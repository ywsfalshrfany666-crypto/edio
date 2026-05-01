import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckSquare,
  Copy,
  Edit2,
  Eye,
  ImageIcon,
  ListFilter,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  GripVertical,
  Wand2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  API_BASE_URL,
  ApiError,
  type ApiBrand,
  type ApiCategory,
  type ApiProduct,
  type Paginated,
  apiRequest,
} from "@/lib/api";
import { formatPrice } from "@/lib/formatPrice";
import { sanitizeNumericInput } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/store/auth";
import { useCurrency } from "@/store/currency";
import { invalidateRuntimeCatalog } from "@/lib/runtimeCatalog";
import {
  getDisplayCategoryTerms,
  getPrimaryProductTerm,
  getTermLabel,
} from "@/lib/categoryTaxonomy";

type ProductSpecForm = {
  id: string;
  labelEn: string;
  labelAr: string;
  value: string;
};

type ProductFormState = {
  id?: string;
  slug: string;
  sourceUrl: string;
  nameEn: string;
  nameAr: string;
  brand: string;
  category: string;
  subCategoriesText: string;
  taglineEn: string;
  taglineAr: string;
  price: string;
  priceUsd: string;
  officialPrice: string;
  officialPriceUsd: string;
  badge: "" | "new" | "featured" | "best" | "preowned";
  inStock: boolean;
  stock: string;
  sales: string;
  image: string;
  galleryText: string;
  featuresText: string;
  specs: ProductSpecForm[];
};

type CatalogClassification = {
  raw_input: string;
  normalized: {
    brand: string;
    series: string;
    model: string;
    generation: string;
    product_type: string;
    sale_unit: string;
    is_variant: boolean;
    variant_attributes: string[];
  };
  classification: {
    top_level_section: string;
    sub_section: string;
    leaf_category: string;
    dynamic_collections: string[];
    reasoning_summary: string;
  };
  display_rules: {
    show_new_badge: boolean;
    show_recently_added_badge: boolean;
    show_bundle_badge: boolean;
    show_each_badge: boolean;
    show_pair_badge: boolean;
    priority_specs: string[];
    primary_use_cases: string[];
  };
  quality: {
    confidence: number;
    review_required: boolean;
    missing_fields: string[];
    conflicts: string[];
  };
  sources_used: Array<{
    source_type: "official" | "retailer" | "internal_taxonomy";
    name: string;
    url: string;
  }>;
};

type PipelineClassification = {
  primary_category_slug?: string;
  secondary_category_slugs?: string[];
  dynamic_collection_slugs?: string[];
  confidence_score?: number;
  needs_review?: boolean;
  classification_reason?: string;
};

type CategoryResolution = {
  category: string;
  needsReview: boolean;
  suggestedCategory: string | null;
  allowedCategories: string[];
};

type ImportMeta = {
  mode?: "url" | "query";
  query?: string;
  matchedTitle?: string;
  resolvedUrl?: string;
  importJobId?: string;
  evidenceCount?: number;
  normalizedImageCount?: number;
  reviewTaskId?: string;
  searchedResults?: number;
  evaluatedCandidates?: number;
  imageCount?: number;
  localizedImageCount?: number;
  featureCount?: number;
  boxItemCount?: number;
  specCount?: number;
  usedStructuredData?: boolean;
  publishDecision?: "auto_publish" | "needs_review" | "reject";
  confidenceOverall?: number;
  qualityFlags?: string[];
  unitType?: string;
  isBundle?: boolean;
  categoryResolution?: CategoryResolution;
  catalogClassification?: CatalogClassification | null;
  pipeline?: {
    version?: string;
    jobId?: string | null;
    evidence?: Array<{ source_type: string; source_url: string; facts: string[] }>;
    classification?: PipelineClassification;
    normalizedImages?: Array<{ source: string; url: string; role: string; background: string }>;
    validation?: { valid: boolean; errors: string[] };
    [key: string]: unknown;
  };
};

type StrictProductData = {
  input_summary: {
    raw_input: string;
    source_url: string | null;
    brand_hint: string | null;
  };
  product_identity: {
    brand: string | null;
    model: string | null;
    variant: string | null;
    generation: string | null;
    color: string | null;
    category: string;
    unit_type: "each" | "pair" | "bundle" | "set" | "unknown";
    is_bundle: boolean;
  };
  titles: {
    canonical_title: string;
    store_title_ar: string;
    subtitle_ar: string;
  };
  descriptions: {
    short_description_ar: string;
    long_description_ar: string;
  };
  identifiers: {
    sku_local: string | null;
    mpn: string | null;
    gtin: string | null;
  };
  technical_specs: Array<{ label: string; value: string; unit: string | null; confidence: number }>;
  highlights_ar: string[];
  use_cases_ar: string[];
  box_contents_ar: string[];
  recommended_accessories: string[];
  comparison_products: Array<{ title: string; slug: string; brand: string | null; category: string }>;
  faq_ar: Array<{ q: string; a: string }>;
  images: {
    main: null | {
      url: string;
      alt_ar: string;
      role: string;
      decision: "approved_hero" | "approved_gallery_only" | "resize_needed" | "replace_needed" | null;
    };
    gallery: Array<{
      url: string;
      alt_ar: string;
      role: string;
      decision: "approved_hero" | "approved_gallery_only" | "resize_needed" | "replace_needed" | null;
    }>;
    ports: Array<{
      url: string;
      alt_ar: string;
      role: string;
      decision: "approved_hero" | "approved_gallery_only" | "resize_needed" | "replace_needed" | null;
    }>;
    package: Array<{
      url: string;
      alt_ar: string;
      role: string;
      decision: "approved_hero" | "approved_gallery_only" | "resize_needed" | "replace_needed" | null;
    }>;
    lifestyle: Array<{
      url: string;
      alt_ar: string;
      role: string;
      decision: "approved_hero" | "approved_gallery_only" | "resize_needed" | "replace_needed" | null;
    }>;
    processing: {
      background: "pure_white";
      flatten_alpha: boolean;
    };
  };
  offers: Array<{
    seller: string;
    price: number;
    currency: string;
    availability: string | null;
    source_url: string;
    last_checked: string;
  }>;
  seo: {
    slug: string;
    meta_title: string;
    meta_description: string;
    keywords: string[];
    suggested_filenames: string[];
    alt_texts_ar: string[];
  };
  page_modules: {
    hero: boolean;
    price_block: boolean;
    highlights: boolean;
    use_cases: boolean;
    specs_table: boolean;
    box_contents: boolean;
    accessories: boolean;
    comparison: boolean;
    faq: boolean;
    cta_lines: string[];
  };
  quality_flags: string[];
  confidence: {
    identity: number;
    specs: number;
    images: number;
    offers: number;
    seo: number;
    overall: number;
  };
  publish_decision: "auto_publish" | "needs_review" | "reject";
  catalog_classification?: CatalogClassification;
};

type UploadedProductMedia = {
  media: Array<{
    url: string;
    name?: string;
    sourceUrl?: string;
    kind?: "upload" | "remote";
    displayDecision?: {
      decision: "approved_hero" | "approved_gallery_only" | "resize_needed" | "replace_needed";
      reasons: string[];
      processing_steps: string[];
      output_targets: Array<{ format: string; width: number; height: number; background: string }>;
    };
  }>;
};

type ImportedDraft = {
  sourceUrl: string;
  nameEn: string;
  nameAr: string;
  brand: string;
  category: string;
  subCategories: string[];
  taglineEn: string;
  taglineAr: string;
  price?: number | null;
  priceUsd?: number | null;
  compareAt?: number | null;
  compareAtUsd?: number | null;
  officialPrice?: number | null;
  officialPriceUsd?: number | null;
  image: string;
  gallery: string[];
  features: string[];
  specs: Array<{ label: { en: string; ar: string }; value: string }>;
  importMeta?: ImportMeta;
  strictProductData?: StrictProductData;
  catalogClassification?: CatalogClassification;
  normalizedImageUrl?: string;
  imageProcessing?: Record<string, unknown> | null;
  importEvidence?: Array<{ source_type: string; source_url: string; facts: string[] }>;
};

type ImportCandidate = {
  title: string;
  url: string;
  image: string;
  imageCount: number;
  specCount: number;
  score: number;
  draft: ImportedDraft;
};

type ExistingImportMatch = {
  id: string;
  slug: string;
  nameEn: string;
  brand: string;
  category: string;
  sourceUrl: string;
  image: string;
  updatedAt: string;
};

type ImportResponse = {
  draft: ImportedDraft;
  candidates?: ImportCandidate[];
  existingProduct?: ExistingImportMatch | null;
};

const badgeOptions = [
  { value: "all", label: "All badges" },
  { value: "new", label: "New" },
  { value: "featured", label: "Featured" },
  { value: "best", label: "Best seller" },
  { value: "preowned", label: "Pre-owned" },
  { value: "none", label: "No badge" },
] as const;

const stockOptions = [
  { value: "all", label: "All stock states" },
  { value: "in", label: "In stock" },
  { value: "out", label: "Out of stock" },
] as const;

type BulkAction =
  | "update_availability"
  | "update_status"
  | "assign_category"
  | "assign_subcategory"
  | "add_tags"
  | "remove_tags"
  | "mark_featured"
  | "unmark_featured"
  | "delete"
  | "reclassify"
  | "refresh_product_data"
  | "normalize_images"
  | "fix_missing_fields"
  | "generate_seo"
  | "export_selected";

type BulkPreviewRow = {
  id: string;
  product: {
    id: string;
    slug: string;
    name: string;
    brand: string;
    image: string;
  };
  action: BulkAction | string;
  current_value: string;
  proposed_value: string;
  confidence: number;
  reason: string;
  safe: boolean;
  needs_review: boolean;
  changes: Record<string, unknown>;
  warnings: string[];
};

type BulkPreviewResponse = {
  action: BulkAction | string;
  threshold: number;
  selected_count: number;
  safe_count: number;
  blocked_count: number;
  preview: BulkPreviewRow[];
  quality_gates?: {
    confidence_threshold: number;
    low_confidence_policy: string;
    taxonomy_policy: string;
  };
};

type BulkApplyResponse = {
  action: string;
  applied_count: number;
  skipped_count: number;
  log?: {
    id: string;
    summary?: { selected: number; applied: number; skipped: number };
  };
  export?: ApiProduct[];
};

type ClassificationPreviewRow = {
  product_id: string;
  product: {
    id: string;
    slug: string;
    name: string;
    brand: string;
    image: string;
  };
  current_assignment: {
    primary_category_slug: string;
    secondary_category_slugs: string[];
    confidence_score: number | null;
    needs_review: boolean;
  };
  proposed_assignment: NonNullable<ApiProduct["categoryAssignment"]>;
  primary_category_slug: string;
  secondary_category_slugs: string[];
  dynamic_collection_slugs: string[];
  confidence_score: number;
  needs_review: boolean;
  classification_reason: string;
  evidence: NonNullable<ApiProduct["categoryAssignment"]>["evidence"];
  safe: boolean;
};

type ClassificationPreviewResponse = {
  dry_run: boolean;
  threshold: number;
  selected_count: number;
  safe_count: number;
  review_count: number;
  conflict_count: number;
  results: ClassificationPreviewRow[];
  quality_gates: {
    confidence_threshold: number;
    taxonomy_policy: string;
    low_confidence_policy: string;
    evidence_priority: string[];
  };
};

type ClassificationApplyResponse = {
  action: string;
  applied_count: number;
  skipped_count: number;
  assignments: ApiProduct["categoryAssignment"][];
  log?: {
    id: string;
    summary?: { selected: number; applied: number; skipped: number };
  };
};

type ClassificationReviewQueueResponse = {
  total: number;
  threshold: number;
  items: Array<{
    product: ApiProduct;
    assignment: NonNullable<ApiProduct["categoryAssignment"]>;
  }>;
};

const bulkActions: Array<{ value: BulkAction; label: string; tone: "safe" | "smart" | "danger" }> = [
  { value: "update_availability", label: "Change availability", tone: "safe" },
  { value: "update_status", label: "Change status", tone: "safe" },
  { value: "assign_category", label: "Assign category", tone: "safe" },
  { value: "assign_subcategory", label: "Assign subcategory", tone: "safe" },
  { value: "add_tags", label: "Add tags", tone: "safe" },
  { value: "remove_tags", label: "Remove tags", tone: "safe" },
  { value: "mark_featured", label: "Mark featured", tone: "safe" },
  { value: "unmark_featured", label: "Unmark featured", tone: "safe" },
  { value: "reclassify", label: "Reclassify selected", tone: "smart" },
  { value: "refresh_product_data", label: "Refresh product data", tone: "smart" },
  { value: "normalize_images", label: "Normalize images", tone: "smart" },
  { value: "fix_missing_fields", label: "Fix missing fields", tone: "smart" },
  { value: "generate_seo", label: "Generate SEO", tone: "smart" },
  { value: "export_selected", label: "Export selected", tone: "safe" },
  { value: "delete", label: "Delete", tone: "danger" },
];

const availabilityBulkOptions = [
  { value: "in_stock", label: "In stock" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "pre_order", label: "Pre-order" },
  { value: "discontinued", label: "Discontinued" },
  { value: "hidden", label: "Hidden" },
] as const;

const statusBulkOptions = [
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "needs_review", label: "Needs review" },
  { value: "hidden", label: "Hidden" },
  { value: "archived", label: "Archived" },
] as const;

const confidenceThreshold = 0.75;

function readableProductHandle(product: ApiProduct) {
  const cleanSlug = String(product.slug || "")
    .replace(/-\d{3,}$/g, "")
    .replace(/^prd-/i, "")
    .trim();

  if (cleanSlug) return cleanSlug;
  return String(product.id || "").replace(/^prd_/i, "");
}

function looksLikeUrl(value: string) {
  try {
    const url = new URL(String(value || "").trim());
    return /^https?:$/.test(url.protocol);
  } catch {
    return false;
  }
}

function safeSourceHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return String(value || "").replace(/^https?:\/\//, "").split("/")[0];
  }
}

function isActiveImportCandidate(candidate: ImportCandidate, currentMeta: ImportMeta | null) {
  return Boolean(currentMeta?.resolvedUrl && candidate.url === currentMeta.resolvedUrl);
}

