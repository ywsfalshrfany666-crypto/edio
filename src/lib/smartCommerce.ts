import { normalizeProductCategory } from "@/lib/productCategories";
import { getProductSearchText, normalizeSearchText } from "@/lib/search";

export type BuyingUse = "music" | "gaming" | "studio" | "podcast" | "travel" | "daily";
export type BuyingBudget = "budget" | "midrange" | "premium" | "no-limit";
export type SoundPreference = "balanced" | "bass" | "vocal" | "detail" | "warm" | "neutral";
export type BuyingDevice = "phone" | "pc" | "audio-interface" | "dac-amp" | "console";
export type WirePreference = "wired" | "wireless" | "any";

export type BuyingPreferences = {
  use?: BuyingUse;
  budget?: BuyingBudget;
  sound?: SoundPreference;
  device?: BuyingDevice;
  wire?: WirePreference;
};

type SmartProduct = {
  id?: string;
  name?: { en?: string; ar?: string };
  brand?: string;
  category?: string;
  subCategories?: string[];
  tagline?: { en?: string; ar?: string };
  features?: string[];
  specs?: Array<{ label?: string | { en?: string; ar?: string }; value?: string }>;
  price?: number;
  inStock?: boolean;
};

export type SmartRecommendation<T extends SmartProduct = SmartProduct> = {
  label: "best-match" | "best-value" | "premium-pick";
  product: T;
  reason: string;
  score: number;
};

const BUDGET_LIMITS: Record<BuyingBudget, number> = {
  budget: 150000,
  midrange: 450000,
  premium: 1200000,
  "no-limit": Number.POSITIVE_INFINITY,
};

const USE_CASES: Record<BuyingUse, { categories: string[]; terms: string[] }> = {
  music: { categories: ["headphones", "iems", "dac", "dap"], terms: ["music", "listening", "hi fi", "hifi"] },
  gaming: { categories: ["headphones", "mic", "dac"], terms: ["gaming", "game", "console", "low latency"] },
  studio: { categories: ["audio-interface", "mic", "headphones"], terms: ["studio", "monitor", "recording", "mix"] },
  podcast: { categories: ["mic", "audio-interface", "headphones"], terms: ["podcast", "broadcast", "voice", "vocal"] },
  travel: { categories: ["iems", "dap", "dac", "headphones"], terms: ["portable", "travel", "bluetooth", "wireless"] },
  daily: { categories: ["iems", "headphones", "dac"], terms: ["daily", "portable", "comfort", "phone"] },
};

const DEVICE_CASES: Record<BuyingDevice, { categories: string[]; terms: string[] }> = {
  phone: { categories: ["iems", "dac", "dap"], terms: ["portable", "usb c", "bluetooth", "phone"] },
  pc: { categories: ["headphones", "dac", "mic", "audio-interface"], terms: ["desktop", "usb", "pc"] },
  "audio-interface": { categories: ["mic", "headphones", "accessories"], terms: ["xlr", "monitor", "interface"] },
  "dac-amp": { categories: ["headphones", "iems", "accessories"], terms: ["balanced", "4.4", "6.35", "desktop"] },
  console: { categories: ["headphones", "mic", "dac"], terms: ["console", "gaming", "usb"] },
};

const SOUND_TERMS: Record<SoundPreference, string[]> = {
  balanced: ["balanced", "balance", "متوازن"],
  bass: ["bass", "sub bass", "low end", "بيس"],
  vocal: ["vocal", "voice", "midrange", "vocals", "صوت"],
  detail: ["detail", "resolution", "analytical", "تفاصيل"],
  warm: ["warm", "smooth", "musical", "دافئ"],
  neutral: ["neutral", "flat", "reference", "محايد"],
};

