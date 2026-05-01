import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_API_BASE = process.env.EDIO_API_BASE || "http://127.0.0.1:8787";
const DEFAULT_OUTPUT_DIR =
  process.env.EDIO_AUDIT_OUTPUT_DIR ||
  "/Users/yousif/Documents/Codex/2026-04-23-edio-users-yousif-documents-codex-2026";
const DB_FILE = process.env.EDIO_DB_FILE || path.resolve("server/data/db.json");

const GENERIC_PRODUCT_TOKENS = new Set([
  "a",
  "an",
  "and",
  "audio",
  "bluetooth",
  "cable",
  "dac",
  "ear",
  "earbud",
  "earbuds",
  "earphone",
  "earphones",
  "for",
  "headphone",
  "headphones",
  "hifi",
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
  "page",
  "planar",
  "product",
  "shop",
  "store",
  "the",
  "to",
  "wireless",
]);

const MODEL_VARIANT_TOKENS = new Set([
  "anniversary",
  "box",
  "bstock",
  "bt",
  "classic",
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
  "ultra",
  "used",
  "v2",
  "v3",
  "v4",
  "vi",
  "vii",
  "viii",
  "wireless",
]);

function parseArgs(argv) {
  const options = {
    apiBase: DEFAULT_API_BASE,
    outputDir: DEFAULT_OUTPUT_DIR,
    maxProducts: 72,
    maxPerBrand: 3,
    queriesFile: "",
    queriesLimit: 0,
    delayMs: 150,
    checkpointEvery: 12,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];

    if (value === "--api-base" && next) {
      options.apiBase = next;
      index += 1;
    } else if (value === "--output-dir" && next) {
      options.outputDir = next;
      index += 1;
    } else if (value === "--max-products" && next) {
      options.maxProducts = Number(next);
      index += 1;
    } else if (value === "--max-per-brand" && next) {
      options.maxPerBrand = Number(next);
      index += 1;
    } else if (value === "--queries-file" && next) {
      options.queriesFile = next;
      index += 1;
    } else if (value === "--queries-limit" && next) {
      options.queriesLimit = Number(next);
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

async function loadQuerySeedItems(filePath, limit = 0) {
  const raw = await fs.readFile(filePath, "utf8");
  const trimmed = raw.trim();
  if (!trimmed) return [];

  let items;
  if (filePath.endsWith(".json")) {
    const parsed = JSON.parse(trimmed);
    items = Array.isArray(parsed) ? parsed : Array.isArray(parsed.queries) ? parsed.queries : [];
  } else {
    items = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((query) => ({ query }));
  }

  return items
    .map(normalizeQuerySeedItem)
    .filter((item) => item.query)
    .slice(0, limit > 0 ? limit : items.length);
}

function normalizeQuerySeedItem(item) {
  if (typeof item === "string") {
    return {
      query: item.trim(),
      expectedName: item.trim(),
      brand: "",
      category: "",
      sourceUrl: "",
    };
  }

  return {
    query: String(item?.query || item?.nameEn || item?.expectedName || "").trim(),
    expectedName: String(item?.expectedName || item?.nameEn || item?.query || "").trim(),
    brand: String(item?.brand || "").trim(),
    category: String(item?.category || "").trim(),
    sourceUrl: String(item?.sourceUrl || "").trim(),
  };
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

function isVersionLikeToken(token) {
  return /^(?:v\d+|mk\d+|gen\d+|20\d{2}|[ivx]{2,})$/i.test(String(token || ""));
}

function hasListingModifier(value) {
  return /\b(open[\s-]?box|refurb(?:ished)?|renewed|used|pre[\s-]?owned|b[\s-]?stock|replacement|spare)\b/i.test(
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
      !(hasListingModifier(candidate) && !hasListingModifier(query)),
  };
}

function sameKey(left, right) {
  return normalizeComparisonText(left) === normalizeComparisonText(right);
}

function buildQueryVariants(product) {
  const exact = String(product?.name?.en || "").trim();
  const stripped = exact
    .replace(
      /\b(planar magnetic|headphones?|earphones?|earbuds?|iems?|in-ear(?: monitors?)?|open-back|closed-back|wireless|bluetooth|dac(?:\/amp)?|amplifier|microphone|studio monitor)\b/gi,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
  const withoutBrand = stripped
    .replace(new RegExp(`^${String(product.brand || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), "")
    .trim();
  const withoutBrandTokens = distinctiveProductTokens(withoutBrand);
  const allowWithoutBrand =
    withoutBrandTokens.length >= 2 || (withoutBrandTokens.length === 1 && !/\d/.test(withoutBrandTokens[0] || ""));

  return Array.from(
    new Set([exact, stripped, allowWithoutBrand ? withoutBrand : ""].filter((value) => value && value.length >= 3)),
  );
}

function pickProducts(products, maxProducts, maxPerBrand) {
  const grouped = new Map();

  for (const product of products) {
    const key = String(product.brand || "").trim();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(product);
  }

  const chosen = [];
  for (const items of grouped.values()) {
    chosen.push(...items.slice(0, maxPerBrand));
    if (chosen.length >= maxProducts) break;
  }

  return chosen.slice(0, maxProducts);
}

async function login(apiBase) {
  const response = await fetch(`${apiBase}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@edio.iq", password: "admin123" }),
  });

  const payload = await response.json();
  if (!response.ok || !payload?.ok || !payload?.data?.token) {
    throw new Error(payload?.error?.message || "Unable to obtain admin token.");
  }

  return payload.data.token;
}

async function runDiscover(apiBase, token, query) {
  const response = await fetch(`${apiBase}/api/admin/products/discover`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });

  const payload = await response.json();
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error?.message || `Discover failed with status ${response.status}`);
  }

  return payload.data;
}

function evaluateCase(product, query, data) {
  const draft = data?.draft || data || {};
  const candidateText = [draft?.nameEn, draft?.brand, draft?.sourceUrl].join(" ");
  const expectedName = String(product?.name?.en || "");
  const expectedBrand = String(product?.brand || "").trim();
  const expectedCategory = String(product?.category || "").trim();
  const brandKnown = Boolean(expectedBrand);
  const categoryKnown = Boolean(expectedCategory);
  const brandMatch = brandKnown ? sameKey(expectedBrand, draft.brand) : null;
  const categoryMatch = categoryKnown ? sameKey(expectedCategory, draft.category) : null;
  const queryCompatibility = scoreQueryCompatibility(candidateText, query);
  const expectedCompatibility = scoreQueryCompatibility(candidateText, expectedName);
  const listingMismatch = hasListingModifier(candidateText) && !hasListingModifier(query);
  const imageCount = Array.isArray(draft.gallery) ? draft.gallery.length : 0;
  const specCount = Array.isArray(draft.specs) ? draft.specs.length : 0;
  const score =
    (brandMatch ? 30 : 0) +
    (categoryMatch ? 20 : 0) +
    Math.max(0, expectedCompatibility.score + 20) +
    Math.min(imageCount, 6) * 3 +
    Math.min(specCount, 6) * 2 -
    (listingMismatch ? 25 : 0);

  return {
    query,
    expectedName,
    expectedBrand,
    expectedCategory,
    actualName: draft.nameEn || "",
    actualBrand: draft.brand || "",
    actualCategory: draft.category || "",
    sourceUrl: draft.sourceUrl || "",
    imageCount,
    specCount,
    brandMatch,
    categoryMatch,
    queryCompatibility,
    expectedCompatibility,
    listingMismatch,
    score,
    pass:
      (!brandKnown || brandMatch) &&
      expectedCompatibility.compatible &&
      !listingMismatch &&
      imageCount >= 2 &&
      (!categoryKnown || categoryMatch),
    candidates: (data?.candidates || []).slice(0, 3).map((candidate) => ({
      title: candidate.title,
      url: candidate.url,
      score: candidate.score,
      imageCount: candidate.imageCount,
      specCount: candidate.specCount,
    })),
  };
}

function buildMarkdownReport(summary, cases) {
  const failures = cases
    .filter((entry) => !entry.pass)
    .sort((left, right) => left.score - right.score)
    .slice(0, 25);

  return [
    "# EDIO Discovery Audit",
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Queries: ${summary.totalQueries}`,
    `- Pass rate: ${summary.passRate}%`,
    `- Brand match rate: ${summary.brandRate}%`,
    `- Category match rate: ${summary.categoryRate}%`,
    `- Avg images: ${summary.averageImages}`,
    `- Avg specs: ${summary.averageSpecs}`,
    `- Listing mismatches: ${summary.listingMismatchCount}`,
    "",
    "## Worst Cases",
    "",
    ...failures.map((entry) =>
      [
        `### ${entry.query}`,
        `- Expected: ${entry.expectedBrand || "(unknown brand)"} / ${entry.expectedName} / ${entry.expectedCategory || "(unknown category)"}`,
        `- Actual: ${entry.actualBrand} / ${entry.actualName} / ${entry.actualCategory}`,
        `- URL: ${entry.sourceUrl || "(none)"}`,
        `- Images: ${entry.imageCount}, Specs: ${entry.specCount}, Listing mismatch: ${entry.listingMismatch ? "yes" : "no"}`,
        `- Top candidates: ${entry.candidates.map((candidate) => `${candidate.title} -> ${candidate.url}`).join(" | ") || "(none)"}`,
        "",
      ].join("\n"),
    ),
  ].join("\n");
}

