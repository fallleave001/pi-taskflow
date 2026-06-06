import assert from "node:assert/strict";
import { test } from "node:test";
import { dependenciesOf, finalPhase, resolveArgs, type Taskflow, topoLayers, validateTaskflow } from "../extensions/schema.ts";

const valid: Taskflow = {
	name: "audit",
	phases: [
		{ id: "discover", type: "agent", agent: "a", task: "list", output: "json" },
		{ id: "audit", type: "map", over: "{steps.discover.json}", as: "item", agent: "a", task: "do {item}", dependsOn: ["discover"] },
		{ id: "report", type: "reduce", from: ["audit"], agent: "a", task: "sum {steps.audit.output}", dependsOn: ["audit"], final: true },
	],
};

test("validateTaskflow: accepts a valid flow", () => {
	const r = validateTaskflow(valid);
	assert.equal(r.ok, true, r.errors.join("; "));
});

test("validateTaskflow: rejects missing name / phases", () => {
	assert.equal(validateTaskflow({}).ok, false);
	assert.equal(validateTaskflow({ name: "x" }).ok, false);
	assert.equal(validateTaskflow({ name: "x", phases: [] }).ok, false);
});

test("validateTaskflow: per-type requirements", () => {
	assert.equal(validateTaskflow({ name: "x", phases: [{ id: "p", type: "agent" }] }).ok, false); // no task
	assert.equal(validateTaskflow({ name: "x", phases: [{ id: "p", type: "map", task: "t" }] }).ok, false); // no over
	assert.equal(validateTaskflow({ name: "x", phases: [{ id: "p", type: "parallel" }] }).ok, false); // no branches
	assert.equal(validateTaskflow({ name: "x", phases: [{ id: "p", type: "reduce", task: "t" }] }).ok, false); // no from
	assert.equal(validateTaskflow({ name: "x", phases: [{ id: "p", type: "flow" }] }).ok, false); // no use
});

test("validateTaskflow: new phase types and fields", () => {
	// flow with use is valid
	assert.equal(validateTaskflow({ name: "x", phases: [{ id: "p", type: "flow", use: "other" }] }).ok, true);
	// approval needs no task
	assert.equal(validateTaskflow({ name: "x", phases: [{ id: "p", type: "approval" }] }).ok, true);
	// retry.max must be >= 0
	assert.equal(
		validateTaskflow({ name: "x", phases: [{ id: "p", type: "agent", task: "t", retry: { max: -1 } }] }).ok,
		false,
	);
	assert.equal(
		validateTaskflow({ name: "x", phases: [{ id: "p", type: "agent", task: "t", retry: { max: 2 } }] }).ok,
		true,
	);
	// when + join accepted
	assert.equal(
		validateTaskflow({
			name: "x",
			phases: [
				{ id: "a", type: "agent", task: "t" },
				{ id: "b", type: "agent", task: "t", dependsOn: ["a"], when: "{steps.a.output} == ok", join: "any" },
			],
		}).ok,
		true,
	);
	// budget accepted at top level
	assert.equal(
		validateTaskflow({ name: "x", budget: { maxUSD: 1 }, phases: [{ id: "p", type: "agent", task: "t" }] }).ok,
		true,
	);
});

test("validateTaskflow: duplicate ids and unknown deps", () => {
	const dup = { name: "x", phases: [{ id: "p", type: "agent", task: "t" }, { id: "p", type: "agent", task: "t" }] };
	assert.equal(validateTaskflow(dup).ok, false);
	const badDep = { name: "x", phases: [{ id: "p", type: "agent", task: "t", dependsOn: ["ghost"] }] };
	assert.equal(validateTaskflow(badDep).ok, false);
});

test("validateTaskflow: does not throw on malformed phases (null / non-object)", () => {
	// Regression: finals filter must not deref a null phase.
	assert.doesNotThrow(() => validateTaskflow({ name: "x", phases: [null] }));
	assert.equal(validateTaskflow({ name: "x", phases: [null] }).ok, false);
	assert.doesNotThrow(() => validateTaskflow({ name: "x", phases: [{ id: "a", task: "t" }, 42] }));
	assert.equal(validateTaskflow({ name: "x", phases: [42] }).ok, false);
});

