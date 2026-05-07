import { apiRequest } from "@/lib/api";

export type SocialProviderId = "google" | "apple";

export type SocialProviderStatus = {
  id: SocialProviderId;
  label: string;
  configured: boolean;
};

export async function getSocialProviderStatus() {
  return apiRequest<Record<SocialProviderId, SocialProviderStatus>>("/api/auth/oauth/providers");
}

export function buildSocialLoginUrl(provider: SocialProviderId, redirectTo = "/account") {
  const safeRedirect = normalizeRedirectPath(redirectTo);
  const params = new URLSearchParams({ redirectTo: safeRedirect });
  return `/api/auth/oauth/${provider}/start?${params.toString()}`;
}

export function normalizeRedirectPath(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("\n")) {
    return "/account";
  }
  try {
    const parsed = new URL(raw, window.location.origin);
    if (parsed.origin !== window.location.origin) return "/account";
    if (parsed.pathname.startsWith("/api/") || parsed.pathname.startsWith("/auth/")) return "/account";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/account";
  }
}