function summarizeCases(cases) {
  const successful = cases.filter((entry) => entry.pass).length;
  const knownBrandCases = cases.filter((entry) => entry.expectedBrand);
  const knownCategoryCases = cases.filter((entry) => entry.expectedCategory);
  return {
    totalQueries: cases.length,
    passRate: Number(((successful / Math.max(cases.length, 1)) * 100).toFixed(1)),
    brandRate: Number(
      ((knownBrandCases.filter((entry) => entry.brandMatch).length / Math.max(knownBrandCases.length, 1)) * 100).toFixed(1),
    ),
    categoryRate: Number(
      ((knownCategoryCases.filter((entry) => entry.categoryMatch).length / Math.max(knownCategoryCases.length, 1)) * 100).toFixed(1),
    ),
    averageImages: Number(
      (cases.reduce((sum, entry) => sum + entry.imageCount, 0) / Math.max(cases.length, 1)).toFixed(2),
    ),
    averageSpecs: Number(
      (cases.reduce((sum, entry) => sum + entry.specCount, 0) / Math.max(cases.length, 1)).toFixed(2),
    ),
    listingMismatchCount: cases.filter((entry) => entry.listingMismatch).length,
  };
}

async function writeCheckpoint({ outputDir, cases, completed, totalQueries }) {
  const summary = summarizeCases(cases);
  await fs.mkdir(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, "edio-discovery-audit-latest.partial.json");
  const mdPath = path.join(outputDir, "edio-discovery-audit-latest.partial.md");

  await fs.writeFile(
    jsonPath,
    JSON.stringify(
      {
        progress: {
          completed,
          totalQueries,
          percent: Number(((completed / Math.max(totalQueries, 1)) * 100).toFixed(1)),
          updatedAt: new Date().toISOString(),
        },
        summary,
        cases,
      },
      null,
      2,
    ),
  );
  await fs.writeFile(
    mdPath,
    [
      `# EDIO Discovery Audit (Partial)`,
      "",
      `- Progress: ${completed}/${totalQueries}`,
      `- Updated: ${new Date().toISOString()}`,
      "",
      buildMarkdownReport(summary, cases),
    ].join("\n"),
  );
}

