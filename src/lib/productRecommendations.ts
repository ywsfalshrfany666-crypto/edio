import { normalizeProductCategory } from "@/lib/productCategories";

type LocalizedName = { en?: string; ar?: string };

export type RecommendationRelationshipType =
  | "accessory"
  | "compatible"
  | "similar"
  | "alternative"
  | "same_brand"
  | "blocked";

export type ProductRelationship = {
  targetProductId: string;
  relationshipType: RecommendationRelationshipType;
  reason?: string;
  priority?: number;
  confidence?: number;
  active?: boolean;
  source?: "manual" | "imported" | "automatic";
};

export type RecommendationProduct = {
  id?: string;
  slug?: string;
  name?: LocalizedName;
  brand?: string;
  category?: string;
  subCategories?: string[];
  tagline?: LocalizedName;
  features?: string[];
  specs?: Array<{ label: string | LocalizedName; value: string }>;
  badge?: "new" | "featured" | "best" | "preowned" | null;
  inStock?: boolean;
  price?: number;
  status?: "published" | "draft" | "needs_review" | "hidden" | "archived" | string;
  needsReview?: boolean;
  tags?: string[];
  relationships?: ProductRelationship[];
  productRelationships?: ProductRelationship[];
};

export type RecommendationType = Exclude<RecommendationRelationshipType, "blocked">;

export type ProductRecommendation<T extends RecommendationProduct = RecommendationProduct> = {
  product: T;
  type: RecommendationType;
  score: number;
  confidence: number;
  reason: string;
  signals: string[];
  source: "manual" | "automatic" | "imported";
};

export type ProductRecommendationSection<T extends RecommendationProduct = RecommendationProduct> = {
  type: "recommended_accessories" | "compatible_with" | "similar_products" | "alternatives" | "same_brand";
  title: string;
  items: ProductRecommendation<T>[];
};

const SECTION_ORDER: ProductRecommendationSection["type"][] = [
  "recommended_accessories",
  "compatible_with",
  "similar_products",
  "alternatives",
  "same_brand",
];

const SECTION_LIMITS: Record<ProductRecommendationSection["type"], number> = {
  recommended_accessories: 4,
  compatible_with: 4,
  similar_products: 6,
  alternatives: 4,
  same_brand: 4,
};

const SECTION_TITLES = {
  en: {
    recommended_accessories: "Recommended accessories",
    compatible_with: "Works well with",
    similar_products: "Similar products",
    alternatives: "Alternatives",
    same_brand: "More from this brand",
  },
  ar: {
    recommended_accessories: "ملحقات مناسبة",
    compatible_with: "يعمل جيداً مع",
    similar_products: "منتجات مشابهة",
    alternatives: "بدائل قريبة",
    same_brand: "من نفس البراند",
  },
} as const;

export function getProductRecommendationSections<T extends RecommendationProduct>(
  product: RecommendationProduct,
  products: T[],
  lang: "en" | "ar" = "en",
): ProductRecommendationSection<T>[] {
  const targetById = new Map(products.map((item) => [String(item.id || ""), item]));
  const blocked = new Set(
    getManualRelationships(product)
      .filter((relationship) => relationship.active !== false && relationship.relationshipType === "blocked")
      .map((relationship) => relationship.targetProductId),
  );

  const manual = getManualRelationships(product)
    .filter((relationship) => relationship.active !== false && relationship.relationshipType !== "blocked")
    .map((relationship) => {
      const target = targetById.get(relationship.targetProductId);
      if (!target || blocked.has(String(target.id || "")) || !isRecommendableProduct(target, true)) return null;
      const type = relationship.relationshipType as RecommendationType;
      return {
        product: target,
        type,
        score: 100 + Number(relationship.priority || 0),
        confidence: clampConfidence(relationship.confidence ?? 0.96),
        reason: relationship.reason || defaultReason(type, product, target, lang),
        signals: ["manual_relationship", type],
        source: relationship.source === "imported" ? "imported" : "manual",
      } satisfies ProductRecommendation<T>;
    })
    .filter(Boolean) as ProductRecommendation<T>[];

  const automatic = products
    .filter((item) => String(item.id || "") !== String(product.id || ""))
    .filter((item) => !blocked.has(String(item.id || "")))
    .filter((item) => isRecommendableProduct(item, false))
    .flatMap((item) => scoreCandidate(product, item, lang));

  const deduped = dedupeRecommendations([...manual, ...automatic]);
  const sections = groupRecommendations(deduped, lang);
  return sections.filter((section) => section.items.length > 0);
}

