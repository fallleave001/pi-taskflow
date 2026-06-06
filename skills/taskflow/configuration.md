# Taskflow Configuration Reference

Every knob you can set on a taskflow, where it lives, and how the values are
resolved. Read this when you need fine control over models, concurrency, agent
discovery, working directories, tool restrictions, or storage.

Configuration lives in **five layers**, from most local to most global:

| Layer | Where | Sets |
|-------|-------|------|
| Phase | a phase object in the DSL | per-step model/thinking/tools/cwd/output/concurrency |
| Flow | the top-level DSL object | name, args, default concurrency, agent scope |
| Agent | `~/.pi/agent/agents/*.md`, `.pi/agents/*.md` frontmatter | per-agent default model/thinking/tools + system prompt |
| Settings | `~/.pi/agent/settings.json` | `subagents.agentOverrides`, global thinking |
| Environment | shell env | `PI_TASKFLOW_PI_BIN` |

---

## 1. Flow-level options

Top-level keys of the taskflow definition object.

```jsonc
{
  "name": "audit-endpoints",        // required — also becomes /tf:<name> when saved
  "description": "Audit API auth",  // shown in /tf list and the command palette
  "concurrency": 8,                 // default max concurrent subagents (default: 8)
  "agentScope": "user",             // user | project | both (default: user)
  "args": { /* see §3 */ },
  "phases": [ /* see §2 */ ]        // required, at least one phase
}
```

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `name` | string | — | **Required.** Saved as `/tf:<name>`. |
| `description` | string | — | Surfaced in `/tf list` and the slash-command. |
| `concurrency` | number | `8` | Default fan-out / same-layer parallelism cap. See §4. |
| `agentScope` | `user`\|`project`\|`both` | `user` | Which agent dirs to load. See §6. |
| `args` | record | `{}` | Declared invocation arguments. See §3. |
| `phases` | array | — | **Required.** The phase DAG. See §2. |
| `version` | number | `1` | ⚠️ Declared in schema but **not yet used** by the runtime. |

---

## 2. Phase-level options

Keys of each object in `phases[]`. Some only apply to specific `type`s.

```jsonc
{
  "id": "audit",            // required, unique — referenced via {steps.audit.output}
  "type": "map",            // agent | parallel | map | gate | reduce (default: agent)
  "agent": "analyst",       // agent name to run this phase
  "task": "Audit {item.route}…",
  "dependsOn": ["discover"],// DAG edges
  "over": "{steps.discover.json}",  // [map] array to fan out over
  "as": "item",             // [map] loop var name (default: item)
  "branches": [ /* … */ ],  // [parallel] static task list
  "from": ["audit"],        // [reduce] phase ids to aggregate
  "output": "json",         // text | json (default: text)
  "model": "claude-sonnet-4-5",   // per-phase model override
  "thinking": "high",       // per-phase thinking override
  "tools": ["read","bash"], // restrict tools for this phase's subagent
  "cwd": "packages/api",    // working directory for this phase's subagent
  "concurrency": 4,         // [map/parallel] fan-out cap for THIS phase
  "final": true             // mark this phase's output as the workflow result
}
```

| Key | Applies to | Default | Notes |
|-----|-----------|---------|-------|
| `id` | all | — | **Required, unique.** Used in `{steps.<id>…}`. |
| `type` | all | `agent` | One of the 5 phase types. |
| `agent` | all | first available | Agent name; resolved from the scoped pool. |
| `task` | agent, gate, map, reduce | — | Prompt; supports interpolation. Required for these types. |
| `over` | map | — | **Required for map.** Must resolve to an array. |
| `as` | map | `item` | Loop variable bound per item. |
| `branches` | parallel | — | **Required for parallel.** `[{task, agent?}]`. |
| `from` | reduce | — | **Required for reduce.** Phase ids whose outputs are aggregated. |
| `dependsOn` | all | `[]` | DAG edges. `from` also implies a dependency. |
| `output` | all | `text` | `json` parses output so `{steps.id.json}` / map `over` work. |
| `model` | all | agent/global | Per-phase model override. See §5. |
| `thinking` | all | agent/global | Per-phase thinking level. See §5. |
| `tools` | all | agent default | Whitelist of tools for the subagent. See §5. |
| `cwd` | all | flow cwd | Run this phase's subagent in a different directory. |
| `concurrency` | map, parallel | flow concurrency | Fan-out cap for this phase only. See §4. |
| `final` | all | last phase | Exactly one phase may be `final`; its output is returned. |

---

## 3. Declaring & passing arguments

Declare arguments on the flow, then reference them with `{args.X}`.

```jsonc
"args": {
  "dir":   { "default": "src", "description": "Directory to scan" },
  "depth": { "default": 2 },
  "token": { "required": true, "description": "API token" }
}
```

| Field | Notes |
|-------|-------|
| `default` | Used when the caller omits the arg. |
| `description` | Documentation only. |
| `required` | ⚠️ Declared but **not enforced** at runtime — treat as documentation for now. |

**Resolution:** for each declared arg, the provided value wins, else its
`default`. Any extra provided keys are also passed through (so undeclared args
still reach `{args.X}`).

**Passing args:**

```
/tf run audit-endpoints {"dir":"packages/api"}     # JSON
/tf run audit-endpoints dir=packages/api depth=3   # key=value pairs
/tf run audit-endpoints packages/api               # single positional → first declared arg
```

