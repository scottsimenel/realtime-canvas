import { describe, expect, test } from 'vitest';
import { UiProvider, useUiStore } from '../uiStore.js';
import { DiceProvider, useDiceStore } from '../diceStore.js';

describe('State stores export check', () => {
  test('UiProvider and useUiStore are defined', () => {
    expect(UiProvider).toBeDefined();
    expect(useUiStore).toBeDefined();
  });

  test('DiceProvider and useDiceStore are defined', () => {
    expect(DiceProvider).toBeDefined();
    expect(useDiceStore).toBeDefined();
  });
});
