import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { applications } from '@/db/schema';
import {
  errorResponse,
  json,
  parseBody,
  requireSession,
  serverError,
} from '@/lib/api';
import { ApplicationIdSchema, UpdateApplicationSchema } from '@/lib/schemas';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Context) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const id = ApplicationIdSchema.safeParse((await params).id);
  if (!id.success) return errorResponse('Invalid application id', 400);

  const body = await parseBody(req, UpdateApplicationSchema);
  if (body.response) return body.response;

  try {
    const [updated] = await db
      .update(applications)
      .set({ ...body.data, updatedAt: new Date() })
      .where(eq(applications.id, id.data))
      .returning();
    return updated ? json({ application: updated }) : errorResponse('Application not found', 404);
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(_req: Request, { params }: Context) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const id = ApplicationIdSchema.safeParse((await params).id);
  if (!id.success) return errorResponse('Invalid application id', 400);

  try {
    const [deleted] = await db
      .delete(applications)
      .where(eq(applications.id, id.data))
      .returning({ id: applications.id });
    return deleted ? json({ ok: true, id: deleted.id }) : errorResponse('Application not found', 404);
  } catch (error) {
    return serverError(error);
  }
}
