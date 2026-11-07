import { KanbanBoard } from '@/components/kanban-board';

export default function Home() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Your pipeline.</h1>
        <p className="mt-2 text-sm text-on-surface-variant">Every application, one clear view from sent to signed.</p>
      </header>
      <KanbanBoard />
    </div>
  );
}
