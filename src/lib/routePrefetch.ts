const routeLoaders = {
  home: () => import("@/pages/Index"),
  shop: () => import("@/pages/Shop"),
  category: () => import("@/pages/Category"),
  product: () => import("@/pages/ProductDetail"),
  checkout: () => import("@/pages/Checkout"),
  about: () => import("@/pages/About"),
  login: () => import("@/pages/auth/Login"),
  signup: () => import("@/pages/auth/Signup"),
  forgotPassword: () => import("@/pages/auth/ForgotPassword"),
  resetPassword: () => import("@/pages/auth/ResetPassword"),
  account: () => import("@/pages/account/Account"),
  profile: () => import("@/pages/account/Profile"),
  addresses: () => import("@/pages/account/Addresses"),
  orders: () => import("@/pages/account/Orders"),
  orderDetail: () => import("@/pages/account/OrderDetail"),
  admin: () => import("@/pages/admin/Dashboard"),
  adminOrders: () => import("@/pages/admin/AdminOrders"),
  adminOrderDetail: () => import("@/pages/admin/AdminOrderDetail"),
  adminProducts: () => import("@/pages/admin/AdminProducts"),
  adminUsers: () => import("@/pages/admin/AdminUsers"),
} as const;

type LoaderKey = keyof typeof routeLoaders;

const prefetched = new Set<LoaderKey>();

function prefetchKey(key: LoaderKey) {
  if (prefetched.has(key)) return;
  prefetched.add(key);
  void routeLoaders[key]();
}

function resolveRouteKeys(to: string): LoaderKey[] {
  const [path] = to.split("?");

  if (path === "/") return ["home"];
  if (path === "/shop") return ["shop"];
  if (path.startsWith("/category/")) return ["category"];
  if (path.startsWith("/product/")) return ["product"];
  if (path === "/checkout") return ["checkout"];
  if (path === "/about") return ["about"];
  if (path === "/login") return ["login"];
  if (path === "/signup") return ["signup"];
  if (path === "/forgot-password") return ["forgotPassword"];
  if (path === "/reset-password") return ["resetPassword"];
  if (path === "/account") return ["account"];
  if (path === "/account/profile") return ["profile"];
  if (path === "/account/addresses") return ["addresses"];
  if (path === "/account/orders") return ["orders"];
  if (path.startsWith("/account/orders/")) return ["orderDetail"];
  if (path === "/admin") return ["admin"];
  if (path === "/admin/orders") return ["adminOrders"];
  if (path.startsWith("/admin/orders/")) return ["adminOrderDetail"];
  if (path === "/admin/products") return ["adminProducts"];
  if (path === "/admin/users") return ["adminUsers"];

  return [];
}

export function prefetchRoute(to: string) {
  resolveRouteKeys(to).forEach(prefetchKey);
}

export function createRoutePrefetchHandlers(to: string) {
  const trigger = () => prefetchRoute(to);

  return {
    onMouseEnter: trigger,
    onFocus: trigger,
    onTouchStart: trigger,
  };
}
