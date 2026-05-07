import { useEffect, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeft, MapPin, Phone, Mail } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ApiError, type ApiOrder, apiRequest } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/formatting";
import { type OrderStatus, orderStatusFlow, orderStatusMeta } from "@/lib/orderStatus";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth";
import { useToast } from "@/hooks/use-toast";

const AdminOrderDetail = () => {
  const { id } = useParams();
  const token = useAuth((s) => s.token);
  const { toast } = useToast();
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [status, setStatus] = useState<OrderStatus>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrder = async () => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      const nextOrder = await apiRequest<ApiOrder>(`/api/admin/orders/${id}`, { token });
      setOrder(nextOrder);
      setStatus(nextOrder.status);
    } catch (nextError) {
      setError(nextError instanceof ApiError ? nextError.message : "Unable to load order.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || !id) return;
    void loadOrder();
  }, [token, id]);

  if (!id) return <Navigate to="/admin/orders" replace />;

  const updateStatus = async (next: OrderStatus) => {
    if (!token || !order) return;
    try {
      const nextOrder = await apiRequest<ApiOrder>(`/api/admin/orders/${order.id}/status`, {
        method: "PATCH",
        token,
        body: { status: next },
      });
      setOrder(nextOrder);
      setStatus(next);
      toast({
        title: "Status updated",
        description: `${nextOrder.number} → ${orderStatusMeta[next].label}`,
      });
    } catch (nextError) {
      toast({
        title: "Update failed",
        description: nextError instanceof ApiError ? nextError.message : "Unable to update order.",
      });
    }
  };

  if (!loading && !order) {
    return <Navigate to="/admin/orders" replace />;
  }

  const meta = orderStatusMeta[status];

  return (
    <AdminLayout title={order?.number || "Order"} eyebrow="Orders / Detail" seoTitle="Order details">
      <div className="space-y-6">
        <Link
          to="/admin/orders"
          className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground smooth"
        >
          <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
          Back to orders
        </Link>

        {error && (
          <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="h-72 animate-pulse bg-surface-high/70" />
            <div className="h-72 animate-pulse bg-surface-high/70" />
          </div>
        ) : order ? (
          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="space-y-5">
              <div className="border border-border/30">
                <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
                  <p className="label-tech text-muted-foreground">Items ({order.items.length})</p>
                  <p className="font-mono text-sm tabular-nums">{formatNumber(order.total)} IQD</p>
                </div>
                <div className="divide-y divide-border/30">
                  {order.items.map((item) => (
                    <div key={item.productId} className="flex items-center gap-4 p-4">
                      <div className="h-14 w-14 bg-surface-high overflow-hidden shrink-0">
                        <img src={item.image} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="label-tech text-primary text-[10px]">{item.brand}</p>
                        <p className="text-sm font-medium truncate">{item.name}</p>
                      </div>
                      <p className="text-[12px] font-mono text-muted-foreground">×{item.qty}</p>
                      <p className="font-mono text-sm tabular-nums w-32 text-end">
                        {formatNumber(item.price * item.qty)} IQD
                      </p>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 border-t border-border/30 space-y-1">
                  <Row label="Subtotal" value={`${formatNumber(order.subtotal)} IQD`} />
                  {order.discount ? (
                    <Row label="Discount" value={`-${formatNumber(order.discount)} IQD`} />
                  ) : null}
                  <Row label="Shipping" value={`${formatNumber(order.shipping)} IQD`} />
                  <Row label="Total" value={`${formatNumber(order.total)} IQD`} bold />
                </div>
              </div>

              <div className="border border-border/30 p-5">
                <p className="label-tech text-muted-foreground mb-3">Customer</p>
                <p className="font-display text-base font-semibold">{order.customerName}</p>
                <div className="mt-3 grid sm:grid-cols-2 gap-3 text-[12px] text-muted-foreground">
                  <p className="flex items-center gap-2"><Mail className="h-3 w-3" />{order.customerEmail}</p>
                  <p className="flex items-center gap-2"><Phone className="h-3 w-3" />{order.customerPhone}</p>
                  <p className="flex items-start gap-2 sm:col-span-2">
                    <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>
                      {order.shippingAddress.line1}, {order.shippingAddress.city}, {order.shippingAddress.governorate}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className={cn("border p-5", meta.tone)}>
                <p className="label-tech mb-1">Current status</p>
                <p className="font-display text-2xl font-bold">{meta.label}</p>
              </div>

              <div className="border border-border/30 bg-surface-low p-5">
                <p className="label-tech text-muted-foreground mb-3">Update status</p>
                <div className="space-y-2">
                  {orderStatusFlow.map((nextStatus) => (
                    <button
                      key={nextStatus}
                      onClick={() => void updateStatus(nextStatus)}
                      className={cn(
                        "w-full flex items-center justify-between gap-3 px-3 py-2.5 text-[12px] smooth border",
                        status === nextStatus
                          ? "bg-surface-highest border-primary text-foreground"
                          : "bg-background border-border/40 text-muted-foreground hover:text-foreground hover:border-border",
                      )}
                    >
                      <span className="font-mono uppercase tracking-widest">
                        {orderStatusMeta[nextStatus].label}
                      </span>
                      {status === nextStatus && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border border-border/30 p-5">
                <p className="label-tech text-muted-foreground mb-2">Payment</p>
                <p className="font-mono text-sm uppercase tracking-widest text-primary">Cash on Delivery</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Placed {formatDateTime(order.createdAt)}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  );
};

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn("flex justify-between text-sm", bold && "font-display font-bold pt-1 border-t border-border/30 mt-1")}>
      <span className={cn(bold ? "text-foreground" : "text-muted-foreground")}>{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}

export default AdminOrderDetail;
