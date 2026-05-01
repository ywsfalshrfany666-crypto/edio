import { useState } from "react";
import { Save } from "lucide-react";
import { AccountLayout } from "@/components/account/AccountLayout";
import { useAuth } from "@/store/auth";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/formatting";

const Profile = () => {
  const user = useAuth((s) => s.user)!;
  const update = useAuth((s) => s.updateProfile);
  const loading = useAuth((s) => s.loading);
  const { toast } = useToast();

  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone || "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await update({ fullName, phone, avatarUrl });
    if (error) {
      toast({ title: "Update failed", description: error });
      return;
    }
    toast({ title: "Profile updated" });
  };

  return (
    <AccountLayout title="Profile" eyebrow="Account / Profile">
      <form onSubmit={onSubmit} className="max-w-xl space-y-6">
        <Field label="Full name" value={fullName} onChange={setFullName} required />
        <Field label="Email" value={user.email} disabled />
        <Field label="Phone" value={phone} onChange={setPhone} placeholder="+964 770 000 0000" />
        <Field
          label="Avatar URL (optional)"
          value={avatarUrl}
          onChange={setAvatarUrl}
          placeholder="https://…"
        />

        <div className="pt-2 border-t border-border/30">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-[11px] font-semibold uppercase tracking-widest hover:bg-primary-glow smooth press"
          >
            <Save className="h-3.5 w-3.5" /> Save changes
          </button>
        </div>

        <div className="border border-border/30 bg-surface-low p-5">
          <p className="label-tech text-muted-foreground mb-2">Account meta</p>
          <dl className="grid grid-cols-2 gap-3 text-[12px] font-mono">
            <dt className="text-muted-foreground">User ID</dt>
            <dd className="truncate">{user.id}</dd>
            <dt className="text-muted-foreground">Role</dt>
            <dd className="text-primary uppercase">{user.role}</dd>
            <dt className="text-muted-foreground">Member since</dt>
            <dd>{formatDate(user.createdAt)}</dd>
          </dl>
        </div>
      </form>
    </AccountLayout>
  );
};

function Field({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="block">
      <span className="label-tech mb-2 block">{label}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full bg-surface-high border border-border/40 px-4 py-3 text-sm focus:outline-none focus:border-primary disabled:opacity-60"
      />
    </label>
  );
}

export default Profile;
