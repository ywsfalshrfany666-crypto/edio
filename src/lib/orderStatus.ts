import type { ApiOrderStatus } from "@/lib/api";

export type OrderStatus = ApiOrderStatus;

export const orderStatusMeta: Record<
  OrderStatus,
  { label: string; tone: string }
> = {
  pending: { label: "Pending", tone: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  confirmed: { label: "Confirmed", tone: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  shipped: { label: "Shipped", tone: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  delivered: { label: "Delivered", tone: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  cancelled: { label: "Cancelled", tone: "bg-red-500/15 text-red-400 border-red-500/30" },
};

export const orderStatusFlow: OrderStatus[] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];
