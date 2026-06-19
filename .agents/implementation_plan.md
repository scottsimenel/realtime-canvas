# Implementation Plan - Universal Agent Guardrails & Code Health Guidelines

Establish structured, tool-agnostic guardrails and best-practice rules for AI coding assistants using `agent.md` as a single source of truth, incorporating Antigravity-specific workflows and token conservation techniques.

---

## User Review Required

> [!IMPORTANT]
> - **`agent.md` (Universal rules replacement)**: Instead of the tool-specific `.cursorrules`, we will create a central, universal **`agent.md`** file in the project root. This ensures compatibility with any IDE assistant (Cursor, Windsurf, GitHub Copilot, Cline, etc.) and any underlying model (Gemini, Claude, GPT).
> - **Antigravity Workflow Optimization**: The guidelines will explicitly document how to leverage Antigravity's Planning Mode (`implementation_plan.md`), task tracker (`task.md`), and walkthrough records (`walkthrough.md`) to guide any assistant through a structured development lifecycle.
> - **Subagent Context Delegation**: The guidelines will instruct assistants to delegate extensive lookups to specialized subagents (like `research`) to protect the main agent's context window and conserve token limits.

---

## Open Questions

None.

---

## Proposed Changes

### Root Configuration

#### [NEW] [agent.md](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/agent.md)
Create a universal instruction file for AI agents containing:
1. **Tool-Agnostic Setup**: Instruct the agent to read `agent.md` on first contact. Detail how users can symlink or bridge this to tool-specific formats (e.g. creating a `.cursorrules` containing `"Read and obey agent.md in the root directory"`).
2. **Context Preservation & Token Economy**:
   - Limit chat session lengths to 15–20 turns to prevent token bloat and hallucination.
   - Ignore heavy files using `.antigravityignore`.
   - Never feed large console logs, raw stack traces, or entire build histories to the agent. Cut down pastes to specific error lines.
   - Delegate heavy codebase audits, broad grep searches, and documentation reading to the `research` subagent to keep the main agent's context small and performant.
3. **Antigravity Workflows**:
   - **Planning Mode**: Detail the transition from research -> planning (`implementation_plan.md`) -> user approval -> task checklist (`task.md`) -> execution -> walkthrough (`walkthrough.md`).
   - **Verification Loop**: Require running lint (`npm run lint`) and compilation (`npm run build`) checks after modifications.
4. **Architectural Invariants**:
   - Decouple computation/math logic (move to specialized pure functions) from the React rendering components.
   - Standardize client-side state handling with optimistic updates while avoiding race conditions on collaborative websocket channels.
   - Document state mutation methods (e.g., room setting modifications) that must not be bypassed.

#### [MODIFY] [.antigravityignore](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/.antigravityignore)
- Add additional rules to exclude local test runs, temporary artifacts, and cached folders from the active indexing scope to save tokens.

---

## Verification Plan

### Automated Verification
- Run `npm run build` and `npm run lint` inside `/client` to confirm no documentation files interfere with compilation.
