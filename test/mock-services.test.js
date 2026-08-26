import test from "node:test";
import assert from "node:assert/strict";
import { findBuilding } from "../src/data.js";
import { abstractLease, analyseMaintenance, answerTenant, buildEsgEvidence, createEsgReport, draftValuation, generateMarketing, matchProperties, qualifyLead } from "../src/mock-services.js";

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

  assert.equal(campaign.campaignConcept, "Volume with warmth");
  assert.equal(campaign.headline, "Space, with a point of view");
  assert.match(campaign.strapline, /Surry Hills/);
  assert.match(campaign.description, /warehouse past/i);
  assert.match(campaign.callToAction, /private inspection/i);
  assert.match(campaign.imagePrompt, /Surry Hills/);
  assert.match(campaign.imagePrompt, /preserving the exact property/i);
  assert.match(campaign.imagePrompt, /clearly visible before-and-after transformation/i);
  assert.match(campaign.imagePrompt, /warm late-afternoon light/i);
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
  assert.equal(result.floorplan.included, false);
});

test("tenant assistant attaches only the approved floorplan to relevant Meridian questions", () => {
  const result = answerTenant("building-meridian", "Where are the toilets on the Level 12 floor plan?");
  assert.equal(result.category, "Building information");
  assert.equal(result.floorplan.included, true);
  assert.equal(result.floorplan.assetId, "floorplan-meridian-level-12");
  assert.match(result.reply, /static plan|posted building signage/i);

  const unrelated = answerTenant("building-meridian", "What are the concierge hours?");
  assert.equal(unrelated.floorplan.included, false);
  const otherBuilding = answerTenant("building-arcade", "Show me the floor plan");
  assert.equal(otherBuilding.floorplan.included, false);
});

test("tenant assistant Mock mode returns question-specific grounded annotations", () => {
  const location = answerTenant("building-meridian", "Where is the restaurant relative to the central stairs?");
  assert.equal(location.floorplan.annotation.relationship.type, "location");
  assert.equal(location.floorplan.annotation.marker.kind, "direction-arrow");
  assert.deepEqual(location.floorplan.annotation.regions.map((region) => region.id), ["restaurant", "central_stairs"]);
  assert.ok(location.floorplan.annotation.regions.every((region) => region.polygon.length >= 3));

  const adjacency = answerTenant("building-meridian", "Which 64.2 m² office is closer to the restaurant because it is adjacent?");
  assert.equal(adjacency.floorplan.annotation.relationship.type, "adjacency");
  assert.equal(adjacency.floorplan.annotation.marker.kind, "shared-boundary");

  const transition = answerTenant("building-meridian", "Which verandah transition runs toward the restaurant?");
  assert.equal(transition.floorplan.annotation.marker.kind, "axis-arrow");
  assert.match(transition.floorplan.annotation.relationship.label, /not a route/);
});

test("tenant assistant Mock mode annotates count and size evidence deterministically", () => {
  const count = answerTenant("building-meridian", "How many separately labelled office spaces are shown?");
  const size = answerTenant("building-meridian", "Which labelled office is the largest?");
  assert.equal(count.floorplan.annotation.relationship.type, "count");
  assert.equal(count.floorplan.annotation.regions.filter((region) => region.role === "primary").length, 3);
  assert.equal(size.floorplan.annotation.relationship.type, "size");
  assert.equal(size.floorplan.annotation.regions[0].id, "office_114_4");
  assert.equal(size.floorplan.annotation.regions[0].areaSqm, 114.4);
});

test("tenant assistant returns labelled-area planning estimates for restaurant and office capacity questions", () => {
  const restaurant = answerTenant("building-meridian", "What capacity can the restaurant contain?");
  const offices = answerTenant("building-meridian", "How many people can the office area hold?");
  const reference = answerTenant(
    "building-meridian",
    "If the restaurant seating plan holds 120 people, how many can the largest office hold at the same average area per person?"
  );
  const balcony = answerTenant(
    "building-meridian",
    "what about balcony?",
    [{ role: "user", content: "What capacity can the restaurant contain?" }]
  );

  assert.match(restaurant.reply, /15 reviewed four-seat dining tables, for 60 table seats/);
  assert.match(restaurant.reply, /not a fire-code occupancy limit or certified building capacity/i);
  assert.deepEqual(restaurant.floorplan.annotation.regions.map((region) => region.id), ["restaurant"]);
  assert.match(offices.reply, /West office 64\.2 m².*5–8 people/);
  assert.match(offices.reply, /Largest office 114\.4 m².*9–14 people/);
  assert.deepEqual(offices.floorplan.annotation.regions.map((region) => region.id), [
    "office_west_64_2",
    "office_east_64_2",
    "office_114_4"
  ]);
  assert.match(reference.reply, /60 table seats.*about 33 people; that is not an office-layout recommendation/i);
  assert.match(reference.reply, /takes precedence over the supplied 120-seat assumption/i);
  assert.match(balcony.reply, /4 reviewed four-seat dining tables, for 16 table seats/);
  assert.deepEqual(balcony.floorplan.annotation.regions.map((region) => region.id), ["balcony"]);
});

