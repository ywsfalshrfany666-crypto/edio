import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import headphonesLifestyleImg from "@/assets/architecture/headphones-loudspeaker.jpg";
import iemsPackshotImg from "@/assets/normalized/home-iems-white.png";
import dacPackshotImg from "@/assets/products/fiio-k11-30633-1.jpeg";
import micPackshotImg from "@/assets/products/audio-technica-at2020-29522-1.jpg";
import dapPackshotImg from "@/assets/normalized/home-dap-white.jpg";
import {
  getCategoryPath,
  getDisplayCategoryTerms,
  resolveCategoryTerm,
} from "@/lib/categoryTaxonomy";
import { productCategorySlugs, type ProductCategorySlug } from "@/lib/productCategories";
import { cn } from "@/lib/utils";

type CategoryCopyKey = "headphones" | "iems" | "dac" | "mic" | "dap" | "audioInterface" | "accessories";
type SurfaceMode = "context" | "white";

type ShowcaseMedia = {
  src: string;
  alt: string;
  surface: SurfaceMode;
  fit: "cover" | "contain";
  focalPoint: string;
};

type ShowcaseItem = {
  slug: ProductCategorySlug;
  copyKey: CategoryCopyKey;
  href: string;
  media: ShowcaseMedia;
};

type TertiaryItem = {
  href: string;
  label: { en: string; ar: string };
};

const preferredHeroSlug: ProductCategorySlug = "headphones";
const preferredSecondarySlugs: ProductCategorySlug[] = ["iems", "dac", "mic", "dap"];

const mediaByCategory: Partial<Record<ProductCategorySlug, ShowcaseMedia>> = {
  headphones: {
    src: headphonesLifestyleImg,
    alt: "Over-ear headphones in a warm listening setup",
    surface: "context",
    fit: "cover",
    focalPoint: "50% 48%",
  },
  iems: {
    src: iemsPackshotImg,
    alt: "In-ear monitors on a pure white background",
    surface: "white",
    fit: "contain",
    focalPoint: "50% 54%",
  },
  dac: {
    src: dacPackshotImg,
    alt: "Compact desktop DAC and amplifier on a white background",
    surface: "white",
    fit: "contain",
    focalPoint: "50% 54%",
  },
  mic: {
    src: micPackshotImg,
    alt: "Studio microphone on a pure white background",
    surface: "white",
    fit: "contain",
    focalPoint: "50% 50%",
  },
  dap: {
    src: dapPackshotImg,
    alt: "Portable digital audio player on a pure white background",
    surface: "white",
    fit: "contain",
    focalPoint: "50% 52%",
  },
};

const categoryCopyKeys: Record<ProductCategorySlug, CategoryCopyKey> = {
  headphones: "headphones",
  iems: "iems",
  dap: "dap",
  dac: "dac",
  mic: "mic",
  "audio-interface": "audioInterface",
  accessories: "accessories",
};

const sectionCopy = {
  en: {
    eyebrow: "System paths",
    title: "Start with the right format.",
    body: "Clear category paths for the way you listen, record, and build a cleaner signal chain.",
    heroDescription: "Reference listening, portable comfort, and focused daily use.",
    explore: "Explore",
    chipLabel: "More category paths",
    preOwned: "Pre-Owned",
  },
  ar: {
    eyebrow: "مسارات النظام",
    title: "ابدأ من الصيغة المناسبة.",
    body: "فئات واضحة لطريقة استماعك، تسجيلك، وبناء سلسلة صوت أنظف.",
    heroDescription: "استماع مرجعي، راحة يومية، واستخدام مركز بلا تشتيت.",
    explore: "استكشف",
    chipLabel: "مسارات إضافية",
    preOwned: "مستعمل معتمد",
  },
};

const cardCopyByLanguage: Record<
  "en" | "ar",
  Record<CategoryCopyKey, { name: string; tag: string; cta: string }>
> = {
  en: {
    headphones: { name: "Headphones", tag: "Reference listening", cta: "Explore headphones" },
    iems: { name: "In-Ear Monitors", tag: "Portable precision", cta: "Explore IEMs" },
    dac: { name: "DACs & Amps", tag: "Signal path", cta: "Explore DACs & amps" },
    mic: { name: "Microphones", tag: "Studio capture", cta: "Explore microphones" },
    dap: { name: "Digital Audio Players", tag: "Pocket library", cta: "Explore DAPs" },
    audioInterface: { name: "Audio Interfaces", tag: "Recording chain", cta: "Explore audio interfaces" },
    accessories: { name: "Accessories", tag: "The essentials", cta: "Explore accessories" },
  },
  ar: {
    headphones: { name: "سماعات رأس", tag: "استماع مرجعي", cta: "استكشف سماعات الرأس" },
    iems: { name: "IEM", tag: "دقة محمولة", cta: "استكشف IEM" },
    dac: { name: "DAC & AMP", tag: "مسار الإشارة", cta: "استكشف DAC & AMP" },
    mic: { name: "ميكروفونات", tag: "التقاط استوديو", cta: "استكشف الميكروفونات" },
    dap: { name: "مشغلات DAP", tag: "مكتبتك المحمولة", cta: "استكشف DAP" },
    audioInterface: { name: "كرت صوت", tag: "سلسلة التسجيل", cta: "استكشف كرت الصوت" },
    accessories: { name: "إكسسوارات", tag: "الأساسيات", cta: "استكشف الإكسسوارات" },
  },
};

