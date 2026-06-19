import { describe, expect, test } from 'vitest';
import { UiProvider, useUiStore } from '../uiStore.js';
import { DiceProvider, useDiceStore } from '../diceStore.js';
import { HistoryProvider, useHistoryStore } from '../historyStore.js';
import { SelectionProvider, useSelectionStore } from '../selectionStore.js';
import { ClipboardProvider, useClipboardStore } from '../clipboardStore.js';
import { CanvasProvider, useCanvasStore } from '../canvasStore.js';
import { UploadProvider, useUploadStore } from '../uploadStore.js';
import { useElementActions } from '../../app/hooks/useElementActions.js';
import { useSocketConnection } from '../../app/hooks/useSocketConnection.js';
import { useUserEvents } from '../../app/hooks/useUserEvents.js';
import { useElementEvents } from '../../app/hooks/useElementEvents.js';
import { useTabEvents } from '../../app/hooks/useTabEvents.js';
import { useDiceEvents } from '../../app/hooks/useDiceEvents.js';
import { useSaveEvents } from '../../app/hooks/useSaveEvents.js';

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

  test('useSocketConnection is defined', () => {
    expect(useSocketConnection).toBeDefined();
  });

  test('useUserEvents is defined', () => {
    expect(useUserEvents).toBeDefined();
  });

  test('useElementEvents is defined', () => {
    expect(useElementEvents).toBeDefined();
  });

  test('useTabEvents is defined', () => {
    expect(useTabEvents).toBeDefined();
  });

  test('useDiceEvents is defined', () => {
    expect(useDiceEvents).toBeDefined();
  });

  test('useSaveEvents is defined', () => {
    expect(useSaveEvents).toBeDefined();
  });
});
