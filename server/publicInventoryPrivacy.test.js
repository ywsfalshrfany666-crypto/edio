import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 19990;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let child;
let tempDir;

async function request(pathname, options = {}) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method: options.method || "GET",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await response.json().catch(() => null);
  return { response, json };
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

describe("public inventory privacy", () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "edio-public-stock-test-"));
    child = spawn(process.execPath, ["server/index.js"], {
      cwd: path.resolve(__dirname, ".."),
      env: {
        ...process.env,
        API_PORT: String(PORT),
        API_HOST: "127.0.0.1",
        EDIO_DB_FILE: path.join(tempDir, "db.json"),
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

  it("hides exact storefront stock above the low-stock threshold while preserving admin stock", async () => {
    const login = await request("/api/auth/login", {
      method: "POST",
      body: { email: "admin@edio.iq", password: "admin123" },
    });
    expect(login.response.status).toBe(200);
    const token = login.json.data.token;

    const created = await request("/api/admin/products", {
      method: "POST",
      token,
      body: {
        name: { en: `Public Stock Privacy ${Date.now()}` },
        brand: "EDIO",
        category: "headphones",
        price: 99000,
        image: "/src/assets/products/hifiman-ananda-planar-magnetic-1.webp",
        stock: 8,
        inStock: true,
        availabilityStatus: "in_stock",
        status: "published",
        confidenceScore: 0.96,
        categoryAssignment: {
          primary_category_slug: "headphones",
          secondary_category_slugs: ["closed-back"],
          dynamic_collection_slugs: [],
          confidence_score: 0.96,
          needs_review: false,
          classification_reason: "Verified storefront privacy test product.",
          evidence: [],
        },
      },
    });
    expect(created.response.status).toBe(201);
    const adminProduct = created.json.data;
    expect(typeof adminProduct.stock).toBe("number");
    expect(adminProduct.stock).toBe(8);

    const storefrontDetail = await request(`/api/products/${adminProduct.slug}`);
    expect(storefrontDetail.response.status).toBe(200);
    expect(storefrontDetail.json.data.stock).toBeUndefined();
    expect(storefrontDetail.json.data.sourcePayload).toBeUndefined();
    expect(storefrontDetail.json.data.importState).toBeUndefined();
    expect(storefrontDetail.json.data.needsReview).toBeUndefined();
    expect(storefrontDetail.json.data.publicStock).toMatchObject({
      availability: "in_stock",
      stock_display: "In stock",
      low_stock: false,
      low_stock_quantity: null,
    });

    const lowStock = await request(`/api/admin/products/${adminProduct.id}`, {
      method: "PATCH",
      token,
      body: { stock: 2, inStock: true, availabilityStatus: "in_stock" },
    });
    expect(lowStock.response.status).toBe(200);

    const lowStockDetail = await request(`/api/products/${adminProduct.slug}`);
    expect(lowStockDetail.response.status).toBe(200);
    expect(lowStockDetail.json.data.stock).toBeUndefined();
    expect(lowStockDetail.json.data.publicStock).toMatchObject({
      low_stock: true,
      low_stock_quantity: 2,
      stock_display: "Only 2 left",
    });
  });

  it("keeps review products out of public catalog responses", async () => {
    const login = await request("/api/auth/login", {
      method: "POST",
      body: { email: "admin@edio.iq", password: "admin123" },
    });
    expect(login.response.status).toBe(200);
    const token = login.json.data.token;

    const created = await request("/api/admin/products", {
      method: "POST",
      token,
      body: {
        name: { en: `Review Hidden ${Date.now()}` },
        brand: "EDIO",
        category: "headphones",
        price: 99000,
        image: "/src/assets/products/hifiman-ananda-planar-magnetic-1.webp",
        stock: 5,
        inStock: true,
        availabilityStatus: "in_stock",
        status: "published",
        needsReview: true,
      },
    });
    expect(created.response.status).toBe(201);

    const catalog = await request("/api/catalog");
    expect(catalog.response.status).toBe(200);
    const products = catalog.json.data.products;
    expect(products.some((product) => product.id === created.json.data.id)).toBe(false);
    expect(products.some((product) => Object.prototype.hasOwnProperty.call(product, "stock"))).toBe(false);
    expect(products.some((product) => Object.prototype.hasOwnProperty.call(product, "sourcePayload"))).toBe(false);
  });
});
