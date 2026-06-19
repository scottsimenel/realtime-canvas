import { createContext, useContext, useState, useCallback, createElement } from 'react';
import { getSocket } from '../lib/socket.js';
import { useSelectionStore } from './selectionStore.js';

const HistoryContext = createContext(null);

/**
 * History State Store Provider.
 * Manages undo and redo actions stack.
 */
export function HistoryProvider({
  children,
  setTabs,
  handleSwitchTab,
  activeTabId
}) {
  const { setSelectedElementIds } = useSelectionStore();
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
      handleSwitchTab(targetTabId);
    }

    switch (action.type) {
      case 'create': {
        const elementIds = action.elements.map((el) => el.id);
        socket.emit('element-delete', { elementIds, tabId: targetTabId }, (res) => {
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
        action.elements.forEach((element) => {
          socket.emit('element-create', { element, tabId: targetTabId }, (res) => {
            if (res && res.success) {
              setTabs((prev) =>
                prev.map((t) =>
                  t.id === targetTabId
                    ? {
                        ...t,
                        elements: [...t.elements.filter((el) => el.id !== element.id), element],
                      }
                    : t
                )
              );
            }
          });
        });
        break;
      }
      case 'transform': {
        const batch = action.elementsBefore.map((el) => {
          return {
            elementId: el.id,
            updates: {
              x: el.x,
              y: el.y,
              width: el.width,
              height: el.height,
              properties: el.properties,
            },
          };
        });
        socket.emit('element-update', { batch, tabId: targetTabId }, (res) => {
          if (res && res.success) {
            setTabs((prev) =>
              prev.map((t) =>
                t.id === targetTabId
                  ? {
                      ...t,
                      elements: t.elements.map((el) => {
                        const before = action.elementsBefore.find((b) => b.id === el.id);
                        if (before) {
                          return JSON.parse(JSON.stringify(before));
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
        socket.emit('element-delete', { elementIds: toDeleteIds, tabId: targetTabId }, (res) => {
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

            action.elementsBefore.forEach((element) => {
              socket.emit('element-create', { element, tabId: targetTabId }, (res) => {
                if (res && res.success) {
                  setTabs((prev) =>
                    prev.map((t) =>
                      t.id === targetTabId
                        ? {
                            ...t,
                            elements: [...t.elements.filter((el) => el.id !== element.id), element],
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
        socket.emit('elements-reorder', { orderedIds: action.orderedIdsBefore, tabId: targetTabId }, (res) => {
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
  }, [history, activeTabId, handleSwitchTab, setTabs, setSelectedElementIds]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const action = redoStack[0];
    const socket = getSocket();
    if (!socket || !socket.connected) return;

    const targetTabId = action.tabId || 'tab-default';

    if (activeTabId !== targetTabId) {
      handleSwitchTab(targetTabId);
    }

    switch (action.type) {
      case 'create': {
        action.elements.forEach((element) => {
          socket.emit('element-create', { element, tabId: targetTabId }, (res) => {
            if (res && res.success) {
              setTabs((prev) =>
                prev.map((t) =>
                  t.id === targetTabId
                    ? {
                        ...t,
                        elements: [...t.elements.filter((el) => el.id !== element.id), element],
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
        socket.emit('element-delete', { elementIds, tabId: targetTabId }, (res) => {
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
          return {
            elementId: el.id,
            updates: {
              x: el.x,
              y: el.y,
              width: el.width,
              height: el.height,
              properties: el.properties,
            },
          };
        });
        socket.emit('element-update', { batch, tabId: targetTabId }, (res) => {
          if (res && res.success) {
            setTabs((prev) =>
              prev.map((t) =>
                t.id === targetTabId
                  ? {
                      ...t,
                      elements: t.elements.map((el) => {
                        const after = action.elementsAfter.find((b) => b.id === el.id);
                        if (after) {
                          return JSON.parse(JSON.stringify(after));
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
        socket.emit('element-delete', { elementIds: toDeleteIds, tabId: targetTabId }, (res) => {
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
              socket.emit('element-create', { element, tabId: targetTabId }, (res) => {
                if (res && res.success) {
                  setTabs((prev) =>
                    prev.map((t) =>
                      t.id === targetTabId
                        ? {
                            ...t,
                            elements: [...t.elements.filter((el) => el.id !== element.id), element],
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
        socket.emit('elements-reorder', { orderedIds: action.orderedIdsAfter, tabId: targetTabId }, (res) => {
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
  }, [redoStack, activeTabId, handleSwitchTab, setTabs, setSelectedElementIds]);

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
