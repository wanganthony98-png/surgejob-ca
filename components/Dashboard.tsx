"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchX } from "lucide-react";
import { isOpenFilter } from "@/lib/filterMatch";
import { collectLocationOptions } from "@/lib/companyLocations";
import { industries, roles } from "@/lib/seed";
import { useStore } from "@/lib/store";
import type { Company } from "@/lib/types";
import { CompanyCard } from "./CompanyCard";

const ITEMS_PER_PAGE = 10;

function isFreshFunding(company: Company, days = 30) {
  if (!company.fundingDate) {
    return /funded (this week|\d+ days ago|last month)/i.test(company.fundedRelative || "");
  }
  const parsed = Date.parse(
    /^\d{4}-\d{2}-\d{2}/.test(company.fundingDate)
      ? `${company.fundingDate}T00:00:00Z`
      : company.fundingDate,
  );
  if (Number.isNaN(parsed)) {
    return /funded (this week|\d+ days ago|last month)/i.test(company.fundedRelative || "");
  }
  return (Date.now() - parsed) / (1000 * 60 * 60 * 24) <= days;
}

function withActiveFallback(company: Company): Company {
  const is_active =
    Boolean(company.isActive) ||
    company.openRoleCount > 0 ||
    isFreshFunding(company, 30);
  return { ...company, isActive: is_active };
}

export function Dashboard() {
  const { filters, setFilters, clearFilters, filteredCompanies, companies, loading } = useStore();
  const [currentPage, setCurrentPage] = useState(1);
  const hasActiveFilters =
    !isOpenFilter(filters.industry) ||
    !isOpenFilter(filters.funding) ||
    !isOpenFilter(filters.location) ||
    !isOpenFilter(filters.size) ||
    !isOpenFilter(filters.rating) ||
    !isOpenFilter(filters.roleStatus);

  const displayCompanies = useMemo(() => {
    const source = filteredCompanies.length > 0 ? filteredCompanies : companies;
    return source.map(withActiveFallback);
  }, [filteredCompanies, companies]);

  const locationOptions = useMemo<string[][]>(() => {
    const dynamic = collectLocationOptions(companies, roles).map((loc) => [loc, loc]);
    return [["all", "Any city"], ...dynamic];
  }, [companies]);

  const totalPages = Math.max(1, Math.ceil(displayCompanies.length / ITEMS_PER_PAGE));
  const paginatedCompanies = displayCompanies.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

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
              options={locationOptions}
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
        ) : displayCompanies.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <SearchX className="mx-auto h-8 w-8 text-slate-400" />
            <h2 className="mt-3 text-lg font-semibold text-slate-900">
              No companies match these filters
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Nothing in this board meets the current industry, funding, location, size, rating, and
              role-status combination.
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
          <>
            {paginatedCompanies.map((company) => (
              <CompanyCard key={company.id} company={company} />
            ))}
            {totalPages > 1 ? (
              <div className="flex items-center justify-center gap-4 pt-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <p className="text-sm text-slate-600">
                  Page {currentPage} of {totalPages}
                </p>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            ) : null}
          </>
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
