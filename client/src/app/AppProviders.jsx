import { UiProvider } from '../state/uiStore.js';
import { DiceProvider } from '../state/diceStore.js';
import { HistoryProvider } from '../state/historyStore.js';
import { SelectionProvider } from '../state/selectionStore.js';
import { ClipboardProvider } from '../state/clipboardStore.js';

/**
 * Global App State and Socket Providers.
 */
export function AppProviders({
  children,
  elements = [],
  setElements,
  activeTabId,
  locks = {},
  currentUser,
  setTabs,
  handleSwitchTab
}) {
  return (
    <UiProvider>
      <DiceProvider>
        <SelectionProvider elements={elements}>
          <HistoryProvider
            setTabs={setTabs}
            handleSwitchTab={handleSwitchTab}
            activeTabId={activeTabId}
          >
            <ClipboardProvider
              elements={elements}
              setElements={setElements}
              activeTabId={activeTabId}
              locks={locks}
              currentUser={currentUser}
            >
              {children}
            </ClipboardProvider>
          </HistoryProvider>
        </SelectionProvider>
      </DiceProvider>
    </UiProvider>
  );
}
