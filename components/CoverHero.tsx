"use client";

import { ArrowRight, BadgeCheck, Landmark, Radar, Send } from "lucide-react";
import { motion } from "motion/react";

const steps = [
  {
    n: "01",
    title: "Track VC Funding",
    copy: "Watch new Canadian SME rounds before they flood public boards.",
    icon: Radar,
  },
  {
    n: "02",
    title: "Verify SME Growth & Ratings",
    copy: "Check headcount, Glassdoor, and hiring freshness in one pass.",
    icon: BadgeCheck,
  },
  {
    n: "03",
    title: "Apply Direct via ATS",
    copy: "Continue to the company ATS with evidence still attached.",
    icon: Send,
  },
];

export function CoverHero() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200">
      <div className="hero-glow pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c41e3a]"
        >
          What is SurgeJob?
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08 }}
          className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-6xl"
        >
          Right Time. Right Company.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18 }}
          className="mt-5 max-w-2xl text-lg leading-8 text-slate-600"
        >
          Connecting tech talent with newly funded Canadian SMEs before public recruiters hit them.
          SurgeJob surfaces the opening, the round, the lead investor, and the growth signal in one board.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.28 }}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1.5 text-sm text-slate-600 shadow-sm backdrop-blur"
        >
          <Landmark className="h-4 w-4 text-[#c41e3a]" />
          Role-first hiring evidence, not another ghost-job feed.
        </motion.div>
        <div className="mt-10 grid gap-3 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.35 + index * 0.12 }}
                className="rounded-2xl border border-white/80 bg-white/80 p-5 shadow-sm backdrop-blur"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-widest text-slate-400">{step.n}</span>
                  <Icon className="h-5 w-5 text-[#c41e3a]" />
                </div>
                <h2 className="mt-3 text-base font-semibold text-slate-900">{step.title}</h2>
                <p className="mt-1.5 text-sm leading-6 text-slate-500">{step.copy}</p>
                {index < steps.length - 1 ? (
                  <p className="mt-3 hidden items-center gap-1 text-xs font-medium text-slate-400 md:flex">
                    Next <ArrowRight className="h-3 w-3" />
                  </p>
                ) : null}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
