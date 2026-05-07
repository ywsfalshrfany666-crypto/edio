import type { ReactNode } from "react";
import { Grid2X2, Rows2 } from "lucide-react";
import type { ProductGridView } from "@/lib/productGridView";
import { cn } from "@/lib/utils";

export function ProductGridViewToggle({
  value,
  onChange,
  className,
}: {
  value: ProductGridView;
  onChange: (value: ProductGridView) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex min-h-11 items-center gap-1 rounded-md border border-border/35 bg-surface-lowest/70 p-1 md:hidden",
        className,
      )}
      role="group"
      aria-label="خيارات عرض المنتجات"
    >
      <ToggleButton
        active={value === "two"}
        label="عرض منتجين في الصف"
        onClick={() => onChange("two")}
      >
        <Grid2X2 className="h-4 w-4" aria-hidden />
      </ToggleButton>
      <ToggleButton
        active={value === "one"}
        label="عرض منتج واحد في الصف"
        onClick={() => onChange("one")}
      >
        <Rows2 className="h-4 w-4 rotate-90" aria-hidden />
      </ToggleButton>
    </div>
  );
}

function ToggleButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-[0.35rem] border text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "border-primary/60 bg-primary/14 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.18)]"
          : "border-transparent hover:border-border/70 hover:bg-surface-high hover:text-foreground",
      )}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  );
}
