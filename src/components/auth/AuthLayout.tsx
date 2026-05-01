import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/layout/Header";
import heroImg from "@/assets/hero-headphones.jpg";

type Props = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function AuthLayout({ eyebrow, title, subtitle, children, footer }: Props) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
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
          © {new Date().getFullYear()} EDIO Sound Studio
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
            Your EDIO account keeps your shipping details, order history, and saved gear in
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
