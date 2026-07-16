import test from "node:test";
import assert from "node:assert/strict";
import { generateMarketing, matchProperties, qualifyLead } from "../src/mock-services.js";

const brief = {
  location: "Double Bay",
  budget: 4800000,
  beds: 4,
  propertyType: "House",
  priorities: "Quiet street, strong schools, outdoor entertaining and water views."
};

test("property matching is deterministic, ranked and grounded in listing IDs", () => {
  const first = matchProperties(brief);
  const second = matchProperties(brief);

  assert.deepEqual(first, second);
  assert.equal(first.results[0].id, "harbour-house");
  assert.ok(first.results.every((result, index, all) => index === 0 || all[index - 1].score >= result.score));
  assert.ok(first.results.every((result) => result.tradeoffs.length > 0));
});

test("marketing mock uses selected property and campaign settings", () => {
  const campaign = generateMarketing("atelier-residence", {
    audience: "Design-conscious professionals",
    channel: "Instagram",
    tone: "Refined editorial"
  });

  assert.match(campaign.headline, /Atelier Residence/);
  assert.match(campaign.imagePrompt, /Surry Hills/);
  assert.equal(campaign.highlights.length, 4);
});

test("lead qualification returns a stable actionable fixture", () => {
  const result = qualifyLead("lead-amanda");
  assert.equal(result.score, 94);
  assert.equal(result.grade, "Priority");
  assert.match(result.nextAction, /Call within 15 minutes/);
  assert.match(result.followUpDraft, /Saturday/);
});
