import { ref, onMounted, onUnmounted } from 'vue';
import { useSubmission } from './useSubmission';
import type { Submission } from '@scanland/shared';

/**
 * Sync composable — automatically uploads pending submissions when the device goes online.
 * Uses Capacitor Network plugin to detect connectivity changes.
 */
export function useSync() {
  const isSyncing = ref(false);
  const pendingCount = ref(0);
  const { getPendingSubmissions, updateStatus } = useSubmission();

  let networkListener: any = null;

  async function startSync(): Promise<void> {
    if (typeof (window as any)?.Capacitor === 'undefined') return;

    const { Network } = await import('@capacitor/network');

    // Listen for connectivity changes
    networkListener = await Network.addListener('networkStatusChange', async (status) => {
      if (status.connected) {
        await uploadPending();
      }
    });

    // Check current status and sync if online
    const status = await Network.getStatus();
    if (status.connected) {
      await uploadPending();
    }
  }

  async function stopSync(): Promise<void> {
    if (networkListener) {
      await networkListener.remove();
      networkListener = null;
    }
  }

  async function uploadPending(): Promise<void> {
    if (isSyncing.value) return;
    isSyncing.value = true;

    try {
      const pending = await getPendingSubmissions();
      pendingCount.value = pending.length;

      for (const submission of pending) {
        if (!submission.id) continue;
        await uploadOne(submission);
        pendingCount.value--;
      }
    } catch (e) {
      console.error('Sync error:', e);
    } finally {
      isSyncing.value = false;
    }
  }

  async function uploadOne(submission: Submission): Promise<void> {
    if (!submission.id) return;

    try {
      await updateStatus(submission.id, 'uploading');

      const apiUrl = import.meta.env.VITE_API_URL || 'https://api.scanland.app';
      const formData = new FormData();
      formData.append('approvalCode', submission.approvalCode);
      if (submission.brandName) formData.append('brandName', submission.brandName);
      if (submission.productName) formData.append('productName', submission.productName);
      if (submission.companyName) formData.append('companyName', submission.companyName);
      if (submission.address) formData.append('address', submission.address);
      if (submission.country) formData.append('country', submission.country);
      if (submission.region) formData.append('region', submission.region);
      if (submission.category) formData.append('category', submission.category);
      if (submission.ocrConfidence != null) {
        formData.append('ocrConfidence', String(submission.ocrConfidence));
      }

      // Upload product image if available
      if (submission.productImagePath) {
        try {
          const { Filesystem } = await import('@capacitor/filesystem');
          const file = await Filesystem.readFile({ path: submission.productImagePath });
          if (typeof file.data === 'string') {
            const blob = base64ToBlob(file.data, 'image/jpeg');
            formData.append('image', blob, 'product.jpg');
          }
        } catch (e) {
          console.warn('Could not attach image:', e);
        }
      }

      const response = await fetch(`${apiUrl}/api/submissions`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      await updateStatus(submission.id, 'uploaded');
    } catch (e: any) {
      await updateStatus(submission.id, 'failed', e.message);
    }
  }

  onMounted(() => {
    startSync();
  });

  onUnmounted(() => {
    stopSync();
  });

  return {
    isSyncing,
    pendingCount,
    uploadPending,
  };
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64);
  const byteArrays: Uint8Array[] = [];
  for (let offset = 0; offset < byteChars.length; offset += 512) {
    const slice = byteChars.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  return new Blob(byteArrays as unknown as BlobPart[], { type: mimeType });
}
