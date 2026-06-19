import { describe, expect, test } from 'vitest';
import { UiProvider, useUiStore } from '../uiStore.js';
import { DiceProvider, useDiceStore } from '../diceStore.js';
import { HistoryProvider, useHistoryStore } from '../historyStore.js';
import { SelectionProvider, useSelectionStore } from '../selectionStore.js';
import { ClipboardProvider, useClipboardStore } from '../clipboardStore.js';

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
});
