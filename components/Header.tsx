"use client";

import { Bookmark, GitCompare, Heart, LogOut, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { Logo } from "./Logo";

export function Header() {
  const {
    view,
    setView,
    selectedCompanyIds,
    compareEnabled,
    saved,
    favoriteCompanyIds,
    user,
    signInWithGoogle,
    logout,
  } = useStore();
  const compareCount = selectedCompanyIds.length;

  function initialsFrom(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "SJ";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => setView({ name: "dashboard" })}
          className="shrink-0 text-left"
          aria-label="SurgeJob.ca"
        >
          <Logo variant="onLight" compact />
        </button>
        <nav className="flex min-w-0 items-center justify-end gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setView({ name: "compare" })}
            disabled={!compareEnabled && view.name !== "compare"}
            title={
              compareEnabled
                ? "Compare selected companies"
                : "Select at least two companies that match the current filters"
            }
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
              view.name === "compare"
                ? "bg-slate-900 text-white"
                : compareEnabled
                  ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  : "cursor-not-allowed border border-slate-100 bg-slate-50 text-slate-400"
            }`}
          >
            <GitCompare className="h-4 w-4" />
            <span className="hidden sm:inline">Compare</span>
            <span className="rounded-full bg-slate-100 px-1.5 text-xs text-slate-700">
              {compareCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setView({ name: "saved" })}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
              view.name === "saved"
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            aria-label={`Saved applications ${saved.length}, favorites ${favoriteCompanyIds.length}`}
          >
            <Bookmark className="h-4 w-4" />
            <span className="hidden sm:inline">Saved</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 text-xs text-slate-700">
              {saved.length}
              <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
              {favoriteCompanyIds.length}
            </span>
          </button>
          {user ? (
            <div className="flex items-center gap-2">
              <span
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3"
                title={user.email || user.name}
              >
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    referrerPolicy="no-referrer"
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c41e3a] text-xs font-semibold text-white">
                    {initialsFrom(user.name)}
                  </span>
                )}
                <span className="hidden max-w-[9rem] truncate text-sm font-medium text-slate-700 sm:block">
                  {user.name}
                </span>
              </span>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => signInWithGoogle()}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => signInWithGoogle()}
                className="rounded-lg bg-[#c41e3a] px-3 py-2 text-sm font-medium text-white hover:bg-[#a81830]"
              >
                Sign Up
              </button>
            </>
          )}
        </nav>
      </div>
      {!compareEnabled && selectedCompanyIds.length > 0 && view.name === "dashboard" ? (
        <div className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900 sm:px-6">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Comparison stays disabled until two filtered companies are selected.
          </span>
        </div>
      ) : null}
    </header>
  );
}
