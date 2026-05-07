/**
 * Mock orders & users for UI demonstration.
 * Replace with real DB queries once a backend is wired up.
 */
import { products } from "./catalog";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled";

export type OrderItem = {
  productId: string;
  name: string;
  brand: string;
  image: string;
  price: number;
  qty: number;
};

export type Order = {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: {
    line1: string;
    city: string;
    governorate: string;
    notes?: string;
  };
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  paymentMethod: "cod";
  createdAt: string;
};

const sample = (n: number) => products.slice(0, Math.min(products.length, n));

const mkItems = (count: number): OrderItem[] =>
  sample(count).map((p, i) => ({
    productId: p.id,
    name: p.name.en,
    brand: p.brand,
    image: p.image,
    price: p.price,
    qty: i === 0 ? 1 : ((i % 2) + 1),
  }));

const total = (items: OrderItem[], shipping = 5000) => {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  return { subtotal, shipping, total: subtotal + shipping };
};

const order = (
  i: number,
  status: OrderStatus,
  daysAgo: number,
  customerOverride?: Partial<Order>,
): Order => {
  const items = mkItems((i % 3) + 1);
  const t = total(items);
  return {
    id: `ord_${String(1000 + i)}`,
    number: `EDIO-${String(2400 + i).padStart(5, "0")}`,
    customerId: `usr_${String(100 + (i % 7))}`,
    customerName: ["Ahmed Hassan", "Sara Mohammed", "Omar Khalil", "Layla Ali", "Mustafa Saleh", "Noor Jaber", "Karim Aziz"][i % 7],
    customerEmail: ["ahmed@example.com", "sara@example.com", "omar@example.com", "layla@example.com", "mustafa@example.com", "noor@example.com", "karim@example.com"][i % 7],
    customerPhone: "+964 770 " + String(1000000 + i * 1234).slice(0, 7),
    shippingAddress: {
      line1: ["Al-Mansour, Block 12, House 4", "Karrada, Street 24", "Erbil, Italian Village 5", "Basra, Al-Jazair Street", "Iraq"][i % 5],
      city: ["Baghdad", "Baghdad", "Erbil", "Basra", "Iraq"][i % 5],
      governorate: ["Baghdad", "Baghdad", "Erbil", "Basra", "Iraq"][i % 5],
    },
    items,
    ...t,
    status,
    paymentMethod: "cod",
    createdAt: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    ...customerOverride,
  };
};

export const mockOrders: Order[] = [
  order(0, "pending", 0),
  order(1, "confirmed", 1),
  order(2, "shipped", 2),
  order(3, "delivered", 5),
  order(4, "delivered", 7),
  order(5, "cancelled", 8),
  order(6, "pending", 0),
  order(7, "shipped", 3),
  order(8, "delivered", 11),
  order(9, "delivered", 14),
  order(10, "confirmed", 1),
  order(11, "delivered", 18),
];

export type AdminUser = {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "customer";
  banned: boolean;
  createdAt: string;
  ordersCount: number;
  totalSpent: number;
};

export const mockUsers: AdminUser[] = [
  { id: "usr_100", email: "ahmed@example.com", fullName: "Ahmed Hassan", role: "customer", banned: false, createdAt: new Date(Date.now() - 30 * 86400000).toISOString(), ordersCount: 4, totalSpent: 890000 },
  { id: "usr_101", email: "sara@example.com", fullName: "Sara Mohammed", role: "customer", banned: false, createdAt: new Date(Date.now() - 22 * 86400000).toISOString(), ordersCount: 2, totalSpent: 320000 },
  { id: "usr_102", email: "omar@example.com", fullName: "Omar Khalil", role: "customer", banned: false, createdAt: new Date(Date.now() - 15 * 86400000).toISOString(), ordersCount: 3, totalSpent: 1240000 },
  { id: "usr_103", email: "layla@example.com", fullName: "Layla Ali", role: "customer", banned: true, createdAt: new Date(Date.now() - 12 * 86400000).toISOString(), ordersCount: 1, totalSpent: 79000 },
  { id: "usr_104", email: "mustafa@example.com", fullName: "Mustafa Saleh", role: "customer", banned: false, createdAt: new Date(Date.now() - 8 * 86400000).toISOString(), ordersCount: 2, totalSpent: 560000 },
  { id: "usr_105", email: "noor@example.com", fullName: "Noor Jaber", role: "customer", banned: false, createdAt: new Date(Date.now() - 5 * 86400000).toISOString(), ordersCount: 1, totalSpent: 199000 },
  { id: "usr_admin", email: "admin@edio.iq", fullName: "EDIO Admin", role: "admin", banned: false, createdAt: new Date(Date.now() - 90 * 86400000).toISOString(), ordersCount: 0, totalSpent: 0 },
];

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
];
