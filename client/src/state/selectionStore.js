import { createContext, useContext, useState, createElement } from 'react';
import { useCanvasStore } from './canvasStore.js';

const SelectionContext = createContext(null);

/**
 * Selection State Store Provider.
 * Manages active canvas selection and inspector transform input synchronizations.
 */
export function SelectionProvider({ children }) {
  const { elements } = useCanvasStore();
  const [selectedElementIds, setSelectedElementIds] = useState([]);
  const [inputWidth, setInputWidth] = useState('');
  const [inputHeight, setInputHeight] = useState('');
  const [inputRotation, setInputRotation] = useState('');
  const [isInspectorFocused, setIsInspectorFocused] = useState(false);

  const [prevSelectedElementIds, setPrevSelectedElementIds] = useState([]);
  const [prevElements, setPrevElements] = useState([]);

  if (prevSelectedElementIds !== selectedElementIds || prevElements !== elements) {
    setPrevSelectedElementIds(selectedElementIds);
    setPrevElements(elements);

    if (selectedElementIds.length === 0) {
      setInputWidth('');
      setInputHeight('');
      setInputRotation('');
    } else {
      const selectedElements = elements.filter((el) => selectedElementIds.includes(el.id));
      if (selectedElements.length > 0) {
        if (!isInspectorFocused) {
          const firstWidth = selectedElements[0].width;
          const allSameWidth = selectedElements.every((el) => el.width === firstWidth);
          setInputWidth(allSameWidth ? String(firstWidth) : '');

          const firstHeight = selectedElements[0].height;
          const allSameHeight = selectedElements.every((el) => el.height === firstHeight);
          setInputHeight(allSameHeight ? String(firstHeight) : '');

          const firstRot = selectedElements[0].properties?.rotation || 0;
          const deg = Math.round((firstRot * 180) / Math.PI) % 360;
          const normalizedDeg = deg < 0 ? deg + 360 : deg;
          const allSameRot = selectedElements.every((el) => {
            const r = el.properties?.rotation || 0;
            const d = Math.round((r * 180) / Math.PI) % 360;
            const nd = d < 0 ? d + 360 : d;
            return nd === normalizedDeg;
          });
          setInputRotation(allSameRot ? String(normalizedDeg) : '');
        }
      }
    }
  }

  const value = {
    selectedElementIds,
    setSelectedElementIds,
    inputWidth,
    setInputWidth,
    inputHeight,
    setInputHeight,
    inputRotation,
    setInputRotation,
    isInspectorFocused,
    setIsInspectorFocused
  };

  return createElement(SelectionContext.Provider, { value }, children);
}

/**
 * Hook to consume the Selection state store context.
 * @returns {object} The Selection state store values and setters.
 */
export function useSelectionStore() {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error('useSelectionStore must be used within a SelectionProvider');
  }
  return context;
}
