# Refactor Remediation Plan v2 — Closing the Residual Gaps

**Status:** Proposed
**Supersedes:** the previous `REMEDIATION_PLAN.md` (its WS1/WS4/WS5 landed; this plan closes what remains)
**Originates from:** Review of commits `41d01e9`–`ccdc13e` (the WS1–WS5 remediation pass)

---

## 📋 Context — Why This Plan Exists

The first remediation pass closed the two highest-severity code gaps cleanly:
- **WS1** ✅ — all 18 hardcoded socket emits rewired to `EVENTS.*` (verified: 0 remain in `client/src/`).
- **WS4** ✅ — `AppContent.jsx` slimmed 1,264 → **449 lines**; business state moved into stores.

But a code-level review (lint/build/test run independently, coverage report read, source inspected) found **three residual gaps** that the first pass either skipped or only partially addressed:

| # | Gap | Severity | Status after pass 1 |
|---|-----|----------|---------------------|
| R1 | `walkthrough.md` **not rewritten** — still claims "4,200 → 600 lines" (false); zero mention of WS1–WS5/Stage 7.5/Stage 8 | 🔴 High | ❌ Skipped |
| R2 | `historyStore` (367 lines, the highest-risk module) has **no behavioral test** — not even imported by any test; `state/` coverage 58.87% stmts / 28.84% branches, below the ≥70%/60% target | 🔴 High | ❌ Untouched |
| R3 | `splitPathElement` has **no positive-split test** — the one existing case asserts `length === 0` (correct for those inputs, but misleadingly named, and no case exercises an actual split) | 🟡 Medium | ❌ Untouched |
| R4 | `useSelectionActions.js` is **load-bearing but undocumented** in `STRUCTURE.md` (0 mentions) — §Arch 6 violation | 🟡 Medium | ❌ Untouched |
| R5 | `npm run lint` now warns on generated `coverage/` file | 🟢 Low | ⚠️ Partial |

This plan closes all five. Each workstream is independently shippable and independently revertible.

---

## 🎯 Definition of Done (for this plan)

- [ ] `.agents/walkthrough.md` contains **no** occurrence of "4,200" or "600 lines"; accurate line counts (App.jsx 2,750→134, AppContent.jsx 1,264→449); a "Remediation" section records WS1–WS5 outcomes with the coverage table.
- [ ] A **behavioral** `historyStore` test suite exists: push/undo/redo across all 5 action types, the 50-action cap eviction, and empty-stack no-op.
- [ ] A **positive-split** `splitPathElement` test exists that asserts ≥1 child element with correct geometry; the misleadingly-named test is renamed or its inputs made honest.
- [ ] `useSelectionActions.js` is documented in `STRUCTURE.md`.
- [ ] `coverage/` added to ESLint `globalIgnores` so `npm run lint` is warning-free.
- [ ] `npm run lint`, `npm run build`, `npm run test -- --coverage` all green; `state/` branch coverage **≥60%**; output pasted into walkthrough.

---

## 🧭 Workstream Order & Dependencies

```
RW1 (walkthrough) ─── must be LAST (documents final state)
RW2 (historyStore tests) ─┐
RW3 (splitPathElement test) ─┤── independent; can parallelize
RW4 (STRUCTURE.md doc) ─────┤
RW5 (housekeeping) ─────────┘
```

Recommended merge order: **RW5 → RW4 → RW3 → RW2 → RW1.**
RW1 goes last because it records the end state (including the new test files and final coverage numbers) and must not be written until that state is fixed.

---

# RW1 — Rewrite `walkthrough.md` to Reflect Reality

**Severity:** 🔴 High · **Risk:** None (docs only) · **Files touched:** `.agents/walkthrough.md`

### Problem
The current `walkthrough.md` (~309 lines) is largely a re-paste of the **2024** modularization and contains a provably false claim at line 45:

> *"Simplified `App.jsx` from 4,200 lines to a lightweight coordinator (~600 lines)"*

