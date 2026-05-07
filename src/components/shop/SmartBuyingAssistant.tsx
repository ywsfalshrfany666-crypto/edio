import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RuntimeProduct } from "@/lib/runtimeCatalog";
import {
  getSmartBuyingRecommendations,
  type BuyingBudget,
  type BuyingDevice,
  type BuyingPreferences,
  type BuyingUse,
  type SoundPreference,
  type WirePreference,
} from "@/lib/smartCommerce";
import { formatPrice } from "@/lib/formatPrice";
import { useCurrency } from "@/store/currency";
import { cn } from "@/lib/utils";

type Option<T extends string> = {
  value: T;
  en: string;
  ar: string;
};

const useOptions: Option<BuyingUse>[] = [
  { value: "music", en: "Music", ar: "موسيقى" },
  { value: "gaming", en: "Gaming", ar: "ألعاب" },
  { value: "studio", en: "Studio", ar: "استوديو" },
  { value: "podcast", en: "Podcast", ar: "بودكاست" },
  { value: "travel", en: "Travel", ar: "سفر" },
  { value: "daily", en: "Daily use", ar: "يومي" },
];

const budgetOptions: Option<BuyingBudget>[] = [
  { value: "budget", en: "Budget", ar: "اقتصادي" },
  { value: "midrange", en: "Midrange", ar: "متوسط" },
  { value: "premium", en: "Premium", ar: "فاخر" },
  { value: "no-limit", en: "No limit", ar: "بدون حد" },
];

const soundOptions: Option<SoundPreference>[] = [
  { value: "balanced", en: "Balanced", ar: "متوازن" },
  { value: "bass", en: "Bass", ar: "بيس" },
  { value: "vocal", en: "Vocal", ar: "فوكل" },
  { value: "detail", en: "Detail", ar: "تفاصيل" },
  { value: "warm", en: "Warm", ar: "دافئ" },
  { value: "neutral", en: "Neutral", ar: "محايد" },
];

const deviceOptions: Option<BuyingDevice>[] = [
  { value: "phone", en: "Phone", ar: "هاتف" },
  { value: "pc", en: "PC", ar: "كمبيوتر" },
  { value: "audio-interface", en: "Audio Interface", ar: "كرت صوت" },
  { value: "dac-amp", en: "DAC/AMP", ar: "DAC/AMP" },
  { value: "console", en: "Console", ar: "كونسول" },
];

const wireOptions: Option<WirePreference>[] = [
  { value: "wired", en: "Wired", ar: "سلكي" },
  { value: "wireless", en: "Wireless", ar: "لاسلكي" },
  { value: "any", en: "No preference", ar: "بدون تفضيل" },
];

const labelMap = {
  "best-match": { en: "Best Match", ar: "أفضل تطابق" },
  "best-value": { en: "Best Value", ar: "أفضل قيمة" },
  "premium-pick": { en: "Premium Pick", ar: "اختيار فاخر" },
} as const;

