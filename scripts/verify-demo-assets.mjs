import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "artifacts", "demo-assets.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.artifacts)) {
  throw new Error("Unsupported demo asset manifest.");
}

for (const artifact of manifest.artifacts) {
  const assetPath = path.resolve(root, artifact.path);
  if (!assetPath.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Asset path escapes the repository: ${artifact.path}`);
  }
  const [contents, metadata] = await Promise.all([readFile(assetPath), stat(assetPath)]);
  const actualHash = createHash("sha256").update(contents).digest("hex");
  if (metadata.size !== artifact.bytes) {
    throw new Error(`${artifact.path} size mismatch: expected ${artifact.bytes}, received ${metadata.size}.`);
  }
  if (actualHash !== artifact.sha256) {
    throw new Error(`${artifact.path} SHA-256 mismatch.`);
  }
}

console.log(`Verified ${manifest.artifacts.length} committed demo assets.`);
