import { useEffect, useMemo, useState } from "react";
import { Search, Shield, ShieldOff, Ban, CheckCircle2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useToast } from "@/hooks/use-toast";
import { ApiError, type ApiUser, type Paginated, apiRequest } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { useAuth } from "@/store/auth";

type AdminUserRow = ApiUser & {
  ordersCount: number;
  totalSpent: number;
};

const AdminUsers = () => {
  const token = useAuth((s) => s.token);
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"all" | "admin" | "customer">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest<Paginated<AdminUserRow>>("/api/admin/users", {
        token,
        searchParams: { q, limit: 200 },
      });
      setUsers(result.items);
    } catch (nextError) {
      setError(nextError instanceof ApiError ? nextError.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    void loadUsers();
  }, [token, q]);

  const list = useMemo(() => {
    return users.filter((user) => (role === "all" ? true : user.role === role));
  }, [users, role]);

  const patchUser = async (id: string, patch: Partial<AdminUserRow>) => {
    if (!token) return;
    try {
      await apiRequest<ApiUser>(`/api/admin/users/${id}`, {
        method: "PATCH",
        token,
        body: patch,
      });
      await loadUsers();
    } catch (nextError) {
      toast({
        title: "Update failed",
        description: nextError instanceof ApiError ? nextError.message : "Unable to update user.",
      });
    }
  };

  const toggleRole = async (user: AdminUserRow) => {
    const nextRole = user.role === "admin" ? "customer" : "admin";
    await patchUser(user.id, { role: nextRole });
    toast({
      title: "Role updated",
      description: `${user.fullName} is now ${nextRole}.`,
    });
  };

  const toggleBan = async (user: AdminUserRow) => {
    await patchUser(user.id, { banned: !user.banned });
    toast({
      title: user.banned ? "User reinstated" : "User banned",
      description: user.email,
    });
  };

  return (
    <AdminLayout title="Users" eyebrow="People">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2">
            {(["all", "customer", "admin"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setRole(value)}
                className={cn(
                  "px-3 py-2 text-[11px] font-mono uppercase tracking-widest smooth",
                  role === value
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-high text-muted-foreground hover:text-foreground",
                )}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or email…"
              className="bg-surface-high border border-border/40 ps-9 pe-3 py-2 text-sm focus:outline-none focus:border-primary w-64"
            />
          </div>
        </div>

        {error && (
          <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="border border-border/30 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-low text-left">
              <tr className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Spent</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {loading &&
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={`loading-${index}`}>
                    <td colSpan={7} className="px-4 py-4">
                      <div className="h-12 animate-pulse bg-surface-high/70" />
                    </td>
                  </tr>
                ))}

              {!loading &&
                list.map((user) => (
                  <tr key={user.id} className="hover:bg-surface-low smooth">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center">
                          <span className="font-display text-[11px] font-bold text-primary">
                            {user.fullName
                              .split(" ")
                              .map((part) => part[0])
                              .slice(0, 2)
                              .join("")}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{user.fullName}</p>
                          <p className="text-[11px] text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "border px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest",
                          user.role === "admin"
                            ? "border-primary/40 text-primary"
                            : "border-border/40 text-muted-foreground",
                        )}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">{user.ordersCount}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{formatNumber(user.totalSpent)} IQD</td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {user.banned ? (
                        <span className="text-[11px] font-mono text-red-400">Banned</span>
                      ) : (
                        <span className="text-[11px] font-mono text-emerald-400">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => void toggleRole(user)}
                          className="p-1.5 text-muted-foreground hover:text-primary smooth"
                          title={user.role === "admin" ? "Demote to customer" : "Promote to admin"}
                        >
                          {user.role === "admin" ? (
                            <ShieldOff className="h-3.5 w-3.5" />
                          ) : (
                            <Shield className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          onClick={() => void toggleBan(user)}
                          className="p-1.5 text-muted-foreground hover:text-red-400 smooth"
                          title={user.banned ? "Reinstate" : "Ban"}
                        >
                          {user.banned ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <Ban className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

              {!loading && list.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No users match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminUsers;
