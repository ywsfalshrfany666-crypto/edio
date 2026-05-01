import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_OUTPUT_DIR =
  process.env.EDIO_RESEARCH_OUTPUT_DIR ||
  "/Users/yousif/Documents/Codex/2026-04-23-edio-users-yousif-documents-codex-2026";

const DEFAULT_BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

const KNOWN_BRANDS = [
  "AKG",
  "Audio-Technica",
  "AFUL",
  "DUNU",
  "FiiO",
  "HiBy",
  "HIFIMAN",
  "Kiwi Ears",
  "MOONDROP",
  "SIMGOT",
  "SpinFit",
  "TANCHJIM",
  "TRUTHEAR",
  "7Hz",
];

const GENERIC_PRODUCT_TOKENS = new Set([
  "and",
  "accessories",
  "adapter",
  "adapters",
  "amp",
  "amplifier",
  "audio",
  "bluetooth",
  "buy",
  "cable",
  "cables",
  "closed",
  "dac",
  "driver",
  "ear",
  "earbud",
  "earbuds",
  "earphone",
  "earphones",
  "headphone",
  "headphones",
  "hifi",
  "iem",
  "iems",
  "in",
  "magnetic",
  "microphone",
  "monitor",
  "monitors",
  "official",
  "open",
  "over",
  "page",
  "planar",
  "portable",
  "product",
  "products",
  "shop",
  "store",
  "studio",
  "the",
  "truly",
  "wireless",
]);

const MODEL_KEY_NOISE_TOKENS = new Set([
  ...GENERIC_PRODUCT_TOKENS,
  "analog",
  "balanced",
  "class",
  "convertor",
  "converter",
  "desktop",
  "digital",
  "driver",
  "drivers",
  "dynamic",
  "edition",
  "electrostatic",
  "entry",
  "first",
  "flagship",
  "grade",
  "grades",
  "hybrid",
  "level",
  "magnet",
  "pair",
  "pin",
  "quad",
  "single",
  "titanium",
  "topsound",
  "triple",
  "universal",
]);

const ACCESSORY_HINTS = [
  "adapter",
  "adapters",
  "cable",
  "cables",
  "case",
  "cases",
  "earpad",
  "earpads",
  "ear tip",
  "ear tips",
  "eartip",
  "eartips",
  "headband",
  "mis tip",
  "pouch",
  "replacement",
  "spring tips",
  "strap",
  "tips",
  "upgrade cable",
];

const NOISE_QUERY_HINTS = [
  "access denied",
  "bundle",
  "combo",
  "gift card",
  "language",
  "login",
  "open box",
  "refurbished",
  "renewed",
  "reset password",
  "sign up",
  "trade up",
  "upgrade program",
  "used",
];

const CORE_PRODUCT_CATEGORIES = new Set(["dac", "headphones", "iems", "mic"]);

const RESEARCH_SOURCES = [
  { domain: "akg.com", kind: "official", brand: "AKG" },
  { domain: "tw.akg.com", kind: "official", brand: "AKG" },
  { domain: "fiio.com", kind: "official", brand: "FiiO" },
  { domain: "hifiman.com", kind: "official", brand: "HIFIMAN" },
  { domain: "eu.hifiman.com", kind: "official", brand: "HIFIMAN" },
  { domain: "moondroplab.com", kind: "official", brand: "MOONDROP" },
  { domain: "spinfit-eartip.com", kind: "official", brand: "SpinFit" },
  { domain: "headphones.com", kind: "retailer" },
  { domain: "sweetwater.com", kind: "retailer" },
  { domain: "crutchfield.com", kind: "retailer" },
  { domain: "linsoul.com", kind: "retailer" },
  { domain: "shenzhenaudio.com", kind: "retailer" },
  { domain: "apos.audio", kind: "retailer" },
  { domain: "hifigo.com", kind: "retailer" },
];

function parseArgs(argv) {
  const options = {
    outputDir: DEFAULT_OUTPUT_DIR,
    maxPagesPerDomain: 24,
    maxAnalyzedPages: 180,
    delayMs: 120,
    checkpointEvery: 20,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];

    if (value === "--output-dir" && next) {
      options.outputDir = next;
      index += 1;
    } else if (value === "--max-pages-per-domain" && next) {
      options.maxPagesPerDomain = Number(next);
      index += 1;
    } else if (value === "--max-analyzed-pages" && next) {
      options.maxAnalyzedPages = Number(next);
      index += 1;
    } else if (value === "--delay-ms" && next) {
      options.delayMs = Number(next);
      index += 1;
    } else if (value === "--checkpoint-every" && next) {
      options.checkpointEvery = Number(next);
      index += 1;
    }
  }

  return options;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithBrowserHeaders(url, { timeoutMs = 12000, retries = 1, accept = "text/html,application/xhtml+xml,*/*;q=0.8" } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs + attempt * 2000),
        headers: {
          "User-Agent": DEFAULT_BROWSER_USER_AGENT,
          Accept: accept,
        },
      });

      if (attempt < retries && (response.status === 403 || response.status === 408 || response.status === 429 || response.status >= 500)) {
        await sleep(350 * (attempt + 1));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await sleep(350 * (attempt + 1));
    }
  }

  throw lastError || new Error(`Failed to fetch ${url}`);
}

