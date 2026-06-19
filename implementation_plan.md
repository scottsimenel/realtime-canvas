# Implementation Plan — Refactor Remediation Plan

This plan implements the remediation of all architectural gaps (G1 to G5) identified in the Stage 0–7 review, as detailed in the workspace [REMEDIATION_PLAN.md](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/REMEDIATION_PLAN.md).

---

## User Review Required

The user has explicitly approved proceeding with the execution of this remediation plan.

---

## Proposed Changes

We will execute the remediation in five distinct workstreams, committing and verifying at each boundary.

### WS5: Housekeeping
* **Update `agent.md`**: Document the self-edit history log.
* **Verify `STRUCTURE.md`**: Confirm every file added by the refactor is documented.

### WS1: Protocol Rewiring
* **Canvas.jsx & RightSidebar.jsx**: Swap all 18 hardcoded event emission strings with their corresponding constants from `shared/protocol.js`.

### WS4: AppContent Slimming
* **AppContent.jsx**: Move active tool, configuration, and zoom states to `uiStore.js`, and selection transform references to `selectionStore.js`.
* **AppContent.jsx**: Reduce line size from 1,165 lines to under 500 lines.

### WS2: Behavioral Tests
* **tests/stores.test.js**: Replace existence checking assertions with real behavioral tests covering history undo/redo stacks, clipboard offset transformations, and canvas tab isolation.
* **CanvasSelection.test.js & DiceMath.test.js**: Write pure logic tests for hit-testing math and rotation math.

### WS3: Walkthrough Rewrite
* **walkthrough.md**: Rewrite to document precise, verifiable metrics and verification results.

---

## Verification Plan

### Automated Tests
- Run `npm --prefix client run lint` to ensure ESLint passes with no warnings.
- Run `npm --prefix client run build` to verify the production build succeeds.
- Run `npm --prefix client run test` to verify all unit tests pass with coverage analysis.

### Manual Verification
- Smoke-test real-time collaboration using two browser tabs (moving elements, locks, pasting, tab switches).
