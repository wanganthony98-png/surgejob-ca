"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Building2, CalendarClock, ExternalLink, Star, Users, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { formatFunding, getInsight, unavailable } from "@/lib/seed";
import { getCompany, roleForCompany, useStore } from "@/lib/store";

export function CompanyDetailModal() {
  const { detailCompanyId, closeCompanyDetail, notify } = useStore();
  const [chartReady, setChartReady] = useState(false);
  const company = detailCompanyId ? getCompany(detailCompanyId) : undefined;
  const insight = detailCompanyId ? getInsight(detailCompanyId) : undefined;
  const role = company ? roleForCompany(company.id) : undefined;

  useEffect(() => {
    setChartReady(true);
  }, []);

  useEffect(() => {
    if (!detailCompanyId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCompanyDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailCompanyId, closeCompanyDetail]);

  const applyUrl = role?.destinationUrl;
  const apply = () => {
    if (!applyUrl) {
      notify("This role cannot be continued yet. The ATS destination is missing.");
      return;
    }
    window.open(applyUrl, "_blank", "noopener,noreferrer");
    notify("Opening the official LinkedIn / ATS apply page.");
  };

  return (
    <AnimatePresence>
      {company && insight ? (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeCompanyDetail}
        >
          <motion.div
            role="dialog"
            aria-labelledby="company-detail-title"
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="overflow-y-auto">
              <header className="border-b border-slate-100 px-5 py-4 sm:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-semibold text-white"
                      style={{ backgroundColor: company.markColor }}
                    >
                      {company.mark}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Level 2 · Company insight
                      </p>
                      <h2 id="company-detail-title" className="text-lg font-semibold text-slate-900">
                        {company.name}
                      </h2>
                      {role ? <p className="text-sm text-slate-500">{role.title}</p> : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeCompanyDetail}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close company detail"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge label="Funding" value={formatFunding(company)} />
                  <Badge
                    icon={<Building2 className="h-3 w-3" />}
                    label="Lead VC"
                    value={company.leadInvestor ?? "Not available"}
                  />
                  <Badge
                    icon={<Users className="h-3 w-3" />}
                    label="Size"
                    value={company.headcountLabel}
                  />
                  <Badge
                    icon={<Star className="h-3 w-3" />}
                    label="Glassdoor"
                    value={
                      company.glassdoorRating === null
                        ? "Not available"
                        : `★ ${company.glassdoorRating.toFixed(1)}`
                    }
                  />
                  <Badge
                    icon={<CalendarClock className="h-3 w-3" />}
                    label="Freshness"
                    value={unavailable(company.fundedRelative)}
                  />
                </div>
              </header>

              <div className="grid gap-6 px-5 py-5 sm:px-6 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="h-[280px] rounded-2xl border border-slate-100 bg-slate-950 p-3">
                  {chartReady ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={insight.scores} cx="50%" cy="50%" outerRadius="72%">
                        <PolarGrid stroke="rgba(255,255,255,0.16)" />
                        <PolarAngleAxis dataKey="metric" tick={{ fill: "#cbd5e1", fontSize: 10 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar
                          name="Fit"
                          dataKey="value"
                          stroke="#fb7185"
                          fill="#e11d48"
                          fillOpacity={0.45}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : null}
                </div>
                <div className="flex flex-col justify-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">
                    Career fit radar
                  </p>
                  <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">
                    {insight.surgeIndex}
                    <span className="text-lg font-medium text-slate-400">/100</span>
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    Surge Index • {insight.tier}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    Six signals scored 0–100: capital velocity, headcount growth, institutional backing,
                    cultural health, fresh opportunity, and market traction.
                  </p>
                </div>
              </div>

              <section className="border-t border-slate-100 px-5 py-5 sm:px-6">
                <h3 className="text-sm font-semibold text-slate-900">
                  Who&apos;s currently in this role here
                </h3>
                <ul className="mt-3 space-y-2">
                  {insight.peers.map((peer) => (
                    <li
                      key={peer.linkedinUrl}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {peer.name} • {peer.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">{peer.tag}</p>
                      </div>
                      <a
                        href={peer.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        View Profile on LinkedIn
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] leading-5 text-slate-400">
                  SurgeJob.ca displays publicly available career links for networking.
                </p>
              </section>
            </div>

            <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={apply}
                disabled={!applyUrl}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Apply on LinkedIn / Company ATS
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Badge({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
      {icon}
      <span className="font-medium text-slate-400">{label}</span>
      {value}
    </span>
  );
}
