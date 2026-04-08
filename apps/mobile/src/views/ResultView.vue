<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/scanner" />
        </ion-buttons>
        <ion-title>Result</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <!-- No result in store -->
      <div v-if="!result" class="no-result">
        <ion-icon :icon="helpCircleOutline" size="large" />
        <p>No scan result available. Try scanning or entering a code first.</p>
        <ion-button router-link="/tabs/scanner">Go to Scanner</ion-button>
      </div>

      <!-- Match found -->
      <template v-if="result?.matched && result.manufacturer">
        <ion-card>
          <ion-card-header>
            <ion-chip :color="confidenceColor" class="confidence-chip">
              {{ Math.round(result.confidence * 100) }}% match
            </ion-chip>
            <ion-card-title>{{ result.manufacturer.companyName }}</ion-card-title>
            <ion-card-subtitle>{{ result.normalizedCode.fullCode }}</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <!-- Address -->
            <ion-list lines="none">
              <ion-item v-if="fullAddress">
                <ion-icon slot="start" :icon="locationOutline" />
                <ion-label class="ion-text-wrap">{{ fullAddress }}</ion-label>
              </ion-item>

              <ion-item v-if="result.normalizedCode.stateCode">
                <ion-icon slot="start" :icon="mapOutline" />
                <ion-label>{{ stateName }}</ion-label>
              </ion-item>

              <ion-item v-if="result.normalizedCode.euSuffix">
                <ion-icon slot="start" :icon="ribbonOutline" />
                <ion-label>EU Suffix: {{ result.normalizedCode.euSuffix }}</ion-label>
              </ion-item>

              <ion-item v-if="result.matchMethod">
                <ion-icon slot="start" :icon="searchOutline" />
                <ion-label>Match method: {{ result.matchMethod }}</ion-label>
              </ion-item>
            </ion-list>

            <!-- Categories -->
            <div v-if="result.manufacturer.categories?.length" class="categories">
              <h3>Categories</h3>
              <ion-chip v-for="cat in result.manufacturer.categories" :key="cat" color="tertiary">
                {{ cat }}
              </ion-chip>
            </div>

            <!-- Remarks -->
            <div v-if="result.manufacturer.remarks" class="remarks">
              <h3>Remarks</h3>
              <p>{{ result.manufacturer.remarks }}</p>
            </div>

            <!-- Restrictions -->
            <div v-if="result.manufacturer.restrictions" class="restrictions">
              <h3>Restrictions</h3>
              <p>{{ result.manufacturer.restrictions }}</p>
            </div>

            <!-- Approval status warnings -->
            <ion-card v-if="result.manufacturer.approvalSuspendedSince" color="danger">
              <ion-card-content>
                <ion-icon :icon="warningOutline" />
                Approval suspended since {{ result.manufacturer.approvalSuspendedSince }}
              </ion-card-content>
            </ion-card>

            <ion-card v-if="result.manufacturer.approvalValidUntil" color="warning">
              <ion-card-content>
                <ion-icon :icon="timeOutline" />
                Approval valid until {{ result.manufacturer.approvalValidUntil }}
              </ion-card-content>
            </ion-card>
          </ion-card-content>
        </ion-card>

        <!-- Actions -->
        <div class="actions">
          <ion-button expand="block" @click="scanAnother">
            <ion-icon slot="start" :icon="scanOutline" />
            Scan Another
          </ion-button>
        </div>
      </template>

      <!-- No match -->
      <template v-if="result && !result.matched">
        <ion-card color="warning">
          <ion-card-header>
            <ion-card-title>Not Found</ion-card-title>
            <ion-card-subtitle>{{ result.normalizedCode.fullCode }}</ion-card-subtitle>
          </ion-card-header>
          <ion-card-content>
            <p>
              This approval code was not found in the database. It may be from a different
              country, recently issued, or the code may have been read incorrectly.
            </p>
          </ion-card-content>
        </ion-card>

        <div class="actions">
          <ion-button expand="block" @click="submitMissing">
            <ion-icon slot="start" :icon="addCircleOutline" />
            Submit This Code
          </ion-button>
          <ion-button expand="block" fill="outline" @click="scanAnother">
            <ion-icon slot="start" :icon="refreshOutline" />
            Try Again
          </ion-button>
        </div>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonList,
  IonItem,
  IonIcon,
  IonLabel,
  IonChip,
  IonButton,
} from '@ionic/vue';
import {
  locationOutline,
  mapOutline,
  ribbonOutline,
  searchOutline,
  warningOutline,
  timeOutline,
  scanOutline,
  addCircleOutline,
  refreshOutline,
  helpCircleOutline,
} from 'ionicons/icons';
import { GERMAN_STATE_NAMES } from '@scanland/shared';
import { useScanStore } from '@/stores/scan';

const router = useRouter();
const scanStore = useScanStore();

const result = computed(() => scanStore.lookupResult);

const fullAddress = computed(() => {
  const m = result.value?.manufacturer;
  if (!m) return '';
  const parts = [];
  if (m.street) parts.push(m.street + (m.houseNumber ? ` ${m.houseNumber}` : ''));
  if (m.postalCode || m.city) parts.push([m.postalCode, m.city].filter(Boolean).join(' '));
  return parts.join(', ');
});

const stateName = computed(() => {
  const code = result.value?.normalizedCode?.stateCode;
  if (!code) return '';
  return (GERMAN_STATE_NAMES as Record<string, string>)[code] || code;
});

const confidenceColor = computed(() => {
  const c = result.value?.confidence ?? 0;
  if (c >= 0.9) return 'success';
  if (c >= 0.7) return 'warning';
  return 'danger';
});

function scanAnother() {
  scanStore.clear();
  router.push('/tabs/scanner');
}

function submitMissing() {
  router.push('/submit');
}
</script>

<style scoped>
.no-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.no-result ion-icon {
  font-size: 64px;
  color: var(--ion-color-medium);
  margin-bottom: 16px;
}

.confidence-chip {
  margin-bottom: 8px;
}

.categories,
.remarks,
.restrictions {
  margin-top: 16px;
}

.categories h3,
.remarks h3,
.restrictions h3 {
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--ion-color-medium);
}

.actions {
  padding: 16px 0;
}

.actions ion-button {
  margin-bottom: 8px;
}
</style>
