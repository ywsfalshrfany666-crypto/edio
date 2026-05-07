import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Tag, Package, ArrowUpRight, CornerDownLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getBrandLogo } from "@/data/brandLogos";
import { formatNumber } from "@/lib/formatting";
import { createRoutePrefetchHandlers } from "@/lib/routePrefetch";
import { cn } from "@/lib/utils";
import { useRuntimeCatalog } from "@/lib/runtimeCatalog";
import { PRODUCT_IMAGE_CANVAS_CLASS } from "@/lib/productImage";
import { getSearchHint, matchesBrandSearch, matchesProductSearch, normalizeSearchText, scoreProductSearch } from "@/lib/search";

type Props = {
  query: string;
  open: boolean;
  onClose: () => void;
  onPickBrand: (brand: string) => void;
};

const MAX_PRODUCTS = 6;
const MAX_BRANDS = 4;

export const SearchSuggestions = ({ query, open, onClose, onPickBrand }: Props) => {
  const { i18n } = useTranslation();
  const lang = i18n.language as "en" | "ar";
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { products, brands: brandList } = useRuntimeCatalog();

  const q = normalizeSearchText(query);

  const { matchedProducts, matchedBrands } = useMemo(() => {
    if (q.length < 1) return { matchedProducts: [], matchedBrands: [] };
    const matchedBrands = brandList
      .filter((b) => matchesBrandSearch(b, q))
      .slice(0, MAX_BRANDS);
    const matchedProducts = products
      .filter((p) => matchesProductSearch(p, q))
      .sort((a, b) => scoreProductSearch(b, q) - scoreProductSearch(a, q))
      .slice(0, MAX_PRODUCTS);
    return { matchedProducts, matchedBrands };
  }, [brandList, products, q]);

  const flatItems = useMemo(
    () => [
      ...matchedBrands.map((b) => ({ type: "brand" as const, value: b })),
      ...matchedProducts.map((p) => ({ type: "product" as const, value: p })),
    ],
    [matchedBrands, matchedProducts],
  );

  // Reset highlight when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [q]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter") {
        const item = flatItems[activeIndex];
        if (!item) return;
        e.preventDefault();
        if (item.type === "brand") {
          onPickBrand(item.value);
          onClose();
        } else {
          window.location.href = `/product/${item.value.slug}`;
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, flatItems, activeIndex, onClose, onPickBrand]);

  if (!open || q.length < 1) return null;

  const empty = matchedProducts.length === 0 && matchedBrands.length === 0;

  return (
    <div
      ref={containerRef}
      className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 origin-top animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="bg-background border border-border shadow-2xl shadow-black/60 overflow-hidden rounded-sm">
        {empty ? (
          <div className="p-8 text-center">
            <p className="label-tech text-muted-foreground mb-1">No matches</p>
            <p className="text-sm text-foreground/80">
              Nothing for <span className="font-mono text-primary">"{query}"</span>
            </p>
            <p className="mt-3 text-xs text-muted-foreground">{getSearchHint(lang)}</p>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            {matchedBrands.length > 0 && (
              <div className="border-b border-border/30">
                <div className="px-4 pt-3 pb-2">
                  <p className="label-tech text-muted-foreground flex items-center gap-2">
                    <Tag className="h-3 w-3" /> Brands
                  </p>
                </div>
                <ul>
                  {matchedBrands.map((b, i) => {
                    const idx = i;
                    const active = activeIndex === idx;
                    const logo = getBrandLogo(b);
                    return (
                      <li key={b}>
                        <button
                          type="button"
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => {
                            onPickBrand(b);
                            onClose();
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2.5 text-start smooth",
                            active ? "bg-surface-high" : "hover:bg-surface-high",
                          )}
                        >
                          <span className="h-8 w-12 flex items-center justify-center">
                            {logo ? (
                              <img
                                src={logo}
                                alt=""
                                className="max-h-5 max-w-[80%] object-contain opacity-80 [filter:brightness(0)_invert(1)]"
                              />
                            ) : (
                              <span className="font-display text-[10px] font-bold">{b.slice(0, 3)}</span>
                            )}
                          </span>
                          <span className="text-sm font-medium flex-1">{b}</span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {matchedProducts.length > 0 && (
              <div>
                <div className="px-4 pt-3 pb-2">
                  <p className="label-tech text-muted-foreground flex items-center gap-2">
                    <Package className="h-3 w-3" /> Products
                  </p>
                </div>
                <ul>
                  {matchedProducts.map((p, i) => {
                    const idx = matchedBrands.length + i;
                    const active = activeIndex === idx;
                    return (
                      <li key={p.id}>
                        <Link
                          to={`/product/${p.slug}`}
                          {...createRoutePrefetchHandlers(`/product/${p.slug}`)}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={onClose}
                          className={cn(
                            "flex items-center gap-3 px-4 py-2.5 smooth",
                            active ? "bg-surface-high" : "hover:bg-surface-high",
                          )}
                        >
                          <span className={cn(PRODUCT_IMAGE_CANVAS_CLASS, "h-10 w-10 shrink-0 overflow-hidden")}>
                            <img
                              src={p.image}
                              alt=""
                              className="h-full w-full object-contain p-1"
                              width={80}
                              height={80}
                              loading="lazy"
                              decoding="async"
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium truncate">
                              {p.name[lang] || p.name.en}
                            </span>
                            <span className="block label-tech text-muted-foreground truncate">
                              {p.brand} · {formatNumber(p.price, lang)} IQD
                            </span>
                          </span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {!empty && (
          <div className="hidden md:flex items-center justify-between gap-4 px-4 py-2 border-t border-border/30 bg-background/40">
            <div className="flex items-center gap-3 label-tech text-muted-foreground text-[10px]">
              <span className="inline-flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-surface-high border border-border/30 font-mono">↑↓</kbd> navigate
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-surface-high border border-border/30 font-mono">
                  <CornerDownLeft className="h-2.5 w-2.5" />
                </kbd>
                select
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-surface-high border border-border/30 font-mono">esc</kbd> close
              </span>
            </div>
            <span className="label-tech text-primary text-[10px]">
              {matchedProducts.length + matchedBrands.length} results
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
