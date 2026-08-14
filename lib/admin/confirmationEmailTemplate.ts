import { getTranslations } from "next-intl/server";
import { getService, getServiceOption } from "@/data/services";
import { formatTimeLabel } from "@/lib/booking/time";
import { BUSINESS, confirmationEmailMapsUrl } from "@/lib/config/business";
import type { CustomerRecord } from "@/lib/repositories/customerRepository";
import type { ReservationRecord } from "@/lib/repositories/reservationRepository";

export const DEFAULT_CONFIRMATION_SUBJECT = "Your Reservation is Confirmed – Woori Aroma";
export const DEFAULT_INTRO_TEXT = "Thank you for choosing Woori Aroma for your time in Jeju.";
export const DEFAULT_CONFIRM_TEXT = "We are pleased to confirm your reservation.";
export const DEFAULT_PRIVACY_TEXT =
  "Woori Aroma welcomes only one group at a time, allowing you to enjoy a quiet and completely private experience.";
export const DEFAULT_VISIT_TEXT =
  "Please arrive at the scheduled time. If you need to change your reservation, please contact us in advance.";
export const DEFAULT_CLOSING_TEXT = "We look forward to welcoming you to Woori Aroma.";

export interface ConfirmationEmailInput {
  subject: string;
  customerName: string;
  /** Pre-formatted, English, e.g. "Friday, August 14, 2026". Omitted from the email if blank. */
  dateLabel: string;
  /** Pre-formatted, English, e.g. "3:00 PM". Omitted from the email if blank. */
  timeLabel: string;
  treatmentName: string;
  durationMinutes: number;
  guestCount: number;
  introText: string;
  confirmText: string;
  /** "프라이빗 스파 안내" — admin-editable (was fixed brand copy; see AGENTS.md). */
  privacyText: string;
  visitText: string;
  closingText: string;
}

export interface GeneratedConfirmationEmail {
  subject: string;
  html: string;
  plainText: string;
}

/**
 * Reservation fields that are NOT admin-editable — resolved once from
 * trusted server data. Split out from ConfirmationEmailInput so the admin
 * UI only ever edits the four free-text blocks (인사말/예약 안내 문구/방문
 * 안내/마무리 문구); date/time/treatment/guests always come from the
 * reservation record itself.
 */
export interface ConfirmationEmailReservationFields {
  customerName: string;
  dateLabel: string;
  timeLabel: string;
  treatmentName: string;
  durationMinutes: number;
  guestCount: number;
}

/**
 * Resolves the reservation-derived (non-editable) fields for the
 * confirmation email — always in English regardless of the reservation's
 * site locale, since this is written for international guests. Returns
 * null when the service/option can no longer be resolved, matching the
 * existing "incomplete data" guard on the reservation detail page.
 */