test("validateTaskflow: detects cycles", () => {
	const cyc = {
		name: "x",
		phases: [
			{ id: "a", type: "agent", task: "t", dependsOn: ["b"] },
			{ id: "b", type: "agent", task: "t", dependsOn: ["a"] },
		],
	};
	const r = validateTaskflow(cyc);
	assert.equal(r.ok, false);
	assert.match(r.errors.join(" "), /cycle/i);
});

test("validateTaskflow: at most one final", () => {
	const two = {
		name: "x",
		phases: [
			{ id: "a", type: "agent", task: "t", final: true },
			{ id: "b", type: "agent", task: "t", final: true },
		],
	};
	assert.equal(validateTaskflow(two).ok, false);
});

test("resolveArgs: applies defaults, honors overrides, passes through extras", () => {
	const def: Taskflow = {
		name: "x",
		args: { a: { default: 1 }, b: {} },
		phases: [{ id: "p", task: "t" }],
	};
	assert.deepEqual(resolveArgs(def, { b: 2, c: 3 }), { a: 1, b: 2, c: 3 });
	assert.deepEqual(resolveArgs(def, undefined), { a: 1 });
	assert.deepEqual(resolveArgs(def, { a: 9 }), { a: 9 });
});

test("topoLayers: produces correct execution layers", () => {
	const layers = topoLayers(valid.phases);
	assert.deepEqual(layers.map((l) => l.map((p) => p.id)), [["discover"], ["audit"], ["report"]]);
});

test("topoLayers: parallel phases share a layer", () => {
	const phases: Taskflow["phases"] = [
		{ id: "root", type: "agent", task: "t" },
		{ id: "x", type: "agent", task: "t", dependsOn: ["root"] },
		{ id: "y", type: "agent", task: "t", dependsOn: ["root"] },
		{ id: "join", type: "reduce", from: ["x", "y"], task: "t", dependsOn: ["x", "y"] },
	];
	const layers = topoLayers(phases);
	assert.deepEqual(layers[0].map((p) => p.id), ["root"]);
	assert.deepEqual(layers[1].map((p) => p.id).sort(), ["x", "y"]);
	assert.deepEqual(layers[2].map((p) => p.id), ["join"]);
});

test("dependenciesOf: unions dependsOn and from", () => {
	assert.deepEqual(dependenciesOf({ id: "p", from: ["a"], dependsOn: ["b"] }).sort(), ["a", "b"]);
});

test("finalPhase: explicit final, else last", () => {
	assert.equal(finalPhase(valid.phases).id, "report");
	const noFinal: Taskflow["phases"] = [{ id: "a", task: "t" }, { id: "b", task: "t" }];
	assert.equal(finalPhase(noFinal).id, "b");
});

test("validateTaskflow: warns when {steps.X} is referenced but X is not in dependsOn", () => {
	// This is the jiuyang-full-pipeline anti-pattern: the task talks about
	// {steps.code-review-1.output} but the phase has no dependsOn, so it runs
	// in parallel with code-review-1 and the model sees the literal placeholder.
	const def = {
		name: "no-deps",
		phases: [
			{ id: "code-review-1", type: "agent", task: "review code" },
			{ id: "fix-issues", type: "agent", task: "fix {steps.code-review-1.output}" },
			{ id: "code-review-2", type: "agent", task: "re-review {steps.fix-issues.output}" },
		],
	};
	const r = validateTaskflow(def);
	assert.equal(r.ok, true, "missing dependsOn is a warning, not an error");
	assert.equal(r.warnings.length, 2, "two undeclared refs");
	assert.match(r.warnings[0], /Phase 'fix-issues'.*'code-review-1'.*not in dependsOn/);
	assert.match(r.warnings[1], /Phase 'code-review-2'.*'fix-issues'.*not in dependsOn/);
});

test("validateTaskflow: warns about a phase referencing its own output", () => {
	const def = {
		name: "self-ref",
		phases: [{ id: "loop", type: "agent", task: "use {steps.loop.output} again" }],
	};
	const r = validateTaskflow(def);
	assert.equal(r.ok, true);
	assert.equal(r.warnings.length, 1);
	assert.match(r.warnings[0], /references its own output/);
});

test("validateTaskflow: no warning when {steps.X} is properly declared in dependsOn", () => {
	const def = {
		name: "ok-deps",
		phases: [
			{ id: "a", type: "agent", task: "do" },
			{ id: "b", type: "agent", task: "use {steps.a.output}", dependsOn: ["a"] },
		],
	};
	const r = validateTaskflow(def);
	assert.equal(r.ok, true);
	assert.equal(r.warnings.length, 0);
});

