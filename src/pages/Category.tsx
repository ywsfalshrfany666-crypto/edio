import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, Navigate, Link, useSearchParams } from "react-router-dom";
import { ArrowRight, SlidersHorizontal } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { ProductCard } from "@/components/shop/ProductCard";
import { categories as staticCategories } from "@/data/catalog";
import {
  countProductsForCategoryTerm,
  getCategoryPath,
  getDisplayCategoryTerms,
  getTermLabel,
  productMatchesCategoryTerm,
  resolveCategoryTerm,
} from "@/lib/categoryTaxonomy";
import { cn } from "@/lib/utils";
import { useRuntimeCatalog } from "@/lib/runtimeCatalog";

type SortKey = "featured" | "priceAsc" | "priceDesc" | "newest";

const Category = () => {
  const { slug, term } = useParams<{ slug: string; term?: string }>();
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as "en" | "ar";
  const { products, categories: runtimeCategories } = useRuntimeCatalog();
  const categories = runtimeCategories.length ? runtimeCategories : staticCategories;
  const cat = categories.find((c) => c.slug === slug);
  const legacyFilter = searchParams.get("f") || searchParams.get("term") || searchParams.get("subcategory");
  const rawTerm = term || legacyFilter || "";
  const activeTerm = cat ? resolveCategoryTerm(cat.slug, rawTerm) : null;
  const isTermPage = Boolean(rawTerm);
  const activeTermLabel = activeTerm ? getTermLabel(activeTerm, lang) : rawTerm ? humanizeTerm(rawTerm) : "";
  const displayTerms = useMemo(() => (cat ? getDisplayCategoryTerms(cat.slug) : []), [cat]);

  const [sort, setSort] = useState<SortKey>("featured");

  const obj = cat ? (t(`categoriesBlock.${cat.key}`, { returnObjects: true }) as { name: string; tag: string }) : { name: "", tag: "" };
  const items = cat ? products.filter((item) => productMatchesCategoryTerm(item, cat.slug, isTermPage ? rawTerm : null)) : [];
  const pageTitle = activeTermLabel || obj.name;
  const pageEyebrow = isTermPage ? obj.name : obj.tag;
  const pageDescription = isTermPage
    ? lang === "ar"
      ? `منتجات ${activeTermLabel || rawTerm} فقط داخل ${obj.name}.`
      : `${activeTermLabel || rawTerm} products only inside ${obj.name}.`
    : t("architecture.description");

  const termCounts = useMemo(
    () =>
      new Map(
        displayTerms.map((item) => [
          item.slug,
          countProductsForCategoryTerm(products, cat?.slug || "", item.slug),
        ]),
      ),
    [cat?.slug, displayTerms, products],
  );

  const sorted = useMemo(() => {
    const arr = [...items];
    if (sort === "priceAsc") arr.sort((a, b) => a.price - b.price);
    if (sort === "priceDesc") arr.sort((a, b) => b.price - a.price);
    if (sort === "newest") arr.sort((a, b) => (b.badge === "new" ? 1 : 0) - (a.badge === "new" ? 1 : 0));
    return arr;
  }, [items, sort]);

  if (!cat) return <Navigate to="/shop" replace />;

  const heroProduct = items[0];
  const totalLabel = `${items.length.toString().padStart(2, "0")} ${t("common.products")}`;

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: "featured", label: t("common.featured") },
    { key: "newest", label: t("common.new") },
    { key: "priceAsc", label: t("shop.sortOptions.priceAsc") },
    { key: "priceDesc", label: t("shop.sortOptions.priceDesc") },
  ];

  return (
    <Layout>
      {/* Creative Hero */}
      <section data-header-surface="mixed" className="section-luxury relative overflow-hidden bg-surface-lowest pb-14 pt-28 md:pt-32">
        {/* Backdrop image */}
        <div className="absolute inset-0">
          <img src={cat.image} alt="" className="w-full h-full object-cover opacity-20 scale-110 blur-2xl" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
        </div>

        {/* Floating signal grid */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
          aria-hidden
        />

        <div className="container-edio relative z-10">
          {/* Breadcrumb */}
          <nav className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-8 flex items-center gap-2">
            <Link to="/shop" className="hover:text-foreground smooth">{t("nav.shop")}</Link>
            <span className="opacity-40">/</span>
            {isTermPage ? (
              <>
                <Link to={`/category/${cat.slug}`} className="hover:text-foreground smooth">{obj.name}</Link>
                <span className="opacity-40">/</span>
                <span className="text-foreground/70">{pageTitle}</span>
              </>
            ) : (
              <span className="text-foreground/70">{obj.name}</span>
            )}
          </nav>

          <div className="grid lg:grid-cols-12 gap-10 items-end">
            {/* Title block */}
            <div className="lg:col-span-7" data-reveal>
              <div className="flex items-center gap-3 mb-5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary signal-dot" aria-hidden />
                <p className="label-tech text-primary">{pageEyebrow}</p>
              </div>
              <h1 className="font-display text-[44px] md:text-7xl lg:text-[88px] font-bold tracking-normal leading-[0.92] text-balance">
                {pageTitle}
              </h1>
              <p className="mt-6 text-base text-muted-foreground max-w-md leading-relaxed">
                {pageDescription}
              </p>

              {/* Meta strip */}
              <div className="mt-8 flex items-center gap-6 flex-wrap">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-semibold">{items.length.toString().padStart(2, "0")}</span>
                  <span className="label-tech">{t("common.products")}</span>
                </div>
                <span className="h-4 w-px bg-border" />
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-semibold">
                    {new Set(items.map((i) => i.brand)).size.toString().padStart(2, "0")}
                  </span>
                  <span className="label-tech">{t("common.brands")}</span>
                </div>
              </div>
            </div>

            {/* Floating product preview */}
            {heroProduct && (
              <Link
                to={`/product/${heroProduct.slug}`}
                className="premium-shell group relative block w-full max-w-sm lg:col-span-5 lg:ms-auto lg:w-[80%] lg:max-w-none"
                data-reveal="right"
              >
                <div className="relative aspect-square overflow-hidden rounded-[0.28rem] bg-surface-low">
                  <div className="absolute inset-0 bg-radial-glow opacity-50 transition-opacity duration-700 group-hover:opacity-80" aria-hidden />
                  <div className="product-image-canvas absolute inset-5 flex items-center justify-center overflow-hidden">
                    <img
                      src={heroProduct.image}
                      alt={heroProduct.name[lang]}
                      loading="eager"
                      className="h-full w-full object-contain p-3 transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    />
                  </div>
                  {/* Floating tag */}
                  <div className="absolute top-4 start-4 inline-flex items-center gap-2 bg-background/70 backdrop-blur px-3 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary signal-dot" />
                    <span className="label-tech text-foreground">{t("categoryPage.featured")}</span>
                  </div>
                  {/* Bottom card */}
                  <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 border border-border/35 bg-background/85 p-4 backdrop-blur">
                    <div className="min-w-0">
                      <p className="label-tech text-primary mb-1 truncate">{heroProduct.brand}</p>
                      <p className="font-display text-sm font-semibold truncate">{heroProduct.name[lang]}</p>
                    </div>
                    <span className="premium-icon h-9 w-9 shrink-0 bg-primary text-primary-foreground">
                      <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                    </span>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Toolbar */}
      <section data-header-surface="dark" className="bg-background pt-10">
        <div className="container-edio flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-baseline gap-3">
            <h2 className="font-display text-xl md:text-2xl font-bold tracking-tight">{pageTitle}</h2>
            <span className="label-tech">{totalLabel}</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto -mx-2 px-2">
            <span className="hidden md:inline-flex items-center gap-1.5 label-tech mr-2">
              <SlidersHorizontal className="h-3 w-3" />
              {t("common.sort")}
            </span>
            {sortOptions.map((o) => (
              <button
                key={o.key}
                onClick={() => setSort(o.key)}
                className={cn(
                  "premium-ghost min-h-11 shrink-0 px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest",
                  sort === o.key
                    ? "border-primary/55 bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          {displayTerms.length > 0 && (
            <div className="flex w-full items-center gap-2 overflow-x-auto pt-2">
              <Link
                to={`/category/${cat.slug}`}
                className={cn(
                  "premium-ghost min-h-10 shrink-0 px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest",
                  !isTermPage ? "border-primary/55 bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {lang === "ar" ? "الكل" : "All"}
                <span className="ms-2 text-foreground/55">{countProductsForCategoryTerm(products, cat.slug)}</span>
              </Link>
              {displayTerms.map((item) => {
                const active = activeTerm?.slug === item.slug;
                return (
                  <Link
                    key={item.slug}
                    to={getCategoryPath(cat.slug, item.slug)}
                    className={cn(
                      "premium-ghost min-h-10 shrink-0 px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest",
                      active ? "border-primary/55 bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {getTermLabel(item, lang)}
                    <span className="ms-2 text-foreground/55">{termCounts.get(item.slug) || 0}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Grid */}
      <section data-header-surface="mixed" className="py-10 md:py-14 bg-background">
        <div className="container-edio">
          {sorted.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          ) : (
            <div className="py-32 text-center">
              <p className="label-tech text-primary mb-3">{t("categoryPage.emptyEyebrow")}</p>
              <p className="font-display text-2xl font-bold">
                {isTermPage
                  ? lang === "ar"
                    ? `لا توجد منتجات في ${pageTitle}`
                    : `No products in ${pageTitle}`
                  : t("categoryPage.emptyTitle")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {isTermPage
                  ? lang === "ar"
                    ? "لم نعرض منتجات القسم الأب كبديل، حتى يبقى الفرع دقيقًا."
                    : "Parent category products are not shown as a fallback, so this child stays precise."
                  : t("categoryPage.emptyBody")}
              </p>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
};

function humanizeTerm(value: string) {
  return String(value || "")
    .replace(/[?&#].*$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

export default Category;
