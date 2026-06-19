# Implementation Plan - App.jsx Refactor (Stage 0 & Stage 1)

Execute the initial preparation and extraction phases of the `App.jsx` decomposition plan to improve code health and unit-testability, making changes incrementally with standalone git commits.

---

## User Review Required

> [!IMPORTANT]
> - **Incremental Commits**: We will commit and verify at the end of each step or stage to maintain a clean git history and allow trivial rollbacks.
> - **No Functional Changes**: Stage 0 and Stage 1 consist of structural setup and pure function extraction. The application functionality will remain identical.
> - **Testing suite**: We will add `vitest` to `/client` to verify the extracted helper logic in isolation.

---

## Open Questions

None.

---

## Proposed Changes

### Stage 0: Preparation

#### [NEW] Directories
- `client/src/app/`
- `client/src/app/hooks/`
- `client/src/state/`
- `client/src/lib/`

#### [NEW] [socket.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/lib/socket.js)
- Extract socket setup and URL resolution, returning a lazy socket initializer instance.

#### [NEW] [protocol.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/shared/protocol.js)
- Define standard event names as constants.

#### [MODIFY] [package.json](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/package.json)
- Add `vitest` as a dev dependency and configure the `test` command.
- Create a basic smoke test in `client/src/lib/__tests__/smoke.test.js`.

#### [MODIFY] [STRUCTURE.md](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/STRUCTURE.md)
- Document the new modular folders.

---

### Stage 1: Extract Pure Helpers

#### [NEW] [url.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/lib/url.js)
- Extract `getFullUrl(path)` and add unit tests.

#### [NEW] [locks.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/lib/locks.js)
- Extract lock mapping logic (`locksArrayToMap(entries)`) and add unit tests.

#### [NEW] [ids.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/lib/ids.js)
- Extract ID generators for elements, tabs, rolls, and assets.

#### [NEW] [mergeElement.js](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/lib/mergeElement.js)
- Extract element merging utility.

#### [MODIFY] [App.jsx](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/client/src/App.jsx)
- Import helpers from the newly created files and replace inline logic.

---

## Verification Plan

### Automated Tests
- Run `npm --prefix client run lint` to verify code quality.
- Run `npm --prefix client run build` to confirm successful bundles.
- Run `npm --prefix client run test` (Vitest) to check helper test suites.
