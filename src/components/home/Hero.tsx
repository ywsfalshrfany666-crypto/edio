import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight, Headphones } from "lucide-react";
import { createRoutePrefetchHandlers } from "@/lib/routePrefetch";
import heroImg from "@/assets/hero-hifiman-arya-review.jpg";
import heroImg1200 from "@/assets/hero-hifiman-arya-review-1200.jpg";
import heroImg800 from "@/assets/hero-hifiman-arya-review-800.jpg";

export function Hero() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === "ar";
  const titleLines = t("hero.title").split("\n");
  const quickLinks = [
    { label: t("nav.headphones"), to: "/category/headphones" },
    { label: t("nav.iems"), to: "/category/iems" },
    { label: t("nav.dacAmp"), to: "/category/dac" },
    { label: t("nav.mic"), to: "/category/mic" },
    { label: t("nav.accessories"), to: "/category/accessories" },
  ];

  const stats = [
    { value: "30+", label: t("hero.stats.brands", { defaultValue: "Brands" }) },
    { value: "5★", label: t("hero.stats.rating", { defaultValue: "Rated" }) },
    { value: "24/7", label: t("hero.stats.support", { defaultValue: "Support" }) },
  ];

  return (
    <section data-header-surface="dark" className="section-luxury relative flex min-h-[100dvh] flex-col justify-end overflow-hidden bg-background pt-12 sm:pt-16">
      {/* Backdrop image + gradients */}
      <div className="absolute inset-0">
        <img
          src={heroImg}
          srcSet={`${heroImg800} 800w, ${heroImg1200} 1200w, ${heroImg} 1400w`}
          sizes="100vw"
          alt=""
          className="hero-motion absolute inset-0 h-full w-full object-cover object-[52%_34%] opacity-90 scale-105 saturate-[0.88] contrast-[1.04] md:object-[54%_30%]"
          style={{ animation: "heroFloat 24s cubic-bezier(0.22,1,0.36,1) infinite, heroZoom 18s cubic-bezier(0.22,1,0.36,1) forwards" }}
          decoding="async"
        />
        <div
          className="hero-motion absolute inset-0 opacity-35 mix-blend-screen"
          style={{ animation: "heroLightSweep 18s cubic-bezier(0.22,1,0.36,1) infinite" }}
          aria-hidden
        >
          <div className="absolute -left-[20%] top-[12%] h-[44%] w-[55%] rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.22),transparent_68%)] blur-3xl" />
          <div className="absolute right-[4%] bottom-[16%] h-[30%] w-[26%] rounded-full bg-[radial-gradient(circle,hsl(var(--foreground)/0.14),transparent_70%)] blur-3xl" />
        </div>
        <div
          className="hero-motion absolute inset-0 opacity-35"
          style={{
            animation: "heroGrainDrift 26s linear infinite",
            backgroundImage:
              "linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.05) 34%, transparent 55%)",
          }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-radial-glow opacity-55" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-background/20" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-r from-background/94 via-background/26 to-background/55" aria-hidden />
      </div>

      {/* Main content */}
      <div className="container-edio relative z-10 grid gap-6 pb-8 sm:gap-10 sm:pb-12 md:pb-20 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-8">
          <p className="label-tech text-primary mb-3 sm:mb-5 reveal">{t("hero.eyebrow")}</p>
          <h1 className="font-display arabic-display-safe max-w-[13ch] text-[36px] font-bold leading-[0.92] text-balance sm:max-w-4xl sm:text-6xl md:text-7xl lg:text-[5.5rem]">
            {titleLines.map((line, i) => (
              <span key={i} className={`block reveal reveal-delay-${i + 1}`}>
                {line}
              </span>
            ))}
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-foreground/72 reveal reveal-delay-3 sm:mt-6 sm:text-base md:text-lg">
            {t("hero.subtitle")}
          </p>

          {/* CTAs */}
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 reveal reveal-delay-4">
            <Link
              to="/shop"
              {...createRoutePrefetchHandlers("/shop")}
              className="premium-cta group inline-flex min-h-12 items-center justify-center gap-3 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-widest"
            >
              {t("hero.primaryCta")}
              <span className="premium-icon h-8 w-8">
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
              </span>
            </Link>
            <Link
              to="/about"
              {...createRoutePrefetchHandlers("/about")}
              className="premium-ghost inline-flex min-h-12 items-center justify-center gap-2 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-foreground"
            >
              {t("hero.aboutCta")}
            </Link>
          </div>

          <div className="mt-5 flex flex-wrap gap-2.5 reveal reveal-delay-4">
            {quickLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                {...createRoutePrefetchHandlers(item.to)}
                className="premium-ghost inline-flex min-h-10 items-center justify-center px-3.5 py-2 text-[11px] font-mono uppercase tracking-[0.16em] text-foreground/86"
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-3 gap-2 reveal reveal-delay-4 sm:mt-10 sm:flex sm:items-center sm:gap-6 md:gap-10">
            {stats.map((s, i) => (
              <div key={i} className="flex flex-col items-center sm:items-start sm:flex-row sm:items-baseline gap-0.5 sm:gap-2 min-w-0 text-center sm:text-start">
                <span className="font-mono text-lg sm:text-2xl md:text-3xl font-semibold leading-none">{s.value}</span>
                <span className="label-tech truncate">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Side info panel */}
        <aside className="lg:col-span-4 reveal reveal-delay-4">
          <div className="premium-shell">
          <div className="premium-core p-5 md:p-6">
            <div className="flex items-center gap-2">
              <Headphones className="h-4 w-4 text-primary" />
              <span className="label-tech text-primary">{t("hero.sideLabel")}</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-foreground/82">
              {t("hero.sideBody")}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/20 pt-4">
              {stats.map((s) => (
                <div key={s.label} className={isArabic ? "text-right" : "text-left"}>
                  <p className="font-mono text-xl font-semibold leading-none">{s.value}</p>
                  <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
          </div>
        </aside>
      </div>

      <style>{`
        @keyframes heroZoom {
          from { transform: scale(1.08); }
          to { transform: scale(1); }
        }
        @keyframes heroFloat {
          0%, 100% { transform: scale(1.05) translate3d(0, 0, 0); }
          50% { transform: scale(1.08) translate3d(-1%, 1.1%, 0); }
        }
        @keyframes heroLightSweep {
          0%, 100% { transform: translate3d(-3%, 0, 0); opacity: 0.28; }
          50% { transform: translate3d(3%, -1.5%, 0); opacity: 0.58; }
        }
        @keyframes heroGrainDrift {
          0% { transform: translate3d(-8%, 0, 0); }
          100% { transform: translate3d(8%, 0, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-motion {
            animation: none !important;
          }
        }
      `}</style>
    </section>
  );
}
