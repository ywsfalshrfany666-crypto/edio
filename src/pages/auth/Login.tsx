import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/store/auth";
import { AuthLayout, AuthInput, AuthButton, AuthUnavailableNotice, SocialLoginButtons } from "@/components/auth/AuthLayout";
import { useToast } from "@/hooks/use-toast";
import { normalizeRedirectPath } from "@/lib/socialAuth";
import { AUTH_API_AVAILABLE } from "@/lib/api";
import { SUPABASE_AUTH_AVAILABLE } from "@/lib/supabaseConfig";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const signIn = useAuth((s) => s.signIn);
  const resendEmailVerification = useAuth((s) => s.resendEmailVerification);
  const user = useAuth((s) => s.user);
  const loading = useAuth((s) => s.loading);
  const refreshSession = useAuth((s) => s.refreshSession);
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = useMemo(
    () => normalizeRedirectPath(searchParams.get("redirectTo") || (location.state as { from?: string })?.from || "/account"),
    [location.state, searchParams],
  );

  useEffect(() => {
    const authResult = searchParams.get("auth");
    if (authResult === "oauth_success") {
      void refreshSession();
    } else if (authResult === "oauth_error") {
      setError("Unable to sign in with that provider. Try again or use email and password.");
    }
  }, [refreshSession, searchParams]);

  useEffect(() => {
    if (searchParams.get("auth") === "oauth_success" && user) {
      toast({ title: "Welcome back", description: "You're signed in." });
      navigate(redirectTo, { replace: true });
    }
  }, [navigate, redirectTo, searchParams, toast, user]);

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

  const onResendVerification = async () => {
    if (!email) {
      setError("اكتب بريدك الإلكتروني أولاً لإعادة إرسال رابط التحقق.");
      return;
    }
    const { error: resendError } = await resendEmailVerification(email);
    if (resendError) {
      setError(resendError);
      return;
    }
    toast({ title: "Verification email sent", description: "Check your inbox and spam folder." });
  };

  return (
    <AuthLayout
      eyebrow="Sign in"
      seoTitle="Login"
      title="Welcome back"
      subtitle="Sign in to track orders, manage addresses, and audition first."
      footer={
        <>
          New to edio?{" "}
          <Link to="/signup" className="text-primary hover:text-primary-glow smooth font-medium">
            Create an account
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {SUPABASE_AUTH_AVAILABLE || AUTH_API_AVAILABLE ? (
          <>
            <SocialLoginButtons redirectTo={redirectTo} showDivider onError={setError} />
            {AUTH_API_AVAILABLE || SUPABASE_AUTH_AVAILABLE ? (
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
          <div className="space-y-3 border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[12px] text-red-400">
            {error}
            {error.includes("فعّل بريدك") && (
              <button
                type="button"
                onClick={onResendVerification}
                disabled={loading}
                className="block text-start font-semibold text-foreground underline underline-offset-4 transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                إعادة إرسال رابط التحقق
              </button>
            )}
          </div>
        )}

        <AuthButton loading={loading}>Sign in</AuthButton>
              </form>
            ) : (
              <AuthUnavailableNotice
                title="تسجيل الدخول بالبريد غير مفعل حالياً"
                message="يمكنك تسجيل الدخول الآن باستخدام Google عبر Supabase. تسجيل الدخول التقليدي يحتاج backend منفصل قبل تفعيله في النسخة static."
              />
            )}
          </>
        ) : (
          <AuthUnavailableNotice
            title="Google Login غير جاهز بعد"
            message="أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY أثناء build لتفعيل تسجيل الدخول عبر Google."
          />
        )}
      </div>
    </AuthLayout>
  );
};

export default Login;