export function SmartBuyingAssistant({ products }: { products: RuntimeProduct[] }) {
  const { i18n } = useTranslation();
  const lang = i18n.language as "en" | "ar";
  const currency = useCurrency((s) => s.currency);
  const [open, setOpen] = useState(false);
  const [preferences, setPreferences] = useState<BuyingPreferences>({});

  const answerCount = Object.values(preferences).filter(Boolean).length;
  const recommendations = useMemo(
    () => (answerCount >= 2 ? getSmartBuyingRecommendations(products, preferences, lang) : []),
    [answerCount, lang, preferences, products],
  );

  const setValue = <Key extends keyof BuyingPreferences>(key: Key, value: NonNullable<BuyingPreferences[Key]>) => {
    setPreferences((current) => ({ ...current, [key]: current[key] === value ? undefined : value }));
  };

  return (
    <section className="mb-8 rounded-lg border border-border/30 bg-surface-lowest/55 p-4 md:p-5" data-reveal>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="mb-2 inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            {lang === "ar" ? "ساعدني أختار" : "Find Your Sound"}
          </p>
          <h2 className="font-display text-xl font-semibold tracking-tight md:text-2xl">
            {lang === "ar" ? "ترشيحات قليلة حسب استخدامك." : "A few picks based on how you listen."}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="premium-ghost inline-flex min-h-11 items-center justify-center rounded-md px-4 text-[11px] font-semibold uppercase tracking-widest text-primary"
          aria-expanded={open}
        >
          {open ? (lang === "ar" ? "إغلاق" : "Close") : lang === "ar" ? "ابدأ" : "Start"}
        </button>
      </div>

      {open ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            <Question title={lang === "ar" ? "لماذا تشتري؟" : "What are you buying for?"}>
              <OptionGroup options={useOptions} value={preferences.use} lang={lang} onSelect={(value) => setValue("use", value)} />
            </Question>
            <Question title={lang === "ar" ? "ما الميزانية؟" : "What is your budget?"}>
              <OptionGroup options={budgetOptions} value={preferences.budget} lang={lang} onSelect={(value) => setValue("budget", value)} />
            </Question>
            <Question title={lang === "ar" ? "أي صوت تفضل؟" : "What sound do you prefer?"}>
              <OptionGroup options={soundOptions} value={preferences.sound} lang={lang} onSelect={(value) => setValue("sound", value)} />
            </Question>
            <Question title={lang === "ar" ? "ما الجهاز المستخدم؟" : "What device will you use?"}>
              <OptionGroup options={deviceOptions} value={preferences.device} lang={lang} onSelect={(value) => setValue("device", value)} />
            </Question>
            <Question title={lang === "ar" ? "سلكي أم لاسلكي؟" : "Wired or wireless?"}>
              <OptionGroup options={wireOptions} value={preferences.wire} lang={lang} onSelect={(value) => setValue("wire", value)} />
            </Question>
          </div>

          <div className="rounded-md border border-border/25 bg-background/36 p-4">
            <p className="mb-4 text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
              {lang === "ar" ? "النتيجة" : "Result"}
            </p>
            {answerCount < 2 ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {lang === "ar" ? "اختر إجابتين على الأقل لنقترح 3 منتجات فقط." : "Answer at least two questions to get 3 focused picks."}
              </p>
            ) : recommendations.length ? (
              <div className="grid gap-3">
                {recommendations.map((item) => (
                  <Link
                    key={`${item.label}-${item.product.id}`}
                    to={`/product/${item.product.slug}`}
                    className="group grid grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-md p-2 transition-colors hover:bg-surface-high/60"
                  >
                    <span className="product-image-canvas flex aspect-square items-center justify-center overflow-hidden rounded-sm">
                      <img
                        src={item.product.image}
                        alt={item.product.name[lang] || item.product.name.en}
                        width={160}
                        height={160}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-contain p-1.5"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-primary">
                        {labelMap[item.label][lang]}
                      </span>
                      <span className="mt-1 block truncate text-sm font-semibold">{item.product.name[lang] || item.product.name.en}</span>
                      <span className="mt-1 block font-mono text-xs text-foreground/82">
                        {formatPrice(item.product.price, lang, currency)}
                      </span>
                      <span className="mt-1.5 block text-xs leading-relaxed text-muted-foreground">{item.reason}</span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {lang === "ar" ? "لم نجد تطابقاً مثالياً حالياً." : "We could not find a perfect match yet."}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Question({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-foreground/78">{title}</p>
      {children}
    </div>
  );
}

function OptionGroup<T extends string>({
  options,
  value,
  lang,
  onSelect,
}: {
  options: Option<T>[];
  value?: T;
  lang: "en" | "ar";
  onSelect: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option.value)}
          className={cn(
            "min-h-9 rounded-full border px-3 text-xs transition-colors",
            value === option.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border/35 bg-surface-high/45 text-muted-foreground hover:border-primary/50 hover:text-foreground",
          )}
        >
          {option[lang]}
        </button>
      ))}
    </div>
  );
}
