import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Expand, X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProductCardImageMode, PRODUCT_IMAGE_CANVAS_CLASS } from "@/lib/productImage";

type Props = {
  images: string[];
  alt: string;
  badge?: string | null;
  discount?: number;
};

export function ProductGallery({ images, alt, badge, discount = 0 }: Props) {
  const [active, setActive] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [lensPos, setLensPos] = useState({ x: 50, y: 50 });
  const [lightbox, setLightbox] = useState(false);
  const [lbZoom, setLbZoom] = useState(1);
  const [lbPan, setLbPan] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const scrollLockRef = useRef<{
    overflow: string;
    position: string;
    top: string;
    width: string;
    overscrollBehavior: string;
    scrollY: number;
  } | null>(null);

  const total = images.length;
  const activeImage = images[active] || "";
  const mainImageMode = getProductCardImageMode(activeImage);
  const next = useCallback(() => {
    if (!total) return;
    setActive((i) => (i + 1) % total);
  }, [total]);
  const prev = useCallback(() => {
    if (!total) return;
    setActive((i) => (i - 1 + total) % total);
  }, [total]);

  const openLightbox = useCallback(() => {
    setLightbox(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightbox(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }, []);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeLightbox();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeLightbox, lightbox, next, prev]);

  useEffect(() => {
    if (!lightbox) return;
    const scrollY = window.scrollY;
    scrollLockRef.current = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overscrollBehavior: document.documentElement.style.overscrollBehavior,
      scrollY,
    };
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.documentElement.style.overscrollBehavior = "none";

    window.requestAnimationFrame(() => closeButtonRef.current?.focus({ preventScroll: true }));
    return () => {
      const previous = scrollLockRef.current;
      if (!previous) return;
      document.body.style.overflow = previous.overflow;
      document.body.style.position = previous.position;
      document.body.style.top = previous.top;
      document.body.style.width = previous.width;
      document.documentElement.style.overscrollBehavior = previous.overscrollBehavior;
      window.scrollTo(0, previous.scrollY);
      scrollLockRef.current = null;
    };
  }, [lightbox]);

  // Reset zoom on image / lightbox change
  useEffect(() => {
    setLbZoom(1);
    setLbPan({ x: 0, y: 0 });
  }, [active, lightbox]);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setLensPos({ x, y });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = e.changedTouches[0].clientY - touchRef.current.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) next();
      else prev();
    }
    touchRef.current = null;
  };

  // Lightbox drag-to-pan
  const onLbMouseDown = (e: React.MouseEvent) => {
    if (lbZoom <= 1) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: lbPan.x, baseY: lbPan.y };
  };
  const onLbMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    setLbPan({
      x: dragRef.current.baseX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.baseY + (e.clientY - dragRef.current.startY),
    });
  };
  const onLbMouseUp = () => {
    dragRef.current = null;
  };

  return (
    <>
      <div className="flex gap-3">
        {/* Vertical thumbs (desktop) */}
        {total > 1 && (
          <div className="hidden md:flex w-16 shrink-0 flex-col gap-2">
            {images.map((g, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={cn(
                  PRODUCT_IMAGE_CANVAS_CLASS,
                  "edio-gallery-thumb relative aspect-square overflow-hidden p-1.5 smooth",
                  i === active ? "ring-1 ring-primary opacity-100" : "opacity-55 hover:opacity-100",
                )}
                aria-label={`Image ${i + 1}`}
              >
                <img src={g} alt="" className="w-full h-full object-contain" width={160} height={160} loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        )}

        {/* Main image */}
        <div
          className={cn(
            "edio-gallery-stage group relative aspect-square flex-1 cursor-zoom-in select-none overflow-hidden",
            mainImageMode === "contain" ? PRODUCT_IMAGE_CANVAS_CLASS : "edio-gallery-stage--photo",
          )}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          onMouseMove={handleMove}
          ref={triggerRef}
          role="button"
          tabIndex={0}
          aria-label="Open product image lightbox"
          onClick={openLightbox}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openLightbox();
            }
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {badge && (
            <span className="product-badge absolute top-4 start-4 z-20">
              {badge}
            </span>
          )}
          {discount > 0 && (
            <span className="product-badge product-badge--primary absolute top-4 end-4 z-20">
              −{discount}%
            </span>
          )}

          {/* Image with hover zoom */}
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
            <img
              src={activeImage}
              alt={alt}
              className={cn(
                "h-full w-full object-center transition-transform duration-300 ease-out",
                mainImageMode === "cover"
                  ? hovering
                    ? "scale-[1.08] object-cover"
                    : "scale-[1.04] object-cover"
                  : hovering
                    ? "scale-[1.14] object-contain"
                    : "scale-[1.1] object-contain",
              )}
              width={900}
              height={900}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              style={
                hovering
                  ? { transformOrigin: `${lensPos.x}% ${lensPos.y}%` }
                  : undefined
              }
              draggable={false}
            />
          </div>

          {/* Counter */}
          {total > 1 && (
            <div className="absolute bottom-4 start-4 z-20 label-tech bg-background/70 backdrop-blur px-2.5 py-1 font-mono">
              {String(active + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </div>
          )}

          {/* Expand */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              openLightbox();
            }}
            className="edio-gallery-control absolute bottom-4 end-4 z-20 inline-flex h-10 w-10 items-center justify-center text-foreground smooth hover:bg-primary hover:text-primary-foreground"
            aria-label="Open fullscreen"
          >
            <Expand className="h-4 w-4" />
          </button>

          {/* Prev / Next on main */}
          {total > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                className="edio-gallery-control absolute start-3 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center text-foreground opacity-0 smooth hover:bg-primary hover:text-primary-foreground group-hover:opacity-100"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                className="edio-gallery-control absolute end-3 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center text-foreground opacity-0 smooth hover:bg-primary hover:text-primary-foreground group-hover:opacity-100"
                aria-label="Next image"
              >
                <ChevronRight className="h-5 w-5 rtl:rotate-180" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile thumbs */}
      {total > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2 md:hidden">
          {images.map((g, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={cn(
                PRODUCT_IMAGE_CANVAS_CLASS,
                "edio-gallery-thumb aspect-square overflow-hidden p-1.5",
                i === active ? "ring-1 ring-primary" : "opacity-70",
              )}
            >
              <img src={g} alt="" className="w-full h-full object-contain" width={160} height={160} loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && typeof document !== "undefined" && createPortal(
	        <div
            role="dialog"
            aria-modal="true"
            aria-label="Product image viewer"
	          className="motion-fade-in fixed inset-0 z-[1000] flex flex-col bg-black/92 text-white backdrop-blur-md"
          onMouseMove={onLbMouseMove}
          onMouseUp={onLbMouseUp}
          onMouseLeave={onLbMouseUp}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeLightbox();
          }}
        >
          {/* Top bar */}
          <div className="z-10 flex shrink-0 items-center justify-between p-3 md:p-5">
            <div className="label-tech font-mono text-foreground/80">
              {String(active + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLbZoom((z) => Math.max(1, +(z - 0.5).toFixed(2)))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/12 bg-white/10 text-white backdrop-blur smooth hover:bg-primary hover:text-primary-foreground"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="w-12 text-center font-mono text-xs text-white/70">
                {Math.round(lbZoom * 100)}%
              </span>
              <button
                onClick={() => setLbZoom((z) => Math.min(4, +(z + 0.5).toFixed(2)))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/12 bg-white/10 text-white backdrop-blur smooth hover:bg-primary hover:text-primary-foreground"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                ref={closeButtonRef}
                onClick={closeLightbox}
                className="ms-2 inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/12 bg-white/10 text-white backdrop-blur smooth hover:bg-primary hover:text-primary-foreground"
                aria-label="Close image viewer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Stage */}
          <div
            className={cn(
              "relative flex flex-1 touch-none items-center justify-center overflow-hidden px-3",
              lbZoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
            )}
            onMouseDown={onLbMouseDown}
            onClick={(e) => {
              if (lbZoom === 1 && e.target === e.currentTarget) {
                closeLightbox();
              }
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className={cn(PRODUCT_IMAGE_CANVAS_CLASS, "flex max-h-[78vh] max-w-[94vw] items-center justify-center overflow-hidden rounded-md bg-white")}>
              <img
                src={activeImage}
                alt={alt}
                draggable={false}
                className="max-h-[76vh] max-w-[92vw] object-contain p-3 transition-transform duration-300 ease-out md:p-4"
                width={1200}
                height={1200}
                loading="lazy"
                decoding="async"
                style={{
                  transform: `translate(${lbPan.x}px, ${lbPan.y}px) scale(${lbZoom})`,
                }}
              />
            </div>

            {total > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute start-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md border border-white/12 bg-black/45 text-white backdrop-blur smooth hover:bg-primary hover:text-primary-foreground md:start-8 md:h-12 md:w-12"
                  aria-label="Previous"
                >
                  <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
                </button>
                <button
                  onClick={next}
                  className="absolute end-3 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md border border-white/12 bg-black/45 text-white backdrop-blur smooth hover:bg-primary hover:text-primary-foreground md:end-8 md:h-12 md:w-12"
                  aria-label="Next"
                >
                  <ChevronRight className="h-5 w-5 rtl:rotate-180" />
                </button>
              </>
            )}
          </div>

          {/* Bottom thumbs */}
          {total > 1 && (
            <div className="flex shrink-0 items-center justify-start gap-2 overflow-x-auto px-4 py-3 md:justify-center md:px-6 md:py-5">
              {images.map((g, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={cn(
                    PRODUCT_IMAGE_CANVAS_CLASS,
                    "edio-gallery-thumb h-14 w-14 shrink-0 overflow-hidden smooth p-1.5 md:h-16 md:w-16",
                    i === active ? "ring-1 ring-primary opacity-100" : "opacity-55 hover:opacity-100",
                  )}
                >
                  <img src={g} alt="" className="w-full h-full object-contain" width={160} height={160} loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
