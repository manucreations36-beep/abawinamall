import { describe, expect, it } from "vitest";
import { MPESA_CODE_RE } from "./store-config";
import {
  canRejectPayment,
  canVerifyPayment,
  isValidRefundAmount,
  paymentStatusAfterRefund,
  remainingRefundable,
} from "./payments";

describe("M-Pesa transaction code format", () => {
  it("accepts a 10-character uppercase alphanumeric code", () => {
    expect(MPESA_CODE_RE.test("QK7X2AB91Z")).toBe(true);
  });

  it("rejects lowercase, short, long and special-character codes", () => {
    expect(MPESA_CODE_RE.test("qk7x2ab91z")).toBe(false);
    expect(MPESA_CODE_RE.test("QK7X2AB91")).toBe(false);
    expect(MPESA_CODE_RE.test("QK7X2AB91ZZ")).toBe(false);
    expect(MPESA_CODE_RE.test("QK7X2AB9!Z")).toBe(false);
    expect(MPESA_CODE_RE.test("")).toBe(false);
  });
});

describe("payment verification transitions", () => {
  it("allows verification from unpaid, awaiting_verification and failed", () => {
    expect(canVerifyPayment("unpaid")).toBe(true);
    expect(canVerifyPayment("awaiting_verification")).toBe(true);
    expect(canVerifyPayment("failed")).toBe(true);
  });

  it("never allows verifying an already paid or refunded order", () => {
    expect(canVerifyPayment("paid")).toBe(false);
    expect(canVerifyPayment("partially_refunded")).toBe(false);
    expect(canVerifyPayment("refunded")).toBe(false);
  });

  it("only allows rejection while awaiting verification", () => {
    expect(canRejectPayment("awaiting_verification")).toBe(true);
    expect(canRejectPayment("unpaid")).toBe(false);
    expect(canRejectPayment("paid")).toBe(false);
    expect(canRejectPayment("failed")).toBe(false);
  });
});

describe("refund amounts", () => {
  it("caps the refundable amount at the order total minus prior refunds", () => {
    expect(remainingRefundable(1000, 0)).toBe(1000);
    expect(remainingRefundable(1000, 400)).toBe(600);
    expect(remainingRefundable(1000, 1000)).toBe(0);
  });

  it("rejects zero, negative and over-total refunds", () => {
    expect(isValidRefundAmount(0, 1000, 0)).toBe(false);
    expect(isValidRefundAmount(-50, 1000, 0)).toBe(false);
    expect(isValidRefundAmount(1001, 1000, 0)).toBe(false);
    expect(isValidRefundAmount(700, 1000, 400)).toBe(false);
  });

  it("distinguishes partial and full refunds", () => {
    expect(paymentStatusAfterRefund(400, 1000, 0)).toBe("partially_refunded");
    expect(paymentStatusAfterRefund(600, 1000, 400)).toBe("refunded");
    expect(paymentStatusAfterRefund(1000, 1000, 0)).toBe("refunded");
  });

  it("throws on an invalid refund instead of producing a status", () => {
    expect(() => paymentStatusAfterRefund(0, 1000, 0)).toThrow();
    expect(() => paymentStatusAfterRefund(700, 1000, 400)).toThrow();
  });
});
