"use client";

import { ApplicationSummary } from "./ApplicationSummary";
import { AuthModal } from "./AuthModal";
import { Comparison } from "./Comparison";
import { CompanyDetailModal } from "./CompanyDetailModal";
import { CoverBoardStage } from "./CoverPage";
import { Dashboard } from "./Dashboard";
import { Header } from "./Header";
import { RoleDetail } from "./RoleDetail";
import { SavedApplications } from "./SavedApplications";
import { StoreProvider, useStore } from "@/lib/store";

function Toast() {
  const { toast } = useStore();
  if (!toast) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[100] rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
      {toast}
    </div>
  );
}

function Screens() {
  const { view } = useStore();
  return (
    <>
      {view.name === "dashboard" ? (
        <CoverBoardStage board={<Dashboard />} />
      ) : (
        <div className="pt-16">
          {view.name === "role" ? <RoleDetail /> : null}
          {view.name === "compare" ? <Comparison /> : null}
          {view.name === "apply" ? <ApplicationSummary /> : null}
          {view.name === "saved" ? <SavedApplications /> : null}
        </div>
      )}
    </>
  );
}

function Shell() {
  return (
    <div className="flex min-h-full flex-col bg-slate-50 font-sans text-slate-900">
      <Header />
      <main className="flex-1">
        <Screens />
      </main>
      <footer className="relative z-0 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Seeded records for a hiring-trust prototype. Not a live job board.</p>
        </div>
      </footer>
      <AuthModal />
      <CompanyDetailModal />
      <Toast />
    </div>
  );
}

export function SurgeJobApp() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
