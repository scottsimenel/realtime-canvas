import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RoomManager } from '../roomManager.js';
import { sanitizeRoomId } from '../registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const baseSavesDir = path.join(__dirname, '..', 'saves');

describe('RoomManager & Multi-Room Isolation Tests', () => {
  const testRoomA = 'test-room-alpha';
  const testRoomB = 'test-room-beta';

  const cleanTestDirs = () => {
    [testRoomA, testRoomB].forEach((roomId) => {
      const roomDir = path.join(baseSavesDir, roomId);
      if (fs.existsSync(roomDir)) {
        fs.rmSync(roomDir, { recursive: true, force: true });
      }
    });
  };

  before(() => {
    cleanTestDirs();
  });

  after(() => {
    cleanTestDirs();
  });

  it('sanitizeRoomId removes invalid characters and limits length', () => {
    assert.strictEqual(sanitizeRoomId('My Room 123!@#'), 'my-room-123');
    assert.strictEqual(sanitizeRoomId('../../etc/passwd'), 'etc-passwd');
    assert.strictEqual(sanitizeRoomId(''), 'canvas-default');
    assert.strictEqual(sanitizeRoomId(null), 'canvas-default');
    assert.strictEqual(sanitizeRoomId('A'.repeat(50)).length, 32);
  });

  it('getOrCreateRoom creates and caches registry instances', () => {
    const manager = new RoomManager();
    const reg1 = manager.getOrCreateRoom(testRoomA);
    const reg2 = manager.getOrCreateRoom(testRoomA);
    const regB = manager.getOrCreateRoom(testRoomB);

    assert.ok(reg1);
    assert.strictEqual(reg1, reg2, 'Repeated call for same room should return same cached instance');
    assert.notStrictEqual(reg1, regB, 'Different rooms should return distinct instances');
    assert.strictEqual(reg1.roomId, testRoomA);
    assert.strictEqual(regB.roomId, testRoomB);
  });

  it('isolates user sessions and elements between rooms', () => {
    const manager = new RoomManager();
    const regA = manager.getOrCreateRoom(testRoomA);
    const regB = manager.getOrCreateRoom(testRoomB);

    // Alice joins room A
    const aliceState = regA.joinRoom('socket-alice', 'Alice', '#ff0000');
    assert.strictEqual(regA.users.size, 1);
    assert.strictEqual(regB.users.size, 0);

    // Bob joins room B
    const bobState = regB.joinRoom('socket-bob', 'Bob', '#00ff00');
    assert.strictEqual(regA.users.size, 1);
    assert.strictEqual(regB.users.size, 1);

    // Alice adds element to room A
    const tabA = aliceState.activeTabId;
    regA.createElement(tabA, {
      id: 'shape-1',
      type: 'rectangle',
      x: 100,
      y: 100,
      width: 50,
      height: 50
    });

    assert.strictEqual(regA.tabs.get(tabA).elements.size, 1);
    const tabB = bobState.activeTabId;
    assert.strictEqual(regB.tabs.get(tabB).elements.size, 0);
  });

  it('isolates saves on disk per room', () => {
    const manager = new RoomManager();
    const regA = manager.getOrCreateRoom(testRoomA);
    const regB = manager.getOrCreateRoom(testRoomB);

    const saveRes = regA.saveState('Alpha Save');
    assert.ok(saveRes.id);
    const saveFilePath = path.join(regA.savesDir, `${saveRes.id}.json`);
    assert.ok(fs.existsSync(saveFilePath));
    assert.ok(saveFilePath.includes(testRoomA));

    const savesA = regA.listSaves();
    const savesB = regB.listSaves();

    assert.strictEqual(savesA.length, 1);
    assert.strictEqual(savesB.length, 0, 'Room B should not see saves belonging to Room A');
  });

  it('listRooms accurately aggregates active rooms and disk saves', () => {
    const manager = new RoomManager();
    manager.getOrCreateRoom(testRoomA);
    manager.getOrCreateRoom(testRoomB);

    const roomList = manager.listRooms();
    assert.ok(Array.isArray(roomList));

    const roomA = roomList.find(r => r.id === testRoomA);
    const roomB = roomList.find(r => r.id === testRoomB);

    assert.ok(roomA);
    assert.ok(roomB);
    assert.strictEqual(roomA.hasSave, true);
    assert.strictEqual(roomB.hasSave, false);
  });

  it('removeUser disconnects user and releases locks for specified room', () => {
    const manager = new RoomManager();
    const regA = manager.getOrCreateRoom(testRoomA);

    regA.joinRoom('socket-temp', 'TempUser', '#ffffff');
    const tabId = regA.tabs.keys().next().value;
    regA.createElement(tabId, {
      id: 'shape-lock-1',
      type: 'rectangle',
      x: 10,
      y: 10
    });
    regA.lockElement(tabId, 'shape-lock-1', 'socket-temp');
    assert.strictEqual(regA.tabs.get(tabId).locks.has('shape-lock-1'), true);

    const result = manager.removeUser('socket-temp', testRoomA);
    assert.strictEqual(regA.users.has('socket-temp'), false);
    assert.strictEqual(result.releasedLocks.length, 1);
    assert.strictEqual(result.releasedLocks[0].elementId, 'shape-lock-1');
  });

  it('autosaveAllRooms saves active rooms', () => {
    const manager = new RoomManager();
    const regA = manager.getOrCreateRoom(testRoomA);
    regA.joinRoom('socket-alice', 'Alice', '#ff0000');

    const count = manager.autosaveAllRooms();
    assert.ok(count >= 1);
  });
});
