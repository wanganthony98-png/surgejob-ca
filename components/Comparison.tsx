"use client";

import { ArrowLeft, X } from "lucide-react";
import { formatArrangement, formatFunding, unavailable } from "@/lib/seed";
import { getCompany, roleForCompany, useStore } from "@/lib/store";

export function Comparison() {
  const { selectedCompanyIds, removeSelect, setView, compareEnabled, filteredCompanies } =
    useStore();
  const selected = selectedCompanyIds
    .map((id) => getCompany(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const visible = selected.filter((c) => filteredCompanies.some((f) => f.id === c.id));

  if (!compareEnabled || visible.length < 2) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Select at least two companies</h1>
        <p className="mt-2 text-sm text-slate-500">
          Comparison stays off until two companies in the current filter set are selected. Missing signals will be labeled, not guessed.
        </p>
        <button
          type="button"
          onClick={() => setView({ name: "dashboard" })}
          className="mt-4 text-sm font-medium text-[#c41e3a]"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  const rows: { label: string; value: (id: string) => string }[] = [
    {
      label: "Funding",
      value: (id) => formatFunding(getCompany(id)!),
    },
    {
      label: "Lead investor",
      value: (id) => {
        const investor = getCompany(id)!.leadInvestor;
        return investor ? `Led by ${investor}` : "Not available";
      },
    },
    {
      label: "Funding freshness",
      value: (id) => unavailable(getCompany(id)!.fundedRelative),
    },
    {
      label: "Funding date",
      value: (id) => unavailable(getCompany(id)!.fundingDate),
    },
    { label: "Headcount", value: (id) => getCompany(id)!.headcountLabel },
    {
      label: "Location",
      value: (id) => {
        const c = getCompany(id)!;
        return `${c.location} · ${formatArrangement(c.workArrangement)}`;
      },
    },
    {
      label: "Glassdoor",
      value: (id) => {
        const rating = getCompany(id)!.glassdoorRating;
        return rating === null ? "Not available" : String(rating);
      },
    },
    {
      label: "Freshness",
      value: (id) => roleForCompany(id)?.freshnessLabel ?? "Not available",
    },
    {
      label: "Open roles",
      value: (id) => String(getCompany(id)!.openRoleCount),
    },
    {
      label: "Posted",
      value: (id) => unavailable(roleForCompany(id)?.postedDate),
    },
    {
      label: "Last checked",
      value: (id) => unavailable(roleForCompany(id)?.lastCheckedDate),
    },
    {
      label: "Evidence",
      value: (id) =>
        getCompany(id)!.evidenceCompleteness === "complete" ? "Complete" : "Incomplete",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={() => setView({ name: "dashboard" })}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-600"
      >
        <ArrowLeft className="h-4 w-4" /> Back to board
      </button>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">Compare employer signals</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-500">
        Rows stay aligned so you can judge funding, headcount, location, rating, freshness, and open-role count. Incomplete evidence stays visible.
      </p>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="px-4 py-3 font-medium text-slate-500">Signal</th>
              {visible.map((company) => (
                <th key={company.id} className="min-w-[180px] px-4 py-3 align-top">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900">{company.name}</div>
                      <div className="text-xs font-normal text-slate-500">{roleForCompany(company.id)?.title}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSelect(company.id)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      aria-label={`Remove ${company.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-slate-100">
                <th className="px-4 py-3 text-left font-medium text-slate-500">{row.label}</th>
                {visible.map((company) => {
                  const value = row.value(company.id);
                  const missing = value === "Not available" || value === "Incomplete";
                  return (
                    <td
                      key={company.id}
                      className={`px-4 py-3 ${missing ? "text-slate-400" : "text-slate-800"}`}
                    >
                      {value}
                      {missing && row.label === "Glassdoor" ? (
                        <span className="mt-1 block text-xs">Evidence is incomplete.</span>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {visible.map((company) => {
          const role = roleForCompany(company.id);
          if (!role) return null;
          return (
            <button
              key={company.id}
              type="button"
              onClick={() => setView({ name: "role", roleId: role.id })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Open {role.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}