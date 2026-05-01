import { type DisplayCurrency, IQD_PER_USD } from "@/store/currency";
import { localeWithEnglishDigits } from "@/lib/formatting";

const formatters: Record<string, Intl.NumberFormat> = {};

export function formatPrice(
  amount: number,
  lang: "en" | "ar" = "en",
  currency: DisplayCurrency = "IQD",
) {
  if (currency === "USD") {
    const converted = amount / IQD_PER_USD;
    const psychological = amount <= 0 ? 0 : Math.max(0.99, Math.ceil(converted) - 0.01);
    const key = `${lang}-USD`;
    if (!formatters[key]) {
      formatters[key] = new Intl.NumberFormat(localeWithEnglishDigits(lang), {
        style: "currency",
        currency: "USD",
        numberingSystem: "latn",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return formatters[key].format(psychological);
  }

  const key = `${lang}-IQD`;
  if (!formatters[key]) {
    formatters[key] = new Intl.NumberFormat(localeWithEnglishDigits(lang), {
      numberingSystem: "latn",
      maximumFractionDigits: 0,
    });
  }
  const n = formatters[key].format(amount);
  return lang === "ar" ? `${n} د.ع` : `${n} IQD`;
}
