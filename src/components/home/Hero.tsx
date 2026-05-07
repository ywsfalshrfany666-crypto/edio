import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { createRoutePrefetchHandlers } from "@/lib/routePrefetch";
import heroImg from "@/assets/hero-hifiman-arya-review.jpg";
import heroImg1200 from "@/assets/hero-hifiman-arya-review-1200.jpg";
import heroImg800 from "@/assets/hero-hifiman-arya-review-800.jpg";
import heroWebp1200 from "@/assets/hero-hifiman-arya-review-1200.webp";
import heroWebp960 from "@/assets/hero-hifiman-arya-review-960.webp";
import heroWebp640 from "@/assets/hero-hifiman-arya-review-640.webp";

export function Hero() {
  const { t } = useTranslation();
  const titleLines = t("hero.title").split("\n");
  const quickLinks = [
    { label: t("nav.headphones"), to: "/category/headphones" },
    { label: t("nav.iems"), to: "/category/iems" },
    { label: t("nav.dacAmp"), to: "/category/dac" },
    { label: t("nav.accessories"), to: "/category/accessories" },
  ];

  return (
    <section data-header-surface="dark" className="section-luxury relative flex min-h-[92dvh] flex-col justify-end overflow-hidden bg-background pt-12 sm:pt-16">
      {/* Backdrop image + gradients */}
      <div className="absolute inset-0">
        <picture>
          <source
            type="image/webp"
            srcSet={`${heroWebp640} 640w, ${heroWebp960} 960w, ${heroWebp1200} 1200w`}
            sizes="100vw"
          />
          <img
            src={heroImg800}
            srcSet={`${heroImg800} 800w, ${heroImg1200} 1200w, ${heroImg} 1400w`}
            sizes="100vw"
            alt=""
            width={1400}
            height={900}
            loading="eager"
            fetchPriority="high"
            className="hero-motion absolute inset-0 h-full w-full object-cover object-[52%_34%] opacity-90 scale-105 saturate-[0.88] contrast-[1.04] md:object-[54%_30%]"
            decoding="async"
          />
        </picture>
        <div
          className="hero-motion absolute inset-0 opacity-35 mix-blend-screen"
          aria-hidden
        >
          <div className="absolute -left-[20%] top-[12%] h-[44%] w-[55%] rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.22),transparent_68%)] blur-3xl" />
          <div className="absolute right-[4%] bottom-[16%] h-[30%] w-[26%] rounded-full bg-[radial-gradient(circle,hsl(var(--foreground)/0.14),transparent_70%)] blur-3xl" />
        </div>
        <div
          className="hero-motion absolute inset-0 opacity-35"
          style={{ backgroundImage: "linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.05) 34%, transparent 55%)" }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-radial-glow opacity-55" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-background/20" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-r from-background/94 via-background/26 to-background/55" aria-hidden />
      </div>

      {/* Main content */}
      <div className="container-edio relative z-10 grid gap-6 pb-10 sm:gap-10 sm:pb-14 md:pb-20 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-8">
          <p className="label-tech text-primary mb-3 sm:mb-5">{t("hero.eyebrow")}</p>
          <h1 className="font-display arabic-display-safe max-w-[13ch] text-[36px] font-bold leading-[0.92] text-balance sm:max-w-4xl sm:text-6xl md:text-7xl lg:text-[5.5rem]">
            {titleLines.map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-foreground/74 sm:mt-6 sm:text-base md:text-lg">
            {t("hero.subtitle")}
          </p>

          {/* CTAs */}
          <div className="mt-6 flex flex-col items-stretch gap-3 sm:mt-8 sm:flex-row sm:items-center">
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
          </div>

          <div className="mt-5 flex flex-wrap gap-2.5 sm:mt-6">
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
        </div>
      </div>
    </section>
  );
}
