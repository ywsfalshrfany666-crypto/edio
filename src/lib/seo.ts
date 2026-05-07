import type { Product } from "@/data/catalog";
import { getTermLabel, resolveCategoryTerm } from "@/lib/categoryTaxonomy";
import { getConciseDescription } from "@/lib/productPresentation";

export const SITE_ORIGIN = "https://edio-iq.com";
export const SITE_NAME = "edio";
export const DEFAULT_OG_IMAGE = "/og/edio-og.png";
export const DEFAULT_OG_ALT = "edio premium audio store in Iraq";

export type LocaleCode = "en" | "ar";

export type SeoMeta = {
  title: string;
  description: string;
  canonicalPath: string;
  image: string;
  imageAlt: string;
  keywords: string[];
};

const CATEGORY_LABELS: Record<string, { en: string; ar: string; keywords: string[] }> = {
  headphones: {
    en: "Headphones",
    ar: "سماعات رأس",
    keywords: ["headphones", "studio headphones", "wireless headphones", "سماعات احترافية", "سماعات رأس"],
  },
  iems: {
    en: "IEMs and Earbuds",
    ar: "سماعات IEM",
    keywords: ["IEM", "earbuds", "in-ear monitors", "سماعات IEM", "سماعات داخل الأذن"],
  },
  dac: {
    en: "DAC and Amplifiers",
    ar: "DAC ومضخمات",
    keywords: ["DAC", "amplifier", "hi-fi audio", "مضخم صوت", "داك"],
  },
  dap: {
    en: "Digital Audio Players",
    ar: "مشغلات صوت DAP",
    keywords: ["DAP", "digital audio player", "portable hi-fi", "مشغل صوت محمول"],
  },
  mic: {
    en: "Microphones",
    ar: "ميكروفونات",
    keywords: ["microphone", "studio microphone", "recording mic", "ميكروفون", "مايكروفون"],
  },
  "audio-interface": {
    en: "Audio Interfaces",
    ar: "كروت صوت",
    keywords: ["audio interface", "sound card", "studio recording", "كرت صوت", "واجهة صوت"],
  },
  accessories: {
    en: "Audio Accessories",
    ar: "إكسسوارات صوت",
    keywords: ["audio accessories", "audio cables", "ear tips", "اكسسوارات صوت", "كابلات صوت"],
  },
};

const CATEGORY_CONTEXT = {
  en: "Curated premium audio gear in Iraq with clear product information, real availability, and support before purchase.",
  ar: "اختيارات صوتية Premium في العراق مع معلومات واضحة، توفر حقيقي، ودعم قبل الشراء.",
};

