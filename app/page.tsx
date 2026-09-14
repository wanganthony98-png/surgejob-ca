import { SurgeJobApp } from "@/components/SurgeJobApp";

/**
 * 3-tier homepage: Cover (fade/lift) → Level 1 board → Level 2 insight modal → Level 3 ATS tab.
 */
export default function Home() {
  return (
    <div className="min-h-screen bg-[#05070d]">
      <SurgeJobApp />
    </div>
  );
}
