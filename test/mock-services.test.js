import test from "node:test";
import assert from "node:assert/strict";
import { findBuilding } from "../src/data.js";
import { abstractLease, answerTenant, draftValuation, generateMarketing, matchProperties, qualifyLead } from "../src/mock-services.js";

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
  assert.match(campaign.imagePrompt, /Preserve the exact property/);
  assert.equal(campaign.highlights.length, 4);
});

test("lead qualification returns a stable actionable fixture", () => {
  const result = qualifyLead("lead-amanda");
  assert.equal(result.score, 94);
  assert.equal(result.grade, "Priority");
  assert.match(result.nextAction, /Call within 15 minutes/);
  assert.match(result.followUpDraft, /Saturday/);
});

test("valuation mock produces an ordered range grounded in known comparables", () => {
  const result = draftValuation("harbour-house", {
    purpose: "Sale appraisal",
    condition: "Renovated",
    valuerNotes: "Assume vacant possession"
  });
  assert.ok(result.valueLow <= result.valueMid && result.valueMid <= result.valueHigh);
  assert.equal(result.comparables.length, 4);
  assert.ok(result.comparables.every((comparable) => comparable.id.startsWith("comp-")));
  assert.match(result.signOff, /qualified valuer/i);
});

test("lease abstraction mock surfaces material conflicts and dates", () => {
  const result = abstractLease("lease-logistics");
  assert.equal(result.risks[0].severity, "High");
  assert.match(result.risks[0].title, /Security conflict/);
  assert.ok(result.criticalDates.length >= 3);
});

test("tenant assistant triages maintenance and creates a grounded work order", () => {
  const result = answerTenant("building-meridian", "There is water leaking near a power outlet");
  assert.equal(result.category, "Maintenance");
  assert.equal(result.urgency, "Priority");
  assert.equal(result.workOrder.created, true);
  assert.match(result.recommendedAction, /electrics/i);
});

test("tenant assistant citations come from the selected building context", () => {
  const building = findBuilding("building-arcade");
  const result = answerTenant(building.id, "I lost my access pass");
  const allowedCitations = new Set([
    ...building.knowledge.map((article) => article.title),
    building.serviceHours,
    building.emergencyContact,
    `${building.name} service hours`
  ]);
  assert.ok(result.citations.every((citation) => allowedCitations.has(citation)));
  assert.doesNotMatch(result.reply, /concierge.*photo identification/i);
});

test("tenant emergency citations stay within the selected building context", () => {
  const building = findBuilding("building-meridian");
  const result = answerTenant(building.id, "I can smell gas");
  const knownTitles = new Set(building.knowledge.map((article) => article.title));
  assert.equal(result.urgency, "Emergency");
  assert.ok(knownTitles.has(result.citations[0]));
  assert.equal(result.citations[1], building.emergencyContact);
});

test("photo identification questions are not misclassified as HVAC", () => {
  const result = answerTenant("building-meridian", "What photo identification is required for a temporary pass?");
  assert.equal(result.category, "Access & security");
  assert.equal(result.workOrder.created, false);
});

test("maintenance timing is not invented for buildings without an SLA", () => {
  const leak = answerTenant("building-southbank", "There is a water leak");
  const hvac = answerTenant("building-arcade", "The air conditioning is hot");
  assert.equal(leak.workOrder.nextUpdate, "Facilities will confirm attendance timing");
  assert.equal(hvac.workOrder.nextUpdate, "Facilities will confirm attendance timing");
});
