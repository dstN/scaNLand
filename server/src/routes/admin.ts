import type { FastifyInstance } from 'fastify';
import { eq, desc, and, sql } from 'drizzle-orm';
import { getDb, schema } from '../db/index.js';

export async function adminRoutes(app: FastifyInstance) {
  // All admin routes require authentication
  app.addHook('onRequest', (app as any).authenticate);

  // GET /api/admin/submissions — list submissions with filters
  app.get(
    '/submissions',
    {
      schema: {
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            queue: { type: 'string', enum: ['pending', 'review_required', 'approved', 'auto_rejected'] },
            status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
            page: { type: 'number', default: 1 },
            limit: { type: 'number', default: 20 },
          },
        },
      },
    },
    async (request) => {
      const { queue, status, page = 1, limit = 20 } = request.query as any;
      const db = getDb();

      const conditions = [];
      if (queue) conditions.push(eq(schema.submissions.moderationQueue, queue));
      if (status) conditions.push(eq(schema.submissions.moderationStatus, status));

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      const offset = (page - 1) * limit;

      const [items, [countResult]] = await Promise.all([
        db
          .select()
          .from(schema.submissions)
          .where(where)
          .orderBy(desc(schema.submissions.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.submissions)
          .where(where),
      ]);

      return {
        items,
        total: countResult.count,
        page,
        limit,
        totalPages: Math.ceil(countResult.count / limit),
      };
    }
  );

  // GET /api/admin/submissions/:id
  app.get(
    '/submissions/:id',
    {
      schema: {
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'number' } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: number };
      const db = getDb();

      const [submission] = await db
        .select()
        .from(schema.submissions)
        .where(eq(schema.submissions.id, id))
        .limit(1);

      if (!submission) {
        return reply.code(404).send({ error: 'Submission not found' });
      }

      return submission;
    }
  );

  // PATCH /api/admin/submissions/:id/approve
  app.patch(
    '/submissions/:id/approve',
    {
      schema: {
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'number' } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: number };
      const user = (request as any).user;
      const db = getDb();

      await db
        .update(schema.submissions)
        .set({
          moderationStatus: 'approved',
          moderationQueue: 'approved',
          reviewedBy: user.id,
          reviewedAt: new Date().toISOString(),
        })
        .where(eq(schema.submissions.id, id));

      // Audit log
      await db.insert(schema.auditLog).values({
        userId: user.id,
        action: 'approve',
        submissionId: id,
      });

      return { success: true };
    }
  );

  // PATCH /api/admin/submissions/:id/reject
  app.patch(
    '/submissions/:id/reject',
    {
      schema: {
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'number' } },
        },
        body: {
          type: 'object',
          properties: {
            reason: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: number };
      const { reason } = (request.body as { reason?: string }) || {};
      const user = (request as any).user;
      const db = getDb();

      await db
        .update(schema.submissions)
        .set({
          moderationStatus: 'rejected',
          moderationQueue: 'approved',
          reviewedBy: user.id,
          reviewedAt: new Date().toISOString(),
          rejectionReason: reason,
        })
        .where(eq(schema.submissions.id, id));

      // Audit log
      await db.insert(schema.auditLog).values({
        userId: user.id,
        action: 'reject',
        submissionId: id,
        details: { reason },
      });

      return { success: true };
    }
  );

  // GET /api/admin/stats — dashboard stats
  app.get(
    '/stats',
    {
      schema: { security: [{ bearerAuth: [] }] },
    },
    async () => {
      const db = getDb();

      const [pending] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.submissions)
        .where(eq(schema.submissions.moderationQueue, 'pending'));

      const [review] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.submissions)
        .where(eq(schema.submissions.moderationQueue, 'review_required'));

      const [approved] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.submissions)
        .where(eq(schema.submissions.moderationStatus, 'approved'));

      const [rejected] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.submissions)
        .where(eq(schema.submissions.moderationStatus, 'rejected'));

      const [total] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.submissions);

      return {
        pending: pending.count,
        reviewRequired: review.count,
        approved: approved.count,
        rejected: rejected.count,
        total: total.count,
      };
    }
  );
}
