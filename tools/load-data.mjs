/* Loads the planner's data files (data/*.js) into Node, exactly as the browser sees them. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function loadData(files = ["data/trees.js", "data/keywords.js", "data/premades.js"]) {
  const ctx = {};
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(readFileSync(join(ROOT, f), "utf8"), ctx, { filename: f });
  return ctx.BP;
}
