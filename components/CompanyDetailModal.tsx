"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Briefcase, ExternalLink, Globe, Link2, Radar as RadarIcon, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { calculateRadarScores, surgeFromRadarScores } from "@/lib/calculateRadarScores";
import { getCompanyActionUrls, getLinkedInPeopleUrl } from "@/lib/companyUrls";
import { resolveRoleApplyUrl } from "@/lib/jobUrlSafety";
import { getScoreReason, type RadarDimension } from "@/lib/getScoreReason";
import { formatArrangement, formatFunding, unavailable } from "@/lib/seed";
import { resolveCompanyFreshness } from "@/lib/freshness";
import { getCompany, useStore } from "@/lib/store";
import type { RadarData, WorkArrangement } from "@/lib/types";

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-1.3.7-2.1 1.7-2.1 1.1 0 1.55.77 1.55 1.97v5.06h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
    </svg>
  );
}

const DIMENSIONS: { key: RadarDimension; label: string }[] = [
  { key: "capital", label: "Capital" },
  { key: "growth", label: "Growth" },
  { key: "product", label: "Product" },
  { key: "market", label: "Market" },
  { key: "leadership", label: "Leadership" },
  { key: "culture", label: "Culture" },
];

const FALLBACK_RADAR: RadarData = {
  capital: 88,
  growth: 80,
  product: 85,
  market: 78,
  leadership: 82,
  culture: 75,
};

type DetailTab = "analytics" | "roles" | "links";

function employmentTypeLabel(workArrangement: WorkArrangement | undefined) {
  if (!workArrangement) return "Full-time";
  return `Full-time · ${formatArrangement(workArrangement)}`;
}

