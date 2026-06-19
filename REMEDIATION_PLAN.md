# Refactor Remediation Plan — Closing the Gaps from the Stages 0–7 Review

**Status:** Proposed
**Originates from:** Review of commits `9bf6c50`–`29365a6` (Stages 0–7)
**Goal:** Finish the refactor to the standard claimed in `REFACTOR_PLAN.md` and enforced by the `[BLOCKING]` rules in `agent.md`.

---

## 📋 Context — Why This Plan Exists

The Stages 0–7 refactor landed green: lint clean, build passing, 28/28 tests. But a code-level review found the work is **~80% complete** relative to its stated goals. Five gaps remain, ordered by severity:

| # | Gap | Severity | Violates agent.md rule |
|---|-----|----------|------------------------|
| G1 | Stage 7 left **18 hardcoded socket event strings** in `Canvas.jsx` (17) and `RightSidebar.jsx` (1) | 🔴 High | §Arch 5 three-file protocol `[BLOCKING]` |
| G2 | **20 of 28 tests are existence-only** (`expect(X).toBeDefined()`); high-risk logic untested | 🔴 High | (intent of §Workflows 3 verification gate) |
| G3 | `walkthrough.md` is **stale + inaccurate** (re-pastes 2024 work; claims "4,200→600 lines", actual is ~2,750→134) | 🟡 Medium | §Guardrails 5 preserve audit trail |
| G4 | **`AppContent.jsx` is 1,264 lines** — a new near-megacomponent holding 6 local `useState`s + 6 refs | 🟡 Medium | §Arch 6 architecture boundaries |
| G5 | `agent.md` edited mid-refactor without flagging; stray `nul` file untracked | 🟢 Low | §Guardrails 1 read-before-write |

This plan closes all five. Each workstream is independently shippable and independently revertible.

---

## 🎯 Target State (Definition of Done for this plan)

