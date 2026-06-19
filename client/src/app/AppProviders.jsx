import { UiProvider } from '../state/uiStore.js';
import { DiceProvider } from '../state/diceStore.js';

/**
 * Global App State and Socket Providers.
 */
export function AppProviders({ children }) {
  return (
    <UiProvider>
      <DiceProvider>
        {children}
      </DiceProvider>
    </UiProvider>
  );
}