function scoreCandidate<T extends RecommendationProduct>(
  source: RecommendationProduct,
  target: T,
  lang: "en" | "ar",
): ProductRecommendation<T>[] {
  const sourceCategory = normalizeProductCategory(source);
  const targetCategory = normalizeProductCategory(target);
  const sourceTerms = terms(source);
  const targetTerms = terms(target);
  const sharedTerms = [...sourceTerms].filter((term) => targetTerms.has(term));
  const recommendations: ProductRecommendation<T>[] = [];

  const accessory = scoreAccessory(source, target, sourceCategory, targetCategory, sourceTerms, targetTerms, lang);
  if (accessory) recommendations.push(accessory);

  const compatible = scoreCompatibility(source, target, sourceCategory, targetCategory, sourceTerms, targetTerms, lang);
  if (compatible) recommendations.push(compatible);

  const similar = scoreSimilar(source, target, sourceCategory, targetCategory, sharedTerms, lang);
  if (similar) recommendations.push(similar);

  const alternative = scoreAlternative(source, target, sourceCategory, targetCategory, sharedTerms, lang);
  if (alternative) recommendations.push(alternative);

  const sameBrand = scoreSameBrand(source, target, sourceCategory, targetCategory, sharedTerms, lang);
  if (sameBrand) recommendations.push(sameBrand);

  return recommendations.filter((item) => item.confidence >= 0.7 && item.score >= 70);
}

function scoreAccessory<T extends RecommendationProduct>(
  source: RecommendationProduct,
  target: T,
  sourceCategory: string,
  targetCategory: string,
  sourceTerms: Set<string>,
  targetTerms: Set<string>,
  lang: "en" | "ar",
): ProductRecommendation<T> | null {
  if (targetCategory !== "accessories") return null;
  const sourceConnector = connectorType(source);
  const targetConnector = connectorType(target);
  const signals: string[] = ["accessory_candidate"];
  let score = 0;
  let confidence = 0;
  let reason = "";

  if (sourceCategory === "iems") {
    if (targetTerms.has("eartips") || textOf(target).includes("ear tip") || textOf(target).includes("eartip")) {
      score = 94;
      confidence = 0.94;
      signals.push("iem_eartips");
      reason = lang === "ar" ? "يساعد على ضبط الراحة والعزل لسماعات IEM." : "Helps tune fit and isolation for IEMs.";
    } else if (targetTerms.has("cases")) {
      score = 78;
      confidence = 0.76;
      signals.push("iem_case");
      reason = lang === "ar" ? "حافظة عملية لسماعات IEM والاستخدام اليومي." : "A practical case for IEM carry.";
    } else if (targetTerms.has("audio-cables") && sourceConnector && connectorsCompatible(sourceConnector, targetConnector)) {
      score = 92;
      confidence = 0.9;
      signals.push("connector_match", sourceConnector);
      reason = lang === "ar" ? `كيبل متوافق مع موصل ${formatConnector(sourceConnector)}.` : `Cable match for ${formatConnector(sourceConnector)} connectors.`;
    }
  }

  if (sourceCategory === "headphones") {
    if (targetTerms.has("cases")) {
      score = 74;
      confidence = 0.72;
      signals.push("headphone_case");
      reason = lang === "ar" ? "مفيد للحفظ والتنقل مع السماعات." : "Useful for storage and transport.";
    } else if (targetTerms.has("audio-cables") && sourceConnector && connectorsCompatible(sourceConnector, targetConnector)) {
      score = 90;
      confidence = 0.88;
      signals.push("connector_match", sourceConnector);
      reason = lang === "ar" ? `كيبل مناسب لموصل ${formatConnector(sourceConnector)}.` : `Cable match for ${formatConnector(sourceConnector)} connectors.`;
    }
  }

  if (sourceCategory === "mic") {
    if (isUsbMicrophone(source) && targetCategory === "accessories" && targetTerms.has("audio-cables")) return null;
    if (isXlrMicrophone(source) && targetTerms.has("audio-cables") && (targetConnector === "xlr" || textOf(target).includes("xlr"))) {
      score = 96;
      confidence = 0.95;
      signals.push("xlr_mic", "xlr_cable");
      reason = lang === "ar" ? "كيبل XLR مطلوب لسلسلة تسجيل هذا المايك." : "XLR cable for this microphone chain.";
    }
  }

  if (sourceCategory === "audio-interface" && targetTerms.has("audio-cables")) {
    score = targetConnector === "xlr" || targetConnector === "trs" ? 88 : 76;
    confidence = score >= 88 ? 0.88 : 0.72;
    signals.push("interface_cabling");
    reason = lang === "ar" ? "يكمل توصيل كرت الصوت بمعدات التسجيل." : "Completes the interface recording chain.";
  }

  if ((sourceCategory === "dac" || sourceCategory === "dap") && targetTerms.has("audio-cables")) {
    score = targetConnector === "4.4mm" || targetConnector === "3.5mm" || targetConnector === "usb" ? 86 : 72;
    confidence = score >= 86 ? 0.84 : 0.7;
    signals.push("source_cabling");
    reason = lang === "ar" ? "يكمل مسار الإشارة حسب مخارج المصدر." : "Completes the signal path for the source outputs.";
  }

  if (!score) return null;
  return { product: target, type: "accessory", score, confidence, reason, signals, source: "automatic" };
}

