import assert from "node:assert/strict";
import { test } from "node:test";
import {
	emptyUsage,
	isFailed,
	aggregateUsage,
	formatTokens,
	formatUsage,
	mapWithConcurrencyLimit,
	type UsageStats,
	type RunResult,
} from "../extensions/runner.ts";

// ── emptyUsage ──────────────────────────────────────────────────────

test("emptyUsage: returns all fields zeroed", () => {
	const u = emptyUsage();
	assert.deepEqual(u, {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		cost: 0,
		contextTokens: 0,
		turns: 0,
	});
});

test("emptyUsage: returns a fresh object each call (no shared reference)", () => {
	const a = emptyUsage();
	const b = emptyUsage();
	assert.notEqual(a, b);
	a.input = 42;
	assert.equal(b.input, 0);
});

// ── isFailed ────────────────────────────────────────────────────────

function mkResult(overrides: Partial<RunResult> = {}): RunResult {
	return {
		agent: "a",
		task: "t",
		exitCode: 0,
		output: "ok",
		stderr: "",
		usage: emptyUsage(),
		stopReason: "end",
		...overrides,
	};
}

test("isFailed: returns false for exitCode 0 and normal stopReason", () => {
	assert.equal(isFailed(mkResult()), false);
	assert.equal(isFailed(mkResult({ stopReason: "end" })), false);
	assert.equal(isFailed(mkResult({ stopReason: undefined })), false);
});

test("isFailed: returns true for non-zero exitCode", () => {
	assert.equal(isFailed(mkResult({ exitCode: 1 })), true);
	assert.equal(isFailed(mkResult({ exitCode: 127 })), true);
	assert.equal(isFailed(mkResult({ exitCode: -1 })), true);
});

test("isFailed: returns true for stopReason 'error'", () => {
	assert.equal(isFailed(mkResult({ stopReason: "error" })), true);
});

test("isFailed: returns true for stopReason 'aborted'", () => {
	assert.equal(isFailed(mkResult({ stopReason: "aborted" })), true);
});

test("isFailed: returns true when multiple failure indicators combine", () => {
	assert.equal(isFailed(mkResult({ exitCode: 1, stopReason: "error" })), true);
});

// ── aggregateUsage ──────────────────────────────────────────────────

test("aggregateUsage: sums all numeric fields from multiple usages", () => {
	const a: UsageStats = { input: 10, output: 20, cacheRead: 5, cacheWrite: 3, cost: 0.01, contextTokens: 100, turns: 1 };
	const b: UsageStats = { input: 30, output: 40, cacheRead: 10, cacheWrite: 7, cost: 0.02, contextTokens: 200, turns: 2 };
	const total = aggregateUsage([a, b]);
	assert.equal(total.input, 40);
	assert.equal(total.output, 60);
	assert.equal(total.cacheRead, 15);
	assert.equal(total.cacheWrite, 10);
	assert.equal(total.cost, 0.03);
	assert.equal(total.turns, 3);
});

test("aggregateUsage: empty array returns zeroed usage", () => {
	const total = aggregateUsage([]);
	assert.deepEqual(total, emptyUsage());
});

test("aggregateUsage: single usage returns a copy (not the same reference)", () => {
	const u: UsageStats = { input: 5, output: 10, cacheRead: 0, cacheWrite: 0, cost: 0.001, contextTokens: 0, turns: 1 };
	const total = aggregateUsage([u]);
	assert.equal(total.input, 5);
	assert.equal(total.output, 10);
	assert.notEqual(total, u);
});

test("aggregateUsage: does not include contextTokens in sum (by design — field excluded from loop)", () => {
	// contextTokens is explicitly excluded from the aggregation loop in runner.ts
	// because contextTokens is a snapshot, not an additive counter.
	const a: UsageStats = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 500, turns: 0 };
	const b: UsageStats = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 300, turns: 0 };
	const total = aggregateUsage([a, b]);
	// contextTokens stays at 0 (emptyUsage default) since aggregateUsage doesn't sum it
	assert.equal(total.contextTokens, 0);
});

// ── formatTokens ────────────────────────────────────────────────────

test("formatTokens: below 1000 returns plain number", () => {
	assert.equal(formatTokens(0), "0");
	assert.equal(formatTokens(1), "1");
	assert.equal(formatTokens(999), "999");
});

test("formatTokens: 1000–9999 returns one-decimal k", () => {
	assert.equal(formatTokens(1000), "1.0k");
	assert.equal(formatTokens(1500), "1.5k");
	assert.equal(formatTokens(9999), "10.0k");
});

test("formatTokens: 10000–999999 returns rounded k", () => {
	assert.equal(formatTokens(10000), "10k");
	assert.equal(formatTokens(50000), "50k");
	assert.equal(formatTokens(999999), "1000k");
});

test("formatTokens: 1M+ returns one-decimal M", () => {
	assert.equal(formatTokens(1000000), "1.0M");
	assert.equal(formatTokens(2500000), "2.5M");
	assert.equal(formatTokens(10000000), "10.0M");
});

test("formatTokens: boundary values", () => {
	// boundary: exactly 1000
	assert.equal(formatTokens(1000), "1.0k");
	// boundary: exactly 10000
	assert.equal(formatTokens(10000), "10k");
	// boundary: exactly 1000000
	assert.equal(formatTokens(1000000), "1.0M");
});

// ── formatUsage ─────────────────────────────────────────────────────

