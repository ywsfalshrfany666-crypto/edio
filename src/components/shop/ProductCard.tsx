import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Product } from "@/data/catalog";
import type { RuntimeProduct } from "@/lib/runtimeCatalog";
import { createRoutePrefetchHandlers } from "@/lib/routePrefetch";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/formatPrice";
import {
  getProductCardThumbnailPresentation,
} from "@/lib/productImage";
import { getPublicStockDisplay } from "@/lib/publicStock";
import { useCurrency } from "@/store/currency";

type Variant = "default" | "wide" | "showcase";
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
  const brandHref = `/shop?brand=${encodeURIComponent(product.brand)}`;
  const cardThumbnail = getProductCardThumbnailPresentation(product);
  const cardImage = cardThumbnail.src;
  const apiPublicStock = "publicStock" in product ? product.publicStock : undefined;
  const publicStock = getPublicStockDisplay({
    availableQuantity: apiPublicStock?.low_stock ? apiPublicStock.low_stock_quantity : "stock" in product ? product.stock : undefined,
    inStock: product.inStock,
    availabilityStatus: apiPublicStock?.availability || ("availabilityStatus" in product ? product.availabilityStatus : undefined),
    locale: lang,
  });

  return (
    <article
      data-reveal
      data-reveal-delay={Math.min(index, 4) * 45}
      className={cn("group edio-product-card h-full w-full hover-lift", variant === "showcase" && "edio-product-card--showcase")}
    >
      <div
        className={cn(
          "relative flex h-full w-full flex-col overflow-hidden",
          variant === "wide" && "edio-product-card__inner--wide",
          variant === "showcase" && "edio-product-card__inner--showcase",
        )}
      >
        <Link to={productHref} {...createRoutePrefetchHandlers(productHref)} className="block shrink-0">
          <div
            className={cn(
              "edio-product-card__stage relative overflow-hidden",
              cardThumbnail.canvasClass,
              "aspect-square",
            )}
          >
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
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
              {cardImage ? (
                <img
                  src={cardImage}
                  alt={product.name[lang]}
                  width={640}
                  height={640}
                  loading="lazy"
                  decoding="async"
                  className={cn(
                    "edio-product-card__image h-full w-full object-center transition-transform duration-300 ease-out",
                    "object-contain",
                  )}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-surface-high text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                  {lang === "ar" ? "بدون صورة" : "No image"}
                </div>
              )}
            </div>
          </div>
        </Link>

        <div
          className={cn(
            "edio-product-card__content flex flex-1 flex-col px-3 pb-4 pt-3 text-start md:px-5 md:pb-6 md:pt-5",
            variant === "showcase" && "pb-4 pt-3 md:pb-5 md:pt-4",
          )}
        >
          <Link
            to={brandHref}
            className="label-tech mb-2 inline-block w-fit max-w-full truncate text-primary/90 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={
              lang === "ar"
                ? `عرض كل منتجات ${product.brand}`
                : `View all ${product.brand} products`
            }
          >
            {product.brand}
          </Link>
          <Link to={productHref} {...createRoutePrefetchHandlers(productHref)} className="flex min-h-[2.9rem] items-start">
            <h3 className="font-display line-clamp-2 text-[0.94rem] font-semibold leading-[1.1] transition-opacity hover:opacity-80 md:text-[1.12rem] md:leading-[1.08]">
              {product.name[lang]}
            </h3>
          </Link>

          <div className="mt-auto min-w-0 pt-4 md:pt-5">
            <span
              className={cn(
                "block whitespace-nowrap font-display text-[0.9rem] font-semibold tracking-normal tabular-nums md:text-lg",
                hasCompareAt ? "text-primary" : "text-foreground",
              )}
            >
              {formatPrice(product.price, lang, currency)}
            </span>
            {hasCompareAt && (
              <span className="mt-1 block whitespace-nowrap font-display text-xs tracking-normal text-muted-foreground line-through tabular-nums">
                {formatPrice(product.compareAt, lang, currency)}
              </span>
            )}
            <span
              className={cn(
                "mt-3 inline-flex items-center gap-1.5 text-xs",
                publicStock.severity === "danger"
                  ? "text-destructive"
                  : publicStock.severity === "warning"
                    ? "text-primary"
                    : "text-primary",
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
              {publicStock.label}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
