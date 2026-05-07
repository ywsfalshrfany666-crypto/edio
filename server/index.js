import http from "node:http";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { lookup } from "node:dns/promises";
import { build } from "esbuild";
import {
  BULK_CONFIDENCE_THRESHOLD,
  applyPreviewChangesToProduct,
  buildBulkPreview,
} from "./bulkProductOps.js";
import {
  CLASSIFICATION_CONFIDENCE_THRESHOLD,
  applyClassificationToProduct,
  classifyProductForCatalog,
  classifyProductForCatalogAsync,
  normalizeCategoryAssignment,
} from "./productClassificationEngine.js";
import {
  IMPORT_PIPELINE_VERSION,
  IMPORT_SOURCE_WEIGHTS,
  assignImportPipelineDataToDraft,
  buildImportEvidenceFromDraft,
  buildImportJobRecord,
  buildImportModelStepOutput,
  buildImportReviewTask,
  completeImportJobRecord,
  failImportJobRecord,
  rankImportEvidence,
  shouldPreserveAcceptedClassification,
  validateImportModelStepOutput,
} from "./productImportPipeline.js";
import {
  PRODUCT_IMAGE_NORMALIZATION_POLICY,
  normalizePngTransparencyToWhite,
} from "./imageNormalization.js";
import {
  buildDescriptionBlocksFromImportDraft,
  sanitizeDescriptionText,
} from "./productDescriptionMedia.js";
import {
  applyProductWebEnrichment,
  createProductWebEnrichmentDryRun,
} from "./productWebEnrichment.js";
import {
  WOOCOMMERCE_IMPORT_VERSION,
  analyzeWooCommerceCsv,
} from "./woocommerceImport.js";
import {
  buildOAuthAuthorizationUrl,
  consumeOAuthState,
  createOAuthState,
  exchangeOAuthCode,
  getOAuthProviderConfig,
  getOAuthProviderStatus,
  normalizeProviderProfile,
  normalizeRedirectPath,
  verifyOAuthIdToken,
} from "./oauthAuth.js";
import {
  MEDIA_PIPELINE_VERSION,
  buildImportMediaJob,
  buildProductMediaSet,
  checksumBuffer,
  collectImageCandidatesFromSources,
  normalizeAssetCandidate,
  retryWithBackoff,
} from "./productMediaPipeline.js";
import {
  PRODUCT_PLATFORM_FEATURE_FLAGS,
  applyInventoryWebhookUpdate,
  applyProductLifecycle,
  backfillProductPlatform,
  buildInternalRevalidationResponse,
  createImportProductJob,
  ensureProductPlatformCollections,
  serializeProductPlatformProduct,
  verifyInventoryWebhookSignature,
} from "./productManagementPlatform.js";
import {
  buildProductionReadinessReport,
  isStorefrontVisibleProduct,
} from "./productionReadiness.js";
import { applyNineEndingPricing } from "./pricingPolicy.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT_DIR, "src");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = process.env.EDIO_DB_FILE || path.join(DATA_DIR, "db.json");
const IMPORT_MEDIA_DIR = path.join(DATA_DIR, "imported-media");
const IMAGE_DISPLAY_POLICY = {
  hero_background: "white",
  minimum_for_future_compliance: "500x500",
  recommended_hero_size: "1500x1500+",
  text_overlay_allowed_on_hero: false,
};
const BRAND_SEARCH_DOMAINS = {
  hifiman: ["eu.hifiman.com", "hifiman.com", "headphones.com"],
  fiio: ["fiio.com", "fiio.com.cn", "headphones.com"],
  moondrop: ["moondroplab.com", "shenzhenaudio.com"],
  simgot: ["simgot.com", "linsoul.com"],
  "kiwi ears": ["kiwiears.com", "linsoul.com"],
  dunu: ["dunu-topsound.com", "dunu-topsound.com/en", "headphones.com", "linsoul.com", "shenzhenaudio.com", "hifigo.com"],
  aful: ["afulaudio.com", "hifigo.com"],
  tanchjim: ["tanchjimaudio.com", "shenzhenaudio.com"],
  truthear: ["truthear.com", "shenzhenaudio.com"],
  "7hz": ["7hzacoustics.com", "linsoul.com"],
  tripowin: ["linsoul.com"],
  spinfit: ["spinfit-eartip.com"],
  "audio technica": ["audio-technica.com"],
  "fosi audio": ["fosiaudio.com"],
  hiby: ["hiby.com"],
  akg: ["tw.akg.com", "au.akg.com", "akg.com"],
  philips: ["philips.com"],
  rode: ["rode.com", "thomannmusic.com", "sweetwater.com"],
  shure: ["shure.com", "sweetwater.com", "thomannmusic.com"],
  sennheiser: ["sennheiser.com", "sweetwater.com", "thomannmusic.com"],
  beyerdynamic: ["beyerdynamic.com", "thomannmusic.com"],
  focusrite: ["focusrite.com", "sweetwater.com", "thomannmusic.com"],
};
const TRUSTED_RETAILER_HOSTS = [
  "amazon.com",
  "amazon.co.uk",
  "sweetwater.com",
  "thomann.de",
  "thomannmusic.com",
  "headphones.com",
  "hifigo.com",
  "linsoul.com",
  "shenzhenaudio.com",
  "musicradar.com",
  "thepodcasthaven.com",
];
const KNOWN_BRAND_LABELS = {
  hifiman: "HiFiMAN",
  fiio: "FiiO",
  moondrop: "MOONDROP",
  simgot: "SIMGOT",
  "kiwi ears": "Kiwi Ears",
  dunu: "DUNU",
  aful: "AFUL",
  tanchjim: "TANCHJIM",
  truthear: "TRUTHEAR",
  "7hz": "7HZ",
  tripowin: "Tripowin",
  spinfit: "SpinFit",
  "audio technica": "Audio-Technica",
  "fosi audio": "Fosi Audio",
  hiby: "HiBy",
  akg: "AKG",
  philips: "Philips",
  rode: "Rode",
  shure: "Shure",
  sennheiser: "Sennheiser",
  beyerdynamic: "beyerdynamic",
  focusrite: "Focusrite",
};
const STRICT_PRODUCT_TYPE_BY_CATEGORY = {
  headphones: "Headphones",
  iems: "IEM",
  dap: "DAP",
  dac: "DAC / AMP",
  "audio-interface": "Audio Interface",
  mic: "Microphone",
  accessories: "Accessory",
  unknown: "unknown",
};
const STRICT_CATEGORY_AR = {
  headphones: "سماعات رأس",
  iems: "سماعات IEM",
  dap: "مشغل صوت محمول",
  dac: "DAC / AMP",
  "audio-interface": "واجهة صوتية",
  mic: "ميكروفون",
  accessories: "إكسسوار صوتي",
  unknown: "غير محددة",
};
const STRICT_CATEGORY_USE_CASES = {
  headphones: ["Monitoring", "Critical Listening", "Mixing"],
  iems: ["Daily Listening", "Stage Monitoring", "Portable HiFi"],
  dap: ["Portable Listening", "Hi-Res Playback", "Travel"],
  dac: ["Desktop Listening", "Headphone Driving", "Signal Conversion"],
  "audio-interface": ["Recording", "Podcast", "Studio Production"],
  mic: ["Podcast", "Studio Recording", "Streaming"],
  accessories: ["Cable Management", "Replacement", "System Setup"],
  unknown: [],
};
const GENERIC_PRODUCT_TOKENS = new Set([
  "a",
  "an",
  "and",
  "audio",
  "balanced",
  "bluetooth",
  "cable",
  "dac",
  "dynamic",
  "ear",
  "earbud",
  "earbuds",
  "earphone",
  "earphones",
  "flagship",
  "for",
  "headphone",
  "headphones",
  "hifi",
  "hybrid",
  "iem",
  "iems",
  "in",
  "magnetic",
  "mic",
  "microphone",
  "monitor",
  "monitors",
  "of",
  "official",
  "open",
  "over",
  "page",
  "planar",
  "portable",
  "quad",
  "product",
  "shop",
  "store",
  "studio",
  "the",
  "to",
  "topsound",
  "triple",
  "wireless",
]);
const MODEL_VARIANT_TOKENS = new Set([
  "anniversary",
  "box",
  "bstock",
  "bt",
  "classic",
  "closed",
  "est",
  "evo",
  "gen2",
  "gen3",
  "ii",
  "iii",
  "iv",
  "ix",
  "jr",
  "le",
  "limited",
  "ltd",
  "max",
  "mini",
  "mk2",
  "mk3",
  "mkii",
  "mkiii",
  "mkiv",
  "mkv",
  "nano",
  "organic",
  "openbox",
  "plus",
  "pro",
  "refurbished",
  "renewed",
  "r2r",
  "se",
  "sr",
  "stealth",
  "studio",
  "snow",
  "ultra",
  "unveiled",
  "used",
  "v2",
  "v3",
  "v4",
  "vi",
  "vii",
  "viii",
  "wireless",
]);
const PORT = Number(process.env.API_PORT || process.env.PORT || 8787);
const HOST = process.env.API_HOST || "127.0.0.1";
const JWT_SECRET = process.env.JWT_SECRET || "edio-local-development-secret";
const DEFAULT_JWT_SECRET = "edio-local-development-secret";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14;
const AUTH_SESSION_COOKIE = process.env.EDIO_AUTH_COOKIE_NAME || "edio_session";
const OAUTH_STATE_COOKIE = process.env.EDIO_OAUTH_STATE_COOKIE_NAME || "edio_oauth_state";
const AUTH_SESSION_TTL_MS = Number(process.env.EDIO_SESSION_TTL_MS || 1000 * 60 * 60 * 24 * 14);
const EMAIL_VERIFICATION_TTL_MS = Number(process.env.EDIO_EMAIL_VERIFICATION_TTL_MS || 1000 * 60 * 60 * 24);
const PASSWORD_RESET_TTL_MS = Number(process.env.EDIO_PASSWORD_RESET_TTL_MS || 1000 * 60 * 60);
const AUTH_COOKIE_SECURE =
  process.env.EDIO_AUTH_COOKIE_SECURE === "true" ||
  (process.env.NODE_ENV === "production" && process.env.EDIO_AUTH_COOKIE_SECURE !== "false");
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX = 8;
const GENERAL_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REMOTE_HTML_BYTES = 2_000_000;
const MAX_REMOTE_IMAGE_BYTES = 8_000_000;
const ALLOWED_IMAGE_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
const FORBIDDEN_PROFILE_FIELDS = new Set([
  "role",
  "isAdmin",
  "admin",
  "superAdmin",
  "super_admin",
  "passwordHash",
  "passwordSalt",
  "emailVerified",
  "banned",
  "status",
  "deletedAt",
  "internalNotes",
]);
const FREE_SHIPPING_THRESHOLD = 150000;
const SHIPPING_FEE = 5000;
const IQD_PER_USD = 1300;
const SUPPORTED_CURRENCIES = ["IQD", "USD"];
const DEFAULT_BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const ALWASEET_PUBLIC_API_BASE = "https://api.alwaseet-iq.net/v1/merchant";

const ORDER_STATUSES = new Set(["pending", "confirmed", "shipped", "delivered", "cancelled"]);
const PRODUCT_BADGES = new Set(["new", "featured", "best", "preowned"]);
const PRODUCT_STATUSES = new Set(["published", "draft", "needs_review", "hidden", "archived"]);
const PRODUCT_AVAILABILITY_STATUSES = new Set(["in_stock", "out_of_stock", "pre_order", "discontinued", "hidden"]);
const PRODUCT_RELATIONSHIP_TYPES = new Set(["accessory", "compatible", "similar", "alternative", "same_brand", "blocked"]);
const PUBLIC_USER_FIELDS = [
  "id",
  "email",
  "emailVerified",
  "fullName",
  "phone",
  "phoneE164",
  "avatarUrl",
  "role",
  "status",
  "locale",
  "currency",
  "banned",
  "createdAt",
  "updatedAt",
  "lastLoginAt",
];
const NEW_BADGE_WINDOW_MS = 7 * 86400000;
const HIDDEN_BRAND_KEYS = new Set(["crown", "hue"]);
const SITE_CATEGORY_SLUGS = ["headphones", "iems", "dap", "dac", "audio-interface", "mic", "accessories"];
const UNKNOWN_CATEGORY = "unknown";
const COLLECTION_DEFINITIONS = [
  {
    slug: "featured",
    title: "Featured",
    description: "Highlighted products curated for the EDIO storefront.",
    sort: "featured",
  },
  {
    slug: "new-arrivals",
    title: "New Arrivals",
    description: "The latest products added to the EDIO catalog.",
    sort: "newest",
    aliases: ["newest", "recent", "recently-added"],
  },
  {
    slug: "new",
    title: "New",
    description: "Products still inside the new-arrival window or marked as new.",
    sort: "newest",
    badge: "new",
    aliases: ["fresh"],
  },
  {
    slug: "popular",
    title: "Most Viewed",
    description: "Popular catalog items ranked by current storefront importance.",
    sort: "featured",
    aliases: ["most-viewed", "views"],
  },
  {
    slug: "best-sellers",
    title: "Best Sellers",
    description: "Products ranked by the strongest sales performance.",
    sort: "best-selling",
    aliases: ["best", "best-selling", "top-selling"],
  },
  {
    slug: "pre-owned",
    title: "Pre-Owned",
    description: "Pre-owned pieces currently available in the catalog.",
    sort: "newest",
    preowned: true,
    aliases: ["preowned"],
  },
  {
    slug: "sale",
    title: "On Sale",
    description: "Products currently carrying a lower sale price than their compare-at price.",
    sort: "featured",
    saleOnly: true,
    aliases: ["offers", "deals"],
  },
  {
    slug: "in-stock",
    title: "Available Now",
    description: "Products that are currently available for sale.",
    sort: "featured",
    inStock: true,
    aliases: ["available", "available-now"],
  },
  {
    slug: "out-of-stock",
    title: "Sold Out",
    description: "Products that are currently unavailable.",
    sort: "newest",
    outOfStock: true,
    aliases: ["sold-out", "unavailable"],
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithBrowserHeaders(
  url,
  {
    method = "GET",
    accept = "text/html,application/xhtml+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
    headers = {},
    timeoutMs = 12000,
    retries = 1,
    ...rest
  } = {},
) {
  let lastError;
  let currentUrl = await validateExternalHttpUrl(url);
  const maxRedirects = 3;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      let redirectCount = 0;

      while (redirectCount <= maxRedirects) {
        const response = await fetch(currentUrl, {
        method,
        signal: AbortSignal.timeout(timeoutMs + attempt * 2000),
        redirect: "manual",
        headers: {
          "User-Agent": DEFAULT_BROWSER_USER_AGENT,
          Accept: accept,
          ...headers,
        },
        ...rest,
      });

        if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
          redirectCount += 1;
          if (redirectCount > maxRedirects) {
            throw new ApiError(400, "redirect_limit_exceeded", "External request redirected too many times");
          }
          currentUrl = await validateExternalHttpUrl(new URL(response.headers.get("location"), currentUrl));
          continue;
        }

        if (attempt < retries && (response.status === 403 || response.status === 408 || response.status === 429 || response.status >= 500)) {
          await sleep(350 * (attempt + 1));
          break;
        }

        return response;
      }
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      await sleep(350 * (attempt + 1));
    }
  }

  throw lastError || new Error(`Failed to fetch ${url}`);
}

async function validateExternalHttpUrl(rawUrl, field = "url") {
  let parsed;
  try {
    parsed = rawUrl instanceof URL ? new URL(rawUrl.toString()) : new URL(String(rawUrl || ""));
  } catch {
    throw new ApiError(400, "validation_error", `${field} is invalid`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new ApiError(400, "blocked_url", `${field} must use http or https`);
  }
  if (parsed.username || parsed.password) {
    throw new ApiError(400, "blocked_url", `${field} must not include credentials`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (isBlockedHostname(hostname)) {
    throw new ApiError(400, "blocked_url", `${field} points to a private or local host`);
  }

  const addresses = net.isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: false }).catch(() => {
        throw new ApiError(400, "blocked_url", `${field} host could not be resolved safely`);
      });

  if (!addresses.length || addresses.some((entry) => isPrivateOrReservedIp(entry.address))) {
    throw new ApiError(400, "blocked_url", `${field} resolved to a private or reserved address`);
  }

  return parsed;
}

function isBlockedHostname(hostname) {
  const clean = String(hostname || "").replace(/^\[|\]$/g, "").toLowerCase();
  return (
    !clean ||
    clean === "localhost" ||
    clean.endsWith(".localhost") ||
    clean === "metadata.google.internal" ||
    clean.endsWith(".internal") ||
    clean.endsWith(".local") ||
    isPrivateOrReservedIp(clean)
  );
}

function isPrivateOrReservedIp(value) {
  const ipVersion = net.isIP(value);
  if (!ipVersion) return false;

  if (ipVersion === 4) {
    const parts = value.split(".").map((part) => Number(part));
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }

  const normalized = value.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.") ||
    normalized.startsWith("::ffff:169.254.")
  );
}

async function readResponseBufferWithLimit(response, maxBytes, label = "response") {
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > maxBytes) {
    throw new ApiError(413, "payload_too_large", `${label} is too large`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxBytes) {
      throw new ApiError(413, "payload_too_large", `${label} is too large`);
    }
    return Buffer.from(arrayBuffer);
  }

  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      throw new ApiError(413, "payload_too_large", `${label} is too large`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function readResponseTextWithLimit(response, maxBytes, label = "response") {
  const buffer = await readResponseBufferWithLimit(response, maxBytes, label);
  return buffer.toString("utf8");
}

function normalizeContentType(value) {
  return String(value || "").split(";")[0].trim().toLowerCase();
}

function assertHtmlResponse(response) {
  const contentType = normalizeContentType(response.headers.get("content-type"));
  if (contentType && !["text/html", "application/xhtml+xml", "application/xml", "text/xml"].includes(contentType)) {
    throw new ApiError(400, "invalid_content_type", "External page did not return HTML");
  }
}

function assertImageResponse(response) {
  const contentType = normalizeContentType(response.headers.get("content-type"));
  if (contentType && !ALLOWED_IMAGE_CONTENT_TYPES.has(contentType)) {
    throw new ApiError(400, "invalid_image_type", "Only JPG, PNG, WebP, and AVIF product images are allowed");
  }
}
const BRAND_LOGOS = {
  "7hz": "/src/assets/brands/white/7hz-white.png",
  aful: "/src/assets/brands/white/aful-white.png",
  audiotechnica: "/src/assets/brands/audio-technica.svg",
  blon: "/src/assets/brands/white/blon-white.png",
  dunu: "/src/assets/brands/white/dunu-white.png",
  fiio: "/src/assets/brands/white/fiio-white.png",
  fosiaudio: "/src/assets/brands/white/fosi-audio-white.png",
  harmonicempire: "/src/assets/brands/white/harmonic-empire-white.png",
  harmonicdyne: "/src/assets/brands/white/harmonicdyne-white.png",
  hifiman: "/src/assets/brands/white/hifiman-official-white.png",
  hiby: "/src/assets/brands/white/hiby-white.png",
  jcally: "/src/assets/brands/white/jcally-white.png",
  kefine: "/src/assets/brands/white/kefine-white.png",
  kinera: "/src/assets/brands/white/kinera-official-white.png",
  kiwiears: "/src/assets/brands/white/kiwi-ears-white.png",
  letshuoer: "/src/assets/brands/white/letshuoer-white.png",
  moondrop: "/src/assets/brands/white/moondrop-white.png",
  philips: "/src/assets/brands/philips.svg",
  roseselsa: "/src/assets/brands/white/roseselsa-official-white.png",
  sennheiser: "/src/assets/brands/white/sennheiser-white.png",
  simgot: "/src/assets/brands/white/simgot-white.png",
  sivga: "/src/assets/brands/white/sivga-official-white.png",
  smsl: "/src/assets/brands/white/smsl-white.png",
  spinfit: "/src/assets/brands/white/spinfit-white.png",
  tanchjim: "/src/assets/brands/tanchjim-official.png",
  tangzu: "/src/assets/brands/white/tangzu-official-white.png",
  tripowin: "/src/assets/brands/white/tripowin-white.png",
  trn: "/src/assets/brands/white/trn-white.png",
  truthear: "/src/assets/brands/truthear-official.svg",
  twistura: "/src/assets/brands/white/twistura-official-white.png",
  ziigaat: "/src/assets/brands/ziigaat.svg",
  pulaaudio: "/src/assets/brands/pula-audio.svg",
};

const seedCoupons = [
  { code: "WELCOME10", type: "percent", value: 10, label: "10% off your order", active: true },
  { code: "EDIO20", type: "percent", value: 20, label: "20% off members", minSubtotal: 200000, active: true },
  { code: "SOUND50K", type: "fixed", value: 50000, label: "50,000 IQD off", minSubtotal: 300000, active: true },
];

let db;

async function fetchAlwaseetPublicJson(endpoint) {
  const response = await fetch(`${ALWASEET_PUBLIC_API_BASE}${endpoint}`, {
    headers: { "User-Agent": DEFAULT_BROWSER_USER_AGENT, Accept: "application/json" },
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.status) {
    throw new ApiError(502, "alwaseet_lookup_unavailable", "Unable to load Alwaseet shipping options");
  }
  return json;
}

function cleanAlwaseetLookupText(value, max = 160) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeAlwaseetLookupOption(row, labelKeys) {
  const id = Number(row?.id);
  const label = labelKeys.map((key) => cleanAlwaseetLookupText(row?.[key])).find(Boolean);
  return Number.isFinite(id) && id > 0 && label ? { id, label } : null;
}

async function loadAlwaseetPublicLookups(cityId) {
  const [citiesJson, packageSizesJson, regionsJson] = await Promise.all([
    fetchAlwaseetPublicJson("/citys"),
    fetchAlwaseetPublicJson("/package-sizes"),
    cityId ? fetchAlwaseetPublicJson(`/regions?city_id=${encodeURIComponent(String(cityId))}`) : Promise.resolve({ data: [] }),
  ]);
  const cityRows = Array.isArray(citiesJson.data) ? citiesJson.data : [];
  const sizeRows = Array.isArray(packageSizesJson.data) ? packageSizesJson.data : [];
  const regionRows = Array.isArray(regionsJson.data) ? regionsJson.data : [];
  return {
    cities: cityRows
      .map((row) => normalizeAlwaseetLookupOption(row, ["city_name", "name"]))
      .filter(Boolean),
    regions: regionRows
      .map((row) => normalizeAlwaseetLookupOption(row, ["region_name", "name"]))
      .filter(Boolean),
    packageSizes: sizeRows
      .map((row) => normalizeAlwaseetLookupOption(row, ["size", "title", "name"]))
      .filter(Boolean),
  };
}

async function route(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || `${HOST}:${PORT}`}`);
  const pathname = normalizePathname(url.pathname);
  const parts = pathname.split("/").filter(Boolean);
  const method = req.method || "GET";
  assertAllowedRequestOrigin(req, pathname);
  applyRouteRateLimits(req, pathname, method);

  if (pathname.startsWith("/src/assets/") && method === "GET") {
    return sendStaticAsset(res, pathname);
  }

  if (pathname.startsWith("/media/imports/") && method === "GET") {
    return sendImportedAsset(res, pathname);
  }

  if (pathname === "/api/health" && method === "GET") {
    return send(res, 200, {
      ok: true,
      data: {
        service: "edio-api",
        status: "ok",
        time: new Date().toISOString(),
        products: db.products.length,
        orders: db.orders.length,
        productPlatform: {
          enabled: true,
          featureFlags: PRODUCT_PLATFORM_FEATURE_FLAGS,
          variants: db.productVariants?.length || 0,
          outboxEvents: db.outboxEvents?.length || 0,
        },
      },
    });
  }

  if (pathname === "/api/webhooks/inventory-updated" && method === "POST") {
    const { body, rawBody } = await readJsonRaw(req, { maxBytes: 250_000 });
    const secret = process.env.EDIO_INVENTORY_WEBHOOK_SECRET || "";
    const signature = req.headers["x-edio-signature"] || req.headers["x-hub-signature-256"] || req.headers["x-signature"] || "";
    const verification = verifyInventoryWebhookSignature({ rawBody, signature, secret });
    if (secret && !verification.ok) {
      throw new ApiError(401, "invalid_signature", "Inventory webhook signature is invalid");
    }
    const result = applyInventoryWebhookUpdate(db, body, {
      signatureVerified: verification.ok,
      requestId: getRequestId(req),
    });
    writeAuditLog({
      req,
      actorUserId: null,
      action: "inventory.webhook.updated",
      targetType: "inventory_level",
      targetId: result.level.id,
      beforeState: null,
      afterState: {
        variantId: result.variant.id,
        productId: result.variant.productId,
        level: result.level,
        signature: verification.reason,
      },
    });
    await saveDatabase();
    return send(res, 200, { ok: true, data: result });
  }

  if (pathname === "/api/internal/revalidate" && method === "POST") {
    const token = process.env.EDIO_INTERNAL_REVALIDATE_TOKEN || "";
    if (token) {
      const authorization = String(req.headers.authorization || "");
      if (authorization !== `Bearer ${token}`) {
        throw new ApiError(401, "unauthorized", "Internal revalidation token is invalid");
      }
    } else if (process.env.NODE_ENV === "production") {
      throw new ApiError(503, "not_configured", "Internal revalidation token is not configured");
    }
    const body = await readJson(req, { maxBytes: 100_000 });
    const result = buildInternalRevalidationResponse(db, body, { requestId: getRequestId(req) });
    await saveDatabase();
    return send(res, 202, { ok: true, data: result });
  }

  if (pathname === "/api/currency" && method === "GET") {
    return send(res, 200, { ok: true, data: getCurrencyMeta() });
  }

  if (pathname === "/api/currency/convert" && method === "POST") {
    const body = await readJson(req);
    const amount = Number(body.amount);
    if (!Number.isFinite(amount)) throw new ApiError(400, "validation_error", "amount must be a valid number");
    const from = normalizeCurrency(body.from || "IQD");
    const to = normalizeCurrency(body.to || "USD");
    if (!SUPPORTED_CURRENCIES.includes(from) || !SUPPORTED_CURRENCIES.includes(to)) {
      throw new ApiError(400, "validation_error", "Unsupported currency");
    }
    return send(res, 200, {
      ok: true,
      data: {
        amount,
        from,
        to,
        converted: convertCurrency(amount, from, to),
        rate: getConversionRate(from, to),
      },
    });
  }

  if (pathname === "/api/catalog" && method === "GET") {
    return send(res, 200, {
      ok: true,
      data: {
        products: filterProducts(db.products, url.searchParams).map(withPublicInventoryProduct),
        categories: db.categories,
        brands: listBrands(),
        coupons: db.coupons.filter((coupon) => coupon.active).map(publicCoupon),
        collections: listCollections(),
        currency: getCurrencyMeta(),
      },
    });
  }

  if (pathname === "/api/products" && method === "GET") {
    const result = paginate(filterProducts(db.products, url.searchParams), url.searchParams);
    result.items = result.items.map(withPublicInventoryProduct);
    return send(res, 200, { ok: true, data: result });
  }

  if (parts[0] === "api" && parts[1] === "products" && parts[2] && parts[3] === "recommendations" && method === "GET") {
    const product = findProduct(parts[2]);
    if (!product) throw new ApiError(404, "not_found", "Product not found");
    if (!isStorefrontVisibleProduct(product)) throw new ApiError(404, "not_found", "Product not found");
    return send(res, 200, {
      ok: true,
      data: getPublicProductRecommendations(product, {
        lang: url.searchParams.get("lang") === "ar" ? "ar" : "en",
      }),
    });
  }

  if (parts[0] === "api" && parts[1] === "products" && parts[2] && method === "GET") {
    const product = findProduct(parts[2]);
    if (!product) throw new ApiError(404, "not_found", "Product not found");
    if (!isStorefrontVisibleProduct(product)) throw new ApiError(404, "not_found", "Product not found");
    return send(res, 200, { ok: true, data: withPublicInventoryProduct(product) });
  }

  if (pathname === "/api/brands" && method === "GET") {
    return send(res, 200, { ok: true, data: listBrands() });
  }

  if (parts[0] === "api" && parts[1] === "brands" && parts[2] && method === "GET") {
    const brand = getBrand(parts[2]);
    if (!brand) throw new ApiError(404, "not_found", "Brand not found");
    return send(res, 200, { ok: true, data: brand });
  }

  if (pathname === "/api/categories" && method === "GET") {
    return send(res, 200, { ok: true, data: db.categories.map(withCategoryCounts) });
  }

  if (parts[0] === "api" && parts[1] === "categories" && parts[2] && method === "GET") {
    const category = db.categories.find((item) => item.slug === parts[2]);
    if (!category) throw new ApiError(404, "not_found", "Category not found");
    return send(res, 200, { ok: true, data: withCategoryCounts(category) });
  }

  if (pathname === "/api/collections" && method === "GET") {
    return send(res, 200, { ok: true, data: listCollections() });
  }

  if (parts[0] === "api" && parts[1] === "collections" && parts[2] && method === "GET") {
    return send(res, 200, { ok: true, data: getCollection(parts[2], url.searchParams) });
  }

  if (pathname === "/api/alwaseet/lookups" && method === "GET") {
    const cityId = Number(url.searchParams.get("cityId") || 0);
    const lookups = await loadAlwaseetPublicLookups(Number.isFinite(cityId) && cityId > 0 ? cityId : undefined);
    return send(res, 200, { ok: true, data: lookups });
  }

  if (pathname === "/api/auth/oauth/providers" && method === "GET") {
    return send(res, 200, { ok: true, data: getOAuthProviderStatus(process.env) });
  }

  if (parts[0] === "api" && parts[1] === "auth" && parts[2] === "oauth" && parts[3] && parts[4] === "start" && method === "GET") {
    const provider = parts[3];
    const config = getOAuthProviderConfig(provider, process.env, getPublicBaseUrl(req));
    if (!config) throw new ApiError(503, "provider_not_configured", "This sign-in provider is not configured yet.");
    const state = createOAuthState({
      provider,
      redirectTo: url.searchParams.get("redirectTo") || url.searchParams.get("returnTo") || "/account",
      secret: JWT_SECRET,
    });
    setOAuthStateCookie(res, state.cookieValue);
    redirect(res, buildOAuthAuthorizationUrl(config, state));
    return;
  }

  if (parts[0] === "api" && parts[1] === "auth" && parts[2] === "oauth" && parts[3] && parts[4] === "callback" && ["GET", "POST"].includes(method)) {
    const provider = parts[3];
    const params = method === "POST" ? await readFormUrlencoded(req, { maxBytes: 64_000 }) : Object.fromEntries(url.searchParams.entries());
    clearOAuthStateCookie(res);
    try {
      const { user, redirectTo } = await completeOAuthLogin(provider, params, req);
      await createSessionCookie(req, res, user);
      redirect(res, buildAuthRedirectUrl(req, "/login", "oauth_success", "", redirectTo));
      return;
    } catch (error) {
      const code = error instanceof ApiError ? error.code : error?.code || "callback_failed";
      writeAuditLog({
        req,
        action: "auth.oauth.failed",
        targetType: "oauth",
        afterState: { provider, code },
      });
      await saveDatabase();
      redirect(res, buildAuthRedirectUrl(req, "/login", "oauth_error", code));
      return;
    }
  }

  if ((pathname === "/api/auth/signup" || pathname === "/auth/signup") && method === "POST") {
    const body = await readJson(req);
    const user = await signup(body, req);
    if (!user) {
      return send(res, 202, {
        ok: true,
        data: {
          message: "If this email can be registered, a verification message will be sent.",
          emailVerificationRequired: true,
        },
      });
    }
    const token = signToken(user);
    await createSessionCookie(req, res, user);
    return send(res, 201, { ok: true, data: { user: publicUser(user), token } });
  }

  if ((pathname === "/api/auth/register" || pathname === "/auth/register") && method === "POST") {
    const body = await readJson(req);
    await register(body, req);
    return send(res, 202, {
      ok: true,
      data: {
        message: "If this email can be registered, a verification message will be sent.",
        emailVerificationRequired: true,
      },
    });
  }

  if ((pathname === "/api/auth/login" || pathname === "/auth/login") && method === "POST") {
    const body = await readJson(req);
    const user = await login(body, req);
    const token = signToken(user);
    await createSessionCookie(req, res, user);
    return send(res, 200, { ok: true, data: { user: publicUser(user), token } });
  }

  if ((pathname === "/api/auth/logout" || pathname === "/auth/logout") && method === "POST") {
    const user = optionalUser(req);
    await revokeCurrentSession(req, user?.id || null, "auth.logout");
    clearSessionCookie(res);
    await saveDatabase();
    return send(res, 200, { ok: true, data: { message: "Signed out" } });
  }

  if ((pathname === "/api/auth/reauth" || pathname === "/auth/reauth") && method === "POST") {
    const user = requireUser(req);
    const body = await readJson(req);
    await reauthenticateUser(user, body, req);
    return send(res, 200, { ok: true, data: { verified: true } });
  }

  if ((pathname === "/api/auth/verify-email" || pathname === "/auth/verify-email") && method === "POST") {
    const body = await readJson(req);
    const user = await verifyEmailToken(body.token, req);
    return send(res, 200, { ok: true, data: { user: publicUser(user), message: "Email verified" } });
  }

  if (pathname === "/api/auth/me" && method === "GET") {
    const user = requireUser(req);
    return send(res, 200, { ok: true, data: publicUser(user) });
  }

  if ((pathname === "/api/users/me" || pathname === "/api/me" || pathname === "/me") && method === "GET") {
    const user = requireUser(req);
    return send(res, 200, { ok: true, data: getCustomerAccount(user) });
  }

  if (pathname === "/api/auth/me" && method === "PATCH") {
    const user = requireUser(req);
    const body = await readJson(req);
    const updated = await updateUserProfile(user.id, body, req);
    return send(res, 200, { ok: true, data: publicUser(updated) });
  }

  if ((pathname === "/api/users/me" || pathname === "/api/me/profile" || pathname === "/me/profile") && method === "PATCH") {
    const user = requireUser(req);
    const body = await readJson(req);
    const updated = await updateUserProfile(user.id, body, req);
    return send(res, 200, { ok: true, data: getCustomerAccount(updated) });
  }

  if ((pathname === "/api/auth/password-reset" || pathname === "/auth/forgot-password") && method === "POST") {
    const body = await readJson(req);
    await requestPasswordReset(body.email, req);
    return send(res, 200, { ok: true, data: { message: "If the email exists, a reset link will be sent." } });
  }

  if ((pathname === "/api/auth/password/forgot" || pathname === "/auth/password/forgot") && method === "POST") {
    const body = await readJson(req);
    await requestPasswordReset(body.email, req);
    return send(res, 200, { ok: true, data: { message: "If the email exists, a reset link will be sent." } });
  }

  if ((pathname === "/api/auth/reset-password" || pathname === "/auth/reset-password") && method === "POST") {
    const body = await readJson(req);
    await resetPassword(body, req);
    clearSessionCookie(res);
    return send(res, 200, { ok: true, data: { message: "Password updated" } });
  }

  if ((pathname === "/api/auth/password/reset" || pathname === "/auth/password/reset") && method === "POST") {
    const body = await readJson(req);
    await resetPassword(body, req);
    clearSessionCookie(res);
    return send(res, 200, { ok: true, data: { message: "Password updated" } });
  }

  if ((pathname === "/api/auth/passkeys/register/options" || pathname === "/auth/passkeys/register/options") && method === "POST") {
    const user = requireUser(req);
    return send(res, 200, { ok: true, data: createPasskeyRegistrationOptions(user, req) });
  }

  if ((pathname === "/api/auth/passkeys/register/verify" || pathname === "/auth/passkeys/register/verify") && method === "POST") {
    throw new ApiError(501, "passkeys_not_configured", "Passkey verification needs a WebAuthn verifier package before production use.");
  }

  if ((pathname === "/api/me/passkeys" || pathname === "/me/passkeys") && method === "GET") {
    const user = requireUser(req);
    return send(res, 200, { ok: true, data: listUserPasskeys(user.id) });
  }

  if ((parts[0] === "api" && parts[1] === "me" && parts[2] === "passkeys" && parts[3] && method === "DELETE") ||
      (parts[0] === "me" && parts[1] === "passkeys" && parts[2] && method === "DELETE")) {
    const user = requireUser(req);
    const body = await readJson(req);
    const passkeyId = parts[0] === "api" ? parts[3] : parts[2];
    await revokePasskey(user.id, passkeyId, body, req);
    return send(res, 200, { ok: true, data: { revoked: true } });
  }

  if ((pathname === "/api/me/sessions" || pathname === "/me/sessions") && method === "GET") {
    const user = requireUser(req);
    return send(res, 200, { ok: true, data: listUserSessions(user.id, req) });
  }

  if ((parts[0] === "api" && parts[1] === "me" && parts[2] === "sessions" && parts[3] && method === "DELETE") ||
      (parts[0] === "me" && parts[1] === "sessions" && parts[2] && method === "DELETE")) {
    const user = requireUser(req);
    const sessionId = parts[0] === "api" ? parts[3] : parts[2];
    await revokeSessionById(user.id, sessionId, req);
    return send(res, 200, { ok: true, data: { revoked: true } });
  }

  if (pathname === "/api/cart" && method === "GET") {
    const user = requireUser(req);
    return send(res, 200, { ok: true, data: getCart(user.id) });
  }

  if (pathname === "/api/cart" && method === "PUT") {
    const user = requireUser(req);
    const body = await readJson(req);
    const cart = await setCart(user.id, body.items || [], body.couponCode || null);
    return send(res, 200, { ok: true, data: cart });
  }

  if (pathname === "/api/coupons/validate" && method === "POST") {
    const body = await readJson(req);
    const items = Array.isArray(body.items) ? normalizeCartItems(body.items) : [];
    const subtotal = body.subtotal !== undefined
      ? Number(body.subtotal || 0)
      : items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const validation = validateCoupon(body.code, subtotal);
    return send(res, 200, { ok: true, data: validation });
  }

  if (pathname === "/api/orders" && method === "POST") {
    const user = optionalUser(req);
    const body = await readJson(req);
    const order = await createOrder(body, user);
    return send(res, 201, { ok: true, data: order });
  }

  if (pathname === "/api/orders" && method === "GET") {
    const user = requireUser(req);
    const orders = getOrdersForUser(user, url.searchParams);
    return send(res, 200, { ok: true, data: paginate(orders, url.searchParams) });
  }

  if (parts[0] === "api" && parts[1] === "orders" && parts[2] && method === "GET") {
    const user = requireUser(req);
    const order = getOrderForUser(user, parts[2]);
    return send(res, 200, { ok: true, data: order });
  }

  if ((pathname === "/api/addresses" || pathname === "/api/me/addresses" || pathname === "/me/addresses") && method === "GET") {
    const user = requireUser(req);
    return send(res, 200, { ok: true, data: listUserAddresses(user.id) });
  }

  if ((pathname === "/api/addresses" || pathname === "/api/me/addresses" || pathname === "/me/addresses") && method === "POST") {
    const user = requireUser(req);
    const body = await readJson(req);
    const address = await createAddress(user.id, body, req);
    return send(res, 201, { ok: true, data: address });
  }

  if ((parts[0] === "api" && parts[1] === "addresses" && parts[2] && method === "PATCH") ||
      (parts[0] === "api" && parts[1] === "me" && parts[2] === "addresses" && parts[3] && method === "PATCH") ||
      (parts[0] === "me" && parts[1] === "addresses" && parts[2] && method === "PATCH")) {
    const user = requireUser(req);
    const body = await readJson(req);
    const addressId = parts[1] === "addresses" ? parts[2] : parts[0] === "api" ? parts[3] : parts[2];
    const address = await updateAddress(user.id, addressId, body, req);
    return send(res, 200, { ok: true, data: address });
  }

  if ((parts[0] === "api" && parts[1] === "addresses" && parts[2] && method === "DELETE") ||
      (parts[0] === "api" && parts[1] === "me" && parts[2] === "addresses" && parts[3] && method === "DELETE") ||
      (parts[0] === "me" && parts[1] === "addresses" && parts[2] && method === "DELETE")) {
    const user = requireUser(req);
    const addressId = parts[1] === "addresses" ? parts[2] : parts[0] === "api" ? parts[3] : parts[2];
    await deleteAddress(user.id, addressId, req);
    return send(res, 200, { ok: true, data: { deleted: true } });
  }

  if (parts[0] === "api" && parts[1] === "admin") {
    const admin = requireAdmin(req);
    return handleAdminRoute(req, res, url, pathname, parts, admin);
  }

  if ((method === "GET" || method === "HEAD") && existsSync(DIST_DIR)) {
    return sendDistAsset(req, res, pathname);
  }

  throw new ApiError(404, "not_found", "Endpoint not found");
}

async function handleAdminRoute(req, res, url, pathname, parts, admin) {
  const method = req.method || "GET";

  if (pathname === "/api/admin/dashboard" && method === "GET") {
    const totalRevenue = db.orders
      .filter((order) => order.status !== "cancelled")
      .reduce((sum, order) => sum + order.total, 0);
    const pendingOrders = db.orders.filter((order) => order.status === "pending").length;
    const activeUsers = db.users.filter((user) => !user.banned).length;
    const lowStock = db.products.filter((product) => product.stock <= 2).length;
    const recentOrders = [...db.orders].sort(byCreatedDesc).slice(0, 8);

    return send(res, 200, {
      ok: true,
      data: {
        totalRevenue,
        pendingOrders,
        activeUsers,
        lowStock,
        productCount: db.products.length,
        orderCount: db.orders.length,
        recentOrders,
      },
    });
  }

  if (pathname === "/api/admin/production-readiness" && method === "GET") {
    return send(res, 200, {
      ok: true,
      data: buildProductionReadinessReport(db),
    });
  }

  if (pathname === "/api/admin/users" && method === "GET") {
    const query = (url.searchParams.get("q") || "").trim().toLowerCase();
    let users = db.users.map((user) => ({
      ...publicUser(user),
      ordersCount: db.orders.filter((order) => order.customerId === user.id).length,
      totalSpent: db.orders
        .filter((order) => order.customerId === user.id && order.status !== "cancelled")
        .reduce((sum, order) => sum + order.total, 0),
    }));
    if (query) {
      users = users.filter((user) =>
        [user.email, user.fullName, user.phone].filter(Boolean).some((value) => String(value).toLowerCase().includes(query)),
      );
    }
    return send(res, 200, { ok: true, data: paginate(users, url.searchParams) });
  }

  if (parts[2] === "users" && parts[3] && method === "GET") {
    const user = db.users.find((item) => item.id === parts[3]);
    if (!user) throw new ApiError(404, "not_found", "User not found");
    const orders = db.orders.filter((order) => order.customerId === user.id);
    return send(res, 200, {
      ok: true,
      data: {
        ...publicUser(user),
        ordersCount: orders.length,
        totalSpent: orders.filter((order) => order.status !== "cancelled").reduce((sum, order) => sum + order.total, 0),
        sessions: db.userSessions
          .filter((session) => session.userId === user.id)
          .map((session) => ({
            id: session.id,
            createdAt: session.createdAt,
            lastSeenAt: session.lastSeenAt,
            expiresAt: session.expiresAt,
            revokedAt: session.revokedAt,
            userAgent: session.userAgent,
          })),
      },
    });
  }

  if (parts[2] === "users" && parts[3] && method === "PATCH") {
    const body = await readJson(req);
    const user = db.users.find((item) => item.id === parts[3]);
    if (!user) throw new ApiError(404, "not_found", "User not found");
    const before = publicUser(user);
    if (typeof body.banned === "boolean") user.banned = body.banned;
    if (body.status && ["active", "unverified", "disabled", "deleted"].includes(body.status)) {
      user.status = body.status;
      user.banned = body.status === "disabled" || body.status === "deleted";
    }
    if (body.role !== undefined) {
      if (admin.role !== "super_admin") {
        throw new ApiError(403, "forbidden", "Only a super admin can change user roles");
      }
      if (!["admin", "customer", "super_admin"].includes(body.role)) {
        throw new ApiError(400, "validation_error", "Invalid user role");
      }
      user.role = body.role;
    }
    if (typeof body.emailVerified === "boolean") {
      if (admin.role !== "super_admin") {
        throw new ApiError(403, "forbidden", "Only a super admin can verify users manually");
      }
      user.emailVerified = body.emailVerified;
    }
    user.updatedAt = new Date().toISOString();
    writeAuditLog({
      req,
      actorUserId: admin?.id || null,
      action: "admin.user.updated",
      targetType: "user",
      targetId: user.id,
      beforeState: before,
      afterState: publicUser(user),
    });
    await saveDatabase();
    return send(res, 200, { ok: true, data: publicUser(user) });
  }

  if (pathname === "/api/admin/orders" && method === "GET") {
    const orders = getOrdersForAdmin(url.searchParams);
    return send(res, 200, { ok: true, data: paginate(orders, url.searchParams) });
  }

  if (parts[2] === "orders" && parts[3] && !parts[4] && method === "GET") {
    const order = db.orders.find((item) => item.id === parts[3] || item.number === parts[3]);
    if (!order) throw new ApiError(404, "not_found", "Order not found");
    return send(res, 200, { ok: true, data: order });
  }

  if (parts[2] === "orders" && parts[3] && parts[4] === "status" && method === "PATCH") {
    const body = await readJson(req);
    const status = requireString(body.status, "status");
    if (!ORDER_STATUSES.has(status)) throw new ApiError(400, "validation_error", "Invalid order status");
    const order = db.orders.find((item) => item.id === parts[3] || item.number === parts[3]);
    if (!order) throw new ApiError(404, "not_found", "Order not found");
    order.status = status;
    order.updatedAt = new Date().toISOString();
    order.timeline.push({ status, at: order.updatedAt, note: body.note || `Status changed to ${status}` });
    await saveDatabase();
    return send(res, 200, { ok: true, data: order });
  }

  if (pathname === "/api/admin/products" && method === "GET") {
    const result = paginate(filterProducts(db.products, url.searchParams, { includeUnpublished: true }), url.searchParams);
    return send(res, 200, { ok: true, data: result });
  }

  if (pathname === "/api/admin/products" && method === "POST") {
    const body = await readJson(req);
    const product = await createProduct(body);
    return send(res, 201, { ok: true, data: product });
  }

  if (pathname === "/api/admin/import/products" && method === "POST") {
    const body = await readJson(req, { maxBytes: 1_000_000 });
    const result = createImportProductJob(db, body, {
      actorUserId: admin?.id || null,
      requestId: getRequestId(req),
    });
    writeAuditLog({
      req,
      actorUserId: admin?.id || null,
      action: "product.import.previewed",
      targetType: "import_job",
      targetId: result.job.id,
      beforeState: null,
      afterState: { jobId: result.job.id, itemCount: result.items.length },
    });
    await saveDatabase();
    return send(res, 202, { ok: true, data: result });
  }

  if (
    (pathname === "/api/admin/import/woocommerce/analyze" ||
      pathname === "/api/admin/products/import/woocommerce/analyze") &&
    method === "POST"
  ) {
    const body = await readJson(req, { maxBytes: 24_000_000 });
    const csvText = await readWooCommerceImportCsv(body);
    const report = analyzeWooCommerceCsv(csvText, db.products, {
      existingCategories: db.categories.map((category) => category.slug || category.id || category),
    });
    const job = {
      id: `woo_import_${crypto.randomUUID()}`,
      version: WOOCOMMERCE_IMPORT_VERSION,
      mode: "woocommerce_csv_dry_run",
      input: body.filePath || body.file_path || "inline_csv",
      sourceUrl: "",
      status: "dry_run_completed",
      productId: null,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      summary: report.summary,
    };
    upsertImportJob(job);
    report.preview.slice(0, 500).forEach((item) => {
      upsertImportJobItem({
        id: `woo_import_item_${job.id}_${item.rowNumber}`,
        jobId: job.id,
        productId: item.currentProductMatch?.id || null,
        status: item.action === "review" ? "needs_review" : "previewed",
        action: item.action,
        errors: item.warnings,
        data: item,
      });
    });
    recordImportEvent({
      jobId: job.id,
      action: "woocommerce_dry_run_completed",
      message: "WooCommerce CSV dry-run completed without mutating products.",
      data: report.summary,
    });
    writeAuditLog({
      req,
      actorUserId: admin?.id || null,
      action: "woocommerce_import.dry_run_completed",
      targetType: "import_job",
      targetId: job.id,
      beforeState: null,
      afterState: {
        totalRows: report.summary.total_rows,
        create: report.summary.new_products,
        update: report.summary.products_to_update,
        review: report.summary.products_needing_review,
      },
    });
    await saveDatabase();
    return send(res, 200, { ok: true, data: { job, report } });
  }

  if (
    (pathname === "/api/admin/import/woocommerce/apply" ||
      pathname === "/api/admin/products/import/woocommerce/apply") &&
    method === "POST"
  ) {
    const body = await readJson(req, { maxBytes: 200_000 });
    if (body.confirm !== true) {
      return send(res, 200, {
        ok: true,
        data: {
          mode: "plan_only",
          message: "Run dry-run first, review conflicts, then send confirm=true with selected row ids. No products were changed.",
          supportedModes: [
            "apply_all_safe_changes",
            "apply_selected_rows",
            "update_existing_only",
            "create_new_only",
            "import_images_only",
            "import_description_media_only",
            "import_prices_availability_only",
          ],
        },
      });
    }
    throw new ApiError(
      409,
      "apply_requires_review",
      "WooCommerce apply is intentionally blocked until a reviewed dry-run selection is supplied. No products were changed.",
    );
  }

  if (
    (pathname === "/api/admin/products/enrichment/dry-run" ||
      pathname === "/api/admin/products/enrich/dry-run") &&
    method === "POST"
  ) {
    const body = await readJson(req, { maxBytes: 4_000_000 });
    const report = createProductWebEnrichmentDryRun(db, body, {
      actorUserId: admin?.id || null,
      requestId: getRequestId(req),
    });
    await saveDatabase();
    return send(res, 200, { ok: true, data: report });
  }

  if (
    (pathname === "/api/admin/products/enrichment/apply" ||
      pathname === "/api/admin/products/enrich/apply") &&
    method === "POST"
  ) {
    const body = await readJson(req, { maxBytes: 4_000_000 });
    const result = applyProductWebEnrichment(db, body, {
      actorUserId: admin?.id || null,
      requestId: getRequestId(req),
    });
    await saveDatabase();
    return send(res, 200, { ok: true, data: result });
  }

  if (parts[2] === "products" && parts[3] && !parts[4] && method === "GET") {
    const product = findProduct(parts[3]);
    if (!product) throw new ApiError(404, "not_found", "Product not found");
    const details = serializeProductPlatformProduct(db, product);
    return send(res, 200, { ok: true, data: details });
  }

  if (
    parts[2] === "products" &&
    parts[3] &&
    ["publish", "unpublish", "schedule"].includes(parts[4]) &&
    method === "POST"
  ) {
    const body = await readJson(req, { maxBytes: 100_000 });
    const result = applyProductLifecycle(db, parts[3], parts[4], {
      actorUserId: admin?.id || null,
      requestId: getRequestId(req),
      scheduledAt: body.scheduledAt || body.scheduleAt || body.publishAt || null,
    });
    writeAuditLog({
      req,
      actorUserId: admin?.id || null,
      action: `product.lifecycle.${parts[4]}`,
      targetType: "product",
      targetId: result.product.id,
      beforeState: null,
      afterState: {
        lifecycle: result.lifecycle,
        version: result.product.version,
        scheduledAt: result.product.scheduledAt || null,
      },
    });
    await saveDatabase();
    return send(res, 200, { ok: true, data: result });
  }

  if (pathname === "/api/admin/products/classification/review" && method === "GET") {
    const result = getClassificationReviewQueue(url.searchParams);
    return send(res, 200, { ok: true, data: result });
  }

  if (pathname === "/api/admin/products/classification/preview" && method === "POST") {
    const body = await readJson(req);
    const preview = await buildAdminClassificationPreview({ ...body, dry_run: true });
    return send(res, 200, { ok: true, data: preview });
  }

  if (pathname === "/api/admin/products/classification/apply" && method === "POST") {
    const body = await readJson(req);
    const result = await applyAdminClassification(body);
    return send(res, 200, { ok: true, data: result });
  }

  if (pathname === "/api/admin/products/bulk/preview" && method === "POST") {
    const body = await readJson(req);
    const preview = buildAdminBulkPreview(body);
    return send(res, 200, { ok: true, data: preview });
  }

  if (pathname === "/api/admin/products/bulk/reclassify" && method === "POST") {
    const body = await readJson(req);
    const preview = buildAdminBulkPreview({ ...body, action: "reclassify" });
    return send(res, 200, { ok: true, data: preview });
  }

  if (pathname === "/api/admin/products/bulk/normalize-images" && method === "POST") {
    const body = await readJson(req);
    const preview = buildAdminBulkPreview({ ...body, action: "normalize_images" });
    return send(res, 200, { ok: true, data: preview });
  }

  if (pathname === "/api/admin/products/bulk/apply" && method === "POST") {
    const body = await readJson(req);
    const result = await applyAdminBulkAction(body);
    return send(res, 200, { ok: true, data: result });
  }

  if (pathname === "/api/admin/products/bulk/undo" && method === "POST") {
    const body = await readJson(req);
    const result = await undoAdminBulkAction(body.log_id || body.logId);
    return send(res, 200, { ok: true, data: result });
  }

  if (pathname === "/api/admin/products/media" && method === "POST") {
    const body = await readJson(req, { maxBytes: 18_000_000 });
    const uploaded = await persistAdminProductMedia(body);
    return send(res, 201, { ok: true, data: uploaded });
  }

  if (pathname === "/api/admin/import-jobs" && method === "POST") {
    const body = await readJson(req, { maxBytes: 1_000_000 });
    const productId = String(body.productId || body.product_id || "").trim();
    const job = buildImportMediaJob({
      productId: productId || null,
      mode: body.action || "media_import",
      input: body.input || body.sourceUrl || null,
      sourceUrl: body.sourceUrl || null,
      idempotencyKey: body.idempotencyKey || body.idempotency_key || null,
    });
    const candidates = collectImageCandidatesFromSources(body, {
      productId: productId || null,
      importJobId: job.id,
      sourceType: body.sourceType || body.source_type || "retailer",
      sourceUrl: body.sourceUrl || body.source_url || "",
    });
    upsertImportJob(job);
    recordImportEvent({
      jobId: job.id,
      productId: productId || null,
      action: "job_started",
      message: "Media import job started",
      data: { candidateCount: candidates.length },
    });
    if (productId) {
      const result = await recomputeProductMedia(productId, {
        job,
        candidates,
        imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls : Array.isArray(body.urls) ? body.urls : [],
      });
      await saveDatabase();
      return send(res, 201, { ok: true, data: result });
    }
    job.status = "queued";
    job.updatedAt = new Date().toISOString();
    upsertImportJob(job);
    await saveDatabase();
    return send(res, 201, { ok: true, data: { job } });
  }

  if (parts[2] === "import-jobs" && parts[3] && method === "GET") {
    return send(res, 200, { ok: true, data: serializeImportJob(parts[3]) });
  }

  if (parts[2] === "products" && parts[3] && parts[4] === "media" && !parts[5] && method === "GET") {
    return send(res, 200, { ok: true, data: { productId: parts[3], media: getProductMedia(parts[3]) } });
  }

  if (parts[2] === "products" && parts[3] && parts[4] === "media" && parts[5] === "recompute" && method === "POST") {
    const body = await readJson(req, { maxBytes: 1_000_000 });
    const job = buildImportMediaJob({
      productId: parts[3],
      mode: "media_recompute",
      input: body.input || body.sourceUrl || null,
      sourceUrl: body.sourceUrl || body.source_url || null,
      idempotencyKey: body.idempotencyKey || body.idempotency_key || null,
    });
    const result = await recomputeProductMedia(parts[3], {
      job,
      candidates: collectImageCandidatesFromSources(body, {
        productId: parts[3],
        importJobId: job.id,
        sourceType: body.sourceType || body.source_type || "retailer",
        sourceUrl: body.sourceUrl || body.source_url || "",
      }),
      imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls : Array.isArray(body.urls) ? body.urls : [],
    });
    await saveDatabase();
    return send(res, 200, { ok: true, data: result });
  }

  if (parts[2] === "products" && parts[3] && parts[4] === "media" && parts[5] && method === "PATCH") {
    const body = await readJson(req, { maxBytes: 100_000 });
    const updated = patchProductMedia(parts[3], parts[5], body);
    await saveDatabase();
    return send(res, 200, { ok: true, data: updated });
  }

  if (pathname === "/api/admin/products/import/jobs" && method === "GET") {
    return send(res, 200, { ok: true, data: serializeImportJobLogs(url.searchParams) });
  }

  if (pathname === "/api/admin/products/review-tasks" && method === "GET") {
    return send(res, 200, { ok: true, data: serializeReviewTasks(url.searchParams) });
  }

  if (pathname === "/api/admin/products/import" && method === "POST") {
    const body = await readJson(req);
    const job = buildImportJobRecord({ mode: "url", input: body.url, sourceUrl: body.url });
    upsertImportJobLog(job);
    try {
      const imported = await importProductFromUrl(body.url, { force: body.force === true });
      const finalized = await finalizeImportPipelineDraft(imported, job, { rawInput: body.url, force: body.force === true });
      const existingProduct = findExistingProductMatch({
        sourceUrl: finalized.sourceUrl,
        brand: finalized.brand,
        nameEn: finalized.nameEn,
        category: finalized.category,
      });
      await saveDatabase();
      return send(res, 200, {
        ok: true,
        data: {
          draft: finalized,
          existingProduct: existingProduct ? serializeImportProductMatch(existingProduct) : null,
        },
      });
    } catch (error) {
      upsertImportJobLog(failImportJobRecord(job, error));
      await saveDatabase();
      throw error;
    }
  }

  if (pathname === "/api/admin/products/discover" && method === "POST") {
    const body = await readJson(req);
    const job = buildImportJobRecord({ mode: "query", input: body.query });
    upsertImportJobLog(job);
    try {
      const imported = await discoverProductFromQuery(body.query);
      const draft = imported?.draft ? imported.draft : imported;
      const finalized = await finalizeImportPipelineDraft(draft, job, { rawInput: body.query, force: body.force === true });
      const payload = imported?.draft ? { ...imported, draft: finalized } : finalized;
      await saveDatabase();
      return send(res, 200, { ok: true, data: payload });
    } catch (error) {
      upsertImportJobLog(failImportJobRecord(job, error));
      await saveDatabase();
      throw error;
    }
  }

  if (parts[2] === "products" && parts[3] && parts[4] === "duplicate" && method === "POST") {
    const body = await readJson(req);
    const product = await duplicateProduct(parts[3], body, admin);
    return send(res, 201, { ok: true, data: product });
  }

  if (parts[2] === "products" && parts[3] && method === "PATCH") {
    const body = await readJson(req);
    const product = await updateProduct(parts[3], body);
    return send(res, 200, { ok: true, data: product });
  }

  if (parts[2] === "products" && parts[3] && method === "DELETE") {
    const index = db.products.findIndex((product) => product.id === parts[3] || product.slug === parts[3]);
    if (index === -1) throw new ApiError(404, "not_found", "Product not found");
    const deletedId = db.products[index].id;
    db.products.splice(index, 1);
    db.categoryAssignments = (db.categoryAssignments || []).filter((assignment) => assignment.productId !== deletedId);
    db.reviewTasks = (db.reviewTasks || []).filter((task) => task.productId !== deletedId);
    const deletedVariantIds = new Set((db.productVariants || []).filter((variant) => variant.productId === deletedId).map((variant) => variant.id));
    db.productVariants = (db.productVariants || []).filter((variant) => variant.productId !== deletedId);
    db.variantPrices = (db.variantPrices || []).filter((price) => !deletedVariantIds.has(price.variantId));
    db.inventoryLevels = (db.inventoryLevels || []).filter((level) => !deletedVariantIds.has(level.variantId));
    db.productChannelListings = (db.productChannelListings || []).filter((listing) => listing.productId !== deletedId);
    db.productMedia = (db.productMedia || []).filter((media) => media.productId !== deletedId);
    db.searchIndexDocuments = (db.searchIndexDocuments || []).filter((document) => document.productId !== deletedId);
    db.meta.updatedAt = new Date().toISOString();
    await saveDatabase();
    return send(res, 200, { ok: true, data: { deleted: true } });
  }

  if (pathname === "/api/admin/coupons" && method === "GET") {
    return send(res, 200, { ok: true, data: db.coupons });
  }

  if (pathname === "/api/admin/coupons" && method === "POST") {
    const body = await readJson(req);
    const coupon = await createCoupon(body);
    return send(res, 201, { ok: true, data: coupon });
  }

  if (parts[2] === "coupons" && parts[3] && method === "PATCH") {
    const body = await readJson(req);
    const coupon = await updateCoupon(parts[3], body);
    return send(res, 200, { ok: true, data: coupon });
  }

  if (parts[2] === "coupons" && parts[3] && method === "DELETE") {
    const deleted = await deleteCoupon(parts[3]);
    return send(res, 200, { ok: true, data: deleted });
  }

  throw new ApiError(404, "not_found", "Admin endpoint not found");
}

async function loadDatabase() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(IMPORT_MEDIA_DIR, { recursive: true });
  try {
    await stat(DB_FILE);
    const contents = await readFile(DB_FILE, "utf8");
    const existing = JSON.parse(contents);
    return migrateDatabase(existing);
  } catch (error) {
    if (error && error.code !== "ENOENT") throw error;
    const seeded = await createSeedDatabase();
    await writeFile(DB_FILE, JSON.stringify(seeded, null, 2));
    return seeded;
  }
}

function migrateDatabase(existing) {
  const next = {
    meta: { version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...(existing.meta || {}) },
    products: Array.isArray(existing.products) ? existing.products : [],
    categories: Array.isArray(existing.categories) ? existing.categories : [],
    coupons: Array.isArray(existing.coupons) ? existing.coupons : seedCoupons,
    users: Array.isArray(existing.users) ? existing.users : [],
    userEmails: Array.isArray(existing.userEmails) ? existing.userEmails : [],
    authPasswords: Array.isArray(existing.authPasswords) ? existing.authPasswords : [],
    authPasskeys: Array.isArray(existing.authPasskeys) ? existing.authPasskeys : [],
    passkeyChallenges: Array.isArray(existing.passkeyChallenges) ? existing.passkeyChallenges : [],
    customerProfiles: Array.isArray(existing.customerProfiles) ? existing.customerProfiles : [],
    addresses: Array.isArray(existing.addresses) ? existing.addresses : [],
    customerAddresses: Array.isArray(existing.customerAddresses)
      ? existing.customerAddresses
      : Array.isArray(existing.userAddresses)
        ? existing.userAddresses
        : Array.isArray(existing.addresses)
          ? existing.addresses
          : [],
    userAddresses: Array.isArray(existing.userAddresses) ? existing.userAddresses : [],
    userPreferences: Array.isArray(existing.userPreferences) ? existing.userPreferences : [],
    userConsents: Array.isArray(existing.userConsents) ? existing.userConsents : [],
    userSessions: Array.isArray(existing.userSessions) ? existing.userSessions : [],
    authIdentities: Array.isArray(existing.authIdentities) ? existing.authIdentities : [],
    emailVerificationTokens: Array.isArray(existing.emailVerificationTokens) ? existing.emailVerificationTokens : [],
    passwordResetTokens: Array.isArray(existing.passwordResetTokens) ? existing.passwordResetTokens : [],
    auditLogs: Array.isArray(existing.auditLogs) ? existing.auditLogs : [],
    auditEvents: Array.isArray(existing.auditEvents) ? existing.auditEvents : [],
    emailOutbox: Array.isArray(existing.emailOutbox) ? existing.emailOutbox : [],
    carts: existing.carts && typeof existing.carts === "object" ? existing.carts : {},
    orders: Array.isArray(existing.orders) ? existing.orders : [],
    bulkActionLogs: Array.isArray(existing.bulkActionLogs) ? existing.bulkActionLogs : [],
    categoryAssignments: Array.isArray(existing.categoryAssignments) ? existing.categoryAssignments : [],
    importJobLogs: Array.isArray(existing.importJobLogs) ? existing.importJobLogs : [],
    reviewTasks: Array.isArray(existing.reviewTasks) ? existing.reviewTasks : [],
    importJobs: Array.isArray(existing.importJobs) ? existing.importJobs : [],
    importJobItems: Array.isArray(existing.importJobItems) ? existing.importJobItems : [],
    assetCandidates: Array.isArray(existing.assetCandidates) ? existing.assetCandidates : [],
    mediaAssets: Array.isArray(existing.mediaAssets) ? existing.mediaAssets : [],
    productMedia: Array.isArray(existing.productMedia) ? existing.productMedia : [],
    importEvents: Array.isArray(existing.importEvents) ? existing.importEvents : [],
    productVariants: Array.isArray(existing.productVariants) ? existing.productVariants : [],
    variantPrices: Array.isArray(existing.variantPrices) ? existing.variantPrices : [],
    inventoryLocations: Array.isArray(existing.inventoryLocations) ? existing.inventoryLocations : [],
    inventoryLevels: Array.isArray(existing.inventoryLevels) ? existing.inventoryLevels : [],
    productChannelListings: Array.isArray(existing.productChannelListings) ? existing.productChannelListings : [],
    productRevisions: Array.isArray(existing.productRevisions) ? existing.productRevisions : [],
    approvalRequests: Array.isArray(existing.approvalRequests) ? existing.approvalRequests : [],
    outboxEvents: Array.isArray(existing.outboxEvents) ? existing.outboxEvents : [],
    searchIndexDocuments: Array.isArray(existing.searchIndexDocuments) ? existing.searchIndexDocuments : [],
    inventoryMovements: Array.isArray(existing.inventoryMovements) ? existing.inventoryMovements : [],
  };

  for (const product of next.products) {
    product.stock = Number.isFinite(Number(product.stock)) ? Number(product.stock) : product.inStock ? 8 : 0;
    product.sales = Number.isFinite(Number(product.sales)) ? Number(product.sales) : 0;
    product.sourceUrl = product.sourceUrl || "";
    product.createdAt = product.createdAt || new Date().toISOString();
    product.updatedAt = product.updatedAt || product.createdAt;
    product.storedBadge = product.storedBadge || product.badge || null;
    product.badge = product.storedBadge;
    const mergedSpecs = mergeSpecs(
      Array.isArray(product.specs) ? product.specs : [],
      extractSpecsFromTextBlock(product.tagline?.en || ""),
    );
    const cleanFeatures = cleanFeatureCandidates(Array.isArray(product.features) ? product.features : []);
    const normalizedCurrent = normalizeCommercialPricePair({
      iqd: Number.isFinite(Number(product.price)) ? Number(product.price) : null,
      usd: Number.isFinite(Number(product.priceUsd)) ? Number(product.priceUsd) : null,
    });
    const normalizedOfficial = normalizeCommercialPricePair({
      iqd:
        Number.isFinite(Number(product.officialPrice))
          ? Number(product.officialPrice)
          : Number.isFinite(Number(product.compareAt))
            ? Number(product.compareAt)
            : null,
      usd:
        Number.isFinite(Number(product.officialPriceUsd))
          ? Number(product.officialPriceUsd)
          : Number.isFinite(Number(product.compareAtUsd))
            ? Number(product.compareAtUsd)
            : null,
    });
    product.tagline = {
      en: selectDisplayDescription({
        tagline: product.tagline?.en || "",
        features: cleanFeatures,
        specs: mergedSpecs,
      }),
      ar: isSpecLikeText(product.tagline?.ar || "") ? "" : String(product.tagline?.ar || "").trim(),
    };
    product.features = cleanFeatures;
    product.specs = mergedSpecs;
    product.price = applyNineEndingPricing(normalizedCurrent.iqd || 0);
    product.priceUsd = normalizedCurrent.usd;
    product.officialPrice = normalizedOfficial.iqd;
    product.compareAt = normalizedOfficial.iqd;
    product.officialPriceUsd = normalizedOfficial.usd;
    product.compareAtUsd = normalizedOfficial.usd;
    product.availabilityStatus =
      product.availabilityStatus ||
      (product.inStock ? "in_stock" : "out_of_stock");
    product.status = product.status || (product.availabilityStatus === "hidden" ? "hidden" : "published");
    product.tags = Array.isArray(product.tags) ? product.tags : [];
    product.needsReview = Boolean(product.needsReview);
    product.confidenceScore = optionalConfidence(product.confidenceScore);
    product.lastBulkActionAt = product.lastBulkActionAt || null;
    product.normalizedImageUrl = product.normalizedImageUrl || "";
    product.seo = product.seo && typeof product.seo === "object" ? product.seo : {};
    product.imageProcessing = product.imageProcessing && typeof product.imageProcessing === "object" ? product.imageProcessing : null;
    product.importState =
      product.importState && typeof product.importState === "object"
        ? {
            status: product.importState.status || "ready",
            lastJobId: product.importState.lastJobId || null,
            error: product.importState.error || null,
            reviewedAt: product.importState.reviewedAt || null,
          }
        : { status: "ready", lastJobId: null, error: null, reviewedAt: null };
    product.importEvidence = Array.isArray(product.importEvidence) ? product.importEvidence : [];
    product.acceptedClassificationAt = product.acceptedClassificationAt || null;
    const assignment =
      product.categoryAssignment && typeof product.categoryAssignment === "object"
        ? normalizeCategoryAssignment(product.id, {
            primary_category_slug: product.categoryAssignment.primaryCategorySlug || product.categoryAssignment.primary_category_slug || product.category,
            secondary_category_slugs:
              product.categoryAssignment.secondaryCategorySlugs ||
              product.categoryAssignment.secondary_category_slugs ||
              product.subCategories ||
              [],
            dynamic_collection_slugs:
              product.categoryAssignment.dynamicCollectionSlugs ||
              product.categoryAssignment.dynamic_collection_slugs ||
              [],
            confidence_score: product.categoryAssignment.confidenceScore ?? product.categoryAssignment.confidence_score ?? product.confidenceScore ?? 0,
            needs_review: product.categoryAssignment.needsReview ?? product.categoryAssignment.needs_review ?? product.needsReview,
            classification_reason:
              product.categoryAssignment.classificationReason ||
              product.categoryAssignment.classification_reason ||
              "Preserved existing category assignment during migration.",
            evidence: product.categoryAssignment.evidence || [],
          }, product.categoryAssignment.updatedAt || product.updatedAt)
        : normalizeCategoryAssignment(product.id, classifyProductForCatalog(product, { now: product.updatedAt }), product.updatedAt);
    product.categoryAssignment = assignment;
    product.needsReview = Boolean(product.needsReview || assignment.needsReview);
    product.confidenceScore = optionalConfidence(product.confidenceScore) ?? assignment.confidenceScore;
  }

  next.categoryAssignments = upsertCategoryAssignments(next.categoryAssignments, next.products.map((product) => product.categoryAssignment));
  backfillProductPlatform(next, { now: next.meta.updatedAt || new Date().toISOString() });

  for (const user of next.users) {
    normalizeUserRecord(user);
    ensureAccountRelations(next, user);
  }

  next.customerAddresses = next.customerAddresses.map(normalizeCustomerAddress).filter(Boolean);
  next.addresses = next.customerAddresses;
  next.userAddresses = next.customerAddresses;
  next.userSessions = next.userSessions.map(normalizeSessionRecord).filter(Boolean);
  next.emailVerificationTokens = next.emailVerificationTokens.map(normalizeAuthTokenRecord).filter(Boolean);
  next.passwordResetTokens = next.passwordResetTokens.map(normalizeAuthTokenRecord).filter(Boolean);
  next.auditLogs = next.auditLogs.filter((item) => item?.id && item?.action && item?.createdAt);
  next.auditEvents = next.auditLogs;

  return next;
}

async function createSeedDatabase() {
  const catalog = await loadFrontendCatalog();
  const now = Date.now();
  const products = catalog.products.map((product, index) => normalizeProduct(product, index, now));
  products.forEach((product) => {
    product.categoryAssignment = normalizeCategoryAssignment(
      product.id,
      classifyProductForCatalog(product, { now: product.updatedAt }),
      product.updatedAt,
    );
    product.needsReview = Boolean(product.needsReview || product.categoryAssignment.needsReview);
    product.confidenceScore = product.confidenceScore ?? product.categoryAssignment.confidenceScore;
  });
  const adminUser = createSeedUser({
    id: "usr_admin",
    email: "admin@edio.iq",
    fullName: "EDIO Admin",
    role: "admin",
    password: "admin123",
    createdAt: new Date(now - 90 * 86400000).toISOString(),
  });
  const customerUser = createSeedUser({
    id: "usr_customer",
    email: "customer@edio.iq",
    fullName: "EDIO Customer",
    role: "customer",
    password: "customer123",
    phone: "+9647702046674",
    createdAt: new Date(now - 30 * 86400000).toISOString(),
  });
  const sampleOrders = createSampleOrders(products, customerUser.id, now);

  const seeded = {
    meta: {
      version: 1,
      source: "src/data/catalog.ts",
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      currencyRate: { IQD_PER_USD },
    },
    products,
    categories: catalog.categories.map((category) => ({ ...category, productCount: 0 })),
    coupons: seedCoupons,
    users: [adminUser, customerUser],
    userEmails: [],
    authPasswords: [],
    authPasskeys: [],
    passkeyChallenges: [],
    customerProfiles: [],
    customerAddresses: [
      {
        id: "adr_iraq_mosul",
        userId: customerUser.id,
        label: "Home",
        fullName: customerUser.fullName,
        phone: customerUser.phone,
        line1: "Mosul, Iraq",
        city: "Mosul",
        governorate: "Nineveh",
        notes: "Default demo address",
        isDefault: true,
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString(),
      },
    ],
    addresses: [],
    userAddresses: [],
    userConsents: [],
    carts: {},
    orders: sampleOrders,
    bulkActionLogs: [],
    categoryAssignments: products.map((product) =>
      normalizeCategoryAssignment(product.id, classifyProductForCatalog(product, { now: product.updatedAt }), product.updatedAt),
    ),
    importJobLogs: [],
    reviewTasks: [],
    userPreferences: [],
    userSessions: [],
    authIdentities: [],
    emailVerificationTokens: [],
    passwordResetTokens: [],
    auditLogs: [],
    auditEvents: [],
    emailOutbox: [],
    importJobs: [],
    importJobItems: [],
    assetCandidates: [],
    mediaAssets: [],
    productMedia: [],
    importEvents: [],
    productVariants: [],
    variantPrices: [],
    inventoryLocations: [],
    inventoryLevels: [],
    productChannelListings: [],
    productRevisions: [],
    approvalRequests: [],
    outboxEvents: [],
    searchIndexDocuments: [],
    inventoryMovements: [],
  };
  seeded.users.forEach((user) => ensureAccountRelations(seeded, user));
  seeded.addresses = seeded.customerAddresses;
  seeded.userAddresses = seeded.customerAddresses;
  seeded.auditEvents = seeded.auditLogs;
  ensureProductPlatformCollections(seeded, { now: new Date(now).toISOString() });
  backfillProductPlatform(seeded, { now: new Date(now).toISOString() });
  return seeded;
}

async function loadFrontendCatalog() {
  const tempDir = path.join(os.tmpdir(), `edio-catalog-${crypto.randomUUID()}`);
  await mkdir(tempDir, { recursive: true });
  const outfile = path.join(tempDir, "catalog.mjs");

  try {
    await build({
      absWorkingDir: ROOT_DIR,
      entryPoints: [path.join(SRC_DIR, "data/catalog.ts")],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile,
      logLevel: "silent",
      plugins: [frontendImportPlugin()],
    });

    const module = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
    return {
      products: Array.isArray(module.products) ? module.products : [],
      categories: Array.isArray(module.categories) ? module.categories : [],
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function frontendImportPlugin() {
  return {
    name: "edio-frontend-imports",
    setup(buildContext) {
      buildContext.onResolve({ filter: /\.(png|jpe?g|webp|svg|ico)$/i }, (args) => {
        const target = args.path.startsWith("@/")
          ? path.join(SRC_DIR, args.path.slice(2))
          : path.resolve(args.resolveDir, args.path);
        return { path: target, namespace: "asset-url" };
      });
      buildContext.onLoad({ filter: /.*/, namespace: "asset-url" }, (args) => {
        const publicPath = `/${path.relative(ROOT_DIR, args.path).split(path.sep).join("/")}`;
        return { contents: `export default ${JSON.stringify(publicPath)};`, loader: "js" };
      });
      buildContext.onResolve({ filter: /^@\// }, (args) => ({
        path: resolveSourceImport(args.path.slice(2)),
      }));
    },
  };
}

function resolveSourceImport(importPath) {
  const base = path.join(SRC_DIR, importPath);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
    path.join(base, "index.js"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return base;
}

function normalizeProduct(product, index, now) {
  const createdAt = new Date(now - index * 3600000).toISOString();
  const sales = product.badge === "best" ? 50 - (index % 12) : Math.max(0, 24 - (index % 24));
  const existingSpecs = Array.isArray(product.specs) ? product.specs : [];
  const derivedSpecs = existingSpecs.length ? [] : extractSpecsFromTextBlock(product.tagline?.en || "");
  const mergedSpecs = mergeSpecs(existingSpecs, derivedSpecs);
  const cleanFeatures = cleanFeatureCandidates(Array.isArray(product.features) ? product.features : []);
  const taglineEn = selectDisplayDescription({
    tagline: product.tagline?.en || "",
    features: cleanFeatures,
    specs: mergedSpecs,
  });
  const taglineAr = isSpecLikeText(product.tagline?.ar || "") ? "" : String(product.tagline?.ar || "").trim();
  const normalizedCurrent = normalizeCommercialPricePair({ iqd: Number(product.price || 0) || null });
  const normalizedOfficial = normalizeCommercialPricePair({ iqd: product.compareAt ? Number(product.compareAt) : null });

  return {
    id: String(product.id),
    slug: product.slug || slugify(`${product.brand}-${product.name?.en || product.id}`),
    sourceUrl: product.sourceUrl || "",
    name: product.name || { en: "Untitled product", ar: "منتج بدون اسم" },
    brand: product.brand || "EDIO",
    category: normalizeProductCategory(product),
    subCategories: Array.isArray(product.subCategories) ? product.subCategories : [],
    tagline: { en: taglineEn, ar: taglineAr },
    price: normalizedCurrent.iqd || 0,
    priceUsd: normalizedCurrent.usd,
    compareAt: normalizedOfficial.iqd,
    compareAtUsd: normalizedOfficial.usd,
    officialPrice: normalizedOfficial.iqd,
    officialPriceUsd: normalizedOfficial.usd,
    currency: "IQD",
    image: product.image || "",
    gallery: Array.isArray(product.gallery) ? product.gallery : product.image ? [product.image] : [],
    descriptionBlocks: normalizeDescriptionBlocks(product.descriptionBlocks || []),
    storedBadge: product.badge || null,
    badge: product.badge || null,
    features: cleanFeatures,
    specs: mergedSpecs,
    inStock: Boolean(product.inStock),
    stock: product.inStock ? 8 + (index % 12) : 0,
    sales,
    createdAt,
    updatedAt: createdAt,
  };
}

function isWithinNewBadgeWindow(product) {
  if (!String(product?.id || "").startsWith("prd_")) return false;
  const createdAt = new Date(product?.createdAt || 0).getTime();
  return Number.isFinite(createdAt) && Date.now() - createdAt <= NEW_BADGE_WINDOW_MS;
}

function getEffectiveBadge(product) {
  const storedBadge = product?.storedBadge ?? product?.badge ?? null;
  if (storedBadge === "preowned") return "preowned";
  if (isWithinNewBadgeWindow(product)) return "new";
  return storedBadge || null;
}

const PRODUCT_CATEGORY_ALIASES = {
  headphone: "headphones",
  headphones: "headphones",
  iem: "iems",
  iems: "iems",
  earphone: "iems",
  earphones: "iems",
  earbuds: "iems",
  dap: "dap",
  "digital-audio-player": "dap",
  digitalaudioplayer: "dap",
  player: "dap",
  dac: "dac",
  amp: "dac",
  "dac-amp": "dac",
  "dac-and-amp": "dac",
  dacamp: "dac",
  dacandamp: "dac",
  microphone: "mic",
  microphones: "mic",
  mic: "mic",
  "audio-interface": "audio-interface",
  audiointerface: "audio-interface",
  interface: "audio-interface",
  accessories: "accessories",
  accessory: "accessories",
  cable: "accessories",
  cables: "accessories",
  eartips: "accessories",
  "ear-tips": "accessories",
  cases: "accessories",
};

function getCatalogCategorySlugs() {
  return SITE_CATEGORY_SLUGS;
}

function isCatalogCategorySlug(value) {
  const normalized = String(value || "").trim();
  return getCatalogCategorySlugs().includes(normalized);
}

function normalizeCategoryAlias(value) {
  const raw = keyify(value || "");
  const alias = PRODUCT_CATEGORY_ALIASES[raw] || "";
  if (alias && isCatalogCategorySlug(alias)) return alias;
  return getCatalogCategorySlugs().find((slug) => keyify(slug) === raw) || "";
}

function requireCatalogCategory(value, field = "category") {
  const raw = requireString(value, field);
  const normalized = normalizeCategoryAlias(raw);
  if (!normalized) {
    throw new ApiError(
      400,
      "validation_error",
      `${field} must be one of the existing EDIO categories: ${getCatalogCategorySlugs().join(", ")}`,
    );
  }
  return normalized;
}

function normalizeProductCategory(product) {
  const directCategory = normalizeCategoryAlias(product?.category || "");
  if (directCategory) return directCategory;

  const nameText = typeof product?.name === "string" ? product.name : [product?.name?.en, product?.name?.ar].filter(Boolean).join(" ");
  const taglineText =
    typeof product?.tagline === "string" ? product.tagline : [product?.tagline?.en, product?.tagline?.ar].filter(Boolean).join(" ");
  const specText = (product?.specs || [])
    .flatMap((spec) => [
      typeof spec.label === "string" ? spec.label : [spec.label?.en, spec.label?.ar].filter(Boolean).join(" "),
      spec.value || "",
    ])
    .join(" ");
  const haystack = [
    product?.category,
    product?.slug,
    product?.brand,
    nameText,
    taglineText,
    ...(product?.subCategories || []),
    ...(product?.features || []),
    specText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const title = [nameText, product?.slug].filter(Boolean).join(" ").toLowerCase();

  if (/\b(audio interface|usb interface|recording interface|sound card|xlr interface)\b/.test(haystack)) return "audio-interface";
  if (/\b(dap|digital audio player|music player|hi-?res player|hiby r3|r3ii|hiby m300|snowsky echo mini)\b/.test(haystack)) return "dap";
  if (/\b(microphone|studio mic|condenser mic|dynamic mic|usb microphone)\b/.test(haystack)) return "mic";
  if (/\b(headphone|headphones|over-ear|on-ear|open-back|closed-back|circumaural|supra-aural)\b/.test(title)) return "headphones";
  if (/\b(headphone|headphones|over-ear|on-ear|open-back|closed-back|circumaural|supra-aural)\b/.test(haystack)) return "headphones";
  if (/\b(iem|iems|in-ear monitor|in ear monitor|earphone|earphones|earbud|earbuds|tws)\b/.test(haystack)) return "iems";
  if (/\b(dac|amp|amplifier|dongle|decoder|cs43131|ak4493|es9039|balanced out|line out)\b/.test(haystack)) return "dac";
  if (/\b(cable|cables|adapter|adaptor|eartip|eartips|ear tip|ear tips|case|pouch|storage|convertor|converter|mmcx|2-pin|0\.78mm)\b/.test(haystack)) {
    return "accessories";
  }

  return UNKNOWN_CATEGORY;
}

const CATEGORY_TERM_DEFINITIONS = {
  headphones: [
    {
      slug: "type-back",
      aliases: ["back-type"],
      children: [
        { slug: "closed-back" },
        { slug: "open-back" },
      ],
    },
    {
      slug: "driver-configuration",
      aliases: ["driver", "driver-configuration-headphone"],
      children: [
        { slug: "dynamic-driver", aliases: ["dynamic", "dynamic-driver-driver-configuration-headphone"] },
        { slug: "planar-driver", aliases: ["planar", "planar-driver-driver-configuration-headphone"] },
      ],
    },
  ],
  iems: [
    {
      slug: "driver-configuration",
      aliases: ["driver"],
      children: [
        { slug: "dynamic-driver", aliases: ["dynamic"] },
        { slug: "planar-driver", aliases: ["planar"] },
        { slug: "balanced-armatures", aliases: ["ba"] },
        { slug: "hybrid-drivers", aliases: ["hybrid"] },
      ],
    },
    { slug: "wireless", aliases: ["tws", "true-wireless"] },
  ],
  dap: [
    { slug: "portable" },
    { slug: "bluetooth" },
  ],
  dac: [
    { slug: "portable", aliases: ["dongle"] },
    { slug: "desktop" },
    { slug: "bluetooth" },
  ],
  "audio-interface": [
    { slug: "desktop" },
    { slug: "portable" },
  ],
  mic: [
    { slug: "dynamic" },
    { slug: "condenser" },
  ],
  accessories: [
    { slug: "audio-cables", aliases: ["cables", "cable"] },
    { slug: "eartips", aliases: ["ear-tips", "ear-tips-tips"] },
    { slug: "cable-convertors", aliases: ["convertors", "converters", "adapters", "adaptors"] },
    { slug: "cases", aliases: ["case", "storage", "storage-boxes", "storage-boxes-cases"] },
  ],
};

function flattenCategoryTerms(category, includeGroups = true) {
  const normalizedCategory = normalizeCategoryAlias(category) || UNKNOWN_CATEGORY;
  const terms = CATEGORY_TERM_DEFINITIONS[normalizedCategory] || [];
  const flat = [];
  const visit = (term) => {
    if (includeGroups || !term.children?.length) flat.push(term);
    for (const child of term.children || []) visit(child);
  };
  for (const term of terms) visit(term);
  return flat;
}

function resolveCategoryTerm(category, term) {
  const requested = keyify(term);
  if (!requested) return null;
  return (
    flattenCategoryTerms(category).find((candidate) => {
      const keys = [candidate.slug, ...(candidate.aliases || [])].map(keyify);
      return keys.includes(requested);
    }) || null
  );
}

function collectCategoryTermKeys(term, includeChildren = true) {
  const keys = new Set([term.slug, ...(term.aliases || [])].map(keyify));
  if (includeChildren) {
    for (const child of term.children || []) {
      for (const key of collectCategoryTermKeys(child, true)) keys.add(key);
    }
  }
  return keys;
}

function getProductSecondaryCategorySlugs(product) {
  const assignmentTerms =
    product?.categoryAssignment?.secondaryCategorySlugs ||
    product?.categoryAssignment?.secondary_category_slugs ||
    [];
  return [...new Set([...(product?.subCategories || []), ...assignmentTerms].map(keyify).filter(Boolean))];
}

function productMatchesCategoryTerm(product, category, term) {
  const normalizedCategory = normalizeProductCategory(product);
  const requestedCategory = normalizeProductCategory({ category });
  if (normalizedCategory !== requestedCategory) return false;

  const requestedTerm = keyify(term);
  if (!requestedTerm) return true;

  const termDefinition = resolveCategoryTerm(requestedCategory, requestedTerm);
  if (!termDefinition) return false;

  const acceptedTerms = collectCategoryTermKeys(termDefinition, true);
  const productTerms = getProductSecondaryCategorySlugs(product);
  return productTerms.some((item) => acceptedTerms.has(item));
}

function withDerivedProduct(product) {
  const currentIqd = Number.isFinite(Number(product.price)) ? Number(product.price) : 0;
  const officialIqd =
    Number.isFinite(Number(product.officialPrice))
      ? Number(product.officialPrice)
      : Number.isFinite(Number(product.compareAt))
        ? Number(product.compareAt)
        : null;

  const priceUsd =
    Number.isFinite(Number(product.priceUsd))
      ? Number(product.priceUsd)
      : convertCurrency(currentIqd, "IQD", "USD");
  const officialPriceUsd =
    Number.isFinite(Number(product.officialPriceUsd))
      ? Number(product.officialPriceUsd)
      : officialIqd
        ? convertCurrency(officialIqd, "IQD", "USD")
        : null;

  return {
    ...product,
    category: normalizeProductCategory(product),
    subCategories: getProductSecondaryCategorySlugs(product),
    specs: mergeSpecs(product.specs || [], []),
    storedBadge: product.storedBadge ?? product.badge ?? null,
    badge: getEffectiveBadge(product),
    price: currentIqd,
    priceUsd,
    compareAt: officialIqd,
    compareAtUsd: officialPriceUsd,
    officialPrice: officialIqd,
    officialPriceUsd,
    isNewArrival: isWithinNewBadgeWindow(product),
  };
}

function withPublicInventoryProduct(product) {
  const derived = withDerivedProduct(product);
  const publicStock = getPublicInventoryDisplay({
    availableQuantity: derived.stock,
    inStock: derived.inStock,
    availabilityStatus: derived.availabilityStatus,
  });

  return {
    id: derived.id,
    slug: derived.slug,
    name: derived.name,
    brand: derived.brand,
    category: derived.category,
    subCategories: derived.subCategories,
    tagline: derived.tagline,
    price: derived.price,
    priceUsd: derived.priceUsd,
    compareAt: derived.compareAt,
    compareAtUsd: derived.compareAtUsd,
    officialPrice: derived.officialPrice,
    officialPriceUsd: derived.officialPriceUsd,
    currency: derived.currency || "IQD",
    image: derived.image,
    gallery: Array.isArray(derived.gallery) ? derived.gallery : [],
    productPage: publicProductPageContent(derived.productPage),
    descriptionBlocks: publicDescriptionBlocks(derived.descriptionBlocks),
    badge: derived.badge || null,
    features: Array.isArray(derived.features) ? derived.features : [],
    specs: Array.isArray(derived.specs) ? derived.specs : [],
    inStock: Boolean(derived.inStock),
    availabilityStatus: derived.availabilityStatus,
    tags: Array.isArray(derived.tags) ? derived.tags : [],
    sales: Number(derived.sales || 0),
    isNewArrival: Boolean(derived.isNewArrival),
    createdAt: derived.createdAt || "",
    updatedAt: derived.updatedAt || "",
    publicStock,
  };
}

function getPublicProductRecommendations(product, { lang = "en" } = {}) {
  const source = withDerivedProduct(product);
  const blocked = new Set(
    normalizeProductRelationships(source.relationships || source.productRelationships || [])
      .filter((relationship) => relationship.active !== false && relationship.relationshipType === "blocked")
      .map((relationship) => relationship.targetProductId),
  );
  const candidates = db.products
    .filter((item) => item.id !== source.id)
    .filter((item) => !blocked.has(item.id))
    .filter(isStorefrontVisibleProduct)
    .map(withDerivedProduct)
    .filter((item) => item.inStock !== false && item.price);

  const manual = normalizeProductRelationships(source.relationships || source.productRelationships || [])
    .filter((relationship) => relationship.active !== false && relationship.relationshipType !== "blocked")
    .map((relationship) => {
      const target = candidates.find((item) => item.id === relationship.targetProductId);
      if (!target) return null;
      return {
        product: target,
        recommendation_type: relationship.relationshipType,
        score: 100 + Number(relationship.priority || 0),
        confidence: relationship.confidence ?? 0.96,
        reason: relationship.reason || publicRecommendationReason(relationship.relationshipType, lang),
        signals: ["manual_relationship", relationship.relationshipType],
      };
    })
    .filter(Boolean);

  const automatic = candidates.flatMap((candidate) => scorePublicRecommendation(source, candidate, lang));
  const deduped = dedupePublicRecommendations([...manual, ...automatic]);
  const sections = [
    ["recommended_accessories", lang === "ar" ? "ملحقات مناسبة" : "Recommended accessories", "accessory", 4],
    ["compatible_with", lang === "ar" ? "يعمل جيداً مع" : "Works well with", "compatible", 4],
    ["similar_products", lang === "ar" ? "منتجات مشابهة" : "Similar products", "similar", 6],
    ["alternatives", lang === "ar" ? "بدائل قريبة" : "Alternatives", "alternative", 4],
    ["same_brand", lang === "ar" ? "من نفس البراند" : "More from this brand", "same_brand", 4],
  ].map(([type, title, recommendationType, limit]) => ({
    type,
    title,
    items: deduped
      .filter((item) => item.recommendation_type === recommendationType)
      .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
      .slice(0, Number(limit))
      .map((item) => ({
        product: withPublicInventoryProduct(item.product),
        recommendation_type: item.recommendation_type,
        score: item.score,
        confidence: Number(item.confidence.toFixed(2)),
        reason: item.reason,
      })),
  })).filter((section) => section.items.length);

  return { product_id: source.id, sections };
}

function scorePublicRecommendation(source, target, lang) {
  const sourceCategory = normalizeProductCategory(source);
  const targetCategory = normalizeProductCategory(target);
  const sourceText = recommendationText(source);
  const targetText = recommendationText(target);
  const shared = [...recommendationTerms(source)].filter((term) => recommendationTerms(target).has(term));
  const results = [];

  if (targetCategory === "accessories") {
    const sourceConnector = recommendationConnector(sourceText);
    const targetConnector = recommendationConnector(targetText);
    if (sourceCategory === "iems" && /\b(ear-?tips?|eartips?)\b/.test(targetText)) {
      results.push(publicRecommendation(target, "accessory", 94, 0.94, lang === "ar" ? "يساعد على ضبط الراحة والعزل لسماعات IEM." : "Helps tune fit and isolation for IEMs.", ["iem_eartips"]));
    } else if ((sourceCategory === "iems" || sourceCategory === "headphones") && sourceConnector && sourceConnector === targetConnector) {
      results.push(publicRecommendation(target, "accessory", 90, 0.88, lang === "ar" ? `كيبل متوافق مع موصل ${sourceConnector}.` : `Cable match for ${sourceConnector} connectors.`, ["connector_match"]));
    } else if (sourceCategory === "mic" && /\bxlr\b/.test(sourceText) && /\bxlr\b/.test(targetText)) {
      results.push(publicRecommendation(target, "accessory", 96, 0.95, lang === "ar" ? "كيبل XLR مطلوب لهذا المايك." : "XLR cable for this microphone.", ["xlr_mic", "xlr_cable"]));
    }
  }

  if ((sourceCategory === "headphones" || sourceCategory === "iems") && targetCategory === "dac") {
    const hardToDrive = /\b(planar|open-back|he6|hard to drive|83\.5|high impedance)\b/.test(sourceText);
    if (sourceCategory === "headphones" && hardToDrive) {
      results.push(publicRecommendation(target, "compatible", 92, 0.88, lang === "ar" ? "مناسب لسماعات تحتاج قدرة وتحكم أفضل." : "Suitable for headphones that need more power and control.", ["power_need", "dac_amp"]));
    } else if (sourceCategory === "iems" && /\b(portable|dongle|usb-c|3\.5|4\.4)\b/.test(targetText)) {
      results.push(publicRecommendation(target, "compatible", 82, 0.78, lang === "ar" ? "مصدر محمول مناسب للاستماع اليومي مع IEM." : "Portable source for everyday IEM listening.", ["portable_listening"]));
    }
  }

  if (sourceCategory === "mic" && targetCategory === "audio-interface" && /\bxlr\b/.test(sourceText) && !/\busb\b/.test(sourceText)) {
    results.push(publicRecommendation(target, "compatible", 98, 0.96, lang === "ar" ? "مايك XLR يحتاج كرت صوت مناسب." : "XLR microphone requires an audio interface.", ["xlr_mic_requires_interface"]));
  }

  if (sourceCategory === targetCategory && targetCategory !== "accessories") {
    const tierDistance = Math.abs(publicPriceTier(source) - publicPriceTier(target));
    if (shared.length >= 2 || (recommendationBackType(sourceText) && recommendationBackType(sourceText) === recommendationBackType(targetText))) {
      results.push(publicRecommendation(target, "similar", 72 + shared.length * 7 - tierDistance * 5, 0.7 + shared.length * 0.05, lang === "ar" ? "خيار قريب في نفس الفئة والاستخدام." : "A close option in the same category and use case.", ["same_category", ...shared.slice(0, 3)]));
    }
    if (source.inStock === false || (shared.length >= 2 && tierDistance <= 1)) {
      results.push(publicRecommendation(target, "alternative", 76 + shared.length * 5 - tierDistance * 5, 0.72 + shared.length * 0.04, lang === "ar" ? "بديل قريب بنفس الفئة والسعر." : "A nearby alternative in the same lane.", ["alternative", ...shared.slice(0, 3)]));
    }
  }

  if (source.brand && target.brand && sameKey(source.brand, target.brand) && sourceCategory === targetCategory && shared.length) {
    results.push(publicRecommendation(target, "same_brand", 78 + shared.length * 4, 0.76 + shared.length * 0.03, lang === "ar" ? "من نفس البراند وبسياق قريب." : "Same brand, related use case.", ["same_brand", "same_category"]));
  }

  return results.filter((item) => item.confidence >= 0.7 && item.score >= 70);
}

function publicRecommendation(product, type, score, confidence, reason, signals) {
  return { product, recommendation_type: type, score, confidence, reason, signals };
}

function dedupePublicRecommendations(items) {
  const priority = { accessory: 5, compatible: 4, similar: 3, alternative: 2, same_brand: 1 };
  const byProduct = new Map();
  for (const item of items) {
    const existing = byProduct.get(item.product.id);
    if (!existing || item.score + priority[item.recommendation_type] > existing.score + priority[existing.recommendation_type]) {
      byProduct.set(item.product.id, item);
    }
  }
  return [...byProduct.values()];
}

function publicRecommendationReason(type, lang) {
  if (type === "accessory") return lang === "ar" ? "ملحق محدد يدوياً لهذا المنتج." : "Manually selected accessory.";
  if (type === "compatible") return lang === "ar" ? "منتج متوافق محدد يدوياً." : "Manually selected compatible product.";
  if (type === "alternative") return lang === "ar" ? "بديل محدد يدوياً." : "Manually selected alternative.";
  if (type === "same_brand") return lang === "ar" ? "منتج قريب من نفس البراند." : "Related product from the same brand.";
  return lang === "ar" ? "منتج مشابه محدد يدوياً." : "Manually selected similar product.";
}

function recommendationText(product) {
  return [
    product.brand,
    product.category,
    ...(product.subCategories || []),
    product.name?.en,
    product.name?.ar,
    product.tagline?.en,
    product.tagline?.ar,
    ...(product.features || []),
    ...(product.tags || []),
    ...(product.specs || []).flatMap((spec) => [
      typeof spec.label === "string" ? spec.label : spec.label?.en || spec.label?.ar || "",
      spec.value || "",
    ]),
  ].filter(Boolean).join(" ").toLowerCase();
}

function recommendationTerms(product) {
  return new Set(recommendationText(product).split(/[^a-z0-9\u0600-\u06ff.]+/i).map(slugify).filter((term) => term.length > 2));
}

function recommendationConnector(text) {
  if (/\bmmcx\b/.test(text)) return "mmcx";
  if (/\b(?:2[\s-]*pin|0\.78|0\.75|qdc)\b/.test(text)) return "2-pin";
  if (/\bxlr\b/.test(text)) return "xlr";
  if (/\btrs\b/.test(text)) return "trs";
  if (/\b4\.4\s*mm|balanced\b/.test(text)) return "4.4mm";
  if (/\b3\.5\s*mm|single-ended\b/.test(text)) return "3.5mm";
  return "";
}

function recommendationBackType(text) {
  if (/\bopen[-\s]?back\b/.test(text)) return "open-back";
  if (/\bclosed[-\s]?back\b/.test(text)) return "closed-back";
  return "";
}

function publicPriceTier(product) {
  const price = Number(product.price || 0);
  if (price < 75000) return 0;
  if (price < 250000) return 1;
  if (price < 700000) return 2;
  return 3;
}

function getPublicInventoryDisplay({ availableQuantity, inStock, availabilityStatus }) {
  const status = normalizePublicAvailability(availabilityStatus);
  const quantity = Number.isFinite(Number(availableQuantity)) ? Math.max(0, Math.floor(Number(availableQuantity))) : null;
  const isAvailable = status === "in_stock" || (!status && (inStock === true || Number(quantity || 0) > 0));

  if (status === "pre_order") return publicInventoryResult("pre_order", "Pre-order", false, null, "neutral");
  if (status === "discontinued") return publicInventoryResult("discontinued", "Discontinued", false, null, "danger");
  if (!isAvailable || status === "out_of_stock" || quantity === 0) {
    return publicInventoryResult("out_of_stock", "Out of stock", false, null, "danger");
  }
  if (quantity !== null && quantity <= 3) {
    return publicInventoryResult("in_stock", `Only ${quantity} left`, true, quantity, "warning");
  }
  return publicInventoryResult("in_stock", "In stock", false, null, "success");
}

function normalizePublicAvailability(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "in_stock" || normalized === "in-stock") return "in_stock";
  if (normalized === "out_of_stock" || normalized === "out-of-stock" || normalized === "sold_out") return "out_of_stock";
  if (normalized === "pre_order" || normalized === "pre-order" || normalized === "preorder") return "pre_order";
  if (normalized === "discontinued") return "discontinued";
  if (normalized === "hidden") return "hidden";
  return null;
}

function publicInventoryResult(availability, stockDisplay, lowStock, lowStockQuantity, severity) {
  return {
    availability,
    stock_display: stockDisplay,
    low_stock: lowStock,
    low_stock_quantity: lowStockQuantity,
    severity,
  };
}

function createSampleOrders(products, customerId, now) {
  const statuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
  return products.slice(0, 10).map((product, index) => {
    const qty = (index % 2) + 1;
    const subtotal = product.price * qty;
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    const discount = index % 4 === 0 ? Math.round(subtotal * 0.1) : 0;
    const createdAt = new Date(now - index * 86400000).toISOString();
    const status = statuses[index % statuses.length];

    return {
      id: `ord_${1000 + index}`,
      number: `EDIO-${String(2600 + index).padStart(5, "0")}`,
      customerId,
      customerName: "EDIO Customer",
      customerEmail: "customer@edio.iq",
      customerPhone: "+9647702046674",
      shippingAddress: {
        line1: "Mosul, Iraq",
        city: "Mosul",
        governorate: "Nineveh",
        notes: "Seed order",
      },
      items: [
        {
          productId: product.id,
          name: product.name.en,
          brand: product.brand,
          image: product.image,
          price: product.price,
          qty,
        },
      ],
      subtotal,
      discount,
      shipping,
      total: Math.max(0, subtotal - discount) + shipping,
      status,
      paymentMethod: "cod",
      createdAt,
      updatedAt: createdAt,
      timeline: [{ status: "pending", at: createdAt, note: "Order created" }],
    };
  });
}

function createSeedUser({ id, email, fullName, role, password, phone = "", createdAt }) {
  return normalizeUserRecord({
    id,
    email: normalizeEmail(email),
    fullName,
    phone,
    avatarUrl: "",
    role,
    banned: false,
    emailVerified: true,
    status: "active",
    locale: "en",
    currency: "IQD",
    lastLoginAt: null,
    deletedAt: null,
    createdAt,
    updatedAt: createdAt,
    ...hashPassword(password),
  });
}

function normalizeUserRecord(user) {
  const now = new Date().toISOString();
  user.id = user.id || `usr_${crypto.randomUUID()}`;
  user.email = normalizeEmail(user.email);
  user.emailCanonical = normalizeEmail(user.emailCanonical || user.email);
  user.emailVerified = user.emailVerified !== undefined ? Boolean(user.emailVerified) : true;
  user.fullName = String(user.fullName || user.name || user.email || "EDIO Customer").trim();
  user.phone = String(user.phone || user.phoneE164 || "");
  user.phoneE164 = String(user.phoneE164 || (user.phone.startsWith("+") ? user.phone : ""));
  user.avatarUrl = String(user.avatarUrl || "");
  user.role = ["customer", "admin", "super_admin"].includes(user.role) ? user.role : "customer";
  user.banned = Boolean(user.banned);
  user.passwordLoginDisabled = Boolean(user.passwordLoginDisabled);
  user.status = user.status || (user.banned ? "disabled" : "active");
  if (!["active", "unverified", "disabled", "deleted"].includes(user.status)) user.status = user.banned ? "disabled" : "active";
  if (user.status === "disabled") user.banned = true;
  user.locale = String(user.locale || "en");
  user.currency = SUPPORTED_CURRENCIES.includes(user.currency) ? user.currency : "IQD";
  user.createdAt = user.createdAt || now;
  user.updatedAt = user.updatedAt || user.createdAt;
  user.lastLoginAt = user.lastLoginAt || null;
  user.deletedAt = user.deletedAt || null;
  return user;
}

function normalizeSessionRecord(session) {
  if (!session?.id || !session?.userId || !session?.tokenHash) return null;
  return {
    id: String(session.id),
    userId: String(session.userId),
    tokenHash: String(session.tokenHash),
    createdAt: session.createdAt || new Date().toISOString(),
    lastSeenAt: session.lastSeenAt || session.createdAt || new Date().toISOString(),
    expiresAt: session.expiresAt || new Date(Date.now() + AUTH_SESSION_TTL_MS).toISOString(),
    revokedAt: session.revokedAt || null,
    lastReauthenticatedAt: session.lastReauthenticatedAt || null,
    userAgent: String(session.userAgent || ""),
    ipHash: String(session.ipHash || ""),
  };
}

function normalizeAuthTokenRecord(token) {
  if (!token?.id || !token?.userId || !token?.tokenHash) return null;
  return {
    id: String(token.id),
    userId: String(token.userId),
    tokenHash: String(token.tokenHash),
    createdAt: token.createdAt || new Date().toISOString(),
    expiresAt: token.expiresAt || new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS).toISOString(),
    usedAt: token.usedAt || null,
    requestId: token.requestId || null,
  };
}

function ensureAccountRelations(database, user) {
  if (!database.userEmails.some((item) => item.userId === user.id && item.normalizedEmail === user.emailCanonical)) {
    database.userEmails.push({
      id: `uem_${crypto.randomUUID()}`,
      userId: user.id,
      email: user.email,
      normalizedEmail: user.emailCanonical,
      verifiedAt: user.emailVerified ? user.updatedAt || user.createdAt : null,
      isPrimary: true,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }

  if (!user.passwordLoginDisabled && !database.authPasswords.some((item) => item.userId === user.id) && user.passwordHash && user.passwordSalt) {
    database.authPasswords.push({
      id: `apw_${crypto.randomUUID()}`,
      userId: user.id,
      algorithm: "scrypt",
      passwordHash: user.passwordHash,
      passwordSalt: user.passwordSalt,
      updatedAt: user.updatedAt,
    });
  }

  if (!user.passwordLoginDisabled && !database.authIdentities.some((item) => item.userId === user.id && item.provider === "password")) {
    database.authIdentities.push({
      id: `aid_${crypto.randomUUID()}`,
      userId: user.id,
      provider: "password",
      providerUserId: user.emailCanonical,
      label: "Email and password",
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      revokedAt: null,
    });
  }

  if (!database.customerProfiles.some((item) => item.userId === user.id)) {
    const [firstName = "", ...rest] = String(user.fullName || "").split(/\s+/).filter(Boolean);
    database.customerProfiles.push({
      id: `cpr_${crypto.randomUUID()}`,
      userId: user.id,
      firstName,
      lastName: rest.join(" "),
      fullName: user.fullName,
      phoneE164: user.phoneE164 || user.phone || "",
      avatarUrl: user.avatarUrl || "",
      locale: user.locale || "en",
      language: user.locale || "en",
      currency: user.currency || "IQD",
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }

  if (!database.userPreferences.some((item) => item.userId === user.id)) {
    database.userPreferences.push({
      id: `upr_${crypto.randomUUID()}`,
      userId: user.id,
      locale: user.locale || "en",
      language: user.locale || "en",
      currency: user.currency || "IQD",
      marketingEmail: false,
      orderUpdates: true,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }
}

function upsertAuthPassword(user) {
  const existing = db.authPasswords.find((item) => item.userId === user.id);
  const payload = {
    algorithm: "scrypt",
    passwordHash: user.passwordHash,
    passwordSalt: user.passwordSalt,
    updatedAt: new Date().toISOString(),
  };
  if (existing) {
    Object.assign(existing, payload);
  } else {
    db.authPasswords.push({ id: `apw_${crypto.randomUUID()}`, userId: user.id, ...payload });
  }
}

function normalizeCustomerAddress(address) {
  if (!address?.userId) return null;
  const now = new Date().toISOString();
  return {
    id: String(address.id || `adr_${crypto.randomUUID()}`),
    userId: String(address.userId),
    label: String(address.label || "Address"),
    fullName: String(address.fullName || address.name || ""),
    phone: String(address.phone || ""),
    line1: String(address.line1 || address.address || ""),
    city: String(address.city || ""),
    governorate: String(address.governorate || address.province || address.state || ""),
    notes: String(address.notes || ""),
    isDefault: Boolean(address.isDefault),
    createdAt: address.createdAt || now,
    updatedAt: address.updatedAt || address.createdAt || now,
    deletedAt: address.deletedAt || null,
  };
}

async function saveDatabase() {
  db.meta.updatedAt = new Date().toISOString();
  await writeFile(DB_FILE, JSON.stringify(db, null, 2));
}

function upsertCategoryAssignments(existingAssignments = [], nextAssignments = []) {
  const byProduct = new Map(
    (Array.isArray(existingAssignments) ? existingAssignments : [])
      .filter((assignment) => assignment?.productId)
      .map((assignment) => [assignment.productId, assignment]),
  );
  for (const assignment of nextAssignments) {
    if (!assignment?.productId) continue;
    byProduct.set(assignment.productId, assignment);
  }
  return [...byProduct.values()];
}

function optionalConfidence(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function upsertImportJobLog(job) {
  if (!job?.id) return null;
  db.importJobLogs = Array.isArray(db.importJobLogs) ? db.importJobLogs : [];
  const existingIndex = db.importJobLogs.findIndex((item) => item.id === job.id);
  if (existingIndex >= 0) {
    db.importJobLogs.splice(existingIndex, 1, job);
  } else {
    db.importJobLogs.unshift(job);
  }
  db.importJobLogs = db.importJobLogs.slice(0, 200);
  return job;
}

function upsertReviewTask(task) {
  if (!task?.id) return null;
  db.reviewTasks = Array.isArray(db.reviewTasks) ? db.reviewTasks : [];
  const existingIndex = db.reviewTasks.findIndex((item) => item.id === task.id);
  if (existingIndex >= 0) {
    const previous = db.reviewTasks[existingIndex];
    db.reviewTasks.splice(existingIndex, 1, {
      ...previous,
      ...task,
      status: previous.status === "closed" ? previous.status : task.status,
      createdAt: previous.createdAt || task.createdAt,
    });
  } else {
    db.reviewTasks.unshift(task);
  }
  db.reviewTasks = db.reviewTasks.slice(0, 300);
  return task;
}

function serializeReviewTasks(searchParams) {
  const limit = Math.max(1, Math.min(200, Number(searchParams.get("limit") || 100)));
  const status = String(searchParams.get("status") || "open").trim();
  const items = (Array.isArray(db.reviewTasks) ? db.reviewTasks : [])
    .filter((task) => !status || status === "all" || task.status === status)
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))
    .slice(0, limit);
  return { total: items.length, items };
}

function serializeImportJobLogs(searchParams) {
  const limit = Math.max(1, Math.min(200, Number(searchParams.get("limit") || 80)));
  const status = String(searchParams.get("status") || "").trim();
  const items = (Array.isArray(db.importJobLogs) ? db.importJobLogs : [])
    .filter((job) => !status || job.status === status)
    .slice(0, limit);
  return {
    version: IMPORT_PIPELINE_VERSION,
    source_weights: IMPORT_SOURCE_WEIGHTS,
    total: items.length,
    items,
  };
}

function upsertImportJob(job) {
  if (!job?.id) return null;
  db.importJobs = Array.isArray(db.importJobs) ? db.importJobs : [];
  const existingIndex = db.importJobs.findIndex((item) => item.id === job.id);
  if (existingIndex >= 0) {
    db.importJobs.splice(existingIndex, 1, { ...db.importJobs[existingIndex], ...job, updatedAt: new Date().toISOString() });
  } else {
    db.importJobs.unshift(job);
  }
  db.importJobs = db.importJobs.slice(0, 500);
  return job;
}

function upsertImportJobItem(item) {
  if (!item?.id || !item?.jobId) return null;
  const now = new Date().toISOString();
  db.importJobItems = Array.isArray(db.importJobItems) ? db.importJobItems : [];
  const normalized = {
    ...item,
    status: item.status || "running",
    attempts: Number(item.attempts || 0),
    errors: Array.isArray(item.errors) ? item.errors : [],
    createdAt: item.createdAt || now,
    updatedAt: now,
  };
  const existingIndex = db.importJobItems.findIndex((entry) => entry.id === normalized.id);
  if (existingIndex >= 0) {
    db.importJobItems.splice(existingIndex, 1, {
      ...db.importJobItems[existingIndex],
      ...normalized,
      createdAt: db.importJobItems[existingIndex].createdAt || normalized.createdAt,
    });
  } else {
    db.importJobItems.unshift(normalized);
  }
  db.importJobItems = db.importJobItems.slice(0, 3000);
  return normalized;
}

function recordImportEvent({ jobId = null, productId = null, assetId = null, action, level = "info", message = "", data = {} }) {
  db.importEvents = Array.isArray(db.importEvents) ? db.importEvents : [];
  const event = {
    id: `import_event_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    jobId,
    productId,
    assetId,
    action,
    level,
    message,
    data,
    createdAt: new Date().toISOString(),
  };
  db.importEvents.unshift(event);
  db.importEvents = db.importEvents.slice(0, 2000);
  return event;
}

function serializeImportJob(jobId) {
  const job = (db.importJobs || []).find((item) => item.id === jobId) || (db.importJobLogs || []).find((item) => item.id === jobId);
  if (!job) throw new ApiError(404, "not_found", "Import job not found");
  return {
    job,
    items: (db.importJobItems || []).filter((item) => item.jobId === jobId),
    candidates: (db.assetCandidates || []).filter((item) => item.importJobId === jobId || item.provenance?.importJobId === jobId),
    events: (db.importEvents || []).filter((item) => item.jobId === jobId).slice(0, 200),
  };
}

async function readWooCommerceImportCsv(body = {}) {
  if (typeof body.csv === "string" && body.csv.trim()) {
    if (Buffer.byteLength(body.csv, "utf8") > 24_000_000) {
      throw new ApiError(413, "payload_too_large", "WooCommerce CSV is too large for dry-run analysis.");
    }
    return body.csv;
  }
  const filePath = String(body.filePath || body.file_path || "").trim();
  if (!filePath) {
    throw new ApiError(400, "validation_error", "Provide csv text or filePath for WooCommerce dry-run analysis.");
  }
  if (!path.isAbsolute(filePath) || path.extname(filePath).toLowerCase() !== ".csv") {
    throw new ApiError(400, "validation_error", "WooCommerce filePath must be an absolute .csv path.");
  }
  const fileStat = await stat(filePath);
  if (fileStat.size > 24_000_000) {
    throw new ApiError(413, "payload_too_large", "WooCommerce CSV is too large for dry-run analysis.");
  }
  return readFile(filePath, "utf8");
}

function registerMediaAsset(asset) {
  if (!asset?.storedUrl && !asset?.url) return null;
  const now = new Date().toISOString();
  const normalized = normalizeAssetCandidate(asset, { now });
  const mediaAsset = {
    id: asset.assetId || `media_asset_${(normalized.checksum || crypto.createHash("sha1").update(normalized.storedUrl || normalized.url).digest("hex")).slice(0, 16)}`,
    productId: normalized.productId || null,
    url: normalized.storedUrl || normalized.url,
    sourceUrl: normalized.sourceUrl || "",
    sourceType: normalized.sourceType,
    checksum: normalized.checksum || "",
    perceptualHash: normalized.perceptualHash,
    metadata: normalized.metadata,
    derivatives: normalized.derivatives,
    normalizationLog: asset.normalizationLog || asset.normalization || null,
    status: "ready",
    createdAt: asset.createdAt || now,
    updatedAt: now,
  };
  db.mediaAssets = Array.isArray(db.mediaAssets) ? db.mediaAssets : [];
  const existingIndex = db.mediaAssets.findIndex((item) => item.id === mediaAsset.id || (mediaAsset.checksum && item.checksum === mediaAsset.checksum));
  if (existingIndex >= 0) {
    db.mediaAssets.splice(existingIndex, 1, { ...db.mediaAssets[existingIndex], ...mediaAsset, createdAt: db.mediaAssets[existingIndex].createdAt || mediaAsset.createdAt });
  } else {
    db.mediaAssets.unshift(mediaAsset);
  }
  db.assetCandidates = Array.isArray(db.assetCandidates) ? db.assetCandidates : [];
  const candidate = {
    ...normalized,
    id: asset.candidateId || normalized.id,
    assetId: mediaAsset.id,
    importJobId: asset.importJobId || normalized.provenance?.importJobId || null,
  };
  const candidateIndex = db.assetCandidates.findIndex((item) => item.id === candidate.id);
  if (candidateIndex >= 0) db.assetCandidates.splice(candidateIndex, 1, { ...db.assetCandidates[candidateIndex], ...candidate, updatedAt: now });
  else db.assetCandidates.unshift(candidate);
  return { mediaAsset, candidate };
}

function getProductMedia(productId) {
  const media = (db.productMedia || [])
    .filter((item) => item.productId === productId)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  if (media.length) return media;
  const product = db.products.find((item) => item.id === productId);
  if (!product) throw new ApiError(404, "not_found", "Product not found");
  const fallbackUrls = [product.image, ...(Array.isArray(product.gallery) ? product.gallery : [])].filter(Boolean);
  return fallbackUrls.map((url, index) => ({
    id: `legacy_media_${productId}_${index}`,
    productId,
    url,
    role: index === 0 ? "main" : "gallery",
    sortOrder: index,
    altText: `${product.brand || ""} ${product.nameEn || product.name || "Product"}`.trim(),
    title: product.nameEn || product.name || "Product image",
    sourceType: "internal",
    status: "legacy",
  }));
}

async function recomputeProductMedia(productId, options = {}) {
  const product = db.products.find((item) => item.id === productId);
  if (!product) throw new ApiError(404, "not_found", "Product not found");
  const job = options.job || buildImportMediaJob({ productId, mode: "media_recompute", input: product.nameEn || product.name });
  upsertImportJob(job);
  const now = new Date().toISOString();
  const jobItemId = `import_job_item_${job.id}_${productId}`;
  upsertImportJobItem({
    id: jobItemId,
    jobId: job.id,
    productId,
    status: "running",
    input: product.nameEn || product.name || product.slug || product.id,
  });
  const rawCandidates = [];
  const failures = [];
  const pushUrl = (url, role = "gallery", sourceType = "internal", extras = {}) => {
    if (!url) return;
    rawCandidates.push(
      normalizeAssetCandidate({
        productId,
        url,
        storedUrl: url,
        sourceUrl: extras.sourceUrl || url,
        sourceType,
        role,
        pageUrl: extras.pageUrl || "",
        checksum: extras.checksum || "",
        metadata: readImageMetaFromUrl(url),
        importJobId: job.id,
        normalizationLog: extras.normalizationLog || null,
      }),
    );
  };
  pushUrl(product.image, "main", "internal");
  for (const url of Array.isArray(product.gallery) ? product.gallery : []) pushUrl(url, "gallery", "internal");
  for (const media of (db.productMedia || []).filter((item) => item.productId === productId)) {
    pushUrl(media.url, media.role || "gallery", media.sourceType || "internal");
  }

  const suppliedCandidates = [
    ...collectImageCandidatesFromSources(
      {
        imageUrls: Array.isArray(options.imageUrls) ? options.imageUrls : [],
        imageCandidates: Array.isArray(options.candidates) ? options.candidates : [],
        sources: Array.isArray(options.sources) ? options.sources : [],
      },
      { productId, importJobId: job.id, sourceType: "retailer" },
    ),
  ];

  for (const [index, candidate] of suppliedCandidates.entries()) {
    const sourceUrl = candidate.sourceUrl || candidate.url || candidate.storedUrl || "";
    const mediaItemId = `import_job_item_${job.id}_${productId}_${index}`;
    upsertImportJobItem({
      id: mediaItemId,
      jobId: job.id,
      productId,
      status: "running",
      input: sourceUrl,
      sourceType: candidate.sourceType,
    });
    try {
      const sourceValue = candidate.storedUrl || candidate.url || sourceUrl;
      const storedUrl = isRemoteImageUrl(sourceValue)
        ? await downloadImportedImage(sourceValue, product.slug || product.nameEn || product.id, {
            productId,
            jobId: job.id,
            importJobId: job.id,
            sourceType: candidate.sourceType || "retailer",
            role: candidate.role || "gallery",
            pageUrl: candidate.provenance?.pageUrl || candidate.pageUrl || "",
          })
        : sourceValue;
      if (!storedUrl) throw new Error("image_rejected_or_empty");
      pushUrl(storedUrl, candidate.role || "gallery", candidate.sourceType || "retailer", {
        sourceUrl,
        pageUrl: candidate.provenance?.pageUrl || candidate.pageUrl || "",
        checksum: candidate.checksum || "",
      });
      upsertImportJobItem({
        id: mediaItemId,
        jobId: job.id,
        productId,
        status: "completed",
        input: sourceUrl,
        output: storedUrl,
        sourceType: candidate.sourceType,
      });
      recordImportEvent({
        jobId: job.id,
        productId,
        action: "asset_candidate_ingested",
        message: "Image candidate ingested",
        data: { sourceUrl, storedUrl, role: candidate.role, sourceType: candidate.sourceType },
      });
    } catch (error) {
      const message = error?.message || "image_import_failed";
      failures.push({ sourceUrl, message });
      upsertImportJobItem({
        id: mediaItemId,
        jobId: job.id,
        productId,
        status: "failed",
        input: sourceUrl,
        sourceType: candidate.sourceType,
        errors: [{ message, createdAt: new Date().toISOString() }],
      });
      recordImportEvent({
        jobId: job.id,
        productId,
        action: "asset_candidate_failed",
        level: "warn",
        message,
        data: { sourceUrl, role: candidate.role, sourceType: candidate.sourceType },
      });
    }
  }
  const mediaSet = buildProductMediaSet(rawCandidates, product, { productId, importJobId: job.id, now });
  db.productMedia = (db.productMedia || []).filter((item) => item.productId !== productId);
  const registeredByCandidateId = new Map();
  for (const item of mediaSet.media) {
    const registered = registerMediaAsset({
      ...item,
      productId,
      url: item.storedUrl || item.url,
      storedUrl: item.storedUrl || item.url,
      sourceUrl: item.sourceUrl || item.url || "",
      importJobId: job.id,
      role: item.role,
      metadata: item.metadata || readImageMetaFromUrl(item.storedUrl || item.url),
      derivatives: item.derivatives || {},
    });
    if (registered?.mediaAsset?.id) registeredByCandidateId.set(item.id, registered.mediaAsset.id);
  }
  const productMedia = mediaSet.media.map((item) => ({
    id: `product_media_${productId}_${item.assetId || item.id}_${item.sortOrder}`,
    productId,
    mediaAssetId: item.assetId || registeredByCandidateId.get(item.id) || null,
    url: item.storedUrl || item.url,
    sourceUrl: item.sourceUrl || "",
    sourceType: item.sourceType,
    provenance: item.provenance || null,
    derivatives: item.derivatives || {},
    metadata: item.metadata || {},
    role: item.role,
    sortOrder: item.sortOrder,
    altText: item.altText,
    title: item.title,
    confidenceScore: item.quality?.confidence || 0,
    reasonCodes: item.quality?.reasons || [],
    status: item.status,
    createdAt: now,
    updatedAt: now,
  }));
  db.productMedia.unshift(...productMedia);
  product.image = productMedia[0]?.url || product.image || "";
  product.gallery = productMedia.map((item) => item.url).filter(Boolean);
  product.mediaPipeline = {
    version: MEDIA_PIPELINE_VERSION,
    updatedAt: now,
    heroConfidence: productMedia[0]?.confidenceScore || 0,
    heroReasons: productMedia[0]?.reasonCodes || [],
    candidateCount: rawCandidates.length,
    selectedCount: productMedia.length,
  };
  product.updatedAt = now;
  for (const event of mediaSet.events) {
    recordImportEvent({ jobId: job.id, productId, action: event.type, message: `${event.type}: kept ${event.keptUrl}`, data: event });
  }
  upsertImportJobItem({
    id: jobItemId,
    jobId: job.id,
    productId,
    status: failures.length ? "completed_with_warnings" : "completed",
    input: product.nameEn || product.name || product.slug || product.id,
    output: productMedia.map((item) => item.url),
    errors: failures,
  });
  job.status = failures.length ? "completed_with_warnings" : "completed";
  job.completedAt = now;
  job.updatedAt = now;
  job.summary = { ...mediaSet.summary, failures };
  upsertImportJob(job);
  return { job, media: productMedia, summary: mediaSet.summary, events: mediaSet.events };
}

function patchProductMedia(productId, mediaId, body = {}) {
  const product = db.products.find((item) => item.id === productId);
  if (!product) throw new ApiError(404, "not_found", "Product not found");
  db.productMedia = Array.isArray(db.productMedia) ? db.productMedia : [];
  const index = db.productMedia.findIndex((item) => item.productId === productId && item.id === mediaId);
  if (index < 0) throw new ApiError(404, "not_found", "Product media not found");
  const previous = db.productMedia[index];
  const next = {
    ...previous,
    altText: typeof body.altText === "string" ? body.altText.trim().slice(0, 160) : previous.altText,
    title: typeof body.title === "string" ? body.title.trim().slice(0, 140) : previous.title,
    role: body.role ? String(body.role).trim() : previous.role,
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : previous.sortOrder,
    status: body.status ? String(body.status).trim() : previous.status,
    updatedAt: new Date().toISOString(),
  };
  db.productMedia.splice(index, 1, next);
  if (body.makeHero === true || next.role === "main") {
    db.productMedia = db.productMedia.map((item) =>
      item.productId === productId
        ? {
            ...item,
            role: item.id === next.id ? "main" : item.role === "main" ? "gallery" : item.role,
            sortOrder: item.id === next.id ? 0 : Math.max(1, Number(item.sortOrder || 0)),
          }
        : item,
    );
  }
  const ordered = getProductMedia(productId);
  product.image = ordered[0]?.url || product.image;
  product.gallery = ordered.map((item) => item.url).filter(Boolean);
  product.updatedAt = new Date().toISOString();
  recordImportEvent({
    productId,
    assetId: next.mediaAssetId || next.id,
    action: "media_manual_override",
    message: "Admin updated product media metadata",
    data: { before: previous, after: next },
  });
  return { media: getProductMedia(productId), product: { id: product.id, image: product.image, gallery: product.gallery } };
}

function importDraftToClassificationProduct(draft, now = new Date().toISOString()) {
  return {
    id: draft.id || `draft_${slugify(draft.nameEn || draft.sourceUrl || "import")}`,
    slug: slugify(draft.nameEn || draft.sourceUrl || "imported-product"),
    sourceUrl: draft.sourceUrl || "",
    name: { en: draft.nameEn || "", ar: draft.nameAr || "" },
    brand: draft.brand || "",
    category: draft.category || "",
    subCategories: Array.isArray(draft.subCategories) ? draft.subCategories : [],
    tagline: { en: draft.taglineEn || "", ar: draft.taglineAr || "" },
    features: Array.isArray(draft.features) ? draft.features : [],
    specs: Array.isArray(draft.specs) ? draft.specs : [],
    tags: Array.isArray(draft.tags) ? draft.tags : [],
    inStock: draft.inStock !== false,
    price: Number(draft.price || 0),
    image: draft.image || "",
    gallery: Array.isArray(draft.gallery) ? draft.gallery : [],
    createdAt: now,
    updatedAt: now,
  };
}

function classificationFromAssignment(assignment = {}) {
  return {
    primary_category_slug: assignment.primaryCategorySlug || assignment.primary_category_slug || "",
    secondary_category_slugs: assignment.secondaryCategorySlugs || assignment.secondary_category_slugs || [],
    dynamic_collection_slugs: assignment.dynamicCollectionSlugs || assignment.dynamic_collection_slugs || [],
    confidence_score: assignment.confidenceScore ?? assignment.confidence_score ?? 0,
    needs_review: assignment.needsReview ?? assignment.needs_review ?? false,
    classification_reason: assignment.classificationReason || assignment.classification_reason || "",
    evidence: assignment.evidence || [],
  };
}

async function normalizeImportedDraftImages(draft, job) {
  const source = String(draft.image || draft.gallery?.[0] || "").trim();
  if (!source) return [];

  const normalized = await createNormalizedImageAssetDetails({
    id: job?.id || `imp_${slugify(draft.nameEn || source)}`,
    slug: slugify(draft.nameEn || source || "imported-product"),
    image: source,
    normalizedImageUrl: draft.normalizedImageUrl || "",
  });
  const normalizedImageUrl = normalized.url;

  if (!normalizedImageUrl) return [];
  if (normalizedImageUrl === source && !normalized.alreadyNormalized) return [];

  draft.normalizedImageUrl = normalizedImageUrl;
  draft.image = normalizedImageUrl;
  draft.gallery = dedupeStrings([normalizedImageUrl, ...(draft.gallery || [])]);
  draft.imageProcessing = {
    background: "#FFFFFF",
    objectFit: "contain",
    shadow: false,
    gradient: false,
    flatten_alpha: true,
    alphaRemoved: true,
    normalizedFrom: source,
    normalization: normalized.log,
  };
  return [
    {
      source,
      url: normalizedImageUrl,
      role: "main",
      background: "#FFFFFF",
      flatten_alpha: true,
      alpha_removed: true,
      already_normalized: Boolean(normalized.alreadyNormalized),
      metadata: normalized.log,
    },
  ];
}

async function finalizeImportPipelineDraft(draft, job, options = {}) {
  const now = new Date().toISOString();
  const sourceType = classifyCatalogSourceType(draft?.sourceUrl, draft?.brand) || "retailer";
  const evidence = rankImportEvidence(
    buildImportEvidenceFromDraft(draft, {
      rawInput: options.rawInput || job?.input,
      sourceUrl: draft?.sourceUrl || job?.sourceUrl,
      sourceType,
      usedStructuredData: draft?.importMeta?.usedStructuredData,
    }),
  );
  const classificationProduct = importDraftToClassificationProduct(draft, now);
  const classification = classifyProductForCatalog(classificationProduct, {
    now,
    existingCategories: getCatalogCategorySlugs(),
    source_snippets: evidence,
    confidenceThreshold: CLASSIFICATION_CONFIDENCE_THRESHOLD,
  });
  const normalizedImages = await normalizeImportedDraftImages(draft, job);
  const modelStepOutput = buildImportModelStepOutput(draft, evidence, {
    rawInput: options.rawInput || job?.input,
    confidence: classification.confidence_score,
  });
  const validation = validateImportModelStepOutput(modelStepOutput);
  const reviewTask = upsertReviewTask(
    buildImportReviewTask({
      job,
      draft,
      classification,
      now,
    }),
  );
  const finalizedDraft = assignImportPipelineDataToDraft(draft, {
    job,
    evidence,
    modelStepOutput,
    validation,
    classification,
    normalizedImages,
    reviewTask,
  });
  upsertImportJobLog(completeImportJobRecord(job, { draft: finalizedDraft, classification, evidence, normalizedImages, reviewTask }, now));
  return finalizedDraft;
}

function maybeQueueProductReviewTask(product, jobId = null) {
  if (!product?.categoryAssignment) return null;
  return upsertReviewTask(
    buildImportReviewTask({
      job: jobId ? { id: jobId } : null,
      productId: product.id,
      draft: {
        nameEn: product.name?.en || product.slug,
        brand: product.brand,
      },
      classification: classificationFromAssignment(product.categoryAssignment),
      now: product.updatedAt || new Date().toISOString(),
    }),
  );
}

function getBulkContext() {
  return {
    now: new Date().toISOString(),
    existingCategories: getCatalogCategorySlugs(),
  };
}

function normalizeBulkProductIds(body = {}) {
  const ids = Array.isArray(body.product_ids)
    ? body.product_ids
    : Array.isArray(body.productIds)
      ? body.productIds
      : [];
  return [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))];
}

function getProductsForBulkBody(body = {}) {
  const ids = normalizeBulkProductIds(body);
  if (!ids.length) throw new ApiError(400, "validation_error", "Select at least one product before running a bulk action.");
  const byId = new Map(db.products.map((product) => [product.id, product]));
  const bySlug = new Map(db.products.map((product) => [product.slug, product]));
  const products = ids.map((id) => byId.get(id) || bySlug.get(id)).filter(Boolean);
  if (!products.length) throw new ApiError(404, "not_found", "No selected products were found.");
  return products;
}

function getProductsForClassificationBody(body = {}) {
  const ids = normalizeBulkProductIds(body);
  if (ids.length) return getProductsForBulkBody(body);
  if (body.all === true || body.all_products === true || body.allProducts === true) return [...db.products];
  throw new ApiError(400, "validation_error", "Select products or pass all_products=true for a full dry run.");
}

function getClassificationContext(body = {}) {
  const options = body.options || {};
  return {
    now: options.now || new Date().toISOString(),
    existingCategories: getCatalogCategorySlugs(),
    confidenceThreshold: Number(options.confidence_threshold ?? CLASSIFICATION_CONFIDENCE_THRESHOLD),
    enrich_web: options.enrich_web === true,
    enrichWeb: options.enrichWeb === true,
    source_urls: options.source_urls || options.sourceUrls || [],
    source_urls_by_product: options.source_urls_by_product || options.sourceUrlsByProduct || {},
    source_snippets: options.source_snippets || options.sourceSnippets || [],
    source_snippets_by_product: options.source_snippets_by_product || options.sourceSnippetsByProduct || {},
  };
}

function serializeClassificationProduct(product) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name?.en || product.name?.ar || product.slug || product.id,
    brand: product.brand || "",
    image: product.normalizedImageUrl || product.image || "",
  };
}

function buildClassificationRow(product, classification, threshold) {
  const assignment = normalizeCategoryAssignment(product.id, classification, new Date().toISOString());
  const safe = classification.confidence_score >= threshold && !classification.needs_review;
  return {
    product_id: product.id,
    product: serializeClassificationProduct(product),
    current_assignment: {
      primary_category_slug: product.category || "",
      secondary_category_slugs: Array.isArray(product.subCategories) ? product.subCategories : [],
      confidence_score: product.confidenceScore ?? product.categoryAssignment?.confidenceScore ?? null,
      needs_review: Boolean(product.needsReview || product.categoryAssignment?.needsReview),
    },
    proposed_assignment: assignment,
    ...classification,
    safe,
  };
}

async function buildAdminClassificationPreview(body = {}) {
  const products = getProductsForClassificationBody(body);
  const context = getClassificationContext(body);
  const threshold = context.confidenceThreshold;
  const results = [];
  for (const product of products) {
    const classification =
      context.enrich_web || context.enrichWeb
        ? await classifyProductForCatalogAsync(product, context)
        : classifyProductForCatalog(product, context);
    results.push(buildClassificationRow(product, classification, threshold));
  }
  return {
    dry_run: body.dry_run !== false,
    threshold,
    selected_count: results.length,
    safe_count: results.filter((row) => row.safe).length,
    review_count: results.filter((row) => row.needs_review).length,
    conflict_count: results.filter((row) => row.classification_reason.includes("conflicts:")).length,
    results,
    quality_gates: {
      confidence_threshold: threshold,
      taxonomy_policy: "existing_edio_categories_and_secondary_terms_only",
      low_confidence_policy: "queue_for_admin_review",
      evidence_priority: [
        "official",
        "manual",
        "structured_data",
        "retailer",
        "internal",
        "community",
        "model",
      ],
    },
  };
}

async function applyAdminClassification(body = {}) {
  if (body.dry_run === true || body.options?.dry_run === true) {
    return buildAdminClassificationPreview({ ...body, dry_run: true });
  }
  const preview = await buildAdminClassificationPreview(body);
  const options = body.options || {};
  const requestedIds = new Set(
    (Array.isArray(body.change_ids) ? body.change_ids : Array.isArray(options.change_ids) ? options.change_ids : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  );
  const skipLowConfidence = options.skip_low_confidence !== false;
  const rowsToApply = preview.results.filter((row) => {
    if (requestedIds.size && !requestedIds.has(row.product_id)) return false;
    if (skipLowConfidence && !row.safe) return false;
    const product = db.products.find((item) => item.id === row.product_id);
    if (shouldPreserveAcceptedClassification(product, { force: options.force === true })) return false;
    return true;
  });
  const skippedRows = preview.results.filter((row) => !rowsToApply.some((applied) => applied.product_id === row.product_id));
  const now = new Date().toISOString();
  const before = rowsToApply
    .map((row) => db.products.find((product) => product.id === row.product_id))
    .filter(Boolean)
    .map(cloneForUndo);
  const assignments = [];
  for (const row of rowsToApply) {
    const product = db.products.find((item) => item.id === row.product_id);
    if (!product) continue;
    assignments.push(applyClassificationToProduct(product, row, now));
  }
  db.categoryAssignments = upsertCategoryAssignments(db.categoryAssignments, assignments);
  const log = addBulkActionLog({
    action: "classification_apply",
    before,
    appliedRows: rowsToApply.map((row) => ({ id: row.product_id })),
    skippedRows: skippedRows.map((row) => ({ id: row.product_id })),
    options,
    now,
  });
  await saveDatabase();
  return {
    action: "classification_apply",
    applied_count: rowsToApply.length,
    skipped_count: skippedRows.length,
    log,
    assignments,
  };
}

function getClassificationReviewQueue(searchParams) {
  const limit = Math.max(1, Math.min(200, Number(searchParams.get("limit") || 80)));
  const rows = db.products
    .filter((product) => product.needsReview || product.categoryAssignment?.needsReview || Number(product.confidenceScore || 0) < CLASSIFICATION_CONFIDENCE_THRESHOLD)
    .map((product) => ({
      product: withDerivedProduct(product),
      assignment: product.categoryAssignment || normalizeCategoryAssignment(product.id, classifyProductForCatalog(product), product.updatedAt),
    }))
    .sort((a, b) => Number(a.assignment.confidenceScore || 0) - Number(b.assignment.confidenceScore || 0))
    .slice(0, limit);
  return {
    total: rows.length,
    threshold: CLASSIFICATION_CONFIDENCE_THRESHOLD,
    items: rows,
  };
}

function buildAdminBulkPreview(body = {}) {
  const products = getProductsForBulkBody(body);
  const context = getBulkContext();
  const preview = buildBulkPreview(products, body, context);
  return {
    ...preview,
    quality_gates: {
      confidence_threshold: preview.threshold || BULK_CONFIDENCE_THRESHOLD,
      low_confidence_policy: "skip_unless_explicitly_selected",
      taxonomy_policy: "existing_edio_categories_only",
    },
  };
}

function pickRowsForApply(preview, body = {}) {
  const options = body.options || {};
  const requestedIds = new Set(
    (Array.isArray(body.change_ids) ? body.change_ids : Array.isArray(options.change_ids) ? options.change_ids : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean),
  );
  const skipLowConfidence = options.skip_low_confidence !== false;

  return preview.preview.filter((row) => {
    if (requestedIds.size && !requestedIds.has(row.id)) return false;
    if (skipLowConfidence && !row.safe) return false;
    return true;
  });
}

function cloneForUndo(product) {
  return JSON.parse(JSON.stringify(product));
}

function addBulkActionLog({ action, before, appliedRows, skippedRows, options, now }) {
  const log = {
    id: `bulk_${crypto.randomUUID()}`,
    action,
    createdAt: now,
    productIds: [...new Set([...appliedRows, ...skippedRows].map((row) => row.id))],
    appliedIds: appliedRows.map((row) => row.id),
    skippedIds: skippedRows.map((row) => row.id),
    options: options || {},
    summary: {
      selected: appliedRows.length + skippedRows.length,
      applied: appliedRows.length,
      skipped: skippedRows.length,
    },
    undo: {
      available: true,
      products: before,
    },
  };
  db.bulkActionLogs = Array.isArray(db.bulkActionLogs) ? db.bulkActionLogs : [];
  db.bulkActionLogs.unshift(log);
  db.bulkActionLogs = db.bulkActionLogs.slice(0, 100);
  return log;
}

function escapeSvgAttribute(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function createNormalizedImageAsset(product) {
  const details = await createNormalizedImageAssetDetails(product);
  return details.url;
}

async function createNormalizedImageAssetDetails(product) {
  const source = String(product.image || product.normalizedImageUrl || "").trim();
  if (!source) return { url: "", changed: false, log: null };
  if (/\/normalized-[a-f0-9]{10}\.png$/i.test(source)) {
    const localPath = resolveReadableImagePath(source);
    let log = product.imageProcessing?.normalization || null;
    if (!log && localPath && existsSync(`${localPath}.meta.json`)) {
      try {
        log = JSON.parse(readFileSync(`${localPath}.meta.json`, "utf8"));
      } catch {
        log = null;
      }
    }
    return { url: source, changed: false, alreadyNormalized: true, log };
  }

  const meta = readImageMetaFromUrl(source);
  const format = String(meta.format || extensionFromImageUrl(source) || "").toLowerCase();
  const shouldNormalize = format === "png" && (meta.transparent === true || meta.transparent === null);
  if (!shouldNormalize) return { url: source, changed: false, log: null };

  const readablePath = resolveReadableImagePath(source);
  if (!readablePath) return { url: source, changed: false, log: null };

  const seed = slugify(product.slug || product.name?.en || product.id || "product") || "product";
  const inputBuffer = readFileSync(readablePath);
  let normalized;
  try {
    normalized = normalizePngTransparencyToWhite(inputBuffer, PRODUCT_IMAGE_NORMALIZATION_POLICY);
  } catch {
    return { url: source, changed: false, log: null };
  }

  if (!normalized.changed) {
    return { url: source, changed: false, log: normalized.log };
  }

  const hash = crypto
    .createHash("sha1")
    .update(Buffer.concat([Buffer.from(`${product.id || ""}:${source}:white-bitmap:`), normalized.buffer]))
    .digest("hex")
    .slice(0, 10);
  const filename = `${seed}-normalized-${hash}.png`;
  const filePath = path.join(IMPORT_MEDIA_DIR, filename);
  if (!existsSync(filePath)) {
    await writeFile(filePath, normalized.buffer);
    await writeFile(`${filePath}.meta.json`, JSON.stringify(normalized.log, null, 2));
  }
  const url = `/media/imports/${filename}`;
  const log = {
    ...normalized.log,
    source,
    outputUrl: url,
  };
  if (product && typeof product === "object") {
    product.imageProcessing = {
      ...(product.imageProcessing || {}),
      background: PRODUCT_IMAGE_NORMALIZATION_POLICY.background,
      objectFit: "contain",
      shadow: false,
      gradient: false,
      flatten_alpha: true,
      alphaRemoved: true,
      normalizedFrom: source,
      normalization: log,
    };
  }
  return { url, changed: true, log };
}

async function applyAdminBulkAction(body = {}) {
  const preview = buildAdminBulkPreview(body);
  const action = preview.action;
  const options = body.options || {};
  const rowsToApply = pickRowsForApply(preview, body);
  const rowIds = new Set(rowsToApply.map((row) => row.id));
  const skippedRows = preview.preview.filter((row) => !rowIds.has(row.id));
  const now = new Date().toISOString();
  const before = rowsToApply
    .map((row) => db.products.find((product) => product.id === row.id))
    .filter(Boolean)
    .map(cloneForUndo);

  if (action === "delete" && options.confirm_delete !== true) {
    throw new ApiError(400, "confirmation_required", "Deleting selected products requires explicit confirmation.");
  }

  if (action === "export_selected") {
    const exported = rowsToApply
      .map((row) => db.products.find((product) => product.id === row.id))
      .filter(Boolean)
      .map(withDerivedProduct);
    const log = addBulkActionLog({ action, before: [], appliedRows: rowsToApply, skippedRows, options, now });
    return {
      action,
      applied_count: exported.length,
      skipped_count: skippedRows.length,
      log,
      export: exported,
    };
  }

  if (action === "delete") {
    const idsToDelete = new Set(rowsToApply.map((row) => row.id));
    db.products = db.products.filter((product) => !idsToDelete.has(product.id));
    db.categoryAssignments = (db.categoryAssignments || []).filter((assignment) => !idsToDelete.has(assignment.productId));
    const log = addBulkActionLog({ action, before, appliedRows: rowsToApply, skippedRows, options, now });
    await saveDatabase();
    return {
      action,
      applied_count: rowsToApply.length,
      skipped_count: skippedRows.length,
      log,
    };
  }

  for (const row of rowsToApply) {
    const product = db.products.find((item) => item.id === row.id);
    if (!product) continue;
    if (action === "normalize_images") {
      const normalized = await createNormalizedImageAssetDetails(product);
      if (normalized.url) {
        row.changes = {
          ...row.changes,
          normalizedImageUrl: normalized.url,
          image: normalized.url,
          imageProcessing: {
            background: "#FFFFFF",
            objectFit: "contain",
            shadow: false,
            gradient: false,
            flatten_alpha: Boolean(normalized.changed),
            alphaRemoved: Boolean(normalized.changed),
            normalization: normalized.log,
          },
        };
      }
    }
    applyPreviewChangesToProduct(product, row, now);
    if (product.categoryAssignment) {
      db.categoryAssignments = upsertCategoryAssignments(db.categoryAssignments, [product.categoryAssignment]);
    }
  }

  const log = addBulkActionLog({ action, before, appliedRows: rowsToApply, skippedRows, options, now });
  await saveDatabase();
  return {
    action,
    applied_count: rowsToApply.length,
    skipped_count: skippedRows.length,
    log,
  };
}

async function undoAdminBulkAction(logId) {
  const id = String(logId || "").trim();
  if (!id) throw new ApiError(400, "validation_error", "Bulk action log id is required.");
  const log = (db.bulkActionLogs || []).find((item) => item.id === id);
  if (!log?.undo?.available || !Array.isArray(log.undo.products)) {
    throw new ApiError(404, "not_found", "No undo snapshot is available for this bulk action.");
  }

  const restoredIds = [];
  for (const snapshot of log.undo.products) {
    const index = db.products.findIndex((product) => product.id === snapshot.id);
    if (index >= 0) db.products[index] = snapshot;
    else db.products.unshift(snapshot);
    if (snapshot.categoryAssignment) {
      db.categoryAssignments = upsertCategoryAssignments(db.categoryAssignments, [snapshot.categoryAssignment]);
    }
    restoredIds.push(snapshot.id);
  }
  log.undo.available = false;
  log.undoneAt = new Date().toISOString();
  await saveDatabase();
  return { restoredIds, log };
}

function filterProducts(products, searchParams, options = {}) {
  const query = (searchParams.get("q") || searchParams.get("search") || "").trim().toLowerCase();
  const category = searchParams.get("category") || searchParams.get("cat");
  const categoryTerm = searchParams.get("subcategory") || searchParams.get("term") || searchParams.get("f");
  const brand = searchParams.get("brand");
  const badge = searchParams.get("badge");
  const preowned = searchParams.get("preowned");
  const inStock = searchParams.get("inStock");
  const min = Number(searchParams.get("min") || searchParams.get("minPrice") || 0);
  const max = Number(searchParams.get("max") || searchParams.get("maxPrice") || 0);
  const sort = searchParams.get("sort") || "featured";

  let result = [...products]
    .filter((product) => options.includeUnpublished || isStorefrontVisibleProduct(product))
    .map(withDerivedProduct);

  if (query) {
    result = result.filter((product) => {
      const haystack = [
        product.name?.en,
        product.name?.ar,
        product.brand,
        product.category,
        product.tagline?.en,
        product.tagline?.ar,
        ...(product.subCategories || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  if (category) {
    result = result.filter((product) =>
      categoryTerm
        ? productMatchesCategoryTerm(product, category, categoryTerm)
        : normalizeProductCategory(product) === normalizeProductCategory({ category }),
    );
  }
  if (brand) result = result.filter((product) => sameKey(product.brand, brand));
  if (badge) result = result.filter((product) => product.badge === badge);
  if (preowned === "true") result = result.filter((product) => product.badge === "preowned" || product.category === "preowned");
  if (inStock === "true") result = result.filter((product) => product.inStock);
  if (min > 0) result = result.filter((product) => product.price >= min);
  if (max > 0) result = result.filter((product) => product.price <= max);

  return sortProducts(result, sort);
}

function sortProducts(products, sort) {
  const result = [...products];
  switch (sort) {
    case "newest":
    case "new":
      return result.sort(byCreatedDesc);
    case "price-asc":
    case "price-low":
      return result.sort((a, b) => a.price - b.price);
    case "price-desc":
    case "price-high":
      return result.sort((a, b) => b.price - a.price);
    case "best":
    case "best-selling":
      return result.sort((a, b) => Number(b.sales || 0) - Number(a.sales || 0));
    case "featured":
    default:
      return result.sort((a, b) => rankProduct(b) - rankProduct(a));
  }
}

function rankProduct(product) {
  const badgeRank = { best: 6, featured: 5, new: 4, preowned: 3 };
  return (badgeRank[getEffectiveBadge(product)] || 1) * 1000 + Number(product.sales || 0);
}

function paginate(items, searchParams) {
  const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") || 24)));
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const offset = Math.max(0, Number(searchParams.get("offset") || (page - 1) * limit));
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    limit,
    offset,
    page,
    hasMore: offset + limit < items.length,
  };
}

function listCollections() {
  return COLLECTION_DEFINITIONS.map((definition) => {
    const products = collectProducts(definition, new URLSearchParams());
    return {
      slug: definition.slug,
      title: definition.title,
      description: definition.description,
      total: products.length,
      sort: definition.sort,
    };
  });
}

function getCollection(rawSlug, searchParams) {
  const definition = resolveCollection(rawSlug);
  if (!definition) throw new ApiError(404, "not_found", "Collection not found");
  const products = collectProducts(definition, searchParams);
  const result = paginate(products, searchParams);
  return {
    slug: definition.slug,
    title: definition.title,
    description: definition.description,
    sort: searchParams.get("sort") || definition.sort,
    ...result,
    items: result.items.map(withPublicInventoryProduct),
  };
}

function listBrands() {
  const seen = new Map();
  for (const product of db.products.filter(isStorefrontVisibleProduct)) {
    const key = keyify(product.brand);
    if (HIDDEN_BRAND_KEYS.has(key)) continue;
    if (!seen.has(key)) {
      seen.set(key, {
        name: product.brand,
        slug: slugify(product.brand),
        key,
        productCount: 0,
        categories: new Set(),
        logo: getBrandLogoPath(product.brand),
      });
    }
    const brand = seen.get(key);
    brand.productCount += 1;
    brand.categories.add(normalizeProductCategory(product));
  }

  return [...seen.values()]
    .map((brand) => ({ ...brand, categories: [...brand.categories].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getBrand(value) {
  const key = keyify(value);
  const brand = listBrands().find((item) => item.key === key || item.slug === value);
  if (!brand) return null;
  const products = db.products.filter((product) => isStorefrontVisibleProduct(product) && sameKey(product.brand, brand.name)).map(withDerivedProduct);
  return {
    ...brand,
    description: `${brand.name} products available at EDIO, curated from the pieces we currently carry.`,
    products: sortProducts(products, "newest").map(withPublicInventoryProduct),
  };
}

function withCategoryCounts(category) {
  return {
    ...category,
    productCount: db.products.filter((product) => isStorefrontVisibleProduct(product) && normalizeProductCategory(product) === category.slug).length,
    terms: flattenCategoryTerms(category.slug, false).map((term) => ({
      slug: term.slug,
      productCount: db.products.filter((product) => isStorefrontVisibleProduct(product) && productMatchesCategoryTerm(product, category.slug, term.slug)).length,
    })),
  };
}

function findProduct(value) {
  return db.products.find((product) => product.id === value || product.slug === value);
}

function getBrandLogoPath(brand) {
  return BRAND_LOGOS[keyify(brand)] || "";
}

function resolveCollection(rawSlug) {
  const slug = String(rawSlug || "").trim().toLowerCase();
  return COLLECTION_DEFINITIONS.find((item) => item.slug === slug || item.aliases?.includes(slug)) || null;
}

function collectProducts(definition, searchParams) {
  const nextParams = new URLSearchParams(searchParams);
  if (!nextParams.get("sort") && definition.sort) nextParams.set("sort", definition.sort);
  if (definition.preowned) nextParams.set("preowned", "true");
  if (definition.badge) nextParams.set("badge", definition.badge);
  if (definition.inStock) nextParams.set("inStock", "true");
  let products = filterProducts(db.products, nextParams);
  if (definition.saleOnly) {
    products = products.filter((product) => Number(product.compareAt || 0) > Number(product.price || 0));
  }
  if (definition.outOfStock) {
    products = products.filter((product) => !product.inStock || Number(product.stock || 0) <= 0);
  }
  return products;
}

function getCurrencyMeta() {
  return {
    base: "IQD",
    supported: SUPPORTED_CURRENCIES,
    iqdPerUsd: IQD_PER_USD,
    rates: {
      IQD: 1,
      USD: Number((1 / IQD_PER_USD).toFixed(6)),
    },
  };
}

function normalizeCurrency(value) {
  return String(value || "").trim().toUpperCase();
}

function getConversionRate(from, to) {
  if (from === to) return 1;
  if (from === "IQD" && to === "USD") return Number((1 / IQD_PER_USD).toFixed(6));
  if (from === "USD" && to === "IQD") return IQD_PER_USD;
  throw new ApiError(400, "validation_error", "Unsupported currency conversion");
}

function convertCurrency(amount, from, to) {
  if (from === to) return amount;
  const rate = getConversionRate(from, to);
  if (to === "IQD") return Math.round(amount * rate);
  return Number((amount * rate).toFixed(2));
}

function roundIqdCommercial(amount) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.max(5000, Math.round(numeric / 5000) * 5000);
}

function roundUsdCommercial(amount) {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  if (numeric <= 9) return 9;
  if (numeric < 100) return Math.max(9, Math.round(numeric / 10) * 10 - 1);
  if (numeric < 500) return Math.max(19, Math.round(numeric / 10) * 10 - 1);
  if (numeric < 1000) return Math.max(99, Math.round(numeric / 25) * 25 - 1);
  return Math.max(99, Math.round(numeric / 50) * 50 - 1);
}

function normalizeCommercialPricePair({ iqd = null, usd = null }) {
  const nextUsd = usd !== null ? roundUsdCommercial(usd) : null;
  if (nextUsd !== null) {
    return {
      iqd: roundIqdCommercial(convertCurrency(nextUsd, "USD", "IQD")),
      usd: nextUsd,
    };
  }

  const nextIqd = iqd !== null ? roundIqdCommercial(iqd) : null;
  if (nextIqd !== null) {
    return {
      iqd: nextIqd,
      usd: roundUsdCommercial(convertCurrency(nextIqd, "IQD", "USD")),
    };
  }

  return { iqd: null, usd: null };
}

async function register(body, req) {
  const payload = validateRegistrationBody(body);
  const existing = db.users.find((user) => user.emailCanonical === payload.emailCanonical || user.email === payload.emailCanonical);
  if (existing) {
    writeAuditLog({
      req,
      action: "auth.register.duplicate",
      targetType: "user",
      targetId: existing.id,
      afterState: { emailCanonical: payload.emailCanonical },
    });
    await saveDatabase();
    return null;
  }

  const user = createUserRecord(payload, { emailVerified: false, status: "unverified" });
  db.users.push(user);
  ensureAccountRelations(db, user);
  recordUserConsent(user.id, body, req);
  await issueEmailVerificationToken(user, req);
  writeAuditLog({ req, actorUserId: user.id, action: "auth.register", targetType: "user", targetId: user.id, afterState: publicUser(user) });
  await saveDatabase();
  return user;
}

async function signup(body, req) {
  const payload = validateRegistrationBody(body, { minPasswordLength: 6 });
  if (db.users.some((user) => user.emailCanonical === payload.emailCanonical || user.email === payload.emailCanonical)) {
    writeAuditLog({
      req,
      action: "auth.signup.duplicate",
      targetType: "user",
      afterState: { emailCanonical: payload.emailCanonical },
    });
    await saveDatabase();
    return null;
  }

  const user = createUserRecord(payload, { emailVerified: false, status: "unverified" });
  db.users.push(user);
  ensureAccountRelations(db, user);
  recordUserConsent(user.id, body, req);
  await issueEmailVerificationToken(user, req);
  writeAuditLog({ req, actorUserId: user.id, action: "auth.signup", targetType: "user", targetId: user.id, afterState: publicUser(user) });
  await saveDatabase();
  return user;
}

async function reauthenticateUser(user, body, req) {
  enforceAuthRateLimit(req, `reauth:${user.id}`);
  requireRecentPassword(user, body.currentPassword || body.password);
  const session = getCurrentSession(req);
  if (session) {
    session.lastReauthenticatedAt = new Date().toISOString();
    session.lastSeenAt = session.lastReauthenticatedAt;
  }
  writeAuditLog({
    req,
    actorUserId: user.id,
    action: "auth.reauthenticated",
    targetType: "session",
    targetId: session?.id || null,
  });
  await saveDatabase();
}

async function login(body, req) {
  const email = normalizeEmail(body.email);
  const password = requireString(body.password, "password");
  if (!email) throw new ApiError(400, "validation_error", "Email is required");
  enforceAuthRateLimit(req, `login:${email}`);

  const user = db.users.find((item) => item.emailCanonical === email || item.email === email);
  if (!user || !verifyPassword(password, user)) {
    writeAuditLog({
      req,
      action: "auth.login.failed",
      targetType: "user",
      targetId: user?.id || null,
      afterState: { emailCanonical: email, reason: "invalid_credentials" },
    });
    await saveDatabase();
    throw new ApiError(401, "invalid_credentials", "Invalid email or password");
  }
  if (isUserDisabled(user)) {
    writeAuditLog({
      req,
      actorUserId: user.id,
      action: "auth.login.failed",
      targetType: "user",
      targetId: user.id,
      afterState: { reason: "disabled" },
    });
    await saveDatabase();
    throw new ApiError(403, "user_disabled", "This user is disabled");
  }

  user.lastLoginAt = new Date().toISOString();
  user.updatedAt = user.updatedAt || user.lastLoginAt;
  writeAuditLog({ req, actorUserId: user.id, action: "auth.login.success", targetType: "user", targetId: user.id });
  await saveDatabase();
  return user;
}

async function completeOAuthLogin(provider, params, req) {
  if (params.error) {
    throw new ApiError(400, "provider_error", "The sign-in provider could not complete authentication.");
  }
  const code = requireString(params.code, "code");
  const state = requireString(params.state, "state");
  const storedState = consumeOAuthState({
    cookieValue: getCookieValue(req, OAUTH_STATE_COOKIE),
    provider,
    state,
    secret: JWT_SECRET,
  });
  if (!storedState) throw new ApiError(400, "invalid_state", "Sign-in session expired. Try again.");
  const config = getOAuthProviderConfig(provider, process.env, getPublicBaseUrl(req));
  if (!config) throw new ApiError(503, "provider_not_configured", "This sign-in provider is not configured yet.");

  const tokenSet = await exchangeOAuthCode(config, code);
  const claims = await verifyOAuthIdToken(tokenSet.id_token, config, storedState.nonce);
  const profile = normalizeProviderProfile(provider, claims, params.user);
  const user = await findOrCreateOAuthUser(profile, req);
  user.lastLoginAt = new Date().toISOString();
  user.updatedAt = user.lastLoginAt;
  writeAuditLog({
    req,
    actorUserId: user.id,
    action: "auth.oauth.login.success",
    targetType: "user",
    targetId: user.id,
    afterState: { provider, identityLinked: true },
  });
  await saveDatabase();
  return { user, redirectTo: storedState.redirectTo };
}

async function findOrCreateOAuthUser(profile, req) {
  if (!profile.providerAccountId) throw new ApiError(400, "provider_error", "Provider account is missing.");
  const existingIdentity = db.authIdentities.find(
    (identity) =>
      identity.provider === profile.provider &&
      identity.providerUserId === profile.providerAccountId &&
      !identity.revokedAt,
  );
  if (existingIdentity) {
    const user = db.users.find((item) => item.id === existingIdentity.userId);
    if (!user || isUserDisabled(user)) throw new ApiError(403, "user_disabled", "This user is disabled");
    updateOAuthIdentity(existingIdentity, profile);
    return user;
  }

  if (!profile.email || !isValidEmail(profile.email)) {
    throw new ApiError(400, "email_missing", "The sign-in provider did not return a usable email.");
  }
  if (!profile.emailVerified) {
    throw new ApiError(409, "account_link_conflict", "The sign-in provider did not verify this email.");
  }

  let user = db.users.find((item) => item.emailCanonical === profile.email || item.email === profile.email);
  if (user) {
    if (isUserDisabled(user)) throw new ApiError(403, "user_disabled", "This user is disabled");
    if (!user.emailVerified) {
      user.emailVerified = true;
      if (user.status === "unverified") user.status = "active";
    }
    if (!user.avatarUrl && profile.avatarUrl) user.avatarUrl = profile.avatarUrl;
    if ((!user.fullName || user.fullName === user.email) && profile.fullName) user.fullName = profile.fullName;
    user.updatedAt = new Date().toISOString();
  } else {
    user = createOAuthUserRecord(profile);
    db.users.push(user);
  }

  ensureAccountRelations(db, user);
  linkOAuthIdentity(user, profile);
  syncCustomerProfileFromUser(user);
  writeAuditLog({
    req,
    actorUserId: user.id,
    action: "auth.oauth.identity.linked",
    targetType: "user",
    targetId: user.id,
    afterState: { provider: profile.provider, email: profile.email, role: user.role },
  });
  return user;
}

function createOAuthUserRecord(profile) {
  const now = new Date().toISOString();
  return normalizeUserRecord({
    id: `usr_${crypto.randomUUID()}`,
    email: profile.email,
    emailCanonical: profile.email,
    emailVerified: true,
    fullName: profile.fullName || profile.email.split("@")[0],
    phone: "",
    phoneE164: "",
    avatarUrl: profile.avatarUrl || "",
    role: "customer",
    status: "active",
    banned: false,
    locale: "en",
    currency: "IQD",
    lastLoginAt: null,
    deletedAt: null,
    passwordLoginDisabled: true,
    createdAt: now,
    updatedAt: now,
  });
}

function linkOAuthIdentity(user, profile) {
  const existing = db.authIdentities.find(
    (identity) =>
      identity.userId === user.id &&
      identity.provider === profile.provider &&
      identity.providerUserId === profile.providerAccountId,
  );
  if (existing) {
    updateOAuthIdentity(existing, profile);
    return existing;
  }
  const now = new Date().toISOString();
  const identity = {
    id: `aid_${crypto.randomUUID()}`,
    userId: user.id,
    provider: profile.provider,
    providerUserId: profile.providerAccountId,
    label: `${profile.provider === "google" ? "Google" : "Apple"} login`,
    email: profile.email,
    emailVerified: profile.emailVerified,
    avatarUrl: profile.avatarUrl || "",
    createdAt: now,
    updatedAt: now,
    revokedAt: null,
  };
  db.authIdentities.push(identity);
  return identity;
}

function updateOAuthIdentity(identity, profile) {
  identity.email = profile.email || identity.email || "";
  identity.emailVerified = Boolean(profile.emailVerified || identity.emailVerified);
  identity.avatarUrl = profile.avatarUrl || identity.avatarUrl || "";
  identity.updatedAt = new Date().toISOString();
  return identity;
}

async function updateUserProfile(userId, body, req) {
  assertNoForbiddenFields(body);
  const user = db.users.find((item) => item.id === userId);
  if (!user) throw new ApiError(404, "not_found", "User not found");
  const before = publicUser(user);

  if (body.email !== undefined && normalizeEmail(body.email) !== user.emailCanonical) {
    requireRecentPassword(user, body.currentPassword);
    const nextEmail = normalizeEmail(body.email);
    if (!isValidEmail(nextEmail)) throw new ApiError(400, "validation_error", "A valid email is required");
    if (db.users.some((item) => item.id !== user.id && item.emailCanonical === nextEmail)) {
      throw new ApiError(409, "email_exists", "Email is already registered");
    }
    user.email = nextEmail;
    user.emailCanonical = nextEmail;
    user.emailVerified = false;
    user.status = "unverified";
    db.userEmails.forEach((email) => {
      if (email.userId === user.id) email.isPrimary = false;
    });
    db.userEmails.push({
      id: `uem_${crypto.randomUUID()}`,
      userId: user.id,
      email: user.email,
      normalizedEmail: user.emailCanonical,
      verifiedAt: null,
      isPrimary: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await issueEmailVerificationToken(user, req);
  }
  if (body.fullName !== undefined) user.fullName = requireCleanString(body.fullName, "fullName", 120);
  if (body.phone !== undefined) user.phone = sanitizePlainText(body.phone, { max: 40 });
  if (body.phoneE164 !== undefined) user.phoneE164 = sanitizePlainText(body.phoneE164, { max: 40 });
  if (body.avatarUrl !== undefined) user.avatarUrl = sanitizePlainText(body.avatarUrl, { max: 500 });
  if (body.locale !== undefined) user.locale = sanitizePlainText(body.locale || "en", { max: 12 });
  if (body.currency !== undefined && SUPPORTED_CURRENCIES.includes(body.currency)) user.currency = body.currency;
  if (body.password !== undefined) {
    requireRecentPassword(user, body.currentPassword);
    const password = requireString(body.password, "password");
    assertStrongPassword(password);
    Object.assign(user, hashPassword(password));
    upsertAuthPassword(user);
    revokeUserSessions(user.id);
  }
  user.updatedAt = new Date().toISOString();
  syncCustomerProfileFromUser(user);
  writeAuditLog({
    req,
    actorUserId: user.id,
    action: body.password !== undefined ? "user.profile.password_updated" : "user.profile.updated",
    targetType: "user",
    targetId: user.id,
    beforeState: before,
    afterState: publicUser(user),
  });
  await saveDatabase();
  return user;
}

function syncCustomerProfileFromUser(user) {
  ensureAccountRelations(db, user);
  const profile = db.customerProfiles.find((item) => item.userId === user.id);
  const [firstName = "", ...rest] = String(user.fullName || "").split(/\s+/).filter(Boolean);
  Object.assign(profile, {
    firstName,
    lastName: rest.join(" "),
    fullName: user.fullName,
    phoneE164: user.phoneE164 || user.phone || "",
    avatarUrl: user.avatarUrl || "",
    locale: user.locale || "en",
    language: user.locale || "en",
    currency: user.currency || "IQD",
    updatedAt: user.updatedAt,
  });
  const preferences = db.userPreferences.find((item) => item.userId === user.id);
  if (preferences) {
    preferences.locale = user.locale || preferences.locale;
    preferences.language = user.locale || preferences.language;
    preferences.currency = user.currency || preferences.currency;
    preferences.updatedAt = user.updatedAt;
  }
}

function getCustomerAccount(user) {
  ensureAccountRelations(db, user);
  const profile = getCustomerProfile(user.id);
  const preferences = db.userPreferences.find((item) => item.userId === user.id) || null;
  const emails = db.userEmails
    .filter((item) => item.userId === user.id)
    .map(({ id, email, normalizedEmail, verifiedAt, isPrimary, createdAt, updatedAt }) => ({
      id,
      email,
      normalizedEmail,
      verifiedAt,
      isPrimary,
      createdAt,
      updatedAt,
    }));
  return {
    user: publicUser(user),
    profile,
    emails,
    preferences,
    consents: db.userConsents.filter((item) => item.userId === user.id),
    addresses: listUserAddresses(user.id),
    sessions: listUserSessions(user.id),
    authIdentities: listUserAuthIdentities(user.id),
  };
}

function getCustomerProfile(userId) {
  const user = db.users.find((item) => item.id === userId);
  if (!user) return null;
  ensureAccountRelations(db, user);
  const profile = db.customerProfiles.find((item) => item.userId === userId);
  if (!profile) return null;
  return {
    id: profile.id,
    userId: profile.userId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    fullName: profile.fullName,
    phoneE164: profile.phoneE164,
    avatarUrl: profile.avatarUrl,
    locale: profile.locale,
    language: profile.language,
    currency: profile.currency,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function listUserAuthIdentities(userId) {
  const hasPassword = db.authPasswords.some((item) => item.userId === userId);
  const passkeys = db.authPasskeys.filter((item) => item.userId === userId && !item.revokedAt);
  const oauthIdentities = db.authIdentities.filter(
    (item) => item.userId === userId && ["google", "apple"].includes(item.provider) && !item.revokedAt,
  );
  return [
    ...(hasPassword ? [{ type: "password", label: "Email and password", enabled: true }] : []),
    ...oauthIdentities.map((identity) => ({
      type: "oauth",
      provider: identity.provider,
      id: identity.id,
      label: identity.label || `${identity.provider} login`,
      email: identity.email || null,
      createdAt: identity.createdAt,
      lastUsedAt: identity.updatedAt || null,
    })),
    ...passkeys.map((passkey) => ({
      type: "passkey",
      id: passkey.id,
      label: passkey.label || "Passkey",
      createdAt: passkey.createdAt,
      lastUsedAt: passkey.lastUsedAt || null,
    })),
  ];
}

function requireRecentPassword(user, password) {
  if (!password || !verifyPassword(String(password), user)) {
    throw new ApiError(403, "reauth_required", "Re-authentication is required for this change");
  }
}

function recordUserConsent(userId, body, req) {
  const accepted =
    body.acceptTerms === true ||
    body.termsAccepted === true ||
    body.legalAccepted === true ||
    body.accept === true;
  if (!accepted) return null;
  const now = new Date().toISOString();
  const consent = {
    id: `ucn_${crypto.randomUUID()}`,
    userId,
    type: "terms_privacy",
    version: String(body.termsVersion || body.privacyVersion || "edio-local-v1"),
    accepted: true,
    acceptedAt: now,
    createdAt: now,
    requestId: getRequestId(req),
    ipHash: hashClientIp(req),
  };
  db.userConsents.push(consent);
  return consent;
}

function validateRegistrationBody(body, options = {}) {
  assertNoForbiddenFields(body);
  const email = normalizeEmail(body.email);
  const fullName = sanitizePlainText(body.fullName || body.firstName || body.name || email.split("@")[0] || "", { max: 120 });
  const password = requireString(body.password, "password");
  if (!isValidEmail(email)) throw new ApiError(400, "validation_error", "A valid email is required");
  if (!fullName) throw new ApiError(400, "validation_error", "A name or email is required");
  assertStrongPassword(password, options.minPasswordLength || 8);
  return {
    email,
    emailCanonical: email,
    fullName,
    password,
    phone: sanitizePlainText(body.phone || "", { max: 40 }),
    phoneE164: sanitizePlainText(body.phoneE164 || (String(body.phone || "").startsWith("+") ? body.phone : ""), { max: 40 }),
    avatarUrl: sanitizePlainText(body.avatarUrl || "", { max: 500 }),
    locale: sanitizePlainText(body.locale || "en", { max: 12 }),
    currency: SUPPORTED_CURRENCIES.includes(body.currency) ? body.currency : "IQD",
  };
}

function createUserRecord(payload, options = {}) {
  const now = new Date().toISOString();
  return normalizeUserRecord({
    id: `usr_${crypto.randomUUID()}`,
    email: payload.email,
    emailCanonical: payload.emailCanonical,
    emailVerified: Boolean(options.emailVerified),
    fullName: payload.fullName,
    phone: payload.phone,
    phoneE164: payload.phoneE164,
    avatarUrl: payload.avatarUrl,
    role: "customer",
    status: options.status || (options.emailVerified ? "active" : "unverified"),
    banned: false,
    locale: payload.locale,
    currency: payload.currency,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    deletedAt: null,
    ...hashPassword(payload.password),
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

function assertStrongPassword(password, minLength = 8) {
  if (String(password || "").length < minLength) {
    throw new ApiError(400, "validation_error", `Password must be at least ${minLength} characters`);
  }
}

function isUserDisabled(user) {
  return Boolean(user?.banned || user?.status === "disabled" || user?.status === "deleted" || user?.deletedAt);
}

async function issueEmailVerificationToken(user, req) {
  const rawToken = randomAuthToken();
  const now = new Date();
  db.emailVerificationTokens.push({
    id: `evt_${crypto.randomUUID()}`,
    userId: user.id,
    tokenHash: hashAuthToken(rawToken),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS).toISOString(),
    usedAt: null,
    requestId: getRequestId(req),
  });
  queueAuthEmail("email_verification", user, rawToken, req);
  return rawToken;
}

async function verifyEmailToken(rawToken, req) {
  const token = consumeAuthToken(db.emailVerificationTokens, rawToken, "invalid_verification_token");
  const user = db.users.find((item) => item.id === token.userId);
  if (!user) throw new ApiError(400, "invalid_verification_token", "Verification token is invalid or expired");
  const before = publicUser(user);
  user.emailVerified = true;
  if (user.status === "unverified") user.status = "active";
  user.updatedAt = new Date().toISOString();
  writeAuditLog({
    req,
    actorUserId: user.id,
    action: "auth.email.verified",
    targetType: "user",
    targetId: user.id,
    beforeState: before,
    afterState: publicUser(user),
  });
  await saveDatabase();
  return user;
}

async function requestPasswordReset(emailInput, req) {
  const email = normalizeEmail(emailInput);
  if (!isValidEmail(email)) return;
  enforceAuthRateLimit(req, `password-reset:${email}`);
  const user = db.users.find((item) => item.emailCanonical === email || item.email === email);
  if (!user || isUserDisabled(user)) {
    writeAuditLog({ req, action: "auth.password_reset.requested", targetType: "user", afterState: { emailCanonical: email, delivered: false } });
    await saveDatabase();
    return;
  }
  const rawToken = randomAuthToken();
  const now = new Date();
  db.passwordResetTokens.push({
    id: `prt_${crypto.randomUUID()}`,
    userId: user.id,
    tokenHash: hashAuthToken(rawToken),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS).toISOString(),
    usedAt: null,
    requestId: getRequestId(req),
  });
  queueAuthEmail("password_reset", user, rawToken, req);
  writeAuditLog({
    req,
    actorUserId: user.id,
    action: "auth.password_reset.requested",
    targetType: "user",
    targetId: user.id,
    afterState: { delivered: true },
  });
  await saveDatabase();
}

async function resetPassword(body, req) {
  const password = requireString(body.password || body.newPassword, "password");
  assertStrongPassword(password, body.email ? 6 : 8);
  let user = null;
  let token = null;

  if (body.token) {
    token = consumeAuthToken(db.passwordResetTokens, body.token, "invalid_reset_token");
    user = db.users.find((item) => item.id === token.userId);
  } else if (body.email) {
    const email = normalizeEmail(body.email);
    user = db.users.find((item) => item.emailCanonical === email || item.email === email);
  }

  if (!user || isUserDisabled(user)) throw new ApiError(400, "invalid_reset_token", "Reset token is invalid or expired");
  Object.assign(user, hashPassword(password));
  upsertAuthPassword(user);
  user.updatedAt = new Date().toISOString();
  revokeUserSessions(user.id);
  writeAuditLog({
    req,
    actorUserId: user.id,
    action: "auth.password_reset.completed",
    targetType: "user",
    targetId: user.id,
    afterState: { sessionsRevoked: true, tokenId: token?.id || null },
  });
  queueAuthEmail("password_changed", user, null, req);
  await saveDatabase();
}

function consumeAuthToken(collection, rawToken, errorCode) {
  const tokenHash = hashAuthToken(requireString(rawToken, "token"));
  const token = collection.find((item) => item.tokenHash === tokenHash);
  if (!token || token.usedAt || new Date(token.expiresAt).getTime() < Date.now()) {
    throw new ApiError(400, errorCode, "Token is invalid or expired");
  }
  token.usedAt = new Date().toISOString();
  return token;
}

function queueAuthEmail(type, user, token, req) {
  const baseUrl = String(process.env.PUBLIC_APP_URL || req?.headers?.origin || "http://127.0.0.1:8080").replace(/\/$/, "");
  const pathByType = {
    email_verification: "/verify-email",
    password_reset: "/reset-password",
    password_changed: "/account/security",
  };
  db.emailOutbox.push({
    id: `email_${crypto.randomUUID()}`,
    type,
    to: user.email,
    userId: user.id,
    link: token ? `${baseUrl}${pathByType[type]}?token=${encodeURIComponent(token)}` : `${baseUrl}${pathByType[type]}`,
    createdAt: new Date().toISOString(),
    status: process.env.EDIO_EMAIL_PROVIDER ? "queued" : "development_outbox",
  });
}

function getCart(userId) {
  const cart = db.carts[userId] || { items: [], couponCode: null };
  return enrichCart(cart);
}

async function setCart(userId, items, couponCode) {
  if (!Array.isArray(items)) throw new ApiError(400, "validation_error", "Cart items must be an array");
  const normalized = normalizeCartItems(items);
  const subtotal = normalized.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const coupon = couponCode ? validateCoupon(couponCode, subtotal).coupon : null;
  db.carts[userId] = {
    items: normalized.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
    couponCode: coupon?.code || null,
    updatedAt: new Date().toISOString(),
  };
  await saveDatabase();
  return enrichCart(db.carts[userId]);
}

function enrichCart(cart) {
  const items = normalizeCartItems(cart.items || []);
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const couponResult = cart.couponCode ? validateCoupon(cart.couponCode, subtotal, true) : null;
  const discount = couponResult?.ok ? calculateDiscount(couponResult.coupon, subtotal) : 0;
  const afterDiscount = Math.max(0, subtotal - discount);
  const shipping = afterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  return {
    items: items.map((item) => ({ ...item, product: withPublicInventoryProduct(item.product) })),
    coupon: couponResult?.ok ? couponResult.coupon : null,
    subtotal,
    discount,
    shipping,
    total: afterDiscount + shipping,
  };
}

function normalizeCartItems(items) {
  return items
    .map((item) => {
      const productId = String(item.productId || item.id || "");
      const product = findProduct(productId);
      const quantity = Math.max(1, Math.min(99, Number(item.quantity || item.qty || 1)));
      return product ? { product, quantity } : null;
    })
    .filter(Boolean);
}

function validateCoupon(rawCode, subtotal, quiet = false) {
  const code = String(rawCode || "").trim().toUpperCase();
  const coupon = db.coupons.find((item) => item.code === code && item.active);
  if (!coupon) {
    if (quiet) return { ok: false, error: "invalid" };
    throw new ApiError(404, "invalid_coupon", "Invalid coupon code");
  }
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) {
    if (quiet) return { ok: false, error: "minSubtotal" };
    throw new ApiError(400, "coupon_min_subtotal", "Subtotal is too low for this coupon");
  }
  return {
    ok: true,
    coupon: publicCoupon(coupon),
    discount: calculateDiscount(coupon, subtotal),
    subtotal,
  };
}

function calculateDiscount(coupon, subtotal) {
  if (!coupon) return 0;
  if (coupon.type === "percent") return Math.round((subtotal * coupon.value) / 100);
  return Math.min(coupon.value, subtotal);
}

async function createOrder(body, user) {
  assertNoForbiddenFields(body);
  const items = normalizeCartItems(body.items || []);
  if (!items.length) throw new ApiError(400, "validation_error", "Order requires at least one valid item");

  const customer = body.customer || {};
  const fullName = sanitizePlainText(user?.fullName || [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.fullName || customer.name, { max: 120 });
  const email = user?.email || normalizeEmail(customer.email);
  const phone = sanitizePlainText(user?.phone || customer.phone, { max: 40 });
  if (!fullName) throw new ApiError(400, "validation_error", "Customer name is required");
  if (!email) throw new ApiError(400, "validation_error", "Customer email is required");
  if (!phone) throw new ApiError(400, "validation_error", "Customer phone is required");

  const shippingAddress = normalizeShippingAddress(body.shippingAddress || customer);
  assertCartInventoryAvailable(items);
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const couponResult = body.couponCode ? validateCoupon(body.couponCode, subtotal) : null;
  const discount = couponResult?.discount || 0;
  const afterDiscount = Math.max(0, subtotal - discount);
  const shipping = afterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const now = new Date().toISOString();

  const order = {
    id: `ord_${crypto.randomUUID()}`,
    number: `EDIO-${Date.now().toString(36).toUpperCase()}`,
    customerId: user?.id || `guest_${crypto.randomUUID()}`,
    customerName: fullName,
    customerEmail: email,
    customerPhone: phone,
    shippingAddress,
    items: items.map(({ product, quantity }) => ({
      productId: product.id,
      name: product.name.en,
      brand: product.brand,
      image: product.image,
      price: product.price,
      qty: quantity,
    })),
    subtotal,
    discount,
    couponCode: couponResult?.coupon?.code || null,
    shipping,
    total: afterDiscount + shipping,
    status: "pending",
    paymentMethod: body.paymentMethod || "cod",
    createdAt: now,
    updatedAt: now,
    timeline: [{ status: "pending", at: now, note: "Order created" }],
  };

  for (const item of items) {
    item.product.stock = Math.max(0, Number(item.product.stock || 0) - item.quantity);
    item.product.inStock = item.product.stock > 0;
    item.product.sales = Number(item.product.sales || 0) + item.quantity;
    item.product.updatedAt = now;
  }

  db.orders.unshift(order);
  if (user) delete db.carts[user.id];
  await saveDatabase();
  return order;
}

function assertCartInventoryAvailable(items) {
  for (const item of items) {
    const available = Number.isFinite(Number(item.product.stock)) ? Math.max(0, Math.floor(Number(item.product.stock))) : item.product.inStock ? 99 : 0;
    if (item.product.availabilityStatus === "pre_order") continue;
    if (!item.product.inStock || available <= 0 || item.quantity > available) {
      const publicStock = getPublicInventoryDisplay({
        availableQuantity: available,
        inStock: item.product.inStock,
        availabilityStatus: item.product.availabilityStatus,
      });
      const message = publicStock.low_stock && publicStock.low_stock_quantity
        ? `Only ${publicStock.low_stock_quantity} left.`
        : "Requested quantity is not available right now.";
      throw new ApiError(409, "insufficient_stock", message);
    }
  }
}

function normalizeShippingAddress(value) {
  const line1 = requireCleanString(value.line1 || value.address, "shippingAddress.line1", 180);
  const city = requireCleanString(value.city, "shippingAddress.city", 80);
  const governorate = requireCleanString(value.governorate || value.province || value.state, "shippingAddress.governorate", 80);
  return {
    line1,
    city,
    governorate,
    notes: sanitizePlainText(value.notes || "", { max: 300 }),
  };
}

function getOrdersForUser(user, searchParams) {
  if (user.role === "admin") return getOrdersForAdmin(searchParams);
  const status = searchParams.get("status");
  let orders = db.orders.filter((order) => order.customerId === user.id || order.customerEmail === user.email);
  if (status) orders = orders.filter((order) => order.status === status);
  return sortProductsByDate(orders);
}

function getOrdersForAdmin(searchParams) {
  const status = searchParams.get("status");
  const query = (searchParams.get("q") || searchParams.get("search") || "").trim().toLowerCase();
  let orders = [...db.orders];
  if (status) orders = orders.filter((order) => order.status === status);
  if (query) {
    orders = orders.filter((order) =>
      [order.number, order.customerName, order.customerEmail, order.customerPhone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }
  return sortProductsByDate(orders);
}

function getOrderForUser(user, value) {
  const order = db.orders.find((item) => item.id === value || item.number === value);
  if (!order) throw new ApiError(404, "not_found", "Order not found");
  if (user.role !== "admin" && order.customerId !== user.id && order.customerEmail !== user.email) {
    throw new ApiError(403, "forbidden", "You cannot access this order");
  }
  return order;
}

function listUserAddresses(userId) {
  return db.addresses.filter((address) => address.userId === userId && !address.deletedAt);
}

async function createAddress(userId, body, req) {
  assertNoForbiddenFields(body);
  const now = new Date().toISOString();
  const address = {
    id: `adr_${crypto.randomUUID()}`,
    userId,
    label: sanitizePlainText(body.label || "Address", { max: 80 }) || "Address",
    fullName: requireCleanString(body.fullName || body.name, "fullName", 120),
    phone: requireCleanString(body.phone, "phone", 40),
    ...normalizeShippingAddress(body),
    isDefault: Boolean(body.isDefault),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  if (address.isDefault) db.addresses.forEach((item) => item.userId === userId && (item.isDefault = false));
  db.addresses.push(address);
  db.customerAddresses = db.addresses;
  db.userAddresses = db.addresses;
  writeAuditLog({
    req,
    actorUserId: userId,
    action: "customer.address.created",
    targetType: "address",
    targetId: address.id,
    afterState: address,
  });
  await saveDatabase();
  return address;
}

async function updateAddress(userId, id, body, req) {
  assertNoForbiddenFields(body);
  const address = db.addresses.find((item) => item.id === id && item.userId === userId);
  if (!address) throw new ApiError(404, "not_found", "Address not found");
  if (isAddressUsedForActiveOrder(userId, address)) {
    const user = db.users.find((item) => item.id === userId);
    requireRecentPassword(user, body.currentPassword);
  }
  const before = { ...address };
  for (const field of ["label", "fullName", "phone", "line1", "city", "governorate", "notes"]) {
    if (body[field] !== undefined) address[field] = sanitizePlainText(body[field] || "", { max: field === "notes" ? 300 : 160 });
  }
  if (body.isDefault !== undefined) {
    address.isDefault = Boolean(body.isDefault);
    if (address.isDefault) db.addresses.forEach((item) => item.userId === userId && item.id !== id && (item.isDefault = false));
  }
  address.updatedAt = new Date().toISOString();
  writeAuditLog({
    req,
    actorUserId: userId,
    action: "customer.address.updated",
    targetType: "address",
    targetId: address.id,
    beforeState: before,
    afterState: address,
  });
  await saveDatabase();
  return address;
}

async function deleteAddress(userId, id, req) {
  const address = db.addresses.find((item) => item.id === id && item.userId === userId && !item.deletedAt);
  if (!address) throw new ApiError(404, "not_found", "Address not found");
  if (isAddressUsedForActiveOrder(userId, address)) {
    const body = await readJson(req);
    const user = db.users.find((item) => item.id === userId);
    requireRecentPassword(user, body.currentPassword);
  }
  const before = { ...address };
  address.deletedAt = new Date().toISOString();
  address.updatedAt = address.deletedAt;
  writeAuditLog({
    req,
    actorUserId: userId,
    action: "customer.address.deleted",
    targetType: "address",
    targetId: address.id,
    beforeState: before,
    afterState: { deletedAt: address.deletedAt },
  });
  await saveDatabase();
}

function isAddressUsedForActiveOrder(userId, address) {
  const active = new Set(["pending", "confirmed", "shipped"]);
  return db.orders.some((order) => {
    if (order.customerId !== userId || !active.has(order.status)) return false;
    const shipping = order.shippingAddress || {};
    return sameKey(shipping.line1, address.line1) && sameKey(shipping.city, address.city);
  });
}

async function createProduct(body) {
  const nameEn = requireCleanString(body.name?.en || body.nameEn || body.name, "name.en", 180);
  const brand = requireCleanString(body.brand, "brand", 80);
  const category = requireCatalogCategory(body.category, "category");
  const sourceUrl = body.sourceUrl ? sanitizePlainText(body.sourceUrl, { max: 1000 }) : "";
  const existingMatch = findExistingProductMatch({
    sourceUrl,
    brand,
    nameEn,
    category,
  });
  if (existingMatch) {
    throw new ApiError(
      409,
      "product_exists",
      `A matching product already exists: ${existingMatch.name?.en || existingMatch.slug || existingMatch.id}`,
    );
  }
  const now = new Date().toISOString();
  const pricing = normalizeAdminPricing(body);
  const rawSpecs = Array.isArray(body.specs) ? body.specs : [];
  const mergedSpecs = mergeSpecs(rawSpecs, extractSpecsFromTextBlock(body.tagline?.en || body.taglineEn || ""));
  const cleanFeatures = cleanFeatureCandidates(cleanStringArray(body.features, 12, 220));
  const taglineEn = selectDisplayDescription({
    tagline: body.tagline?.en || body.taglineEn || "",
    features: cleanFeatures,
    specs: mergedSpecs,
  });
  const taglineAr = isSpecLikeText(body.tagline?.ar || body.taglineAr || "")
    ? ""
    : String(body.tagline?.ar || body.taglineAr || body.tagline?.en || body.taglineEn || "").trim();
  const product = {
    id: `prd_${crypto.randomUUID()}`,
    slug: createProductSlug(body.slug || nameEn),
    sourceUrl,
    name: { en: nameEn, ar: sanitizePlainText(body.name?.ar || body.nameAr || nameEn, { max: 180 }) || nameEn },
    brand,
    category,
    subCategories: cleanStringArray(body.subCategories, 8, 80),
    tagline: { en: sanitizePlainText(taglineEn, { max: 500 }), ar: sanitizePlainText(taglineAr, { max: 500 }) },
    price: pricing.price,
    priceUsd: pricing.priceUsd,
    compareAt: pricing.officialPrice,
    compareAtUsd: pricing.officialPriceUsd,
    officialPrice: pricing.officialPrice,
    officialPriceUsd: pricing.officialPriceUsd,
    currency: "IQD",
    image: sanitizePlainText(body.image || "", { max: 1000 }),
    gallery: cleanStringArray(Array.isArray(body.gallery) ? body.gallery : body.image ? [body.image] : [], 20, 1000),
    productPage: normalizeProductPageContent(body.productPage || body.product_page),
    descriptionBlocks: normalizeDescriptionBlocks(body.descriptionBlocks || body.description_blocks || []),
    relationships: normalizeProductRelationships(body.relationships || body.productRelationships || []),
    productRelationships: normalizeProductRelationships(body.relationships || body.productRelationships || []),
    storedBadge: body.badge ? normalizeEnum(body.badge, PRODUCT_BADGES, null, "badge") : null,
    badge: body.badge ? normalizeEnum(body.badge, PRODUCT_BADGES, null, "badge") : null,
    features: cleanFeatures,
    specs: mergedSpecs,
    inStock: body.inStock !== false,
    stock: Math.max(0, Math.min(100000, Number(body.stock ?? 8))),
    sales: Number(body.sales || 0),
    availabilityStatus: normalizeEnum(body.availabilityStatus || (body.inStock === false ? "out_of_stock" : "in_stock"), PRODUCT_AVAILABILITY_STATUSES, "in_stock", "availabilityStatus"),
    status: normalizeEnum(body.status || "published", PRODUCT_STATUSES, "published", "status"),
    tags: cleanStringArray(body.tags, 20, 60),
    needsReview: Boolean(body.needsReview),
    confidenceScore: optionalConfidence(body.confidenceScore),
    normalizedImageUrl: body.normalizedImageUrl || "",
    imageProcessing: body.imageProcessing || null,
    seo: body.seo && typeof body.seo === "object" ? body.seo : {},
    importState: {
      status: body.importMeta?.importJobId ? "imported" : "ready",
      lastJobId: body.importMeta?.importJobId || null,
      error: null,
      reviewedAt: null,
    },
    importEvidence: Array.isArray(body.importEvidence)
      ? body.importEvidence
      : Array.isArray(body.importMeta?.pipeline?.evidence)
        ? body.importMeta.pipeline.evidence
        : [],
    acceptedClassificationAt: null,
    lastBulkActionAt: null,
    createdAt: now,
    updatedAt: now,
  };
  const suppliedCategoryAssignment = body.categoryAssignment || body.importMeta?.pipeline?.classification || body.importMeta?.catalogClassification;
  product.categoryAssignment = suppliedCategoryAssignment && typeof suppliedCategoryAssignment === "object"
    ? normalizeCategoryAssignment(product.id, {
        primary_category_slug: suppliedCategoryAssignment.primaryCategorySlug || suppliedCategoryAssignment.primary_category_slug || product.category,
        secondary_category_slugs:
          suppliedCategoryAssignment.secondaryCategorySlugs ||
          suppliedCategoryAssignment.secondary_category_slugs ||
          product.subCategories ||
          [],
        dynamic_collection_slugs:
          suppliedCategoryAssignment.dynamicCollectionSlugs ||
          suppliedCategoryAssignment.dynamic_collection_slugs ||
          [],
        confidence_score: suppliedCategoryAssignment.confidenceScore ?? suppliedCategoryAssignment.confidence_score ?? product.confidenceScore ?? 0,
        needs_review: suppliedCategoryAssignment.needsReview ?? suppliedCategoryAssignment.needs_review ?? product.needsReview,
        classification_reason:
          suppliedCategoryAssignment.classificationReason ||
          suppliedCategoryAssignment.classification_reason ||
          "Category assignment supplied by admin.",
        evidence: suppliedCategoryAssignment.evidence || product.importEvidence || [],
      }, now)
    : normalizeCategoryAssignment(product.id, classifyProductForCatalog(product, { now }), now);
  product.needsReview = Boolean(product.needsReview || product.categoryAssignment.needsReview);
  product.confidenceScore = product.confidenceScore ?? product.categoryAssignment.confidenceScore;
  db.categoryAssignments = upsertCategoryAssignments(db.categoryAssignments, [product.categoryAssignment]);
  db.products.unshift(product);
  maybeQueueProductReviewTask(product, product.importState.lastJobId);
  backfillProductPlatform(db, { productIds: [product.id], now });
  await saveDatabase();
  return withDerivedProduct(product);
}

async function duplicateProduct(value, body = {}, admin = null) {
  const source = findProduct(value);
  if (!source) throw new ApiError(404, "not_found", "Product not found");

  const now = new Date().toISOString();
  const sourceBadge = source.storedBadge || source.badge || null;
  const requestedBadge = body.badge === undefined ? sourceBadge : body.badge;
  const nextBadge = requestedBadge === "" ? null : requestedBadge;
  if (nextBadge && !["new", "featured", "best", "preowned"].includes(nextBadge)) {
    throw new ApiError(400, "validation_error", "Duplicate badge must be new, featured, best, or preowned.");
  }

  const nextId = `prd_${crypto.randomUUID()}`;
  const sourceNameEn = source.name?.en || source.nameEn || source.slug || "Product";
  const slugSuffix = body.slugSuffix || "copy";
  const clone = JSON.parse(JSON.stringify(source));
  clone.id = nextId;
  clone.slug = createProductSlug(`${source.slug || sourceNameEn}-${slugSuffix}`);
  clone.name = {
    en: body.nameEn || source.name?.en || sourceNameEn,
    ar: body.nameAr || source.name?.ar || source.name?.en || sourceNameEn,
  };
  clone.storedBadge = nextBadge;
  clone.badge = nextBadge;
  clone.stock = Number.isFinite(Number(body.stock)) ? Number(body.stock) : Number(source.stock || 0);
  clone.inStock = body.inStock === undefined ? clone.stock > 0 : Boolean(body.inStock);
  clone.availabilityStatus = body.availabilityStatus !== undefined ? body.availabilityStatus : source.availabilityStatus;
  clone.status = body.status || source.status || "published";
  clone.sales = Number.isFinite(Number(body.sales)) ? Number(body.sales) : Number(source.sales || 0);
  clone.sourceProductId = source.id;
  clone.duplicatedFromProductId = source.id;
  clone.acceptedClassificationAt = source.acceptedClassificationAt || null;
  clone.lastBulkActionAt = source.lastBulkActionAt || null;
  clone.createdAt = body.preserveCreatedAt === false ? now : source.createdAt || now;
  clone.updatedAt = now;
  clone.importState = {
    ...(source.importState || {}),
    status: "ready",
    lastJobId: null,
    error: null,
    duplicatedFromProductId: source.id,
  };

  clone.categoryAssignment = normalizeCategoryAssignment(nextId, {
    primary_category_slug: source.categoryAssignment?.primaryCategorySlug || source.category || clone.category,
    secondary_category_slugs: source.categoryAssignment?.secondaryCategorySlugs || source.subCategories || [],
    dynamic_collection_slugs: source.categoryAssignment?.dynamicCollectionSlugs || [],
    confidence_score: source.categoryAssignment?.confidenceScore ?? source.confidenceScore ?? 0.75,
    needs_review: source.categoryAssignment?.needsReview ?? source.needsReview ?? false,
    classification_reason: `Cloned from ${source.id}; taxonomy and merchandising state preserved.`,
    evidence: source.categoryAssignment?.evidence || source.importEvidence || [],
  }, now);
  clone.needsReview = Boolean(clone.categoryAssignment.needsReview);
  clone.confidenceScore = clone.categoryAssignment.confidenceScore;

  db.products.unshift(clone);
  db.categoryAssignments = upsertCategoryAssignments(db.categoryAssignments, [clone.categoryAssignment]);

  const sourceMedia = getProductMedia(source.id);
  if (sourceMedia.length) {
    db.productMedia = Array.isArray(db.productMedia) ? db.productMedia : [];
    db.productMedia.unshift(
      ...sourceMedia.map((media, index) => ({
        ...media,
        id: `product_media_${nextId}_${crypto.randomBytes(4).toString("hex")}_${index}`,
        productId: nextId,
        sortOrder: index,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  writeAuditLog({
    action: "product.duplicated",
    actorUserId: admin?.id || null,
    targetType: "product",
    targetId: nextId,
    beforeState: { sourceProductId: source.id },
    afterState: { id: nextId, badge: nextBadge, slug: clone.slug },
  });
  backfillProductPlatform(db, { productIds: [clone.id], now });
  await saveDatabase();
  return withDerivedProduct(clone);
}

async function createCoupon(body) {
  const nowCode = requireString(body.code, "code").toUpperCase();
  if (db.coupons.some((coupon) => coupon.code === nowCode)) {
    throw new ApiError(409, "coupon_exists", "Coupon code already exists");
  }
  const coupon = normalizeCouponInput(body, nowCode);
  db.coupons.push(coupon);
  await saveDatabase();
  return coupon;
}

async function updateCoupon(value, body) {
  const coupon = db.coupons.find((item) => item.code === String(value || "").trim().toUpperCase());
  if (!coupon) throw new ApiError(404, "not_found", "Coupon not found");
  const nextCode = body.code ? requireString(body.code, "code").toUpperCase() : coupon.code;
  if (nextCode !== coupon.code && db.coupons.some((item) => item.code === nextCode)) {
    throw new ApiError(409, "coupon_exists", "Coupon code already exists");
  }
  Object.assign(coupon, normalizeCouponInput({ ...coupon, ...body }, nextCode));
  await saveDatabase();
  return coupon;
}

async function deleteCoupon(value) {
  const code = String(value || "").trim().toUpperCase();
  const index = db.coupons.findIndex((item) => item.code === code);
  if (index === -1) throw new ApiError(404, "not_found", "Coupon not found");
  db.coupons.splice(index, 1);
  await saveDatabase();
  return { deleted: true, code };
}

function normalizeCouponInput(body, code) {
  const type = requireString(body.type, "type").toLowerCase();
  if (!["percent", "fixed"].includes(type)) throw new ApiError(400, "validation_error", "Coupon type must be percent or fixed");
  const value = Number(body.value);
  if (!Number.isFinite(value) || value <= 0) throw new ApiError(400, "validation_error", "Coupon value must be greater than zero");
  const minSubtotal = body.minSubtotal === undefined || body.minSubtotal === null || body.minSubtotal === ""
    ? 0
    : Number(body.minSubtotal);
  if (!Number.isFinite(minSubtotal) || minSubtotal < 0) throw new ApiError(400, "validation_error", "minSubtotal must be zero or greater");
  return {
    code,
    type,
    value,
    label: String(body.label || "").trim() || code,
    minSubtotal,
    active: body.active !== false,
  };
}

async function updateProduct(value, body) {
  const product = findProduct(value);
  if (!product) throw new ApiError(404, "not_found", "Product not found");
  const nextSourceUrl = body.sourceUrl !== undefined ? sanitizePlainText(body.sourceUrl || "", { max: 1000 }) : product.sourceUrl || "";
  const nextBrand = body.brand !== undefined ? requireCleanString(body.brand, "brand", 80) : product.brand;
  const nextCategory = body.category !== undefined ? requireCatalogCategory(body.category, "category") : product.category;
  const nextNameEn = sanitizePlainText(body.name?.en || body.nameEn || body.name || product.name?.en, { max: 180 });
  const existingMatch = findExistingProductMatch({
    sourceUrl: nextSourceUrl,
    brand: nextBrand,
    nameEn: nextNameEn,
    category: nextCategory,
    excludeId: product.id,
  });
  if (existingMatch) {
    throw new ApiError(
      409,
      "product_exists",
      `A matching product already exists: ${existingMatch.name?.en || existingMatch.slug || existingMatch.id}`,
    );
  }
  if (body.sourceUrl !== undefined) product.sourceUrl = nextSourceUrl;
  if (body.brand !== undefined) product.brand = nextBrand;
  if (body.image !== undefined) product.image = sanitizePlainText(body.image || "", { max: 1000 });
  if (body.category !== undefined) product.category = nextCategory;
  if (body.badge !== undefined) {
    product.storedBadge = body.badge ? normalizeEnum(body.badge, PRODUCT_BADGES, null, "badge") : null;
    product.badge = product.storedBadge;
  }
  if (body.slug !== undefined) {
    product.slug = createProductSlug(body.slug || product.name?.en || product.slug, product.id);
  }
  if (body.name !== undefined) {
    if (typeof body.name === "string") {
      product.name = { ...product.name, en: requireCleanString(body.name, "name.en", 180) };
    } else {
    product.name = {
      ...product.name,
      ...(body.name.en !== undefined ? { en: requireCleanString(body.name.en, "name.en", 180) } : {}),
      ...(body.name.ar !== undefined ? { ar: sanitizePlainText(body.name.ar, { max: 180 }) } : {}),
    };
    }
  }
  if (body.tagline) {
    product.tagline = {
      ...product.tagline,
      ...(body.tagline.en !== undefined ? { en: sanitizePlainText(body.tagline.en, { max: 500 }) } : {}),
      ...(body.tagline.ar !== undefined ? { ar: sanitizePlainText(body.tagline.ar, { max: 500 }) } : {}),
    };
  }
  if (body.subCategories) product.subCategories = cleanStringArray(body.subCategories, 8, 80);
  if (body.gallery) product.gallery = cleanStringArray(body.gallery, 20, 1000);
  if (body.productPage !== undefined || body.product_page !== undefined) {
    product.productPage = normalizeProductPageContent(body.productPage || body.product_page);
  }
  if (body.descriptionBlocks !== undefined || body.description_blocks !== undefined) {
    product.descriptionBlocks = normalizeDescriptionBlocks(body.descriptionBlocks || body.description_blocks || []);
  }
  if (body.relationships !== undefined || body.productRelationships !== undefined) {
    const relationships = normalizeProductRelationships(body.relationships || body.productRelationships || []);
    product.relationships = relationships;
    product.productRelationships = relationships;
  }
  if (body.features) product.features = cleanFeatureCandidates(Array.isArray(body.features) ? body.features : product.features);
  if (body.specs) product.specs = mergeSpecs(Array.isArray(body.specs) ? body.specs : product.specs, []);
  if (body.tagline || body.features || body.specs) {
    const mergedTagline = selectDisplayDescription({
      tagline: product.tagline?.en || "",
      features: product.features || [],
      specs: product.specs || [],
    });
    product.tagline = {
      ...product.tagline,
      en: mergedTagline,
      ar: isSpecLikeText(product.tagline?.ar || "") ? "" : String(product.tagline?.ar || "").trim(),
    };
  }
  if (
    body.price !== undefined ||
    body.priceUsd !== undefined ||
    body.compareAt !== undefined ||
    body.officialPrice !== undefined ||
    body.officialPriceUsd !== undefined
  ) {
    const pricing = normalizeAdminPricing({ ...product, ...body });
    product.price = pricing.price;
    product.priceUsd = pricing.priceUsd;
    product.compareAt = pricing.officialPrice;
    product.compareAtUsd = pricing.officialPriceUsd;
    product.officialPrice = pricing.officialPrice;
    product.officialPriceUsd = pricing.officialPriceUsd;
  }
  if (body.stock !== undefined) product.stock = Math.max(0, Number(body.stock));
  if (body.inStock !== undefined) product.inStock = Boolean(body.inStock);
  if (body.availabilityStatus !== undefined) product.availabilityStatus = normalizeEnum(body.availabilityStatus, PRODUCT_AVAILABILITY_STATUSES, product.availabilityStatus || "in_stock", "availabilityStatus");
  if (body.status !== undefined) product.status = normalizeEnum(body.status, PRODUCT_STATUSES, product.status || "published", "status");
  if (body.tags !== undefined) product.tags = cleanStringArray(body.tags, 20, 60);
  if (body.needsReview !== undefined) product.needsReview = Boolean(body.needsReview);
  if (body.confidenceScore !== undefined) product.confidenceScore = optionalConfidence(body.confidenceScore);
  if (body.normalizedImageUrl !== undefined) product.normalizedImageUrl = String(body.normalizedImageUrl || "");
  if (body.imageProcessing !== undefined) product.imageProcessing = body.imageProcessing || null;
  if (body.seo !== undefined) product.seo = body.seo && typeof body.seo === "object" ? body.seo : {};
  if (body.importMeta?.importJobId || body.importState) {
    product.importState = {
      status: body.importState?.status || (body.importMeta?.importJobId ? "imported" : product.importState?.status || "ready"),
      lastJobId: body.importMeta?.importJobId || body.importState?.lastJobId || product.importState?.lastJobId || null,
      error: body.importState?.error || null,
      reviewedAt: body.importState?.reviewedAt || product.importState?.reviewedAt || null,
    };
  }
  if (Array.isArray(body.importEvidence)) {
    product.importEvidence = body.importEvidence;
  } else if (Array.isArray(body.importMeta?.pipeline?.evidence)) {
    product.importEvidence = body.importMeta.pipeline.evidence;
  }
  product.updatedAt = new Date().toISOString();
  const suppliedCategoryAssignment = body.categoryAssignment || body.importMeta?.catalogClassification;
  if (suppliedCategoryAssignment && typeof suppliedCategoryAssignment === "object") {
    if (shouldPreserveAcceptedClassification(product, { force: body.force === true })) {
      product.importState = {
        ...(product.importState || { status: "ready", lastJobId: null, error: null, reviewedAt: null }),
        status: "classification_locked",
      };
    } else {
      product.categoryAssignment = normalizeCategoryAssignment(product.id, {
        primary_category_slug: suppliedCategoryAssignment.primaryCategorySlug || suppliedCategoryAssignment.primary_category_slug || product.category,
        secondary_category_slugs:
          suppliedCategoryAssignment.secondaryCategorySlugs ||
          suppliedCategoryAssignment.secondary_category_slugs ||
          product.subCategories ||
          [],
        dynamic_collection_slugs:
          suppliedCategoryAssignment.dynamicCollectionSlugs ||
          suppliedCategoryAssignment.dynamic_collection_slugs ||
          [],
        confidence_score: suppliedCategoryAssignment.confidenceScore ?? suppliedCategoryAssignment.confidence_score ?? product.confidenceScore ?? 0,
        needs_review: suppliedCategoryAssignment.needsReview ?? suppliedCategoryAssignment.needs_review ?? product.needsReview,
        classification_reason:
          suppliedCategoryAssignment.classificationReason ||
          suppliedCategoryAssignment.classification_reason ||
          "Category assignment supplied by admin.",
        evidence: suppliedCategoryAssignment.evidence || product.importEvidence || [],
      }, product.updatedAt);
    }
  } else if (
    !shouldPreserveAcceptedClassification(product, { force: body.force === true }) &&
    (body.category !== undefined || body.subCategories !== undefined || body.name !== undefined || body.tagline !== undefined || body.specs !== undefined)
  ) {
    product.categoryAssignment = normalizeCategoryAssignment(
      product.id,
      classifyProductForCatalog(product, { now: product.updatedAt }),
      product.updatedAt,
    );
  }
  if (product.categoryAssignment) {
    product.needsReview = Boolean(product.needsReview || product.categoryAssignment.needsReview);
    product.confidenceScore = optionalConfidence(product.confidenceScore) ?? product.categoryAssignment.confidenceScore;
    db.categoryAssignments = upsertCategoryAssignments(db.categoryAssignments, [product.categoryAssignment]);
  }
  maybeQueueProductReviewTask(product, product.importState?.lastJobId || null);
  backfillProductPlatform(db, { productIds: [product.id], now: product.updatedAt });
  await saveDatabase();
  return withDerivedProduct(product);
}

function normalizeProductRelationships(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .map((entry) => {
      const rawType = String(entry?.relationshipType || entry?.relationship_type || "")
        .trim()
        .toLowerCase()
        .replace(/[-\s]+/g, "_");
      const relationshipType =
        rawType === "recommended_accessory" || rawType === "recommended_accessories"
          ? "accessory"
          : rawType === "compatible_with"
            ? "compatible"
            : rawType === "similar_products"
              ? "similar"
              : rawType === "same_brand_products"
                ? "same_brand"
                : rawType;
      const targetProductId = sanitizePlainText(entry?.targetProductId || entry?.target_product_id || "", { max: 120 });
      if (!targetProductId || !PRODUCT_RELATIONSHIP_TYPES.has(relationshipType)) return null;
      const key = `${relationshipType}:${targetProductId}`;
      if (seen.has(key)) return null;
      seen.add(key);
      const priority = Number(entry?.priority || 0);
      const confidence = Number(entry?.confidence);
      return {
        targetProductId,
        relationshipType,
        reason: sanitizePlainText(entry?.reason || "", { max: 220 }),
        priority: Number.isFinite(priority) ? Math.max(-100, Math.min(100, priority)) : 0,
        confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : undefined,
        active: entry?.active !== false,
        source: ["manual", "imported", "automatic"].includes(entry?.source) ? entry.source : "manual",
      };
    })
    .filter(Boolean);
}

function normalizeAdminPricing(body) {
  const priceIqd = toOptionalNumber(body.price);
  const priceUsd = toOptionalNumber(body.priceUsd);
  const officialIqd = toOptionalNumber(body.officialPrice ?? body.compareAt);
  const officialUsd = toOptionalNumber(body.officialPriceUsd ?? body.compareAtUsd);
  const finalCurrent = normalizeCommercialPricePair({ iqd: priceIqd, usd: priceUsd });
  const finalOfficial = normalizeCommercialPricePair({ iqd: officialIqd, usd: officialUsd });

  return {
    price: applyNineEndingPricing(finalCurrent.iqd || 0),
    priceUsd: finalCurrent.usd,
    officialPrice: finalOfficial.iqd,
    officialPriceUsd: finalOfficial.usd,
  };
}

function requireUser(req) {
  const sessionUser = getCookieSessionUser(req);
  if (sessionUser) return sessionUser;

  const token = getBearerToken(req);
  if (!token) throw new ApiError(401, "unauthorized", "Authentication token is required");
  const payload = verifyToken(token);
  const user = db.users.find((item) => item.id === payload.sub);
  if (!user) throw new ApiError(401, "unauthorized", "User no longer exists");
  if (isUserDisabled(user)) throw new ApiError(403, "user_disabled", "This user is disabled");
  return user;
}

function optionalUser(req) {
  if (!getBearerToken(req) && !getCookieValue(req, AUTH_SESSION_COOKIE)) return null;
  try {
    return requireUser(req);
  } catch {
    return null;
  }
}

function requireAdmin(req) {
  const user = requireUser(req);
  if (!["admin", "super_admin"].includes(user.role)) throw new ApiError(403, "forbidden", "Admin access is required");
  return user;
}

async function createSessionCookie(req, res, user) {
  const rawToken = randomAuthToken();
  const now = new Date();
  const session = {
    id: `sess_${crypto.randomUUID()}`,
    userId: user.id,
    tokenHash: hashAuthToken(rawToken),
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + AUTH_SESSION_TTL_MS).toISOString(),
    revokedAt: null,
    lastReauthenticatedAt: null,
    userAgent: String(req.headers["user-agent"] || "").slice(0, 300),
    ipHash: hashClientIp(req),
  };
  db.userSessions.push(session);
  setSessionCookie(res, rawToken, session.expiresAt);
  await saveDatabase();
  return session;
}

function getCookieSessionUser(req) {
  const session = getCurrentSession(req);
  if (!session || session.revokedAt || new Date(session.expiresAt).getTime() < Date.now()) return null;
  const user = db.users.find((item) => item.id === session.userId);
  if (!user || isUserDisabled(user)) return null;
  session.lastSeenAt = new Date().toISOString();
  return user;
}

function getCurrentSession(req) {
  const rawToken = getCookieValue(req, AUTH_SESSION_COOKIE);
  if (!rawToken) return null;
  const tokenHash = hashAuthToken(rawToken);
  return db.userSessions.find((item) => item.tokenHash === tokenHash) || null;
}

async function revokeCurrentSession(req, actorUserId = null, action = "auth.session.revoked") {
  const rawToken = getCookieValue(req, AUTH_SESSION_COOKIE);
  const tokenHash = rawToken ? hashAuthToken(rawToken) : "";
  const session = tokenHash ? db.userSessions.find((item) => item.tokenHash === tokenHash && !item.revokedAt) : null;
  if (session) session.revokedAt = new Date().toISOString();
  writeAuditLog({
    req,
    actorUserId,
    action,
    targetType: "session",
    targetId: session?.id || null,
    afterState: { revoked: Boolean(session) },
  });
}

function revokeUserSessions(userId) {
  const now = new Date().toISOString();
  for (const session of db.userSessions) {
    if (session.userId === userId && !session.revokedAt) session.revokedAt = now;
  }
}

function listUserSessions(userId, req = null) {
  const currentToken = req ? getCookieValue(req, AUTH_SESSION_COOKIE) : "";
  const currentHash = currentToken ? hashAuthToken(currentToken) : "";
  return db.userSessions
    .filter((session) => session.userId === userId && !session.revokedAt)
    .sort((a, b) => new Date(b.lastSeenAt || b.createdAt).getTime() - new Date(a.lastSeenAt || a.createdAt).getTime())
    .map((session) => ({
      id: session.id,
      current: Boolean(currentHash && session.tokenHash === currentHash),
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      lastReauthenticatedAt: session.lastReauthenticatedAt || null,
      expiresAt: session.expiresAt,
      userAgent: session.userAgent,
    }));
}

async function revokeSessionById(userId, sessionId, req) {
  const session = db.userSessions.find((item) => item.id === sessionId && item.userId === userId && !item.revokedAt);
  if (!session) throw new ApiError(404, "not_found", "Session not found");
  session.revokedAt = new Date().toISOString();
  writeAuditLog({
    req,
    actorUserId: userId,
    action: "auth.session.revoked",
    targetType: "session",
    targetId: session.id,
    afterState: { revokedAt: session.revokedAt },
  });
  await saveDatabase();
}

function createPasskeyRegistrationOptions(user, req) {
  const challenge = randomAuthToken();
  const now = new Date();
  const challengeRecord = {
    id: `pkc_${crypto.randomUUID()}`,
    userId: user.id,
    challengeHash: hashAuthToken(challenge),
    type: "registration",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
    usedAt: null,
    requestId: getRequestId(req),
  };
  db.passkeyChallenges.push(challengeRecord);
  writeAuditLog({
    req,
    actorUserId: user.id,
    action: "auth.passkey.registration_options_created",
    targetType: "user",
    targetId: user.id,
  });
  return {
    enabled: false,
    reason: "WebAuthn challenge generation is prepared; cryptographic attestation verification requires adding a WebAuthn verifier package.",
    publicKey: {
      challenge,
      rp: { name: "Edio", id: getRpId(req) },
      user: {
        id: Buffer.from(user.id).toString("base64url"),
        name: user.email,
        displayName: user.fullName,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      timeout: 300000,
      attestation: "none",
    },
  };
}

function listUserPasskeys(userId) {
  return db.authPasskeys
    .filter((item) => item.userId === userId && !item.revokedAt)
    .map((item) => ({
      id: item.id,
      label: item.label || "Passkey",
      createdAt: item.createdAt,
      lastUsedAt: item.lastUsedAt || null,
      transports: Array.isArray(item.transports) ? item.transports : [],
    }));
}

async function revokePasskey(userId, passkeyId, body, req) {
  const user = db.users.find((item) => item.id === userId);
  const passkey = db.authPasskeys.find((item) => item.id === passkeyId && item.userId === userId && !item.revokedAt);
  if (!passkey) throw new ApiError(404, "not_found", "Passkey not found");
  requireRecentPassword(user, body.currentPassword || body.password);
  passkey.revokedAt = new Date().toISOString();
  writeAuditLog({
    req,
    actorUserId: userId,
    action: "auth.passkey.revoked",
    targetType: "passkey",
    targetId: passkey.id,
    afterState: { revokedAt: passkey.revokedAt },
  });
  await saveDatabase();
}

function getRpId(req) {
  const host = String(req.headers.host || "127.0.0.1").split(":")[0];
  return host || "127.0.0.1";
}

function setSessionCookie(res, rawToken, expiresAt) {
  const cookie = [
    `${AUTH_SESSION_COOKIE}=${encodeURIComponent(rawToken)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${new Date(expiresAt).toUTCString()}`,
    `Max-Age=${Math.floor(AUTH_SESSION_TTL_MS / 1000)}`,
    AUTH_COOKIE_SECURE ? "Secure" : "",
  ].filter(Boolean).join("; ");
  appendSetCookie(res, cookie);
}

function setOAuthStateCookie(res, value) {
  appendSetCookie(
    res,
    [
      `${OAUTH_STATE_COOKIE}=${encodeURIComponent(value)}`,
      "Path=/api/auth/oauth",
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=600",
      AUTH_COOKIE_SECURE ? "Secure" : "",
    ].filter(Boolean).join("; "),
  );
}

function clearOAuthStateCookie(res) {
  appendSetCookie(
    res,
    `${OAUTH_STATE_COOKIE}=; Path=/api/auth/oauth; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${AUTH_COOKIE_SECURE ? "; Secure" : ""}`,
  );
}

function clearSessionCookie(res) {
  appendSetCookie(res, `${AUTH_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${AUTH_COOKIE_SECURE ? "; Secure" : ""}`);
}

function appendSetCookie(res, cookie) {
  const current = res.getHeader("Set-Cookie");
  if (!current) {
    res.setHeader("Set-Cookie", cookie);
  } else if (Array.isArray(current)) {
    res.setHeader("Set-Cookie", [...current, cookie]);
  } else {
    res.setHeader("Set-Cookie", [current, cookie]);
  }
}

function getCookieValue(req, name) {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[name] || "";
}

function parseCookies(header) {
  return String(header || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf("=");
      if (index === -1) return cookies;
      const key = part.slice(0, index).trim();
      cookies[key] = decodeURIComponent(part.slice(index + 1).trim());
      return cookies;
    }, {});
}

function randomAuthToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashAuthToken(token) {
  return crypto.createHmac("sha256", JWT_SECRET).update(String(token || "")).digest("hex");
}

function hashClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || req.socket?.remoteAddress || "";
  return ip ? crypto.createHmac("sha256", JWT_SECRET).update(ip).digest("hex") : "";
}

function getRequestId(req) {
  return String(req.headers["x-request-id"] || req.headers["x-correlation-id"] || `req_${crypto.randomUUID()}`);
}

function getPublicBaseUrl(req) {
  const configured = String(process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");
  const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() || (AUTH_COOKIE_SECURE ? "https" : "http");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || `127.0.0.1:${PORT}`).split(",")[0].trim();
  return `${proto}://${host}`.replace(/\/$/, "");
}

function buildAuthRedirectUrl(req, pathValue, result, errorCode = "", redirectTo = "") {
  const base = getPublicBaseUrl(req);
  const path = normalizeRedirectPath(pathValue, "/login");
  const url = new URL(path, base);
  if (result) url.searchParams.set("auth", result);
  if (errorCode) url.searchParams.set("error", String(errorCode).slice(0, 80));
  if (redirectTo) url.searchParams.set("redirectTo", normalizeRedirectPath(redirectTo));
  return url.toString();
}

function redirect(res, location, status = 302) {
  res.writeHead(status, {
    Location: location,
    "Cache-Control": "no-store",
  });
  res.end();
}

const authRateLimits = new Map();
const routeRateLimits = new Map();

function enforceAuthRateLimit(req, key) {
  const now = Date.now();
  const clientKey = `${hashClientIp(req)}:${key}`;
  const bucket = authRateLimits.get(clientKey) || { count: 0, resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS };
  if (bucket.resetAt < now) {
    bucket.count = 0;
    bucket.resetAt = now + AUTH_RATE_LIMIT_WINDOW_MS;
  }
  bucket.count += 1;
  authRateLimits.set(clientKey, bucket);
  if (bucket.count > AUTH_RATE_LIMIT_MAX) {
    throw new ApiError(429, "rate_limited", "Too many attempts. Try again later.");
  }
}

function enforceRouteRateLimit(req, key, { max = 60, windowMs = GENERAL_RATE_LIMIT_WINDOW_MS } = {}) {
  const now = Date.now();
  const clientKey = `${hashClientIp(req)}:${key}`;
  const bucket = routeRateLimits.get(clientKey) || { count: 0, resetAt: now + windowMs };
  if (bucket.resetAt < now) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  routeRateLimits.set(clientKey, bucket);
  if (bucket.count > max) {
    throw new ApiError(429, "rate_limited", "Too many requests. Try again later.");
  }
}

function applyRouteRateLimits(req, pathname, method) {
  if (method === "OPTIONS") return;

  if (pathname === "/api/catalog" || pathname === "/api/products" || pathname.startsWith("/api/products/")) {
    enforceRouteRateLimit(req, `catalog:${pathname}`, { max: 180 });
  }

  if (pathname.includes("/auth/") || pathname.startsWith("/auth/")) {
    enforceRouteRateLimit(req, `auth:${pathname}`, { max: 30, windowMs: AUTH_RATE_LIMIT_WINDOW_MS });
  }

  if (pathname.includes("/password") || pathname.includes("/register") || pathname.includes("/signup")) {
    enforceRouteRateLimit(req, `identity:${pathname}`, { max: 12, windowMs: AUTH_RATE_LIMIT_WINDOW_MS });
  }

  if (pathname.startsWith("/api/admin/products/import") || pathname.startsWith("/api/admin/products/discover")) {
    enforceRouteRateLimit(req, "admin-product-import", { max: 20, windowMs: AUTH_RATE_LIMIT_WINDOW_MS });
  }

  if (pathname.startsWith("/api/admin/products/enrichment") || pathname.startsWith("/api/admin/products/enrich")) {
    enforceRouteRateLimit(req, "admin-product-enrichment", { max: 12, windowMs: AUTH_RATE_LIMIT_WINDOW_MS });
  }

  if (pathname.startsWith("/api/admin/import/woocommerce") || pathname.startsWith("/api/admin/products/import/woocommerce")) {
    enforceRouteRateLimit(req, "admin-woocommerce-import", { max: 12, windowMs: AUTH_RATE_LIMIT_WINDOW_MS });
  }

  if (pathname.startsWith("/api/admin/import/products")) {
    enforceRouteRateLimit(req, "admin-product-platform-import", { max: 30, windowMs: AUTH_RATE_LIMIT_WINDOW_MS });
  }

  if (/^\/api\/admin\/products\/[^/]+\/(publish|unpublish|schedule)$/.test(pathname)) {
    enforceRouteRateLimit(req, "admin-product-lifecycle", { max: 60, windowMs: AUTH_RATE_LIMIT_WINDOW_MS });
  }

  if (pathname === "/api/webhooks/inventory-updated") {
    enforceRouteRateLimit(req, "inventory-webhook", { max: 120, windowMs: GENERAL_RATE_LIMIT_WINDOW_MS });
  }

  if (pathname === "/api/internal/revalidate") {
    enforceRouteRateLimit(req, "internal-revalidate", { max: 20, windowMs: AUTH_RATE_LIMIT_WINDOW_MS });
  }

  if (
    pathname.startsWith("/api/admin/products/media") ||
    pathname.startsWith("/api/admin/import-jobs") ||
    pathname.includes("/media/recompute")
  ) {
    enforceRouteRateLimit(req, "admin-media-import", { max: 30, windowMs: AUTH_RATE_LIMIT_WINDOW_MS });
  }

  if (pathname.startsWith("/api/admin/products/bulk")) {
    enforceRouteRateLimit(req, "admin-bulk-actions", { max: 40, windowMs: AUTH_RATE_LIMIT_WINDOW_MS });
  }
}

function writeAuditLog({ req, actorUserId = null, action, targetType = "system", targetId = null, beforeState = null, afterState = null }) {
  db.auditLogs.push({
    id: `aud_${crypto.randomUUID()}`,
    actorUserId,
    action,
    targetType,
    targetId,
    beforeState: sanitizeAuditState(beforeState),
    afterState: sanitizeAuditState(afterState),
    requestId: getRequestId(req || { headers: {} }),
    ipHash: req ? hashClientIp(req) : "",
    createdAt: new Date().toISOString(),
  });
}

function sanitizeAuditState(value) {
  if (!value || typeof value !== "object") return value;
  const json = JSON.parse(JSON.stringify(value));
  const redact = (node) => {
    if (!node || typeof node !== "object") return;
    for (const key of Object.keys(node)) {
      if (/password|token|secret|hash|salt/i.test(key)) {
        node[key] = "[redacted]";
      } else {
        redact(node[key]);
      }
    }
  };
  redact(json);
  return json;
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
}

function signToken(user) {
  const header = base64urlJson({ alg: "HS256", typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const payload = base64urlJson({
    sub: user.id,
    email: user.email,
    role: user.role,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  });
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token) {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) throw new ApiError(401, "invalid_token", "Invalid token");
  let parsedHeader;
  try {
    parsedHeader = JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
  } catch {
    throw new ApiError(401, "invalid_token", "Invalid token");
  }
  if (parsedHeader.alg !== "HS256" || parsedHeader.typ !== "JWT") {
    throw new ApiError(401, "invalid_token", "Invalid token header");
  }
  const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new ApiError(401, "invalid_token", "Invalid token signature");
  }
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new ApiError(401, "invalid_token", "Invalid token");
  }
  if (parsed.exp && parsed.exp < Math.floor(Date.now() / 1000)) throw new ApiError(401, "token_expired", "Token expired");
  return parsed;
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { passwordSalt: salt, passwordHash: hash };
}

function verifyPassword(password, user) {
  if (user?.passwordLoginDisabled || !user?.passwordHash || !user?.passwordSalt) return false;
  const hash = crypto.scryptSync(password, user.passwordSalt, 64);
  const stored = Buffer.from(user.passwordHash, "hex");
  return stored.length === hash.length && crypto.timingSafeEqual(stored, hash);
}

async function readJson(req, options = {}) {
  return (await readJsonRaw(req, options)).body;
}

async function readJsonRaw(req, options = {}) {
  const maxBytes = options.maxBytes || 2_000_000;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new ApiError(413, "payload_too_large", "Request body is too large");
    chunks.push(chunk);
  }
  if (!chunks.length) return { body: {}, rawBody: "" };
  const rawBody = Buffer.concat(chunks).toString("utf8");
  try {
    return { body: JSON.parse(rawBody), rawBody };
  } catch {
    throw new ApiError(400, "invalid_json", "Body must be valid JSON");
  }
}

async function readFormUrlencoded(req, options = {}) {
  const maxBytes = options.maxBytes || 64_000;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new ApiError(413, "payload_too_large", "Request body is too large");
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks).toString("utf8");
  return Object.fromEntries(new URLSearchParams(rawBody).entries());
}

function send(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

async function sendStaticAsset(res, pathname) {
  const assetPath = path.join(ROOT_DIR, pathname.replace(/^\/+/, ""));
  const normalizedAssetPath = path.normalize(assetPath);
  const allowedRoot = path.normalize(path.join(SRC_DIR, "assets"));

  if (!normalizedAssetPath.startsWith(`${allowedRoot}${path.sep}`)) {
    throw new ApiError(403, "forbidden", "Asset path is not allowed");
  }

  try {
    const fileStats = await stat(normalizedAssetPath);
    if (!fileStats.isFile()) throw new ApiError(404, "not_found", "Asset not found");
    const contents = await readFile(normalizedAssetPath);
    res.writeHead(200, {
      "Content-Type": getMimeType(normalizedAssetPath),
      "Content-Length": contents.length,
      "Cache-Control": "public, max-age=86400",
    });
    res.end(contents);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(404, "not_found", "Asset not found");
  }
}

async function sendDistAsset(req, res, pathname) {
  const cleanPathname = pathname === "/" ? "/index.html" : pathname;
  const requestedPath = path.normalize(path.join(DIST_DIR, cleanPathname.replace(/^\/+/, "")));
  const distRoot = path.normalize(DIST_DIR);

  if (!requestedPath.startsWith(`${distRoot}${path.sep}`) && requestedPath !== distRoot) {
    throw new ApiError(403, "forbidden", "Static asset path is not allowed");
  }

  let filePath = requestedPath;
  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) throw new Error("not_file");
  } catch {
    filePath = path.join(DIST_DIR, "index.html");
  }

  const contents = await readFile(filePath);
  const isHtml = path.basename(filePath) === "index.html";
  res.writeHead(200, {
    "Content-Type": getMimeType(filePath),
    "Content-Length": contents.length,
    "Cache-Control": isHtml ? "no-cache" : "public, max-age=31536000, immutable",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(contents);
}

function getMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
    case ".webmanifest":
      return "application/json; charset=utf-8";
    case ".ico":
      return "image/x-icon";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".gif":
      return "image/gif";
    case ".avif":
      return "image/avif";
    default:
      return "application/octet-stream";
  }
}

function normalizeImportedMoney(amount, currency) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return { priceIqd: null, priceUsd: null };
  }

  const numeric = Number(amount);
  const normalizedCurrency = String(currency || "USD").trim().toUpperCase();
  if (normalizedCurrency === "IQD") {
    const normalized = normalizeCommercialPricePair({ iqd: numeric });
    return { priceIqd: normalized.iqd, priceUsd: normalized.usd };
  }

  const normalized = normalizeCommercialPricePair({ usd: numeric });
  return { priceIqd: normalized.iqd, priceUsd: normalized.usd };
}

async function importProductFromUrl(rawUrl, options = {}) {
  const sourceUrl = requireString(rawUrl, "url");
  let pageUrl;
  try {
    pageUrl = await validateExternalHttpUrl(sourceUrl);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "validation_error", "Product URL is invalid");
  }

  let response;
  try {
    response = await fetchWithBrowserHeaders(pageUrl, {
      accept: "text/html,application/xhtml+xml",
      timeoutMs: 16000,
      retries: 2,
    });
  } catch {
    throw new ApiError(400, "import_failed", "Unable to reach the product page. Try again or paste another trusted source.");
  }

  if (!response.ok) {
    throw new ApiError(400, "import_failed", `Unable to fetch the product page (${response.status})`);
  }

  assertHtmlResponse(response);
  pageUrl = new URL(response.url || pageUrl.toString());
  const html = await readResponseTextWithLimit(response, MAX_REMOTE_HTML_BYTES, "Product page");
  const schema = extractProductSchema(html, pageUrl);
  const embeddedProduct = extractEmbeddedProductSignals(html, pageUrl, options.query || "");
  const title =
    schema.name ||
    embeddedProduct.title ||
    extractMetaContent(html, "property", "og:title") ||
    extractMetaContent(html, "name", "twitter:title") ||
    extractTagContent(html, "title") ||
    "";
  const description =
    schema.description ||
    extractMetaContent(html, "property", "og:description") ||
    extractMetaContent(html, "name", "description") ||
    extractMetaContent(html, "name", "twitter:description") ||
    "";
  const cleanName = cleanProductTitle(title, pageUrl.hostname, options.query || "");
  const importedPrice = normalizeImportedMoney(schema.price, schema.currency);
  const importedOfficialPrice = normalizeImportedMoney(schema.compareAt, schema.currency);
  const images = dedupeStrings([
    ...(schema.images || []),
    ...(embeddedProduct.images || []),
    ...extractImageUrls(html, pageUrl, { query: cleanName || options.query || title }),
  ]).slice(0, 16);
  const localizedImages = await localizeImportedImages(images, cleanName || "product");
  const packageItems = extractPackageItems(html);
  const specs = mergeSpecs(schema.specs || [], [
    ...extractSpecs(html),
    ...extractSpecsFromTextBlock(description),
  ]);
  const features = cleanFeatureCandidates([
    ...extractFeatureCandidates(html, description),
    ...extractFeatureCandidatesFromDescription(description),
    ...packageItems,
  ]);
  const featureCoverage = splitImportedFeatureCoverage(features);
  const brand = schema.brand || embeddedProduct.brand || inferBrand([options.query, title].filter(Boolean).join(" "), pageUrl.hostname);
  const normalizedName = ensureBrandInName(cleanName || title, brand);
  const categoryTitleContext = dedupeStrings([normalizedName || cleanName || title, title]).join(" ");
  const category = inferCategory({
    title: categoryTitleContext,
    description,
    productType: schema.productType || embeddedProduct.productType || schema.category,
    specs,
    features,
    sourceUrl,
  });
  const categoryResolution = {
    category: category || UNKNOWN_CATEGORY,
    needsReview: !category,
    suggestedCategory: category || null,
    allowedCategories: getCatalogCategorySlugs(),
  };
  const subCategories = inferSubCategories(category, { title, description, features, specs });
  const finalImages = localizedImages.length ? localizedImages : images;
  const storefrontFeatures = pruneCategoryMismatchImportedFeatures(category, features);
  const displayDescription = selectDisplayDescription({
    tagline: sentenceFromText(description),
    description,
    features: storefrontFeatures,
    specs,
  });
  const descriptionBlocks = buildDescriptionBlocksFromImportDraft(
    {
      nameEn: normalizedName || cleanName,
      sourceUrl: pageUrl.toString(),
      descriptionHtml: html,
    },
    {
      sourceUrl: pageUrl.toString(),
      sourceType: schema.used ? "official" : "retailer",
      productName: normalizedName || cleanName,
    },
  );

  const draft = {
    sourceUrl: pageUrl.toString(),
    nameEn: normalizedName || cleanName,
    nameAr: "",
    brand,
    category,
    subCategories,
    taglineEn: displayDescription,
    taglineAr: "",
    price: importedPrice.priceIqd,
    priceUsd: importedPrice.priceUsd,
    compareAt: importedOfficialPrice.priceIqd,
    compareAtUsd: importedOfficialPrice.priceUsd,
    officialPrice: importedOfficialPrice.priceIqd,
    officialPriceUsd: importedOfficialPrice.priceUsd,
    image: finalImages[0] || "",
    gallery: finalImages,
    descriptionBlocks,
    features: storefrontFeatures,
    specs,
    importMeta: {
      ...buildImportMetaFromDraft(
        {
          gallery: finalImages,
          features,
          specs,
          importMeta: { usedStructuredData: Boolean(schema.used) },
        },
        {
          mode: "url",
          resolvedUrl: sourceUrl,
          localizedImageCount: localizedImages.length,
        },
      ),
      titleFound: Boolean(title),
      categoryResolution,
      ...(categoryResolution.needsReview ? { publishDecision: "needs_review", qualityFlags: ["category_unknown"] } : {}),
    },
  };

  return applyStrictProductIntelligence(draft, {
    rawInput: options.query || sourceUrl,
    sourceTitle: title,
    sourceDescription: description,
    sourcePrice: schema.price,
    sourceCompareAt: schema.compareAt,
    sourceCurrency: schema.currency,
    usedStructuredData: Boolean(schema.used),
  });
}

async function discoverProductFromQuery(rawQuery) {
  const query = requireString(rawQuery, "query").replace(/\s+/g, " ").trim();

  if (looksLikeUrl(query)) {
    return importProductFromUrl(query);
  }

  const localMatches = searchLocalCatalogDrafts(query);
  if (isBroadSearchQuery(query) && localMatches.length) {
    const narrowLocalMatches = localMatches.filter((item) =>
      normalizeComparisonText(item.title).includes(normalizeComparisonText(query)),
    );
    const preferredLocalMatches = narrowLocalMatches.length ? narrowLocalMatches : localMatches.slice(0, 1);
    const localExistingProduct = findExistingProductMatch({
      sourceUrl: preferredLocalMatches[0].draft.sourceUrl,
      brand: preferredLocalMatches[0].draft.brand,
      nameEn: preferredLocalMatches[0].draft.nameEn,
      category: preferredLocalMatches[0].draft.category,
    });
    return {
      draft: preferredLocalMatches[0].draft,
      existingProduct: localExistingProduct ? serializeImportProductMatch(localExistingProduct) : null,
      candidates: preferredLocalMatches,
    };
  }

  if (inferBrandSearchDomains(query).length && distinctiveProductTokens(query).length <= 3) {
    const directDomainMatch = await discoverDirectDomainMatch(query);
    if (directDomainMatch && isRichImportDraft(directDomainMatch.draft || directDomainMatch)) return directDomainMatch;
  }

  const candidates = await searchProductCandidates(query);
  if (!candidates.length) {
    const directDomainMatch = await discoverDirectDomainMatch(query);
    if (directDomainMatch) return directDomainMatch;
    if (localMatches.length) {
      return {
        draft: localMatches[0].draft,
        candidates: localMatches,
      };
    }
    throw new ApiError(404, "not_found", "No matching product pages were found for this model.");
  }

  const importedCandidates = [];
  let fallbackImported = null;
  const maxCandidatesToImport = Math.min(candidates.length, 8);

  for (const candidate of candidates.slice(0, maxCandidatesToImport)) {
    try {
      const imported = await importProductFromUrl(candidate.url, { query });
      const score = scoreImportedProduct(imported, query) + candidate.score;
      importedCandidates.push({ imported, candidate, score });
      if (!fallbackImported) {
        fallbackImported = imported;
      }

      const strongEnough =
        imported.importMeta?.usedStructuredData &&
        (imported.gallery?.length || 0) >= 3 &&
        (imported.specs?.length || 0) >= 4;
      if (strongEnough && importedCandidates.length >= 3) {
        break;
      }
    } catch {
      continue;
    }
  }

  if (!importedCandidates.length) {
    if (fallbackImported) return fallbackImported;
    throw new ApiError(
      400,
      "import_failed",
      "We found search results, but none of them produced a usable product draft. Try adding the official product link.",
    );
  }

  const strictlyMatchedCandidates = importedCandidates.filter(({ imported, candidate }) =>
    isStrongQueryMatch(imported, query, candidate),
  );
  if (strictlyMatchedCandidates.length) {
    importedCandidates.splice(0, importedCandidates.length, ...strictlyMatchedCandidates);
  }

  const compatibleCandidates = importedCandidates.filter(({ imported, candidate }) =>
    scoreQueryCompatibility(
      [imported?.nameEn, imported?.brand, candidate?.title, candidate?.url].join(" "),
      query,
    ).compatible,
  );
  if (!compatibleCandidates.length) {
    const localMatches = searchLocalCatalogDrafts(query);
    if (localMatches.length) {
      const localExistingProduct = findExistingProductMatch({
        sourceUrl: localMatches[0].draft.sourceUrl,
        brand: localMatches[0].draft.brand,
        nameEn: localMatches[0].draft.nameEn,
        category: localMatches[0].draft.category,
      });
      return {
        draft: localMatches[0].draft,
        existingProduct: localExistingProduct ? serializeImportProductMatch(localExistingProduct) : null,
        candidates: localMatches,
      };
    }
    throw new ApiError(
      404,
      "not_found",
      "No reliable exact match was found for this model. Paste the official product URL to import it safely.",
    );
  }

  const storefrontCandidates = compatibleCandidates.filter(
    ({ imported, candidate }) => !isEditorialUrl(imported?.sourceUrl || candidate?.url || ""),
  );
  const candidatePool = storefrontCandidates.length ? storefrontCandidates : compatibleCandidates;

  candidatePool.sort((a, b) => b.score - a.score);
  const best = candidatePool[0];
  const merged = candidatePool
    .slice(1, 6)
    .filter((item) => canMergeImportedDrafts(best.imported, item.imported, query))
    .reduce((draft, item) => mergeImportedDrafts(draft, item.imported), { ...best.imported });
  const existingProduct = findExistingProductMatch({
    sourceUrl: best.imported.sourceUrl,
    brand: merged.brand,
    nameEn: merged.nameEn,
    category: merged.category,
  });
  const mergedWithCatalog =
    existingProduct && String(existingProduct.id || "") !== ""
      ? mergeImportedDrafts(merged, catalogProductToDraft(existingProduct, query))
      : merged;

  const finalDraft = applyStrictProductIntelligence(
    {
      ...mergedWithCatalog,
      sourceUrl: best.imported.sourceUrl,
      importMeta: buildImportMetaFromDraft(mergedWithCatalog, {
        mode: "query",
        query,
        matchedTitle: best.candidate.title || best.imported.nameEn,
        resolvedUrl: best.imported.sourceUrl,
        searchedResults: candidates.length,
        evaluatedCandidates: candidatePool.length,
        usedStructuredData: candidatePool.some((item) => item.imported.importMeta?.usedStructuredData),
      }),
    },
    { rawInput: query },
  );

  return {
    draft: finalDraft,
    existingProduct: existingProduct ? serializeImportProductMatch(existingProduct) : null,
    candidates: candidatePool.slice(0, 5).map((item) => ({
      title: item.imported.nameEn || item.candidate.title,
      url: item.imported.sourceUrl,
      image: item.imported.image,
      imageCount: item.imported.gallery?.length || 0,
      specCount: item.imported.specs?.length || 0,
      score: item.score,
      draft: {
        ...item.imported,
        sourceUrl: item.imported.sourceUrl,
        importMeta: buildImportMetaFromDraft(item.imported, {
          mode: "query",
          query,
          matchedTitle: item.candidate.title || item.imported.nameEn,
          resolvedUrl: item.imported.sourceUrl,
          searchedResults: candidates.length,
          evaluatedCandidates: candidatePool.length,
          usedStructuredData: item.imported.importMeta?.usedStructuredData,
        }),
      },
    })),
  };
}

function isRichImportDraft(draft) {
  const galleryCount = Array.isArray(draft?.gallery) ? draft.gallery.length : 0;
  const specCount = Array.isArray(draft?.specs) ? draft.specs.length : 0;
  const featureCount = Array.isArray(draft?.features) ? draft.features.length : 0;
  return galleryCount >= 2 || specCount >= 2 || featureCount >= 3;
}

function searchLocalCatalogDrafts(query) {
  const normalizedQuery = normalizeComparisonText(query);
  const scored = db.products
    .map((product) => {
      const haystack = [
        product.name?.en,
        product.brand,
        product.slug,
        ...(product.features || []),
      ]
        .join(" ")
        .trim();
      const compatibility = scoreQueryCompatibility(haystack, query);
      const score = compatibility.score + countSharedTerms(haystack, query) * 2;
      const normalizedTitle = normalizeComparisonText(product.name?.en || "");
      const directTitleMatch =
        normalizedTitle.includes(normalizedQuery) || normalizedQuery.includes(normalizedTitle);
      const reliable =
        compatibility.compatible ||
        directTitleMatch ||
        (distinctiveProductTokens(query).length === 1 && countSharedTerms(product.name?.en || "", query) >= 1);
      return { product, score, compatibility, reliable };
    })
    .filter((item) => item.reliable && item.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return scored.map(({ product, score, compatibility }) => ({
    title: product.name.en,
    url: `/product/${product.slug}`,
    image: product.image,
    imageCount: (product.gallery || []).length,
    specCount: (product.specs || []).length,
    score,
    compatibility,
    draft: catalogProductToDraft(product, query, { evaluatedCandidates: scored.length }),
  }));
}

function catalogProductToDraft(product, query = "", overrides = {}) {
  const visibleSpecs = mergeSpecs(product.specs || [], []);
  const draft = {
    sourceUrl: `/product/${product.slug}`,
    nameEn: product.name.en,
    nameAr: product.name.ar || "",
    brand: product.brand,
    category: product.category,
    subCategories: product.subCategories || [],
    taglineEn: product.tagline?.en || "",
    taglineAr: product.tagline?.ar || "",
    price: product.price ?? null,
    priceUsd: product.priceUsd ?? null,
    compareAt: product.compareAt ?? null,
    compareAtUsd: product.compareAtUsd ?? null,
    officialPrice: product.officialPrice ?? product.compareAt ?? null,
    officialPriceUsd: product.officialPriceUsd ?? product.compareAtUsd ?? null,
    image: product.image || "",
    gallery: product.gallery || [],
    features: product.features || [],
    specs: visibleSpecs.map((spec) => ({
      label: typeof spec.label === "string" ? { en: spec.label, ar: "" } : spec.label,
      value: spec.value,
    })),
  };

  return applyStrictProductIntelligence({
    ...draft,
    importMeta: buildImportMetaFromDraft(draft, {
      mode: "query",
      query,
      matchedTitle: product.name.en,
      resolvedUrl: `/product/${product.slug}`,
      searchedResults: 0,
      evaluatedCandidates: overrides.evaluatedCandidates ?? 0,
      localizedImageCount: (product.gallery || []).filter((item) => String(item || "").startsWith("/")).length,
      usedStructuredData: false,
    }),
  }, { rawInput: query || product.name.en });
}

function applyStrictProductIntelligence(draft, context = {}) {
  const builtStrictProductData = buildStrictProductData(draft, context);
  const catalogClassification = buildCatalogClassificationData(draft, builtStrictProductData, context);
  const strictProductData = {
    ...builtStrictProductData,
    catalog_classification: catalogClassification,
  };
  const identity = strictProductData.product_identity || {};
  const titles = strictProductData.titles || {};
  const descriptions = strictProductData.descriptions || {};
  const importMeta = {
    ...(draft.importMeta || {}),
    publishDecision: strictProductData.publish_decision,
    confidenceOverall: strictProductData.confidence?.overall,
    qualityFlags: strictProductData.quality_flags || [],
    unitType: identity.unit_type,
    isBundle: Boolean(identity.is_bundle),
    catalogClassification,
  };

  return {
    ...draft,
    nameAr: draft.nameAr || titles.store_title_ar || titles.canonical_title,
    taglineAr: draft.taglineAr || descriptions.short_description_ar,
    strictProductData,
    importMeta,
    catalogClassification,
  };
}

function buildStrictProductData(draft, context = {}) {
  const sourceUrl = String(draft?.sourceUrl || context.sourceUrl || "");
  const rawInput = String(context.rawInput || sourceUrl || draft?.nameEn || "").replace(/\s+/g, " ").trim();
  const language = String(context.language || "ar").trim() || "ar";
  const brand = String(draft?.brand || inferBrand([draft?.nameEn, rawInput].join(" "), safeHostname(sourceUrl))).trim();
  const canonicalTitle = ensureBrandInName(String(draft?.nameEn || rawInput || "").trim(), brand);
  const model = extractStrictModelName(canonicalTitle, brand);
  const category = normalizeProductCategory({
    category: draft?.category,
    name: { en: canonicalTitle },
    brand,
    tagline: { en: draft?.taglineEn || "" },
    features: draft?.features || [],
    specs: draft?.specs || [],
    sourceUrl,
  });
  const productType = inferStrictProductType(category, [canonicalTitle, draft?.taglineEn, rawInput].join(" "));
  const unitType = inferStrictUnitType([canonicalTitle, rawInput, ...(draft?.features || [])].join(" "), category);
  const isBundle = unitType === "bundle" || /\b(bundle|kit|set|pack)\b/i.test([canonicalTitle, rawInput].join(" "));
  const identity = {
    brand: brand || null,
    series: extractStrictSeries(model),
    model: model || null,
    generation: extractStrictGeneration(canonicalTitle),
    color: extractStrictColor(canonicalTitle),
    finish: extractStrictFinish(canonicalTitle),
    sale_unit: unitType || null,
    variant_attributes: extractStrictVariantAttributes(canonicalTitle),
    product_type: productType || null,
  };
  const qualityFlags = buildStrictQualityFlags(draft, {
    rawInput,
    brand,
    model,
    category,
    sourceUrl,
    unitType,
    isBundle,
    usedStructuredData: context.usedStructuredData ?? draft?.importMeta?.usedStructuredData,
  });
  const confidence = computeStrictConfidence(draft, {
    rawInput,
    brand,
    model,
    category,
    qualityFlags,
    usedStructuredData: context.usedStructuredData ?? draft?.importMeta?.usedStructuredData,
  });
  const publishDecision = decideStrictPublishState(confidence, qualityFlags);
  const coverage = splitImportedFeatureCoverage(draft?.features || []);
  const highlights = buildStrictHighlights(draft, coverage.highlights, category);
  const boxContents = coverage.boxItems.slice(0, 8);
  const useCases = inferStrictUseCases(category, [canonicalTitle, draft?.taglineEn, ...(draft?.features || [])].join(" "));
  const technicalSpecs = buildStrictTechnicalSpecs(draft?.specs || [], context);
  const imageCandidates = buildStrictImageCandidates(draft, canonicalTitle, sourceUrl);
  const comparisons = findStrictComparisonProducts(category, canonicalTitle, brand);
  const offers = buildStrictOffers(draft, context, sourceUrl).map((offer) => ({
    ...offer,
    sale_unit: unitType || null,
  }));
  const categories = {
    primary: category,
    label_ar: STRICT_CATEGORY_AR[category] || "منتج صوتي",
    product_type: productType,
    subcategories: draft?.subCategories || [],
  };
  const tags = dedupeStrings([brand, model, productType, category, ...useCases, ...distinctiveProductTokens(canonicalTitle)]).slice(0, 14);
  const pageModules = buildStrictPageModules({
    highlights,
    technicalSpecs,
    useCases,
    boxContents,
    recommendedAccessories: inferRecommendedAccessories(category),
    comparisonProducts: comparisons,
    imageCandidates,
    offers,
  });
  const qaInput = {
    canonical_title: canonicalTitle,
    brand,
    model,
    category: productType,
    unit_type: unitType,
    is_bundle: isBundle,
    identifiers: extractStrictIdentifiers(draft, sourceUrl),
    technical_specs: technicalSpecs,
    image_candidates: imageCandidates,
    offers: offers.map((offer) => ({ amount: offer.price, currency: offer.currency_original })),
    comparison_products: comparisons,
    taxonomy: {
      category_key: category,
    },
    confidence: {
      overall: confidence,
    },
  };
  const catalogQa = runStrictCatalogQa(qaInput, draft, context);
  const allMissingFields = dedupeStrings([
	    ...catalogQa.missing_fields,
	    ...(!brand ? ["brand"] : []),
	    ...(!model ? ["model"] : []),
	    ...(category === UNKNOWN_CATEGORY ? ["category"] : []),
	    ...(!productType ? ["product_type"] : []),
    ...(!offers.length ? ["offers"] : []),
  ]);
  const allQualityFlags = dedupeStrings([
    ...qualityFlags,
    ...catalogQa.validation_errors,
    ...catalogQa.validation_warnings,
    ...allMissingFields.map((field) => `missing_${field}`),
  ]);
  const reviewRequired =
    !brand ||
    !model ||
    category === UNKNOWN_CATEGORY ||
    !productType ||
    !technicalSpecs.length ||
    !offers.length ||
    catalogQa.conflicting_fields.length > 0 ||
    !unitType ||
    catalogQa.final_publish_decision !== "auto_publish";

  const legacyStrictProductData = {
    raw_input: rawInput,
    language,
    normalized: identity,
    display: {
      normalized_name: canonicalTitle,
      store_title_ar: buildStoreTitleAr(canonicalTitle, category),
      short_description: buildShortDescriptionAr(canonicalTitle, category, highlights),
      long_description: buildLongDescriptionPlain(canonicalTitle, category, highlights, technicalSpecs, boxContents),
    },
    highlights,
    specs: technicalSpecs,
    image_candidates: imageCandidates.length
      ? imageCandidates
      : sourceUrl
        ? [{ type: "source_page", url: sourceUrl, description: `Source page for ${canonicalTitle}`, source: sourceUrl }]
        : [],
    offers,
    display_currencies: [],
    categories,
    tags,
    comparisons,
    page_modules: pageModules,
    quality: {
      overall_confidence: catalogQa.confidence_adjustments.adjusted_overall,
      review_required: reviewRequired,
      publish_decision: reviewRequired && catalogQa.final_publish_decision === "auto_publish" ? "needs_review" : catalogQa.final_publish_decision,
      quality_flags: allQualityFlags,
      missing_fields: allMissingFields,
      conflicting_fields: catalogQa.conflicting_fields,
      reasons: dedupeStrings([
        ...catalogQa.editor_notes_ar,
        ...qualityFlags,
      ]),
      validation_errors: catalogQa.validation_errors,
      validation_warnings: catalogQa.validation_warnings,
      confidence_adjustments: catalogQa.confidence_adjustments,
      editor_notes_ar: catalogQa.editor_notes_ar,
    },
  };
  const qualityGate = runEdioQualityGate(legacyStrictProductData);

  return buildEdioProductPageJson({
    rawInput,
    sourceUrl,
    brand,
    model,
    identity,
    category,
    productType,
    unitType,
    isBundle,
    canonicalTitle,
    highlights,
    technicalSpecs,
    boxContents,
    useCases,
    imageCandidates: legacyStrictProductData.image_candidates,
    offers,
    comparisons,
    qualityFlags: legacyStrictProductData.quality.quality_flags,
    catalogQa,
    qualityGate,
    baseConfidence: legacyStrictProductData.quality.overall_confidence,
  });
}

function buildEdioProductPageJson({
  rawInput,
  sourceUrl,
  brand,
  model,
  identity,
  category,
  productType,
  unitType,
  isBundle,
  canonicalTitle,
  highlights,
  technicalSpecs,
  boxContents,
  useCases,
  imageCandidates,
  offers,
  comparisons,
  qualityFlags,
  catalogQa,
  qualityGate,
  baseConfidence,
}) {
  const edioCategory = toEdioProductCategory(category, productType);
  const edioUnitType = toEdioUnitType(unitType);
  const identifiers = extractStrictIdentifiers({ specs: technicalSpecs.map((spec) => ({ label: spec.label, value: spec.value })) }, sourceUrl);
  const groupedImages = groupEdioImages(imageCandidates, canonicalTitle);
  const offerRows = buildEdioOffers(offers);
  const seo = buildEdioSeo(canonicalTitle, edioCategory, groupedImages);
  const confidence = computeEdioConfidence({
    brand,
    model,
    category: edioCategory,
    unitType: edioUnitType,
    specs: technicalSpecs,
    images: groupedImages,
    offers: offerRows,
    seo,
    baseConfidence,
    qualityGate,
  });
  const flags = buildEdioQualityFlags({
    legacyFlags: qualityFlags,
    catalogQa,
    qualityGate,
    brand,
    model,
    category: edioCategory,
    unitType: edioUnitType,
    specs: technicalSpecs,
    images: groupedImages,
    offers: offerRows,
    identifiers,
    isBundle,
  });
  const publishDecision = decideEdioPublishDecision({
    confidence,
    flags,
    brand,
    model,
    category: edioCategory,
    unitType: edioUnitType,
    images: groupedImages,
    specs: technicalSpecs,
  });
  const localizedHighlights = localizeListAr(highlights, "highlight").slice(0, 5);
  const localizedUseCases = localizeListAr(useCases, "use_case").slice(0, 5);
  const localizedBoxContents = localizeListAr(boxContents, "box").slice(0, 10);
  const recommendedAccessories = localizeListAr(inferRecommendedAccessories(category), "accessory").slice(0, 6);

  return {
    input_summary: {
      raw_input: rawInput,
      source_url: sourceUrl || null,
      brand_hint: brand || null,
    },
    product_identity: {
      brand: brand || null,
      model: model || null,
      variant: buildProductVariant(identity),
      generation: identity?.generation || null,
      color: identity?.color || null,
      category: edioCategory,
      unit_type: edioUnitType,
      is_bundle: Boolean(isBundle || edioUnitType === "bundle"),
    },
    titles: {
      canonical_title: canonicalTitle,
      store_title_ar: buildStoreTitleAr(canonicalTitle, category),
      subtitle_ar: buildEdioSubtitleAr(edioCategory, localizedUseCases),
    },
    descriptions: {
      short_description_ar: buildShortDescriptionAr(canonicalTitle, category, localizedHighlights),
      long_description_ar: buildLongDescriptionPlain(canonicalTitle, category, localizedHighlights, technicalSpecs, localizedBoxContents),
    },
    identifiers: {
      sku_local: null,
      mpn: identifiers.mpn || null,
      gtin: identifiers.gtin || null,
    },
    technical_specs: technicalSpecs.map((spec) => ({
      label: spec.label,
      value: spec.value,
      unit: spec.unit || null,
      confidence: spec.confidence,
    })),
    highlights_ar: localizedHighlights,
    use_cases_ar: localizedUseCases,
    box_contents_ar: localizedBoxContents,
    recommended_accessories: recommendedAccessories,
    comparison_products: comparisons.map((item) => ({
      title: item.title,
      slug: item.slug,
      brand: item.brand || null,
      category: toEdioProductCategory(item.category, item.category),
    })),
    faq_ar: buildStrictFaq(category, edioUnitType),
    images: {
      main: groupedImages.main,
      gallery: groupedImages.gallery,
      ports: groupedImages.ports,
      package: groupedImages.package,
      lifestyle: groupedImages.lifestyle,
      processing: {
        background: "pure_white",
        flatten_alpha: Boolean(groupedImages.flattenAlpha),
      },
    },
    offers: offerRows,
    seo,
    page_modules: {
      hero: Boolean(groupedImages.main),
      price_block: Boolean(offerRows.length),
      highlights: Boolean(localizedHighlights.length),
      use_cases: Boolean(localizedUseCases.length),
      specs_table: Boolean(technicalSpecs.length),
      box_contents: Boolean(localizedBoxContents.length),
      accessories: Boolean(recommendedAccessories.length),
      comparison: Boolean(comparisons.length),
      faq: true,
      cta_lines: buildEdioCtaLines(publishDecision, flags),
    },
    quality_flags: flags,
    confidence,
    publish_decision: publishDecision,
  };
}

function toEdioProductCategory(category, productType) {
  const type = String(productType || "").toLowerCase();
  if (type.includes("microphone")) return "Microphone";
  if (type.includes("audio interface")) return "Audio Interface";
  if (type === "iem" || type.includes("in-ear")) return "IEM";
  if (type.includes("headphone")) return "Headphones";
  if (type.includes("studio monitor")) return "Studio Monitor";
  if (type === "dac" || type.includes("dac")) return "DAC";
  if (type === "amp" || type.includes("amplifier")) return "AMP";
  if (type.includes("mixer")) return "Mixer";
  if (type.includes("bundle")) return "Bundle";

  const map = {
    headphones: "Headphones",
    iems: "IEM",
    dap: "Accessory",
    dac: "DAC",
    "audio-interface": "Audio Interface",
    mic: "Microphone",
    accessories: "Accessory",
    cable: "Cable",
  };
  return map[category] || "unknown";
}

function toEdioUnitType(unitType) {
  const value = String(unitType || "").toLowerCase();
  if (["each", "pair", "bundle", "set"].includes(value)) return value;
  if (value === "single") return "each";
  return "unknown";
}

function buildProductVariant(identity) {
  return dedupeStrings([identity?.generation, identity?.color, identity?.finish, ...(identity?.variant_attributes || [])]).join(" ") || null;
}

function groupEdioImages(imageCandidates, canonicalTitle) {
  const grouped = {
    main: null,
    gallery: [],
    ports: [],
    package: [],
    lifestyle: [],
    flattenAlpha: false,
  };

  for (const candidate of imageCandidates || []) {
    const entry = {
      url: candidate.url,
      alt_ar: `صورة ${canonicalTitle}`,
      role: candidate.type,
      decision: candidate.display_decision?.decision || null,
    };
    if ((candidate.display_decision?.reasons || []).includes("transparent_background_detected")) {
      grouped.flattenAlpha = true;
    }
    if (!grouped.main && candidate.type === "main") {
      grouped.main = entry;
      continue;
    }
    if (candidate.type === "ports") grouped.ports.push(entry);
    else if (candidate.type === "package") grouped.package.push(entry);
    else if (candidate.type === "lifestyle") grouped.lifestyle.push(entry);
    else grouped.gallery.push(entry);
  }

  return grouped;
}

function buildEdioOffers(offers) {
  return (offers || [])
    .filter((offer) => offer?.price !== null && offer?.price !== undefined && !Number.isNaN(Number(offer.price)))
    .filter((offer) => offer?.currency || offer?.currency_original)
    .map((offer) => ({
      seller: offer.source === "edio" ? "Edio" : safeHostname(offer.source_url || offer.source) || String(offer.source || "source"),
      price: Number(offer.price),
      currency: offer.currency || offer.currency_original,
      availability: offer.availability || null,
      source_url: offer.source_url || null,
      last_checked: offer.fetched_at || new Date().toISOString(),
    }))
    .filter((offer) => offer.source_url);
}

function buildEdioSeo(canonicalTitle, category, groupedImages) {
  const slug = slugify(canonicalTitle);
  const metaTitle = `${canonicalTitle} | Edio`;
  const metaDescription = `${canonicalTitle} في Edio مع معلومات منظمة عن الفئة والمواصفات والصور قبل الشراء.`;
  const keywords = dedupeStrings([
    canonicalTitle,
    category,
    ...distinctiveProductTokens(canonicalTitle),
    "Edio",
  ]).slice(0, 10);
  const imageUrls = [groupedImages.main, ...groupedImages.gallery, ...groupedImages.ports, ...groupedImages.package, ...groupedImages.lifestyle]
    .filter(Boolean)
    .slice(0, 8);
  return {
    slug,
    meta_title: metaTitle.slice(0, 70),
    meta_description: metaDescription.slice(0, 160),
    keywords,
    suggested_filenames: imageUrls.map((_, index) => `${slug || "product"}-${index + 1}`),
    alt_texts_ar: imageUrls.map((image, index) => image.alt_ar || `صورة ${canonicalTitle} رقم ${index + 1}`),
  };
}

function buildEdioSubtitleAr(category, useCases) {
  const label = edioCategoryLabelAr(category);
  const useCase = useCases[0] ? ` مناسب لـ ${useCases[0]}` : "";
  return `${label}${useCase}`.trim();
}

function edioCategoryLabelAr(category) {
  const map = {
    Microphone: "ميكروفون",
    "Audio Interface": "واجهة صوتية",
    IEM: "سماعات IEM",
    Headphones: "سماعات رأس",
    "Studio Monitor": "سماعة مراقبة ستوديو",
    DAC: "DAC",
    AMP: "مضخم صوت",
    Mixer: "ميكسر",
    Cable: "كيبل",
    Accessory: "إكسسوار صوتي",
    Bundle: "حزمة",
    unknown: "غير محددة",
  };
  return map[category] || "غير محددة";
}

function localizeListAr(values, type) {
  const map = {
    Monitoring: "المراقبة الصوتية",
    "Critical Listening": "الاستماع التحليلي",
    Mixing: "المكساج",
    "Daily Listening": "الاستماع اليومي",
    "Stage Monitoring": "المراقبة على المسرح",
    "Portable HiFi": "الاستماع المحمول عالي الجودة",
    "Portable Listening": "الاستماع المحمول",
    "Hi-Res Playback": "تشغيل ملفات عالية الدقة",
    Travel: "التنقل والسفر",
    "Desktop Listening": "الاستماع المكتبي",
    "Headphone Driving": "تشغيل السماعات",
    "Signal Conversion": "تحويل الإشارة",
    Recording: "التسجيل",
    Podcast: "البودكاست",
    "Studio Production": "الإنتاج الصوتي",
    "Studio Recording": "التسجيل الاستوديوي",
    Streaming: "البث المباشر",
    Gaming: "الألعاب",
    "Live Monitoring": "المراقبة الحية",
    "Cable Management": "تنظيم الكيابل",
    Replacement: "الاستبدال",
    "System Setup": "تجهيز النظام",
    "Headphone stand": "حامل سماعات",
    "Balanced cable": "كيبل متوازن",
    "DAC / AMP": "DAC / AMP",
    "Ear tips": "سدادات أذن",
    "Upgrade cable": "كيبل ترقية",
    "Storage case": "علبة حفظ",
    "USB-C cable": "كيبل USB-C",
    "Protective case": "غطاء حماية",
    "MicroSD card": "بطاقة MicroSD",
    "USB cable": "كيبل USB",
    Headphones: "سماعات رأس",
    "XLR cable": "كيبل XLR",
    "Microphone stand": "حامل ميكروفون",
    "Studio headphones": "سماعات ستوديو",
    "Boom arm": "ذراع ميكروفون",
    "Pop filter": "فلتر بوب",
  };

  return dedupeStrings((values || []).map((value) => map[value] || cleanArabicListItem(value, type))).filter(Boolean);
}

function cleanArabicListItem(value, type) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (/^[\u0600-\u06FF\s،]+$/.test(text)) return text;
  if (type === "highlight") return text;
  if (type === "box") return text;
  return text;
}

function buildEdioQualityFlags({ legacyFlags, catalogQa, qualityGate, brand, model, category, unitType, specs, images, offers, identifiers, isBundle }) {
  const mapped = (legacyFlags || []).map((flag) => {
    const map = {
      missing_brand: "brand_unresolved",
      missing_model: "model_ambiguous",
      missing_category: "category_unknown",
      missing_product_images: "images_missing",
      missing_technical_specs: "specs_incomplete",
      missing_highlights: "specs_incomplete",
      no_structured_product_data: "source_structured_data_missing",
      query_match_needs_review: "model_ambiguous",
      editorial_source_used: "source_priority_needs_review",
      bundle_or_set_verify_contents: "unit_type_ambiguous",
      unit_type_needs_review: "unit_type_ambiguous",
    };
    return map[flag] || flag;
  });

  const flags = [
    ...mapped,
    ...(catalogQa?.validation_errors || []),
    ...(catalogQa?.validation_warnings || []),
    ...(qualityGate?.blocking_issues || []),
    ...(qualityGate?.warnings || []),
  ].map(normalizeEdioQualityFlag);

  if (!brand) flags.push("brand_unresolved");
  if (!model) flags.push("model_ambiguous");
  if (!category || category === "unknown") flags.push("category_unknown");
  if (!unitType || unitType === "unknown") flags.push("unit_type_ambiguous");
  if (!Array.isArray(specs) || specs.length < 5) flags.push("specs_incomplete");
  if (!images?.main) flags.push("images_missing");
  if (!Array.isArray(offers) || !offers.length) flags.push("offers_missing");
  if (!identifiers?.mpn || !identifiers?.gtin) flags.push("identifier_unverified");
  if (isBundle && !Array.isArray(specs)) flags.push("brand_template_fallback");

  return dedupeStrings(flags);
}

function normalizeEdioQualityFlag(flag) {
  const map = {
    missing_brand: "brand_unresolved",
    missing_model: "model_ambiguous",
    missing_category: "category_unknown",
    missing_product_images: "images_missing",
    missing_technical_specs: "specs_incomplete",
    missing_highlights: "specs_incomplete",
    missing_offers: "offers_missing",
    no_offer_available: "offers_missing",
    specs_missing: "specs_incomplete",
    offer_missing_price: "offers_missing",
    offer_missing_currency: "offers_missing",
    offer_missing_source_url: "offers_missing",
    no_structured_product_data: "source_structured_data_missing",
    query_match_needs_review: "model_ambiguous",
    editorial_source_used: "source_priority_needs_review",
    bundle_or_set_verify_contents: "unit_type_ambiguous",
    unit_type_needs_review: "unit_type_ambiguous",
  };
  return map[flag] || flag;
}

function computeEdioConfidence({ brand, model, category, unitType, specs, images, offers, seo, baseConfidence, qualityGate }) {
  const identity = scoreParts([brand, model, category !== "unknown" ? category : "", unitType !== "unknown" ? unitType : ""]);
  const specsScore = Math.min(0.96, specs.length >= 5 ? 0.74 + Math.min(0.2, specs.length * 0.02) : specs.length ? 0.42 + specs.length * 0.06 : 0.1);
  const imagesScore = images.main ? Math.min(0.96, 0.62 + Math.min(0.24, (images.gallery.length + images.ports.length + images.package.length + images.lifestyle.length) * 0.04)) : 0.12;
  const offersScore = offers.length ? 0.86 : 0.18;
  const seoScore = seo.slug && seo.meta_title && seo.meta_description ? 0.88 : 0.35;
  const weighted = identity * 0.28 + specsScore * 0.24 + imagesScore * 0.18 + offersScore * 0.14 + seoScore * 0.08 + Number(baseConfidence || 0) * 0.08;
  const gatePenalty = qualityGate?.decision === "rejected" ? 0.12 : qualityGate?.decision === "manual_review" ? 0.04 : 0;
  let overall = Math.max(0, Math.min(0.99, weighted - gatePenalty));
  if (identity >= 0.75 && images.main && overall < 0.6) {
    overall = 0.6;
  }

  return {
    identity: Number(identity.toFixed(2)),
    specs: Number(specsScore.toFixed(2)),
    images: Number(imagesScore.toFixed(2)),
    offers: Number(offersScore.toFixed(2)),
    seo: Number(seoScore.toFixed(2)),
    overall: Number(overall.toFixed(2)),
  };
}

function scoreParts(parts) {
  const filled = parts.filter(Boolean).length;
  return Number((filled / Math.max(1, parts.length)).toFixed(2));
}

function decideEdioPublishDecision({ confidence, flags, brand, model, category, unitType, images, specs }) {
  const criticalFlags = new Set(["brand_unresolved", "model_ambiguous", "category_unknown", "unit_type_ambiguous", "images_missing"]);
  const hasCritical = flags.some((flag) => criticalFlags.has(flag) || /^critical:/.test(flag) || /prompt_injection|xss|html_detected/.test(flag));
  if (confidence.overall < 0.6 || !brand || !model || (category === "unknown" && !model) || unitType === "unknown" || flags.includes("model_ambiguous")) {
    return "reject";
  }
  if (confidence.overall >= 0.9 && !hasCritical && images.main && specs.length >= 5) {
    return "auto_publish";
  }
  return "needs_review";
}

function buildEdioCtaLines(publishDecision, flags) {
  if (publishDecision === "auto_publish") return ["جاهز للنشر التلقائي.", "راجع السعر والتوفر ثم انشر."];
  if (publishDecision === "reject") return ["لا تنشر المنتج قبل حل مشاكل الهوية أو الأمان."];
  if (flags.includes("specs_incomplete")) return ["أكمل المواصفات المؤكدة قبل النشر."];
  if (flags.includes("offers_missing")) return ["أضف عرض سعر موثق قبل النشر."];
  return ["جاهز للمراجعة اليدوية."];
}

function safeHostname(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function extractStrictModelName(title, brand) {
  let model = String(title || "").trim();
  const cleanBrand = String(brand || "").trim();
  if (cleanBrand) {
    model = model.replace(new RegExp(`^${escapeRegExp(cleanBrand)}\\s+`, "i"), "").trim();
  }
  model = model
    .replace(/\b(?:headphones?|earphones?|in-ear monitors?|microphones?|audio interface|dac(?:\/amp)?|amplifier|accessories?)\b.*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return model || String(title || "").trim();
}

function extractStrictSeries(model) {
  const value = String(model || "").trim();
  if (!value) return null;
  const match = value.match(/^([A-Za-z]+)[\s-]?\d+/);
  if (match?.[1] && match[1].length >= 2) return match[1];
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && /^[A-Za-z0-9-]+$/.test(words[0]) && !/\d/.test(words[0])) return words[0];
  return null;
}

function extractStrictGeneration(text) {
  const match = String(text || "").match(/\b(?:v\d+(?:\.\d+)?|mk\s*(?:i{1,3}|iv|v|\d+)|gen(?:eration)?\s*\d+|\d+(?:st|nd|rd|th)\s+gen|20\d{2})\b/i);
  return match ? match[0].replace(/\s+/g, " ").trim() : null;
}

function extractStrictColor(text) {
  const match = String(text || "").match(/\b(black|white|silver|blue|red|green|gold|grey|gray|clear|transparent|matte black|space gray)\b/i);
  return match ? match[0].trim() : null;
}

function extractStrictFinish(text) {
  const match = String(text || "").match(/\b(matte|glossy|brushed|polished|anodized|wood|metallic)\b/i);
  return match ? match[0].trim() : null;
}

function extractStrictVariantAttributes(text) {
  const value = String(text || "");
  return dedupeStrings([
    extractStrictGeneration(value),
    extractStrictColor(value),
    extractStrictFinish(value),
    ...[...value.matchAll(/\b(?:usb-c|usb|xlr|wireless|bluetooth|open-back|closed-back|balanced)\b/gi)].map((match) => match[0]),
  ]).filter(Boolean);
}

function inferStrictProductType(category, text) {
  const normalizedText = String(text || "").toLowerCase();
  if (/\bstudio monitor\b/.test(normalizedText)) return "Studio Monitor";
  if (/\bmixer\b/.test(normalizedText)) return "Mixer";
  if (/\bbundle|kit|set\b/.test(normalizedText)) return "Bundle";
  if (/\bamp|amplifier\b/.test(normalizedText) && !/\bdac\b/.test(normalizedText)) return "AMP";
  return STRICT_PRODUCT_TYPE_BY_CATEGORY[category] || "Accessory";
}

function inferStrictUnitType(text, category) {
  const value = String(text || "").toLowerCase();
  if (/\b(bundle|studio pack)\b/.test(value)) return "bundle";
  if (/\b(set|pack of \d+|sleeves set|tips set)\b/.test(value)) return "set";
  if (/\b(pair|stereo pair|matched pair|2x)\b/.test(value)) return "pair";
  if (/\b(each|single|1 piece|one piece)\b/.test(value)) return "each";
  return "each";
}

function buildStrictQualityFlags(draft, analysis) {
  const flags = [];
  const compatibility = scoreQueryCompatibility([draft?.nameEn, draft?.brand, draft?.sourceUrl].join(" "), analysis.rawInput);

  if (!analysis.brand) flags.push("missing_brand");
  if (!analysis.model || normalizeComparisonText(analysis.model) === normalizeComparisonText(analysis.brand)) flags.push("missing_model");
  if (!analysis.category || analysis.category === UNKNOWN_CATEGORY) flags.push("missing_category");
  if (!draft?.gallery?.length && !draft?.image) flags.push("missing_product_images");
  if (!draft?.specs?.length) flags.push("missing_technical_specs");
  if (!draft?.features?.length) flags.push("missing_highlights");
  if (!analysis.usedStructuredData) flags.push("no_structured_product_data");
  if (analysis.rawInput && !looksLikeUrl(analysis.rawInput) && !compatibility.compatible) flags.push("query_match_needs_review");
  if (isEditorialUrl(analysis.sourceUrl)) flags.push("editorial_source_used");
  if (analysis.isBundle) flags.push("bundle_or_set_verify_contents");
  if (analysis.unitType === "set" || analysis.unitType === "bundle") flags.push("unit_type_needs_review");

  return dedupeStrings(flags);
}

function computeStrictConfidence(draft, analysis) {
  let score = 0.42;
  if (analysis.brand) score += 0.1;
  if (analysis.model) score += 0.12;
  if (analysis.category && analysis.category !== UNKNOWN_CATEGORY) score += 0.08;
  if (analysis.usedStructuredData) score += 0.11;
  if ((draft?.gallery || []).length >= 2 || draft?.image) score += 0.08;
  if ((draft?.specs || []).length >= 4) score += 0.08;
  if ((draft?.features || []).length >= 3) score += 0.04;
  if (analysis.rawInput && !looksLikeUrl(analysis.rawInput)) {
    const compatibility = scoreQueryCompatibility([draft?.nameEn, draft?.brand, draft?.sourceUrl].join(" "), analysis.rawInput);
    score += compatibility.compatible ? 0.08 : -0.12;
  }
  score -= Math.min(0.26, analysis.qualityFlags.length * 0.035);
  return Math.max(0, Math.min(0.99, Number(score.toFixed(2))));
}

function decideStrictPublishState(confidence, qualityFlags) {
  const critical = new Set(["missing_model", "missing_category", "query_match_needs_review"]);
  if (confidence < 0.6 || qualityFlags.includes("missing_model")) return "reject";
  if (confidence >= 0.9 && !qualityFlags.some((flag) => critical.has(flag))) return "auto_publish";
  return "needs_review";
}

function buildStoreTitleAr(title, category) {
  const categoryLabel = STRICT_CATEGORY_AR[category] || "منتج صوتي";
  return `${title} - ${categoryLabel}`.trim();
}

function buildShortDescriptionAr(title, category, highlights) {
  const categoryLabel = STRICT_CATEGORY_AR[category] || "منتج صوتي";
  const hook = highlights[0] ? ` مع ${highlights[0]}` : "";
  return `${title} ${categoryLabel} مخصص لتجربة صوت واضحة ومنظمة${hook}.`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildLongDescriptionHtml(title, category, highlights, specs, boxContents) {
  const categoryLabel = STRICT_CATEGORY_AR[category] || "منتج صوتي";
  const parts = [
    `<p><strong>${escapeHtml(title)}</strong> هو ${escapeHtml(categoryLabel)} تم تجهيزه للعرض في المتجر اعتمادا على البيانات المتاحة من المصدر.</p>`,
  ];
  if (highlights.length) {
    parts.push(`<h3>أبرز النقاط</h3><ul>${highlights.slice(0, 5).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`);
  }
  if (specs.length) {
    parts.push(
      `<h3>المواصفات الفنية</h3><table>${specs
        .slice(0, 8)
        .map((spec) => `<tr><th>${escapeHtml(spec.label)}</th><td>${escapeHtml([spec.value, spec.unit].filter(Boolean).join(" "))}</td></tr>`)
        .join("")}</table>`,
    );
  }
  if (boxContents.length) {
    parts.push(`<h3>محتويات العلبة</h3><ul>${boxContents.slice(0, 6).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`);
  }
  parts.push("<p>لم تتم إضافة مواصفات أو أرقام تعريف غير مؤكدة؛ أي نقص ظاهر يبقى للمراجعة قبل النشر.</p>");
  return parts.join("");
}

function buildLongDescriptionPlain(title, category, highlights, specs, boxContents) {
  const categoryLabel = STRICT_CATEGORY_AR[category] || "منتج صوتي";
  const paragraphs = [
    `${title} هو ${categoryLabel} تم تنظيم بياناته اعتمادا على المصادر المتاحة بدون إضافة مواصفات غير مثبتة. الهدف من الصفحة أن تعرض للعميل المعلومة المهمة بسرعة: ماهية المنتج، استخدامه المناسب، وأبرز التفاصيل التي تساعده على قرار الشراء.`,
  ];
  if (highlights.length) {
    paragraphs.push(`أبرز النقاط العملية: ${highlights.slice(0, 5).join("، ")}.`);
  }
  if (specs.length) {
    paragraphs.push(`المواصفات الفنية محفوظة في جدول مستقل حتى تبقى البيانات واضحة وقابلة للمراجعة، مع مستوى ثقة لكل بند حسب قوة المصدر.`);
  }
  if (boxContents.length) {
    paragraphs.push(`محتويات العلبة الموثقة: ${boxContents.slice(0, 6).join("، ")}.`);
  }
  paragraphs.push("أي حقل ناقص أو غير محسوم يظهر ضمن الجودة والمراجعة بدلا من تخمينه داخل الوصف.");
  return paragraphs.join("\n\n");
}

function buildStrictTechnicalSpecs(specs, context = {}) {
  const baseConfidence = context.usedStructuredData ? 0.9 : 0.74;
  return (specs || [])
    .slice(0, 16)
    .map((spec) => {
      const label = String(spec?.label?.en || spec?.label || "").trim();
      const value = String(spec?.value || "").trim();
      return {
        group: inferStrictSpecGroup(label),
        label,
        value,
        unit: inferStrictSpecUnit(label, value),
        confidence: baseConfidence,
      };
    })
    .filter((spec) => spec.label && spec.value);
}

function inferStrictSpecGroup(label) {
  const value = String(label || "").toLowerCase();
  if (/driver|frequency|impedance|sensitivity|spl|response/.test(value)) return "audio";
  if (/input|output|connector|usb|xlr|interface|port/.test(value)) return "connectivity";
  if (/weight|dimension|size|material|color/.test(value)) return "physical";
  if (/battery|power|phantom|voltage|watt/.test(value)) return "power";
  return "general";
}

function inferStrictSpecUnit(label, value) {
  const text = `${label} ${value}`.toLowerCase();
  if (/\bhz|khz\b/.test(text)) return /khz/.test(text) ? "kHz/Hz" : "Hz";
  if (/\bohm|Ω\b/i.test(`${label} ${value}`)) return "Ohm";
  if (/\bdb\b/.test(text)) return "dB";
  if (/\bmm\b/.test(text)) return "mm";
  if (/\bg\b|\bgram/.test(text)) return "g";
  if (/\bw\b|\bwatts?\b/.test(text)) return "W";
  if (/\bmah\b/.test(text)) return "mAh";
  if (/\bbit\b/.test(text)) return "bit";
  return null;
}

function extractStrictIdentifiers(draft, sourceUrl) {
  const specs = draft?.specs || [];
  const find = (patterns) => {
    const match = specs.find((spec) => patterns.some((pattern) => pattern.test(String(spec?.label?.en || spec?.label || ""))));
    return match ? String(match.value || "").trim() || null : null;
  };
  return {
    gtin: find([/^gtin$/i, /^ean$/i, /^upc$/i]) || null,
    mpn: find([/^mpn$/i, /^manufacturer part/i]) || null,
    sku: null,
    source_url: sourceUrl || null,
  };
}

function buildStrictImageCandidates(draft, canonicalTitle, sourceUrl) {
  return (draft?.gallery || [])
    .slice(0, 12)
    .map((imageUrl, index) => {
      const imageType = index === 0 ? "main" : inferStrictImageType(imageUrl);
      const desiredRole = imageType === "main" ? "hero" : imageType;
      return {
        type: imageType,
        url: imageUrl,
        description: index === 0 ? `Main product image for ${canonicalTitle}` : `Gallery image ${index + 1} for ${canonicalTitle}`,
        source: sourceUrl || "imported",
        display_decision: buildImageDisplayDecision(readImageMetaFromUrl(imageUrl), desiredRole),
      };
    });
}

function buildStrictOffers(draft, context, sourceUrl) {
  const offers = [];
  const fetchedAt = new Date().toISOString();
  const push = (type, amount, currency, source) => {
    if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return;
    const normalizedCurrency = String(currency || "").toUpperCase();
    const normalizedSource = String(source || sourceUrl || "source").trim();
    offers.push({
      type,
      price: Number(amount),
      currency: normalizedCurrency,
      currency_original: normalizedCurrency,
      source: normalizedSource,
      source_url: looksLikeUrl(normalizedSource) ? normalizedSource : sourceUrl || "edio://catalog",
      fetched_at: fetchedAt,
      availability: null,
      sale_unit: null,
    });
  };
  push("source_price", context.sourcePrice, String(context.sourceCurrency || "USD").toUpperCase(), sourceUrl || "source");
  push("source_compare_at", context.sourceCompareAt, String(context.sourceCurrency || "USD").toUpperCase(), sourceUrl || "source");
  push("store_price", draft?.price, "IQD", "edio");
  push("store_price_usd", draft?.priceUsd, "USD", "edio");
  push("store_compare_at", draft?.officialPrice ?? draft?.compareAt, "IQD", "edio");
  push("store_compare_at_usd", draft?.officialPriceUsd ?? draft?.compareAtUsd, "USD", "edio");
  return offers;
}

function findStrictComparisonProducts(category, canonicalTitle, brand) {
  const titleKey = normalizeComparisonText(canonicalTitle);
  const brandKey = normalizeComparisonText(brand);
  return db.products
    .filter((product) => normalizeProductCategory(product) === category)
    .filter((product) => normalizeComparisonText(product.name?.en || "") !== titleKey)
    .filter((product) => !brandKey || normalizeComparisonText(product.brand || "") !== brandKey || countSharedTerms(product.name?.en || "", canonicalTitle) < 2)
    .slice(0, 3)
    .map((product) => ({
      title: product.name?.en || "",
      slug: product.slug || "",
      brand: product.brand || "",
      category: normalizeProductCategory(product),
    }))
    .filter((item) => item.title && item.slug);
}

function buildStrictPageModules({ highlights, technicalSpecs, useCases, boxContents, recommendedAccessories, comparisonProducts, imageCandidates, offers }) {
  return [
    { key: "hero", title: "Hero", visible: Boolean(imageCandidates.length) },
    { key: "highlights", title: "Highlights", visible: Boolean(highlights.length) },
    { key: "specs_table", title: "Specs table", visible: Boolean(technicalSpecs.length) },
    { key: "use_cases", title: "Use cases", visible: Boolean(useCases.length) },
    { key: "box_contents", title: "Box contents", visible: Boolean(boxContents.length) },
    { key: "recommended_accessories", title: "Recommended accessories", visible: Boolean(recommendedAccessories.length) },
    { key: "comparison", title: "Comparison", visible: Boolean(comparisonProducts.length) },
    { key: "offers", title: "Offers", visible: Boolean(offers.length) },
    { key: "faq", title: "FAQ", visible: true },
    { key: "cta", title: "CTA", visible: true },
  ];
}

function runStrictCatalogQa(productJson, draft, context = {}) {
  const validationErrors = [];
  const validationWarnings = [];
  const missingFields = [];
  const conflictingFields = [];
  const editorNotes = [];
  const sourceText = [
    context.rawInput,
    context.sourceTitle,
    context.sourceDescription,
    draft?.taglineEn,
    ...(draft?.features || []),
    ...(draft?.specs || []).flatMap((spec) => [spec?.label?.en || spec?.label || "", spec?.value || ""]),
  ]
    .join(" ")
    .toLowerCase();

  const addMissing = (field, note) => {
    missingFields.push(field);
    if (note) editorNotes.push(note);
  };

  if (!productJson.canonical_title) addMissing("canonical_title", "العنوان التجاري غير مكتمل.");
  if (!productJson.brand) addMissing("brand", "البراند غير محسوم.");
  if (!productJson.model) {
    addMissing("model", "الموديل غير محسوم ولا يجب نشر المنتج تلقائيا.");
    validationErrors.push("critical: model_not_resolved");
  }
  if (!productJson.category) addMissing("category", "الفئة غير واضحة.");
  if (!productJson.image_candidates?.length) addMissing("image_candidates", "الصورة الرئيسية غير متوفرة.");
  if (!productJson.technical_specs?.length) addMissing("technical_specs", "المواصفات الفنية غير كافية.");

  for (const [key, value] of Object.entries(productJson.identifiers || {})) {
    if (!value || key === "source_url") continue;
    const normalized = String(value).trim();
    if ((key === "gtin" && !/^\d{8,14}$/.test(normalized)) || /(?:unknown|n\/a|not available|tbd)/i.test(normalized)) {
      validationErrors.push(`critical: invalid_or_invented_identifier_${key}`);
    }
  }

  const sourceSaysPair = /\b(pair|stereo pair|matched pair|زوج)\b/i.test(sourceText);
  const sourceSaysSingle = /\b(each|single|واحدة|قطعة واحدة)\b/i.test(sourceText);
  const sourceSaysBundle = /\b(bundle|kit|set|حزمة|طقم)\b/i.test(sourceText);
  if (productJson.unit_type === "pair" && sourceSaysSingle) {
    validationErrors.push("critical: unit_type_pair_conflicts_with_source_single");
    conflictingFields.push("unit_type");
  }
  if ((productJson.unit_type === "each" || productJson.unit_type === "single") && sourceSaysPair) {
    validationErrors.push("critical: unit_type_each_conflicts_with_source_pair");
    conflictingFields.push("unit_type");
  }
  if (!productJson.is_bundle && sourceSaysBundle) {
    validationErrors.push("critical: bundle_source_conflicts_with_is_bundle_false");
    conflictingFields.push("is_bundle");
  }

  for (const offer of productJson.offers || []) {
    if (offer.amount !== null && offer.amount !== undefined && !offer.currency) {
      validationErrors.push("price_without_currency");
      conflictingFields.push("offers.currency");
    }
    if (offer.amount !== null && offer.amount !== undefined && Number(offer.amount) < 0) {
      validationErrors.push("invalid_negative_price");
      conflictingFields.push("offers.amount");
    }
  }
  if (!(productJson.offers || []).length) {
    validationWarnings.push("no_offer_available");
    editorNotes.push("لا يوجد سعر مؤكد ضمن البيانات المستوردة.");
  }

  const mainImage = (productJson.image_candidates || []).find((image) => image.type === "main");
  if (!mainImage?.url) {
    validationWarnings.push("main_image_missing_blocks_auto_publish");
  } else if (/logo|icon|sprite|cookie|avatar|banner|placeholder/i.test(mainImage.url)) {
    validationWarnings.push("main_image_policy_warning_blocks_auto_publish");
    conflictingFields.push("image_candidates.main");
  }

  if ((productJson.comparison_products || []).some((item) => item.category && item.category !== productJson.taxonomy?.category_key)) {
    validationErrors.push("comparison_product_category_mismatch");
    conflictingFields.push("comparison_products");
  }

  const originalOverall = Number(productJson.confidence?.overall || 0);
  let adjustedOverall = originalOverall;
  adjustedOverall -= validationErrors.length * 0.18;
  adjustedOverall -= validationWarnings.length * 0.04;
  adjustedOverall -= Math.min(0.14, missingFields.length * 0.03);
  adjustedOverall = Math.max(0, Math.min(0.99, Number(adjustedOverall.toFixed(2))));

  const hasCriticalError = validationErrors.some((error) => /^critical:/.test(error));
  const blocksAutoPublish = validationWarnings.some((warning) => /blocks_auto_publish/.test(warning));
  let finalDecision = "needs_review";
  if (hasCriticalError || adjustedOverall < 0.6 || missingFields.includes("model")) {
    finalDecision = "reject";
  } else if (adjustedOverall >= 0.9 && !blocksAutoPublish) {
    finalDecision = "auto_publish";
  }

  if (!editorNotes.length) {
    editorNotes.push("راجع التنبيهات ثم انشر فقط إذا كانت البيانات مطابقة للمصدر.");
  }

  return {
    validation_errors: dedupeStrings(validationErrors),
    validation_warnings: dedupeStrings(validationWarnings),
    missing_fields: dedupeStrings(missingFields),
    conflicting_fields: dedupeStrings(conflictingFields),
    confidence_adjustments: {
      original_overall: originalOverall,
      adjusted_overall: adjustedOverall,
      reason: validationErrors.length || validationWarnings.length || missingFields.length ? "qa_penalties_applied" : "no_penalty",
    },
    final_publish_decision: finalDecision,
    editor_notes_ar: dedupeStrings(editorNotes),
  };
}

function runEdioQualityGate(productDraft) {
  const blockingIssues = [];
  const warnings = [];
  const fixes = [];
  const queueWeights = {
    pricing: 0,
    media: 0,
    specs: 0,
    safety: 0,
    naming: 0,
  };
  let score = Number(productDraft?.quality?.overall_confidence ?? 0.82);

  const addFix = (fix) => {
    if (fix) fixes.push(fix);
  };
  const pushBlocking = (queue, message, fix) => {
    blockingIssues.push(message);
    queueWeights[queue] = (queueWeights[queue] || 0) + 3;
    addFix(fix);
    score -= 0.18;
  };
  const pushWarning = (queue, message, fix) => {
    warnings.push(message);
    queueWeights[queue] = (queueWeights[queue] || 0) + 1;
    addFix(fix);
    score -= 0.04;
  };

  const normalized = productDraft?.normalized || {};
  const display = productDraft?.display || {};
  const name = String(display.normalized_name || display.store_title_ar || "").trim();
  const brand = String(normalized.brand || "").trim();
  const model = String(normalized.model || "").trim();
  const generation = String(normalized.generation || "").trim();

  if (!name || name.length < 4) {
    pushBlocking("naming", "name_missing_or_too_short", "أدخل اسم منتج واضح يحافظ على البراند والموديل.");
  }
  if (name.length > 120) {
    pushWarning("naming", "name_too_long", "اختصر العنوان التجاري واحذف الكلمات غير البيعية.");
  }
  if (hasRepeatedAdjacentWords(name)) {
    pushWarning("naming", "name_repeats_words", "احذف الكلمات المكررة من الاسم.");
  }
  if (!brand) {
    pushWarning("naming", "brand_missing", "ثبّت البراند من مصدر موثوق قبل النشر.");
  } else if (!modelPreservedInText(brand, name)) {
    pushBlocking("naming", "brand_missing_from_name", "أعد إدراج البراند في العنوان.");
  }
  if (!model) {
    pushBlocking("naming", "model_missing", "لا تنشر المنتج قبل حسم الموديل.");
  } else if (!modelPreservedInText(model, name)) {
    pushBlocking("naming", "model_missing_from_name", "أعد إدراج الموديل كما هو.");
  }
  if (generation && !modelPreservedInText(generation, name)) {
    pushWarning("naming", "generation_missing_from_name", "أعد إدراج الجيل لأنه جزء من هوية المنتج.");
  }

  const specs = Array.isArray(productDraft?.specs) ? productDraft.specs : [];
  if (!specs.length) {
    pushWarning("specs", "specs_missing", "أضف مواصفات موثوقة من المصدر الرسمي أو متجر موثوق.");
  }
  const specValuesByLabel = new Map();
  for (const spec of specs) {
    const label = String(spec?.label || "").trim();
    const value = String(spec?.value || "").trim();
    if (!label || !value) continue;
    const labelKey = normalizeComparisonText(label);
    const valueKey = normalizeComparisonText(value);
    if (/(unknown|n\/a|tbd|estimated|guess|تقريبا|تقديري|غير معروف)/i.test(`${label} ${value}`)) {
      pushWarning("specs", "spec_contains_uncertain_value", `راجع المواصفة: ${label}.`);
    }
    if (labelKey && specValuesByLabel.has(labelKey) && specValuesByLabel.get(labelKey) !== valueKey) {
      pushBlocking("specs", "conflicting_specs", `حل تعارض المواصفة: ${label}.`);
    }
    specValuesByLabel.set(labelKey, valueKey);
  }

  const offers = Array.isArray(productDraft?.offers) ? productDraft.offers : [];
  if (!offers.length) {
    pushWarning("pricing", "offers_missing", "أضف عرض سعر موثق أو اترك المنتج للمراجعة اليدوية.");
  }
  for (const offer of offers) {
    const hasPrice = offer?.price !== undefined && offer?.price !== null && !Number.isNaN(Number(offer.price));
    if (!hasPrice) {
      pushBlocking("pricing", "offer_missing_price", "كل عرض يحتاج price واضح.");
    }
    if (!offer?.currency && !offer?.currency_original) {
      pushBlocking("pricing", "offer_missing_currency", "كل عرض يحتاج currency.");
    }
    if (!offer?.source_url) {
      pushBlocking("pricing", "offer_missing_source_url", "كل عرض يحتاج source_url قابل للتتبع.");
    }
    if (!offer?.fetched_at) {
      pushWarning("pricing", "offer_missing_fetched_at", "احفظ fetched_at مع كل عرض.");
    }
    if (offer?.sale_price !== undefined && !hasPrice) {
      pushBlocking("pricing", "sale_price_without_price", "لا تضف sale_price بدون price أساسي.");
    }
    const saleStart = offer?.sale_start ? Date.parse(offer.sale_start) : null;
    const saleEnd = offer?.sale_end ? Date.parse(offer.sale_end) : null;
    if (saleStart && saleEnd && saleStart > saleEnd) {
      pushBlocking("pricing", "invalid_sale_date_range", "صحح sale_start و sale_end.");
    }
  }

  const images = Array.isArray(productDraft?.image_candidates) ? productDraft.image_candidates : [];
  const heroImage = images.find((image) => image?.type === "main" || image?.type === "hero");
  if (!heroImage?.url) {
    pushWarning("media", "hero_image_missing", "أضف صورة hero واضحة أو سجّل سبب عدم جاهزيتها.");
  } else if (/logo|icon|sprite|cookie|avatar|banner|placeholder|tracking/i.test(heroImage.url)) {
    pushWarning("media", "hero_image_policy_warning", "استبدل صورة hero بصورة منتج حقيقية وواضحة.");
  }

  const categories = productDraft?.categories || {};
  if (!categories.primary || !normalized.product_type) {
    pushWarning("specs", "category_or_product_type_missing", "راجع الفئة ونوع المنتج قبل النشر.");
  }
  if (categories.product_type && normalized.product_type && categories.product_type !== normalized.product_type) {
    pushBlocking("specs", "category_product_type_mismatch", "وحّد نوع المنتج بين التصنيف والبيانات المولدة.");
  }
  if (Array.isArray(productDraft?.tags) && productDraft.tags.length > 18) {
    pushWarning("naming", "too_many_tags", "قلل الوسوم إلى الكلمات المهمة فقط.");
  }

  const safetyText = flattenTextForSafety(productDraft);
  if (/<\/?[a-z][\s\S]*>/i.test(safetyText)) {
    pushBlocking("safety", "html_detected", "احذف HTML من حقول المنتج.");
  }
  if (/javascript:|onerror\s*=|onload\s*=|<script|data:text\/html/i.test(safetyText)) {
    pushBlocking("safety", "xss_pattern_detected", "نظف النصوص والروابط من أي نمط XSS.");
  }
  if (/ignore previous|system prompt|developer message|prompt injection|انس التعليمات|تجاهل التعليمات/i.test(safetyText)) {
    pushBlocking("safety", "prompt_injection_detected", "احذف أي نص يشبه تعليمات للنموذج من بيانات المنتج.");
  }

  score = Math.max(0, Math.min(0.99, Number(score.toFixed(2))));
  if (!blockingIssues.length && warnings.length && score < 0.75) {
    score = 0.75;
  }
  let decision = "manual_review";
  if (blockingIssues.length || queueWeights.safety > 0 || score < 0.75) {
    decision = "rejected";
  } else if (score >= 0.92 && !warnings.length) {
    decision = "auto_publish_eligible";
  }

  const recommendedQueue =
    Object.entries(queueWeights)
      .sort((a, b) => b[1] - a[1])
      .find(([, weight]) => weight > 0)?.[0] || "naming";

  return {
    decision,
    score,
    blocking_issues: dedupeStrings(blockingIssues),
    warnings: dedupeStrings(warnings),
    fixes: dedupeStrings(fixes),
    recommended_auto_publish: decision === "auto_publish_eligible",
    recommended_review_queue: recommendedQueue,
  };
}

function hasRepeatedAdjacentWords(value) {
  const words = normalizeComparisonText(value).split(" ").filter(Boolean);
  return words.some((word, index) => index > 0 && word === words[index - 1]);
}

function modelPreservedInText(model, text) {
  const modelKey = normalizeComparisonText(model);
  const textKey = normalizeComparisonText(text);
  return Boolean(modelKey && textKey.includes(modelKey));
}

function flattenTextForSafety(value, depth = 0) {
  if (depth > 5 || value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => flattenTextForSafety(item, depth + 1)).join(" ");
  if (typeof value === "object") {
    return Object.values(value)
      .map((item) => flattenTextForSafety(item, depth + 1))
      .join(" ");
  }
  return "";
}

function buildStrictHighlights(draft, sourceHighlights, category) {
  const highlights = cleanFeatureCandidates(sourceHighlights || []).slice(0, 6);
  if (highlights.length) return highlights;
  const specsText = (draft?.specs || []).map((spec) => `${spec?.label?.en || spec?.label || ""} ${spec?.value || ""}`).join(" ");
  const inferred = [];
  if (/\bplanar\b/i.test(specsText)) inferred.push("Planar magnetic driver");
  if (/\bcardioid\b/i.test(specsText)) inferred.push("Cardioid pickup pattern");
  if (/\busb\b/i.test(specsText)) inferred.push("USB connectivity");
  if (category === "audio-interface" && /\bxlr\b/i.test(specsText)) inferred.push("XLR recording connectivity");
  return inferred.slice(0, 4);
}

function inferStrictUseCases(category, text) {
  const useCases = [...(STRICT_CATEGORY_USE_CASES[category] || [])];
  const value = String(text || "").toLowerCase();
  if (/\bgaming\b/.test(value)) useCases.push("Gaming");
  if (/\bpodcast|broadcast\b/.test(value)) useCases.push("Podcast");
  if (/\bstage|live\b/.test(value)) useCases.push("Live Monitoring");
  return dedupeStrings(useCases).slice(0, 5);
}

function inferRecommendedAccessories(category) {
  const map = {
    headphones: ["Headphone stand", "Balanced cable", "DAC / AMP"],
    iems: ["Ear tips", "Upgrade cable", "Storage case"],
    dap: ["USB-C cable", "Protective case", "MicroSD card"],
    dac: ["USB cable", "Balanced cable", "Headphones"],
    "audio-interface": ["XLR cable", "Microphone stand", "Studio headphones"],
    mic: ["XLR cable", "Boom arm", "Pop filter"],
    accessories: [],
  };
  return map[category] || [];
}

function buildStrictFaq(category, unitType) {
  const unitAnswer = unitType === "pair" ? "يتم التعامل معه كزوج في المتجر ما لم يذكر المصدر خلاف ذلك." : "يتم التعامل معه كقطعة واحدة ما لم يذكر المصدر خلاف ذلك.";
  const categoryAnswer = STRICT_CATEGORY_AR[category] ? `التصنيف الحالي هو ${STRICT_CATEGORY_AR[category]}.` : "التصنيف يحتاج مراجعة قبل النشر.";
  return [
    { q: "هل المنتج مفرد أم زوج؟", a: unitAnswer },
    { q: "ما التصنيف المناسب لهذا المنتج؟", a: categoryAnswer },
  ];
}

function buildCatalogClassificationData(draft, strictProductData, context = {}) {
  const rawInput = String(
    context.rawInput ||
      strictProductData?.input_summary?.raw_input ||
      draft?.importMeta?.query ||
      draft?.sourceUrl ||
      draft?.nameEn ||
      "",
  )
    .replace(/\s+/g, " ")
    .trim();
  const identity = strictProductData?.product_identity || {};
  const canonicalTitle = strictProductData?.titles?.canonical_title || draft?.nameEn || rawInput;
  const brand = identity.brand || draft?.brand || inferBrand([canonicalTitle, rawInput].join(" "), safeHostname(draft?.sourceUrl || ""));
  const model = identity.model || extractStrictModelName(canonicalTitle, brand);
  const siteCategory = normalizeProductCategory({
    category: draft?.category,
    name: { en: canonicalTitle },
    brand,
    tagline: { en: draft?.taglineEn || "" },
    features: draft?.features || [],
    specs: draft?.specs || [],
  });
  const productType =
    inferStrictProductType(siteCategory, [canonicalTitle, rawInput, draft?.taglineEn].join(" ")) ||
    strictProductData?.product_identity?.category;
  const saleUnit = identity.unit_type || inferStrictUnitType([canonicalTitle, rawInput, ...(draft?.features || [])].join(" "), siteCategory);
  const generation = identity.generation || extractStrictGeneration(canonicalTitle);
  const color = identity.color || extractStrictColor(canonicalTitle);
  const variantAttributes = dedupeStrings([
    generation,
    color,
    identity.variant,
    ...extractStrictVariantAttributes(canonicalTitle),
  ]);
  const confidence = Number(strictProductData?.confidence?.overall || 0);
  const classificationCanResolve = confidence >= 0.75 && siteCategory !== UNKNOWN_CATEGORY;
  const subSection = classificationCanResolve ? inferCatalogClassificationSubSection(siteCategory, draft, productType) : "";
  const leafCategory = classificationCanResolve ? inferCatalogLeafCategory(siteCategory, subSection, productType) : "";
  const dynamicCollections = inferCatalogDynamicCollections(draft, context);
  const missingFields = buildCatalogClassificationMissingFields({
    brand,
    model,
    productType,
    saleUnit,
    siteCategory,
  });
  const conflicts = buildCatalogClassificationConflicts(draft, strictProductData, siteCategory, saleUnit);
  const reviewRequired = confidence < 0.92 || missingFields.length > 0 || conflicts.length > 0;

  return {
    raw_input: rawInput,
    normalized: {
      brand: brand || "",
      series: extractStrictSeries(model) || "",
      model: model || "",
      generation: generation || "",
      product_type: productType || "",
      sale_unit: saleUnit || "unknown",
      is_variant: Boolean(variantAttributes.length),
      variant_attributes: variantAttributes,
    },
    classification: {
      top_level_section: classificationCanResolve ? siteCategory : "",
      sub_section: subSection,
      leaf_category: leafCategory,
      dynamic_collections: dynamicCollections,
      reasoning_summary: buildCatalogClassificationReason({
        brand,
        model,
        siteCategory,
        productType,
        saleUnit,
        confidence,
        classificationCanResolve,
        reviewRequired,
      }),
    },
    display_rules: {
      show_new_badge: dynamicCollections.includes("new"),
      show_recently_added_badge: dynamicCollections.includes("new-arrivals"),
      show_bundle_badge: saleUnit === "bundle",
      show_each_badge: saleUnit === "each",
      show_pair_badge: saleUnit === "pair",
      priority_specs: inferCatalogPrioritySpecs(siteCategory, brand),
      primary_use_cases: (strictProductData?.use_cases_ar?.length
        ? strictProductData.use_cases_ar
        : localizeListAr(inferStrictUseCases(siteCategory, [canonicalTitle, rawInput, draft?.taglineEn].join(" ")), "use_case")
      ).slice(0, 5),
    },
    quality: {
      confidence,
      review_required: reviewRequired,
      missing_fields: missingFields,
      conflicts,
    },
    sources_used: buildCatalogClassificationSources(draft?.sourceUrl, brand),
  };
}

function inferCatalogClassificationSubSection(category, draft, productType) {
  const explicitSubCategory = (draft?.subCategories || []).map((item) => String(item || "").trim()).find(Boolean);
  if (explicitSubCategory) return explicitSubCategory;

  const haystack = [
    draft?.nameEn,
    draft?.brand,
    draft?.taglineEn,
    productType,
    ...(draft?.features || []),
    ...(draft?.specs || []).flatMap((spec) => [spec?.label?.en || spec?.label || "", spec?.value || ""]),
  ]
    .join(" ")
    .toLowerCase();

  if (category === "headphones") {
    if (/\bopen-back|open back\b/.test(haystack)) return "open-back";
    if (/\bclosed-back|closed back\b/.test(haystack)) return "closed-back";
    if (/\bon-ear|on ear\b/.test(haystack)) return "on-ear";
    return "over-ear";
  }
  if (category === "iems") {
    if (/\btrue wireless|tws\b/.test(haystack)) return "true-wireless";
    if (/\bcustom iem|ciem\b/.test(haystack)) return "custom-iem";
    if (/\bplanar\b/.test(haystack)) return "planar";
    if (/\bhybrid|balanced armature| ba\b/.test(haystack)) return "hybrid";
    return "in-ear-monitor";
  }
  if (category === "dap") return "portable-player";
  if (category === "dac") {
    if (/\bdongle|usb-c|portable\b/.test(haystack)) return "portable-dac";
    if (/\bdesktop\b/.test(haystack)) return "desktop-dac";
    return "dac-amp";
  }
  if (category === "audio-interface") return "recording-interface";
  if (category === "mic") {
    if (/\busb\b/.test(haystack)) return "usb-microphone";
    if (/\bcondenser\b/.test(haystack)) return "condenser-microphone";
    if (/\bdynamic\b/.test(haystack)) return "dynamic-microphone";
    return "microphone";
  }
  if (category === "accessories") {
    if (/\bcable|connector|adapter|mmcx|2-pin|usb-c|xlr\b/.test(haystack)) return "cables-adapters";
    if (/\bear ?tips?|eartips?|sleeves?\b/.test(haystack)) return "ear-tips";
    if (/\bcase|pouch|stand|holder\b/.test(haystack)) return "storage-care";
    return "audio-accessory";
  }

  return "";
}

function inferCatalogLeafCategory(category, subSection, productType) {
  if (subSection) return subSection;
  if (category === UNKNOWN_CATEGORY) return "";
  const normalizedType = slugify(productType);
  return normalizedType && normalizedType !== "unknown" ? normalizedType : category;
}

function inferCatalogDynamicCollections(draft, context = {}) {
  const badge = getEffectiveBadge(draft);
  const collections = [];
  if (badge === "new") collections.push("new");
  if (badge === "preowned") collections.push("pre-owned");
  if (draft?.id ? isWithinNewBadgeWindow(draft) : (draft?.importMeta?.mode || context.rawInput)) {
    collections.push("new-arrivals");
  }
  if (Number(draft?.compareAt || draft?.officialPrice || 0) > Number(draft?.price || 0)) collections.push("sale");
  if (draft?.inStock === true || Number(draft?.stock || 0) > 0) collections.push("in-stock");
  if (draft?.inStock === false || Number(draft?.stock || 0) === 0 && draft?.stock !== undefined) collections.push("out-of-stock");
  return dedupeStrings(collections).filter((slug) => resolveCollection(slug));
}

function inferCatalogPrioritySpecs(category, brand) {
  const brandKey = keyify(brand);
  const brandPriority = {
    shure: ["polar_pattern", "impedance", "gain_requirement", "connector", "included_accessories"],
    focusrite: ["i_o_count", "generation", "dynamic_range", "phantom_power", "software_bundle"],
    yamaha: ["sale_unit", "driver_size", "power", "frequency_response", "room_control"],
    audiotechnica: ["driver_size", "comfort", "isolation", "included_cables", "folding_design"],
    beyerdynamic: ["impedance_variant", "open_closed", "comfort", "frequency_response", "studio_use"],
    fiio: ["inputs", "outputs", "output_power_by_load", "max_sampling_rate", "gain_modes"],
    ifiaudio: ["outputs", "output_power", "output_impedance", "desktop_use", "max_sampling_rate"],
    mogami: ["connector_a", "connector_b", "length", "balanced", "cable_type"],
  };
  if (brandPriority[brandKey]) return brandPriority[brandKey];

  const categoryPriority = {
    headphones: ["open_closed", "driver_mm", "impedance", "sensitivity", "frequency_response"],
    iems: ["driver_type", "impedance", "sensitivity", "cable", "isolation"],
    dap: ["storage", "battery", "dac_chip", "outputs", "bluetooth"],
    dac: ["inputs", "outputs", "max_pcm", "max_dsd", "output_power"],
    "audio-interface": ["i_o_count", "phantom_power", "bit_depth", "sample_rate", "gain_range"],
    mic: ["transducer_type", "polar_pattern", "frequency_response", "impedance", "connector"],
    accessories: ["accessory_type", "compatibility", "quantity", "connector", "length"],
  };
  return categoryPriority[category] || [];
}

function buildCatalogClassificationMissingFields({ brand, model, productType, saleUnit, siteCategory }) {
  return dedupeStrings([
    !brand ? "brand" : "",
    !model ? "model" : "",
    !productType || productType === "unknown" ? "product_type" : "",
    !saleUnit || saleUnit === "unknown" ? "sale_unit" : "",
    !siteCategory || siteCategory === UNKNOWN_CATEGORY ? "category" : "",
  ]);
}

function buildCatalogClassificationConflicts(draft, strictProductData, siteCategory, saleUnit) {
  const flags = strictProductData?.quality_flags || [];
  const conflicts = [];
  if (draft?.importMeta?.categoryResolution?.needsReview) conflicts.push("category_needs_review");
  if (siteCategory === UNKNOWN_CATEGORY || flags.includes("category_unknown")) conflicts.push("category_unknown");
  if (saleUnit === "unknown" || flags.includes("unit_type_ambiguous")) conflicts.push("unit_type_ambiguous");
  if (flags.includes("model_ambiguous")) conflicts.push("model_ambiguous");
  if (flags.includes("source_priority_needs_review")) conflicts.push("source_priority_needs_review");
  if (strictProductData?.publish_decision === "reject") conflicts.push("publish_gate_rejected");
  return dedupeStrings(conflicts);
}

function buildCatalogClassificationReason({ brand, model, siteCategory, productType, saleUnit, confidence, classificationCanResolve, reviewRequired }) {
  if (!classificationCanResolve) {
    return "لم يتم حسم القسم النهائي لأن الثقة منخفضة أو لأن المنتج لا يطابق أقسام EDIO الحالية بوضوح.";
  }
  const label = STRICT_CATEGORY_AR[siteCategory] || siteCategory;
  const reviewText = reviewRequired ? " مع إرسال النتيجة للمراجعة قبل النشر." : " ويمكن استخدامه بدون إنشاء قسم جديد.";
  return `تمت مطابقة ${[brand, model].filter(Boolean).join(" ") || "المنتج"} مع قسم ${label} اعتماداً على النوع ${productType || "غير محدد"} ووحدة البيع ${saleUnit || "unknown"} بثقة ${Math.round(confidence * 100)}%${reviewText}`;
}

function buildCatalogClassificationSources(sourceUrl, brand) {
  const sources = [];
  const sourceType = classifyCatalogSourceType(sourceUrl, brand);
  if (sourceType) {
    sources.push({
      source_type: sourceType,
      name: safeHostname(sourceUrl) || "source",
      url: sourceUrl,
    });
  }
  sources.push({
    source_type: "internal_taxonomy",
    name: "EDIO current taxonomy",
    url: "/api/categories",
  });
  return sources;
}

function classifyCatalogSourceType(sourceUrl, brand) {
  const value = String(sourceUrl || "").trim();
  if (!value) return "";
  if (value.startsWith("/product/")) return "internal_taxonomy";
  const host = safeHostname(value);
  if (!host) return "";
  if (isTrustedRetailerHost(host)) return "retailer";
  if (isOfficialBrandHost(host, brand)) return "official";
  return "retailer";
}

function isTrustedRetailerHost(host) {
  const normalized = String(host || "").replace(/^www\./i, "").toLowerCase();
  return TRUSTED_RETAILER_HOSTS.some((domain) => normalized === domain || normalized.endsWith(`.${domain}`));
}

function isOfficialBrandHost(host, brand) {
  const normalizedHost = String(host || "").replace(/^www\./i, "").toLowerCase();
  const brandKey = keyify(brand);
  if (!brandKey) return false;
  const domains = Object.entries(BRAND_SEARCH_DOMAINS).find(([key]) => sameKey(key, brandKey))?.[1] || [];
  const officialDomains = domains.filter((domain) => !isTrustedRetailerHost(domain));
  if (officialDomains.some((domain) => normalizedHost === domain || normalizedHost.endsWith(`.${domain}`))) return true;
  const firstHostPart = normalizedHost.split(".").filter(Boolean).find((part) => !["en", "eu", "us", "uk", "au", "ca", "tw", "jp", "store", "shop"].includes(part)) || "";
  return firstHostPart ? keyify(firstHostPart).includes(brandKey) || brandKey.includes(keyify(firstHostPart)) : false;
}

function inferStrictImageType(imageUrl) {
  const value = String(imageUrl || "").toLowerCase();
  if (/\b(port|ports|input|output|rear|back)\b/.test(value)) return "ports";
  if (/\b(package|box|contents|bundle)\b/.test(value)) return "package";
  if (/\b(lifestyle|studio|desk|setup)\b/.test(value)) return "lifestyle";
  return "gallery";
}

function buildImportMetaFromDraft(draft, overrides = {}) {
  const coverage = splitImportedFeatureCoverage(draft?.features || []);
  const strictProductData = overrides.strictProductData ?? draft?.strictProductData;
  return {
    mode: overrides.mode || draft?.importMeta?.mode || "query",
    query: overrides.query ?? draft?.importMeta?.query,
    matchedTitle: overrides.matchedTitle ?? draft?.importMeta?.matchedTitle,
    resolvedUrl: overrides.resolvedUrl ?? draft?.sourceUrl ?? draft?.importMeta?.resolvedUrl,
    searchedResults: overrides.searchedResults ?? draft?.importMeta?.searchedResults,
    evaluatedCandidates: overrides.evaluatedCandidates ?? draft?.importMeta?.evaluatedCandidates,
    imageCount: overrides.imageCount ?? (draft?.gallery?.length || 0),
    localizedImageCount:
      overrides.localizedImageCount ??
      (draft?.gallery || []).filter((item) => String(item || "").startsWith("/media/imports/")).length,
    featureCount: overrides.featureCount ?? coverage.highlights.length,
    boxItemCount: overrides.boxItemCount ?? coverage.boxItems.length,
    specCount: overrides.specCount ?? (draft?.specs?.length || 0),
    usedStructuredData: overrides.usedStructuredData ?? draft?.importMeta?.usedStructuredData ?? false,
    publishDecision:
      overrides.publishDecision ??
      draft?.importMeta?.publishDecision ??
      strictProductData?.quality?.publish_decision ??
      strictProductData?.publish_decision,
    confidenceOverall:
      overrides.confidenceOverall ??
      draft?.importMeta?.confidenceOverall ??
      strictProductData?.quality?.overall_confidence ??
      strictProductData?.confidence?.overall,
    qualityFlags:
      overrides.qualityFlags ??
      draft?.importMeta?.qualityFlags ??
      strictProductData?.quality?.quality_flags ??
      strictProductData?.quality_flags ??
      [],
    unitType:
      overrides.unitType ??
      draft?.importMeta?.unitType ??
      strictProductData?.normalized?.sale_unit ??
      strictProductData?.product_identity?.unit_type ??
      strictProductData?.unit_type,
    isBundle:
      overrides.isBundle ??
      draft?.importMeta?.isBundle ??
      (strictProductData?.normalized?.sale_unit === "bundle" ? true : undefined) ??
      strictProductData?.product_identity?.is_bundle ??
      strictProductData?.is_bundle ??
      false,
    catalogClassification:
      overrides.catalogClassification ??
      draft?.importMeta?.catalogClassification ??
      draft?.catalogClassification ??
      strictProductData?.catalog_classification ??
      null,
  };
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

function extractImageUrls(html, pageUrl, options = {}) {
  const query = String(options.query || "").trim();
  const candidates = [];
  const pushCandidates = (items) => {
    for (const item of items || []) {
      if (!item?.url) continue;
      candidates.push(item);
    }
  };

  const mediaSnippets = extractLikelyProductMediaSnippets(html, pageUrl);
  for (const snippet of mediaSnippets) {
    pushCandidates(extractImageCandidatesFromSnippet(snippet, pageUrl, query, 28));
  }

  for (const snippet of extractEmbeddedProductSnippets(html, pageUrl)) {
    pushCandidates(extractImageCandidatesFromSnippet(snippet, pageUrl, query, 22));
  }

  const metaPatterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
  ];

  for (const pattern of metaPatterns) {
    for (const match of html.matchAll(pattern)) {
      const score = scoreImageCandidate(match[1], "meta-image", pageUrl, query) + 10;
      if (score > 0) candidates.push({ url: normalizeImageCandidate(match[1], pageUrl), score });
    }
  }

  pushCandidates(extractImageCandidatesFromAttributes(html, pageUrl, query, 0));

  const unique = [];
  const seen = new Set();
  for (const item of candidates
    .filter((candidate) => candidate?.url && candidate.score > 0)
    .sort((a, b) => b.score - a.score)) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    unique.push(item.url);
    if (unique.length >= 20) break;
  }

  return unique;
}

function extractEmbeddedProductSignals(html, pageUrl, query = "") {
  const snippets = extractEmbeddedProductSnippets(html, pageUrl);
  let best = { title: "", brand: "", productType: "", images: [], score: -1 };

  for (const snippet of snippets) {
    const title = decodeJsonFragment((snippet.match(/"title"\s*:\s*"([^"]+)"/i) || [])[1] || "");
    const brand =
      decodeJsonFragment((snippet.match(/"vendor"\s*:\s*"([^"]+)"/i) || [])[1] || "") ||
      decodeJsonFragment((snippet.match(/"brand"\s*:\s*"([^"]+)"/i) || [])[1] || "");
    const productType =
      decodeJsonFragment((snippet.match(/"type"\s*:\s*"([^"]+)"/i) || [])[1] || "") ||
      decodeJsonFragment((snippet.match(/"product_type"\s*:\s*"([^"]+)"/i) || [])[1] || "");
    const images = extractImageCandidatesFromSnippet(snippet, pageUrl, query || title, 24)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.url)
      .filter((value, index, list) => list.indexOf(value) === index)
      .slice(0, 20);
    const score = images.length * 3 + (title ? 3 : 0) + (brand ? 2 : 0) + (productType ? 1 : 0);

    if (score > best.score) {
      best = { title, brand, productType, images, score };
    }
  }

  return best;
}

function extractEmbeddedProductSnippets(html, pageUrl) {
  const handle = escapeRegExp(titleFromProductUrl(pageUrl).toLowerCase());
  if (!handle) return [];

  const snippets = [];
  const seen = new Set();
  const patterns = [
    new RegExp(`"handle"\\s*:\\s*"${handle}"`, "gi"),
    new RegExp(`data-product-handle=["']${handle}["']`, "gi"),
    new RegExp(`productHandle\\s*[:=]\\s*"${handle}"`, "gi"),
    new RegExp(`"url"\\s*:\\s*"\\\\/products\\\\/${handle}(?:[^"]*)"`, "gi"),
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const start = Math.max(0, match.index - 2400);
      const end = Math.min(html.length, match.index + 26000);
      const snippet = html.slice(start, end);
      const key = `${start}:${end}`;
      if (seen.has(key)) continue;
      seen.add(key);
      snippets.push(snippet);
    }
  }

  return snippets;
}

function extractLikelyProductMediaSnippets(html, pageUrl) {
  const handle = titleFromProductUrl(pageUrl).toLowerCase();
  const snippets = [];
  const seen = new Set();
  const patterns = [
    /<media-gallery[\s\S]*?<\/media-gallery>/gi,
    /<section[^>]+class=["'][^"']*(?:product__media|product-media|product-gallery|media-gallery)[^"']*["'][\s\S]{0,24000}?<\/section>/gi,
    /<div[^>]+class=["'][^"']*(?:product__media|product-media|product-gallery|media-gallery|m-product-media--slider__images)[^"']*["'][\s\S]{0,18000}?<\/div>/gi,
    /<section[^>]+class=["'][^"']*(?:product-feature|feature-row|feature-block|product-overview|overview-media|product-story|story-block|technology-block)[^"']*["'][\s\S]{0,18000}?<\/section>/gi,
    /<div[^>]+class=["'][^"']*(?:product-feature|feature-row|feature-block|product-overview|overview-media|product-story|story-block|technology-block)[^"']*["'][\s\S]{0,14000}?<\/div>/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const snippet = match[0];
      if (handle && !snippet.toLowerCase().includes(handle) && /data-product-handle/i.test(snippet)) continue;
      const key = snippet.slice(0, 200);
      if (seen.has(key)) continue;
      seen.add(key);
      snippets.push(snippet);
    }
  }

  return snippets;
}

function extractImageCandidatesFromSnippet(snippet, pageUrl, query, baseScore = 0) {
  const candidates = [];
  const push = (candidate, context) => {
    const normalized = normalizeImageCandidate(candidate, pageUrl);
    if (!normalized) return;
    const score = baseScore + scoreImageCandidate(normalized, context, pageUrl, query);
    if (score <= 0) return;
    candidates.push({ url: normalized, score });
  };

  for (const match of snippet.matchAll(/(?:srcset|data-srcset)=["']([^"']+)["']/gi)) {
    for (const candidate of String(match[1] || "")
      .split(",")
      .map((item) => item.trim().split(/\s+/)[0])
      .filter(Boolean)) {
      push(candidate, snippet);
    }
  }

  for (const match of snippet.matchAll(/(?:src|data-src|data-image|data-zoom-image|data-lazy-src|href)=["']([^"']+)["']/gi)) {
    push(match[1], snippet);
  }

  for (const match of snippet.matchAll(/"(?:src|source|image|featured_image|featuredImage)"\s*:\s*"([^"]+)"/gi)) {
    push(decodeJsonFragment(match[1]), snippet);
  }

  for (const match of snippet.matchAll(/"images"\s*:\s*\[([\s\S]*?)\]/gi)) {
    for (const imageMatch of match[1].matchAll(/"([^"]+\.(?:jpe?g|png|webp|avif|gif)(?:[^"]*)?)"/gi)) {
      push(decodeJsonFragment(imageMatch[1]), snippet);
    }
  }

  return candidates;
}

function extractImageCandidatesFromAttributes(html, pageUrl, query, baseScore = 0) {
  const candidates = [];
  const push = (candidate, context) => {
    const normalized = normalizeImageCandidate(candidate, pageUrl);
    if (!normalized) return;
    const score = baseScore + scoreImageCandidate(normalized, context, pageUrl, query);
    if (score <= 0) return;
    candidates.push({ url: normalized, score });
  };

  for (const match of html.matchAll(/<img[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)["'][^>]*>/gi)) {
    const snippet = html.slice(Math.max(0, match.index - 280), Math.min(html.length, match.index + 600));
    push(match[1], snippet);
  }

  for (const match of html.matchAll(/"image"\s*:\s*"([^"]+)"/gi)) {
    const snippet = html.slice(Math.max(0, match.index - 280), Math.min(html.length, match.index + 600));
    push(decodeJsonFragment(match[1]), snippet);
  }

  return candidates;
}

function hasDecorativeImportedImageSignal(value) {
  return /(?:^|[\s/_-])(?:cookie|cookies|consent|mascot|avatar|author|profile|portrait|team|staff|logo|sprite|icon|placeholder|newsletter|banner|payment|trust|social|facebook|instagram|youtube|tiktok|whatsapp|telegram|chat|support|reviewer|award|badge|cartoon|illustration|giveaway|reward)(?:[\s._/-]|$)/i.test(
    String(value || ""),
  );
}

function scoreImageCandidate(candidate, context, pageUrl, query = "") {
  let url;
  try {
    url = new URL(candidate, pageUrl);
  } catch {
    return -100;
  }

  const pathText = decodeURIComponent(url.pathname).toLowerCase();
  const contextText = String(context || "").toLowerCase();
  const filename = pathText.split("/").pop() || "";
  const queryTokens = distinctiveProductTokens(query || titleFromProductUrl(pageUrl));
  let score = 0;
  const isTrustedRetailProductAsset =
    /(?:^|\.)static-thomann\.de$/i.test(url.hostname) &&
    /\/pics\/(?:bdb|prod|bdbo)\//.test(pathText) &&
    !/thumb80|favicon|cookie/.test(pathText);
  const trustedProductContext = /media-gallery|product-media|product__media|product-gallery|featured_image|m-product-media|slider__images|schema\.org\/product|application\/ld\+json/.test(
    contextText,
  );

  if (hasDecorativeImportedImageSignal(pathText) || hasDecorativeImportedImageSignal(filename)) return -100;
  if (hasDecorativeImportedImageSignal(contextText)) score -= 42;

  if (trustedProductContext) score += 18;
  if (isTrustedRetailProductAsset) score += 30;
  if (/feature-block|product-description|description|content|details|overview|product-feature|story|technology|highlights?|benefits|in the box|package/.test(contextText)) score += 8;
  if (/meta-image/.test(contextText)) score += 8;
  if (/product-card|recommend|related|announcement|blog|article|collection|mega-banner|reward|recently viewed|upsell|teaser|video|youtube/.test(contextText)) score -= 22;
  if (/logo|icon|badge|breadcrumb|footer|header|payment|social|author|review-avatar|newsletter|chat|support|shipping|returns|warranty|cookie|consent|mascot|cartoon|illustration/.test(contextText)) score -= 24;
  if (/thumbnail|thumbs|thumb-list|thumb-slider|product__thumbnail|gallery-thumbs|slider-nav|slider-dots|carousel-nav|flickity-button|swiper-button|aria-label=["']go to item|go to slide|go to item|data-thumb|thumbnail-button|pagination/.test(contextText)) score -= 28;

  if (/\/(blogs?|articles?)\//.test(pathText)) score -= 24;
  if (/\/products?\//.test(pathText)) score += 8;
  if (/\/files\//.test(pathText)) score += 3;
  if (/logo|icon|favicon|sprite|flag|swatch|thumb|thumbnail|placeholder/.test(pathText)) score -= isTrustedRetailProductAsset ? 3 : 24;
  if (/(?:[_-](?:thumb|thumbnail|small|compact|icon|nav)|\/(?:thumb|thumbs|thumbnails)\/)/.test(pathText)) score -= isTrustedRetailProductAsset ? 2 : 20;
  if (/bundle|giveaway|reward|promo|sale-banner|newsletter/.test(pathText)) score -= 12;

  const tokenHits = queryTokens.filter((token) => pathText.includes(token) || filename.includes(token)).length;
  const contextTokenHits = queryTokens.filter((token) => contextText.includes(token)).length;
  score += tokenHits * 5;
  score += contextTokenHits * 3;
  const requiredContextHits = Math.max(1, Math.ceil(queryTokens.length * 0.35));
  const hasQuerySignal = tokenHits > 0 || contextTokenHits >= requiredContextHits;
  if (queryTokens.length && !hasQuerySignal && !trustedProductContext) score -= 36;
  if (queryTokens.length && tokenHits === 0 && /product-card|recommend|related|collection|reward/.test(contextText)) score -= 10;
  if (queryTokens.length && tokenHits === 0 && contextTokenHits === 0 && /footer|header|payment|newsletter|social|support/.test(contextText)) score -= 12;

  const widthMatch = contextText.match(/\bwidth=["']?(\d{1,4})/i);
  const heightMatch = contextText.match(/\bheight=["']?(\d{1,4})/i);
  const width = widthMatch ? Number(widthMatch[1]) : 0;
  const height = heightMatch ? Number(heightMatch[1]) : 0;
  if ((width && width <= 140) || (height && height <= 140)) score -= 18;
  if ((width && width <= 220) || (height && height <= 220)) {
    if (/thumbnail|thumbs|gallery-thumbs|slider-nav|carousel-nav|go to item|pagination/.test(contextText)) score -= 22;
  }

  return score;
}

function decodeJsonFragment(value) {
  return String(value || "")
    .replace(/\\u003c/g, "<")
    .replace(/\\u003e/g, ">")
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"')
    .trim();
}

function extractProductSchema(html, pageUrl) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const candidates = [];

  for (const match of scripts) {
    const raw = decodeHtmlEntities(match[1]).trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      for (const item of flattenJsonLd(parsed)) {
        const types = normalizeSchemaTypes(item?.["@type"]);
        if (!types.includes("product")) continue;
        candidates.push(item);
      }
    } catch {
      continue;
    }
  }

  const item = candidates[0];
  if (!item) {
    return { used: false, name: "", description: "", brand: "", images: [], specs: [], price: null, compareAt: null, currency: "USD" };
  }

  const images = dedupeStrings(
    arrayify(item.image).map((value) => normalizeImageCandidate(typeof value === "string" ? value : value?.url, pageUrl)),
  ).filter(Boolean);
  const offers = arrayify(item.offers)[0] || {};
  const price = toOptionalNumber(offers.price ?? item.price);
  const compareAt = toOptionalNumber(offers.highPrice ?? item.msrp ?? item.priceSpecification?.price);
  const currency = String(
    offers.priceCurrency ||
      item.priceCurrency ||
      item.priceSpecification?.priceCurrency ||
      "USD",
  )
    .trim()
    .toUpperCase();
  const specs = [];
  const pushSpec = (label, value) => {
    const normalizedLabel = normalizeSpecLabel(String(label || "").trim());
    const normalizedValue = formatSchemaMeasurement(value);
    if (!normalizedLabel || !normalizedValue) return;
    if (specs.some((item) => String(item.label?.en || item.label || "").toLowerCase() === normalizedLabel.toLowerCase())) return;
    specs.push({
      label: { en: normalizedLabel, ar: "" },
      value: normalizedValue,
    });
  };

  for (const property of arrayify(item.additionalProperty)) {
    const label = property?.name || property?.propertyID || "";
    const value = property?.value || property?.valueReference?.name || "";
    pushSpec(label, value);
  }

  pushSpec("MPN", item.mpn);
  pushSpec("Model", item.model);
  pushSpec("Color", item.color);
  pushSpec("Material", item.material);
  pushSpec("Weight", item.weight);

  return {
    used: true,
    name: String(item.name || "").trim(),
    description: String(item.description || "").trim(),
    brand: typeof item.brand === "string" ? item.brand : String(item.brand?.name || "").trim(),
    category: String(item.category || "").trim(),
    productType: String(item.productType || item.category || "").trim(),
    images,
    specs,
    price,
    compareAt,
    currency,
  };
}

function formatSchemaMeasurement(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return cleanSpecValue(value);
  if (typeof value !== "object") return "";

  const rawValue = value.value ?? value.name ?? value.amount ?? value.minValue ?? "";
  const unit = value.unitText ?? value.unitCode ?? value.unit ?? "";
  return cleanSpecValue([rawValue, unit].filter(Boolean).join(" "));
}

function flattenJsonLd(value) {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (value && typeof value === "object" && Array.isArray(value["@graph"])) return value["@graph"].flatMap(flattenJsonLd);
  return value ? [value] : [];
}

function normalizeSchemaTypes(value) {
  return arrayify(value)
    .map((item) => String(item || "").toLowerCase().trim())
    .filter(Boolean);
}

function mergeSpecs(primary, secondary) {
  const merged = [];
  const add = (spec) => {
    const normalizedLabel = normalizeSpecLabel(String(spec?.label?.en || spec?.label || ""));
    const key = normalizedLabel
      .toLowerCase()
      .trim();
    const value = String(spec?.value || "").trim();
    if (!key || !value || isHiddenSpecLabel(normalizedLabel)) return;
    if (merged.some((item) => String(item.label.en || item.label).toLowerCase().trim() === key)) return;
    merged.push({
      ...spec,
      label:
        typeof spec.label === "string"
          ? normalizedLabel
          : { ...spec.label, en: normalizedLabel },
      value: cleanSpecValue(value),
    });
  };

  for (const spec of primary || []) add(spec);
  for (const spec of secondary || []) add(spec);
  return merged.slice(0, 16);
}

function mergeImportedDrafts(base, fallback) {
  const mergedSpecs = mergeSpecs(base.specs || [], fallback.specs || []);
  const mergedFeatures = cleanFeatureCandidates([...(base.features || []), ...(fallback.features || [])]);
  const mergedTagline = selectDisplayDescription({
    tagline: base.taglineEn || fallback.taglineEn || "",
    features: mergedFeatures,
    specs: mergedSpecs,
  });
  const baseGallery = dedupeStrings(base.gallery || []);
  const fallbackGallery = dedupeStrings(fallback.gallery || []);
  const mergedGallery =
    baseGallery.length >= 8
      ? baseGallery.slice(0, 12)
      : dedupeStrings([...baseGallery, ...fallbackGallery]).slice(0, 12);

  return {
    ...base,
    nameEn: base.nameEn || fallback.nameEn,
    nameAr: base.nameAr || fallback.nameAr,
    brand: base.brand || fallback.brand,
    category: base.category || fallback.category,
    subCategories: dedupeStrings([...(base.subCategories || []), ...(fallback.subCategories || [])]).slice(0, 6),
    taglineEn: mergedTagline,
    taglineAr: base.taglineAr || fallback.taglineAr,
    price: base.price ?? fallback.price ?? null,
    priceUsd: base.priceUsd ?? fallback.priceUsd ?? null,
    compareAt: base.compareAt ?? fallback.compareAt ?? null,
    compareAtUsd: base.compareAtUsd ?? fallback.compareAtUsd ?? null,
    officialPrice: base.officialPrice ?? fallback.officialPrice ?? base.compareAt ?? fallback.compareAt ?? null,
    officialPriceUsd:
      base.officialPriceUsd ?? fallback.officialPriceUsd ?? base.compareAtUsd ?? fallback.compareAtUsd ?? null,
    image: base.image || fallback.image,
    gallery: mergedGallery,
    features: mergedFeatures,
    specs: mergedSpecs,
  };
}

async function sendImportedAsset(res, pathname) {
  try {
    const relativePath = pathname.replace(/^\/media\/imports\//, "");
    const filePath = path.normalize(path.join(IMPORT_MEDIA_DIR, relativePath));
    const allowedRoot = path.normalize(IMPORT_MEDIA_DIR);
    if (!filePath.startsWith(`${allowedRoot}${path.sep}`)) throw new ApiError(400, "validation_error", "Invalid asset path");
    const contents = await readFile(filePath);
    res.writeHead(200, { "Content-Type": getMimeType(filePath), "Cache-Control": "public, max-age=31536000, immutable" });
    res.end(contents);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(404, "not_found", "Imported asset not found");
  }
}

async function localizeImportedImages(imageUrls, seed) {
  const results = [];
  const seen = new Set();

  for (const imageUrl of imageUrls.slice(0, 20)) {
    try {
      const localized = await downloadImportedImage(imageUrl, seed);
      if (localized && !seen.has(localized)) {
        seen.add(localized);
        results.push(localized);
      }
    } catch {
      continue;
    }
  }

  return results;
}

async function persistAdminProductMedia(body = {}) {
  const seed = String(body.seed || body.name || "product").trim() || "product";
  const files = Array.isArray(body.files) ? body.files : [];
  const urls = Array.isArray(body.urls) ? body.urls : [];
  const media = [];
  const seen = new Set();

  for (const [index, file] of files.slice(0, 12).entries()) {
    try {
      const persisted = await persistUploadedProductImage({ ...file, productId: body.productId || null }, seed, index === 0 ? "hero" : "gallery");
      if (persisted?.url && !seen.has(persisted.url)) {
        seen.add(persisted.url);
        media.push(persisted);
      }
    } catch {
      continue;
    }
  }

  for (const [index, url] of urls.slice(0, 20).entries()) {
    try {
      const persistedUrl = await downloadImportedImage(url, seed, { importJobId: body.importJobId || null, productId: body.productId || null });
      if (persistedUrl && !seen.has(persistedUrl)) {
        seen.add(persistedUrl);
        media.push({
          url: persistedUrl,
          sourceUrl: String(url || ""),
          kind: "remote",
          displayDecision: buildImageDisplayDecision(readImageMetaFromUrl(persistedUrl), index === 0 ? "hero" : "gallery"),
        });
      }
    } catch {
      continue;
    }
  }

  if (!media.length) {
    throw new ApiError(400, "media_upload_failed", "No usable product images were uploaded or imported.");
  }

  return { media };
}

async function persistUploadedProductImage(file, seed, desiredRole = "gallery") {
  const filename = String(file?.name || "product-image").trim();
  const contentType = String(file?.type || "").trim().toLowerCase();
  const rawData = String(file?.data || "").trim();
  const base64 = rawData.includes(",") ? rawData.split(",").pop() : rawData;
  if (!base64) throw new ApiError(400, "validation_error", "Image data is missing");
  if (contentType && !ALLOWED_IMAGE_CONTENT_TYPES.has(normalizeContentType(contentType))) {
    throw new ApiError(400, "invalid_image_type", "Only JPG, PNG, WebP, and AVIF product images are allowed");
  }

  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length || buffer.length > 6_000_000) {
    throw new ApiError(413, "payload_too_large", "Each image must be smaller than 6 MB");
  }
  const uploadedMeta = readImageMetaFromBuffer(buffer, filename, contentType);
  if (!["jpg", "png", "webp", "avif"].includes(uploadedMeta.format) || !uploadedMeta.width || !uploadedMeta.height) {
    throw new ApiError(400, "invalid_image", "Uploaded file must be a valid JPG, PNG, WebP, or AVIF image");
  }

  if (!shouldPersistImportedImage(buffer, filename)) {
    throw new ApiError(400, "invalid_image", "The uploaded image is too small or not suitable for the product gallery");
  }

  const normalized = normalizeProductImageBufferForStorage(buffer, {
    sourceName: filename,
    sourceUrl: filename,
    kind: "upload",
  });
  const storedBuffer = normalized.buffer;
  const hash = crypto.createHash("sha1").update(storedBuffer).digest("hex").slice(0, 12);
  const extension = normalized.changed
    ? ".png"
    : extensionFromContentType(contentType) || path.extname(filename).toLowerCase() || ".jpg";
  const safeSeed = slugify(seed || "product") || "product";
  const safeExtension = ALLOWED_IMAGE_EXTENSIONS.has(extension)
    ? extension
    : ".jpg";
  const storedName = `${safeSeed}-${hash}${safeExtension}`;
  const filePath = path.join(IMPORT_MEDIA_DIR, storedName);
  if (!existsSync(filePath)) {
    await writeFile(filePath, storedBuffer);
    if (normalized.changed) {
      await writeFile(`${filePath}.meta.json`, JSON.stringify(normalized.log, null, 2));
    }
  }
  const storedUrl = `/media/imports/${storedName}`;
  const checksum = checksumBuffer(storedBuffer);
  const registered = registerMediaAsset({
    productId: file.productId || null,
    url: storedUrl,
    storedUrl,
    sourceUrl: filename,
    sourceType: "upload",
    role: desiredRole,
    checksum,
    metadata: readImageMetaFromBuffer(storedBuffer, storedUrl, getMimeType(filePath)),
    normalizationLog: normalized.changed ? { ...normalized.log, outputUrl: storedUrl } : null,
  });

  return {
    url: storedUrl,
    mediaAssetId: registered?.mediaAsset?.id || null,
    name: filename,
    type: getMimeType(filePath),
    size: storedBuffer.length,
    kind: "upload",
    displayDecision: buildImageDisplayDecision(readImageMetaFromBuffer(storedBuffer, storedUrl, getMimeType(filePath)), desiredRole),
    normalizationLog: normalized.changed ? { ...normalized.log, outputUrl: storedUrl } : null,
  };
}

async function downloadImportedImage(imageUrl, seed, options = {}) {
  const response = await retryWithBackoff(
    async () => {
      const fetched = await fetchWithBrowserHeaders(imageUrl, {
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        timeoutMs: 16000,
        retries: 0,
      });
      if ([408, 425, 429, 500, 502, 503, 504].includes(fetched.status)) {
        const retryAfter = Number(fetched.headers.get("retry-after") || 0);
        const error = new Error(`transient_image_fetch_${fetched.status}`);
        error.retryAfterMs = retryAfter > 0 ? retryAfter * 1000 : 0;
        throw error;
      }
      return fetched;
    },
    { maxAttempts: 3, baseMs: 300 },
  );
  if (!response.ok) return "";

  assertImageResponse(response);
  const resolvedImageUrl = response.url || imageUrl;
  const buffer = await readResponseBufferWithLimit(response, MAX_REMOTE_IMAGE_BYTES, "Product image");
  const remoteMeta = readImageMetaFromBuffer(buffer, resolvedImageUrl, response.headers.get("content-type") || "");
  if (!["jpg", "png", "webp", "avif"].includes(remoteMeta.format) || !remoteMeta.width || !remoteMeta.height) {
    throw new ApiError(400, "invalid_image", "Remote file is not a valid JPG, PNG, WebP, or AVIF image");
  }
  if (!shouldPersistImportedImage(buffer, imageUrl)) return "";
  const normalized = normalizeProductImageBufferForStorage(buffer, {
    sourceName: resolvedImageUrl,
    sourceUrl: resolvedImageUrl,
    kind: "remote",
  });
  const storedBuffer = normalized.buffer;
  const hash = crypto.createHash("sha1").update(storedBuffer).digest("hex").slice(0, 12);
  const extension = normalized.changed
    ? ".png"
    : extensionFromContentType(response.headers.get("content-type")) ||
      path.extname(new URL(resolvedImageUrl).pathname).toLowerCase() ||
      ".jpg";
  if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
    throw new ApiError(400, "invalid_image_type", "Only JPG, PNG, WebP, and AVIF product images are allowed");
  }
  const safeSeed = slugify(seed || "product") || "product";
  const filename = `${safeSeed}-${hash}${extension}`;
  const filePath = path.join(IMPORT_MEDIA_DIR, filename);
  const storedUrl = `/media/imports/${filename}`;
  if (existsSync(filePath)) {
    registerMediaAsset({
      productId: options.productId || null,
      url: storedUrl,
      storedUrl,
      sourceUrl: resolvedImageUrl,
      sourceType: options.sourceType || "retailer",
      role: options.role || "gallery",
      checksum: checksumBuffer(storedBuffer),
      metadata: readImageMetaFromBuffer(storedBuffer, storedUrl, getMimeType(filePath)),
      normalizationLog: normalized.changed ? { ...normalized.log, outputUrl: storedUrl } : null,
      importJobId: options.importJobId || options.jobId || null,
    });
    return storedUrl;
  }
  await writeFile(filePath, storedBuffer);
  if (normalized.changed) {
    await writeFile(`${filePath}.meta.json`, JSON.stringify({ ...normalized.log, outputUrl: storedUrl }, null, 2));
  }
  registerMediaAsset({
    productId: options.productId || null,
    url: storedUrl,
    storedUrl,
    sourceUrl: resolvedImageUrl,
    sourceType: options.sourceType || "retailer",
    role: options.role || "gallery",
    checksum: checksumBuffer(storedBuffer),
    metadata: readImageMetaFromBuffer(storedBuffer, storedUrl, getMimeType(filePath)),
    normalizationLog: normalized.changed ? { ...normalized.log, outputUrl: storedUrl } : null,
    importJobId: options.importJobId || options.jobId || null,
  });
  return storedUrl;
}

function normalizeProductImageBufferForStorage(buffer, { sourceName = "", sourceUrl = "", kind = "" } = {}) {
  const meta = readImageMetaFromBuffer(buffer, sourceName);
  if (meta.format !== "png" || meta.transparent !== true) {
    return {
      changed: false,
      buffer,
      log: {
        action: "image_normalization_skipped",
        reason: meta.format === "png" ? "png_without_detected_transparency" : "not_png",
        sourceName,
        sourceUrl,
        kind,
        before: meta,
        after: meta,
      },
    };
  }

  try {
    const normalized = normalizePngTransparencyToWhite(buffer, PRODUCT_IMAGE_NORMALIZATION_POLICY);
    return {
      ...normalized,
      log: {
        ...normalized.log,
        sourceName,
        sourceUrl,
        kind,
      },
    };
  } catch (error) {
    return {
      changed: false,
      buffer,
      log: {
        action: "image_normalization_failed",
        reason: error?.message || "unable_to_normalize_png",
        sourceName,
        sourceUrl,
        kind,
        before: meta,
        after: meta,
      },
    };
  }
}

function extensionFromContentType(contentType) {
  const type = String(contentType || "").toLowerCase();
  if (type.includes("image/jpeg")) return ".jpg";
  if (type.includes("image/png")) return ".png";
  if (type.includes("image/webp")) return ".webp";
  if (type.includes("image/avif")) return ".avif";
  if (type.includes("image/gif")) return ".gif";
  if (type.includes("image/svg")) return ".svg";
  return "";
}

function shouldPersistImportedImage(buffer, imageUrl) {
  const meta = detectImageDimensions(buffer);
  if (!meta.width || !meta.height) return true;

  const shorterSide = Math.min(meta.width, meta.height);
  const longerSide = Math.max(meta.width, meta.height);
  const aspectRatio = longerSide / Math.max(1, shorterSide);
  const lowerUrl = String(imageUrl || "").toLowerCase();
  const sizeHint = extractSizedImageHint(lowerUrl);

  if (hasDecorativeImportedImageSignal(lowerUrl)) return false;
  if (shorterSide <= 180) return false;
  if (aspectRatio >= 5.2) return false;
  if (
    shorterSide <= 420 &&
    (/thumb|thumbnail|swatch|nav|pagination|carousel|slider|small|compact|icon/.test(lowerUrl) ||
      (sizeHint && sizeHint.width <= 420 && sizeHint.height <= 420))
  ) {
    return false;
  }

  return true;
}

function isRemoteImageUrl(value) {
  try {
    const parsed = new URL(String(value || ""));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function extractSizedImageHint(value) {
  const match = String(value || "").match(/(?:[_-]|\/)(\d{2,4})x(\d{2,4})(?=[^0-9]|$)/i);
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

function detectImageDimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 32) return { width: 0, height: 0 };

  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const size = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3 && size >= 7) {
        return {
          width: buffer.readUInt16BE(offset + 7),
          height: buffer.readUInt16BE(offset + 5),
        };
      }
      if (size < 2) break;
      offset += 2 + size;
    }
  }

  if (buffer.slice(0, 4).toString("ascii") === "RIFF" && buffer.slice(8, 12).toString("ascii") === "WEBP") {
    const chunkType = buffer.slice(12, 16).toString("ascii");
    if (chunkType === "VP8X" && buffer.length >= 30) {
      return {
        width: 1 + buffer.readUIntLE(24, 3),
        height: 1 + buffer.readUIntLE(27, 3),
      };
    }
    if (chunkType === "VP8 " && buffer.length >= 30) {
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      };
    }
    if (chunkType === "VP8L" && buffer.length >= 25) {
      const bits = buffer.readUInt32LE(21);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
  }

  if (buffer.slice(0, 3).toString("ascii") === "GIF" && buffer.length >= 10) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }

  if (buffer.includes(Buffer.from("ftyp")) && buffer.includes(Buffer.from("avif"))) {
    const ispeIndex = buffer.indexOf(Buffer.from("ispe"));
    if (ispeIndex >= 0 && ispeIndex + 16 <= buffer.length) {
      return {
        width: buffer.readUInt32BE(ispeIndex + 8),
        height: buffer.readUInt32BE(ispeIndex + 12),
      };
    }
  }

  return { width: 0, height: 0 };
}

function buildImageDisplayDecision(imageMeta = {}, desiredRole = "gallery", policy = IMAGE_DISPLAY_POLICY) {
  const role = String(desiredRole || "gallery").toLowerCase();
  const isHeroRole = role === "hero" || role === "main";
  const width = Number(imageMeta.width || imageMeta.natural_width || 0);
  const height = Number(imageMeta.height || imageMeta.natural_height || 0);
  const shorterSide = width && height ? Math.min(width, height) : 0;
  const longerSide = width && height ? Math.max(width, height) : 0;
  const aspectRatio = shorterSide ? longerSide / shorterSide : 1;
  const format = String(imageMeta.format || imageMeta.extension || "").replace(/^\./, "").toLowerCase();
  const urlText = String(imageMeta.url || imageMeta.source_url || "").toLowerCase();
  const minimum = parseImageSizePolicy(policy.minimum_for_future_compliance, { width: 500, height: 500 });
  const recommended = parseImageSizePolicy(policy.recommended_hero_size, { width: 1500, height: 1500 });
  const targetWidth = Math.max(1500, recommended.width || 1500);
  const targetHeight = Math.max(1500, recommended.height || 1500);
  const reasons = [];
  const processingSteps = [];
  let decision = "";

  if (!width || !height) {
    reasons.push("image_dimensions_unknown");
    processingSteps.push("اقرأ أبعاد الصورة قبل اعتمادها كصورة رئيسية.");
  }

  if (hasDecorativeImportedImageSignal(urlText) || /logo|icon|sprite|cookie|avatar|tracking|placeholder/.test(urlText)) {
    reasons.push("decorative_or_non_product_image_signal");
    decision = "replace_needed";
  }

  if (format === "svg" || format === "gif") {
    reasons.push(`${format}_not_preferred_for_product_hero`);
    if (isHeroRole && decision !== "replace_needed") decision = "approved_gallery_only";
  }

  if (policy.text_overlay_allowed_on_hero === false && /banner|promo|campaign|ad-|advert|review-card|hero-text/.test(urlText)) {
    reasons.push("text_overlay_or_promotional_image_signal");
    if (isHeroRole) decision = "replace_needed";
  }

  if (shorterSide && shorterSide < 240) {
    reasons.push("image_too_small_for_catalog");
    decision = "replace_needed";
  } else if (shorterSide && shorterSide < Math.min(minimum.width, minimum.height)) {
    reasons.push("image_below_500x500_future_compliance");
    if (!decision) decision = "resize_needed";
  }

  if (aspectRatio >= 5.2) {
    reasons.push("extreme_aspect_ratio");
    decision = "replace_needed";
  } else if (isHeroRole && aspectRatio >= 2.2 && decision !== "replace_needed") {
    reasons.push("wide_or_tall_image_better_for_gallery");
    decision = "approved_gallery_only";
  }

  if (imageMeta.transparent === true || imageMeta.has_alpha === true) {
    reasons.push("transparent_background_detected");
    processingSteps.push("أنشئ canvas مربع بخلفية بيضاء.");
    processingSteps.push("ضع المنتج في المنتصف مع هامش آمن 8% إلى 12%.");
    processingSteps.push("ادمج طبقة PNG فوق الخلفية البيضاء دون ظل قاس.");
    processingSteps.push("صدّر نسخة JPG ونسخة WebP للاستخدام كبطاقة رئيسية.");
  } else if (imageMeta.transparent === null && format === "png") {
    reasons.push("png_alpha_channel_needs_check");
    processingSteps.push("افحص قناة alpha؛ إذا كانت شفافة فطبّق flatten على خلفية بيضاء.");
  }

  if (isHeroRole && !processingSteps.length) {
    processingSteps.push("حضّر نسخة مربعة 1:1 بخلفية بيضاء دون نصوص فوق الصورة.");
  }

  if (!decision) {
    decision = isHeroRole ? "approved_hero" : "approved_gallery_only";
  }

  return {
    decision,
    reasons: dedupeStrings(reasons),
    processing_steps: dedupeStrings(processingSteps),
    output_targets: [
      { format: "jpg", width: targetWidth, height: targetHeight, background: policy.hero_background || "white" },
      { format: "webp", width: targetWidth, height: targetHeight, background: policy.hero_background || "white" },
    ],
  };
}

function readImageMetaFromBuffer(buffer, imageUrl = "", contentType = "") {
  const dimensions = detectImageDimensions(buffer);
  const format = detectImageFormat(buffer, imageUrl, contentType);
  return {
    url: imageUrl,
    width: dimensions.width,
    height: dimensions.height,
    format,
    mime_type: contentType || getMimeType(imageUrl),
    transparent: detectImageTransparency(buffer, format),
  };
}

function readImageMetaFromUrl(imageUrl) {
  const localPath = resolveReadableImagePath(imageUrl);
  if (localPath) {
    try {
      const buffer = readFileSync(localPath);
      return readImageMetaFromBuffer(buffer, imageUrl, getMimeType(localPath));
    } catch {
      // Fall back to URL hints below.
    }
  }

  const sizeHint = extractSizedImageHint(String(imageUrl || "").toLowerCase()) || {};
  const format = extensionFromImageUrl(imageUrl);
  return {
    url: String(imageUrl || ""),
    width: sizeHint.width || 0,
    height: sizeHint.height || 0,
    format,
    transparent: format === "png" ? null : false,
  };
}

function resolveReadableImagePath(imageUrl) {
  const cleanPath = String(imageUrl || "").split("?")[0].split("#")[0];
  if (!cleanPath) return "";

  if (cleanPath.startsWith("/media/imports/")) {
    const relativePath = cleanPath.replace(/^\/media\/imports\//, "");
    const filePath = path.normalize(path.join(IMPORT_MEDIA_DIR, relativePath));
    return filePath.startsWith(IMPORT_MEDIA_DIR) && existsSync(filePath) ? filePath : "";
  }

  if (cleanPath.startsWith("/src/")) {
    const filePath = path.normalize(path.join(ROOT_DIR, cleanPath.slice(1)));
    return filePath.startsWith(ROOT_DIR) && existsSync(filePath) ? filePath : "";
  }

  return "";
}

function detectImageFormat(buffer, imageUrl = "", contentType = "") {
  const type = String(contentType || "").toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("webp")) return "webp";
  if (type.includes("avif")) return "avif";
  if (type.includes("gif")) return "gif";
  if (type.includes("svg")) return "svg";

  if (Buffer.isBuffer(buffer)) {
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "png";
    if (buffer[0] === 0xff && buffer[1] === 0xd8) return "jpg";
    if (buffer.slice(0, 4).toString("ascii") === "RIFF" && buffer.slice(8, 12).toString("ascii") === "WEBP") return "webp";
    if (buffer.slice(0, 3).toString("ascii") === "GIF") return "gif";
    if (buffer.includes(Buffer.from("ftyp")) && buffer.includes(Buffer.from("avif"))) return "avif";
    if (buffer.slice(0, 256).toString("utf8").includes("<svg")) return "svg";
  }

  return extensionFromImageUrl(imageUrl);
}

function detectImageTransparency(buffer, format) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (format === "png") {
    if (buffer.length > 26) {
      const colorType = buffer[25];
      if (colorType === 4 || colorType === 6) return true;
    }
    return buffer.includes(Buffer.from("tRNS"));
  }
  if (format === "webp") {
    const chunkType = buffer.slice(12, 16).toString("ascii");
    if (chunkType === "VP8X" && buffer.length >= 21) return Boolean(buffer[20] & 0x10);
  }
  return false;
}

function extensionFromImageUrl(imageUrl) {
  const pathname = String(imageUrl || "").split("?")[0].split("#")[0].toLowerCase();
  const extension = path.extname(pathname).replace(/^\./, "");
  return ["jpg", "jpeg", "png", "webp", "avif", "gif", "svg"].includes(extension)
    ? extension.replace("jpeg", "jpg")
    : "";
}

function parseImageSizePolicy(value, fallback) {
  const match = String(value || "").match(/(\d{2,5})\s*x\s*(\d{2,5})/i);
  if (!match) return fallback;
  return { width: Number(match[1]), height: Number(match[2]) };
}

function normalizeImageCandidate(candidate, pageUrl) {
  const first = decodeHtmlEntities(String(candidate || ""))
    .split(",")[0]
    .trim()
    .split(/\s+/)[0];
  if (!first || first.startsWith("data:")) return "";

  try {
    const normalizedUrl = new URL(first, pageUrl);
    normalizedUrl.searchParams.delete("width");
    normalizedUrl.searchParams.delete("height");
    const normalized = normalizedUrl.toString();
    const trustedThomannProductImage =
      /(?:^|\.)static-thomann\.de\//i.test(normalized) &&
      /\/thumb\/(?:padthumb[6-9]\d{2}x[6-9]\d{2}|bdbmagic|bdb[1-9]\d{2,})\/pics\/(?:bdb|bdbo|prod)\//i.test(normalized);
    if (/(store_switcher|favicon|logo|icon|sprite|flag|avatar)/i.test(normalized)) return "";
    if (/\/wysiwyg\//i.test(normalized) && !/product/i.test(normalized)) return "";
    if (!trustedThomannProductImage && /thumbnail|swatch|thumb|placeholder/i.test(normalized)) return "";
    const sizeHint = extractSizedImageHint(normalized);
    if (sizeHint && Math.min(sizeHint.width, sizeHint.height) <= 180) return "";
    if (sizeHint && Math.max(sizeHint.width, sizeHint.height) / Math.max(1, Math.min(sizeHint.width, sizeHint.height)) >= 5.2) return "";
    if (!/\.(jpg|jpeg|png|webp|avif|gif)(\?|#|$)/i.test(normalized)) return "";
    return normalized;
  } catch {
    return "";
  }
}

function extractSpecs(html) {
  const specs = [];
  const addSpec = (label, value) => {
    const cleanLabel = normalizeSpecLabel(decodeHtmlEntities(stripTags(label).trim()).replace(/[:\s]+$/, ""));
    const cleanValue = cleanSpecValue(decodeHtmlEntities(stripTags(value).trim()));
    if (!cleanLabel || !cleanValue) return;
    if (isHiddenSpecLabel(cleanLabel)) return;
    if (cleanLabel.length > 80 || cleanValue.length > 160) return;
    if (specs.some((item) => item.label.en.toLowerCase() === cleanLabel.toLowerCase())) return;
    specs.push({ label: { en: cleanLabel, ar: "" }, value: cleanValue });
  };

  for (const match of html.matchAll(/<tr[^>]*>\s*(?:<th[^>]*>|<td[^>]*>)([\s\S]*?)<\/(?:th|td)>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)) {
    addSpec(match[1], match[2]);
    if (specs.length >= 12) return specs;
  }

  for (const match of html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi)) {
    addSpec(match[1], match[2]);
    if (specs.length >= 12) return specs;
  }

  for (const match of html.matchAll(/<li[^>]*>\s*([^:<]{2,50})\s*:\s*([^<]{2,120})<\/li>/gi)) {
    addSpec(match[1], match[2]);
    if (specs.length >= 12) return specs;
  }

  return specs;
}

function extractSpecsFromTextBlock(text) {
  const source = decodeHtmlEntities(String(text || "").replace(/\s+/g, " ").trim());
  if (!source || source.length < 20) return [];

  const labels = [
    "Acoustic system",
    "Headphone Type",
    "Driver Type",
    "Driver Configuration",
    "Driver",
    "Frequency response",
    "Frequency Response",
    "Magnet type",
    "Speaker diameter",
    "Sensitivity",
    "Maximum power input",
    "Rated power",
    "Impedance",
    "Weight",
    "Cable Connector",
    "Connector",
    "Cable Length",
    "Bluetooth Version",
    "Output Interface",
    "Compatibility",
    "THD",
  ];

  const lower = source.toLowerCase();
  const hits = labels
    .map((label) => ({ label, index: lower.indexOf(label.toLowerCase()) }))
    .filter((entry) => entry.index >= 0)
    .sort((a, b) => a.index - b.index);

  if (hits.length < 2) return [];

  const specs = [];
  for (let index = 0; index < hits.length; index += 1) {
    const current = hits[index];
    const next = hits[index + 1];
    const value = source
      .slice(current.index + current.label.length, next ? next.index : source.length)
      .replace(/^[:\s-]+/, "")
      .trim();

    const cleanLabel = normalizeSpecLabel(current.label);
    const cleanValue = cleanSpecValue(value);
    if (!cleanLabel || !cleanValue || cleanValue.length < 2 || cleanValue.length > 160) continue;
    if (specs.some((item) => item.label.en.toLowerCase() === cleanLabel.toLowerCase())) continue;
    specs.push({ label: { en: cleanLabel, ar: "" }, value: cleanValue });
    if (specs.length >= 12) break;
  }

  return specs;
}

function extractFeatureCandidates(html, description) {
  const structured = extractStructuredFeatureCandidates(html);
  if (structured.length) return structured;

  const items = [];
  const blocked = new Set([
    "features",
    "breadcrumbs",
    "turntables",
    "cartridges",
    "microphones",
    "commercial audio",
    "headphones",
    "wireless headphones",
    "earbuds",
  ]);
  const addItem = (value) => {
    const clean = decodeHtmlEntities(stripTags(value).replace(/\s+/g, " ").trim());
    if (!clean || clean.length < 8 || clean.length > 140) return;
    if (/:/.test(clean)) return;
    if (blocked.has(clean.toLowerCase())) return;
    if (looksLikeNavigationFeatureText(clean)) return;
    if (!items.includes(clean)) items.push(clean);
  };

  for (const match of html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    const context = html.slice(Math.max(0, (match.index || 0) - 700), match.index || 0);
    if (!/\b(features?|highlights?|overview|description|benefits?|why(?:\s+choose|\s+this)?|product details?)\b/i.test(context)) {
      continue;
    }
    addItem(match[1]);
    if (items.length >= 6) break;
  }

  if (!items.length && description) {
    for (const sentence of description.split(/[.؟!]/)) {
      addItem(sentence);
      if (items.length >= 3) break;
    }
  }

  return items.slice(0, 6);
}

function extractStructuredFeatureCandidates(html) {
  const items = [];
  const addItem = (value) => {
    const clean = decodeHtmlEntities(stripTags(value).replace(/\s+/g, " ").trim());
    if (!clean || clean.length < 12 || clean.length > 180) return;
    if (looksLikeNavigationFeatureText(clean)) return;
    if (!items.includes(clean)) items.push(clean);
  };

  for (const match of html.matchAll(/feature-block/gi)) {
    const snippet = html.slice(match.index, Math.min(html.length, match.index + 1200));
    const heading = decodeHtmlEntities(stripTags((snippet.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i) || [])[1] || "").trim());
    const paragraph = decodeHtmlEntities(stripTags((snippet.match(/<p[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || "").trim());
    addItem(paragraph || heading);
    if (items.length >= 6) return items;
  }

  const featureSections = [
    /<h[1-6][^>]*>\s*(?:<strong[^>]*>)?\s*Key Features\s*(?:<\/strong>)?\s*<\/h[1-6]>[\s\S]{0,1800}?<ul[^>]*>([\s\S]*?)<\/ul>/gi,
    /<h[1-6][^>]*>\s*(?:<strong[^>]*>)?\s*Features\s*(?:<\/strong>)?\s*<\/h[1-6]>[\s\S]{0,1800}?<ul[^>]*>([\s\S]*?)<\/ul>/gi,
    /<h[1-6][^>]*>\s*(?:<strong[^>]*>)?\s*(?:Highlights|Product Highlights)\s*(?:<\/strong>)?\s*<\/h[1-6]>[\s\S]{0,1800}?<ul[^>]*>([\s\S]*?)<\/ul>/gi,
  ];

  for (const pattern of featureSections) {
    for (const match of html.matchAll(pattern)) {
      for (const item of match[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
        addItem(item[1]);
        if (items.length >= 6) return items;
      }
    }
  }

  const narrativeSections = [
    /<h[1-6][^>]*>\s*(?:<strong[^>]*>)?\s*(?:Description|Product Description|Overview|Highlights?)\s*(?:<\/strong>)?\s*<\/h[1-6]>[\s\S]{0,1800}?(<p[\s\S]*?<\/p>(?:[\s\S]{0,900}?<p[\s\S]*?<\/p>)?)/gi,
  ];

  for (const pattern of narrativeSections) {
    for (const match of html.matchAll(pattern)) {
      for (const paragraph of match[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
        addItem(paragraph[1]);
        if (items.length >= 8) return items;
      }
    }
  }

  return items;
}

function cleanFeatureCandidates(values) {
  const blocked = new Set([
    "learn more",
    "read more",
    "shop now",
    "buy now",
    "add to cart",
    "free shipping",
    "fast delivery",
    "in stock",
    "out of stock",
    "share",
    "wishlist",
    "compare",
    "amps & dacs",
    "digital audio players",
    "upgrade cables",
    "accessories",
    "cable adapters",
    "recommendation for you",
    "review by chrono",
    "review by resolve reviews",
  ]);
  const cleaned = dedupeStrings(
    (values || [])
      .map((value) => normalizeImportedFeatureText(value))
      .map((value) => value.replace(/\b(click here|learn more|read more|view details)\b/gi, "").trim())
      .map((value) => value.replace(/[|·]+/g, " ").replace(/\s+/g, " ").trim())
      .filter((value) => value.length >= (looksLikeImportedBoxItem(value) ? 4 : 10) && value.length <= 180)
      .filter((value) => !isSpecLikeText(value))
      .filter((value) => !blocked.has(value.toLowerCase()))
      .filter((value) => looksLikeImportedBoxItem(value) || !/[:：]/.test(value))
      .filter((value) => !/^(sku|model|brand|price|availability)\b/i.test(value))
      .filter((value) => !/^(home|shop|products?|collections?|brands?|support|search)$/i.test(value))
      .filter((value) => !/\b(?:by brands?|shop by)\b/i.test(value))
      .filter((value) => !/\b(amps?\s*&\s*dacs?|digital audio players|upgrade cables|cable adapters)\b/i.test(value))
      .filter((value) => !/\b(review|comparison|vs\.?|giveaway|kickstarter|newsletter|sales tax|free 2-day shipping)\b/i.test(value))
      .filter((value) => !looksLikeNavigationFeatureText(value))
      .filter((value) => !/https?:\/\//i.test(value))
      .filter((value) => /[a-z0-9]/i.test(value)),
  );

  const { highlights, boxItems } = splitImportedFeatureCoverage(cleaned);
  return [...highlights.slice(0, 8), ...boxItems.slice(0, 4)].slice(0, 12);
}

function normalizeImportedFeatureText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^[•*\-–—]+\s*/, "")
    .replace(/\s*[•·]\s*/g, " ")
    .replace(/\s+\*\s+(\d+)$/g, " x$1")
    .replace(/^(\d+)\s*[x×]\s*/i, "x$1 ")
    .replace(/\b(?:what(?:'|’)s in (?:the )?box|inside the box|package contents?|in the box)\b[:\-]?\s*/gi, "")
    .trim();
}

function splitImportedFeatureCoverage(values) {
  const highlights = [];
  const boxItems = [];

  for (const value of values || []) {
    if (!value) continue;
    if (looksLikeImportedBoxItem(value)) {
      boxItems.push(value);
      continue;
    }
    highlights.push(value);
  }

  return {
    highlights: dedupeStrings(highlights),
    boxItems: dedupeStrings(boxItems),
  };
}

function pruneCategoryMismatchImportedFeatures(category, features) {
  const normalizedCategory = normalizeComparisonText(category);
  if (!normalizedCategory) return features;

  const blockedPatterns = [];
  if (/\b(iems?|headphones?)\b/.test(normalizedCategory)) {
    blockedPatterns.push(
      /\b(?:headphone amps?|all headphone amps?|portable headphone amps?|desktop headphone amps?|speaker amplifiers?|speaker amplifier|dacs?|usb interface|mqa support|accessories?|all accessories|headphone cables?|audio cables?|ear pads?(?:\s*&\s*|\s+and\s+)?tips?)\b/i,
    );
  }

  if (!blockedPatterns.length) return features;
  return dedupeStrings((features || []).filter((value) => !blockedPatterns.some((pattern) => pattern.test(value))));
}

function looksLikeImportedBoxItem(value) {
  const text = normalizeImportedFeatureText(value).toLowerCase();
  if (!text) return false;
  if (/[:：]/.test(text) || isSpecLikeText(text)) return false;

  return (
    /\b(user manual|owner'?s guide|manual|warranty card|service card|certificate|storage case|carrying pouch|pouch|adapter|eartips?|ear tips|earpads?|ear pads|plug|cable|cables|protective veil|veils|case|bag)\b/.test(text) ||
    /(^x\d+\s)|(\sx\d+$)/.test(text) ||
    /\b(?:headphones?|earphones?|iems?|earbuds?)\s*x\d+\b/.test(text)
  );
}

function extractPackageItems(html) {
  const lines = htmlToTextLines(html);
  const items = [];

  const addItem = (value) => {
    const clean = normalizeImportedFeatureText(value);
    if (!clean || clean.length > 140) return;
    if (!looksLikeImportedBoxItem(clean) && !/(^x\d+\s)|(\sx\d+$)/i.test(clean)) return;
    if (!items.includes(clean)) items.push(clean);
  };

  for (let index = 0; index < lines.length; index += 1) {
    if (!isPackageHeadingLine(lines[index])) continue;

    for (let cursor = index + 1, collected = 0; cursor < lines.length && collected < 10; cursor += 1) {
      const line = lines[cursor];
      if (!line) continue;
      if (isPackageHeadingLine(line) || isPackageStopLine(line)) break;
      if (line.length > 180) break;
      addItem(line);
      collected += 1;
    }
  }

  return items.slice(0, 8);
}

function htmlToTextLines(html) {
  return decodeHtmlEntities(
    String(html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:li|p|h[1-6]|dt|dd|tr|div|section|ul|ol|table)>/gi, "\n"),
  )
    .split(/\r?\n/)
    .map((line) => stripTags(line).replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function isPackageHeadingLine(value) {
  return /^(?:what(?:'|’)s in (?:the )?box\??|inside the box\??|in the box\??|package(?: contents?)?\??)$/i.test(
    String(value || "").trim(),
  );
}

function isPackageStopLine(value) {
  return /^(?:features?|feature|specification|specifications|technical details|details|downloads?|reviews?|faq|description|product description|overview|documents?(?:\s*&\s*downloads)?|customer reviews|return policy|warranty|shipping|help)$/i.test(
    String(value || "").trim(),
  );
}

async function searchProductCandidates(query) {
  const domains = inferBrandSearchDomains(query);
  const variants = buildSearchQueries(query, domains);
  const results = [];
  const strongResultCount = () =>
    results.filter((item) => {
      const compatibility = scoreQueryCompatibility([item?.title, item?.url].join(" "), query);
      return Number(item?.score || 0) >= 18 && compatibility.compatible;
    }).length;

  if (domains.length) {
    for (const domain of domains.slice(0, 4)) {
      const items = await searchDomainSitemapCandidates(query, domain);
      results.push(...items);
      if (strongResultCount() >= 6) break;
    }
  }

  if (domains.length && strongResultCount() < 4 && distinctiveProductTokens(query).length <= 3) {
    const items = await searchDirectDomainCandidates(query, domains.slice(0, 4));
    results.push(...items);
  }

  if (strongResultCount() < 6) {
    try {
      for (const variant of variants) {
        const items = await searchDuckDuckGoCandidates(query, variant);
        results.push(...items);
        if (strongResultCount() >= 8) break;
      }
    } catch {
      // Fallback below handles provider issues such as bot challenges.
    }
  }

  if (strongResultCount() < 8) {
    for (const variant of variants) {
      const items = await searchBingCandidates(query, variant);
      results.push(...items);
      if (strongResultCount() >= 10) break;
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .filter((candidate, index, list) => list.findIndex((item) => item.url === candidate.url) === index)
    .slice(0, 24);
}

async function searchDirectDomainCandidates(query, domains) {
  const candidates = buildDirectDomainUrlCandidates(query, domains);
  const results = [];

  for (const candidateUrl of candidates.slice(0, 24)) {
    try {
      const response = await fetchWithBrowserHeaders(candidateUrl, {
        accept: "text/html,application/xhtml+xml",
        timeoutMs: 10000,
        retries: 1,
      });

      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") || "";
      if (!/html/i.test(contentType)) continue;

      const resolvedUrl = new URL(response.url || candidateUrl);
      if (!isLikelyProductPage(resolvedUrl)) continue;

      const html = await readResponseTextWithLimit(response, MAX_REMOTE_HTML_BYTES, "External product page");
      const title =
        extractMetaContent(html, "property", "og:title") ||
        extractMetaContent(html, "name", "twitter:title") ||
        extractTagContent(html, "title") ||
        titleFromProductUrl(resolvedUrl);
      const score = scoreSearchCandidate(title, resolvedUrl, query, query) + 10;
      if (score < 6) continue;

      results.push({
        url: resolvedUrl.toString(),
        title,
        score,
      });
    } catch {
      continue;
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .filter((candidate, index, list) => list.findIndex((item) => item.url === candidate.url) === index)
    .slice(0, 10);
}

async function discoverDirectDomainMatch(query) {
  const domains = inferBrandSearchDomains(query).slice(0, 4);
  if (!domains.length || distinctiveProductTokens(query).length > 3) return null;

  const importedMatches = [];
  for (const candidateUrl of buildDirectDomainUrlCandidates(query, domains).slice(0, 12)) {
    try {
      const imported = await importProductFromUrl(candidateUrl, { query });
      const compatibility = scoreQueryCompatibility(
        [imported?.nameEn, imported?.brand, imported?.sourceUrl || candidateUrl].join(" "),
        query,
      );
      if (!compatibility.compatible) continue;

      importedMatches.push({
        imported,
        url: imported.sourceUrl || candidateUrl,
        score: scoreImportedProduct(imported, query) + 8,
      });

      if ((imported.gallery?.length || 0) >= 2 && compatibility.hits >= Math.max(1, Math.ceil(distinctiveProductTokens(query).length * 0.6))) {
        break;
      }
    } catch {
      continue;
    }
  }

  if (!importedMatches.length) return null;

  importedMatches.sort((a, b) => b.score - a.score);
  const best = importedMatches[0];
  const existingProduct = findExistingProductMatch({
    sourceUrl: best.imported.sourceUrl,
    brand: best.imported.brand,
    nameEn: best.imported.nameEn,
    category: best.imported.category,
  });
  const mergedBest =
    existingProduct && String(existingProduct.id || "") !== ""
      ? mergeImportedDrafts(best.imported, catalogProductToDraft(existingProduct, query))
      : best.imported;

  const finalDraft = applyStrictProductIntelligence(
    {
      ...mergedBest,
      sourceUrl: best.imported.sourceUrl,
      importMeta: buildImportMetaFromDraft(mergedBest, {
        mode: "query",
        query,
        matchedTitle: best.imported.nameEn,
        resolvedUrl: best.imported.sourceUrl,
        searchedResults: 0,
        evaluatedCandidates: importedMatches.length,
        usedStructuredData: best.imported.importMeta?.usedStructuredData,
      }),
    },
    { rawInput: query },
  );

  return {
    draft: finalDraft,
    existingProduct: existingProduct ? serializeImportProductMatch(existingProduct) : null,
    candidates: importedMatches.slice(0, 3).map((item) => ({
      title: item.imported.nameEn,
      url: item.url,
      image: item.imported.image,
      imageCount: item.imported.gallery?.length || 0,
      specCount: item.imported.specs?.length || 0,
      score: item.score,
      draft: {
        ...item.imported,
        importMeta: buildImportMetaFromDraft(item.imported, {
          mode: "query",
          query,
          matchedTitle: item.imported.nameEn,
          resolvedUrl: item.imported.sourceUrl,
          searchedResults: 0,
          evaluatedCandidates: importedMatches.length,
          usedStructuredData: item.imported.importMeta?.usedStructuredData,
        }),
      },
    })),
  };
}

function buildDirectDomainUrlCandidates(query, domains) {
  const coreQuery = stripKnownBrandFromQuery(query);
  const simplifiedCoreQuery = simplifyDiscoverySearchQuery(coreQuery || query, { includeBrand: false });
  const rawSlug = String(simplifiedCoreQuery || coreQuery || query)
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");

  if (!rawSlug || rawSlug.length < 3) return [];

  const lowerSlug = rawSlug.toLowerCase();
  const pathCandidates = dedupeStrings([
    `/products/${lowerSlug}`,
    `/product/${lowerSlug}`,
    `/${rawSlug}`,
    `/${lowerSlug}`,
    `/en/${rawSlug}`,
    `/en/${lowerSlug}`,
    `/${rawSlug}.html`,
    `/${rawSlug}-.html`,
    `/en/${rawSlug}.html`,
    `/en/${rawSlug}-.html`,
    `/${lowerSlug}.html`,
    `/${lowerSlug}-.html`,
    `/en/${lowerSlug}.html`,
    `/en/${lowerSlug}-.html`,
  ]);

  return dedupeStrings(
    domains.flatMap((domain) => pathCandidates.map((candidatePath) => `https://${domain}${candidatePath}`)),
  );
}

function stripKnownBrandFromQuery(query) {
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery) return "";

  const brandKeys = Object.keys(BRAND_SEARCH_DOMAINS).sort((left, right) => right.length - left.length);
  for (const brandKey of brandKeys) {
    const pattern = new RegExp(`^${escapeRegExp(brandKey)}\\s+`, "i");
    if (pattern.test(normalizedQuery)) {
      return normalizedQuery.replace(pattern, "").trim();
    }
  }

  return normalizedQuery;
}

async function searchDomainSitemapCandidates(query, domain) {
  const sitemapUrls = await resolveSitemapUrls(domain);
  if (!sitemapUrls.length) return [];

  const results = [];
  const queue = [...sitemapUrls];
  const visited = new Set();

  while (queue.length && visited.size < 10 && results.length < 24) {
    const sitemapUrl = queue.shift();
    if (!sitemapUrl || visited.has(sitemapUrl)) continue;
    visited.add(sitemapUrl);

    let xml = "";
    try {
      xml = await fetchTextWithBrowserHeaders(sitemapUrl);
    } catch {
      continue;
    }

    if (!xml) continue;

    if (/<sitemapindex[\s>]/i.test(xml)) {
      for (const nestedUrl of extractXmlLocs(xml).slice(0, 12)) {
        if (!visited.has(nestedUrl) && /(product|shop|catalog|page|sitemap)/i.test(nestedUrl)) {
          queue.push(nestedUrl);
        }
      }
      continue;
    }

    if (!/<urlset[\s>]/i.test(xml)) continue;

    for (const entry of extractSitemapEntries(xml)) {
      let url;
      try {
        url = new URL(entry.loc);
      } catch {
        continue;
      }

      if (!isLikelyProductPage(url)) continue;

      const title = entry.title || titleFromProductUrl(url);
      const score =
        scoreSearchCandidate(title, url, query, query) +
        (entry.image ? 2 : 0) +
        (/\/products?\//i.test(url.pathname) ? 3 : 0);

      if (score < 4) continue;

      results.push({
        url: url.toString(),
        title,
        image: entry.image || "",
        score,
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .filter((candidate, index, list) => list.findIndex((item) => item.url === candidate.url) === index)
    .slice(0, 12);
}

async function searchDuckDuckGoCandidates(query, variant) {
  const searchUrl = new URL("https://html.duckduckgo.com/html/");
  searchUrl.searchParams.set("q", variant);

  const response = await fetchWithBrowserHeaders(searchUrl, {
    accept: "text/html,application/xhtml+xml",
    timeoutMs: 12000,
    retries: 1,
  });

  if (!response.ok) {
    throw new ApiError(400, "import_failed", `Unable to search for this model (${response.status})`);
  }

  assertHtmlResponse(response);
  const html = await readResponseTextWithLimit(response, MAX_REMOTE_HTML_BYTES, "DuckDuckGo search response");
  if (/anomaly-modal|bots use duckduckgo too|confirm this search was made by a human/i.test(html)) {
    throw new ApiError(400, "import_failed", "DuckDuckGo search challenge triggered");
  }

  const results = [];
  for (const match of html.matchAll(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = decodeDuckDuckGoResultUrl(match[1]);
    if (!href) continue;
    let url;
    try {
      url = new URL(href);
    } catch {
      continue;
    }
    if (!isLikelyProductPage(url)) continue;

    const title = decodeHtmlEntities(stripTags(match[2]).replace(/\s+/g, " ").trim());
    results.push({
      url: url.toString(),
      title,
      score: scoreSearchCandidate(title, url, query, variant),
    });
  }

  return results;
}

async function searchBingCandidates(query, variant) {
  const searchUrl = new URL("https://www.bing.com/search");
  searchUrl.searchParams.set("cc", "us");
  searchUrl.searchParams.set("mkt", "en-US");
  searchUrl.searchParams.set("setlang", "en-US");
  searchUrl.searchParams.set("q", variant);

  const response = await fetchWithBrowserHeaders(searchUrl, {
    accept: "text/html,application/xhtml+xml",
    timeoutMs: 12000,
    retries: 1,
  });

  if (!response.ok) {
    throw new ApiError(400, "import_failed", `Unable to search Bing for this model (${response.status})`);
  }

  assertHtmlResponse(response);
  const html = await readResponseTextWithLimit(response, MAX_REMOTE_HTML_BYTES, "Bing search response");
  const results = [];

  for (const match of html.matchAll(/<h2[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/gi)) {
    const href = decodeBingResultUrl(match[1]);
    if (!href) continue;
    let url;
    try {
      url = new URL(href);
    } catch {
      continue;
    }
    if (!isLikelyProductPage(url)) continue;

    const title = decodeHtmlEntities(stripTags(match[2]).replace(/\s+/g, " ").trim());
    results.push({
      url: url.toString(),
      title,
      score: scoreSearchCandidate(title, url, query, variant),
    });
  }

  return results;
}

function decodeBingResultUrl(value) {
  try {
    const url = new URL(decodeHtmlEntities(value), "https://www.bing.com");
    if (!/bing\.com$/i.test(url.hostname)) return url.toString();

    const encoded = url.searchParams.get("u");
    if (encoded) {
      const normalized = encoded.replace(/^a1/i, "");
      const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
      try {
        const decoded = Buffer.from(padded, "base64").toString("utf8");
        if (/^https?:\/\//i.test(decoded)) return decoded;
      } catch {
        // Fall through to raw value handling.
      }
    }

    return "";
  } catch {
    return "";
  }
}

function decodeDuckDuckGoResultUrl(value) {
  try {
    const maybeDuck = new URL(value, "https://duckduckgo.com");
    const uddg = maybeDuck.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : maybeDuck.toString();
  } catch {
    return "";
  }
}

async function resolveSitemapUrls(domain) {
  const results = [];
  const fallbacks = dedupeStrings([`https://${domain}/sitemap.xml`, `https://www.${domain}/sitemap.xml`]);

  for (const robotsUrl of [`https://${domain}/robots.txt`, `https://www.${domain}/robots.txt`]) {
    try {
      const text = await fetchTextWithBrowserHeaders(robotsUrl);
      for (const line of text.split(/\r?\n/)) {
        const match = line.match(/^\s*sitemap:\s*(\S+)/i);
        if (match) results.push(decodeHtmlEntities(match[1].trim()));
      }
    } catch {
      // Fall back to common sitemap locations.
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
    const image = decodeHtmlEntities(stripTags((block.match(/<image:loc>([\s\S]*?)<\/image:loc>/i) || [])[1] || "").trim());

    entries.push({ loc, title, image });
  }
  return entries;
}

function titleFromProductUrl(url) {
  const lastSegment = decodeURIComponent(String(url.pathname || "").split("/").filter(Boolean).pop() || "");
  return lastSegment
    .replace(/[-_]+/g, " ")
    .replace(/\b(products?|shop|item)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchTextWithBrowserHeaders(url) {
  const response = await fetchWithBrowserHeaders(url, {
    timeoutMs: 12000,
    retries: 1,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  assertHtmlResponse(response);
  return readResponseTextWithLimit(response, MAX_REMOTE_HTML_BYTES, "External text response");
}

function isLikelyProductPage(url) {
  const blockedHosts = [
    "youtube.com",
    "youtu.be",
    "facebook.com",
    "instagram.com",
    "tiktok.com",
    "x.com",
    "twitter.com",
    "reddit.com",
    "pinterest.com",
    "linkedin.com",
    "wikipedia.org",
  ];
  const blockedPathBits = ["search", "category", "collections", "brand", "brands", "news", "blog", "blogs", "reviews"];
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  const pathText = url.pathname.toLowerCase();

  if (blockedHosts.some((item) => host.endsWith(item))) return false;
  if (/\b(amazon|ebay|aliexpress|noon|temu)\b/i.test(host)) return false;
  if (isEditorialUrl(url)) return false;
  if (blockedPathBits.some((bit) => pathText === `/${bit}` || pathText.startsWith(`/${bit}/`))) return false;
  return /^https?:/.test(url.protocol);
}

function scoreSearchCandidate(title, url, query, variant = query) {
  const haystack = `${title} ${url.hostname} ${url.pathname}`.toLowerCase();
  const titleHaystack = `${title} ${titleFromProductUrl(url)}`.toLowerCase();
  const words = distinctiveProductTokens(query).length
    ? distinctiveProductTokens(query)
    : query.toLowerCase().split(/\s+/).filter(Boolean);
  const compatibility = scoreQueryCompatibility(`${title} ${url.pathname}`, query);
  let score = 0;
  let titleHits = 0;

  for (const word of words) {
    if (haystack.includes(word)) score += 3;
    if (titleHaystack.includes(word)) {
      score += 5;
      titleHits += 1;
    }
  }

  score += compatibility.score;
  if (words.length) {
    score += titleHits >= Math.max(1, Math.ceil(words.length * 0.6)) ? 6 : -8;
    if (titleHaystack.includes(query.toLowerCase())) score += 8;
  }

  if (hasListingModifier(`${title} ${url.pathname}`) && !hasListingModifier(query)) score -= 16;
  if (hasAccessoryModifier(`${title} ${url.pathname}`) && !hasAccessoryModifier(query)) score -= 20;
  if (/product|products|headphone|iem|earphone|earbud|dac|amp|microphone|cable|adapter|accessories/i.test(haystack)) {
    score += 2;
  }

  if (/official|shop|store/i.test(haystack)) score += 2;
  if (/spec|specifications|tech-spec|support/i.test(haystack)) score += 2;
  if (/manual|datasheet/i.test(haystack)) score += 1;
  if (isEditorialUrl(url) || /review|forum|thread|reddit/i.test(haystack)) score -= 14;
  score += scoreDomainQuality(url);
  if (variant !== query && haystack.includes(variant.toLowerCase().split(/\s+/)[0])) score += 1;

  return score;
}

function scoreImportedProduct(imported, query) {
  const nameHaystack = [imported.nameEn, imported.brand].join(" ").toLowerCase();
  const haystack = [
    imported.nameEn,
    imported.brand,
    imported.taglineEn,
    imported.sourceUrl,
    ...(imported.features || []),
  ]
    .join(" ")
    .toLowerCase();
  const words = distinctiveProductTokens(query).length
    ? distinctiveProductTokens(query)
    : query.toLowerCase().split(/\s+/).filter(Boolean);
  const nameHits = words.reduce((sum, word) => sum + (nameHaystack.includes(word) ? 1 : 0), 0);
  const compatibility = scoreQueryCompatibility([imported.nameEn, imported.brand, imported.sourceUrl].join(" "), query);
  let score = words.reduce((sum, word) => sum + (haystack.includes(word) ? 2 : 0), 0);
  score += nameHits * 5;
  score += compatibility.score;
  if (words.length) {
    score += nameHits >= Math.max(1, Math.ceil(words.length * 0.6)) ? 8 : -12;
    if (nameHaystack.includes(query.toLowerCase())) score += 10;
  }
  if (hasListingModifier([imported.nameEn, imported.sourceUrl].join(" ")) && !hasListingModifier(query)) score -= 16;
  if (hasAccessoryModifier([imported.nameEn, imported.sourceUrl].join(" ")) && !hasAccessoryModifier(query)) score -= 20;
  if (isEditorialUrl(imported.sourceUrl)) score -= 16;
  if (imported.image) score += 2;
  if ((imported.gallery || []).length >= 2) score += 1;
  if ((imported.specs || []).length >= 3) score += 2;
  if (imported.category) score += 1;
  if (imported.importMeta?.usedStructuredData) score += 2;
  if (imported.price !== null && imported.price !== undefined) score += 1;
  if (imported.compareAt !== null && imported.compareAt !== undefined) score += 1;
  if (imported.taglineEn && !isSpecLikeText(imported.taglineEn)) score += 1;
  if (!(imported.gallery || []).length) score -= 18;
  if (!(imported.specs || []).length) score -= 10;
  if (!String(imported.nameEn || "").trim()) score -= 24;
  if (
    normalizeComparisonText(imported.nameEn || "") &&
    normalizeComparisonText(imported.nameEn || "") === normalizeComparisonText(imported.brand || "")
  ) {
    score -= 24;
  }
  return score;
}

function buildSearchQueries(query, domains = []) {
  const compact = query.replace(/\s+/g, " ").trim();
  const simplifiedCompact = simplifyDiscoverySearchQuery(compact);
  const simplifiedBrandless = simplifyDiscoverySearchQuery(compact, { includeBrand: false });
  const base = [
    compact,
    simplifiedCompact,
    simplifiedBrandless,
    `"${compact}" official`,
    simplifiedCompact ? `"${simplifiedCompact}" official` : "",
    `${compact} official specs`,
    `${compact} official product page`,
    simplifiedCompact ? `${simplifiedCompact} official product page` : "",
    `${compact} product page`,
    simplifiedCompact ? `${simplifiedCompact} product page` : "",
    `${compact} buy`,
    `${compact} technical specifications`,
    `${compact} review specs official`,
    `${compact} official store`,
    `${compact} manufacturer`,
    `${compact} product specifications`,
    `${compact} site:manufacturer`,
  ];

  for (const domain of domains) {
    base.push(`site:${domain} "${compact}"`);
    base.push(`site:${domain} ${compact}`);
    base.push(`site:${domain} "${compact}" specs`);
    if (simplifiedCompact && simplifiedCompact !== compact) {
      base.push(`site:${domain} "${simplifiedCompact}"`);
      base.push(`site:${domain} ${simplifiedCompact}`);
      base.push(`site:${domain} "${simplifiedCompact}" specs`);
    }
  }

  return dedupeStrings(base);
}

function simplifyDiscoverySearchQuery(query, { includeBrand = true } = {}) {
  const compact = String(query || "").replace(/\s+/g, " ").trim();
  if (!compact) return "";

  const brand = inferBrand(compact, "");
  const brandless = stripKnownBrandFromQuery(compact);
  const simplifiedCore = distinctiveProductTokens(brandless || compact).join(" ").trim() || brandless || compact;
  if (!includeBrand) return simplifiedCore;
  return ensureBrandInName(simplifiedCore, brand);
}

function inferBrandSearchDomains(query) {
  const text = String(query || "").toLowerCase();
  const matches = [];

  for (const [brandKey, domains] of Object.entries(BRAND_SEARCH_DOMAINS)) {
    if (text.includes(brandKey)) {
      matches.push(...domains);
    }
  }

  return dedupeStrings(matches);
}

function scoreDomainQuality(url) {
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  let score = 0;

  if (/\b(audio|hifi|headphones?|earphones?|microphones?|acoustics?)\b/.test(host)) score += 2;
  if (/\b(store|shop)\b/.test(host)) score += 1;
  if (/\b(support|manuals?)\b/.test(host)) score += 1;
  if (/\b(blog|news|magazine|forum)\b/.test(host)) score -= 2;

  return score;
}

function normalizeSpecLabel(value) {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase();
  const labels = [
    [/^impedance$/i, "Impedance"],
    [/^sensitivity$/i, "Sensitivity"],
    [/^frequency response(?: range)?$/i, "Frequency Response"],
    [/^driver(?: size)?$/i, "Driver"],
    [/^(?:connector|earphone jack|plug|input|output interface)$/i, "Connector"],
    [/^cable(?: length)?$/i, "Cable"],
    [/^microphone$/i, "Microphone"],
    [/^weight$/i, "Weight"],
    [/^bluetooth version$/i, "Bluetooth Version"],
    [/^cavity material$/i, "Material"],
    [/^product name$/i, "Model"],
  ];
  const match = labels.find(([pattern]) => pattern.test(normalized));
  return match ? match[1] : raw;
}

function isHiddenSpecLabel(value) {
  return normalizeComparisonText(normalizeSpecLabel(value)) === "sku";
}

function cleanSpecValue(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\b(click here|learn more|read more)\b/gi, "")
    .trim();
}

function extractFeatureCandidatesFromDescription(description) {
  const text = String(description || "").replace(/\s+/g, " ").trim();
  if (!text) return [];

  const candidates = [];
  for (const sentence of text.split(/[.!؟]+/)) {
    const clean = sentence.trim();
    if (!clean) continue;
    if (clean.length < 20 || clean.length > 140) continue;
    if (looksLikeNavigationFeatureText(clean)) continue;
    candidates.push(clean);
    if (candidates.length >= 6) break;
  }

  return candidates;
}

function looksLikeNavigationFeatureText(value) {
  const normalized = normalizeComparisonText(value);
  if (!normalized) return false;
  if (/^(?:by brands?|shop by)\b/.test(normalized)) return true;

  if (
    /^(?:in ear|over ear|wireless)\s+headphones?$/.test(normalized) ||
    /^(?:all\s+)?dacs?$/.test(normalized) ||
    /^(?:portable|desktop)\s+dacs?$/.test(normalized) ||
    /^(?:all\s+)?headphone\s+amps?$/.test(normalized) ||
    /^(?:portable|desktop)\s+headphone\s+amps?$/.test(normalized) ||
    /^speaker\s+amplifiers?$/.test(normalized) ||
    /^(?:all\s+)?accessories$/.test(normalized) ||
    /^(?:headphone|audio)\s+cables?$/.test(normalized) ||
    /^ear\s+pads?(?:\s+and\s+|\s+)\s*tips?$/.test(normalized) ||
    /^(?:headphones?|iems?|earbuds?)$/.test(normalized)
  ) {
    return true;
  }

  if (
    /^(?:(?:in ear|over ear|wireless)\s+headphones?)(?:\s+(?:(?:in ear|over ear|wireless)\s+headphones?))+$/i.test(
      normalized,
    ) ||
    /^(?:(?:all\s+)?dacs?|(?:portable|desktop)\s+dacs?)(?:\s+(?:(?:all\s+)?dacs?|(?:portable|desktop)\s+dacs?))+$/i.test(normalized) ||
    /^(?:(?:all\s+)?headphone\s+amps?|(?:portable|desktop)\s+headphone\s+amps?|speaker\s+amplifiers?)(?:\s+(?:(?:all\s+)?headphone\s+amps?|(?:portable|desktop)\s+headphone\s+amps?|speaker\s+amplifiers?))+$/i.test(
      normalized,
    ) ||
    /^(?:(?:all\s+)?accessories|(?:headphone|audio)\s+cables?|ear\s+pads?(?:\s+and\s+|\s+)\s*tips?)(?:\s+(?:(?:all\s+)?accessories|(?:headphone|audio)\s+cables?|ear\s+pads?(?:\s+and\s+|\s+)\s*tips?))+$/i.test(
      normalized,
    )
  ) {
    return true;
  }

  return false;
}

function isSpecLikeText(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!text) return false;
  const labelHits = [
    "frequency response",
    "frequency res",
    "impedance",
    "sensitivity",
    "driver",
    "headphone type",
    "speaker diameter",
    "magnet type",
    "maximum power input",
    "connector",
    "cable length",
    "cable plug",
    "bluetooth version",
    "single ended",
    "balanced",
    "housing",
    "nozzle",
    "thd",
  ].filter((label) => text.includes(label)).length;
  const unitHits = [
    /\b\d+(?:\.\d+)?\s*hz\b/i,
    /\b\d+(?:\.\d+)?\s*khz\b/i,
    /\b\d+(?:\.\d+)?\s*ohm\b/i,
    /\b\d+(?:\.\d+)?\s*db\b/i,
    /\b\d+(?:\.\d+)?\s*mm\b/i,
    /\b\d+(?:\.\d+)?\s*mw\b/i,
    /\b\d+(?:\.\d+)?\s*pin\b/i,
  ].filter((pattern) => pattern.test(text)).length;
  return labelHits >= 2 || (labelHits >= 1 && unitHits >= 1);
}

function selectDisplayDescription({ tagline = "", description = "", features = [], specs = [] }) {
  const candidates = [
    String(tagline || "").trim(),
    sentenceFromText(description),
    ...cleanFeatureCandidates(features || []),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate.length < 18 || candidate.length > 180) continue;
    if (isSpecLikeText(candidate)) continue;
    if (looksLikeNavigationFeatureText(candidate)) continue;
    if (/\b(amps?\s*&\s*dacs?|digital audio players|upgrade cables|cable adapters)\b/i.test(candidate)) continue;
    return candidate;
  }

  const fallback = String(tagline || "").trim();
  if (!fallback || isSpecLikeText(fallback) || looksLikeNavigationFeatureText(fallback)) return "";
  if (/\b(amps?\s*&\s*dacs?|digital audio players|upgrade cables|cable adapters)\b/i.test(fallback)) return "";
  return specs.length ? "" : fallback;
}

function inferBrand(title, hostname) {
  const titleText = String(title || "");
  const brandNames = listBrands().map((item) => item.name);
  const matched = brandNames.find((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(titleText));
  if (matched) return matched;
  const knownBrandKey = Object.keys(KNOWN_BRAND_LABELS)
    .sort((left, right) => right.length - left.length)
    .find((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(titleText));
  if (knownBrandKey) return KNOWN_BRAND_LABELS[knownBrandKey];
  const hostParts = hostname.replace(/^www\./i, "").split(".").filter(Boolean);
  const genericPrefixes = new Set([
    "en",
    "eu",
    "us",
    "uk",
    "au",
    "ca",
    "tw",
    "jp",
    "de",
    "fr",
    "it",
    "es",
    "nl",
    "se",
    "cn",
    "store",
    "shop",
    "support",
  ]);
  const hostPart = genericPrefixes.has(hostParts[0]) && hostParts[1] ? hostParts[1] : hostParts[0] || "";
  if (!hostPart) return "";
  const normalizedHostBrand = hostPart.replace(/[-_]/g, " ");
  const canonicalBrand = brandNames.find((name) => sameKey(name, normalizedHostBrand));
  const knownHostBrand = Object.entries(KNOWN_BRAND_LABELS).find(([key]) => sameKey(key, normalizedHostBrand));
  return canonicalBrand || knownHostBrand?.[1] || normalizedHostBrand;
}

function ensureBrandInName(name, brand) {
  const cleanName = String(name || "").trim();
  const cleanBrand = String(brand || "").trim();
  if (!cleanName) return "";
  if (!cleanBrand) return cleanName;
  if (new RegExp(`\\b${escapeRegExp(cleanBrand)}\\b`, "i").test(cleanName)) return cleanName;
  return `${cleanBrand} ${cleanName}`.trim();
}

function inferCategory({ title, description, productType = "", specs, features, sourceUrl }) {
  const haystack = [
    title,
    description,
    productType,
    sourceUrl,
    ...(features || []),
    ...(specs || []).flatMap((spec) => [spec.label?.en || "", spec.value || ""]),
  ]
    .join(" ")
    .toLowerCase();
  const titleHaystack = String(title || "").toLowerCase();
  const typeHaystack = String(productType || "").toLowerCase();

  const scores = {
    headphones: 0,
    iems: 0,
    dap: 0,
    dac: 0,
    "audio-interface": 0,
    mic: 0,
    accessories: 0,
  };

  const scoreTerms = (target, amount, terms, source) => {
    for (const term of terms) {
      if (source.includes(term)) scores[target] += amount;
    }
  };

  scoreTerms("headphones", 6, ["headphone", "headphones", "over-ear", "open-back", "closed-back", "overear", "openback", "closedback"], titleHaystack);
  scoreTerms("headphones", 4, ["planar magnetic", "planar headphone", "circumaural", "full-size", "full sized", "around-ear", "studio headphones", "foldable studio headphones"], haystack);
  scoreTerms("headphones", 4, ["headphone", "headphones", "over-ear", "open-back", "closed-back", "overear", "openback", "closedback"], typeHaystack);
  scoreTerms("iems", 7, [" iem ", "in-ear monitor", "in-ear monitors", "earphone", "earphones"], ` ${titleHaystack} `);
  scoreTerms("iems", 4, ["2-pin", "0.78mm", "mmcx", "earbud", "earbuds"], haystack);
  scoreTerms("iems", 4, ["in-ear", "earphone", "earphones", "iems", "in ear"], haystack);
  scoreTerms("iems", 5, ["in-ear", "earphone", "earphones", "iems", "in ear"], typeHaystack);
  scoreTerms("dap", 7, ["dap", "digital audio player", "hi-res player", "portable music player"], titleHaystack);
  scoreTerms("dap", 5, ["music player", "micro sd", "microsd", "hi-res audio", "portable player"], haystack);
  scoreTerms("dac", 7, ["dac", "amp", "amplifier", "dongle dac", "usb dac", "desktop dac", "headphone amp"], titleHaystack);
  scoreTerms("dac", 4, ["line out", "balanced out", "dac/amp", "ak4493", "es9039", "cs43131"], haystack);
  scoreTerms("dac", 5, ["dac", "amp", "amplifier", "dongle dac", "desktop dac"], typeHaystack);
  scoreTerms("audio-interface", 8, ["audio interface", "usb interface", "recording interface", "sound card"], titleHaystack);
  scoreTerms("audio-interface", 5, ["audio interface", "usb interface", "recording interface", "xlr input", "instrument input", "phantom power", "monitor output"], haystack);
  scoreTerms("audio-interface", 5, ["audio interface", "recording interface", "interface"], typeHaystack);
  scoreTerms("mic", 7, ["microphone", "microphones", "studio mic", "condenser mic", "dynamic mic"], titleHaystack);
  scoreTerms("mic", 4, ["xlr", "polar pattern", "cardioid", "phantom power"], haystack);
  scoreTerms("mic", 5, ["microphone", "microphones", "condenser", "dynamic"], typeHaystack);
  scoreTerms("accessories", 6, ["cable", "adapter", "eartip", "eartips", "case", "pouch", "storage case"], titleHaystack);
  scoreTerms("accessories", 3, ["connector", "termination", "ear tips", "adapter"], haystack);
  scoreTerms("accessories", 4, ["cable", "adapter", "accessories", "case", "ear tips"], typeHaystack);

  if (/\bhifiman\b/.test(haystack) && /\b(ananda|arya|edition xs|sundara|he\d|susvara)\b/.test(haystack)) {
    scores.headphones += 8;
  }
  if (/\bhifiman\b/.test(haystack) && !/\b(iem|in-ear|earphone|earphones|earbud)\b/.test(haystack)) {
    scores.headphones += 4;
    scores.iems -= 4;
  }
  if (/\b(ananda|arya|edition xs|sundara|he400|he560|he6|he1000|susvara)\b/.test(titleHaystack)) {
    scores.headphones += 8;
    scores.iems -= 6;
  }
  if (/\b(headphone|headphones|open-back|closed-back|over-ear|overear|closedback|openback)\b/.test(titleHaystack)) {
    scores.headphones += 5;
    scores.iems -= 4;
  }
  if (/\b(iem|in-ear|earphone|earphones|earbud)\b/.test(titleHaystack)) {
    scores.iems += 6;
    scores.headphones -= 4;
  }

  const ranked = Object.entries(scores)
    .filter(([slug]) => isCatalogCategorySlug(slug))
    .sort((a, b) => b[1] - a[1]);
  const [bestSlug, bestScore = 0] = ranked[0] || [];
  const secondScore = ranked[1]?.[1] || 0;
  if (!bestSlug || bestScore < 4) return "";
  if (secondScore > 0 && bestScore - secondScore <= 1) return "";
  return bestSlug;
}

function inferSubCategories(category, { title, description, features, specs }) {
  const haystack = [
    title,
    description,
    ...(features || []),
    ...(specs || []).flatMap((spec) => [spec.label?.en || "", spec.value || ""]),
  ]
    .join(" ")
    .toLowerCase();

  if (category === "headphones") {
    return ["over-ear", /\bopen-back\b/.test(haystack) ? "open-back" : /\bclosed-back\b/.test(haystack) ? "closed-back" : ""].filter(Boolean);
  }

  if (category === "iems") {
    return [/\bhybrid\b/.test(haystack) ? "hybrid" : "", /\bplanar\b/.test(haystack) ? "planar" : ""].filter(Boolean);
  }

  if (category === "dac") {
    return [/\bdongle\b/.test(haystack) ? "dongle" : "", /\bdesktop\b/.test(haystack) ? "desktop" : ""].filter(Boolean);
  }

  if (category === "mic") {
    return [/\bcondenser\b/.test(haystack) ? "condenser" : "", /\bdynamic\b/.test(haystack) ? "dynamic" : ""].filter(Boolean);
  }

  return [];
}

function cleanProductTitle(title, hostname, query = "") {
  let cleaned = decodeHtmlEntities(String(title || "").trim());
  const hostLabel = hostname.replace(/^www\./i, "").split(".")[0];
  const separators = [" | ", " – ", " — ", " - "];
  for (const separator of separators) {
    if (cleaned.includes(separator)) {
      const parts = cleaned.split(separator).map((part) => part.trim()).filter(Boolean);
      const [first, second] = parts;
      const firstBrand = inferBrand(first || "", hostname);
      if (first && second && firstBrand && normalizeComparisonText(first) === normalizeComparisonText(firstBrand)) {
        cleaned = `${first} ${second}`.trim();
        break;
      }
      if (first && first.length >= 4) {
        cleaned = first;
        break;
      }
    }
  }

  cleaned = cleaned.replace(new RegExp(escapeRegExp(hostLabel), "ig"), "").replace(/\s{2,}/g, " ").trim();

  const normalizedQuery = String(query || "").replace(/\s+/g, " ").trim();
  if (normalizedQuery) {
    const brandFromQuery = inferBrand(normalizedQuery, hostname);
    const queryWithoutBrand = brandFromQuery
      ? normalizedQuery.replace(new RegExp(`^${escapeRegExp(brandFromQuery)}\\s*`, "i"), "").trim()
      : normalizedQuery;

    for (const candidateQuery of dedupeStrings([normalizedQuery, queryWithoutBrand])) {
      const queryPattern = candidateQuery
        .split(/\s+/)
        .map((part) => escapeRegExp(part))
        .join("[\\s\\-–—_/()]+");
      const directMatch = cleaned.match(new RegExp(queryPattern, "i"));
      if (directMatch?.[0]) {
        return directMatch[0].trim();
      }
    }

    const queryTokens = distinctiveProductTokens(normalizedQuery);
    const modelToken = queryTokens.find((token) => /\d/.test(token) || isVersionLikeToken(token));
    if (modelToken && new RegExp(`\\b${escapeRegExp(modelToken)}\\b`, "i").test(cleaned)) {
      const preferredName = ensureBrandInName(normalizedQuery, brandFromQuery);
      if (preferredName) return preferredName;
    }
  }

  const descriptorPattern =
    /\s+(?:planar magnetic|magnetic planar|open-back|closed-back|over-ear|on-ear|in-ear|headphones?|earphones?|iems?|in-ear monitors?|wireless|bluetooth|studio monitor|dac(?:\/amp)?|amplifier|microphones?|cables?|adapters?|ear tips?|accessories|single dynamic driver|dynamic driver|planar driver|hybrid driver|balanced armature|ba driver|mm driver|driver size|open acoustic|closed acoustic)\b.*$/i;
  cleaned = cleaned.replace(descriptorPattern, "").trim();
  cleaned = cleaned.replace(/\((?:open|closed|planar|wireless|bluetooth|studio)[^)]+\)$/i, "").trim();
  cleaned = cleaned.replace(/\b(?:with|w\/)\s+(?:single|dual|triple|quad)\s+(?:dynamic|ba|balanced armature|planar|hybrid)\s+driver.*$/i, "").trim();
  cleaned = cleaned.replace(/\b(?:single|dual|triple|quad)\s+(?:dynamic|ba|balanced armature|planar|hybrid)\s+driver.*$/i, "").trim();
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return cleaned;
}

function sentenceFromText(value) {
  return decodeHtmlEntities(String(value || ""))
    .replace(/\s+/g, " ")
    .trim()
    .split(/[.؟!]/)[0]
    ?.trim();
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function looksLikeUrl(value) {
  try {
    const url = new URL(String(value).trim());
    return /^https?:$/.test(url.protocol);
  } catch {
    return false;
  }
}

function isEditorialUrl(value) {
  const text = String(value || "").trim();
  if (!text) return false;

  try {
    const url = new URL(text, "https://edio.local");
    const pathText = url.pathname.toLowerCase();
    return /\/(?:blog|blogs|article|articles|review|reviews|news|journal|stories)(?:\/|$)/.test(pathText);
  } catch {
    return /\/(?:blog|blogs|article|articles|review|reviews|news|journal|stories)(?:\/|$)/i.test(text);
  }
}

function arrayify(value) {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null || value === "" ? [] : [value];
}

function dedupeStrings(values) {
  return Array.from(new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean)));
}

function toOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const numeric = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function createProductSlug(value, excludeId = "") {
  const base = slugify(value || "product") || "product";
  let candidate = base;
  let counter = 2;

  while (
    db.products.some(
      (product) =>
        product.slug === candidate &&
        (!excludeId || product.id !== excludeId),
    )
  ) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
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

function countSharedTerms(a, b) {
  const left = new Set(tokenizeComparisonText(a));
  const right = new Set(tokenizeComparisonText(b));
  let count = 0;
  for (const token of left) {
    if (right.has(token)) count += 1;
  }
  return count;
}

function isVersionLikeToken(token) {
  return /^(?:v\d+|mk\d+|gen\d+|20\d{2}|[ivx]{2,})$/i.test(String(token || ""));
}

function hasListingModifier(value) {
  return /\b(open[\s-]?box|refurb(?:ished)?|renewed|used|pre[\s-]?owned|b[\s-]?stock|replacement|spare)\b/i.test(
    String(value || ""),
  );
}

function hasAccessoryModifier(value) {
  return /\b(accessories?|adapter|adapters|eartips?|ear tips?|earpads?|ear pads?|nozzle|nozzles|case|pouch|protective veil|veils|headphone cable|audio cable|replaceable)\b/i.test(
    String(value || ""),
  );
}

function unexpectedModelTokens(candidate, query) {
  const querySet = new Set(distinctiveProductTokens(query));
  return distinctiveProductTokens(candidate).filter(
    (token) => !querySet.has(token) && (MODEL_VARIANT_TOKENS.has(token) || isVersionLikeToken(token)),
  );
}

function hasConflictingModelTokens(candidate, query) {
  const queryTokens = distinctiveProductTokens(query);
  const candidateTokens = distinctiveProductTokens(candidate);
  const queryNumeric = new Set(queryTokens.filter((token) => /\d/.test(token) || isVersionLikeToken(token)));
  const candidateNumeric = new Set(candidateTokens.filter((token) => /\d/.test(token) || isVersionLikeToken(token)));

  if (!queryNumeric.size || !candidateNumeric.size) return false;
  for (const token of candidateNumeric) {
    if (!queryNumeric.has(token)) return true;
  }
  return false;
}

function scoreQueryCompatibility(candidate, query) {
  const queryTokens = distinctiveProductTokens(query);
  if (!queryTokens.length) {
    return { score: 0, hits: 0, missing: 0, unexpected: [], conflictingModel: false, compatible: true };
  }

  const candidateTokens = distinctiveProductTokens(candidate);
  const candidateSet = new Set(candidateTokens);
  const hits = queryTokens.filter((token) => candidateSet.has(token)).length;
  const missing = queryTokens.length - hits;
  const unexpected = unexpectedModelTokens(candidate, query);
  const conflictingModel = hasConflictingModelTokens(candidate, query);
  let score = hits * 8 - missing * 7 - unexpected.length * 10;

  if (conflictingModel) score -= 14;
  if (hasListingModifier(candidate) && !hasListingModifier(query)) score -= 18;
  if (hasAccessoryModifier(candidate) && !hasAccessoryModifier(query)) score -= 22;

  return {
    score,
    hits,
    missing,
    unexpected,
    conflictingModel,
    compatible:
      hits >= Math.max(1, Math.ceil(queryTokens.length * 0.6)) &&
      !conflictingModel &&
      unexpected.length === 0 &&
      !(hasListingModifier(candidate) && !hasListingModifier(query)) &&
      !(hasAccessoryModifier(candidate) && !hasAccessoryModifier(query)),
  };
}

function isStrongQueryMatch(imported, query, candidate = null) {
  const candidateText = [imported?.nameEn, imported?.brand, imported?.sourceUrl, candidate?.title, candidate?.url].join(" ");
  return scoreQueryCompatibility(candidateText, query).compatible;
}

function isBroadSearchQuery(query) {
  const tokens = distinctiveProductTokens(query);
  if (tokens.length !== 1) return false;
  return !/\d/.test(tokens[0]) && !MODEL_VARIANT_TOKENS.has(tokens[0]);
}

function canMergeImportedDrafts(base, candidate, query = "") {
  const baseText = [base?.nameEn, base?.brand].join(" ");
  const candidateText = [candidate?.nameEn, candidate?.brand].join(" ");
  const queryCompatibility = scoreQueryCompatibility(candidateText, query || baseText);
  const baseCompatibility = scoreQueryCompatibility(candidateText, baseText);

  if (base?.brand && candidate?.brand && !sameKey(base.brand, candidate.brand)) return false;
  if (hasListingModifier(candidateText) && !hasListingModifier(query || baseText)) return false;

  return queryCompatibility.compatible && baseCompatibility.hits >= Math.max(1, Math.ceil(distinctiveProductTokens(baseText).length * 0.5));
}

function findExistingProductMatch({ sourceUrl = "", brand = "", nameEn = "", category = "", excludeId = "" }) {
  const cleanSourceUrl = String(sourceUrl || "").trim().toLowerCase();
  const normalizedName = normalizeComparisonText(nameEn);
  const normalizedBrand = normalizeComparisonText(brand);

  return db.products.find((product) => {
    if (excludeId && product.id === excludeId) return false;

    const productSourceUrl = String(product.sourceUrl || "").trim().toLowerCase();
    if (cleanSourceUrl && productSourceUrl && cleanSourceUrl === productSourceUrl) return true;

    const productName = normalizeComparisonText(product.name?.en || "");
    const productBrand = normalizeComparisonText(product.brand || "");
    if (!normalizedName || !productName || normalizedName !== productName) return false;
    if (normalizedBrand && productBrand && normalizedBrand !== productBrand) return false;
    if (category && product.category && String(category) !== String(product.category)) return false;
    return true;
  }) || null;
}

function serializeImportProductMatch(product) {
  return {
    id: String(product.id),
    slug: String(product.slug || ""),
    nameEn: String(product.name?.en || ""),
    brand: String(product.brand || ""),
    category: String(product.category || ""),
    sourceUrl: String(product.sourceUrl || ""),
    image: String(product.image || ""),
    updatedAt: product.updatedAt || product.createdAt || "",
  };
}

function setCorsHeaders(req, res) {
  const origin = normalizeOrigin(req.headers.origin);
  res.setHeader("Vary", "Origin");
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
}

function setSecurityHeaders(req, res) {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https:",
    "form-action 'self'",
  ];
  if (process.env.NODE_ENV === "production") directives.push("upgrade-insecure-requests");

  res.setHeader("Content-Security-Policy", directives.join("; "));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  if (AUTH_COOKIE_SECURE || process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
}

function normalizeOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "";
  }
}

function configuredAllowedOrigins() {
  const values = [
    process.env.PUBLIC_APP_URL,
    process.env.VITE_PUBLIC_APP_URL,
    process.env.EDIO_ALLOWED_ORIGINS,
    `http://${HOST}:${PORT}`,
    "http://127.0.0.1:8080",
    "http://localhost:8080",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
  ];
  return new Set(
    values
      .flatMap((value) => String(value || "").split(","))
      .map(normalizeOrigin)
      .filter(Boolean),
  );
}

function isAllowedOrigin(origin) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  if (configuredAllowedOrigins().has(normalized)) return true;
  if (process.env.NODE_ENV !== "production") {
    return /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(normalized);
  }
  return false;
}

function assertAllowedRequestOrigin(req, pathname = "") {
  const method = req.method || "GET";
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return;
  if (/^\/api\/auth\/oauth\/(?:google|apple)\/callback$/.test(pathname)) return;
  const origin = normalizeOrigin(req.headers.origin);
  if (origin && !isAllowedOrigin(origin)) {
    throw new ApiError(403, "forbidden_origin", "Request origin is not allowed");
  }
}

function normalizePathname(pathname) {
  const clean = decodeURIComponent(pathname).replace(/\/+$/, "");
  return clean || "/";
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function requireString(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new ApiError(400, "validation_error", `${field} is required`);
  return normalized;
}

function sanitizePlainText(value, { max = 500 } = {}) {
  const cleaned = String(value || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\bjavascript\s*:/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, max);
}

function normalizeDescriptionBlocks(value, { publicOnly = false } = {}) {
  if (!Array.isArray(value)) return [];
  return value
    .map((block, index) => normalizeDescriptionBlock(block, index, { publicOnly }))
    .filter(Boolean)
    .slice(0, 40);
}

function publicDescriptionBlocks(value) {
  return normalizeDescriptionBlocks(value, { publicOnly: true });
}

function normalizeProductPageContent(value, { publicOnly = false } = {}) {
  if (!value || typeof value !== "object") return undefined;
  const media = normalizeProductPageMediaList(value.media, { publicOnly });
  const sources = publicOnly ? [] : normalizeProductPageSources(value.sources);
  const blocks = Array.isArray(value.description?.blocks)
    ? value.description.blocks
        .map((block, index) => normalizeProductPageBlock(block, index, { publicOnly }))
        .filter(Boolean)
        .slice(0, 24)
    : [];
  const groups = Array.isArray(value.specs?.groups)
    ? value.specs.groups
        .map((group, index) => normalizeProductPageSpecGroup(group, index))
        .filter(Boolean)
        .slice(0, 12)
    : [];
  const videos = Array.isArray(value.videos)
    ? value.videos
        .map((video, index) => ({
          id: sanitizePlainText(video.id || `video_${index}`, { max: 80 }),
          title: sanitizePlainText(video.title, { max: 140 }),
          url: sanitizeImageUrl(video.url),
          thumbnail: sanitizeImageUrl(video.thumbnail),
          ...(publicOnly ? {} : { sourceUrl: sanitizeImageUrl(video.sourceUrl) }),
        }))
        .filter((video) => video.title && video.url)
        .slice(0, 8)
    : [];

  return {
    description: { blocks },
    sound: normalizeProductPageSound(value.sound, { publicOnly }),
    specs: { groups },
    media,
    videos,
    sources,
    seo: value.seo && typeof value.seo === "object"
      ? {
          title: sanitizePlainText(value.seo.title, { max: 70 }),
          metaDescription: sanitizePlainText(value.seo.metaDescription || value.seo.meta_description, { max: 170 }),
          keywords: cleanStringArray(value.seo.keywords, 20, 60),
          canonicalPath: sanitizePath(value.seo.canonicalPath || value.seo.canonical_path),
          ogImage: sanitizeImageUrl(value.seo.ogImage || value.seo.og_image),
        }
      : undefined,
    seoWarnings: cleanStringArray(value.seoWarnings || value.seo_warnings, 20, 120),
    contentStatus: normalizeEnum(value.contentStatus || value.content_status, new Set(["draft", "needs_research", "reviewed", "published"]), "draft", "contentStatus"),
    updatedAt: sanitizePlainText(value.updatedAt || value.updated_at, { max: 40 }),
  };
}

function publicProductPageContent(value) {
  return normalizeProductPageContent(value, { publicOnly: true });
}

function normalizeProductPageBlock(block, index, { publicOnly = false } = {}) {
  if (!block || typeof block !== "object") return null;
  const media = normalizeProductPageMedia(block.media, index, { publicOnly });
  const video = block.video && typeof block.video === "object"
    ? {
        id: sanitizePlainText(block.video.id || `video_${index}`, { max: 80 }),
        title: sanitizePlainText(block.video.title, { max: 140 }),
        url: sanitizeImageUrl(block.video.url),
        thumbnail: sanitizeImageUrl(block.video.thumbnail),
        ...(publicOnly ? {} : { sourceUrl: sanitizeImageUrl(block.video.sourceUrl) }),
      }
    : undefined;
  return {
    id: sanitizePlainText(block.id || `block_${index}`, { max: 80 }),
    type: normalizeEnum(block.type, new Set(["hero_editorial", "brand_story", "feature", "image_text", "full_width_image", "video_embed", "press_quote", "faq"]), "feature", "blockType"),
    title: sanitizePlainText(block.title, { max: 180 }),
    subtitle: sanitizePlainText(block.subtitle, { max: 220 }),
    body: sanitizePlainText(block.body, { max: 5000 }),
    media,
    video: video?.title && video?.url ? video : undefined,
    layout: normalizeEnum(block.layout, new Set(["image-left", "image-right", "full-width", "two-column"]), "image-right", "blockLayout"),
    order: Number.isFinite(Number(block.order)) ? Number(block.order) : index,
    visible: block.visible !== false,
    ...(publicOnly ? {} : { sourceRefIds: cleanStringArray(block.sourceRefIds || block.source_ref_ids, 12, 80) }),
  };
}

function normalizeProductPageSound(sound, { publicOnly = false } = {}) {
  if (!sound || typeof sound !== "object") return undefined;
  return {
    signature: sanitizePlainText(sound.signature, { max: 160 }),
    bass: sanitizePlainText(sound.bass, { max: 600 }),
    mids: sanitizePlainText(sound.mids, { max: 600 }),
    treble: sanitizePlainText(sound.treble, { max: 600 }),
    soundstage: sanitizePlainText(sound.soundstage, { max: 600 }),
    imaging: sanitizePlainText(sound.imaging, { max: 600 }),
    detail: sanitizePlainText(sound.detail, { max: 600 }),
    comfort: sanitizePlainText(sound.comfort, { max: 600 }),
    pairing: sanitizePlainText(sound.pairing, { max: 600 }),
    genreMatch: cleanStringArray(sound.genreMatch || sound.genre_match, 12, 60),
    dacAmpRequirement: sanitizePlainText(sound.dacAmpRequirement || sound.dac_amp_requirement, { max: 400 }),
    graphImage: normalizeProductPageMedia(sound.graphImage || sound.graph_image, 0, { publicOnly }),
    ...(publicOnly ? {} : {
      sourceRefs: normalizeProductPageSources(sound.sourceRefs || sound.source_refs),
      sourceConfidence: normalizeEnum(sound.sourceConfidence || sound.source_confidence, new Set(["high", "medium", "low"]), "low", "sourceConfidence"),
    }),
  };
}

function normalizeProductPageSpecGroup(group, index) {
  if (!group || typeof group !== "object") return null;
  const specs = Array.isArray(group.specs)
    ? group.specs
        .map((spec) => ({
          name: sanitizePlainText(spec.name, { max: 120 }),
          value: sanitizePlainText(spec.value, { max: 240 }),
          unit: sanitizePlainText(spec.unit, { max: 40 }),
          sourceRefId: sanitizePlainText(spec.sourceRefId || spec.source_ref_id, { max: 80 }),
        }))
        .filter((spec) => spec.name && spec.value)
        .slice(0, 40)
    : [];
  return {
    id: sanitizePlainText(group.id || `spec_group_${index}`, { max: 80 }),
    title: sanitizePlainText(group.title || "Specs", { max: 80 }),
    specs,
    order: Number.isFinite(Number(group.order)) ? Number(group.order) : index,
  };
}

function normalizeProductPageMediaList(value, { publicOnly = false } = {}) {
  if (!Array.isArray(value)) return [];
  return value.map((media, index) => normalizeProductPageMedia(media, index, { publicOnly })).filter(Boolean).slice(0, 40);
}

function normalizeProductPageMedia(media, index, { publicOnly = false } = {}) {
  if (!media || typeof media !== "object") return undefined;
  const url = sanitizeImageUrl(media.url);
  if (!url) return undefined;
  return {
    id: sanitizePlainText(media.id || `media_${index}`, { max: 80 }),
    url,
    alt: sanitizePlainText(media.alt, { max: 180 }),
    caption: sanitizePlainText(media.caption, { max: 240 }),
    width: positiveInteger(media.width),
    height: positiveInteger(media.height),
    ...(publicOnly ? {} : { sourceUrl: sanitizeImageUrl(media.sourceUrl || media.source_url) }),
    licenseStatus: normalizeEnum(media.licenseStatus || media.license_status, new Set(["official_manufacturer", "owned", "licensed", "authorized_distributor", "unknown", "do_not_use"]), "unknown", "licenseStatus"),
    placement: normalizeEnum(media.placement, new Set(["gallery", "description", "sound", "specs"]), "description", "placement"),
    order: Number.isFinite(Number(media.order)) ? Number(media.order) : index,
    isPrimary: Boolean(media.isPrimary || media.is_primary),
  };
}

function normalizeProductPageSources(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((source, index) => {
      const url = sanitizeImageUrl(source.url);
      if (!url) return null;
      return {
        id: sanitizePlainText(source.id || `source_${index}`, { max: 80 }),
        title: sanitizePlainText(source.title, { max: 180 }),
        url,
        sourceType: normalizeEnum(source.sourceType || source.source_type, new Set(["manufacturer", "official_manual", "authorized_distributor", "expert_review", "forum_user_review", "internal"]), "internal", "sourceType"),
        confidence: normalizeEnum(source.confidence, new Set(["high", "medium", "low"]), "low", "confidence"),
        usedFields: cleanStringArray(source.usedFields || source.used_fields, 8, 40).filter((field) => ["specs", "sound", "description", "images"].includes(field)),
        notes: sanitizePlainText(source.notes, { max: 500 }),
      };
    })
    .filter(Boolean)
    .slice(0, 40);
}

function sanitizePath(value) {
  const normalized = sanitizePlainText(value, { max: 240 });
  return normalized.startsWith("/") && !normalized.startsWith("//") ? normalized : "";
}

function normalizeDescriptionBlock(block, index, { publicOnly = false } = {}) {
  if (!block || typeof block !== "object") return null;
  const rawType = String(block.type || "").trim();
  const type = ["text", "image", "spec_image", "image_group", "callout"].includes(rawType) ? rawType : "image";
  const mediaUrl = sanitizeImageUrl(block.media?.url || block.url || "");
  const contentText = sanitizeDescriptionText(
    block.content?.text || block.content?.markdown || block.content?.html_or_markdown || block.text || "",
    { max: 5000 },
  ).replace(/<img\b[^>]*>/gi, "");
  const normalized = {
    id: sanitizePlainText(block.id || `desc_${index}`, { max: 80 }),
    type,
    section: normalizeEnum(block.section || block.content?.section || "", new Set(["description", "description_media", "technical_specs", "box_contents"]), "", "descriptionSection") || undefined,
    content: contentText ? { text: sanitizePlainText(contentText, { max: 5000 }) } : block.content?.imageRole ? { imageRole: block.content.imageRole } : {},
    media: mediaUrl
      ? {
          url: mediaUrl,
          alt: sanitizePlainText(block.altText || block.alt_text || block.media?.alt || "", { max: 180 }),
          width: positiveInteger(block.media?.width),
          height: positiveInteger(block.media?.height),
          role: normalizeDescriptionRole(block.media?.role || block.content?.imageRole || block.role),
        }
      : undefined,
    sortOrder: Number.isFinite(Number(block.sortOrder ?? block.sort_order)) ? Number(block.sortOrder ?? block.sort_order) : index,
    altText: sanitizePlainText(block.altText || block.alt_text || block.media?.alt || "", { max: 180 }),
    caption: sanitizePlainText(block.caption || "", { max: 240 }),
    extractedText: sanitizePlainText(block.extractedText || block.extracted_text || "", { max: 2500 }),
    extractionConfidence: optionalConfidence(block.extractionConfidence ?? block.extraction_confidence) || 0,
    needsReview: Boolean(block.needsReview ?? block.needs_review),
  };

  if (!normalized.content?.text && !normalized.media?.url) return null;

  if (!publicOnly) {
    normalized.sourceUrl = sanitizePlainText(block.sourceUrl || block.source_url || "", { max: 1000 });
    normalized.sourceType = normalizeEnum(block.sourceType || block.source_type || "manual", new Set(["official", "retailer", "imported", "manual", "unknown"]), "unknown", "sourceType");
    normalized.classificationReason = sanitizePlainText(block.classificationReason || block.classification_reason || "", { max: 240 });
    normalized.confidence = optionalConfidence(block.confidence) || 0;
  }

  return normalized;
}

function sanitizeImageUrl(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.startsWith("/") && !normalized.startsWith("//")) return sanitizePlainText(normalized, { max: 1000 });
  if (/^https?:\/\//i.test(normalized)) return sanitizePlainText(normalized, { max: 1000 });
  if (/^data:image\/(?:png|jpe?g|webp|avif);base64,/i.test(normalized)) return normalized.slice(0, 150000);
  return "";
}

function normalizeDescriptionRole(value) {
  const role = String(value || "description").trim().toLowerCase().replace(/-/g, "_");
  if (["description", "feature", "spec_image", "box_image", "unknown_description_image", "comparison", "diagram", "unknown"].includes(role)) return role;
  if (["spec", "technical", "chart"].includes(role)) return "spec_image";
  if (["box", "package", "package_contents", "contents", "included"].includes(role)) return "box_image";
  return "description";
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : undefined;
}

function requireCleanString(value, field, max = 500) {
  const normalized = sanitizePlainText(value, { max });
  if (!normalized) throw new ApiError(400, "validation_error", `${field} is required`);
  return normalized;
}

function assertNoForbiddenFields(body, fields = FORBIDDEN_PROFILE_FIELDS) {
  if (!body || typeof body !== "object") return;
  const blocked = Object.keys(body).find((key) => fields.has(key));
  if (blocked) {
    throw new ApiError(400, "forbidden_field", `${blocked} cannot be changed from this endpoint`);
  }
}

function cleanStringArray(value, maxItems = 20, maxLength = 120) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => sanitizePlainText(item, { max: maxLength }))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeEnum(value, allowed, fallback, field) {
  const normalized = String(value || "").trim();
  if (!normalized) return fallback;
  if (!allowed.has(normalized)) {
    throw new ApiError(400, "validation_error", `${field} is not allowed`);
  }
  return normalized;
}

function publicUser(user) {
  return Object.fromEntries(PUBLIC_USER_FIELDS.filter((field) => field in user).map((field) => [field, user[field]]));
}

function publicCoupon(coupon) {
  const { code, type, value, label, minSubtotal } = coupon;
  return { code, type, value, label, minSubtotal: minSubtotal || 0 };
}

function byCreatedDesc(a, b) {
  return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
}

function sortProductsByDate(items) {
  return [...items].sort(byCreatedDesc);
}

function keyify(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function sameKey(a, b) {
  return keyify(a) === keyify(b);
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function validateProductionSecurityConfig() {
  if (process.env.NODE_ENV !== "production") return;
  if (!process.env.JWT_SECRET || JWT_SECRET === DEFAULT_JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error("Production requires a strong JWT_SECRET of at least 32 characters.");
  }
  if (!AUTH_COOKIE_SECURE) {
    throw new Error("Production requires secure authentication cookies.");
  }
}

validateProductionSecurityConfig();
db = await loadDatabase();

const server = http.createServer(async (req, res) => {
  setSecurityHeaders(req, res);
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    await route(req, res);
  } catch (error) {
    if (error instanceof ApiError) {
      send(res, error.status, { ok: false, error: { code: error.code, message: error.message } });
      return;
    }

    console.error(error);
    send(res, 500, { ok: false, error: { code: "server_error", message: "Unexpected server error" } });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`EDIO API running at http://${HOST}:${PORT}`);
  console.log(`Database: ${DB_FILE}`);
});