function hasCategory(slug: ProductCategorySlug) {
  return productCategorySlugs.includes(slug);
}

function buildShowcaseItem(slug: ProductCategorySlug): ShowcaseItem | null {
  const media = mediaByCategory[slug];
  if (!hasCategory(slug) || !media) return null;

  return {
    slug,
    copyKey: categoryCopyKeys[slug],
    href: getCategoryPath(slug),
    media,
  };
}

function buildTertiaryItems(lang: "en" | "ar", preOwnedLabel: string): TertiaryItem[] {
  const audioCableTerm = resolveCategoryTerm("accessories", "audio-cables");
  const items: TertiaryItem[] = [];

  if (audioCableTerm) {
    items.push({
      href: getCategoryPath("accessories", audioCableTerm.slug),
      label: {
        en: "Cables",
        ar: "كيابل",
      },
    });
  }

  if (hasCategory("accessories")) {
    items.push({
      href: getCategoryPath("accessories"),
      label: { en: "Accessories", ar: "إكسسوارات" },
    });
  }

  items.push({
    href: "/pre-owned",
    label: { en: "Pre-Owned", ar: preOwnedLabel },
  });

  return items.map((item) => ({
    ...item,
    label: { ...item.label, [lang]: item.label[lang] },
  }));
}

export function ArchitectureGrid() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("ar") ? "ar" : "en";
  const dir = lang === "ar" ? "rtl" : "ltr";
  const copy = sectionCopy[lang];
  const heroItem = buildShowcaseItem(preferredHeroSlug);
  const secondaryItems = preferredSecondarySlugs
    .map(buildShowcaseItem)
    .filter((item): item is ShowcaseItem => Boolean(item));
  const tertiaryItems = buildTertiaryItems(lang, copy.preOwned);

  if (!heroItem) return null;

  return (
    <section
      aria-labelledby="home-categories-title"
      data-header-surface="dark"
      dir={dir}
      className="home-categories section-luxury bg-surface-lowest py-16 md:py-20"
    >
      <div className="container-edio relative">
        <div className="home-categories__header">
          <div>
            <p className="label-tech mb-3 text-primary">{copy.eyebrow}</p>
            <h2
              id="home-categories-title"
              className="font-display arabic-display-safe text-balance text-4xl font-bold leading-[1.02] tracking-normal md:text-5xl"
            >
              {copy.title}
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-foreground/64 md:text-base">
            {copy.body}
          </p>
        </div>

        <div className="home-categories__layout">
          <CategoryCard item={heroItem} variant="hero" priority copy={copy} lang={lang} />

          <ul className="home-categories__secondary" role="list">
            {secondaryItems.map((item) => (
              <li key={item.slug}>
                <CategoryCard item={item} variant="secondary" copy={copy} lang={lang} />
              </li>
            ))}
          </ul>
        </div>

        <nav className="home-categories__tertiary" aria-label={copy.chipLabel}>
          {tertiaryItems.map((item) => (
            <Link key={item.href} to={item.href} className="home-category-chip">
              <span>{item.label[lang]}</span>
              <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}

function CategoryCard({
  item,
  variant,
  priority = false,
  copy,
  lang,
}: {
  item: ShowcaseItem;
  variant: "hero" | "secondary";
  priority?: boolean;
  copy: (typeof sectionCopy)["en"];
  lang: "en" | "ar";
}) {
  const cardCopy = cardCopyByLanguage[lang][item.copyKey];
  const terms = getDisplayCategoryTerms(item.slug).slice(0, 2);
  const titleId = `home-category-${item.slug}-title`;
  const descriptionId = variant === "hero" ? `home-category-${item.slug}-description` : undefined;
  const ctaText = cardCopy.cta || `${copy.explore} ${cardCopy.name}`;

  return (
    <Link
      to={item.href}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className={cn(
        "category-card group",
        variant === "hero" ? "category-card--hero" : "category-card--secondary",
        item.media.surface === "white" && "category-card--white-canvas",
      )}
    >
      <span className="category-card__media">
        <img
          src={item.media.src}
          alt={item.media.alt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding="async"
          className="category-card__image"
          style={{
            objectFit: item.media.fit,
            objectPosition: item.media.focalPoint,
          }}
        />
      </span>
      <span className="category-card__overlay" aria-hidden="true" />

      <span className="category-card__content">
        <span className="category-card__eyebrow">{cardCopy.tag}</span>
        <span id={titleId} className="category-card__title">
          {cardCopy.name}
        </span>
        {variant === "hero" && (
          <span id={descriptionId} className="category-card__description">
            {copy.heroDescription}
          </span>
        )}
        {terms.length > 0 && (
          <span className="category-card__terms" aria-label={lang === "ar" ? "الأقسام الفرعية" : "Subcategories"}>
            {terms.map((term) => (
              <span key={term.slug} className="category-card__term">
                {term.label[lang]}
              </span>
            ))}
          </span>
        )}
        <span className="category-card__cta">
          {ctaText}
          <span className="category-card__cta-icon" aria-hidden="true">
            <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </span>
        </span>
      </span>
    </Link>
  );
}
