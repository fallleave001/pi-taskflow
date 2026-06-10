# RFC: Background Run (Detached Execution)

> Status: **Proposed** · Date: 2026-06-10
> Companion: [`background-run-research.md`](../background-run-research.md) (motivation + competitive analysis)

## TL;DR

Add `detach: true` to the tool's `run` action. Spawns `executeTaskflow` in a detached child process, returns `runId` immediately, host conversation freed. Status polled via existing store. **Zero changes to runtime.ts/schema.ts.** ~205 lines across 3 files.

## 1. DSL Shape

No DSL changes. `detach` is a **runtime parameter**, not a flow property:

```typescript
// In TaskflowParams (index.ts TypeBox schema)
detach: Type.Optional(Type.Boolean({ description: "Run in background; return runId immediately" })),
```

```json
{ "action": "run", "define": { "name": "deep-audit", "phases": [...] }, "detach": true }
```

Same flow can run foreground or background. Whether to detach is a dispatch-time decision.

## 2. Runtime Changes

### `index.ts` — `run` action (~50 lines added)

When `detach: true`:
1. Validate + desugar definition (existing code, unchanged)
2. Persist RunState with `status: "running"`, `pid` field
3. Serialize context (def, args, cwd, runId) to temp JSON
4. `spawn(process.execPath, [runnerScript, tmpFile], { detached: true, stdio: "ignore" })` → `child.unref()`
5. Record PID in RunState, persist
6. Return `{ runId, status: "running" }` immediately

### `extensions/detached-runner.ts` — NEW (~60 lines)

Thin script: reads context JSON → loads/creates RunState → calls `executeTaskflow(state, deps)` → `saveRun()` on completion. Top-level try/catch writes `status: "failed"` on crash. Calls `deliverMessage()` for completion notification if available (else polling fallback).

**Why not re-spawn `pi`?** Full pi session overhead (model registry, TUI, extensions) for a single `executeTaskflow` call. 60-line script is simpler.

### `store.ts` — (~15 lines added)

```typescript
// Add to RunState
pid?: number;       // OS PID of detached runner
detached?: boolean;  // true for background runs

// New helper
function isProcessAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
```

Status rendering shows `🟢 running` / `⚪ exited` based on `isProcessAlive(state.pid)`.

### Files NOT touched

`runtime.ts`, `schema.ts`, `interpolate.ts`, `cache.ts`, `runner.ts`, `verify.ts`, `agents.ts`, `render.ts` — **zero changes**. `executeTaskflow` is called identically in both modes.

## 3. Validation Rules

1. `detach` requires `define` or `name` (same as any `run` action)
2. `detach` + approval phases → **warning emitted** at validation: approval auto-rejects in background (see §4)
3. No schema version bump needed

## 4. Failure Semantics

| Scenario | Behavior | Invariant? |
|----------|----------|-----------|
| Approval phase in background | Auto-reject, `approval.auto = true` | ✅ Phase runs, decision recorded |
| Detached process crash | Top-level catch → `status: "failed"` persisted | ✅ Store is source of truth |
| Host session exits | Flow continues; PID in store; next session polls | ✅ Store survives session boundaries |
| PID stale (process died uncleanly) | `isProcessAlive` → false; resumable via `action: "resume"` | ✅ Resume already exists |

All project invariants hold: intermediate results stay in store, `safeEmit`/`safeProgress` still wrap callbacks, idle watchdog still kills stalled subagents, loops still have `maxIterations` caps, atomic writes unchanged.

## 5. Backward Compatibility

- Default `detach: false` — all existing behavior identical
- Store: `pid`/`detached` are optional fields; old JSON loads fine
- No DSL changes; no version bump

## 6. Rejected Alternatives

| Alternative | Why rejected |
|-------------|-------------|
| Supervisor daemon (Claude Code model) | 10× complexity; file-backed store already provides shared state |
| Re-spawn `pi --mode json` | Full pi session overhead for one function call |
| `new Worker()` in-process | Shares memory; crash corrupts host; spawn gives OS isolation |
| Background as phase type (`type: "background"`) | Conflates what-to-run with how-to-run; same flow should work both ways |

## 7. Test Plan

| Test | Verifies |
|------|----------|
| `detach returns immediately with runId` | Tool returns within 1s, valid runId |
| `detached flow completes and persists` | `loadRun` → `status: "completed"`, correct output |
| `approval auto-rejects in background` | `approval.auto = true`, downstream sees rejection |
| `process crash persists failure` | Kill PID → `loadRun` → `status: "failed"` |
| `resume crashed detached run` | `action: "resume"` restarts from last checkpoint |
| `store loads old format (no pid/detached)` | Backward compat, no error |
| `isProcessAlive` accuracy | True for current PID, false for dead PID |

## 8. Open Questions

1. **`deliverMessage` API** — does `@earendil-works/pi-coding-agent` expose it? If not, notification deferred to polling (RFC still delivers value).
2. **Concurrency cap** — max concurrent detached runs? Proposal: no hard limit, warn if >5 active.
