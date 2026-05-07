import { useTranslation } from "react-i18next";
import { Headphones, ShieldCheck, Award, Truck, ArrowUpRight } from "lucide-react";

const icons = [Headphones, ShieldCheck, Award, Truck];

export function TrustGrid() {
  const { t } = useTranslation();
  const items = t("trust.items", { returnObjects: true }) as { title: string; body: string }[];

  return (
    <section data-header-surface="dark" className="section-luxury bg-surface-lowest py-20 md:py-28">
      <div className="container-edio">
        <div className="mb-10 flex flex-col gap-6 md:mb-14 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="label-tech mb-3 text-primary">{t("featured.eyebrow")}</p>
            <h2 className="font-display arabic-display-safe max-w-xl text-3xl font-bold tracking-tight md:text-5xl">
              {t("trust.title")}
            </h2>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => {
            const Icon = icons[i];
            return (
              <div key={i} className="group premium-shell">
                <div className="premium-core relative h-full overflow-hidden p-8 md:p-10">
	                <div className="absolute inset-x-0 top-0 h-px origin-start scale-x-0 bg-primary/60 transition-transform duration-300 group-hover:scale-x-100" />
                <div className="mb-6 flex items-center justify-between">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </span>
	                  <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
                <h3 className="font-display text-lg font-semibold tracking-tight mb-3">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
