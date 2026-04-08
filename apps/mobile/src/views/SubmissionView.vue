<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/result" />
        </ion-buttons>
        <ion-title>Submit Code</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-card>
        <ion-card-header>
          <ion-card-title>Report Unknown Code</ion-card-title>
          <ion-card-subtitle>
            Help expand the database by submitting information about this code.
          </ion-card-subtitle>
        </ion-card-header>
        <ion-card-content>
          <!-- Code (pre-filled, read-only) -->
          <ion-input
            :value="approvalCode"
            label="Approval Code"
            label-placement="floating"
            readonly
          />

          <!-- Product image -->
          <div class="image-section">
            <ion-button expand="block" fill="outline" @click="takePhoto" class="ion-margin-top">
              <ion-icon slot="start" :icon="cameraOutline" />
              {{ imagePath ? 'Retake Photo' : 'Take Photo of Product' }}
            </ion-button>
            <div v-if="imagePreview" class="image-preview">
              <img :src="imagePreview" alt="Product photo" />
            </div>
          </div>

          <!-- Brand name -->
          <ion-input
            v-model="brandName"
            label="Brand Name"
            label-placement="floating"
            placeholder="e.g. Alpenhain"
            class="ion-margin-top"
          />

          <!-- Product name -->
          <ion-input
            v-model="productName"
            label="Product Name"
            label-placement="floating"
            placeholder="e.g. Back-Camembert"
            class="ion-margin-top"
          />

          <!-- Company name (optional) -->
          <ion-input
            v-model="companyName"
            label="Company Name (optional)"
            label-placement="floating"
            class="ion-margin-top"
          />

          <!-- Country -->
          <ion-select
            v-model="country"
            label="Country"
            label-placement="floating"
            interface="action-sheet"
            class="ion-margin-top"
          >
            <ion-select-option value="DE">Germany (DE)</ion-select-option>
            <ion-select-option value="FR">France (FR)</ion-select-option>
            <ion-select-option value="NL">Netherlands (NL)</ion-select-option>
            <ion-select-option value="PL">Poland (PL)</ion-select-option>
            <ion-select-option value="IT">Italy (IT)</ion-select-option>
            <ion-select-option value="AT">Austria (AT)</ion-select-option>
            <ion-select-option value="BE">Belgium (BE)</ion-select-option>
            <ion-select-option value="ES">Spain (ES)</ion-select-option>
            <ion-select-option value="DK">Denmark (DK)</ion-select-option>
            <ion-select-option value="other">Other</ion-select-option>
          </ion-select>

          <!-- Category -->
          <ion-select
            v-model="category"
            label="Product Category"
            label-placement="floating"
            interface="action-sheet"
            class="ion-margin-top"
          >
            <ion-select-option value="dairy">Dairy</ion-select-option>
            <ion-select-option value="meat">Meat</ion-select-option>
            <ion-select-option value="fish">Fish / Seafood</ion-select-option>
            <ion-select-option value="egg">Egg Products</ion-select-option>
            <ion-select-option value="other">Other</ion-select-option>
          </ion-select>

          <!-- Submit button -->
          <ion-button
            expand="block"
            class="ion-margin-top"
            @click="submitForm"
            :disabled="isSubmitting || !approvalCode"
          >
            <ion-icon slot="start" :icon="cloudUploadOutline" />
            {{ isSubmitting ? 'Saving...' : 'Submit' }}
          </ion-button>
        </ion-card-content>
      </ion-card>

      <!-- Success toast handled via ion-toast -->
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
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
  IonInput,
  IonButton,
  IonIcon,
  IonSelect,
  IonSelectOption,
  toastController,
} from '@ionic/vue';
import { cameraOutline, cloudUploadOutline } from 'ionicons/icons';
import { useScanStore } from '@/stores/scan';
import { useSubmission } from '@/composables/useSubmission';

const router = useRouter();
const scanStore = useScanStore();
const { queueSubmission } = useSubmission();

const approvalCode = computed(
  () => scanStore.lookupResult?.normalizedCode.fullCode || scanStore.currentCode?.fullCode || ''
);

const brandName = ref('');
const productName = ref('');
const companyName = ref('');
const country = ref('DE');
const category = ref('');
const imagePath = ref('');
const imagePreview = ref('');
const isSubmitting = ref(false);

async function takePhoto() {
  try {
    if (typeof (window as any)?.Capacitor !== 'undefined') {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({
        quality: 80,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        width: 1200,
      });
      imagePath.value = photo.path || '';
      imagePreview.value = photo.webPath || '';
    } else {
      // Web fallback: file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) {
          imagePreview.value = URL.createObjectURL(file);
          imagePath.value = file.name;
        }
      };
      input.click();
    }
  } catch (e: any) {
    console.error('Photo capture failed:', e);
  }
}

async function submitForm() {
  isSubmitting.value = true;

  try {
    await queueSubmission({
      approvalCode: approvalCode.value,
      brandName: brandName.value || undefined,
      productName: productName.value || undefined,
      companyName: companyName.value || undefined,
      country: country.value || undefined,
      category: category.value || undefined,
      productImagePath: imagePath.value || undefined,
      ocrConfidence: scanStore.lookupResult?.normalizedCode.confidence,
    });

    const toast = await toastController.create({
      message: 'Submission queued. It will upload when online.',
      duration: 3000,
      color: 'success',
      position: 'bottom',
    });
    await toast.present();

    // Go back to scanner
    scanStore.clear();
    router.push('/tabs/scanner');
  } catch (e: any) {
    const toast = await toastController.create({
      message: `Submission failed: ${e.message}`,
      duration: 3000,
      color: 'danger',
      position: 'bottom',
    });
    await toast.present();
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style scoped>
.image-section {
  margin-top: 8px;
}

.image-preview {
  margin-top: 12px;
  border-radius: 8px;
  overflow: hidden;
}

.image-preview img {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
}
</style>
