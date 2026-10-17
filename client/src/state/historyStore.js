import { EVENTS } from '../../../shared/protocol.js';
import { createContext, useContext, useState, useCallback, createElement } from 'react';
import { getSocket } from '../lib/socket.js';
import { useSelectionStore } from './selectionStore.js';
import { useCanvasStore } from './canvasStore.js';

const HistoryContext = createContext(null);

/**
 * History State Store Provider.
 * Manages undo and redo actions stack.
 */
export function HistoryProvider({ children }) {
  const { setSelectedElementIds } = useSelectionStore();
  const { setTabs, activeTabId, setActiveTabId } = useCanvasStore();
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const pushHistoryAction = useCallback((action) => {
    setHistory((prev) => {
      const next = [action, ...prev];
      if (next.length > 50) {
        next.pop();
      }
      return next;
    });
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const action = history[0];
    const socket = getSocket();
    if (!socket || !socket.connected) return;

    const targetTabId = action.tabId || 'tab-default';

    if (activeTabId !== targetTabId) {
      setActiveTabId(targetTabId);
      socket.emit(EVENTS.TAB_SWITCH, { tabId: targetTabId });
    }

    switch (action.type) {
      case 'create': {
        const elementIds = action.elements.map((el) => el.id);
        socket.emit(EVENTS.ELEMENT_DELETE, { elementIds, tabId: targetTabId }, (res) => {
          if (res && res.success) {
            setTabs((prev) =>
              prev.map((t) =>
                t.id === targetTabId
                  ? {
                      ...t,
                      elements: t.elements.filter((el) => !elementIds.includes(el.id)),
                    }
                  : t
              )
            );
            setSelectedElementIds((prev) => prev.filter((id) => !elementIds.includes(id)));
          }
        });
        break;
      }
      case 'delete': {
        const sortedElements = [...action.elements].sort(
          (a, b) => (a._layerIndex ?? 999999) - (b._layerIndex ?? 999999)
        );
        let restoredCount = 0;
        sortedElements.forEach((element) => {
          const cleanElement = { ...element };
          const targetIndex = cleanElement._layerIndex;
          delete cleanElement._layerIndex;

          socket.emit(EVENTS.ELEMENT_CREATE, { element: cleanElement, tabId: targetTabId }, (res) => {
            if (res && res.success) {
              setTabs((prev) =>
                prev.map((t) => {
                  if (t.id !== targetTabId) return t;
                  const nextElements = [...t.elements.filter((el) => el.id !== cleanElement.id)];
                  if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex <= nextElements.length) {
                    nextElements.splice(targetIndex, 0, cleanElement);
                  } else {
                    nextElements.push(cleanElement);
                  }
                  return {
                    ...t,
                    elements: nextElements,
                  };
                })
              );
              restoredCount++;
              if (restoredCount === sortedElements.length && sortedElements.some((e) => typeof e._layerIndex === 'number')) {
                setTimeout(() => {
                  setTabs((currentTabs) => {
                    const currentTab = currentTabs.find((t) => t.id === targetTabId);
                    if (currentTab) {
                      socket.emit(EVENTS.ELEMENTS_REORDER, {
                        orderedIds: currentTab.elements.map((el) => el.id),
                        tabId: targetTabId,
                      });
                    }
                    return currentTabs;
                  });
                }, 50);
              }
            }
          });
        });
        break;
      }
      case 'transform': {
        const batch = action.elementsBefore.map((el) => {
          const updates = {
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
            properties: el.properties,
          };
          if (el.type !== undefined) {
            updates.type = el.type;
          }
          return {
            elementId: el.id,
            updates,
          };
        });
        socket.emit(EVENTS.ELEMENT_UPDATE, { batch, tabId: targetTabId }, (res) => {
          if (res && res.success) {
            setTabs((prev) =>
              prev.map((t) =>
                t.id === targetTabId
                  ? {
                      ...t,
                      elements: t.elements.map((el) => {
                        const before = action.elementsBefore.find((b) => b.id === el.id);
                        if (before) {
                          const clean = { ...before };
                          delete clean._layerIndex;
                          return JSON.parse(JSON.stringify(clean));
                        }
                        return el;
                      }),
                    }
                  : t
              )
            );
          }
        });
        break;
      }
      case 'erase': {
        const toDeleteIds = action.elementsAfter.map((el) => el.id);
        socket.emit(EVENTS.ELEMENT_DELETE, { elementIds: toDeleteIds, tabId: targetTabId }, (res) => {
          if (res && res.success) {
            setTabs((prev) =>
              prev.map((t) => {
                if (t.id !== targetTabId) return t;
                return {
                  ...t,
                  elements: t.elements.filter((el) => !toDeleteIds.includes(el.id)),
                };
              })
            );

            const sortedBefore = [...action.elementsBefore].sort(
              (a, b) => (a._layerIndex ?? 999999) - (b._layerIndex ?? 999999)
            );
            sortedBefore.forEach((element) => {
              const cleanElement = { ...element };
              const targetIndex = cleanElement._layerIndex;
              delete cleanElement._layerIndex;

              socket.emit(EVENTS.ELEMENT_CREATE, { element: cleanElement, tabId: targetTabId }, (res) => {
                if (res && res.success) {
                  setTabs((prev) =>
                    prev.map((t) => {
                      if (t.id !== targetTabId) return t;
                      const nextElements = [...t.elements.filter((el) => el.id !== cleanElement.id)];
                      if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex <= nextElements.length) {
                        nextElements.splice(targetIndex, 0, cleanElement);
                      } else {
                        nextElements.push(cleanElement);
                      }
                      return {
                        ...t,
                        elements: nextElements,
                      };
                    })
                  );
                }
              });
            });
          }
        });
        break;
      }
      case 'reorder': {
        socket.emit(EVENTS.ELEMENTS_REORDER, { orderedIds: action.orderedIdsBefore, tabId: targetTabId }, (res) => {
          if (res && res.success) {
            setTabs((prev) =>
              prev.map((t) => {
                if (t.id !== targetTabId) return t;
                const elementMap = new Map(t.elements.map((el) => [el.id, el]));
                const sorted = [];
                action.orderedIdsBefore.forEach((id) => {
                  if (elementMap.has(id)) {
                    sorted.push(elementMap.get(id));
                  }
                });
                t.elements.forEach((el) => {
                  if (!action.orderedIdsBefore.includes(el.id)) {
                    sorted.push(el);
                  }
                });
                return {
                  ...t,
                  elements: sorted,
                };
              })
            );
          }
        });
        break;
      }
      default:
        console.warn('Unknown undo action type:', action.type);
    }

    setRedoStack((prev) => [action, ...prev]);
    setHistory((prev) => prev.slice(1));
  }, [history, activeTabId, setActiveTabId, setTabs, setSelectedElementIds]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const action = redoStack[0];
    const socket = getSocket();
    if (!socket || !socket.connected) return;

    const targetTabId = action.tabId || 'tab-default';

    if (activeTabId !== targetTabId) {
      setActiveTabId(targetTabId);
      socket.emit(EVENTS.TAB_SWITCH, { tabId: targetTabId });
    }

    switch (action.type) {
      case 'create': {
        action.elements.forEach((element) => {
          const cleanElement = { ...element };
          delete cleanElement._layerIndex;
          socket.emit(EVENTS.ELEMENT_CREATE, { element: cleanElement, tabId: targetTabId }, (res) => {
            if (res && res.success) {
              setTabs((prev) =>
                prev.map((t) =>
                  t.id === targetTabId
                    ? {
                        ...t,
                        elements: [...t.elements.filter((el) => el.id !== cleanElement.id), cleanElement],
                      }
                    : t
                )
              );
            }
          });
        });
        break;
      }
      case 'delete': {
        const elementIds = action.elements.map((el) => el.id);
        socket.emit(EVENTS.ELEMENT_DELETE, { elementIds, tabId: targetTabId }, (res) => {
          if (res && res.success) {
            setTabs((prev) =>
              prev.map((t) =>
                t.id === targetTabId
                  ? {
                      ...t,
                      elements: t.elements.filter((el) => !elementIds.includes(el.id)),
                    }
                  : t
              )
            );
            setSelectedElementIds((prev) => prev.filter((id) => !elementIds.includes(id)));
          }
        });
        break;
      }
      case 'transform': {
        const batch = action.elementsAfter.map((el) => {
          const updates = {
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
            properties: el.properties,
          };
          if (el.type !== undefined) {
            updates.type = el.type;
          }
          return {
            elementId: el.id,
            updates,
          };
        });
        socket.emit(EVENTS.ELEMENT_UPDATE, { batch, tabId: targetTabId }, (res) => {
          if (res && res.success) {
            setTabs((prev) =>
              prev.map((t) =>
                t.id === targetTabId
                  ? {
                      ...t,
                      elements: t.elements.map((el) => {
                        const after = action.elementsAfter.find((b) => b.id === el.id);
                        if (after) {
                          const clean = { ...after };
                          delete clean._layerIndex;
                          return JSON.parse(JSON.stringify(clean));
                        }
                        return el;
                      }),
                    }
                  : t
              )
            );
          }
        });
        break;
      }
      case 'erase': {
        const toDeleteIds = action.elementsBefore.map((el) => el.id);
        socket.emit(EVENTS.ELEMENT_DELETE, { elementIds: toDeleteIds, tabId: targetTabId }, (res) => {
          if (res && res.success) {
            setTabs((prev) =>
              prev.map((t) => {
                if (t.id !== targetTabId) return t;
                return {
                  ...t,
                  elements: t.elements.filter((el) => !toDeleteIds.includes(el.id)),
                };
              })
            );

            action.elementsAfter.forEach((element) => {
              const cleanElement = { ...element };
              delete cleanElement._layerIndex;
              socket.emit(EVENTS.ELEMENT_CREATE, { element: cleanElement, tabId: targetTabId }, (res) => {
                if (res && res.success) {
                  setTabs((prev) =>
                    prev.map((t) =>
                      t.id === targetTabId
                        ? {
                            ...t,
                            elements: [...t.elements.filter((el) => el.id !== cleanElement.id), cleanElement],
                          }
                        : t
                    )
                  );
                }
              });
            });
          }
        });
        break;
      }
      case 'reorder': {
        socket.emit(EVENTS.ELEMENTS_REORDER, { orderedIds: action.orderedIdsAfter, tabId: targetTabId }, (res) => {
          if (res && res.success) {
            setTabs((prev) =>
              prev.map((t) => {
                if (t.id !== targetTabId) return t;
                const elementMap = new Map(t.elements.map((el) => [el.id, el]));
                const sorted = [];
                action.orderedIdsAfter.forEach((id) => {
                  if (elementMap.has(id)) {
                    sorted.push(elementMap.get(id));
                  }
                });
                t.elements.forEach((el) => {
                  if (!action.orderedIdsAfter.includes(el.id)) {
                    sorted.push(el);
                  }
                });
                return {
                  ...t,
                  elements: sorted,
                };
              })
            );
          }
        });
        break;
      }
      default:
        console.warn('Unknown redo action type:', action.type);
    }

    setHistory((prev) => [action, ...prev]);
    setRedoStack((prev) => prev.slice(1));
  }, [redoStack, activeTabId, setActiveTabId, setTabs, setSelectedElementIds]);

  const value = {
    history,
    setHistory,
    redoStack,
    setRedoStack,
    pushHistoryAction,
    handleUndo,
    handleRedo
  };

  return createElement(HistoryContext.Provider, { value }, children);
}

/**
 * Hook to consume the History state store context.
 * @returns {object} The History state store values and setters.
 */
export function useHistoryStore() {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error('useHistoryStore must be used within a HistoryProvider');
  }
  return context;
}
