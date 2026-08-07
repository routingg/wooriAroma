export interface DepositChargeRequest {
  amount: number;
  currency: "KRW";
  reservationNumber: string;
  customerName: string;
  customerEmail: string;
}

export type DepositChargeResult =
  | { success: true; transactionId: string }
  | { success: false; errorCode: string };

/**
 * Anything that can take a deposit payment. Swap `mockPaymentProvider`
 * for a Toss Payments / Stripe implementation of this interface when
 * a real gateway is wired up — no caller code needs to change.
 */
export interface PaymentProvider {
  chargeDeposit(request: DepositChargeRequest): Promise<DepositChargeResult>;
}
