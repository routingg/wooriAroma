import { createHmac, randomBytes } from "node:crypto";
import { normalizePhone } from "../phone";
import { logFailure, notConfigured } from "../devLog";
import { buildKakaoVariables, buildSmsText } from "../templates/korean";
import type { KoreanMessagingProvider, NotificationResult, ReservationNotificationPayload } from "../types";

const SOLAPI_ENDPOINT = "https://api.solapi.com/messages/v4/send";
const REQUEST_TIMEOUT_MS = 10_000;
const KAKAO_PROVIDER = "solapi-kakao";
const SMS_PROVIDER = "solapi-sms";

interface SolapiConfig {
  apiKey: string;
  apiSecret: string;
  senderNumber: string;
  pfId?: string;
  templateId?: string;
}

function readConfig(): SolapiConfig | null {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const senderNumber = process.env.SOLAPI_SENDER_NUMBER;
  if (!apiKey || !apiSecret || !senderNumber) return null;
  return {
    apiKey,
    apiSecret,
    senderNumber,
    pfId: process.env.SOLAPI_KAKAO_PFID,
    templateId: process.env.SOLAPI_KAKAO_TEMPLATE_ID,
  };
}

/** SOLAPI expects domestic Korean numbers with no "+82" and a leading 0, e.g. "01012345678". */
function toSolapiDomesticFormat(e164: string): string {
  return e164.startsWith("+82") ? `0${e164.slice(3)}` : e164.replace(/\D/g, "");
}

function buildAuthHeader(apiKey: string, apiSecret: string): string {
  const date = new Date().toISOString();
  const salt = randomBytes(16).toString("hex");
  const signature = createHmac("sha256", apiSecret).update(date + salt).digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

async function callSolapi(config: SolapiConfig, message: Record<string, unknown>): Promise<{ id?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(SOLAPI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: buildAuthHeader(config.apiKey, config.apiSecret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
      signal: controller.signal,
    });

    const body = (await response.json().catch(() => ({}))) as {
      messageId?: string;
      errorCode?: string;
      errorMessage?: string;
    };

    if (!response.ok || body.errorCode) {
      throw new Error(`SOLAPI ${response.status}: ${body.errorCode ?? ""} ${body.errorMessage ?? ""}`.trim());
    }

    return { id: body.messageId };
  } finally {
    clearTimeout(timeout);
  }
}

async function sendSms(payload: ReservationNotificationPayload, config: SolapiConfig, to: string): Promise<NotificationResult> {
  try {
    const { id } = await callSolapi(config, {
      to,
      from: config.senderNumber,
      text: buildSmsText(payload),
    });
    return { status: "SENT", provider: SMS_PROVIDER, providerMessageId: id };
  } catch (error) {
    logFailure(SMS_PROVIDER, payload.event, payload.customerPhone, error);
    return { status: "FAILED", provider: SMS_PROVIDER, reason: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * SOLAPI: Kakao AlimTalk first, automatic SMS fallback only when Kakao is
 * unavailable or fails — never both on a successful Kakao send, to avoid
 * double-messaging and double cost (§25 cost-awareness). Returns one result
 * per channel actually touched (1 or 2 entries) so the admin dashboard can
 * show "SMS — Not needed" vs. "SMS ✓ Fallback sent" per §16 of the spec.
 */
export const koreanMessagingProvider: KoreanMessagingProvider = {
  async send(payload: ReservationNotificationPayload): Promise<NotificationResult[]> {
    const config = readConfig();
    const normalized = normalizePhone(payload.customerPhone);
    if (!normalized) {
      const reason = "invalid_phone_number";
      return [
        { status: "SKIPPED", provider: KAKAO_PROVIDER, reason },
        { status: "SKIPPED", provider: SMS_PROVIDER, reason },
      ];
    }
    const to = toSolapiDomesticFormat(normalized.e164);

    if (!config) {
      return [notConfigured(KAKAO_PROVIDER, payload.event, payload.customerPhone)];
    }

    if (!config.pfId || !config.templateId) {
      const kakaoSkipped = notConfigured(KAKAO_PROVIDER, payload.event, payload.customerPhone);
      return [kakaoSkipped, await sendSms(payload, config, to)];
    }

    try {
      const { id } = await callSolapi(config, {
        to,
        from: config.senderNumber,
        kakaoOptions: {
          pfId: config.pfId,
          templateId: config.templateId,
          variables: buildKakaoVariables(payload),
          disableSms: true,
        },
      });
      const kakaoSent: NotificationResult = { status: "SENT", provider: KAKAO_PROVIDER, providerMessageId: id };
      const smsNotNeeded: NotificationResult = { status: "SKIPPED", provider: SMS_PROVIDER, reason: "not_needed" };
      return [kakaoSent, smsNotNeeded];
    } catch (error) {
      logFailure(KAKAO_PROVIDER, payload.event, payload.customerPhone, error);
      const kakaoFailed: NotificationResult = {
        status: "FAILED",
        provider: KAKAO_PROVIDER,
        reason: error instanceof Error ? error.message : String(error),
      };
      return [kakaoFailed, await sendSms(payload, config, to)];
    }
  },
};
