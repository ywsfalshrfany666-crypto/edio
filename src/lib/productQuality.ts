type QualitySpec = {
  label?: string | { en?: string; ar?: string };
  value?: string;
};

export type QualityProduct = {
  image?: string;
  normalizedImageUrl?: string;
  gallery?: string[];
  price?: number | string | null;
  inStock?: boolean;
  stock?: number | string | null;
  brand?: string;
  category?: string;
  subCategories?: string[];
  tagline?: { en?: string; ar?: string };
  features?: string[];
  specs?: QualitySpec[];
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
  };
  needsReview?: boolean;
  status?: string;
  categoryAssignment?: {
    needsReview?: boolean;
    confidenceScore?: number;
  } | null;
  imageProcessing?: {
    background?: string;
  } | null;
};

export type ProductQualityResult = {
  score: number;
  missing: string[];
  suggestions: string[];
  needsReview: boolean;
};

type Check = {
  key: string;
  weight: number;
  pass: boolean;
  missing: string;
  suggestion: string;
};

export function calculateProductQuality(product: QualityProduct): ProductQualityResult {
  const checks: Check[] = [
    {
      key: "main_image",
      weight: 14,
      pass: Boolean(product.normalizedImageUrl || product.image),
      missing: "Main image",
      suggestion: "Add one clean main product image.",
    },
    {
      key: "gallery",
      weight: 8,
      pass: (product.gallery || []).filter(Boolean).length >= 3,
      missing: "Gallery images",
      suggestion: "Add at least 3 gallery images when available.",
    },
    {
      key: "price",
      weight: 12,
      pass: Number(product.price || 0) > 0,
      missing: "Price",
      suggestion: "Set a confirmed selling price.",
    },
    {
      key: "availability",
      weight: 8,
      pass: typeof product.inStock === "boolean" || Number(product.stock || 0) > 0,
      missing: "Availability",
      suggestion: "Confirm stock or availability status.",
    },
    {
      key: "brand",
      weight: 8,
      pass: Boolean(String(product.brand || "").trim()),
      missing: "Brand",
      suggestion: "Add the product brand.",
    },
    {
      key: "category",
      weight: 10,
      pass: Boolean(product.category && product.category !== "unknown" && product.category !== "needs_review"),
      missing: "Category",
      suggestion: "Assign the correct main category.",
    },
    {
      key: "subcategory",
      weight: 7,
      pass: Boolean((product.subCategories || []).filter(Boolean).length),
      missing: "Subcategory",
      suggestion: "Add at least one precise subcategory.",
    },
    {
      key: "short_description",
      weight: 9,
      pass: Boolean(String(product.tagline?.en || product.tagline?.ar || "").trim()),
      missing: "Short description",
      suggestion: "Write one clear product benefit line.",
    },
    {
      key: "technical_specs",
      weight: 10,
      pass: (product.specs || []).filter((spec) => spec.value && String(spec.value).trim()).length >= 3,
      missing: "Technical specs",
      suggestion: "Add confirmed technical specs.",
    },
    {
      key: "seo_title",
      weight: 5,
      pass: Boolean(product.seo?.metaTitle),
      missing: "SEO title",
      suggestion: "Add a concise SEO title.",
    },
    {
      key: "seo_description",
      weight: 5,
      pass: Boolean(product.seo?.metaDescription),
      missing: "Meta description",
      suggestion: "Add a short SEO meta description.",
    },
    {
      key: "image_background",
      weight: 4,
      pass: Boolean(product.normalizedImageUrl || product.imageProcessing?.background || product.image),
      missing: "Image normalization",
      suggestion: "Normalize product image background when needed.",
    },
  ];

  const score = checks.reduce((total, check) => total + (check.pass ? check.weight : 0), 0);
  const missing = checks.filter((check) => !check.pass).map((check) => check.missing);
  const suggestions = checks.filter((check) => !check.pass).map((check) => check.suggestion);
  const reviewFlag =
    Boolean(product.needsReview) ||
    product.status === "needs_review" ||
    Boolean(product.categoryAssignment?.needsReview) ||
    Number(product.categoryAssignment?.confidenceScore ?? 1) < 0.7;

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    missing,
    suggestions,
    needsReview: reviewFlag || score < 70,
  };
}

export function getQualityTone(score: number) {
  if (score >= 85) return "good";
  if (score >= 70) return "warn";
  return "bad";
}
