<template>
  <div class="submission-detail">
    <div class="back-link">
      <router-link to="/submissions">← Back to Submissions</router-link>
    </div>

    <div v-if="loading" class="loading">Loading...</div>

    <template v-if="submission">
      <div class="header">
        <h1>Submission #{{ submission.id }}</h1>
        <span :class="'badge badge-' + submission.moderationStatus">
          {{ submission.moderationStatus }}
        </span>
      </div>

      <div class="detail-grid">
        <!-- Main info -->
        <div class="card">
          <h2>Code Details</h2>
          <dl>
            <dt>Approval Code</dt>
            <dd><code>{{ submission.approvalCode }}</code></dd>

            <dt>Brand</dt>
            <dd>{{ submission.brandName || '–' }}</dd>

            <dt>Product</dt>
            <dd>{{ submission.productName || '–' }}</dd>

            <dt>Company</dt>
            <dd>{{ submission.companyName || '–' }}</dd>

            <dt>Country</dt>
            <dd>{{ submission.country || '–' }}</dd>

            <dt>Category</dt>
            <dd>{{ submission.category || '–' }}</dd>

            <dt>OCR Confidence</dt>
            <dd>{{ submission.ocrConfidence ? (submission.ocrConfidence * 100).toFixed(0) + '%' : '–' }}</dd>

            <dt>Submitted</dt>
            <dd>{{ formatDate(submission.createdAt) }}</dd>
          </dl>
        </div>

        <!-- Image -->
        <div class="card" v-if="submission.productImageUrl">
          <h2>Product Image</h2>
          <img :src="submission.productImageUrl" alt="Product" class="product-image" />
        </div>

        <!-- Moderation info -->
        <div class="card">
          <h2>Moderation</h2>
          <dl>
            <dt>Queue</dt>
            <dd>
              <span :class="'badge badge-' + queueBadge(submission.moderationQueue)">
                {{ submission.moderationQueue }}
              </span>
            </dd>

            <dt>Suspicion Reasons</dt>
            <dd>
              <span v-if="submission.suspicionReasons?.length">
                {{ submission.suspicionReasons.join(', ') }}
              </span>
              <span v-else>None</span>
            </dd>

            <dt v-if="submission.reviewedBy">Reviewed By</dt>
            <dd v-if="submission.reviewedBy">User #{{ submission.reviewedBy }}</dd>

            <dt v-if="submission.rejectionReason">Rejection Reason</dt>
            <dd v-if="submission.rejectionReason">{{ submission.rejectionReason }}</dd>
          </dl>
        </div>
      </div>

      <!-- Actions -->
      <div v-if="submission.moderationStatus === 'pending'" class="actions card">
        <h2>Actions</h2>
        <div class="action-buttons">
          <button class="btn btn-success" @click="approve" :disabled="acting">
            ✓ Approve
          </button>
          <button class="btn btn-danger" @click="showRejectDialog = true" :disabled="acting">
            ✗ Reject
          </button>
        </div>

        <!-- Reject dialog -->
        <div v-if="showRejectDialog" class="reject-dialog">
          <textarea
            v-model="rejectionReason"
            placeholder="Reason for rejection (optional)"
            rows="3"
          />
          <div class="reject-actions">
            <button class="btn btn-danger" @click="reject" :disabled="acting">
              Confirm Rejection
            </button>
            <button class="btn btn-outline" @click="showRejectDialog = false">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const props = defineProps<{ id: string }>();
const router = useRouter();
const auth = useAuthStore();

const submission = ref<any>(null);
const loading = ref(true);
const acting = ref(false);
const showRejectDialog = ref(false);
const rejectionReason = ref('');

async function loadSubmission() {
  try {
    const res = await fetch(`/api/admin/submissions/${props.id}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (!res.ok) throw new Error('Not found');
    submission.value = await res.json();
  } catch {
    router.push('/submissions');
  } finally {
    loading.value = false;
  }
}

async function approve() {
  acting.value = true;
  try {
    await fetch(`/api/admin/submissions/${props.id}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    await loadSubmission();
  } finally {
    acting.value = false;
  }
}

async function reject() {
  acting.value = true;
  try {
    await fetch(`/api/admin/submissions/${props.id}/reject`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: rejectionReason.value }),
    });
    showRejectDialog.value = false;
    await loadSubmission();
  } finally {
    acting.value = false;
  }
}

function queueBadge(queue: string): string {
  const map: Record<string, string> = {
    pending: 'pending',
    review_required: 'review',
    approved: 'approved',
    auto_rejected: 'rejected',
  };
  return map[queue] || 'pending';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

onMounted(loadSubmission);
</script>

<style scoped>
.back-link {
  margin-bottom: 16px;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.card h2 {
  font-size: 16px;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}

dl {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 8px 16px;
}

dt {
  font-size: 13px;
  color: var(--color-text-secondary);
}

dd {
  font-size: 14px;
}

.product-image {
  width: 100%;
  max-height: 300px;
  object-fit: contain;
  border-radius: var(--radius);
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.reject-dialog textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 14px;
  margin-bottom: 12px;
  resize: vertical;
}

.reject-actions {
  display: flex;
  gap: 8px;
}

.loading {
  padding: 48px;
  text-align: center;
}
</style>
