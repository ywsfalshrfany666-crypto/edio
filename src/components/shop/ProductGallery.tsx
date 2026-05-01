import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRODUCT_IMAGE_CANVAS_CLASS } from "@/lib/productImage";

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
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const total = images.length;
  const next = () => setActive((i) => (i + 1) % total);
  const prev = () => setActive((i) => (i - 1 + total) % total);

  // Keyboard nav (lightbox + page)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape" && lightbox) setLightbox(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, total]);

  // Lock body scroll while lightbox open
  useEffect(() => {
    if (lightbox) {
      const prevO = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevO;
      };
    }
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
                <img src={g} alt="" className="w-full h-full object-contain" />
              </button>
            ))}
          </div>
        )}

        {/* Main image */}
        <div
          className="edio-gallery-stage group relative aspect-square flex-1 cursor-zoom-in select-none overflow-hidden"
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          onMouseMove={handleMove}
          onClick={() => setLightbox(true)}
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
          <div className={cn(PRODUCT_IMAGE_CANVAS_CLASS, "absolute inset-4 flex items-center justify-center overflow-hidden md:inset-6")}>
            <img
              src={images[active]}
              alt={alt}
              className={cn(
                "h-full w-full object-contain p-4 transition-transform duration-500 ease-out md:p-8",
                hovering ? "scale-[1.16]" : "scale-100",
              )}
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
              setLightbox(true);
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
              <img src={g} alt="" className="w-full h-full object-contain" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-xl animate-fade-in"
          onMouseMove={onLbMouseMove}
          onMouseUp={onLbMouseUp}
          onMouseLeave={onLbMouseUp}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between p-4 md:p-6 z-10">
            <div className="label-tech font-mono text-foreground/80">
              {String(active + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLbZoom((z) => Math.max(1, +(z - 0.5).toFixed(2)))}
                className="h-10 w-10 inline-flex items-center justify-center bg-surface-high hover:bg-primary hover:text-primary-foreground smooth"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="font-mono text-xs text-muted-foreground w-12 text-center">
                {Math.round(lbZoom * 100)}%
              </span>
              <button
                onClick={() => setLbZoom((z) => Math.min(4, +(z + 0.5).toFixed(2)))}
                className="h-10 w-10 inline-flex items-center justify-center bg-surface-high hover:bg-primary hover:text-primary-foreground smooth"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                onClick={() => setLightbox(false)}
                className="ms-2 h-10 w-10 inline-flex items-center justify-center bg-surface-high hover:bg-primary hover:text-primary-foreground smooth"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Stage */}
          <div
            className={cn(
              "relative flex-1 flex items-center justify-center overflow-hidden",
              lbZoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
            )}
            onMouseDown={onLbMouseDown}
            onClick={(e) => {
              if (lbZoom === 1 && e.target === e.currentTarget) {
                setLbZoom(2);
              }
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className={cn(PRODUCT_IMAGE_CANVAS_CLASS, "flex max-h-[80vh] max-w-[90vw] items-center justify-center overflow-hidden p-4")}>
              <img
                src={images[active]}
                alt={alt}
                draggable={false}
                className="max-h-[76vh] max-w-[86vw] object-contain transition-transform duration-300 ease-out"
                style={{
                  transform: `translate(${lbPan.x}px, ${lbPan.y}px) scale(${lbZoom})`,
                }}
              />
            </div>

            {total > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute start-4 md:start-8 top-1/2 -translate-y-1/2 h-12 w-12 inline-flex items-center justify-center bg-surface-high/80 backdrop-blur hover:bg-primary hover:text-primary-foreground smooth"
                  aria-label="Previous"
                >
                  <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
                </button>
                <button
                  onClick={next}
                  className="absolute end-4 md:end-8 top-1/2 -translate-y-1/2 h-12 w-12 inline-flex items-center justify-center bg-surface-high/80 backdrop-blur hover:bg-primary hover:text-primary-foreground smooth"
                  aria-label="Next"
                >
                  <ChevronRight className="h-5 w-5 rtl:rotate-180" />
                </button>
              </>
            )}
          </div>

          {/* Bottom thumbs */}
          {total > 1 && (
            <div className="p-4 md:p-6 flex items-center justify-center gap-2 overflow-x-auto">
              {images.map((g, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={cn(
                    PRODUCT_IMAGE_CANVAS_CLASS,
                    "edio-gallery-thumb h-16 w-16 shrink-0 overflow-hidden smooth p-1.5",
                    i === active ? "ring-1 ring-primary opacity-100" : "opacity-50 hover:opacity-100",
                  )}
                >
                  <img src={g} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
