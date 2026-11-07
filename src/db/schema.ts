import { pgTable, text, uuid, timestamp, index } from 'drizzle-orm/pg-core';
import { desc } from 'drizzle-orm';

// Single-user app (password gate), so there is no user_id column.
export const applications = pgTable(
  'applications',
  {
    id:        uuid('id').primaryKey().defaultRandom(),
    title:     text('title').notNull(),
    company:   text('company').notNull(),
    type:      text('type').notNull(),
    platform:  text('platform').notNull(),
    location:  text('location'),
    url:       text('url'),
    status:    text('status').notNull().default('APPLIED'),
    notes:     text('notes'),
    appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('applications_status_idx').on(t.status),
    index('applications_applied_at_idx').on(desc(t.appliedAt)),
  ],
);

export type Application    = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
