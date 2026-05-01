import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  Lock,
  Check,
  Banknote,
  Truck,
  Tag,
  X,
  AlertCircle,
  ShieldCheck,
  Phone,
  
  MapPin,
  User,
  ArrowLeft,
  ArrowRight,
  Package,
  Sparkles,
  ShoppingBag,
  Home,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useCart } from "@/store/cart";
import { useCurrency } from "@/store/currency";
import { formatPrice } from "@/data/catalog";
import { getCartDiscount } from "@/lib/cartPricing";
import { toast } from "sonner";
import { useRuntimeCatalog } from "@/lib/runtimeCatalog";

const FREE_SHIPPING_THRESHOLD = 150000;
const SHIPPING_FEE = 5000;

const IRAQ_GOVERNORATES: { en: string; ar: string }[] = [
  { en: "Baghdad", ar: "بغداد" },
  { en: "Nineveh (Mosul)", ar: "نينوى" },
  { en: "Basra", ar: "البصرة" },
  { en: "Erbil", ar: "أربيل" },
  { en: "Sulaymaniyah", ar: "السليمانية" },
  { en: "Duhok", ar: "دهوك" },
  { en: "Halabja", ar: "حلبجة" },
  { en: "Kirkuk", ar: "كركوك" },
  { en: "Anbar", ar: "الأنبار" },
  { en: "Salah ad-Din", ar: "صلاح الدين" },
  { en: "Diyala", ar: "ديالى" },
  { en: "Babil", ar: "بابل" },
  { en: "Karbala", ar: "كربلاء" },
  { en: "Najaf", ar: "النجف" },
  { en: "Wasit", ar: "واسط" },
  { en: "Maysan", ar: "ميسان" },
  { en: "Dhi Qar", ar: "ذي قار" },
  { en: "Muthanna", ar: "المثنى" },
  { en: "Qadisiyyah", ar: "القادسية" },
];

