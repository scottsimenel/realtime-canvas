import { describe, expect, test } from 'vitest';
import { UiProvider, useUiStore } from '../uiStore.js';
import { DiceProvider, useDiceStore } from '../diceStore.js';
import { HistoryProvider, useHistoryStore } from '../historyStore.js';
import { SelectionProvider, useSelectionStore } from '../selectionStore.js';
import { ClipboardProvider, useClipboardStore } from '../clipboardStore.js';
import { CanvasProvider, useCanvasStore } from '../canvasStore.js';
import { UploadProvider, useUploadStore } from '../uploadStore.js';
import { useElementActions } from '../../app/hooks/useElementActions.js';

describe('State stores export check', () => {
  test('UiProvider and useUiStore are defined', () => {
    expect(UiProvider).toBeDefined();
    expect(useUiStore).toBeDefined();
  });

  test('DiceProvider and useDiceStore are defined', () => {
    expect(DiceProvider).toBeDefined();
    expect(useDiceStore).toBeDefined();
  });

  test('HistoryProvider and useHistoryStore are defined', () => {
    expect(HistoryProvider).toBeDefined();
    expect(useHistoryStore).toBeDefined();
  });

  test('SelectionProvider and useSelectionStore are defined', () => {
    expect(SelectionProvider).toBeDefined();
    expect(useSelectionStore).toBeDefined();
  });

  test('ClipboardProvider and useClipboardStore are defined', () => {
    expect(ClipboardProvider).toBeDefined();
    expect(useClipboardStore).toBeDefined();
  });

  test('CanvasProvider and useCanvasStore are defined', () => {
    expect(CanvasProvider).toBeDefined();
    expect(useCanvasStore).toBeDefined();
  });

  test('UploadProvider and useUploadStore are defined', () => {
    expect(UploadProvider).toBeDefined();
    expect(useUploadStore).toBeDefined();
  });

  test('useElementActions is defined', () => {
    expect(useElementActions).toBeDefined();
  });
});
