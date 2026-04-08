<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>History</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list v-if="scanStore.scanHistory.length > 0">
        <ion-item-sliding v-for="(item, index) in scanStore.scanHistory" :key="index">
          <ion-item @click="viewResult(item)" button>
            <ion-icon
              slot="start"
              :icon="item.matched ? checkmarkCircleOutline : closeCircleOutline"
              :color="item.matched ? 'success' : 'danger'"
            />
            <ion-label>
              <h2>{{ item.normalizedCode.fullCode }}</h2>
              <p v-if="item.matched && item.manufacturer">
                {{ item.manufacturer.companyName }}
              </p>
              <p v-else>Not found</p>
            </ion-label>
            <ion-note slot="end">
              <ion-chip
                :color="getConfidenceColor(item.confidence)"
                size="small"
              >
                {{ Math.round(item.confidence * 100) }}%
              </ion-chip>
            </ion-note>
          </ion-item>

          <ion-item-options side="end">
            <ion-item-option color="danger" @click="removeItem(index)">
              <ion-icon slot="icon-only" :icon="trashOutline" />
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>

      <!-- Empty state -->
      <div v-else class="empty-state">
        <ion-icon :icon="timeOutline" size="large" />
        <h2>No Scan History</h2>
        <p>Your scanned and looked-up codes will appear here.</p>
        <ion-button router-link="/tabs/scanner" fill="outline">
          Start Scanning
        </ion-button>
      </div>

      <!-- Pending submissions -->
      <ion-card v-if="pendingCount > 0">
        <ion-card-header>
          <ion-card-title>Pending Submissions</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <p>{{ pendingCount }} submission(s) waiting to upload.</p>
          <ion-button
            expand="block"
            fill="outline"
            @click="syncNow"
            :disabled="isSyncing"
          >
            <ion-icon slot="start" :icon="syncOutline" />
            {{ isSyncing ? 'Syncing...' : 'Sync Now' }}
          </ion-button>
        </ion-card-content>
      </ion-card>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonIcon,
  IonLabel,
  IonNote,
  IonChip,
  IonButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
} from '@ionic/vue';
import {
  checkmarkCircleOutline,
  closeCircleOutline,
  trashOutline,
  timeOutline,
  syncOutline,
} from 'ionicons/icons';
import type { LookupResult } from '@scanland/shared';
import { useScanStore } from '@/stores/scan';
import { useSync } from '@/composables/useSync';

const router = useRouter();
const scanStore = useScanStore();
const { pendingCount, isSyncing, uploadPending: syncNow } = useSync();

function viewResult(item: LookupResult) {
  scanStore.setLookupResult(item);
  router.push('/result');
}

function removeItem(index: number) {
  scanStore.scanHistory.splice(index, 1);
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'success';
  if (confidence >= 0.7) return 'warning';
  return 'danger';
}
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  text-align: center;
}

.empty-state ion-icon {
  font-size: 64px;
  color: var(--ion-color-medium);
  margin-bottom: 16px;
}

.empty-state h2 {
  margin-bottom: 8px;
}

.empty-state p {
  color: var(--ion-color-medium);
  margin-bottom: 24px;
}
</style>
