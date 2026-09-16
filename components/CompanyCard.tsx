"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Briefcase,
  CalendarClock,
  Gauge,
  MapPin,
  Users,
} from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { calculateRadarScores, surgeFromRadarScores } from "@/lib/calculateRadarScores";
import { openRolesCountLabel } from "@/lib/companyUrls";
import type { RadarDimension } from "@/lib/getScoreReason";
import { formatArrangement, formatFunding, unavailable } from "@/lib/seed";
import { roleForCompany, useStore } from "@/lib/store";
import type { Company, RadarData } from "@/lib/types";
import { FavoriteButton } from "./AuthModal";

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-1.3.7-2.1 1.7-2.1 1.1 0 1.55.77 1.55 1.97v5.06h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
    </svg>
  );
}

const RADAR_LABELS: { key: RadarDimension; label: string }[] = [
  { key: "growth", label: "Growth" },
  { key: "product", label: "Product" },
  { key: "market", label: "Market" },
  { key: "leadership", label: "Leadership" },
  { key: "culture", label: "Culture" },
  { key: "capital", label: "Capital" },
];

const FALLBACK_RADAR: RadarData = {
  capital: 88,
  growth: 80,
  product: 85,
  market: 78,
  leadership: 82,
  culture: 75,
};

function resolveRadarScores(company: Company): RadarData {
  const dynamic = calculateRadarScores(company);
  return { ...FALLBACK_RADAR, ...dynamic };
}

function openRolesSummary(company: Company) {
  if (company.hiringSignal?.trim()) return company.hiringSignal.trim();
  const count = company.peerRoles?.length ?? 0;
  if (count > 0) return `${count} Open Role${count === 1 ? "" : "s"}`;
  if (company.applyUrl) return "Careers open";
  return "No Active Roles";
}

/** Simple non-interactive radar summary for Level 1 cards (no Level 3 popovers). */
export function RadarChartInteractive({
  company,
  radar: radarProp,
}: {
  company: Company;
  radar?: RadarData;
}) {
  const scores = radarProp ? { ...FALLBACK_RADAR, ...radarProp } : resolveRadarScores(company);
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    setChartReady(true);
  }, []);

  const chartData = RADAR_LABELS.map(({ key, label }) => ({
    metric: label,
    value: scores[key],
  }));

  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-[180px_1fr]">
      <div className="h-[160px] rounded-2xl border border-slate-100 bg-slate-950 p-2">
        {chartReady ? (
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="68%">
              <PolarGrid stroke="rgba(255,255,255,0.16)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: "#94a3b8", fontSize: 9 }} />
              <PolarRadiusAxis domain={[40, 100]} tick={false} axisLine={false} />
              <Radar
                name="Surge"
                dataKey="value"
                stroke="#2dd4bf"
                fill="#14b8a6"
                fillOpacity={0.45}
              />
            </RadarChart>
          </ResponsiveContainer>
        ) : null}
      </div>
      <div className="flex flex-col justify-center gap-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-700">
          <Gauge className="h-3.5 w-3.5" />
          Surge radar
        </p>
        <div className="flex flex-wrap gap-1.5">
          {RADAR_LABELS.map(({ key, label }) => (
            <span
              key={key}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              {label} {scores[key]}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-slate-400">
          Open the company insight for full score rationales.
        </p>
      </div>
    </div>
  );
}

export function CompanyCard({ company }: { company: Company }) {
  const { selectedCompanyIds, toggleSelect, openCompanyDetail } = useStore();
  const role = roleForCompany(company.id);
  const selected = selectedCompanyIds.includes(company.id);
  const stale = role?.status === "stale";
  const title = role?.title ?? company.name;
  const freshness = role?.freshnessLabel ?? company.fundedRelative ?? "Active";
  const radar = resolveRadarScores(company);
  const surge = company.surgeIndex ?? surgeFromRadarScores(radar);
  const rolesSummary = openRolesSummary(company);
  const rolesCount = openRolesCountLabel(company);

  const openLevelTwo = () => openCompanyDetail(company.id);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`${title} at ${company.name}. Open company insight.`}
      className="cursor-pointer rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("button, a, input, label")) return;
        openLevelTwo();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openLevelTwo();
        }
      }}
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        <label className="flex shrink-0 items-start gap-2 pt-1 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => toggleSelect(company.id)}
            onClick={(event) => event.stopPropagation()}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#c41e3a] focus:ring-[#c41e3a]"
          />
          Compare
        </label>
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: company.markColor }}
        >
          {company.mark}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold leading-snug text-slate-900">{title}</h2>
                {company.linkedinUrl ? (
                  <a
                    href={company.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Open ${company.name} on LinkedIn`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#0a66c2]/20 bg-[#0a66c2]/10 text-[#0A66C2] transition hover:bg-[#0a66c2]/15"
                  >
                    <LinkedInIcon className="h-4 w-4 text-[#0A66C2]" />
                  </a>
                ) : null}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    stale
                      ? "bg-red-50 text-red-700 ring-1 ring-red-100"
                      : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"
                  }`}
                >
                  {freshness}
                </span>
                {company.leadInvestor && company.leadInvestor !== "Undisclosed" ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-800">
                    <Building2 className="h-3 w-3" />
                    Lead Investor: {company.leadInvestor}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm font-medium text-slate-700">{company.name}</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">{company.mission}</p>
            </div>
            <FavoriteButton companyId={company.id} companyName={company.name} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Funding" value={formatFunding(company)} />
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <Building2 className="h-3.5 w-3.5" /> Lead investor
              </p>
              <p className="mt-1 text-lg font-semibold leading-6 text-slate-900">
                {company.leadInvestor && company.leadInvestor !== "Undisclosed"
                  ? `Led by ${company.leadInvestor}`
                  : "Undisclosed"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <Users className="h-3.5 w-3.5" /> Signal
              </p>
              <p className="mt-1 text-lg font-semibold leading-6 text-slate-900">
                Surge {surge}/100
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{company.industry || "Others"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <CalendarClock className="h-3.5 w-3.5" /> Freshness
              </p>
              <p className="mt-1 text-lg font-semibold leading-6 text-slate-900">
                {unavailable(company.fundedRelative)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Funded {unavailable(company.fundingDate)}
              </p>
            </div>
          </div>

          <RadarChartInteractive company={company} radar={radar} />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
              <Briefcase className="h-3.5 w-3.5 text-slate-500" />
              {rolesSummary}
            </span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openLevelTwo();
              }}
              className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {rolesCount
                ? `View ${rolesCount} Open Roles & Team →`
                : "View Open Roles & Team →"}
            </button>
          </div>

          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {company.location} · {formatArrangement(company.workArrangement)}
            </span>
          </p>
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700/70">{label}</p>
      <p className="mt-1 text-lg font-bold leading-6 text-emerald-950">{value}</p>
    </div>
  );
}

export function RoleCard({ company }: { company: Company }) {
  return <CompanyCard company={company} />;
}
