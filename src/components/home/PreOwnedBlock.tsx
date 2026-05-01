import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Shield, Search, ArrowRight, Recycle, BadgeCheck } from "lucide-react";

export function PreOwnedBlock() {
  const { t } = useTranslation();
  const pillarContent = t("preowned.pillars", { returnObjects: true }) as { title: string; desc: string }[];
  const pillars = [
    { icon: Search, ...pillarContent[0] },
    { icon: Shield, ...pillarContent[1] },
    { icon: BadgeCheck, ...pillarContent[2] },
    { icon: Recycle, ...pillarContent[3] },
  ];

  return (
    <section data-header-surface="dark" className="section-luxury relative overflow-hidden bg-background py-20 md:py-28">
      {/* Top + bottom hairlines */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, hsl(var(--border) / 0.8) 50%, transparent 100%)",
        }}
        aria-hidden
      />
      {/* Ambient backdrop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.3]"
        style={{
          background:
            "radial-gradient(circle at 80% 20%, hsl(var(--primary) / 0.10), transparent 55%)",
        }}
        aria-hidden
      />

      <div className="container-edio relative">
        {/* Header */}
        <div className="grid items-end gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <div className="mb-6 flex items-center gap-3">
              <span className="h-px w-8 bg-primary/60" aria-hidden />
              <p className="label-tech text-primary">{t("preowned.eyebrow")}</p>
            </div>
            <h2 className="font-display arabic-display-safe text-balance text-4xl font-bold leading-[1.05] tracking-normal md:text-6xl">
              {t("preowned.title")}
            </h2>
          </div>
          <p className="max-w-md text-base leading-relaxed text-muted-foreground md:text-[17px]">
            {t("preowned.body")}
          </p>
        </div>

        {/* Pillars grid */}
        <div className="mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p) => (
            <div key={p.title} className="group premium-shell">
              <div className="premium-core relative flex h-full flex-col gap-4 p-6 md:p-7">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <p.icon className="h-5 w-5 transition-transform duration-500 group-hover:scale-110" />
              </span>
              <div>
                <h3 className="font-display text-base font-semibold tracking-tight">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {p.desc}
                </p>
              </div>
              {/* Hover hairline */}
              <span
                className="absolute inset-x-0 bottom-0 h-px origin-start scale-x-0 bg-primary/60 transition-transform duration-500 group-hover:scale-x-100"
                aria-hidden
              />
              </div>
            </div>
          ))}
        </div>

        {/* Footer CTA strip */}
        <div className="mt-12 flex flex-col items-start justify-between gap-6 border-t border-border/40 pt-10 md:flex-row md:items-center">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-primary signal-dot" />
              {t("preowned.footerAuthentic")}
            </span>
            <span className="hidden md:inline">·</span>
            <span>{t("preowned.footerRotation")}</span>
          </div>

          <Link
            to="/shop?filter=preowned"
            className="premium-cta group inline-flex items-center gap-3 px-5 py-2.5 text-[11px] font-mono uppercase tracking-[0.22em]"
          >
            <span>{t("preowned.browse")}</span>
            <span className="premium-icon h-8 w-8">
              <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
