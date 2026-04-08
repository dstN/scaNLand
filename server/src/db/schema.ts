import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: integer().primaryKey({ autoIncrement: true }),
  email: text().notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text({ enum: ['admin', 'moderator'] }).notNull().default('moderator'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const submissions = sqliteTable(
  'submissions',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    approvalCode: text('approval_code').notNull(),
    productImageUrl: text('product_image_url'),
    brandName: text('brand_name'),
    productName: text('product_name'),
    companyName: text('company_name'),
    address: text(),
    country: text(),
    region: text(),
    category: text(),
    ocrConfidence: real('ocr_confidence'),
    deviceFingerprint: text('device_fingerprint'),
    moderationStatus: text('moderation_status', { enum: ['pending', 'approved', 'rejected'] })
      .notNull()
      .default('pending'),
    moderationQueue: text('moderation_queue', {
      enum: ['pending', 'review_required', 'approved', 'auto_rejected'],
    })
      .notNull()
      .default('pending'),
    suspicionReasons: text('suspicion_reasons', { mode: 'json' }).$type<string[]>().default([]),
    reviewedBy: integer('reviewed_by'),
    reviewedAt: text('reviewed_at'),
    rejectionReason: text('rejection_reason'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_approval_code').on(table.approvalCode),
    index('idx_moderation_status').on(table.moderationStatus),
    index('idx_moderation_queue').on(table.moderationQueue),
    index('idx_created_at').on(table.createdAt),
  ]
);

export const auditLog = sqliteTable('audit_log', {
  id: integer().primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  action: text().notNull(),
  submissionId: integer('submission_id'),
  details: text({ mode: 'json' }).$type<Record<string, unknown>>(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});
