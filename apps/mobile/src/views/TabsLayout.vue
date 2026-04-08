<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="scanner" href="/tabs/scanner">
          <ion-icon :icon="scanOutline" />
          <ion-label>Scan</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="manual" href="/tabs/manual">
          <ion-icon :icon="keypadOutline" />
          <ion-label>Manual</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="history" href="/tabs/history">
          <ion-icon :icon="timeOutline" />
          <ion-label>History</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonTabs,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
} from '@ionic/vue';
import { scanOutline, keypadOutline, timeOutline } from 'ionicons/icons';
</script>
