import { UiProvider } from '../state/uiStore.js';
import { DiceProvider } from '../state/diceStore.js';
import { CanvasProvider } from '../state/canvasStore.js';
import { SelectionProvider } from '../state/selectionStore.js';
import { HistoryProvider } from '../state/historyStore.js';
import { ClipboardProvider } from '../state/clipboardStore.js';

/**
 * Global App State and Socket Providers.
 * Nesting structure for application contexts:
 * Ui -> Dice -> Canvas -> Selection -> History -> Clipboard
 */
export function AppProviders({ children }) {
  return (
    <UiProvider>
      <DiceProvider>
        <CanvasProvider>
          <SelectionProvider>
            <HistoryProvider>
              <ClipboardProvider>
                {children}
              </ClipboardProvider>
            </HistoryProvider>
          </SelectionProvider>
        </CanvasProvider>
      </DiceProvider>
    </UiProvider>
  );
}
