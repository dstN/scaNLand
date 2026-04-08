import type { FastifyInstance } from 'fastify';
import { getDb, schema } from '../db/index.js';
import { analyzeSubmission } from '../services/spam.js';
import { nanoid } from 'nanoid';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

export async function submissionRoutes(app: FastifyInstance) {
  // POST /api/submissions — mobile app submits unknown codes
  app.post(
    '/',
    {
      schema: {
        consumes: ['multipart/form-data'],
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              status: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const db = getDb();
      const parts = request.parts();

      let approvalCode = '';
      let brandName: string | undefined;
      let productName: string | undefined;
      let companyName: string | undefined;
      let address: string | undefined;
      let country: string | undefined;
      let region: string | undefined;
      let category: string | undefined;
      let ocrConfidence: number | undefined;
      let imageUrl: string | undefined;

      for await (const part of parts) {
        if (part.type === 'file') {
          // Save uploaded image
          const ext = part.filename?.split('.').pop() || 'jpg';
          const allowedExts = ['jpg', 'jpeg', 'png', 'webp'];
          if (!allowedExts.includes(ext.toLowerCase())) {
            return reply.code(400).send({ error: 'Invalid file type' });
          }

          const filename = `${nanoid()}.${ext}`;
          await mkdir(UPLOAD_DIR, { recursive: true });
          const filepath = join(UPLOAD_DIR, filename);
          await pipeline(part.file, createWriteStream(filepath));
          imageUrl = `/uploads/${filename}`;
        } else {
          // Form field
          const value = part.value as string;
          switch (part.fieldname) {
            case 'approvalCode': approvalCode = value; break;
            case 'brandName': brandName = value; break;
            case 'productName': productName = value; break;
            case 'companyName': companyName = value; break;
            case 'address': address = value; break;
            case 'country': country = value; break;
            case 'region': region = value; break;
            case 'category': category = value; break;
            case 'ocrConfidence': ocrConfidence = parseFloat(value) || undefined; break;
          }
        }
      }

      if (!approvalCode) {
        return reply.code(400).send({ error: 'approvalCode is required' });
      }

      // Spam analysis
      const spamResult = analyzeSubmission({
        approvalCode,
        brandName,
        productName,
        companyName,
        address,
      });

      const [result] = await db.insert(schema.submissions).values({
        approvalCode,
        productImageUrl: imageUrl,
        brandName,
        productName,
        companyName,
        address,
        country,
        region,
        category,
        ocrConfidence,
        deviceFingerprint: request.headers['x-device-id'] as string || undefined,
        moderationStatus: spamResult.autoReject ? 'rejected' : 'pending',
        moderationQueue: spamResult.autoReject
          ? 'auto_rejected'
          : spamResult.suspicious
            ? 'review_required'
            : 'pending',
        suspicionReasons: spamResult.reasons,
      }).returning({ id: schema.submissions.id });

      return reply.code(201).send({
        id: result.id,
        status: spamResult.autoReject ? 'auto_rejected' : 'pending',
      });
    }
  );
}
