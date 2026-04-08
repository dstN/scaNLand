import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { authRoutes } from './routes/auth.js';
import { submissionRoutes } from './routes/submissions.js';
import { adminRoutes } from './routes/admin.js';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

async function start() {
  // Security plugins
  await app.register(helmet);
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // JWT
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
  });

  // File uploads
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB
      files: 1,
    },
  });

  // OpenAPI docs
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'scaNLand API',
        version: '0.1.0',
        description: 'API for managing EU food approval mark submissions',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });
  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // Auth decorator
  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // Routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(submissionRoutes, { prefix: '/api/submissions' });
  await app.register(adminRoutes, { prefix: '/api/admin' });

  // Health check
  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Start server
  const host = process.env.HOST || '0.0.0.0';
  const port = parseInt(process.env.PORT || '3000', 10);

  await app.listen({ host, port });
  app.log.info(`Server running at http://${host}:${port}`);
  app.log.info(`API docs at http://${host}:${port}/docs`);
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
