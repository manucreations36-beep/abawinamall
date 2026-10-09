/**
 * Payment and refund business rules for the manual M-Pesa workflow.
 * These mirror the server-side checks in the database functions
 * (verify_payment, reject_payment, resolve_return) so the UI can
 * show valid actions before calling the server. The server remains
 * the source of truth.
 */

export const PAYMENT_STATUSES = [
  "unpaid",
  "awaiting_verification",
  "paid",
  "failed",
  "partially_refunded",
  "refunded",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** A payment can only be verified while unpaid, awaiting verification, or previously failed. */
export function canVerifyPayment(status: PaymentStatus): boolean {
  return status === "unpaid" || status === "awaiting_verification" || status === "failed";
}

/** A payment can only be rejected while it awaits verification. */
export function canRejectPayment(status: PaymentStatus): boolean {
  return status === "awaiting_verification";
}

/** The most that can still be refunded for an order. */
export function remainingRefundable(total: number, refundedAmount: number): number {
  return Math.max(0, total - refundedAmount);
}

/** A refund must be positive and no more than the remaining refundable amount. */
export function isValidRefundAmount(
  amount: number,
  total: number,
  refundedAmount: number,
): boolean {
  return amount > 0 && amount <= remainingRefundable(total, refundedAmount);
}

/** The payment status that results from a refund of `amount`. */
export function paymentStatusAfterRefund(
  amount: number,
  total: number,
  refundedAmount: number,
): PaymentStatus {
  if (!isValidRefundAmount(amount, total, refundedAmount)) {
    throw new Error("Invalid refund amount");
  }
  return refundedAmount + amount >= total ? "refunded" : "partially_refunded";
}
