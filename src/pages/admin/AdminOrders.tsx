import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Download, ArrowRight } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ApiError, type ApiOrder, type Paginated, apiRequest } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/formatting";
import { type OrderStatus, orderStatusMeta } from "@/lib/orderStatus";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth";

const filters: { key: "all" | OrderStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

const AdminOrders = () => {
  const token = useAuth((s) => s.token);
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [q, setQ] = useState("");
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest<Paginated<ApiOrder>>("/api/admin/orders", {
        token,
        searchParams: {
          limit: 200,
          q,
          status: filter !== "all" ? filter : undefined,
        },
      });
      setOrders(result.items);
    } catch (nextError) {
      setError(nextError instanceof ApiError ? nextError.message : "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    void loadOrders();
  }, [token, q, filter]);

  const totals = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    filters.forEach((item) => {
      if (item.key !== "all") {
        counts[item.key] = orders.filter((order) => order.status === item.key).length;
      }
    });
    return counts;
  }, [orders]);

  const exportOrders = () => {
    const blob = new Blob([JSON.stringify(orders, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "edio-admin-orders.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout title="Orders" eyebrow="Manage">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {filters.map((item) => (
              <button
                key={item.key}
                onClick={() => setFilter(item.key)}
                className={cn(
                  "px-3 py-2 text-[11px] font-mono uppercase tracking-widest smooth inline-flex items-center gap-2",
                  filter === item.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-high text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
                <span className="opacity-60">{totals[item.key] || 0}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search number, customer…"
                className="bg-surface-high border border-border/40 ps-9 pe-3 py-2 text-sm focus:outline-none focus:border-primary w-64"
              />
            </div>
            <button
              onClick={exportOrders}
              className="inline-flex items-center gap-2 bg-surface-high border border-border/40 px-3 py-2 text-[11px] font-mono uppercase tracking-widest hover:bg-surface-highest smooth"
            >
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
        </div>

        {error && (
          <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="border border-border/30 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-low text-left">
              <tr className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {loading &&
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={`loading-${index}`}>
                    <td colSpan={7} className="px-4 py-4">
                      <div className="h-12 animate-pulse bg-surface-high/70" />
                    </td>
                  </tr>
                ))}

              {!loading &&
                orders.map((order) => {
                  const meta = orderStatusMeta[order.status];
                  return (
                    <tr key={order.id} className="hover:bg-surface-low smooth">
                      <td className="px-4 py-3 font-mono text-[12px]">{order.number}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{order.customerName}</div>
                        <div className="text-[11px] text-muted-foreground">{order.customerEmail}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {order.items.length} item{order.items.length > 1 ? "s" : ""}
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums">{formatNumber(order.total)} IQD</td>
                      <td className="px-4 py-3">
                        <span className={cn("border px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest", meta.tone)}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <Link
                          to={`/admin/orders/${order.id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-widest text-primary hover:text-primary-glow smooth"
                        >
                          Open <ArrowRight className="h-3 w-3 rtl:rotate-180" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}

              {!loading && orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No orders match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminOrders;
