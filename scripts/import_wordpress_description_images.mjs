import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyWordPressDescriptionImport,
  createWordPressDescriptionImportPlan,
  rollbackWordPressDescriptionImport,
} from "../server/wordpressDescriptionImport.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const DEFAULT_DB = path.join(repoRoot, "server/data/db.json");

const args = parseArgs(process.argv.slice(2));
const mode = args.apply ? "apply" : args.rollback ? "rollback" : "dry-run";
const dbPath = path.resolve(args.db || DEFAULT_DB);
const sourceFile = args.file
  ? path.resolve(args.file)
  : "/Users/yousif/Downloads/wc-product-export-3-5-2026-1777825471356.csv";

const db = JSON.parse(await readFile(dbPath, "utf8"));

if (mode === "rollback") {
  const report = rollbackWordPressDescriptionImport(db, args.rollback, { now: args.now });
  await writeFile(dbPath, JSON.stringify(db, null, 2));
  console.log(JSON.stringify({ mode, report }, null, 2));
  process.exit(0);
}

const csvText = await readFile(sourceFile, "utf8");
const options = {
  sourceFile,
  threshold: Number(args.threshold || 0.9),
  previewLimit: Number(args.previewLimit || 30),
  skipNetworkImageValidation: args.skipNetworkImageValidation === true,
  importJobId: args.importJobId,
  now: args.now,
};

if (mode === "dry-run") {
  const plan = await createWordPressDescriptionImportPlan(csvText, db, options);
  console.log(JSON.stringify({
    mode,
    sourceFile,
    summary: plan.summary,
    preview: plan.preview.map((item) => ({
      rowNumber: item.rowNumber,
      productName: item.productName,
      currentProductName: item.currentProductName,
      matchType: item.matchType,
      matchConfidence: item.matchConfidence,
      proposedAction: item.proposedAction,
      textBlockCount: item.textBlockCount,
      descriptionImageCount: item.descriptionImageCount,
      specImageCount: item.specImageCount,
      warnings: item.warnings,
      imageUrls: item.imageUrls,
    })),
  }, null, 2));
  process.exit(0);
}

const { plan, report } = await applyWordPressDescriptionImport(csvText, db, options);
await writeFile(dbPath, JSON.stringify(db, null, 2));
console.log(JSON.stringify({ mode, sourceFile, planSummary: plan.summary, report }, null, 2));

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const arg = values[index];
    if (arg === "--apply") result.apply = true;
    else if (arg === "--skip-network-image-validation") result.skipNetworkImageValidation = true;
    else if (arg === "--rollback") result.rollback = values[++index];
    else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      result[key] = values[++index];
    }
  }
  return result;
}
