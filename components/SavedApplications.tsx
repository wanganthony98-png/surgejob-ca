"use client";

import { ArrowLeft } from "lucide-react";
import { getCompany, getRole, useStore } from "@/lib/store";
import type { SavedStatus } from "@/lib/types";

const statuses: SavedStatus[] = ["considering", "applied", "closed"];

export function SavedApplications() {
  const {
    saved,
    updateSavedStatus,
    removeSaved,
    setView,
    favoriteCompanyIds,
    toggleFavorite,
  } = useStore();
  const favorites = favoriteCompanyIds
    .map((id) => getCompany(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={() => setView({ name: "dashboard" })}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-600"
      >
        <ArrowLeft className="h-4 w-4" /> Back to board
      </button>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">Saved applications</h1>
      <p className="mt-2 text-sm text-slate-500">
        Status and fit notes stay here after you review a destination elsewhere. Favorited companies are listed first.
      </p>
      {favorites.length ? (
        <div className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Favorites</h2>
          <ul className="mt-2 space-y-2">
            {favorites.map((company) => (
              <li
                key={company.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
              >
                <span className="font-medium text-slate-800">{company.name}</span>
                <button
                  type="button"
                  onClick={() => toggleFavorite(company.id)}
                  className="text-xs font-medium text-rose-600 hover:underline"
                >
                  Remove favorite
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {saved.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <h2 className="font-semibold text-slate-900">No saved roles yet</h2>
          <p className="mt-2 text-sm text-slate-500">
            Saved roles appear after a decision. Open a role, keep your reasoning, and mark considering, applied, or closed.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {saved.map((item) => {
            const role = getRole(item.roleId);
            const company = getCompany(item.companyId);
            if (!role || !company) return null;
            return (
              <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <button
                      type="button"
                      onClick={() => setView({ name: "role", roleId: role.id })}
                      className="text-left text-lg font-semibold text-slate-900 hover:underline"
                    >
                      {role.title}
                    </button>
                    <p className="text-sm text-slate-600">{company.name}</p>
                    <p className="mt-1 text-xs text-slate-400">Saved {item.savedDate}</p>
                  </div>
                  <select
                    value={item.status}
                    onChange={(e) => updateSavedStatus(item.id, e.target.value as SavedStatus)}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm capitalize"
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.evidenceSummary}</p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {item.fitNotes || "No fit notes retained."}
                </p>
                <button
                  type="button"
                  onClick={() => removeSaved(item.id)}
                  className="mt-3 text-xs font-medium text-slate-400 hover:text-[#c41e3a]"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
