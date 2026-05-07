import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import dapImage from "@/assets/normalized/home-dap-white.jpg";
import iemImage from "@/assets/normalized/home-iems-white.png";
import dacImage from "@/assets/products/fiio-k11-30633-1.jpeg";
import headphoneImage from "@/assets/products/philips-shp9500-32223-1.webp";
import microphoneImage from "@/assets/products/audio-technica-at2020-29522-1.jpg";
import { getCategoryPath } from "@/lib/categoryTaxonomy";
import { productCategorySlugs, type ProductCategorySlug } from "@/lib/productCategories";

type Lang = "en" | "ar";

type CategoryShowcaseItem = {
  slug: ProductCategorySlug;
  title: Record<Lang, string>;
  eyebrow: Record<Lang, string>;
  cta: Record<Lang, string>;
  image?: string;
  imageAlt?: Record<Lang, string>;
};

const sectionCopy: Record<Lang, { eyebrow: string; title: string; body: string }> = {
  en: {
    eyebrow: "Listening map",
    title: "Choose your sound path",
    body: "Clear categories for headphones, IEMs, source gear, and recording tools.",
  },
  ar: {
    eyebrow: "دليل الاستماع",
    title: "اختر مسارك الصوتي",
    body: "فئات واضحة تقودك بسرعة إلى السماعة أو المصدر أو أداة التسجيل المناسبة.",
  },
};

const categoryShowcaseItems: CategoryShowcaseItem[] = [
  {
    slug: "headphones",
    title: { en: "Headphones", ar: "سماعات رأس" },
    eyebrow: { en: "Reference listening", ar: "استماع مرجعي" },
    cta: { en: "Explore headphones", ar: "استكشف السماعات" },
    image: headphoneImage,
    imageAlt: {
      en: "Open-back headphones on a white background",
      ar: "سماعات رأس على خلفية بيضاء",
    },
  },
  {
    slug: "iems",
    title: { en: "IEM", ar: "IEM" },
    eyebrow: { en: "Portable precision", ar: "دقة محمولة" },
    cta: { en: "Explore IEM", ar: "استكشف IEM" },
    image: iemImage,
    imageAlt: {
      en: "In-ear monitors on a white background",
      ar: "سماعات IEM على خلفية بيضاء",
    },
  },
  {
    slug: "dac",
    title: { en: "DAC & AMP", ar: "DAC & AMP" },
    eyebrow: { en: "Clean source", ar: "مصادر نظيفة" },
    cta: { en: "Explore sources", ar: "استكشف المصادر" },
    image: dacImage,
    imageAlt: {
      en: "Compact DAC and amplifier on a white background",
      ar: "جهاز DAC و AMP على خلفية بيضاء",
    },
  },
  {
    slug: "dap",
    title: { en: "DAP", ar: "DAP" },
    eyebrow: { en: "Portable players", ar: "مشغلات محمولة" },
    cta: { en: "Explore DAP", ar: "استكشف DAP" },
    image: dapImage,
    imageAlt: {
      en: "Portable digital audio player on a white background",
      ar: "مشغل DAP على خلفية بيضاء",
    },
  },
  {
    slug: "mic",
    title: { en: "Microphones", ar: "ميكروفونات" },
    eyebrow: { en: "Clear capture", ar: "تسجيل واضح" },
    cta: { en: "Explore microphones", ar: "استكشف الميكروفونات" },
    image: microphoneImage,
    imageAlt: {
      en: "Studio microphone on a white background",
      ar: "ميكروفون استوديو على خلفية بيضاء",
    },
  },
  {
    slug: "audio-interface",
    title: { en: "Audio Interfaces", ar: "كرت صوت" },
    eyebrow: { en: "Recording chain", ar: "واجهة تسجيلك" },
    cta: { en: "Explore interfaces", ar: "استكشف كروت الصوت" },
  },
  {
    slug: "accessories",
    title: { en: "Accessories", ar: "إكسسوارات" },
    eyebrow: { en: "Experience essentials", ar: "أساسيات التجربة" },
    cta: { en: "Explore accessories", ar: "استكشف الإكسسوارات" },
  },
];

function hasCategory(slug: ProductCategorySlug) {
  return productCategorySlugs.includes(slug);
}

export function ArchitectureGrid() {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language.startsWith("ar") ? "ar" : "en";
  const dir = lang === "ar" ? "rtl" : "ltr";
  const copy = sectionCopy[lang];
  const items = categoryShowcaseItems.filter((item) => hasCategory(item.slug));

  if (!items.length) return null;

  return (
    <section
      aria-labelledby="home-categories-title"
      data-header-surface="dark"
      dir={dir}
      className="home-category-showcase section-luxury bg-surface-lowest"
    >
      <div className="container-edio">
        <div className="home-category-showcase__header">
          <p className="home-category-showcase__eyebrow">{copy.eyebrow}</p>
          <div className="home-category-showcase__headline">
            <h2 id="home-categories-title" className="home-category-showcase__title">
              {copy.title}
            </h2>
            <p className="home-category-showcase__body">{copy.body}</p>
          </div>
        </div>

        <div className="home-category-showcase__grid">
          {items.map((item, index) => (
            <CategoryCard key={item.slug} item={item} index={index} lang={lang} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CategoryCard({ item, index, lang }: { item: CategoryShowcaseItem; index: number; lang: Lang }) {
  const titleId = `home-category-${item.slug}-title`;

  return (
    <Link
      to={getCategoryPath(item.slug)}
      aria-labelledby={titleId}
      className="home-category-showcase-card"
    >
      <span className="home-category-showcase-card__number" aria-hidden>
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className="home-category-showcase-card__content">
        <span className="home-category-showcase-card__eyebrow">{item.eyebrow[lang]}</span>
        <span id={titleId} className="home-category-showcase-card__title">
          {item.title[lang]}
        </span>
        <span className="home-category-showcase-card__cta">
          {item.cta[lang]}
          <ArrowRight className="home-category-showcase-card__icon rtl:rotate-180" aria-hidden />
        </span>
      </span>
      {item.image ? (
        <span className="home-category-showcase-card__media">
          <img
            src={item.image}
            alt={item.imageAlt?.[lang] ?? ""}
            className="home-category-showcase-card__image"
            loading="lazy"
            decoding="async"
          />
        </span>
      ) : null}
    </Link>
  );
}
