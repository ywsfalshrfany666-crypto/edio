import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/store/auth";
import { AuthLayout, AuthInput, AuthButton, AuthUnavailableNotice } from "@/components/auth/AuthLayout";
import { useToast } from "@/hooks/use-toast";
import { AUTH_API_AVAILABLE } from "@/lib/api";
import { SUPABASE_AUTH_AVAILABLE } from "@/lib/supabaseConfig";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const resetPassword = useAuth((s) => s.resetPassword);
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError("Passwords don't match.");
    setLoading(true);
    const { error } = await resetPassword(password, token);
    setLoading(false);
    if (error) return setError(error);
    toast({ title: "Password updated", description: "Sign in with your new password." });
    navigate("/login", { replace: true });
  };

  return (
    <AuthLayout
      eyebrow="Set new password"
      seoTitle="Reset password"
      title="Choose a new one"
      subtitle={token ? "This secure reset link can be used once." : "Open the reset link from your email, then choose a new password."}
      footer={
        <Link to="/login" className="text-primary hover:text-primary-glow smooth font-medium">
          Back to sign in
        </Link>
      }
    >
      {!AUTH_API_AVAILABLE && !SUPABASE_AUTH_AVAILABLE ? (
        <AuthUnavailableNotice />
      ) : (
      <form onSubmit={onSubmit} className="space-y-5">
        <AuthInput
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <AuthInput
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && (
          <div className="border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[12px] text-red-400">
            {error}
          </div>
        )}
        <AuthButton loading={loading}>Update password</AuthButton>
      </form>
      )}
    </AuthLayout>
  );
};

export default ResetPassword;
