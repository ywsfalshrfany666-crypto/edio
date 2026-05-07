import { NavLink, Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  Boxes,
  Users,
  LogOut,
  Bell,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/store/auth";
import { Logo } from "@/components/layout/Header";
import { Seo } from "@/components/Seo";
import { cn } from "@/lib/utils";

const items = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/products", label: "Products", icon: Boxes },
  { to: "/admin/users", label: "Users", icon: Users },
];

export function AdminLayout({
  children,
  title,
  eyebrow,
  seoTitle,
}: {
  children: React.ReactNode;
  title: string;
  eyebrow?: string;
  seoTitle?: string;
}) {
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const navigate = useNavigate();
  const pageTitle = seoTitle || (title === "Dashboard" ? "Admin" : title);

  return (
    <div className="min-h-screen bg-background grid lg:grid-cols-[260px_1fr]">
      <Seo title={pageTitle} pageType="admin" description="edio admin workspace." isAdmin />
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col border-e border-border/30 bg-surface-lowest sticky top-0 h-screen">
        <div className="px-6 py-6 border-b border-border/30 flex items-center justify-between">
          <Logo />
          <span className="label-tech text-primary">Admin</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 text-sm smooth border-s-2",
                  isActive
                    ? "bg-surface-high text-foreground border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-low border-transparent",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border/30 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-low smooth"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            Back to store
          </Link>
          <button
            onClick={() => {
              signOut();
              navigate("/");
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-low smooth"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-background/85 backdrop-blur border-b border-border/30">
          <div className="flex items-center justify-between gap-4 px-6 py-4">
            <div>
              <p className="label-tech text-primary mb-0.5">{eyebrow || "Admin"}</p>
              <h1 className="font-display text-xl md:text-2xl font-bold tracking-tight">{title}</h1>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 text-muted-foreground hover:text-foreground smooth" aria-label="Notifications">
                <Bell className="h-4 w-4" />
              </button>
              {user && (
                <div className="flex items-center gap-2 pl-3 border-s border-border/30">
                  <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
                    <span className="font-display text-[11px] font-bold text-primary">
                      {user.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                    </span>
                  </div>
                  <div className="hidden md:block">
                    <p className="text-[12px] font-medium leading-tight">{user.fullName}</p>
                    <p className="text-[10px] text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Mobile nav */}
          <nav className="lg:hidden px-3 pb-3 flex gap-1 overflow-x-auto">
            {items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-2 px-3 py-2 text-[11px] font-mono uppercase tracking-widest whitespace-nowrap smooth",
                    isActive ? "bg-primary text-primary-foreground" : "bg-surface-high text-muted-foreground",
                  )
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </NavLink>
            ))}
          </nav>
        </header>

        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
