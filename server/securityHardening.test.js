import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 19989;
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
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.origin ? { Origin: options.origin } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await response.json().catch(() => null);
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

async function login(email, password) {
  const result = await request("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  return {
    ...result,
    cookie: result.response.headers.get("set-cookie")?.split(";")[0] || "",
    token: result.json?.data?.token || "",
  };
}

describe("security hardening", () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "edio-security-test-"));
    dbFile = path.join(tempDir, "db.json");
    child = spawn(process.execPath, ["server/index.js"], {
      cwd: path.resolve(__dirname, ".."),
      env: {
        ...process.env,
        API_PORT: String(PORT),
        API_HOST: "127.0.0.1",
        EDIO_DB_FILE: dbFile,
        PUBLIC_APP_URL: "http://127.0.0.1:8080",
        JWT_SECRET: "security-test-secret-with-more-than-32-characters",
      },
      stdio: "ignore",
    });
    await waitForApi();
  }, 45_000);

  afterAll(async () => {
    child?.kill();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it("sets defensive headers and does not reflect untrusted CORS origins", async () => {
    const trusted = await request("/api/health", { origin: "http://127.0.0.1:8080" });
    expect(trusted.response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(trusted.response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(trusted.response.headers.get("x-frame-options")).toBe("DENY");
    expect(trusted.response.headers.get("permissions-policy")).toContain("camera=()");
    expect(trusted.response.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:8080");

    const untrusted = await request("/api/health", { origin: "https://evil.example" });
    expect(untrusted.response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rejects unsafe cross-origin state changes", async () => {
    const result = await request("/api/auth/login", {
      method: "POST",
      origin: "https://evil.example",
      body: { email: "admin@edio.iq", password: "admin123" },
    });
    expect(result.response.status).toBe(403);
    expect(result.json.error.code).toBe("forbidden_origin");
  });

  it("protects admin APIs from unauthenticated and customer users", async () => {
    const anonymous = await request("/api/admin/dashboard");
    expect(anonymous.response.status).toBe(401);

    const customer = await login("customer@edio.iq", "customer123");
    expect(customer.response.status).toBe(200);

    const rejected = await request("/api/admin/dashboard", { cookie: customer.cookie });
    expect(rejected.response.status).toBe(403);
  });

  it("keeps hidden products out of storefront APIs while preserving admin visibility", async () => {
    const admin = await login("admin@edio.iq", "admin123");
    const created = await request("/api/admin/products", {
      method: "POST",
      cookie: admin.cookie,
      body: {
        name: { en: "Shadow Launch Headphone" },
        brand: "EDIO",
        category: "headphones",
        price: 75000,
        status: "hidden",
        availabilityStatus: "hidden",
        image: "/src/assets/products/shadow-launch.webp",
      },
    });
    expect(created.response.status).toBe(201);

    const storefrontList = await request("/api/products?q=Shadow%20Launch%20Headphone&limit=100");
    expect(storefrontList.response.status).toBe(200);
    expect(storefrontList.json.data.items).toHaveLength(0);

    const storefrontDetail = await request(`/api/products/${created.json.data.slug}`);
    expect(storefrontDetail.response.status).toBe(404);

    const adminList = await request("/api/admin/products?q=Shadow%20Launch%20Headphone&limit=100", { cookie: admin.cookie });
    expect(adminList.response.status).toBe(200);
    expect(adminList.json.data.items).toHaveLength(1);
  });

  it("exposes a protected production readiness report for launch checks", async () => {
    const anonymous = await request("/api/admin/production-readiness");
    expect(anonymous.response.status).toBe(401);

    const admin = await login("admin@edio.iq", "admin123");
    const report = await request("/api/admin/production-readiness", { cookie: admin.cookie });
    expect(report.response.status).toBe(200);
    expect(report.json.data).toMatchObject({
      summary: expect.objectContaining({
        products: expect.any(Number),
        variants: expect.any(Number),
        pendingOutbox: expect.any(Number),
      }),
      checks: expect.objectContaining({
        allProductsHaveBaseVariant: expect.any(Boolean),
        visibleProductsIndexed: expect.any(Boolean),
      }),
    });
    expect(report.json.data.score).toBeGreaterThanOrEqual(0);
    expect(report.json.data.score).toBeLessThanOrEqual(100);
  });

  it("blocks customer mass assignment fields", async () => {
    const customer = await login("customer@edio.iq", "customer123");
    const rejected = await request("/api/me/profile", {
      method: "PATCH",
      cookie: customer.cookie,
      body: { role: "admin", fullName: "Customer Admin" },
    });
    expect(rejected.response.status).toBe(400);
    expect(rejected.json.error.code).toBe("forbidden_field");

    const account = await request("/api/users/me", { cookie: customer.cookie });
    expect(account.json.data.user.role).toBe("customer");
  });

  it("prevents regular admins from granting roles", async () => {
    const admin = await login("admin@edio.iq", "admin123");
    const db = await readDb();
    const customer = db.users.find((user) => user.role === "customer");

    const rejected = await request(`/api/admin/users/${customer.id}`, {
      method: "PATCH",
      cookie: admin.cookie,
      body: { role: "admin" },
    });
    expect(rejected.response.status).toBe(403);
  });

  it("rejects SSRF targets in product and image import flows", async () => {
    const admin = await login("admin@edio.iq", "admin123");
    const localUrl = `${BASE_URL}/api/health`;

    const importResult = await request("/api/admin/products/import", {
      method: "POST",
      cookie: admin.cookie,
      body: { url: localUrl },
    });
    expect(importResult.response.status).toBe(400);
    expect(["blocked_url", "validation_error"]).toContain(importResult.json.error.code);

    const mediaResult = await request("/api/admin/products/media", {
      method: "POST",
      cookie: admin.cookie,
      body: { seed: "blocked", urls: [localUrl] },
    });
    expect(mediaResult.response.status).toBe(400);
  });

  it("rejects unsupported uploaded image types", async () => {
    const admin = await login("admin@edio.iq", "admin123");
    const svg = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>").toString("base64");
    const result = await request("/api/admin/products/media", {
      method: "POST",
      cookie: admin.cookie,
      body: {
        seed: "bad-upload",
        files: [{ name: "bad.svg", type: "image/svg+xml", data: svg }],
      },
    });
    expect(result.response.status).toBe(400);
  });

  it("rate limits repeated invalid login attempts", async () => {
    let last;
    for (let index = 0; index < 10; index += 1) {
      last = await request("/api/auth/login", {
        method: "POST",
        body: { email: "rate-limit@edio.test", password: `wrong-${index}` },
      });
    }
    expect(last.response.status).toBe(429);
    expect(last.json.error.code).toBe("rate_limited");
  });
});
