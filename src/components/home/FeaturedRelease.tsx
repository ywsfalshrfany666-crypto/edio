import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { Product } from "@/data/catalog";
import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/formatPrice";
import { getHomeFeaturedProduct } from "@/lib/homeCatalog";
import { useCurrency } from "@/store/currency";
import { PRODUCT_IMAGE_CANVAS_CLASS } from "@/lib/productImage";
import { cn } from "@/lib/utils";

export function FeaturedRelease() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as "en" | "ar";
  const currency = useCurrency((s) => s.currency);
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getHomeFeaturedProduct().then((nextProduct) => {
      if (!cancelled) {
        setProduct(nextProduct);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!product) {
    return (
      <section data-header-surface="dark" className="section-luxury bg-surface-lowest py-20 md:py-28">
        <div className="container-edio grid gap-8 xl:gap-16 xl:grid-cols-12 items-start">
        <div className="relative order-1 xl:col-span-7">
          <div className="product-stage mx-auto aspect-square w-full max-w-[760px] animate-pulse" />
          </div>
          <div className="order-2 w-full min-w-0 xl:col-span-5">
            <div className="h-3 w-28 rounded-full bg-surface-highest/70" />
            <div className="mt-4 h-10 w-full max-w-xl rounded-sm bg-surface-high/85" />
            <div className="mt-5 h-4 w-full max-w-md rounded-full bg-surface-highest/60" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section data-header-surface="dark" className="section-luxury bg-surface-lowest py-20 md:py-28">
      <div className="container-edio grid gap-8 xl:gap-16 xl:grid-cols-12 items-start">
        {/* Image */}
        <div className="relative order-1 xl:col-span-7">
          <div className="premium-shell mx-auto w-full max-w-[760px]">
          <div className="product-stage group relative flex aspect-square items-center justify-center overflow-hidden rounded-[0.28rem]">
            <div className="absolute inset-0 bg-radial-glow opacity-50 transition-opacity duration-700 group-hover:opacity-70" aria-hidden />
            <div className={cn(PRODUCT_IMAGE_CANVAS_CLASS, "absolute inset-5 flex items-center justify-center overflow-hidden md:inset-7")}>
              <img
                src={product.image}
                alt={product.name[lang]}
                className="h-full w-full object-contain p-4 transition-transform duration-700 ease-out group-hover:scale-[1.02] md:p-6"
                loading="lazy"
              />
            </div>
            <div className="absolute bottom-4 start-4 inline-flex items-center gap-2 bg-background/70 backdrop-blur px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary signal-dot" aria-hidden />
              <span className="label-tech text-foreground">{product.brand}</span>
            </div>
          </div>
          </div>
        </div>

        {/* Content */}
        <div className="order-2 w-full min-w-0 xl:col-span-5">
          <p className="label-tech text-primary mb-4">{t("featured.eyebrow")}</p>
          <h2 className="font-display max-w-xl text-3xl font-bold leading-[1.05] tracking-normal text-balance md:text-4xl lg:text-5xl">
            {t("featured.title")}
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-foreground/72 md:text-[15px]">
            {t("featured.description")}
          </p>

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 max-w-md border-t border-border/30 pt-6">
            {product.specs.slice(0, 4).map((s, i) => (
              <div key={i} className="min-w-0">
                <dt className="label-tech mb-1 truncate">{s.label[lang]}</dt>
                <dd className="font-mono text-sm text-foreground/90 truncate">{s.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex flex-col gap-4 border-t border-border/30 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-lg">{formatPrice(product.price, lang, currency)}</p>
            </div>
            <Link
              to={`/product/${product.slug}`}
              className="premium-cta group inline-flex min-h-12 items-center justify-center gap-3 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-widest"
            >
              {t("cta.discover")}
              <span className="premium-icon h-8 w-8">
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
