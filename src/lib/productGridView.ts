import { useCallback, useEffect, useState } from "react";

export type ProductGridView = "one" | "two";

const PRODUCT_GRID_VIEW_STORAGE_KEY = "edio_product_grid_view";

function normalizeProductGridView(value: unknown): ProductGridView | null {
  return value === "one" || value === "two" ? value : null;
}

export function useProductGridView() {
  const [gridView, setGridViewState] = useState<ProductGridView>("two");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = normalizeProductGridView(window.localStorage.getItem(PRODUCT_GRID_VIEW_STORAGE_KEY));
    if (stored) setGridViewState(stored);
  }, []);

  const setGridView = useCallback((nextView: ProductGridView) => {
    const normalized = normalizeProductGridView(nextView) || "two";
    setGridViewState(normalized);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PRODUCT_GRID_VIEW_STORAGE_KEY, normalized);
    }
  }, []);

  return { gridView, setGridView };
}
