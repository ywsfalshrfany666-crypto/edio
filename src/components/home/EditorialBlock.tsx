import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import editorial from "@/assets/editorial-listen.jpg";

export function EditorialBlock() {
  const { t } = useTranslation();
  return (
    <section id="journal" data-header-surface="dark" className="section-luxury relative overflow-hidden bg-surface-lowest py-20 md:py-28">
      {/* Ambient backdrop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          background:
            "radial-gradient(circle at 18% 30%, hsl(var(--primary) / 0.10), transparent 55%), radial-gradient(circle at 82% 80%, hsl(var(--primary) / 0.06), transparent 60%)",
        }}
        aria-hidden
      />
      {/* Top hairline */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, hsl(var(--border) / 0.8) 50%, transparent 100%)",
        }}
        aria-hidden
      />

      <div className="container-edio relative grid items-center gap-16 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
        {/* Text column */}
        <div className="relative">
          {/* Eyebrow with line */}
          <div className="mb-8 flex items-center gap-3">
            <span className="h-px w-8 bg-primary/60" aria-hidden />
            <p className="label-tech text-primary">{t("editorial.eyebrow")}</p>
          </div>

          <h2 className="font-display arabic-display-safe text-balance text-4xl font-bold leading-[1.02] tracking-normal md:text-6xl lg:text-[64px]">
            {t("editorial.title")}
          </h2>

          <p className="mt-8 max-w-md text-base leading-relaxed text-muted-foreground md:text-[17px]">
            {t("editorial.body")}
          </p>

          {/* Signature row */}
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
            <Link
              to="/about"
              className="premium-ghost group inline-flex items-center gap-2 px-4 py-2.5 text-[11px] font-mono uppercase tracking-[0.22em] text-foreground"
            >
              <span>{t("editorial.philosophy")}</span>
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:rotate-180" />
            </Link>
          </div>
        </div>

        {/* Image column */}
        <div className="relative">
          <div className="premium-shell">
            <div className="relative aspect-[5/4] overflow-hidden">
              <img
                src={editorial}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out hover:scale-[1.02]"
              />
              {/* Subtle vignette + gradient */}
              <div
                className="absolute inset-0 bg-gradient-to-tr from-background/70 via-background/10 to-transparent"
                aria-hidden
              />
              <div
                className="absolute inset-0 mix-blend-overlay opacity-40"
                style={{
                  background:
                    "radial-gradient(120% 80% at 50% 110%, hsl(var(--primary) / 0.25), transparent 60%)",
                }}
                aria-hidden
              />

              {/* Caption tag */}
              <div className="absolute bottom-4 start-4 inline-flex items-center gap-2 px-3 py-1.5">
                <span className="h-1 w-1 rounded-full bg-primary signal-dot" />
                <span className="text-[10px] font-mono uppercase tracking-[0.22em] text-foreground/90 [text-shadow:0_1px_16px_rgb(0_0_0_/_0.72)]">
                  {t("editorial.caption")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
