import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { saveSettings, settingsToEnv } from "../src/settings-store.js";

test("portal settings preserve saved keys when replacement fields are blank", () => {
  const values = settingsToEnv({
    defaultMode: "live",
    gpt: { endpoint: "https://gpt.example.com", authMode: "entra", apiKey: "", identifier: "gpt-5.6-terra" },
    mai: { endpoint: "https://mai.example.com", authMode: "api-key", apiKey: "new-mai", identifier: "MAI-Image-2.5" }
  }, {
    gpt: { apiKey: "saved-gpt" },
    mai: { apiKey: "saved-mai" }
  });

  assert.equal(values.GPT_API_KEY, "saved-gpt");
  assert.equal(values.GPT_AUTH_MODE, "entra");
  assert.equal(values.MAI_API_KEY, "new-mai");
  assert.equal(values.MAI_AUTH_MODE, "api-key");
});

test("settings persistence replaces managed values and preserves unrelated entries", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "aurelia-settings-"));
  const envPath = path.join(directory, ".env");
  context.after(() => rm(directory, { recursive: true, force: true }));

  await saveSettings(envPath, {
    MODEL_MODE: "live",
    GPT_ENDPOINT: "https://gpt.example.com",
    GPT_AUTH_MODE: "api-key",
    GPT_API_KEY: "secret-gpt",
    GPT_DEPLOYMENT: "gpt-5.6-terra",
    MAI_ENDPOINT: "https://mai.example.com",
    MAI_AUTH_MODE: "api-key",
    MAI_API_KEY: "secret-mai",
    MAI_MODEL: "MAI-Image-2.5"
  });
  const first = await readFile(envPath, "utf8");
  assert.match(first, /GPT_API_KEY="secret-gpt"/);

  await saveSettings(envPath, {
    MODEL_MODE: "mock",
    GPT_ENDPOINT: "https://other.example.com",
    GPT_AUTH_MODE: "entra",
    GPT_API_KEY: "replacement",
    GPT_DEPLOYMENT: "gpt-next",
    MAI_ENDPOINT: "https://mai.example.com",
    MAI_AUTH_MODE: "entra",
    MAI_API_KEY: "secret-mai",
    MAI_MODEL: "MAI-Image-2.5"
  });
  const second = await readFile(envPath, "utf8");
  assert.doesNotMatch(second, /secret-gpt/);
  assert.match(second, /GPT_DEPLOYMENT="gpt-next"/);
});
