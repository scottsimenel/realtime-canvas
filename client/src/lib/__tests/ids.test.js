import { describe, expect, test } from 'vitest';
import { newElementId, newTabId, newAssetId, newRollId } from '../ids.js';

describe('ID generators', () => {
  test('newElementId generates correct format', () => {
    const id = newElementId();
    expect(id).toMatch(/^el_\d+_[a-z0-9]+$/);
  });

  test('newTabId generates correct format', () => {
    const id = newTabId();
    expect(id).toMatch(/^tab_\d+_[a-z0-9]+$/);
  });

  test('newAssetId generates correct format', () => {
    const id = newAssetId();
    expect(id).toMatch(/^asset_\d+_[a-z0-9]+$/);
  });

  test('newRollId generates correct format', () => {
    const id = newRollId();
    expect(id).toMatch(/^roll_\d+_[a-z0-9]+$/);
  });
});
