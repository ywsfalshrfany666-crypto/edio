import { useEffect, useState } from "react";
import { Plus, Trash2, Star, MapPin } from "lucide-react";
import { AccountLayout } from "@/components/account/AccountLayout";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ApiError, apiRequest } from "@/lib/api";
import { useAuth } from "@/store/auth";

type Address = {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  city: string;
  governorate: string;
  notes?: string;
  isDefault: boolean;
};

const Addresses = () => {
  const { toast } = useToast();
  const token = useAuth((s) => s.token);
  const [list, setList] = useState<Address[]>([]);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Omit<Address, "id" | "isDefault">>({
    label: "",
    fullName: "",
    phone: "",
    line1: "",
    city: "",
    governorate: "",
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) return;
      try {
        setLoading(true);
        const items = await apiRequest<Address[]>("/api/me/addresses", { token });
        if (!cancelled) setList(items);
      } catch (error) {
        toast({ title: "Unable to load addresses", description: error instanceof ApiError ? error.message : "Try again." });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token, toast]);

  const addAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const next = await apiRequest<Address>("/api/me/addresses", {
        method: "POST",
        token,
        body: { ...draft, isDefault: list.length === 0 },
      });
      setList((l) => [...l, next]);
      setAdding(false);
      setDraft({ label: "", fullName: "", phone: "", line1: "", city: "", governorate: "" });
      toast({ title: "Address added" });
    } catch (error) {
      toast({ title: "Address failed", description: error instanceof ApiError ? error.message : "Try again." });
    }
  };

  const remove = async (id: string) => {
    if (!token) return;
    try {
      await apiRequest<{ deleted: boolean }>(`/api/me/addresses/${id}`, { method: "DELETE", token });
      setList((l) => l.filter((a) => a.id !== id));
      toast({ title: "Address removed" });
    } catch (error) {
      toast({ title: "Remove failed", description: error instanceof ApiError ? error.message : "Try again." });
    }
  };

  const setDefault = async (id: string) => {
    if (!token) return;
    try {
      const updated = await apiRequest<Address>(`/api/me/addresses/${id}`, {
        method: "PATCH",
        token,
        body: { isDefault: true },
      });
      setList((l) => l.map((a) => ({ ...a, isDefault: a.id === updated.id })));
    } catch (error) {
      toast({ title: "Default failed", description: error instanceof ApiError ? error.message : "Try again." });
    }
  };

  return (
    <AccountLayout title="Addresses" eyebrow="Account / Addresses">
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {loading && <p className="text-sm text-muted-foreground">Loading saved addresses…</p>}
          {list.map((a) => (
            <div
              key={a.id}
              className={cn(
                "p-5 border smooth",
                a.isDefault ? "border-primary/50 bg-surface-high" : "border-border/30 bg-surface-low",
              )}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <p className="font-display text-sm font-semibold">{a.label}</p>
                  {a.isDefault && (
                    <span className="label-tech text-primary text-[9px] border border-primary/40 px-1.5 py-0.5">
                      Default
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!a.isDefault && (
                    <button
                      onClick={() => setDefault(a.id)}
                      className="p-1.5 text-muted-foreground hover:text-primary smooth"
                      title="Set as default"
                    >
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => remove(a.id)}
                    className="p-1.5 text-muted-foreground hover:text-red-400 smooth"
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-sm">{a.fullName}</p>
              <p className="text-[12px] text-muted-foreground mt-1">{a.phone}</p>
              <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed">
                {a.line1}
                <br />
                {a.city}, {a.governorate}
              </p>
            </div>
          ))}

          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="border border-dashed border-border/50 hover:border-primary p-5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary smooth min-h-[180px]"
            >
              <Plus className="h-5 w-5" />
              <span className="label-tech">Add address</span>
            </button>
          )}
        </div>

        {adding && (
          <form onSubmit={addAddress} className="border border-border/30 bg-surface-low p-5 grid gap-4 sm:grid-cols-2">
            <Mini label="Label" value={draft.label} onChange={(v) => setDraft({ ...draft, label: v })} placeholder="Home, Office…" required />
            <Mini label="Full name" value={draft.fullName} onChange={(v) => setDraft({ ...draft, fullName: v })} autoComplete="name" required />
            <Mini label="Phone" value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} autoComplete="tel" required />
            <Mini label="Address line" value={draft.line1} onChange={(v) => setDraft({ ...draft, line1: v })} autoComplete="address-line1" required />
            <Mini label="City" value={draft.city} onChange={(v) => setDraft({ ...draft, city: v })} autoComplete="address-level2" required />
            <Mini label="Governorate" value={draft.governorate} onChange={(v) => setDraft({ ...draft, governorate: v })} autoComplete="address-level1" required />
            <div className="sm:col-span-2 flex items-center gap-3 pt-2">
              <button type="submit" className="bg-primary text-primary-foreground px-5 py-2.5 text-[11px] font-semibold uppercase tracking-widest hover:bg-primary-glow smooth press">
                Save address
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground smooth"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </AccountLayout>
  );
};

function Mini({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="block">
      <span className="label-tech mb-1.5 block">{label}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-background border border-border/40 px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
      />
    </label>
  );
}

export default Addresses;
