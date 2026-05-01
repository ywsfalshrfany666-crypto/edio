import { useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, Minus, Plus } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { ProductCard } from "@/components/shop/ProductCard";
import { ProductGallery } from "@/components/shop/ProductGallery";
import { formatPrice } from "@/data/catalog";
import { useCart } from "@/store/cart";
import { useCurrency } from "@/store/currency";
import { toast } from "sonner";
import { useRuntimeProduct } from "@/lib/runtimeCatalog";
import { getCategoryTranslationKey } from "@/lib/productCategories";
import {
  getCompatibleAccessories,
  getConciseDescription,
  getOrderedSpecs,
  getProductHighlights,
  getSimilarProducts,
  getUsefulFaq,
} from "@/lib/productPresentation";

const FREE_SHIPPING_THRESHOLD = 150000;
const SHIPPING_FEE = 5000;

const ProductDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as "en" | "ar";
  const currency = useCurrency((s) => s.currency);
  const { product, products, loading } = useRuntimeProduct(slug);
  const add = useCart((s) => s.add);
  const open = useCart((s) => s.open);
  const [qty, setQty] = useState(1);

  if (!loading && !product) return <Navigate to="/shop" replace />;
  if (!product) {
    return (
      <Layout>
        <section data-header-surface="dark" className="bg-background pb-20 pt-28">
          <div className="container-edio">
            <div className="h-[70vh] animate-pulse rounded-lg border border-border/20 bg-surface-high/40" />
          </div>
        </section>
      </Layout>
    );
  }

  const galleryImages = uniqueTextList([product.image, ...(product.gallery || [])]);
  const compareAt = typeof product.compareAt === "number" && product.compareAt > product.price ? product.compareAt : null;
  const savings = compareAt ? compareAt - product.price : 0;
  const description = getConciseDescription(product, lang);
  const highlights = getProductHighlights(product, lang, 5);
  const specs = getOrderedSpecs(product, lang, 16);
  const accessories = getCompatibleAccessories(product, products, 4);
  const related = getSimilarProducts(product, products, 4);
  const faq = getUsefulFaq(product, lang);
  const productCategoryKey = getCategoryTranslationKey(product.category);
  const productCategoryLabel = productCategoryKey
    ? (t(`categoriesBlock.${productCategoryKey}`, { returnObjects: true }) as { name?: string }).name || product.category
    : lang === "ar"
      ? "مراجعة التصنيف"
      : "Needs review";
  const stockCount = Number(product.stock || 0);
  const stockLine = product.inStock
    ? stockCount > 0
      ? lang === "ar"
        ? `${stockCount} متوفر الآن`
        : `${stockCount} available now`
      : t("common.inStock")
    : t("common.outOfStock");
  const shippingLine =
    product.price >= FREE_SHIPPING_THRESHOLD
      ? lang === "ar"
        ? "شحن مجاني لهذا المنتج"
        : "Free shipping on this item"
      : lang === "ar"
        ? `${formatPrice(SHIPPING_FEE, lang, currency)} شحن، ومجاني فوق ${formatPrice(FREE_SHIPPING_THRESHOLD, lang, currency)}`
        : `${formatPrice(SHIPPING_FEE, lang, currency)} shipping, free over ${formatPrice(FREE_SHIPPING_THRESHOLD, lang, currency)}`;
  const badgeLabel = product.badge
    ? product.badge === "new"
      ? t("common.new")
      : product.badge === "featured"
        ? t("common.featured")
        : product.badge === "preowned"
          ? t("common.preOwned")
          : t("common.bestSeller")
    : null;

  const handleAdd = () => {
    add(product.id, qty);
    toast.success(t("pdp.addedToCart"), { description: product.name[lang] });
  };

  const handleBuyNow = () => {
    add(product.id, qty);
    open();
  };

  return (
    <Layout>
      <section data-header-surface="mixed" className="bg-background pb-20 pt-28 md:pt-32">
        <div className="container-edio">
          <nav className="mb-8 flex flex-wrap items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            <Link to="/shop" className="transition-colors hover:text-foreground">{t("nav.shop")}</Link>
            <span className="opacity-35">/</span>
            <Link to={`/category/${product.category}`} className="transition-colors hover:text-foreground">
              {productCategoryLabel}
            </Link>
            <span className="opacity-35">/</span>
            <span className="max-w-[220px] truncate text-foreground/70">{product.name[lang]}</span>
          </nav>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start" data-reveal="fade">
              <ProductGallery images={galleryImages} alt={product.name[lang]} badge={badgeLabel} discount={0} />
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start" data-reveal>
              <div className="border-b border-border/30 pb-6">
                <p className="mb-3 text-[11px] font-mono uppercase tracking-[0.18em] text-primary">{product.brand}</p>
                <h1 className="font-display text-3xl font-semibold leading-[1.04] text-balance md:text-4xl lg:text-5xl">
                  {product.name[lang]}
                </h1>
              </div>

              <div className="border-b border-border/30 py-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <span className="block font-mono text-3xl font-semibold tabular-nums md:text-[2.15rem]">
                      {formatPrice(product.price, lang, currency)}
                    </span>
                    {compareAt ? (
                      <span className="mt-2 block font-mono text-sm text-muted-foreground line-through tabular-nums">
                        {formatPrice(compareAt, lang, currency)}
                      </span>
                    ) : null}
                  </div>
                  {savings > 0 ? (
                    <span className="edio-product-badge edio-product-badge--sale">
                      {lang === "ar" ? "توفير" : "Save"} {formatPrice(savings, lang, currency)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-foreground/78">
                  <span className={product.inStock ? "edio-stock edio-stock--in" : "edio-stock edio-stock--out"}>
                    <span aria-hidden />
                    {stockLine}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/40" aria-hidden />
                  <span>{shippingLine}</span>
                </div>
              </div>

              {highlights.length > 0 ? (
                <div className="border-b border-border/30 py-6">
                  <p className="mb-4 text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                    {lang === "ar" ? "الأهم أولاً" : "What matters first"}
                  </p>
                  <ul className="space-y-3">
                    {highlights.slice(0, 5).map((item) => (
                      <li key={item} className="flex gap-3 text-sm leading-relaxed text-foreground/84">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.8} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="pt-6">
                <div className="flex items-stretch gap-2">
                  <div className="inline-flex min-h-12 items-center rounded-md border border-border/45 bg-surface-high">
                    <button
                      onClick={() => setQty(Math.max(1, qty - 1))}
                      className="touch-target inline-flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-10 text-center font-mono text-sm tabular-nums">{qty}</span>
                    <button
                      onClick={() => setQty(qty + 1)}
                      className="touch-target inline-flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={handleAdd}
                    className="premium-ghost flex-1 !rounded-md px-4 text-[11px] font-semibold uppercase tracking-widest text-foreground"
                  >
                    {t("cta.addToCart")}
                  </button>
                </div>
                <button
                  onClick={handleBuyNow}
                  className="premium-cta mt-3 inline-flex min-h-12 w-full items-center justify-center gap-3 !rounded-md py-2.5 text-[11px] font-semibold uppercase tracking-widest"
                >
                  {t("cta.buyNow")}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </button>
              </div>
            </aside>
          </div>

          <section className="mt-20 grid gap-10 border-t border-border/30 pt-14 lg:grid-cols-[0.36fr_0.64fr] lg:gap-16" data-reveal>
            <SectionIntro
              eyebrow={t("pdp.specs")}
              title={lang === "ar" ? "مواصفات مرتبة بدون ازدحام." : "Specs, ordered by what matters."}
              copy={lang === "ar" ? "نبدأ بالمعلومات التي تغيّر قرار الشراء حسب نوع المنتج، ثم نكمل بقية المواصفات." : "The table starts with the facts that affect the buying decision, then keeps the rest easy to scan."}
            />
            <div className="overflow-hidden rounded-lg border border-border/35 bg-surface-lowest/70">
              {specs.length > 0 ? (
                <table className="w-full border-collapse">
                  <tbody>
                    {specs.map((spec, index) => (
                      <tr key={`${specLabel(spec.label, lang)}-${index}`} className="border-b border-border/25 last:border-b-0">
                        <th className="w-[42%] px-4 py-4 text-start text-[11px] font-mono font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          {specLabel(spec.label, lang)}
                        </th>
                        <td className="px-4 py-4 text-end text-sm text-foreground/88">{spec.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="p-6 text-sm text-muted-foreground">
                  {lang === "ar" ? "لا توجد مواصفات مؤكدة لهذا المنتج بعد." : "No confirmed technical specs are available yet."}
                </p>
              )}
            </div>
          </section>

          <section className="mt-20 grid gap-10 border-t border-border/30 pt-14 lg:grid-cols-[0.36fr_0.64fr] lg:gap-16" data-reveal>
            <SectionIntro
              eyebrow={lang === "ar" ? "الوصف" : "Description"}
              title={lang === "ar" ? "شرح مختصر وواضح." : "A concise read before checkout."}
              copy={lang === "ar" ? "لا نكرر المواصفات هنا؛ هذا القسم يوضح فائدة المنتج ومتى يكون مناسباً." : "This avoids repeating the spec table and keeps the product story short."}
            />
            <div className="max-w-3xl text-lg leading-[1.8] text-foreground/75">
              <p>{description}</p>
            </div>
          </section>

          {accessories.length > 0 ? (
            <ProductRail
              eyebrow={lang === "ar" ? "إكسسوارات متوافقة" : "Compatible accessories"}
              title={lang === "ar" ? "إضافات مفيدة لنفس طريقة الاستخدام." : "Useful add-ons for this setup."}
              products={accessories}
            />
          ) : null}

          {related.length > 0 ? (
            <ProductRail
              eyebrow={t("pdp.related")}
              title={lang === "ar" ? "منتجات قريبة من نفس العائلة." : "Similar products from the same lane."}
              products={related}
              action={{ to: `/category/${product.category}`, label: t("cta.viewCollection") }}
            />
          ) : null}

          {faq.length > 0 ? (
            <section className="mt-20 border-t border-border/30 pt-14" data-reveal>
              <div className="grid gap-8 lg:grid-cols-[0.36fr_0.64fr]">
                <SectionIntro
                  eyebrow="FAQ"
                  title={lang === "ar" ? "أسئلة سريعة." : "Quick checks."}
                  copy={lang === "ar" ? "نعرضها فقط عندما تضيف وضوحاً فعلياً للشراء." : "Shown only when it removes real buying friction."}
                />
                <div className="divide-y divide-border/30 rounded-lg border border-border/35 bg-surface-lowest/60">
                  {faq.map((item) => (
                    <div key={item.q} className="p-5">
                      <h3 className="font-display text-lg font-semibold">{item.q}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-foreground/70">{item.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </Layout>
  );
};

function ProductRail({
  eyebrow,
  title,
  products,
  action,
}: {
  eyebrow: string;
  title: string;
  products: Parameters<typeof ProductCard>[0]["product"][];
  action?: { to: string; label: string };
}) {
  return (
    <section className="mt-20 border-t border-border/30 pt-14" data-reveal>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-mono uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
        </div>
        {action ? (
          <Link
            to={action.to}
            className="premium-ghost hidden items-center gap-2 !rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary md:inline-flex"
          >
            {action.label}
            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </Link>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((item, index) => (
          <ProductCard key={item.id} product={item} index={index} />
        ))}
      </div>
    </section>
  );
}

function SectionIntro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div>
      <p className="mb-3 text-[11px] font-mono uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h2 className="font-display text-2xl font-semibold leading-tight tracking-tight md:text-3xl">{title}</h2>
      <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">{copy}</p>
    </div>
  );
}

function specLabel(label: string | { en?: string; ar?: string }, lang: "en" | "ar") {
  if (typeof label === "string") return label;
  return label[lang] || label.en || label.ar || "";
}

function uniqueTextList(values: string[]) {
  return Array.from(new Set((values || []).map((item) => String(item || "").trim()).filter(Boolean)));
}

export default ProductDetail;