test("tenant assistant resolves a follow-up pronoun from the conversation", () => {
  const history = [
    { role: "user", content: "where is the gents washroom?" },
    { role: "assistant", content: "The Gents washroom is the western room of the Toilets block." }
  ];

  const route = answerTenant("building-meridian", "how to reach it from the kitchen?", history);
  assert.deepEqual(
    route.floorplan.annotation.regions.map((region) => region.id),
    ["toilets_gents", "kitchen", "reception", "restaurant", "verandah", "passage", "toilets"]
  );
  assert.equal(route.floorplan.annotation.relationship.type, "route");
  assert.match(route.reply, /^From the Kitchen, head north through the service door into Reception/);

  const count = answerTenant("building-meridian", "how many cubicles does it have?", history);
  assert.deepEqual(count.floorplan.annotation.regions.map((region) => region.id), ["toilets_gents"]);
  assert.match(count.reply, /Gents washroom shows 2 enclosed toilet cubicles/);

  // Without a conversation there is no antecedent, so nothing may be invented.
  const bare = answerTenant("building-meridian", "how do I get there?", []);
  assert.equal(bare.floorplan.annotation, null);
});

test("tenant assistant grounds toilet variants and safe wayfinding overlays", () => {
  const toiletScenarios = [
    ["How many toilets does the ladies washroom have?", /Ladies washroom shows 3 enclosed toilet cubicles/, ["toilets_ladies"]],
    ["How many cubicles are in the ladies washroom?", /Ladies washroom shows 3 enclosed toilet cubicles/, ["toilets_ladies"]],
    ["How many toilets are in the women's bathroom?", /Ladies washroom shows 3 enclosed toilet cubicles/, ["toilets_ladies"]],
    ["How many toilets are in the gents?", /Gents washroom shows 2 enclosed toilet cubicles/, ["toilets_gents"]],
    ["How many washrooms are shown on Level 12?", /two washrooms/, ["toilets"]],
    ["Where is the ladies washroom?", /Ladies washroom is the eastern room of the Toilets block/, ["toilets_ladies", "passage"]],
    ["Is the ladies washroom next to the passage?", /Ladies washroom is the eastern room of the Toilets block/, ["toilets_ladies", "passage"]],
    ["How many sinks are in the ladies washroom?", /Ladies washroom shows 4 wash basins/, ["toilets_ladies"]],
    ["How many urinals are shown?", /Toilets block shows 4 urinals/, ["toilets"]],
    ["Where is the men's washroom?", /Gents washroom is the western room of the Toilets block/, ["toilets_gents", "toilets_ladies"]],
    ["Where is the gents?", /Gents washroom is the western room of the Toilets block/, ["toilets_gents", "toilets_ladies"]],
    ["How many fixtures are in the toilets?", /15 plumbing fixtures/, ["toilets"]],
    ["What is next to the toilets?", /sits immediately west of the labelled Passage/, ["toilets", "passage"]],
    ["Is there a separate ladies washroom?", /two separate washrooms inside the Toilets block/, ["toilets_ladies", "passage"]]
  ];
  for (const [message, replyPattern, regionIds] of toiletScenarios) {
    const result = answerTenant("building-meridian", message);
    assert.match(result.reply, replyPattern, message);
    assert.deepEqual(result.floorplan.annotation.regions.map((region) => region.id), regionIds, message);
  }

  const wayfindingScenarios = [
    ["How do I get from reception to the restaurant?", ["restaurant", "reception"], "route"],
    ["Show me the way from the central stairs to the restaurant.", ["restaurant", "central_stairs", "verandah"], "route"],
    ["Navigate me from the toilets to reception.", ["reception", "toilets", "passage", "verandah", "restaurant"], "route"],
    ["Show a route from the stairs to the restaurant.", ["restaurant", "central_stairs", "verandah"], "route"],
    ["how to get to the male's washroom from the kitchen?", ["toilets_gents", "kitchen", "reception", "restaurant", "verandah", "passage", "toilets"], "route"],
    ["How do I get to the ladies room from reception?", ["toilets_ladies", "reception", "restaurant", "verandah", "passage"], "route"],
    ["Where is the kitchen?", ["kitchen", "reception"], "location"],
    ["How do I get to the toilets?", ["toilets", "passage"], "location"]
  ];
  for (const [message, regionIds, relationship] of wayfindingScenarios) {
    const result = answerTenant("building-meridian", message);
    assert.equal(result.floorplan.annotation.relationship.type, relationship, message);
    assert.deepEqual(result.floorplan.annotation.regions.map((region) => region.id), regionIds, message);
    assert.match(result.floorplan.annotation.safetyNote, /not .*(routing|verified)/i, message);
  }
});

test("tenant assistant uses the plain plan for generic display requests", () => {
  const broad = answerTenant("building-meridian", "Show me the Level 12 floor plan and main amenities");
  const namedFeatures = answerTenant("building-meridian", "Show me the floor plan with the restaurant and stairs");
  assert.equal(broad.floorplan.included, true);
  assert.equal(broad.floorplan.annotation, null);
  assert.equal(namedFeatures.floorplan.annotation, null);
  assert.match(broad.reply, /without a highlight/i);
});

