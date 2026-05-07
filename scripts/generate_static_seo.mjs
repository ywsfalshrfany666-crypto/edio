import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { products, categories } from "../src/data/catalog.ts";
import { getDisplayCategoryTerms, productMatchesCategoryTerm } from "../src/lib/categoryTaxonomy.ts";
import {
  SITE_ORIGIN,
  absoluteUrl,
  buildBreadcrumbJsonLd,
  buildCategoryJsonLd,
  buildCategorySeo,
  buildOrganizationJsonLd,
  buildProductJsonLd,
  buildProductSeo,
  buildWebsiteJsonLd,
  productSeoIssues,
} from "../src/lib/seo.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const assetsDir = path.join(distDir, "assets");
const indexPath = path.join(distDir, "index.html");
const today = new Date().toISOString().slice(0, 10);

const baseHtml = await readFile(indexPath, "utf8");
const assetFiles = await readdir(assetsDir).catch(() => []);
const assetByOriginal = new Map();

for (const file of assetFiles) {
  const ext = path.extname(file);
  const base = path.basename(file, ext);
  const originalBase = base.replace(/-[A-Za-z0-9_]{6,}$/, "");
  assetByOriginal.set(`${originalBase}${ext}`, `/assets/${file}`);
}

function resolveBuiltAsset(value) {
  const raw = String(value || "").trim();
  if (!raw) return absoluteUrl("/og/edio-og.png");
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/assets/") || raw.startsWith("/og/") || raw.startsWith("/favicon")) return absoluteUrl(raw);
  const key = path.basename(raw);
  const mapped = assetByOriginal.get(key);
  if (mapped) return absoluteUrl(mapped);

  const ext = path.extname(key);
  const originalBase = path.basename(key, ext);
  const hashedMatch = assetFiles.find((file) => file.startsWith(`${originalBase}-`) && path.extname(file) === ext);
  return absoluteUrl(hashedMatch ? `/assets/${hashedMatch}` : raw);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jsonScript(data) {
  return `<script type="application/ld+json" data-edio-static-seo="jsonld">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

function stripClientSeo(head) {
  return head
    .replace(/\s*<title>[\s\S]*?<\/title>/i, "")
    .replace(/\s*<link rel="canonical"[^>]*>/gi, "")
    .replace(/\s*<meta name="description"[^>]*>/gi, "")
    .replace(/\s*<meta name="robots"[^>]*>/gi, "")
    .replace(/\s*<meta property="og:[^"]+"[^>]*>/gi, "")
    .replace(/\s*<meta name="twitter:[^"]+"[^>]*>/gi, "")
    .replace(/\s*<script type="application\/ld\+json"[^>]*data-edio-static-seo="jsonld"[\s\S]*?<\/script>/gi, "");
}

function imageMimeType(imageUrl) {
  const cleanUrl = imageUrl.split("?")[0];
  if (cleanUrl.endsWith(".webp")) return "image/webp";
  if (cleanUrl.match(/\.jpe?g$/i)) return "image/jpeg";
  if (cleanUrl.endsWith(".svg")) return "image/svg+xml";
  return "image/png";
}

function normalizePreloadImage(entry) {
  if (entry && typeof entry === "object") {
    const href = resolveBuiltAsset(entry.src || entry.href);
    return {
      href,
      media: entry.media ? String(entry.media) : "",
    };
  }
  return {
    href: resolveBuiltAsset(entry),
    media: "",
  };
}

function renderStaticHtml({ title, description, canonicalPath, image, imageAlt, type = "website", jsonLd, preloadImages = [] }) {
  const [beforeHeadEnd, afterHeadEnd] = baseHtml.split("</head>");
  const cleanHead = stripClientSeo(beforeHeadEnd);
  const canonical = absoluteUrl(canonicalPath);
  const imageUrl = resolveBuiltAsset(image);
  const imageType = imageMimeType(imageUrl);
  const preloadTags = Array.from(
    new Map(
      preloadImages
        .map(normalizePreloadImage)
        .filter((item) => item.href)
        .map((item) => [`${item.href}|${item.media}`, item]),
    ).values(),
  )
    .slice(0, 2)
    .map((item) => {
      const media = item.media ? ` media="${escapeHtml(item.media)}"` : "";
      return `<link rel="preload" as="image" href="${escapeHtml(item.href)}" type="${escapeHtml(imageMimeType(item.href))}" fetchpriority="high"${media} />`;
    });
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta name="robots" content="index,follow,max-image-preview:large" />`,
    `<meta property="og:site_name" content="edio" />`,
    `<meta property="og:type" content="${escapeHtml(type)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`,
    `<meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />`,
    `<meta property="og:image:type" content="${escapeHtml(imageType)}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:site" content="@edio_iq" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}" />`,
    ...preloadTags,
    ...(Array.isArray(jsonLd) ? jsonLd : [jsonLd]).filter(Boolean).map(jsonScript),
  ].join("\n    ");

  return `${cleanHead}\n    ${tags}\n  </head>${afterHeadEnd}`;
}

async function writeRoute(routePath, html) {
  const cleanPath = routePath === "/" ? "" : routePath.replace(/^\/+|\/+$/g, "");
  const outDir = path.join(distDir, cleanPath);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "index.html"), html);
}

const routes = [];

routes.push({
  path: "/",
  priority: "1.0",
  changefreq: "weekly",
  html: renderStaticHtml({
    title: "edio",
    description: "Edio is a premium audio store in Iraq for headphones, IEMs, DAC, amplifiers, microphones, and audiophile accessories.",
    canonicalPath: "/",
    image: "/og/edio-og.png",
    imageAlt: "edio premium audio store in Iraq",
    preloadImages: [
      { src: "hero-hifiman-arya-review-640.webp", media: "(max-width: 767px)" },
      { src: "hero-hifiman-arya-review-1200.webp", media: "(min-width: 768px)" },
    ],
    jsonLd: [buildOrganizationJsonLd(), buildWebsiteJsonLd()],
  }),
});

