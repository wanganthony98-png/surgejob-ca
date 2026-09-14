"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  buildEvidenceSummary,
  companies,
  defaultSaved,
  getCompany,
  getRole,
  roleForCompany,
  roles,
} from "./seed";
import type { Filters, SavedApplication, SavedStatus, View } from "./types";

const STORAGE_KEY = "surgejob-v2";

const defaultFilters: Filters = {
  industry: "All industries",
  funding: "all",
  location: "all",
  size: "all",
  rating: "all",
  roleStatus: "all",
};

type Persisted = {
  selectedCompanyIds: string[];
  favoriteCompanyIds: string[];
  saved: SavedApplication[];
  fitNotes: Record<string, string>;
  filters: Filters;
  user: { name: string; email: string } | null;
};

type AuthMode = "login" | "signup" | null;

type Store = {
  ready: boolean;
  loading: boolean;
  view: View;
  filters: Filters;
  selectedCompanyIds: string[];
  favoriteCompanyIds: string[];
  expandedIds: string[];
  saved: SavedApplication[];
  fitNotes: Record<string, string>;
  toast: string | null;
  user: { name: string; email: string } | null;
  authMode: AuthMode;
  setView: (view: View) => void;
  setFilters: (next: Partial<Filters> | Filters) => void;
  clearFilters: () => void;
  toggleSelect: (companyId: string) => void;
  removeSelect: (companyId: string) => void;
  toggleFavorite: (companyId: string) => void;
  toggleEvidence: (companyId: string) => void;
  setFitNotes: (roleId: string, notes: string) => void;
  saveApplication: (roleId: string, status: SavedStatus) => void;
  updateSavedStatus: (savedId: string, status: SavedStatus) => void;
  removeSaved: (savedId: string) => void;
  openAuth: (mode: AuthMode) => void;
  login: (name: string, email: string) => void;
  logout: () => void;
  notify: (message: string) => void;
  detailCompanyId: string | null;
  openCompanyDetail: (companyId: string) => void;
  closeCompanyDetail: () => void;
  filteredCompanies: typeof companies;
  compareEnabled: boolean;
};

const StoreContext = createContext<Store | null>(null);