function scoreCompatibility<T extends RecommendationProduct>(
  source: RecommendationProduct,
  target: T,
  sourceCategory: string,
  targetCategory: string,
  _sourceTerms: Set<string>,
  targetTerms: Set<string>,
  lang: "en" | "ar",
): ProductRecommendation<T> | null {
  const signals: string[] = ["compatibility_rule"];
  let score = 0;
  let confidence = 0;
  let reason = "";

  if ((sourceCategory === "headphones" || sourceCategory === "iems") && targetCategory === "dac") {
    if (sourceCategory === "headphones" && needsAmplification(source)) {
      score = targetTerms.has("desktop") ? 95 : 88;
      confidence = targetTerms.has("desktop") ? 0.93 : 0.84;
      signals.push("power_need", "dac_amp");
      reason = lang === "ar" ? "مناسب لسماعات تحتاج قدرة وتحكم أفضل." : "Suitable for headphones that need more power and control.";
    } else if (sourceCategory === "iems" && targetTerms.has("portable")) {
      score = 82;
      confidence = 0.78;
      signals.push("iem_portable_dac");
      reason = lang === "ar" ? "مصدر محمول مناسب للاستماع اليومي مع IEM." : "Portable source for everyday IEM listening.";
    }
  }

  if (sourceCategory === "dac" && (targetCategory === "headphones" || targetCategory === "iems")) {
    const desktop = terms(source).has("desktop");
    score = desktop && targetCategory === "headphones" ? 84 : 76;
    confidence = score >= 84 ? 0.8 : 0.72;
    signals.push("source_to_transducer");
    reason = lang === "ar" ? "اختيار منطقي لبناء سلسلة استماع متوازنة." : "A logical match for a balanced listening chain.";
  }

  if (sourceCategory === "dap" && (targetCategory === "iems" || targetCategory === "headphones")) {
    score = targetCategory === "iems" ? 88 : 78;
    confidence = targetCategory === "iems" ? 0.86 : 0.74;
    signals.push("portable_listening");
    reason = lang === "ar" ? "مناسب للاستماع المحمول." : "Good match for portable listening.";
  }

  if (sourceCategory === "mic" && targetCategory === "audio-interface" && isXlrMicrophone(source)) {
    score = 98;
    confidence = 0.96;
    signals.push("xlr_mic_requires_interface");
    reason = lang === "ar" ? "مايك XLR يحتاج كرت صوت مناسب." : "XLR microphone requires an audio interface.";
  }

  if (sourceCategory === "mic" && targetCategory === "audio-interface" && isUsbMicrophone(source)) {
    return null;
  }

  if (sourceCategory === "audio-interface" && targetCategory === "mic") {
    score = isUsbMicrophone(target) ? 0 : 90;
    confidence = 0.88;
    signals.push("interface_xlr_mic");
    reason = lang === "ar" ? "يكمل سلسلة تسجيل XLR." : "Completes an XLR recording chain.";
  }

  if (!score) return null;
  return { product: target, type: "compatible", score, confidence, reason, signals, source: "automatic" };
}

