import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Autoplay from "embla-carousel-autoplay";
import type { Product } from "@/data/catalog";
import { ProductCard } from "@/components/shop/ProductCard";
import { createRoutePrefetchHandlers } from "@/lib/routePrefetch";
import { getHomeNewArrivals } from "@/lib/homeCatalog";
import { cn } from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

export function NewArrivals() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === "ar";
  const [items, setItems] = useState<Product[]>([]);

  const autoplay = useRef(
    Autoplay({ delay: 3500, stopOnInteraction: false, stopOnMouseEnter: true })
  );

  const [api, setApi] = useState<CarouselApi | undefined>();
  const [selected, setSelected] = useState(0);
  const [snapCount, setSnapCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void getHomeNewArrivals().then((nextItems) => {
      if (!cancelled) {
        setItems(nextItems);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => {
      setSelected(api.selectedScrollSnap());
      setSnapCount(api.scrollSnapList().length);
    };
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  return (
    <section data-header-surface="mixed" className="section-luxury bg-surface-lowest py-20 md:py-28">
      <div className="container-edio">
        <div className="flex items-end justify-between gap-6 mb-12">
          <div>
            <p className="label-tech text-primary mb-3">{t("newArrivals.eyebrow")}</p>
            <h2 className="font-display arabic-display-safe text-4xl md:text-5xl font-bold tracking-tight">
              {t("newArrivals.title")}
            </h2>
          </div>
          <Link
            to="/shop?sort=newest"
            {...createRoutePrefetchHandlers("/shop?sort=newest")}
            className="premium-ghost hidden items-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-foreground md:inline-flex"
          >
            {t("newArrivals.viewAll")}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </div>

        <Carousel
          setApi={setApi}
          opts={{ align: "start", loop: true, slidesToScroll: 1, direction: isArabic ? "rtl" : "ltr" }}
          plugins={[autoplay.current]}
          className="relative"
        >
          <CarouselContent className="-ml-3 items-stretch">
            {(items.length > 0 ? items : Array.from({ length: 4 }, (_, index) => index)).map((item, i) => (
              <CarouselItem
                key={typeof item === "number" ? `placeholder-${item}` : item.id}
                className="flex pl-3 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4"
              >
                {typeof item === "number" ? (
                  <div className="premium-shell h-full min-h-[26rem] w-full animate-pulse" />
                ) : (
                  <ProductCard product={item} index={i} />
                )}
              </CarouselItem>
            ))}
          </CarouselContent>

          {/* Controls row */}
          <div className="mt-10 flex items-center justify-between gap-6">
            {/* Progress dots */}
            <div className={cn("flex items-center gap-1.5", isArabic && "flex-row-reverse")}>
              {Array.from({ length: snapCount }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => api?.scrollTo(i)}
                  className="flex h-11 w-8 items-center justify-center"
                >
                  <span
                    className={`h-1 rounded-full transition-all duration-500 ${
                      i === selected
                        ? "w-8 bg-primary"
                        : "w-3 bg-surface-highest hover:bg-muted-foreground"
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Arrows */}
            <div className={cn("flex items-center gap-2", isArabic && "flex-row-reverse")}>
              <CarouselPrevious
                className="static h-11 w-11 translate-y-0 rounded-full border border-border/35 bg-surface-high text-foreground smooth press hover:bg-primary hover:text-primary-foreground"
              />
              <CarouselNext
                className="static h-11 w-11 translate-y-0 rounded-full border border-border/35 bg-surface-high text-foreground smooth press hover:bg-primary hover:text-primary-foreground"
              />
            </div>
          </div>
        </Carousel>
      </div>
    </section>
  );
}
