# Workspace Customization Rules

Please read and strictly follow the workspace rules and onboarding procedures defined in the root guidelines [agent.md](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/agent.md).

## Onboarding Checklist

When you first boot up in this workspace, you MUST perform these checks in order to establish context:
1. **Read Architectural Guidelines**: Refer to [STRUCTURE.md](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/STRUCTURE.md) and [agent.md](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/agent.md).
2. **Trace Recent Action Context**: Review the latest walkthrough [.agents/walkthrough.md](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/.agents/walkthrough.md) and task tracker [.agents/task.md](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/.agents/task.md).
3. **Verify Environment**: Run linter checks (`npm --prefix client run lint`) and tests (`npm --prefix client run test -- --coverage --run`) to verify the repository state before making any changes.

## Active Development Rules

1. **Commit and Push**: Actively commit changes and push them to the remote repository whenever it makes sense to do so.
2. **Sync Artifacts**: Ensure that any artifacts and changes to artifacts that are only visible by the antigravity harness (located in `<appDataDir>\brain\<conversation-id>`) are also reflected on the publicly visible equivalents in the workspace `.agents/` directory immediately.