async function main() {
  const options = parseArgs(process.argv);
  let products = [];
  let queuedQueries = [];

  if (options.queriesFile) {
    queuedQueries = await loadQuerySeedItems(options.queriesFile, options.queriesLimit);
  } else {
    const rawDb = await fs.readFile(DB_FILE, "utf8");
    const db = JSON.parse(rawDb);
    products = pickProducts(
      (db.products || []).filter((product) => product?.name?.en && product.brand && product.category),
      options.maxProducts,
      options.maxPerBrand,
    );
  }

  const token = await login(options.apiBase);
  const cases = [];
  const totalQueries = queuedQueries.length || products.reduce((sum, product) => sum + buildQueryVariants(product).length, 0);
  let completed = 0;

  const runQueryCase = async (product, query) => {
      completed += 1;
      process.stdout.write(`[${completed}/${totalQueries}] ${query}\n`);
      try {
        const data = await runDiscover(options.apiBase, token, query);
        cases.push(evaluateCase(product, query, data));
      } catch (error) {
        cases.push({
          query,
          expectedName: product.name.en,
          expectedBrand: product.brand,
          expectedCategory: product.category,
          actualName: "",
          actualBrand: "",
          actualCategory: "",
          sourceUrl: "",
          imageCount: 0,
          specCount: 0,
          brandMatch: false,
          categoryMatch: false,
          queryCompatibility: { compatible: false },
          expectedCompatibility: { compatible: false },
          listingMismatch: false,
          score: -100,
          pass: false,
          error: error instanceof Error ? error.message : String(error),
          candidates: [],
        });
      }

      if (
        options.checkpointEvery > 0 &&
        (completed % options.checkpointEvery === 0 || completed === totalQueries)
      ) {
        await writeCheckpoint({
          outputDir: options.outputDir,
          cases,
          completed,
          totalQueries,
        });
      }

      if (options.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }
  };

  if (queuedQueries.length) {
    for (const item of queuedQueries) {
      await runQueryCase(
        {
          name: { en: item.expectedName || item.query },
          brand: item.brand || "",
          category: item.category || "",
        },
        item.query,
      );
    }
  } else {
    for (const product of products) {
      for (const query of buildQueryVariants(product)) {
        await runQueryCase(product, query);
      }
    }
  }

  const summary = summarizeCases(cases);

  await fs.mkdir(options.outputDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(options.outputDir, `edio-discovery-audit-${stamp}.json`);
  const mdPath = path.join(options.outputDir, `edio-discovery-audit-${stamp}.md`);
  await fs.writeFile(jsonPath, JSON.stringify({ summary, cases }, null, 2));
  await fs.writeFile(mdPath, buildMarkdownReport(summary, cases));

  console.log(
    JSON.stringify(
      {
        summary,
        jsonPath,
        mdPath,
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
