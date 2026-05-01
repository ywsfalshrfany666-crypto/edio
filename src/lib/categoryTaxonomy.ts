import { normalizeProductCategory, type NormalizedProductCategory } from "./productCategories.ts";

export type CategoryTermLabel = {
  en: string;
  ar: string;
};

export type CategoryTermDefinition = {
  slug: string;
  label: CategoryTermLabel;
  aliases?: string[];
  children?: CategoryTermDefinition[];
};

type CategoryTermSource = {
  category?: string;
  subCategories?: string[];
  categoryAssignment?: {
    secondaryCategorySlugs?: string[];
    secondary_category_slugs?: string[];
  } | null;
  name?: { en?: string; ar?: string } | string;
  slug?: string;
  brand?: string;
  tagline?: { en?: string; ar?: string } | string;
  features?: string[];
  specs?: Array<{ label?: string | { en?: string; ar?: string }; value?: string }>;
};

export const categoryTerms: Partial<Record<NormalizedProductCategory, CategoryTermDefinition[]>> = {
  headphones: [
    {
      slug: "type-back",
      label: { en: "Back Type", ar: "نوع العزل" },
      aliases: ["back-type"],
      children: [
        { slug: "closed-back", label: { en: "Closed Back", ar: "مغلق" } },
        { slug: "open-back", label: { en: "Open Back", ar: "مفتوح" } },
      ],
    },
    {
      slug: "driver-configuration",
      label: { en: "Driver Configuration", ar: "نوع الدرايفر" },
      aliases: ["driver", "driver-configuration-headphone"],
      children: [
        {
          slug: "dynamic-driver",
          label: { en: "Dynamic Driver", ar: "درايفر داينمك" },
          aliases: ["dynamic", "dynamic-driver-driver-configuration-headphone"],
        },
        {
          slug: "planar-driver",
          label: { en: "Planar Driver", ar: "درايفر بلانر" },
          aliases: ["planar", "planar-driver-driver-configuration-headphone"],
        },
      ],
    },
  ],
  iems: [
    {
      slug: "driver-configuration",
      label: { en: "Driver Configuration", ar: "نوع الدرايفر" },
      aliases: ["driver"],
      children: [
        { slug: "dynamic-driver", label: { en: "Dynamic Driver", ar: "درايفر داينمك" }, aliases: ["dynamic"] },
        { slug: "planar-driver", label: { en: "Planar Driver", ar: "درايفر بلانر" }, aliases: ["planar"] },
        { slug: "balanced-armatures", label: { en: "Balanced Armatures", ar: "بالانسد أرمتشر" }, aliases: ["ba"] },
        { slug: "hybrid-drivers", label: { en: "Hybrid Drivers", ar: "هايبرد" }, aliases: ["hybrid"] },
      ],
    },
    { slug: "wireless", label: { en: "Wireless", ar: "لاسلكي" }, aliases: ["tws", "true-wireless"] },
  ],
  dap: [
    { slug: "portable", label: { en: "Portable", ar: "محمول" } },
    { slug: "bluetooth", label: { en: "Bluetooth", ar: "بلوتوث" } },
  ],
  dac: [
    { slug: "portable", label: { en: "Portable", ar: "محمول" }, aliases: ["dongle"] },
    { slug: "desktop", label: { en: "Desktop", ar: "مكتبي" } },
    { slug: "bluetooth", label: { en: "Bluetooth", ar: "بلوتوث" } },
  ],
  "audio-interface": [
    { slug: "desktop", label: { en: "Desktop", ar: "مكتبي" } },
    { slug: "portable", label: { en: "Portable", ar: "محمول" } },
  ],
  mic: [
    { slug: "dynamic", label: { en: "Dynamic", ar: "داينمك" } },
    { slug: "condenser", label: { en: "Condenser", ar: "كوندنسر" } },
  ],
  accessories: [
    { slug: "audio-cables", label: { en: "Audio Cables", ar: "كيابل صوت" }, aliases: ["cables", "cable"] },
    { slug: "eartips", label: { en: "Eartips", ar: "Ear Tips" }, aliases: ["ear-tips", "ear-tips-tips"] },
    {
      slug: "cable-convertors",
      label: { en: "Cable Convertors", ar: "محوّلات كيابل" },
      aliases: ["convertors", "converters", "adapters", "adaptors"],
    },
    {
      slug: "cases",
      label: { en: "Storage Boxes / Cases", ar: "علب وحافظات" },
      aliases: ["case", "storage", "storage-boxes", "storage-boxes-cases"],
    },
  ],
};