function scoreSimilar<T extends RecommendationProduct>(
  source: RecommendationProduct,
  target: T,
  sourceCategory: string,
  targetCategory: string,
  sharedTerms: string[],
  lang: "en" | "ar",
): ProductRecommendation<T> | null {
  if (sourceCategory !== targetCategory || targetCategory === "accessories") return null;
  const tierDistance = Math.abs(priceTierIndex(source) - priceTierIndex(target));
  const backTypeAligned = backType(source) && backType(source) === backType(target);
  const driverOverlap = sharedTerms.some((term) => /driver|planar|dynamic|armature|hybrid|condenser|closed-back|open-back/.test(term));
  const score = 70 + sharedTerms.length * 7 + (backTypeAligned ? 10 : 0) + (driverOverlap ? 8 : 0) - tierDistance * 6;
  const confidence = 0.64 + sharedTerms.length * 0.06 + (backTypeAligned ? 0.08 : 0) + (driverOverlap ? 0.06 : 0) - tierDistance * 0.03;
  if (confidence < 0.7) return null;
  return {
    product: target,
    type: "similar",
    score,
    confidence: clampConfidence(confidence),
    reason: lang === "ar" ? "خيار قريب في نفس الفئة والاستخدام." : "A close option in the same category and use case.",
    signals: ["same_category", ...sharedTerms.slice(0, 4), tierDistance <= 1 ? "matching_price_tier" : "near_price_tier"],
    source: "automatic",
  };
}

function scoreAlternative<T extends RecommendationProduct>(
  source: RecommendationProduct,
  target: T,
  sourceCategory: string,
  targetCategory: string,
  sharedTerms: string[],
  lang: "en" | "ar",
): ProductRecommendation<T> | null {
  if (sourceCategory !== targetCategory || targetCategory === "accessories") return null;
  const sourceOut = source.inStock === false;
  const tierDistance = Math.abs(priceTierIndex(source) - priceTierIndex(target));
  if (!sourceOut && (sharedTerms.length < 2 || tierDistance > 1)) return null;
  const score = (sourceOut ? 88 : 76) + sharedTerms.length * 5 - tierDistance * 5;
  const confidence = (sourceOut ? 0.82 : 0.72) + sharedTerms.length * 0.04 - tierDistance * 0.03;
  if (confidence < 0.7) return null;
  return {
    product: target,
    type: "alternative",
    score,
    confidence: clampConfidence(confidence),
    reason: sourceOut
      ? lang === "ar"
        ? "بديل قريب إذا لم يكن المنتج الأساسي متوفراً."
        : "A close alternative while this item is unavailable."
      : lang === "ar"
        ? "بديل قريب بنفس الفئة والسعر."
        : "A nearby alternative in the same lane.",
    signals: ["alternative", ...sharedTerms.slice(0, 4), tierDistance <= 1 ? "matching_price_tier" : "near_price_tier"],
    source: "automatic",
  };
}

