import { EVENTS } from '../../../../shared/protocol.js';
import { useEffect } from 'react';
import { getSocket } from '../../lib/socket.js';
import { mergeElement } from '../../lib/mergeElement.js';
import { useCanvasStore } from '../../state/canvasStore.js';
import { useSelectionStore } from '../../state/selectionStore.js';
import { useUploadStore } from '../../state/uploadStore.js';

/**
 * Hook to listen to element and lock related socket events and update canvas/selection/upload state stores.
 */
export function useElementEvents() {
  const { setTabs } = useCanvasStore();
  const { setSelectedElementIds } = useSelectionStore();
  const { setAssets } = useUploadStore();

  useEffect(() => {
    const s = getSocket();

    const onElementLocked = ({ elementId, userId, tabId }) => {
      const targetTabId = tabId || 'tab-default';
      setTabs((prev) =>
        prev.map((t) =>
          t.id === targetTabId
            ? { ...t, locks: { ...t.locks, [elementId]: userId } }
            : t
        )
      );
    };

    const onElementUnlocked = ({ elementId, tabId }) => {
      const targetTabId = tabId || 'tab-default';
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== targetTabId) return t;
          const nextLocks = { ...t.locks };
          delete nextLocks[elementId];
          return { ...t, locks: nextLocks };
        })
      );
    };

    const onElementUpdated = ({ elementId, updates, tabId }) => {
      const targetTabId = tabId || 'tab-default';
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== targetTabId) return t;
          return {
            ...t,
            elements: t.elements.map((el) =>
              el.id === elementId ? mergeElement(el, updates) : el
            ),
          };
        })
      );
    };

    const onElementUpdatedBatch = ({ batch, tabId }) => {
      const targetTabId = tabId || 'tab-default';
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== targetTabId) return t;
          return {
            ...t,
            elements: t.elements.map((el) => {
              const match = batch.find((item) => item.elementId === el.id);
              return match ? mergeElement(el, match.updates) : el;
            }),
          };
        })
      );
    };

    const onElementCreated = ({ element, tabId }) => {
      const targetTabId = tabId || 'tab-default';
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== targetTabId) return t;
          return {
            ...t,
            elements: [...t.elements.filter((el) => el.id !== element.id), element],
          };
        })
      );
    };

    const onElementDeleted = ({ elementId, tabId }) => {
      const targetTabId = tabId || 'tab-default';
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== targetTabId) return t;
          const nextLocks = { ...t.locks };
          delete nextLocks[elementId];
          return {
            ...t,
            elements: t.elements.filter((el) => el.id !== elementId),
            locks: nextLocks,
          };
        })
      );
      setSelectedElementIds((prev) => prev.filter((id) => id !== elementId));
    };

    const onAssetCreated = ({ asset }) => {
      setAssets((prev) => [...prev.filter((a) => a.id !== asset.id), asset]);
    };

    const onElementsReordered = ({ orderedIds, tabId }) => {
      const targetTabId = tabId || 'tab-default';
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== targetTabId) return t;
          const elementMap = new Map(t.elements.map((el) => [el.id, el]));
          const sorted = [];
          orderedIds.forEach((id) => {
            if (elementMap.has(id)) {
              sorted.push(elementMap.get(id));
            }
          });
          t.elements.forEach((el) => {
            if (!orderedIds.includes(el.id)) {
              sorted.push(el);
            }
          });
          return {
            ...t,
            elements: sorted,
          };
        })
      );
    };

    const onRoomSettingsUpdated = ({ roomSettings: updatedSettings, tabId }) => {
      const targetTabId = tabId || 'tab-default';
      setTabs((prev) =>
        prev.map((t) =>
          t.id === targetTabId
            ? { ...t, roomSettings: updatedSettings }
            : t
        )
      );
    };

    s.on(EVENTS.ELEMENT_LOCKED, onElementLocked);
    s.on(EVENTS.ELEMENT_UNLOCKED, onElementUnlocked);
    s.on(EVENTS.ELEMENT_UPDATED, onElementUpdated);
    s.on(EVENTS.ELEMENT_UPDATED_BATCH, onElementUpdatedBatch);
    s.on(EVENTS.ELEMENT_CREATED, onElementCreated);
    s.on(EVENTS.ELEMENT_DELETED, onElementDeleted);
    s.on(EVENTS.ASSET_CREATED, onAssetCreated);
    s.on(EVENTS.ELEMENTS_REORDERED, onElementsReordered);
    s.on(EVENTS.ROOM_SETTINGS_UPDATED, onRoomSettingsUpdated);

    return () => {
      s.off(EVENTS.ELEMENT_LOCKED, onElementLocked);
      s.off(EVENTS.ELEMENT_UNLOCKED, onElementUnlocked);
      s.off(EVENTS.ELEMENT_UPDATED, onElementUpdated);
      s.off(EVENTS.ELEMENT_UPDATED_BATCH, onElementUpdatedBatch);
      s.off(EVENTS.ELEMENT_CREATED, onElementCreated);
      s.off(EVENTS.ELEMENT_DELETED, onElementDeleted);
      s.off(EVENTS.ASSET_CREATED, onAssetCreated);
      s.off(EVENTS.ELEMENTS_REORDERED, onElementsReordered);
      s.off(EVENTS.ROOM_SETTINGS_UPDATED, onRoomSettingsUpdated);
    };
  }, [setTabs, setSelectedElementIds, setAssets]);
}
