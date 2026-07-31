import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = await Promise.all([
  readFile(new URL("../infra/main.bicep", import.meta.url), "utf8"),
  readFile(new URL("../infra/resources.bicep", import.meta.url), "utf8"),
  readFile(new URL("../scripts/provision-azure.ps1", import.meta.url), "utf8")
]);
const [mainBicep, resourcesBicep, provisionScript] = files;
const infrastructure = files.join("\n");

test("infrastructure pins the validated model versions and managed identity", () => {
  assert.match(mainBicep, /gptModelVersion string = '2026-07-09'/);
  assert.match(mainBicep, /maiModelVersion string = '2026-06-02'/);
  assert.match(resourcesBicep, /name: 'gpt-5\.6-terra'/);
  assert.match(resourcesBicep, /name: 'MAI-Image-2\.5'/);
  assert.match(resourcesBicep, /type: 'SystemAssigned'/);
  assert.match(resourcesBicep, /disableLocalAuth: true/);
  assert.match(resourcesBicep, /a97b65f3-24c7-4388-baec-2e87135dc908/);
});

test("infrastructure does not target the original production resources", () => {
  assert.doesNotMatch(infrastructure, /aurelia-agency-ai-c5f4fc/);
  assert.doesNotMatch(infrastructure, /aurelia-agency-c5f4fc/);
  assert.doesNotMatch(infrastructure, /rg-aurelia-agency-ai-swc/);
});

test("provisioning avoids plaintext and API-key model configuration", () => {
  assert.match(mainBicep, /@secure\(\)[\s\S]*param portalCredentialHash string/);
  assert.match(mainBicep, /@secure\(\)[\s\S]*param portalSessionSecret string/);
  assert.match(resourcesBicep, /name: 'GPT_AUTH_MODE'\s+value: 'entra'/);
  assert.match(resourcesBicep, /name: 'MAI_AUTH_MODE'\s+value: 'entra'/);
  assert.match(provisionScript, /Read-Host "Portal password" -AsSecureString/);
  assert.match(provisionScript, /Portal password must contain at least 12 characters/);
  assert.match(provisionScript, /does not carry the expected Aurelia demo ownership tags/);
  assert.match(provisionScript, /The worktree is dirty/);
  assert.match(provisionScript, /What-if does not change provider state/);
  assert.match(provisionScript, /GetTempFileName/);
  assert.match(provisionScript, /Remove-Item -LiteralPath \$parameterPath/);
});