test("formatUsage: shows turns, input, output, cacheRead, cost when present", () => {
	const usage: UsageStats = { input: 5000, output: 2000, cacheRead: 1000, cacheWrite: 0, cost: 0.0123, contextTokens: 0, turns: 3 };
	const result = formatUsage(usage);
	assert.match(result, /3 turns/);
	assert.match(result, /↑5\.0k/);
	assert.match(result, /↓2\.0k/);
	assert.match(result, /R1\.0k/);
	assert.match(result, /\$0\.0123/);
});

test("formatUsage: omits zero-value fields", () => {
	const usage: UsageStats = { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 1 };
	const result = formatUsage(usage);
	assert.equal(result, "1 turn ↑100 ↓50");
	assert.ok(!result.includes("R"));
	assert.ok(!result.includes("$"));
});

test("formatUsage: appends model when provided", () => {
	const usage: UsageStats = { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 1 };
	const result = formatUsage(usage, "claude-sonnet-4-20250514");
	assert.match(result, /claude-sonnet-4-20250514$/);
});

test("formatUsage: singular 'turn' for turns=1", () => {
	const usage = { ...emptyUsage(), turns: 1, input: 10 };
	assert.match(formatUsage(usage), /1 turn /);
	assert.ok(!formatUsage(usage).includes("turns"));
});

test("formatUsage: plural 'turns' for turns>1", () => {
	const usage = { ...emptyUsage(), turns: 5, input: 10 };
	assert.match(formatUsage(usage), /5 turns/);
});

test("formatUsage: empty usage returns empty string", () => {
	assert.equal(formatUsage(emptyUsage()), "");
});

test("formatUsage: empty usage with model returns just model", () => {
	assert.equal(formatUsage(emptyUsage(), "gpt-4"), "gpt-4");
});

// ── mapWithConcurrencyLimit ─────────────────────────────────────────

test("mapWithConcurrencyLimit: empty array returns empty array", async () => {
	const result = await mapWithConcurrencyLimit([], 4, async () => "nope");
	assert.deepEqual(result, []);
});

test("mapWithConcurrencyLimit: processes all items and preserves order", async () => {
	const items = [10, 20, 30, 40, 50];
	const result = await mapWithConcurrencyLimit(items, 3, async (item) => item * 2);
	assert.deepEqual(result, [20, 40, 60, 80, 100]);
});

test("mapWithConcurrencyLimit: passes correct index to callback", async () => {
	const items = ["a", "b", "c"];
	const indices: number[] = [];
	await mapWithConcurrencyLimit(items, 2, async (_item, index) => {
		indices.push(index);
	});
	assert.deepEqual(indices.sort(), [0, 1, 2]);
});

test("mapWithConcurrencyLimit: respects concurrency cap", async () => {
	let active = 0;
	let peak = 0;
	const items = Array.from({ length: 8 }, (_, i) => i);

	await mapWithConcurrencyLimit(items, 2, async (item) => {
		active++;
		peak = Math.max(peak, active);
		// Stagger slightly to increase chance of observing concurrency
		await new Promise((r) => setTimeout(r, 5));
		active--;
		return item;
	});

	assert.ok(peak <= 2, `peak concurrency was ${peak}, expected ≤ 2`);
	assert.ok(peak >= 1, `peak concurrency was ${peak}, expected ≥ 1`);
});

test("mapWithConcurrencyLimit: concurrency=1 serializes execution", async () => {
	let active = 0;
	let peak = 0;
	const items = [1, 2, 3, 4];

	await mapWithConcurrencyLimit(items, 1, async (item) => {
		active++;
		peak = Math.max(peak, active);
		await new Promise((r) => setTimeout(r, 5));
		active--;
		return item;
	});

	assert.equal(peak, 1, "concurrency=1 must serialize");
});

test("mapWithConcurrencyLimit: concurrency > items.length works (clamped)", async () => {
	const items = [1, 2];
	const result = await mapWithConcurrencyLimit(items, 100, async (item) => item + 1);
	assert.deepEqual(result, [2, 3]);
});

test("mapWithConcurrencyLimit: concurrency=0 is clamped to 1", async () => {
	const items = [1, 2, 3];
	const result = await mapWithConcurrencyLimit(items, 0, async (item) => item * 10);
	assert.deepEqual(result, [10, 20, 30]);
});

test("mapWithConcurrencyLimit: negative concurrency is clamped to 1", async () => {
	const result = await mapWithConcurrencyLimit([42], -5, async (item) => item);
	assert.deepEqual(result, [42]);
});

test("mapWithConcurrencyLimit: error in callback rejects the promise", async () => {
	const items = [1, 2, 3, 4, 5];
	await assert.rejects(
		() =>
			mapWithConcurrencyLimit(items, 2, async (item) => {
				if (item === 3) throw new Error("boom at 3");
				return item;
			}),
		{ message: "boom at 3" },
	);
});

test("mapWithConcurrencyLimit: single item works", async () => {
	const result = await mapWithConcurrencyLimit([99], 4, async (item) => `val:${item}`);
	assert.deepEqual(result, ["val:99"]);
});

test("mapWithConcurrencyLimit: async results resolve in correct slots despite variable delays", async () => {
	// Items with inverse delays: later items finish faster
	const items = [50, 40, 30, 20, 10];
	const result = await mapWithConcurrencyLimit(items, 5, async (item) => {
		await new Promise((r) => setTimeout(r, item / 10));
		return item * 2;
	});
	// Despite items finishing out-of-order, results must be in input order
	assert.deepEqual(result, [100, 80, 60, 40, 20]);
});
