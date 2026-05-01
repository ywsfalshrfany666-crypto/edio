import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 19988;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let child;
let tempDir;
let dbFile;

async function request(pathname, options = {}) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method: options.method || "GET",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await response.json();
  return { response, json };
}

async function readDb() {
  return JSON.parse(await readFile(dbFile, "utf8"));
}

async function waitForApi() {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const { response } = await request("/api/health");
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError || new Error("API did not start");
}

describe("admin product duplicate", () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "edio-duplicate-test-"));
    dbFile = path.join(tempDir, "db.json");
    child = spawn(process.execPath, ["server/index.js"], {
      cwd: path.resolve(__dirname, ".."),
      env: {
        ...process.env,
        API_PORT: String(PORT),
        API_HOST: "127.0.0.1",
        EDIO_DB_FILE: dbFile,
        PUBLIC_APP_URL: "http://127.0.0.1:8080",
      },
      stdio: "ignore",
    });
    await waitForApi();
  }, 45_000);

  afterAll(async () => {
    child?.kill();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it("clones a product without turning it into pre-owned by default", async () => {
    const login = await request("/api/auth/login", {
      method: "POST",
      body: { email: "admin@edio.iq", password: "admin123" },
    });
    expect(login.response.status).toBe(200);
    const token = login.json.data.token;

    const dbBefore = await readDb();
    const source =
      dbBefore.products.find((product) => product.badge !== "preowned" && product.storedBadge !== "preowned") ||
      dbBefore.products[0];

    const duplicated = await request(`/api/admin/products/${source.id}/duplicate`, {
      method: "POST",
      token,
      body: {},
    });

    expect(duplicated.response.status).toBe(201);
    expect(duplicated.json.data.id).not.toBe(source.id);
    expect(duplicated.json.data.badge).not.toBe("preowned");
    expect(duplicated.json.data.stock).toBe(source.stock);
    expect(duplicated.json.data.inStock).toBe(source.inStock);
    expect(duplicated.json.data.availabilityStatus).toBe(source.availabilityStatus);
    expect(duplicated.json.data.category).toBe(source.category);
    expect(duplicated.json.data.gallery).toEqual(source.gallery);
    expect(duplicated.json.data.slug).toContain("copy");

    const dbAfter = await readDb();
    const clone = dbAfter.products.find((product) => product.id === duplicated.json.data.id);
    expect(clone.storedBadge ?? clone.badge ?? null).toBe(source.storedBadge ?? source.badge ?? null);
  });
});