Via the tool: `{ "action": "run", "name": "audit-endpoints", "args": { "dir": "packages/api" } }`.

---

## 4. Concurrency model

There are **two independent concurrency limits**:

1. **Same-layer parallelism** — phases with no dependency between them sit in the
   same topological layer and run concurrently, bounded by **`flow.concurrency`**
   (default `8`).
2. **Fan-out within a `map`/`parallel` phase** — bounded by
   **`phase.concurrency ?? flow.concurrency ?? 8`**.

```jsonc
{
  "concurrency": 6,                 // ≤6 sibling phases run at once
  "phases": [
    { "id": "scan", "type": "map", "over": "{steps.list.json}",
      "concurrency": 3,             // …but this map only fans out 3 at a time
      "task": "…", "dependsOn": ["list"] }
  ]
}
```

Set a low `phase.concurrency` to protect rate-limited models or heavy bash work;
keep `flow.concurrency` higher to let independent phases overlap.

---

## 5. Model, thinking & tools resolution

For any phase, the effective value is resolved in this **precedence order**
(first defined wins):

| Setting | Precedence (high → low) |
|---------|-------------------------|
| **model** | `phase.model` → `settings.agentOverrides[agent].model` → agent frontmatter `model` → pi default |
| **thinking** | `phase.thinking` → `settings.agentOverrides[agent].thinking` → agent frontmatter `thinking` → `settings` global thinking → pi default |
| **tools** | `phase.tools` → `settings.agentOverrides[agent].tools` → agent frontmatter `tools` → all tools |

Notes:
- `tools` is a **whitelist** passed as `--tools a,b,c`. Omit it to allow all.
- Each phase runs as an isolated process:
  `pi --mode json -p --no-session [--model …] [--thinking …] [--tools …] [--append-system-prompt <agent>] "Task: …"`.
- The agent's markdown body becomes the subagent's appended system prompt.

---

## 6. Agent discovery & scope

`flow.agentScope` controls which agent directories are loaded:

| Scope | Loads from |
|-------|-----------|
| `user` (default) | `~/.pi/agent/agents/*.md` |
| `project` | nearest `.pi/agents/*.md` found walking up from cwd |
| `both` | user **then** project (project overrides on name collision) |

- Agents are `.md` files with frontmatter `name` + `description` (required), plus
  optional `model`, `thinking`, `tools`. The body is the system prompt.
- Reference agents in phases by their `name`. An unknown name fails that phase
  with the list of available agents.
- If a phase omits `agent`, the **first discovered agent** is used.

---

## 7. settings.json

Taskflow shares the subagent settings file at `~/.pi/agent/settings.json`:

```jsonc
{
  "subagents": {
    "globalThinking": "medium",          // fallback thinking for all subagents
    "agentOverrides": {
      "analyst": { "model": "claude-sonnet-4-5", "thinking": "high" },
      "scout":   { "tools": ["read", "bash", "grep"] }
    }
  },
  "defaultThinkingLevel": "low"          // used if subagents.globalThinking is absent
}
```

- `subagents.agentOverrides` — per-agent overrides applied at discovery; they beat
  agent frontmatter but lose to a phase-level value (see §5).
- `subagents.globalThinking` (or top-level `defaultThinkingLevel`) — global
  thinking fallback.

---

## 8. Environment variables

| Variable | Effect |
|----------|--------|
| `PI_TASKFLOW_PI_BIN` | Override the `pi` binary used to spawn subagents. Used by tests and unusual launch setups (e.g. `PI_TASKFLOW_PI_BIN=pi`). Normally auto-detected. |

---

## 9. Storage & file locations

| What | Path | Commit? |
|------|------|---------|
| User-scoped flow | `~/.pi/agent/taskflows/<name>.json` | personal |
| Project-scoped flow | `<nearest .pi>/taskflows/<name>.json` | ✅ commit to share |
| Run state (resume) | `<project .pi>/taskflows/runs/<runId>.json` | ❌ gitignore |

- `action: "save"` takes `scope: "project"` (default) or `"user"`.
- Saved flows auto-register as `/tf:<name>` (immediately for the current session,
  and on future `session_start`).
- Project flows override user flows on a name collision.
- Add `.pi/taskflows/runs/` to `.gitignore`.

---

## 10. Quick recipes

**Pin a strong model only for the review gate:**
```jsonc
{ "id": "review", "type": "gate", "agent": "reviewer",
  "model": "claude-opus-4", "thinking": "high",
  "task": "…\nVERDICT:", "dependsOn": ["audit"] }
```

**Sandbox a phase to read-only in a subdirectory:**
```jsonc
{ "id": "scan", "type": "agent", "agent": "scout",
  "cwd": "packages/api", "tools": ["read", "grep", "ls"],
  "task": "List route files. Output ONLY a JSON array.", "output": "json" }
```

**Throttle a rate-limited fan-out:**
```jsonc
{ "id": "summarize", "type": "map", "over": "{steps.scan.json}",
  "concurrency": 2, "agent": "writer",
  "task": "Summarize {item.file}.", "dependsOn": ["scan"] }
```

**Project-only agents:**
```jsonc
{ "name": "ci-audit", "agentScope": "project", "phases": [ /* … */ ] }
```

---

## Caveats (declared but not yet enforced)

These keys validate but the runtime does **not** act on them yet — don't rely on
them for behavior:

- `arg.required` — missing required args are not rejected.
- `flow.version` — informational only.