test("tenant assistant suggestions are ready-to-send tenant confirmations", () => {
  const prompts = [
    "I can smell gas",
    "There is a water leak",
    "The air conditioning is hot",
    "I lost my access pass",
    "I have a question about rent",
    "Tell me about the building"
  ];
  const suggestions = prompts.flatMap((prompt) => answerTenant("building-meridian", prompt).suggestions);
  assert.ok(suggestions.every((suggestion) => !suggestion.endsWith("?")));
});

test("tenant assistant does not repeat a selected quick reply", () => {
  const selected = "I need after-hours air conditioning.";
  const result = answerTenant(
    "building-meridian",
    selected,
    [{ role: "user", content: "The air conditioning is too warm." }]
  );
  assert.equal(result.suggestions.includes(selected), false);
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

test("predictive maintenance analysis is deterministic and grounded in source signals", () => {
  const first = analyseMaintenance("asset-meridian-chiller-02", 30);
  const second = analyseMaintenance("asset-meridian-chiller-02", 30);
  assert.deepEqual(first, second);
  assert.equal(first.failureRisk, "High");
  assert.equal(first.workOrder.created, true);
  assert.deepEqual(first.evidence.map((item) => item.signalId), [
    "compressor-vibration",
    "condenser-approach",
    "power-draw"
  ]);
  assert.equal(first.energyImpact.excessKwhPerDay, 186);
});

test("healthy monitored equipment does not create a reactive work order", () => {
  const result = analyseMaintenance("asset-meridian-lift-03", 90);
  assert.equal(result.failureRisk, "Low");
  assert.equal(result.workOrder.created, false);
  assert.ok(result.healthScore > 80);
});

test("critical multi-signal telemetry produces a reachable critical risk state", () => {
  const result = analyseMaintenance("asset-southbank-dock-07", 7);
  assert.equal(result.failureRisk, "Critical");
  assert.ok(result.healthScore <= 32);
  assert.ok(result.evidence.filter((item) => item.severity === "Critical").length >= 2);
});

test("configured warning limits drive severity and horizon changes forecast risk", () => {
  const arcade = analyseMaintenance("asset-arcade-ahu-03", 30);
  const shortHorizon = analyseMaintenance("asset-meridian-chiller-02", 7);
  const standardHorizon = analyseMaintenance("asset-meridian-chiller-02", 30);
  assert.equal(arcade.evidence.find((item) => item.signalId === "filter-pressure").severity, "Elevated");
  assert.equal(shortHorizon.failureRisk, "Moderate");
  assert.equal(standardHorizon.failureRisk, "High");
  assert.match(shortHorizon.forecastWindow, /not forecast inside the next 7 days/i);
});

test("ESG evidence calculates stable portfolio metrics from source records", () => {
  const settings = {
    scope: "portfolio",
    reportingPeriod: "FY2026 · 1 July 2025–30 June 2026",
    framework: "GRESB review draft",
    focus: "Balanced portfolio"
  };
  const evidence = buildEsgEvidence(settings);
  const report = createEsgReport(settings);
  assert.equal(evidence.buildings.length, 3);
  assert.equal(evidence.metrics.length, 6);
  assert.deepEqual(report.metrics.map((metric) => metric.value), evidence.metrics.map((metric) => metric.value));
  assert.equal(report.assuranceStatus, "Draft");
  assert.match(report.caveats.join(" "), /fictional/i);
});

test("single-building ESG evidence excludes unrelated portfolio gaps", () => {
  const settings = {
    scope: "building-meridian",
    reportingPeriod: "FY2026 · 1 July 2025–30 June 2026",
    framework: "Internal net-zero review",
    focus: "Resource efficiency"
  };
  const evidence = buildEsgEvidence(settings);
  const report = createEsgReport(settings);
  const water = evidence.disclosures.find((item) => item.topic === "Water stewardship");
  const energy = evidence.disclosures.find((item) => item.topic === "Energy and emissions");
  assert.equal(evidence.buildings.length, 1);
  assert.equal(water.status, "Ready");
  assert.equal(water.gap, "");
  assert.match(energy.evidence, /Meridian House/);
  assert.doesNotMatch(JSON.stringify(evidence.disclosures), /all three assets/i);
  assert.doesNotMatch(JSON.stringify(report.actions), /industrial water-submeter/i);
  assert.doesNotMatch(report.executiveSummary, /water stewardship records require confirmation/i);
  assert.ok(evidence.metrics.slice(2).every((metric) => metric.changePercent !== 0));
});

test("ESG report priorities respond to the selected review focus", () => {
  const base = {
    scope: "portfolio",
    reportingPeriod: "FY2026 · 1 July 2025–30 June 2026",
    framework: "GRESB review draft"
  };
  const carbon = createEsgReport({ ...base, focus: "Carbon & energy" });
  const resources = createEsgReport({ ...base, focus: "Resource efficiency" });
  assert.notEqual(carbon.actions[0].action, resources.actions[0].action);
  assert.match(carbon.executiveSummary, /plant efficiency/i);
  assert.match(resources.executiveSummary, /water, waste/i);
});
