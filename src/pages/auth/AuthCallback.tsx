import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { normalizeRedirectPath } from "@/lib/socialAuth";
import { supabase, SUPABASE_AUTH_AVAILABLE } from "@/lib/supabase";
import { useAuth } from "@/store/auth";

const AuthCallback = () => {
  const navigate = useNavigate();
  const refreshSession = useAuth((s) => s.refreshSession);
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const redirectTo = useMemo(
    () => normalizeRedirectPath(searchParams.get("redirectTo") || searchParams.get("next") || "/account"),
    [searchParams],
  );

  useEffect(() => {
    let active = true;
    async function completeAuth() {
      if (!SUPABASE_AUTH_AVAILABLE || !supabase) {
        setError("Google Login is not configured yet.");
        return;
      }
      try {
        const code = searchParams.get("code");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!data.session) throw new Error("missing_session");
        await refreshSession();
        if (active) navigate(redirectTo, { replace: true });
      } catch {
        if (active) setError("تعذر إكمال تسجيل الدخول. جرّب مرة أخرى.");
      }
    }
    void completeAuth();
    return () => {
      active = false;
    };
  }, [navigate, redirectTo, refreshSession, searchParams]);

  return (
    <AuthLayout
      eyebrow="Google Login"
      seoTitle="Login"
      title={error ? "تعذر تسجيل الدخول" : "جاري تسجيل الدخول"}
      subtitle={error ? "لم يتم إنشاء جلسة آمنة من Supabase." : "نراجع جلسة Google ونجهز حسابك."}
      footer={
        <Link to="/login" className="text-primary hover:text-primary-glow smooth font-medium">
          العودة لتسجيل الدخول
        </Link>
      }
    >
      {error ? (
        <div className="space-y-4 border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200">
          <p>{error}</p>
          <Link
            to="/login"
            className="inline-flex min-h-11 items-center justify-center bg-primary px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-primary-foreground smooth hover:bg-primary-glow"
          >
            حاول مرة أخرى
          </Link>
        </div>
      ) : (
        <div className="border border-border/40 bg-surface-high p-5 text-sm text-muted-foreground">
          <span className="me-3 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          يرجى الانتظار لحظة.
        </div>
      )}
    </AuthLayout>
  );
};

export default AuthCallback;
