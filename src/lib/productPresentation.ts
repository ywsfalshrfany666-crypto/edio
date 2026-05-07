import { getTermLabel, resolveCategoryTerm } from "@/lib/categoryTaxonomy";
import { normalizeProductCategory } from "@/lib/productCategories";

type LocalizedText = { en?: string; ar?: string } | string | null | undefined;

export type PresentationSpec = {
  label: string | { en?: string; ar?: string };
  value: string;
};

export type PresentationProduct = {
  id?: string;
  slug?: string;
  name?: { en?: string; ar?: string };
  brand?: string;
  category?: string;
  subCategories?: string[];
  tagline?: { en?: string; ar?: string };
  features?: string[];
  specs?: PresentationSpec[];
  badge?: "new" | "featured" | "best" | "preowned" | null;
  inStock?: boolean;
  stock?: number;
  price?: number;
};

export type PresentationFact = {
  key: string;
  label: string;
  value: string;
  priority: number;
};

export type PairingSuggestion<T extends PresentationProduct = PresentationProduct> = {
  product: T;
  reason: string;
};

const CATEGORY_LABELS = {
  en: {
    headphones: "Headphones",
    iems: "In-ear monitors",
    dac: "DAC / AMP",
    dap: "Digital audio player",
    mic: "Microphone",
    "audio-interface": "Audio interface",
    accessories: "Accessory",
    preowned: "Pre-owned",
  },
  ar: {
    headphones: "سماعات رأس",
    iems: "سماعات IEM",
    dac: "DAC / AMP",
    dap: "مشغل صوت محمول",
    mic: "مايكروفون",
    "audio-interface": "كرت صوت",
    accessories: "إكسسوار",
    preowned: "مستعمل معتمد",
  },
} as const;

const SUBCATEGORY_LABELS: Record<string, { en: string; ar: string; key: string; priority: number }> = {
  "closed-back": { en: "Closed-back", ar: "مغلقة الخلفية", key: "back", priority: 100 },
  "open-back": { en: "Open-back", ar: "مفتوحة الخلفية", key: "back", priority: 100 },
  "dynamic-driver": { en: "Dynamic driver", ar: "درايفر داينمك", key: "driver", priority: 88 },
  "dynamic-driver-driver-configuration-headphone": { en: "Dynamic driver", ar: "درايفر داينمك", key: "driver", priority: 88 },
  "planar-driver": { en: "Planar driver", ar: "درايفر بلانر", key: "driver", priority: 92 },
  "planar-driver-driver-configuration-headphone": { en: "Planar driver", ar: "درايفر بلانر", key: "driver", priority: 92 },
  "balanced-armatures": { en: "Balanced armature", ar: "بالانسد أرمتشر", key: "driver", priority: 88 },
  "hybrid-drivers": { en: "Hybrid drivers", ar: "درايفرات هجينة", key: "driver", priority: 90 },
  wireless: { en: "Wireless", ar: "لاسلكي", key: "connection", priority: 92 },
  bluetooth: { en: "Bluetooth", ar: "بلوتوث", key: "connection", priority: 88 },
  portable: { en: "Portable", ar: "محمول", key: "form", priority: 96 },
  desktop: { en: "Desktop", ar: "مكتبي", key: "form", priority: 96 },
  dynamic: { en: "Dynamic", ar: "داينمك", key: "transducer", priority: 96 },
  condenser: { en: "Condenser", ar: "كوندنسر", key: "transducer", priority: 96 },
  "audio-cables": { en: "Audio cable", ar: "كيبل صوت", key: "accessory", priority: 96 },
  eartips: { en: "Ear tips", ar: "Ear Tips", key: "accessory", priority: 96 },
  "cable-convertors": { en: "Cable convertor", ar: "محوّل كيبل", key: "accessory", priority: 96 },
  cases: { en: "Case / storage", ar: "علبة أو حافظة", key: "accessory", priority: 94 },
};

