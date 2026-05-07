import { Link } from "react-router-dom";
import { ArrowRight, Package, MapPin, User, ShieldCheck } from "lucide-react";
import { AccountLayout } from "@/components/account/AccountLayout";
import { useAuth } from "@/store/auth";
import { mockOrders, orderStatusMeta } from "@/data/mockOrders";
import { formatNumber } from "@/lib/formatting";
import { cn } from "@/lib/utils";

const Account = () => {
  const user = useAuth((s) => s.user)!;
  // Show last 3 mock orders as the user's recent activity
  const recent = mockOrders.slice(0, 3);

  const cards = [
    { to: "/account/profile", icon: User, title: "Profile", desc: "Name, phone, avatar" },
    { to: "/account/addresses", icon: MapPin, title: "Addresses", desc: "Saved shipping details" },
    { to: "/account/orders", icon: Package, title: "Orders", desc: `${mockOrders.length} total` },
  ];

  return (
    <AccountLayout title={`Hi, ${user.fullName.split(" ")[0]}`} eyebrow="Overview" seoTitle="Account">
      <div className="space-y-10">
        {/* Quick cards */}
        <div className="grid gap-3 sm:grid-cols-3">
          {cards.map(({ to, icon: Icon, title, desc }) => (
            <Link
              key={to}
              to={to}
              className="group bg-surface-low border border-border/30 p-5 hover:border-primary/40 hover:bg-surface-high smooth"
            >
              <div className="flex items-center justify-between mb-4">
                <Icon className="h-5 w-5 text-primary" />
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 rtl:group-hover:-translate-x-1 smooth rtl:rotate-180" />
              </div>
              <p className="font-display text-base font-semibold">{title}</p>
              <p className="text-[12px] text-muted-foreground mt-1">{desc}</p>
            </Link>
          ))}
        </div>

        {/* Recent orders */}
        <div>
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="label-tech text-primary mb-1">Activity</p>
              <h2 className="font-display text-xl font-bold">Recent orders</h2>
            </div>
            <Link
              to="/account/orders"
              className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary smooth inline-flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3 rtl:rotate-180" />
            </Link>
          </div>

          <div className="border border-border/30 divide-y divide-border/30">
            {recent.map((o) => {
              const meta = orderStatusMeta[o.status];
              return (
                <Link
                  key={o.id}
                  to={`/account/orders/${o.id}`}
                  className="flex items-center justify-between gap-4 p-4 hover:bg-surface-low smooth"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-12 w-12 bg-surface-high overflow-hidden shrink-0">
                      <img src={o.items[0].image} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-[12px] text-muted-foreground">{o.number}</p>
                      <p className="text-sm font-medium truncate">
                        {o.items[0].name}
                        {o.items.length > 1 && (
                          <span className="text-muted-foreground"> +{o.items.length - 1} more</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className={cn("hidden sm:inline-flex border px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest", meta.tone)}>
                      {meta.label}
                    </span>
                    <span className="font-mono text-sm tabular-nums">{formatNumber(o.total)} IQD</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Trust footer */}
        <div className="border border-border/30 p-5 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-display text-sm font-semibold">Your data is yours</p>
            <p className="text-[12px] text-muted-foreground mt-1">
              edio never shares your contact info. Sign out from any device under{" "}
              <span className="text-foreground">Profile</span>.
            </p>
          </div>
        </div>
      </div>
    </AccountLayout>
  );
};

export default Account;
