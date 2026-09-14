"use client";

import { AlertTriangle, ArrowLeft, Bookmark, ExternalLink } from "lucide-react";
import { formatArrangement, formatFunding, unavailable } from "@/lib/seed";
import { getCompany, getRole, useStore } from "@/lib/store";

export function RoleDetail() {
  const { view, setView, fitNotes, setFitNotes, saveApplication } = useStore();
  const roleId = view.name === "role" ? view.roleId : "";
  const role = getRole(roleId);
  const company = role ? getCompany(role.companyId) : undefined;

  if (!role || !company) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-slate-900">No role selected</h1>
        <p className="mt-2 text-sm text-slate-500">
          Open a role from the board to see requirements beside company evidence.
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

  const stale = role.status === "stale";
  const notes = fitNotes[role.id] ?? "";
  const missingDetails = !role.postedDate || !role.lastCheckedDate || !role.sourceLabel;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={() => setView({ name: "dashboard" })}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to board
      </button>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold leading-snug text-slate-900">{role.title}</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                stale ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"
              }`}
            >
              {role.freshnessLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {company.name} · {role.location} · {formatArrangement(role.workArrangement)}
          </p>
          {missingDetails ? (
            <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Some role details are missing. Apply is hidden until source and destination evidence is complete.
            </p>
          ) : null}
          {stale ? (
            <p className="mt-4 inline-flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Stale listing. The company remains comparable, but this is not a current application opportunity.
            </p>
          ) : null}
          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Requirements
          </h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
            {role.requirements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Freshness and source
          </h2>
          <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate-400">Posted</dt>
              <dd className="font-medium">{unavailable(role.postedDate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Last checked</dt>
              <dd className="font-medium">{unavailable(role.lastCheckedDate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Source</dt>
              <dd className="font-medium">{unavailable(role.sourceLabel)}</dd>
            </div>
          </dl>
          <label className="mt-6 block text-sm font-medium text-slate-800">
            Fit notes
            <textarea
              value={notes}
              onChange={(e) => setFitNotes(role.id, e.target.value)}
              rows={5}
              placeholder="Why this role, what is still unknown, and what you want to keep when you leave to apply."
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none ring-[#c41e3a] focus:ring-2"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => saveApplication(role.id, "considering")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Bookmark className="h-4 w-4" />
              Save as considering
            </button>
            {!stale && role.destinationUrl && !role.evidenceUnavailable ? (
              <button
                type="button"
                onClick={() => setView({ name: "apply", roleId: role.id })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#c41e3a] px-3 py-2 text-sm font-medium text-white hover:bg-[#a81830]"
              >
                Review application
                <ExternalLink className="h-4 w-4" />
              </button>
            ) : stale ? null : (
              <p className="self-center text-sm text-slate-500">
                This role cannot be continued yet. The external destination is missing.
              </p>
            )}
          </div>
        </section>
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: company.markColor }}
            >
              {company.mark}
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">{company.name}</h2>
              <p className="text-xs text-slate-500">{company.industry}</p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{company.mission}</p>
          <dl className="mt-5 space-y-3 text-sm">
            <Row label="Funding" value={formatFunding(company)} />
            <Row
              label="Lead investor"
              value={company.leadInvestor ? `Led by ${company.leadInvestor}` : "Not available"}
            />
            <Row label="Headcount" value={company.headcountLabel} />
            <Row
              label="Glassdoor"
              value={
                company.glassdoorRating === null
                  ? "Not available"
                  : `★ ${company.glassdoorRating.toFixed(1)} / 5.0`
              }
            />
            <Row label="Funding freshness" value={unavailable(company.fundedRelative)} />
            <Row label="Funding date" value={unavailable(company.fundingDate)} />
            <Row label="Location" value={`${company.location} · ${formatArrangement(company.workArrangement)}`} />
            <Row label="Open roles" value={String(company.openRoleCount)} />
            <Row
              label="Evidence"
              value={company.evidenceCompleteness === "complete" ? "Complete" : "Incomplete"}
            />
          </dl>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}
