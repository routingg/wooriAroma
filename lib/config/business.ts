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
} as const;

/** Plain Google Maps search link — no API key required, uses the real documented address. */
export function googleMapsUrl(): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(BUSINESS.addressEn)}`;
}
