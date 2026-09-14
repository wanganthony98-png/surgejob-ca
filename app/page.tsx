import { SurgeJobApp } from "@/components/SurgeJobApp";
import { mockData } from "@/lib/seed";
import { mapCompanyRows } from "@/lib/mapCompany";
import { supabase } from "@/lib/supabaseClient";

/**
 * 3-tier homepage: Cover (fade/lift) → Level 1 board → Level 2 insight modal → Level 3 ATS tab.
 * Live `companies` rows from Supabase, with seeded mockData as a smooth fallback.
 */
async function loadCompanies() {
  try {
    const { data, error } = await supabase.from("companies").select("*");
    if (error || data == null) return mockData;
    const live = mapCompanyRows(data);
    return live.length > 0 ? live : mockData;
  } catch {
    return mockData;
  }
}

export default async function Home() {
  const companies = await loadCompanies();
  return (
    <div className="min-h-screen bg-[#05070d]">
      <SurgeJobApp companies={companies} />
    </div>
  );
}
