import { describe, expect, it } from "vitest";
import {
  buildAlwaseetMerchantPayloadPreview,
  buildAlwaseetCheckoutDraft,
  maskPhone,
  normalizeIraqiPhone,
  normalizePhone,
  validateAlwaseetCheckoutDraft,
} from "./alwaseet";

const product = {
  id: "iem-1",
  name: { en: "Test IEM", ar: "سماعة اختبار" },
  brand: "Edio",
  price: 100000,
} as never;

describe("alwaseet checkout helpers", () => {
  it("normalizes Iraqi phone numbers to the Alwaseet +9647 format", () => {
    expect(normalizeIraqiPhone("0770 000 0000")).toBe("+9647700000000");
    expect(normalizeIraqiPhone("7700000000")).toBe("+9647700000000");
    expect(normalizeIraqiPhone("+9647700000000")).toBe("+9647700000000");
    expect(normalizeIraqiPhone("123")).toBeNull();
  });

  it("masks phones for safe display/logging", () => {
    expect(maskPhone("07700000000")).toBe("+964770***000");
  });

  it("accepts international E.164 phone numbers", () => {
    expect(normalizePhone("7700000000")).toBe("+9647700000000");
    expect(normalizePhone("+12025550123")).toBe("+12025550123");
    expect(normalizePhone("0012025550123")).toBe("+12025550123");
  });

  it("validates required customer, city, region, package, and order fields", () => {
    const draft = buildAlwaseetCheckoutDraft({
      edioOrderId: "EDIO-TEST",
      customerName: "Yousif",
      primaryPhone: "07700000000",
      cityId: 1,
      regionId: 2,
      packageSizeId: 3,
      province: "Baghdad",
      provinceArabic: "بغداد",
      region: "Karrada",
      nearestPoint: "Near main street",
      fullAddress: "Building 1, Street 2",
      items: [{ id: "iem-1", quantity: 1, product }],
      subtotal: 100000,
      discount: 0,
      deliveryPrice: 5000,
      totalPrice: 105000,
    });

    expect(validateAlwaseetCheckoutDraft(draft).ok).toBe(true);
    expect(draft.primaryPhone).toBe("+9647700000000");
    expect(draft.cityId).toBe(1);
    expect(draft.regionId).toBe(2);
    expect(draft.packageSizeId).toBe(3);
    expect(draft.items[0].quantity).toBe(1);
  });

  it("allows optional secondary phone, nearest point, and address", () => {
    const draft = buildAlwaseetCheckoutDraft({
      edioOrderId: "EDIO-TEST",
      customerName: "Yousif",
      primaryPhone: "07700000000",
      cityId: 1,
      regionId: 2,
      packageSizeId: 3,
      province: "Baghdad",
      provinceArabic: "بغداد",
      region: "Karrada",
      nearestPoint: "",
      fullAddress: "",
      items: [{ id: "iem-1", quantity: 1, product }],
      subtotal: 100000,
      discount: 0,
      deliveryPrice: 5000,
      totalPrice: 105000,
    });

    const validation = validateAlwaseetCheckoutDraft(draft);
    const payload = buildAlwaseetMerchantPayloadPreview(draft);

    expect(validation.ok).toBe(true);
    expect(validation.errors.nearestPoint).toBeUndefined();
    expect(validation.errors.fullAddress).toBeUndefined();
    expect(draft.nearestPoint).toBe("سيتم تأكيد أقرب نقطة هاتفياً");
    expect(payload.location).toBe("سيتم تأكيد أقرب نقطة هاتفياً - Karrada - Baghdad");
    expect(payload.client_mobile2).toBeUndefined();
  });

  it("rejects missing region and invalid phone", () => {
    const draft = buildAlwaseetCheckoutDraft({
      edioOrderId: "EDIO-TEST",
      customerName: "Y",
      primaryPhone: "123",
      cityId: 0,
      regionId: 0,
      packageSizeId: 0,
      province: "Baghdad",
      region: "",
      nearestPoint: "",
      fullAddress: "",
      items: [],
      subtotal: 0,
      discount: 0,
      deliveryPrice: 0,
      totalPrice: 0,
    });

    const result = validateAlwaseetCheckoutDraft(draft);
    expect(result.ok).toBe(false);
    expect(result.errors.primaryPhone).toBeTruthy();
    expect(result.errors.cityId).toBeTruthy();
    expect(result.errors.regionId).toBeTruthy();
    expect(result.errors.packageSizeId).toBeTruthy();
    expect(result.errors.region).toBeTruthy();
    expect(result.errors.items).toBeTruthy();
    expect(result.errors.totalPrice).toBeTruthy();
  });

  it("rejects non-positive item quantities before building an Alwaseet request", () => {
    const draft = buildAlwaseetCheckoutDraft({
      edioOrderId: "EDIO-TEST",
      customerName: "Yousif Edio",
      primaryPhone: "07700000000",
      cityId: 13,
      regionId: 1043,
      packageSizeId: 5,
      province: "Baghdad",
      region: "Karrada",
      nearestPoint: "Near main street",
      fullAddress: "Building 1, Street 2",
      items: [{ id: "iem-1", quantity: 0, product }],
      subtotal: 0,
      discount: 0,
      deliveryPrice: 0,
      totalPrice: 0,
    });

    const result = validateAlwaseetCheckoutDraft(draft);
    expect(result.ok).toBe(false);
    expect(result.errors.items).toBeTruthy();
    expect(result.errors.totalPrice).toBeTruthy();
  });

  it("builds the merchant payload from selected Alwaseet IDs and text fields", () => {
    const draft = buildAlwaseetCheckoutDraft({
      edioOrderId: "EDIO-TEST",
      customerName: "Yousif Edio",
      primaryPhone: "07700000000",
      secondaryPhone: "07800000000",
      cityId: 13,
      regionId: 1043,
      packageSizeId: 5,
      province: "Baghdad",
      region: "Karrada",
      nearestPoint: "Near main street",
      fullAddress: "Building 1, Street 2",
      notes: "Call before delivery",
      items: [{ id: "iem-1", quantity: 2, product }],
      subtotal: 200000,
      discount: 0,
      deliveryPrice: 5000,
      totalPrice: 205000,
    });

    const payload = buildAlwaseetMerchantPayloadPreview(draft);

    expect(payload.city_id).toBe(13);
    expect(payload.region_id).toBe(1043);
    expect(payload.package_size).toBe(5);
    expect(payload.location).toBe("Building 1, Street 2 - Near main street - Karrada - Baghdad");
    expect(payload.type_name).toBe("معدات صوتية");
    expect(payload.items_number).toBe(2);
    expect(payload.price).toBe(205000);
    expect(payload.client_mobile).toBe("+9647700000000");
    expect(payload.client_mobile2).toBe("+9647800000000");
    expect(payload.company_order_id).toBeUndefined();
  });

  it("only includes company_order_id when Edio order id is numeric", () => {
    const draft = buildAlwaseetCheckoutDraft({
      edioOrderId: "12345",
      customerName: "Yousif Edio",
      primaryPhone: "07700000000",
      cityId: 13,
      regionId: 1043,
      packageSizeId: 5,
      province: "Baghdad",
      region: "Karrada",
      nearestPoint: "Near main street",
      fullAddress: "Building 1, Street 2",
      items: [{ id: "iem-1", quantity: 1, product }],
      subtotal: 100000,
      discount: 0,
      deliveryPrice: 5000,
      totalPrice: 105000,
    });

    expect(buildAlwaseetMerchantPayloadPreview(draft).company_order_id).toBe(12345);
  });
});
