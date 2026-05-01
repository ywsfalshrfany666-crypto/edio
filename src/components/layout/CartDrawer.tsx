import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Minus, Plus, X, Tag, Check, AlertCircle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCart } from "@/store/cart";
import { useCurrency } from "@/store/currency";
import { formatPrice } from "@/data/catalog";
import { getCartDiscount, getCartTotal } from "@/lib/cartPricing";
import { cn } from "@/lib/utils";
import { useRuntimeCatalog } from "@/lib/runtimeCatalog";
import { PRODUCT_IMAGE_CANVAS_CLASS } from "@/lib/productImage";

export function CartDrawer() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as "en" | "ar";
  const currency = useCurrency((s) => s.currency);
  const isOpen = useCart((s) => s.isOpen);
  const close = useCart((s) => s.close);
  const rawItems = useCart((s) => s.items);
  const update = useCart((s) => s.update);
  const remove = useCart((s) => s.remove);
  const coupon = useCart((s) => s.coupon);
  const applyCoupon = useCart((s) => s.applyCoupon);
  const removeCoupon = useCart((s) => s.removeCoupon);
  const { products } = useRuntimeCatalog();

  const items = useMemo(
    () =>
      rawItems
        .map((item) => {
          const product = products.find((p) => p.id === item.id);
          return product ? { ...item, product } : null;
        })
        .filter((item): item is (typeof rawItems)[number] & { product: (typeof products)[number] } => item !== null),
    [rawItems],
  );
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0), [items]);
  const discount = useMemo(() => getCartDiscount(subtotal, coupon), [coupon, subtotal]);
  const total = useMemo(() => getCartTotal(subtotal, coupon), [coupon, subtotal]);

  const [code, setCode] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [showInput, setShowInput] = useState(false);

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    if (trimmed.length > 32) {
      setFeedback({ type: "error", message: "Code too long" });
      return;
    }
    const result = applyCoupon(trimmed, subtotal);
    if (result.ok) {
      setFeedback({ type: "success", message: `${result.coupon.code} applied · ${result.coupon.label}` });
      setCode("");
      setTimeout(() => setFeedback(null), 3000);
      return;
    }
    const errCode = (result as { ok: false; error: "invalid" | "minSubtotal" }).error;
    const message = errCode === "invalid" ? "Invalid coupon code" : "Subtotal too low for this code";
    setFeedback({ type: "error", message });
  };

  const handleRemoveCoupon = () => {
    removeCoupon();
    setFeedback(null);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(v) => (v ? null : close())}>
      <SheetContent side={lang === "ar" ? "left" : "right"} className="flex w-full flex-col border-0 bg-surface p-0 shadow-soft sm:max-w-md">
        <SheetHeader className="space-y-0 px-6 pt-6 pb-4">
          <SheetTitle className="font-display text-2xl tracking-tight">{t("cart.title")}</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="font-display text-3xl font-bold mb-3">{t("cart.empty")}</div>
            <p className="text-muted-foreground mb-8 max-w-xs">{t("cart.emptyBody")}</p>
            <Link
              to="/shop"
              onClick={close}
              className="quiet-button inline-flex min-h-12 items-center justify-center bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-widest text-primary-foreground transition-colors hover:bg-primary-glow"
            >
              {t("cta.shopAll")}
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-2">
              {items.map((i) => (
                <div key={i.id} className="flex gap-4 border-b border-border/30 py-5 last:border-b-0">
                  <Link
                    to={`/product/${i.product.slug}`}
                    onClick={close}
                    className={cn(PRODUCT_IMAGE_CANVAS_CLASS, "block h-20 w-20 shrink-0 overflow-hidden")}
                  >
                    <img src={i.product.image} alt={i.product.name[lang]} className="h-full w-full object-contain p-2" loading="lazy" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/product/${i.product.slug}`} onClick={close} className="line-clamp-1 text-sm font-medium hover:text-primary">
                      {i.product.name[lang]}
                    </Link>
                    <p className="label-tech mt-1">{i.product.brand}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="inline-flex items-center bg-surface-high">
                        <button onClick={() => update(i.id, i.quantity - 1)} className="touch-target inline-flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Decrease">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="px-2.5 font-mono text-xs">{i.quantity}</span>
                        <button onClick={() => update(i.id, i.quantity + 1)} className="touch-target inline-flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Increase">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="font-mono text-sm">{formatPrice(i.product.price * i.quantity, lang, currency)}</span>
                    </div>
                  </div>
                  <button onClick={() => remove(i.id)} className="touch-target inline-flex items-center justify-center self-start text-muted-foreground hover:text-destructive" aria-label={t("cta.remove")}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-border/30 bg-surface-low">
              {/* Coupon section */}
              <div className="border-b border-border/30 px-6 py-4">
                {coupon ? (
                  <div className="flex items-center justify-between gap-3 border border-primary/30 bg-primary/10 px-3 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-mono uppercase tracking-widest text-primary truncate">
                          {coupon.code}
                        </p>
                        <p className="text-[10.5px] text-muted-foreground truncate">{coupon.label}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleRemoveCoupon}
                      className="touch-target inline-flex items-center justify-center text-muted-foreground hover:text-destructive"
                      aria-label="Remove coupon"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : showInput ? (
                  <form onSubmit={handleApply} className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={code}
                        onChange={(e) => {
                          setCode(e.target.value.toUpperCase());
                          if (feedback) setFeedback(null);
                        }}
                        maxLength={32}
                        placeholder="ENTER CODE"
                        autoFocus
                        className="min-h-11 flex-1 bg-surface px-3 py-2.5 text-xs font-mono uppercase tracking-widest text-foreground placeholder:text-muted-foreground/60 border border-border/40 focus:border-primary/60 outline-none smooth"
                      />
                      <button
                        type="submit"
                        className="min-h-11 bg-foreground px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-background smooth press hover:bg-primary hover:text-primary-foreground"
                      >
                        Apply
                      </button>
                    </div>
                    {feedback && (
                      <div
                        className={cn(
                          "flex items-center gap-1.5 text-[11px]",
                          feedback.type === "success" ? "text-primary" : "text-destructive",
                        )}
                      >
                        <AlertCircle className="h-3 w-3" />
                        <span>{feedback.message}</span>
                      </div>
                    )}
                  </form>
                ) : (
                  <button
                    onClick={() => setShowInput(true)}
                    className="flex min-h-11 items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground smooth hover:text-primary"
                  >
                    <Tag className="h-3.5 w-3.5" />
                    <span>Have a promo code?</span>
                  </button>
                )}
              </div>

              {/* Totals */}
              <div className="px-6 py-5 space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("common.subtotal")}</span>
                  <span className="font-mono">{formatPrice(subtotal, lang, currency)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-primary">Discount</span>
                    <span className="font-mono text-primary">−{formatPrice(discount, lang, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("common.shipping")}</span>
                  <span className="text-muted-foreground">{t("common.calculatedAtCheckout")}</span>
                </div>
                <div className="flex justify-between pt-2.5 border-t border-border/40">
                  <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Total</span>
                  <span className="font-mono text-base font-semibold">{formatPrice(total, lang, currency)}</span>
                </div>
                <Link
                  to="/checkout"
                  onClick={close}
                  className={cn("quiet-button mt-3 flex min-h-12 w-full items-center justify-center bg-primary px-6 py-4 text-center text-sm font-semibold uppercase tracking-widest text-primary-foreground transition-colors hover:bg-primary-glow")}
                >
                  {t("cta.checkout")}
                </Link>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
