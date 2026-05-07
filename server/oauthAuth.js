import crypto from "node:crypto";

export const OAUTH_PROVIDERS = {
  google: {
    id: "google",
    label: "Google",
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    issuer: "https://accounts.google.com",
    jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
    scope: "openid email profile",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    redirectUriEnv: "GOOGLE_REDIRECT_URI",
    alg: "RS256",
  },
  apple: {
    id: "apple",
    label: "Apple",
    authorizationEndpoint: "https://appleid.apple.com/auth/authorize",
    tokenEndpoint: "https://appleid.apple.com/auth/token",
    issuer: "https://appleid.apple.com",
    jwksUri: "https://appleid.apple.com/auth/keys",
    scope: "openid email name",
    clientIdEnv: "APPLE_CLIENT_ID",
    clientSecretEnv: "APPLE_CLIENT_SECRET",
    redirectUriEnv: "APPLE_REDIRECT_URI",
    alg: "RS256",
  },
};

const DEFAULT_REDIRECT_PATH = "/account";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const jwksCache = new Map();

export function getOAuthProviderStatus(env = process.env) {
  return Object.fromEntries(
    Object.entries(OAUTH_PROVIDERS).map(([id, provider]) => [
      id,
      {
        id,
        label: provider.label,
        configured: Boolean(getOAuthProviderConfig(id, env, "https://edio-iq.com")),
      },
    ]),
  );
}

export function getOAuthProviderConfig(providerId, env = process.env, publicBaseUrl = "") {
  const provider = OAUTH_PROVIDERS[providerId];
  if (!provider) return null;
  const clientId = readEnv(env, provider.clientIdEnv);
  const clientSecret = getProviderClientSecret(providerId, env);
  if (!clientId || !clientSecret) return null;
  const redirectUri = readEnv(env, provider.redirectUriEnv) || `${publicBaseUrl.replace(/\/$/, "")}/api/auth/oauth/${providerId}/callback`;
  return {
    ...provider,
    clientId,
    clientSecret,
    redirectUri,
  };
}

export function normalizeRedirectPath(value, fallback = DEFAULT_REDIRECT_PATH) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("\n") || raw.includes("\r")) {
    return fallback;
  }
  try {
    const parsed = new URL(raw, "https://edio.local");
    if (parsed.origin !== "https://edio.local") return fallback;
    if (parsed.pathname.startsWith("/api/") || parsed.pathname.startsWith("/auth/")) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function createOAuthState({ provider, redirectTo, secret, now = Date.now() }) {
  const payload = {
    provider,
    redirectTo: normalizeRedirectPath(redirectTo),
    state: randomUrlToken(32),
    nonce: randomUrlToken(32),
    createdAt: now,
  };
  return {
    ...payload,
    cookieValue: signStatePayload(payload, secret),
  };
}

export function consumeOAuthState({ cookieValue, provider, state, secret, now = Date.now() }) {
  const payload = verifyStatePayload(cookieValue, secret);
  if (!payload) return null;
  if (payload.provider !== provider || payload.state !== state) return null;
  if (!payload.createdAt || now - Number(payload.createdAt) > OAUTH_STATE_TTL_MS) return null;
  return payload;
}

export function buildOAuthAuthorizationUrl(config, statePayload) {
  const url = new URL(config.authorizationEndpoint);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", statePayload.state);
  url.searchParams.set("nonce", statePayload.nonce);
  if (config.id === "google") {
    url.searchParams.set("prompt", "select_account");
  }
  if (config.id === "apple") {
    url.searchParams.set("response_mode", "form_post");
  }
  return url.toString();
}

export async function exchangeOAuthCode(config, code) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
  });
  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.id_token) {
    const error = new Error("OAuth token exchange failed");
    error.code = "provider_error";
    error.providerError = json?.error || response.statusText;
    throw error;
  }
  return json;
}

export async function verifyOAuthIdToken(idToken, config, expectedNonce) {
  const { header, payload, signingInput, signature } = decodeJwt(idToken);
  if (header.alg !== config.alg) throw new Error("Unexpected provider token algorithm");
  if (payload.iss !== config.issuer) throw new Error("Unexpected provider issuer");
  if (!isExpectedAudience(payload.aud, config.clientId)) throw new Error("Unexpected provider audience");
  if (payload.exp && Number(payload.exp) < Math.floor(Date.now() / 1000)) throw new Error("Provider token expired");
  if (expectedNonce && payload.nonce !== expectedNonce) throw new Error("Invalid provider nonce");
  const jwk = await getJwk(config.jwksUri, header.kid);
  if (!jwk) throw new Error("Provider signing key not found");
  const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const verifier = crypto.createVerify(config.alg === "ES256" ? "SHA256" : "RSA-SHA256");
  verifier.update(signingInput);
  verifier.end();
  const valid = verifier.verify(key, signature);
  if (!valid) throw new Error("Provider token signature invalid");
  return payload;
}