- [ ] **Zero** hardcoded socket event string literals in `client/src/` outside `shared/protocol.js`. (`io.on('connection')` in `server.js` is legitimately exempt — it's a Socket.io lifecycle event, not a protocol event.)
- [ ] Test suite has **behavioral coverage** of every pure function with branching logic and every store reducer. Existence-only tests are removed or upgraded.
- [ ] `walkthrough.md` rewritten to reflect actual state, with verifiable line counts.
- [ ] `AppContent.jsx` is **under 500 lines** and holds no business state — only layout composition + hook delegation.
- [ ] `nul` file gone; `agent.md` change log noted.
- [ ] Every workstream leaves `npm run lint`, `npm run build`, `npm run test` green.
- [ ] Every change follows the three-file protocol rule and is documented in `STRUCTURE.md` if it adds files.

---

## 🧭 Workstream Order & Dependencies

```
WS1 (protocol rewiring)   ──┐
WS4 (AppContent slimming) ──┤── independent of each other; can parallelize
WS5 (housekeeping)        ──┘
WS2 (behavioral tests)    ───── can start after WS1 (so tests cover rewired emits)
WS3 (walkthrough rewrite) ───── must be LAST (documents the final state)
```

Recommended merge order: **WS5 → WS1 → WS4 → WS2 → WS3.**
WS3 goes last because it records the end state and must not be written until that state is fixed.

---

# WS1 — Finish Stage 7: Rewire the 18 Remaining Hardcoded Socket Emits

**Severity:** 🔴 High · **Risk:** Low (mechanical) · **Files touched:** 2 client + STRUCTURE.md

### Problem
`shared/protocol.js` exists and is used by the hooks/stores, but two view files still emit raw strings:

| File | Line | Current | Should be |
|------|------|---------|-----------|
| `Canvas.jsx` | 344 | `socket.emit('cursor-move', ...)` | `EVENTS.CURSOR_MOVE` |
| `Canvas.jsx` | 373 | `socket.emit('element-delete', ...)` | `EVENTS.ELEMENT_DELETE` |
| `Canvas.jsx` | 449 | `socket.emit('element-unlock', ...)` | `EVENTS.ELEMENT_UNLOCK` |
| `Canvas.jsx` | 456 | `socket.emit('element-unlock', ...)` | `EVENTS.ELEMENT_UNLOCK` |
| `Canvas.jsx` | 728 | `socket.emit('element-delete', ...)` | `EVENTS.ELEMENT_DELETE` |
| `Canvas.jsx` | 730 | `socket.emit('element-create', ...)` | `EVENTS.ELEMENT_CREATE` |
| `Canvas.jsx` | 762, 806, 857, 886 | `socket.emit('element-lock', ...)` ×4 | `EVENTS.ELEMENT_LOCK` |
| `Canvas.jsx` | 970 | `socket.emit('element-delete', ...)` | `EVENTS.ELEMENT_DELETE` |
| `Canvas.jsx` | 972 | `socket.emit('element-create', ...)` | `EVENTS.ELEMENT_CREATE` |
| `Canvas.jsx` | 1234, 1237 | `socket.emit('element-update', ...)` ×2 | `EVENTS.ELEMENT_UPDATE` |
| `Canvas.jsx` | 1305 | `socket.emit('element-create', ...)` | `EVENTS.ELEMENT_CREATE` |
| `Canvas.jsx` | 1386, 1416 | `socket.emit('element-unlock', ...)` ×2 | `EVENTS.ELEMENT_UNLOCK` |
| `RightSidebar.jsx` | 212 | `socket.emit('element-delete', ...)` | `EVENTS.ELEMENT_DELETE` |

### Steps
1. **Add the import** to both files:
   ```js
   import { EVENTS } from '../../../shared/protocol.js';
   ```
   (Verify the relative path — `Canvas.jsx` is at `client/src/components/canvas/`, so `../../../shared/protocol.js`. Confirm against how `AppContent.jsx:1` imports it.)
2. **Mechanical replacement** — swap each of the 18 string literals for its `EVENTS.*` constant. Use `git grep -n "socket.emit('[a-z-]"` to re-verify zero remain after.
3. **Do not** reformat surrounding lines — keep the diff minimal (§Guardrails 3).
4. **Smoke test in two browser tabs**: drag, lock (verify outline appears in peer's color), eraser-split, delete, multi-select move, paste, cursor-move. All must propagate to the peer.

### Verification gate (paste output before claiming done)
```bash
# Must print 0:
git grep -nE "socket\.(emit|on|off)\(['\"][a-z-]+['\"]" client/src/ | grep -v shared/protocol.js | wc -l
npm --prefix client run lint
npm --prefix client run build
```

### Exit criteria
- Grep for hardcoded emits in `client/src/` returns **0**.
- Two-browser smoke test passes for drag/lock/erase/delete/paste/cursor.

---

# WS2 — Replace Existence-Only Tests with Behavioral Tests

**Severity:** 🔴 High · **Risk:** Medium (logic is subtle) · **Files touched:** test files only

### Problem
`stores.test.js` runs 14 tests, all `expect(X).toBeDefined()`. The 6 hook tests are the same. These confirm files import — they will not catch a regression in undo/redo, paste-offset, or lock cleanup. The 28/28 number gives false confidence.

### Strategy: tier the test effort by risk

**Tier A — Pure functions (highest value, easiest):** test actual input→output.
| Target | File | Test cases |
|--------|------|-----------|
| `mergeElement` | `lib/mergeElement.js` | (already has 4 tests — **augment**: nested `properties` merge, undefined `updates`, idempotency) |
| `locksArrayToMap` | `lib/locks.js` | (has 2 tests — **augment**: empty array, duplicate keys, last-wins semantics) |
| `splitPathElement` | `components/canvas/CanvasSelection.js` | **NEW**: eraser crossing a stroke → 2 children with correct bounding boxes; no crossing → unchanged; edge cases (endpoint hit, tangent) |
| `getElementAtCoords` / `getHoveredElement` | `CanvasSelection.js` | **NEW**: rotated rectangle hit/miss; z-order (topmost wins); circle uses normalized distance |
| `getGroupBoundingBox` | `CanvasSelection.js` | **NEW**: rotated children → correct axis-aligned bbox |
| Quaternion ops (`qMultiply`, `qLerp`, `getRotationToAlignNormal`) | `components/dice/DiceMath.js` | **NEW**: identity mult, associativity, slerp endpoints, face alignment |

**Tier B — Store reducers (the highest-risk untested logic):**
| Target | Test cases |
|--------|-----------|
| `historyStore.handleUndo` / `handleRedo` | Push a `create` action → undo deletes it → redo recreates with identical properties. Repeat for `delete`, `transform`, `erase`, `reorder` action types. Verify the 50-action cap evicts oldest. Verify empty-stack undo is a no-op. |
| `clipboardStore.handlePaste` | Paste offset increments by `+20` on consecutive pastes; resets to `20` after a copy; new element IDs are regenerated (not cloned). |
| `canvasStore` lock-map transforms | `setLocks` from array form → object form; `setElements` scoped to active tab; switching `activeTabId` does not bleed elements between tabs. |
| `selectionStore` render-sync block | The `prevSelectedElementIds`/`prevElements` sync-during-render pattern must not fire when selection is unchanged (regression guard for the subtle pattern flagged in `REFACTOR_PLAN.md` risks). |

**Tier C — Replace, don't keep, the existence tests:**
- Delete the 14 `expect(X).toBeDefined()` tests in `stores.test.js` and the 6 in the hook tests.
- If keeping a module-load sanity check is desired, consolidate into **one** test per file: `expect(() => render(<Providers><App/></Providers>)).not.toThrow()` style, not 14 trivial ones.

### Testing harness notes
- Use `@testing-library/react` `renderHook` for hook tests and `render` for provider trees.
- For `historyStore`/`clipboardStore`, the tests need the providers mounted — use a small `withProviders(wrapper)` helper.
- Mock the socket singleton (`lib/socket.js`) in hook tests with `vi.mock`.
- The pure-function tests (Tier A) need **no** React or socket — keep them isolated and fast.

### Verification gate
```bash
npm --prefix client run test -- --coverage
```
Target: **≥70% statements / ≥60% branches** on `state/`, `lib/`, `components/canvas/CanvasSelection.js`, `components/dice/DiceMath.js`. Report the actual coverage numbers in the walkthrough.

### Exit criteria
- Existence-only tests removed or consolidated to one-per-file.
- Behavioral tests added for all Tier A and Tier B targets.
- Coverage thresholds met (paste the coverage table).

---

# WS3 — Rewrite `walkthrough.md` to Reflect Reality

**Severity:** 🟡 Medium · **Risk:** None (docs only) · **Files touched:** `.agents/walkthrough.md`

### Problem
The current `walkthrough.md` is ~70% a re-paste of the **2024** modularization (server handler splits, `CanvasSelection`/`CanvasRenderer`/`DiceEffects` decomposition). For the Stages 0–7 refactor specifically it claims:
- "Simplified `App.jsx` from **4,200 lines** to ~600 lines" — **both numbers wrong** (actual: ~2,750 → 134).
- Omits that Stage 7 left 18 hardcoded emits (now fixed by WS1).
- Omits that `AppContent.jsx` became a 1,264-line megacomponent (now fixed by WS4).
- Calls 28/28 tests meaningful without disclosing that 20 are existence-only (now fixed by WS2).

### Steps
1. **Preserve the historical 2024 section** but move it under a clearly-labeled `## Historical: Original Modularization (pre-refactor)` heading so it's not mistaken for recent work.
2. **Write a new top section** `## Refactor Stages 0–7 (2026-06) + Remediation` with:
   - Accurate line counts: `App.jsx` 2,750 → 134; `AppContent.jsx` created at 1,264 → reduced to <500 by remediation.
   - Honest accounting of what each stage delivered vs. what it claimed.
   - A "Remediation follow-up" subsection documenting G1–G5 and how each was closed, with the verification evidence (grep counts, coverage numbers, build output).
3. **Include the actual verification output** from WS1/WS2/WS4 (paste the green lint/build/test + the `git grep` zero-count line + the coverage table).
4. Cross-link to `REFACTOR_PLAN.md` and `REMEDIATION_PLAN.md`.

### Exit criteria
- Every numeric claim in `walkthrough.md` is reproducible from the codebase or git history.
- No reference to "4,200 lines" or "600 lines".
- The remediation workstream outcomes are recorded with evidence.

---

# WS4 — Slim `AppContent.jsx` (Stage 8)

**Severity:** 🟡 Medium · **Risk:** Medium (touches the main render tree) · **Files touched:** `AppContent.jsx`, new/updated stores

### Problem
`AppContent.jsx` (1,264 lines) still owns business state that belongs in stores:
- `useState`: `showSavesModal` (L46), `activeVirtualDimensions` (L96), `activeTool` (L99), `penColor` (L100), `penSize` (L101), `eraserSize` (L102), `showCursorNames` (L104).
- `useRef`: `nameRef`, `colorRef`, `roomIdRef`, `joinedRef` (L205–208), `activeTabIdRef` (L218), `inspectorLockRef`, `originalInspectorElementsRef` (L278–279).

This is the new bottleneck — the exact problem the refactor was meant to solve.

### Target architecture
```
state/uiStore.js           ← add: activeTool, penColor, penSize, eraserSize,
                              showCursorNames, activeVirtualDimensions, showSavesModal
                              (everything tool/canvas-preference related)
state/selectionStore.js    ← add: inspectorLockRef, originalInspectorElementsRef
                              (these are selection-transform scratch state)
state/canvasStore.js       ← activeTabIdRef already belongs here (it mirrors activeTabId);
                              replace the ref with the store value + a derivation
```
`nameRef`/`colorRef`/`roomIdRef`/`joinedRef` are lobby/session scratch — leave in `App.jsx` (where the lobby already lives) or move to a new `state/sessionStore.js` only if they're read in `AppContent`. Verify before moving.

### Steps (incremental, one concern per commit)
1. **Inventory**: for each piece of state, grep all readers/writers in `AppContent.jsx` and its children. Record the list in the commit message.
2. **Move tool state** (`activeTool`, `penColor`, `penSize`, `eraserSize`) → `uiStore`. This is the cleanest cluster.
3. **Move canvas-preference state** (`showCursorNames`, `activeVirtualDimensions`, `showSavesModal`) → `uiStore`.
4. **Move inspector scratch** (`inspectorLockRef`, `originalInspectorElementsRef`) → `selectionStore`.
5. **Resolve `activeTabIdRef`** — it duplicates `canvasStore.activeTabId`. Determine why the ref exists (likely a stale-closure workaround) and replace it with the store value if safe; if the ref is load-bearing, document why in a comment.
6. **After each move**: run lint + build + tests + the two-browser smoke test for the affected feature.

### Exit criteria
- `AppContent.jsx` is **< 500 lines**.
- It contains **no** `useState`/`useRef` for business state (only layout composition + hook delegation).
- Tool switching, pen drawing, eraser, cursor-name toggle, inspector transform, save modal all still work in a two-browser session.

---

# WS5 — Housekeeping

**Severity:** 🟢 Low · **Risk:** None · **Files touched:** repo root, `agent.md`, `STRUCTURE.md`

### Steps
1. **Delete the `nul` file** — it's a Windows artifact (likely from an accidental `> nul` redirect). Confirm it's not referenced anywhere first: `git grep -n "\bnul\b"` should return nothing meaningful.
2. **Add `nul` to `.gitignore`** as a one-line guard in case it recurs on Windows. (Pattern: `/nul`.)
3. **Document the `agent.md` edit history** — commit `b8d5ac5` modified `agent.md` mid-refactor to add `.agents/` publish instructions. Add a one-line note at the top of agent.md's Workflows section: *"Change log: artifact-publishing workflow added in `b8d5ac5`; all other edits must be flagged before applying (§Guardrails 1)."* This makes the self-edit visible rather than buried.
4. **Verify `STRUCTURE.md` documents every file** added by the refactor (`app/`, `app/hooks/*`, `state/*`, `lib/*`, `shared/protocol.js`). Per §Arch 6, an undocumented file is a violation. Cross-check against `git ls-files client/src/app client/src/state client/src/lib shared/`.

### Exit criteria
- `git status` shows only intentional changes (no `nul`).
- `STRUCTURE.md` lists every tracked file in the new directories.

---

## ✅ Final Verification (run after all workstreams merge)

```bash
# 1. Protocol completeness — expect 0
git grep -nE "socket\.(emit|on|off)\(['\"][a-z-]+['\"]" client/src/ | grep -v shared/protocol.js | wc -l

# 2. Standard gates
npm --prefix client run lint
npm --prefix client run build
npm --prefix client run test -- --coverage

# 3. AppContent size — expect < 500
wc -l client/src/app/AppContent.jsx

# 4. Clean tree
git status
```

All four must pass. Paste the output into the rewritten `walkthrough.md`.

---

## ⚠️ Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| WS1 mechanical replacement introduces a typo'd constant that silently breaks an event. | The grep check + two-browser smoke test will catch it; constants are imported, so a typo is a compile error, not a silent runtime miss. |
| WS2 behavioral tests for `historyStore` reveal a latent bug in the undo/redo logic. | **Good** — that's the point. Fix the bug, don't weaken the test. Document in walkthrough. |
| WS4 moving `activeTabIdRef` breaks a stale-closure workaround the refactor introduced. | Step 5 is explicitly "determine why the ref exists" before removing; if load-bearing, keep it with a comment rather than force-removing. |
| Workstreams drift from the `[BLOCKING]` rules mid-execution. | This plan is governed by the same `agent.md` rules. Each workstream's verification gate is a blocking checkpoint. |
| Parallel WS1/WS4/WS5 work conflicts on `STRUCTURE.md`. | Merge WS5's `STRUCTURE.md` update last, after the file lists stabilize. |

---

## 🗓️ Suggested Execution

- **One developer/agent session per workstream.** WS1 and WS4 are the only ones with real logic risk; WS5 and WS3 are mechanical/doc.
- **Merge order:** WS5 → WS1 → WS4 → WS2 → WS3.
- **Each workstream = one commit** with the verification output in the message body.
- **No workstream is "done" until its verification gate passes and the output is pasted.**

This closes every gap from the review and leaves the refactor at the standard the original plan and `agent.md` rules demand.
