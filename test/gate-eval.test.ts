import assert from "node:assert/strict";
import { test } from "node:test";

import { executeTaskflow, type RuntimeDeps } from "../extensions/runtime.ts";
import type { RunState } from "../extensions/store.ts";
import type { AgentConfig } from "../extensions/agents.ts";
import type { RunResult } from "../extensions/runner.ts";
import { emptyUsage } from "../extensions/usage.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const dummyAgent: AgentConfig = { name: "default", model: "test/model", description: "dummy", systemPrompt: "", source: "user", filePath: "none" };

function mkState(def: any, runId: string): RunState {
	return {
		runId,
		flowName: (def as any).name,
		def: def as any,
		args: {},
		status: "running",
		phases: {},
		createdAt: Date.now(),
		updatedAt: Date.now(),
		cwd: "/tmp/test-eval",
	};
}

function mockRunResult(output: string): RunResult {
	return {
		agent: "default",
		task: "",
		exitCode: 0,
		output,
		stderr: "",
		usage: emptyUsage(),
	};
}

// ---------------------------------------------------------------------------
// Eval gates
// ---------------------------------------------------------------------------

test("eval gate: all evals pass → skips LLM gate", async () => {
	const def = {
		name: "eval-test",
		phases: [
			{ id: "prod", type: "agent", task: "produce PASS" },
			{
				id: "check",
				type: "gate",
				task: "should-never-run",
				dependsOn: ["prod"],
				eval: ["{steps.prod.output} contains PASS"],
			},
		],
	};
	const state: RunState = mkState(def, "eval-m1");
	const deps: RuntimeDeps = {
		cwd: "/tmp",
		agents: [dummyAgent],
		runTask: async (_cwd, _agents, _an, task) => {
			if (task.includes("should-never-run")) throw new Error("LLM gate called but eval should have passed");
			return mockRunResult(task);
		},
	};
	const result = await executeTaskflow(state, deps);
	assert.equal(result.ok, true);
	assert.equal(state.phases["check"]?.gate?.verdict, "pass");
});

test("eval gate: any eval fails → LLM gate runs", async () => {
	const def = {
		name: "eval-fail",
		phases: [
			{ id: "prod", type: "agent", task: "produce FAIL" },
			{
				id: "check",
				type: "gate",
				task: "is this good?",
				dependsOn: ["prod"],
				eval: ["{steps.prod.output} contains PASS"],
			},
		],
	};
	const state: RunState = mkState(def, "eval-fail-m1");
	let gateCalled = false;
	const deps: RuntimeDeps = {
		cwd: "/tmp",
		agents: [dummyAgent],
		runTask: async (_cwd, _agents, _an, task) => {
			if (task.includes("is this good?")) {
				gateCalled = true;
				return mockRunResult("VERDICT: BLOCK needs work");
			}
			return mockRunResult(task);
		},
	};
	const result = await executeTaskflow(state, deps);
	assert.equal(result.ok, false);
	assert.equal(gateCalled, true);
	assert.equal(state.phases["check"]?.gate?.verdict, "block");
});

// ---------------------------------------------------------------------------
// onBlock:retry
// ---------------------------------------------------------------------------

test("onBlock:retry — gate blocks, upstream+gate re-execute once", async () => {
	const calls: string[] = [];
	const def = {
		name: "retry-test",
		phases: [
			{ id: "prod", type: "agent", task: "produce-report" },
			{
				id: "check",
				type: "gate",
				task: "gate-task",
				dependsOn: ["prod"],
				onBlock: "retry" as const,
				retry: { max: 1 },
			},
			{ id: "final", type: "agent", task: "ship", dependsOn: ["check"], final: true },
		],
	};
	const state: RunState = mkState(def, "retry-m1");
	let gateAttempt = 0;
	const deps: RuntimeDeps = {
		cwd: "/tmp",
		agents: [dummyAgent],
		runTask: async (_cwd, _agents, _an, task) => {
			calls.push(task);
			if (task.includes("gate-task")) {
				gateAttempt++;
				return mockRunResult(gateAttempt === 1 ? "VERDICT: BLOCK needs more detail" : "VERDICT: PASS");
			}
			if (task.includes("produce-report")) {
				return mockRunResult(gateAttempt === 0 ? "v1" : "v2 (improved)");
			}
			return mockRunResult(task);
		},
	};
	const result = await executeTaskflow(state, deps);
	assert.equal(result.ok, true);
	assert.equal(state.phases["check"]?.gate?.verdict, "pass");
	assert.ok(calls.filter((t) => t.includes("gate-task")).length >= 2, "gate ran at least twice");
});

test("onBlock:retry — max retries exhausted → halts", async () => {
	const def = {
		name: "retry-exhaust",
		phases: [
			{ id: "prod", type: "agent", task: "produce" },
			{
				id: "check",
				type: "gate",
				task: "gate-task",
				dependsOn: ["prod"],
				onBlock: "retry" as const,
				retry: { max: 0 },
			},
		],
	};
	const state: RunState = mkState(def, "retry-exhaust-m1");
	const deps: RuntimeDeps = {
		cwd: "/tmp",
		agents: [dummyAgent],
		runTask: async (_cwd, _agents, _an, task) => {
			if (task.includes("gate-task")) return mockRunResult("VERDICT: BLOCK");
			return mockRunResult(task);
		},
	};
	const result = await executeTaskflow(state, deps);
	assert.equal(result.ok, false);
	assert.equal(state.phases["check"]?.gate?.verdict, "block");
});

test("onBlock:retry — default is 'halt' (backward compatible)", async () => {
	const def = {
		name: "halt-default",
		phases: [
			{ id: "prod", type: "agent", task: "produce" },
			{
				id: "check",
				type: "gate",
				task: "gate-task",
				dependsOn: ["prod"],
				// onBlock omitted → defaults to "halt"
			},
		],
	};
	const state: RunState = mkState(def, "halt-default-m1");
	const deps: RuntimeDeps = {
		cwd: "/tmp",
		agents: [dummyAgent],
		runTask: async (_cwd, _agents, _an, task) => {
			if (task.includes("gate-task")) return mockRunResult("VERDICT: BLOCK");
			return mockRunResult(task);
		},
	};
	const result = await executeTaskflow(state, deps);
	assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// Combined: eval + onBlock:retry
// ---------------------------------------------------------------------------

test("combined: eval passes → gate skipped, retry never triggers", async () => {
	const def = {
		name: "eval-first",
		phases: [
			{ id: "prod", type: "agent", task: "produce PASS" },
			{
				id: "check",
				type: "gate",
				task: "gate-task",
				dependsOn: ["prod"],
				onBlock: "retry" as const,
				retry: { max: 1 },
				eval: ["{steps.prod.output} contains PASS"],
			},
		],
	};
	const state: RunState = mkState(def, "eval-first-m1");
	let llmGateCalled = false;
	const deps: RuntimeDeps = {
		cwd: "/tmp",
		agents: [dummyAgent],
		runTask: async (_cwd, _agents, _an, task) => {
			if (task.includes("gate-task")) {
				llmGateCalled = true;
				return mockRunResult("VERDICT: BLOCK");
			}
			return mockRunResult(task);
		},
	};
	const result = await executeTaskflow(state, deps);
	assert.equal(result.ok, true);
	assert.equal(state.phases["check"]?.gate?.verdict, "pass");
	assert.equal(llmGateCalled, false, "LLM gate never called");
});
