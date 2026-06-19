import { useEffect } from 'react';
import { useUiStore } from '../../state/uiStore.js';

/**
 * Hook to register the global shortcut ('\') for toggling Zen Mode.
 */
export function useZenModeShortcut() {
  const { handleToggleZenMode } = useUiStore();

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === '\\') {
        const activeEl = document.activeElement;
        const isInput = activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          activeEl.isContentEditable
        );
        if (!isInput) {
          e.preventDefault();
          handleToggleZenMode();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleToggleZenMode]);
}