function scoreSameBrand<T extends RecommendationProduct>(
  source: RecommendationProduct,
  target: T,
  sourceCategory: string,
  targetCategory: string,
  sharedTerms: string[],
  lang: "en" | "ar",
): ProductRecommendation<T> | null {
  if (!source.brand || !target.brand || source.brand.toLowerCase() !== target.brand.toLowerCase()) return null;
  if (sourceCategory !== targetCategory && sharedTerms.length === 0) return null;
  const score = 72 + sharedTerms.length * 5 + (sourceCategory === targetCategory ? 8 : 0);
  const confidence = 0.7 + sharedTerms.length * 0.04 + (sourceCategory === targetCategory ? 0.06 : 0);
  if (confidence < 0.7) return null;
  return {
    product: target,
    type: "same_brand",
    score,
    confidence: clampConfidence(confidence),
    reason: lang === "ar" ? "من نفس البراند وبسياق قريب." : "Same brand, related use case.",
    signals: ["same_brand", ...(sourceCategory === targetCategory ? ["same_category"] : []), ...sharedTerms.slice(0, 3)],
    source: "automatic",
  };
}

function groupRecommendations<T extends RecommendationProduct>(
  recommendations: ProductRecommendation<T>[],
  lang: "en" | "ar",
): ProductRecommendationSection<T>[] {
  const groups: Record<ProductRecommendationSection["type"], ProductRecommendation<T>[]> = {
    recommended_accessories: [],
    compatible_with: [],
    similar_products: [],
    alternatives: [],
    same_brand: [],
  };

  for (const recommendation of recommendations.sort((a, b) => b.score - a.score || b.confidence - a.confidence)) {
    const sectionType = recommendationTypeToSection(recommendation.type);
    const group = groups[sectionType];
    if (group.some((item) => item.product.id === recommendation.product.id)) continue;
    if (group.length >= SECTION_LIMITS[sectionType]) continue;
    group.push(recommendation);
  }

  return SECTION_ORDER.map((type) => ({
    type,
    title: SECTION_TITLES[lang][type],
    items: groups[type],
  }));
}

function recommendationTypeToSection(type: RecommendationType): ProductRecommendationSection["type"] {
  if (type === "accessory") return "recommended_accessories";
  if (type === "compatible") return "compatible_with";
  if (type === "alternative") return "alternatives";
  if (type === "same_brand") return "same_brand";
  return "similar_products";
}

function dedupeRecommendations<T extends RecommendationProduct>(items: ProductRecommendation<T>[]) {
  const best = new Map<string, ProductRecommendation<T>>();
  for (const item of items) {
    const key = `${item.product.id}:${item.type}`;
    const existing = best.get(key);
    if (!existing || item.score > existing.score || item.source === "manual") best.set(key, item);
  }

  const byProduct = new Map<string, ProductRecommendation<T>>();
  const priority: Record<RecommendationType, number> = {
    accessory: 5,
    compatible: 4,
    similar: 3,
    alternative: 2,
    same_brand: 1,
  };
  for (const item of best.values()) {
    const key = String(item.product.id || "");
    const existing = byProduct.get(key);
    if (!existing || item.score + priority[item.type] > existing.score + priority[existing.type]) {
      byProduct.set(key, item);
    }
  }
  return [...byProduct.values()];
}

function getManualRelationships(product: RecommendationProduct): ProductRelationship[] {
  const raw = product.relationships || product.productRelationships || [];
  return Array.isArray(raw) ? raw : [];
}

function isRecommendableProduct(product: RecommendationProduct, manual: boolean) {
  const status = String(product.status || "published");
  if (["hidden", "archived", "draft", "needs_review"].includes(status)) return false;
  if (product.needsReview && !manual) return false;
  if (!product.id) return false;
  if (!product.price && !manual) return false;
  if (product.inStock === false && !manual) return false;
  return true;
}

function terms(product: RecommendationProduct) {
  return new Set([
    normalizeTerm(product.category),
    ...(product.subCategories || []).map(normalizeTerm),
    ...(product.tags || []).map(normalizeTerm),
    ...specPairs(product).flatMap((pair) => [normalizeTerm(pair.label), normalizeTerm(pair.value)]),
    ...textOf(product).split(/[^a-z0-9\u0600-\u06ff.]+/i).map(normalizeTerm),
  ].filter(Boolean));
}

