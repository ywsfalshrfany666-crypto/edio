export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://127.0.0.1:8787";

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  token?: string | null;
  body?: unknown;
  searchParams?: Record<string, string | number | boolean | null | undefined>;
};

type Envelope<T> = {
  ok: boolean;
  data: T;
  error?: {
    code?: string;
    message?: string;
  };
};

export type Paginated<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  page: number;
  hasMore: boolean;
};

export type ApiUser = {
  id: string;
  email: string;
  emailVerified?: boolean;
  fullName: string;
  phone?: string;
  phoneE164?: string;
  avatarUrl?: string;
  role: "admin" | "customer" | "super_admin";
  status?: "active" | "unverified" | "disabled" | "deleted";
  locale?: string;
  currency?: "IQD" | "USD";
  banned?: boolean;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string | null;
};

export type ApiOrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled";

export type ApiOrder = {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: {
    line1: string;
    city: string;
    governorate: string;
    notes?: string;
  };
  items: Array<{
    productId: string;
    name: string;
    brand: string;
    image: string;
    price: number;
    qty: number;
  }>;
  subtotal: number;
  discount?: number;
  couponCode?: string | null;
  shipping: number;
  total: number;
  status: ApiOrderStatus;
  paymentMethod: "cod";
  createdAt: string;
  updatedAt: string;
  timeline?: Array<{ status: ApiOrderStatus; at: string; note?: string }>;
};

export type ApiProduct = {
  id: string;
  slug: string;
  sourceUrl?: string;
  name: { en: string; ar: string };
  brand: string;
  category: string;
  subCategories: string[];
  tagline: { en: string; ar: string };
  price: number;
  priceUsd?: number | null;
  compareAt: number | null;
  compareAtUsd?: number | null;
  officialPrice?: number | null;
  officialPriceUsd?: number | null;
  currency: "IQD";
  image: string;
  gallery: string[];
  storedBadge?: "new" | "featured" | "best" | "preowned" | null;
  badge: "new" | "featured" | "best" | "preowned" | null;
  features: string[];
  specs: Array<{ label: string | { en: string; ar: string }; value: string }>;
  inStock: boolean;
  stock: number;
  sales: number;
  isNewArrival?: boolean;
  availabilityStatus?: "in_stock" | "out_of_stock" | "pre_order" | "discontinued" | "hidden";
  status?: "published" | "draft" | "needs_review" | "hidden" | "archived";
  tags?: string[];
  needsReview?: boolean;
  confidenceScore?: number | null;
  categoryAssignment?: {
    productId: string;
    primaryCategorySlug: string;
    secondaryCategorySlugs: string[];
    dynamicCollectionSlugs: string[];
    confidenceScore: number;
    needsReview: boolean;
    classificationReason: string;
    evidence: Array<{
      source_type: "official" | "manual" | "structured_data" | "retailer" | "internal" | "community" | "model";
      source_url: string;
      facts: string[];
    }>;
    source: string;
    updatedAt: string;
  };
  normalizedImageUrl?: string;
  imageProcessing?: {
    background?: string;
    objectFit?: string;
    shadow?: boolean;
    gradient?: boolean;
  } | null;
  importState?: {
    status: "ready" | "imported" | "needs_review" | "failed" | "classification_locked" | string;
    lastJobId: string | null;
    error: { code?: string; message?: string } | null;
    reviewedAt: string | null;
  };
  importEvidence?: Array<{
    source_type: "official" | "manual" | "structured_data" | "retailer" | "internal" | "community" | "model";
    source_url: string;
    facts: string[];
  }>;
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
  };
  lastBulkActionAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiBrand = {
  name: string;
  slug: string;
  key: string;
  productCount: number;
  categories: string[];
  logo?: string;
};

export type ApiCategory = {
  slug: string;
  key: string;
  image: string;
  productCount: number;
  terms?: Array<{
    slug: string;
    productCount: number;
  }>;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(path, `${API_BASE_URL}/`);
  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    method: options.method || "GET",
    credentials: "include",
    headers: {
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const json = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || !json?.ok) {
    throw new ApiError(
      json?.error?.message || response.statusText || "Request failed",
      response.status,
      json?.error?.code,
    );
  }

  return json.data;
}
