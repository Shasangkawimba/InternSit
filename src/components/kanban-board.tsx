'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, Briefcase, Clock, ExternalLink, MapPin, Plus, RefreshCw, Search } from 'lucide-react';
import {
  APPLICATION_TYPES,
  EMPTY_FILTERS,
  PLATFORMS,
  computeStats,
  filterApplications,
  hasActiveFilters,
  matchesFilters,
  nextStatus,
  previousStatus,
  timeAgo,
  type ApplicationFilters,
  type ApplicationItem,
  type ApplicationStatus,
} from '@/lib/applications';
import { ApiError, listApplications, updateApplicationStatus } from '@/lib/applications-client';
import { ApplicationModal } from '@/components/application-modal';

// Monochrome on purpose: wireframe gray→dark gray—primary tone only, no per-status colors.
const STATUS_STYLE: Record<ApplicationStatus, { label: string; dot: string; text: string }> = {
  APPLIED: { label: 'APPLIED', dot: 'bg-primary', text: 'text-on-surface' },
  INTERVIEW: { label: 'INTERVIEWING', dot: 'bg-primary', text: 'text-on-surface' },
  OFFER: { label: 'OFFER', dot: 'bg-primary', text: 'text-on-surface' },
  REJECTED: { label: 'REJECTED', dot: 'bg-outline', text: 'text-on-surface-variant' },
};

const ACTIVE_STAGES = ['APPLIED', 'INTERVIEW', 'OFFER'] as const;
const filterFieldClass = 'w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-base text-on-surface outline-none placeholder:text-on-surface-variant/70 focus:border-input-focus sm:text-sm';
const actionClass = 'inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

function redirectToLogin() {
  window.location.replace('/login');
}

function ApplicationCard({ application, now, pending, dragging, onDragStart, onDragEnd, onChangeStatus, onEdit }: {
  application: ApplicationItem;
  now: number | null;
  pending: boolean;
  dragging: boolean;
  onDragStart: (application: ApplicationItem) => void;
  onDragEnd: () => void;
  onChangeStatus: (application: ApplicationItem, status: ApplicationStatus) => void;
  onEdit: (application: ApplicationItem) => void;
}) {
  const style = STATUS_STYLE[application.status];
  const next = STATUS_STYLE[nextStatus(application.status)].label;
  const previous = previousStatus(application.status);

  return (
    <article
      aria-labelledby={`application-${application.id}`}
      draggable={!pending}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', application.id);
        onDragStart(application);
      }}
      onDragEnd={onDragEnd}
      // Mouse convenience only; keyboard and screen-reader users use the title button.
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest('a, button')) onEdit(application);
      }}
      className={`min-w-0 cursor-grab rounded-xl border-2 border-outline bg-surface-lowest p-4 transition-colors hover:border-primary active:cursor-grabbing ${dragging ? 'opacity-40' : ''} ${pending ? 'cursor-wait' : ''}`}
    >
      <h3 className="text-sm font-semibold">
        <button
          type="button"
          id={`application-${application.id}`}
          onClick={() => onEdit(application)}
          disabled={pending}
          title={application.title}
          aria-label={`Edit ${application.title} at ${application.company}`}
          className="line-clamp-1 w-full rounded text-left font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait"
        >
          {application.title}
        </button>
      </h3>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-outline-variant bg-surface-low px-2 py-0.5 text-[11px] text-on-surface-variant">{application.type}</span>
        <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] ${style.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
          {style.label}
        </span>
      </div>
      <div className="mt-4 space-y-2 text-xs text-on-surface-variant">
        <p className="flex items-start gap-2">
          <Briefcase className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{application.company}</span>
        </p>
        <p className="break-words font-mono text-[11px]">{application.platform}</p>
        {application.location && (
          <p className="flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{application.location}</span>
          </p>
        )}
        <p className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <time dateTime={application.appliedAt} title={application.appliedAt}>
            {now === null ? 'Applied' : timeAgo(application.appliedAt, now)}
          </time>
        </p>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-outline-variant pt-2">
        <div>
          {application.url && (
            <a href={application.url} target="_blank" rel="noopener noreferrer" className={actionClass} aria-label={`Open application link for ${application.title} at ${application.company} (new tab)`}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Link
            </a>
          )}
        </div>
        <div className="flex items-center gap-1">
          {previous && (
            <button
              type="button"
              onClick={() => onChangeStatus(application, previous)}
              disabled={pending}
              className={`${actionClass} disabled:cursor-wait disabled:opacity-50`}
              title={`Move back to ${STATUS_STYLE[previous].label}`}
              aria-label={`Move ${application.title} at ${application.company} back to ${STATUS_STYLE[previous].label}`}
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {STATUS_STYLE[previous].label}
            </button>
          )}
          <button type="button" onClick={() => onChangeStatus(application, nextStatus(application.status))} disabled={pending} className={`${actionClass} disabled:cursor-wait disabled:opacity-50`} title={`Move to ${next}`} aria-label={`Move ${application.title} at ${application.company} to ${next}`}>
            Next <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      {application.notes && <p className="mt-3 line-clamp-2 break-words text-xs italic leading-relaxed text-on-surface-variant" title={application.notes}>{application.notes}</p>}
    </article>
  );
}

