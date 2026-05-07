import { Navigate, useLocation } from "react-router-dom";
import { AUTH_API_AVAILABLE } from "@/lib/api";
import { useAuth } from "@/store/auth";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (!AUTH_API_AVAILABLE) {
    return <Navigate to="/account" replace />;
  }
  if (!["admin", "super_admin"].includes(user.role)) {
    return <Navigate to="/account" replace />;
  }
  return <>{children}</>;
}
