import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const MANAGED_KEYS = [
  "MODEL_MODE",
  "GPT_ENDPOINT",
  "GPT_API_KEY",
  "GPT_DEPLOYMENT",
  "MAI_ENDPOINT",
  "MAI_API_KEY",
  "MAI_MODEL"
];

function quoteEnv(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\n")}"`;
}

export function settingsToEnv(settings, currentConfig) {
  return {
    MODEL_MODE: settings.defaultMode,
    GPT_ENDPOINT: settings.gpt.endpoint,
    GPT_API_KEY: settings.gpt.apiKey || currentConfig.gpt.apiKey,
    GPT_DEPLOYMENT: settings.gpt.identifier,
    MAI_ENDPOINT: settings.mai.endpoint,
    MAI_API_KEY: settings.mai.apiKey || currentConfig.mai.apiKey,
    MAI_MODEL: settings.mai.identifier
  };
}

export async function saveSettings(envPath, values) {
  let existing = "";
  try {
    existing = await readFile(envPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const managedPattern = new RegExp(`^(?:export\\s+)?(?:${MANAGED_KEYS.join("|")})\\s*=`);
  const preserved = existing
    .split(/\r?\n/)
    .filter((line) => !managedPattern.test(line.trim()))
    .join("\n")
    .trimEnd();
  const managed = MANAGED_KEYS.map((key) => `${key}=${quoteEnv(values[key] || "")}`).join("\n");
  const content = `${preserved ? `${preserved}\n\n` : ""}# Managed by the Aurelia portal\n${managed}\n`;
  const temporaryPath = path.join(path.dirname(envPath), `.${path.basename(envPath)}.${process.pid}.tmp`);

  await writeFile(temporaryPath, content, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, envPath);
}
