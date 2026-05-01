import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/store/auth";
import { AuthLayout, AuthInput, AuthButton } from "@/components/auth/AuthLayout";

const ForgotPassword = () => {
  const requestPasswordReset = useAuth((s) => s.requestPasswordReset);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await requestPasswordReset(email);
    setLoading(false);
    if (error) return setError(error);
    setSent(true);
  };

  return (
    <AuthLayout
      eyebrow="Password reset"
      title={sent ? "Check your inbox" : "Forgot password"}
      subtitle={
        sent
          ? "If that email exists in our system, you'll get a reset link in a moment."
          : "Enter the email tied to your EDIO account and we'll send a reset link."
      }
      footer={
        <>
          Remember it?{" "}
          <Link to="/login" className="text-primary hover:text-primary-glow smooth font-medium">
            Back to sign in
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="flex items-start gap-3 border border-emerald-500/30 bg-emerald-500/10 p-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-sm text-foreground/90">
            We've sent a reset link to <span className="font-mono text-primary">{email}</span>. The
            link expires in 60 minutes.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <AuthInput
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          {error && (
            <div className="border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[12px] text-red-400">
              {error}
            </div>
          )}
          <AuthButton loading={loading}>Send reset link</AuthButton>
        </form>
      )}
    </AuthLayout>
  );
};

export default ForgotPassword;