export function getSmartBuyingRecommendations<T extends SmartProduct>(
  products: T[],
  preferences: BuyingPreferences,
  lang: "en" | "ar",
): SmartRecommendation<T>[] {
  const scored = products
    .filter((product) => product.id && Number(product.price || 0) > 0)
    .map((product) => ({ product, score: scoreProduct(product, preferences) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || Number(a.product.price || 0) - Number(b.product.price || 0));

  if (!scored.length) return [];

  const picks: SmartRecommendation<T>[] = [];
  const used = new Set<string>();
  const push = (label: SmartRecommendation<T>["label"], item: (typeof scored)[number] | undefined) => {
    if (!item || !item.product.id || used.has(item.product.id)) return;
    used.add(item.product.id);
    picks.push({ label, product: item.product, score: item.score, reason: recommendationReason(label, item.product, preferences, lang) });
  };

  push("best-match", scored[0]);

  const budgetLimit = preferences.budget ? BUDGET_LIMITS[preferences.budget] : Number.POSITIVE_INFINITY;
  const valuePool = scored
    .filter(({ product }) => Number(product.price || 0) <= budgetLimit)
    .sort((a, b) => valueScore(b) - valueScore(a));
  push("best-value", valuePool[0] || scored[Math.min(1, scored.length - 1)]);

  const premiumPool = scored
    .filter(({ product }) => preferences.budget === "no-limit" || Number(product.price || 0) >= Math.min(450000, budgetLimit))
    .sort((a, b) => Number(b.product.price || 0) - Number(a.product.price || 0));
  push("premium-pick", premiumPool[0] || scored[Math.min(2, scored.length - 1)]);

  for (const item of scored) {
    if (picks.length >= 3) break;
    push(picks.length === 1 ? "best-value" : "premium-pick", item);
  }

  return picks.slice(0, 3);
}

function scoreProduct(product: SmartProduct, preferences: BuyingPreferences) {
  const category = normalizeProductCategory(product);
  const text = normalizeSearchText(getProductSearchText(product));
  let score = product.inStock ? 10 : 2;

  if (preferences.use) {
    const profile = USE_CASES[preferences.use];
    if (profile.categories.includes(category)) score += 28;
    score += termHits(text, profile.terms) * 5;
  }

  if (preferences.device) {
    const profile = DEVICE_CASES[preferences.device];
    if (profile.categories.includes(category)) score += 18;
    score += termHits(text, profile.terms) * 4;
  }

  if (preferences.sound) {
    const hits = termHits(text, SOUND_TERMS[preferences.sound]);
    score += hits ? 12 + hits * 3 : 2;
  }

  if (preferences.wire && preferences.wire !== "any") {
    const wireless = /\b(wireless|bluetooth|bt|لاسلكي|بلوتوث)\b/i.test(text);
    score += preferences.wire === "wireless" ? (wireless ? 16 : -8) : wireless ? -6 : 10;
  }

  if (preferences.budget) {
    const limit = BUDGET_LIMITS[preferences.budget];
    const price = Number(product.price || 0);
    if (Number.isFinite(limit)) score += price <= limit ? 14 : -Math.min(20, Math.ceil((price - limit) / 100000) * 3);
    else score += 8;
  }

  return score;
}

function termHits(text: string, terms: string[]) {
  return terms.reduce((count, term) => count + (text.includes(normalizeSearchText(term)) ? 1 : 0), 0);
}

function valueScore(item: { product: SmartProduct; score: number }) {
  return item.score / (Number(item.product.price || 0) / 100000 + 1);
}

function recommendationReason(
  label: SmartRecommendation["label"],
  product: SmartProduct,
  preferences: BuyingPreferences,
  lang: "en" | "ar",
) {
  const category = normalizeProductCategory(product);
  const useCopy = preferences.use
    ? {
        music: lang === "ar" ? "للاستماع الموسيقي" : "for music listening",
        gaming: lang === "ar" ? "للألعاب" : "for gaming",
        studio: lang === "ar" ? "للعمل الاستوديو" : "for studio work",
        podcast: lang === "ar" ? "للبودكاست والصوت" : "for podcast and voice",
        travel: lang === "ar" ? "للاستخدام المحمول" : "for portable use",
        daily: lang === "ar" ? "للاستخدام اليومي" : "for daily use",
      }[preferences.use]
    : "";

  if (label === "best-value") {
    return lang === "ar" ? `قيمة قوية ${useCopy} ضمن الميزانية.` : `Strong value ${useCopy} within your budget.`;
  }
  if (label === "premium-pick") {
    return lang === "ar" ? `اختيار أعلى مستوى لمن يريد نتيجة أفضل.` : `A higher-end pick when you want more headroom.`;
  }
  if (category === "audio-interface") {
    return lang === "ar" ? "يناسب سلسلة تسجيل بسيطة وواضحة." : "Fits a clean recording setup.";
  }
  return lang === "ar" ? `أفضل تطابق ${useCopy} حسب اختياراتك.` : `Best match ${useCopy} based on your answers.`;
}
