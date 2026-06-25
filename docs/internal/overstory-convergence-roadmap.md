# Roadmap: Converging pi-taskflow onto the overstory Runtime Vision

> Status: **Proposed** · Date: 2026-06-24
> Companion: [`rfc-flowir-compilation.md`](./rfc-flowir-compilation.md) (M1, the first step)
> Source: synthesized from a 9-phase multi-agent brainstorm + deep-research run
> (`overstory-convergence-brainstorm`, 2026-06-24): scout gap-map → 5 parallel
> lenses → analyst converge (top 3) → planner deepdive (RFC-level) → final-arbiter
> verdict. Every load-bearing claim below was code-verified by the arbiter.

---

## TL;DR

pi-taskflow will **incrementally refactor itself into overstory's runtime shape**,
one releasable milestone at a time, keeping all tests green and every `/tf` command
and flow DSL backward-compatible — so that one day the kernel can be **swapped for
`overstory` core** with no user-visible break.

The next "explosive" step is **not** the flagship (minimal recomputation). It is the
**FlowIR compilation layer (M1)** — the only zero-dependency, zero-execution-path
contract seam that the flagship structurally requires.

> **Sequencing is the decision.** The three top candidates are not competitors;
> they form a serial dependency chain. Topological sort yields **M1 → M2 → M3 → M4 → M5**, uniquely.

---

## 1. The two projects (and the decision)

| | pi-taskflow | overstory |
|---|---|---|
| Status | **Production**, published npm (`v0.0.24`), dogfooded | **Early-dev** (`0.1.0-dev.0`, `private: true`, unpublished) |
| Shape | Pi extension: `extensions/{runtime,schema,interpolate,cache,store,context-store,compile,verify,runner}.ts` | Monorepo: `packages/core` (ir/scheduler/graph/tree/snapshot/events/store/exec) + `packages/pi` (adapter) |
| Runtime deps | 0 | 0 (optional TypeBox) |
| Tests | 702 | 20 (core) |

overstory's `README` states it plainly: *"The current production iteration of these
ideas lives in pi-taskflow."* overstory is the **next-generation kernel vision**;
pi-taskflow is the **current production iteration** of the same thesis.

**Product decision (the governing constraint):** refactor pi-taskflow *gradually*
toward overstory's ideas — reshaping the runtime into overstory core's shape — so
the kernel can eventually be **replaced wholesale** by `overstory` core. Hard
invariants for every step:

1. **All tests green** (existing 702 + new) — no regressions.
2. **End-to-end works** — every `/tf` command and e2e script stays green.
3. **Backward compatible** — published `RunState.json`, the flow DSL, and `/tf`
   commands never break.
4. **Each step is independently releasable** — you can stop at any milestone and ship.

---

## 2. What the brainstorm found — and why the order is forced

Five lenses (minimal-recomputation/ContextGraph · FlowIR · RunSnapshot/PatchLog ·
new-mechanisms Islands/Streaming/cost-asymmetric · refactor-sequencing engineering)
diverged, an analyst converged them to a top 3, planners wrote RFC-level deep dives,
and a final-arbiter cross-checked every claim against both codebases.

### The top 3 candidates

| Rank | Candidate | flagship | blast | roi | fit | total | Why it's not first |
|---|---|---|---|---|---|---|---|
| 1 | **FlowIR compilation layer** | 7 | 8 | 9 | **10** | 34 | — (it *is* first) |
| 2 | Observed `readSet@version` | 9 | 9 | 8 | 7 | 33 | Materially more precise *only once* FlowIR's declared plane names keys |
| 3 | Minimal recomputation | **10** | 9 | 7 | 5 | 31 | Hard-depends on both planes; changes execution results; `fit 5` |

(`fit` = fit under the "tests always green, each step releasable, backward-compatible" constraint.)

### Why the flagship does **not** go first

The arbiter verified the dependency topology in code:

