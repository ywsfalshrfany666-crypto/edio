#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyCatalogReclassificationPlan,
  buildCatalogReclassificationPlan,
  buildReclassificationCsv,
  buildReclassificationMarkdown,
} from "../server/catalogReclassifier.js";

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename), "..");
const DB_FILE = process.env.EDIO_DB_FILE || path.join(ROOT_DIR, "server/data/db.json");
const DEFAULT_REPORT_DIR = path.join(ROOT_DIR, "server/data/reclassification-reports");

function parseArgs(argv) {
  const getValue = (name, fallback = "") => {
    const match = argv.find((arg) => arg.startsWith(`${name}=`));
    return match ? match.slice(name.length + 1) : fallback;
  };

  const productIds = argv
    .filter((arg) => arg.startsWith("--id="))
    .map((arg) => arg.slice("--id=".length))
    .filter(Boolean);

  return {
    commit: argv.includes("--commit") || argv.includes("--apply"),
    force: argv.includes("--force"),
    onlyReview: argv.includes("--needs-review"),
    enrichWeb: argv.includes("--enrich-web"),
    productIds,
    confidenceThreshold: Number(getValue("--confidence", "0.75")),
    outDir: path.resolve(ROOT_DIR, getValue("--out-dir", DEFAULT_REPORT_DIR)),
  };
}

const options = parseArgs(process.argv.slice(2));
const db = JSON.parse(await readFile(DB_FILE, "utf8"));
const plan = await buildCatalogReclassificationPlan(db, options);

if (options.commit) {
  applyCatalogReclassificationPlan(db, plan, options);
  await writeFile(DB_FILE, `${JSON.stringify(db, null, 2)}\n`);
}

await mkdir(options.outDir, { recursive: true });
const timestamp = plan.generated_at.replace(/[^0-9]/g, "").slice(0, 14);
const mode = options.commit ? "commit" : "dry-run";
const csvPath = path.join(options.outDir, `edio-reclassification-${mode}-${timestamp}.csv`);
const mdPath = path.join(options.outDir, `edio-reclassification-${mode}-${timestamp}.md`);

await writeFile(csvPath, buildReclassificationCsv(plan));
await writeFile(mdPath, buildReclassificationMarkdown(plan));

console.log(
  JSON.stringify(
    {
      mode,
      database: DB_FILE,
      csv: csvPath,
      markdown: mdPath,
      ...plan.summary,
    },
    null,
    2,
  ),
);