Actual numbers (verified from git history and current files): `App.jsx` went **~2,750 → 134** lines, with an intermediate `AppContent.jsx` that grew to **1,264** lines and was later slimmed to **449**. There is **no mention** anywhere of the WS1–WS5 remediation, Stage 7.5, or Stage 8. This violates §Guardrails 5 (preserve the audit trail) — the audit log misrepresents the work.

### Steps
1. **Preserve the legitimate historical content** but move it under a clearly-labeled heading `## Historical: Original Modularization (pre-2026)` so it's not mistaken for recent work. The server-handler splits, `CanvasSelection`/`CanvasRenderer`/`DiceEffects` decomposition, grid snapping, ruler, clipboard, etc. are real history — keep them, just date and label them.
2. **Rewrite the two stale "Verification & Testing Results" sections** (there are two, both with outdated bundle hashes/sizes). Replace with a single current section reporting the verified numbers from this plan's final run.
3. **Write a new top section** `## App.jsx Decomposition — Stages 0–7 + Remediation` with:
   - Accurate counts: `App.jsx` 2,750 → 134; `AppContent.jsx` created at 1,264 → reduced to 449 by remediation.
   - The `shared/protocol.js` introduction and the three-file-protocol rule.
   - The state/hook extraction map (`state/*`, `app/hooks/*`, `lib/*`).
   - An honest accounting: Stage 7 *claimed* full protocol rewiring but left 18 hardcoded emits (fixed by remediation Stage 7.5); Stage 8 slimmed AppContent.
4. **Add a "Remediation" subsection** documenting RW1–RW5 outcomes: the grep showing 0 hardcoded emits, the coverage table, the new historyStore/splitPath tests, the STRUCTURE.md fix.
5. **Remove** every reference to "4,200 lines" and "600 lines". Verify with: `grep -nE "4,?200|600 lines" .agents/walkthrough.md` → must be empty.

### Exit criteria
- `grep -nE "4,?200|600 lines" .agents/walkthrough.md` returns nothing.
- Every numeric claim (line counts, bundle sizes, test counts, coverage %) is reproducible from the codebase or git history at the time of writing.
- The remediation workstream outcomes are recorded with the actual verification output pasted.

---

# RW2 — Behavioral Tests for `historyStore`

**Severity:** 🔴 High · **Risk:** Medium (logic is subtle, may surface latent bugs) · **Files touched:** `client/src/state/__tests__/historyStore.test.js` (new), possibly `stores.test.js` (remove the mock-out)

### Problem
`historyStore.js` (367 lines) contains the most complex client logic in the codebase: a `handleUndo`/`handleRedo` pair each dispatching over **5 action types** (`create`, `delete`, `transform`, `erase`, `reorder`), a 50-action cap, empty-stack guards, and cross-tab switching. The coverage report **does not list it at all** — it is not imported by any test. The existing `stores.test.js` (lines 94–102) actively **mocks it out** rather than testing it. `state/` branch coverage is 28.84%, far below the 60% target. This is the single highest-value test gap.

### The history action contract (transcribed from source for test correctness)
| `action.type` | Fields | Undo emits | Redo emits |
|---|---|---|---|
| `create` | `elements[]`, `tabId` | `ELEMENT_DELETE` (the created ids) | `ELEMENT_CREATE` (each element) |
| `delete` | `elements[]`, `tabId` | `ELEMENT_CREATE` (each element) | `ELEMENT_DELETE` (the ids) |
| `transform` | `elementsBefore[]`, `elementsAfter[]`, `tabId` | `ELEMENT_UPDATE` batch from `elementsBefore` | `ELEMENT_UPDATE` batch from `elementsAfter` |
| `erase` | `elementsBefore[]`, `elementsAfter[]`, `tabId` | `ELEMENT_DELETE` `elementsAfter`, then `ELEMENT_CREATE` `elementsBefore` | `ELEMENT_DELETE` `elementsBefore`, then `ELEMENT_CREATE` `elementsAfter` |
| `reorder` | `orderedIdsBefore[]`, `orderedIdsAfter[]`, `tabId` | `ELEMENTS_REORDER` `orderedIdsBefore` | `ELEMENTS_REORDER` `orderedIdsAfter` |

