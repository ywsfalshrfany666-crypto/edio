import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/store/auth";
import { AuthLayout, AuthInput, AuthButton, AuthUnavailableNotice, SocialLoginButtons } from "@/components/auth/AuthLayout";
import { useToast } from "@/hooks/use-toast";
import { AUTH_API_AVAILABLE } from "@/lib/api";
import { SUPABASE_AUTH_AVAILABLE } from "@/lib/supabaseConfig";

const Signup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const signUp = useAuth((s) => s.signUp);
  const resendEmailVerification = useAuth((s) => s.resendEmailVerification);
  const loading = useAuth((s) => s.loading);

  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!accept) {
      setError("Please accept the terms to continue.");
      return;
    }
    const result = await signUp({ email, password, fullName: firstName || undefined, acceptTerms: accept });
    const { error } = result;
    if (error) {
      setError(error);
      return;
    }
    if (result.emailConfirmationRequired) {
      setConfirmationEmail(email);
      toast({ title: "Check your email", description: "We sent you a verification link." });
      return;
    }
    toast({ title: "Account created", description: "Welcome to edio." });
    navigate("/account", { replace: true });
  };

  const onResendVerification = async () => {
    if (!confirmationEmail) return;
    setError(null);
    const { error: resendError } = await resendEmailVerification(confirmationEmail);
    if (resendError) {
      setError(resendError);
      return;
    }
    toast({ title: "Verification email sent", description: "Check your inbox and spam folder." });
  };

  return (
    <AuthLayout
      eyebrow="Create account"
      seoTitle="Register"
      title="Join edio"
      subtitle="Start with the essentials. You can complete delivery details later."
      footer={
        <>
          Already a member?{" "}
          <Link to="/login" className="text-primary hover:text-primary-glow smooth font-medium">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {SUPABASE_AUTH_AVAILABLE || AUTH_API_AVAILABLE ? (
          <>
            <SocialLoginButtons redirectTo="/account" showDivider onError={setError} />
            {AUTH_API_AVAILABLE || SUPABASE_AUTH_AVAILABLE ? (
              confirmationEmail ? (
                <div className="space-y-5 border border-primary/25 bg-primary/10 p-5 text-sm text-muted-foreground">
                  <div>
                    <p className="label-tech mb-2 text-primary">Email verification</p>
                    <h2 className="font-display text-2xl font-semibold text-foreground">راجع بريدك الإلكتروني.</h2>
                    <p className="mt-3 leading-relaxed">
                      أرسلنا رابط تحقق إلى <span className="text-foreground">{confirmationEmail}</span>. افتح الرابط لإكمال إنشاء الحساب
                      ثم سجل الدخول.
                    </p>
                  </div>
                  {error && <div className="border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[12px] text-red-400">{error}</div>}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <AuthButton type="button" loading={loading} onClick={onResendVerification}>
                      Resend email
                    </AuthButton>
                    <Link
                      to="/login"
                      className="inline-flex min-h-11 items-center justify-center border border-border/50 bg-surface-high px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-foreground smooth hover:border-primary/45 hover:bg-surface-highest"
                    >
                      Sign in
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="space-y-5">
        <AuthInput
          label="First name"
          type="text"
          autoComplete="given-name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Yousif"
          hint="Optional for now."
        />
        <AuthInput
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <AuthInput
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="At least 8 characters. No shipping details needed yet."
        />

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={accept}
            onChange={(e) => setAccept(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span className="text-[12px] text-muted-foreground leading-relaxed">
            I agree to edio's{" "}
            <Link to="/terms" className="text-foreground hover:text-primary smooth">
              terms
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="text-foreground hover:text-primary smooth">
              privacy policy
            </Link>
            .
          </span>
        </label>

        {error && (
          <div className="border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[12px] text-red-400">
            {error}
          </div>
        )}

        <AuthButton loading={loading}>Create account</AuthButton>
                </form>
              )
            ) : (
              <AuthUnavailableNotice
                title="إنشاء الحساب بالبريد غير مفعل حالياً"
                message="يمكنك إنشاء حساب باستخدام Google حالياً. التسجيل التقليدي يحتاج backend منفصل قبل تفعيله في النسخة static."
              />
            )}
          </>
        ) : (
          <AuthUnavailableNotice
            title="Google Login غير جاهز بعد"
            message="أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY أثناء build لتفعيل إنشاء الحساب عبر Google."
          />
        )}
      </div>
    </AuthLayout>
  );
};

export default Signup;
