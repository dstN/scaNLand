<template>
  <div class="submissions">
    <div class="page-header">
      <h1>Submissions</h1>
      <div class="filters">
        <select v-model="queueFilter" @change="loadSubmissions">
          <option value="">All Queues</option>
          <option value="pending">Pending</option>
          <option value="review_required">Needs Review</option>
          <option value="approved">Approved</option>
          <option value="auto_rejected">Auto-Rejected</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="loading">Loading...</div>

    <table v-if="items.length > 0" class="data-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Code</th>
          <th>Brand</th>
          <th>Country</th>
          <th>Queue</th>
          <th>Status</th>
          <th>Date</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id">
          <td>{{ item.id }}</td>
          <td><code>{{ item.approvalCode }}</code></td>
          <td>{{ item.brandName || '–' }}</td>
          <td>{{ item.country || '–' }}</td>
          <td>
            <span :class="'badge badge-' + queueBadge(item.moderationQueue)">
              {{ item.moderationQueue }}
            </span>
          </td>
          <td>
            <span :class="'badge badge-' + item.moderationStatus">
              {{ item.moderationStatus }}
            </span>
          </td>
          <td>{{ formatDate(item.createdAt) }}</td>
          <td>
            <router-link :to="`/submissions/${item.id}`" class="btn btn-outline btn-sm">
              View
            </router-link>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="!loading && items.length === 0" class="empty">
      No submissions found.
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="pagination">
      <button
        class="btn btn-outline"
        :disabled="page <= 1"
        @click="page--; loadSubmissions()"
      >
        Previous
      </button>
      <span>Page {{ page }} of {{ totalPages }}</span>
      <button
        class="btn btn-outline"
        :disabled="page >= totalPages"
        @click="page++; loadSubmissions()"
      >
        Next
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const auth = useAuthStore();

const items = ref<any[]>([]);
const loading = ref(true);
const page = ref(1);
const totalPages = ref(1);
const queueFilter = ref((route.query.queue as string) || '');

async function loadSubmissions() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (queueFilter.value) params.set('queue', queueFilter.value);
    params.set('page', String(page.value));
    params.set('limit', '20');

    const res = await fetch(`/api/admin/submissions?${params}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (!res.ok) throw new Error('Failed to load');
    const data = await res.json();
    items.value = data.items;
    totalPages.value = data.totalPages;
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
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
  return new Date(iso).toLocaleDateString();
}

onMounted(loadSubmissions);
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.filters select {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 14px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-surface);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow);
}

.data-table th,
.data-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.data-table th {
  background: var(--color-bg);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
}

.data-table code {
  background: var(--color-bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px 0;
}

.empty,
.loading {
  padding: 48px;
  text-align: center;
  color: var(--color-text-secondary);
}
</style>
