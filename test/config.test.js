import test from "node:test";
import assert from "node:assert/strict";
import {
  getConfig,
  normalizeAzureOpenAIBaseUrl,
  normalizeMaiEndpoint,
  publicStatus
} from "../src/config.js";

test("normalizes Azure OpenAI resource and deployment URLs to the v1 base", () => {
  assert.equal(
    normalizeAzureOpenAIBaseUrl("https://contoso.openai.azure.com"),
    "https://contoso.openai.azure.com/openai/v1/"
  );
  assert.equal(
    normalizeAzureOpenAIBaseUrl("https://contoso.openai.azure.com/openai/deployments/demo/responses?api-version=preview"),
    "https://contoso.openai.azure.com/openai/v1/"
  );
  assert.equal(
    normalizeAzureOpenAIBaseUrl("https://contoso.openai.azure.com/openai/v1/responses"),
    "https://contoso.openai.azure.com/openai/v1/"
  );
});

test("normalizes MAI endpoint when a full generation route is supplied", () => {
  assert.equal(
    normalizeMaiEndpoint("https://contoso.services.ai.azure.com/mai/v1/images/generations"),
    "https://contoso.services.ai.azure.com"
  );
  assert.equal(
    normalizeMaiEndpoint("https://contoso.services.ai.azure.com/custom/base/"),
    "https://contoso.services.ai.azure.com/custom/base"
  );
});

test("rejects plaintext full provider routes", () => {
  assert.throws(
    () => normalizeAzureOpenAIBaseUrl("http://example.com/openai/v1/responses"),
    /must use HTTPS/
  );
  assert.throws(
    () => normalizeMaiEndpoint("http://example.com/mai/v1/images/edits"),
    /must use HTTPS/
  );
});

test("live mode falls back explicitly when GPT credentials are incomplete", () => {
  const config = getConfig({
    MODEL_MODE: "live",
    GPT_ENDPOINT: "https://contoso.openai.azure.com",
    GPT_API_KEY: "",
    GPT_AUTH_MODE: "api-key",
    GPT_DEPLOYMENT: "gpt-5.4",
    MAI_ENDPOINT: "",
    MAI_API_KEY: ""
  });

  assert.equal(config.requestedMode, "live");
  assert.equal(config.defaultMode, "mock");
  assert.deepEqual(publicStatus(config), {
    defaultMode: "mock",
    requestedMode: "live",
    gpt: { configured: false, deployment: "gpt-5.4", authMode: "api-key" },
    mai: { configured: false, model: "MAI-Image-2.5", authMode: "api-key" }
  });
});

test("Microsoft Entra mode is configured without an API key", () => {
  const config = getConfig({
    MODEL_MODE: "live",
    GPT_ENDPOINT: "https://contoso.openai.azure.com",
    GPT_AUTH_MODE: "entra",
    GPT_API_KEY: "",
    GPT_DEPLOYMENT: "gpt-5.4",
    MAI_ENDPOINT: "https://contoso.services.ai.azure.com",
    MAI_AUTH_MODE: "entra",
    MAI_API_KEY: ""
  });

  assert.equal(config.gpt.configured, true);
  assert.equal(config.gpt.authMode, "entra");
  assert.equal(config.defaultMode, "live");
  assert.equal(config.mai.configured, true);
  assert.equal(config.mai.authMode, "entra");
});
