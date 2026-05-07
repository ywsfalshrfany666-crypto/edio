import { useEffect, useMemo } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Check,
  Package,
  Truck,
  Home,
  ShoppingBag,
  ArrowRight,
  Phone,
  MapPin,
  Copy,
  Sparkles,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Seo } from "@/components/Seo";
import { formatPrice } from "@/data/catalog";
import { formatDate } from "@/lib/formatting";
import { useCurrency } from "@/store/currency";
import { toast } from "sonner";
import { useRuntimeCatalog } from "@/lib/runtimeCatalog";
import type { EdioOrderSubmissionResult } from "@/lib/edioOrder";

type OrderItem = { id: string; quantity: number };

type OrderState = {
  orderId: string;
  placedAt: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  customer: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    secondaryPhone?: string;
    address?: string;
    city?: string;
    region?: string;
    nearestPoint?: string;
    notes?: string;
  };
  orderSubmission?: EdioOrderSubmissionResult;
  paymentMethod: "qi_card" | "cod";
  etaDays: [number, number];
};

const OrderConfirmation = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as "en" | "ar";
  const currency = useCurrency((s) => s.currency);
  const location = useLocation();
  const order = location.state as OrderState | null;
  const { products } = useRuntimeCatalog();

  // Confetti-ish: scroll to top
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  const detailedItems = useMemo(() => {
    if (!order) return [];
    return order.items
      .map((i) => {
        const product = products.find((p) => p.id === i.id);
        return product ? { ...i, product } : null;
      })
      .filter((x): x is OrderItem & { product: (typeof products)[number] } => x !== null);
  }, [order, products]);

  if (!order) return <Navigate to="/shop" replace />;

  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
  const placedDate = new Date(order.placedAt);
  const etaStart = new Date(placedDate.getTime() + order.etaDays[0] * 86400000);
  const etaEnd = new Date(placedDate.getTime() + order.etaDays[1] * 86400000);
  const fmtDate = (d: Date) =>
    formatDate(d, lang, { day: "numeric", month: "short" });

  const copyOrderId = async () => {
    try {
      await navigator.clipboard.writeText(order.orderId);
      toast.success("Order ID copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <Layout>
      <Seo title="Order confirmed" description="Your edio order has been confirmed." />
      {/* Hero confirmation band */}
      <section data-header-surface="dark" className="relative pt-28 md:pt-32 pb-14 md:pb-20 border-b border-border/30 overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(1200px 500px at 50% -10%, hsl(var(--primary) / 0.22), transparent 60%), linear-gradient(180deg, hsl(var(--surface-high)) 0%, hsl(var(--surface-low)) 60%, hsl(var(--background)) 100%)",
          }}
          aria-hidden
        />
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
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 -z-10 h-72 w-72 rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.55), transparent 70%)" }}
          aria-hidden
        />

        <div className="container-edio relative text-center">
          {/* Success badge */}
          <div className="inline-flex items-center justify-center mb-6">
            <span className="relative inline-flex h-16 w-16 items-center justify-center bg-primary text-primary-foreground rounded-full">
              <Check className="h-8 w-8" strokeWidth={2.5} />
              <span className="absolute inset-0 rounded-full bg-primary/30 blur-xl animate-pulse" aria-hidden />
            </span>
          </div>

          <p className="label-tech text-primary mb-3 inline-flex items-center gap-2 justify-center">
            <Sparkles className="h-3 w-3" />
            Step 03 / 03 — Confirmed
          </p>
          <h1 className="font-display text-5xl md:text-7xl font-extrabold tracking-normal leading-[0.92]">
            Order placed{order.customer.firstName ? `, ${order.customer.firstName}` : ""}.
          </h1>
          <p className="mt-5 text-base text-muted-foreground max-w-xl mx-auto">
            Thank you. We've received your order and will call you shortly to confirm delivery details.
          </p>

          {/* Order ID chip */}
          <div className="mt-8 inline-flex items-center gap-2 bg-background border border-border px-4 py-2.5">
            <span className="label-tech text-muted-foreground">Order</span>
            <span className="font-mono text-sm text-foreground">{order.orderId}</span>
            <button
              type="button"
              onClick={copyOrderId}
              className="text-muted-foreground hover:text-primary smooth ms-1"
              aria-label="Copy order ID"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="bg-background pb-32 md:pb-24">
        <div className="container-edio pt-10 md:pt-14">
          {/* Tracker */}
          <div className="bg-surface-low p-6 md:p-8 mb-10">
            <div className="flex items-center justify-between mb-5">
              <span className="label-tech text-primary">Your Order's Journey</span>
              <span className="text-[10px] font-mono text-muted-foreground">
                ETA · {fmtDate(etaStart)} – {fmtDate(etaEnd)}
              </span>
            </div>

            <div className="relative">
              {/* Dashed road */}
              <div
                className="absolute left-7 right-7 top-[18px] h-px"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(to right, hsl(var(--border) / 0.8) 0 6px, transparent 6px 12px)",
                }}
                aria-hidden
              />
              {/* Filled progress (Cart -> Details -> Confirmed) */}
              <div className="absolute left-7 top-[18px] h-px bg-primary right-7" aria-hidden />

              <ol className="relative flex items-center justify-between">
                {[
                  { icon: ShoppingBag, label: "Cart" },
                  { icon: MapPin, label: "Details" },
                  { icon: Check, label: "Confirmed" },
                  { icon: Truck, label: "Shipping" },
                  { icon: Home, label: "Doorstep" },
                ].map((stop, i) => {
                  const status = i <= 2 ? "done" : i === 3 ? "active" : "pending";
                  return (
                    <li key={stop.label} className="flex flex-col items-center gap-2">
                      <span
                        className={`relative z-10 inline-flex h-9 w-9 items-center justify-center border smooth ${
                          status === "done"
                            ? "bg-foreground border-foreground text-background"
                            : status === "active"
                              ? "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20"
                              : "bg-surface-low border-border/60 text-muted-foreground"
                        }`}
                      >
                        <stop.icon className="h-4 w-4" />
                      </span>
                      <span
                        className={`text-[10px] font-mono uppercase tracking-widest ${
                          status === "active"
                            ? "text-primary"
                            : status === "done"
                              ? "text-foreground"
                              : "text-muted-foreground"
                        }`}
                      >
                        {stop.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-14">
            {/* Left: Details */}
            <div className="space-y-8">
              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="inline-flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-primary" />
                    <p className="label-tech">Items</p>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </span>
                </div>
                <ul className="divide-y divide-border/30 border-t border-b border-border/30">
                  {detailedItems.map((i) => (
                    <li key={i.id} className="flex gap-4 py-4">
                      <div className="relative w-16 h-16 bg-surface-low shrink-0 overflow-hidden">
                        <img src={i.product.image} alt="" className="w-full h-full object-cover" />
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
                    </li>
                  ))}
                </ul>
              </div>

              {/* Delivery + Payment */}
              <div className="grid sm:grid-cols-2 gap-4">
                <InfoCard icon={MapPin} title="Delivery To">
                  {order.customer.firstName && (
                    <p className="text-sm text-foreground">
                      {[order.customer.firstName, order.customer.lastName].filter(Boolean).join(" ")}
                    </p>
                  )}
                  {order.customer.address && (
                    <p className="text-sm text-muted-foreground">{order.customer.address}</p>
                  )}
                  {order.customer.city && (
                    <p className="text-sm text-muted-foreground">{order.customer.city}</p>
                  )}
                  {order.customer.region && (
                    <p className="text-sm text-muted-foreground">{order.customer.region}</p>
                  )}
                  {order.customer.nearestPoint && (
                    <p className="text-sm text-muted-foreground">Nearest point: {order.customer.nearestPoint}</p>
                  )}
                  {order.customer.phone && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" /> {order.customer.phone}
                    </p>
                  )}
                  {order.customer.email && (
                    <p className="text-xs text-muted-foreground">{order.customer.email}</p>
                  )}
                </InfoCard>
                <InfoCard icon={Truck} title="Payment">
                  <p className="text-sm text-foreground">
                    {order.paymentMethod === "qi_card" ? "Qi Card / Master transfer" : "Cash on Delivery"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {order.paymentMethod === "qi_card"
                      ? "We will approve the order after receiving the transfer receipt on WhatsApp."
                      : `Please have ${formatPrice(order.total, lang, currency)} ready when your order arrives.`}
                  </p>
                </InfoCard>
              </div>

              {order.orderSubmission && (
                <InfoCard icon={Truck} title="edio Order Storage">
                  <p className="text-sm text-foreground">{order.orderSubmission.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Status: {order.orderSubmission.status} · Alwaseet auto-submit disabled
                  </p>
                </InfoCard>
              )}
            </div>

            {/* Right: Totals + CTAs */}
            <aside className="lg:sticky lg:top-28 self-start space-y-4">
              <div className="bg-surface-low">
                <div className="px-5 md:px-6 py-5 border-b border-border/30">
                  <p className="label-tech">Order Total</p>
                </div>
                <dl className="px-5 md:px-6 py-5 space-y-2.5 text-sm">
                  <Row label="Subtotal" value={formatPrice(order.subtotal, lang, currency)} />
                  {order.discount > 0 && (
                    <Row label="Discount" value={`− ${formatPrice(order.discount, lang, currency)}`} accent />
                  )}
                  <Row
                    label="Shipping"
                    value={order.shipping === 0 ? "Free" : formatPrice(order.shipping, lang, currency)}
                  />
                </dl>
                <div className="px-5 md:px-6 py-4 border-t border-border/30 flex items-baseline justify-between">
                  <span className="label-tech">Total</span>
                  <span className="font-mono text-2xl font-semibold">{formatPrice(order.total, lang, currency)}</span>
                </div>
              </div>

              <Link
                to="/shop"
                className="group relative w-full bg-primary hover:bg-primary-glow text-primary-foreground py-5 text-sm font-semibold uppercase tracking-widest smooth inline-flex items-center justify-center gap-3"
              >
                {t("cta.continueShopping")}
                <ArrowRight className="h-4 w-4 smooth group-hover:translate-x-1 rtl:rotate-180" />
              </Link>
              <Link
                to="/account/orders"
                className="block text-center w-full py-4 bg-surface-high hover:bg-surface-highest text-foreground text-[11px] font-semibold uppercase tracking-widest smooth"
              >
                View My Orders
              </Link>
            </aside>
          </div>
        </div>
      </section>
    </Layout>
  );
};

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`font-mono ${accent ? "text-primary" : "text-foreground"}`}>{value}</dd>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface-low p-5">
      <div className="inline-flex items-center gap-2 mb-3">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <p className="label-tech">{title}</p>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export default OrderConfirmation;