export function absoluteUrl(pathOrUrl = "/") {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_ORIGIN}${path}`;
}

export function cleanSeoText(value: unknown, maxLength = 160) {
  const clean = String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= maxLength) return clean;
  const sliced = clean.slice(0, maxLength - 1).replace(/\s+\S*$/, "").trim();
  return `${sliced || clean.slice(0, maxLength - 1).trim()}…`;
}

export function productDisplayName(product: Pick<Product, "name">, lang: LocaleCode = "en") {
  return product.name[lang] || product.name.en || product.name.ar || "";
}

export function categoryLabel(slug: string, lang: LocaleCode = "en") {
  const category = CATEGORY_LABELS[slug];
  return category?.[lang] || slug.replace(/-/g, " ");
}

export function buildProductSeo(product: Product, lang: LocaleCode = "en"): SeoMeta {
  const name = productDisplayName(product, lang);
  const category = categoryLabel(product.category, lang);
  const productPageSeo = product.productPage?.seo;
  const description = cleanSeoText(
    productPageSeo?.metaDescription ||
      getConciseDescription(product, lang) ||
      product.tagline?.[lang] ||
      product.tagline?.en ||
      `${name} by ${product.brand}, available from edio for premium audio listeners in Iraq.`,
    156,
  );
  const title = cleanSeoText(productPageSeo?.title || `${name} - ${product.brand} ${category}`, 68);
  const keywords = uniqueList([
    ...(productPageSeo?.keywords || []),
    product.brand,
    name,
    category,
    "audiophile",
    "audiofile",
    "hi-fi audio",
    "premium audio",
    "audio gear Iraq",
    "متجر صوتيات العراق",
    "سماعات احترافية",
    ...(CATEGORY_LABELS[product.category]?.keywords || []),
    ...product.subCategories,
  ]);

  return {
    title,
    description,
    canonicalPath: productPageSeo?.canonicalPath || `/product/${product.slug}`,
    image: productPageSeo?.ogImage || product.image || DEFAULT_OG_IMAGE,
    imageAlt: `${name} product image at edio`,
    keywords,
  };
}

export function buildCategorySeo(
  slug: string,
  lang: LocaleCode = "en",
  termSlug?: string | null,
): SeoMeta {
  const term = termSlug ? resolveCategoryTerm(slug, termSlug) : null;
  const parent = categoryLabel(slug, lang);
  const label = term ? getTermLabel(term, lang) : parent;
  const canonicalPath = `/category/${slug}${term ? `/${term.slug}` : ""}`;
  const title = term
    ? `${label} ${parent}`
    : lang === "ar"
      ? `${parent} في edio`
      : `${parent} at edio`;
  const description =
    lang === "ar"
      ? cleanSeoText(`تسوق ${label} من edio: ${CATEGORY_CONTEXT.ar}`, 156)
      : cleanSeoText(`Shop ${label} at edio: ${CATEGORY_CONTEXT.en}`, 156);
  const keywords = uniqueList([
    label,
    parent,
    ...(CATEGORY_LABELS[slug]?.keywords || []),
    "audiophile Iraq",
    "Baghdad headphones",
    "منتجات صوتيات في العراق",
  ]);

  return {
    title,
    description,
    canonicalPath,
    image: DEFAULT_OG_IMAGE,
    imageAlt: `${label} category at edio`,
    keywords,
  };
}

export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: `${SITE_ORIGIN}/`,
    logo: absoluteUrl("/favicon.png"),
    image: absoluteUrl(DEFAULT_OG_IMAGE),
    sameAs: ["https://www.instagram.com/edio.iq/", "https://www.facebook.com/edio.iq/", "https://t.me/edio_iq"],
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+9647702046674",
      contactType: "customer support",
      areaServed: "IQ",
      availableLanguage: ["Arabic", "English"],
    },
  };
}

export function buildWebsiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: `${SITE_ORIGIN}/`,
    inLanguage: ["ar-IQ", "en"],
  };
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@id": absoluteUrl(item.path),
        name: item.name,
      },
    })),
  };
}

export function buildProductJsonLd(product: Product, lang: LocaleCode = "en", imageResolver: (src: string) => string = absoluteUrl) {
  const seo = buildProductSeo(product, lang);
  const images = uniqueList([product.image, ...(product.gallery || [])])
    .filter(Boolean)
    .slice(0, 8)
    .map(imageResolver);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": absoluteUrl(seo.canonicalPath),
    name: productDisplayName(product, lang),
    image: images.length ? images : [absoluteUrl(DEFAULT_OG_IMAGE)],
    description: seo.description,
    sku: product.id,
    brand: { "@type": "Brand", name: product.brand },
    category: categoryLabel(product.category, "en"),
    itemCondition: product.badge === "preowned" ? "https://schema.org/UsedCondition" : "https://schema.org/NewCondition",
    offers: {
      "@type": "Offer",
      url: absoluteUrl(seo.canonicalPath),
      price: String(product.price),
      priceCurrency: product.currency || "IQD",
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: product.badge === "preowned" ? "https://schema.org/UsedCondition" : "https://schema.org/NewCondition",
    },
    additionalProperty: (product.specs || []).slice(0, 12).map((spec) => ({
      "@type": "PropertyValue",
      name: typeof spec.label === "string" ? spec.label : spec.label.en || spec.label.ar || "Specification",
      value: spec.value,
    })),
  };
}

export function buildCategoryJsonLd(slug: string, lang: LocaleCode = "en", termSlug?: string | null) {
  const seo = buildCategorySeo(slug, lang, termSlug);
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: seo.title,
    description: seo.description,
    url: absoluteUrl(seo.canonicalPath),
    isPartOf: buildWebsiteJsonLd(),
  };
}

export function productSeoIssues(product: Product) {
  const issues: string[] = [];
  if (!product.slug) issues.push("missing slug");
  if (!product.brand) issues.push("missing brand");
  if (!product.name?.en && !product.name?.ar) issues.push("missing name");
  if (!product.image) issues.push("missing image");
  if (!product.tagline?.en && !product.features?.length) issues.push("thin description");
  if (!product.specs?.length) issues.push("missing specs");
  if (!Number.isFinite(product.price) || product.price < 0) issues.push("invalid price");
  return issues;
}

function uniqueList(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}
