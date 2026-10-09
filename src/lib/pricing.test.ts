import { describe, expect, it } from "vitest";
import { effectivePrice, isFlashLive, compareAtPrice } from "./pricing";

const now = new Date("2026-10-08T12:00:00Z");

describe("flash deal pricing", () => {
  it("uses the flash price while the deal is running", () => {
    const p = { price: 1000, flash_price: 800, flash_ends_at: "2026-10-09T00:00:00Z" };
    expect(isFlashLive(p, now)).toBe(true);
    expect(effectivePrice(p, now)).toBe(800);
    expect(compareAtPrice(p, now)).toBe(1000);
  });

  it("falls back to the normal price after the deal ends", () => {
    const p = { price: 1000, flash_price: 800, flash_ends_at: "2026-10-08T11:00:00Z" };
    expect(isFlashLive(p, now)).toBe(false);
    expect(effectivePrice(p, now)).toBe(1000);
  });

  it("ignores a flash price that is not lower than the normal price", () => {
    const p = { price: 1000, flash_price: 1200, flash_ends_at: "2026-10-09T00:00:00Z" };
    expect(effectivePrice(p, now)).toBe(1000);
  });
});
