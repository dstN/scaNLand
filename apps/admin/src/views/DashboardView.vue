<template>
  <div class="dashboard">
    <h1>Dashboard</h1>

    <div class="stats-grid" v-if="stats">
      <div class="card stat-card">
        <div class="stat-value">{{ stats.pending }}</div>
        <div class="stat-label">Pending</div>
      </div>
      <div class="card stat-card stat-review">
        <div class="stat-value">{{ stats.reviewRequired }}</div>
        <div class="stat-label">Needs Review</div>
      </div>
      <div class="card stat-card stat-approved">
        <div class="stat-value">{{ stats.approved }}</div>
        <div class="stat-label">Approved</div>
      </div>
      <div class="card stat-card stat-rejected">
        <div class="stat-value">{{ stats.rejected }}</div>
        <div class="stat-label">Rejected</div>
      </div>
    </div>

    <div v-if="loading" class="loading">Loading stats...</div>
    <div v-if="error" class="error">{{ error }}</div>

    <div class="quick-actions card">
      <h2>Quick Actions</h2>
      <div class="actions">
        <router-link to="/submissions?queue=pending" class="btn btn-primary">
          Review Pending
        </router-link>
        <router-link to="/submissions?queue=review_required" class="btn btn-outline">
          Flagged Items
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();

interface Stats {
  pending: number;
  reviewRequired: number;
  approved: number;
  rejected: number;
  total: number;
}

const stats = ref<Stats | null>(null);
const loading = ref(true);
const error = ref('');

onMounted(async () => {
  try {
    const res = await fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (!res.ok) throw new Error('Failed to load stats');
    stats.value = await res.json();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.dashboard h1 {
  margin-bottom: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  text-align: center;
  padding: 20px;
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  color: var(--color-primary);
}

.stat-review .stat-value {
  color: var(--color-warning);
}

.stat-approved .stat-value {
  color: var(--color-success);
}

.stat-rejected .stat-value {
  color: var(--color-danger);
}

.stat-label {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}

.quick-actions h2 {
  margin-bottom: 16px;
  font-size: 18px;
}

.actions {
  display: flex;
  gap: 12px;
}

.loading,
.error {
  padding: 24px;
  text-align: center;
}

.error {
  color: var(--color-danger);
}
</style>
