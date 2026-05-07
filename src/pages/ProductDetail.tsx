import { useParams, Navigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Seo } from "@/components/Seo";
import { ProductCard } from "@/components/shop/ProductCard";
import { ProductDetailTabs, type ProductDetailTab } from "@/components/shop/ProductDetailTabs";
import { ProductGridViewToggle } from "@/components/shop/ProductGridViewToggle";
import { ProductGallery } from "@/components/shop/ProductGallery";
import { formatPrice } from "@/data/catalog";
import { useCart } from "@/store/cart";
import { useCurrency } from "@/store/currency";
import { toast } from "sonner";
import { useRuntimeProduct } from "@/lib/runtimeCatalog";
import { getCategoryTranslationKey } from "@/lib/productCategories";
import {
  normalizeProductDescriptionBlocks,
  splitProductDescriptionSections,
  type NormalizedDescriptionBlock,
} from "@/lib/productDescriptionBlocks";
import { getPublicStockDisplay } from "@/lib/publicStock";
import {
  getConciseDescription,
  getOrderedSpecs,
  getProductHighlights,
  getUsefulFaq,
} from "@/lib/productPresentation";
import {
  getProductRecommendationSections,
  type ProductRecommendationSection,
} from "@/lib/productRecommendations";
import type { ProductContentBlock, ProductDetailContent, ProductSoundProfile, ProductSpecGroup } from "@/lib/productContent/productContentTypes";
import { normalizeProductPageContent, productPageToDetailContent } from "@/lib/productPageBuilder";
import { buildBreadcrumbJsonLd, buildProductJsonLd, buildProductSeo } from "@/lib/seo";
import { useProductGridView } from "@/lib/productGridView";
import { cn } from "@/lib/utils";

const FREE_SHIPPING_THRESHOLD = 150000;
const SHIPPING_FEE = 5000;

const ProductDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as "en" | "ar";
  const currency = useCurrency((s) => s.currency);
  const { product, products, loading } = useRuntimeProduct(slug);
  const add = useCart((s) => s.add);
  const open = useCart((s) => s.open);

  if (!loading && !product) return <Navigate to="/shop" replace />;
  if (!product) {
    return (
      <Layout>
        <section data-header-surface="dark" className="bg-background pb-20 pt-28">
          <div className="container-edio">
            <div className="h-[70vh] animate-pulse rounded-lg border border-border/20 bg-surface-high/40" />
          </div>
        </section>
      </Layout>
    );
  }

  const galleryImages = uniqueTextList([product.image, ...(product.gallery || [])]);
  const compareAt = typeof product.compareAt === "number" && product.compareAt > product.price ? product.compareAt : null;
  const savings = compareAt ? compareAt - product.price : 0;
  const description = getConciseDescription(product, lang);
  const descriptionBlocks = normalizeProductDescriptionBlocks(product, lang);
  const descriptionSections = splitProductDescriptionSections(descriptionBlocks);
  const highlights = getProductHighlights(product, lang, 5);
  const specs = getOrderedSpecs(product, lang, 16);
  const productPage = normalizeProductPageContent((product as { productPage?: unknown }).productPage);
  const richContent = productPageToDetailContent(productPage) || getOptionalProductDetailContent(product);
  const productPageBlocks = productPage?.description?.blocks?.filter((block) => block.visible !== false) || [];
  const hasDescriptionSection = Boolean(description || descriptionSections.textBlocks.length);
  const hasSpecsSection = Boolean(specs.length || descriptionSections.specImageBlocks.length);
  const hasBoxSection = Boolean(descriptionSections.boxContents.length || descriptionSections.boxImageBlocks.length);
  const hasRichDescription = hasDescriptionSection || descriptionSections.descriptionImageBlocks.length > 0 || hasBoxSection;
  const tabs: ProductDetailTab[] = [
    {
      id: "description",
      label: lang === "ar" ? "الوصف" : "Description",
      eyebrow: lang === "ar" ? "الوصف" : "Description",
      title: lang === "ar" ? "قصة المنتج بوضوح." : "The product story, clearly organized.",
      summary:
        lang === "ar"
          ? "نرتب الوصف والصور والمحتويات المؤكدة في مساحة واحدة سهلة القراءة."
          : "Description, source media, and confirmed box contents are kept together for easier reading.",
      content: (
        productPageBlocks.length ? (
          <ProductPageDescriptionTabContent blocks={productPageBlocks} lang={lang} />
        ) : (
          <ProductDescriptionTabContent
            description={description}
            textBlocks={descriptionSections.textBlocks}
            imageBlocks={descriptionSections.descriptionImageBlocks}
            boxContents={descriptionSections.boxContents}
            boxImageBlocks={descriptionSections.boxImageBlocks}
            hasRichDescription={hasRichDescription}
            lang={lang}
          />
        )
      ),
    },
    {
      id: "sound",
      label: lang === "ar" ? "الصوت" : "Sound",
      eyebrow: lang === "ar" ? "الصوت" : "Sound",
      title: lang === "ar" ? "الانطباع الصوتي عند توفره." : "Listening notes when verified.",
      summary:
        lang === "ar"
          ? "لا نعرض توقيعاً صوتياً أو قياسات إلا إذا كانت موجودة ومؤكدة."
          : "Sound impressions and measurements appear only when Edio has verified product data.",
      content: <ProductSoundTabContent lang={lang} highlights={highlights} sound={richContent?.sound} />,
    },
    {
      id: "specs",
      label: lang === "ar" ? "المواصفات" : "Specs",
      eyebrow: t("pdp.specs"),
      title: lang === "ar" ? "مواصفات مرتبة بدون ازدحام." : "Specs, ordered by what matters.",
      summary:
        lang === "ar"
          ? "نعرض فقط المواصفات أو صور المواصفات المؤكدة لهذا المنتج."
          : "Only confirmed specs or source spec images are shown here.",
      content: (
        <ProductSpecsTabContent
          specs={specs}
          specGroups={richContent?.specGroups}
          specImageBlocks={descriptionSections.specImageBlocks}
          fallbackHighlights={highlights}
          lang={lang}
        />
      ),
    },
  ];
  const recommendationSections = getProductRecommendationSections(product, products, lang);
  const faq = getUsefulFaq(product, lang);
  const productSeo = buildProductSeo(product, lang);
  const productCategoryKey = getCategoryTranslationKey(product.category);
  const productCategoryLabel = productCategoryKey
    ? (t(`categoriesBlock.${productCategoryKey}`, { returnObjects: true }) as { name?: string }).name || product.category
    : lang === "ar"
      ? "مراجعة التصنيف"
      : "Needs review";
  const publicStock = getPublicStockDisplay({
    availableQuantity: product.publicStock?.low_stock ? product.publicStock.low_stock_quantity : product.stock,
    inStock: product.inStock,
    availabilityStatus: product.publicStock?.availability || product.availabilityStatus,
    locale: lang,
  });
  const stockLine = publicStock.label;
  const shippingLine =
    product.price >= FREE_SHIPPING_THRESHOLD
      ? lang === "ar"
        ? "شحن مجاني لهذا المنتج"
        : "Free shipping on this item"
      : lang === "ar"
        ? `${formatPrice(SHIPPING_FEE, lang, currency)} شحن، ومجاني فوق ${formatPrice(FREE_SHIPPING_THRESHOLD, lang, currency)}`
        : `${formatPrice(SHIPPING_FEE, lang, currency)} shipping, free over ${formatPrice(FREE_SHIPPING_THRESHOLD, lang, currency)}`;
  const badgeLabel = product.badge
    ? product.badge === "new"
      ? t("common.new")
      : product.badge === "featured"
        ? t("common.featured")
        : product.badge === "preowned"
          ? t("common.preOwned")
          : t("common.bestSeller")
    : null;
  const trustItems = [
    stockLine,
    lang === "ar" ? "توصيل داخل العراق" : "Delivery in Iraq",
    lang === "ar" ? "دعم قبل الشراء" : "Support before buying",
    product.badge === "preowned"
      ? lang === "ar"
        ? "قطعة مفحوصة"
        : "Inspected item"
      : lang === "ar"
        ? "طلب آمن"
        : "Secure order",
  ];

  const handleAdd = () => {
    add(product.id, 1);
    toast.success(t("pdp.addedToCart"), { description: product.name[lang] });
  };

  const handleBuyNow = () => {
    add(product.id, 1);
    open();
  };

  return (
    <Layout>
      <Seo
        title={productSeo.title}
        pageType="product"
        description={productSeo.description}
        canonicalPath={productSeo.canonicalPath}
        image={productSeo.image}
        imageAlt={productSeo.imageAlt}
        type="product"
        jsonLd={[
          buildProductJsonLd(product, lang),
          buildBreadcrumbJsonLd([
            { name: "Shop", path: "/shop" },
            { name: productCategoryLabel, path: `/category/${product.category}` },
            { name: product.name[lang] || product.name.en, path: productSeo.canonicalPath },
          ]),
        ]}
      />
      <section data-header-surface="mixed" className="bg-background pb-20 pt-28 md:pt-32">
        <div className="container-edio">
          <nav className="mb-8 flex flex-wrap items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            <Link to="/shop" className="transition-colors hover:text-foreground">{t("nav.shop")}</Link>
            <span className="opacity-35">/</span>
            <Link to={`/category/${product.category}`} className="transition-colors hover:text-foreground">
              {productCategoryLabel}
            </Link>
            <span className="opacity-35">/</span>
            <span className="max-w-[220px] truncate text-foreground/70">{product.name[lang]}</span>
          </nav>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start" data-reveal="fade">
              <ProductGallery images={galleryImages} alt={product.name[lang]} badge={badgeLabel} discount={0} />
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start" data-reveal>
              <div className="border-b border-border/30 pb-6">
                <p className="mb-3 text-[11px] font-mono uppercase tracking-[0.18em] text-primary">{product.brand}</p>
                <h1 className="font-display text-3xl font-semibold leading-[1.04] text-balance md:text-4xl lg:text-5xl">
                  {product.name[lang]}
                </h1>
              </div>

              <div className="border-b border-border/30 py-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <span className="block font-mono text-3xl font-semibold tabular-nums md:text-[2.15rem]">
                      {formatPrice(product.price, lang, currency)}
                    </span>
                    {compareAt ? (
                      <span className="mt-2 block font-mono text-sm text-muted-foreground line-through tabular-nums">
                        {formatPrice(compareAt, lang, currency)}
                      </span>
                    ) : null}
                  </div>
                  {savings > 0 ? (
                    <span className="edio-product-badge edio-product-badge--sale">
                      {lang === "ar" ? "توفير" : "Save"} {formatPrice(savings, lang, currency)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-foreground/78">
                  <span className={publicStock.severity === "danger" ? "edio-stock edio-stock--out" : "edio-stock edio-stock--in"}>
                    <span aria-hidden />
                    {stockLine}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/40" aria-hidden />
                  <span>{shippingLine}</span>
                </div>
                <TrustStrip items={trustItems} />
              </div>

              {highlights.length > 0 ? (
                <div className="border-b border-border/30 py-6">
                  <p className="mb-4 text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                    {lang === "ar" ? "الأهم أولاً" : "What matters first"}
                  </p>
                  <ul className="space-y-3">
                    {highlights.slice(0, 5).map((item) => (
                      <li key={item} className="flex gap-3 text-sm leading-relaxed text-foreground/84">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.8} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="pt-6">
                <div className="flex items-stretch">
                  <button
                    onClick={handleAdd}
                    className="premium-ghost min-h-12 w-full !rounded-md px-4 text-[11px] font-semibold uppercase tracking-widest text-foreground"
                  >
                    {t("cta.addToCart")}
                  </button>
                </div>
                <button
                  onClick={handleBuyNow}
                  className="premium-cta mt-3 inline-flex min-h-12 w-full items-center justify-center gap-3 !rounded-md py-2.5 text-[11px] font-semibold uppercase tracking-widest"
                >
                  {t("cta.buyNow")}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </button>
              </div>
            </aside>
          </div>

          <ProductDetailTabs tabs={tabs} dir={lang === "ar" ? "rtl" : "ltr"} />

          {recommendationSections.length > 0 ? (
            <RecommendationBlocks
              sections={recommendationSections}
              categoryPath={`/category/${product.category}`}
              categoryLabel={t("cta.viewCollection")}
              lang={lang}
            />
          ) : null}

          {faq.length > 0 ? (
            <section className="mt-20 border-t border-border/30 pt-14" data-reveal>
              <div className="grid gap-8 lg:grid-cols-[0.36fr_0.64fr]">
                <SectionIntro
                  eyebrow="FAQ"
                  title={lang === "ar" ? "أسئلة سريعة." : "Quick checks."}
                  copy={lang === "ar" ? "نعرضها فقط عندما تضيف وضوحاً فعلياً للشراء." : "Shown only when it removes real buying friction."}
                />
                <div className="divide-y divide-border/30 rounded-lg border border-border/35 bg-surface-lowest/60">
                  {faq.map((item) => (
                    <div key={item.q} className="p-5">
                      <h3 className="font-display text-lg font-semibold">{item.q}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-foreground/70">{item.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </Layout>
  );
};

function TrustStrip({ items }: { items: string[] }) {
  return (
    <div className="mt-5 grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border/22 bg-surface-lowest/40 px-3 text-xs text-foreground/78"
        >
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.8} />
          {item}
        </span>
      ))}
    </div>
  );
}

function ProductPageDescriptionTabContent({ blocks, lang }: { blocks: ProductContentBlock[]; lang: "en" | "ar" }) {
  const sortedBlocks = [...blocks].sort((left, right) => left.order - right.order);
  return (
    <div className="space-y-8">
      {sortedBlocks.map((block) => {
        const image = block.media?.url;
        const imageFirst = block.layout === "image-left";
        const fullWidth = block.layout === "full-width" || block.type === "full_width_image";
        const figure = image ? (
          <figure className="product-description-media">
            <img
              src={image}
              alt={block.media?.alt || block.title}
              width={block.media?.width}
              height={block.media?.height}
              loading="lazy"
              decoding="async"
            />
            {block.media?.caption ? <figcaption>{block.media.caption}</figcaption> : null}
          </figure>
        ) : null;
        const copy = (
          <div className="space-y-3">
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-primary">
              {block.type.replace(/_/g, " ")}
            </p>
            {block.title ? <h3 className="font-display text-xl font-semibold leading-tight md:text-2xl">{block.title}</h3> : null}
            {block.subtitle ? <p className="text-sm leading-relaxed text-muted-foreground">{block.subtitle}</p> : null}
            {block.body ? <p className="text-base leading-[1.8] text-foreground/76">{block.body}</p> : null}
          </div>
        );

        if (block.type === "video_embed" && block.video?.url) {
          return (
            <div key={block.id} className="rounded-lg border border-border/35 bg-surface-lowest/60 p-5">
              {copy}
              <a className="mt-4 inline-flex text-sm font-semibold text-primary hover:text-primary/80" href={block.video.url} target="_blank" rel="noreferrer">
                {lang === "ar" ? "فتح الفيديو" : "Open video"}
              </a>
            </div>
          );
        }

        if (fullWidth) {
          return (
            <div key={block.id} className="space-y-5">
              {copy}
              {figure}
            </div>
          );
        }

        return (
          <div key={block.id} className="grid gap-6 rounded-lg border border-border/30 bg-surface-lowest/50 p-5 md:grid-cols-2">
            {imageFirst ? figure : copy}
            {imageFirst ? copy : figure}
          </div>
        );
      })}
    </div>
  );
}

function ProductDescriptionContent({
  description,
  blocks,
}: {
  description: string;
  blocks: NormalizedDescriptionBlock[];
}) {
  return (
    <div className="product-description-flow max-w-3xl text-lg leading-[1.8] text-foreground/75">
      {description ? <p>{description}</p> : null}
      {blocks.map((block) => {
        if (block.type === "text" || block.type === "callout") {
          return (
            <p
              key={block.id}
              className={block.type === "callout" ? "rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-base text-foreground/84" : ""}
            >
              {block.text}
            </p>
          );
        }

        const aspectRatio = block.width && block.height ? `${block.width} / ${block.height}` : undefined;
        return (
          <figure
            key={block.id}
            className={
              block.type === "spec_image"
                ? "product-description-media product-description-media--spec"
                : "product-description-media"
            }
          >
            <img
              src={block.mediaUrl}
              alt={block.alt}
              loading="lazy"
              decoding="async"
              width={block.width}
              height={block.height}
              style={aspectRatio ? { aspectRatio } : undefined}
            />
            {block.caption ? <figcaption>{block.caption}</figcaption> : null}
            {block.type === "spec_image" && block.extractedText ? (
              <p className="product-description-media__extracted">{block.extractedText}</p>
            ) : null}
          </figure>
        );
      })}
    </div>
  );
}

function ProductDescriptionMediaGrid({
  blocks,
  variant = "description",
}: {
  blocks: NormalizedDescriptionBlock[];
  variant?: "description" | "spec";
}) {
  return (
    <div className={variant === "spec" ? "product-description-flow" : "product-description-media-stack"}>
      {blocks.map((block) => (
        <ProductDescriptionFigure key={block.id} block={block} />
      ))}
    </div>
  );
}

function ProductDescriptionTabContent({
  description,
  textBlocks,
  imageBlocks,
  boxContents,
  boxImageBlocks,
  hasRichDescription,
  lang,
}: {
  description: string;
  textBlocks: NormalizedDescriptionBlock[];
  imageBlocks: NormalizedDescriptionBlock[];
  boxContents: string[];
  boxImageBlocks: NormalizedDescriptionBlock[];
  hasRichDescription: boolean;
  lang: "en" | "ar";
}) {
  return (
    <div className="space-y-8">
      {hasRichDescription ? (
        <>
          <ProductDescriptionContent description={description} blocks={textBlocks} />
          {imageBlocks.length > 0 ? <ProductDescriptionMediaGrid blocks={imageBlocks} /> : null}
          {boxContents.length > 0 || boxImageBlocks.length > 0 ? (
            <div className="space-y-5 border-t border-border/25 pt-8">
              <div>
                <p className="mb-2 text-[11px] font-mono uppercase tracking-[0.18em] text-primary">
                  {lang === "ar" ? "داخل الصندوق" : "In the box"}
                </p>
                <h3 className="font-display text-xl font-semibold tracking-tight">
                  {lang === "ar" ? "المحتويات المؤكدة فقط." : "Confirmed contents only."}
                </h3>
              </div>
              {boxContents.length > 0 ? (
                <ul className="grid gap-2 rounded-lg border border-border/35 bg-surface-lowest/60 p-4 sm:grid-cols-2">
                  {boxContents.map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-relaxed text-foreground/82">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.8} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {boxImageBlocks.length > 0 ? <ProductDescriptionMediaGrid blocks={boxImageBlocks} /> : null}
            </div>
          ) : null}
        </>
      ) : (
        <p className="rounded-lg border border-border/35 bg-surface-lowest/60 p-5 text-sm leading-relaxed text-foreground/72">
          {lang === "ar" ? "تفاصيل الوصف قيد التجهيز لهذا المنتج." : "Product description details are being prepared."}
        </p>
      )}
    </div>
  );
}

function ProductSoundTabContent({
  lang,
  highlights,
  sound,
}: {
  lang: "en" | "ar";
  highlights: string[];
  sound?: ProductSoundProfile;
}) {
  const safeHighlights = highlights.slice(0, 4);
  const hasSoundData = Boolean(
    sound?.summary ||
      sound?.signature ||
      sound?.strengths?.length ||
      sound?.soundTags?.length ||
      sound?.listeningNotes?.length ||
      sound?.frequencyGraphImage?.url,
  );

  return (
    <div className="space-y-6">
      {hasSoundData ? (
        <>
          {sound?.summary || sound?.signature ? (
            <div className="rounded-lg border border-border/35 bg-surface-lowest/60 p-5">
              {sound.signature ? (
                <p className="mb-3 text-[11px] font-mono uppercase tracking-[0.18em] text-primary">{sound.signature}</p>
              ) : null}
              {sound.summary ? <p className="text-base leading-relaxed text-foreground/78">{sound.summary}</p> : null}
            </div>
          ) : null}
          {sound?.soundTags?.length ? (
            <div className="flex flex-wrap gap-2">
              {sound.soundTags.map((tag) => (
                <span key={tag} className="rounded-full border border-border/35 bg-surface-lowest/50 px-3 py-1.5 text-xs text-foreground/76">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {sound?.strengths?.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {sound.strengths.map((item) => (
                <li key={item} className="flex gap-3 rounded-md border border-border/25 bg-surface-lowest/45 p-3 text-sm leading-relaxed text-foreground/78">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.8} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {sound?.frequencyGraphImage?.url ? (
            <figure className="product-description-media product-description-media--spec">
              <img
                src={sound.frequencyGraphImage.url}
                alt={sound.frequencyGraphImage.alt}
                loading="lazy"
                decoding="async"
                width={sound.frequencyGraphImage.width}
                height={sound.frequencyGraphImage.height}
              />
            </figure>
          ) : null}
        </>
      ) : (
        <div className="rounded-lg border border-border/35 bg-surface-lowest/60 p-5">
          <p className="text-base leading-relaxed text-foreground/78">
            {lang === "ar"
              ? "تفاصيل الصوت قيد التجهيز لهذا المنتج. لن نعرض توقيعاً صوتياً أو قياسات قبل توفر مصدر موثوق."
              : "Sound details are being prepared for this product. Edio will not show a sound signature or measurements until a trusted source is available."}
          </p>
        </div>
      )}
      {safeHighlights.length > 0 ? (
        <div>
          <p className="mb-3 text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
            {lang === "ar" ? "حقائق متاحة الآن" : "Available facts"}
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {safeHighlights.map((item) => (
              <li key={item} className="flex gap-3 rounded-md border border-border/25 bg-surface-lowest/45 p-3 text-sm leading-relaxed text-foreground/78">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.8} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ProductSpecsTabContent({
  specs,
  specGroups,
  specImageBlocks,
  fallbackHighlights,
  lang,
}: {
  specs: Array<{ label: string | { en?: string; ar?: string }; value: string }>;
  specGroups?: ProductSpecGroup[];
  specImageBlocks: NormalizedDescriptionBlock[];
  fallbackHighlights: string[];
  lang: "en" | "ar";
}) {
  const visibleSpecGroups = (specGroups || []).filter((group) => group.title && group.specs?.some((spec) => spec.name && spec.value));
  const hasSpecs = visibleSpecGroups.length > 0 || specs.length > 0 || specImageBlocks.length > 0;

  return (
    <div className="space-y-5">
      {visibleSpecGroups.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleSpecGroups.map((group) => (
            <div key={group.title} className="overflow-hidden rounded-lg border border-border/35 bg-surface-lowest/70">
              <h3 className="border-b border-border/25 px-4 py-3 font-display text-lg font-semibold">{group.title}</h3>
              <table className="w-full border-collapse">
                <tbody>
                  {group.specs.filter((spec) => spec.name && spec.value).map((spec) => (
                    <tr key={`${group.title}-${spec.name}`} className="border-b border-border/25 last:border-b-0">
                      <th className="w-[42%] px-4 py-3 text-start text-[11px] font-mono font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        {spec.name}
                      </th>
                      <td className="px-4 py-3 text-end text-sm text-foreground/88">
                        {spec.value}{spec.unit ? ` ${spec.unit}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : null}
      {specs.length > 0 ? <ProductSpecsTable specs={specs} lang={lang} /> : null}
      {specImageBlocks.length > 0 ? <ProductDescriptionMediaGrid blocks={specImageBlocks} variant="spec" /> : null}
      {!hasSpecs ? (
        <div className="rounded-lg border border-border/35 bg-surface-lowest/60 p-5">
          <p className="text-sm leading-relaxed text-foreground/72">
            {lang === "ar"
              ? "المواصفات التفصيلية قيد المراجعة. نعرض حالياً المعلومات المؤكدة المتاحة فقط."
              : "Detailed specifications are under review. For now, only available confirmed product facts are shown."}
          </p>
          {fallbackHighlights.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {fallbackHighlights.slice(0, 5).map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed text-foreground/78">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.8} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ProductDescriptionFigure({ block }: { block: NormalizedDescriptionBlock }) {
  const aspectRatio = block.width && block.height ? `${block.width} / ${block.height}` : undefined;
  return (
    <figure
      className={
        block.type === "spec_image" || block.imageRole === "spec_image"
          ? "product-description-media product-description-media--spec"
          : "product-description-media"
      }
    >
      <img
        src={block.mediaUrl}
        alt={block.alt}
        loading="lazy"
        decoding="async"
        width={block.width}
        height={block.height}
        style={aspectRatio ? { aspectRatio } : undefined}
      />
      {block.caption ? <figcaption>{block.caption}</figcaption> : null}
      {(block.type === "spec_image" || block.imageRole === "spec_image") && block.extractedText ? (
        <p className="product-description-media__extracted">{block.extractedText}</p>
      ) : null}
    </figure>
  );
}

function ProductSpecsTable({
  specs,
  lang,
}: {
  specs: Array<{ label: string | { en?: string; ar?: string }; value: string }>;
  lang: "en" | "ar";
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/35 bg-surface-lowest/70">
      <table className="w-full border-collapse">
        <tbody>
          {specs.map((spec, index) => (
            <tr key={`${specLabel(spec.label, lang)}-${index}`} className="border-b border-border/25 last:border-b-0">
              <th className="w-[42%] px-4 py-4 text-start text-[11px] font-mono font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {specLabel(spec.label, lang)}
              </th>
              <td className="px-4 py-4 text-end text-sm text-foreground/88">{spec.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecommendationBlocks({
  sections,
  categoryPath,
  categoryLabel,
  lang,
}: {
  sections: ProductRecommendationSection<Parameters<typeof ProductCard>[0]["product"]>[];
  categoryPath: string;
  categoryLabel: string;
  lang: "en" | "ar";
}) {
  const { gridView, setGridView } = useProductGridView();

  return (
    <section className="mt-20 space-y-14 border-t border-border/30 pt-14" data-reveal>
      {sections.map((section, sectionIndex) => (
        <div key={section.type}>
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-[11px] font-mono uppercase tracking-[0.18em] text-primary">
                {lang === "ar"
                  ? sectionIndex === 0
                    ? "اختيارات دقيقة"
                    : "مرتبط"
                  : sectionIndex === 0
                    ? "MATCHED PICKS"
                    : "RELATED"}
              </p>
              <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{section.title}</h2>
            </div>
            <div className="flex items-center gap-2">
              {sectionIndex === 0 ? (
                <ProductGridViewToggle value={gridView} onChange={setGridView} className="shrink-0" />
              ) : null}
              {section.type === "similar_products" ? (
                <Link
                  to={categoryPath}
                  className="premium-ghost hidden items-center gap-2 !rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-widest text-primary md:inline-flex"
                >
                  {categoryLabel}
                  <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                </Link>
              ) : null}
            </div>
          </div>
          <div
            className={cn(
              "grid sm:grid-cols-2 lg:grid-cols-4",
              gridView === "one" ? "grid-cols-1 gap-4" : "grid-cols-2 gap-3 sm:gap-4",
            )}
          >
            {section.items.map((item, index) => (
              <div key={`${section.type}-${item.product.id}`} className="min-w-0">
                <ProductCard product={item.product} index={index} />
                <p className="mt-3 min-h-[2.4rem] px-1 text-xs leading-relaxed text-muted-foreground">
                  {item.reason}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function SectionIntro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div>
      <p className="mb-3 text-[11px] font-mono uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h2 className="font-display text-2xl font-semibold leading-tight tracking-tight md:text-3xl">{title}</h2>
      <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">{copy}</p>
    </div>
  );
}

function specLabel(label: string | { en?: string; ar?: string }, lang: "en" | "ar") {
  if (typeof label === "string") return label;
  return label[lang] || label.en || label.ar || "";
}

function uniqueTextList(values: string[]) {
  return Array.from(new Set((values || []).map((item) => String(item || "").trim()).filter(Boolean)));
}

function getOptionalProductDetailContent(product: unknown): ProductDetailContent | undefined {
  const candidate = product as {
    productDetailContent?: ProductDetailContent;
    detailContent?: ProductDetailContent;
  };
  return candidate.productDetailContent || candidate.detailContent;
}

export default ProductDetail;