function normalizeMediaKey(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const resolved = resolveMediaUrl(raw);
  return resolved
    .replace(/^https?:\/\/127\.0\.0\.1:\d+/i, "")
    .replace(/[?#].*$/g, "")
    .trim()
    .toLowerCase();
}

function parseGalleryItems(value: string) {
  const seen = new Set<string>();
  const items: string[] = [];

  for (const item of String(value || "")
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)) {
    const key = normalizeMediaKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }

  return items;
}

function normalizeSpecAuditKey(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isInternalSpecLabel(value: string) {
  return normalizeSpecAuditKey(value) === "sku";
}

function looksLikeNavigationFeatureLine(value: string) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (!normalized) return false;

  return (
    /^(?:in ear|over ear|wireless)\s+headphones?$/.test(normalized) ||
    /^(?:all\s+)?dacs?$/.test(normalized) ||
    /^(?:portable|desktop)\s+dacs?$/.test(normalized) ||
    /^(?:(?:in ear|over ear|wireless)\s+headphones?)(?:\s+(?:(?:in ear|over ear|wireless)\s+headphones?))+$/i.test(
      normalized,
    ) ||
    /^(?:(?:all\s+)?dacs?|(?:portable|desktop)\s+dacs?)(?:\s+(?:(?:all\s+)?dacs?|(?:portable|desktop)\s+dacs?))+$/i.test(
      normalized,
    )
  );
}

type CategoryAuditRule = {
  label: string;
  match: RegExp;
  expected: RegExp;
  blocked: RegExp;
  suggestion: string;
};

const categoryAuditRules: CategoryAuditRule[] = [
  {
    label: "In-ear monitor",
    match: /\biems?\b/i,
    expected: /\b(in ear|in-ear|iem|earphone)\b/i,
    blocked: /\b(over ear|over-ear|wireless headphone|headphones?)\b/i,
    suggestion: "In-ear monitor for portable listening.",
  },
  {
    label: "Over-ear headphone",
    match: /\bheadphones?\b/i,
    expected: /\b(over ear|over-ear|headphones?)\b/i,
    blocked: /\b(in ear|in-ear|iem|earbud)\b/i,
    suggestion: "Over-ear headphone for focused listening.",
  },
  {
    label: "DAC / amp",
    match: /\bdacs?\b/i,
    expected: /\b(dac|amp|converter|desktop|portable)\b/i,
    blocked: /\b(in ear|in-ear|iem|earbud|over ear|over-ear)\b/i,
    suggestion: "DAC / amp for clean, reliable playback.",
  },
];

function getCategoryAuditRule(category: string) {
  return categoryAuditRules.find((rule) => rule.match.test(String(category || ""))) || null;
}

function getTaglineMismatch(category: string, tagline: string) {
  const rule = getCategoryAuditRule(category);
  const value = String(tagline || "").trim();
  if (!rule || !value) return null;
  if (rule.blocked.test(value) && !rule.expected.test(value)) return rule;
  return null;
}

function getProductAdminFlags(product: ApiProduct) {
  const flags: string[] = [];
  if (!product.image && !product.normalizedImageUrl) flags.push("missing_image");
  if (!Number(product.price || 0)) flags.push("missing_price");
  if (!product.specs?.length) flags.push("missing_specs");
  if (!product.brand) flags.push("missing_brand");
  if (!product.category) flags.push("missing_category");
  if (!product.subCategories?.length) flags.push("missing_subcategory");
  if (product.needsReview || product.status === "needs_review") flags.push("needs_review");
  if (!product.seo?.metaTitle) flags.push("missing_meta_title");
  if (!product.seo?.metaDescription) flags.push("missing_meta_description");
  return flags;
}

function productMatchesSmartSelection(product: ApiProduct, selector: string) {
  const flags = getProductAdminFlags(product);
  switch (selector) {
    case "visible":
      return true;
    case "in_stock":
      return product.inStock;
    case "out_of_stock":
      return !product.inStock;
    case "missing_image":
    case "missing_price":
    case "missing_specs":
    case "needs_review":
      return flags.includes(selector);
    case "preowned":
      return product.badge === "preowned";
    case "featured":
      return product.badge === "featured";
    default:
      if (selector.startsWith("brand:")) return sameAdminKey(product.brand) === sameAdminKey(selector.slice("brand:".length));
      if (selector.startsWith("category:")) return sameAdminKey(product.category) === sameAdminKey(selector.slice("category:".length));
      if (selector.startsWith("subcategory:")) {
        const term = sameAdminKey(selector.slice("subcategory:".length));
        return product.subCategories.some((item) => sameAdminKey(item) === term);
      }
      return false;
  }
}

function sameAdminKey(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeSpec(partial?: Partial<ProductSpecForm>): ProductSpecForm {
  return {
    id: crypto.randomUUID(),
    labelEn: partial?.labelEn || "",
    labelAr: partial?.labelAr || "",
    value: partial?.value || "",
  };
}

function normalizeStorefrontSpecs(specs: ProductSpecForm[]) {
  const filtered = specs.filter((spec) => !isInternalSpecLabel(spec.labelEn || spec.labelAr));
  return filtered.length ? filtered : [makeSpec()];
}

const emptyForm: ProductFormState = {
  slug: "",
  sourceUrl: "",
  nameEn: "",
  nameAr: "",
  brand: "",
  category: "",
  subCategoriesText: "",
  taglineEn: "",
  taglineAr: "",
  price: "",
  priceUsd: "",
  officialPrice: "",
  officialPriceUsd: "",
  badge: "",
  inStock: true,
  stock: "8",
  sales: "0",
  image: "",
  galleryText: "",
  featuresText: "",
  specs: [makeSpec()],
};

const AdminProducts = () => {
  const token = useAuth((s) => s.token);
  const signOut = useAuth((s) => s.signOut);
  const currency = useCurrency((s) => s.currency);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("all");
  const [cat, setCat] = useState("all");
  const [badge, setBadge] = useState<(typeof badgeOptions)[number]["value"]>("all");
  const [stockState, setStockState] = useState<(typeof stockOptions)[number]["value"]>("all");
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [brands, setBrands] = useState<ApiBrand[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [galleryDraft, setGalleryDraft] = useState("");
  const [draggedGalleryKey, setDraggedGalleryKey] = useState<string | null>(null);
  const [importMeta, setImportMeta] = useState<ImportMeta | null>(null);
  const [strictImportData, setStrictImportData] = useState<StrictProductData | null>(null);
  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>([]);
  const [existingImportMatch, setExistingImportMatch] = useState<ExistingImportMatch | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction>("reclassify");
  const [bulkAvailability, setBulkAvailability] = useState("in_stock");
  const [bulkStatus, setBulkStatus] = useState("published");
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkSubcategory, setBulkSubcategory] = useState("");
  const [bulkTags, setBulkTags] = useState("");
  const [bulkPreview, setBulkPreview] = useState<BulkPreviewResponse | null>(null);
  const [bulkPreviewOpen, setBulkPreviewOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkApplyIds, setBulkApplyIds] = useState<Set<string>>(() => new Set());
  const [classificationPreview, setClassificationPreview] = useState<ClassificationPreviewResponse | null>(null);
  const [classificationPreviewOpen, setClassificationPreviewOpen] = useState(false);
  const [classificationLoading, setClassificationLoading] = useState(false);
  const [classificationApplyIds, setClassificationApplyIds] = useState<Set<string>>(() => new Set());

  const loadMeta = async () => {
    if (!token) return;
    const [brandData, categoryData] = await Promise.all([
      apiRequest<ApiBrand[]>("/api/brands", { token }),
      apiRequest<ApiCategory[]>("/api/categories", { token }),
    ]);
    setBrands(brandData);
    setCategories(categoryData);
  };

  const loadProducts = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const result = await apiRequest<Paginated<ApiProduct>>("/api/admin/products", {
        token,
        searchParams: {
          limit: 200,
          q,
          brand: brand !== "all" ? brand : undefined,
          category: cat !== "all" ? cat : undefined,
          badge: badge !== "all" && badge !== "none" ? badge : undefined,
          inStock: stockState === "in" ? true : undefined,
        },
      });
      let nextProducts = result.items;
      if (badge === "none") nextProducts = nextProducts.filter((item) => !item.badge);
      if (stockState === "out") nextProducts = nextProducts.filter((item) => !item.inStock);
      setCatalogTotal(result.total);
      setProducts(nextProducts);
      setError(null);
    } catch (nextError) {
      if (nextError instanceof ApiError && (nextError.status === 401 || nextError.status === 403)) {
        signOut();
        setProducts([]);
        setError("Your admin session expired. Please sign in again.");
        toast({
          title: "Session expired",
          description: "We signed you out to protect the admin area. Please sign in again.",
          variant: "destructive",
        });
        navigate("/login", { replace: true, state: { from: "/admin/products" } });
        return;
      }
      setCatalogTotal(0);
      setError(nextError instanceof ApiError ? nextError.message : "Unable to load products.");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    void loadMeta();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void loadProducts();
  }, [token, q, brand, cat, badge, stockState]);

  useEffect(() => {
    if (!token || !error) return;

    const retry = () => void loadProducts();
    const timer = window.setTimeout(retry, 2500);

    window.addEventListener("focus", retry);
    document.addEventListener("visibilitychange", retry);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", retry);
      document.removeEventListener("visibilitychange", retry);
    };
  }, [token, error, q, brand, cat, badge, stockState]);

  useEffect(() => {
    setSelectedIds((current) => {
      const visibleIds = new Set(products.map((product) => product.id));
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [products]);

  const hasActiveFilters = useMemo(
    () => Boolean(q.trim()) || brand !== "all" || cat !== "all" || badge !== "all" || stockState !== "all",
    [q, brand, cat, badge, stockState],
  );
  const productCountLabel = useMemo(() => {
    if (!catalogTotal && !products.length) return "No products loaded yet";
    if (hasActiveFilters) return `Showing ${products.length} of ${catalogTotal} products`;
    return `${catalogTotal || products.length} products in catalog`;
  }, [catalogTotal, hasActiveFilters, products.length]);
  const filterSummaryLabel = useMemo(() => {
    const labels = [
      q.trim() ? `search: ${q.trim()}` : "",
      brand !== "all" ? `brand: ${brand}` : "",
      cat !== "all" ? `category: ${cat}` : "",
      badge !== "all" ? `badge: ${badge}` : "",
      stockState !== "all" ? `stock: ${stockState}` : "",
    ].filter(Boolean);

    return labels.length ? labels.join(" • ") : "All filters clear";
  }, [q, brand, cat, badge, stockState]);
  const allVisibleSelected = products.length > 0 && products.every((product) => selectedIds.has(product.id));
  const selectedProducts = useMemo(
    () => products.filter((product) => selectedIds.has(product.id)),
    [products, selectedIds],
  );
  const selectedDiagnostics = useMemo(() => {
    const reviewCount = selectedProducts.filter(
      (product) =>
        product.needsReview ||
        product.categoryAssignment?.needsReview ||
        Number(product.confidenceScore ?? product.categoryAssignment?.confidenceScore ?? 1) < confidenceThreshold,
    ).length;

    return {
      reviewCount,
      missingMediaCount: selectedProducts.filter((product) => !product.image).length,
      missingSpecsCount: selectedProducts.filter((product) => !product.specs?.length).length,
      inStockCount: selectedProducts.filter((product) => product.inStock).length,
    };
  }, [selectedProducts]);
  const selectedSafePreviewCount = bulkPreview?.preview.filter((row) => bulkApplyIds.has(row.id) && row.safe).length || 0;
  const selectedSafeClassificationCount =
    classificationPreview?.results.filter((row) => classificationApplyIds.has(row.product_id) && row.safe).length || 0;
  const visibleReviewCount = products.filter(
    (product) =>
      product.needsReview ||
      product.categoryAssignment?.needsReview ||
      Number(product.confidenceScore ?? product.categoryAssignment?.confidenceScore ?? 1) < confidenceThreshold,
  ).length;
  const categoryTermOptions = useMemo(() => getDisplayCategoryTerms(bulkCategory || cat || "headphones"), [bulkCategory, cat]);
  const smartSelectionOptions = useMemo(() => {
    const categoryOptions = categories.map((item) => ({
      value: `category:${item.slug}`,
      label: `Category: ${item.slug}`,
    }));
    const brandOptions = brands.slice(0, 20).map((item) => ({
      value: `brand:${item.name}`,
      label: `Brand: ${item.name}`,
    }));
    const subcategoryOptions = Array.from(
      new Set(products.flatMap((product) => product.subCategories.map((item) => sameAdminKey(item)).filter(Boolean))),
    ).map((item) => ({
      value: `subcategory:${item}`,
      label: `Subcategory: ${item}`,
    }));
    return [
      { value: "visible", label: "All visible results" },
      { value: "in_stock", label: "In stock" },
      { value: "out_of_stock", label: "Out of stock" },
      { value: "missing_image", label: "Missing image" },
      { value: "missing_price", label: "Missing price" },
      { value: "missing_specs", label: "Missing specs" },
      { value: "needs_review", label: "Needs review" },
      { value: "preowned", label: "Pre-owned" },
      { value: "featured", label: "Featured" },
      ...categoryOptions,
      ...subcategoryOptions,
      ...brandOptions,
    ];
  }, [brands, categories, products]);
  const matchedExistingProduct = useMemo(
    () =>
      existingImportMatch
        ? products.find((product) => product.id === existingImportMatch.id || product.slug === existingImportMatch.slug) || null
        : null,
    [existingImportMatch, products],
  );
  const trimmedImportSource = form.sourceUrl.trim();
  const importUsesUrl = looksLikeUrl(trimmedImportSource);
  const importButtonLabel = importUsesUrl ? "Import URL" : "Search model";
  const importPendingLabel = importUsesUrl ? "Importing..." : "Searching...";
  const importResolvedFromCatalog = Boolean(importMeta?.resolvedUrl?.startsWith("/product/"));
  const pipelineClassification = importMeta?.pipeline?.classification;

  const toggleProductSelection = (productId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const toggleVisibleSelection = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        products.forEach((product) => next.delete(product.id));
      } else {
        products.forEach((product) => next.add(product.id));
      }
      return next;
    });
  };

  const selectBySmartRule = (selector: string) => {
    const matching = products.filter((product) => productMatchesSmartSelection(product, selector));
    setSelectedIds(new Set(matching.map((product) => product.id)));
    toast({
      title: "Selection updated",
      description: `${matching.length} product${matching.length === 1 ? "" : "s"} selected from the current results.`,
    });
  };

  const getBulkOptions = () => ({
    confidence_threshold: confidenceThreshold,
    skip_low_confidence: true,
    availability: bulkAvailability,
    status: bulkStatus,
    category: bulkCategory || (cat !== "all" ? cat : ""),
    subcategory: bulkSubcategory,
    tags: bulkTags,
  });

  const requestBulkPreview = async (actionOverride?: BulkAction) => {
    if (!token || !selectedIds.size) return;
    const action = actionOverride || bulkAction;
    setBulkLoading(true);
    try {
      const preview = await apiRequest<BulkPreviewResponse>(
        action === "reclassify"
          ? "/api/admin/products/bulk/reclassify"
          : action === "normalize_images"
            ? "/api/admin/products/bulk/normalize-images"
            : "/api/admin/products/bulk/preview",
        {
          method: "POST",
          token,
          body: {
            product_ids: [...selectedIds],
            action,
            options: getBulkOptions(),
          },
        },
      );
      setBulkPreview(preview);
      setBulkApplyIds(new Set(preview.preview.filter((row) => row.safe).map((row) => row.id)));
      setBulkPreviewOpen(true);
    } catch (nextError) {
      toast({
        title: "Bulk preview failed",
        description: nextError instanceof ApiError ? nextError.message : "Unable to build a safe preview.",
      });
    } finally {
      setBulkLoading(false);
    }
  };

  const applyBulkChanges = async (mode: "safe" | "selected") => {
    if (!token || !bulkPreview) return;
    const changeIds =
      mode === "safe"
        ? bulkPreview.preview.filter((row) => row.safe).map((row) => row.id)
        : [...bulkApplyIds].filter((id) => bulkPreview.preview.some((row) => row.id === id && row.safe));

    if (!changeIds.length) {
      toast({ title: "Nothing safe to apply", description: "Low confidence rows are skipped by default." });
      return;
    }

    if (bulkPreview.action === "delete") {
      const confirmed = window.confirm(`Delete ${changeIds.length} selected product${changeIds.length === 1 ? "" : "s"}? This cannot be applied without confirmation.`);
      if (!confirmed) return;
    }

    setBulkLoading(true);
    try {
      const result = await apiRequest<BulkApplyResponse>("/api/admin/products/bulk/apply", {
        method: "POST",
        token,
        body: {
          product_ids: [...selectedIds],
          change_ids: changeIds,
          action: bulkPreview.action,
          options: {
            ...getBulkOptions(),
            confirm_delete: bulkPreview.action === "delete",
          },
        },
      });

      if (result.export?.length) {
        const blob = new Blob([JSON.stringify(result.export, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `edio-products-export-${Date.now()}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
      }

      toast({
        title: "Bulk action applied",
        description: `${result.applied_count} applied, ${result.skipped_count} skipped. ${result.log?.id ? `Log: ${result.log.id}` : ""}`,
      });
      invalidateRuntimeCatalog();
      setBulkPreviewOpen(false);
      setBulkPreview(null);
      setSelectedIds(new Set());
      await Promise.all([loadProducts(), loadMeta()]);
    } catch (nextError) {
      toast({
        title: "Bulk apply failed",
        description: nextError instanceof ApiError ? nextError.message : "Unable to apply this bulk action.",
      });
    } finally {
      setBulkLoading(false);
    }
  };

  const selectClassificationReviewQueue = async () => {
    if (!token) return;
    setClassificationLoading(true);
    try {
      const queue = await apiRequest<ClassificationReviewQueueResponse>("/api/admin/products/classification/review", {
        token,
        searchParams: { limit: 200 },
      });
      setSelectedIds(new Set(queue.items.map((item) => item.product.id)));
      toast({
        title: "Review queue selected",
        description: `${queue.items.length} product${queue.items.length === 1 ? "" : "s"} need classification review.`,
      });
    } catch (nextError) {
      toast({
        title: "Unable to load review queue",
        description: nextError instanceof ApiError ? nextError.message : "Try again after the API is reachable.",
      });
    } finally {
      setClassificationLoading(false);
    }
  };

  const requestClassificationPreview = async () => {
    if (!token || !selectedIds.size) return;
    setClassificationLoading(true);
    try {
      const preview = await apiRequest<ClassificationPreviewResponse>("/api/admin/products/classification/preview", {
        method: "POST",
        token,
        body: {
          product_ids: [...selectedIds],
          options: {
            confidence_threshold: confidenceThreshold,
            skip_low_confidence: true,
            enrich_web: false,
          },
        },
      });
      setClassificationPreview(preview);
      setClassificationApplyIds(new Set(preview.results.filter((row) => row.safe).map((row) => row.product_id)));
      setClassificationPreviewOpen(true);
    } catch (nextError) {
      toast({
        title: "Classification dry-run failed",
        description: nextError instanceof ApiError ? nextError.message : "Unable to classify the selected products.",
      });
    } finally {
      setClassificationLoading(false);
    }
  };

  const applyClassificationChanges = async (mode: "safe" | "selected") => {
    if (!token || !classificationPreview) return;
    const changeIds =
      mode === "safe"
        ? classificationPreview.results.filter((row) => row.safe).map((row) => row.product_id)
        : [...classificationApplyIds].filter((id) =>
            classificationPreview.results.some((row) => row.product_id === id && row.safe),
          );
    if (!changeIds.length) {
      toast({ title: "Nothing safe to apply", description: "Low confidence classifications stay in review." });
      return;
    }

    setClassificationLoading(true);
    try {
      const result = await apiRequest<ClassificationApplyResponse>("/api/admin/products/classification/apply", {
        method: "POST",
        token,
        body: {
          product_ids: [...selectedIds],
          change_ids: changeIds,
          options: {
            confidence_threshold: confidenceThreshold,
            skip_low_confidence: true,
          },
        },
      });
      toast({
        title: "Classification applied",
        description: `${result.applied_count} applied, ${result.skipped_count} kept for review.`,
      });
      invalidateRuntimeCatalog();
      setClassificationPreviewOpen(false);
      setClassificationPreview(null);
      setSelectedIds(new Set());
      await Promise.all([loadProducts(), loadMeta()]);
    } catch (nextError) {
      toast({
        title: "Classification apply failed",
        description: nextError instanceof ApiError ? nextError.message : "Unable to apply classification changes.",
      });
    } finally {
      setClassificationLoading(false);
    }
  };

  const openCreate = () => {
    setForm({
      ...emptyForm,
      specs: [makeSpec()],
    });
    setImportMeta(null);
    setStrictImportData(null);
    setImportCandidates([]);
    setExistingImportMatch(null);
    setGalleryDraft("");
    setFormOpen(true);
  };

  const openEdit = (product: ApiProduct) => {
    const mappedSpecs = product.specs.length
      ? product.specs.map((spec) =>
          typeof spec.label === "string"
            ? makeSpec({ labelEn: spec.label, value: spec.value })
            : makeSpec({ labelEn: spec.label.en, labelAr: spec.label.ar, value: spec.value }),
        )
      : [makeSpec()];

    setForm({
      id: product.id,
      slug: product.slug,
      sourceUrl: product.sourceUrl || "",
      nameEn: product.name.en,
      nameAr: product.name.ar,
      brand: product.brand,
      category: product.category,
      subCategoriesText: product.subCategories.join(", "),
      taglineEn: product.tagline.en,
      taglineAr: product.tagline.ar,
      price: String(product.price),
      priceUsd: product.priceUsd ? String(product.priceUsd) : "",
      officialPrice: product.officialPrice || product.compareAt ? String(product.officialPrice || product.compareAt) : "",
      officialPriceUsd: product.officialPriceUsd || product.compareAtUsd ? String(product.officialPriceUsd || product.compareAtUsd) : "",
      badge: product.storedBadge || "",
      inStock: product.inStock,
      stock: String(product.stock ?? 0),
      sales: String(product.sales ?? 0),
      image: product.image,
      galleryText: product.gallery.join("\n"),
      featuresText: product.features.join("\n"),
      specs: normalizeStorefrontSpecs(mappedSpecs),
    });
    setImportMeta(null);
    setStrictImportData(null);
    setImportCandidates([]);
    setExistingImportMatch(null);
    setGalleryDraft("");
    setFormOpen(true);
  };

  const applyImportedDraft = (imported: ImportedDraft) => {
    const importedGallery = imported.gallery?.length ? parseGalleryItems(imported.gallery.join("\n")) : [];
    const importedSpecs = imported.specs?.length
      ? imported.specs.map((spec) =>
          makeSpec({
            labelEn: spec.label?.en || "",
            labelAr: spec.label?.ar || "",
            value: spec.value,
          }),
        )
      : null;

    setForm((current) => ({
      ...current,
      sourceUrl: imported.sourceUrl || current.sourceUrl,
      nameEn: imported.nameEn || current.nameEn,
      nameAr: imported.nameAr || current.nameAr,
      brand: imported.brand || current.brand,
      category: imported.category || current.category,
      subCategoriesText: imported.subCategories?.length
        ? imported.subCategories.join(", ")
        : current.subCategoriesText,
      taglineEn: imported.taglineEn || current.taglineEn,
      taglineAr: imported.taglineAr || current.taglineAr,
      price:
        imported.price !== undefined && imported.price !== null && !Number.isNaN(imported.price)
          ? String(imported.price)
          : current.price,
      priceUsd:
        imported.priceUsd !== undefined && imported.priceUsd !== null && !Number.isNaN(imported.priceUsd)
          ? String(imported.priceUsd)
          : current.priceUsd,
      officialPrice:
        imported.officialPrice !== undefined && imported.officialPrice !== null && !Number.isNaN(imported.officialPrice)
          ? String(imported.officialPrice)
          : imported.compareAt !== undefined && imported.compareAt !== null && !Number.isNaN(imported.compareAt)
            ? String(imported.compareAt)
            : current.officialPrice,
      officialPriceUsd:
        imported.officialPriceUsd !== undefined && imported.officialPriceUsd !== null && !Number.isNaN(imported.officialPriceUsd)
          ? String(imported.officialPriceUsd)
          : imported.compareAtUsd !== undefined && imported.compareAtUsd !== null && !Number.isNaN(imported.compareAtUsd)
            ? String(imported.compareAtUsd)
            : current.officialPriceUsd,
      image: imported.image || importedGallery[0] || current.image,
      galleryText: importedGallery.length ? importedGallery.join("\n") : current.galleryText,
      featuresText: imported.features?.length ? imported.features.join("\n") : current.featuresText,
      specs: importedSpecs ? normalizeStorefrontSpecs(importedSpecs) : current.specs,
    }));
    setImportMeta(imported.importMeta || null);
    setStrictImportData(imported.strictProductData || null);
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setSubmitting(true);

    try {
      const gallery = parseGalleryItems(form.galleryText);
      const image = form.image.trim() || gallery[0] || "";
      const normalizedGallery = image
        ? parseGalleryItems([image, ...gallery].join("\n"))
        : gallery;
      const stock = Math.max(0, Number(form.stock || 0));
      const payload = {
        slug: form.slug.trim() || undefined,
        sourceUrl: form.sourceUrl.trim(),
        name: {
          en: form.nameEn.trim(),
          ar: form.nameAr.trim() || form.nameEn.trim(),
        },
        brand: form.brand.trim(),
        category: form.category.trim(),
        subCategories: parseCsv(form.subCategoriesText),
        tagline: {
          en: form.taglineEn.trim(),
          ar: form.taglineAr.trim() || form.taglineEn.trim(),
        },
        price: form.price ? Number(form.price) : null,
        priceUsd: form.priceUsd ? Number(form.priceUsd) : null,
        officialPrice: form.officialPrice ? Number(form.officialPrice) : null,
        officialPriceUsd: form.officialPriceUsd ? Number(form.officialPriceUsd) : null,
        compareAt: form.officialPrice ? Number(form.officialPrice) : null,
        badge: form.badge || null,
        inStock: form.inStock && stock > 0,
        stock,
        sales: Number(form.sales || 0),
        image,
        gallery: normalizedGallery,
        features: parseMultiline(form.featuresText),
        specs: form.specs
          .filter((spec) => !isInternalSpecLabel(spec.labelEn || spec.labelAr))
          .map((spec) => ({
            label: spec.labelAr.trim()
              ? { en: spec.labelEn.trim(), ar: spec.labelAr.trim() }
              : spec.labelEn.trim(),
            value: spec.value.trim(),
          }))
          .filter((spec) => {
            if (typeof spec.label === "string") return spec.label && spec.value;
            return spec.label.en && spec.value;
          }),
        ...(importMeta ? { importMeta } : {}),
        ...(importMeta?.pipeline?.classification ? { categoryAssignment: importMeta.pipeline.classification } : {}),
        ...(importMeta?.pipeline?.evidence ? { importEvidence: importMeta.pipeline.evidence } : {}),
        ...(image.includes("/normalized-") ? { normalizedImageUrl: image } : {}),
      };

      if (form.id) {
        await apiRequest<ApiProduct>(`/api/admin/products/${form.id}`, {
          method: "PATCH",
          token,
          body: payload,
        });
        toast({ title: "Product updated", description: payload.name.en });
        invalidateRuntimeCatalog();
        setFormOpen(false);
      } else {
        await apiRequest<ApiProduct>("/api/admin/products", {
          method: "POST",
          token,
          body: payload,
        });
        toast({
          title: "Product added",
          description: `${payload.name.en} was saved. The form is now ready for the next product.`,
        });
        invalidateRuntimeCatalog();
        setForm({
          ...emptyForm,
          specs: [makeSpec()],
        });
        setGalleryDraft("");
        setImportMeta(null);
        setStrictImportData(null);
        setImportCandidates([]);
        setExistingImportMatch(null);
      }

      await Promise.all([loadProducts(), loadMeta()]);
    } catch (nextError) {
      toast({
        title: "Save failed",
        description:
          nextError instanceof ApiError && nextError.code === "product_exists"
            ? `${nextError.message}. Open the existing product and update it instead of creating a duplicate.`
            : nextError instanceof ApiError
              ? nextError.message
              : "Unable to save product.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const importFromSource = async () => {
    if (!token) return;
    const sourceInput = form.sourceUrl.trim();
    if (!sourceInput) {
      toast({ title: "Missing input", description: "Paste a product URL or type the model name first." });
      return;
    }

    setImporting(true);
    try {
      const response = await apiRequest<ImportedDraft | ImportResponse>(
        looksLikeUrl(sourceInput) ? "/api/admin/products/import" : "/api/admin/products/discover",
        {
        method: "POST",
        token,
        body: looksLikeUrl(sourceInput) ? { url: sourceInput } : { query: sourceInput },
      });

      const imported = "draft" in response ? response.draft : response;
      applyImportedDraft(imported);
      setImportCandidates("draft" in response ? response.candidates || [] : []);
      setExistingImportMatch("draft" in response ? response.existingProduct || null : null);

      toast({
        title: "Draft imported",
        description: looksLikeUrl(sourceInput)
          ? "Images and available details were pulled in from the product page."
          : "We searched the web for this model and filled the product draft with the best match we found.",
      });
    } catch (nextError) {
      toast({
        title: "Import failed",
        description:
          nextError instanceof ApiError
            ? nextError.message
            : "Unable to import from this source. Try a clearer model name or paste the official product link.",
      });
    } finally {
      setImporting(false);
    }
  };

  const removeProduct = async (product: ApiProduct) => {
    if (!token) return;
    const confirmed = window.confirm(`Delete ${product.name.en}?`);
    if (!confirmed) return;
    try {
      await apiRequest<{ deleted: true }>(`/api/admin/products/${product.id}`, {
        method: "DELETE",
        token,
      });
      toast({ title: "Product deleted", description: product.name.en });
      invalidateRuntimeCatalog();
      await Promise.all([loadProducts(), loadMeta()]);
    } catch (nextError) {
      toast({
        title: "Delete failed",
        description: nextError instanceof ApiError ? nextError.message : "Unable to delete product.",
      });
    }
  };

  const duplicateProduct = async (product: ApiProduct) => {
    if (!token) return;
    const confirmed = window.confirm(
      `Clone ${product.name.en} with the same badge, price, stock, category, gallery, and current product details?`,
    );
    if (!confirmed) return;
    try {
      const duplicated = await apiRequest<ApiProduct>(`/api/admin/products/${product.id}/duplicate`, {
        method: "POST",
        token,
        body: {},
      });
      toast({
        title: "Product cloned",
        description: `${duplicated.name.en} cloned with the same current product details.`,
      });
      invalidateRuntimeCatalog();
      await Promise.all([loadProducts(), loadMeta()]);
    } catch (nextError) {
      toast({
        title: "Duplicate failed",
        description: nextError instanceof ApiError ? nextError.message : "Unable to duplicate product.",
      });
    }
  };

  const updateGallery = (items: string[]) => {
    const normalized = parseGalleryItems(items.join("\n"));
    setForm((current) => {
      const nextCover = normalized.some((item) => normalizeMediaKey(item) === normalizeMediaKey(current.image))
        ? current.image
        : normalized[0] || "";
      return {
        ...current,
        image: nextCover,
        galleryText: normalized.join("\n"),
      };
    });
  };

  const removeGalleryItem = (itemToRemove: string) => {
    updateGallery(
      parseGalleryItems(form.galleryText).filter(
        (item) => normalizeMediaKey(item) !== normalizeMediaKey(itemToRemove),
      ),
    );
  };

  const reorderGalleryItem = (fromKey: string, toKey: string) => {
    if (!fromKey || !toKey || fromKey === toKey) return;
    const items = parseGalleryItems(form.galleryText);
    const fromIndex = items.findIndex((item) => normalizeMediaKey(item) === fromKey);
    const toIndex = items.findIndex((item) => normalizeMediaKey(item) === toKey);
    if (fromIndex < 0 || toIndex < 0) return;
    const nextItems = [...items];
    const [moved] = nextItems.splice(fromIndex, 1);
    nextItems.splice(toIndex, 0, moved);
    updateGallery(nextItems);
  };

  const applyNinePricingToValue = (value: string) => {
    const numeric = Number(sanitizeNumericInput(value));
    if (!Number.isFinite(numeric) || numeric <= 0) return value;
    const rounded = Math.ceil(numeric);
    const base = Math.floor(rounded / 10000) * 10000;
    const candidate = base + 9000;
    return String(rounded <= candidate ? candidate : base + 19000);
  };

  const applyNinePricingToForm = () => {
    setForm((current) => ({ ...current, price: applyNinePricingToValue(current.price) }));
  };

  const addGalleryItems = (rawValue: string) => {
    const candidates = parseGalleryItems(
      String(rawValue || "")
        .replace(/[,\u060C]+/g, "\n"),
    );
    if (!candidates.length) return;
    updateGallery([...parseGalleryItems(form.galleryText), ...candidates]);
    setGalleryDraft("");
  };

  const addStoredGalleryItems = (items: string[]) => {
    const nextItems = parseGalleryItems(items.join("\n"));
    if (!nextItems.length) return;
    updateGallery([...parseGalleryItems(form.galleryText), ...nextItems]);
  };

  const uploadProductMedia = async (files: FileList | File[]) => {
    if (!token) return;
    const selectedFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!selectedFiles.length) {
      toast({ title: "No images selected", description: "Choose one or more product image files." });
      return;
    }

    setUploadingMedia(true);
    try {
      const encodedFiles = await Promise.all(
        selectedFiles.slice(0, 12).map(async (file) => ({
          name: file.name,
          type: file.type,
          data: await readFileAsDataUrl(file),
        })),
      );
      const response = await apiRequest<UploadedProductMedia>("/api/admin/products/media", {
        method: "POST",
        token,
        body: {
          seed: form.nameEn || form.brand || "product",
          files: encodedFiles,
        },
      });
      const urls = response.media.map((item) => item.url).filter(Boolean);
      addStoredGalleryItems(urls);
      toast({
        title: "Images uploaded",
        description: `${urls.length} image${urls.length === 1 ? "" : "s"} stored locally and added to the gallery.`,
      });
    } catch (nextError) {
      toast({
        title: "Upload failed",
        description: nextError instanceof ApiError ? nextError.message : "Unable to upload these images.",
      });
    } finally {
      setUploadingMedia(false);
    }
  };

  const storeRemoteGalleryDraft = async () => {
    if (!token) return;
    const urls = parseGalleryItems(
      String(galleryDraft || "")
        .replace(/[,\u060C]+/g, "\n"),
    ).filter((item) => /^https?:\/\//i.test(item));

    if (!urls.length) {
      toast({ title: "No remote links", description: "Paste one or more image URLs first." });
      return;
    }

    setUploadingMedia(true);
    try {
      const response = await apiRequest<UploadedProductMedia>("/api/admin/products/media", {
        method: "POST",
        token,
        body: {
          seed: form.nameEn || form.brand || "product",
          urls,
        },
      });
      const storedUrls = response.media.map((item) => item.url).filter(Boolean);
      addStoredGalleryItems(storedUrls);
      setGalleryDraft("");
      toast({
        title: "Images stored locally",
        description: `${storedUrls.length} image${storedUrls.length === 1 ? "" : "s"} copied into EDIO media.`,
      });
    } catch (nextError) {
      toast({
        title: "Import failed",
        description: nextError instanceof ApiError ? nextError.message : "Unable to store these image links.",
      });
    } finally {
      setUploadingMedia(false);
    }
  };

  const galleryItems = parseGalleryItems(form.galleryText);
  const activeCoverKey = normalizeMediaKey(form.image);
  const previewGalleryItems = galleryItems
    .filter((item) => normalizeMediaKey(item) !== activeCoverKey)
    .slice(0, 4);

  const coverPreview = resolveMediaUrl(form.image.trim() || galleryItems[0] || "");
  const featureItems = parseMultiline(form.featuresText);
  const noisyFeatureItems = featureItems.filter((item) => looksLikeNavigationFeatureLine(item));
  const cleanFeatureItems = featureItems.filter((item) => !looksLikeNavigationFeatureLine(item));
  const boxItemEstimate = cleanFeatureItems.filter((item) => looksLikeBoxItemText(item));
  const highlightItems = cleanFeatureItems.filter((item) => !looksLikeBoxItemText(item));
  const hiddenSpecRows = form.specs.filter((spec) => isInternalSpecLabel(spec.labelEn || spec.labelAr));
  const completedSpecs = form.specs.filter(
    (spec) => !isInternalSpecLabel(spec.labelEn || spec.labelAr) && spec.labelEn.trim() && spec.value.trim(),
  );
  const coverIsInGallery = !activeCoverKey || galleryItems.some((item) => normalizeMediaKey(item) === activeCoverKey);
  const taglineLength = form.taglineEn.trim().length;
  const categoryAuditRule = getCategoryAuditRule(form.category);
  const taglineMismatch = getTaglineMismatch(form.category, form.taglineEn);
  const readinessChecks = [
    {
      label: "Source reference saved",
      description: "Keep the original product page traceable for later updates.",
      passed: Boolean(form.sourceUrl.trim()),
    },
    {
      label: "Brand and category set",
      description: "Needed for clean search, filtering, and related products.",
      passed: Boolean(form.brand.trim()) && Boolean(form.category.trim()),
    },
    {
      label: "Cover belongs to gallery",
      description: "Prevents a mismatch between the hero image and the gallery set.",
      passed: coverIsInGallery,
    },
    {
      label: "Gallery has 4+ images",
      description: "Specialist stores usually give multiple angles before the user clicks away.",
      passed: galleryItems.length >= 4,
    },
    {
      label: "Short selling line",
      description: "A tight tagline helps the product page explain itself instantly.",
      passed: taglineLength >= 18 && taglineLength <= 140,
    },
    {
      label: "4+ highlights",
      description: "The product page needs enough non-spec highlights to guide the decision.",
      passed: highlightItems.length >= 4,
    },
    {
      label: "4+ specifications",
      description: "Spec-driven gear needs enough technical detail to compare confidently.",
      passed: completedSpecs.length >= 4,
    },
    {
      label: "Price is ready",
      description: "A saved selling price keeps the PDP ready for publishing and checkout.",
      passed: Boolean(form.price.trim()),
    },
  ];
  const readinessPassed = readinessChecks.filter((item) => item.passed).length;
  const readinessScore = Math.round((readinessPassed / readinessChecks.length) * 100);
  const readinessTone =
    readinessScore >= 88
      ? "text-primary border-primary/30 bg-primary/10"
      : readinessScore >= 63
        ? "text-amber-200 border-amber-500/30 bg-amber-500/10"
        : "text-red-300 border-red-500/30 bg-red-500/10";
  const nextReadinessGap = readinessChecks.find((item) => !item.passed) || null;
  const storefrontStructureLine = [
    `${highlightItems.length} highlights`,
    `${boxItemEstimate.length} in-box items`,
    `${galleryItems.length} images`,
    `${completedSpecs.length} specs`,
  ].join(" • ");
  const missingTaglineSuggestion = !form.taglineEn.trim() ? categoryAuditRule : null;
  const auditIssueCount =
    Number(Boolean(taglineMismatch || missingTaglineSuggestion)) +
    Number(Boolean(noisyFeatureItems.length)) +
    Number(Boolean(hiddenSpecRows.length));
  const activeInventoryCount = products.filter((product) => product.inStock).length;
  const featuredCount = products.filter((product) => Boolean(product.badge)).length;
  const applyCategoryTaglineFix = () => {
    const rule = categoryAuditRule;
    if (!rule) return;
    setForm((current) => {
      const shouldResetArabic =
        !current.taglineAr.trim() || current.taglineAr.trim() === current.taglineEn.trim();
      return {
        ...current,
        taglineEn: rule.suggestion,
        taglineAr: shouldResetArabic ? "" : current.taglineAr,
      };
    });
  };
  const removeNoisyFeatureLines = () => {
    setForm((current) => ({
      ...current,
      featuresText: parseMultiline(current.featuresText)
        .filter((item) => !looksLikeNavigationFeatureLine(item))
        .join("\n"),
    }));
  };
  const removeInternalSpecRows = () => {
    setForm((current) => ({
      ...current,
      specs: normalizeStorefrontSpecs(
        current.specs.filter((spec) => !isInternalSpecLabel(spec.labelEn || spec.labelAr)),
      ),
    }));
  };

  return (
    <AdminLayout title="Products" eyebrow="Catalog">
      <div className="space-y-7">
        <div className="admin-bezel">
          <div className="admin-core overflow-hidden p-5 md:p-6">
            <div className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr] lg:items-end">
              <div>
                <p className="label-tech mb-3 text-primary">Product command center</p>
                <h2 className="font-display text-3xl font-bold leading-tight md:text-5xl">
                  Build a cleaner audio catalog.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                  Import, classify, audit, and publish EDIO products from one focused surface.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["Catalog", catalogTotal || products.length, "total"],
                  ["Live stock", activeInventoryCount, "available"],
                  ["Badged", featuredCount, "curated"],
                ].map(([label, value, caption]) => (
                  <div key={label} className="border border-border/35 bg-surface-lowest/50 p-3">
                    <p className="label-tech text-[0.58rem]">{label}</p>
                    <p className="mt-2 font-display text-2xl font-bold tabular-nums text-foreground">{value}</p>
                    <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">{caption}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="admin-bezel">
          <div className="admin-core flex flex-wrap items-center justify-between gap-3 p-3 md:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search products..."
                className="admin-field w-64 py-2.5 pe-3 ps-9 text-sm"
              />
            </div>
            <FilterSelect value={brand} onChange={setBrand}>
              <option value="all">All brands</option>
              {brands.map((item) => (
                <option key={item.key} value={item.name}>
                  {item.name}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect value={cat} onChange={setCat}>
              <option value="all">All categories</option>
              {categories.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.slug}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect value={badge} onChange={(value) => setBadge(value as (typeof badgeOptions)[number]["value"])}>
              {badgeOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              value={stockState}
              onChange={(value) => setStockState(value as (typeof stockOptions)[number]["value"])}
            >
              {stockOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </FilterSelect>
          </div>

          <button
            onClick={openCreate}
            className="admin-cta group inline-flex items-center gap-3 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-widest"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/16 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
              <Plus className="h-3.5 w-3.5" />
            </span>
            Add product
          </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 px-1 text-[11px] font-mono text-muted-foreground">
          <span>{productCountLabel}</span>
          <span className="inline-flex items-center gap-1">
            <ListFilter className="h-3.5 w-3.5" />
            {filterSummaryLabel}
          </span>
        </div>

        {selectedIds.size > 0 ? (
          <div className="sticky top-3 z-30 overflow-hidden rounded-lg border border-primary/35 bg-background/88 shadow-[0_24px_80px_-40px_rgba(255,75,26,0.7)] backdrop-blur-xl">
            <div className="grid gap-3 p-3 xl:grid-cols-[minmax(280px,0.95fr)_minmax(360px,1.15fr)_auto] xl:items-center">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-2 text-primary">
                  <CheckSquare className="h-4 w-4" />
                  <span className="text-sm font-semibold">{selectedIds.size} selected</span>
                </div>
                <FilterSelect value="smart-select" onChange={selectBySmartRule}>
                  <option value="smart-select" disabled>
                    Smart select
                  </option>
                  {smartSelectionOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </FilterSelect>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="admin-ghost px-3 py-2 text-xs text-muted-foreground"
                >
                  Clear
                </button>
              </div>

              <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-4">
                {[
                  ["Visible", selectedProducts.length, allVisibleSelected ? "all results" : "current page"],
                  ["Review", selectedDiagnostics.reviewCount, "held if risky"],
                  ["Media", selectedDiagnostics.missingMediaCount, "missing"],
                  ["Stock", selectedDiagnostics.inStockCount, "in stock"],
                ].map(([label, value, helper]) => (
                  <div key={label} className="rounded-md border border-border/30 bg-surface-lowest/45 px-3 py-2">
                    <p className="text-[9px] font-mono uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <span className="font-display text-lg font-semibold text-foreground">{value}</span>
                      <span className="truncate text-[10px] text-muted-foreground">{helper}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                <FilterSelect value={bulkAction} onChange={(value) => setBulkAction(value as BulkAction)}>
                  {bulkActions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </FilterSelect>

                {bulkAction === "update_availability" ? (
                  <FilterSelect value={bulkAvailability} onChange={setBulkAvailability}>
                    {availabilityBulkOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </FilterSelect>
                ) : null}

                {bulkAction === "update_status" ? (
                  <FilterSelect value={bulkStatus} onChange={setBulkStatus}>
                    {statusBulkOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </FilterSelect>
                ) : null}

                {bulkAction === "assign_category" || bulkAction === "assign_subcategory" ? (
                  <>
                    <FilterSelect
                      value={bulkCategory || (cat !== "all" ? cat : categories[0]?.slug || "")}
                      onChange={(value) => {
                        setBulkCategory(value);
                        setBulkSubcategory("");
                      }}
                    >
                      {categories.map((item) => (
                        <option key={item.slug} value={item.slug}>
                          {item.slug}
                        </option>
                      ))}
                    </FilterSelect>
                    <FilterSelect value={bulkSubcategory} onChange={setBulkSubcategory}>
                      <option value="">No child term</option>
                      {categoryTermOptions.map((term) => (
                        <option key={term.slug} value={term.slug}>
                          {getTermLabel(term, "en")}
                        </option>
                      ))}
                    </FilterSelect>
                  </>
                ) : null}

                {bulkAction === "add_tags" || bulkAction === "remove_tags" ? (
                  <input
                    value={bulkTags}
                    onChange={(event) => setBulkTags(event.target.value)}
                    placeholder="tag-one, tag-two"
                    className="admin-field w-52 px-3 py-2.5 text-sm"
                  />
                ) : null}

                <button
                  type="button"
                  onClick={() => void requestBulkPreview()}
                  disabled={bulkLoading || !selectedIds.size}
                  className="admin-cta inline-flex items-center gap-2 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest disabled:opacity-60"
                >
                  {bulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                  Preview
                </button>
              </div>
            </div>
            <div className="border-t border-border/25 px-3 py-2 text-[11px] text-muted-foreground">
              Low confidence changes under {Math.round(confidenceThreshold * 100)}% are skipped. Destructive actions require confirmation.
              {selectedDiagnostics.missingSpecsCount ? ` ${selectedDiagnostics.missingSpecsCount} selected products need specs cleanup.` : ""}
            </div>
          </div>
        ) : null}

        <div className="admin-bezel">
          <div className="admin-core p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="label-tech mb-2 text-primary">Classification engine</p>
                <h2 className="font-display text-xl font-bold">Existing taxonomy only</h2>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  Dry-run classification preserves WordPress terms when valid, scores evidence, and queues uncertain products for review.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border/40 px-3 py-2 text-xs text-muted-foreground">
                  {visibleReviewCount} visible need review
                </span>
                <button
                  type="button"
                  onClick={() => void selectClassificationReviewQueue()}
                  disabled={classificationLoading}
                  className="admin-ghost inline-flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground disabled:opacity-60"
                >
                  {classificationLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ListFilter className="h-3.5 w-3.5" />}
                  Select review queue
                </button>
                <button
                  type="button"
                  onClick={() => void requestClassificationPreview()}
                  disabled={!selectedIds.size || classificationLoading}
                  className="admin-cta inline-flex items-center gap-2 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest disabled:opacity-60"
                >
                  {classificationLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Dry-run selected
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void loadProducts()}
              className="shrink-0 rounded-sm border border-red-400/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-red-200 transition-colors hover:bg-red-500/10"
            >
              Retry
            </button>
          </div>
        )}

        <div className="admin-bezel">
          <div className="admin-core overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-lowest/70 text-left">
              <tr className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={toggleVisibleSelection}
                    className={cn(
                      "inline-flex h-7 w-7 items-center justify-center rounded-sm border transition-colors",
                      allVisibleSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/50 text-muted-foreground hover:border-primary/60 hover:text-primary",
                    )}
                    aria-label={allVisibleSelected ? "Unselect all visible products" : "Select all visible products"}
                  >
                    {allVisibleSelected ? <Check className="h-3.5 w-3.5" /> : null}
                  </button>
                </th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Badge</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {loading &&
                Array.from({ length: 8 }).map((_, index) => (
                  <tr key={`loading-${index}`}>
                    <td colSpan={8} className="px-4 py-4">
                      <div className="h-12 animate-pulse bg-surface-high/70" />
                    </td>
                  </tr>
                ))}

              {!loading &&
                products.map((product) => {
                  const selected = selectedIds.has(product.id);
                  const flags = getProductAdminFlags(product);
                  const primaryTerm = getPrimaryProductTerm(product);
                  const assignment = product.categoryAssignment;
                  return (
                  <tr key={product.id} className={cn("smooth hover:bg-primary/5", selected && "bg-primary/[0.07]")}>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleProductSelection(product.id)}
                        className={cn(
                          "inline-flex h-7 w-7 items-center justify-center rounded-sm border transition-colors",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border/50 text-muted-foreground hover:border-primary/60 hover:text-primary",
                        )}
                        aria-label={selected ? `Unselect ${product.name.en}` : `Select ${product.name.en}`}
                      >
                        {selected ? <Check className="h-3.5 w-3.5" /> : null}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ProductThumb src={product.normalizedImageUrl || product.image} alt={product.name.en} />
                        <div className="min-w-0">
                          <p className="max-w-[280px] truncate text-sm font-medium">{product.name.en}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <p className="font-mono text-[10px] text-muted-foreground">{readableProductHandle(product)}</p>
                            {flags.includes("needs_review") ? (
                              <span className="rounded-sm border border-amber-400/35 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-amber-200">
                                review
                              </span>
                            ) : null}
                            {flags.filter((flag) => flag.startsWith("missing_")).slice(0, 2).map((flag) => (
                              <span
                                key={`${product.id}-${flag}`}
                                className="rounded-sm border border-red-400/30 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-red-200"
                              >
                                {flag.replace("missing_", "")}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{product.brand}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div className="space-y-1">
                        <p>{product.category}</p>
                        {primaryTerm ? (
                          <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-primary">
                            {getTermLabel(primaryTerm, "en")}
                          </p>
                        ) : null}
                        {assignment ? (
                          <span
                            className={cn(
                              "inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] font-mono",
                              assignment.needsReview
                                ? "border-amber-400/35 bg-amber-500/10 text-amber-200"
                                : "border-emerald-400/35 bg-emerald-500/10 text-emerald-200",
                            )}
                          >
                            {Math.round(assignment.confidenceScore * 100)}%
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1 font-mono tabular-nums">
                        <p>{formatPrice(product.price, "en", currency)}</p>
                        {product.compareAt ? (
                          <p className="text-[10px] text-muted-foreground line-through">
                            {formatPrice(product.compareAt, "en", currency)}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <span
                          className={cn(
                            "text-[11px] font-mono",
                            product.inStock ? "text-emerald-400" : "text-red-400",
                          )}
                        >
                          {product.inStock ? "In stock" : "Out of stock"}
                        </span>
                        <p className="text-[10px] font-mono text-muted-foreground">{product.stock} units</p>
                        {product.availabilityStatus && product.availabilityStatus !== (product.inStock ? "in_stock" : "out_of_stock") ? (
                          <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-amber-200">
                            {product.availabilityStatus.replaceAll("_", " ")}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {product.badge ? (
                        <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-primary">
                          {product.badge}
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => openEdit(product)}
                          className="admin-ghost inline-flex h-8 w-8 items-center justify-center text-muted-foreground"
                          aria-label="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => void duplicateProduct(product)}
                          className="admin-ghost inline-flex h-8 w-8 items-center justify-center text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                          aria-label={`Clone ${product.name.en}`}
                          title="Clone product with the same details"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => void removeProduct(product)}
                          className="admin-ghost inline-flex h-8 w-8 items-center justify-center text-muted-foreground hover:border-red-400/45 hover:bg-red-500/10 hover:text-red-300"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}

              {!loading && products.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No products match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
          </div>
        </div>
      </div>

      {classificationPreviewOpen && classificationPreview && (
        <div className="fixed inset-0 z-[76] flex items-center justify-center bg-background/82 p-3 backdrop-blur-xl md:p-6">
          <div className="admin-bezel w-full max-w-7xl">
            <div className="admin-core flex max-h-[92vh] w-full flex-col overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/30 px-5 py-5 md:px-6">
                <div>
                  <p className="label-tech mb-2 text-primary">Classification dry-run</p>
                  <h2 className="font-display text-2xl font-bold md:text-3xl">Review taxonomy assignments</h2>
                  <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                    Only existing main and secondary categories are used. Low-confidence products stay in admin review.
                  </p>
                </div>
                <button
                  onClick={() => setClassificationPreviewOpen(false)}
                  className="admin-ghost inline-flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground"
                  aria-label="Close classification preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3 border-b border-border/30 px-5 py-4 md:grid-cols-4 md:px-6">
                {[
                  ["Selected", classificationPreview.selected_count, "products"],
                  ["Safe", classificationPreview.safe_count, "can apply"],
                  ["Review", classificationPreview.review_count, "queued"],
                  ["Conflicts", classificationPreview.conflict_count, "needs editor"],
                ].map(([label, value, caption]) => (
                  <div key={label} className="border border-border/30 bg-surface-lowest/45 p-3">
                    <p className="label-tech text-[0.58rem]">{label}</p>
                    <p className="mt-2 font-display text-2xl font-bold tabular-nums text-foreground">{value}</p>
                    <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">{caption}</p>
                  </div>
                ))}
              </div>

              <div className="flex-1 overflow-auto px-4 py-4 md:px-6">
                <table className="w-full min-w-[1120px] text-sm">
                  <thead className="sticky top-0 z-10 bg-surface-lowest text-left">
                    <tr className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      <th className="px-3 py-3">Apply</th>
                      <th className="px-3 py-3">Product</th>
                      <th className="px-3 py-3">Current</th>
                      <th className="px-3 py-3">Proposed</th>
                      <th className="px-3 py-3">Confidence</th>
                      <th className="px-3 py-3">Evidence</th>
                      <th className="px-3 py-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {classificationPreview.results.map((row) => {
                      const selectedForApply = classificationApplyIds.has(row.product_id);
                      const evidenceFacts = row.evidence.flatMap((item) => item.facts.slice(0, 1)).slice(0, 3);
                      return (
                        <tr key={row.product_id} className={cn(row.safe ? "hover:bg-primary/5" : "bg-amber-500/5")}>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              disabled={!row.safe}
                              onClick={() =>
                                setClassificationApplyIds((current) => {
                                  const next = new Set(current);
                                  if (next.has(row.product_id)) next.delete(row.product_id);
                                  else next.add(row.product_id);
                                  return next;
                                })
                              }
                              className={cn(
                                "inline-flex h-7 w-7 items-center justify-center rounded-sm border transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                                selectedForApply
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border/50 text-muted-foreground hover:border-primary/60 hover:text-primary",
                              )}
                              aria-label={`Toggle ${row.product.name}`}
                            >
                              {selectedForApply ? <Check className="h-3.5 w-3.5" /> : null}
                            </button>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-3">
                              <ProductThumb src={row.product.image} alt={row.product.name} />
                              <div className="min-w-0">
                                <p className="max-w-[220px] truncate font-medium text-foreground">{row.product.name}</p>
                                <p className="font-mono text-[10px] text-muted-foreground">{row.product.brand || row.product.slug}</p>
                              </div>
                            </div>
                          </td>
                          <td className="max-w-[180px] px-3 py-3 font-mono text-xs text-muted-foreground">
                            <p>{row.current_assignment.primary_category_slug || "none"}</p>
                            <p className="mt-1 line-clamp-2">{row.current_assignment.secondary_category_slugs.join(", ") || "no child"}</p>
                          </td>
                          <td className="max-w-[220px] px-3 py-3 font-mono text-xs text-foreground">
                            <p>{row.primary_category_slug || "needs review"}</p>
                            <p className="mt-1 line-clamp-2">{row.secondary_category_slugs.join(", ") || "no child assigned"}</p>
                            {row.dynamic_collection_slugs.length ? (
                              <p className="mt-1 text-[10px] text-primary">{row.dynamic_collection_slugs.join(", ")}</p>
                            ) : null}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={cn(
                                "inline-flex min-w-16 items-center justify-center rounded-full border px-2.5 py-1 font-mono text-xs",
                                row.safe
                                  ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                                  : "border-amber-400/35 bg-amber-500/10 text-amber-200",
                              )}
                            >
                              {Math.round(row.confidence_score * 100)}%
                            </span>
                          </td>
                          <td className="max-w-[260px] px-3 py-3">
                            <div className="space-y-1">
                              {row.evidence.slice(0, 3).map((item, index) => (
                                <p key={`${row.product_id}-${item.source_type}-${index}`} className="line-clamp-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                                  {item.source_type}
                                  {item.source_url ? ` • ${safeSourceHost(item.source_url)}` : ""}
                                </p>
                              ))}
                              {evidenceFacts.length ? (
                                <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{evidenceFacts.join(" • ")}</p>
                              ) : null}
                            </div>
                          </td>
                          <td className="max-w-[320px] px-3 py-3">
                            <p className="line-clamp-3 text-xs leading-5 text-muted-foreground">{row.classification_reason}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/30 px-5 py-4 md:px-6">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Applies only safe rows. Everything else stays marked as needs_review.
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setClassificationApplyIds(new Set(classificationPreview.results.filter((row) => row.safe).map((row) => row.product_id)))}
                    className="admin-ghost px-4 py-2 text-xs text-muted-foreground"
                  >
                    Select safe only
                  </button>
                  <button
                    type="button"
                    onClick={() => setClassificationPreviewOpen(false)}
                    className="admin-ghost px-4 py-2 text-xs text-muted-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void applyClassificationChanges("selected")}
                    disabled={classificationLoading || !selectedSafeClassificationCount}
                    className="admin-ghost inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-primary disabled:opacity-60"
                  >
                    {classificationLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                    Apply selected
                  </button>
                  <button
                    type="button"
                    onClick={() => void applyClassificationChanges("safe")}
                    disabled={classificationLoading || !classificationPreview.safe_count}
                    className="admin-cta inline-flex items-center gap-2 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-widest disabled:opacity-60"
                  >
                    {classificationLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckSquare className="h-3.5 w-3.5" />}
                    Apply all safe
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {bulkPreviewOpen && bulkPreview && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-background/82 p-3 backdrop-blur-xl md:p-6">
          <div className="admin-bezel w-full max-w-7xl">
            <div className="admin-core flex max-h-[92vh] w-full flex-col overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/30 px-5 py-5 md:px-6">
                <div>
                  <p className="label-tech mb-2 text-primary">Bulk action preview</p>
                  <h2 className="font-display text-2xl font-bold md:text-3xl">
                    Review before applying {bulkPreview.action.replaceAll("_", " ")}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                    {bulkPreview.safe_count} safe changes, {bulkPreview.blocked_count} held for review. Nothing is applied until you confirm.
                  </p>
                </div>
                <button
                  onClick={() => setBulkPreviewOpen(false)}
                  className="admin-ghost inline-flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground"
                  aria-label="Close bulk preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3 border-b border-border/30 px-5 py-4 md:grid-cols-4 md:px-6">
                {[
                  ["Selected", bulkPreview.selected_count, "products"],
                  ["Safe", bulkPreview.safe_count, ">= 75%"],
                  ["Needs review", bulkPreview.blocked_count, "skipped"],
                  ["Chosen", selectedSafePreviewCount, "to apply"],
                ].map(([label, value, caption]) => (
                  <div key={label} className="border border-border/30 bg-surface-lowest/45 p-3">
                    <p className="label-tech text-[0.58rem]">{label}</p>
                    <p className="mt-2 font-display text-2xl font-bold tabular-nums text-foreground">{value}</p>
                    <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">{caption}</p>
                  </div>
                ))}
              </div>

              <div className="flex-1 overflow-auto px-4 py-4 md:px-6">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="sticky top-0 z-10 bg-surface-lowest text-left">
                    <tr className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      <th className="px-3 py-3">Apply</th>
                      <th className="px-3 py-3">Product</th>
                      <th className="px-3 py-3">Current value</th>
                      <th className="px-3 py-3">Proposed value</th>
                      <th className="px-3 py-3">Confidence</th>
                      <th className="px-3 py-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {bulkPreview.preview.map((row) => {
                      const selectedForApply = bulkApplyIds.has(row.id);
                      return (
                        <tr key={row.id} className={cn(row.safe ? "hover:bg-primary/5" : "bg-amber-500/5")}>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              disabled={!row.safe}
                              onClick={() =>
                                setBulkApplyIds((current) => {
                                  const next = new Set(current);
                                  if (next.has(row.id)) next.delete(row.id);
                                  else next.add(row.id);
                                  return next;
                                })
                              }
                              className={cn(
                                "inline-flex h-7 w-7 items-center justify-center rounded-sm border transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                                selectedForApply
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border/50 text-muted-foreground hover:border-primary/60 hover:text-primary",
                              )}
                              aria-label={`Toggle ${row.product.name}`}
                            >
                              {selectedForApply ? <Check className="h-3.5 w-3.5" /> : null}
                            </button>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-3">
                              <ProductThumb src={row.product.image} alt={row.product.name} />
                              <div className="min-w-0">
                                <p className="max-w-[240px] truncate font-medium text-foreground">{row.product.name}</p>
                                <p className="font-mono text-[10px] text-muted-foreground">{row.product.brand || row.product.slug}</p>
                              </div>
                            </div>
                          </td>
                          <td className="max-w-[220px] px-3 py-3">
                            <p className="line-clamp-3 break-words font-mono text-xs text-muted-foreground">{row.current_value}</p>
                          </td>
                          <td className="max-w-[260px] px-3 py-3">
                            <p className="line-clamp-4 break-words font-mono text-xs text-foreground">{row.proposed_value}</p>
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={cn(
                                "inline-flex min-w-16 items-center justify-center rounded-full border px-2.5 py-1 font-mono text-xs",
                                row.safe
                                  ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-200"
                                  : "border-amber-400/35 bg-amber-500/10 text-amber-200",
                              )}
                            >
                              {Math.round(row.confidence * 100)}%
                            </span>
                          </td>
                          <td className="max-w-[280px] px-3 py-3">
                            <div className="space-y-1">
                              <p className="text-xs leading-5 text-muted-foreground">{row.reason}</p>
                              {row.warnings?.length ? (
                                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-amber-200">
                                  {row.warnings.slice(0, 3).join(", ")}
                                </p>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/30 px-5 py-4 md:px-6">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {bulkPreview.action === "delete" ? (
                    <>
                      <AlertTriangle className="h-4 w-4 text-red-300" />
                      Delete requires confirmation and is logged with an undo snapshot.
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      Every applied row is written to bulk_action_logs with an undo snapshot.
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkApplyIds(new Set(bulkPreview.preview.filter((row) => row.safe).map((row) => row.id)))}
                    className="admin-ghost px-4 py-2 text-xs text-muted-foreground"
                  >
                    Skip low confidence
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkPreviewOpen(false)}
                    className="admin-ghost px-4 py-2 text-xs text-muted-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void applyBulkChanges("selected")}
                    disabled={bulkLoading || !selectedSafePreviewCount}
                    className="admin-ghost inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-primary disabled:opacity-60"
                  >
                    {bulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                    Apply selected changes
                  </button>
                  <button
                    type="button"
                    onClick={() => void applyBulkChanges("safe")}
                    disabled={bulkLoading || !bulkPreview.safe_count}
                    className="admin-cta inline-flex items-center gap-2 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-widest disabled:opacity-60"
                  >
                    {bulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckSquare className="h-3.5 w-3.5" />}
                    Apply all safe changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/82 p-3 backdrop-blur-xl md:p-6">
          <div className="admin-bezel w-full max-w-6xl">
          <div className="admin-core flex max-h-[92vh] w-full flex-col overflow-hidden">
            <div className="flex items-start justify-between border-b border-border/30 px-5 py-5 md:px-6">
              <div>
                <p className="label-tech mb-2 text-primary">{form.id ? "Edit product" : "Create product"}</p>
                <h2 className="font-display text-2xl font-bold md:text-3xl">
                  {form.id ? form.nameEn || "Edit catalog entry" : "New catalog entry"}
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Add the source, product story, pricing, media, and specialist audio specs in one controlled flow.
                </p>
              </div>
              <button
                onClick={() => setFormOpen(false)}
                className="admin-ghost inline-flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={submitForm} className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
              <div className="space-y-8">
                <FormSection
                  title="Basic identity"
                  description="The essentials that define the product in the catalog and product page."
                  icon={<Sparkles className="h-4 w-4" />}
                >
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <Field
                      label="Name (EN)"
                      value={form.nameEn}
                      onChange={(value) => setForm((current) => ({ ...current, nameEn: value }))}
                    />
                    <Field
                      label="Name (AR)"
                      value={form.nameAr}
                      onChange={(value) => setForm((current) => ({ ...current, nameAr: value }))}
                    />
                    <Field
                      label="Slug"
                      value={form.slug}
                      onChange={(value) => setForm((current) => ({ ...current, slug: value }))}
                      placeholder="leave blank to auto-generate"
                    />
                    <Field
                      label="Brand"
                      value={form.brand}
                      onChange={(value) => setForm((current) => ({ ...current, brand: value }))}
                      required
                      listId="admin-brand-options"
                    />
                    <Field
                      label="Category"
                      value={form.category}
                      onChange={(value) => setForm((current) => ({ ...current, category: value }))}
                      required
                      listId="admin-category-options"
                    />
                    <Field
                      label="Sub-categories"
                      value={form.subCategoriesText}
                      onChange={(value) => setForm((current) => ({ ...current, subCategoriesText: value }))}
                      placeholder="iems, studio, portable"
                    />
                    <Field
                      label="Tagline (EN)"
                      value={form.taglineEn}
                      onChange={(value) => setForm((current) => ({ ...current, taglineEn: value }))}
                      className="xl:col-span-2"
                    />
                    <Field
                      label="Tagline (AR)"
                      value={form.taglineAr}
                      onChange={(value) => setForm((current) => ({ ...current, taglineAr: value }))}
                    />
                  </div>
                </FormSection>

                <FormSection
                  title="Pricing and availability"
                  description="Sale price, compare-at price, badge, and inventory state."
                  icon={<ListFilter className="h-4 w-4" />}
                >
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <NumericField
                      label="Current price (IQD)"
                      value={form.price}
                      onChange={(value) => setForm((current) => ({ ...current, price: value }))}
                      onBlur={applyNinePricingToForm}
                      helperText="Auto-applies 9 pricing: 75,000 → 79,000."
                      required
                    />
                    <NumericField
                      label="Current price (USD)"
                      value={form.priceUsd}
                      onChange={(value) => setForm((current) => ({ ...current, priceUsd: value }))}
                      allowDecimal
                    />
                    <NumericField
                      label="Official price (IQD)"
                      value={form.officialPrice}
                      onChange={(value) => setForm((current) => ({ ...current, officialPrice: value }))}
                    />
                    <NumericField
                      label="Official price (USD)"
                      value={form.officialPriceUsd}
                      onChange={(value) => setForm((current) => ({ ...current, officialPriceUsd: value }))}
                      allowDecimal
                    />
                    <label className="block">
                      <span className="label-tech mb-2 block">Badge</span>
                      <select
                        value={form.badge}
                        onChange={(e) =>
                          setForm((current) => ({
                            ...current,
                            badge: e.target.value as ProductFormState["badge"],
                          }))
                        }
                      className="admin-field w-full px-4 py-3 text-sm"
                    >
                        <option value="">None</option>
                        <option value="new">New</option>
                        <option value="featured">Featured</option>
                        <option value="best">Best seller</option>
                        <option value="preowned">Pre-owned</option>
                      </select>
                    </label>
                    <NumericField
                      label="Sales count"
                      value={form.sales}
                      onChange={(value) => setForm((current) => ({ ...current, sales: value }))}
                    />
                    <NumericField
                      label="Stock units"
                      value={form.stock}
                      onChange={(value) => setForm((current) => ({ ...current, stock: value }))}
                    />
                    <label className="admin-field flex items-center gap-3 px-4 py-3 md:col-span-2 xl:col-span-3">
                      <input
                        type="checkbox"
                        checked={form.inStock}
                        onChange={(e) => setForm((current) => ({ ...current, inStock: e.target.checked }))}
                        className="h-4 w-4 accent-primary"
                      />
                      <div>
                        <p className="text-sm font-medium">Available for sale</p>
                        <p className="text-xs text-muted-foreground">
                          If unchecked, the product will appear as unavailable even if stock is present.
                        </p>
                      </div>
                    </label>
                  </div>
                </FormSection>

                <FormSection
                  title="Media"
                  description="Cover image and gallery for the admin list and product page."
                  icon={<ImageIcon className="h-4 w-4" />}
                >
                  <div className="grid gap-6 xl:grid-cols-[1.7fr,0.9fr]">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="block">
                          <span className="label-tech mb-2 block">Product URL or model name</span>
                          <div className="flex gap-2">
                            <input
                              value={form.sourceUrl}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, sourceUrl: event.target.value }))
                              }
                              placeholder="https://brand.com/product/... or HiFiMAN HE6se V2"
                            className="admin-field w-full px-4 py-3 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => void importFromSource()}
                              disabled={importing || !trimmedImportSource}
                              className="admin-ghost inline-flex shrink-0 items-center gap-2 px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-primary disabled:opacity-60"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              {importing ? importPendingLabel : importButtonLabel}
                            </button>
                          </div>
                        </label>
                        <p className="text-xs text-muted-foreground">
                          Paste a product page URL or type the exact model name. We search for the closest real product page, classify it, collect media, and fill the draft automatically.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Search now prefers exact model matches, avoids review and promo pages when a store page exists, and removes duplicate media before it reaches the gallery.
                        </p>
                        {importMeta ? (
                          <div className="rounded-md border border-border/30 bg-surface-lowest/45 px-4 py-3 text-sm">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                              <span className="font-medium text-foreground">
                                {importMeta.mode === "query" ? "Imported from model search" : "Imported from source URL"}
                              </span>
                              {importMeta.imageCount ? (
                                <span className="text-muted-foreground">{importMeta.imageCount} images</span>
                              ) : null}
                              {importMeta.localizedImageCount ? (
                                <span className="text-primary">{importMeta.localizedImageCount} stored locally</span>
                              ) : null}
                              {importMeta.featureCount ? (
                                <span className="text-muted-foreground">{importMeta.featureCount} highlights</span>
                              ) : null}
                              {importMeta.boxItemCount ? (
                                <span className="text-muted-foreground">{importMeta.boxItemCount} in-box items</span>
                              ) : null}
                              {importMeta.specCount ? (
                                <span className="text-muted-foreground">{importMeta.specCount} specs</span>
                              ) : null}
                              {importMeta.evaluatedCandidates ? (
                                <span className="text-muted-foreground">
                                  checked {importMeta.evaluatedCandidates} candidate pages
                                </span>
                              ) : null}
                              {importMeta.usedStructuredData ? (
                                <span className="text-primary">Structured product data found</span>
                              ) : null}
                              {importMeta.importJobId ? (
                                <span className="font-mono text-muted-foreground">job {importMeta.importJobId.slice(0, 12)}</span>
                              ) : null}
                              {importMeta.evidenceCount ? (
                                <span className="text-muted-foreground">{importMeta.evidenceCount} evidence items</span>
                              ) : null}
                              {importMeta.normalizedImageCount ? (
                                <span className="text-primary">{importMeta.normalizedImageCount} white-background image</span>
                              ) : null}
                              {importMeta.publishDecision ? (
                                <span
                                  className={cn(
                                    "rounded-sm border px-2 py-1 text-[10px] font-semibold uppercase tracking-widest",
                                    importMeta.publishDecision === "auto_publish"
                                      ? "border-emerald-400/35 text-emerald-200"
                                      : importMeta.publishDecision === "reject"
                                        ? "border-red-400/35 text-red-200"
                                        : "border-amber-400/35 text-amber-200",
                                  )}
                                >
                                  {importMeta.publishDecision.replace("_", " ")}
                                </span>
                              ) : null}
                              {typeof importMeta.confidenceOverall === "number" ? (
                                <span className="text-muted-foreground">
                                  confidence {Math.round(importMeta.confidenceOverall * 100)}%
                                </span>
                              ) : null}
                              {importMeta.unitType ? (
                                <span className="text-muted-foreground">unit: {importMeta.unitType}</span>
                              ) : null}
                              {importMeta.isBundle ? (
                                <span className="text-amber-200">bundle/set review</span>
                              ) : null}
                              {importResolvedFromCatalog ? (
                                <span className="text-primary">Matched an existing catalog entry</span>
                              ) : null}
                            </div>
                            {importMeta.qualityFlags?.length ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {importMeta.qualityFlags.slice(0, 8).map((flag) => (
                                  <span
                                    key={flag}
                                    className="rounded-sm border border-border/35 bg-surface-high/45 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground"
                                  >
                                    {flag.replaceAll("_", " ")}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            {importMeta.catalogClassification ? (
                              <div className="mt-3 rounded-sm border border-border/30 bg-background/35 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                    Catalog classification
                                  </p>
                                  <span
                                    className={cn(
                                      "rounded-sm border px-2 py-1 text-[10px] font-semibold uppercase tracking-widest",
                                      importMeta.catalogClassification.quality.review_required
                                        ? "border-amber-400/35 text-amber-200"
                                        : "border-emerald-400/35 text-emerald-200",
                                    )}
                                  >
                                    {importMeta.catalogClassification.quality.review_required ? "needs review" : "ready"}
                                  </span>
                                </div>
                                <div className="mt-3 grid gap-2 md:grid-cols-3">
                                  <div>
                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Section</p>
                                    <p className="mt-1 font-mono text-xs text-foreground">
                                      {importMeta.catalogClassification.classification.top_level_section || "unresolved"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Leaf</p>
                                    <p className="mt-1 font-mono text-xs text-foreground">
                                      {importMeta.catalogClassification.classification.leaf_category || "needs review"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Confidence</p>
                                    <p className="mt-1 font-mono text-xs text-foreground">
                                      {Math.round(importMeta.catalogClassification.quality.confidence * 100)}%
                                    </p>
                                  </div>
                                </div>
                                {importMeta.catalogClassification.classification.dynamic_collections.length ? (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {importMeta.catalogClassification.classification.dynamic_collections.map((collection) => (
                                      <span
                                        key={collection}
                                        className="rounded-sm border border-primary/25 bg-primary/5 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-primary"
                                      >
                                        {collection.replaceAll("-", " ")}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                                {importMeta.catalogClassification.quality.missing_fields.length ||
                                importMeta.catalogClassification.quality.conflicts.length ? (
                                  <p className="mt-2 text-xs text-amber-100">
                                    Review: {[...importMeta.catalogClassification.quality.missing_fields, ...importMeta.catalogClassification.quality.conflicts]
                                      .slice(0, 5)
                                      .join(", ")}
                                  </p>
                                ) : null}
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {importMeta.catalogClassification.classification.reasoning_summary}
                                </p>
                              </div>
                            ) : null}
                            {pipelineClassification ? (
                              <div className="mt-3 rounded-sm border border-primary/20 bg-primary/5 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                                    Import pipeline assignment
                                  </p>
                                  <span
                                    className={cn(
                                      "rounded-sm border px-2 py-1 text-[10px] font-semibold uppercase tracking-widest",
                                      pipelineClassification.needs_review
                                        ? "border-amber-400/35 text-amber-200"
                                        : "border-emerald-400/35 text-emerald-200",
                                    )}
                                  >
                                    {pipelineClassification.needs_review ? "review" : "safe"}
                                  </span>
                                </div>
                                <div className="mt-3 grid gap-2 md:grid-cols-3">
                                  <div>
                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Primary</p>
                                    <p className="mt-1 font-mono text-xs text-foreground">
                                      {pipelineClassification.primary_category_slug || "unresolved"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Secondary</p>
                                    <p className="mt-1 font-mono text-xs text-foreground">
                                      {(pipelineClassification.secondary_category_slugs || []).join(", ") || "needs review"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Confidence</p>
                                    <p className="mt-1 font-mono text-xs text-foreground">
                                      {Math.round(Number(pipelineClassification.confidence_score || 0) * 100)}%
                                    </p>
                                  </div>
                                </div>
                                {pipelineClassification.classification_reason ? (
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    {pipelineClassification.classification_reason}
                                  </p>
                                ) : null}
                              </div>
                            ) : null}
                            {importMeta.matchedTitle ? (
                              <p className="mt-2 text-muted-foreground">Matched: {importMeta.matchedTitle}</p>
                            ) : null}
                            {importResolvedFromCatalog ? (
                              <p className="mt-2 text-xs text-muted-foreground">
                                No safer external page beat the existing catalog match, so the current catalog entry was loaded instead of forcing a risky variant.
                              </p>
                            ) : null}
                            <p className="mt-2 text-xs text-muted-foreground">
                              The storefront keeps highlights separate from box contents so the product page stays focused instead of showing a raw vendor dump.
                            </p>
                            {importMeta.resolvedUrl ? (
                              <a
                                href={importMeta.resolvedUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-flex text-xs text-primary hover:underline"
                              >
                                {importMeta.resolvedUrl}
                              </a>
                            ) : null}
                          </div>
                        ) : null}
                        {strictImportData ? (
                          <details className="rounded-md border border-border/30 bg-surface-lowest/35 px-4 py-3 text-sm">
                            <summary className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-widest text-primary">
                              Strict ecommerce JSON
                            </summary>
                            <div className="mt-3 grid gap-3 md:grid-cols-4">
                              <div className="rounded-sm border border-border/25 bg-background/35 px-3 py-2">
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Decision</p>
                                <p className="mt-1 font-mono text-sm text-foreground">{strictImportData.publish_decision}</p>
                              </div>
                              <div className="rounded-sm border border-border/25 bg-background/35 px-3 py-2">
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Confidence</p>
                                <p className="mt-1 font-mono text-sm text-foreground">
                                  {Math.round(strictImportData.confidence.overall * 100)}%
                                </p>
                              </div>
                              <div className="rounded-sm border border-border/25 bg-background/35 px-3 py-2">
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Unit</p>
                                <p className="mt-1 font-mono text-sm text-foreground">{strictImportData.product_identity.unit_type || "needs review"}</p>
                              </div>
                              <div className="rounded-sm border border-border/25 bg-background/35 px-3 py-2">
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Category</p>
                                <p className="mt-1 font-mono text-sm text-foreground">
                                  {strictImportData.product_identity.category}
                                </p>
                              </div>
                            </div>
                            <pre className="mt-3 max-h-80 overflow-auto rounded-md border border-border/25 bg-background/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
                              {JSON.stringify(strictImportData, null, 2)}
                            </pre>
                          </details>
                        ) : null}
                        {existingImportMatch ? (
                          <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="font-medium text-foreground">Existing catalog match found</p>
                                <p className="mt-1 text-muted-foreground">
                                  {existingImportMatch.nameEn} is already in the catalog under {existingImportMatch.brand}.
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Category: {existingImportMatch.category} {existingImportMatch.sourceUrl ? "• Source saved" : "• No source URL saved"}
                                </p>
                              </div>
                              {matchedExistingProduct ? (
                                <button
                                  type="button"
                                  onClick={() => openEdit(matchedExistingProduct)}
                                  className="admin-ghost inline-flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-primary"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                  Open existing product
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                        {importCandidates.length ? (
                          <div className="space-y-3 rounded-md border border-border/30 bg-surface-lowest/45 p-4">
                            <div>
                              <p className="label-tech mb-1 block">Search matches</p>
                              <p className="text-xs text-muted-foreground">
                                We checked several pages. The best match is applied automatically, and you can switch to another result any time.
                              </p>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              {importCandidates.map((candidate) => {
                                const active = isActiveImportCandidate(candidate, importMeta);
                                return (
                                <button
                                  key={`${candidate.url}-${candidate.score}`}
                                  type="button"
                                  onClick={() => applyImportedDraft(candidate.draft)}
                                  className={cn(
                                    "flex items-start gap-3 rounded-md border bg-surface-high/30 p-3 text-left transition-colors duration-500 hover:bg-surface-high/50",
                                    active ? "border-primary/60 bg-primary/5" : "border-border/30 hover:border-primary/40",
                                  )}
                                >
                                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border/30 bg-background">
                                    {candidate.image ? (
                                      <img
                                        src={resolveMediaUrl(candidate.image)}
                                        alt={candidate.title}
                                        className="h-full w-full object-contain p-2"
                                      />
                                    ) : (
                                      <div className="flex h-full items-center justify-center text-muted-foreground">
                                        <ImageIcon className="h-5 w-5" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="truncate text-sm font-medium text-foreground">{candidate.title}</p>
                                      {active ? (
                                        <span className="shrink-0 border border-primary/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                                          Applied
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{candidate.url}</p>
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      {candidate.imageCount} images, {candidate.specCount} specs
                                    </p>
                                    <p className="mt-1 text-xs text-primary">{active ? "Current draft" : "Switch to this result"}</p>
                                  </div>
                                </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <Field
                        label="Cover image"
                        value={form.image}
                        onChange={(value) => setForm((current) => ({ ...current, image: value }))}
                        placeholder="/src/assets/products/example.jpg or https://..."
                      />
                      <label className="block">
                        <span className="label-tech mb-2 block">Add more images</span>
                        <div className="flex gap-2">
                          <input
                            value={galleryDraft}
                            onChange={(event) => setGalleryDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter") return;
                              event.preventDefault();
                              addGalleryItems(galleryDraft);
                            }}
                            placeholder="Paste one or more image URLs/paths"
                            className="admin-field w-full px-4 py-3 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => addGalleryItems(galleryDraft)}
                            disabled={!galleryDraft.trim() || uploadingMedia}
                            className="admin-ghost inline-flex shrink-0 items-center gap-2 px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-primary disabled:opacity-60"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add image
                          </button>
                          <button
                            type="button"
                            onClick={() => void storeRemoteGalleryDraft()}
                            disabled={!galleryDraft.trim() || uploadingMedia}
                            className="admin-ghost inline-flex shrink-0 items-center gap-2 px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground disabled:opacity-60"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            {uploadingMedia ? "Storing..." : "Store"}
                          </button>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Add links directly, or use Store to copy remote image URLs into EDIO media so the product no longer depends on the source site.
                        </p>
                      </label>
                      <label className="block rounded-md border border-dashed border-border/40 bg-surface-lowest/45 px-4 py-4 transition-colors duration-500 hover:border-primary/50">
                        <span className="flex items-center justify-between gap-3">
                          <span>
                            <span className="label-tech mb-1 block">Upload product images</span>
                            <span className="block text-xs text-muted-foreground">
                              Select JPG, PNG, WebP, AVIF, GIF, or SVG files. They are stored with imported product media and added to the gallery.
                            </span>
                          </span>
                          <span className="admin-ghost inline-flex shrink-0 items-center gap-2 px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-primary">
                            <Upload className="h-3.5 w-3.5" />
                            {uploadingMedia ? "Uploading..." : "Choose files"}
                          </span>
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          disabled={uploadingMedia}
                          onChange={(event) => {
                            if (event.target.files?.length) void uploadProductMedia(event.target.files);
                            event.currentTarget.value = "";
                          }}
                          className="sr-only"
                        />
                      </label>
                      <TextAreaField
                        label="Gallery"
                        value={form.galleryText}
                        onChange={(value) => setForm((current) => ({ ...current, galleryText: value }))}
                        placeholder={"One image path or URL per line"}
                        rows={6}
                      />
                      {galleryItems.length ? (
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="label-tech block">Imported gallery</p>
                              <p className="text-xs text-muted-foreground">
                                التكرار يُزال تلقائيًا. اسحب الصور لترتيبها، اضغط أي صورة لتجعلها الغلاف، أو احذف أي صورة لا تريدها.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => updateGallery([])}
                              className="admin-ghost inline-flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Clear all
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                            {galleryItems.map((item) => {
                              const resolved = resolveMediaUrl(item);
                              const active = activeCoverKey === normalizeMediaKey(item);
                              const itemKey = normalizeMediaKey(item) || item;
                              const isDragging = draggedGalleryKey === itemKey;
                              return (
                                <div
                                  key={itemKey}
                                  draggable
                                  onDragStart={(event) => {
                                    setDraggedGalleryKey(itemKey);
                                    event.dataTransfer.effectAllowed = "move";
                                    event.dataTransfer.setData("text/plain", itemKey);
                                  }}
                                  onDragOver={(event) => {
                                    event.preventDefault();
                                    event.dataTransfer.dropEffect = "move";
                                  }}
                                  onDrop={(event) => {
                                    event.preventDefault();
                                    const fromKey = event.dataTransfer.getData("text/plain") || draggedGalleryKey || "";
                                    reorderGalleryItem(fromKey, itemKey);
                                    setDraggedGalleryKey(null);
                                  }}
                                  onDragEnd={() => setDraggedGalleryKey(null)}
                                  className={cn(
                                    "group overflow-hidden rounded-md border bg-background transition duration-200",
                                    active ? "border-primary" : "border-border/30",
                                    isDragging ? "scale-[0.98] opacity-45" : "hover:border-primary/40",
                                  )}
                                >
                                  <div className="relative aspect-square overflow-hidden bg-surface-high">
                                    <div className="absolute start-2 top-2 z-10 inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-full border border-white/15 bg-black/55 text-white/80 opacity-80 transition group-hover:bg-black/75 group-hover:text-white active:cursor-grabbing">
                                      <GripVertical className="h-4 w-4" />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setForm((current) => ({ ...current, image: item }))}
                                      className="block h-full w-full text-left"
                                    >
                                      <img src={resolved} alt="Imported option" className="h-full w-full object-contain p-2" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeGalleryItem(item)}
                                      className="absolute end-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-400/40 bg-black/75 text-white shadow-lg transition-colors hover:bg-red-500"
                                      aria-label="Remove image"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                  <div className="px-3 py-2">
                                    <p className={cn("text-xs", active ? "text-primary" : "text-muted-foreground")}>
                                      {active ? "Current cover" : "Use as cover"}
                                    </p>
                                    {active ? (
                                      <p className="mt-1 text-[10px] text-muted-foreground">If removed, the next image becomes cover.</p>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                      {form.image.trim() && !galleryItems.some((item) => normalizeMediaKey(item) === normalizeMediaKey(form.image)) ? (
                        <div className="rounded-sm border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                          The selected cover image is outside the gallery. It will still be saved as cover unless you replace it.
                        </div>
                      ) : null}
                    </div>
                      <div className="admin-bezel">
                      <div className="admin-core p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="label-tech block">Preview</p>
                        <p className="text-[10px] font-mono text-muted-foreground">
                          {galleryItems.length ? `${galleryItems.length} gallery image${galleryItems.length > 1 ? "s" : ""}` : "No gallery yet"}
                        </p>
                      </div>
                      <div className="mt-3 aspect-square overflow-hidden rounded-md border border-border/30 bg-surface-high">
                        {coverPreview ? (
                          <img src={coverPreview} alt="Product preview" className="h-full w-full object-contain p-4" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground">
                            <div className="text-center">
                              <ImageIcon className="mx-auto mb-2 h-8 w-8" />
                              <p className="text-xs">No image yet</p>
                            </div>
                          </div>
                        )}
                      </div>
                      {previewGalleryItems.length ? (
                        <div className="mt-3 space-y-2">
                          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Other imported images</p>
                          <div className="grid grid-cols-4 gap-2">
                            {previewGalleryItems.map((item) => (
                              <button
                                key={`preview-${normalizeMediaKey(item) || item}`}
                                type="button"
                                onClick={() => setForm((current) => ({ ...current, image: item }))}
                                className="aspect-square overflow-hidden rounded-md border border-border/30 bg-surface-high transition-colors hover:border-primary/50"
                              >
                                <img src={resolveMediaUrl(item)} alt="Gallery preview" className="h-full w-full object-contain p-2" />
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <p className="mt-3 text-xs text-muted-foreground">
                        Local project assets like <code>/src/assets/...</code> work here too. The preview keeps the full image visible so you can check fit before saving.
                      </p>
                      <div className="mt-4 border-t border-border/30 pt-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="label-tech block">Storefront readiness</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Based on the same patterns specialist retailers use: enough images, a clear hook, clean specs, and a consistent hero image.
                            </p>
                          </div>
                          <div className={cn("shrink-0 border px-3 py-2 text-sm font-semibold", readinessTone)}>
                            {readinessScore}%
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                          {nextReadinessGap
                            ? `Next fix: ${nextReadinessGap.label}. ${nextReadinessGap.description}`
                            : "This draft has the essentials to publish without obvious PDP gaps."}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">Current structure: {storefrontStructureLine}</p>
                        <div className="mt-3 space-y-2">
                          {readinessChecks.map((check) => (
                            <div
                              key={check.label}
                              className={cn(
                                "border px-3 py-2 text-xs",
                                check.passed
                                  ? "border-primary/20 bg-primary/5 text-foreground/85"
                                  : "border-border/30 bg-surface-high/40 text-muted-foreground",
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-medium">{check.label}</p>
                                <span className="font-mono uppercase tracking-widest">
                                  {check.passed ? "Ready" : "Missing"}
                                </span>
                              </div>
                              <p className="mt-1 text-muted-foreground">{check.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      </div>
                    </div>
                  </div>
                </FormSection>

                <FormSection
                  title="Details"
                  description="Short selling points and key specifications. Keep it rich but still easy to maintain."
                  icon={<Sparkles className="h-4 w-4" />}
                >
                  <div className="space-y-5">
                    {form.sourceUrl ? (
                      <div className="rounded-md border border-border/30 bg-surface-high/40 px-4 py-3 text-sm">
                        <p className="label-tech mb-1 block">Source reference</p>
                        <a
                          href={form.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-primary hover:underline"
                        >
                          {form.sourceUrl}
                        </a>
                      </div>
                    ) : null}

                    <div className="admin-bezel">
                    <div className="admin-core p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="label-tech mb-1 block">Information audit</p>
                          <p className="text-xs text-muted-foreground">
                            Checks this draft for category/tagline conflicts, noisy imported lines, and hidden internal specs before it reaches the storefront.
                          </p>
                        </div>
                        <div
                          className={cn(
                            "shrink-0 border px-3 py-2 text-sm font-semibold",
                            auditIssueCount
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                              : "border-primary/30 bg-primary/10 text-primary",
                          )}
                        >
                          {auditIssueCount ? `${auditIssueCount} issue${auditIssueCount > 1 ? "s" : ""}` : "Clean"}
                        </div>
                      </div>

                      {auditIssueCount ? (
                        <div className="mt-3 space-y-2">
                          {taglineMismatch || missingTaglineSuggestion ? (
                            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium text-red-200">
                                    {taglineMismatch
                                      ? "Tagline does not match the selected category"
                                      : "Tagline is still missing"}
                                  </p>
                                  <p className="mt-1 text-xs text-red-100/80">
                                    {taglineMismatch ? (
                                      <>
                                        This category reads like {taglineMismatch.label.toLowerCase()}, but the current tagline says{" "}
                                        <span className="font-medium text-red-100">{form.taglineEn || "something else"}</span>.
                                        Suggested safe fix: {taglineMismatch.suggestion}
                                      </>
                                    ) : (
                                      <>
                                        This draft has no short selling line yet. Suggested safe starting point:{" "}
                                        {missingTaglineSuggestion?.suggestion}
                                      </>
                                    )}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={applyCategoryTaglineFix}
                                  className="admin-ghost inline-flex shrink-0 items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-red-100"
                                >
                                  Fix tagline
                                </button>
                              </div>
                            </div>
                          ) : null}

                          {noisyFeatureItems.length ? (
                            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium text-amber-100">Imported navigation lines found in features</p>
                                  <p className="mt-1 text-xs text-amber-100/80">
                                    These lines look like menu labels rather than product highlights:
                                    {" "}
                                    {noisyFeatureItems.join(" • ")}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={removeNoisyFeatureLines}
                                  className="admin-ghost inline-flex shrink-0 items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-amber-100"
                                >
                                  Clean features
                                </button>
                              </div>
                            </div>
                          ) : null}

                          {hiddenSpecRows.length ? (
                            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium text-amber-100">Internal spec rows are hidden from EDIO</p>
                                  <p className="mt-1 text-xs text-amber-100/80">
                                    {hiddenSpecRows.map((spec) => spec.labelEn || spec.labelAr).join(" • ")} will not be used. EDIO relies on the slug field instead of SKU.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={removeInternalSpecRows}
                                  className="admin-ghost inline-flex shrink-0 items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-amber-100"
                                >
                                  Remove hidden specs
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-muted-foreground">
                          No obvious information conflicts were detected in this draft.
                        </p>
                      )}
                    </div>
                    </div>

                    <TextAreaField
                      label="Features"
                      value={form.featuresText}
                      onChange={(value) => setForm((current) => ({ ...current, featuresText: value }))}
                      placeholder={"One feature per line"}
                      rows={5}
                    />
                    <p className="text-xs text-muted-foreground">
                      Lines such as <code>Cable x1</code>, <code>User Manual x1</code>, or <code>Storage Case x1</code> are
                      treated as box contents on the storefront, while the rest stays in the highlights section.
                    </p>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="label-tech mb-1 block">Specifications</p>
                          <p className="text-xs text-muted-foreground">
                            Add only the fields that matter on the product page. Arabic labels are optional, and internal IDs like SKU stay out of this form because EDIO uses the slug field instead.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              specs: [...current.specs, makeSpec()],
                            }))
                          }
                          className="admin-ghost inline-flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add spec
                        </button>
                      </div>

                      <div className="space-y-3">
                        {form.specs.map((spec, index) => (
                          <div key={spec.id} className="grid gap-3 rounded-md border border-border/30 bg-surface-lowest/40 p-4 xl:grid-cols-[1fr,1fr,1.2fr,auto]">
                            <Field
                              label={`Label (EN) ${index + 1}`}
                              value={spec.labelEn}
                              onChange={(value) =>
                                setForm((current) => ({
                                  ...current,
                                  specs: current.specs.map((item) =>
                                    item.id === spec.id ? { ...item, labelEn: value } : item,
                                  ),
                                }))
                              }
                            />
                            <Field
                              label="Label (AR)"
                              value={spec.labelAr}
                              onChange={(value) =>
                                setForm((current) => ({
                                  ...current,
                                  specs: current.specs.map((item) =>
                                    item.id === spec.id ? { ...item, labelAr: value } : item,
                                  ),
                                }))
                              }
                            />
                            <Field
                              label="Value"
                              value={spec.value}
                              onChange={(value) =>
                                setForm((current) => ({
                                  ...current,
                                  specs: current.specs.map((item) =>
                                    item.id === spec.id ? { ...item, value } : item,
                                  ),
                                }))
                              }
                            />
                            <div className="flex items-end">
                              <button
                                type="button"
                                onClick={() =>
                                  setForm((current) => ({
                                    ...current,
                                    specs: current.specs.length > 1
                                      ? current.specs.filter((item) => item.id !== spec.id)
                                      : [makeSpec()],
                                  }))
                                }
                                className="admin-ghost inline-flex h-[46px] items-center justify-center px-3 text-muted-foreground hover:text-red-400"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </FormSection>
              </div>

              <datalist id="admin-brand-options">
                {brands.map((item) => (
                  <option key={item.key} value={item.name} />
                ))}
              </datalist>
              <datalist id="admin-category-options">
                {categories.map((item) => (
                  <option key={item.slug} value={item.slug} />
                ))}
              </datalist>

              <div className="mt-8 flex items-center justify-end gap-3 border-t border-border/30 pt-5">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="admin-ghost px-4 py-2 text-sm text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="admin-cta group inline-flex items-center gap-3 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-widest disabled:opacity-60"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/16 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                  {submitting ? "Saving..." : form.id ? "Save product" : "Create product"}
                </button>
              </div>
            </form>
          </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

function resolveMediaUrl(value: string) {
  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith("/")) return `${API_BASE_URL}${value}`;
  return value;
}

function parseMultiline(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function looksLikeBoxItemText(value: string) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+\*\s+(\d+)$/g, " x$1")
    .replace(/^(\d+)\s*[x×]\s*/i, "x$1 ")
    .toLowerCase()
    .trim();

  if (!text) return false;

  return (
    /\b(user manual|owner'?s guide|manual|warranty card|service card|certificate|storage case|carrying pouch|pouch|adapter|eartips?|ear tips|earpads?|ear pads|plug|cable|cables|case|bag)\b/.test(text) ||
    /(^x\d+\s)|(\sx\d+$)/.test(text)
  );
}

function parseCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Unable to read image file"));
    reader.readAsDataURL(file);
  });
}

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="admin-field px-3 py-2.5 text-sm"
    >
      {children}
    </select>
  );
}

function ProductThumb({ src, alt }: { src: string; alt: string }) {
  const resolvedSrc = resolveMediaUrl(src);
  const [failed, setFailed] = useState(false);

  return (
    <div className="product-image-canvas flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/30">
      {resolvedSrc && !failed ? (
        <img
          src={resolvedSrc}
          alt={alt}
          className="h-full w-full object-contain p-1"
          onError={() => setFailed(true)}
        />
      ) : (
        <ImageIcon className="h-5 w-5 text-muted-foreground" />
      )}
    </div>
  );
}

function FormSection({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="admin-bezel">
      <div className="admin-core space-y-4 p-4 md:p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  className,
  listId,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  listId?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className={cn("block", className)}>
      <span className="label-tech mb-2 block">{label}</span>
      <input
        {...rest}
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="admin-field w-full px-4 py-3 text-sm"
      />
    </label>
  );
}

function NumericField({
  label,
  value,
  onChange,
  allowDecimal = false,
  className,
  helperText,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allowDecimal?: boolean;
  className?: string;
  helperText?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  return (
    <label className={cn("block", className)}>
      <span className="label-tech mb-2 block">{label}</span>
      <input
        {...rest}
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        dir="ltr"
        lang="en"
        value={value}
        onChange={(event) => onChange(sanitizeNumericInput(event.target.value, { allowDecimal }))}
        className="admin-field w-full px-4 py-3 text-sm font-mono tabular-nums"
      />
      {helperText ? <span className="mt-1.5 block text-[10px] text-muted-foreground">{helperText}</span> : null}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="label-tech mb-2 block">{label}</span>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="admin-field w-full resize-y px-4 py-3 text-sm"
      />
    </label>
  );
}

export default AdminProducts;
