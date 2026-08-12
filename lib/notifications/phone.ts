import { parsePhoneNumberWithError } from "libphonenumber-js/min";

/**
 * Server-only phone parsing. Never import this from a "use client" component —
 * libphonenumber-js's metadata is unnecessary client-bundle weight for a
 * decision (Korean vs. international) the UI only needs a cheap heuristic for
 * (see DetailsStep's own lightweight `looksLikeKoreanPhone`).
 */

export interface NormalizedPhone {
  /** E.164, e.g. "+821012345678". */
  e164: string;
  /** ISO 3166-1 alpha-2 country, e.g. "KR". Undefined if undetectable. */
  country: string | undefined;
  isKorean: boolean;
}

/**
 * Normalizes free-form input ("010-1234-5678", "+82 10 1234 5678",
 * "821012345678") to E.164. Assumes Korean numbers without an explicit "+"
 * are domestic (matches the booking form's placeholder/expectation) —
 * everything else must already carry a country code to parse correctly.
 * Returns null if the number can't be parsed into a valid E.164 number;
 * callers must treat that as "can't message this channel", never throw.
 */
export function normalizePhone(raw: string): NormalizedPhone | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Already carries a country code ("+82 10...", "82 10..." without a
  // leading "+" is ambiguous with a domestic number, so only the explicit
  // "+" form is trusted here) — let libphonenumber-js detect the country.
  if (trimmed.startsWith("+")) {
    const parsed = tryParse(trimmed, undefined);
    return parsed;
  }

  // Bare domestic input ("010-1234-5678") has no country code at all — the
  // booking form's placeholder/expectation is Korean, so default to KR.
  return tryParse(trimmed, "KR");
}

function tryParse(candidate: string, defaultCountry: "KR" | undefined): NormalizedPhone | null {
  try {
    const parsed = parsePhoneNumberWithError(candidate, defaultCountry);
    if (!parsed.isValid()) return null;
    return { e164: parsed.number, country: parsed.country, isKorean: parsed.country === "KR" };
  } catch {
    return null;
  }
}

/** True if the number is a valid, parseable Korean (+82) number. */
export function isKoreanPhone(raw: string): boolean {
  return normalizePhone(raw)?.isKorean ?? false;
}
