import type { Session, SupabaseClient } from "@supabase/supabase-js";

export type AuthUser = {
  name: string;
  email: string;
  avatarUrl: string | null;
};

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

/** Derive the app's user shape (name, email, avatar) from a Supabase session. */
export function userFromSession(session: Session | null | undefined): AuthUser | null {
  const user = session?.user;
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const email = typeof user.email === "string" ? user.email : "";
  const name =
    firstString(meta.full_name, meta.name, meta.user_name) ??
    (email ? email.split("@")[0] : "") ??
    "Member";
  const avatarUrl = firstString(meta.avatar_url, meta.picture) ?? null;
  return { name: name || "Member", email, avatarUrl };
}

/** Trigger Supabase Google OAuth, redirecting back to `${origin}/auth/callback`. */
export function signInWithGoogle(client: SupabaseClient, redirectTo?: string) {
  return client.auth.signInWithOAuth({
    provider: "google",
    options: redirectTo ? { redirectTo } : undefined,
  });
}
