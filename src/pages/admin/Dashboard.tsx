import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  ShoppingBag,
  Users,
  Package,
  ArrowUpRight,
  ArrowRight,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ApiError, type ApiOrder, type ApiProduct, type Paginated, apiRequest } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/formatting";
import { orderStatusMeta } from "@/lib/orderStatus";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth";

type DashboardData = {
  totalRevenue: number;
  pendingOrders: number;
  activeUsers: number;
  lowStock: number;
  productCount: number;
  orderCount: number;
  recentOrders: ApiOrder[];
};

const Dashboard = () => {
  const token = useAuth((s) => s.token);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [topProducts, setTopProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [dashboardData, ordersData, productsData] = await Promise.all([
          apiRequest<DashboardData>("/api/admin/dashboard", { token }),
          apiRequest<Paginated<ApiOrder>>("/api/admin/orders", {
            token,
            searchParams: { limit: 200 },
          }),
          apiRequest<Paginated<ApiProduct>>("/api/admin/products", {
            token,
            searchParams: { limit: 5, sort: "best-selling" },
          }),
        ]);
        if (cancelled) return;
        setDashboard(dashboardData);
        setOrders(ordersData.items);
        setTopProducts(productsData.items);
      } catch (nextError) {
        if (cancelled) return;
        setError(nextError instanceof ApiError ? nextError.message : "Unable to load dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const deliveredCount = useMemo(
    () => orders.filter((order) => order.status === "delivered").length,
    [orders],
  );

  const days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, index) => {
      const day = new Date(Date.now() - (6 - index) * 86400000);
      const dayOrders = orders.filter(
        (order) =>
          new Date(order.createdAt).toDateString() === day.toDateString() &&
          order.status !== "cancelled",
      );
      return {
        date: day,
        revenue: dayOrders.reduce((sum, order) => sum + order.total, 0),
      };
    });
  }, [orders]);

  const max = Math.max(1, ...days.map((day) => day.revenue));

  const stats = dashboard
    ? [
        {
          label: "Revenue (all time)",
          value: `${formatNumber(dashboard.totalRevenue)} IQD`,
          icon: TrendingUp,
          delta: `${formatNumber(days[6]?.revenue || 0)} today`,
          tone: "text-emerald-400",
        },
        {
          label: "Total orders",
          value: dashboard.orderCount.toString(),
          icon: ShoppingBag,
          delta: `${dashboard.pendingOrders} pending`,
          tone: "text-amber-400",
        },
        {
          label: "Delivered",
          value: deliveredCount.toString(),
          icon: Package,
          delta: orders.length ? `${Math.round((deliveredCount / orders.length) * 100)}% rate` : "0% rate",
          tone: "text-sky-400",
        },
        {
          label: "Active users",
          value: dashboard.activeUsers.toString(),
          icon: Users,
          delta: `${dashboard.lowStock} low stock`,
          tone: "text-primary",
        },
      ]
    : [];

  return (
    <AdminLayout title="Dashboard" eyebrow="Overview">
      <div className="space-y-8">
        {error && (
          <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(loading ? Array.from({ length: 4 }) : stats).map((item, index) =>
            loading ? (
              <div key={index} className="h-32 animate-pulse bg-surface-high/70" />
            ) : (
              <div key={item.label} className="border border-border/30 bg-surface-low p-5">
                <div className="flex items-start justify-between mb-4">
                  <item.icon className="h-4 w-4 text-primary" />
                  <span className={cn("text-[10px] font-mono uppercase tracking-widest", item.tone)}>
                    {item.delta}
                  </span>
                </div>
                <p className="font-display text-2xl font-bold tabular-nums">{item.value}</p>
                <p className="text-[12px] text-muted-foreground mt-1">{item.label}</p>
              </div>
            ),
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 border border-border/30 bg-surface-low p-5">
            <div className="flex items-end justify-between mb-6">
              <div>
                <p className="label-tech text-primary mb-1">Revenue</p>
                <h2 className="font-display text-lg font-bold">Last 7 days</h2>
              </div>
              <p className="text-[11px] font-mono text-muted-foreground">IQD</p>
            </div>
            <div className="h-48 flex items-end gap-2">
              {days.map((day, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full bg-surface-high relative h-full flex items-end">
                    <div
                      className="w-full bg-primary transition-all duration-700"
                      style={{ height: `${(day.revenue / max) * 100}%` }}
                      title={`${formatNumber(day.revenue)} IQD`}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {formatDate(day.date, "en", { weekday: "short" })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border/30 bg-surface-low p-5">
            <div className="flex items-end justify-between mb-4">
              <div>
                <p className="label-tech text-primary mb-1">Best sellers</p>
                <h2 className="font-display text-lg font-bold">Top 5</h2>
              </div>
            </div>
            <ul className="space-y-3">
              {topProducts.map((product, index) => (
                <li key={product.id} className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-muted-foreground w-4">{index + 1}</span>
                  <div className="h-8 w-8 bg-background overflow-hidden shrink-0">
                    <img src={product.image} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium truncate">{product.name.en}</p>
                    <p className="text-[10px] text-muted-foreground">{product.brand}</p>
                  </div>
                  <span className="font-mono text-[11px] tabular-nums">×{product.sales}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="label-tech text-primary mb-1">Activity</p>
              <h2 className="font-display text-lg font-bold">Recent orders</h2>
            </div>
            <Link
              to="/admin/orders"
              className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary smooth inline-flex items-center gap-1"
            >
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="border border-border/30 divide-y divide-border/30">
            {(dashboard?.recentOrders || []).map((order) => {
              const meta = orderStatusMeta[order.status];
              return (
                <Link
                  key={order.id}
                  to={`/admin/orders/${order.id}`}
                  className="flex items-center justify-between gap-4 p-4 hover:bg-surface-low smooth"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 bg-surface-high overflow-hidden shrink-0">
                      <img src={order.items[0]?.image} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-muted-foreground">{order.number}</p>
                      <p className="text-sm font-medium truncate">{order.customerName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className={cn("hidden sm:inline border px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest", meta.tone)}>
                      {meta.label}
                    </span>
                    <span className="font-mono text-sm tabular-nums">{formatNumber(order.total)} IQD</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground rtl:rotate-180" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
