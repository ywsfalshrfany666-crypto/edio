import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = { id: string; quantity: number };

export type Coupon = {
  code: string;
  type: "percent" | "fixed";
  value: number;
  label: string;
  minSubtotal?: number;
};

// Demo coupons — in production, validate server-side
export const COUPONS: Record<string, Coupon> = {
  WELCOME10: { code: "WELCOME10", type: "percent", value: 10, label: "10% off your order" },
  EDIO20: { code: "EDIO20", type: "percent", value: 20, label: "20% off — members", minSubtotal: 200000 },
  SOUND50K: { code: "SOUND50K", type: "fixed", value: 50000, label: "50,000 IQD off", minSubtotal: 300000 },
};

export type CouponResult =
  | { ok: true; coupon: Coupon }
  | { ok: false; error: "invalid" | "minSubtotal" };

type CartState = {
  items: CartItem[];
  isOpen: boolean;
  coupon: Coupon | null;
  add: (id: string, qty?: number) => void;
  remove: (id: string) => void;
  update: (id: string, qty: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
  applyCoupon: (code: string, subtotal: number) => CouponResult;
  removeCoupon: () => void;
  count: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      coupon: null,
      add: (id, qty = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.id === id);
          if (existing) {
            return { items: s.items.map((i) => (i.id === id ? { ...i, quantity: i.quantity + qty } : i)), isOpen: true };
          }
          return { items: [...s.items, { id, quantity: qty }], isOpen: true };
        }),
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      update: (id, qty) =>
        set((s) => ({ items: qty <= 0 ? s.items.filter((i) => i.id !== id) : s.items.map((i) => (i.id === id ? { ...i, quantity: qty } : i)) })),
      clear: () => set({ items: [], coupon: null }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      applyCoupon: (raw, subtotal) => {
        const code = raw.trim().toUpperCase();
        const coupon = COUPONS[code];
        if (!coupon) return { ok: false, error: "invalid" };
        if (coupon.minSubtotal && subtotal < coupon.minSubtotal) {
          return { ok: false, error: "minSubtotal" };
        }
        set({ coupon });
        return { ok: true, coupon };
      },
      removeCoupon: () => set({ coupon: null }),
      count: () => get().items.reduce((n, i) => n + i.quantity, 0),
    }),
    { name: "edio-cart" },
  ),
);
