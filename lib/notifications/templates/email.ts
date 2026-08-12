import { getTranslations } from "next-intl/server";
import { BUSINESS, googleMapsUrl } from "@/lib/config/business";
import { formatCurrency } from "@/lib/booking/pricing";
import { formatTimeLabel } from "@/lib/booking/time";
import type { ReservationNotificationPayload } from "../types";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * One shared HTML shell for all 4 events — table-based layout with inlined
 * styles, since that's what actually renders consistently across email
 * clients (Gmail/Outlook strip <style> blocks and flexbox/grid). Kept to a
 * single column, generous tap targets, and a max-width of 480px so it reads
 * cleanly on a phone without a media query.
 */
export async function renderReservationEmail(payload: ReservationNotificationPayload): Promise<RenderedEmail> {
  const t = await getTranslations({ locale: payload.preferredLanguage, namespace: "notifications.email" });

  const dateLabel = new Intl.DateTimeFormat(payload.preferredLanguage, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${payload.date}T00:00:00`));
  const timeLabel = formatTimeLabel(payload.time, payload.preferredLanguage);

  const subject = t(`subject.${payload.event}`, { reservationNumber: payload.reservationNumber });
  const heading = t(`heading.${payload.event}`);
  const intro = t(`intro.${payload.event}`, { name: payload.customerName });

  const rows: [string, string][] = [
    [t("reservationNumber"), payload.reservationNumber],
    [t("date"), dateLabel],
    [t("time"), timeLabel],
    [t("treatment"), payload.treatmentName],
    [t("duration"), `${payload.durationMinutes} min`],
    [t("guests"), String(payload.guestCount)],
  ];

  if (payload.event !== "RESERVATION_CANCELLED") {
    rows.push(
      [t("totalAmount"), formatCurrency(payload.totalAmount, payload.preferredLanguage)],
      [t("depositPaid"), formatCurrency(payload.depositAmount, payload.preferredLanguage)],
      [t("remainingBalance"), formatCurrency(payload.remainingAmount, payload.preferredLanguage)],
    );
  }

  const rowsHtml = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:6px 0;color:#78716c;font-size:14px;">${escapeHtml(label)}</td>
          <td style="padding:6px 0;color:#1c1917;font-size:14px;font-weight:600;text-align:right;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  const rowsText = rows.map(([label, value]) => `${label}: ${value}`).join("\n");

  const mapsUrl = googleMapsUrl();
  const html = `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f4;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background-color:#1c1917;padding:28px 24px;text-align:center;">
                <span style="color:#fafaf9;font-size:13px;letter-spacing:2px;">WOORI AROMA</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 24px 8px;">
                <h1 style="margin:0 0 8px;color:#1c1917;font-size:20px;">${escapeHtml(heading)}</h1>
                <p style="margin:0 0 20px;color:#57534e;font-size:14px;line-height:1.5;">${escapeHtml(intro)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e7e5e4;border-bottom:1px solid #e7e5e4;padding:8px 0;">
                  ${rowsHtml}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px 4px;">
                <p style="margin:0 0 12px;color:#57534e;font-size:13px;line-height:1.6;">${escapeHtml(t("changeInstructions"))}</p>
                <a href="${escapeHtml(BUSINESS.instagramUrl)}" style="display:inline-block;margin-right:8px;margin-bottom:8px;padding:10px 16px;border:1px solid #d6d3d1;border-radius:999px;color:#1c1917;font-size:13px;text-decoration:none;">${escapeHtml(t("contactInstagram"))}</a>
                <a href="${escapeHtml(mapsUrl)}" style="display:inline-block;margin-bottom:8px;padding:10px 16px;border:1px solid #d6d3d1;border-radius:999px;color:#1c1917;font-size:13px;text-decoration:none;">${escapeHtml(t("viewOnMap"))}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 24px;">
                <p style="margin:0;color:#a8a29e;font-size:12px;">${escapeHtml(t("footer"))} · ${escapeHtml(BUSINESS.addressEn)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

  const text = `${heading}\n\n${intro}\n\n${rowsText}\n\n${t("changeInstructions")}\n${BUSINESS.instagramUrl}\n${mapsUrl}\n\n${t("footer")} · ${BUSINESS.addressEn}`;

  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
