import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from './stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: () => import('./views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('./views/AdminLayout.vue'),
      children: [
        {
          path: '',
          redirect: '/dashboard',
        },
        {
          path: 'dashboard',
          component: () => import('./views/DashboardView.vue'),
        },
        {
          path: 'submissions',
          component: () => import('./views/SubmissionsView.vue'),
        },
        {
          path: 'submissions/:id',
          component: () => import('./views/SubmissionDetailView.vue'),
          props: true,
        },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (!to.meta.public && !auth.isAuthenticated) {
    return '/login';
  }
});

export default router;
