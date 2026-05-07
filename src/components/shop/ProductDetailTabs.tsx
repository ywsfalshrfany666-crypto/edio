import { useId, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ProductDetailTabId = "description" | "sound" | "specs";

export type ProductDetailTab = {
  id: ProductDetailTabId;
  label: string;
  eyebrow: string;
  title: string;
  summary?: string;
  content: ReactNode;
};

type ProductDetailTabsProps = {
  tabs: ProductDetailTab[];
  defaultTab?: ProductDetailTabId;
  dir?: "ltr" | "rtl";
};

export function ProductDetailTabs({ tabs, defaultTab = "description", dir = "ltr" }: ProductDetailTabsProps) {
  const stableTabs = useMemo(() => tabs.filter((tab) => Boolean(tab.content)), [tabs]);
  const [activeTab, setActiveTab] = useState<ProductDetailTabId>(
    stableTabs.some((tab) => tab.id === defaultTab) ? defaultTab : stableTabs[0]?.id || "description",
  );
  const baseId = useId();
  const activeIndex = Math.max(0, stableTabs.findIndex((tab) => tab.id === activeTab));

  if (!stableTabs.length) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();

    const isPrevious = dir === "rtl" ? event.key === "ArrowRight" : event.key === "ArrowLeft";
    const isNext = dir === "rtl" ? event.key === "ArrowLeft" : event.key === "ArrowRight";
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? stableTabs.length - 1
        : isPrevious
          ? (activeIndex - 1 + stableTabs.length) % stableTabs.length
          : isNext
            ? (activeIndex + 1) % stableTabs.length
            : activeIndex;

    setActiveTab(stableTabs[nextIndex].id);
  };

  return (
    <section className="mt-20 border-t border-border/30 pt-14" data-reveal>
      <div
        role="tablist"
        aria-label="Product information"
        className="flex gap-2 overflow-x-auto border-b border-border/30 pb-0"
        onKeyDown={handleKeyDown}
      >
        {stableTabs.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              id={`${baseId}-${tab.id}-tab`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-${tab.id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative min-h-12 shrink-0 px-4 text-start font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                "after:absolute after:inset-x-0 after:bottom-[-1px] after:h-px after:origin-center after:scale-x-0 after:bg-primary after:transition-transform after:duration-500",
                selected && "text-foreground after:scale-x-100",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {stableTabs.map((tab) => {
        const selected = tab.id === activeTab;
        return (
          <div
            key={tab.id}
            id={`${baseId}-${tab.id}-panel`}
            role="tabpanel"
            aria-labelledby={`${baseId}-${tab.id}-tab`}
            hidden={!selected}
            tabIndex={0}
            className="pt-10 focus-visible:outline-none"
          >
            <div className="grid gap-10 lg:grid-cols-[0.34fr_0.66fr] lg:gap-16">
              <div>
                <p className="mb-3 text-[11px] font-mono uppercase tracking-[0.18em] text-primary">{tab.eyebrow}</p>
                <h2 className="font-display text-2xl font-semibold leading-tight tracking-tight md:text-3xl">{tab.title}</h2>
                {tab.summary ? <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">{tab.summary}</p> : null}
              </div>
              <div>{tab.content}</div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
