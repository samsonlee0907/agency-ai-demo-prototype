import test from "node:test";
import assert from "node:assert/strict";
import { startServer } from "../server.js";

test("serves status, bootstrap data and deterministic matching", async (context) => {
  const server = startServer(0);
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const statusResponse = await fetch(`${base}/api/status`);
  assert.equal(statusResponse.status, 200);
  assert.equal(statusResponse.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.equal(statusResponse.headers.get("content-security-policy"), "frame-ancestors 'self'");
  const status = await statusResponse.json();
  assert.ok(["mock", "live"].includes(status.defaultMode));
  assert.equal("apiKey" in status.gpt, false);
  assert.equal("endpoint" in status.realtime, false);
  assert.equal("clientSecret" in status.realtime, false);

  const settingsResponse = await fetch(`${base}/api/settings`);
  assert.equal(settingsResponse.status, 200);
  const settings = await settingsResponse.json();
  assert.equal(settings.gpt.identifier, process.env.GPT_DEPLOYMENT || "gpt-5.6-terra");
  assert.ok(["api-key", "entra"].includes(settings.gpt.authMode));
  assert.ok(["api-key", "entra"].includes(settings.mai.authMode));
  assert.equal("apiKey" in settings.gpt, false);

  if (!status.realtime.configured) {
    const realtimeResponse = await fetch(`${base}/api/realtime/client-secret`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buildingId: "building-meridian" })
    });
    assert.equal(realtimeResponse.status, 503);
  }

  const invalidSettingsResponse = await fetch(`${base}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      defaultMode: "live",
      gpt: { endpoint: "http://example.com/openai/v1/", identifier: "gpt-5.6-terra", authMode: "entra", apiKey: "" },
      mai: { endpoint: "", identifier: "MAI-Image-2.5", authMode: "entra", apiKey: "" }
    })
  });
  assert.equal(invalidSettingsResponse.status, 400);
  const settingsAfterInvalidUpdate = await fetch(`${base}/api/settings`).then((response) => response.json());
  assert.equal(settingsAfterInvalidUpdate.gpt.endpoint, settings.gpt.endpoint);

  const bootstrapResponse = await fetch(`${base}/api/bootstrap`);
  const bootstrap = await bootstrapResponse.json();
  assert.equal(bootstrap.listings.length, 6);
  assert.equal(bootstrap.leads.length, 4);
  assert.equal(bootstrap.leaseDocuments.length, 3);
  assert.equal(bootstrap.buildingProfiles.length, 3);
  assert.equal(bootstrap.maintenanceAssets.length, 4);
  assert.equal(bootstrap.esgPortfolio.buildings.length, 3);

  const pdfResponse = await fetch(`${base}/assets/documents/meridian-house-office-lease-demo.pdf`, { method: "HEAD" });
  assert.equal(pdfResponse.status, 200);
  assert.equal(pdfResponse.headers.get("content-type"), "application/pdf");
  assert.equal(pdfResponse.headers.get("x-frame-options"), "SAMEORIGIN");

  const matchResponse = await fetch(`${base}/api/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "mock",
      brief: {
        location: "Double Bay",
        budget: 4800000,
        beds: 4,
        propertyType: "House",
        priorities: "schools, quiet street and water views"
      }
    })
  });
  assert.equal(matchResponse.status, 200);
  const matches = await matchResponse.json();
  assert.equal(matches.results[0].id, "harbour-house");

  const marketingResponse = await fetch(`${base}/api/marketing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "mock",
      propertyId: "harbour-house",
      settings: {
        audience: "Established families",
        channel: "Digital campaign",
        tone: "Refined editorial"
      }
    })
  });
  assert.equal(marketingResponse.status, 200);
  const marketing = await marketingResponse.json();
  assert.equal(marketing.campaignConcept, "Harbour, held lightly");
  assert.match(marketing.callToAction, /private inspection/i);

  const editedPrompt = "Use brighter late-afternoon light and a warmer editorial colour grade.";
  const imageResponse = await fetch(`${base}/api/image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "mock",
      propertyId: "harbour-house",
      prompt: editedPrompt
    })
  });
  assert.equal(imageResponse.status, 200);
  const image = await imageResponse.json();
  assert.equal(image.generated, false);
  assert.equal(image.prompt, editedPrompt);

  const valuationResponse = await fetch(`${base}/api/valuation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "mock",
      propertyId: "harbour-house",
      settings: { purpose: "Sale appraisal", condition: "Renovated", valuerNotes: "" }
    })
  });
  assert.equal(valuationResponse.status, 200);
  const valuation = await valuationResponse.json();
  assert.ok(valuation.valueLow < valuation.valueHigh);

  const leaseResponse = await fetch(`${base}/api/lease`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "mock", leaseId: "lease-meridian" })
  });
  assert.equal(leaseResponse.status, 200);
  const lease = await leaseResponse.json();
  assert.equal(lease.parties.tenant, "Northstar Advisory Pty Ltd");

  const assistantResponse = await fetch(`${base}/api/assistant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "mock",
      buildingId: "building-meridian",
      message: "The air conditioning is too warm",
      history: []
    })
  });
  assert.equal(assistantResponse.status, 200);
  const assistant = await assistantResponse.json();
  assert.equal(assistant.workOrder.created, true);
  assert.equal(assistant.category, "Maintenance");

  const maintenanceResponse = await fetch(`${base}/api/maintenance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "mock", assetId: "asset-meridian-chiller-02", horizon: 30 })
  });
  assert.equal(maintenanceResponse.status, 200);
  const maintenance = await maintenanceResponse.json();
  assert.equal(maintenance.failureRisk, "High");
  assert.equal(maintenance.workOrder.created, true);

  const esgResponse = await fetch(`${base}/api/esg`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "mock",
      settings: {
        scope: "portfolio",
        reportingPeriod: "FY2026 · 1 July 2025–30 June 2026",
        framework: "GRESB review draft",
        focus: "Balanced portfolio"
      }
    })
  });
  assert.equal(esgResponse.status, 200);
  const esg = await esgResponse.json();
  assert.equal(esg.buildings.length, 3);
  assert.equal(esg.assuranceStatus, "Draft");
  assert.ok(esg.metrics.every((metric) => Number.isFinite(metric.value)));

  const invalidPeriodResponse = await fetch(`${base}/api/esg`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "mock",
      settings: {
        scope: "portfolio",
        reportingPeriod: "FY2035",
        framework: "GRESB review draft",
        focus: "Balanced portfolio"
      }
    })
  });
  assert.equal(invalidPeriodResponse.status, 400);
});
