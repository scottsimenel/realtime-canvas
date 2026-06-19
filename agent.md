# AI Agent & Developer Guidelines (`agent.md`)

Welcome! This document serves as the central contract for AI coding assistants (Gemini, Claude, GPT) and human developers working on this project. It outlines architectural boundaries, token conservation practices, and operational workflows to ensure high-velocity, reliable development.

---

## 🛠️ How to Apply This File Universally

To leverage this rules system in any coding tool or IDE (Cursor, Windsurf, GitHub Copilot, Cline, etc.):
1. **Copy this file (`agent.md`)** to the root of your target project.
2. **Bridge to Tool-Specific Rules**: Create a lightweight, tool-specific rule file that instructs the agent to read and follow `agent.md`. For example:
   - **Cursor**: Create `.cursorrules` in the root:
     ```text
     Please read and strictly follow the workspace rules defined in agent.md.
     ```
   - **Windsurf**: Create `.windsurfrules` in the root:
     ```text
     Always refer to the guidelines in agent.md before writing code or running commands.
     ```
   - **GitHub Copilot**: Reference `agent.md` in custom instructions or copilot prompts.
   - **Cline / Roo-Code**: Create `.clinerules` with similar text.

---

## 🪙 Token Preservation & Context Economy

Context windows are a valuable, finite resource. Large contexts increase latency, raise API costs, and lead to model hallucinations. Follow these guardrails to keep context sizes minimal:

### 1. Ignore Heavy Folders (`.antigravityignore` / `.gitignore`)
Ensure that build files, node modules, temporary folders, and binary outputs are completely excluded from indexing.
- **Rules**: Never let the agent read compiled bundles or cache files. Update `.antigravityignore` whenever new dependencies or build directories are introduced.

### 2. Limit Chat Conversation History
As a chat thread grows, the entire previous history is sent to the model with every new request.
- **Rule**: If a thread exceeds **15–20 turns**, or if the model starts exhibiting latency or repeating errors, **start a fresh chat session**. Keep your prompts highly focused on single tasks.

### 3. Minimize Console/Build Output Noise
- **Rule**: Do not paste pages of raw compiler outputs or console logs. Extract and paste only the relevant block (typically 10–30 lines containing the stack trace and the exact error description).

### 4. Delegate to Subagents for Heavy Audits
- **Rule**: If you need to perform exhaustive codebase searches, analyze third-party library code, or read raw documentation files, **delegate the task to a specialized subagent** (e.g. `research` subagent). Let the subagent parse the heavy data in a separate thread and return only a distilled summary to the main agent.

---

## 🏗️ Architectural Rules & Invariants

Maintain modular, decoupled design patterns to make it easy for AI agents to analyze and modify features without needing to read the entire codebase:

### 1. Decouple Computation/Math Logic from Views  **[BLOCKING]**
- **Rule**: No `Math.*`, matrix ops, quaternion ops, coordinate transforms, or collision/physics calculations may appear inside `.jsx`/`.tsx` view files. View components render state; they do not compute it.
- **Rule**: If a calculation is needed inside a component, write it as a named, exported pure function in the sibling math module (`/client/src/components/canvas/CanvasSelection.js` for canvas geometry, `/client/src/components/dice/DiceMath.js` for quaternion math), give it a JSDoc `@param`/`@returns` contract, import it, and add a unit test for it.
- **Practice**: Place all math in pure functions inside dedicated modules (e.g. `/client/src/components/canvas/CanvasSelection.js` or `/client/src/components/dice/DiceMath.js`). Pure functions are the only units in this codebase that can be tested in isolation — protect that property.

### 2. Enforce JSDoc Interfaces
- **Rule**: Always write JSDoc contracts for new components, utility functions, or handler modules. This provides the AI with clear parameter definitions without parsing implementation details:
  ```javascript
  /**
   * Calculates the snapped center coordinate on a flat-topped hexagonal grid.
   * @param {number} x - Target x coordinate in virtual space.
   * @param {number} y - Target y coordinate in virtual space.
   * @param {number} size - Horizontal and vertical spacing factor (gridSize).
   * @returns {{x: number, y: number}} The coordinates of the closest hex center.
   */
  ```

