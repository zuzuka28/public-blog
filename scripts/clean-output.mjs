import { rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = join(root, "_site");

if (basename(output) !== "_site" || dirname(output) !== root) {
  throw new Error(`Refusing to remove unexpected output path: ${output}`);
}

await rm(output, { recursive: true, force: true });
console.log("Removed stale _site output.");