- **Minimal recomputation (M5)** needs *both* planes: its deep dive mandates an
  observed ∪ declared **union** semantics, and `flowIRHash` for `ir-changed`
  detection. Without FlowIR (M1) and observed readSet (M3), it cannot be sound.
- **Observed readSet (M3)** explicitly gets sharper once FlowIR's `inject/emits`
  declared plane exists.
- **FlowIR (M1)** declares no dependencies and touches **no execution path**.

> Do not let the flagship score invert the order. M5 is a **north star**, not an
> entry point. Leading with it would mean changing execution results (skip/rerun
> nodes) on a `fit-5` surface *before* the contract that makes it sound exists.

### The verified gaps that de-risk the whole roadmap

- overstory is `private: true` → M1 must **vendor** (not import) its pure compiler.
- pi-taskflow `interpolate.ts` has **no read-hook today** → M3's `onRead` seam is
  genuinely clean and additive (fail-open by default).
- overstory `graph/index.ts` already has single-node `evaluateStaleness` /
  `observedDependents`, but `computeStaleFrontier` / `recomputeFlow` are
  **genuinely absent** → M5 is "add the algorithm," not "rewrite the engine."

---

## 3. The roadmap (5 milestones)

```
M1 FlowIR shadow ──▶ M2 declared readSet ──▶ M3 observed readSet@version ──▶ M4 stale-marking ──▶ M5 minimal recompute
  (contract seam)      (content-addressed)     (overstory moat)              (cascade algorithm)   (Make→Bazel flagship)
```

### Status — H1 landed (as of v0.0.26)

> The table further below is the original **design intent**. H1 (M1+M2
> foundation + cache-key migration) shipped in v0.0.26. Honest status:

| # | Status | What actually shipped | Remaining for full milestone |
|---|---|---|---|
| **M1** | 🟡 **seam landed (stub translate)** | `compileTaskflowToIR(def) → {ir, meta, hash, usedFallbackHash, warnings, errors}` typed surface (`extensions/flowir/{index,translate,meta}.ts`); `/tf ir <flow>` command + `ir` tool action; determinism + stub-parity tests; `e2e-flowir.mts`. Runtime routes `flowDefHash` through the seam. | Vendor overstory's genuine `ir/{compile,cond,hash,schema}` compiler so `usedFallbackHash` flips `false` and a real **byte-parity** test vs a pinned overstory commit exists. Until then hash == `flowDefHash` (fallback). |
| **M2** | 🟢 **declared plane landed** | Per-phase `DeclaredDeps {reads,writes}` synthesized at compile time (`collectRefs` over task/over/when/until/eval/branches/with/context + `dependsOn`), attached to `ir.meta.declaredDeps`, persisted to `RunState`. M5 recompute frontier now uses **union(observed ∪ declared)** (`stale.ts` 3-arg `computeStaleFrontier` + property test). | Reconcile declared-vs-observed discrepancies as advisory diagnostics (RFC-004); not blocking. |
| **Cache** | 🟢 **backward-compatible migration** | `cacheKey` is now versioned (`v2:flowdef:`) with a **3-tier lookup**: new key → bare `flowdef:` key → legacy (no-flowdef) key. Pre-existing cross-run entries still hit for one release cycle; no write-through on fallback. No cross-flow collision (every tier includes `flow:${name}`). | Advance to `v3:` when the genuine IR hash lands. |
| **M3** | 🟢 shipped (v0.0.25) | `onRead` hook, `PhaseState.reads`, provenance/why-stale, when/eval read capture. | — |
| **M4** | 🟢 shipped | `computeStaleFrontier` pure fn + property test. | — |
| **M5** | 🟢 trustworthy (v0.0.25) | `/tf recompute` (dry-run default), union frontier, self-read deadlock fixed, unobserved-deps guard. | Flip default-on after the flagship "strictly < full" demo; precise `ir-changed` diff; map item-level reuse. |

---

