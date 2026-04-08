import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { NormalizedApprovalCode, LookupResult } from '@scanland/shared';

export const useScanStore = defineStore('scan', () => {
  const currentCode = ref<NormalizedApprovalCode | null>(null);
  const lookupResult = ref<LookupResult | null>(null);
  const ocrText = ref('');
  const isProcessing = ref(false);
  const scanHistory = ref<LookupResult[]>([]);

  function setOcrText(text: string) {
    ocrText.value = text;
  }

  function setCurrentCode(code: NormalizedApprovalCode) {
    currentCode.value = code;
  }

  function setLookupResult(result: LookupResult) {
    lookupResult.value = result;
    // Add to history
    scanHistory.value.unshift(result);
    if (scanHistory.value.length > 100) {
      scanHistory.value.pop();
    }
  }

  function clear() {
    currentCode.value = null;
    lookupResult.value = null;
    ocrText.value = '';
    isProcessing.value = false;
  }

  return {
    currentCode,
    lookupResult,
    ocrText,
    isProcessing,
    scanHistory,
    setOcrText,
    setCurrentCode,
    setLookupResult,
    clear,
  };
});