routes.push({
  path: "/shop",
  priority: "0.9",
  changefreq: "daily",
  html: renderStaticHtml({
    title: "Audio Shop | edio",
    description: "Shop audiophile headphones, IEMs, DAC, amplifiers, microphones, and premium audio accessories from Edio in Iraq.",
    canonicalPath: "/shop",
    image: "/og/edio-og.png",
    imageAlt: "Edio audio shop",
    preloadImages: ["edio-logo-header.png"],
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Edio audio shop",
        description: "Premium audio products in Iraq: headphones, IEMs, DAC, amplifiers, microphones, and accessories.",
        url: absoluteUrl("/shop"),
        isPartOf: buildWebsiteJsonLd(),
      },
      buildBreadcrumbJsonLd([{ name: "Shop", path: "/shop" }]),
    ],
  }),
});

for (const category of categories) {
  const seo = buildCategorySeo(category.slug, "en");
  const heroProduct = products.find((item) => productMatchesCategoryTerm(item, category.slug, null));
  routes.push({
    path: seo.canonicalPath,
    priority: "0.8",
    changefreq: "weekly",
    html: renderStaticHtml({
      title: `${seo.title} | edio`,
      description: seo.description,
      canonicalPath: seo.canonicalPath,
      image: category.image,
      imageAlt: seo.imageAlt,
      preloadImages: [heroProduct?.image || category.image],
      jsonLd: [
        buildCategoryJsonLd(category.slug, "en"),
        buildBreadcrumbJsonLd([
          { name: "Shop", path: "/shop" },
          { name: seo.title, path: seo.canonicalPath },
        ]),
      ],
    }),
  });

  for (const term of getDisplayCategoryTerms(category.slug)) {
    const termSeo = buildCategorySeo(category.slug, "en", term.slug);
    const termHeroProduct = products.find((item) => productMatchesCategoryTerm(item, category.slug, term.slug));
    routes.push({
      path: termSeo.canonicalPath,
      priority: "0.65",
      changefreq: "weekly",
      html: renderStaticHtml({
        title: `${termSeo.title} | edio`,
        description: termSeo.description,
        canonicalPath: termSeo.canonicalPath,
        image: category.image,
        imageAlt: termSeo.imageAlt,
        preloadImages: [termHeroProduct?.image || heroProduct?.image || category.image],
        jsonLd: [
          buildCategoryJsonLd(category.slug, "en", term.slug),
          buildBreadcrumbJsonLd([
            { name: "Shop", path: "/shop" },
            { name: seo.title, path: seo.canonicalPath },
            { name: termSeo.title, path: termSeo.canonicalPath },
          ]),
        ],
      }),
    });
  }
}

const duplicateSlugs = new Set();
const seenSlugs = new Set();
const seoIssueRows = [];

for (const product of products) {
  if (seenSlugs.has(product.slug)) duplicateSlugs.add(product.slug);
  seenSlugs.add(product.slug);
  const issues = productSeoIssues(product);
  if (issues.length) seoIssueRows.push({ slug: product.slug, issues });

  const seo = buildProductSeo(product, "en");
  routes.push({
    path: seo.canonicalPath,
    priority: "0.72",
    changefreq: "weekly",
    html: renderStaticHtml({
      title: `${seo.title} | edio`,
      description: seo.description,
      canonicalPath: seo.canonicalPath,
      image: product.image,
      imageAlt: seo.imageAlt,
      type: "product",
      preloadImages: [product.image],
      jsonLd: [
        buildProductJsonLd(product, "en", resolveBuiltAsset),
        buildBreadcrumbJsonLd([
          { name: "Shop", path: "/shop" },
          { name: product.category, path: `/category/${product.category}` },
          { name: product.name.en || product.name.ar, path: seo.canonicalPath },
        ]),
      ],
    }),
  });
}

for (const route of routes) {
  await writeRoute(route.path, route.html);
}

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...routes.map((route) =>
    [
      "  <url>",
      `    <loc>${absoluteUrl(route.path)}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      `    <changefreq>${route.changefreq}</changefreq>`,
      `    <priority>${route.priority}</priority>`,
      "  </url>",
    ].join("\n"),
  ),
  "</urlset>",
  "",
].join("\n");

const robots = [
  "User-agent: Googlebot",
  "Allow: /",
  "",
  "User-agent: Bingbot",
  "Allow: /",
  "",
  "User-agent: Twitterbot",
  "Allow: /",
  "",
  "User-agent: facebookexternalhit",
  "Allow: /",
  "",
  "User-agent: *",
  "Allow: /",
  "",
  `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
  "",
].join("\n");

await writeFile(path.join(distDir, "sitemap.xml"), sitemap);
await writeFile(path.join(distDir, "robots.txt"), robots);
await writeFile(path.join(rootDir, "public", "sitemap.xml"), sitemap);
await writeFile(path.join(rootDir, "public", "robots.txt"), robots);

const report = {
  generatedAt: new Date().toISOString(),
  routes: routes.length,
  products: products.length,
  categories: categories.length,
  duplicateSlugs: Array.from(duplicateSlugs),
  productsWithSeoIssues: seoIssueRows.length,
  issueSamples: seoIssueRows.slice(0, 20),
};

await writeFile(path.join(distDir, "seo-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(
  `Generated static SEO: ${routes.length} routes, ${products.length} products, ${categories.length} categories, ${seoIssueRows.length} products with warnings.`,
);
