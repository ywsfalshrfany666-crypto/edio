import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { Seo } from "@/components/Seo";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation();

  return (
    <main data-header-surface="dark" className="section-luxury flex min-h-[100dvh] items-center bg-background px-4 py-24">
      <Seo
        title="Page not found"
        description="This edio page could not be found. Return to the store to browse premium audio gear."
        canonicalPath={location.pathname}
      />
      <div className="container-edio">
        <div className="premium-shell mx-auto max-w-3xl">
          <div className="premium-core relative overflow-hidden p-8 text-center md:p-14">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" aria-hidden />
            <p className="label-tech mb-5 text-primary">edio / 404</p>
            <h1 className="font-display arabic-display-safe text-5xl font-bold leading-none md:text-7xl">404</h1>
            <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
              {t("notFound.body")}
            </p>
            <Link
              to="/"
              className="premium-cta group mx-auto mt-8 inline-flex min-h-12 items-center justify-center gap-3 px-6 py-3 text-sm font-semibold uppercase tracking-wider"
            >
              {t("notFound.back")}
              <span className="premium-icon h-8 w-8">
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
};

export default NotFound;
