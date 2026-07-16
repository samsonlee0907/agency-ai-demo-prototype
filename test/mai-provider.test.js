import test from "node:test";
import assert from "node:assert/strict";
import { buildMaiEditUrl, buildMaiGenerationUrl, extractMaiImage } from "../src/providers/mai-image.js";

test("builds the fixed MAI generation route", () => {
  assert.equal(
    buildMaiGenerationUrl("https://contoso.services.ai.azure.com/"),
    "https://contoso.services.ai.azure.com/mai/v1/images/generations"
  );
});

test("builds the fixed MAI image edit route", () => {
  assert.equal(
    buildMaiEditUrl("https://contoso.services.ai.azure.com/"),
    "https://contoso.services.ai.azure.com/mai/v1/images/edits"
  );
});

test("extracts the documented MAI base64 response shape", () => {
  assert.equal(extractMaiImage({ data: [{ b64_json: "abc123" }] }), "abc123");
  assert.throws(() => extractMaiImage({ data: [] }), /data\[0\]\.b64_json/);
});
