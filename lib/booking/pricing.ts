import type { AppLocale } from "@/i18n/routing";

/** Deposit charged per guest, in KRW. */
export const DEPOSIT_PER_GUEST = 10_000;

export function calculateTotalAmount(pricePerPerson: number, guestCount: number): number {
  return pricePerPerson * guestCount;
}

export function calculateDepositAmount(guestCount: number): number {
  return DEPOSIT_PER_GUEST * guestCount;
}

export function calculateRemainingAmount(totalAmount: number, depositAmount: number): number {
  return totalAmount - depositAmount;
}

/** Locale-aware KRW formatting, e.g. "₩280,000". */
export function formatCurrency(amount: number, locale: AppLocale): string {
  return new Intl.NumberFormat(localeToIntlTag(locale), {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(amount);
}

function localeToIntlTag(locale: AppLocale): string {
  switch (locale) {
    case "zh":
      return "zh-CN";
    default:
      return locale;
  }
}
