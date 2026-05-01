import { useEffect, useMemo, useState } from "react";
import {
  API_BASE_URL,
  apiRequest,
  type ApiCategory,
  type ApiProduct,
} from "@/lib/api";
import {
  brandList as fallbackBrands,
  categories as fallbackCategories,
  products as fallbackProducts,
  type Product,
} from "@/data/catalog";
import { normalizeProductCategory } from "@/lib/productCategories";

export type RuntimeProduct = Product & {
  sourceUrl?: string;
  priceUsd?: number | null;
  compareAtUsd?: number | null;
  officialPrice?: number | null;
  officialPriceUsd?: number | null;
  storedBadge?: "new" | "featured" | "best" | "preowned" | null;
  stock: number;
  sales: number;
  isNewArrival?: boolean;
  createdAt: string;
  updatedAt: string;
};

type CatalogResponse = {
  products: ApiProduct[];
  categories: ApiCategory[];
  brands: Array<{ name: string }>;
};

type RuntimeCatalogState = {
  products: RuntimeProduct[];
  categories: ApiCategory[];
  brands: string[];
};

let catalogCache: RuntimeCatalogState | null = null;
let catalogPromise: Promise<RuntimeCatalogState> | null = null;

function resolveProductMediaUrl(path: string) {
  const value = String(path || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/media/imports/")) return `${API_BASE_URL}${value}`;
  return value;
}

function mapApiProductToRuntime(product: ApiProduct): RuntimeProduct {
  const normalizedCategory = normalizeProductCategory(product);
  const assignmentTerms = product.categoryAssignment?.secondaryCategorySlugs || [];
  const subCategories = Array.from(new Set([...(product.subCategories || []), ...assignmentTerms].filter(Boolean)));

  return {
    ...product,
    category: normalizedCategory,
    subCategories,
    compareAt: product.officialPrice ?? product.compareAt ?? null,
    priceUsd: product.priceUsd ?? null,
    compareAtUsd: product.officialPriceUsd ?? product.compareAtUsd ?? null,
    officialPrice: product.officialPrice ?? product.compareAt ?? null,
    officialPriceUsd: product.officialPriceUsd ?? product.compareAtUsd ?? null,
    image: resolveProductMediaUrl(product.image),
    gallery: (product.gallery || []).map(resolveProductMediaUrl),
    specs: (product.specs || []).map((spec) => ({
      label: typeof spec.label === "string" ? spec.label : spec.label,
      value: spec.value,
    })),
  } as RuntimeProduct;
}

function buildFallbackCatalog(): RuntimeCatalogState {
  return {
    products: fallbackProducts.map((product) => ({
      ...product,
      category: normalizeProductCategory(product),
      sourceUrl: "",
      priceUsd: product.price ? Number((product.price / 1300).toFixed(2)) : null,
      compareAtUsd: product.compareAt ? Number((product.compareAt / 1300).toFixed(2)) : null,
      officialPrice: product.compareAt ?? null,
      officialPriceUsd: product.compareAt ? Number((product.compareAt / 1300).toFixed(2)) : null,
      storedBadge: product.badge ?? null,
      stock: product.inStock ? 8 : 0,
      sales: 0,
      isNewArrival: product.badge === "new",
      createdAt: "",
      updatedAt: "",
    })),
    categories: fallbackCategories.map((category) => ({ ...category, productCount: 0 })),
    brands: fallbackBrands,
  };
}

export async function fetchRuntimeCatalog(force = false): Promise<RuntimeCatalogState> {
  if (!force && catalogCache) return catalogCache;
  if (!force && catalogPromise) return catalogPromise;

  catalogPromise = apiRequest<CatalogResponse>("/api/catalog")
    .then((data) => {
      const nextState = {
        products: (data.products || []).map(mapApiProductToRuntime),
        categories: data.categories?.length ? data.categories : buildFallbackCatalog().categories,
        brands: data.brands?.length ? data.brands.map((brand) => brand.name) : fallbackBrands,
      };
      catalogCache = nextState;
      return nextState;
    })
    .catch(() => {
      const fallback = buildFallbackCatalog();
      catalogCache = fallback;
      return fallback;
    })
    .finally(() => {
      catalogPromise = null;
    });

  return catalogPromise;
}

export function invalidateRuntimeCatalog() {
  catalogCache = null;
  catalogPromise = null;
}

export function useRuntimeCatalog() {
  const fallback = useMemo(() => buildFallbackCatalog(), []);
  const [state, setState] = useState<RuntimeCatalogState>(catalogCache || fallback);
  const [loading, setLoading] = useState(!catalogCache);

  useEffect(() => {
    let cancelled = false;
    setLoading(!catalogCache);
    void fetchRuntimeCatalog().then((nextState) => {
      if (cancelled) return;
      setState(nextState);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...state, loading };
}

export function useRuntimeProduct(slug?: string) {
  const { products, loading } = useRuntimeCatalog();
  return {
    loading,
    product: slug ? products.find((item) => item.slug === slug || item.id === slug) || null : null,
    products,
  };
}

export async function getHomeNewArrivals(limit = 12): Promise<RuntimeProduct[]> {
  const { products } = await fetchRuntimeCatalog();
  return [...products]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, limit);
}

export async function getHomeBestSellers(limit = 12): Promise<RuntimeProduct[]> {
  const { products } = await fetchRuntimeCatalog();
  return [...products]
    .sort((a, b) => Number(b.sales || 0) - Number(a.sales || 0))
    .slice(0, limit);
}

export async function getHomeFeaturedProduct(): Promise<RuntimeProduct | null> {
  const { products } = await fetchRuntimeCatalog();
  return [...products].sort((a, b) => (b.officialPrice || b.price) - (a.officialPrice || a.price))[0] ?? null;
}
