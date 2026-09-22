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
  companies as seedCompanies,
  getCompany,
  getRole,
  roleForCompany,
  roles,
  setLiveCompanies,
} from "./seed";
import {
  fundingMatches,
  industryMatches,
  isOpenFilter,
  locationMatches,
  sizeMatches,
} from "./filterMatch";
import type { Company, Filters, SavedApplication, SavedStatus, View } from "./types";
import {
  fetchSavedCompanyIds,
  fetchSessionUser,
  removeSavedCompanyForUser,
  saveCompanyForUser,
  signOutSupabase,
  type AuthUser,
} from "./userSavedJobs";
import { getSupabaseBrowser } from "./supabaseBrowser";

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
  filters: Filters;
  fitNotes: Record<string, string>;
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
  user: AuthUser | null;
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
  filteredCompanies: Company[];
  companies: Company[];
  compareEnabled: boolean;
};

const StoreContext = createContext<Store | null>(null);

function companyRoleLocations(company: Company) {
  return (company.peerRoles || []).map((r) => r.location).filter(Boolean);
}

function matchesFilters(company: Company, filters: Filters) {
  const role = roleForCompany(company.id);

  if (!industryMatches(company.industry, filters.industry)) return false;
  if (!fundingMatches(company.fundingRound, filters.funding)) return false;
  if (!locationMatches(company.location, filters.location, companyRoleLocations(company))) {
    return false;
  }
  if (!sizeMatches(company.headcount, filters.size)) return false;
  if (filters.rating === "4.0+" && (company.glassdoorRating === null || company.glassdoorRating < 4)) {
    return false;
  }
  if (filters.rating === "4.3+" && (company.glassdoorRating === null || company.glassdoorRating < 4.3)) {
    return false;
  }
  if (!isOpenFilter(filters.roleStatus)) {
    if (!role) return false;
    if (normalizeRoleStatus(filters.roleStatus) !== role.status) return false;
  }
  return true;
}

function normalizeRoleStatus(value: string) {
  return value.trim().toLowerCase() === "stale" ? "stale" : "active";
}

export function StoreProvider({
  children,
  initialCompanies,
}: {
  children: React.ReactNode;
  initialCompanies: Company[];
}) {
  setLiveCompanies(initialCompanies);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>({ name: "dashboard" });
  const [filters, setFiltersState] = useState<Filters>(defaultFilters);
  const [selectedCompanyIds, setSelected] = useState<string[]>([]);
  const [favoriteCompanyIds, setFavorites] = useState<string[]>([]);
  const [expandedIds, setExpanded] = useState<string[]>([]);
  const [saved, setSaved] = useState<SavedApplication[]>([]);
  const [fitNotes, setFitNotesState] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [detailCompanyId, setDetailCompanyId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Persisted;
        setSelected(parsed.selectedCompanyIds ?? []);
        setFitNotesState(parsed.fitNotes ?? {});
        setFiltersState({ ...defaultFilters, ...parsed.filters });
      }
    } catch {
      /* ignore */
    }
    setReady(true);
    const timer = window.setTimeout(() => setLoading(false), 700);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const payload: Persisted = {
      selectedCompanyIds,
      fitNotes,
      filters,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [ready, selectedCompanyIds, fitNotes, filters]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Bind session + saved companies to auth.users.id
  useEffect(() => {
    let cancelled = false;

    async function hydrateAuth() {
      const sessionUser = await fetchSessionUser();
      if (cancelled) return;
      setUser(sessionUser);
      if (sessionUser) {
        const ids = await fetchSavedCompanyIds(sessionUser.id);
        if (!cancelled) setFavorites(ids);
      } else {
        setFavorites([]);
        setSaved([]);
      }
    }

    hydrateAuth();

    let unsubscribe: (() => void) | undefined;
    try {
      const supabase = getSupabaseBrowser();
      const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (cancelled) return;
        if (!session?.user) {
          setUser(null);
          setFavorites([]);
          setSaved([]);
          return;
        }
        const nextUser = await fetchSessionUser();
        if (cancelled) return;
        setUser(nextUser);
        if (nextUser) {
          const ids = await fetchSavedCompanyIds(nextUser.id);
          if (!cancelled) setFavorites(ids);
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      /* missing anon key in some envs */
    }

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const filteredCompanies = useMemo(
    () => initialCompanies.filter((c) => matchesFilters(c, filters)),
    [filters, initialCompanies],
  );

  const compareEnabled =
    filteredCompanies.filter((c) => selectedCompanyIds.includes(c.id)).length >= 2;

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

  const openAuth = useCallback((mode: AuthMode) => {
    setAuthMode(mode);
  }, []);

  const toggleFavorite = useCallback(
    (companyId: string) => {
      if (!user) {
        setAuthMode("login");
        setToast("Log in with Google to save companies.");
        return;
      }
      const company = getCompany(companyId);
      const isSaved = favoriteCompanyIds.includes(companyId);
      setFavorites((prev) =>
        isSaved ? prev.filter((id) => id !== companyId) : [...prev, companyId],
      );
      void (async () => {
        try {
          if (isSaved) {
            await removeSavedCompanyForUser(user.id, companyId);
            setToast("Removed from saved.");
          } else {
            await saveCompanyForUser(user.id, companyId, company?.name);
            setToast("Saved to your account.");
          }
        } catch (error) {
          console.warn("[saved] sync failed:", error);
          setToast("Could not sync saved jobs. Check Supabase auth / user_saved_jobs.");
          // Revert optimistic update
          setFavorites((prev) =>
            isSaved ? [...prev, companyId] : prev.filter((id) => id !== companyId),
          );
        }
      })();
    },
    [user, favoriteCompanyIds],
  );

  const login = useCallback((name: string, email: string) => {
    // Local fallback when OAuth is unavailable — still no persisted saved jobs without auth.users.id
    setUser({ id: `local-${email}`, name, email });
    setAuthMode(null);
    setFavorites([]);
    setToast(`Welcome${name ? `, ${name}` : ""}. Use Google to sync saved jobs.`);
  }, []);

  const logout = useCallback(() => {
    void signOutSupabase().catch(() => undefined);
    setUser(null);
    setFavorites([]);
    setSaved([]);
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
      if (!user) {
        setAuthMode("login");
        setToast("Log in with Google to save applications.");
        return;
      }
      const role = getRole(roleId);
      const company = role ? getCompany(role.companyId) : undefined;
      if (!role || !company) return;
      const notes = fitNotes[roleId] ?? "";
      const evidenceSummary = buildEvidenceSummary(role, company);
      const today = new Date().toLocaleDateString("en-CA", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
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
      void saveCompanyForUser(user.id, company.id, company.name).catch(() => undefined);
      setFavorites((prev) => (prev.includes(company.id) ? prev : [...prev, company.id]));
      setToast("Saved to your account.");
    },
    [fitNotes, user],
  );

  const updateSavedStatus = useCallback((savedId: string, status: SavedStatus) => {
    setSaved((prev) => prev.map((item) => (item.id === savedId ? { ...item, status } : item)));
  }, []);

  const removeSaved = useCallback(
    (savedId: string) => {
      setSaved((prev) => {
        const item = prev.find((row) => row.id === savedId);
        if (item && user) {
          void removeSavedCompanyForUser(user.id, item.companyId).catch(() => undefined);
          setFavorites((favs) => favs.filter((id) => id !== item.companyId));
        }
        return prev.filter((row) => row.id !== savedId);
      });
    },
    [user],
  );

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
    companies: initialCompanies,
    compareEnabled,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export { seedCompanies as companies, roles, getCompany, getRole, roleForCompany };
