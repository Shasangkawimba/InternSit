import { and, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { applications } from '@/db/schema';
import { json, parseBody, requireSession, serverError, validationError } from '@/lib/api';
import { ApplicationSchema, ListApplicationsQuerySchema } from '@/lib/schemas';

// Escape LIKE wildcards so user input is matched literally.
const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

export async function GET(req: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  // Treat empty params (?platform=) as "not provided".
  const params = Object.fromEntries(
    [...new URL(req.url).searchParams].filter(([, value]) => value !== ''),
  );
  const query = ListApplicationsQuerySchema.safeParse(params);
  if (!query.success) return validationError(query.error);

  const { q, platform, type, status } = query.data;
  const filters: SQL[] = [];
  if (platform) filters.push(eq(applications.platform, platform));
  if (type) filters.push(eq(applications.type, type));
  if (status) filters.push(eq(applications.status, status));
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    filters.push(or(ilike(applications.title, pattern), ilike(applications.company, pattern))!);
  }

  try {
    const rows = await db
      .select()
      .from(applications)
      .where(and(...filters))
      .orderBy(desc(applications.appliedAt));
    return json({ applications: rows });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await parseBody(req, ApplicationSchema);
  if (body.response) return body.response;

  try {
    const [created] = await db.insert(applications).values(body.data).returning();
    return json({ application: created }, 201);
  } catch (error) {
    return serverError(error);
  }
}
