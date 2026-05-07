type AlwaseetOrderRequest = {
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

type AlwaseetFunctionRequest =
  | { action?: "createOrder"; order?: AlwaseetOrderRequest }
  | { action: "lookups"; cityId?: number };

type AlwaseetResponse = {
  status?: boolean;
  errNum?: string;
  msg?: string;
  data?: unknown;
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

const DEFAULT_API_BASE = "https://api.alwaseet-iq.net/v1/merchant";

function jsonResponse(body: Record<string, unknown>, status = 200, origin = "") {
  return new Response(status === 204 ? null : JSON.stringify(body), {
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

function normalizeIraqiPhone(value: unknown) {
  const digits = String(value || "").replace(/[^\d+]/g, "").replace(/^00/, "+");
  if (/^\+9647\d{9}$/.test(digits)) return digits;

  const onlyDigits = digits.replace(/\D/g, "");
  if (/^07\d{9}$/.test(onlyDigits)) return `+964${onlyDigits.slice(1)}`;
  if (/^7\d{9}$/.test(onlyDigits)) return `+964${onlyDigits}`;
  if (/^9647\d{9}$/.test(onlyDigits)) return `+${onlyDigits}`;

  return null;
}

function maskPhone(phone: string) {
  const normalized = normalizeIraqiPhone(phone);
  if (!normalized) return "";
  return `${normalized.slice(0, 7)}***${normalized.slice(-3)}`;
}

function validatePayload(payload: AlwaseetOrderRequest) {
  const errors: string[] = [];
  if (!cleanText(payload.edioOrderId, 80)) errors.push("missing_order_id");
  if (cleanText(payload.customerName, 100).length < 2) errors.push("invalid_customer_name");
  if (!normalizeIraqiPhone(payload.primaryPhone)) errors.push("invalid_primary_phone");
  if (payload.secondaryPhone && !normalizeIraqiPhone(payload.secondaryPhone)) errors.push("invalid_secondary_phone");
  if (!Number.isFinite(payload.cityId) || payload.cityId <= 0) errors.push("missing_city_id");
  if (!Number.isFinite(payload.regionId) || payload.regionId <= 0) errors.push("missing_region_id");
  if (!Number.isFinite(payload.packageSizeId) || payload.packageSizeId <= 0) errors.push("missing_package_size");
  if (!cleanText(payload.province, 80)) errors.push("missing_province");
  if (cleanText(payload.region, 100).length < 2) errors.push("missing_region");
  if (!Array.isArray(payload.items) || !payload.items.length || payload.items.some((item) => !Number.isFinite(item.quantity) || item.quantity < 1)) {
    errors.push("missing_items");
  }
  if (!Number.isFinite(payload.totalPrice) || payload.totalPrice <= 0) errors.push("invalid_total");
  if (payload.currency !== "IQD" || payload.paymentMethod !== "cod") errors.push("unsupported_payment");
  return errors;
}

function safeCustomerMessage(code: string) {
  if (/صلاحية|permission|unauthorized|forbidden|access/i.test(code)) {
    return "تعذر إرسال الطلب إلى الوسيط بسبب صلاحيات حساب الشحن. يرجى تحديث إعدادات حساب الوسيط.";
  }
  if (/credentials|token|login/i.test(code)) {
    return "تعذر إرسال الطلب إلى الوسيط بسبب إعدادات تسجيل الدخول الخاصة بالشحن.";
  }
  return "تعذر إرسال طلب الشحن إلى الوسيط حالياً.";
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

  const response = await fetch(`${admin.url}/rest/v1/${table}${query}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(`supabase_rest_${response.status}`);
  }

  return response;
}

async function recordEvent(
  admin: SupabaseAdmin | null,
  event: {
    edioOrderId: string;
    eventType: string;
    provider?: string;
    status?: string;
    details?: Record<string, unknown>;
  },
) {
  if (!admin) return;
  await adminRest(admin, "shipping_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
    edio_order_id: event.edioOrderId,
    provider: event.provider || "alwaseet",
    event_type: event.eventType,
    status: event.status || null,
    details: event.details || {},
    }),
  });
}

async function checkRateLimit(admin: SupabaseAdmin | null, ip: string) {
  if (!admin || !ip) return true;
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const query = [
    "select=id",
    "event_type=eq.create_order_attempt",
    `created_at=gte.${encodeURIComponent(since)}`,
    `details=cs.${encodeURIComponent(JSON.stringify({ ip }))}`,
  ].join("&");

  try {
    const response = await adminRest(admin, "shipping_events", {
      method: "GET",
      headers: {
        Prefer: "count=exact",
        Range: "0-0",
      },
      query,
    });
    const contentRange = response.headers.get("content-range") || "";
    const count = Number(contentRange.split("/")[1] || 0);
    return !Number.isFinite(count) || count < 8;
  } catch {
    return true;
  }
}

async function getExistingIntegration(admin: SupabaseAdmin | null, edioOrderId: string) {
  if (!admin) return null;
  try {
    const query = [
      "select=*",
      "provider=eq.alwaseet",
      `edio_order_id=eq.${encodeURIComponent(edioOrderId)}`,
      "limit=1",
    ].join("&");
    const response = await adminRest(admin, "shipping_integrations", { method: "GET", query });
    const data = await response.json().catch(() => []);
    return Array.isArray(data) ? data[0] || null : null;
  } catch {
    return null;
  }
}

async function upsertIntegration(
  admin: SupabaseAdmin | null,
  payload: AlwaseetOrderRequest,
  result: {
    status: string;
    dryRun: boolean;
    providerOrderId?: string | null;
    trackingId?: string | null;
    requestSummary: Record<string, unknown>;
    responseSummary: Record<string, unknown>;
    lastError?: string | null;
  },
) {
  if (!admin) return;
  await adminRest(admin, "shipping_integrations", {
    method: "POST",
    query: "on_conflict=provider,edio_order_id",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      provider: "alwaseet",
      edio_order_id: payload.edioOrderId,
      provider_order_id: result.providerOrderId || null,
      provider_tracking_id: result.trackingId || null,
      status: result.status,
      dry_run: result.dryRun,
      request_summary: result.requestSummary,
      response_summary: result.responseSummary,
      last_error: result.lastError || null,
      updated_at: new Date().toISOString(),
    }),
  });
}

async function fetchAlwaseet(endpoint: string, init: RequestInit = {}) {
  const apiBase = (Deno.env.get("ALWASEET_API_BASE_URL") || DEFAULT_API_BASE).replace(/\/$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${apiBase}${endpoint}`, {
      ...init,
      signal: controller.signal,
    });
    const json = (await response.json().catch(() => null)) as AlwaseetResponse | null;
    if (!response.ok || !json?.status) {
      throw new Error(json?.msg || `Alwaseet request failed with ${response.status}`);
    }
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeId(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeOption(row: Record<string, unknown>, labelKeys: string[]) {
  const id = normalizeId(row.id);
  const label = labelKeys.map((key) => cleanText(row[key], 160)).find(Boolean) || cleanText(row.name, 160);
  return id > 0 && label ? { id, label } : null;
}

async function loadLookups(cityId?: number) {
  const [citiesJson, packageSizesJson, regionsJson] = await Promise.all([
    fetchAlwaseet("/citys"),
    fetchAlwaseet("/package-sizes"),
    cityId ? fetchAlwaseet(`/regions?city_id=${encodeURIComponent(String(cityId))}`) : Promise.resolve({ data: [] }),
  ]);

  const cityRows = Array.isArray(citiesJson.data) ? citiesJson.data as Array<Record<string, unknown>> : [];
  const regionRows = Array.isArray(regionsJson.data) ? regionsJson.data as Array<Record<string, unknown>> : [];
  const sizeRows = Array.isArray(packageSizesJson.data) ? packageSizesJson.data as Array<Record<string, unknown>> : [];

  return {
    cities: cityRows
      .map((row) => normalizeOption(row, ["city_name", "name"]))
      .filter((item): item is { id: number; label: string } => Boolean(item)),
    regions: regionRows
      .map((row) => normalizeOption(row, ["region_name", "name"]))
      .filter((item): item is { id: number; label: string } => Boolean(item)),
    packageSizes: sizeRows
      .map((row) => normalizeOption(row, ["size", "title", "name"]))
      .filter((item): item is { id: number; label: string } => Boolean(item)),
  };
}

async function getAlwaseetToken() {
  const apiToken = Deno.env.get("ALWASEET_API_TOKEN")?.trim();
  if (apiToken) return apiToken;

  const username = Deno.env.get("ALWASEET_USERNAME")?.trim();
  const password = Deno.env.get("ALWASEET_PASSWORD")?.trim();
  if (!username || !password) {
    throw new Error("missing_alwaseet_credentials");
  }

  const body = new FormData();
  body.set("username", username);
  body.set("password", password);
  const json = await fetchAlwaseet("/login", { method: "POST", body });
  const data = json.data as { token?: string } | undefined;
  if (!data?.token) throw new Error("missing_alwaseet_token");
  return data.token;
}

function buildCreateOrderForm(payload: AlwaseetOrderRequest, cityId: number, regionId: number, packageSizeId: number) {
  const locationParts = [
    cleanText(payload.fullAddress, 240),
    cleanText(payload.nearestPoint, 160),
    cleanText(payload.region, 100),
    cleanText(payload.province, 80),
  ].filter(Boolean);
  const form = new FormData();
  form.set("client_name", cleanText(payload.customerName, 100));
  form.set("client_mobile", normalizeIraqiPhone(payload.primaryPhone)!);
  if (payload.secondaryPhone) form.set("client_mobile2", normalizeIraqiPhone(payload.secondaryPhone) || "");
  form.set("city_id", String(cityId));
  form.set("region_id", String(regionId));
  form.set("location", locationParts.length ? locationParts.join(" - ") : "سيتم تأكيد العنوان هاتفياً");
  form.set("type_name", cleanText(payload.itemType || Deno.env.get("ALWASEET_DEFAULT_ORDER_TYPE") || "معدات صوتية", 120));
  form.set("items_number", String(payload.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)));
  form.set("price", String(Math.round(payload.totalPrice)));
  form.set("package_size", String(packageSizeId));
  form.set("merchant_notes", cleanText(`Edio ${payload.edioOrderId}. ${payload.notes || ""}`, 500));
  form.set("replacement", String(payload.replacement || 0));
  if (/^\d+$/.test(payload.edioOrderId)) {
    const companyOrderId = Number(payload.edioOrderId);
    if (Number.isSafeInteger(companyOrderId)) {
      form.set("company_order_id", String(companyOrderId));
    }
  }
  return form;
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";

  if (request.method === "OPTIONS") {
    return jsonResponse({}, 204, origin);
  }
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, message: "Method not allowed" }, 405, origin);
  }
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return jsonResponse({ ok: false, message: "Origin not allowed" }, 403, origin);
  }

  let rawPayload: AlwaseetFunctionRequest | AlwaseetOrderRequest;
  try {
    rawPayload = await request.json();
  } catch {
    return jsonResponse({ ok: false, message: "Invalid request body" }, 400, origin);
  }

  if ("action" in rawPayload && rawPayload.action === "lookups") {
    try {
      const cityId = Number(rawPayload.cityId || 0) || undefined;
      const lookups = await loadLookups(cityId);
      return jsonResponse({ ok: true, data: lookups }, 200, origin);
    } catch {
      return jsonResponse({ ok: false, message: "Unable to load Alwaseet shipping options" }, 502, origin);
    }
  }

  const payload = "action" in rawPayload && rawPayload.action === "createOrder" && rawPayload.order
    ? rawPayload.order
    : rawPayload as AlwaseetOrderRequest;

  const errors = validatePayload(payload);
  if (errors.length) {
    return jsonResponse({
      ok: false,
      dryRun: true,
      status: "failed",
      edioOrderId: cleanText(payload?.edioOrderId, 80),
      message: "بيانات الشحن غير مكتملة.",
      errors,
    }, 400, origin);
  }

  const admin = getAdminClient();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const dryRun = Deno.env.get("ALWASEET_DRY_RUN") !== "false";

  try {
    const rateAllowed = await checkRateLimit(admin, ip);
    if (!rateAllowed) {
      return jsonResponse({
        ok: false,
        dryRun,
        status: "failed",
        edioOrderId: payload.edioOrderId,
        message: "محاولات كثيرة خلال وقت قصير. حاول لاحقاً.",
      }, 429, origin);
    }

    await recordEvent(admin, {
      edioOrderId: payload.edioOrderId,
      eventType: "create_order_attempt",
      status: dryRun ? "dry_run" : "pending",
      details: { ip, dryRun, maskedPhone: maskPhone(payload.primaryPhone) },
    }).catch(() => undefined);

    const existing = await getExistingIntegration(admin, payload.edioOrderId);
    if (existing?.status === "sent" || existing?.status === "dry_run") {
      return jsonResponse({
        ok: true,
        dryRun: Boolean(existing.dry_run),
        status: "duplicate",
        edioOrderId: payload.edioOrderId,
        trackingId: existing.provider_tracking_id,
        alwaseetOrderId: existing.provider_order_id,
        message: "تم تسجيل طلب الشحن مسبقاً.",
      }, 200, origin);
    }

    const requestSummary = {
      edioOrderId: payload.edioOrderId,
      customerName: cleanText(payload.customerName, 100),
      maskedPhone: maskPhone(payload.primaryPhone),
      province: cleanText(payload.province, 80),
      region: cleanText(payload.region, 100),
      itemsCount: payload.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      totalPrice: Math.round(payload.totalPrice),
    };

    if (dryRun) {
      await upsertIntegration(admin, payload, {
        status: "dry_run",
        dryRun: true,
        requestSummary,
        responseSummary: { message: "Dry-run only. No live Alwaseet order created." },
      }).catch(() => undefined);

      return jsonResponse({
        ok: true,
        dryRun: true,
        status: "dry_run",
        edioOrderId: payload.edioOrderId,
        trackingId: null,
        alwaseetOrderId: null,
        message: "تم استلام بيانات الشحن بوضع الاختبار. لم يتم إنشاء طلب حي لدى الوسيط.",
      }, 200, origin);
    }

    if (!admin) {
      return jsonResponse({
        ok: false,
        dryRun: false,
        status: "failed",
        edioOrderId: payload.edioOrderId,
        message: "إرسال الشحن الحي غير متاح بدون تخزين آمن للطلبات.",
      }, 500, origin);
    }

    const token = await getAlwaseetToken();
    const cityId = payload.cityId;
    const regionId = payload.regionId;
    const packageSizeId = payload.packageSizeId;
    const form = buildCreateOrderForm(payload, cityId, regionId, packageSizeId);
    const response = await fetchAlwaseet(`/create-order?token=${encodeURIComponent(token)}`, {
      method: "POST",
      body: form,
    });
    const data = Array.isArray(response.data) ? response.data[0] as Record<string, unknown> : response.data as Record<string, unknown> | undefined;
    const trackingId = data?.qr_id ? String(data.qr_id) : null;
    const providerOrderId = data?.id ? String(data.id) : trackingId;

    await upsertIntegration(admin, payload, {
      status: "sent",
      dryRun: false,
      providerOrderId,
      trackingId,
      requestSummary: { ...requestSummary, cityId, regionId, packageSizeId },
      responseSummary: {
        errNum: response.errNum || null,
        msg: response.msg || null,
        providerOrderId,
        trackingId,
        hasPrintLink: Boolean(data?.qr_link),
      },
    });

    await recordEvent(admin, {
      edioOrderId: payload.edioOrderId,
      eventType: "create_order_success",
      status: "sent",
      details: { trackingId, providerOrderId },
    }).catch(() => undefined);

    return jsonResponse({
      ok: true,
      dryRun: false,
      status: "sent",
      edioOrderId: payload.edioOrderId,
      trackingId,
      alwaseetOrderId: providerOrderId,
      message: "تم إرسال طلب الشحن إلى الوسيط.",
    }, 200, origin);
  } catch (error) {
    const code = error instanceof Error ? error.message : "alwaseet_unknown_error";
    await upsertIntegration(admin, payload, {
      status: "failed",
      dryRun,
      requestSummary: {
        edioOrderId: payload.edioOrderId,
        maskedPhone: maskPhone(payload.primaryPhone),
      },
      responseSummary: { code },
      lastError: code,
    }).catch(() => undefined);

    return jsonResponse({
      ok: false,
      dryRun,
      status: "failed",
      edioOrderId: payload.edioOrderId,
      message: safeCustomerMessage(code),
      code,
    }, 502, origin);
  }
});
