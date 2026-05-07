type SearchableSpec = {
  label?: string | { en?: string; ar?: string };
  value?: string;
};

type SearchableProduct = {
  name?: { en?: string; ar?: string };
  brand?: string;
  category?: string;
  subCategories?: string[];
  tagline?: { en?: string; ar?: string };
  features?: string[];
  specs?: SearchableSpec[];
  tags?: string[];
};

const SYNONYM_GROUPS = [
  ["سماعة", "سماعات", "هيدفون", "headphone", "headphones", "earphone", "earphones"],
  ["ايرفون", "ايرفونز", "ايربودز", "iem", "iems", "in ear", "in-ear", "in ear monitor", "in-ear monitor"],
  ["مايك", "ميكروفون", "microphone", "mic"],
  ["كرت صوت", "كرت الصوت", "audio interface", "interface"],
  ["امب", "أمب", "amp", "amplifier"],
  ["داك", "dac", "dacs"],
  ["كيبل", "كابل", "cable", "cables"],
  ["بلوتوث", "bluetooth", "wireless", "لاسلكي"],
  ["استوديو", "studio", "recording"],
  ["قيمنق", "جيمنج", "gaming", "console"],
  ["سفر", "travel", "portable"],
];

const NORMALIZED_SYNONYM_GROUPS = SYNONYM_GROUPS.map((group) => group.map(normalizeSearchText));

export function normalizeSearchText(value: unknown) {
  return String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u064b-\u065f\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function expandSearchQuery(query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  const tokens = new Set(normalizedQuery.split(" ").filter(Boolean));
  const expanded = new Set<string>([normalizedQuery, ...tokens]);

  for (const group of NORMALIZED_SYNONYM_GROUPS) {
    const matched = group.some((term) => normalizedQuery.includes(term) || tokens.has(term));
    if (!matched) continue;
    for (const term of group) {
      expanded.add(term);
      term.split(" ").forEach((part) => part && expanded.add(part));
    }
  }

  return [...expanded].filter((term) => term.length > 1);
}

export function getProductSearchText(product: SearchableProduct) {
  const specText = (product.specs || [])
    .map((spec) => {
      const label =
        typeof spec.label === "string"
          ? spec.label
          : [spec.label?.en, spec.label?.ar].filter(Boolean).join(" ");
      return `${label || ""} ${spec.value || ""}`;
    })
    .join(" ");

  return [
    product.name?.en,
    product.name?.ar,
    product.brand,
    product.category,
    ...(product.subCategories || []),
    product.tagline?.en,
    product.tagline?.ar,
    ...(product.features || []),
    ...(product.tags || []),
    specText,
  ]
    .filter(Boolean)
    .join(" ");
}

export function scoreProductSearch(product: SearchableProduct, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 1;

  const text = normalizeSearchText(getProductSearchText(product));
  if (!text) return 0;

  const nameText = normalizeSearchText(`${product.name?.en || ""} ${product.name?.ar || ""}`);
  const brandText = normalizeSearchText(product.brand || "");
  const categoryText = normalizeSearchText([product.category, ...(product.subCategories || [])].join(" "));
  const terms = expandSearchQuery(query);

  let score = 0;
  if (nameText.includes(normalizedQuery)) score += 70;
  if (brandText.includes(normalizedQuery)) score += 55;
  if (categoryText.includes(normalizedQuery)) score += 40;
  if (text.includes(normalizedQuery)) score += 35;

  for (const term of terms) {
    if (nameText.includes(term)) score += 18;
    else if (brandText.includes(term)) score += 14;
    else if (categoryText.includes(term)) score += 12;
    else if (text.includes(term)) score += 8;
  }

  return score;
}

export function matchesProductSearch(product: SearchableProduct, query: string) {
  return scoreProductSearch(product, query) > 0;
}

export function matchesBrandSearch(brand: string, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  const brandText = normalizeSearchText(brand);
  return brandText.includes(normalizedQuery) || expandSearchQuery(query).some((term) => brandText.includes(term));
}

export function getSearchHint(lang: "en" | "ar") {
  return lang === "ar" ? "جرّب: IEM، DAC، مايك، كرت صوت" : "Try: IEM, DAC, microphone, audio interface";
}
