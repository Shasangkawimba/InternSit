'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useForm, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Trash2, X } from 'lucide-react';
import { APPLICATION_STATUSES, APPLICATION_TYPES, PLATFORMS, type ApplicationItem, type ApplicationStatus } from '@/lib/applications';
import { ApiError, createApplication, deleteApplication, updateApplication } from '@/lib/applications-client';
import { ApplicationSchema, type ApplicationFormValues, type ApplicationInput, type UpdateApplicationInput } from '@/lib/schemas';

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  APPLIED: 'Applied',
  INTERVIEW: 'Interviewing',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
};

// `platform` starts empty so the user must choose one; the schema rejects '' with a clear message.
const DEFAULT_VALUES = {
  title: '',
  company: '',
  type: 'Internship',
  platform: '',
  location: '',
  url: '',
  status: 'APPLIED',
  notes: '',
} as unknown as ApplicationFormValues;

function toFormValues(application: ApplicationItem): ApplicationFormValues {
  return {
    title: application.title,
    company: application.company,
    type: application.type,
    platform: application.platform as ApplicationFormValues['platform'],
    location: application.location ?? '',
    url: application.url ?? '',
    status: application.status,
    notes: application.notes ?? '',
  };
}

const FIELD_NAMES = ['title', 'company', 'type', 'platform', 'location', 'url', 'status', 'notes'] as const;

const fieldClass = 'w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-on-surface outline-none placeholder:text-on-surface-variant/70 focus:border-input-focus aria-[invalid=true]:border-danger';
const labelClass = 'mb-1.5 block text-xs font-medium text-on-surface-variant';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50';

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} role="alert" className="mt-1.5 text-xs text-danger">{message}</p> : null;
}

