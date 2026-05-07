import { describe, expect, it } from "vitest";
import type { Product } from "@/data/catalog";
import { buildEdioOrderDraft, normalizePhone, validateEdioOrderDraft } from "./edioOrder";

const cartItems = [
  {
    id: "fosi-k7",
    quantity: 1,
    product: {
      id: "fosi-k7",
      slug: "fosi-k7",
      name: { en: "Fosi Audio K7", ar: "Fosi Audio K7" },
      brand: "Fosi Audio",
      category: "dac-amp",
      subCategories: [],
      tagline: { en: "", ar: "" },
      price: 249000,
      compareAt: null,
      currency: "IQD",
      image: "/products/fosi-k7.jpg",
      gallery: ["/products/fosi-k7.jpg"],
      badge: null,
      specs: {},
      features: [],
      inStock: true,
    } as unknown as Product,
  },
];

describe("Edio order checkout storage", () => {
  it("normalizes international phone numbers without requiring Alwaseet IDs", () => {
    expect(normalizePhone("7700000000")).toBe("+9647700000000");
    expect(normalizePhone("+9647712345678")).toBe("+9647712345678");
    expect(normalizePhone("971501234567")).toBe("+971501234567");
  });

  it("builds a backend order draft with optional email and address fields", () => {
    const draft = buildEdioOrderDraft({
      orderNumber: "EDIO-TEST-1",
      customerName: "  Yousif  ",
      customerEmail: " USER@EXAMPLE.COM ",
      primaryPhone: "+9647712345678",
      secondaryPhone: "",
      province: "Baghdad",
      region: "Mansour",
      nearestPoint: "",
      fullAddress: "",
      notes: "Call before delivery",
      items: cartItems,
      subtotal: 249000,
      discount: 0,
      deliveryPrice: 0,
      totalPrice: 249000,
    });

    expect(draft.customerName).toBe("Yousif");
    expect(draft.customerEmail).toBe("user@example.com");
    expect(draft.paymentMethod).toBe("qi_card");
    expect(draft.items[0].productId).toBe("fosi-k7");
    expect(draft.nearestPoint).toBeUndefined();
    expect(validateEdioOrderDraft(draft).ok).toBe(true);
  });

  it("keeps cash on delivery available as an explicit secondary option", () => {
    const draft = buildEdioOrderDraft({
      orderNumber: "EDIO-TEST-COD",
      customerName: "Yousif",
      primaryPhone: "+9647712345678",
      province: "Baghdad",
      region: "Mansour",
      items: cartItems,
      subtotal: 249000,
      discount: 0,
      deliveryPrice: 0,
      totalPrice: 249000,
      paymentMethod: "cod",
    });

    expect(draft.paymentMethod).toBe("cod");
    expect(validateEdioOrderDraft(draft).ok).toBe(true);
  });

  it("rejects missing required local storage fields", () => {
    const draft = buildEdioOrderDraft({
      orderNumber: "EDIO-TEST-2",
      customerName: "",
      customerEmail: "bad-email",
      primaryPhone: "abc",
      province: "",
      region: "",
      items: [],
      subtotal: 0,
      discount: 0,
      deliveryPrice: 0,
      totalPrice: 0,
    });

    const result = validateEdioOrderDraft(draft);
    expect(result.ok).toBe(false);
    expect(result.errors.customerName).toBeTruthy();
    expect(result.errors.customerEmail).toBeTruthy();
    expect(result.errors.primaryPhone).toBeTruthy();
    expect(result.errors.province).toBeTruthy();
    expect(result.errors.region).toBeTruthy();
    expect(result.errors.items).toBeTruthy();
  });
});
