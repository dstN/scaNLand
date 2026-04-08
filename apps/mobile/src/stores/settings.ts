import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useSettingsStore = defineStore('settings', () => {
  const preferredOcrEngine = ref<'mlkit' | 'tesseract' | 'auto'>('auto');
  const hapticFeedback = ref(true);
  const autoSubmit = ref(false);
  const darkMode = ref<'system' | 'light' | 'dark'>('system');

  function setOcrEngine(engine: 'mlkit' | 'tesseract' | 'auto') {
    preferredOcrEngine.value = engine;
  }

  function toggleHaptic() {
    hapticFeedback.value = !hapticFeedback.value;
  }

  function setDarkMode(mode: 'system' | 'light' | 'dark') {
    darkMode.value = mode;
  }

  return {
    preferredOcrEngine,
    hapticFeedback,
    autoSubmit,
    darkMode,
    setOcrEngine,
    toggleHaptic,
    setDarkMode,
  };
});