/** Add mode when `application` is null/undefined, edit mode otherwise. */
export function ApplicationModal({ open, application, onClose, onSaved, onDeleted }: {
  open: boolean;
  application?: ApplicationItem | null;
  onClose: () => void;
  onSaved: (application: ApplicationItem, mode: 'created' | 'updated') => void;
  onDeleted: (id: string, reason: 'deleted' | 'missing') => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [formError, setFormError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const editing = application ?? null;
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<ApplicationFormValues, unknown, ApplicationInput>({
    resolver: zodResolver(ApplicationSchema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;

    if (!open) {
      if (element.open) element.close();
      return;
    }

    reset(editing ? toFormValues(editing) : DEFAULT_VALUES);
    setFormError('');
    setConfirmingDelete(false);
    setDeleting(false);
    if (!element.open) element.showModal();
    setFocus('title');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, editing, reset, setFocus]);

  const busy = isSubmitting || deleting;

  async function onSubmit(values: ApplicationInput) {
    setFormError('');
    try {
      if (editing) {
        // Send only fields the user changed, so untouched data is never overwritten.
        const patch: Record<string, unknown> = {};
        for (const name of FIELD_NAMES) {
          if (dirtyFields[name]) patch[name] = values[name];
        }
        if (Object.keys(patch).length === 0) return onClose();
        onSaved(await updateApplication(editing.id, patch as UpdateApplicationInput), 'updated');
      } else {
        onSaved(await createApplication(values), 'created');
      }
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        window.location.replace('/login');
        return;
      }
      if (editing && error instanceof ApiError && error.status === 404) {
        onDeleted(editing.id, 'missing');
        onClose();
        return;
      }
      if (error instanceof ApiError && error.status === 400 && error.issues.length) {
        let mapped = false;
        for (const issue of error.issues) {
          const name = issue.path.split('.')[0] as FieldPath<ApplicationFormValues>;
          if ((FIELD_NAMES as readonly string[]).includes(name)) {
            setError(name, { type: 'server', message: issue.message });
            mapped = true;
          }
        }
        if (mapped) return;
      }
      setFormError(error instanceof Error ? error.message : 'Could not save the application.');
    }
  }

  async function onDelete() {
    if (!editing) return;
    setFormError('');
    setDeleting(true);
    try {
      await deleteApplication(editing.id);
      onDeleted(editing.id, 'deleted');
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        window.location.replace('/login');
        return;
      }
      if (error instanceof ApiError && error.status === 404) {
        onDeleted(editing.id, 'missing');
        onClose();
        return;
      }
      setFormError(error instanceof Error ? error.message : 'Could not delete the application.');
      setConfirmingDelete(false);
      setDeleting(false);
    }
  }

  const id = (name: string) => `${uid}-${name}`;
  const describedBy = (name: keyof typeof errors) => (errors[name] ? `${id(name)}-error` : undefined);
  const mobileInputs = '[&_input]:text-base [&_select]:text-base [&_textarea]:text-base sm:[&_input]:text-sm sm:[&_select]:text-sm sm:[&_textarea]:text-sm';

  return (
    <dialog
      ref={dialog}
      aria-labelledby={id('title-heading')}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      className="fixed inset-0 h-full max-h-none w-full max-w-none bg-transparent p-0 text-on-surface backdrop:bg-black/40"
    >
      {/* Full-viewport flex frame: the form is optically centered on every device.
          Desktop gets a slight upward bias (the chrome above the viewport makes a
          symmetric center read as low on screen); mobile stays truly symmetric.
          `pointer-events-none` keeps backdrop click-to-close working around the form. */}
      <div className="pointer-events-none flex h-full min-h-0 items-center justify-center px-3 sm:pb-16">
      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className={`pointer-events-auto flex max-h-[80dvh] w-full max-w-lg flex-col rounded-xl border border-outline-variant bg-surface-lowest shadow-2xl sm:max-h-[calc(100dvh-4rem)] ${mobileInputs}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-outline p-4 sm:p-6">
          <div>
            <h2 id={id('title-heading')} className="font-display text-lg font-semibold tracking-tight">{editing ? 'Edit application' : 'Add application'}</h2>
            <p className="mt-1 text-xs text-on-surface-variant">{editing ? 'Update details, move it to another stage, or delete it.' : 'Record a job or internship you have applied to.'}</p>
          </div>
          <div className="flex shrink-0 items-start gap-1">
            {editing && (
              <button type="button" onClick={() => { setFormError(''); setConfirmingDelete(true); }} disabled={busy} aria-label="Delete application" className="rounded-lg p-2 text-danger transition-colors hover:bg-surface-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:opacity-50">
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
            <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-low hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="modal-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <div>
            <label htmlFor={id('title')} className={labelClass}>Position title *</label>
            <input id={id('title')} type="text" autoComplete="off" placeholder="Frontend Developer Intern" aria-invalid={!!errors.title} aria-describedby={describedBy('title')} className={fieldClass} {...register('title')} />
            <FieldError id={`${id('title')}-error`} message={errors.title?.message} />
          </div>

          <div>
            <label htmlFor={id('company')} className={labelClass}>Company *</label>
            <input id={id('company')} type="text" autoComplete="organization" placeholder="Acme Inc." aria-invalid={!!errors.company} aria-describedby={describedBy('company')} className={fieldClass} {...register('company')} />
            <FieldError id={`${id('company')}-error`} message={errors.company?.message} />
          </div>

          <fieldset>
            <legend className={labelClass}>Type *</legend>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-input-border bg-input-bg p-1">
              {APPLICATION_TYPES.map((type) => (
                <label key={type} className="cursor-pointer">
                  <input type="radio" value={type} className="peer sr-only" {...register('type')} />
                  <span className="block rounded-md px-3 py-1.5 text-center text-sm font-medium text-on-surface-variant transition-colors peer-checked:bg-primary peer-checked:text-on-primary peer-checked:shadow-sm peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-primary">{type}</span>
                </label>
              ))}
            </div>
            <FieldError id={`${id('type')}-error`} message={errors.type?.message} />
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={id('platform')} className={labelClass}>Platform *</label>
              <select id={id('platform')} aria-invalid={!!errors.platform} aria-describedby={describedBy('platform')} className={fieldClass} {...register('platform')}>
                <option value="" disabled>Select platform</option>
                {PLATFORMS.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
              </select>
              <FieldError id={`${id('platform')}-error`} message={errors.platform?.message} />
            </div>
            <div>
              <label htmlFor={id('status')} className={labelClass}>Status</label>
              <select id={id('status')} aria-invalid={!!errors.status} aria-describedby={describedBy('status')} className={fieldClass} {...register('status')}>
                {APPLICATION_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
              </select>
              <FieldError id={`${id('status')}-error`} message={errors.status?.message} />
            </div>
          </div>

          <div>
            <label htmlFor={id('location')} className={labelClass}>Location / work mode</label>
            <input id={id('location')} type="text" autoComplete="off" placeholder="Remote, Jakarta, Hybrid" aria-invalid={!!errors.location} aria-describedby={describedBy('location')} className={fieldClass} {...register('location')} />
            <FieldError id={`${id('location')}-error`} message={errors.location?.message} />
          </div>

          <div>
            <label htmlFor={id('url')} className={labelClass}>Application URL</label>
            <input id={id('url')} type="url" inputMode="url" autoComplete="off" placeholder="https://" aria-invalid={!!errors.url} aria-describedby={describedBy('url')} className={fieldClass} {...register('url')} />
            <FieldError id={`${id('url')}-error`} message={errors.url?.message} />
          </div>

          <div>
            <label htmlFor={id('notes')} className={labelClass}>Notes</label>
            <textarea id={id('notes')} rows={4} aria-invalid={!!errors.notes} aria-describedby={describedBy('notes')} className={`${fieldClass} resize-y`} {...register('notes')} />
            <FieldError id={`${id('notes')}-error`} message={errors.notes?.message} />
          </div>

          {formError && <p role="alert" className="rounded-lg border border-danger px-3 py-2 text-xs text-danger">{formError}</p>}
        </div>

        {confirmingDelete && editing ? (
          <div role="alertdialog" aria-label="Confirm delete" className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-outline p-4 sm:px-6">
            <p className="min-w-0 flex-1 basis-48 text-sm">Delete <span className="font-semibold">{editing.title}</span>? This cannot be undone.</p>
            <div className="flex gap-3">
              <button type="button" autoFocus onClick={() => setConfirmingDelete(false)} disabled={deleting} className={`${buttonClass} border border-outline-variant text-on-surface-variant hover:bg-surface-low hover:text-on-surface`}>Keep</button>
              <button type="button" onClick={onDelete} disabled={deleting} className={`${buttonClass} bg-danger text-white shadow-sm hover:opacity-90`}>
                {deleting && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                {deleting ? 'Deleting\u2026' : 'Delete'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-outline p-4 sm:px-6">
            <span />
            <div className="flex gap-3">
              <button type="button" onClick={onClose} disabled={busy} className={`${buttonClass} border border-outline-variant text-on-surface-variant hover:bg-surface-low hover:text-on-surface`}>Cancel</button>
              <button type="submit" disabled={busy} className={`${buttonClass} bg-primary text-on-primary shadow-sm hover:opacity-90`}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                {isSubmitting ? 'Saving\u2026' : editing ? 'Save changes' : 'Add application'}
              </button>
            </div>
          </div>
        )}
      </form>
      </div>
    </dialog>
  );
}
