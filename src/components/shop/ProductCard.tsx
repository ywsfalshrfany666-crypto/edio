import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Product } from "@/data/catalog";
import type { RuntimeProduct } from "@/lib/runtimeCatalog";
import { createRoutePrefetchHandlers } from "@/lib/routePrefetch";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/formatPrice";
import { useCurrency } from "@/store/currency";
import { PRODUCT_IMAGE_CANVAS_CLASS } from "@/lib/productImage";

type Variant = "default" | "wide";
type CardProduct = Product | RuntimeProduct;

export function ProductCard({ product, variant = "default", index = 0 }: { product: CardProduct; variant?: Variant; index?: number }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as "en" | "ar";
  const currency = useCurrency((s) => s.currency);

  const hasCompareAt = typeof product.compareAt === "number" && product.compareAt > product.price;
  const discount = hasCompareAt
    ? Math.round(((product.compareAt - product.price) / product.compareAt) * 100)
    : 0;
  const badges = [
    ...(discount > 0 ? [{ label: `-${discount}%`, tone: "sale" as const }] : []),
    ...(product.badge === "new" ? [{ label: t("common.new"), tone: "state" as const }] : []),
    ...(product.badge === "preowned" ? [{ label: t("common.preOwned"), tone: "state" as const }] : []),
  ];
  const productHref = `/product/${product.slug}`;

  return (
    <article data-reveal data-reveal-delay={index * 80} className="group edio-product-card h-full w-full hover-lift">
      <div
        className={cn(
          "relative flex h-full w-full flex-col overflow-hidden",
          variant === "wide" ? "p-3 md:p-4" : "p-3",
        )}
      >
        <Link to={productHref} {...createRoutePrefetchHandlers(productHref)} className="block shrink-0">
          <div className={cn("edio-product-card__stage relative overflow-hidden", variant === "wide" ? "aspect-[16/10]" : "aspect-square")}>
            {badges.length > 0 && (
              <div className="absolute top-3 start-3 z-10 flex flex-wrap gap-1.5">
                {badges.map((badge) => (
                  <span
                    key={`${badge.tone}-${badge.label}`}
                    className={cn("edio-product-badge", badge.tone === "sale" && "edio-product-badge--sale")}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
            )}
            <div className={cn(PRODUCT_IMAGE_CANVAS_CLASS, "absolute inset-0 flex items-center justify-center overflow-hidden")}>
              <img
                src={product.image}
                alt={product.name[lang]}
                loading="lazy"
                className="h-full w-full object-contain p-0.5 transition-transform duration-700 ease-out group-hover:scale-[1.04] md:p-1.5"
              />
            </div>
          </div>
        </Link>

        <div className="flex flex-1 flex-col items-center px-2 pb-5 pt-4 text-center md:px-4 md:pb-6 md:pt-5">
          <Link to={productHref} {...createRoutePrefetchHandlers(productHref)} className="flex min-h-[3.1rem] items-start justify-center">
            <h3 className="font-display line-clamp-2 text-center text-[1.12rem] font-semibold leading-tight transition-opacity hover:opacity-80 md:text-[1.22rem]">
              {product.name[lang]}
            </h3>
          </Link>

          <div className="mt-auto min-w-0 pt-5 text-center">
            <span
              className={cn(
                "block whitespace-nowrap font-mono text-base font-semibold tabular-nums md:text-lg",
                hasCompareAt ? "text-primary" : "text-foreground",
              )}
            >
              {formatPrice(product.price, lang, currency)}
            </span>
            {hasCompareAt && (
              <span className="mt-1 block whitespace-nowrap font-mono text-xs text-muted-foreground line-through tabular-nums">
                {formatPrice(product.compareAt, lang, currency)}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
