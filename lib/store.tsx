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
  hasOpenRoles,
  industryMatches,
  isOpenFilter,
  sizeMatches,
} from "./filterMatch";
import { companyMatchesLocation } from "./companyLocations";
import { signInWithGoogle as signInWithGoogleRequest, userFromSession } from "./auth";
import { addSavedJob, fetchSavedCompanyIds, removeSavedJob } from "./savedJobs";
import { supabase } from "./supabaseClient";
import type { AuthUser } from "./auth";
import type { Company, Filters, SavedApplication, SavedStatus, View } from "./types";

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
  // Saved jobs/favorites are bound to the user's Supabase account, not localStorage.
  saved: SavedApplication[];
  fitNotes: Record<string, string>;
  filters: Filters;
  user: AuthUser | null;
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
  signInWithGoogle: () => Promise<{ error: Error | null }>;
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

function matchesFilters(companyId: string, filters: Filters) {
  const company = getCompany(companyId);
  if (!company) return false;
  // Defense-in-depth: never surface companies without open roles on the board.
  if (!hasOpenRoles(company)) return false;
  const role = roleForCompany(companyId);

  if (!industryMatches(company.industry, filters.industry)) return false;
  if (!fundingMatches(company.fundingRound, filters.funding)) return false;
  if (!companyMatchesLocation(company, roles, filters.location)) return false;
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
  // Saved applications and saved jobs/favorites start empty (Saved 0) by default.
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
        // Favorites are account-bound (Supabase), never restored from localStorage.
        setSaved(parsed.saved ?? []);
        setFitNotesState(parsed.fitNotes ?? {});
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
    let active = true;

    // Pull the user's saved jobs from Supabase so state persists across devices.
    const hydrateSavedJobs = (sessionUser: AuthUser | null) => {
      if (!sessionUser?.id) return;
      fetchSavedCompanyIds(supabase, sessionUser.id)
        .then((ids) => {
          if (active) setFavorites(ids);
        })
        .catch(() => {
          /* Unreachable auth/db (e.g. local placeholder); leave favorites as-is. */
        });
    };

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        const sessionUser = userFromSession(data.session);
        if (sessionUser) {
          setUser(sessionUser);
          hydrateSavedJobs(sessionUser);
        }
      })
      .catch(() => {
        /* No reachable auth server (e.g. local placeholder); keep local user. */
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      const sessionUser = userFromSession(session);
      if (sessionUser) {
        setUser(sessionUser);
        hydrateSavedJobs(sessionUser);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setFavorites([]);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const payload: Persisted = {
      selectedCompanyIds,
      saved,
      fitNotes,
      filters,
      user,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [ready, selectedCompanyIds, saved, fitNotes, filters, user]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredCompanies = useMemo(
    () => initialCompanies.filter((c) => matchesFilters(c.id, filters)),
    [filters, initialCompanies],
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

  const toggleFavorite = useCallback(
    (companyId: string) => {
      // Guests (or users without a Supabase account) are prompted to log in.
      if (!user?.id) {
        setToast("Please log in to save jobs to your account.");
        setAuthMode("login");
        return;
      }

      const wasSaved = favoriteCompanyIds.includes(companyId);
      // Optimistic UI update, then sync to Supabase (revert on failure).
      setFavorites((prev) =>
        wasSaved ? prev.filter((id) => id !== companyId) : [...prev, companyId],
      );

      const sync = wasSaved
        ? removeSavedJob(supabase, user.id, companyId)
        : addSavedJob(supabase, user.id, companyId);

      sync.catch(() => {
        setFavorites((prev) =>
          wasSaved
            ? prev.includes(companyId)
              ? prev
              : [...prev, companyId]
            : prev.filter((id) => id !== companyId),
        );
        setToast("Couldn't sync your saved jobs. Please try again.");
      });
    },
    [user, favoriteCompanyIds],
  );

  const openAuth = useCallback((mode: AuthMode) => {
    setAuthMode(mode);
  }, []);

  const login = useCallback((name: string, email: string) => {
    // Simulated local login (no Supabase account): id is empty, so saving still
    // prompts a real Google sign-in. Real accounts arrive via signInWithGoogle.
    setUser({ id: "", name, email, avatarUrl: null });
    setAuthMode(null);
    setToast(`Welcome${name ? `, ${name}` : ""}.`);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
    try {
      const { error } = await signInWithGoogleRequest(supabase, redirectTo);
      if (error) {
        setToast(`Google sign-in failed: ${error.message}`);
        return { error };
      }
      return { error: null };
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      setToast(`Google sign-in failed: ${normalized.message}`);
      return { error: normalized };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      /* Ignore network errors from a placeholder/unreachable auth server. */
    }
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
    signInWithGoogle,
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
