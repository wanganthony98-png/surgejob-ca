import type { SupabaseClient } from "@supabase/supabase-js";

/** Supabase join table binding saved jobs/favorites to an auth user. */
export const SAVED_JOBS_TABLE = "user_saved_jobs";

type SavedJobRow = { company_id?: unknown };

/** Fetch the company IDs a user has saved, so the UI can hydrate on load. */
export async function fetchSavedCompanyIds(
  client: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from(SAVED_JOBS_TABLE)
    .select("company_id")
    .eq("user_id", userId);
  if (error) throw error;
  return (data as SavedJobRow[] | null | undefined ?? [])
    .map((row) => String(row.company_id ?? ""))
    .filter(Boolean);
}

/** Save a job/company for a user (idempotent upsert on user_id + company_id). */
export async function addSavedJob(
  client: SupabaseClient,
  userId: string,
  companyId: string,
): Promise<void> {
  const { error } = await client
    .from(SAVED_JOBS_TABLE)
    .upsert({ user_id: userId, company_id: companyId }, { onConflict: "user_id,company_id" });
  if (error) throw error;
}

/** Remove a saved job/company for a user. */
export async function removeSavedJob(
  client: SupabaseClient,
  userId: string,
  companyId: string,
): Promise<void> {
  const { error } = await client
    .from(SAVED_JOBS_TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("company_id", companyId);
  if (error) throw error;
}
