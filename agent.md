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

### 1. Decouple Computation/Math Logic from Views
- **Rule**: Do not write coordinates transforms, matrix calculations, physics ticks, or math equations directly inside view components (like React UI elements).
- **Practice**: Place all math in pure functions inside dedicated modules (e.g. `/client/src/components/canvas/CanvasSelection.js` or `/client/src/components/dice/DiceMath.js`).

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

---

## 🔄 Antigravity Development Workflows

When working in an agentic environment (such as Antigravity), adhere to the following planning and verification pipeline:

### 1. Planning Mode (`implementation_plan.md`)
- **Rule**: For any complex architectural changes or multi-file edits, the agent must run in planning mode.
- **Workflow**:
  1. Research the codebase using read-only tools.
  2. Create or update `implementation_plan.md` in the artifacts folder detailing the proposed changes, file impact, and verification criteria.
  3. Pause and request explicit user review. Do not make code modifications until approved.

### 2. Task Checklist (`task.md`)
- **Rule**: Once the plan is approved, create or update `task.md` in the artifacts directory to track implementation progress as a living TODO list. Mark items as `[/]` (in progress) or `[x]` (complete).

### 3. Verification Loop
- **Rule**: After editing code, the agent must verify the modifications before declaring success:
  - Run linting checks: `npm run lint`
  - Run the production compiler: `npm run build`
  - Address any warnings or errors immediately before requesting feedback.

### 4. Walkthrough Summary (`walkthrough.md`)
- **Rule**: After successful verification, document all changes, additions, and test results in `walkthrough.md` to establish a clear audit log of the task achievements.
