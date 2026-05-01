import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DisplayCurrency = "IQD" | "USD";

type CurrencyState = {
  currency: DisplayCurrency;
  toggle: () => void;
  setCurrency: (currency: DisplayCurrency) => void;
};

export const IQD_PER_USD = 1300;

export const useCurrency = create<CurrencyState>()(
  persist(
    (set) => ({
      currency: "IQD",
      toggle: () =>
        set((state) => ({
          currency: state.currency === "IQD" ? "USD" : "IQD",
        })),
      setCurrency: (currency) => set({ currency }),
    }),
    { name: "edio-currency" },
  ),
);
