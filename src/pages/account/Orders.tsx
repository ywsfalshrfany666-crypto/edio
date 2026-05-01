import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ArrowRight } from "lucide-react";
import { AccountLayout } from "@/components/account/AccountLayout";
import { mockOrders, orderStatusMeta, type OrderStatus } from "@/data/mockOrders";
import { formatDate, formatNumber } from "@/lib/formatting";
import { cn } from "@/lib/utils";

const filters: { key: "all" | OrderStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

const Orders = () => {
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    return mockOrders.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      if (q && !o.number.toLowerCase().includes(q.toLowerCase()) && !o.items.some((i) => i.name.toLowerCase().includes(q.toLowerCase()))) return false;
      return true;
    });
  }, [filter, q]);

  return (
    <AccountLayout title="Orders" eyebrow="Account / Orders">
      <div className="space-y-5">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "px-3 py-2 text-[11px] font-mono uppercase tracking-widest smooth",
                  filter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-high text-muted-foreground hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search orders…"
              className="bg-surface-high border border-border/40 ps-9 pe-3 py-2 text-sm focus:outline-none focus:border-primary w-56"
            />
          </div>
        </div>

        {/* List */}
        {list.length === 0 ? (
          <div className="border border-border/30 py-20 text-center">
            <p className="label-tech text-primary mb-2">Nothing here</p>
            <p className="font-display text-xl font-bold">No orders match.</p>
            <p className="text-sm text-muted-foreground mt-1">Try a different filter or search.</p>
          </div>
        ) : (
          <div className="border border-border/30 divide-y divide-border/30">
            {list.map((o) => {
              const meta = orderStatusMeta[o.status];
              return (
                <Link
                  key={o.id}
                  to={`/account/orders/${o.id}`}
                  className="flex items-center justify-between gap-4 p-4 hover:bg-surface-low smooth"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-14 w-14 bg-surface-high overflow-hidden shrink-0">
                      <img src={o.items[0].image} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-[12px] text-muted-foreground">{o.number}</p>
                        <span className="text-[11px] text-muted-foreground">·</span>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDate(o.createdAt)}
                        </p>
                      </div>
                      <p className="text-sm font-medium truncate mt-0.5">
                        {o.items[0].name}
                        {o.items.length > 1 && (
                          <span className="text-muted-foreground"> +{o.items.length - 1} more</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className={cn("border px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest", meta.tone)}>
                      {meta.label}
                    </span>
                    <span className="font-mono text-sm tabular-nums hidden sm:inline">{formatNumber(o.total)} IQD</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AccountLayout>
  );
};

export default Orders;
