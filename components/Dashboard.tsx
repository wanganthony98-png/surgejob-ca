"use client";

import { SearchX } from "lucide-react";
import { isOpenFilter } from "@/lib/filterMatch";
import { industries } from "@/lib/seed";
import { useStore } from "@/lib/store";
import { CompanyCard } from "./CompanyCard";

export function Dashboard() {
  const { filters, setFilters, clearFilters, filteredCompanies, loading } = useStore();
  const hasActiveFilters =
    !isOpenFilter(filters.industry) ||
    !isOpenFilter(filters.funding) ||
    !isOpenFilter(filters.location) ||
    !isOpenFilter(filters.size) ||
    !isOpenFilter(filters.rating) ||
    !isOpenFilter(filters.roleStatus);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95 pt-16 backdrop-blur">
        <div className="mx-auto max-w-6xl space-y-3 px-4 py-3 sm:px-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {industries.map((industry) => {
              const active = filters.industry === industry;
              return (
                <button
                  key={industry}
                  type="button"
                  onClick={() => setFilters({ industry })}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                    active
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-white"
                  }`}
                >
                  {industry}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <FilterSelect
              label="Funding"
              value={filters.funding}
              onChange={(funding) => setFilters({ funding })}
              options={[
                ["all", "Any round"],
                ["Seed", "Seed"],
                ["Series A", "Series A"],
                ["Series B", "Series B"],
              ]}
            />
            <FilterSelect
              label="Location"
              value={filters.location}
              onChange={(location) => setFilters({ location })}
              options={[
                ["all", "Any city"],
                ["Toronto, ON", "Toronto, ON"],
                ["Montreal, QC", "Montreal, QC"],
                ["Vancouver, BC", "Vancouver, BC"],
                ["Waterloo, ON", "Waterloo, ON"],
                ["Ottawa, ON", "Ottawa, ON"],
              ]}
            />
            <FilterSelect
              label="Company size"
              value={filters.size}
              onChange={(size) => setFilters({ size })}
              options={[
                ["all", "Any size"],
                ["11-50", "11-50"],
                ["51-200", "51-200"],
                ["200+", "200+"],
              ]}
            />
            <FilterSelect
              label="Glassdoor"
              value={filters.rating}
              onChange={(rating) => setFilters({ rating })}
              options={[
                ["all", "Any rating"],
                ["4.0+", "4.0+"],
                ["4.3+", "4.3+"],
              ]}
            />
            <FilterSelect
              label="Role status"
              value={filters.roleStatus}
              onChange={(roleStatus) => setFilters({ roleStatus })}
              options={[
                ["all", "Active and stale"],
                ["active", "Active roles only"],
                ["stale", "Stale listings"],
              ]}
            />
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="mb-0.5 text-sm font-medium text-[#c41e3a] hover:underline"
              >
                Clear Filters
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-52 animate-pulse rounded-2xl border border-slate-200 bg-white"
              />
            ))}
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <SearchX className="mx-auto h-8 w-8 text-slate-400" />
            <h2 className="mt-3 text-lg font-semibold text-slate-900">No companies match these filters</h2>
            <p className="mt-2 text-sm text-slate-500">
              Nothing in this board meets the current industry, funding, location, size, rating, and role-status combination.
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 rounded-lg bg-[#c41e3a] px-4 py-2 text-sm font-medium text-white"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          filteredCompanies.map((company) => (
            <CompanyCard key={company.id} company={company} />
          ))
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
