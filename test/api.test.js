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
  const status = await statusResponse.json();
  assert.equal(status.defaultMode, "mock");
  assert.equal("apiKey" in status.gpt, false);

  const bootstrapResponse = await fetch(`${base}/api/bootstrap`);
  const bootstrap = await bootstrapResponse.json();
  assert.equal(bootstrap.listings.length, 6);
  assert.equal(bootstrap.leads.length, 4);

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
});
