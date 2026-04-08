import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import argon2 from 'argon2';
import { getDb, schema } from '../db/index.js';

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/login
  app.post(
    '/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              token: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'number' },
                  email: { type: 'string' },
                  role: { type: 'string' },
                },
              },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body as { email: string; password: string };
      const db = getDb();

      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);

      if (!user) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const valid = await argon2.verify(user.passwordHash, password);
      if (!valid) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const token = app.jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        { expiresIn: '24h' }
      );

      return { token, user: { id: user.id, email: user.email, role: user.role } };
    }
  );

  // GET /api/auth/me
  app.get(
    '/me',
    {
      onRequest: [(app as any).authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              email: { type: 'string' },
              role: { type: 'string' },
            },
          },
        },
      },
    },
    async (request) => {
      const user = (request as any).user;
      return { id: user.id, email: user.email, role: user.role };
    }
  );
}