function matchesFilters(companyId: string, filters: Filters) {
  const company = getCompany(companyId);
  const role = roleForCompany(companyId);
  if (!company || !role) return false;

  if (filters.industry !== "All industries" && company.industry !== filters.industry) {
    return false;
  }
  if (filters.funding !== "all" && company.fundingRound !== filters.funding) return false;
  if (filters.location !== "all" && company.location !== filters.location) return false;
  if (filters.size !== "all" && company.headcount !== filters.size) return false;
  if (filters.rating === "4.0+" && (company.glassdoorRating === null || company.glassdoorRating < 4)) {
    return false;
  }
  if (filters.rating === "4.3+" && (company.glassdoorRating === null || company.glassdoorRating < 4.3)) {
    return false;
  }
  if (filters.roleStatus === "active" && role.status !== "active") return false;
  if (filters.roleStatus === "stale" && role.status !== "stale") return false;
  return true;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>({ name: "dashboard" });
  const [filters, setFiltersState] = useState<Filters>(defaultFilters);
  const [selectedCompanyIds, setSelected] = useState<string[]>([]);
  const [favoriteCompanyIds, setFavorites] = useState<string[]>([]);
  const [expandedIds, setExpanded] = useState<string[]>([]);
  const [saved, setSaved] = useState<SavedApplication[]>(defaultSaved);
  const [fitNotes, setFitNotesState] = useState<Record<string, string>>({
    "maplestack-designer": defaultSaved[0].fitNotes,
  });
  const [toast, setToast] = useState<string | null>(null);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [detailCompanyId, setDetailCompanyId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Persisted;
        setSelected(parsed.selectedCompanyIds ?? []);
        setFavorites(parsed.favoriteCompanyIds ?? []);
        setSaved(parsed.saved?.length ? parsed.saved : defaultSaved);
        setFitNotesState(
          parsed.fitNotes ?? { "maplestack-designer": defaultSaved[0].fitNotes },
        );
        setFiltersState({ ...defaultFilters, ...parsed.filters });
        setUser(parsed.user ?? null);
      }
    } catch {
      /* keep seeds */
    }
    setReady(true);
    const timer = window.setTimeout(() => setLoading(false), 700);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const payload: Persisted = {
      selectedCompanyIds,
      favoriteCompanyIds,
      saved,
      fitNotes,
      filters,
      user,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [ready, selectedCompanyIds, favoriteCompanyIds, saved, fitNotes, filters, user]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredCompanies = useMemo(
    () => companies.filter((c) => matchesFilters(c.id, filters)),
    [filters],
  );

  const compareEnabled = filteredCompanies.filter((c) =>
    selectedCompanyIds.includes(c.id),
  ).length >= 2;

  const setFilters = useCallback((next: Partial<Filters> | Filters) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(defaultFilters);
  }, []);

  const toggleSelect = useCallback((companyId: string) => {
    setSelected((prev) =>
      prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId],
    );
  }, []);

  const removeSelect = useCallback((companyId: string) => {
    setSelected((prev) => prev.filter((id) => id !== companyId));
  }, []);

  const toggleFavorite = useCallback((companyId: string) => {
    setFavorites((prev) =>
      prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId],
    );
  }, []);

  const openAuth = useCallback((mode: AuthMode) => {
    setAuthMode(mode);
  }, []);

  const login = useCallback((name: string, email: string) => {
    setUser({ name, email });
    setAuthMode(null);
    setToast(`Welcome${name ? `, ${name}` : ""}. Favorites stay on this device.`);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToast("Signed out.");
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
  }, []);

  const openCompanyDetail = useCallback((companyId: string) => {
    setDetailCompanyId(companyId);
  }, []);

  const closeCompanyDetail = useCallback(() => {
    setDetailCompanyId(null);
  }, []);

  const toggleEvidence = useCallback((companyId: string) => {
    setExpanded((prev) =>
      prev.includes(companyId) ? prev.filter((id) => id !== companyId) : [...prev, companyId],
    );
  }, []);

  const setFitNotes = useCallback((roleId: string, notes: string) => {
    setFitNotesState((prev) => ({ ...prev, [roleId]: notes }));
  }, []);

  const saveApplication = useCallback(
    (roleId: string, status: SavedStatus) => {
      const role = getRole(roleId);
      const company = role ? getCompany(role.companyId) : undefined;
      if (!role || !company) return;
      const notes = fitNotes[roleId] ?? "";
      const evidenceSummary = buildEvidenceSummary(role, company);
      const today = "March 13, 2026";
      setSaved((prev) => {
        const existing = prev.find((item) => item.roleId === roleId);
        if (existing) {
          return prev.map((item) =>
            item.roleId === roleId
              ? { ...item, status, fitNotes: notes, evidenceSummary, savedDate: today }
              : item,
          );
        }
        return [
          {
            id: `saved-${roleId}`,
            roleId,
            companyId: company.id,
            status,
            savedDate: today,
            fitNotes: notes,
            evidenceSummary,
          },
          ...prev,
        ];
      });
      setToast("Saved. Fit notes and status are on Saved applications.");
    },
    [fitNotes],
  );

  const updateSavedStatus = useCallback((savedId: string, status: SavedStatus) => {
    setSaved((prev) => prev.map((item) => (item.id === savedId ? { ...item, status } : item)));
  }, []);

  const removeSaved = useCallback((savedId: string) => {
    setSaved((prev) => prev.filter((item) => item.id !== savedId));
  }, []);

  const value: Store = {
    ready,
    loading,
    view,
    filters,
    selectedCompanyIds,
    favoriteCompanyIds,
    expandedIds,
    saved,
    fitNotes,
    toast,
    user,
    authMode,
    setView,
    setFilters,
    clearFilters,
    toggleSelect,
    removeSelect,
    toggleFavorite,
    toggleEvidence,
    setFitNotes,
    saveApplication,
    updateSavedStatus,
    removeSaved,
    openAuth,
    login,
    logout,
    notify,
    detailCompanyId,
    openCompanyDetail,
    closeCompanyDetail,
    filteredCompanies,
    compareEnabled,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export { companies, roles, getCompany, getRole, roleForCompany };