### Strategy — reuse the proven React-mock pattern
`stores.test.js` already establishes a working pattern: mock `react` (useState/useRef/useCallback/useMemo/useEffect/createContext/useContext/createElement), mock `lib/socket.js`, and mock the sibling stores (`selectionStore`, `canvasStore`). Import the provider *after* the mocks are defined, then drive the callbacks captured from the provider's context value. Use this exact pattern for `historyStore.test.js`.

### Required test cases
1. **Empty-stack no-op**: `handleUndo()` with empty `history` emits nothing; `handleRedo()` with empty `redoStack` emits nothing.
2. **`create` round-trip**: push a `create` action → `handleUndo` emits `ELEMENT_DELETE` with the element ids and calls `setTabs` to remove them → `handleRedo` emits `ELEMENT_CREATE` per element and restores them. Assert exact emitted event names and payloads via the socket mock.
3. **`delete` round-trip**: mirror of create — undo restores, redo re-deletes.
4. **`transform` round-trip**: undo emits an `ELEMENT_UPDATE` batch whose updates equal `elementsBefore`; redo emits a batch equal to `elementsAfter`. Verify the `setTabs` mapper restores the correct pre/post element objects (deep-equal, since source uses `JSON.parse(JSON.stringify(...))`).
5. **`erase` round-trip**: undo emits `ELEMENT_DELETE` for `elementsAfter` ids then `ELEMENT_CREATE` for each `elementsBefore`; redo does the inverse. This is the most complex branch — assert the **order** of emits.
6. **`reorder` round-trip**: undo emits `ELEMENTS_REORDER` with `orderedIdsBefore`; redo with `orderedIdsAfter`. Verify the `setTabs` mapper reconstructs the element array in the emitted order.
7. **50-action cap**: push 52 distinct actions → assert `history.length === 50` and the two oldest were evicted (FIFO). Assert `redoStack` is cleared on each push.
8. **Cross-tab switch**: push an action with `tabId: 'tab-other'` while `activeTabId` is `'tab-default'` → undo calls `setActiveTabId('tab-other')` and emits `TAB_SWITCH`. (Guard: confirm the source reads `activeTabId` from `useCanvasStore`, lines 15/38/195.)

### Implementation notes
- The socket mock's `emit` callback must invoke the supplied callback with `{ success: true }` so the `if (res && res.success)` branches execute (otherwise `setTabs` is never called and coverage stays low). Pattern: `emit: vi.fn((event, data, cb) => cb && cb({ success: true }))`.
- The `canvasStore` mock must expose `setTabs` as a `vi.fn()` so the `prev.map(...)` reducers can be asserted — pass a mutable `tabs` array and assert the post-call shape.
- **If a test reveals a latent bug** (e.g. the cap evicts the wrong end, or a `setTabs` reducer misorders): **fix the source, do not weaken the test.** Document the bug + fix in the walkthrough. This is the whole point of writing the test.
- After the suite lands, remove the now-redundant `historyStore` mock from `stores.test.js` only if doing so doesn't break the `clipboardStore` test that depends on it (verify before deleting).

### Verification gate
```bash
npm --prefix client run test -- --coverage
```
Target: `historyStore.js` listed with **≥70% stmts / ≥60% branches**; `state/` overall branch coverage **≥60%**. Paste the coverage table into the walkthrough.

### Exit criteria
- `historyStore.js` appears in the coverage report at/above target.
- All 8 required test cases present and passing.
- No regression in existing 32 tests.

---

# RW3 — Add a Positive-Split `splitPathElement` Test

