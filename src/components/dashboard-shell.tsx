'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LogOut, Moon, Sun } from 'lucide-react';
import { toggleTheme } from '@/lib/theme';
import { Logo } from '@/components/logo';

const controlClass = 'rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-low hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

function ThemeToggle() {
  return (
    <button type="button" onClick={toggleTheme} className={controlClass} aria-label="Switch color theme">
      <Sun className="hidden h-5 w-5 dark:block" aria-hidden="true" />
      <Moon className="h-5 w-5 dark:hidden" aria-hidden="true" />
    </button>
  );
}

function LogoutButton() {
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
      <button
        type="button"
        onClick={logout}
        disabled={loggingOut}
        className={`${controlClass} disabled:cursor-wait disabled:opacity-50`}
        aria-label={loggingOut ? 'Signing out' : 'Sign out'}
      >
        <LogOut className="h-5 w-5" aria-hidden="true" />
      </button>
      {error && <p role="alert" className="absolute top-full mt-1 text-xs text-danger">{error}</p>}
    </>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#dashboard-content" className="sr-only z-50 rounded-lg bg-primary p-3 text-on-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>

      <header className="relative sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-outline-variant bg-surface-lowest px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <Logo className="h-7 w-7" />
          <span className="font-display text-lg font-bold tracking-tight">InternSit</span>
        </Link>
        <div className="flex items-center gap-0.5">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </header>

      <main id="dashboard-content" tabIndex={-1} className="min-h-[calc(100dvh-4rem)] p-4 outline-none sm:p-6 lg:p-8">
        {children}
      </main>
    </>
  );
}
