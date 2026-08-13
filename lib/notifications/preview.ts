import { SKETCHMAP_CONTENT_ID } from "./mapAttachment";
import { renderReservationEmail, type RenderEmailOptions } from "./templates/email";
import type { ReservationNotificationPayload } from "./types";

export interface EmailPreview {
  subject: string;
  html: string;
}

/**
 * Same renderer the real send uses, but with the map's `cid:` reference
 * rewritten to the public `/sketchmap.png` path — a `cid:` URL only
 * resolves inside a received email's own attachment context, not in a
 * browser tab previewing the HTML, so the admin preview would otherwise
 * show a broken image for the exact same markup that renders correctly
 * once actually delivered.
 */
export async function renderEmailPreview(
  payload: ReservationNotificationPayload,
  options: RenderEmailOptions = {},
): Promise<EmailPreview> {
  const rendered = await renderReservationEmail(payload, options);
  const html = rendered.html.split(`cid:${SKETCHMAP_CONTENT_ID}`).join("/sketchmap.png");
  return { subject: rendered.subject, html };
}
