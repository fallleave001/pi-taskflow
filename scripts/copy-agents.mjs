// Copy the built-in agent .md data files into dist/agents so the published
// taskflow-core package can resolve them via import.meta.dirname at runtime.
// tsc only emits .js/.d.ts; data files must be copied explicitly.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const coreRoot = join(here, "..", "packages", "taskflow-core");
const src = join(coreRoot, "src", "agents");
const dest = join(coreRoot, "dist", "agents");

if (!existsSync(src)) {
	console.error(`[copy-agents] source not found: ${src}`);
	process.exit(1);
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`[copy-agents] copied built-in agents → ${dest}`);