| # | Milestone | Core change | Tests+e2e gate | overstory alignment | Releasable? |
|---|---|---|---|---|---|
| **M1** | **FlowIR shadow + `/tf ir`** | New `extensions/flowir/*` (vendored genuine compiler + translate bridge). `/tf ir <flow>` emits compiled IR + `flowIRHash` + structured `CompileError[]`. **Zero change to the 9 phase branches.** | existing suite zero-diff; new `flowir.test.ts` (property determinism + hash sensitivity + **byte-parity** vs overstory pinned commit); `sync-flowir.mjs --check` green; `/tf ir` e2e non-empty hash | ~10% — FlowIR types/hash shared | ✅ purely additive new command |
| **M2** | **`flowIRHash` into cache key + declared readSet** | `flowIRHash` folded into `cacheKey` as an **additive part** (old key hit ⟹ new key still hits; no false miss); `DeclaredDeps` (synthesized `inject`/`emits`) attached to nodes; hash persisted to `RunState`. | `cache.test.ts`+`store-extended.test.ts` green; new property: identical re-run ⟹ same hash; dogfood-cache still hits; **"nothing changed on Tuesday ⟹ $0.00 all cacheHit"** demo | ~25% — declared plane landed; cache is content-addressed | ✅ additive; cross-run cache sharper |
| **M3** | **Observed readSet + versioned context + provenance** | `interpolate.ts` gains an `onRead?` hook (fires only on successful resolution; fail-open); `PhaseState` gains `outputVersion?`/`reads?` (additive; old `RunState.json` loads fine); new `/tf provenance` + `/tf why-stale`. | existing suite zero-diff (`onRead` default `undefined`); new `observe.test.ts` (missed-invalidation soundness + early-cutoff + cascade); `runtime-branches.test.ts` records expected reads per phase; `e2e-provenance.mts`; v0.0.24 RunState loads both ways | ~45% — observed plane landed; data structures isomorphic to overstory `ContextGraph` | ✅ provenance/why-stale is independently useful |
| **M4** | **Stale-marking layer (cost-asymmetric: mark, don't rerun)** | Add `graph/cascade.ts` `computeStaleFrontier` to overstory core (pure fn + property test); pi-taskflow uses it to compute the stale frontier and **enqueue — but not auto-rerun by default** (VISION §2.3 conservative scheduling). `why-stale` upgraded to show frontier + cause. | overstory `graph-cascade.test.ts` (fast-check: soundness frontier⊆true-closure + precision cutoff strictly smaller); pi-taskflow all green; frontier deterministic | ~55% — cascade algorithm shared | ✅ "why it should rerun" diagnostics; zero behavior change |
| **M5** | **Minimal Recomputation (flagship, flag-gated)** | `computeStaleFrontier` + driver fixpoint (overstory `recomputeFlow`) → pi-taskflow `/tf recompute` (union I5: observed ∪ declared, early-cutoff per hop). Flag **default off**; flip default after AC all-green. | `recompute.test.ts` + `e2e-recompute.mts`: change a file no downstream reads ⟹ 0 reruns; change a file whose output-hash is unchanged ⟹ only direct deps rerun, transitive cutoff; change a file whose output truly changed ⟹ rerun = stale closure, **strictly < full**; provenance traces each decision to `key@version`+hash | ~70% — recompute loop shared; remaining = swap `executePhase` loop + converge state model | ✅ flagship capability, opt-in flag |

**Serial dependencies:** M1→M2 (same FlowIR); M2→M3 (declared plane lets observed keys be named); M3→M4 (observed plane is frontier input); M4→M5 (marking layer is the safe prerequisite to rerunning).

> **The elegance of the ordering:** even if you stop at **M2**, you have already
> shipped real product value — identical re-runs are free ($0.00), errors are
> LLM-consumable for self-correction, and dependencies are named. The flagship's
> glow is deferred, not lost: it arrives sharper at M5 because the planes underneath it are sound.

---

## 4. Per-milestone detail

### M1 — FlowIR compilation shadow
See the dedicated [`rfc-flowir-compilation.md`](./rfc-flowir-compilation.md).
**One-line:** vendor overstory's pure `ir/{compile,cond,hash,schema}` + `result/` +
`identity/`, add a single `translate.ts` bridge, expose `/tf ir`. Establishes the
byte-level FlowIR contract. Native validation: `flowIRHash` determinism + byte-parity.

### M2 — declared readSet + content-addressed cache
- `flowIRHash` becomes an **additive** component of `cacheKey` (a new versioned
  prefix; old persisted cache keys still hit). 
- `DeclaredDeps = { reads: inject, writes: emits }` synthesized at compile time and
  attached to each node.
- `flowIRHash` persisted into `RunState` (additive field; old runs load unchanged).
- **Demo:** re-run an unchanged flow ⟹ `$0.00`, all `cacheHit`. This is the first
  user-visible payoff and is honest framing ("identical re-run is free"), **not** the
  minimal-recompute number (that needs M5).

### M3 — observed readSet@version (the moat)
- `interpolate.ts` gains `onRead?(ref)` — invoked **only** on successful resolution,
  so a parse error stays fail-open (phase runs). This is the seam VISION §2.3 rests on.
- `PhaseState` gains additive `reads?: ReadRef[]` and `outputVersion?: number`.
- New commands `/tf provenance <runId>` (the evidence chain: a conclusion ← which
  reads@version ← which writes) and `/tf why-stale <phaseId>`.
- This is where "first to capture **observed** readSet@version" becomes true — the
  defensible moat no competitor (LangGraph checkpoint, Temporal replay, academic
  agent-caching) has.

### M4 — stale-marking (cost-asymmetric, the safe half)
- Add `computeStaleFrontier` to overstory `graph/` (pure function, property-tested).
- pi-taskflow computes the frontier and **marks stale + enqueues, but does not
  auto-rerun**. This is VISION §2.3's "fine-grained tracking, conservative
  scheduling" — the cheap effects (counts, severity, alerts) run; the expensive LLM
  effects are gated.
- Ships as pure diagnostics first (`why-stale` shows the frontier + cause). Zero
  behavior change. This is the safety prerequisite that lets M5 rerun confidently.

### M5 — minimal recomputation (flagship)
- `computeStaleFrontier` + a driver fixpoint (`recomputeFlow` in overstory core) →
  pi-taskflow `/tf recompute`, using **union I5** (observed ∪ declared) with
  early-cutoff per hop.
- **Flag-gated, default off.** Flip to default-on only after the full AC is green.
- **The flagship demo:** Monday full audit $6 / 8 agents → Tuesday change 1 file →
  rerun ≤2 nodes, $0.40 (−85%–93%). Every decision traceable to `key@version`+hash.

---

## 5. Risks & validation gates

> ⚠️ **Honest upfront:** VISION §4's three headline numbers (token savings,
> kill-9 recovery, incremental-recompute cost ratio) are **distributed across the
> roadmap**. No single milestone delivers all three. Claim each only at the
> milestone that owns it.