const Checkout = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as "en" | "ar";
  const currency = useCurrency((s) => s.currency);
  const navigate = useNavigate();
  const rawItems = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
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

  const [submitting, setSubmitting] = useState(false);
  const [code, setCode] = useState("");
  const [showCouponInput, setShowCouponInput] = useState(false);
  const [couponFeedback, setCouponFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Customer form state
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    if (trimmed.length > 32) {
      setCouponFeedback({ type: "error", message: "Code too long" });
      return;
    }
    const result = applyCoupon(trimmed, subtotal);
    if (result.ok) {
      setCouponFeedback({ type: "success", message: `${result.coupon.code} applied` });
      setCode("");
      setShowCouponInput(false);
      setTimeout(() => setCouponFeedback(null), 3000);
      return;
    }
    const errCode = (result as { ok: false; error: "invalid" | "minSubtotal" }).error;
    setCouponFeedback({
      type: "error",
      message: errCode === "invalid" ? "Invalid coupon code" : "Subtotal too low for this code",
    });
  };

  const handleRemoveCoupon = () => {
    removeCoupon();
    setCouponFeedback(null);
  };

  if (items.length === 0) return <Navigate to="/shop" replace />;

  const afterDiscount = Math.max(0, subtotal - discount);
  const shipping = afterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = afterDiscount + shipping;
  const remainingForFree = Math.max(0, FREE_SHIPPING_THRESHOLD - afterDiscount);
  const freeProgress = Math.min(100, (afterDiscount / FREE_SHIPPING_THRESHOLD) * 100);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const orderId = `EDIO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const snapshot = {
      orderId,
      placedAt: new Date().toISOString(),
      items: rawItems,
      subtotal,
      discount,
      shipping,
      total,
      customer: {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        phone: phone ? `+964 ${phone}` : undefined,
        address: address || undefined,
        city: city || undefined,
      },
      paymentMethod: "cod" as const,
      etaDays: [2, 4] as [number, number],
    };
    setTimeout(() => {
      toast.success(t("checkout.success"));
      clear();
      navigate("/order-confirmation", { state: snapshot, replace: true });
    }, 1100);
  };

  return (
    <Layout>
      {/* Editorial header band */}
      <section data-header-surface="dark" className="relative pt-28 md:pt-32 pb-12 border-b border-border/30 overflow-hidden">
        {/* Gradient background */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(1200px 500px at 15% -10%, hsl(var(--primary) / 0.18), transparent 60%), radial-gradient(900px 500px at 95% 10%, hsl(var(--primary) / 0.10), transparent 65%), linear-gradient(180deg, hsl(var(--surface-high)) 0%, hsl(var(--surface-low)) 60%, hsl(var(--background)) 100%)",
          }}
          aria-hidden
        />
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 -z-10 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          }}
          aria-hidden
        />
        {/* Floating glow orb */}
        <div
          className="absolute -top-24 right-1/3 -z-10 h-72 w-72 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.5), transparent 70%)" }}
          aria-hidden
        />
        <div className="container-edio relative">
          <div className="flex items-center justify-between gap-6 mb-8">
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground smooth"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("cta.continueShopping")}
            </Link>
            <div className="hidden md:flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
              <Lock className="h-3 w-3 text-primary" />
              <span>Secure Checkout</span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="max-w-2xl">
              <p className="label-tech mb-3 text-primary">Step 02 / 03 — Details</p>
              <h1 className="font-display text-5xl md:text-7xl font-extrabold tracking-normal leading-[0.92]">
                {t("checkout.title")}
              </h1>
              <p className="mt-4 text-base text-muted-foreground max-w-md">
                Just a few details and your order is on its way across Iraq.
              </p>
            </div>

            {/* Delivery Journey — creative tracker */}
            <div className="w-full md:w-[360px] shrink-0">
              <div className="flex items-center justify-between mb-3">
                <span className="label-tech text-primary">Your Order's Journey</span>
                <span className="text-[10px] font-mono text-muted-foreground">ETA · 2–4 days</span>
              </div>

              <div className="relative bg-surface-low p-5 overflow-hidden">
                {/* Dashed road */}
                <div
                  className="absolute left-7 right-7 top-1/2 -translate-y-1/2 h-px"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(to right, hsl(var(--border) / 0.8) 0 6px, transparent 6px 12px)",
                  }}
                  aria-hidden
                />
                {/* Filled progress (Cart -> Details) */}
                <div className="absolute left-7 top-1/2 -translate-y-1/2 h-px bg-primary w-[calc(50%-1.75rem)]" aria-hidden />

                {/* Animated truck */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -mt-3 transition-all duration-700"
                  style={{ left: "calc(50% - 0.75rem)" }}
                  aria-hidden
                >
                  <div className="relative">
                    <Truck className="h-5 w-5 text-primary animate-pulse" />
                    <span className="absolute -inset-2 rounded-full bg-primary/20 blur-md animate-pulse" />
                  </div>
                </div>

                {/* Stops */}
                <ol className="relative flex items-center justify-between">
                  {[
                    { icon: ShoppingBag, label: "Cart", status: "done" as const },
                    { icon: MapPin, label: "Details", status: "active" as const },
                    { icon: Home, label: "Doorstep", status: "pending" as const },
                  ].map((stop) => (
                    <li key={stop.label} className="flex flex-col items-center gap-2">
                      <span
                        className={`relative z-10 inline-flex h-9 w-9 items-center justify-center border smooth ${
                          stop.status === "done"
                            ? "bg-foreground border-foreground text-background"
                            : stop.status === "active"
                              ? "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20"
                              : "bg-surface-low border-border/60 text-muted-foreground"
                        }`}
                      >
                        {stop.status === "done" ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <stop.icon className="h-4 w-4" />
                        )}
                      </span>
                      <span
                        className={`text-[10px] font-mono uppercase tracking-widest ${
                          stop.status === "active" ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {stop.label}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main */}
      <section className="bg-background pb-32 md:pb-24">
        <div className="container-edio pt-10 md:pt-14">
          <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-14">
            {/* Form column */}
            <form onSubmit={onSubmit} className="space-y-6 md:space-y-8">
              {/* Contact card */}
              <Card icon={Phone} number="01" title={t("checkout.contact")} hint="We'll call you to confirm delivery.">
                <PhoneInput
                  label={t("checkout.phone")}
                  required
                  placeholder="7XX XXX XXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Card>

              {/* Shipping card */}
              <Card icon={MapPin} number="02" title={t("checkout.shipping")} hint="Where should we deliver?">
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Input icon={User} label={t("checkout.firstName")} required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    <Input label={t("checkout.lastName")} required value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                  <Input icon={MapPin} label={t("checkout.address")} required placeholder="Street, building, apt." value={address} onChange={(e) => setAddress(e.target.value)} />
                  <Select label={t("checkout.city")} required value={city} onChange={(e) => setCity(e.target.value)}>
                    <option value="" disabled>Select governorate…</option>
                    {IRAQ_GOVERNORATES.map((g) => (
                      <option key={g.en} value={g.en}>{`${g.en} · ${g.ar}`}</option>
                    ))}
                  </Select>

                  <div className="flex items-start gap-3 p-4 bg-primary/5 border-s-2 border-primary">
                    <Truck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="text-xs text-foreground/80 leading-relaxed">
                      <span className="text-foreground font-semibold">All Iraq · 5,000 IQD flat shipping.</span>{" "}
                      Free delivery on orders of {formatPrice(FREE_SHIPPING_THRESHOLD, lang, currency)} or more.
                    </div>
                  </div>
                </div>
              </Card>


              {/* Payment card */}
              <Card icon={Banknote} number="03" title={t("checkout.payment")} hint="One simple way to pay.">
                <div className="relative p-5 md:p-6 bg-background border border-primary/40 ring-1 ring-primary/10">
                  <span className="absolute top-0 end-0 text-[10px] font-mono uppercase tracking-widest bg-primary text-primary-foreground px-2 py-1">
                    Selected
                  </span>
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 shrink-0 inline-flex items-center justify-center bg-primary text-primary-foreground">
                      <Banknote className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground text-base">Cash on Delivery</p>
                        <span className="text-[10px] font-mono uppercase tracking-widest bg-primary/15 text-primary px-1.5 py-0.5">
                          Only Method
                        </span>
                      </div>
                      <p className="text-xs md:text-[13px] text-muted-foreground mt-2 leading-relaxed">
                        Pay in cash (IQD) when your order arrives. Please have the exact amount ready.
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Desktop submit */}
              <div className="hidden lg:block space-y-4 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="group relative w-full bg-primary hover:bg-primary-glow disabled:opacity-60 text-primary-foreground py-5 text-sm font-semibold uppercase tracking-widest smooth"
                >
                  <span className="inline-flex items-center justify-center gap-3">
                    {submitting ? (
                      <>
                        <span className="inline-block h-3.5 w-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        Processing…
                      </>
                    ) : (
                      <>
                        {t("cta.placeOrder")}
                        <span className="opacity-50">·</span>
                        <span className="font-mono">{formatPrice(total, lang, currency)}</span>
                        <ArrowRight className="h-4 w-4 smooth group-hover:translate-x-1" />
                      </>
                    )}
                  </span>
                </button>
                <div className="flex items-center justify-center gap-5 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Lock className="h-3 w-3" /> Private & secure
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-3 w-3" /> No card required
                  </span>
                </div>
              </div>
            </form>

            {/* Summary */}
            <aside className="lg:sticky lg:top-28 self-start space-y-4">
              <div className="bg-surface-low overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 md:px-6 pt-5 md:pt-6 pb-4 border-b border-border/30">
                  <div className="inline-flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-primary" />
                    <p className="label-tech">{t("checkout.summary")}</p>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </span>
                </div>

                {/* Items */}
                <div className="px-5 md:px-6 py-5 space-y-4 max-h-[300px] overflow-y-auto">
                  {items.map((i) => (
                    <div key={i.id} className="flex gap-3.5 group">
                      <div className="relative w-14 h-14 bg-background shrink-0 overflow-hidden">
                        <img
                          src={i.product.image}
                          alt=""
                          className="w-full h-full object-cover smooth group-hover:scale-105"
                        />
                        <span className="absolute -top-1.5 -end-1.5 inline-flex h-4 min-w-4 items-center justify-center bg-primary px-1 text-[10px] font-mono font-semibold text-primary-foreground">
                          {i.quantity}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-1">{i.product.name[lang]}</p>
                        <p className="label-tech mt-0.5">{i.product.brand}</p>
                      </div>
                      <p className="font-mono text-sm self-start whitespace-nowrap">
                        {formatPrice(i.product.price * i.quantity, lang, currency)}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Free shipping progress */}
                <div className="px-5 md:px-6 py-4 border-t border-border/30 bg-background/40">
                  {remainingForFree > 0 ? (
                    <>
                      <div className="flex items-center justify-between text-[11px] mb-2">
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <Truck className="h-3 w-3" />
                          Add {formatPrice(remainingForFree, lang, currency)} for free shipping
                        </span>
                        <span className="font-mono text-muted-foreground">{Math.round(freeProgress)}%</span>
                      </div>
                      <div className="h-1 bg-border/40 overflow-hidden">
                        <div className="h-full bg-primary smooth" style={{ width: `${freeProgress}%` }} />
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-[11px] text-primary">
                      <Sparkles className="h-3 w-3" />
                      <span className="font-mono uppercase tracking-widest">You unlocked free shipping</span>
                    </div>
                  )}
                </div>

                {/* Coupon */}
                <div className="px-5 md:px-6 py-4 border-t border-border/30">
                  {coupon ? (
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-primary/10 border border-primary/30">
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
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="text-muted-foreground hover:text-destructive p-1"
                        aria-label="Remove coupon"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : showCouponInput ? (
                    <form onSubmit={handleApplyCoupon} className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={code}
                          onChange={(e) => {
                            setCode(e.target.value.toUpperCase());
                            if (couponFeedback) setCouponFeedback(null);
                          }}
                          maxLength={32}
                          placeholder="ENTER CODE"
                          autoFocus
                          className="flex-1 bg-background px-3 py-2.5 text-xs font-mono uppercase tracking-widest text-foreground placeholder:text-muted-foreground/60 border border-border/40 focus:border-primary/60 outline-none smooth"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2.5 bg-foreground text-background text-[11px] font-semibold uppercase tracking-widest hover:bg-primary hover:text-primary-foreground smooth"
                        >
                          Apply
                        </button>
                      </div>
                      {couponFeedback && (
                        <div
                          className={`flex items-center gap-1.5 text-[11px] ${couponFeedback.type === "success" ? "text-primary" : "text-destructive"}`}
                        >
                          <AlertCircle className="h-3 w-3" />
                          <span>{couponFeedback.message}</span>
                        </div>
                      )}
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowCouponInput(true)}
                      className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary smooth"
                    >
                      <Tag className="h-3.5 w-3.5" />
                      <span>Have a promo code?</span>
                    </button>
                  )}
                </div>

                {/* Totals */}
                <div className="px-5 md:px-6 py-4 border-t border-border/30 space-y-2.5 text-sm">
                  <Row label={t("common.subtotal")} value={formatPrice(subtotal, lang, currency)} />
                  {coupon && discount > 0 && (
                    <Row label={`Discount · ${coupon.code}`} value={`−${formatPrice(discount, lang, currency)}`} accent />
                  )}
                  <Row
                    label={t("common.shipping")}
                    value={shipping === 0 ? t("common.free") : formatPrice(shipping, lang, currency)}
                    accent={shipping === 0}
                  />
                </div>

                {/* Total bar */}
                <div className="px-5 md:px-6 py-5 bg-foreground text-background flex items-end justify-between">
                  <div>
                    <p className="label-tech mb-1 text-background/60">{t("common.total")}</p>
                    <p className="text-[10.5px] text-background/50">
                      {currency === "IQD" ? "Cash on delivery (IQD)" : "Cash on delivery · USD display"}
                    </p>
                  </div>
                  <p className="font-mono text-2xl md:text-3xl text-primary leading-none">
                    {formatPrice(total, lang, currency)}
                  </p>
                </div>
              </div>

              {/* Trust */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <TrustBadge icon={Truck} label="Fast delivery" />
                <TrustBadge icon={ShieldCheck} label="Genuine gear" />
                <TrustBadge icon={Phone} label="Iraq support" />
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Mobile sticky submit bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border/40 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="label-tech text-muted-foreground">{t("common.total")}</p>
            <p className="font-mono text-lg text-primary leading-tight truncate">{formatPrice(total, lang, currency)}</p>
          </div>
          <button
            type="submit"
            form=""
            onClick={(e) => {
              const form = (e.currentTarget.closest("section") as HTMLElement)?.parentElement?.querySelector("form");
              form?.requestSubmit();
            }}
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-glow disabled:opacity-60 text-primary-foreground py-3.5 text-xs font-semibold uppercase tracking-widest smooth"
          >
            {submitting ? "Processing…" : t("cta.placeOrder")}
            {!submitting && <ArrowRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </Layout>
  );
};

function Card({
  icon: Icon,
  number,
  title,
  hint,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  number: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-low p-5 md:p-7">
      <div className="flex items-start gap-4 mb-5">
        <div className="h-10 w-10 shrink-0 inline-flex items-center justify-center bg-foreground text-background">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[10px] text-primary tracking-widest">{number}</span>
            <h3 className="font-display text-xl md:text-2xl font-bold tracking-normal leading-none">{title}</h3>
          </div>
          {hint && <p className="text-xs text-muted-foreground mt-1.5">{hint}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Input({
  label,
  icon: Icon,
  ...props
}: { label: string; icon?: React.ComponentType<{ className?: string }> } & React.InputHTMLAttributes<HTMLInputElement>) {
  const isReadOnly = props.readOnly;
  return (
    <label
      className={`group block bg-surface-highest border border-border/60 hover:border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 smooth p-3.5 ${isReadOnly ? "opacity-70 hover:border-border/60 focus-within:ring-0" : ""}`}
    >
      <span className="label-tech mb-1.5 flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3 opacity-60" />}
        {label}
        {isReadOnly && (
          <span className="text-[9px] font-mono text-muted-foreground/60 normal-case tracking-normal">(locked)</span>
        )}
      </span>
      <input
        {...props}
        className="w-full bg-transparent border-0 outline-none text-base placeholder:text-muted-foreground/50 read-only:cursor-not-allowed"
      />
    </label>
  );
}

function Select({
  label,
  children,
  ...props
}: { label: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block bg-surface-highest border border-border/60 hover:border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 smooth p-3.5 relative">
      <span className="label-tech block mb-1.5">{label}</span>
      <select
        {...props}
        className="w-full bg-transparent border-0 outline-none text-base appearance-none cursor-pointer pe-6"
      >
        {children}
      </select>
      <span className="absolute end-4 bottom-3.5 pointer-events-none text-muted-foreground text-xs">▾</span>
    </label>
  );
}

function PhoneInput({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block bg-surface-highest border border-border/60 hover:border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 smooth p-3.5">
      <span className="label-tech mb-1.5 flex items-center gap-1.5">
        <Phone className="h-3 w-3 opacity-60" />
        {label}
      </span>
      <div className="flex items-center gap-2.5">
        <span
          className="inline-flex items-center gap-2 shrink-0 px-2.5 py-1.5 bg-surface-high border border-border/40"
          aria-label="Iraq +964"
        >
          <span className="inline-flex flex-col w-5 h-3.5 overflow-hidden border border-border/30">
            <span className="flex-1 bg-[#CE1126]" />
            <span className="flex-1 bg-white relative">
              <span className="absolute inset-0 flex items-center justify-center text-[6px] font-bold text-[#007A3D] leading-none tracking-tighter">
                الله أكبر
              </span>
            </span>
            <span className="flex-1 bg-[#0B0B0B]" />
          </span>
          <span className="font-mono text-sm text-foreground">+964</span>
        </span>
        <input
          {...props}
          type="tel"
          inputMode="numeric"
          pattern="[0-9 ]*"
          maxLength={14}
          className="flex-1 min-w-0 bg-transparent border-0 outline-none text-base placeholder:text-muted-foreground/50"
        />
      </div>
    </label>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className={accent ? "text-primary" : "text-muted-foreground"}>{label}</span>
      <span className={`font-mono ${accent ? "text-primary" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

function TrustBadge({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="bg-surface-low/60 border border-border/30 py-3 px-2 flex flex-col items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}

export default Checkout;
