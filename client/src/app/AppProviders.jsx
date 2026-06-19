import { UiProvider } from '../state/uiStore.js';
import { DiceProvider } from '../state/diceStore.js';
import { CanvasProvider } from '../state/canvasStore.js';
import { SelectionProvider } from '../state/selectionStore.js';
import { HistoryProvider } from '../state/historyStore.js';
import { ClipboardProvider } from '../state/clipboardStore.js';
import { UploadProvider } from '../state/uploadStore.js';

/**
 * Global App State and Socket Providers.
 * Nesting structure for application contexts:
 * Ui -> Dice -> Upload -> Canvas -> Selection -> History -> Clipboard
 */
export function AppProviders({ children }) {
  return (
    <UiProvider>
      <DiceProvider>
        <UploadProvider>
          <CanvasProvider>
            <SelectionProvider>
              <HistoryProvider>
                <ClipboardProvider>
                  {children}
                </ClipboardProvider>
              </HistoryProvider>
            </SelectionProvider>
          </CanvasProvider>
        </UploadProvider>
      </DiceProvider>
    </UiProvider>
  );
}