const statsGridClass = 'grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4';

function StatsHeader({ applications, filtered }: { applications: readonly ApplicationItem[]; filtered: boolean }) {
  const stats = computeStats(applications);
  const items = [
    { label: 'Total', value: stats.total },
    { label: 'Active', value: stats.active },
    { label: 'In Progress', value: stats.inProgress },
    { label: 'Offers', value: stats.offers },
  ];
  return (
    <dl aria-label={filtered ? 'Application statistics for current filters' : 'Application statistics'} className={statsGridClass}>
      {items.map(({ label, value }) => (
        <div key={label} className="rounded-xl border border-outline-variant bg-surface-lowest p-4">
          <dt className="font-mono text-[11px] uppercase tracking-widest text-on-surface-variant">{label}</dt>
          <dd className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function BoardSkeleton() {
  return (
    <div className="space-y-8" aria-hidden="true">
      <div className={statsGridClass}>
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-[84px] animate-pulse rounded-xl border border-outline-variant bg-surface-low motion-reduce:animate-none" />
        ))}
      </div>
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3 xl:gap-6">
        {ACTIVE_STAGES.map((status) => (
          <div key={status} className="space-y-4">
            <div className="h-8 border-b border-outline-variant" />
            {[0, 1].map((index) => (
              <div key={index} className="h-40 animate-pulse rounded-xl border-2 border-outline-variant bg-surface-low motion-reduce:animate-none" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

type LoadState = 'loading' | 'ready' | 'error';

export function KanbanBoard() {
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [actionError, setActionError] = useState('');
  const [now, setNow] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ApplicationItem | null>(null);
  const [filters, setFilters] = useState<ApplicationFilters>(EMPTY_FILTERS);
  const [notice, setNotice] = useState('');
  // Drag and drop: the id travels with both state and dataTransfer (state is the
  // reliable source; dataTransfer covers cross-page drags and strict-mode replays).
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<ApplicationStatus | null>(null);
  const applicationsRef = useRef<ApplicationItem[]>([]);
  applicationsRef.current = applications;

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadState('loading');
    try {
      const items = await listApplications(signal);
      setApplications(items);
      setLoadState('ready');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (error instanceof ApiError && error.status === 401) return redirectToLogin();
      setLoadError(error instanceof Error ? error.message : 'Could not load applications.');
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Compute relative times after hydration so server/client clocks cannot mismatch.
  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  function openEdit(application: ApplicationItem) {
    if (pendingIds.has(application.id)) return;
    setActionError('');
    setEditing(application);
  }

  function closeModal() {
    setAddOpen(false);
    setEditing(null);
  }

  function handleSaved(application: ApplicationItem, mode: 'created' | 'updated') {
    const label = `${application.title} at ${application.company}`;
    // Tell the user when their change disappeared from view because of an active filter.
    setNotice(
      matchesFilters(application, filters)
        ? ''
        : `${label} was ${mode === 'created' ? 'added' : 'updated'} but is hidden by the current filters.`,
    );
    if (mode === 'created') {
      // New rows have the newest applied_at, so they belong at the top (matches API ordering).
      setApplications((current) => [application, ...current]);
      setAnnouncement(`${label} added to ${STATUS_STYLE[application.status].label}.`);
    } else {
      setApplications((current) => current.map((item) => item.id === application.id ? application : item));
      setAnnouncement(`${label} updated. Stage: ${STATUS_STYLE[application.status].label}.`);
    }
  }

  function handleDeleted(id: string, reason: 'deleted' | 'missing') {
    const removed = applications.find((item) => item.id === id);
    const label = removed ? `${removed.title} at ${removed.company}` : 'The application';
    setApplications((current) => current.filter((item) => item.id !== id));
    if (reason === 'deleted') setAnnouncement(`${label} deleted.`);
    else setActionError(`${label} no longer exists and was removed from the board.`);
  }

  async function changeStatus(application: ApplicationItem, status: ApplicationStatus) {
    if (pendingIds.has(application.id) || application.status === status) return;
    const previous = application.status;
    const label = `${application.title} at ${application.company}`;

    setActionError('');
    setPendingIds((current) => new Set(current).add(application.id));
    // Optimistic update; rolled back below if the server rejects it.
    setApplications((current) => current.map((item) => item.id === application.id ? { ...item, status } : item));

    try {
      const saved = await updateApplicationStatus(application.id, status);
      setApplications((current) => current.map((item) => item.id === saved.id ? saved : item));
      setAnnouncement(`${label} moved to ${STATUS_STYLE[saved.status].label}.`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return redirectToLogin();
      if (error instanceof ApiError && error.status === 404) {
        setApplications((current) => current.filter((item) => item.id !== application.id));
        setActionError(`${label} no longer exists and was removed from the board.`);
      } else {
        setApplications((current) => current.map((item) => item.id === application.id ? { ...item, status: previous } : item));
        setActionError(`Could not move ${label}. ${error instanceof Error ? error.message : ''}`.trim());
      }
    } finally {
      setPendingIds((current) => {
        const nextPending = new Set(current);
        nextPending.delete(application.id);
        return nextPending;
      });
    }
  }

  function handleDropStatus(status: ApplicationStatus, id: string | null) {
    setDragOverStatus(null);
    setDraggedId(null);
    if (!id) return;
    const application = applicationsRef.current.find((item) => item.id === id);
    if (application && application.status !== status && !pendingIds.has(application.id)) {
      void changeStatus(application, status);
    }
  }

  function updateFilters(patch: Partial<ApplicationFilters>) {
    setNotice('');
    setFilters((current) => ({ ...current, ...patch }));
  }

  function clearFilters() {
    setNotice('');
    setFilters(EMPTY_FILTERS);
  }

  const visible = useMemo(() => filterApplications(applications, filters), [applications, filters]);
  const filtered = hasActiveFilters(filters);
  const rejected = visible.filter((application) => application.status === 'REJECTED');

  const dragging = (application: ApplicationItem) => draggedId === application.id;
  const showDropHighlight = (status: ApplicationStatus) => draggedId !== null && dragOverStatus === status;
  const columnDropProps = (status: ApplicationStatus) => ({
    onDragOver: (event: React.DragEvent) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      setDragOverStatus(status);
    },
    onDragLeave: (event: React.DragEvent) => {
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
      setDragOverStatus((current) => (current === status ? null : current));
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      handleDropStatus(status, draggedId ?? event.dataTransfer.getData('text/plain'));
    },
  });

  if (loadState === 'loading') {
    return (
      <div role="status" aria-live="polite">
        <span className="sr-only">Loading applications…</span>
        <BoardSkeleton />
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div role="alert" className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-outline-variant py-12 text-center">
        <AlertCircle className="h-8 w-8 text-danger" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold">Could not load applications</p>
          <p className="mt-1 max-w-md break-words px-4 text-xs text-on-surface-variant">{loadError}</p>
        </div>
        <button type="button" onClick={() => void load()} className={`${actionClass} border border-outline-variant`}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p role="status" className="sr-only">{announcement}</p>
      <StatsHeader applications={visible} filtered={filtered} />
      <div role="search" aria-label="Filter applications" className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" />
          <input
            type="search"
            value={filters.query}
            onChange={(event) => updateFilters({ query: event.target.value })}
            aria-label="Search by position or company"
            placeholder="Search position or company"
            autoComplete="off"
            className={`${filterFieldClass} pl-9`}
          />
        </div>
        <select
          value={filters.platform}
          onChange={(event) => updateFilters({ platform: event.target.value as ApplicationFilters['platform'] })}
          aria-label="Filter by platform"
          className={`${filterFieldClass} lg:w-56`}
        >
          <option value="">All platforms</option>
          {PLATFORMS.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
        </select>
        <select
          value={filters.type}
          onChange={(event) => updateFilters({ type: event.target.value as ApplicationFilters['type'] })}
          aria-label="Filter by type"
          className={`${filterFieldClass} lg:w-40`}
        >
          <option value="">All types</option>
          {APPLICATION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-xs text-on-surface-variant">
          {filtered ? `Showing ${visible.length} of ${applications.length} applications. Statistics reflect these filters.` : `${applications.length} ${applications.length === 1 ? 'application' : 'applications'}`}
          {filtered && (
            <button type="button" onClick={clearFilters} className="ml-2 rounded font-medium text-on-surface underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Clear filters</button>
          )}
        </p>
        <button type="button" onClick={() => { setActionError(''); setAddOpen(true); }} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary shadow-sm transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add application
        </button>
      </div>
      <ApplicationModal open={addOpen || editing !== null} application={editing} onClose={closeModal} onSaved={handleSaved} onDeleted={handleDeleted} />
      {actionError && (
        <p role="alert" className="rounded-xl border border-danger bg-surface-lowest px-4 py-3 text-xs text-danger">{actionError}</p>
      )}
      {notice && (
        <p role="status" className="rounded-xl border border-outline-variant bg-surface-low px-4 py-3 text-xs text-on-surface-variant">{notice}</p>
      )}
      {applications.length === 0 ? (
        <p className="rounded-xl border border-outline-variant bg-surface-low px-4 py-3 text-xs text-on-surface-variant">No applications yet. Use Add application to record your first one.</p>
      ) : visible.length === 0 && (
        <p className="rounded-xl border border-outline-variant bg-surface-low px-4 py-3 text-xs text-on-surface-variant">No applications match your filters.</p>
      )}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3 xl:gap-6">
        {ACTIVE_STAGES.map((status) => {
          const items = visible.filter((application) => application.status === status);
          const style = STATUS_STYLE[status];
          const highlighted = showDropHighlight(status);
          return (
            <section
              key={status}
              aria-labelledby={`stage-${status}`}
              {...columnDropProps(status)}
              className={`min-w-0 space-y-4 rounded-xl transition-colors ${highlighted ? 'bg-surface-low outline-2 outline-dashed outline-outline' : ''}`}
            >
              <div className="flex items-center justify-between gap-3 border-b border-outline-variant pb-3">
                <h2 id={`stage-${status}`} className={`flex items-center gap-2 font-mono text-xs font-medium ${style.text}`}>
                  <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden="true" />
                  {style.label}
                </h2>
                <span aria-label={`${items.length} applications`} className="rounded-md border border-outline-variant bg-surface-low px-2 py-0.5 font-mono text-[11px] text-on-surface-variant">{items.length}</span>
              </div>
              {items.length ? (
                <div className="space-y-4">
                  {items.map((application) => (
                    <ApplicationCard
                      key={application.id}
                      application={application}
                      now={now}
                      pending={pendingIds.has(application.id)}
                      dragging={dragging(application)}
                      onDragStart={(application) => setDraggedId(application.id)}
                      onDragEnd={() => setDraggedId(null)}
                      onChangeStatus={(application, status) => void changeStatus(application, status)}
                      onEdit={openEdit}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-outline-variant py-12 text-on-surface-variant">
                  <AlertCircle className="mb-2 h-8 w-8 opacity-30" aria-hidden="true" />
                  <p className="text-xs">{highlighted ? 'Drop here to move to this stage' : 'No applications in this stage'}</p>
                </div>
              )}
            </section>
          );
        })}
      </div>
      <section
        aria-labelledby="stage-REJECTED"
        {...columnDropProps('REJECTED')}
        className={`space-y-4 rounded-xl border-t border-outline-variant pt-6 transition-colors ${showDropHighlight('REJECTED') ? 'bg-surface-low outline-2 outline-dashed outline-outline' : ''}`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="stage-REJECTED" className={`flex items-center gap-2 text-sm font-semibold ${STATUS_STYLE.REJECTED.text}`}>
            <span className={`h-2 w-2 rounded-full ${STATUS_STYLE.REJECTED.dot}`} aria-hidden="true" />
            Archived / Rejected
          </h2>
          <span aria-label={`${rejected.length} applications`} className="rounded-md border border-outline-variant bg-surface-low px-2 py-0.5 font-mono text-[11px] text-on-surface-variant">{rejected.length}</span>
        </div>
        <p className="text-xs text-on-surface-variant">Drop a card here to archive it, or use Next on an archived card to restore it to Applied.</p>
        {rejected.length > 0 && (
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3 lg:grid-cols-4">
            {rejected.map((application) => (
              <ApplicationCard
                key={application.id}
                application={application}
                now={now}
                pending={pendingIds.has(application.id)}
                dragging={dragging(application)}
                onDragStart={(application) => setDraggedId(application.id)}
                onDragEnd={() => setDraggedId(null)}
                onChangeStatus={(application, status) => void changeStatus(application, status)}
                onEdit={openEdit}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
