type EdioOrderRequest = {
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

type SupabaseAdmin = {
  url: string;
  serviceRole: string;
};

const ALLOWED_ORIGINS = new Set([
  "https://edio-iq.com",
  "https://lavender-dogfish-486210.hostingersite.com",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:8091",
  "http://127.0.0.1:8093",
  "http://127.0.0.1:8094",
]);

function jsonResponse(body: Record<string, unknown>, status = 200, origin = "") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://edio-iq.com",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  });
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizePhone(value: string) {
  const normalized = value.replace(/[^\d+]/g, "").replace(/^00/, "+");
  if (/^\+[1-9]\d{6,14}$/.test(normalized)) return normalized;
  return null;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());
}

function validatePayload(payload: EdioOrderRequest) {
  const errors: string[] = [];
  if (!cleanText(payload.orderNumber, 80)) errors.push("missing_order_number");
  if (cleanText(payload.customerName, 100).length < 2) errors.push("invalid_customer_name");
  if (payload.customerEmail && !isValidEmail(payload.customerEmail)) errors.push("invalid_customer_email");
  if (!normalizePhone(payload.primaryPhone)) errors.push("invalid_primary_phone");
  if (payload.secondaryPhone && !normalizePhone(payload.secondaryPhone)) errors.push("invalid_secondary_phone");
  if (!cleanText(payload.province, 80)) errors.push("missing_province");
  if (cleanText(payload.region, 100).length < 2) errors.push("missing_region");
  if (!Array.isArray(payload.items) || !payload.items.length) errors.push("missing_items");
  if (payload.items?.some((item) => !item.productId || item.quantity < 1 || item.unitPrice < 0)) errors.push("invalid_items");
  if (!Number.isFinite(payload.totalPrice) || payload.totalPrice < 0) errors.push("invalid_total");
  if (payload.currency !== "IQD" || !["qi_card", "cod"].includes(payload.paymentMethod)) errors.push("unsupported_payment");
  return errors;
}

function getAdminClient(): SupabaseAdmin | null {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return null;
  return { url: url.replace(/\/$/, ""), serviceRole };
}

async function adminRest(
  admin: SupabaseAdmin,
  table: string,
  init: RequestInit & { query?: string } = {},
) {
  const query = init.query ? `?${init.query}` : "";
  const headers = new Headers(init.headers);
  headers.set("apikey", admin.serviceRole);
  headers.set("Authorization", `Bearer ${admin.serviceRole}`);
  headers.set("Content-Type", "application/json");

  return fetch(`${admin.url}/rest/v1/${table}${query}`, {
    ...init,
    headers,
  });
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") {
    return jsonResponse({ ok: true }, 200, origin);
  }
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, message: "Method not allowed" }, 405, origin);
  }

  const admin = getAdminClient();
  if (!admin) {
    return jsonResponse(
      {
        ok: false,
        status: "failed",
        orderId: "",
        message: "تخزين الطلبات غير مفعّل حالياً.",
        backend: "supabase",
        alwaseetDisabled: true,
        code: "missing_supabase_service_role",
      },
      500,
      origin,
    );
  }

  const json = (await request.json().catch(() => null)) as { order?: EdioOrderRequest } | null;
  const order = json?.order;
  if (!order) {
    return jsonResponse(
      {
        ok: false,
        status: "failed",
        orderId: "",
        message: "بيانات الطلب غير مكتملة.",
        backend: "supabase",
        alwaseetDisabled: true,
        errors: ["missing_order"],
      },
      400,
      origin,
    );
  }

  const errors = validatePayload(order);
  if (errors.length) {
    return jsonResponse(
      {
        ok: false,
        status: "failed",
        orderId: order.orderNumber,
        message: "بيانات الطلب غير مكتملة.",
        backend: "supabase",
        alwaseetDisabled: true,
        errors,
      },
      400,
      origin,
    );
  }

  const row = {
    order_number: cleanText(order.orderNumber, 80),
    customer_name: cleanText(order.customerName, 100),
    customer_email: order.customerEmail ? cleanText(order.customerEmail, 160).toLowerCase() : null,
    customer_phone_e164: normalizePhone(order.primaryPhone),
    shipping_address: {
      province: cleanText(order.province, 80),
      region: cleanText(order.region, 100),
      nearestPoint: order.nearestPoint ? cleanText(order.nearestPoint, 160) : null,
      fullAddress: order.fullAddress ? cleanText(order.fullAddress, 240) : null,
      secondaryPhone: order.secondaryPhone ? normalizePhone(order.secondaryPhone) : null,
      notes: order.notes ? cleanText(order.notes, 500) : null,
    },
    items: order.items.map((item) => ({
      productId: cleanText(item.productId, 80),
      name: cleanText(item.name, 140),
      brand: cleanText(item.brand, 80),
      quantity: Math.max(1, Math.round(Number(item.quantity || 1))),
      unitPrice: Math.max(0, Math.round(Number(item.unitPrice || 0))),
    })),
    totals: {
      subtotal: Math.max(0, Math.round(order.subtotal || 0)),
      discount: Math.max(0, Math.round(order.discount || 0)),
      deliveryPrice: Math.max(0, Math.round(order.deliveryPrice || 0)),
      totalPrice: Math.max(0, Math.round(order.totalPrice || 0)),
      currency: "IQD",
      paymentReference: order.paymentReference ? cleanText(order.paymentReference, 80) : null,
    },
    status: order.paymentMethod === "qi_card" ? "pending_payment_confirmation" : "pending",
    payment_method: order.paymentMethod,
    updated_at: new Date().toISOString(),
  };

  const response = await adminRest(admin, "orders", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });

  if (response.status === 409) {
    return jsonResponse(
      {
        ok: true,
        status: "duplicate",
        orderId: order.orderNumber,
        message: "هذا الطلب محفوظ مسبقاً داخل Edio.",
        backend: "supabase",
        alwaseetDisabled: true,
      },
      200,
      origin,
    );
  }

  if (!response.ok) {
    return jsonResponse(
      {
        ok: false,
        status: "failed",
        orderId: order.orderNumber,
        message: "تعذر حفظ الطلب حالياً.",
        backend: "supabase",
        alwaseetDisabled: true,
        code: `orders_insert_${response.status}`,
      },
      500,
      origin,
    );
  }

  return jsonResponse(
    {
      ok: true,
      status: "stored",
      orderId: order.orderNumber,
      message: "تم تسجيل طلبك داخل Edio. سنتواصل معك لتأكيد التوصيل.",
      backend: "supabase",
      alwaseetDisabled: true,
    },
    200,
    origin,
  );
});
