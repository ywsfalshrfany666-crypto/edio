import { createClient } from "@supabase/supabase-js";
import {
  getAuthCallbackUrl,
  getSiteUrl,
  isSupabaseConfigured,
  mapSupabaseUser,
  SUPABASE_ANON_KEY,
  SUPABASE_AUTH_AVAILABLE,
  SUPABASE_SESSION_TOKEN,
  SUPABASE_URL,
} from "./supabaseConfig";

export const supabase = SUPABASE_AUTH_AVAILABLE
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export {
  getAuthCallbackUrl,
  getSiteUrl,
  isSupabaseConfigured,
  mapSupabaseUser,
  SUPABASE_AUTH_AVAILABLE,
  SUPABASE_SESSION_TOKEN,
};