### 3. Local State Isolation & WebSocket Sync
- **Rule**: When updating properties in a real-time collaborative scope:
  1. Modify local UI state immediately to keep the interface highly responsive (optimistic update).
  2. Emit the event over websockets.
  3. Ensure that the socket listener ignores self-emitted broadcasts to avoid cursor stuttering or recursive input loops.
- **Rule**  **[BLOCKING]**: Every optimistic update must define its rollback path. The `socket.emit(..., (res) => ...)` callback must restore the prior local state when `res.success === false`. A `// TODO: handle error` comment is not acceptable — see `handleSpawnShape` in `App.jsx` for the reference pattern (apply local change, revert on failed ack). An optimistic update without a rollback branch is incomplete by definition.

### 4. Real-Time Lock (Mutex) Contract  **[BLOCKING]**
- **Rule**: Any code path that mutates an existing canvas element must respect the lock contract. The server enforces this in `registry.updateElement` / `registry.deleteElement` by refusing operations from non-lock-holders — do not attempt to bypass it with a direct `tab.elements.set(...)`.
- **Rule**: Before mutating an element, confirm the caller holds the lock (via the server's lock map) **or** that the operation is lock-exempt by design (e.g. `element-create` for a brand-new element), and document the exemption with an inline comment.
- **Rule**: Never leave a lock acquired. Every `element-lock` must be paired with a corresponding `element-unlock` on the same element(s) in the same interaction (drag end, inspector blur, component unmount). Locks orphaned by a crashed interaction cause "stuck" elements for all users until disconnect cleanup runs.

### 5. Shared Socket Protocol as the Single Source of Truth  **[BLOCKING]**
- **Rule**: Socket event names and payload shapes must live in `/shared/protocol.js` as exported constants and JSDoc `@typedef`s. Both `/server` and `/client` import from there. Hardcoding an event name string in a handler or listener is a violation.
- **Rule**: Any change to a socket event's name or payload is a **three-file change** committed together: (1) `shared/protocol.js`, (2) the server handler, (3) every client listener. Never rename or reshape an event in one place — silent protocol drift has already caused hard-to-trace desync bugs (e.g. the locked-to-missing-default-tab bug).
- **Rule**: When adding a new event, define its name constant and payload `@typedef` in `shared/protocol.js` **first**, before writing any handler or listener code.

### 6. Protect the Architecture Boundaries
- **Rule**  **[BLOCKING]**: `App.jsx` is capped at its current size and is actively shrinking — see `REFACTOR_PLAN.md`. Do not add new state, new socket event listeners, or new business logic to `App.jsx`. New event handlers go in `/client/src/app/hooks/use*Events.js`; new state goes in `/client/src/state/*Store.js`. If a change strictly requires editing `App.jsx`, call it out explicitly and request human review.
- **Rule**: New files must be documented in `STRUCTURE.md` in the same change that adds them. An undocumented file is a contract violation — `STRUCTURE.md` is the map of the codebase, and a stale map is worse than no map.

---

## 🔄 Antigravity Development Workflows

When working in an agentic environment (such as Antigravity), adhere to the following planning and verification pipeline:

### 1. Planning Mode (`implementation_plan.md`)
- **Rule**: For any complex architectural changes or multi-file edits, the agent must run in planning mode.
- **Workflow**:
  1. Research the codebase using read-only tools.
  2. Create or update `implementation_plan.md` in the system-designated artifacts folder (`<appDataDir>\brain\<conversation-id>`).
  3. **Publish to Workspace**: Copy/publish the artifact to the workspace `.agents/` directory (`.agents/implementation_plan.md`) so it is public and accessible in Explorer and to other coding agents.
  4. Pause and request explicit user review. Do not make code modifications until approved.

### 2. Task Checklist (`task.md`)
- **Rule**: Once the plan is approved, create or update `task.md` in the system artifacts directory and copy/sync it to the workspace `.agents/task.md` to track implementation progress as a living, public TODO list. Mark items as `[/]` (in progress) or `[x]` (complete).

### 3. Verification Loop  **[BLOCKING]**
- **Rule**: No task may be declared complete, fixed, or passing without evidence. Before claiming success you must run, and paste the actual output of:
  - `npm --prefix client run lint` — must finish with no errors.
  - `npm --prefix client run build` — must complete and emit the `dist/` bundle.
  - `node --check server/server.js` — must report no syntax errors.
  - Any test that covers the module you touched (`npm test` once a test harness exists).
- **Rule**: Paste the green command output (or report the failure verbatim) in the task summary. "I believe this works", "this should be correct", or silently skipping verification are all unacceptable. If a check cannot be run in the current environment, say so explicitly rather than implying it passed.
- **Rule**: Address warnings, not just errors — lint warnings accumulate into the kind of noise that hides real bugs over time.

### 4. Walkthrough Summary (`walkthrough.md`)
- **Rule**: After successful verification, document all changes, additions, and test results in `walkthrough.md` in both the system artifacts directory and the workspace `.agents/walkthrough.md` to establish a clear audit log of the task achievements.

---

## 🛡️ Operational Guardrails for AI-Driven Development

These rules address the most common ways an autonomous agent degrades a codebase over repeated rounds of edits. They exist because the project is expected to undergo many additional AI-driven iterations.

### 1. Read Before Write — No Blind Overwrites  **[BLOCKING]**
- **Rule**: Before creating, overwriting, or significantly rewriting any file, open and read its current contents first. Never regenerate a file from memory or from a task description alone.
- **Rule**: If the file's current contents contradict the task description (the function you were told to modify doesn't exist, the signature differs, the logic is already in place), stop and surface the contradiction to the user. Do not proceed on an assumption.
- **Why**: Overwriting from a stale mental model is the single most destructive AI failure mode — it silently discards recent work.

