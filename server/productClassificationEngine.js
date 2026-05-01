export const CLASSIFICATION_CONFIDENCE_THRESHOLD = 0.75;

export const EXISTING_CATEGORY_SLUGS = [
  "headphones",
  "iems",
  "dap",
  "dac",
  "audio-interface",
  "mic",
  "accessories",
];

export const EXISTING_DYNAMIC_COLLECTION_SLUGS = [
  "featured",
  "new-arrivals",
  "new",
  "popular",
  "best-sellers",
  "pre-owned",
  "sale",
  "in-stock",
  "out-of-stock",
];

export const CATEGORY_TERM_DEFINITIONS = {
  headphones: [
    {
      slug: "type-back",
      aliases: ["back-type"],
      children: [
        { slug: "closed-back", aliases: ["closed", "closedback"] },
        { slug: "open-back", aliases: ["open", "openback"] },
      ],
    },
    {
      slug: "driver-configuration",
      aliases: ["driver", "driver-configuration-headphone"],
      children: [
        { slug: "dynamic-driver", aliases: ["dynamic", "dynamic-driver-driver-configuration-headphone"] },
        { slug: "planar-driver", aliases: ["planar", "planar-magnetic", "planar-driver-driver-configuration-headphone"] },
      ],
    },
  ],
  iems: [
    {
      slug: "driver-configuration",
      aliases: ["driver"],
      children: [
        { slug: "dynamic-driver", aliases: ["dynamic", "dd", "single-dd"] },
        { slug: "planar-driver", aliases: ["planar", "planar-magnetic"] },
        { slug: "balanced-armatures", aliases: ["ba", "balanced-armature", "balanced-armature-driver"] },
        { slug: "hybrid-drivers", aliases: ["hybrid", "hybrid-driver", "tribrid", "quadbrid"] },
      ],
    },
    { slug: "wireless", aliases: ["tws", "true-wireless", "bluetooth"] },
  ],
  dap: [
    { slug: "portable" },
    { slug: "bluetooth" },
  ],
  dac: [
    { slug: "portable", aliases: ["dongle", "usb-c"] },
    { slug: "desktop" },
    { slug: "bluetooth" },
  ],
  "audio-interface": [
    { slug: "desktop" },
    { slug: "portable" },
  ],
  mic: [
    { slug: "dynamic", aliases: ["dynamic-mic", "dynamic-microphone"] },
    { slug: "condenser", aliases: ["condenser-mic", "condenser-microphone", "electret"] },
  ],
  accessories: [
    { slug: "audio-cables", aliases: ["cables", "cable", "audio-cable"] },
    { slug: "eartips", aliases: ["ear-tips", "ear-tips-tips", "tips", "ear-tip"] },
    { slug: "cable-convertors", aliases: ["convertors", "converters", "adapters", "adaptors", "adapter", "adaptor"] },
    { slug: "cases", aliases: ["case", "storage", "storage-boxes", "storage-boxes-cases", "pouch"] },
  ],
};

const CATEGORY_ALIASES = {
  headphone: "headphones",
  headphones: "headphones",
  "سماعات": "headphones",
  "سماعات-الرأس": "headphones",
  iem: "iems",
  iems: "iems",
  "in-ear-monitor": "iems",
  "in-ear-monitors": "iems",
  earphone: "iems",
  earphones: "iems",
  earbuds: "iems",
  dap: "dap",
  "digital-audio-player": "dap",
  player: "dap",
  dac: "dac",
  amp: "dac",
  amplifier: "dac",
  "dac-amp": "dac",
  "dac-and-amp": "dac",
  microphone: "mic",
  microphones: "mic",
  mic: "mic",
  "audio-interface": "audio-interface",
  "audio-interfaces": "audio-interface",
  interface: "audio-interface",
  accessories: "accessories",
  accessory: "accessories",
  cable: "accessories",
  cables: "accessories",
  eartips: "accessories",
  "ear-tips": "accessories",
  cases: "accessories",
};

const SOURCE_WEIGHTS = {
  official: 0.98,
  manual: 0.97,
  structured_data: 0.94,
  retailer: 0.88,
  internal: 0.86,
  community: 0.58,
  model: 0.72,
};

