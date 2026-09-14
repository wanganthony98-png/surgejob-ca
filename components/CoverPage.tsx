"use client";

import { ChevronDown, Gauge, Landmark, Search, ShieldCheck } from "lucide-react";
import { Logo } from "./Logo";
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

const featurePills = [
  { title: "Growth Momentum Tracking", icon: Gauge },
  { title: "Zero Ghost Jobs", icon: ShieldCheck },
  { title: "3-Tier Precision Search", icon: Search },
];

const vcBadges = [
  { label: "Inovia Capital", x: "8%", y: "18%", delay: 0 },
  { label: "Georgian", x: "78%", y: "22%", delay: 0.4 },
  { label: "BDC Capital", x: "12%", y: "72%", delay: 0.8 },
  { label: "Real Ventures", x: "72%", y: "68%", delay: 1.1 },
  { label: "Portage", x: "84%", y: "48%", delay: 0.2 },
];

export function CoverPage({ onExplore }: { onExplore: () => void }) {
  return (
    <section className="relative flex h-screen min-h-screen w-full flex-col overflow-hidden bg-[#05070d] text-white">
      <div className="cover-aurora pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#05070d_72%)]" />

      {vcBadges.map((badge) => (
        <motion.div
          key={badge.label}
          className="pointer-events-none absolute hidden rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 shadow-[0_0_24px_rgba(196,30,58,0.25)] backdrop-blur md:block"
          style={{ left: badge.x, top: badge.y }}
          animate={{ y: [0, -12, 0], opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 5.5, delay: badge.delay, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="inline-flex items-center gap-1.5">
            <Landmark className="h-3.5 w-3.5 text-rose-300" />
            {badge.label}
          </span>
        </motion.div>
      ))}

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center"
        >
          <Logo variant="onDark" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.6 }}
          className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl lg:text-7xl"
        >
          Right Time. Right Company.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 sm:text-lg sm:leading-8"
        >
          Don&apos;t burn out in a stagnant company. Join before the curve spikes. SurgeJob tracks
          real-time funding, headcount expansion, and growth momentum to bring you in during the
          golden window.
        </motion.p>

        <ul className="mt-6 flex w-full max-w-3xl flex-wrap items-center justify-center gap-2">
          {featurePills.map((pill, index) => {
            const Icon = pill.icon;
            return (
              <motion.li
                key={pill.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 + index * 0.1 }}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white/90 backdrop-blur sm:px-4 sm:py-2 sm:text-sm"
              >
                <Icon className="h-4 w-4 text-rose-300" />
                {pill.title}
              </motion.li>
            );
          })}
        </ul>
      </div>

      <div className="relative z-10 pb-6 sm:pb-10">
        <motion.button
          type="button"
          onClick={onExplore}
          className="mx-auto flex flex-col items-center gap-1 text-sm font-medium text-white/80 hover:text-white"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          Scroll Down / Explore Board
          <ChevronDown className="h-5 w-5" />
        </motion.button>
      </div>
    </section>
  );
}

const COVER_FADE_RANGE_PX = 500;
const COVER_LIFT_PX = -180;

export function CoverBoardStage({ board }: { board: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [coverInteractive, setCoverInteractive] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);
  const { scrollY } = useScroll();
  const smoothScrollY = useSpring(scrollY, {
    stiffness: 140,
    damping: 32,
    mass: 0.28,
    restDelta: 0.001,
  });

  const coverOpacity = useTransform(smoothScrollY, [0, COVER_FADE_RANGE_PX], [1, 0]);
  const coverY = useTransform(smoothScrollY, [0, COVER_FADE_RANGE_PX], [0, COVER_LIFT_PX]);
  const boardOpacity = useTransform(smoothScrollY, [40, COVER_FADE_RANGE_PX], [0.12, 1]);
  const boardY = useTransform(smoothScrollY, [0, COVER_FADE_RANGE_PX], [28, 0]);
  const boardScale = useTransform(smoothScrollY, [0, COVER_FADE_RANGE_PX], [0.985, 1]);

  useMotionValueEvent(scrollY, "change", (value) => {
    setCoverInteractive(value < COVER_FADE_RANGE_PX * 0.35);
  });

  const explore = () => {
    setCoverInteractive(false);
    window.scrollTo({ top: COVER_FADE_RANGE_PX, behavior: "smooth" });
  };

  if (!mounted) {
    return (
      <div className="h-screen">
        <CoverPage onExplore={() => undefined} />
      </div>
    );
  }

  return (
    <div ref={stageRef} className="relative h-[200vh]">
      <div className="sticky top-0 h-screen overflow-hidden bg-slate-50">
        <motion.div
          className="absolute inset-0 z-10 transform-gpu will-change-transform"
          style={{ y: boardY, scale: boardScale, opacity: boardOpacity }}
        >
          <div className="h-screen overflow-y-auto">{board}</div>
        </motion.div>
        <motion.div
          aria-hidden={!coverInteractive}
          className={`absolute inset-0 z-20 transform-gpu will-change-transform ${
            coverInteractive ? "" : "pointer-events-none"
          }`}
          style={{
            y: coverY,
            opacity: coverOpacity,
            pointerEvents: coverInteractive ? "auto" : "none",
          }}
        >
          <CoverPage onExplore={explore} />
        </motion.div>
      </div>
    </div>
  );
}
