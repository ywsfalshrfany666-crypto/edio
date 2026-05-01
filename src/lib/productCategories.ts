export const productCategorySlugs = [
  "headphones",
  "iems",
  "dap",
  "dac",
  "audio-interface",
  "mic",
  "accessories",
] as const;

export type ProductCategorySlug = (typeof productCategorySlugs)[number];
export type NormalizedProductCategory = ProductCategorySlug | "unknown";

export const productCategoryKeyBySlug: Record<ProductCategorySlug, string> = {
  headphones: "headphones",
  iems: "iems",
  dap: "dap",
  dac: "dac",
  "audio-interface": "audioInterface",
  mic: "mic",
  accessories: "accessories",
};

type CategorySource = {
  category?: string;
  subCategories?: string[];
  slug?: string;
  brand?: string;
  name?: { en?: string; ar?: string } | string;
  tagline?: { en?: string; ar?: string } | string;
  features?: string[];
  specs?: Array<{ label?: string | { en?: string; ar?: string }; value?: string }>;
};

const categoryAliases: Record<string, ProductCategorySlug> = {
  headphone: "headphones",
  headphones: "headphones",
  "سماعات": "headphones",
  "سماعات-الرأس": "headphones",
  iem: "iems",
  iems: "iems",
  earphone: "iems",
  earphones: "iems",
  earbuds: "iems",
  dap: "dap",
  "digital-audio-player": "dap",
  player: "dap",
  dac: "dac",
  amp: "dac",
  "dac-amp": "dac",
  "dac-and-amp": "dac",
  microphone: "mic",
  microphones: "mic",
  mic: "mic",
  "audio-interface": "audio-interface",
  interface: "audio-interface",
  accessories: "accessories",
  accessory: "accessories",
  cable: "accessories",
  cables: "accessories",
  eartips: "accessories",
  "ear-tips": "accessories",
  cases: "accessories",
};

function keyify(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function textOfName(name: CategorySource["name"]) {
  if (!name) return "";
  if (typeof name === "string") return name;
  return [name.en, name.ar].filter(Boolean).join(" ");
}

function textOfTagline(tagline: CategorySource["tagline"]) {
  if (!tagline) return "";
  if (typeof tagline === "string") return tagline;
  return [tagline.en, tagline.ar].filter(Boolean).join(" ");
}

function textOfSpecLabel(label: CategorySource["specs"] extends Array<infer T> ? T extends { label?: infer L } ? L : never : never) {
  if (!label) return "";
  if (typeof label === "string") return label;
  return [label.en, label.ar].filter(Boolean).join(" ");
}

function buildCategoryHaystack(product: CategorySource) {
  return [
    product.category,
    product.slug,
    product.brand,
    textOfName(product.name),
    textOfTagline(product.tagline),
    ...(product.subCategories || []),
    ...(product.features || []),
    ...(product.specs || []).flatMap((spec) => [textOfSpecLabel(spec.label), spec.value || ""]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function normalizeProductCategory(product: CategorySource): NormalizedProductCategory {
  const rawCategory = keyify(product.category);
  if (categoryAliases[rawCategory]) return categoryAliases[rawCategory];

  const haystack = buildCategoryHaystack(product);
  const title = [textOfName(product.name), product.slug].filter(Boolean).join(" ").toLowerCase();

  if (/\b(audio interface|usb interface|recording interface|sound card|xlr interface)\b/.test(haystack)) return "audio-interface";
  if (/\b(dap|digital audio player|music player|hi-?res player|hiby r3|r3ii|hiby m300|snowsky echo mini)\b/.test(haystack)) return "dap";
  if (/\b(microphone|studio mic|condenser mic|dynamic mic|usb microphone)\b/.test(haystack)) return "mic";
  if (/\b(headphone|headphones|over-ear|on-ear|open-back|closed-back|circumaural|supra-aural)\b/.test(title)) return "headphones";
  if (/\b(headphone|headphones|over-ear|on-ear|open-back|closed-back|circumaural|supra-aural)\b/.test(haystack)) return "headphones";
  if (/\b(iem|iems|in-ear monitor|in ear monitor|earphone|earphones|earbud|earbuds|tws)\b/.test(haystack)) return "iems";
  if (/\b(dac|amp|amplifier|dongle|decoder|cs43131|ak4493|es9039|balanced out|line out)\b/.test(haystack)) return "dac";
  if (/\b(cable|cables|adapter|adaptor|eartip|eartips|ear tip|ear tips|case|pouch|storage|convertor|converter|mmcx|2-pin|0\.78mm)\b/.test(haystack)) {
    return "accessories";
  }

  return "unknown";
}

export function productMatchesCategory(product: CategorySource, category: string) {
  return normalizeProductCategory(product) === normalizeProductCategory({ category });
}

export function getCategoryTranslationKey(category: string) {
  return productCategoryKeyBySlug[normalizeProductCategory({ category }) as ProductCategorySlug] || "";
}
