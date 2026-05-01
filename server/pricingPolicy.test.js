import { describe, expect, it } from "vitest";
import { applyNineEndingPricing } from "./pricingPolicy.js";

describe("nine-ending pricing policy", () => {
  it("moves IQD selling prices to the next 9,000 ending inside the ten-thousand band", () => {
    expect(applyNineEndingPricing(65000)).toBe(69000);
    expect(applyNineEndingPricing(75000)).toBe(79000);
    expect(applyNineEndingPricing(495000)).toBe(499000);
  });

  it("keeps already compliant prices and moves overflow into the next band", () => {
    expect(applyNineEndingPricing(79000)).toBe(79000);
    expect(applyNineEndingPricing(79900)).toBe(89000);
    expect(applyNineEndingPricing(0)).toBe(0);
  });
});
