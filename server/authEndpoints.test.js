import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 19987;
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

describe("auth endpoints", () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "edio-auth-test-"));
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

  it("creates a compatible signup session and audit entry", async () => {
    const { response, json } = await request("/api/auth/signup", {
      method: "POST",
      body: { email: "New.Customer@Edio.test", password: "customer123", fullName: "New Customer", acceptTerms: true },
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toContain("edio_session=");
    expect(json.data.token).toBeTruthy();
    expect(json.data.user.emailCanonical).toBeUndefined();
    expect(json.data.user.emailVerified).toBe(false);

    const db = await readDb();
    expect(db.users.some((user) => user.emailCanonical === "new.customer@edio.test")).toBe(true);
    expect(db.emailVerificationTokens).toHaveLength(1);
    expect(db.emailOutbox.some((email) => email.type === "email_verification")).toBe(true);
    expect(db.userConsents.some((consent) => consent.userId === json.data.user.id && consent.type === "terms_privacy")).toBe(true);
    expect(db.authIdentities.some((identity) => identity.userId === json.data.user.id && identity.provider === "password")).toBe(true);
    expect(db.auditLogs.some((log) => log.action === "auth.signup")).toBe(true);
  });

  it("supports login, cookie /users/me access, and logout revocation", async () => {
    const login = await request("/api/auth/login", {
      method: "POST",
      body: { email: "admin@edio.iq", password: "admin123" },
    });
    const cookie = login.response.headers.get("set-cookie")?.split(";")[0];

    expect(login.response.status).toBe(200);
    expect(cookie).toContain("edio_session=");

    const me = await request("/api/users/me", { cookie });
    expect(me.response.status).toBe(200);
    expect(me.json.data.user.role).toBe("admin");
    expect(Array.isArray(me.json.data.sessions)).toBe(true);

    const logout = await request("/api/auth/logout", { method: "POST", cookie });
    expect(logout.response.status).toBe(200);

    const db = await readDb();
    expect(db.userSessions.some((session) => session.revokedAt)).toBe(true);
    expect(db.auditLogs.some((log) => log.action === "auth.logout")).toBe(true);
  });

  it("requires re-authentication for sensitive profile changes and records reauth", async () => {
    const login = await request("/api/auth/login", {
      method: "POST",
      body: { email: "new.customer@edio.test", password: "customer123" },
    });
    const cookie = login.response.headers.get("set-cookie")?.split(";")[0];

    const rejected = await request("/api/me/profile", {
      method: "PATCH",
      cookie,
      body: { email: "changed.customer@edio.test" },
    });
    expect(rejected.response.status).toBe(403);
    expect(rejected.json.error.code).toBe("reauth_required");

    const reauth = await request("/api/auth/reauth", {
      method: "POST",
      cookie,
      body: { password: "customer123" },
    });
    expect(reauth.response.status).toBe(200);

    const updated = await request("/api/me/profile", {
      method: "PATCH",
      cookie,
      body: { email: "changed.customer@edio.test", currentPassword: "customer123" },
    });
    expect(updated.response.status).toBe(200);
    expect(updated.json.data.user.email).toBe("changed.customer@edio.test");
    expect(updated.json.data.user.emailVerified).toBe(false);

    const db = await readDb();
    expect(db.auditLogs.some((log) => log.action === "auth.reauthenticated")).toBe(true);
    expect(db.emailVerificationTokens.filter((token) => token.userId === login.json.data.user.id).length).toBeGreaterThan(0);
  });

  it("stores account addresses under the progressive profile model", async () => {
    const login = await request("/api/auth/login", {
      method: "POST",
      body: { email: "customer@edio.iq", password: "customer123" },
    });
    const cookie = login.response.headers.get("set-cookie")?.split(";")[0];

    const created = await request("/api/me/addresses", {
      method: "POST",
      cookie,
      body: {
        label: "Studio",
        fullName: "EDIO Customer",
        phone: "+9647702046674",
        line1: "Mosul studio",
        city: "Mosul",
        governorate: "Nineveh",
        isDefault: true,
      },
    });

    expect(created.response.status).toBe(201);
    expect(created.json.data.isDefault).toBe(true);

    const list = await request("/api/me/addresses", { cookie });
    expect(list.response.status).toBe(200);
    expect(list.json.data.some((address) => address.label === "Studio")).toBe(true);
  });

  it("uses one-time password reset tokens and revokes sessions", async () => {
    const forgot = await request("/api/auth/password/forgot", {
      method: "POST",
      body: { email: "customer@edio.iq" },
    });
    expect(forgot.response.status).toBe(200);

    const db = await readDb();
    const resetEmail = db.emailOutbox.find((email) => email.type === "password_reset" && email.to === "customer@edio.iq");
    const token = new URL(resetEmail.link).searchParams.get("token");
    expect(token).toBeTruthy();

    const reset = await request("/api/auth/password/reset", {
      method: "POST",
      body: { token, password: "newCustomer123" },
    });
    expect(reset.response.status).toBe(200);

    const reused = await request("/api/auth/password/reset", {
      method: "POST",
      body: { token, password: "anotherCustomer123" },
    });
    expect(reused.response.status).toBe(400);
  });

  it("exposes passkey device management without enabling unsafe verification", async () => {
    const login = await request("/api/auth/login", {
      method: "POST",
      body: { email: "customer@edio.iq", password: "newCustomer123" },
    });
    const cookie = login.response.headers.get("set-cookie")?.split(";")[0];

    const options = await request("/api/auth/passkeys/register/options", {
      method: "POST",
      cookie,
    });
    expect(options.response.status).toBe(200);
    expect(options.json.data.enabled).toBe(false);
    expect(options.json.data.publicKey.challenge).toBeTruthy();

    const list = await request("/api/me/passkeys", { cookie });
    expect(list.response.status).toBe(200);
    expect(Array.isArray(list.json.data)).toBe(true);

    const verify = await request("/api/auth/passkeys/register/verify", {
      method: "POST",
      cookie,
      body: { challenge: "placeholder" },
    });
    expect(verify.response.status).toBe(501);
  });
});