async function fetchText(url, options = {}) {
  const response = await fetchWithBrowserHeaders(url, options);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

async function resolveSitemapUrls(domain) {
  const results = [];
  const fallbacks = [`https://${domain}/sitemap.xml`, `https://www.${domain}/sitemap.xml`];

  for (const robotsUrl of [`https://${domain}/robots.txt`, `https://www.${domain}/robots.txt`]) {
    try {
      const text = await fetchText(robotsUrl, { accept: "text/plain,*/*;q=0.8", timeoutMs: 9000, retries: 1 });
      for (const line of text.split(/\r?\n/)) {
        const match = line.match(/^\s*sitemap:\s*(\S+)/i);
        if (match) results.push(decodeHtmlEntities(match[1].trim()));
      }
    } catch {
      // Fall back to default sitemap path.
    }
  }

  return dedupeStrings([...results, ...fallbacks]);
}

function extractXmlLocs(xml) {
  return [...String(xml || "").matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) =>
    decodeHtmlEntities(stripTags(match[1]).trim()),
  );
}

function extractSitemapEntries(xml) {
  const entries = [];
  for (const match of String(xml || "").matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
    const block = match[1];
    const loc = decodeHtmlEntities(stripTags((block.match(/<loc>([\s\S]*?)<\/loc>/i) || [])[1] || "").trim());
    if (!loc) continue;

    const title = decodeHtmlEntities(stripTags((block.match(/<image:title>([\s\S]*?)<\/image:title>/i) || [])[1] || "").trim());
    entries.push({ loc, title });
  }
  return entries;
}

function dedupeStrings(values) {
  return Array.from(new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean)));
}

