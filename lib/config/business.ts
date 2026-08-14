/**
 * Centralized real business facts (AGENTS.md: keep business URLs
 * centralized rather than scattering them through JSX). Only documented
 * facts from proposal.md/README.md go here — no invented phone/WhatsApp
 * number, since none has been provided and a fake one would mislead
 * customers into contacting a channel that doesn't exist.
 */
export const BUSINESS = {
  name: "Woori Aroma",
  nameKo: "우리같이아로마",
  addressEn: "285 Jungmungwangwang-ro, Jungmun-dong, Seogwipo-si, Jeju-do, South Korea",
  addressKo: "제주특별자치도 서귀포시 중문관광로 285",
  instagramUrl: "https://www.instagram.com/aromatogether/",
  instagramHandle: "@aromatogether",
  /** Short display address for the "/" footer — addressEn above stays canonical for confirmation/ICS/email. */
  addressLines: ["285 Jungmungwangwang-ro", "Seogwipo-si, Jeju, South Korea"],
  phone: "+82 64-738-6140",
  phoneHref: "tel:+82647386140",
} as const;

/** Plain Google Maps search link — no API key required, uses the real documented address. */
export function googleMapsUrl(): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(BUSINESS.addressEn)}`;
}

/** Direct Google Maps pin link for the "/" footer CTA (distinct from the search-query link above). */
export const googleMapsPinUrl = "https://maps.app.goo.gl/ozNriq55tKG9qPAs5?g_st=ac";

/**
 * Google Maps link for admin-composed confirmation emails (lib/admin/confirmationEmailTemplate.ts) —
 * a distinct short link supplied specifically for that feature, different
 * from googleMapsUrl()'s computed search-query link and the "/" footer's
 * googleMapsPinUrl above. Kept as its own constant rather than reusing
 * either, per explicit instruction to use this exact URL for emails.
 */
export const confirmationEmailMapsUrl = "https://maps.app.goo.gl/RQt5BTpazJTQ4WPV8";
