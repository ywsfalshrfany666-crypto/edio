import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const baseUrl = process.env.EDIO_AUDIT_BASE_URL || "http://127.0.0.1:8080";
const routes = [
  "/",
  "/shop",
  "/category/iems",
  "/product/fiio-k11-30633",
].map((route) => `${baseUrl}${route}`);

const outputDir = "lighthouse-reports";
if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

const lighthouseBin = process.platform === "win32" ? "lighthouse.cmd" : "lighthouse";
const runner = spawnSync(lighthouseBin, ["--version"], { stdio: "ignore" }).status === 0
  ? lighthouseBin
  : "npx";

const baseArgs = runner === "npx" ? ["--yes", "lighthouse"] : [];
const budgets = ["--only-categories=performance,accessibility,best-practices,seo"];
const chromeFlags = ["--chrome-flags=--headless=new --no-sandbox"];

for (const url of routes) {
  const slug = new URL(url).pathname.replace(/^\/$/, "home").replace(/[^\w-]+/g, "-");
  const outputPath = join(outputDir, `${slug}.html`);
  const args = [
    ...baseArgs,
    url,
    ...budgets,
    ...chromeFlags,
    "--quiet",
    "--output=html",
    `--output-path=${outputPath}`,
  ];

  const result = spawnSync(runner, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