function stripTags(value) {
  return String(value || "").replace(/<[^>]+>/g, " ");
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeComparisonText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeComparisonText(value) {
  return normalizeComparisonText(value)
    .split(" ")
    .filter((token) => token.length >= 2);
}

function distinctiveProductTokens(value) {
  return tokenizeComparisonText(value).filter((token) => !GENERIC_PRODUCT_TOKENS.has(token));
}

function modelKeyTokens(value) {
  return tokenizeComparisonText(value).filter((token) => !MODEL_KEY_NOISE_TOKENS.has(token));
}

function isVersionLikeToken(token) {
  return /^(?:v\d+|mk\d+|gen\d+|20\d{2}|[ivx]{2,}|[a-z]{1,3}\d+[a-z]{0,3}|\d+[a-z]{0,3})$/i.test(String(token || ""));
}

function normalizedContainsHint(value, hints) {
  const normalized = normalizeComparisonText(value);
  const compact = normalized.replace(/\s+/g, "");
  return hints.some((hint) => {
    const normalizedHint = normalizeComparisonText(hint);
    const compactHint = normalizedHint.replace(/\s+/g, "");
    return normalized.includes(normalizedHint) || compact.includes(compactHint);
  });
}

function looksAccessoryLike(value) {
  return normalizedContainsHint(value, ACCESSORY_HINTS);
}

function looksResearchNoise(value) {
  const raw = String(value || "").trim();
  const visibleLabel = raw.replace(/https?:\/\/\S+/gi, " ").trim();
  const compact = visibleLabel.replace(/[^a-z0-9]/gi, "");

  if (normalizedContainsHint(raw, NOISE_QUERY_HINTS)) return true;
  if (compact.length >= 18 && /^[a-z]+$/.test(compact) && !/\s/.test(visibleLabel)) return true;
  if (compact.length >= 18 && /(upgrade|program|combo|bundle|strap|replacement)/i.test(compact)) return true;
  return false;
}

function extractPathSlug(urlLike) {
  try {
    const url = urlLike instanceof URL ? urlLike : new URL(String(urlLike || ""));
    return decodeHtmlEntities(url.pathname.split("/").filter(Boolean).pop() || "");
  } catch {
    return "";
  }
}

function humanizeHandle(value) {
  return decodeHtmlEntities(String(value || ""))
    .replace(/[_/]+/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCoreCategory(category) {
  return CORE_PRODUCT_CATEGORIES.has(String(category || "").trim());
}

function isLikelyProductPage(url) {
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  const pathText = url.pathname.toLowerCase();

  if (/\b(blog|blogs|article|articles|review|reviews|journal|news|stories|forum|support)\b/.test(pathText)) return false;
  if (/youtube\.com|youtu\.be|facebook\.com|instagram\.com|reddit\.com|x\.com|twitter\.com/.test(host)) return false;
  if (/^\/(?:all-headphones|in-ear|on-ear|over-ear|headphones|earphones|earbuds|collections|collection|category|categories)(?:\/|$)/.test(pathText)) return false;
  if (/^\/sale(?:-|\/|$)/.test(pathText)) return false;
  if (/\/(?:sale|clearance|deals)(?:\/|$)/.test(pathText)) return false;
  if (/\/home(?:\/|$)/.test(pathText)) return false;
  if (/\/(?:access-denied|language|log-?in|sign-?up|reset-password|update-password|user-account|account|gift-card)(?:\/|$)/.test(pathText)) return false;
  if (/\b(open[\s-]?box|refurb(?:ished)?|renewed|used|b[\s-]?stock|trade-up)\b/i.test(pathText)) return false;

  if (/sweetwater\.com$/i.test(host)) return /^\/store\/detail\//.test(pathText);
  if (/crutchfield\.com$/i.test(host)) return /^\/p_/.test(pathText);
  if (/headphones\.com$/i.test(host)) return /^\/products\//.test(pathText);
  if (/apos\.audio$/i.test(host)) return /^\/products\//.test(pathText);
  if (/linsoul\.com$/i.test(host)) return /^\/products\//.test(pathText);
  if (/shenzhenaudio\.com$/i.test(host)) return /^\/products\//.test(pathText);
  if (/hifigo\.com$/i.test(host)) return /^\/products\//.test(pathText);

  if (/\/products?\//.test(pathText)) return true;
  if (/\/[^/]+\.html$/.test(pathText)) return true;
  if (/^\/[a-z0-9-]{3,}$/.test(pathText) && !/^(?:\/collections|\/pages|\/search|\/category)/.test(pathText)) return true;

  return false;
}

function scoreDiscoveredUrl(entry, source) {
  let score = 0;
  const title = String(entry.title || "");
  const urlText = String(entry.loc || "");
  const hostText = `${title} ${urlText}`.toLowerCase();
  const hasKnownBrand = KNOWN_BRANDS.some((brand) => hostText.includes(brand.toLowerCase()));

  if (isLikelyProductPage(new URL(entry.loc))) score += 8;
  if (/\/products?\//i.test(urlText)) score += 5;
  if (/\.html($|[?#])/i.test(urlText)) score += 4;
  if (title) score += 2;
  if (source.brand && hostText.includes(source.brand.toLowerCase().replace(/\s+/g, ""))) score += 2;
  if (source.kind === "retailer") score += hasKnownBrand ? 6 : -4;
  if (/review|blog|news|story|article/i.test(hostText)) score -= 12;
  if (/gift card|access denied|login|sign up|reset password|open box|refurbished|renewed|trade-up/i.test(hostText)) score -= 18;
  if (looksAccessoryLike(hostText)) score -= 7;
  if (looksResearchNoise(hostText)) score -= 14;

  return score;
}

async function collectProductUrlsForSource(source, maxPages) {
  const sitemapUrls = await resolveSitemapUrls(source.domain);
  const queue = [...sitemapUrls];
  const visited = new Set();
  const discovered = [];

  while (queue.length && visited.size < 14 && discovered.length < maxPages * 3) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl || visited.has(sitemapUrl)) continue;
    visited.add(sitemapUrl);

    let xml = "";
    try {
      xml = await fetchText(sitemapUrl, { accept: "application/xml,text/xml,*/*;q=0.8", timeoutMs: 12000, retries: 1 });
    } catch {
      continue;
    }

    if (!xml) continue;

    if (/<sitemapindex[\s>]/i.test(xml)) {
      for (const nestedUrl of extractXmlLocs(xml).slice(0, 20)) {
        if (!visited.has(nestedUrl) && /(product|products|shop|catalog|page|item|sitemap)/i.test(nestedUrl)) {
          queue.push(nestedUrl);
        }
      }
      continue;
    }

    if (!/<urlset[\s>]/i.test(xml)) continue;

    for (const entry of extractSitemapEntries(xml)) {
      let pageUrl;
      try {
        pageUrl = new URL(entry.loc);
      } catch {
        continue;
      }

      const normalizedHost = pageUrl.hostname.replace(/^www\./i, "").toLowerCase();
      const sourceHost = source.domain.replace(/^www\./i, "").toLowerCase();
      if (!(normalizedHost === sourceHost || normalizedHost.endsWith(`.${sourceHost}`))) continue;
      if (!isLikelyProductPage(pageUrl)) continue;

      discovered.push({
        url: pageUrl.toString(),
        title: entry.title || "",
        score: scoreDiscoveredUrl(entry, source),
      });
    }
  }

  return discovered
    .sort((left, right) => right.score - left.score)
    .filter((entry, index, list) => list.findIndex((item) => item.url === entry.url) === index)
    .slice(0, maxPages);
}

function extractMetaContent(html, attrName, attrValue) {
  const escaped = escapeRegExp(attrValue);
  const match =
    html.match(new RegExp(`<meta[^>]*${attrName}=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i")) ||
    html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*${attrName}=["']${escaped}["'][^>]*>`, "i"));
  return match ? decodeHtmlEntities(match[1].trim()) : "";
}

function extractTagContent(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i"));
  return match ? decodeHtmlEntities(stripTags(match[1]).trim()) : "";
}

function countApproxImages(html) {
  const urls = new Set();

  for (const match of html.matchAll(/<(?:img|source)[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)["']/gi)) {
    const value = String(match[1] || "");
    if (!/\.(?:jpe?g|png|webp|avif|gif)(?:$|[?#])/i.test(value)) continue;
    if (/logo|icon|sprite|flag|avatar|payment|badge|swatch|thumb/i.test(value)) continue;
    urls.add(value);
  }

  for (const match of html.matchAll(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/gi)) {
    urls.add(match[1]);
  }

  return urls.size;
}

function countApproxSpecs(html) {
  const labels = new Set();
  const push = (label, value) => {
    const cleanLabel = decodeHtmlEntities(stripTags(String(label || "")).trim()).replace(/[:\s]+$/, "");
    const cleanValue = decodeHtmlEntities(stripTags(String(value || "")).trim());
    if (!cleanLabel || !cleanValue) return;
    if (cleanLabel.length > 80 || cleanValue.length > 180) return;
    labels.add(cleanLabel.toLowerCase());
  };

  for (const match of html.matchAll(/<tr[^>]*>\s*(?:<th[^>]*>|<td[^>]*>)([\s\S]*?)<\/(?:th|td)>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)) {
    push(match[1], match[2]);
  }
  for (const match of html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi)) {
    push(match[1], match[2]);
  }
  for (const match of html.matchAll(/<li[^>]*>\s*([^:<]{2,60})\s*:\s*([^<]{2,140})<\/li>/gi)) {
    push(match[1], match[2]);
  }

  return labels.size;
}

function extractStructuredDataSignals(html) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  let hasProduct = false;
  let hasAggregateRating = false;
  let hasOffers = false;

  for (const match of scripts) {
    const raw = decodeHtmlEntities(match[1]).trim();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      for (const item of flattenJsonLd(parsed)) {
        const text = JSON.stringify(item).toLowerCase();
        const types = arrayify(item?.["@type"]).map((entry) => String(entry || "").toLowerCase());
        if (types.includes("product")) hasProduct = true;
        if (text.includes("aggregaterating")) hasAggregateRating = true;
        if (text.includes("\"offers\"")) hasOffers = true;
      }
    } catch {
      continue;
    }
  }

  return {
    hasProductSchema: hasProduct,
    hasAggregateRating,
    hasOffers,
  };
}

function arrayify(value) {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null || value === "" ? [] : [value];
}

function flattenJsonLd(value) {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (value && typeof value === "object" && Array.isArray(value["@graph"])) return value["@graph"].flatMap(flattenJsonLd);
  return value ? [value] : [];
}

function inferBrand(text) {
  const haystack = String(text || "").toLowerCase();
  return KNOWN_BRANDS.find((brand) => {
    const normalized = brand.toLowerCase();
    return haystack.includes(normalized) || haystack.includes(normalized.replace(/[^a-z0-9]+/g, ""));
  }) || "";
}

function cleanProductTitle(title, hostname) {
  let cleaned = decodeHtmlEntities(String(title || "").trim());
  const hostLabel = hostname.replace(/^www\./i, "").split(".")[0];
  const separators = [" | ", " – ", " — ", " - "];

  for (const separator of separators) {
    if (cleaned.includes(separator)) {
      const [first] = cleaned.split(separator);
      if (first && first.length >= 4) {
        cleaned = first.trim();
        break;
      }
    }
  }

  cleaned = cleaned.replace(/^(?:audio(?:\s*[-:|]\s*)+)+/i, "").trim();
  cleaned = cleaned.replace(/^(?:audio\s+)(?=(?:7hz|hiby|dunu|moondrop|kiwi|simgot|tanchjim|fiio|spinfit)\b)/i, "").trim();
  cleaned = cleaned.replace(new RegExp(escapeRegExp(hostLabel), "ig"), "").replace(/\s{2,}/g, " ").trim();
  cleaned = cleaned.replace(/[-_]+/g, " ").replace(/\s{2,}/g, " ").trim();
  cleaned = cleaned.replace(/\s+(?:headphones?|earphones?|earbuds?|iems?|in-ear monitors?|dac(?:\/amp)?|amplifier|microphones?|cables?|adapters?)\b.*$/i, "").trim();
  cleaned = cleaned.replace(/\((?:open|closed|wireless|bluetooth|studio)[^)]+\)$/i, "").trim();
  cleaned = cleaned.replace(/^[\W_]+|[\W_]+$/g, "").trim();
  return cleaned;
}

function buildModelKey(name, brand) {
  const tokens = modelKeyTokens(
    String(name || "")
      .replace(new RegExp(`\\b${escapeRegExp(String(brand || ""))}\\b`, "ig"), " ")
      .trim(),
  );
  return tokens.slice(0, 4).join(" ");
}

function inferCategory(text, { primaryText = "" } = {}) {
  const primary = String(primaryText || "").toLowerCase();
  const secondary = String(text || "").toLowerCase();
  const tests = {
    iems: /\b(iem|in-ear|earphone|earphones|earbuds?)\b/,
    headphones: /\b(headphone|headphones|open-back|closed-back|over-ear)\b/,
    dac: /\b(dac|amplifiers?|headphone amps?|headphone amplifiers?|usb dac|desktop dac|dongle)\b/,
    mic: /\b(microphone|mic|condenser|dynamic microphone)\b/,
    accessories: /\b(adapter|cable|ear tips|eartips|case|pouch|accessories|filters?)\b/,
  };

  if (tests.iems.test(primary)) return "iems";
  if (tests.headphones.test(primary)) return "headphones";
  if (tests.dac.test(primary)) return "dac";
  if (tests.mic.test(primary)) return "mic";
  if (tests.accessories.test(primary)) return "accessories";

  const secondaryHasCore =
    tests.iems.test(secondary) || tests.headphones.test(secondary) || tests.dac.test(secondary) || tests.mic.test(secondary);

  if (tests.iems.test(secondary)) return "iems";
  if (tests.headphones.test(secondary)) return "headphones";
  if (tests.dac.test(secondary)) return "dac";
  if (tests.mic.test(secondary)) return "mic";
  if (!secondaryHasCore && tests.accessories.test(secondary)) return "accessories";
  return "";
}

function analyzeDecisionSignals(html, text) {
  const lowerText = String(text || "").toLowerCase();

  return {
    hasPackage: /\b(what(?:'|’)s in the box|inside the box|package contents?|in the box)\b/i.test(text),
    hasShipping: /\b(shipping|delivery|free shipping|worldwide shipping)\b/i.test(text),
    hasWarranty: /\b(warranty|guarantee)\b/i.test(text),
    hasAuthenticity: /\b(authentic|authorized distributor|official dealer|genuine)\b/i.test(text),
    hasFaq: /\b(faq|frequently asked questions?)\b/i.test(text),
    hasReviews: /\b(customer reviews|write a review|based on \d+ reviews|ratings?)\b/i.test(text),
    hasAddToCart: /\b(add to cart|buy now|select options|in stock|pre-?order)\b/i.test(text),
    hasCompareOrBundle: /\b(compare|bundle|make it a bundle)\b/i.test(text),
    longFormStory:
      (lowerText.match(/\b(description|overview|features|story|technology|benefits)\b/g) || []).length >= 2,
  };
}

async function analyzeProductPage(entry, source) {
  const response = await fetchWithBrowserHeaders(entry.url, {
    timeoutMs: 14000,
    retries: 1,
    accept: "text/html,application/xhtml+xml,*/*;q=0.8",
  });
  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status}`);
  }

  const html = await response.text();
  const finalUrl = new URL(response.url || entry.url);
  const title =
    extractMetaContent(html, "property", "og:title") ||
    extractMetaContent(html, "name", "twitter:title") ||
    extractTagContent(html, "title") ||
    entry.title ||
    "";
  const description =
    extractMetaContent(html, "property", "og:description") ||
    extractMetaContent(html, "name", "description") ||
    extractMetaContent(html, "name", "twitter:description") ||
    "";
  const text = decodeHtmlEntities(
    String(html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:li|p|h[1-6]|dt|dd|tr|div|section|ul|ol|table)>/gi, "\n"),
  );
  const cleanedTitle = cleanProductTitle(title, finalUrl.hostname);
  const structured = extractStructuredDataSignals(html);
  const decisions = analyzeDecisionSignals(html, text);
  const slug = extractPathSlug(finalUrl);
  const brand = source.brand || inferBrand([title, description, finalUrl.toString()].join(" "));
  const normalizedTitle = cleanProductTitle(cleanedTitle || title || humanizeHandle(slug), finalUrl.hostname);
  const query = ensureBrandInName(normalizedTitle || humanizeHandle(slug), brand);
  const modelKey = buildModelKey(query, brand);
  const category = inferCategory([title, description, finalUrl.toString(), text].join(" "), {
    primaryText: [title, description, finalUrl.toString()].join(" "),
  });
  const accessoryLike = looksAccessoryLike([query, title, description, slug, finalUrl.toString()].join(" "));
  const coreProduct =
    isCoreCategory(category) ||
    (!accessoryLike &&
      !looksResearchNoise([query, title, slug, finalUrl.toString()].join(" ")) &&
      (structured.hasProductSchema || countApproxImages(html) >= 4 || countApproxSpecs(html) >= 2));

  return {
    url: finalUrl.toString(),
    domain: finalUrl.hostname.replace(/^www\./i, ""),
    sourceKind: source.kind,
    sourceBrand: source.brand || "",
    brand,
    title,
    cleanedTitle,
    query,
    modelKey,
    category,
    slug,
    accessoryLike,
    coreProduct,
    imageCount: countApproxImages(html),
    specCount: countApproxSpecs(html),
    ...structured,
    ...decisions,
  };
}

function ensureBrandInName(name, brand) {
  const cleanName = String(name || "").trim();
  const cleanBrand = String(brand || "").trim();
  if (!cleanName) return "";
  if (!cleanBrand) return cleanName;
  if (new RegExp(`\\b${escapeRegExp(cleanBrand)}\\b`, "i").test(cleanName)) return cleanName;
  return `${cleanBrand} ${cleanName}`.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function summarizePages(pages) {
  const official = pages.filter((page) => page.sourceKind === "official");
  const retailer = pages.filter((page) => page.sourceKind === "retailer");

  const summarizeBucket = (items) => ({
    count: items.length,
    avgImages: average(items.map((item) => item.imageCount)),
    avgSpecs: average(items.map((item) => item.specCount)),
    productSchemaRate: rate(items, (item) => item.hasProductSchema),
    packageRate: rate(items, (item) => item.hasPackage),
    shippingRate: rate(items, (item) => item.hasShipping),
    warrantyRate: rate(items, (item) => item.hasWarranty),
    faqRate: rate(items, (item) => item.hasFaq),
    reviewsRate: rate(items, (item) => item.hasReviews),
    authenticityRate: rate(items, (item) => item.hasAuthenticity),
    addToCartRate: rate(items, (item) => item.hasAddToCart),
  });

  return {
    totalPages: pages.length,
    official: summarizeBucket(official),
    retailer: summarizeBucket(retailer),
  };
}

function average(values) {
  return Number(
    (
      values.reduce((sum, value) => sum + Number(value || 0), 0) /
      Math.max(values.length, 1)
    ).toFixed(2),
  );
}

function rate(items, predicate) {
  return Number(((items.filter(predicate).length / Math.max(items.length, 1)) * 100).toFixed(1));
}

function buildPairs(pages) {
  const pairs = [];
  const officialPages = pages.filter(
    (page) => page.sourceKind === "official" && page.brand && page.query && !page.error && page.coreProduct && !page.accessoryLike,
  );
  const retailerPages = pages.filter(
    (page) => page.sourceKind === "retailer" && page.brand && page.query && !page.error && page.coreProduct && !page.accessoryLike,
  );

  for (const official of officialPages) {
    const compatibleRetailers = retailerPages
      .map((retailer) => ({ retailer, score: scorePairCompatibility(official, retailer) }))
      .filter((entry) => entry.score >= 6)
      .sort((left, right) => right.score - left.score)
      .map((entry) => entry.retailer);

    if (!compatibleRetailers.length) continue;

    pairs.push({
      key: [official.brand, official.modelKey || normalizeComparisonText(official.cleanedTitle || official.query)].join("|"),
      brand: official.brand,
      query: official.query,
      officialCount: 1,
      retailerCount: compatibleRetailers.length,
      officialAvgImages: average([official.imageCount]),
      retailerAvgImages: average(compatibleRetailers.map((item) => item.imageCount)),
      officialAvgSpecs: average([official.specCount]),
      retailerAvgSpecs: average(compatibleRetailers.map((item) => item.specCount)),
      officialShippingRate: rate([official], (item) => item.hasShipping),
      retailerShippingRate: rate(compatibleRetailers, (item) => item.hasShipping),
      officialWarrantyRate: rate([official], (item) => item.hasWarranty),
      retailerWarrantyRate: rate(compatibleRetailers, (item) => item.hasWarranty),
      officialPackageRate: rate([official], (item) => item.hasPackage),
      retailerPackageRate: rate(compatibleRetailers, (item) => item.hasPackage),
      officialReviewsRate: rate([official], (item) => item.hasReviews),
      retailerReviewsRate: rate(compatibleRetailers, (item) => item.hasReviews),
      officialExamples: [official.url],
      retailerExamples: compatibleRetailers.slice(0, 3).map((item) => item.url),
    });
  }

  return pairs;
}

function scorePairCompatibility(official, retailer) {
  if (!official || !retailer) return -1;
  if (normalizeComparisonText(official.brand) !== normalizeComparisonText(retailer.brand)) return -1;
  if (official.category && retailer.category && official.category !== retailer.category) return -1;

  const officialTokens = modelKeyTokens(
    String(official.query || "").replace(new RegExp(`\\b${escapeRegExp(String(official.brand || ""))}\\b`, "ig"), " "),
  );
  const retailerTokens = modelKeyTokens(
    String(retailer.query || "").replace(new RegExp(`\\b${escapeRegExp(String(retailer.brand || ""))}\\b`, "ig"), " "),
  );
  if (!officialTokens.length || !retailerTokens.length) return -1;

  const retailerSet = new Set(retailerTokens);
  const overlap = officialTokens.filter((token) => retailerSet.has(token));
  const numericOverlap = overlap.filter((token) => /\d/.test(token) || isVersionLikeToken(token));

  if (!overlap.length) return -1;
  if (overlap.length < 2 && !numericOverlap.length) return -1;
  if (hasConflictingModelTokens(officialTokens, retailerTokens)) return -1;

  let score = overlap.length * 3;
  const smaller = officialTokens.length <= retailerTokens.length ? officialTokens : retailerTokens;
  const largerSet = new Set(officialTokens.length <= retailerTokens.length ? retailerTokens : officialTokens);
  if (smaller.every((token) => largerSet.has(token))) score += 2;
  if (official.modelKey && retailer.modelKey && official.modelKey === retailer.modelKey) score += 3;
  if (official.category && official.category === retailer.category) score += 1;
  return score;
}

function hasConflictingModelTokens(leftTokens, rightTokens) {
  const leftNumeric = new Set(leftTokens.filter((token) => /\d/.test(token) || isVersionLikeToken(token)));
  const rightNumeric = new Set(rightTokens.filter((token) => /\d/.test(token) || isVersionLikeToken(token)));

  if (!leftNumeric.size || !rightNumeric.size) return false;
  for (const token of leftNumeric) {
    if (!rightNumeric.has(token)) return true;
  }
  for (const token of rightNumeric) {
    if (!leftNumeric.has(token)) return true;
  }
  return false;
}

function summarizePairs(pairs) {
  return {
    pairedProducts: pairs.length,
    officialAvgImages: average(pairs.map((item) => item.officialAvgImages)),
    retailerAvgImages: average(pairs.map((item) => item.retailerAvgImages)),
    officialAvgSpecs: average(pairs.map((item) => item.officialAvgSpecs)),
    retailerAvgSpecs: average(pairs.map((item) => item.retailerAvgSpecs)),
    officialShippingRate: average(pairs.map((item) => item.officialShippingRate)),
    retailerShippingRate: average(pairs.map((item) => item.retailerShippingRate)),
    officialWarrantyRate: average(pairs.map((item) => item.officialWarrantyRate)),
    retailerWarrantyRate: average(pairs.map((item) => item.retailerWarrantyRate)),
    officialPackageRate: average(pairs.map((item) => item.officialPackageRate)),
    retailerPackageRate: average(pairs.map((item) => item.retailerPackageRate)),
    officialReviewsRate: average(pairs.map((item) => item.officialReviewsRate)),
    retailerReviewsRate: average(pairs.map((item) => item.retailerReviewsRate)),
  };
}

function buildResearchQueries(pages) {
  return pages
    .filter((page) => page.brand && page.query && page.modelKey)
    .map((page) => ({
      query: page.query,
      expectedName: page.query,
      brand: page.brand,
      category: page.category,
      sourceUrl: page.url,
      sourceKind: page.sourceKind,
      queryScore: scoreResearchQueryCandidate(page),
      coreProduct: Boolean(page.coreProduct),
      accessoryLike: Boolean(page.accessoryLike),
    }))
    .filter((page) => isUsefulResearchQuery(page))
    .sort((left, right) => right.queryScore - left.queryScore)
    .filter((entry, index, list) => {
      const key = `${normalizeComparisonText(entry.query)}|${normalizeComparisonText(entry.brand)}`;
      return list.findIndex((item) => `${normalizeComparisonText(item.query)}|${normalizeComparisonText(item.brand)}` === key) === index;
    })
    .slice(0, 2000);
}

function scoreResearchQueryCandidate(page) {
  let score = 0;
  if (page.sourceKind === "official") score += 8;
  if (page.hasProductSchema) score += 5;
  if (page.hasOffers) score += 2;
  if (page.hasWarranty) score += 1;
  if (page.hasShipping) score += 1;
  if (page.hasReviews) score += 1;
  if (page.coreProduct) score += 8;
  if (isCoreCategory(page.category)) score += 6;
  if (page.imageCount >= 4) score += 2;
  if (page.specCount >= 2) score += 2;
  if (page.accessoryLike) score -= 12;
  if (page.category === "accessories") score -= 10;
  if (looksResearchNoise([page.query, page.url, page.slug, page.title].join(" "))) score -= 20;
  return score;
}

function isUsefulResearchQuery(page) {
  const text = `${page.query} ${page.sourceUrl || page.url || ""} ${page.category || ""}`.toLowerCase();
  if (!String(page.query || "").trim()) return false;
  if (/\b(official website|language|302 found|gift card|access denied|login|sign up|reset password|account)\b/.test(text)) return false;
  if (/\b(open[\s-]?box|refurb(?:ished)?|renewed|used|b[\s-]?stock|trade-up)\b/.test(text)) return false;
  if (page.accessoryLike || page.category === "accessories") return false;
  if (looksAccessoryLike([page.query, page.sourceUrl || page.url || ""].join(" "))) return false;
  if (looksResearchNoise([page.query, page.sourceUrl || page.url || ""].join(" "))) return false;
  if (Number(page.queryScore || 0) <= 0) return false;
  return true;
}

function buildMarkdownReport(summary, pairSummary, pairs, pages) {
  const pairedExamples = pairs.slice(0, 12);
  const officialHighlights = pages.filter((page) => page.sourceKind === "official" && page.hasPackage).slice(0, 6);
  const retailerHighlights = pages.filter((page) => page.sourceKind === "retailer" && page.hasShipping && page.hasWarranty).slice(0, 6);

  return [
    "# EDIO Product Page Landscape Research",
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Pages analyzed: ${summary.totalPages}`,
    `- Paired products: ${pairSummary.pairedProducts}`,
    "",
    "## Official vs Retailer",
    "",
    `- Official avg images: ${summary.official.avgImages}`,
    `- Retailer avg images: ${summary.retailer.avgImages}`,
    `- Official avg specs: ${summary.official.avgSpecs}`,
    `- Retailer avg specs: ${summary.retailer.avgSpecs}`,
    `- Official product schema rate: ${summary.official.productSchemaRate}%`,
    `- Retailer product schema rate: ${summary.retailer.productSchemaRate}%`,
    `- Official package visibility: ${summary.official.packageRate}%`,
    `- Retailer package visibility: ${summary.retailer.packageRate}%`,
    `- Official shipping visibility: ${summary.official.shippingRate}%`,
    `- Retailer shipping visibility: ${summary.retailer.shippingRate}%`,
    `- Official warranty visibility: ${summary.official.warrantyRate}%`,
    `- Retailer warranty visibility: ${summary.retailer.warrantyRate}%`,
    `- Official review visibility: ${summary.official.reviewsRate}%`,
    `- Retailer review visibility: ${summary.retailer.reviewsRate}%`,
    "",
    "## Paired Examples",
    "",
    ...pairedExamples.map((item) =>
      [
        `### ${item.query}`,
        `- Brand: ${item.brand}`,
        `- Official images/specs: ${item.officialAvgImages} / ${item.officialAvgSpecs}`,
        `- Retailer images/specs: ${item.retailerAvgImages} / ${item.retailerAvgSpecs}`,
        `- Official shipping/warranty/reviews: ${item.officialShippingRate}% / ${item.officialWarrantyRate}% / ${item.officialReviewsRate}%`,
        `- Retailer shipping/warranty/reviews: ${item.retailerShippingRate}% / ${item.retailerWarrantyRate}% / ${item.retailerReviewsRate}%`,
        `- Official URLs: ${item.officialExamples.join(" | ")}`,
        `- Retailer URLs: ${item.retailerExamples.join(" | ")}`,
        "",
      ].join("\n"),
    ),
    "## Signals Worth Reusing In EDIO",
    "",
    "- Keep official pages as product-truth sources for names, imagery, and core specs.",
    "- Reuse retailer-style decision signals near the CTA: shipping, warranty, authenticity, stock, and box contents.",
    "- Treat package contents as a separate storefront section, not as regular marketing highlights.",
    "- Prefer full-frame product imagery and enough visible thumbnails to avoid hidden product context.",
    "",
    "## Example Pages With Strong Package Signals",
    "",
    ...officialHighlights.map((page) => `- ${page.query}: ${page.url}`),
    ...retailerHighlights.map((page) => `- ${page.query}: ${page.url}`),
  ].join("\n");
}

async function writeCheckpoint({ outputDir, analyzedPages, summary, pairSummary, pairs, queries, progress }) {
  await fs.mkdir(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, "edio-product-page-research-latest.partial.json");
  const mdPath = path.join(outputDir, "edio-product-page-research-latest.partial.md");
  const queriesPath = path.join(outputDir, "edio-product-page-research-queries-latest.partial.json");

  await fs.writeFile(
    jsonPath,
    JSON.stringify(
      {
        progress,
        summary,
        pairSummary,
        pairs,
        pages: analyzedPages,
      },
      null,
      2,
    ),
  );
  await fs.writeFile(mdPath, buildMarkdownReport(summary, pairSummary, pairs, analyzedPages));
  await fs.writeFile(queriesPath, JSON.stringify({ queries }, null, 2));
}

async function main() {
  const options = parseArgs(process.argv);
  const allCandidates = [];

  for (const source of RESEARCH_SOURCES) {
    process.stdout.write(`Collecting sitemap pages for ${source.domain}\n`);
    try {
      const urls = await collectProductUrlsForSource(source, options.maxPagesPerDomain);
      allCandidates.push(...urls.map((entry) => ({ ...entry, source })));
    } catch (error) {
      process.stdout.write(`Failed collecting ${source.domain}: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  const queue = allCandidates
    .filter((entry, index, list) => list.findIndex((item) => item.url === entry.url) === index)
    .slice(0, options.maxAnalyzedPages);

  const analyzedPages = [];

  for (let index = 0; index < queue.length; index += 1) {
    const item = queue[index];
    process.stdout.write(`[${index + 1}/${queue.length}] ${item.url}\n`);

    try {
      analyzedPages.push(await analyzeProductPage(item, item.source));
    } catch (error) {
      analyzedPages.push({
        url: item.url,
        domain: item.source.domain,
        sourceKind: item.source.kind,
        sourceBrand: item.source.brand || "",
        brand: item.source.brand || "",
        title: item.title || "",
        cleanedTitle: "",
        query: "",
        modelKey: "",
        category: "",
        imageCount: 0,
        specCount: 0,
        hasProductSchema: false,
        hasAggregateRating: false,
        hasOffers: false,
        hasPackage: false,
        hasShipping: false,
        hasWarranty: false,
        hasAuthenticity: false,
        hasFaq: false,
        hasReviews: false,
        hasAddToCart: false,
        hasCompareOrBundle: false,
        longFormStory: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const summary = summarizePages(analyzedPages);
    const pairs = buildPairs(analyzedPages);
    const pairSummary = summarizePairs(pairs);
    const queries = buildResearchQueries(analyzedPages);

    if (
      options.checkpointEvery > 0 &&
      ((index + 1) % options.checkpointEvery === 0 || index + 1 === queue.length)
    ) {
      await writeCheckpoint({
        outputDir: options.outputDir,
        analyzedPages,
        summary,
        pairSummary,
        pairs,
        queries,
        progress: {
          completed: index + 1,
          total: queue.length,
          percent: Number((((index + 1) / Math.max(queue.length, 1)) * 100).toFixed(1)),
          updatedAt: new Date().toISOString(),
        },
      });
    }

    if (options.delayMs > 0) {
      await sleep(options.delayMs);
    }
  }

  const summary = summarizePages(analyzedPages);
  const pairs = buildPairs(analyzedPages);
  const pairSummary = summarizePairs(pairs);
  const queries = buildResearchQueries(analyzedPages);

  await fs.mkdir(options.outputDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(options.outputDir, `edio-product-page-research-${stamp}.json`);
  const mdPath = path.join(options.outputDir, `edio-product-page-research-${stamp}.md`);
  const queriesPath = path.join(options.outputDir, `edio-product-page-research-queries-${stamp}.json`);

  await fs.writeFile(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sources: RESEARCH_SOURCES,
        summary,
        pairSummary,
        pairs,
        pages: analyzedPages,
      },
      null,
      2,
    ),
  );
  await fs.writeFile(mdPath, buildMarkdownReport(summary, pairSummary, pairs, analyzedPages));
  await fs.writeFile(queriesPath, JSON.stringify({ generatedAt: new Date().toISOString(), queries }, null, 2));

  console.log(
    JSON.stringify(
      {
        summary,
        pairSummary,
        jsonPath,
        mdPath,
        queriesPath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
