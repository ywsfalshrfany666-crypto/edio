import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const htaccessPath = path.join(rootDir, "public", ".htaccess");

const requiredHeaders = [
  "Content-Security-Policy",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "X-Frame-Options",
  "Strict-Transport-Security",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

const htaccess = await readFile(htaccessPath, "utf8");
for (const header of requiredHeaders) {
  if (!htaccess.includes(header)) fail(`Missing ${header} in public/.htaccess`);
}

if (process.env.EDIO_SECURITY_HEADERS_URL) {
  const response = await fetch(process.env.EDIO_SECURITY_HEADERS_URL);
  for (const header of requiredHeaders.filter((item) => item !== "Strict-Transport-Security")) {
    if (!response.headers.get(header)) fail(`Missing ${header} from ${process.env.EDIO_SECURITY_HEADERS_URL}`);
  }
}

if (!process.exitCode) {
  console.log("Security headers check passed.");
}
