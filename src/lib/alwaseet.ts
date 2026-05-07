import type { Product } from "@/data/catalog";
import { API_BASE_URL } from "@/lib/api";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabaseConfig";

export type AlwaseetFieldErrors = Partial<
  Record<
    | "customerName"
    | "primaryPhone"
    | "cityId"
    | "regionId"
    | "province"
    | "region"
    | "nearestPoint"
    | "fullAddress"
    | "packageSizeId"
    | "items"
    | "totalPrice",
    string
  >
>;

export type AlwaseetLookupOption = {
  id: number;
  label: string;
};

export type AlwaseetLookups = {
  cities: AlwaseetLookupOption[];
  regions: AlwaseetLookupOption[];
  packageSizes: AlwaseetLookupOption[];
};

export type AlwaseetCheckoutDraft = {
  edioOrderId: string;
  customerName: string;
  primaryPhone: string;
  secondaryPhone?: string;
  cityId: number;
  regionId: number;
  packageSizeId: number;
  province: string;
  provinceArabic?: string;
  region: string;
  nearestPoint: string;
  fullAddress: string;
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
  paymentMethod: "cod";
  itemType: string;
  replacement: 0 | 1;
};

export type AlwaseetSubmissionResult = {
  ok: boolean;
  dryRun: boolean;
  status: "dry_run" | "sent" | "duplicate" | "failed";
  edioOrderId: string;
  trackingId?: string | null;
  alwaseetOrderId?: string | null;
  message: string;
  code?: string;
  errors?: string[];
};

export type AlwaseetMerchantPayloadPreview = {
  client_name: string;
  client_mobile: string;
  client_mobile2?: string;
  city_id: number;
  region_id: number;
  location: string;
  type_name: string;
  items_number: number;
  price: number;
  package_size: number;
  merchant_notes: string;
  replacement: 0 | 1;
  company_order_id?: number;
};

type CartLineWithProduct = {
  id: string;
  quantity: number;
  product: Product;
};

export function normalizeIraqiPhone(value: string) {
  const digits = value.replace(/[^\d+]/g, "").replace(/^00/, "+");
  if (/^\+9647\d{9}$/.test(digits)) return digits;

  const onlyDigits = digits.replace(/\D/g, "");
  if (/^07\d{9}$/.test(onlyDigits)) return `+964${onlyDigits.slice(1)}`;
  if (/^7\d{9}$/.test(onlyDigits)) return `+964${onlyDigits}`;
  if (/^9647\d{9}$/.test(onlyDigits)) return `+${onlyDigits}`;

  return null;
}

export function normalizePhone(value: string) {
  const iraqiPhone = normalizeIraqiPhone(value);
  if (iraqiPhone) return iraqiPhone;

  const normalized = value.replace(/[^\d+]/g, "").replace(/^00/, "+");
  if (/^\+[1-9]\d{6,14}$/.test(normalized)) return normalized;

  const onlyDigits = normalized.replace(/\D/g, "");
  if (/^[1-9]\d{6,14}$/.test(onlyDigits)) return `+${onlyDigits}`;

  return null;
}

export function maskPhone(phone: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) return "";
  return `${normalized.slice(0, 7)}***${normalized.slice(-3)}`;
}

