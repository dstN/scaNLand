import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import TabsLayout from '@/views/TabsLayout.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/tabs/scanner',
  },
  {
    path: '/tabs/',
    component: TabsLayout,
    children: [
      {
        path: '',
        redirect: '/tabs/scanner',
      },
      {
        path: 'scanner',
        component: () => import('@/views/ScannerView.vue'),
      },
      {
        path: 'manual',
        component: () => import('@/views/ManualInputView.vue'),
      },
      {
        path: 'history',
        component: () => import('@/views/HistoryView.vue'),
      },
    ],
  },
  {
    path: '/result',
    component: () => import('@/views/ResultView.vue'),
  },
  {
    path: '/submit',
    component: () => import('@/views/SubmissionView.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
