"use client";

import { Heart, Landmark, ShieldAlert, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";

const reasons = [
  {
    title: "Skip Ghost Jobs",
    copy: "Every card shows posted date, last checked, and a stale warning when the listing is no longer current.",
  },
  {
    title: "Save Top SME Startups",
    copy: "Favorite newly funded Canadian companies and keep fit notes when you leave to apply.",
  },
  {
    title: "Get Instant Funding Alerts",
    copy: "Track VC rounds and growth signals before public recruiters flood the same ATS.",
  },
];

export function AuthModal() {
  const { authMode, openAuth, login, notify } = useStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [googleStatus, setGoogleStatus] = useState<string | null>(null);

  if (!authMode) return null;
  const isSignup = authMode === "signup";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-labelledby="auth-title"
        className="grid w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl md:grid-cols-[1.05fr_0.95fr]"
      >
        <aside className="hidden bg-slate-950 px-7 py-8 text-white md:block">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-300">
            Why Join SurgeJob?
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">Hire the signal, not the noise.</h2>
          <ul className="mt-6 space-y-5">
            {reasons.map((reason) => (
              <li key={reason.title} className="flex gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                <div>
                  <p className="font-medium">{reason.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">{reason.copy}</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>
        <form
          className="relative p-6 sm:p-8"
          onSubmit={(e) => {
            e.preventDefault();
            login(name.trim() || email.split("@")[0], email.trim());
          }}
        >
          <button
            type="button"
            onClick={() => openAuth(null)}
            className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#c41e3a]">
            <Landmark className="h-3.5 w-3.5" /> SurgeJob.ca
          </p>
          <h3 id="auth-title" className="mt-2 text-xl font-semibold text-slate-900">
            {isSignup ? "Create your account" : "Log in"}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Simulated auth for this prototype. Favorites persist in this browser.
          </p>
          <button
            type="button"
            onClick={() => {
              console.log("Google OAuth initiated");
              setGoogleStatus("Google OAuth initiated");
              notify("Google OAuth initiated");
            }}
            className="mt-5 flex w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow"
          >
            <GoogleMark />
            Continue with Google
          </button>
          {googleStatus ? (
            <p className="mt-2 rounded-lg bg-slate-900 px-3 py-2 text-center text-xs font-medium text-white">
              {googleStatus}
            </p>
          ) : null}
          <div className="my-4 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-semibold tracking-wide text-slate-400">OR</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          {isSignup ? (
            <label className="block text-sm font-medium text-slate-700">
              Name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[#c41e3a] focus:ring-2"
              />
            </label>
          ) : null}
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[#c41e3a] focus:ring-2"
            />
          </label>
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Password
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[#c41e3a] focus:ring-2"
            />
          </label>
          <p className="mt-3 flex items-start gap-2 text-xs text-slate-400">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            No live identity provider. Anything you type stays local.
          </p>
          <button
            type="submit"
            className="mt-5 w-full rounded-lg bg-[#c41e3a] py-2.5 text-sm font-medium text-white hover:bg-[#a81830]"
          >
            {isSignup ? "Sign up" : "Log in"}
          </button>
          <button
            type="button"
            onClick={() => openAuth(isSignup ? "login" : "signup")}
            className="mt-3 w-full text-center text-sm text-slate-500 hover:text-slate-800"
          >
            {isSignup ? "Already have an account? Log in" : "Need an account? Sign up"}
          </button>
        </form>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.8-6.6 7.5l6.3 5.3C38.2 37.3 44 31.5 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

export function FavoriteButton({ companyId, companyName }: { companyId: string; companyName: string }) {
  const { favoriteCompanyIds, toggleFavorite } = useStore();
  const active = favoriteCompanyIds.includes(companyId);
  return (
    <button
      type="button"
      onClick={() => toggleFavorite(companyId)}
      aria-pressed={active}
      aria-label={active ? `Unfavorite ${companyName}` : `Favorite ${companyName}`}
      className={`rounded-full border p-2 transition ${
        active
          ? "border-rose-200 bg-rose-50 text-rose-600"
          : "border-slate-200 bg-white text-slate-400 hover:text-rose-500"
      }`}
    >
      <Heart className={`h-4 w-4 ${active ? "fill-rose-500" : ""}`} />
    </button>
  );
}
