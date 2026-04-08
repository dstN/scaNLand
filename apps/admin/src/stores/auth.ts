import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

interface User {
  id: number;
  email: string;
  role: string;
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '');
  const user = ref<User | null>(null);

  const isAuthenticated = computed(() => !!token.value);

  async function login(email: string, password: string) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login failed');
    }

    const data = await res.json();
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem('token', data.token);
  }

  function logout() {
    token.value = '';
    user.value = null;
    localStorage.removeItem('token');
  }

  async function fetchUser() {
    if (!token.value) return;
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token.value}` },
    });
    if (res.ok) {
      user.value = await res.json();
    } else {
      logout();
    }
  }

  return { token, user, isAuthenticated, login, logout, fetchUser };
});
