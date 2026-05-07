import { describe, expect, it } from "vitest";
import {
  buildOAuthAuthorizationUrl,
  consumeOAuthState,
  createOAuthState,
  getOAuthProviderConfig,
  getOAuthProviderStatus,
  normalizeProviderProfile,
  normalizeRedirectPath,
} from "./oauthAuth.js";

describe("oauth auth helpers", () => {
  it("reports missing providers without crashing", () => {
    const status = getOAuthProviderStatus({});
    expect(status.google.configured).toBe(false);
    expect(status.apple.configured).toBe(false);
  });

  it("builds Google provider config and authorization URL from env", () => {
    const config = getOAuthProviderConfig(
      "google",
      {
        GOOGLE_CLIENT_ID: "google-client",
        GOOGLE_CLIENT_SECRET: "google-secret",
      },
      "https://edio.example",
    );
    expect(config.redirectUri).toBe("https://edio.example/api/auth/oauth/google/callback");

    const state = createOAuthState({
      provider: "google",
      redirectTo: "/checkout",
      secret: "test-secret",
    });
    const url = new URL(buildOAuthAuthorizationUrl(config, state));
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe(state.state);
    expect(url.searchParams.get("nonce")).toBe(state.nonce);
  });

  it("validates state, provider, redirect path, and expiry", () => {
    const state = createOAuthState({
      provider: "apple",
      redirectTo: "https://evil.example/phish",
      secret: "test-secret",
      now: 1_000,
    });
    expect(state.redirectTo).toBe("/account");
    expect(
      consumeOAuthState({
        cookieValue: state.cookieValue,
        provider: "apple",
        state: state.state,
        secret: "test-secret",
        now: 2_000,
      }),
    ).toMatchObject({ provider: "apple", redirectTo: "/account" });
    expect(
      consumeOAuthState({
        cookieValue: state.cookieValue,
        provider: "google",
        state: state.state,
        secret: "test-secret",
        now: 2_000,
      }),
    ).toBeNull();
    expect(
      consumeOAuthState({
        cookieValue: state.cookieValue,
        provider: "apple",
        state: state.state,
        secret: "test-secret",
        now: 700_000,
      }),
    ).toBeNull();
  });

  it("blocks open redirects", () => {
    expect(normalizeRedirectPath("/checkout?step=auth")).toBe("/checkout?step=auth");
    expect(normalizeRedirectPath("//evil.example")).toBe("/account");
    expect(normalizeRedirectPath("https://evil.example")).toBe("/account");
    expect(normalizeRedirectPath("/api/auth/oauth/google/start")).toBe("/account");
  });

  it("normalizes verified provider profile without granting role", () => {
    const profile = normalizeProviderProfile("google", {
      sub: "google-user",
      email: "Customer@Example.com",
      email_verified: true,
      name: "EDIO Customer",
      picture: "https://example.com/avatar.png",
    });
    expect(profile).toMatchObject({
      provider: "google",
      providerAccountId: "google-user",
      email: "customer@example.com",
      emailVerified: true,
      fullName: "EDIO Customer",
    });
    expect(profile.role).toBeUndefined();
  });
});
