import { describe, expect, it } from "vitest";
import { getPublicStockDisplay } from "./publicStock";

describe("public stock display", () => {
  it("hides exact quantities above the low-stock threshold", () => {
    expect(getPublicStockDisplay({ availableQuantity: 10, inStock: true, locale: "ar" })).toMatchObject({
      label: "متوفر",
      lowStock: false,
      visibleQuantity: null,
    });
    expect(getPublicStockDisplay({ availableQuantity: 4, inStock: true, locale: "en" })).toMatchObject({
      label: "In stock",
      lowStock: false,
      visibleQuantity: null,
    });
  });

  it("only exposes quantities when three or fewer remain", () => {
    expect(getPublicStockDisplay({ availableQuantity: 3, inStock: true, locale: "ar" })).toMatchObject({
      label: "باقي 3 قطع فقط",
      lowStock: true,
      visibleQuantity: 3,
    });
    expect(getPublicStockDisplay({ availableQuantity: 2, inStock: true, locale: "ar" })).toMatchObject({
      label: "باقي قطعتين فقط",
      lowStock: true,
      visibleQuantity: 2,
    });
    expect(getPublicStockDisplay({ availableQuantity: 1, inStock: true, locale: "ar" })).toMatchObject({
      label: "باقي قطعة واحدة فقط",
      lowStock: true,
      visibleQuantity: 1,
    });
  });

  it("handles unavailable and special availability states", () => {
    expect(getPublicStockDisplay({ availableQuantity: 0, inStock: false, locale: "ar" }).label).toBe("غير متوفر");
    expect(getPublicStockDisplay({ availabilityStatus: "pre_order", locale: "ar" }).label).toBe("طلب مسبق");
    expect(getPublicStockDisplay({ availabilityStatus: "discontinued", locale: "ar" }).label).toBe("لم يعد متوفراً");
  });
});
