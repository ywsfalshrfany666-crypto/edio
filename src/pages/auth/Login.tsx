import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/store/auth";
import { AuthLayout, AuthInput, AuthButton } from "@/components/auth/AuthLayout";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const signIn = useAuth((s) => s.signIn);
  const loading = useAuth((s) => s.loading);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = (location.state as { from?: string })?.from || "/account";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error } = await signIn(email, password);
    if (error) {
      setError(error);
      return;
    }
    toast({ title: "Welcome back", description: "You're signed in." });
    navigate(redirectTo, { replace: true });
  };

  return (
    <AuthLayout
      eyebrow="Sign in"
      title="Welcome back"
      subtitle="Sign in to track orders, manage addresses, and audition first."
      footer={
        <>
          New to EDIO?{" "}
          <Link to="/signup" className="text-primary hover:text-primary-glow smooth font-medium">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <AuthInput
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="label-tech">Password</span>
            <Link
              to="/forgot-password"
              className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary smooth"
            >
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-high border border-border/40 px-4 py-3 pe-11 text-sm focus:outline-none focus:border-primary focus:bg-surface-highest transition-colors duration-200"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPwd((s) => !s)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground smooth"
              aria-label={showPwd ? "Hide password" : "Show password"}
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[12px] text-red-400">
            {error}
          </div>
        )}

        <AuthButton loading={loading}>Sign in</AuthButton>
      </form>
    </AuthLayout>
  );
};

export default Login;
