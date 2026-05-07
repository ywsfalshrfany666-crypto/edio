export type PageTitleType = "default" | "product" | "category" | "subcategory" | "search" | "admin";

const SITE_NAME = "edio";
const MAX_LEADING_TITLE_LENGTH = 44;
const MAX_QUERY_LENGTH = 28;
const PLACEHOLDER_PATTERN = /^(undefined|null|meta_title|meta description|meta_description|page title|pagespeed insights|\[object object\])$/i;

type BuildPageTitleOptions = {
  type?: PageTitleType;
  title?: unknown;
  parentTitle?: unknown;
  isHome?: boolean;
  isAdmin?: boolean;
  fallback?: string;
};

export function buildPageTitle({
  type = "default",
  title,
  parentTitle,
  isHome = false,
  isAdmin = false,
  fallback,
}: BuildPageTitleOptions = {}) {
  if (isHome) return SITE_NAME;

  const cleanTitle = cleanTitlePart(title);
  const cleanParent = cleanTitlePart(parentTitle);
  const fallbackTitle = cleanTitlePart(fallback) || fallbackForType(type, isAdmin);

  if (type === "admin" || isAdmin) {
    const adminTitle = cleanTitle || fallbackTitle;
    if (!adminTitle || isSameSiteName(adminTitle) || /^dashboard$/i.test(adminTitle)) return `Admin | ${SITE_NAME}`;
    return `${trimTitle(adminTitle)} · Admin | ${SITE_NAME}`;
  }

  if (type === "subcategory") {
    const child = cleanTitle || fallbackTitle;
    const parent = cleanParent;
    const leading = parent ? `${trimTitle(child)} · ${trimTitle(parent)}` : trimTitle(child);
    return appendSiteName(leading);
  }

  if (type === "search") {
    const query = cleanTitle;
    const leading = query ? `Search: ${trimTitle(query, MAX_QUERY_LENGTH)}` : "Search";
    return appendSiteName(leading);
  }

  const leading = cleanTitle || fallbackTitle;
  if (!leading || isSameSiteName(leading)) return SITE_NAME;
  return appendSiteName(trimTitle(leading));
}

export function cleanTitlePart(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  let clean = String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  clean = clean
    .replace(/\s*\|\s*EDIO Sound Studio$/i, "")
    .replace(/\s*\|\s*EDIO$/i, "")
    .replace(/\s*\|\s*edio$/i, "")
    .replace(/^EDIO Sound Studio$/i, SITE_NAME)
    .replace(/^EDIO$/i, SITE_NAME);

  if (!clean || PLACEHOLDER_PATTERN.test(clean) || isSameSiteName(clean)) return clean.toLowerCase() === SITE_NAME ? SITE_NAME : "";
  return clean;
}

export function titleFromSlug(slug: unknown) {
  const clean = cleanTitlePart(slug);
  if (!clean) return "";
  const title = clean
    .split("-")
    .filter(Boolean)
    .map((part) => {
      if (/^(iem|dac|amp)$/i.test(part)) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
  return title.replace(/\bDAC AMP\b/g, "DAC & AMP");
}

function appendSiteName(leading: string) {
  const clean = cleanTitlePart(leading);
  if (!clean || isSameSiteName(clean)) return SITE_NAME;
  return `${dedupeSiteName(clean)} | ${SITE_NAME}`;
}

function dedupeSiteName(value: string) {
  return value
    .replace(/\s*\|\s*edio\b/gi, "")
    .replace(/\s*·\s*edio\b/gi, "")
    .trim();
}

function trimTitle(value: string, maxLength = MAX_LEADING_TITLE_LENGTH) {
  const clean = cleanTitlePart(value);
  if (clean.length <= maxLength) return clean;
  const sliced = clean.slice(0, maxLength).replace(/\s+\S*$/, "").trim();
  return `${sliced || clean.slice(0, maxLength).trim()}...`;
}

function fallbackForType(type: PageTitleType, isAdmin: boolean) {
  if (isAdmin || type === "admin") return "Admin";
  if (type === "product") return "Product";
  if (type === "category") return "Category";
  if (type === "subcategory") return "Category";
  if (type === "search") return "Search";
  return SITE_NAME;
}

function isSameSiteName(value: string) {
  return value.trim().toLowerCase() === SITE_NAME;
}
