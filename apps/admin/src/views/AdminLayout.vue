<template>
  <div class="admin-layout">
    <nav class="sidebar">
      <div class="sidebar-header">
        <h2>scaNLand</h2>
        <span class="badge badge-review">Admin</span>
      </div>

      <ul class="nav-links">
        <li>
          <router-link to="/dashboard" active-class="active">
            📊 Dashboard
          </router-link>
        </li>
        <li>
          <router-link to="/submissions" active-class="active">
            📋 Submissions
          </router-link>
        </li>
      </ul>

      <div class="sidebar-footer">
        <p class="user-email">{{ auth.user?.email }}</p>
        <button class="btn btn-outline" @click="handleLogout">Logout</button>
      </div>
    </nav>

    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();

function handleLogout() {
  auth.logout();
  router.push('/login');
}
</script>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 240px;
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  padding: 20px 0;
}

.sidebar-header {
  padding: 0 20px 20px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: 8px;
}

.sidebar-header h2 {
  font-size: 18px;
}

.nav-links {
  list-style: none;
  padding: 12px 0;
  flex: 1;
}

.nav-links li a {
  display: block;
  padding: 10px 20px;
  color: var(--color-text);
  font-size: 14px;
  transition: background 0.2s;
}

.nav-links li a:hover,
.nav-links li a.active {
  background: var(--color-bg);
  color: var(--color-primary);
}

.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
}

.user-email {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.main-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}
</style>
