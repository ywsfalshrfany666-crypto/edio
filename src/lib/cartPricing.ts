import type { Coupon } from "@/store/cart";

export function getCartDiscount(subtotal: number, coupon: Coupon | null) {
  if (!coupon) return 0;
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) return 0;
  if (coupon.type === "percent") return Math.round((subtotal * coupon.value) / 100);
  return Math.min(coupon.value, subtotal);
}

export function getCartTotal(subtotal: number, coupon: Coupon | null) {
  return Math.max(0, subtotal - getCartDiscount(subtotal, coupon));
}