function cleanText(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function validateAlwaseetCheckoutDraft(draft: AlwaseetCheckoutDraft) {
  const errors: AlwaseetFieldErrors = {};

  if (cleanText(draft.customerName, 100).length < 2) {
    errors.customerName = "أدخل اسم الزبون الكامل.";
  }
  if (!normalizePhone(draft.primaryPhone)) {
    errors.primaryPhone = "أدخل رقم هاتف صحيح.";
  }
  if (!Number.isFinite(draft.cityId) || draft.cityId <= 0) {
    errors.cityId = "اختر المحافظة من خيارات الوسيط.";
  }
  if (!Number.isFinite(draft.regionId) || draft.regionId <= 0) {
    errors.regionId = "اختر المنطقة من خيارات الوسيط.";
  }
  if (!Number.isFinite(draft.packageSizeId) || draft.packageSizeId <= 0) {
    errors.packageSizeId = "اختر حجم الطلب من خيارات الوسيط.";
  }
  if (!cleanText(draft.province, 80)) {
    errors.province = "اختر المحافظة.";
  }
  if (cleanText(draft.region, 100).length < 2) {
    errors.region = "أدخل المنطقة أو القضاء.";
  }
  if (!draft.items.length || draft.items.some((item) => !Number.isFinite(item.quantity) || item.quantity < 1)) {
    errors.items = "السلة لا تحتوي على منتجات صالحة.";
  }
  if (!Number.isFinite(draft.totalPrice) || draft.totalPrice <= 0) {
    errors.totalPrice = "قيمة الطلب غير صالحة.";
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  };
}

export function buildAlwaseetCheckoutDraft({
  edioOrderId,
  customerName,
  primaryPhone,
  secondaryPhone,
  cityId,
  regionId,
  packageSizeId,
  province,
  provinceArabic,
  region,
  nearestPoint,
  fullAddress,
  notes,
  items,
  subtotal,
  discount,
  deliveryPrice,
  totalPrice,
}: {
  edioOrderId: string;
  customerName: string;
  primaryPhone: string;
  secondaryPhone?: string;
  cityId: number;
  regionId: number;
  packageSizeId: number;
  province: string;
  provinceArabic?: string;
  region: string;
  nearestPoint: string;
  fullAddress: string;
  notes?: string;
  items: CartLineWithProduct[];
  subtotal: number;
  discount: number;
  deliveryPrice: number;
  totalPrice: number;
}): AlwaseetCheckoutDraft {
  return {
    edioOrderId,
    customerName: cleanText(customerName, 100),
    primaryPhone: normalizePhone(primaryPhone) || primaryPhone,
    secondaryPhone: secondaryPhone ? normalizePhone(secondaryPhone) || secondaryPhone : undefined,
    cityId,
    regionId,
    packageSizeId,
    province: cleanText(province, 80),
    provinceArabic: provinceArabic ? cleanText(provinceArabic, 80) : undefined,
    region: cleanText(region, 100),
    nearestPoint: cleanText(nearestPoint, 160) || "سيتم تأكيد أقرب نقطة هاتفياً",
    fullAddress: cleanText(fullAddress, 240),
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
    paymentMethod: "cod",
    itemType: "معدات صوتية",
    replacement: 0,
  };
}

function numericExternalOrderId(value: string) {
  if (!/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function buildAlwaseetMerchantPayloadPreview(draft: AlwaseetCheckoutDraft): AlwaseetMerchantPayloadPreview {
  const locationParts = [
    cleanText(draft.fullAddress, 240),
    cleanText(draft.nearestPoint, 160),
    cleanText(draft.region, 100),
    cleanText(draft.province, 80),
  ].filter(Boolean);

  const payload: AlwaseetMerchantPayloadPreview = {
    client_name: cleanText(draft.customerName, 100),
    client_mobile: normalizePhone(draft.primaryPhone) || draft.primaryPhone,
    city_id: draft.cityId,
    region_id: draft.regionId,
    location: locationParts.length ? locationParts.join(" - ") : "سيتم تأكيد العنوان هاتفياً",
    type_name: cleanText(draft.itemType || "معدات صوتية", 120),
    items_number: draft.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    price: Math.round(draft.totalPrice),
    package_size: draft.packageSizeId,
    merchant_notes: cleanText(`edio ${draft.edioOrderId}. ${draft.notes || ""}`, 500),
    replacement: draft.replacement,
  };

  if (draft.secondaryPhone) {
    payload.client_mobile2 = normalizePhone(draft.secondaryPhone) || draft.secondaryPhone;
  }

  const companyOrderId = numericExternalOrderId(draft.edioOrderId);
  if (companyOrderId !== undefined) {
    payload.company_order_id = companyOrderId;
  }

  return payload;
}

export function normalizeAlwaseetError(error: unknown) {
  if (error instanceof Error && error.message) {
    return "تعذر إرسال بيانات الشحن حالياً. تحقق من المعلومات وحاول مرة أخرى.";
  }
  return "تعذر إرسال بيانات الشحن حالياً. حاول مرة أخرى.";
}

function normalizeAlwaseetSubmissionResult(result: AlwaseetSubmissionResult): AlwaseetSubmissionResult {
  if (result.ok) return result;

  const code = String(result.code || "");
  const permissionDenied = /صلاحية|permission|unauthorized|forbidden|access/i.test(code);
  if (permissionDenied) {
    return {
      ...result,
      message:
        "تعذر إرسال الطلب إلى الوسيط بسبب صلاحيات حساب الشحن. معلوماتك صحيحة، وسيحتاج فريق edio إلى تحديث إعدادات الوسيط.",
    };
  }

  if (result.errors?.includes("missing_nearest_point")) {
    return {
      ...result,
      message: "تعذر تجهيز أقرب نقطة دالة تلقائياً. أعد المحاولة أو اكتب أقرب معلم معروف.",
    };
  }

  return result;
}

async function invokeAlwaseetFunctionRaw<T>(body: Record<string, unknown>): Promise<T | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/create-alwaseet-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const json = (await response.json().catch(() => null)) as T | null;
  return json;
}

export async function submitAlwaseetOrder(draft: AlwaseetCheckoutDraft): Promise<AlwaseetSubmissionResult> {
  const validation = validateAlwaseetCheckoutDraft(draft);
  if (!validation.ok) {
    return {
      ok: false,
      dryRun: true,
      status: "failed",
      edioOrderId: draft.edioOrderId,
      message: Object.values(validation.errors)[0] || "بيانات الشحن غير مكتملة.",
    };
  }

  const { supabase } = await import("@/lib/supabase");
  if (!supabase) {
    return {
      ok: false,
      dryRun: true,
      status: "failed",
      edioOrderId: draft.edioOrderId,
      message: "إرسال الشحن غير مفعّل حالياً. إعداد Supabase مطلوب.",
    };
  }

  const { data, error } = await supabase.functions.invoke<AlwaseetSubmissionResult>("create-alwaseet-order", {
    body: { action: "createOrder", order: draft },
  });

  if (error || !data) {
    const rawData = await invokeAlwaseetFunctionRaw<AlwaseetSubmissionResult>({ action: "createOrder", order: draft }).catch(() => null);
    if (rawData) return normalizeAlwaseetSubmissionResult(rawData);

    return {
      ok: false,
      dryRun: true,
      status: "failed",
      edioOrderId: draft.edioOrderId,
      message: normalizeAlwaseetError(error),
    };
  }

  return normalizeAlwaseetSubmissionResult(data);
}

export async function fetchAlwaseetLookups(cityId?: number): Promise<AlwaseetLookups> {
  const { supabase } = await import("@/lib/supabase");
  if (!supabase) {
    return fetchLocalAlwaseetLookups(cityId).catch(() => fetchPublicAlwaseetLookups(cityId));
  }

  const { data, error } = await supabase.functions.invoke<{ ok: boolean; data: AlwaseetLookups }>("create-alwaseet-order", {
    body: { action: "lookups", cityId },
  });

  if (error || !data?.ok) {
    return fetchPublicAlwaseetLookups(cityId);
  }

  return data.data;
}

async function fetchLocalAlwaseetLookups(cityId?: number): Promise<AlwaseetLookups> {
  if (!API_BASE_URL) throw new Error("Local API is not configured.");
  const url = new URL("/api/alwaseet/lookups", `${API_BASE_URL}/`);
  if (cityId) url.searchParams.set("cityId", String(cityId));
  const response = await fetch(url.toString(), { credentials: "include" });
  const json = (await response.json().catch(() => null)) as { ok?: boolean; data?: AlwaseetLookups } | null;
  if (!response.ok || !json?.ok || !json.data) {
    throw new Error("Unable to load local Alwaseet options.");
  }
  return json.data;
}

type AlwaseetPublicResponse = {
  status?: boolean;
  data?: unknown;
};

function normalizeLookupOption(row: Record<string, unknown>, labelKeys: string[]) {
  const id = Number(row.id);
  const label = labelKeys
    .map((key) => cleanText(String(row[key] || ""), 160))
    .find(Boolean);
  return Number.isFinite(id) && id > 0 && label ? { id, label } : null;
}

async function fetchPublicJson(endpoint: string): Promise<AlwaseetPublicResponse> {
  const response = await fetch(`https://api.alwaseet-iq.net/v1/merchant${endpoint}`);
  const json = (await response.json().catch(() => null)) as AlwaseetPublicResponse | null;
  if (!response.ok || !json?.status) {
    throw new Error("Unable to load public Alwaseet options.");
  }
  return json;
}

async function fetchPublicAlwaseetLookups(cityId?: number): Promise<AlwaseetLookups> {
  const [citiesJson, packageSizesJson, regionsJson] = await Promise.all([
    fetchPublicJson("/citys"),
    fetchPublicJson("/package-sizes"),
    cityId ? fetchPublicJson(`/regions?city_id=${encodeURIComponent(String(cityId))}`) : Promise.resolve({ data: [] }),
  ]);

  const cityRows = Array.isArray(citiesJson.data) ? (citiesJson.data as Array<Record<string, unknown>>) : [];
  const regionRows = Array.isArray(regionsJson.data) ? (regionsJson.data as Array<Record<string, unknown>>) : [];
  const sizeRows = Array.isArray(packageSizesJson.data) ? (packageSizesJson.data as Array<Record<string, unknown>>) : [];

  return {
    cities: cityRows
      .map((row) => normalizeLookupOption(row, ["city_name", "name"]))
      .filter((item): item is AlwaseetLookupOption => Boolean(item)),
    regions: regionRows
      .map((row) => normalizeLookupOption(row, ["region_name", "name"]))
      .filter((item): item is AlwaseetLookupOption => Boolean(item)),
    packageSizes: sizeRows
      .map((row) => normalizeLookupOption(row, ["size", "title", "name"]))
      .filter((item): item is AlwaseetLookupOption => Boolean(item)),
  };
}
