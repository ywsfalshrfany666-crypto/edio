import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ApiError, type ApiUser, apiRequest } from "@/lib/api";

export type Role = "admin" | "customer" | "super_admin";

export type User = ApiUser & { role: Role };

type AuthState = {
  user: User | null;
  token: string | null;
  loading: boolean;
  passwordResetEmail: string | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (data: { email: string; password: string; fullName?: string; acceptTerms?: boolean }) => Promise<{ error?: string }>;
  signOut: () => void;
  updateProfile: (patch: Partial<User> & { password?: string }) => Promise<{ error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ error?: string }>;
  resetPassword: (newPassword: string, token?: string | null) => Promise<{ error?: string }>;
  refreshSession: () => Promise<void>;
};

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      loading: false,
      passwordResetEmail: null,

      async signIn(email, password) {
        try {
          set({ loading: true });
          const data = await apiRequest<{ user: User; token: string }>("/api/auth/login", {
            method: "POST",
            body: { email, password },
          });
          set({ user: data.user, token: data.token, loading: false });
          return {};
        } catch (error) {
          set({ loading: false });
          return { error: error instanceof ApiError ? error.message : "Unable to sign in." };
        }
      },

      async signUp({ email, password, fullName, acceptTerms }) {
        try {
          set({ loading: true });
          const data = await apiRequest<{ user: User; token: string }>("/api/auth/signup", {
            method: "POST",
            body: { email, password, fullName, acceptTerms },
          });
          set({ user: data.user, token: data.token, loading: false });
          return {};
        } catch (error) {
          set({ loading: false });
          return { error: error instanceof ApiError ? error.message : "Unable to create account." };
        }
      },

      signOut() {
        void apiRequest<{ message: string }>("/api/auth/logout", {
          method: "POST",
          token: get().token,
        }).catch(() => undefined);
        set({ user: null, token: null, passwordResetEmail: null });
      },

      async updateProfile(patch) {
        const token = get().token;
        if (!token) return { error: "You need to sign in first." };
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
        const token = get().token;
        if (!token) return;
        try {
          const user = await apiRequest<User>("/api/auth/me", { token });
          set({ user });
        } catch {
          set({ user: null, token: null });
        }
      },
    }),
    { name: "edio-auth" },
  ),
);
