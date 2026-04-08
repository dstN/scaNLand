<template>
  <div class="login-page">
    <div class="login-card card">
      <h1>scaNLand Admin</h1>
      <p class="subtitle">Sign in to manage submissions</p>

      <form @submit.prevent="handleLogin">
        <div class="field">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            placeholder="admin@scanland.app"
          />
        </div>

        <div class="field">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            minlength="8"
          />
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <button type="submit" class="btn btn-primary btn-full" :disabled="isLoading">
          {{ isLoading ? 'Signing in...' : 'Sign In' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();

const email = ref('');
const password = ref('');
const error = ref('');
const isLoading = ref(false);

async function handleLogin() {
  error.value = '';
  isLoading.value = true;

  try {
    await auth.login(email.value, password.value);
    router.push('/dashboard');
  } catch (e: any) {
    error.value = e.message;
  } finally {
    isLoading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
}

.login-card {
  width: 100%;
  max-width: 400px;
}

.login-card h1 {
  font-size: 24px;
  margin-bottom: 4px;
}

.subtitle {
  color: var(--color-text-secondary);
  margin-bottom: 24px;
}

.field {
  margin-bottom: 16px;
}

.field label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.field input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 14px;
}

.field input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.error {
  color: var(--color-danger);
  font-size: 14px;
  margin-bottom: 12px;
}

.btn-full {
  width: 100%;
  justify-content: center;
  padding: 12px;
}
</style>
