import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeft, MapPin, Phone, Mail, Truck, CheckCircle2, Clock, Package, XCircle } from "lucide-react";
import { AccountLayout } from "@/components/account/AccountLayout";
import { mockOrders, orderStatusMeta, orderStatusFlow, type OrderStatus } from "@/data/mockOrders";
import { formatDateTime, formatNumber } from "@/lib/formatting";
import { cn } from "@/lib/utils";

const stepIcons: Record<OrderStatus, React.ElementType> = {
  pending: Clock,
  confirmed: CheckCircle2,
  shipped: Truck,
  delivered: Package,
  cancelled: XCircle,
};

const OrderDetail = () => {
  const { id } = useParams();
  const order = mockOrders.find((o) => o.id === id);

  if (!order) return <Navigate to="/account/orders" replace />;

  const meta = orderStatusMeta[order.status];
  const currentStep = orderStatusFlow.indexOf(order.status as OrderStatus);

  return (
    <AccountLayout title={order.number} eyebrow="Account / Orders / Detail" seoTitle="Order details">
      <div className="space-y-8">
        <Link
          to="/account/orders"
          className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground smooth"
        >
          <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
          Back to orders
        </Link>

        {/* Status banner */}
        <div className={cn("border p-5 flex items-center justify-between gap-4 flex-wrap", meta.tone)}>
          <div>
            <p className="label-tech mb-1">Order status</p>
            <p className="font-display text-2xl font-bold">{meta.label}</p>
          </div>
          <p className="text-[12px] font-mono">
            Placed {formatDateTime(order.createdAt)}
          </p>
        </div>

        {/* Progress */}
        {order.status !== "cancelled" && (
          <div>
            <p className="label-tech text-muted-foreground mb-4">Progress</p>
            <ol className="grid grid-cols-4 gap-2">
              {orderStatusFlow.map((s, i) => {
                const Icon = stepIcons[s];
                const reached = i <= currentStep;
                return (
                  <li key={s} className="text-center">
                    <div
                      className={cn(
                        "mx-auto h-9 w-9 flex items-center justify-center border smooth",
                        reached
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-surface-high text-muted-foreground border-border/40",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <p
                      className={cn(
                        "mt-2 text-[10px] font-mono uppercase tracking-widest",
                        reached ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {orderStatusMeta[s].label}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* Items */}
        <div>
          <p className="label-tech text-muted-foreground mb-3">Items</p>
          <div className="border border-border/30 divide-y divide-border/30">
            {order.items.map((it) => (
              <div key={it.productId} className="flex items-center gap-4 p-4">
                <div className="h-14 w-14 bg-surface-high overflow-hidden shrink-0">
                  <img src={it.image} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="label-tech text-primary text-[10px]">{it.brand}</p>
                  <p className="text-sm font-medium truncate">{it.name}</p>
                </div>
                <p className="text-[12px] font-mono text-muted-foreground">×{it.qty}</p>
                <p className="font-mono text-sm tabular-nums">{formatNumber(it.price * it.qty)} IQD</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Shipping */}
          <div className="border border-border/30 p-5">
            <p className="label-tech text-muted-foreground mb-3 flex items-center gap-2">
              <MapPin className="h-3 w-3" /> Shipping address
            </p>
            <p className="text-sm font-medium">{order.customerName}</p>
            <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
              {order.shippingAddress.line1}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.governorate}
            </p>
            <div className="mt-3 pt-3 border-t border-border/30 space-y-1.5 text-[12px] text-muted-foreground">
              <p className="flex items-center gap-2"><Phone className="h-3 w-3" />{order.customerPhone}</p>
              <p className="flex items-center gap-2"><Mail className="h-3 w-3" />{order.customerEmail}</p>
            </div>
          </div>

          {/* Totals */}
          <div className="border border-border/30 p-5">
            <p className="label-tech text-muted-foreground mb-3">Summary</p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-mono tabular-nums">{formatNumber(order.subtotal)} IQD</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd className="font-mono tabular-nums">{formatNumber(order.shipping)} IQD</dd>
              </div>
              <div className="flex justify-between pt-3 border-t border-border/30">
                <dt className="font-display font-semibold">Total</dt>
                <dd className="font-display text-lg font-bold tabular-nums">{formatNumber(order.total)} IQD</dd>
              </div>
            </dl>
            <p className="mt-4 text-[11px] font-mono uppercase tracking-widest text-primary">
              Cash on Delivery
            </p>
          </div>
        </div>
      </div>
    </AccountLayout>
  );
};

export default OrderDetail;
