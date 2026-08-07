import { mockPaymentProvider } from "./mockProvider";
import type { PaymentProvider } from "./types";

export type { DepositChargeRequest, DepositChargeResult, PaymentProvider } from "./types";

/**
 * Central lookup for the active payment provider. Today this always
 * returns the mock provider; once a real gateway is integrated,
 * branch on an env var here (e.g. PAYMENT_PROVIDER=toss) instead of
 * changing every call site.
 */
export function getPaymentProvider(): PaymentProvider {
  return mockPaymentProvider;
}
