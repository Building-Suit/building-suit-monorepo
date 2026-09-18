import { onMounted, ref } from 'vue';
import { useState } from '#app';

/**
 * Theme persistence per Building Suit rules:
 * 1. saved user preference (localStorage 'bs-theme' = 'light' | 'dark')
 * 2. system preference
 * 3. product default (light)
 *
 * The inline script in nuxt.config.ts applies the class before hydration
 * to avoid a flash of incorrect theme. This composable keeps the reactive
 * state in sync and persists toggles.
 */
const STORAGE_KEY = 'bs-theme';

export const useTheme = () => {
  const isDark = useState<boolean>('bs-theme-dark', () => false);

  onMounted(() => {
    isDark.value = document.documentElement.classList.contains('dark');
  });

  const apply = (dark: boolean) => {
    isDark.value = dark;
    if (import.meta.client) {
      document.documentElement.classList.toggle('dark', dark);
      try {
        localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
      } catch {
        /* storage unavailable — preference just not persisted */
      }
    }
  };

  const toggle = () => apply(!isDark.value);

  return { isDark, toggle, apply };
};
