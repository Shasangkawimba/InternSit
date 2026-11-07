'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Briefcase, LayoutDashboard, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { toggleTheme } from '@/lib/theme';

const controlClass = 'rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg font-display text-lg font-bold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-on-primary">
        <Briefcase className="h-4 w-4" aria-hidden="true" />
      </span>
      InternSit
    </Link>
  );
}

function ThemeToggle() {
  return (
    <button type="button" onClick={toggleTheme} className={controlClass} aria-label="Switch color theme">
      <Sun className="hidden h-5 w-5 dark:block" aria-hidden="true" />
      <Moon className="h-5 w-5 dark:hidden" aria-hidden="true" />
    </button>
  );
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    setLoggingOut(true);
    setError(null);
    try {
      const response = await fetch('/api/logout', { method: 'POST' });
      if (!response.ok && response.status !== 401) throw new Error('Logout failed');
      // Full navigation clears the client router cache of protected pages.
      window.location.replace('/login');
    } catch {
      setError('Could not sign out. Please try again.');
      setLoggingOut(false);
    }
  }

  return (
    <>
      <nav aria-label="Main navigation" className="flex-1 p-4">
        <Link href="/" onClick={onNavigate} aria-current="page" className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-low px-3 py-2.5 text-sm font-medium text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
          Dashboard
        </Link>
      </nav>
      <div className="space-y-3 border-t border-outline-variant p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-on-surface-variant">Appearance</span>
          <ThemeToggle />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Personal workspace</p>
            <p className="mt-0.5 font-mono text-[11px] text-on-surface-variant">Single-user</p>
          </div>
          <button type="button" onClick={logout} disabled={loggingOut} className={`${controlClass} disabled:cursor-wait disabled:opacity-50`} aria-label={loggingOut ? 'Signing out' : 'Sign out'}>
            <LogOut className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      </div>
    </>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    const dialog = drawer.current;
    if (!dialog) return;

    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => {
      if (desktop.matches) setDrawerOpen(false);
    };
    closeOnDesktop();
    desktop.addEventListener('change', closeOnDesktop);

    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener('change', closeOnDesktop);
    };
  }, [drawerOpen]);

  return (
    <>
      <a href="#dashboard-content" className="sr-only z-50 rounded-lg bg-primary p-3 text-on-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-outline-variant bg-surface-lowest lg:flex" aria-label="Sidebar">
        <div className="flex h-16 shrink-0 items-center border-b border-outline-variant px-6"><Brand /></div>
        <Navigation />
      </aside>

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-outline-variant bg-surface-lowest px-4 lg:hidden">
        <Brand />
        <button type="button" className={controlClass} onClick={() => setDrawerOpen(true)} aria-label="Open navigation" aria-expanded={drawerOpen} aria-controls="mobile-navigation">
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <dialog
        ref={drawer}
        id="mobile-navigation"
        aria-labelledby="mobile-navigation-title"
        onCancel={() => setDrawerOpen(false)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
            setDrawerOpen(false);
          }
        }}
        className="fixed bottom-0 left-auto right-0 top-16 m-0 h-[calc(100dvh-4rem)] max-h-none w-72 max-w-[100vw] border-l border-outline-variant bg-surface-lowest p-0 text-on-surface backdrop:bg-black/40 open:flex open:flex-col motion-safe:open:animate-[drawer-in_180ms_ease-out]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-outline-variant p-4">
          <h2 id="mobile-navigation-title" className="text-sm font-semibold">Navigation</h2>
          <button type="button" className={controlClass} onClick={() => setDrawerOpen(false)} aria-label="Close navigation">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <Navigation onNavigate={() => setDrawerOpen(false)} />
        </div>
      </dialog>

      <main id="dashboard-content" tabIndex={-1} className="min-h-[calc(100dvh-4rem)] p-4 outline-none sm:p-6 lg:ml-64 lg:min-h-dvh lg:p-8">
        {children}
      </main>
    </>
  );
}