| Gate | Owned by | What it proves |
|---|---|---|
| **`flowIRHash` determinism + byte-parity** | **M1** (immediately runnable) | The seam is real: identical flow (incl. whitespace reorders) ⟹ identical hash; single-field mutation ⟹ hash changes; pi-taskflow's hash == overstory core's `hashIR` byte-for-byte. **This is M1's hard acceptance gate** — proof the compilation layer is not a shell. |
| **kill-9 recovery + observed-readSet soundness** | M3 | Run to completion → `kill -9` → resume → observed plane rebuilds losslessly; `why-stale` verdicts match pre-recompute. Early form of VISION's 2nd number (event-sourced resume vs Temporal replay). |
| **incremental-recompute cost ratio + token savings** | M5 | The flagship number: Monday $6/8 agents → Tuesday 1 file → ≤2 nodes $0.40. **Requires M5.** Before M5, any "savings" claim must be framed honestly as "identical re-run $0.00" (M2), not minimal recomputation. |

**Operational risks (tracked across milestones):**

- **Vendoring drift** (largest op risk): overstory is `0.1.0-dev.0`; every vendored
  file is migration debt if the compiler churns before publish. Mitigation: pin to a
  commit, `sync-flowir.mjs --check` in CI, **byte-parity test** as a hard gate.