test("validateTaskflow: warning also catches refs in map/parallel branches and over", () => {
	const def = {
		name: "fanout-ref",
		phases: [
			{ id: "list", type: "agent", task: "list" },
			{
				id: "work",
				type: "map",
				over: "{steps.list.output}",
				task: "do {item}",
				// no dependsOn — should warn
			},
		],
	};
	const r = validateTaskflow(def);
	assert.equal(r.ok, true);
	assert.equal(r.warnings.length, 1);
	assert.match(r.warnings[0], /'work'.*'list'/);
});

test("validateTaskflow: warning also catches refs in when and flow.with", () => {
	const def = {
		name: "when-and-flow-with",
		phases: [
			{ id: "plan", type: "agent", task: "plan" },
			{ id: "ship", type: "agent", task: "ship", when: "{steps.plan.output} == ok" },
			{ id: "sub", type: "flow", use: "child", with: { note: "use {steps.plan.output}" } },
		],
	};
	const r = validateTaskflow(def);
	assert.equal(r.ok, true);
	assert.equal(r.warnings.length, 2);
	assert.match(r.warnings[0], /'ship'.*'plan'/);
	assert.match(r.warnings[1], /'sub'.*'plan'/);
});

test("validateTaskflow: invocation warnings catch missing args and cwd/codebase mismatch", () => {
	const def: Taskflow = {
		name: "invoke",
		args: { codebase: { required: true } },
		phases: [
			{ id: "a", type: "agent", task: "scan {args.codebase} for {args.branch}", final: true },
		],
	};
	const r = validateTaskflow(def, {
		args: { codebase: "/repo/app" },
		cwd: "/tmp/other-project",
	});
	assert.equal(r.ok, true);
	assert.equal(r.warnings.length, 2);
	assert.match(r.warnings[0], /\{args\.branch\}.*did not provide 'branch'/);
	assert.match(r.warnings[1], /cwd '.*other-project'.*args\.codebase '.*repo\/app'/);
});

test("validateTaskflow: cwd warning also fires when cwd is a parent of codebase", () => {
	const def: Taskflow = {
		name: "parent-cwd",
		phases: [{ id: "a", type: "agent", task: "scan {args.codebase}", final: true }],
	};
	const r = validateTaskflow(def, {
		args: { codebase: "repo/app" },
		cwd: "/tmp/workspace",
	});
	assert.equal(r.ok, true);
	assert.equal(r.warnings.length, 1);
	assert.match(r.warnings[0], /cwd '.*workspace'.*args\.codebase '.*workspace\/repo\/app'/);
});

test("validateTaskflow: no cwd warning when cwd is inside codebase", () => {
	const def: Taskflow = {
		name: "inside-codebase",
		phases: [{ id: "a", type: "agent", task: "scan {args.codebase}", final: true }],
	};
	const r = validateTaskflow(def, {
		args: { codebase: "/tmp/workspace/repo/app" },
		cwd: "/tmp/workspace/repo/app/src",
	});
	assert.equal(r.ok, true);
	assert.equal(r.warnings.length, 0);
});

test("validateTaskflow: strictInterpolation upgrades warnings to errors", () => {
	const def = {
		name: "strict",
		strictInterpolation: true,
		phases: [
			{ id: "review", type: "agent", task: "review" },
			{ id: "fix", type: "agent", task: "fix {steps.review.output}" },
		],
	};
	const r = validateTaskflow(def);
	assert.equal(r.ok, false);
	assert.ok(r.errors.some((e) => /Strict interpolation: Phase 'fix'/.test(e)));
});

test("validateTaskflow: accepts context field on any phase type", () => {
	const def: Taskflow = {
		name: "ctx",
		phases: [
			{ id: "a", type: "agent", task: "t1", context: ["src/a.ts"], final: true },
			{ id: "b", type: "agent", task: "t2", context: ["src/b.ts", "{steps.a.json}"], contextLimit: 500, dependsOn: ["a"] },
		],
	};
	const r = validateTaskflow(def);
	assert.equal(r.ok, true);
});

test("validateTaskflow: missing context field is accepted (backward compatible)", () => {
	const def: Taskflow = {
		name: "no-ctx",
		phases: [{ id: "a", type: "agent", task: "t", final: true }],
	};
	const r = validateTaskflow(def);
	assert.equal(r.ok, true);
	assert.equal(r.warnings.length, 0);
});
