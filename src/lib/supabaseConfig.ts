type SupabaseUserLike = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
  last_sign_in_at?: string | null;
};

type SupabaseSessionLike = {
  user?: {
    last_sign_in_at?: string | null;
  } | null;
} | null;

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
export const SUPABASE_AUTH_AVAILABLE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const SUPABASE_SESSION_TOKEN = "supabase-session";

if (import.meta.env.DEV && !SUPABASE_AUTH_AVAILABLE) {
  console.info("Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable Google Login.");
}

export function isSupabaseConfigured() {
  return SUPABASE_AUTH_AVAILABLE;
}

export function getSiteUrl() {
  const configured = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (typeof window !== "undefined") return window.location.origin;
  return "https://edio-iq.com";
}

export function getAuthCallbackUrl() {
  return `${getSiteUrl()}/auth/callback`;
}

export function mapSupabaseUser(user: SupabaseUserLike, session?: SupabaseSessionLike) {
  const metadata = user.user_metadata || {};
  const fullName =
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata.name === "string" && metadata.name.trim()) ||
    user.email?.split("@")[0] ||
    "edio customer";
  const avatarUrl =
    (typeof metadata.avatar_url === "string" && metadata.avatar_url) ||
    (typeof metadata.picture === "string" && metadata.picture) ||
    undefined;

  return {
    id: user.id,
    email: user.email || "",
    emailVerified: Boolean(user.email_confirmed_at),
    fullName,
    avatarUrl,
    role: "customer" as const,
    status: "active" as const,
    locale: "ar",
    currency: "IQD" as const,
    createdAt: user.created_at || new Date().toISOString(),
    updatedAt: user.updated_at || undefined,
    lastLoginAt: session?.user?.last_sign_in_at || user.last_sign_in_at || null,
  };
}