- **Declared ≠ observed divergence:** synthesized `inject/emits` may not match actual
  interpolation reads. Handle as **advisory discrepancies** (report, never block) until
  M3 lands the observed plane; then as union-I5 at M5 with soundness property tests.
- **Cache-key migration:** M2 folding `flowIRHash` into the key risks a one-time
  miss-storm on deploy. Mitigation: additive key part + versioned prefix (old keys
  still hit).

---

## 6. Honest boundary — what **not** to touch now

These overstory capabilities have low ROI now or would break incremental releasability.
Defer them to **after** the kernel swap.

1. **Native multi-node lowering** (parallel→N siblings / tournament→map+gate /
   reduce→one-node-injects-many). M1 uses 1:1 projection; `lowerToOverstoryNative`
   is *defined but not called*. Touching it now breaks hash stability and widens the
   pre-swap migration surface. Land it when the scheduler actually executes flows.
2. **Full observed-vs-declared reconciliation (RFC-004).** M1/M2's declared plane is
   advisory discrepancies (report, never block). Forcing reconciliation now means
   betting on an unverified union rule before the observed plane (M3) exists.
3. **Map item-level reuse** (single item changes ⟹ rerun only that item). Known
   limitation (RFC-002 §1.3: a map emits the whole array). Scope explosion now; defer
   to an RFC after output-hash alignment.
4. **Unifying the imperative `executePhase` loop → overstory `step()`+driver
   event-sourced execution model.** This *is* the kernel swap itself; it's the entire
   content of the post-M5 RFC. Touching it now = changing data + algorithm + execution
   three layers at once — violates "each step is releasable."
5. **Converging `PhaseState`/`RunState` ↔ overstory `NodeState`/`RunTree`.** Defer to a
   mapping-layer RFC; forcing convergence now breaks backward compat (loading published
   `RunState.json`).
6. **Precise `ir-changed` diff** (invalidate only the structurally-changed slice). M5
   ships "full-invalidate (default) + refuse (flag)" two tiers first; precise diff is
   high-complexity, defer to a later RFC.

---

## 7. The narrative

> **overstory makes agent workflows compilable.** Like Svelte/Vue compiling
> components, we compile your taskflow into a content-addressed FlowIR — so "rerun
> with nothing changed" instantly goes to zero ($0.00), and "upstream changed" will
> one day rerun only the minimal subset that truly depends on it. This is the first
> foundation stone for agent orchestration's march from the Make era to the Bazel era:
> a compiled artifact, not a runtime guess.

Short form (README lead): *"Taskflows are now compiled, not interpreted — a
content-addressed IR that makes identical re-runs free and lays the track for
incremental recomputation."*

---

## 8. Open decision (the one gate before M1 starts)

**Vendor-now vs defer.** The arbiter recommends **vendor-now** (forced by overstory's
`private: true` + pi-taskflow's zero-runtime-dep packaging constraint). Vendoring
overstory's pure `ir/{compile,cond,hash,schema}` + `result/` + `identity/` now means
every later step inherits a correct seam, and each vendored file becomes a one-line
`import` swap once overstory publishes. **This is the only open decision blocking M1.**

---

*One-line summary: M1 (FlowIR shadow) is the only zero-dependency, zero-execution-path,
`fit-10` contract foundation on the path; it doesn't steal the flagship's glow (that's
M5), but it makes the flagship possible — and even if you stop at M2, you've shipped
"identical re-run $0.00 + LLM self-correction + named dependencies." Vendor first,
establish the byte-level contract, make the seam real.*