const CATEGORY_SPEC_PRIORITY: Record<string, string[]> = {
  headphones: ["headphone type", "acoustic system", "driver type", "speaker diameter", "driver size", "impedance", "sensitivity", "frequency response", "connector", "weight"],
  iems: ["driver type", "driver", "impedance", "sensitivity", "frequency response", "connector", "plug", "cable"],
  dac: ["output power", "balanced output", "outputs", "inputs", "max pcm", "sample rate", "bluetooth", "gain", "usb"],
  dap: ["output power", "balanced output", "storage", "battery", "bluetooth", "sample rate", "outputs"],
  mic: ["transducer", "polar pattern", "connector", "frequency response", "impedance", "sensitivity"],
  "audio-interface": ["inputs", "outputs", "i/o", "connection", "phantom", "sample rate", "bit depth", "loopback"],
  accessories: ["compatibility", "connector", "length", "cable type", "quantity", "material"],
};

const BRAND_PRIORITY: Array<{ match: RegExp; terms: string[] }> = [
  { match: /\b(shure)\b/i, terms: ["polar pattern", "connector", "gain", "accessories", "podcast", "broadcast"] },
  { match: /\b(focusrite)\b/i, terms: ["i/o", "inputs", "outputs", "air", "auto gain", "clip safe", "usb"] },
  { match: /\b(yamaha)\b/i, terms: ["unit", "woofer", "driver size", "power", "frequency response", "room control"] },
  { match: /\b(audio[-\s]?technica)\b/i, terms: ["comfort", "closed-back", "open-back", "driver", "cable"] },
  { match: /\b(beyerdynamic)\b/i, terms: ["impedance", "open-back", "closed-back", "frequency response", "comfort"] },
  { match: /\b(fiio|ifi)\b/i, terms: ["output power", "balanced", "outputs", "gain", "sample rate", "portable"] },
  { match: /\b(mogami)\b/i, terms: ["connector", "length", "balanced", "cable type"] },
];

function text(value: LocalizedText, lang: "en" | "ar") {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  return String(value[lang] || value.en || value.ar || "").trim();
}

function specLabel(spec: PresentationSpec, lang: "en" | "ar") {
  return text(spec.label as LocalizedText, lang);
}