export function buildAppleClientSecret(env = process.env, now = Math.floor(Date.now() / 1000)) {
  const existing = readEnv(env, "APPLE_CLIENT_SECRET");
  if (existing) return existing;
  const clientId = readEnv(env, "APPLE_CLIENT_ID");
  const teamId = readEnv(env, "APPLE_TEAM_ID");
  const keyId = readEnv(env, "APPLE_KEY_ID");
  const privateKey = normalizeApplePrivateKey(readEnv(env, "APPLE_PRIVATE_KEY"));
  if (!clientId || !teamId || !keyId || !privateKey) return "";
  const header = base64urlJson({ alg: "ES256", kid: keyId, typ: "JWT" });
  const payload = base64urlJson({
    iss: teamId,
    iat: now,
    exp: now + 60 * 60 * 24 * 180,
    aud: "https://appleid.apple.com",
    sub: clientId,
  });
  const signer = crypto.createSign("SHA256");
  signer.update(`${header}.${payload}`);
  signer.end();
  const signature = signer.sign({ key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

export function normalizeProviderProfile(provider, claims, userPayload = null) {
  const appleUser = parseAppleUser(userPayload);
  const email = normalizeEmail(claims.email || appleUser?.email || "");
  const emailVerified = claims.email_verified === true || claims.email_verified === "true";
  const fullName =
    sanitizeProfileText(claims.name) ||
    sanitizeProfileText([appleUser?.name?.firstName, appleUser?.name?.lastName].filter(Boolean).join(" ")) ||
    (email ? email.split("@")[0] : `${OAUTH_PROVIDERS[provider]?.label || "Social"} customer`);
  return {
    provider,
    providerAccountId: String(claims.sub || ""),
    email,
    emailVerified,
    fullName,
    avatarUrl: sanitizeUrl(claims.picture || ""),
  };
}

function getProviderClientSecret(providerId, env) {
  if (providerId === "apple") {
    try {
      return buildAppleClientSecret(env);
    } catch {
      return "";
    }
  }
  return readEnv(env, OAUTH_PROVIDERS[providerId]?.clientSecretEnv);
}

function readEnv(env, key) {
  return String(env?.[key] || "").trim();
}

function normalizeApplePrivateKey(value) {
  if (!value) return "";
  return value.replace(/\\n/g, "\n");
}

function randomUrlToken(bytes) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function signStatePayload(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyStatePayload(cookieValue, secret) {
  const [encoded, signature] = String(cookieValue || "").split(".");
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  if (!timingSafeEqualText(signature, expected)) return null;
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function timingSafeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function decodeJwt(jwt) {
  const [encodedHeader, encodedPayload, encodedSignature] = String(jwt || "").split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw new Error("Invalid provider token");
  return {
    header: JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8")),
    payload: JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")),
    signingInput: `${encodedHeader}.${encodedPayload}`,
    signature: Buffer.from(encodedSignature, "base64url"),
  };
}

function isExpectedAudience(audience, clientId) {
  return Array.isArray(audience) ? audience.includes(clientId) : audience === clientId;
}

async function getJwk(jwksUri, kid) {
  const cached = jwksCache.get(jwksUri);
  if (cached && cached.expiresAt > Date.now()) return cached.keys.find((key) => key.kid === kid);
  const response = await fetch(jwksUri);
  if (!response.ok) throw new Error("Unable to fetch provider signing keys");
  const json = await response.json();
  const keys = Array.isArray(json.keys) ? json.keys : [];
  jwksCache.set(jwksUri, { keys, expiresAt: Date.now() + 60 * 60 * 1000 });
  return keys.find((key) => key.kid === kid);
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function parseAppleUser(value) {
  if (!value) return null;
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function sanitizeProfileText(value) {
  return String(value || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 120);
}

function sanitizeUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    return ["http:", "https:"].includes(url.protocol) ? url.toString().slice(0, 500) : "";
  } catch {
    return "";
  }
}
