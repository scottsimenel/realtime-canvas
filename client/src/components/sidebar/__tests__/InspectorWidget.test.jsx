import { describe, expect, test } from 'vitest';
import InspectorWidget from '../InspectorWidget.jsx';

describe('InspectorWidget unit tests', () => {
  test('returns null when selectedElementIds is empty', () => {
    const result = InspectorWidget({
      selectedElementIds: [],
      elements: [],
      inputWidth: '',
      setInputWidth: () => {},
      inputHeight: '',
      setInputHeight: () => {},
      inputRotation: '',
      setInputRotation: () => {},
      handleStartInspectorTransform: () => {},
      handleEndInspectorTransform: () => {},
      handleInspectorChange: () => {},
      adjustSelectedElementsLayer: () => {},
      handleDeleteSelected: () => {},
    });
    expect(result).toBeNull();
  });

  test('returns null when selected element is not found in elements list (tab switch race safety)', () => {
    const result = InspectorWidget({
      selectedElementIds: ['el_missing_123'],
      elements: [
        { id: 'el_existing_456', type: 'rectangle', x: 0, y: 0, width: 100, height: 100, properties: {} }
      ],
      inputWidth: '',
      setInputWidth: () => {},
      inputHeight: '',
      setInputHeight: () => {},
      inputRotation: '',
      setInputRotation: () => {},
      handleStartInspectorTransform: () => {},
      handleEndInspectorTransform: () => {},
      handleInspectorChange: () => {},
      adjustSelectedElementsLayer: () => {},
      handleDeleteSelected: () => {},
    });
    expect(result).toBeNull();
  });
});
