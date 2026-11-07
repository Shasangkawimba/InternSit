import { KanbanBoard } from '@/components/kanban-board';

export default function Home() {
  return (
    <div className="space-y-6">
      <header>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-on-surface-variant">Personal workspace</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-sm text-on-surface-variant">Track your job and internship applications in one place.</p>
      </header>
      <KanbanBoard />
    </div>
  );
}