const TRUSTED_RETAILER_HOSTS = new Set([
  "amazon.com",
  "amazon.co.uk",
  "sweetwater.com",
  "thomann.de",
  "thomannmusic.com",
  "headphones.com",
  "hifigo.com",
  "linsoul.com",
  "shenzhenaudio.com",
]);

const MANUAL_URL_RE = /\.(pdf)(?:[?#]|$)|manual|user-guide|spec-sheet|datasheet/i;
const RECENT_WINDOW_MS = 21 * 86400000;

export function keyifyClassification(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function textFromLocalized(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  return [...new Set([value.en, value.ar].filter(Boolean).map((entry) => String(entry).trim()))].join(" ");
}

function labelFromSpec(label) {
  return textFromLocalized(label);
}

export function normalizeClassificationCategory(value, allowedCategories = EXISTING_CATEGORY_SLUGS) {
  const key = keyifyClassification(value);
  const direct = CATEGORY_ALIASES[key] || key;
  return allowedCategories.find((category) => keyifyClassification(category) === keyifyClassification(direct)) || "";
}

export function flattenClassificationTerms(category, includeGroups = true) {
  const terms = CATEGORY_TERM_DEFINITIONS[category] || [];
  const flat = [];
  const visit = (term) => {
    if (includeGroups || !term.children?.length) flat.push(term);
    for (const child of term.children || []) visit(child);
  };
  for (const term of terms) visit(term);
  return flat;
}

export function resolveClassificationTerm(category, value, { leafOnly = true } = {}) {
  const requested = keyifyClassification(value);
  if (!requested) return null;
  const terms = flattenClassificationTerms(category, !leafOnly);
  return (
    terms.find((term) => [term.slug, ...(term.aliases || [])].map(keyifyClassification).includes(requested)) || null
  );
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function boundedScore(value) {
  return Math.max(0, Math.min(0.99, Number(value.toFixed(2))));
}

function evidence(sourceType, sourceUrl, facts) {
  return {
    source_type: sourceType,
    source_url: sourceUrl || "",
    facts: unique(facts).slice(0, 10),
  };
}

function productFacts(product) {
  return unique([
    product?.slug,
    product?.brand,
    textFromLocalized(product?.name),
    textFromLocalized(product?.tagline),
    product?.category ? `category:${product.category}` : "",
    ...(product?.subCategories || []).map((term) => `term:${term}`),
    ...(product?.features || []),
    ...(product?.specs || []).flatMap((spec) => [labelFromSpec(spec.label), spec.value]),
    ...(product?.tags || []),
  ]);
}

function factsText(facts) {
  return unique(facts).join(" ").toLowerCase();
}

function addCandidate(map, key, score, source, fact) {
  if (!key) return;
  const current = map.get(key) || { key, score: 0, sources: [], facts: [] };
  current.score = Math.max(current.score, score);
  current.sources.push(source);
  current.facts.push(fact);
  map.set(key, current);
}

function scoreFor(sourceType, ruleScore) {
  return Math.min(0.99, (SOURCE_WEIGHTS[sourceType] || 0.65) * ruleScore);
}

function addPrimaryEvidence(candidates, source) {
  const text = factsText(source.facts);
  const sourceType = source.source_type;
  const add = (category, ruleScore, fact) => addCandidate(candidates, category, scoreFor(sourceType, ruleScore), source, fact);

  if (/\b(audio interface|usb interface|recording interface|xlr interface|sound card|scarlett|volt|apollo)\b/.test(text)) {
    add("audio-interface", 0.98, "audio interface identity");
  }
  if (/\b(dap|digital audio player|hi-?res player|music player|hiby r3|r3ii|m300)\b/.test(text)) {
    add("dap", 0.95, "digital audio player identity");
  }
  if (/\b(microphone|podmic|sm7b|sm58|condenser mic|dynamic mic|usb microphone|xlr microphone)\b/.test(text)) {
    add("mic", 0.97, "microphone identity");
  }
  if (/\b(headphone|headphones|over-ear|on-ear|circumaural|supra-aural|open-back headphone|closed-back headphone)\b/.test(text)) {
    add("headphones", 0.95, "headphone identity");
  }
  if (/\b(iem|iems|in-ear monitor|in ear monitor|earphone|earphones|earbud|earbuds|true wireless)\b/.test(text)) {
    add("iems", 0.95, "IEM or earphone identity");
  }
  if (/\b(dac|amp|amplifier|dongle dac|headphone amp|decoder|line out|balanced output|cs43131|ak4493|es9039)\b/.test(text)) {
    add("dac", 0.9, "DAC or amplifier identity");
  }
  if (/\b(cable|adapter|adaptor|eartip|eartips|ear tip|ear tips|case|pouch|storage box|convertor|converter|mmcx|2-pin|0\.78mm)\b/.test(text)) {
    add("accessories", 0.92, "accessory identity");
  }
}

function addSecondaryEvidence(candidates, category, source) {
  const text = factsText(source.facts);
  const sourceType = source.source_type;
  const add = (term, ruleScore, fact) => {
    const resolved = resolveClassificationTerm(category, term, { leafOnly: true });
    if (resolved) addCandidate(candidates, resolved.slug, scoreFor(sourceType, ruleScore), source, fact);
  };

  for (const fact of source.facts || []) {
    const raw = String(fact || "");
    const termValue = raw.startsWith("term:") ? raw.slice(5) : raw;
    const resolved = resolveClassificationTerm(category, termValue, { leafOnly: true });
    if (resolved) addCandidate(candidates, resolved.slug, scoreFor(sourceType, 1), source, `existing term ${resolved.slug}`);
  }

  if (category === "headphones") {
    if (/\b(open[- ]back|open acoustic|open headphone|open-back headphone)\b/.test(text)) add("open-back", 1, "open-back confirmed");
    if (/\b(closed[- ]back|closed headphone|closed-back headphone|sealed headphone)\b/.test(text)) add("closed-back", 1, "closed-back confirmed");
    if (/\b(planar magnetic|planar driver|planar headphone|orthodynamic)\b/.test(text)) add("planar-driver", 0.98, "planar driver confirmed");
    if (/\bdynamic driver|dynamic headphone|dynamic transducer\b/.test(text)) add("dynamic-driver", 0.96, "dynamic driver confirmed");
  }

  if (category === "iems") {
    if (/\bhybrid|tria?brid|quadbrid|multi-driver hybrid\b/.test(text)) add("hybrid-drivers", 0.98, "hybrid driver confirmed");
    if (/\bbalanced armature|\bba driver|\bbas\b/.test(text)) add("balanced-armatures", 0.98, "balanced armature confirmed");
    if (/\bplanar magnetic|planar driver|planar iem\b/.test(text)) add("planar-driver", 0.96, "planar driver confirmed");
    if (/\bdynamic driver|single dd|dual dd|1dd\b/.test(text)) add("dynamic-driver", 0.94, "dynamic driver confirmed");
    if (/\btws|true wireless|bluetooth earbuds|wireless earbuds\b/.test(text)) add("wireless", 0.94, "wireless confirmed");
  }

  if (category === "mic") {
    if (/\bdynamic microphone|dynamic mic|moving-coil|podmic|sm7b|sm58\b/.test(text)) add("dynamic", 0.98, "dynamic microphone confirmed");
    if (/\bcondenser microphone|condenser mic|electret condenser|large diaphragm condenser\b/.test(text)) add("condenser", 0.98, "condenser microphone confirmed");
  }

  if (category === "accessories") {
    if (/\b(audio cable|balanced cable|cable|xlr|trs|trrs|mmcx|2-pin|0\.78mm)\b/.test(text)) add("audio-cables", 0.96, "audio cable confirmed");
    if (/\bear ?tips?|eartips?|silicone tips?|foam tips?\b/.test(text)) add("eartips", 0.96, "eartips confirmed");
    if (/\badapter|adaptor|convertor|converter|dongle adapter\b/.test(text)) add("cable-convertors", 0.94, "cable adapter confirmed");
    if (/\bcase|pouch|storage|carry case|storage box\b/.test(text)) add("cases", 0.94, "case or storage confirmed");
  }

  if (category === "dac" || category === "dap" || category === "audio-interface") {
    if (/\bportable|dongle|pocket|usb-c powered|bus powered\b/.test(text)) add("portable", 0.9, "portable format confirmed");
    if (/\bdesktop|desk|rack|studio desktop\b/.test(text)) add("desktop", 0.9, "desktop format confirmed");
    if (/\bbluetooth|bt receiver|wireless receiver\b/.test(text)) add("bluetooth", 0.88, "bluetooth confirmed");
  }
}

function detectPrimary(product, sources, allowedCategories) {
  const candidates = new Map();
  const existing = normalizeClassificationCategory(product.category, allowedCategories);
  if (existing) {
    addCandidate(
      candidates,
      existing,
      0.88,
      evidence("internal", "", [`category:${existing}`]),
      "existing product category",
    );
  }

  for (const source of sources) addPrimaryEvidence(candidates, source);

  const sorted = [...candidates.values()].sort((a, b) => b.score - a.score);
  const best = sorted[0] || null;
  const runnerUp = sorted[1] || null;
  const conflict = Boolean(best && runnerUp && runnerUp.score >= 0.74 && best.score - runnerUp.score < 0.1);
  return { best, runnerUp, conflict, sorted };
}

function detectSecondary(product, category, sources) {
  const candidates = new Map();
  if (category) {
    for (const source of sources) addSecondaryEvidence(candidates, category, source);
  }

  const sorted = [...candidates.values()].sort((a, b) => b.score - a.score);
  const accepted = sorted.filter((candidate) => candidate.score >= 0.72).map((candidate) => candidate.key);
  const conflicts = [];
  if (accepted.includes("open-back") && accepted.includes("closed-back")) conflicts.push("open_back_vs_closed_back");
  if (accepted.includes("dynamic") && accepted.includes("condenser")) conflicts.push("dynamic_vs_condenser_microphone");

  return { accepted: unique(accepted), sorted, conflicts };
}

function needsSecondary(category) {
  return ["headphones", "iems", "mic", "accessories"].includes(category);
}

function dynamicCollectionsForProduct(product, now = new Date()) {
  const createdAt = product?.createdAt ? new Date(product.createdAt).getTime() : 0;
  const ageMs = Number.isFinite(createdAt) && createdAt > 0 ? now.getTime() - createdAt : Infinity;
  const collections = [];
  if (product?.badge === "featured" || product?.storedBadge === "featured") collections.push("featured");
  if (product?.badge === "new" || product?.storedBadge === "new") collections.push("new");
  if (ageMs <= RECENT_WINDOW_MS) collections.push("new-arrivals");
  if (product?.badge === "preowned" || product?.storedBadge === "preowned") collections.push("pre-owned");
  if (Number(product?.compareAt || product?.officialPrice || 0) > Number(product?.price || 0) && Number(product?.price || 0) > 0) {
    collections.push("sale");
  }
  if (product?.inStock || product?.availabilityStatus === "in_stock") collections.push("in-stock");
  if (product?.inStock === false || product?.availabilityStatus === "out_of_stock") collections.push("out-of-stock");
  if (Number(product?.sales || 0) > 0 || product?.badge === "best") collections.push("best-sellers");
  if (Number(product?.views || 0) > 0) collections.push("popular");
  return collections.filter((slug) => EXISTING_DYNAMIC_COLLECTION_SLUGS.includes(slug));
}

function normalizedExternalEvidence(input) {
  if (!input) return [];
  const entries = Array.isArray(input) ? input : [input];
  return entries
    .map((entry) =>
      evidence(
        entry.source_type || entry.sourceType || "internal",
        entry.source_url || entry.sourceUrl || "",
        Array.isArray(entry.facts) ? entry.facts : [entry.fact, entry.text, entry.snippet].filter(Boolean),
      ),
    )
    .filter((entry) => entry.facts.length);
}

function sourceTypeForUrl(url, brand = "") {
  const href = String(url || "");
  if (MANUAL_URL_RE.test(href)) return "manual";
  try {
    const parsed = new URL(href);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (host.includes("edio-iq.com")) return "internal";
    if (TRUSTED_RETAILER_HOSTS.has(host) || [...TRUSTED_RETAILER_HOSTS].some((trusted) => host.endsWith(`.${trusted}`))) {
      return "retailer";
    }
    const brandKey = keyifyClassification(brand).replace(/-/g, "");
    const hostKey = keyifyClassification(host).replace(/-/g, "");
    if (brandKey && hostKey.includes(brandKey)) return "official";
  } catch {
    return "community";
  }
  return "community";
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value) {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractJsonLdFacts(html) {
  const facts = [];
  const matches = String(html || "").matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of matches) {
    try {
      const parsed = JSON.parse(decodeEntities(match[1]).trim());
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes.flatMap((item) => (Array.isArray(item?.["@graph"]) ? item["@graph"] : [item]))) {
        if (!node || typeof node !== "object") continue;
        facts.push(node["@type"], node.name, node.category, node.description, node.brand?.name || node.brand);
      }
    } catch {
      // Ignore malformed JSON-LD. The page text still provides lower-weight evidence.
    }
  }
  return unique(facts);
}

export async function fetchUrlClassificationEvidence(url, product = {}, { fetcher = fetch, timeoutMs = 9000 } = {}) {
  const href = String(url || "").trim();
  if (!href || !/^https?:\/\//i.test(href)) return null;
  const sourceType = sourceTypeForUrl(href, product.brand);
  const response = await fetcher(href, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "User-Agent": "Mozilla/5.0 EDIO Classification Engine",
      Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.6",
    },
  });
  if (!response.ok) return null;
  const text = await response.text();
  const jsonLdFacts = extractJsonLdFacts(text);
  const title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  const description =
    text.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    text.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    "";
  const body = stripHtml(text).slice(0, 6000);
  const facts = unique([title, description, ...jsonLdFacts, body]).slice(0, 8);
  if (!facts.length) return null;
  return evidence(jsonLdFacts.length ? "structured_data" : sourceType, href, facts);
}

async function collectWebEvidence(product, options = {}) {
  if (!options.enrich_web && !options.enrichWeb) return [];
  const urls = unique([
    product?.sourceUrl,
    ...(Array.isArray(options.source_urls) ? options.source_urls : []),
    ...(Array.isArray(options.sourceUrls) ? options.sourceUrls : []),
    ...(options.source_urls_by_product?.[product?.id] || []),
    ...(options.sourceUrlsByProduct?.[product?.id] || []),
  ]);
  const results = [];
  for (const url of urls.slice(0, 3)) {
    try {
      const entry = await fetchUrlClassificationEvidence(url, product, options);
      if (entry) results.push(entry);
    } catch {
      results.push(evidence(sourceTypeForUrl(url, product?.brand), url, ["source fetch failed"]));
    }
  }
  return results;
}

function collectBaseEvidence(product, options = {}) {
  const sources = [];
  const facts = productFacts(product);
  sources.push(evidence("internal", "", facts));
  if (product?.sourceUrl) {
    sources.push(evidence(sourceTypeForUrl(product.sourceUrl, product.brand), product.sourceUrl, facts.slice(0, 8)));
  }
  sources.push(...normalizedExternalEvidence(product?.importEvidence));
  sources.push(...normalizedExternalEvidence(product?.categoryAssignment?.evidence));
  sources.push(...normalizedExternalEvidence(product?.importMeta?.pipeline?.evidence));
  sources.push(...normalizedExternalEvidence(product?.importMeta?.catalogClassification?.sources_used));
  sources.push(...normalizedExternalEvidence(options.source_snippets || options.sourceSnippets));
  const byProduct = options.source_snippets_by_product?.[product?.id] || options.sourceSnippetsByProduct?.[product?.id];
  sources.push(...normalizedExternalEvidence(byProduct));
  return sources.filter((source) => source.facts.length);
}

function modelFallbackEvidence(product, primary) {
  if (primary?.best?.score >= CLASSIFICATION_CONFIDENCE_THRESHOLD) return [];
  const title = [product?.brand, textFromLocalized(product?.name), product?.slug].filter(Boolean).join(" ");
  return [evidence("model", "", [`fallback inference from catalog text: ${title}`])];
}

export function classifyProductForCatalog(product, context = {}) {
  const allowedCategories = context.existingCategories || EXISTING_CATEGORY_SLUGS;
  const now = context.now ? new Date(context.now) : new Date();
  let sources = collectBaseEvidence(product, context);
  let primary = detectPrimary(product, sources, allowedCategories);
  sources = [...sources, ...modelFallbackEvidence(product, primary)];
  primary = detectPrimary(product, sources, allowedCategories);

  const selectedCategory = primary.best?.score >= 0.6 ? primary.best.key : "";
  const secondary = detectSecondary(product, selectedCategory, sources);
  const secondaryMissing = selectedCategory && needsSecondary(selectedCategory) && secondary.accepted.length === 0;
  const conflicts = [...(primary.conflict ? ["primary_category_conflict"] : []), ...secondary.conflicts];

  let confidence = primary.best?.score || 0;
  if (secondary.accepted.length) {
    const strongestSecondary = secondary.sorted[0]?.score || 0;
    confidence = Math.min(0.98, confidence * 0.74 + strongestSecondary * 0.26 + 0.04);
  }
  if (secondaryMissing) confidence -= 0.12;
  if (conflicts.length) confidence -= 0.18;
  if (!selectedCategory) confidence = 0.35;
  confidence = boundedScore(confidence);

  const needsReview =
    confidence < (context.confidenceThreshold || CLASSIFICATION_CONFIDENCE_THRESHOLD) ||
    !selectedCategory ||
    secondaryMissing ||
    conflicts.length > 0;

  const reasonParts = [];
  if (primary.best) reasonParts.push(`${primary.best.key}: ${primary.best.facts[0] || "best supported primary category"}`);
  if (secondary.accepted.length) reasonParts.push(`secondary: ${secondary.accepted.join(", ")}`);
  if (secondaryMissing) reasonParts.push("primary is clear but secondary category needs review");
  if (conflicts.length) reasonParts.push(`conflicts: ${conflicts.join(", ")}`);

  return {
    primary_category_slug: selectedCategory,
    secondary_category_slugs: secondary.accepted,
    dynamic_collection_slugs: dynamicCollectionsForProduct(product, now),
    confidence_score: confidence,
    needs_review: needsReview,
    classification_reason: reasonParts.join("; ") || "No reliable classification evidence found.",
    evidence: sources.map((source) => ({
      source_type: source.source_type,
      source_url: source.source_url,
      facts: source.facts,
    })),
  };
}

export async function classifyProductForCatalogAsync(product, context = {}) {
  const webEvidence = await collectWebEvidence(product, context);
  return classifyProductForCatalog(product, {
    ...context,
    source_snippets: [...normalizedExternalEvidence(context.source_snippets || context.sourceSnippets), ...webEvidence],
  });
}

export function normalizeCategoryAssignment(productId, result, now = new Date().toISOString()) {
  return {
    productId,
    primaryCategorySlug: result.primary_category_slug || "",
    secondaryCategorySlugs: Array.isArray(result.secondary_category_slugs) ? result.secondary_category_slugs : [],
    dynamicCollectionSlugs: Array.isArray(result.dynamic_collection_slugs) ? result.dynamic_collection_slugs : [],
    confidenceScore: Number.isFinite(Number(result.confidence_score)) ? Number(result.confidence_score) : 0,
    needsReview: Boolean(result.needs_review),
    classificationReason: result.classification_reason || "",
    evidence: Array.isArray(result.evidence) ? result.evidence : [],
    source: "classification_engine_v1",
    updatedAt: now,
  };
}

export function applyClassificationToProduct(product, result, now = new Date().toISOString()) {
  const assignment = normalizeCategoryAssignment(product.id, result, now);
  if (assignment.primaryCategorySlug) product.category = assignment.primaryCategorySlug;
  product.subCategories = assignment.secondaryCategorySlugs;
  product.categoryAssignment = assignment;
  product.needsReview = assignment.needsReview;
  product.confidenceScore = assignment.confidenceScore;
  product.updatedAt = now;
  return assignment;
}
