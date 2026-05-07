import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ApiError, AUTH_API_AVAILABLE, COOKIE_SESSION_TOKEN, type ApiUser, apiRequest } from "@/lib/api";
import {
  getAuthCallbackUrl,
  mapSupabaseUser,
  SUPABASE_AUTH_AVAILABLE,
  SUPABASE_SESSION_TOKEN,
} from "@/lib/supabaseConfig";
import { normalizeRedirectPath } from "@/lib/socialAuth";

export type Role = "admin" | "customer" | "super_admin";

export type User = ApiUser & { role: Role };

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  passwordResetEmail: string | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithGoogle: (redirectTo?: string) => Promise<{ error?: string }>;
  signUp: (data: { email: string; password: string; fullName?: string; acceptTerms?: boolean }) => Promise<{
    error?: string;
    emailConfirmationRequired?: boolean;
  }>;
  resendEmailVerification: (email: string) => Promise<{ error?: string }>;
  signOut: () => void;
  updateProfile: (patch: Partial<User> & { password?: string }) => Promise<{ error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ error?: string }>;
  resetPassword: (newPassword: string, token?: string | null) => Promise<{ error?: string }>;
  refreshSession: () => Promise<void>;
};

async function getSupabaseClient() {
  if (!SUPABASE_AUTH_AVAILABLE) return null;
  const { supabase } = await import("@/lib/supabase");
  return supabase;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      loading: false,
      passwordResetEmail: null,

      async signIn(email, password) {
        const supabase = await getSupabaseClient();
        if (supabase) {
          try {
            set({ loading: true });
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error || !data.session?.user) {
              set({ loading: false });
              return { error: "تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور." };
            }
            if (!data.session.user.email_confirmed_at) {
              await supabase.auth.signOut().catch(() => undefined);
              set({ user: null, token: null, loading: false });
              return { error: "فعّل بريدك الإلكتروني أولاً. أرسلنا لك رابط تحقق عند إنشاء الحساب." };
            }
            set({ user: mapSupabaseUser(data.session.user, data.session), token: SUPABASE_SESSION_TOKEN, loading: false });
            return {};
          } catch {
            set({ loading: false });
            return { error: "تعذر تسجيل الدخول حالياً. حاول مرة أخرى." };
          }
        }
        if (!AUTH_API_AVAILABLE) {
          return { error: "الحسابات غير مفعلة حالياً. يمكنك متابعة التسوق أو التواصل معنا لإتمام الطلب." };
        }
        try {
          set({ loading: true });
          const data = await apiRequest<{ user: User; token?: string }>("/api/auth/login", {
            method: "POST",
            body: { email, password },
          });
          set({ user: data.user, token: data.token || COOKIE_SESSION_TOKEN, loading: false });
          return {};
        } catch (error) {
          set({ loading: false });
          return {
            error:
              error instanceof ApiError
                ? error.message
                : "Unable to reach the EDIO API. Make sure the local API server is running.",
          };
        }
      },

      async signInWithGoogle(redirectTo = "/account") {
        const supabase = await getSupabaseClient();
        if (!supabase) {
          return { error: "Google Login غير مفعّل بعد. تأكد من إعداد Supabase variables." };
        }
        try {
          set({ loading: true });
          const safeRedirect = normalizeRedirectPath(redirectTo);
          const callbackUrl = new URL(getAuthCallbackUrl());
          callbackUrl.searchParams.set("redirectTo", safeRedirect);
          const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: callbackUrl.toString(),
              queryParams: {
                access_type: "offline",
                prompt: "select_account",
              },
            },
          });
          if (error) {
            set({ loading: false });
            return { error: "تعذر بدء تسجيل الدخول عبر Google. حاول مرة أخرى." };
          }
          return {};
        } catch {
          set({ loading: false });
          return { error: "تعذر بدء تسجيل الدخول عبر Google. حاول مرة أخرى." };
        }
      },

      async signUp({ email, password, fullName, acceptTerms }) {
        const supabase = await getSupabaseClient();
        if (supabase) {
          try {
            set({ loading: true });
            const { data, error } = await supabase.auth.signUp({
              email,
              password,
              options: {
                data: {
                  full_name: fullName,
                  role: "customer",
                },
                emailRedirectTo: getAuthCallbackUrl(),
              },
            });
            if (error) {
              set({ loading: false });
              return { error: "تعذر إنشاء الحساب. تحقق من البريد وكلمة المرور." };
            }
            if (data.session?.user?.email_confirmed_at) {
              set({ user: mapSupabaseUser(data.session.user, data.session), token: SUPABASE_SESSION_TOKEN, loading: false });
              return {};
            }
            if (data.session) await supabase.auth.signOut().catch(() => undefined);
            set({ user: null, token: null, loading: false });
            return { emailConfirmationRequired: true };
          } catch {
            set({ loading: false });
            return { error: "تعذر إنشاء الحساب حالياً. حاول مرة أخرى." };
          }
        }
        if (!AUTH_API_AVAILABLE) {
          return { error: "إنشاء الحسابات غير مفعل حالياً. يمكنك متابعة التسوق أو التواصل معنا لإتمام الطلب." };
        }
        try {
          set({ loading: true });
          const data = await apiRequest<{ user?: User; token?: string }>("/api/auth/signup", {
            method: "POST",
            body: { email, password, fullName, acceptTerms },
          });
          if (!data.user) {
            set({ loading: false });
            return {};
          }
          set({ user: data.user, token: data.token || COOKIE_SESSION_TOKEN, loading: false });
          return {};
        } catch (error) {
          set({ loading: false });
          return { error: error instanceof ApiError ? error.message : "Unable to create account." };
        }
      },

      async resendEmailVerification(email) {
        const supabase = await getSupabaseClient();
        if (!supabase) return { error: "تأكيد البريد غير مفعّل حالياً." };
        try {
          set({ loading: true });
          const { error } = await supabase.auth.resend({
            type: "signup",
            email,
            options: {
              emailRedirectTo: getAuthCallbackUrl(),
            },
          });
          set({ loading: false });
          if (error) return { error: "تعذر إعادة إرسال رسالة التحقق حالياً. حاول لاحقاً." };
          return {};
        } catch {
          set({ loading: false });
          return { error: "تعذر إعادة إرسال رسالة التحقق حالياً. حاول لاحقاً." };
        }
      },

      signOut() {
        if (SUPABASE_AUTH_AVAILABLE) {
          void getSupabaseClient().then((client) => client?.auth.signOut()).catch(() => undefined);
          set({ user: null, token: null, passwordResetEmail: null });
          return;
        }
        if (!AUTH_API_AVAILABLE) {
          set({ user: null, token: null, passwordResetEmail: null });
          return;
        }
        void apiRequest<{ message: string }>("/api/auth/logout", {
          method: "POST",
          token: get().token,
        }).catch(() => undefined);
        set({ user: null, token: null, passwordResetEmail: null });
      },

      async updateProfile(patch) {
        const supabase = await getSupabaseClient();
        if (supabase) {
          try {
            const { data, error } = await supabase.auth.updateUser({
              data: {
                full_name: patch.fullName,
                avatar_url: patch.avatarUrl,
              },
            });
            if (error) return { error: "تعذر تحديث الحساب حالياً." };
            if (data.user) set({ user: mapSupabaseUser(data.user), token: SUPABASE_SESSION_TOKEN });
            return {};
          } catch {
            return { error: "تعذر تحديث الحساب حالياً." };
          }
        }
        if (!AUTH_API_AVAILABLE) {
          return { error: "إدارة الحساب غير مفعلة حالياً." };
        }
        const token = get().token || COOKIE_SESSION_TOKEN;
        try {
          const user = await apiRequest<User>("/api/auth/me", {
            method: "PATCH",
            token,
            body: patch,
          });
          set({ user });
          return {};
        } catch (error) {
          return { error: error instanceof ApiError ? error.message : "Unable to update profile." };
        }
      },

      async requestPasswordReset(email) {
        const supabase = await getSupabaseClient();
        if (supabase) {
          try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: `${getAuthCallbackUrl()}?redirectTo=/reset-password`,
            });
            if (error) return { error: "تعذر إرسال رابط الاستعادة حالياً." };
            set({ passwordResetEmail: email });
            return {};
          } catch {
            return { error: "تعذر إرسال رابط الاستعادة حالياً." };
          }
        }
        if (!AUTH_API_AVAILABLE) {
          return { error: "استعادة كلمة المرور غير مفعلة حالياً." };
        }
        try {
          await apiRequest<{ message: string }>("/api/auth/password-reset", {
            method: "POST",
            body: { email },
          });
          set({ passwordResetEmail: email });
          return {};
        } catch (error) {
          return { error: error instanceof ApiError ? error.message : "Unable to send reset link." };
        }
      },

      async resetPassword(newPassword, token) {
        const supabase = await getSupabaseClient();
        if (supabase) {
          try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) return { error: "تعذر تحديث كلمة المرور. افتح رابط الاستعادة مرة أخرى." };
            set({ passwordResetEmail: null });
            return {};
          } catch {
            return { error: "تعذر تحديث كلمة المرور حالياً." };
          }
        }
        if (!AUTH_API_AVAILABLE) {
          return { error: "تغيير كلمة المرور غير مفعل حالياً." };
        }
        const email = get().passwordResetEmail || get().user?.email;
        if (!token && !email) return { error: "Reset link is missing. Start the reset flow again." };
        try {
          await apiRequest<{ message: string }>("/api/auth/reset-password", {
            method: "POST",
            body: token ? { token, password: newPassword } : { email, password: newPassword },
          });
          set({ passwordResetEmail: null });
          return {};
        } catch (error) {
          return { error: error instanceof ApiError ? error.message : "Unable to reset password." };
        }
      },

      async refreshSession() {
        const supabase = await getSupabaseClient();
        if (supabase) {
          try {
            const { data, error } = await supabase.auth.getSession();
            if (error || !data.session?.user) {
              set({ user: null, token: null, loading: false });
              return;
            }
            set({ user: mapSupabaseUser(data.session.user, data.session), token: SUPABASE_SESSION_TOKEN, loading: false });
          } catch {
            set({ user: null, token: null, loading: false });
          }
          return;
        }
        if (!AUTH_API_AVAILABLE) {
          set({ user: null, token: null });
          return;
        }
        try {
          const token = get().token || COOKIE_SESSION_TOKEN;
          const user = await apiRequest<User>("/api/auth/me", { token });
          set({ user, token });
        } catch {
          set({ user: null, token: null });
        }
      },
    }),
    {
      name: "edio-auth",
      merge: (persisted, current) => {
        if ((!AUTH_API_AVAILABLE && !SUPABASE_AUTH_AVAILABLE) || !persisted || typeof persisted !== "object") {
          return current;
        }
        return { ...current, ...persisted };
      },
      partialize: (state) => ({
        user: AUTH_API_AVAILABLE || SUPABASE_AUTH_AVAILABLE ? state.user : null,
        token: AUTH_API_AVAILABLE || SUPABASE_AUTH_AVAILABLE ? state.token : null,
        passwordResetEmail: AUTH_API_AVAILABLE || SUPABASE_AUTH_AVAILABLE ? state.passwordResetEmail : null,
      }),
    },
  ),
);