function specPairs(product: RecommendationProduct) {
  return (product.specs || []).map((spec) => ({
    label: typeof spec.label === "string" ? spec.label : spec.label?.en || spec.label?.ar || "",
    value: spec.value || "",
  }));
}

function textOf(product: RecommendationProduct) {
  return [
    product.brand,
    product.category,
    ...(product.subCategories || []),
    product.name?.en,
    product.name?.ar,
    product.tagline?.en,
    product.tagline?.ar,
    ...(product.features || []),
    ...(product.tags || []),
    ...specPairs(product).flatMap((pair) => [pair.label, pair.value]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function connectorType(product: RecommendationProduct) {
  const text = textOf(product);
  if (/\bmmcx\b/.test(text)) return "mmcx";
  if (/\b(?:2[\s-]*pin|0\.78|0\.75|qdc)\b/.test(text)) return "2-pin";
  if (/\b(?:xlr|3-pin xlr|4-pin xlr)\b/.test(text)) return "xlr";
  if (/\btrs\b/.test(text)) return "trs";
  if (/\b4\.4\s*mm|balanced\b/.test(text)) return "4.4mm";
  if (/\b3\.5\s*mm|single-ended\b/.test(text)) return "3.5mm";
  if (/\busb(?:-c)?\b/.test(text)) return "usb";
  return "";
}

function connectorsCompatible(source: string, target: string) {
  if (!source || !target) return false;
  if (source === target) return true;
  if (source === "xlr" && target === "trs") return true;
  if (source === "trs" && target === "xlr") return true;
  return false;
}

function isUsbMicrophone(product: RecommendationProduct) {
  return normalizeProductCategory(product) === "mic" && /\busb(?:-c)?\b/i.test(textOf(product));
}

function isXlrMicrophone(product: RecommendationProduct) {
  return normalizeProductCategory(product) === "mic" && /\bxlr\b/i.test(textOf(product)) && !isUsbMicrophone(product);
}

function needsAmplification(product: RecommendationProduct) {
  const text = textOf(product);
  if (/\b(planar|he6|high impedance|hard to drive|desktop amplifier)\b/i.test(text)) return true;
  const impedanceMatch = text.match(/(\d{2,3})\s*(?:ohm|Ω)/i);
  const sensitivityMatch = text.match(/(\d{2,3}(?:\.\d+)?)\s*db\/?mw/i);
  return Boolean(
    (impedanceMatch && Number(impedanceMatch[1]) >= 80) ||
      (sensitivityMatch && Number(sensitivityMatch[1]) <= 92),
  );
}

function backType(product: RecommendationProduct) {
  const text = textOf(product);
  if (/\bopen[-\s]?back\b/.test(text)) return "open-back";
  if (/\bclosed[-\s]?back\b/.test(text)) return "closed-back";
  return "";
}

function priceTierIndex(product: RecommendationProduct) {
  const price = Number(product.price || 0);
  if (price <= 0) return 1;
  if (price < 75000) return 0;
  if (price < 250000) return 1;
  if (price < 700000) return 2;
  return 3;
}

function defaultReason(type: RecommendationType, source: RecommendationProduct, target: RecommendationProduct, lang: "en" | "ar") {
  if (type === "accessory") return lang === "ar" ? "علاقة يدوية كملحق مناسب." : "Manually selected compatible accessory.";
  if (type === "compatible") return lang === "ar" ? "علاقة يدوية كمنتج متوافق." : "Manually selected compatible product.";
  if (type === "alternative") return lang === "ar" ? "بديل محدد يدوياً." : "Manually selected alternative.";
  if (type === "same_brand") return lang === "ar" ? "منتج مرتبط من نفس البراند." : "Related product from the same brand.";
  return lang === "ar" ? "منتج مشابه محدد يدوياً." : "Manually selected similar product.";
}

function normalizeTerm(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\u0600-\u06ff.]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatConnector(connector: string) {
  if (connector === "2-pin") return "2-pin";
  if (connector === "mmcx") return "MMCX";
  if (connector === "xlr") return "XLR";
  if (connector === "trs") return "TRS";
  return connector;
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