export function CompanyDetailModal() {
  const { detailCompanyId, closeCompanyDetail } = useStore();
  const [chartReady, setChartReady] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("analytics");
  const company = detailCompanyId ? getCompany(detailCompanyId) : undefined;
  const peerRoles = company?.peerRoles ?? [];
  const rolesCount = peerRoles.length || company?.openRoleCount || 0;
  const actionUrls = company ? getCompanyActionUrls(company) : null;
  const freshnessLabel = company
    ? resolveCompanyFreshness(company).freshnessLabel
    : "Not available";
  const radar = company
    ? { ...FALLBACK_RADAR, ...calculateRadarScores(company) }
    : FALLBACK_RADAR;
  const surge = surgeFromRadarScores(radar);
  const chartData = DIMENSIONS.map(({ key, label }) => ({
    metric: label,
    value: radar[key],
  }));

  useEffect(() => {
    setChartReady(true);
  }, []);

  useEffect(() => {
    if (!detailCompanyId) return;
    setActiveTab("analytics");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCompanyDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailCompanyId, closeCompanyDetail]);

  const tabs: {
    id: DetailTab;
    title: string;
    subtitle: string;
  }[] = [
    {
      id: "analytics",
      title: "📊 Hiring Intelligence",
      subtitle: "6-Axis Radar & Rationales",
    },
    {
      id: "roles",
      title: `💼 Open Positions (${rolesCount})`,
      subtitle: "Department & Role Signals",
    },
    {
      id: "links",
      title: "🔗 Direct Links & Network",
      subtitle: "ATS, LinkedIn & Official Web",
    },
  ];

  return (
    <AnimatePresence>
      {company && actionUrls ? (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeCompanyDetail}
        >
          <motion.div
            role="dialog"
            aria-labelledby="company-detail-title"
            className="flex h-[88vh] w-full max-w-6xl flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl md:p-8"
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="mb-5 shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-semibold text-white"
                    style={{ backgroundColor: company.markColor }}
                  >
                    {company.mark}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Level 2 · Company insight
                    </p>
                    <h2 id="company-detail-title" className="text-xl font-bold text-slate-900">
                      {company.name}
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-500">
                      Surge {surge}/100 · {company.industry || "Others"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeCompanyDetail}
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close company detail"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-8 mt-5 grid grid-cols-3 gap-3 rounded-2xl border border-slate-200/80 bg-slate-100 p-2 shadow-inner">
                {tabs.map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl px-4 py-3 transition-all ${
                        active
                          ? "scale-[1.02] border border-slate-800 bg-slate-900 font-bold text-white shadow-md"
                          : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
                      }`}
                    >
                      <span className="text-base font-bold leading-tight">{tab.title}</span>
                      <span
                        className={`mt-1 text-[11px] leading-tight ${
                          active ? "text-white/70" : "text-slate-500"
                        }`}
                      >
                        {tab.subtitle}
                      </span>
                    </button>
                  );
                })}
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto pb-4">
              {activeTab === "analytics" ? (
                <section className="grid h-full grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
                  <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    {chartReady ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="72%">
                          <PolarGrid stroke="rgba(100,116,139,0.25)" />
                          <PolarAngleAxis
                            dataKey="metric"
                            tick={{ fill: "#475569", fontSize: 12 }}
                          />
                          <PolarRadiusAxis domain={[40, 100]} tick={false} axisLine={false} />
                          <Radar
                            name="Surge"
                            dataKey="value"
                            stroke="#059669"
                            fill="#10b981"
                            fillOpacity={0.35}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    ) : (
                      <RadarIcon className="h-10 w-10 text-slate-300" />
                    )}
                  </div>
                  <div className="grid gap-3">
                    {DIMENSIONS.map(({ key, label }) => (
                      <div
                        key={key}
                        className="rounded-xl border border-slate-200/80 bg-slate-50 p-3.5"
                      >
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-800">{label}</p>
                          <p className="text-sm font-extrabold text-emerald-600">
                            {radar[key]}/100
                          </p>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                          {getScoreReason(company, key)}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {activeTab === "roles" ? (
                <section>
                  <h3 className="mb-1 text-base font-bold text-slate-900">
                    Open Positions &amp; Hiring Velocity
                  </h3>
                  <p className="mb-4 text-xs text-slate-500">
                    {company.hiringSignal ||
                      `${rolesCount} publicly listed role${rolesCount === 1 ? "" : "s"}`}
                  </p>
                  <div className="space-y-3">
                    {peerRoles.length > 0 ? (
                      peerRoles.map((job) => {
                        const href =
                          resolveRoleApplyUrl(job.url, actionUrls.careersUrl) ||
                          actionUrls.careersUrl ||
                          actionUrls.linkedInJobsUrl;
                        return (
                          <div
                            key={`${job.title}-${job.url || "careers"}`}
                            className="rounded-r-xl border border-slate-200 border-l-4 border-l-emerald-500 bg-slate-50 p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="text-base font-bold text-slate-900">{job.title}</p>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">
                                    {job.location}
                                  </span>
                                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">
                                    {employmentTypeLabel(company.workArrangement)}
                                  </span>
                                  {job.postedAt ? (
                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                                      {resolveCompanyFreshness({
                                        freshness: job.postedAt,
                                        openRoleCount: 1,
                                      }).freshnessLabel.replace(/^Updated /, "Posted ")}
                                    </span>
                                  ) : null}
                                </div>
                                <a
                                  href={getLinkedInPeopleUrl(company.name, job.title)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-2 inline-flex text-xs text-slate-500 transition hover:text-[#0A66C2]"
                                >
                                  Find who&apos;s in this role on LinkedIn →
                                </a>
                              </div>
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700"
                              >
                                {job.url && resolveRoleApplyUrl(job.url, null)
                                  ? "Apply"
                                  : "Careers"}
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center">
                        <Briefcase className="mx-auto h-8 w-8 text-slate-300" />
                        <p className="mt-3 text-sm text-slate-500">No public roles listed yet.</p>
                      </div>
                    )}
                  </div>
                </section>
              ) : null}

              {activeTab === "links" ? (
                <section className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <h3 className="text-base font-bold text-slate-900">Funding &amp; Investors</h3>
                    <dl className="mt-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-slate-500">Funding</dt>
                        <dd className="font-semibold text-slate-900">{formatFunding(company)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-slate-500">Lead investor</dt>
                        <dd className="font-semibold text-slate-900">
                          {company.leadInvestor && company.leadInvestor !== "Undisclosed"
                            ? company.leadInvestor
                            : "Undisclosed"}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-slate-500">Freshness</dt>
                        <dd className="font-semibold text-slate-900">{freshnessLabel}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-slate-500">Funded</dt>
                        <dd className="font-semibold text-slate-900">
                          {unavailable(company.fundingDate)}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {company.industry ? (
                        <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800">
                          {company.industry}
                        </span>
                      ) : null}
                      {company.leadInvestor && company.leadInvestor !== "Undisclosed" ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                          Led by {company.leadInvestor}
                        </span>
                      ) : null}
                      {company.hiringSignal ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                          {company.hiringSignal}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <h3 className="inline-flex items-center gap-2 text-base font-bold text-slate-900">
                      <Link2 className="h-4 w-4 text-slate-500" />
                      Direct Links &amp; Network
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                      Jump to official careers, LinkedIn jobs, or the company website. SurgeJob
                      surfaces publicly available career links for networking.
                    </p>
                    <div className="mt-5 grid gap-2">
                      <a
                        href={actionUrls.careersUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                      >
                        Company Careers / ATS
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <a
                        href={actionUrls.linkedInJobsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700"
                      >
                        <LinkedInIcon className="h-3.5 w-3.5" />
                        LinkedIn Jobs Hub
                      </a>
                      <a
                        href={actionUrls.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        Official Website
                      </a>
                      <a
                        href={getLinkedInPeopleUrl(company.name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                      >
                        Explore all {company.name} employees on LinkedIn
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>

            <footer className="mt-auto shrink-0 border-t border-slate-200 pt-4">
              <div className="grid gap-2 sm:grid-cols-3">
                <a
                  href={actionUrls.careersUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  Company Careers / ATS
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
                <a
                  href={actionUrls.linkedInJobsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700"
                >
                  <LinkedInIcon className="h-3.5 w-3.5 shrink-0" />
                  LinkedIn Jobs Hub
                </a>
                <a
                  href={actionUrls.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <Globe className="h-3.5 w-3.5 shrink-0" />
                  Official Website
                </a>
              </div>
            </footer>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