export function keyifyTerm(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function flattenCategoryTerms(category: string | undefined, includeGroups = true) {
  const normalizedCategory = normalizeProductCategory({ category });
  const terms = categoryTerms[normalizedCategory] || [];
  const flat: CategoryTermDefinition[] = [];

  const visit = (term: CategoryTermDefinition) => {
    if (includeGroups || !term.children?.length) flat.push(term);
    term.children?.forEach(visit);
  };

  terms.forEach(visit);
  return flat;
}

export function getDisplayCategoryTerms(category: string | undefined) {
  return flattenCategoryTerms(category, false);
}

export function resolveCategoryTerm(category: string | undefined, term: string | null | undefined) {
  const requested = keyifyTerm(term);
  if (!requested) return null;
  return (
    flattenCategoryTerms(category).find((candidate) => {
      const keys = [candidate.slug, ...(candidate.aliases || [])].map(keyifyTerm);
      return keys.includes(requested);
    }) || null
  );
}

function collectTermKeys(term: CategoryTermDefinition, includeChildren: boolean) {
  const keys = new Set([term.slug, ...(term.aliases || [])].map(keyifyTerm));
  if (includeChildren) {
    for (const child of term.children || []) {
      collectTermKeys(child, true).forEach((key) => keys.add(key));
    }
  }
  return keys;
}

export function getProductCategoryTerms(product: CategoryTermSource) {
  const assignmentTerms =
    product.categoryAssignment?.secondaryCategorySlugs ||
    product.categoryAssignment?.secondary_category_slugs ||
    [];
  return Array.from(new Set([...(product.subCategories || []), ...assignmentTerms].map(keyifyTerm).filter(Boolean)));
}

export function productMatchesCategoryTerm(
  product: CategoryTermSource,
  category: string | undefined,
  term?: string | null,
) {
  const normalizedCategory = normalizeProductCategory(product);
  const requestedCategory = normalizeProductCategory({ category });
  if (normalizedCategory !== requestedCategory) return false;

  const requestedTerm = keyifyTerm(term);
  if (!requestedTerm) return true;

  const termDefinition = resolveCategoryTerm(requestedCategory, requestedTerm);
  if (!termDefinition) return false;

  const acceptedTerms = collectTermKeys(termDefinition, true);
  const productTerms = getProductCategoryTerms(product);
  return productTerms.some((item) => acceptedTerms.has(item));
}

export function countProductsForCategoryTerm(products: CategoryTermSource[], category: string, term?: string | null) {
  return products.filter((product) => productMatchesCategoryTerm(product, category, term)).length;
}

export function getPrimaryProductTerm(product: CategoryTermSource) {
  const normalizedCategory = normalizeProductCategory(product);
  const terms = flattenCategoryTerms(normalizedCategory, false);
  return terms.find((term) => productMatchesCategoryTerm(product, normalizedCategory, term.slug)) || null;
}

export function getTermLabel(term: CategoryTermDefinition | null | undefined, lang: "en" | "ar") {
  return term?.label?.[lang] || term?.label?.en || "";
}

export function getCategoryPath(category: string, term?: string | null) {
  const resolved = resolveCategoryTerm(category, term);
  return resolved ? `/category/${normalizeProductCategory({ category })}/${resolved.slug}` : `/category/${normalizeProductCategory({ category })}`;
}
