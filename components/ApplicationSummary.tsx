"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import { buildEvidenceSummary, unavailable } from "@/lib/seed";
import { getCompany, getRole, useStore } from "@/lib/store";

export function ApplicationSummary() {
  const { view, setView, fitNotes, saveApplication } = useStore();
  const roleId = view.name === "apply" ? view.roleId : "";
  const role = getRole(roleId);
  const company = role ? getCompany(role.companyId) : undefined;
  const notes = role ? (fitNotes[role.id] ?? "") : "";

  if (!role || !company) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">No application to review</h1>
        <button type="button" onClick={() => setView({ name: "dashboard" })} className="mt-4 text-sm text-[#c41e3a]">
          Back to dashboard
        </button>
      </div>
    );
  }

  if (!role.destinationUrl) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-slate-900">This role cannot be continued yet</h1>
        <p className="mt-2 text-sm text-slate-500">
          The external destination is missing, so the handoff is blocked. Keep the company for comparison and wait for a source link.
        </p>
        <button
          type="button"
          onClick={() => setView({ name: "role", roleId: role.id })}
          className="mt-4 text-sm font-medium text-[#c41e3a]"
        >
          Return to role
        </button>
      </div>
    );
  }

  const evidence = buildEvidenceSummary(role, company);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={() => setView({ name: "role", roleId: role.id })}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-600"
      >
        <ArrowLeft className="h-4 w-4" /> Back to role
      </button>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">Application summary</h1>
      <p className="mt-2 text-sm text-slate-500">
        Confirm the destination before you leave. Fit notes and evidence stay on SurgeJob.ca after you continue.
      </p>
      <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Role</div>
          <div className="mt-1 font-semibold text-slate-900">{role.title}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Company</div>
          <div className="mt-1 font-semibold text-slate-900">{company.name}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Freshness</div>
          <p className="mt-1 text-slate-700">
            {role.freshnessLabel} role, checked {unavailable(role.lastCheckedDate)}. Review the source before you apply.
          </p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Destination</div>
          <p className="mt-1 font-medium text-slate-800">{role.destinationName}</p>
          <p className="break-all text-slate-500">{role.destinationUrl}</p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Retained evidence</div>
          <p className="mt-1 leading-6 text-slate-700">{evidence}</p>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Fit notes</div>
          <p className="mt-1 whitespace-pre-wrap leading-6 text-slate-700">
            {notes.trim() ? notes : "No fit notes yet. They will stay blank if you continue now."}
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <a
          href={role.destinationUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => saveApplication(role.id, "considering")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#c41e3a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#a81830]"
        >
          Confirm destination and continue
          <ExternalLink className="h-4 w-4" />
        </a>
        <button
          type="button"
          onClick={() => {
            saveApplication(role.id, "applied");
            setView({ name: "saved" });
          }}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Mark applied after leaving
        </button>
      </div>
    </div>
  );
}
