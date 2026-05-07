import { Suspense, lazy } from "react";
import { Layout } from "@/components/layout/Layout";
import { Seo } from "@/components/Seo";
import { Hero } from "@/components/home/Hero";
import { DeferredSection } from "@/components/perf/DeferredSection";
import { buildOrganizationJsonLd, buildWebsiteJsonLd } from "@/lib/seo";

const BrandStrip = lazy(() =>
  import("@/components/home/BrandStrip").then((m) => ({ default: m.BrandStrip })),
);
const ArchitectureGrid = lazy(() =>
  import("@/components/home/ArchitectureGrid").then((m) => ({ default: m.ArchitectureGrid })),
);
const FeaturedRelease = lazy(() =>
  import("@/components/home/FeaturedRelease").then((m) => ({ default: m.FeaturedRelease })),
);
const BestSellers = lazy(() =>
  import("@/components/home/BestSellers").then((m) => ({ default: m.BestSellers })),
);
const NewArrivals = lazy(() =>
  import("@/components/home/NewArrivals").then((m) => ({ default: m.NewArrivals })),
);
const EditorialBlock = lazy(() =>
  import("@/components/home/EditorialBlock").then((m) => ({ default: m.EditorialBlock })),
);
const PreOwnedBlock = lazy(() =>
  import("@/components/home/PreOwnedBlock").then((m) => ({ default: m.PreOwnedBlock })),
);
const TrustGrid = lazy(() =>
  import("@/components/home/TrustGrid").then((m) => ({ default: m.TrustGrid })),
);

function SectionPlaceholder({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <div className={dark ? "bg-surface-lowest" : "bg-background"}>
      <div className="container-edio py-16 md:py-24">
        <div className="max-w-2xl space-y-4">
          <div className="h-3 w-28 rounded-full bg-surface-highest/70" />
          <div className="h-10 w-full max-w-xl rounded-sm bg-surface-high/85" />
          {!compact && <div className="h-4 w-full max-w-lg rounded-full bg-surface-highest/60" />}
        </div>
        <div className={`mt-10 grid gap-3 ${compact ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
          {Array.from({ length: compact ? 4 : 3 }).map((_, i) => (
            <div key={i} className={`animate-pulse rounded-sm bg-surface-high/80 ${compact ? "h-64" : "h-80"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

const Index = () => {
  return (
    <Layout>
      <Seo
        title="edio"
        isHome
        description="edio is a premium audio store in Iraq for headphones, IEMs, DAC, amplifiers, microphones, and audiophile accessories."
        image="/og/edio-og.png"
        imageAlt="edio premium audio store"
        jsonLd={[buildOrganizationJsonLd(), buildWebsiteJsonLd()]}
      />
      <Hero />
      <DeferredSection rootMargin="0px 0px" fallback={<div className="bg-surface-lowest py-10" />}>
        <Suspense fallback={<div className="bg-surface-lowest py-10" />}>
          <div data-reveal="fade"><BrandStrip /></div>
        </Suspense>
      </DeferredSection>
      <DeferredSection rootMargin="160px 0px" fallback={<SectionPlaceholder dark compact />}>
        <Suspense fallback={<SectionPlaceholder dark compact />}>
          <div data-reveal><ArchitectureGrid /></div>
        </Suspense>
      </DeferredSection>
      <DeferredSection rootMargin="160px 0px" fallback={<SectionPlaceholder />}>
        <Suspense fallback={<SectionPlaceholder />}>
          <div data-reveal><FeaturedRelease /></div>
        </Suspense>
      </DeferredSection>
      <DeferredSection rootMargin="160px 0px" fallback={<SectionPlaceholder compact />}>
        <Suspense fallback={<SectionPlaceholder compact />}>
          <div data-reveal><BestSellers /></div>
        </Suspense>
      </DeferredSection>
      <DeferredSection rootMargin="160px 0px" fallback={<SectionPlaceholder dark compact />}>
        <Suspense fallback={<SectionPlaceholder dark compact />}>
          <div data-reveal><NewArrivals /></div>
        </Suspense>
      </DeferredSection>
      <DeferredSection rootMargin="160px 0px" fallback={<SectionPlaceholder dark />}>
        <Suspense fallback={<SectionPlaceholder dark />}>
          <div data-reveal><EditorialBlock /></div>
        </Suspense>
      </DeferredSection>
      <DeferredSection rootMargin="160px 0px" fallback={<SectionPlaceholder />}>
        <Suspense fallback={<SectionPlaceholder />}>
          <div data-reveal><PreOwnedBlock /></div>
        </Suspense>
      </DeferredSection>
      <DeferredSection rootMargin="160px 0px" fallback={<SectionPlaceholder dark compact />}>
        <Suspense fallback={<SectionPlaceholder dark compact />}>
          <div data-reveal><TrustGrid /></div>
        </Suspense>
      </DeferredSection>
    </Layout>
  );
};

export default Index;
