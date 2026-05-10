---
name: cmux
description: Control cmux terminal multiplexer to manage panes, read screen output, send commands, and automate browser interactions.
---

Use this skill to interact with the cmux terminal multiplexer for managing terminal panes, monitoring command output, and browser automation.

## Scope
- CLI entrypoint: `cmux`
- Socket: Unix socket at `/tmp/cmux.sock` (default)
- Auth: `CMUX_SOCKET_PASSWORD` env var or `--password` flag

## Environment variables (auto-set in cmux terminals)
- `CMUX_WORKSPACE_ID` — default workspace for all commands
- `CMUX_SURFACE_ID` — default surface (terminal pane)
- `CMUX_TAB_ID` — default tab
- `CMUX_SOCKET_PATH` — override socket path

## Core commands

### Discovery
```bash
# List all windows, workspaces, panes
cmux list-windows
cmux list-workspaces
cmux list-panes
cmux current-workspace
cmux identify
```

### Terminal management
```bash
# Create splits and panes
cmux new-split right
cmux new-split down
cmux new-pane --type terminal --direction right

# Read terminal output
cmux read-screen --surface <id|ref>
cmux read-screen --scrollback --lines 100

# Send commands to a pane
cmux send --surface <id|ref> "npm run dev"
cmux send-key --surface <id|ref> Enter

# Focus and close
cmux focus-pane --pane <id|ref>
cmux close-surface --surface <id|ref>
```

### Workspace management
```bash
cmux new-workspace --command "cd /Users/nikodem/Projects/ld && bash"
cmux select-workspace --workspace <id|ref>
cmux rename-workspace "my-task"
cmux close-workspace --workspace <id|ref>
```

### Browser automation
```bash
# Open and navigate
cmux browser open http://localhost:3000
cmux browser goto <url>
cmux browser back
cmux browser reload

# Inspect
cmux browser snapshot
cmux browser snapshot --interactive --compact
cmux browser get url
cmux browser get title
cmux browser get text

# Interact
cmux browser click <selector>
cmux browser type <selector> "text"
cmux browser fill <selector> "text"
cmux browser press Enter
cmux browser eval "document.title"

# Wait for conditions
cmux browser wait --selector ".loaded"
cmux browser wait --text "Success"
cmux browser wait --url-contains "/dashboard"
```

### Notifications and status
```bash
cmux notify --title "Task complete" --body "All tests passed"
cmux set-status build "passing" --icon checkmark --color "#22c55e"
cmux set-progress 0.75 --label "Running tests..."
cmux clear-progress
```

### Logging
```bash
cmux log --level info --source orchestrator "Starting parallel builds"
cmux list-log --limit 20
cmux clear-log
```

## Addressing panes and surfaces

Use ref format for readability:
- `window:1`, `workspace:2`, `pane:3`, `surface:4`
- Or use UUIDs from `cmux identify` / `cmux list-panes`
- Pass `--id-format both` to see refs and UUIDs together

## Orchestrator patterns

### Run parallel tasks in separate panes
```bash
# Create splits for parallel work
cmux new-split right
cmux new-split down

# Send commands to each pane
cmux send --surface surface:1 "cd /Users/nikodem/Projects/ld/ld-shopify && npm test"
cmux send --surface surface:2 "cd /Users/nikodem/Projects/ld/ld-news && npm test"

# Monitor output
cmux read-screen --surface surface:1
cmux read-screen --surface surface:2
```

### Monitor a running process
```bash
# Read last N lines from a pane running a dev server
cmux read-screen --surface <id> --lines 50
```

### Browser-based validation
```bash
cmux browser open http://localhost:3000
cmux browser wait --load-state complete
cmux browser snapshot --compact
```

## Operating guidance
1. Always use `cmux identify` or `cmux list-panes` first to discover available surfaces before sending commands.
2. Use refs (`surface:N`) over UUIDs for readability.
3. When running long commands, use `read-screen` to check progress rather than waiting.
4. Clean up panes/workspaces after tasks complete to avoid clutter.
