export type PublicStockAvailability = "in_stock" | "out_of_stock" | "pre_order" | "discontinued" | "hidden";
export type PublicStockSeverity = "success" | "warning" | "danger" | "neutral";

export type PublicStockDisplay = {
  availability: PublicStockAvailability;
  label: string;
  lowStock: boolean;
  visibleQuantity: number | null;
  severity: PublicStockSeverity;
};

type PublicStockInput = {
  availableQuantity?: number | null;
  inStock?: boolean | null;
  availabilityStatus?: string | null;
  locale?: "en" | "ar" | string;
};

export function getPublicStockDisplay({
  availableQuantity,
  inStock,
  availabilityStatus,
  locale = "en",
}: PublicStockInput): PublicStockDisplay {
  const lang = String(locale || "en").startsWith("ar") ? "ar" : "en";
  const normalizedStatus = normalizeAvailability(availabilityStatus);
  const quantity = Number.isFinite(Number(availableQuantity)) ? Math.max(0, Math.floor(Number(availableQuantity))) : null;
  const isAvailable = normalizedStatus === "in_stock" || (normalizedStatus === null && (inStock === true || (quantity ?? 0) > 0));

  if (normalizedStatus === "pre_order") {
    return stockResult("pre_order", lang === "ar" ? "طلب مسبق" : "Pre-order", false, null, "neutral");
  }

  if (normalizedStatus === "discontinued") {
    return stockResult("discontinued", lang === "ar" ? "لم يعد متوفراً" : "Discontinued", false, null, "danger");
  }

  if (!isAvailable || normalizedStatus === "out_of_stock" || quantity === 0) {
    return stockResult("out_of_stock", lang === "ar" ? "غير متوفر" : "Out of stock", false, null, "danger");
  }

  if (quantity !== null && quantity <= 3) {
    return stockResult("in_stock", lowStockLabel(quantity, lang), true, quantity, "warning");
  }

  return stockResult("in_stock", lang === "ar" ? "متوفر" : "In stock", false, null, "success");
}

function normalizeAvailability(value?: string | null): PublicStockAvailability | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "in_stock" || normalized === "in-stock") return "in_stock";
  if (normalized === "out_of_stock" || normalized === "out-of-stock" || normalized === "sold_out") return "out_of_stock";
  if (normalized === "pre_order" || normalized === "pre-order" || normalized === "preorder") return "pre_order";
  if (normalized === "discontinued") return "discontinued";
  if (normalized === "hidden") return "hidden";
  return null;
}

function lowStockLabel(quantity: number, lang: "en" | "ar") {
  if (lang === "ar") {
    if (quantity === 1) return "باقي قطعة واحدة فقط";
    if (quantity === 2) return "باقي قطعتين فقط";
    return "باقي 3 قطع فقط";
  }
  return `Only ${quantity} left`;
}

function stockResult(
  availability: PublicStockAvailability,
  label: string,
  lowStock: boolean,
  visibleQuantity: number | null,
  severity: PublicStockSeverity,
): PublicStockDisplay {
  return { availability, label, lowStock, visibleQuantity, severity };
}
