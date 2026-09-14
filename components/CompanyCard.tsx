"use client";

import {
  Building2,
  CalendarClock,
  MapPin,
  Star,
  Users,
} from "lucide-react";
import { formatArrangement, formatFunding, unavailable } from "@/lib/seed";
import { roleForCompany, useStore } from "@/lib/store";
import type { Company } from "@/lib/types";
import { FavoriteButton } from "./AuthModal";

export function CompanyCard({ company }: { company: Company }) {
  const { selectedCompanyIds, toggleSelect, openCompanyDetail } = useStore();
  const role = roleForCompany(company.id);
  if (!role) return null;
  const selected = selectedCompanyIds.includes(company.id);
  const stale = role.status === "stale";

  const openLevelTwo = () => openCompanyDetail(company.id);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`${role.title} at ${company.name}. Open company insight.`}
      className="cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
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
                <h2 className="text-xl font-semibold leading-snug text-slate-900">
                  {role.title}
                </h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    stale
                      ? "bg-red-50 text-red-700 ring-1 ring-red-100"
                      : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"
                  }`}
                >
                  {role.freshnessLabel}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-slate-700">{company.name}</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">{company.mission}</p>
            </div>
            <FavoriteButton companyId={company.id} companyName={company.name} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="Funding" value={formatFunding(company)} />
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <Building2 className="h-3.5 w-3.5" /> Lead investor
              </p>
              <p className="mt-1 text-lg font-semibold leading-6 text-slate-900">
                {company.leadInvestor ? `Led by ${company.leadInvestor}` : "Not available"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <Users className="h-3.5 w-3.5" /> Headcount
              </p>
              <p className="mt-1 text-lg font-semibold leading-6 text-slate-900">
                {company.headcountLabel}
              </p>
            </div>
            <div className="star-glow rounded-xl border border-amber-100 bg-amber-50 px-3 py-3">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700/70">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> Glassdoor
              </p>
              <p className="mt-1 text-lg font-semibold leading-6 text-slate-900">
                {company.glassdoorRating === null
                  ? "Not available"
                  : `★ ${company.glassdoorRating.toFixed(1)} / 5.0`}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <CalendarClock className="h-3.5 w-3.5" /> Freshness
              </p>
              <p className="mt-1 text-lg font-semibold leading-6 text-slate-900">
                {unavailable(company.fundedRelative)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">Posted {unavailable(role.postedDate)}</p>
            </div>
          </div>

          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {company.location} · {formatArrangement(company.workArrangement)}
            </span>
            <span>
              {company.openRoleCount} {company.openRoleCount === 1 ? "open role" : "open roles"}
            </span>
          </p>
        </div>
      </div>
    </article>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
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
