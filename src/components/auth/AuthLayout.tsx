import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/layout/Header";
import { Seo } from "@/components/Seo";
import { SUPABASE_AUTH_AVAILABLE } from "@/lib/supabaseConfig";
import { useAuth } from "@/store/auth";
import heroImg from "@/assets/hero-headphones.jpg";

type Props = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  seoTitle?: string;
};

export function AuthLayout({ eyebrow, title, subtitle, children, footer, seoTitle }: Props) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <Seo title={seoTitle || eyebrow || title} description="Access your edio account." />
      {/* Form side */}
      <div className="flex flex-col px-6 sm:px-10 lg:px-16 py-8">
        <div className="flex items-center justify-between">
          <Logo />
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground smooth"
          >
            <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
            Home
          </Link>
        </div>

        <div className="flex-1 flex items-center">
          <div className="w-full max-w-md mx-auto">
            <p className="label-tech text-primary mb-3">{eyebrow}</p>
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight leading-[1.05]">
              {title}
              <span className="text-primary">.</span>
            </h1>
            {subtitle && (
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
            )}
            <div className="mt-10">{children}</div>
            {footer && <div className="mt-8 text-sm text-muted-foreground">{footer}</div>}
          </div>
        </div>

        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
          © {new Date().getFullYear()} edio Sound Studio
        </p>
      </div>

      {/* Visual side */}
      <div className="relative hidden lg:block overflow-hidden bg-surface-lowest">
        <img
          src={heroImg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/30 to-transparent" />
        <div className="absolute inset-0 p-10 flex flex-col justify-end">
          <p className="label-tech text-primary mb-2">// Members only</p>
          <p className="font-display text-3xl font-bold leading-tight max-w-md">
            Track orders, save addresses, and audition first.
          </p>
          <p className="mt-3 text-sm text-muted-foreground max-w-md">
            Your edio account keeps your shipping details, order history, and saved gear in
            one place.
          </p>
        </div>
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.08]"
          aria-hidden
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
      </div>
    </div>
  );
}

export function AuthInput({
  label,
  hint,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  return (
    <label className="block">
      <span className="label-tech mb-2 block">{label}</span>
      <input
        {...props}
        className="w-full bg-surface-high border border-border/40 px-4 py-3 text-sm focus:outline-none focus:border-primary focus:bg-surface-highest transition-colors duration-200"
      />
      {error ? (
        <span className="mt-1.5 block text-[11px] text-red-400">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-[11px] text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}

export function AuthButton({
  loading,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 text-[11px] font-semibold uppercase tracking-widest hover:bg-primary-glow smooth press disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? (
        <span className="h-3.5 w-3.5 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
      ) : null}
      {children}
    </button>
  );
}

export function AuthUnavailableNotice({
  title = "الحسابات غير مفعلة حالياً",
  message = "الموقع منشور حالياً كنسخة static، لذلك تسجيل الدخول وإنشاء الحساب يحتاجان تفعيل backend قبل أن يعملا بشكل آمن. يمكنك متابعة التسوق أو التواصل معنا لإتمام الطلب.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="space-y-5 border border-primary/25 bg-primary/10 p-5 text-start">
      <div>
        <p className="label-tech mb-2 text-primary">Account access</p>
        <h2 className="font-display text-2xl font-semibold text-foreground">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{message}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/shop"
          className="inline-flex min-h-11 items-center justify-center bg-primary px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-primary-foreground smooth hover:bg-primary-glow"
        >
          العودة للمتجر
        </Link>
        <a
          href="https://wa.me/9647702046674"
          className="inline-flex min-h-11 items-center justify-center border border-border/50 bg-surface-high px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-foreground smooth hover:border-primary/45 hover:bg-surface-highest"
        >
          التواصل عبر WhatsApp
        </a>
      </div>
      {/* TODO: Enable real auth when the Node.js backend is deployed. */}
    </div>
  );
}

export function SocialLoginButtons({
  redirectTo = "/account",
  showDivider = true,
  onError,
}: {
  redirectTo?: string;
  showDivider?: boolean;
  onError?: (message: string) => void;
}) {
  const signInWithGoogle = useAuth((s) => s.signInWithGoogle);
  const loading = useAuth((s) => s.loading);

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        <button
          type="button"
          disabled={!SUPABASE_AUTH_AVAILABLE || loading}
          title={SUPABASE_AUTH_AVAILABLE ? undefined : "Supabase Auth is not configured yet."}
          onClick={async () => {
            const result = await signInWithGoogle(redirectTo);
            if (result.error) onError?.(result.error);
          }}
          className="inline-flex min-h-12 w-full items-center justify-center gap-3 border border-border/50 bg-surface-high px-4 py-3 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-primary/45 hover:bg-surface-highest focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-[13px] font-bold text-black">
            {loading ? (
              <span className="h-3.5 w-3.5 rounded-full border-2 border-black/20 border-t-black animate-spin" />
            ) : (
              "G"
            )}
          </span>
          <span>المتابعة باستخدام Google</span>
        </button>
      </div>
      {showDivider && (
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest text-muted-foreground/70">
          <span className="h-px flex-1 bg-border/50" />
          <span>or</span>
          <span className="h-px flex-1 bg-border/50" />
        </div>
      )}
    </div>
  );
}