### 2. State the Blast Radius Before Editing  **[BLOCKING]**
- **Rule**: Before modifying any function, component, or handler, identify and state (briefly, in your response) its blast radius:
  - (a) Every caller of the function (grep for its name).
  - (b) Every socket event it emits or listens to.
  - (c) Whether it runs on the **server** (affects every connected client) or on a **client** (one user).
- **Rule**: Treat server-side registry mutations as production-impact changes — they propagate to every user in the room. Prefer adding a new function over modifying a shared one when feasible.

### 3. Prefer Additive, Reversible Changes
- **Rule**: Prefer adding new files/functions over modifying existing ones. Additive changes are trivially reversible; modifications ripple.
- **Rule**: When a change must modify existing code, keep the diff minimal and surgical. Do not reformat untouched code in the same change — reformatting hides the real semantic diff in noise and breaks `git blame`.
- **Rule**: One logical change per commit/PR. A refactor and a feature bundled together is unreviewable.

### 4. Dependency & File Budget
- **Rule**: No new runtime dependencies without explicit human approval. The backend deliberately runs on four dependencies (express, socket.io, cors, multer); the client on a small set. Before proposing a new dependency, justify it against the existing stdlib / current capabilities and note any client bundle-size impact.
- **Rule**: New files must be added to `STRUCTURE.md` in the same change (re-stated from §Architectural Rules 6 because it is violated most often).
- **Rule**: Do not create files outside the documented directory structure without proposing the structural change first.

### 5. Preserve the Verification Audit Trail
- **Rule**: Keep `task.md`, `walkthrough.md`, and any plan documents accurate and current. Do not delete history entries to "clean up" — they are the audit log that lets the next agent (or human) understand why the code looks the way it does.
- **Rule**: When you discover an undocumented behavior, bug, or architectural quirk, record it in `walkthrough.md` rather than silently working around it.

### 6. Know When to Stop and Ask
- **Rule**: If a task requires (a) a new architectural pattern, (b) a dependency, (c) breaking a public interface, or (d) exceeds ~3 files of unplanned scope, pause and request direction. Do not silently expand scope.
- **Rule**: When uncertain between two valid implementations, implement the simpler one and note the alternative in the walkthrough. Do not gold-plate.

### 7. Rule-Marking Convention
- Throughout this file, **`[BLOCKING]`** marks rules that an agent must satisfy before declaring a task complete. Non-blocking rules are strong recommendations. When in conflict, blocking rules win.
