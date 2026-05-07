import type { Product } from "@/data/catalog";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabaseConfig";

export type EdioOrderFieldErrors = Partial<
  Record<
    | "customerName"
    | "customerEmail"
    | "primaryPhone"
    | "secondaryPhone"
    | "province"
    | "region"
    | "items"
    | "totalPrice",
    string
  >
>;

export type EdioOrderDraft = {
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  primaryPhone: string;
  secondaryPhone?: string;
  province: string;
  region: string;
  nearestPoint?: string;
  fullAddress?: string;
  notes?: string;
  items: Array<{
    productId: string;
    name: string;
    brand: string;
    quantity: number;
    unitPrice: number;
  }>;
  subtotal: number;
  discount: number;
  deliveryPrice: number;
  totalPrice: number;
  currency: "IQD";
  paymentMethod: "qi_card" | "cod";
  paymentReference?: string;
};

export type EdioOrderSubmissionResult = {
  ok: boolean;
  status: "stored" | "duplicate" | "failed";
  orderId: string;
  message: string;
  backend: "supabase";
  alwaseetDisabled: true;
  code?: string;
  errors?: string[];
};

type CartLineWithProduct = {
  id: string;
  quantity: number;
  product: Product;
};

export function normalizePhone(value: string) {
  const normalizedIraqi = normalizeIraqiPhone(value);
  if (normalizedIraqi) return normalizedIraqi;

  const normalized = value.replace(/[^\d+]/g, "").replace(/^00/, "+");
  if (/^\+[1-9]\d{6,14}$/.test(normalized)) return normalized;

  const onlyDigits = normalized.replace(/\D/g, "");
  if (/^[1-9]\d{6,14}$/.test(onlyDigits)) return `+${onlyDigits}`;

  return null;
}

function normalizeIraqiPhone(value: string) {
  const digits = value.replace(/[^\d+]/g, "").replace(/^00/, "+");
  if (/^\+9647\d{9}$/.test(digits)) return digits;

  const onlyDigits = digits.replace(/\D/g, "");
  if (/^07\d{9}$/.test(onlyDigits)) return `+964${onlyDigits.slice(1)}`;
  if (/^7\d{9}$/.test(onlyDigits)) return `+964${onlyDigits}`;
  if (/^9647\d{9}$/.test(onlyDigits)) return `+${onlyDigits}`;

  return null;
}

function cleanText(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());
}

export function validateEdioOrderDraft(draft: EdioOrderDraft) {
  const errors: EdioOrderFieldErrors = {};

  if (cleanText(draft.customerName, 100).length < 2) {
    errors.customerName = "أدخل اسم الزبون.";
  }
  if (draft.customerEmail && !isValidEmail(draft.customerEmail)) {
    errors.customerEmail = "أدخل بريد إلكتروني صحيح أو اتركه فارغاً.";
  }
  if (!normalizePhone(draft.primaryPhone)) {
    errors.primaryPhone = "أدخل رقم هاتف صحيح.";
  }
  if (draft.secondaryPhone && !normalizePhone(draft.secondaryPhone)) {
    errors.secondaryPhone = "أدخل رقم ثانوي صحيح أو اتركه فارغاً.";
  }
  if (!cleanText(draft.province, 80)) {
    errors.province = "اختر المحافظة.";
  }
  if (cleanText(draft.region, 100).length < 2) {
    errors.region = "أدخل المنطقة أو القضاء.";
  }
  if (!draft.items.length || draft.items.some((item) => item.quantity < 1)) {
    errors.items = "السلة لا تحتوي على منتجات صالحة.";
  }
  if (!Number.isFinite(draft.totalPrice) || draft.totalPrice < 0) {
    errors.totalPrice = "قيمة الطلب غير صالحة.";
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  };
}

export function buildEdioOrderDraft({
  orderNumber,
  customerName,
  customerEmail,
  primaryPhone,
  secondaryPhone,
  province,
  region,
  nearestPoint,
  fullAddress,
  notes,
  items,
  subtotal,
  discount,
  deliveryPrice,
  totalPrice,
  paymentMethod = "qi_card",
  paymentReference,
}: {
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  primaryPhone: string;
  secondaryPhone?: string;
  province: string;
  region: string;
  nearestPoint?: string;
  fullAddress?: string;
  notes?: string;
  items: CartLineWithProduct[];
  subtotal: number;
  discount: number;
  deliveryPrice: number;
  totalPrice: number;
  paymentMethod?: "qi_card" | "cod";
  paymentReference?: string;
}): EdioOrderDraft {
  return {
    orderNumber,
    customerName: cleanText(customerName, 100),
    customerEmail: customerEmail ? cleanText(customerEmail, 160).toLowerCase() : undefined,
    primaryPhone: normalizePhone(primaryPhone) || primaryPhone,
    secondaryPhone: secondaryPhone ? normalizePhone(secondaryPhone) || secondaryPhone : undefined,
    province: cleanText(province, 80),
    region: cleanText(region, 100),
    nearestPoint: nearestPoint ? cleanText(nearestPoint, 160) : undefined,
    fullAddress: fullAddress ? cleanText(fullAddress, 240) : undefined,
    notes: notes ? cleanText(notes, 500) : undefined,
    items: items.map((item) => ({
      productId: item.product.id,
      name: cleanText(item.product.name.en || item.product.name.ar, 140),
      brand: cleanText(item.product.brand, 80),
      quantity: item.quantity,
      unitPrice: item.product.price,
    })),
    subtotal,
    discount,
    deliveryPrice,
    totalPrice,
    currency: "IQD",
    paymentMethod,
    paymentReference: paymentReference ? cleanText(paymentReference, 80) : undefined,
  };
}

export async function submitEdioOrder(draft: EdioOrderDraft): Promise<EdioOrderSubmissionResult> {
  const validation = validateEdioOrderDraft(draft);
  if (!validation.ok) {
    return {
      ok: false,
      status: "failed",
      orderId: draft.orderNumber,
      message: Object.values(validation.errors)[0] || "بيانات الطلب غير مكتملة.",
      backend: "supabase",
      alwaseetDisabled: true,
    };
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      ok: false,
      status: "failed",
      orderId: draft.orderNumber,
      message: "تخزين الطلبات غير مفعّل حالياً. إعداد Supabase مطلوب.",
      backend: "supabase",
      alwaseetDisabled: true,
    };
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/create-edio-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ order: draft }),
  });

  const json = (await response.json().catch(() => null)) as EdioOrderSubmissionResult | null;
  if (!response.ok || !json) {
    return {
      ok: false,
      status: "failed",
      orderId: draft.orderNumber,
      message: "تعذر حفظ الطلب حالياً. حاول مرة أخرى بعد لحظات.",
      backend: "supabase",
      alwaseetDisabled: true,
    };
  }

  return json;
}
