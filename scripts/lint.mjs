import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const roots = ["server.js", "src", "public", "scripts", "test"];
const files = [];

async function collect(target) {
  const absolute = path.resolve(target);
  if (target.endsWith(".js") || target.endsWith(".mjs")) {
    files.push(absolute);
    return;
  }
  for (const entry of await readdir(absolute, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) await collect(child);
    else if (/\.[cm]?js$/.test(entry.name)) files.push(child);
  }
}

for (const root of roots) {
  await collect(root);
}

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`Syntax checked ${files.length} JavaScript files.`);
