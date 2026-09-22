/**
 * Hiring / role freshness helpers for SurgeJob.
 */

export type RoleLike = {
  postedAt?: string | null;
  posted_at?: string | null;
  posted_date?: string | null;
  postedDate?: string | null;
};

/** Parse ISO / date-y strings to a comparable YYYY-MM-DD (UTC). */
export function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = String(value).trim();
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

/** Latest posted_at across open roles (ISO date string or null). */
export function aggregateLatestPostedAt(
  roles: RoleLike[] | null | undefined,
): string | null {
  if (!Array.isArray(roles) || roles.length === 0) return null;
  let latest: string | null = null;
  for (const role of roles) {
    const candidate = toIsoDate(
      role.postedAt ?? role.posted_at ?? role.posted_date ?? role.postedDate ?? null,
    );
    if (!candidate) continue;
    if (!latest || candidate > latest) latest = candidate;
  }
  return latest;
}

/**
 * Human label for a freshness ISO date, e.g. "Updated 2d ago".
 */
export function formatFreshnessLabel(
  freshnessDate: string | null | undefined,
  options?: { openRoleCount?: number; hasPeerRoles?: boolean },
): string {
  const iso = toIsoDate(freshnessDate ?? null);
  if (iso) {
    const then = Date.parse(`${iso}T00:00:00Z`);
    if (!Number.isNaN(then)) {
      const days = Math.max(0, Math.round((Date.now() - then) / (1000 * 60 * 60 * 24)));
      if (days <= 0) return "Updated today";
      if (days === 1) return "Updated 1d ago";
      if (days < 7) return `Updated ${days}d ago`;
      if (days < 30) {
        const weeks = Math.max(1, Math.round(days / 7));
        return `Updated ${weeks}w ago`;
      }
      if (days < 365) {
        const months = Math.max(1, Math.round(days / 30));
        return `Updated ${months}mo ago`;
      }
      return `Updated ${iso}`;
    }
  }

  const openRoles = Number(options?.openRoleCount || 0);
  if (openRoles > 0 || options?.hasPeerRoles) return "Active Hiring Signal";
  return "Not available";
}

export function resolveCompanyFreshness(company: {
  freshness?: string | null;
  freshnessDate?: string | null;
  peerRoles?: RoleLike[] | null;
  openRoleCount?: number;
}): { freshnessDate: string | null; freshnessLabel: string } {
  const fromField = toIsoDate(company.freshness ?? company.freshnessDate ?? null);
  const fromRoles = aggregateLatestPostedAt(company.peerRoles);
  const freshnessDate =
    fromField && fromRoles
      ? fromField > fromRoles
        ? fromField
        : fromRoles
      : fromField || fromRoles;
  return {
    freshnessDate,
    freshnessLabel: formatFreshnessLabel(freshnessDate, {
      openRoleCount: company.openRoleCount,
      hasPeerRoles: (company.peerRoles?.length || 0) > 0,
    }),
  };
}