export async function resolveConfirmationEmailFields(
  reservation: ReservationRecord,
  customer: CustomerRecord,
): Promise<ConfirmationEmailReservationFields | null> {
  const option = getServiceOption(reservation.serviceOptionId);
  const service = option ? getService(option.serviceId) : undefined;
  if (!option || !service) return null;

  const t = await getTranslations({ locale: "en", namespace: "services" });
  const treatmentName = t(service.nameKey.replace("services.", ""));

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${reservation.dateKey}T00:00:00`));
  const timeLabel = formatTimeLabel(reservation.serviceStart, "en");

  return {
    customerName: customer.name,
    dateLabel,
    timeLabel,
    treatmentName,
    durationMinutes: reservation.durationMinutes,
    guestCount: reservation.guestCount,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "Jane Doe" -> "Jane". Never invents a name — falls back to "Guest". */
function firstNameOf(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0];
}

/**
 * Single source of truth for the admin's "copy & send via Gmail"
 * confirmation email. Pure and synchronous so the exact same call renders
 * the live admin preview AND produces what gets copied to the clipboard —
 * preview and copy can never drift apart (AGENTS.md §23). Any detail-card
 * row whose value is missing/empty is omitted, never rendered as
 * "undefined"/"null"/empty.
 */
export function generateConfirmationEmail(input: ConfirmationEmailInput): GeneratedConfirmationEmail {
  const greeting = (() => {
    const firstName = firstNameOf(input.customerName);
    return firstName ? `Dear ${firstName},` : "Dear Guest,";
  })();

  const detailRows: [string, string][] = [];
  if (input.dateLabel) detailRows.push(["Date", input.dateLabel]);
  if (input.timeLabel) detailRows.push(["Time", input.timeLabel]);
  if (input.treatmentName) detailRows.push(["Treatment", input.treatmentName]);
  if (input.durationMinutes) detailRows.push(["Duration", `${input.durationMinutes} minutes`]);
  if (input.guestCount) detailRows.push(["Guests", String(input.guestCount)]);

  return {
    subject: input.subject,
    html: renderHtml(input, greeting, detailRows),
    plainText: renderPlainText(input, greeting, detailRows),
  };
}

function renderHtml(input: ConfirmationEmailInput, greeting: string, detailRows: [string, string][]): string {
  const { introText, confirmText, privacyText, visitText, closingText } = input;

  const detailRowsHtml = detailRows
    .map(
      ([label, value], index) => `
                        <tr>
                          <td style="padding:${index === 0 ? "0" : "16px"} 0 6px;color:#a9855f;font-size:11px;letter-spacing:1.5px;font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;${
                            index > 0 ? "border-top:1px solid #ece5d8;" : ""
                          }">${escapeHtml(label)}</td>
                        </tr>
                        <tr>
                          <td style="padding:0;color:#3a332a;font-size:16px;font-weight:700;font-family:Georgia,'Times New Roman',serif;">${escapeHtml(value)}</td>
                        </tr>`,
    )
    .join("");

  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f5f2ec;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f2ec;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:20px;border:1px solid #ece5d8;">
            <tr>
              <td style="background-color:#f7f2ea;padding:40px 40px 32px;text-align:center;border-radius:20px 20px 0 0;border-bottom:1px solid #ece5d8;">
                <p style="margin:0;color:#a9855f;font-size:13px;letter-spacing:5px;font-family:Arial,Helvetica,sans-serif;">WOORI AROMA</p>
                <p style="margin:10px 0 0;color:#8a7f6d;font-size:11px;letter-spacing:2px;font-family:Arial,Helvetica,sans-serif;">PRIVATE WELLNESS IN JEJU</p>
                <p style="margin:22px 0 0;color:#3a332a;font-size:23px;line-height:1.4;font-family:Georgia,'Times New Roman',serif;">Your Reservation is Confirmed</p>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 40px 0;">
                <p style="margin:0 0 16px;color:#3a332a;font-size:15px;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(greeting)}</p>
                ${introText ? `<p style="margin:0 0 14px;color:#57503f;font-size:14px;line-height:1.75;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(introText)}</p>` : ""}
                ${confirmText ? `<p style="margin:0;color:#57503f;font-size:14px;line-height:1.75;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(confirmText)}</p>` : ""}
              </td>
            </tr>
            ${
              privacyText
                ? `<tr>
              <td style="padding:18px 40px 0;">
                <p style="margin:0;color:#a9855f;font-size:13px;line-height:1.7;font-style:italic;font-family:Georgia,'Times New Roman',serif;">${escapeHtml(privacyText)}</p>
              </td>
            </tr>`
                : ""
            }
            ${
              detailRows.length > 0
                ? `<tr>
              <td style="padding:28px 40px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf7f1;border:1px solid #ece5d8;border-radius:14px;">
                  <tr>
                    <td style="padding:26px 28px;">
                      <p style="margin:0 0 14px;color:#3a332a;font-size:11px;letter-spacing:2px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">RESERVATION DETAILS</p>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        ${detailRowsHtml}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`
                : ""
            }
            ${
              visitText
                ? `<tr>
              <td style="padding:28px 40px 0;">
                <p style="margin:0;color:#57503f;font-size:13px;line-height:1.75;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(visitText)}</p>
              </td>
            </tr>`
                : ""
            }
            ${
              closingText
                ? `<tr>
              <td style="padding:20px 40px 0;">
                <p style="margin:0;color:#3a332a;font-size:14px;line-height:1.75;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(closingText)}</p>
              </td>
            </tr>`
                : ""
            }
            <tr>
              <td style="padding:32px 40px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #ece5d8;">
                  <tr>
                    <td style="padding:24px 0 0;">
                      <p style="margin:0 0 14px;color:#3a332a;font-size:13px;font-weight:700;font-family:Arial,Helvetica,sans-serif;">Need help with your reservation?</p>
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding:0 16px 8px 0;color:#8a7f6d;font-size:12px;font-family:Arial,Helvetica,sans-serif;">Instagram</td>
                          <td style="padding:0 0 8px;">
                            <a href="${escapeHtml(BUSINESS.instagramUrl)}" target="_blank" style="color:#a9855f;font-size:13px;font-weight:600;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(BUSINESS.instagramHandle)}</a>
                          </td>
                        </tr>
                        ${
                          BUSINESS.phone && BUSINESS.phoneHref
                            ? `<tr>
                          <td style="padding:0 16px 0 0;color:#8a7f6d;font-size:12px;font-family:Arial,Helvetica,sans-serif;">Phone</td>
                          <td style="padding:0;">
                            <a href="${escapeHtml(BUSINESS.phoneHref)}" style="color:#a9855f;font-size:13px;font-weight:600;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(BUSINESS.phone)}</a>
                          </td>
                        </tr>`
                            : ""
                        }
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 0 0;">
                      <a href="${escapeHtml(confirmationEmailMapsUrl)}" target="_blank" style="display:inline-block;padding:12px 18px;border:1px solid #c9bca8;border-radius:8px;text-decoration:none;color:#554b40;font-weight:600;font-size:13px;font-family:Arial,Helvetica,sans-serif;">View on Google Maps</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:28px 40px 40px;">
                <p style="margin:0;color:#3a332a;font-size:13px;font-weight:700;letter-spacing:0.5px;font-family:Georgia,'Times New Roman',serif;">${escapeHtml(BUSINESS.name)}</p>
                <p style="margin:5px 0 0;color:#8a7f6d;font-size:12px;font-family:Arial,Helvetica,sans-serif;">Jeju, Korea</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();
}

function renderPlainText(input: ConfirmationEmailInput, greeting: string, detailRows: [string, string][]): string {
  const { introText, confirmText, privacyText, visitText, closingText } = input;
  const paragraphs: string[] = [greeting];

  if (introText) paragraphs.push(introText);
  if (confirmText) paragraphs.push(confirmText);
  if (privacyText) paragraphs.push(privacyText);

  if (detailRows.length > 0) {
    paragraphs.push(
      ["Reservation Details", "", ...detailRows.map(([label, value]) => `${label}: ${value}`)].join("\n"),
    );
  }

  if (visitText) paragraphs.push(visitText);
  if (closingText) paragraphs.push(closingText);

  const signatureLines = [BUSINESS.name, "Jeju, Korea", "", `Instagram: ${BUSINESS.instagramHandle}`];
  if (BUSINESS.phone) signatureLines.push(`Phone: ${BUSINESS.phone}`);
  signatureLines.push(`Google Maps:\n${confirmationEmailMapsUrl}`);
  paragraphs.push(signatureLines.join("\n"));

  return paragraphs.join("\n\n");
}
