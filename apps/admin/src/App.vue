<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuthStore } from './stores/auth';

const auth = useAuthStore();

onMounted(() => {
  if (auth.isAuthenticated) {
    auth.fetchUser();
  }
});
</script>