function normalizeKey(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function specScore(label: string, product: PresentationProduct) {
  const category = normalizeProductCategory(product);
  const normalized = label.toLowerCase();
  const categoryTerms = CATEGORY_SPEC_PRIORITY[category] || [];
  const brandTerms = BRAND_PRIORITY.find((profile) => profile.match.test(product.brand || ""))?.terms || [];
  const ordered = [...brandTerms, ...categoryTerms];
  const index = ordered.findIndex((term) => normalized.includes(term));
  return index >= 0 ? 90 - index : 0;
}

function uniqueFacts(facts: PresentationFact[]) {
  const seen = new Set<string>();
  return facts.filter((fact) => {
    const key = `${normalizeKey(fact.key)}:${normalizeKey(fact.value)}`;
    if (!fact.value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getCategoryLabel(product: PresentationProduct, lang: "en" | "ar") {
  const category = normalizeProductCategory(product);
  return CATEGORY_LABELS[lang][category as keyof (typeof CATEGORY_LABELS)["en"]] || (lang === "ar" ? "منتج صوتي" : "Audio product");
}

export function getPresentationFacts(product: PresentationProduct, lang: "en" | "ar", limit = 8) {
  const facts: PresentationFact[] = [];
  const category = normalizeProductCategory(product);

  for (const rawTerm of product.subCategories || []) {
    const resolved = resolveCategoryTerm(category, rawTerm);
    const slug = resolved?.slug || rawTerm;
    const local = SUBCATEGORY_LABELS[slug] || SUBCATEGORY_LABELS[normalizeKey(rawTerm)];
    const value = local?.[lang] || (resolved ? getTermLabel(resolved, lang) : "");
    if (value && !["type-back", "driver-configuration", "driver-configuration-headphone"].includes(slug)) {
      const key = local?.key || slug;
      facts.push({ key, label: factLabelForKey(key, lang), value, priority: local?.priority || 70 });
    }
  }

  for (const spec of product.specs || []) {
    const label = specLabel(spec, lang);
    const value = String(spec.value || "").trim();
    const priority = specScore(label, product);
    if (priority > 0 && value) {
      facts.push({ key: normalizeKey(label), label, value, priority });
    }
  }

  return uniqueFacts(facts)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
}

export function getCardMeta(product: PresentationProduct, lang: "en" | "ar") {
  const values = getPresentationFacts(product, lang, 3)
    .map((fact) => fact.value)
    .filter(Boolean);
  return values.slice(0, 2).join(" / ") || getCategoryLabel(product, lang);
}

export function getOrderedSpecs(product: PresentationProduct, lang: "en" | "ar", limit = 16) {
  return [...(product.specs || [])]
    .map((spec, index) => ({ spec, index, score: specScore(specLabel(spec, lang), product) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .filter(({ spec }) => specLabel(spec, lang) && String(spec.value || "").trim())
    .slice(0, limit)
    .map(({ spec }) => spec);
}

export function getConciseDescription(product: PresentationProduct, lang: "en" | "ar") {
  const tagline = text(product.tagline, lang);
  if (tagline && !looksLikeSpecDump(tagline) && tagline.length <= 240) return tagline;

  const feature = (product.features || [])
    .map(cleanFeatureLine)
    .find((item) => item && !looksLikeSpecDump(item) && !looksLikeBoxItem(item) && item.length <= 220);
  if (feature) return feature;

  const name = text(product.name, lang) || product.brand || "";
  const category = getCategoryLabel(product, lang);
  if (lang === "ar") {
    return `${name} ${category} منظم للشراء السريع: صورة واضحة، سعر مباشر، وأهم التفاصيل الفنية بدون ازدحام.`;
  }
  return `${name} is presented with the essentials first: clean imagery, clear price, and the key technical details without extra noise.`;
}

export function getProductHighlights(product: PresentationProduct, lang: "en" | "ar", limit = 5) {
  const factHighlights = getPresentationFacts(product, lang, 5).map((fact) =>
    lang === "ar" ? `${fact.label}: ${fact.value}` : `${fact.label}: ${fact.value}`,
  );
  const featureHighlights = (product.features || [])
    .map(cleanFeatureLine)
    .filter((item) => item && !looksLikeSpecDump(item) && !looksLikeBoxItem(item))
    .map((item) => trimSentence(item, 150));

  return uniqueStrings([...factHighlights, ...featureHighlights]).slice(0, limit);
}

export function getCompatibleAccessories<T extends PresentationProduct>(product: PresentationProduct, products: T[], limit = 4) {
  const category = normalizeProductCategory(product);
  const wantedTerms: Record<string, string[]> = {
    headphones: ["audio-cables", "cable-convertors", "cases"],
    iems: ["eartips", "audio-cables", "cable-convertors", "cases"],
    dac: ["audio-cables", "cable-convertors", "cases"],
    dap: ["audio-cables", "cable-convertors", "cases"],
    mic: ["audio-cables", "cable-convertors", "cases"],
    "audio-interface": ["audio-cables", "cable-convertors"],
    accessories: [],
  };
  const targets = wantedTerms[category] || [];
  if (!targets.length) return [];

  return products
    .filter((item) => item.id !== product.id && normalizeProductCategory(item) === "accessories")
    .map((item) => {
      const terms = (item.subCategories || []).map(normalizeKey);
      const termScore = targets.reduce((score, term) => score + (terms.includes(term) ? 4 : 0), 0);
      const brandScore = item.brand && product.brand && item.brand.toLowerCase() === product.brand.toLowerCase() ? 1 : 0;
      const stockScore = item.inStock ? 1 : 0;
      return { item, score: termScore + brandScore + stockScore };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || Number(b.item.price || 0) - Number(a.item.price || 0))
    .slice(0, limit)
    .map(({ item }) => item);
}

export function getPairingSuggestions<T extends PresentationProduct>(
  product: PresentationProduct,
  products: T[],
  lang: "en" | "ar",
  limit = 4,
): PairingSuggestion<T>[] {
  const category = normalizeProductCategory(product);
  const needsPower = needsAmplification(product);
  const terms = new Set((product.subCategories || []).map(normalizeKey));
  const rules: Record<string, Array<{ category: string; terms?: string[]; weight: number }>> = {
    headphones: [
      { category: "dac", weight: needsPower ? 14 : 9 },
      { category: "dap", weight: 5 },
      { category: "accessories", terms: ["audio-cables", "cable-convertors", "cases"], weight: 6 },
    ],
    iems: [
      { category: "dac", weight: 7 },
      { category: "dap", weight: 7 },
      { category: "accessories", terms: ["eartips", "audio-cables", "cable-convertors", "cases"], weight: 8 },
    ],
    dac: [
      { category: "headphones", weight: 7 },
      { category: "iems", weight: 6 },
      { category: "accessories", terms: ["audio-cables", "cable-convertors"], weight: 7 },
    ],
    dap: [
      { category: "iems", weight: 8 },
      { category: "headphones", weight: 6 },
      { category: "accessories", terms: ["audio-cables", "cases"], weight: 6 },
    ],
    mic: [
      { category: "audio-interface", weight: productText(product).includes("xlr") ? 14 : 9 },
      { category: "accessories", terms: ["audio-cables", "cable-convertors"], weight: 7 },
      { category: "headphones", weight: 4 },
    ],
    "audio-interface": [
      { category: "mic", weight: 10 },
      { category: "headphones", weight: 7 },
      { category: "accessories", terms: ["audio-cables", "cable-convertors"], weight: 8 },
    ],
    accessories: [],
  };
  const activeRules = rules[category] || [];
  if (!activeRules.length) return [];

  return products
    .filter((item) => item.id !== product.id)
    .map((item) => {
      const itemCategory = normalizeProductCategory(item);
      const itemTerms = (item.subCategories || []).map(normalizeKey);
      const matchedRule = activeRules.find((rule) => rule.category === itemCategory);
      if (!matchedRule) return { item, score: 0, reason: "" };

      const termScore = (matchedRule.terms || []).reduce(
        (score, term) => score + (itemTerms.includes(term) ? 3 : 0),
        0,
      );
      const sharedTerms = itemTerms.filter((term) => terms.has(term)).length;
      const stockScore = item.inStock ? 2 : 0;
      const score = matchedRule.weight + termScore + sharedTerms + stockScore;

      return { item, score, reason: pairingReason(category, itemCategory, itemTerms, needsPower, lang) };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || Number(a.item.price || 0) - Number(b.item.price || 0))
    .slice(0, limit)
    .map(({ item, reason }) => ({ product: item, reason }));
}

export function getSimilarProducts<T extends PresentationProduct>(product: PresentationProduct, products: T[], limit = 4) {
  const category = normalizeProductCategory(product);
  const productTerms = new Set((product.subCategories || []).map(normalizeKey));
  return products
    .filter((item) => item.id !== product.id && normalizeProductCategory(item) !== "accessories")
    .map((item) => {
      const sameCategory = normalizeProductCategory(item) === category ? 8 : 0;
      const sameBrand = item.brand && product.brand && item.brand.toLowerCase() === product.brand.toLowerCase() ? 3 : 0;
      const sharedTerms = (item.subCategories || []).filter((term) => productTerms.has(normalizeKey(term))).length;
      const stockScore = item.inStock ? 1 : 0;
      return { item, score: sameCategory + sameBrand + sharedTerms * 2 + stockScore };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
}

export function getUsefulFaq(product: PresentationProduct, lang: "en" | "ar") {
  const facts = getPresentationFacts(product, lang, 4);
  const category = normalizeProductCategory(product);
  const items: Array<{ q: string; a: string }> = [];

  if (product.badge === "preowned") {
    items.push({
      q: lang === "ar" ? "هل المنتج مستعمل؟" : "Is this item pre-owned?",
      a: lang === "ar"
        ? "نعم، يظهر كمنتج مستعمل معتمد. راجع حالة التوفر والسعر قبل إتمام الطلب."
        : "Yes. It is marked as pre-owned; check availability and price before checkout.",
    });
  }

  if (category === "accessories" && facts.length) {
    items.push({
      q: lang === "ar" ? "كيف أتأكد من التوافق؟" : "How do I check compatibility?",
      a: lang === "ar"
        ? "ابدأ من نوع الموصل أو المنتج المتوافق في المواصفات، ثم طابقه مع جهازك قبل الطلب."
        : "Start with the connector or compatibility field in the specs, then match it to your device before ordering.",
    });
  }

  return items.slice(0, 2);
}

function factLabelForKey(key: string, lang: "en" | "ar") {
  const labels: Record<string, { en: string; ar: string }> = {
    back: { en: "Back type", ar: "نوع الخلفية" },
    driver: { en: "Driver", ar: "الدرايفر" },
    connection: { en: "Connection", ar: "الاتصال" },
    form: { en: "Form", ar: "النمط" },
    transducer: { en: "Capsule", ar: "الكبسولة" },
    accessory: { en: "Accessory type", ar: "نوع الإكسسوار" },
  };
  return labels[key]?.[lang] || (lang === "ar" ? "تفصيل مهم" : "Key detail");
}

function cleanFeatureLine(value: string) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^[•*-]+\s*/, "")
    .replace(/\b(?:inside the box|package contents?|in the box)\b[:-]?\s*/gi, "")
    .trim();
}

function looksLikeBoxItem(value: string) {
  const text = String(value || "").toLowerCase();
  return /\b(user manual|manual|warranty card|service card|certificate|storage case|carrying pouch|pouch|adapter|eartips?|ear tips|plug|cable|cables|headphones?\s*x\d+|earphones?\s*x\d+|pair of headphones|pair of earphones)\b/.test(text);
}

function looksLikeSpecDump(value: string) {
  const textValue = String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!textValue) return false;
  const labels = ["frequency response", "impedance", "sensitivity", "driver", "headphone type", "speaker diameter", "connector", "cable length", "bluetooth version", "acoustic system"];
  const hits = labels.filter((label) => textValue.includes(label)).length;
  return hits >= 2;
}

function productText(product: PresentationProduct) {
  return [
    product.brand,
    product.category,
    ...(product.subCategories || []),
    product.tagline?.en,
    product.tagline?.ar,
    ...(product.features || []),
    ...(product.specs || []).flatMap((spec) => [specLabel(spec, "en"), specLabel(spec, "ar"), spec.value]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function needsAmplification(product: PresentationProduct) {
  const value = productText(product);
  if (/\b(planar|open[-\s]?back|high impedance)\b/i.test(value)) return true;
  const impedanceMatch = value.match(/(\d{2,3})\s*(?:ohm|Ω)/i);
  return impedanceMatch ? Number(impedanceMatch[1]) >= 80 : false;
}

function pairingReason(
  sourceCategory: string,
  targetCategory: string,
  targetTerms: string[],
  needsPower: boolean,
  lang: "en" | "ar",
) {
  if (sourceCategory === "mic" && targetCategory === "audio-interface") {
    return lang === "ar" ? "مناسب للمايكروفونات التي تحتاج كرت صوت." : "Recommended for microphone setups.";
  }
  if (sourceCategory === "audio-interface" && targetCategory === "mic") {
    return lang === "ar" ? "يبني سلسلة تسجيل واضحة وبسيطة." : "Builds a simple recording chain.";
  }
  if ((sourceCategory === "headphones" || sourceCategory === "iems") && targetCategory === "dac") {
    return needsPower
      ? lang === "ar"
        ? "مفيد للاستماع المكتبي مع سماعات تحتاج طاقة."
        : "Good match for power-hungry desktop listening."
      : lang === "ar"
        ? "يحسّن التحكم والتوصيل اليومي."
        : "Useful for cleaner everyday playback.";
  }
  if (targetCategory === "dap") {
    return lang === "ar" ? "مفيد للاستماع المحمول بدون تعقيد." : "Useful for portable listening.";
  }
  if (targetTerms.includes("eartips")) {
    return lang === "ar" ? "يساعد على ضبط الراحة والعزل." : "Helps fine-tune fit and isolation.";
  }
  if (targetTerms.includes("audio-cables") || targetTerms.includes("cable-convertors")) {
    return lang === "ar" ? "يكمل التوصيل حسب جهازك." : "Completes the connection for your setup.";
  }
  if (targetCategory === "headphones") {
    return lang === "ar" ? "مناسب للمراقبة أو الاستماع المركز." : "Good for monitoring or focused listening.";
  }
  return lang === "ar" ? "اختيار عملي لنفس طريقة الاستخدام." : "A practical match for the same setup.";
}

function trimSentence(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}…`;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}
