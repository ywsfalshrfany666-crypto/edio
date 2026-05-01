import { Suspense, lazy, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/i18n/config";
import { ScrollToTop } from "./components/ScrollToTop";
import { RequireAuth, RequireAdmin } from "./components/auth/Guards";
import { useAuth } from "./store/auth";

const Index = lazy(() => import("./pages/Index"));
const Shop = lazy(() => import("./pages/Shop"));
const Category = lazy(() => import("./pages/Category"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Checkout = lazy(() => import("./pages/Checkout"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation"));
const About = lazy(() => import("./pages/About"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/auth/Login"));
const Signup = lazy(() => import("./pages/auth/Signup"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const Account = lazy(() => import("./pages/account/Account"));
const Profile = lazy(() => import("./pages/account/Profile"));
const Addresses = lazy(() => import("./pages/account/Addresses"));
const Orders = lazy(() => import("./pages/account/Orders"));
const OrderDetail = lazy(() => import("./pages/account/OrderDetail"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminOrderDetail = lazy(() => import("./pages/admin/AdminOrderDetail"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen bg-background">
    <div className="container-edio py-24">
      <div className="max-w-3xl space-y-4">
        <div className="h-3 w-28 rounded-full bg-surface-highest/80" />
        <div className="h-10 w-full max-w-xl rounded-sm bg-surface-high" />
        <div className="h-4 w-full max-w-2xl rounded-full bg-surface-highest/70" />
        <div className="h-4 w-3/4 rounded-full bg-surface-highest/60" />
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-sm bg-surface-high/80" />
        ))}
      </div>
    </div>
  </div>
);

const AuthBootstrap = () => {
  const token = useAuth((s) => s.token);
  const refreshSession = useAuth((s) => s.refreshSession);

  useEffect(() => {
    if (!token) return;
    void refreshSession();
  }, [token, refreshSession]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthBootstrap />
        <ScrollToTop />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/category/:slug" element={<Category />} />
            <Route path="/category/:slug/:term" element={<Category />} />
            <Route path="/product" element={<Navigate to="/shop" replace />} />
            <Route path="/product/:slug" element={<ProductDetail />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order-confirmation" element={<OrderConfirmation />} />
            <Route path="/about" element={<About />} />

            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
            <Route path="/account/profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/account/addresses" element={<RequireAuth><Addresses /></RequireAuth>} />
            <Route path="/account/orders" element={<RequireAuth><Orders /></RequireAuth>} />
            <Route path="/account/orders/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />

            <Route path="/admin" element={<RequireAdmin><Dashboard /></RequireAdmin>} />
            <Route path="/admin/orders" element={<RequireAdmin><AdminOrders /></RequireAdmin>} />
            <Route path="/admin/orders/:id" element={<RequireAdmin><AdminOrderDetail /></RequireAdmin>} />
            <Route path="/admin/products" element={<RequireAdmin><AdminProducts /></RequireAdmin>} />
            <Route path="/admin/users" element={<RequireAdmin><AdminUsers /></RequireAdmin>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
