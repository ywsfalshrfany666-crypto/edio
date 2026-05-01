import { NavLink, useNavigate } from "react-router-dom";
import { LogOut, User, MapPin, Package, LayoutDashboard } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/store/auth";
import { cn } from "@/lib/utils";

const items = [
  { to: "/account", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/account/profile", label: "Profile", icon: User },
  { to: "/account/addresses", label: "Addresses", icon: MapPin },
  { to: "/account/orders", label: "Orders", icon: Package },
];

export function AccountLayout({ children, title, eyebrow }: { children: React.ReactNode; title: string; eyebrow?: string }) {
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const navigate = useNavigate();

  return (
    <Layout>
      <section className="bg-surface-lowest border-b border-border/30 pt-28 pb-8">
        <div className="container-edio">
          <p className="label-tech text-primary mb-2">{eyebrow || "My account"}</p>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
              {title}
            </h1>
            {user && (
              <div className="flex items-center gap-3">
                <div className="text-end hidden sm:block">
                  <p className="text-sm font-medium">{user.fullName}</p>
                  <p className="text-[11px] text-muted-foreground">{user.email}</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
                  <span className="font-display text-sm font-bold text-primary">
                    {user.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-background py-10 md:py-14">
        <div className="container-edio grid gap-8 lg:grid-cols-[240px_1fr]">
          <aside>
            <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
              {items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex items-center gap-3 px-4 py-2.5 text-sm whitespace-nowrap smooth border-s-2",
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
              {user?.role === "admin" && (
                <NavLink
                  to="/admin"
                  className="inline-flex items-center gap-3 px-4 py-2.5 text-sm border-s-2 border-transparent text-primary hover:bg-surface-low smooth"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Admin dashboard
                </NavLink>
              )}
              <button
                onClick={() => {
                  signOut();
                  navigate("/");
                }}
                className="inline-flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-surface-low smooth border-s-2 border-transparent text-start"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </nav>
          </aside>

          <div className="min-w-0">{children}</div>
        </div>
      </section>
    </Layout>
  );
}
