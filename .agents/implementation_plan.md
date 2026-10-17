# Implementation Plan: Canvas Server & Cloudflare Tunnel Operationalization

Operationalize the Antigravity Canvas server management and Cloudflare Tunnel lifecycle into automated scripts and a comprehensive operational runbook.

---

## 🎯 Objectives
1. Provide robust, automated scripts in `/scripts` for both PowerShell (`.ps1`) and Bash (`.sh`):
   - `start-server`: Builds client if needed, launches server on port 5000 in background with PID tracking, verifies health.
   - `start-tunnel`: Detects `cloudflared`, spawns background tunnel to port 5000 with PID tracking, parses and persists active tunnel URL.
   - `restart-server`: Performs soft restart of Node server without terminating or severing the Cloudflare tunnel.
   - `stop-server`: Gracefully terminates server process only.
   - `stop-all`: Gracefully terminates both server and Cloudflare tunnel.
   - `status`: Queries and displays live status of server, port 5000, tunnel process, and active URL.
2. Add `.run/` directory to `.gitignore` to prevent runtime PID/log files from polluting version control.
3. Create a production-grade [RUNBOOK.md](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/RUNBOOK.md) documenting lifecycle commands, architecture, manual fallback procedures, and troubleshooting.
4. Update [STRUCTURE.md](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/STRUCTURE.md) and [README.md](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/README.md).
5. Verify tests and linting, commit, and push.

---

## 📋 Task Checklist
- [ ] Add `.run/` to `.gitignore`
- [ ] Create `/scripts` directory with scripts:
  - [ ] `scripts/start-server.ps1` & `scripts/start-server.sh`
  - [ ] `scripts/start-tunnel.ps1` & `scripts/start-tunnel.sh`
  - [ ] `scripts/restart-server.ps1` & `scripts/restart-server.sh`
  - [ ] `scripts/stop-server.ps1` & `scripts/stop-server.sh`
  - [ ] `scripts/stop-all.ps1` & `scripts/stop-all.sh`
  - [ ] `scripts/status.ps1` & `scripts/status.sh`
- [ ] Create comprehensive [RUNBOOK.md](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/RUNBOOK.md)
- [ ] Update [STRUCTURE.md](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/STRUCTURE.md)
- [ ] Update [README.md](file:///c:/Users/Scott%20Simenel/.gemini/antigravity/scratch/realtime-canvas/README.md)
- [ ] Verify scripts execution and health check
- [ ] Update `.agents/task.md` and `.agents/walkthrough.md`
- [ ] Commit and push to git