**Severity:** 🟡 Medium · **Risk:** Low · **Files touched:** `client/src/components/canvas/__tests__/CanvasSelection.test.js`

### Problem
The existing test at line 60–79 is titled *"splits path at eraser points correctly"* but asserts `expect(result.length).toBe(0)`. **Important nuance verified against the source:** for *those specific inputs* the empty result is actually correct — the eraser at center `(150,150)` (local `(0,0)`, radius 10) erases only the middle point of a 3-point path, leaving two 1-point fragments which are each `< 2` and discarded. So the assertion isn't *wrong*, but (a) the name is misleading (it documents a no-split case as a split case), and (b) **there is no test anywhere that exercises an actual successful split** — the function's entire purpose. A regression that broke splitting would pass this suite.

### Steps
1. **Rename the existing test** to honestly describe what it checks, e.g. *"returns empty array when eraser leaves only sub-2-point fragments"*.
2. **Add a positive-split test** with inputs engineered to leave two ≥2-point fragments:
   - Path with 5+ points spanning a wide horizontal range, e.g. normalized `[(0,0.5),(0.25,0.5),(0.5,0.5),(0.75,0.5),(1,0.5)]` on a `200×100` element at `(100,100)`.
   - Eraser at the center point only (radius small enough to clip the middle point but leave ≥2 points on each side).
   - Assert `result.length >= 2`; assert each child has `type: 'path'`, `properties.points.length >= 2`, and that the children's geometry reconstructs to the expected split (left fragment then right fragment). Use `toBeCloseTo` on the computed x/y since the function `Math.round`s outputs.
3. **Add an edge case**: eraser that misses entirely → `result.length === 1` (the path returned unchanged as a single chunk) and the child's points equal the input points. This pins the no-op-return path at `CanvasSelection.js:168-170` vs the normal return.

### Implementation notes
- Trace the math by hand before writing assertions (the plan author already traced the existing case above to confirm `[]` is correct). Local coords are `-w/2 + p.x*w`, `-h/2 + p.y*h`; eraser center local is `getLocalCoords(ex,ey,pathEl)`.
- The function regenerates IDs with `Date.now()` + `Math.random()` — assert on shape and counts, not on exact id strings.

### Exit criteria
- A passing test exists where `splitPathElement` returns ≥2 child path elements with correct geometry.
- `splitPathElement` branch coverage on `CanvasSelection.js` increases (the `chunks.length >= 1` happy path at line 172+ is currently uncovered).

---

# RW4 — Document `useSelectionActions.js` in `STRUCTURE.md`

**Severity:** 🟡 Medium · **Risk:** None · **Files touched:** `STRUCTURE.md`

### Problem
`client/src/app/hooks/useSelectionActions.js` was created during Stage 8 and is **load-bearing** — imported and invoked at `AppContent.jsx:17,130`. But it has **0 mentions in `STRUCTURE.md`** (verified by grep). This violates agent.md §Arch 6: *"New files must be documented in `STRUCTURE.md` in the same change."* The architectural map no longer matches the code.

### Steps
1. Open `STRUCTURE.md` and locate the `/client/src/app/hooks/` section (it already lists `useSocketConnection`, `useElementEvents`, `useTabs`, etc.).
2. Add a one-line entry for `useSelectionActions.js` in the same style as its siblings. First read the file's own JSDoc to describe it accurately — based on its call site (`useSelectionActions(currentUser)` in AppContent) and the Stage 8 commit, it centralizes selection/transform actions (inspector transforms, lock toggling, delete) previously inline in AppContent. Confirm the exact responsibility from the source before writing the line.
3. Cross-check the full hook list on disk against `STRUCTURE.md` so no other hook is missed:
   ```
   useDiceEvents useDiceTick useElementActions useElementEvents useKeyboardShortcuts
   useSaveEvents useSelectionActions useSocketConnection useTabEvents useTabs
   useUserEvents useZenModeShortcut
   ```
   Each must appear at least once.

