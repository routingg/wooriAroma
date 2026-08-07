import type { DepositChargeRequest, DepositChargeResult, PaymentProvider } from "./types";

/**
 * Simulates a successful deposit payment after a short delay, with no
 * real gateway involved. Used until Toss Payments / Stripe is
 * integrated — see PaymentProvider in ./types.ts.
 */
export const mockPaymentProvider: PaymentProvider = {
  async chargeDeposit(request: DepositChargeRequest): Promise<DepositChargeResult> {
    await new Promise((resolve) => setTimeout(resolve, 900));

    return {
      success: true,
      transactionId: `MOCK-${request.reservationNumber}-${Date.now()}`,
    };
  },
};
