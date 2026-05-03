import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams, Link } from "react-router-dom";
import { SlidersHorizontal, X, ArrowRight, Search, ChevronDown } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { ProductCard } from "@/components/shop/ProductCard";
import { SearchSuggestions } from "@/components/shop/SearchSuggestions";
import { brandList as staticBrandList, categories as staticCategories, formatPrice, type CategorySlug } from "@/data/catalog";
import { getBrandLogo } from "@/data/brandLogos";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatNumber } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/store/currency";
import { useRuntimeCatalog } from "@/lib/runtimeCatalog";

type SortKey = "featured" | "priceAsc" | "priceDesc" | "newest";

const hiddenBrandCardKeys = new Set(["audiotechnica", "crown", "hue"]);

const canonicalBrandCardKey = (brand: string) => {
  const key = brand.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (key === "7hertz") return "7hz";
  return key;
};

const Shop = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as "en" | "ar";
  const currency = useCurrency((s) => s.currency);
  const [params, setParams] = useSearchParams();
  const initialCat = params.get("cat") as CategorySlug | null;
  const initialBrand = params.get("brand");
  const productsRef = useRef<HTMLDivElement>(null);
  const { products, categories: runtimeCategories, brands: runtimeBrands } = useRuntimeCatalog();
  const categories = runtimeCategories.length ? runtimeCategories : staticCategories;
  const brandList = runtimeBrands.length ? runtimeBrands : staticBrandList;

  const initialFilter = params.get("filter");
  const [activeCats, setActiveCats] = useState<CategorySlug[]>(initialCat ? [initialCat] : []);
  const [activeBrands, setActiveBrands] = useState<string[]>(initialBrand ? [initialBrand] : []);
  const [maxCatalogPrice] = useState(() =>
    Math.max(2500, ...products.map((p) => p.price)),
  );
  const [priceMax, setPriceMax] = useState(maxCatalogPrice);
  const [sort, setSort] = useState<SortKey>("featured");
  const [query, setQuery] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  // Sync brand from URL when changed externally
  useEffect(() => {
    if (initialBrand && !activeBrands.includes(initialBrand)) {
      setActiveBrands([initialBrand]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBrand]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = products.filter(
      (p) =>
        (activeCats.length === 0 || activeCats.includes(p.category)) &&
        (activeBrands.length === 0 || activeBrands.includes(p.brand)) &&
        p.price <= priceMax &&
        (q === "" ||
          p.name.en.toLowerCase().includes(q) ||
          p.name.ar.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)) &&
        (initialFilter !== "preowned" || p.badge === "preowned"),
    );
    if (sort === "priceAsc") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "priceDesc") list = [...list].sort((a, b) => b.price - a.price);
    if (sort === "newest") list = [...list].sort((a, b) => (b.badge === "new" ? 1 : 0) - (a.badge === "new" ? 1 : 0));
    return list;
  }, [activeCats, activeBrands, priceMax, sort, query, initialFilter]);

  // Compute counts per brand / category from full catalog
  const brandCounts = useMemo(() => {
    const m = new Map<string, number>();
    products.forEach((p) => m.set(p.brand, (m.get(p.brand) || 0) + 1));
    return m;
  }, []);

  const visibleBrandList = useMemo(() => {
    const seen = new Set<string>();
    return brandList.filter((brand) => {
      const key = canonicalBrandCardKey(brand);
      if (hiddenBrandCardKeys.has(key)) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);

  const categoryCounts = useMemo(() => {
    const m = new Map<CategorySlug, number>();
    products.forEach((p) => m.set(p.category, (m.get(p.category) || 0) + 1));
    return m;
  }, []);

  const selectedBrand = activeBrands.length === 1 ? activeBrands[0] : null;
  const selectedBrandProducts = useMemo(
    () => (selectedBrand ? products.filter((p) => p.brand === selectedBrand) : []),
    [selectedBrand],
  );
  const selectedBrandLogo = selectedBrand ? getBrandLogo(selectedBrand) : undefined;
  const selectedBrandPriceRange = useMemo(() => {
    if (selectedBrandProducts.length === 0) return null;
    const prices = selectedBrandProducts.map((p) => p.price).filter((price) => price > 0);
    if (prices.length === 0) return null;
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [selectedBrandProducts]);
  const selectedBrandCategories = useMemo(
    () =>
      Array.from(new Set(selectedBrandProducts.map((p) => p.category)))
        .map((slug) => categories.find((c) => c.slug === slug))
        .filter((c): c is (typeof categories)[number] => Boolean(c)),
    [selectedBrandProducts],
  );

  const scrollToGrid = () => {
    setTimeout(() => productsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const handleSelectBrand = (b: string) => {
    setActiveBrands((s) => (s.includes(b) ? s.filter((x) => x !== b) : [...s, b]));
    setParams((p) => {
      const next = new URLSearchParams(p);
      next.set("brand", b);
      return next;
    });
    scrollToGrid();
  };

  const handleSelectCategory = (c: CategorySlug) => {
    setActiveCats((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
    setParams((p) => {
      const next = new URLSearchParams(p);
      next.set("cat", c);
      return next;
    });
    scrollToGrid();
  };

  const FilterPanel = () => (
    <div className="space-y-8">
      <FilterGroup title={t("shop.filters.category")}>
        {categories.map((c) => {
          const obj = t(`categoriesBlock.${c.key}`, { returnObjects: true }) as { name: string };
          const active = activeCats.includes(c.slug);
          const count = categoryCounts.get(c.slug) || 0;
          return (
            <Checkbox
              key={c.slug}
              label={obj.name}
              count={count}
              checked={active}
              onChange={() => handleSelectCategory(c.slug)}
            />
          );
        })}
      </FilterGroup>

      <FilterGroup title={t("shop.filters.brand")}>
        <div className="max-h-72 overflow-y-auto pr-1 space-y-2.5">
          {visibleBrandList.map((b) => {
            const active = activeBrands.includes(b);
            const count = brandCounts.get(b) || 0;
            return (
              <Checkbox
                key={b}
                label={b}
                count={count}
                checked={active}
                onChange={() => handleSelectBrand(b)}
              />
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup title={t("shop.filters.price")}>
        <input
          type="range"
          min={0}
          max={maxCatalogPrice}
          step={5000}
          value={priceMax}
          onChange={(e) => setPriceMax(+e.target.value)}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs font-mono mt-3">
          <span>0</span>
          <span className="text-primary">≤ {formatNumber(priceMax)} IQD</span>
        </div>
      </FilterGroup>

      <button
        onClick={() => {
          setActiveCats([]);
          setActiveBrands([]);
          setPriceMax(maxCatalogPrice);
          setQuery("");
          setParams({});
        }}
        className="inline-flex min-h-11 items-center text-[11px] font-mono uppercase tracking-widest text-primary hover:text-primary-glow smooth"
      >
        {t("common.clear")}
      </button>
    </div>
  );

  return (
    <Layout>
      {/* Hero */}
      <section data-header-surface="dark" className="section-luxury relative overflow-hidden bg-surface-lowest pb-16 pt-32 md:pb-20 md:pt-36">
        {/* Decorative background */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.09]" aria-hidden>
          <div className="absolute -top-24 -end-24 h-[480px] w-[480px] rounded-full bg-primary blur-3xl" />
          <div className="absolute bottom-0 start-1/3 h-[320px] w-[320px] rounded-full bg-primary-glow blur-3xl" />
        </div>
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          aria-hidden
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        <div className="container-edio relative">
          {/* Top meta row */}
          <div className="mb-10 flex items-center justify-between gap-4 border-b border-border/20 pb-6">
            <div className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-primary signal-dot" />
              <p className="label-tech text-primary">{t("nav.shop")}</p>
              <span className="hidden sm:inline label-tech text-muted-foreground">
                / {t("shop.byCategory")}
              </span>
            </div>
            <p className="label-tech text-muted-foreground hidden md:block">
              {new Date().getFullYear()} — Index
            </p>
          </div>

          {/* Headline grid */}
          <div className="grid gap-8 md:grid-cols-12 md:items-end">
            <div className="md:col-span-8">
              <h1 className="font-display text-5xl font-bold leading-[0.9] md:text-7xl lg:text-[5.5rem]">
                {t("shop.title")}
                <span className="inline-block ms-2 align-top text-primary">.</span>
              </h1>
              <p className="mt-6 max-w-md text-base leading-relaxed text-foreground/72">
                {t("shop.subtitle")}
              </p>
            </div>

            <div className="md:col-span-4 md:text-end">
              <div className="inline-flex md:flex md:flex-col items-baseline md:items-end gap-2">
                <span className="font-display text-5xl font-bold tabular-nums tracking-tight md:text-6xl">
                  {String(products.length).padStart(3, "0")}
                </span>
                <span className="label-tech text-muted-foreground">
                  {t("common.products")} · {t("shop.inStockLabel")}
                </span>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="group relative mt-12 max-w-2xl">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-all duration-300 group-focus-within:text-primary group-focus-within:scale-110" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSuggestionsOpen(true);
              }}
              onFocus={() => query.length > 0 && setSuggestionsOpen(true)}
              placeholder={t("shop.search", { defaultValue: "Search products, brands…" })}
              className="admin-field w-full py-4 ps-11 pe-16 text-sm text-foreground placeholder:text-muted-foreground/80 placeholder:transition-opacity placeholder:duration-300 focus:placeholder:opacity-50"
            />
            <span
              className={cn(
                "absolute bottom-0 start-0 h-px bg-primary transition-all duration-500 ease-out",
                query ? "w-full" : "w-0 group-focus-within:w-full",
              )}
            />
            <kbd className="absolute end-4 top-1/2 hidden -translate-y-1/2 items-center gap-1 border border-border/30 bg-surface-high px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground md:inline-flex">
              ⌘ K
            </kbd>

            <SearchSuggestions
              query={query}
              open={suggestionsOpen}
              onClose={() => setSuggestionsOpen(false)}
              onPickBrand={(b) => {
                handleSelectBrand(b);
                setQuery("");
              }}
            />
          </div>
        </div>
      </section>

      {selectedBrand && (
        <section data-header-surface="dark" className="bg-background py-8 md:py-12" data-reveal>
          <div className="container-edio">
            <div className="premium-shell">
            <div className="premium-core grid gap-6 overflow-hidden md:grid-cols-[1.1fr_0.9fr]">
              <div className="p-6 md:p-8 lg:p-10">
                <p className="label-tech text-primary mb-5">
                  {lang === "ar" ? "صفحة البراند" : "Brand Focus"}
                </p>
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                  <div className="flex h-24 w-full max-w-[260px] items-center justify-center px-6 sm:h-28 sm:w-72">
                    {selectedBrandLogo ? (
                      <img
                        src={selectedBrandLogo}
                        alt={selectedBrand}
                        className="max-h-16 max-w-full object-contain [filter:brightness(0)_invert(1)]"
                        loading="lazy"
                      />
                    ) : (
                      <span className="font-display text-2xl font-bold">{selectedBrand}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                      {selectedBrand}
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                      {lang === "ar"
                        ? `مجموعة ${selectedBrand} المتوفرة لدى EDIO، منتقاة حسب المنتجات الموجودة لدينا حتى تصل مباشرة إلى القطع المناسبة بدون تشتيت.`
                        : `${selectedBrand} products available at EDIO, curated from the pieces we currently carry so you can jump straight into the right gear.`}
                    </p>
                  </div>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <BrandMetric
                    label={lang === "ar" ? "المنتجات" : "Products"}
                    value={String(selectedBrandProducts.length).padStart(2, "0")}
                  />
                  <BrandMetric
                    label={lang === "ar" ? "الأقسام" : "Categories"}
                    value={String(selectedBrandCategories.length).padStart(2, "0")}
                  />
                  <BrandMetric
                    label={lang === "ar" ? "السعر" : "Price Range"}
                    value={
                      selectedBrandPriceRange
                        ? selectedBrandPriceRange.min === selectedBrandPriceRange.max
                          ? formatPrice(selectedBrandPriceRange.min, lang, currency)
                          : `${formatPrice(selectedBrandPriceRange.min, lang, currency)} – ${formatPrice(selectedBrandPriceRange.max, lang, currency)}`
                        : "—"
                    }
                  />
                </div>

                {selectedBrandCategories.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {selectedBrandCategories.map((cat) => {
                      const obj = t(`categoriesBlock.${cat.key}`, { returnObjects: true }) as { name: string };
                      return (
                        <Link
                          key={cat.slug}
                          to={`/category/${cat.slug}`}
                          className="premium-ghost inline-flex min-h-9 items-center px-3 text-[11px] font-mono uppercase tracking-widest text-muted-foreground"
                        >
                          {obj.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              <div
                className={cn(
                  "grid min-h-[260px] gap-px bg-border/20 md:min-h-full",
                  selectedBrandProducts.length === 1
                    ? "grid-cols-1"
                    : selectedBrandProducts.length === 2
                      ? "grid-cols-2"
                      : "grid-cols-3",
                )}
              >
                {selectedBrandProducts.slice(0, 3).map((product) => (
                  <Link
                    key={product.id}
                    to={`/product/${product.slug}`}
                    className="group relative flex min-h-[280px] items-center justify-center overflow-hidden bg-background/70"
                    aria-label={product.name[lang]}
                  >
                    <img
                      src={product.image}
                      alt={product.name[lang]}
                      className="h-full w-full object-contain opacity-80 transition-all duration-700 group-hover:scale-[1.03] group-hover:opacity-100"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                  </Link>
                ))}
              </div>
            </div>
            </div>
          </div>
        </section>
      )}

      {/* Products */}
      <section data-header-surface="mixed" className="bg-background py-10 md:py-14" ref={productsRef}>
        <div className="container-edio grid gap-10 lg:grid-cols-[280px_1fr]">
          {/* Desktop filters */}
          <aside className="hidden lg:block lg:sticky lg:top-20 self-start">
            <FilterPanel />
          </aside>

          <div>
            {/* Toolbar */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border/30 pb-5">
              <div className="flex items-center gap-3">
                <Sheet>
                  <SheetTrigger asChild>
                    <button className="premium-ghost inline-flex min-h-11 items-center gap-2 px-4 py-2.5 text-xs lg:hidden">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      {t("common.filter")}
                    </button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="bg-surface border-0 max-h-[85vh] overflow-y-auto">
                    <SheetTitle className="font-display text-2xl mb-6">{t("common.filter")}</SheetTitle>
                    <FilterPanel />
                  </SheetContent>
                </Sheet>
                <span className="font-mono text-xs text-muted-foreground">
                  {filtered.length} {t("shop.results")}
                </span>
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="admin-field min-h-11 px-4 py-2.5 text-xs"
              >
                <option value="featured">{t("shop.sortOptions.featured")}</option>
                <option value="priceAsc">{t("shop.sortOptions.priceAsc")}</option>
                <option value="priceDesc">{t("shop.sortOptions.priceDesc")}</option>
                <option value="newest">{t("shop.sortOptions.newest")}</option>
              </select>
            </div>

            {/* Active chips */}
            {(activeCats.length > 0 || activeBrands.length > 0 || query) && (
              <div className="flex flex-wrap gap-2 mb-6">
                {activeCats.map((c) => {
                  const cat = categories.find((x) => x.slug === c);
                  const label = cat
                    ? (t(`categoriesBlock.${cat.key}`, { returnObjects: true }) as { name: string }).name
                    : c;
                  return (
                    <Chip key={c} label={label} onRemove={() => setActiveCats((s) => s.filter((x) => x !== c))} />
                  );
                })}
                {activeBrands.map((b) => (
                  <Chip key={b} label={b} onRemove={() => setActiveBrands((s) => s.filter((x) => x !== b))} />
                ))}
                {query && <Chip label={`"${query}"`} onRemove={() => setQuery("")} />}
              </div>
            )}

            {filtered.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
            ) : (
              <div className="py-32 text-center">
                <p className="label-tech text-primary mb-3">No matches</p>
                <p className="font-display text-2xl font-bold mb-2">Nothing here yet.</p>
                <p className="text-sm text-muted-foreground">Try removing a filter or clearing your search.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Shop by Category */}
      <section data-header-surface="dark" className="section-luxury bg-background py-12 md:py-16" data-reveal>
        <div className="container-edio">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="label-tech text-primary mb-1">{t("shop.byCategory", { defaultValue: "Shop by Category" })}</p>
              <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">{t("shop.exploreCategories", { defaultValue: "Explore Categories" })}</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {categories.map((c) => {
              const obj = t(`categoriesBlock.${c.key}`, { returnObjects: true }) as { name: string };
              const count = categoryCounts.get(c.slug) || 0;
              return (
                <Link
                  key={c.slug}
                  to={`/category/${c.slug}`}
                  className="group premium-shell relative aspect-square min-h-[150px] overflow-hidden"
                >
                  <img
                    src={c.image}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-38 transition-all duration-700 group-hover:scale-105 group-hover:opacity-60"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />
                  <div className="absolute inset-0 p-4 flex flex-col justify-between">
                    <span className="label-tech bg-background/60 backdrop-blur self-start px-2 py-1">{count}</span>
                    <div>
                      <p className="font-display text-base font-semibold leading-tight">{obj.name}</p>
                      <span className="mt-1.5 inline-flex items-center gap-1 label-tech text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        Browse <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Shop by Brand */}
      <section data-header-surface="dark" className="section-luxury bg-surface-lowest py-12 md:py-16" data-reveal>
        <div className="container-edio">
          <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
            <div>
              <p className="label-tech text-primary mb-1">{t("shop.byBrand", { defaultValue: "Shop by Brand" })}</p>
              <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">{t("shop.allBrands", { defaultValue: "All Brands" })}</h2>
            </div>
            {activeBrands.length > 0 && (
              <button
                onClick={() => {
                  setActiveBrands([]);
                  setParams((p) => {
                    const next = new URLSearchParams(p);
                    next.delete("brand");
                    return next;
                  });
                }}
                className="premium-ghost inline-flex min-h-11 items-center px-4 text-[11px] font-mono uppercase tracking-widest text-muted-foreground"
              >
                {t("common.clear")}
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {visibleBrandList.map((b) => {
              const logo = getBrandLogo(b);
              const active = activeBrands.includes(b);
              return (
                <button
                  key={b}
                  onClick={() => handleSelectBrand(b)}
                  className={cn(
                    "group premium-shell relative flex min-h-16 items-center justify-center overflow-hidden sm:aspect-[3/2]",
                    active
                      ? "border-primary ring-1 ring-primary"
                      : "",
                  )}
                  title={b}
                >
                  {logo ? (
                    <img
                      src={logo}
                      alt={b}
                      className="max-h-8 max-w-[70%] object-contain opacity-70 group-hover:opacity-100 transition-opacity duration-300 [filter:brightness(0)_invert(1)]"
                      loading="lazy"
                    />
                  ) : (
                    <span className="font-display text-xs font-bold tracking-tight text-foreground/80 group-hover:text-foreground">
                      {b}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

    </Layout>
  );
};

function FilterGroup({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/20 pb-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-2 mb-4 group"
      >
        <h3 className="label-tech group-hover:text-primary smooth">{title}</h3>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground group-hover:text-primary smooth transition-transform duration-300",
            open ? "rotate-180" : "rotate-0",
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-2.5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function BrandMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="premium-core px-4 py-3">
      <p className="label-tech mb-1 text-muted-foreground">{label}</p>
      <p className="font-mono text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
  count,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  count?: number;
}) {
  return (
    <label className="group flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-sm px-1">
      <span className="flex items-center gap-3 min-w-0">
        <span
          className={cn(
            "relative inline-flex h-5 w-5 items-center justify-center smooth shrink-0",
            checked ? "bg-primary" : "bg-surface-high group-hover:bg-surface-highest",
          )}
        >
          {checked && <span className="h-1.5 w-1.5 bg-primary-foreground" />}
        </span>
        <span className="text-sm text-foreground/90 truncate">{label}</span>
      </span>
      {typeof count === "number" && (
        <span className="label-tech text-[10px] text-muted-foreground">{count}</span>
      )}
    </label>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="premium-ghost inline-flex min-h-10 items-center gap-1.5 px-3 py-1.5 text-xs font-mono">
      {label}
      <button onClick={onRemove} aria-label="Remove filter" className="inline-flex h-8 w-8 items-center justify-center hover:text-primary smooth">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export default Shop;