### Exit criteria
- `grep -c "useSelectionActions" STRUCTURE.md` returns ≥1.
- Every hook file on disk has a corresponding `STRUCTURE.md` mention (run the cross-check above; no hook missing).

---

# RW5 — Housekeeping: Restore Clean Lint

**Severity:** 🟢 Low · **Risk:** None · **Files touched:** `client/eslint.config.js`

### Problem
Running `npm run test -- --coverage` generates `coverage/`, and `npm run lint` then warns: *"Unused eslint-disable directive"* against `coverage/block-navigation.js`. The ESLint config's `globalIgnores` only excludes `dist`.

### Steps
1. **Add `coverage` to ESLint ignores**: in `client/eslint.config.js`, change `globalIgnores(['dist'])` → `globalIgnores(['dist', 'coverage'])`. This restores `npm run lint` to zero warnings after a coverage run.

### Verification gate
```bash
npm --prefix client run test -- --coverage   # generates coverage/
npm --prefix client run lint                 # must report 0 warnings
```

### Exit criteria
- `npm run lint` reports **0 errors, 0 warnings** immediately after a coverage run.

---

## ✅ Final Verification (run after all workstreams merge, paste into walkthrough)

```bash
# 1. Protocol completeness — expect 0
git grep -nE "socket\.(emit|on|off)\(['\"][a-z-]+['\"]" client/src/ | grep -v shared/protocol.js | wc -l

# 2. Walkthrough integrity — expect empty
grep -nE "4,?200|600 lines" .agents/walkthrough.md

# 3. STRUCTURE completeness — expect every hook listed >=1
for h in useDiceEvents useDiceTick useElementActions useElementEvents useKeyboardShortcuts \
         useSaveEvents useSelectionActions useSocketConnection useTabEvents useTabs \
         useUserEvents useZenModeShortcut; do echo "$h: $(grep -c $h STRUCTURE.md)"; done

# 4. Standard gates
npm --prefix client run lint
npm --prefix client run build
npm --prefix client run test -- --coverage

# 5. Clean tree
git status
```
Targets: (1)=0, (2)=empty, (3)=every hook ≥1, (4)=all green with `state/` branch ≥60%, (5)=clean. Paste the output into the rewritten `walkthrough.md`.

---

## ⚠️ Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| RW2 surfaces a latent bug in undo/redo (e.g. wrong eviction end, misordered erase emits). | **Desired outcome.** Fix the source per the documented contract; do not weaken the test. Record bug+fix in walkthrough. |
| The React-mock pattern in `stores.test.js` is brittle and the new `historyStore.test.js` won't mount. | Copy the *exact* working mock shape from `stores.test.js:9-44` (useState/useRef/useCallback/useMemo/useEffect/createContext/useContext/createElement). The pattern is proven; don't improvise a new one. |
| RW1 history rewrite deletes useful context. | Preserve all historical sections under a dated heading; only the false line-count claim and stale verification blocks are replaced. |
| `splitPathElement` test author mis-traces the math and writes a failing assertion. | The plan traces the existing case (→`[]`) and prescribes specific 5-point inputs for the positive case; trace by hand before asserting, use `toBeCloseTo` on rounded outputs. |
| Lint-warning fix in RW5 is the only edit to `eslint.config.js` — keep it minimal. | One-token change (`'dist'` → `'dist', 'coverage'`); no reformatting. |

---

## 🗓️ Suggested Execution

- **One developer/agent session per workstream.** RW1 (docs) and RW5 (housekeeping) are trivial; RW2 (historyStore tests) is the only one with real logic risk.
- **Merge order:** RW5 → RW4 → RW3 → RW2 → RW1.
- **Each workstream = one commit** with the verification output in the message body.
- **No workstream is "done" until its verification gate passes and the output is pasted.**

This closes every residual gap from the second review and brings the refactor to the standard the original `REFACTOR_PLAN.md` and `agent.md` rules demand.
