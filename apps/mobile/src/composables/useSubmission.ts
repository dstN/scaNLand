import { ref } from 'vue';
import type { Submission } from '@scanland/shared';

/**
 * Submission composable — manages the offline submission queue.
 *
 * Submissions are stored in the local SQLite submission_queue table.
 * When the device is online, useSync uploads pending submissions.
 */
export function useSubmission() {
  const isSaving = ref(false);
  const lastError = ref<string | null>(null);

  /**
   * Queue a submission locally (works offline).
   */
  async function queueSubmission(submission: Omit<Submission, 'id' | 'status' | 'createdAt'>): Promise<number> {
    isSaving.value = true;
    lastError.value = null;

    try {
      const db = await getDb();
      const result = await db.run(
        `INSERT INTO submission_queue (approval_code, product_image_path, brand_name, product_name,
         company_name, address, country, region, category, ocr_confidence, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          submission.approvalCode,
          submission.productImagePath || null,
          submission.brandName || null,
          submission.productName || null,
          submission.companyName || null,
          submission.address || null,
          submission.country || null,
          submission.region || null,
          submission.category || null,
          submission.ocrConfidence || null,
        ]
      );
      return result.changes?.lastId ?? 0;
    } catch (e: any) {
      lastError.value = e.message || 'Failed to save submission';
      throw e;
    } finally {
      isSaving.value = false;
    }
  }

  /**
   * Get all pending submissions from the local queue.
   */
  async function getPendingSubmissions(): Promise<Submission[]> {
    const db = await getDb();
    const result = await db.query(
      `SELECT * FROM submission_queue WHERE status IN ('pending', 'failed') ORDER BY created_at DESC`
    );
    return (result.values || []).map(mapRowToSubmission);
  }

  /**
   * Update submission status after upload attempt.
   */
  async function updateStatus(id: number, status: string, error?: string): Promise<void> {
    const db = await getDb();
    if (error) {
      await db.run(
        `UPDATE submission_queue SET status = ?, last_error = ?, retry_count = retry_count + 1 WHERE id = ?`,
        [status, error, id]
      );
    } else {
      await db.run(
        `UPDATE submission_queue SET status = ? WHERE id = ?`,
        [status, id]
      );
    }
  }

  return {
    queueSubmission,
    getPendingSubmissions,
    updateStatus,
    isSaving,
    lastError,
  };
}

// ---- Internal ----

async function getDb(): Promise<any> {
  if (typeof (window as any)?.Capacitor !== 'undefined') {
    const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
    return {
      run: (sql: string, values: any[]) =>
        CapacitorSQLite.run({ database: 'scanland', statement: sql, values }),
      query: (sql: string, values: any[] = []) =>
        CapacitorSQLite.query({ database: 'scanland', statement: sql, values }),
    };
  }
  throw new Error('Submission queue requires native platform');
}

function mapRowToSubmission(row: any): Submission {
  return {
    id: row.id,
    approvalCode: row.approval_code,
    productImagePath: row.product_image_path || undefined,
    brandName: row.brand_name || undefined,
    productName: row.product_name || undefined,
    companyName: row.company_name || undefined,
    address: row.address || undefined,
    country: row.country || undefined,
    region: row.region || undefined,
    category: row.category || undefined,
    ocrConfidence: row.ocr_confidence || undefined,
    status: row.status,
    createdAt: row.created_at,
    retryCount: row.retry_count,
    lastError: row.last_error || undefined,
  };
}
