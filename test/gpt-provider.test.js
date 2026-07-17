import test from "node:test";
import assert from "node:assert/strict";
import { findMaintenanceAsset } from "../src/operations-data.js";
import { analyseMaintenance, buildEsgEvidence } from "../src/mock-services.js";
import {
  ensureEmergencyGuidance,
  groundEsgReport,
  groundMaintenanceAnalysis,
  groundValuationComparables,
  ModelResponseError
} from "../src/providers/gpt.js";
import { ASSISTANT_REPLY_MAX_LENGTH, assistantOutputSchema } from "../src/schemas.js";

const sources = [
  { id: "comp-one", address: "1 Sample Street", area: "Sydney", saleDate: "1 Jul 2026", salePrice: 1000000 },
  { id: "comp-two", address: "2 Sample Street", area: "Sydney", saleDate: "2 Jul 2026", salePrice: 1100000 },
  { id: "comp-three", address: "3 Sample Street", area: "Sydney", saleDate: "3 Jul 2026", salePrice: 1200000 }
];

function comparable(id) {
  return {
    id,
    address: "fabricated",
    saleDate: "fabricated",
    salePrice: 1,
    adjustedValue: 1150000,
    weight: 33,
    adjustments: ["Comparable evidence"],
    rationale: "Evidence-led comparable rationale."
  };
}

test("valuation grounding restores immutable source facts", () => {
  const result = groundValuationComparables(
    { comparables: sources.map((source) => comparable(source.id)) },
    sources
  );
  assert.equal(result.comparables[0].address, "1 Sample Street, Sydney");
  assert.equal(result.comparables[0].saleDate, "1 Jul 2026");
  assert.equal(result.comparables[0].salePrice, 1000000);
});

test("valuation grounding rejects duplicate comparable IDs", () => {
  assert.throws(
    () => groundValuationComparables(
      { comparables: [comparable("comp-one"), comparable("comp-one"), comparable("comp-two")] },
      sources
    ),
    ModelResponseError
  );
});

test("maintenance grounding restores source readings and rejects invented signal IDs", () => {
  const asset = findMaintenanceAsset("asset-meridian-chiller-02");
  const baseline = analyseMaintenance(asset.id, 30);
  const result = {
    healthScore: 99,
    failureRisk: "Low",
    confidence: 1,
    predictedIssue: "Fabricated",
    forecastWindow: "Fabricated",
    evidence: asset.signals.map((signal) => ({
      signalId: signal.id,
      label: "Fabricated",
      reading: "Fabricated",
      severity: "Elevated",
      interpretation: "A grounded interpretation of the supplied trend."
    })),
    energyImpact: { excessKwhPerDay: 1, costPerMonth: 1, annualEmissionsTonnes: 1, narrative: "Grounded source impact narrative." }
  };
  const grounded = groundMaintenanceAnalysis(result, asset, baseline);
  assert.equal(grounded.evidence[0].reading, "6.8 mm/s RMS");
  assert.equal(grounded.energyImpact.excessKwhPerDay, 186);
  assert.equal(grounded.confidence, 97);
  assert.equal(grounded.failureRisk, "High");
  assert.throws(
    () => groundMaintenanceAnalysis({ ...result, evidence: [{ ...result.evidence[0], signalId: "invented" }, ...result.evidence.slice(1)] }, asset, baseline),
    ModelResponseError
  );
});

test("ESG grounding restores calculated metrics and requires the complete evidence set", () => {
  const evidence = buildEsgEvidence({
    scope: "portfolio",
    reportingPeriod: "FY2026",
    framework: "GRESB review draft",
    focus: "Balanced portfolio"
  });

  const result = {
    scope: "Fabricated",
    reportingPeriod: "Fabricated",
    framework: "Fabricated",
    assuranceStatus: "Review ready",
    metrics: evidence.metrics.map((metric) => ({ ...metric, value: 999, commentary: "A grounded interpretation of this calculated metric." })),
    buildings: evidence.buildings.map((building) => ({ ...building, energyIntensity: 999, insight: "A grounded building performance interpretation." })),
    disclosures: evidence.disclosures.map((disclosure) => ({ ...disclosure, summary: "A grounded disclosure readiness interpretation." })),
    methodology: "Fabricated"
  };
  const grounded = groundEsgReport(result, evidence);
  assert.equal(grounded.metrics[0].value, evidence.metrics[0].value);
  assert.equal(grounded.buildings[0].energyIntensity, evidence.buildings[0].energyIntensity);
  assert.equal(grounded.assuranceStatus, "Draft");
  assert.throws(
    () => groundEsgReport({ ...result, metrics: result.metrics.slice(1) }, evidence),
    ModelResponseError
  );
});

test("emergency assistant responses always include safe 000 guidance", () => {
  const response = {
    reply: "Do not touch the outlet. Move away from the affected area and contact building security.",
    category: "Emergency",
    urgency: "Emergency",
    recommendedAction: "Keep clear of the affected area.",
    citations: ["Emergency procedures"],
    workOrder: { created: true, reference: "WO-1", summary: "Water near outlet", nextUpdate: "Security will respond." },
    suggestions: ["Move to a safe area"]
  };

  const guarded = ensureEmergencyGuidance(response);
  assert.match(guarded.reply, /\b000\b/);
  assert.equal(assistantOutputSchema.safeParse(guarded).success, true);
  assert.equal(ensureEmergencyGuidance(guarded), guarded);

  const maximumReply = ensureEmergencyGuidance({
    ...response,
    reply: "x".repeat(ASSISTANT_REPLY_MAX_LENGTH)
  });
  assert.equal(maximumReply.reply.length <= ASSISTANT_REPLY_MAX_LENGTH, true);
  assert.equal(assistantOutputSchema.safeParse(maximumReply).success, true);
});
