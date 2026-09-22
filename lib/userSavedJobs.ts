"use client";

import { getSupabaseBrowser } from "./supabaseBrowser";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export async function fetchSessionUser(): Promise<AuthUser | null> {
  try {
    const supabase = getSupabaseBrowser();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    const email = data.user.email || "";
    const name =
      (data.user.user_metadata?.full_name as string | undefined) ||
      (data.user.user_metadata?.name as string | undefined) ||
      email.split("@")[0] ||
      "Member";
    return { id: data.user.id, name, email };
  } catch {
    return null;
  }
}

export async function signInWithGoogle() {
  const supabase = getSupabaseBrowser();
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/` : undefined;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) throw error;
}

export async function signOutSupabase() {
  const supabase = getSupabaseBrowser();
  await supabase.auth.signOut();
}

export async function fetchSavedCompanyIds(userId: string): Promise<string[]> {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("user_saved_jobs")
    .select("company_id")
    .eq("user_id", userId);
  if (error) {
    console.warn("[saved] fetch failed:", error.message);
    return [];
  }
  return (data || []).map((row) => String(row.company_id)).filter(Boolean);
}

export async function saveCompanyForUser(
  userId: string,
  companyId: string,
  companyName?: string,
) {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase.from("user_saved_jobs").upsert(
    {
      user_id: userId,
      company_id: companyId,
      company_name: companyName || null,
    },
    { onConflict: "user_id,company_id" },
  );
  if (error) throw error;
}

export async function removeSavedCompanyForUser(userId: string, companyId: string) {
  const supabase = getSupabaseBrowser();
  const { error } = await supabase
    .from("user_saved_jobs")
    .delete()
    .eq("user_id", userId)
    .eq("company_id", companyId);
  if (error) throw error;
}
