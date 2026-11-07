import type { Application } from '@/db/schema';

export const APPLICATION_STATUSES = ['APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_TYPES = ['Job', 'Internship'] as const;
export type ApplicationType = (typeof APPLICATION_TYPES)[number];

export const PLATFORMS = [
  'LinkedIn',
  'Jobstreet',
  'Glints',
  'MagangHub (Kemnaker)',
  'Kalibrr',
  'Indeed',
  'Company Website',
  'Instagram / Social Media',
  'Referral / Kenalan',
  'Other',
] as const;
export type Platform = (typeof PLATFORMS)[number];

// API responses use ISO strings rather than the database driver's Date objects.
export type ApplicationItem = Omit<Application, 'type' | 'status' | 'appliedAt' | 'updatedAt'> & {
  type: ApplicationType;
  status: ApplicationStatus;
  appliedAt: string;
  updatedAt: string;
};

const NEXT_STATUS: Record<ApplicationStatus, ApplicationStatus> = {
  APPLIED: 'INTERVIEW',
  INTERVIEW: 'OFFER',
  OFFER: 'REJECTED',
  REJECTED: 'APPLIED',
};

export function nextStatus(status: ApplicationStatus): ApplicationStatus {
  return NEXT_STATUS[status];
}

export type ApplicationFilters = {
  query: string;
  platform: Platform | '';
  type: ApplicationType | '';
};

export const EMPTY_FILTERS: ApplicationFilters = { query: '', platform: '', type: '' };

export function hasActiveFilters(filters: ApplicationFilters): boolean {
  return filters.query.trim() !== '' || filters.platform !== '' || filters.type !== '';
}

/**
 * Search matches title or company, case-insensitive; every whitespace-separated word
 * must appear (so "acme intern" finds "Frontend Intern" at "Acme"). Platform and type
 * are exact matches; empty means "any". All active conditions must hold.
 */
export function matchesFilters(
  application: Pick<ApplicationItem, 'title' | 'company' | 'platform' | 'type'>,
  filters: ApplicationFilters,
): boolean {
  if (filters.platform && application.platform !== filters.platform) return false;
  if (filters.type && application.type !== filters.type) return false;
  const words = filters.query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = `${application.title} ${application.company}`.toLocaleLowerCase();
  return words.every((word) => haystack.includes(word));
}

export function filterApplications<T extends Pick<ApplicationItem, 'title' | 'company' | 'platform' | 'type'>>(
  applications: readonly T[],
  filters: ApplicationFilters,
): T[] {
  return hasActiveFilters(filters) ? applications.filter((item) => matchesFilters(item, filters)) : [...applications];
}

export type ApplicationStats = { total: number; active: number; inProgress: number; offers: number };

/** Active = everything not archived; In progress = still awaiting an outcome. */
export function computeStats(applications: readonly Pick<ApplicationItem, 'status'>[]): ApplicationStats {
  const stats: ApplicationStats = { total: applications.length, active: 0, inProgress: 0, offers: 0 };
  for (const { status } of applications) {
    if (status !== 'REJECTED') stats.active++;
    if (status === 'APPLIED' || status === 'INTERVIEW') stats.inProgress++;
    if (status === 'OFFER') stats.offers++;
  }
  return stats;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return 'Unknown date';
  const hours = Math.floor(Math.max(0, now - timestamp) / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
