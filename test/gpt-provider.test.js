import test from "node:test";
import assert from "node:assert/strict";
import { findMaintenanceAsset } from "../src/operations-data.js";
import {
  abstractLease as mockAbstractLease,
  analyseMaintenance,
  buildEsgEvidence,
  draftValuation as mockDraftValuation
} from "../src/mock-services.js";
import {
  createGptProvider,
  ensureEmergencyGuidance,
  groundEsgReport,
  groundMaintenanceAnalysis,
  groundTenantFloorplan,
  groundValuationComparables,
  ModelResponseError,
  normalizeAssistantFollowUps
} from "../src/providers/gpt.js";
import { comparableSales, findBuilding, findListing } from "../src/data.js";
import { findFloorplanAsset } from "../src/floorplan-assets.js";
import {
  ASSISTANT_REPLY_MAX_LENGTH,
  assistantOutputSchema,
  maintenanceModelOutputSchema,
  maintenanceOutputSchema
} from "../src/schemas.js";

const sources = [
  { id: "comp-one", address: "1 Sample Street", area: "Sydney", saleDate: "1 Jul 2026", salePrice: 1000000 },
  { id: "comp-two", address: "2 Sample Street", area: "Sydney", saleDate: "2 Jul 2026", salePrice: 1100000 },
  { id: "comp-three", address: "3 Sample Street", area: "Sydney", saleDate: "3 Jul 2026", salePrice: 1200000 }
];

function assistantResponse(floorplan = {
  included: false,
  assetId: "",
  caption: "",
  annotation: null
}) {
  return {
    reply: "Here is a grounded response based on the supplied building information.",
    category: "Building information",
    urgency: "Routine",
    recommendedAction: "Review the supplied building information.",
    citations: ["Meridian House Level 12 floor plan"],
    workOrder: { created: false, reference: "", summary: "No work order required", nextUpdate: "Not applicable" },
    floorplan,
    suggestions: []
  };
}

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

function liveProvider(client) {
  return createGptProvider({
    configured: true,
    authMode: "api-key",
    apiKey: "test",
    endpoint: "https://example.openai.azure.com/openai/v1/",
    deployment: "gpt-5.6-terra"
  }, { client });
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

test("valuation retries one malformed model draft before returning a valid response", async () => {
  const valid = mockDraftValuation("harbour-house", {
    purpose: "Pre-listing appraisal",
    condition: "Renovated",
    valuerNotes: ""
  });
  const requests = [];
  const client = {
    responses: {
      create: async (request) => {
        requests.push(request);
        const response = structuredClone(valid);
        if (requests.length === 1) response.comparables[2].adjustedValue = 0;
        return { output_text: JSON.stringify(response) };
      }
    }
  };

  const result = await liveProvider(client).draftValuation(
    findListing("harbour-house"),
    { purpose: "Pre-listing appraisal", condition: "Renovated", valuerNotes: "" },
    comparableSales
  );

  assert.equal(requests.length, 2);
  assert.match(requests[1].input[0].content[0].text, /prior draft was rejected/i);
  assert.equal(result.comparables[2].adjustedValue, valid.comparables[2].adjustedValue);
});

test("lease retries one incomplete model draft before returning a valid abstraction", async () => {
  const valid = mockAbstractLease("lease-meridian");
  const requests = [];
  const client = {
    responses: {
      create: async (request) => {
        requests.push(request);
        const response = structuredClone(valid);
        if (requests.length === 1) response.reviewNote = "";
        return { output_text: JSON.stringify(response) };
      }
    }
  };

  const result = await liveProvider(client).abstractLease({
    id: "lease-meridian",
    title: valid.documentTitle,
    content: "A supplied fictional lease source."
  });

  assert.equal(requests.length, 2);
  assert.match(requests[1].input[0].content[0].text, /reviewNote/i);
  assert.equal(result.reviewNote, valid.reviewNote);
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

test("maintenance model evidence contains only the signal identifier and interpretation", () => {
  const asset = findMaintenanceAsset("asset-meridian-chiller-02");
  const baseline = analyseMaintenance(asset.id, 30);
  const draft = {
    ...baseline,
    evidence: baseline.evidence.map((item) => ({
      signalId: item.signalId,
      interpretation: "This approved signal supports the deterministic maintenance assessment."
    }))
  };

  assert.equal(maintenanceModelOutputSchema.safeParse(draft).success, true);
  assert.equal(maintenanceModelOutputSchema.safeParse({
    ...draft,
    evidence: [{ ...draft.evidence[0], reading: "This untrusted display value must not be model output." }, ...draft.evidence.slice(1)]
  }).success, false);
  assert.equal(maintenanceOutputSchema.safeParse(groundMaintenanceAnalysis(draft, asset, baseline)).success, true);
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
    floorplan: {
      included: false,
      assetId: "",
      title: "",
      floor: "",
      imageUrl: "",
      alt: "",
      caption: "",
      annotation: null
    },
    suggestions: ["I am in a safe area."]
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

test("tenant provider sends approved floorplan bytes only for relevant image-grounded calls", async () => {
  const requests = [];
  const floorplan = findFloorplanAsset("floorplan-meridian-level-12");
  const client = {
    responses: {
      create: async (request) => {
        requests.push(request);
        const hasImage = request.input[1].content.some((item) => item.type === "input_image");
        const modelInput = JSON.parse(request.input[1].content[0].text);
        const plainPlan = /^show me the level 12 floor plan$/i.test(modelInput.message);
        return {
          output_text: JSON.stringify(assistantResponse(hasImage ? {
            included: true,
            assetId: floorplan.id,
            caption: plainPlan
              ? floorplan.description
              : "The restaurant and stairs are highlighted for comparison.",
            annotation: plainPlan ? null : {
              selections: [
                { regionId: "restaurant", role: "primary", reason: "This is the requested destination." },
                { regionId: "central_stairs", role: "secondary", reason: "This is the spatial reference." }
              ],
              relationship: {
                type: "location",
                fromRegionId: "central_stairs",
                toRegionId: "restaurant",
                direction: "northeast"
              }
            }
          } : undefined))
        };
      }
    }
  };
  const provider = createGptProvider({
    configured: true,
    authMode: "api-key",
    apiKey: "test",
    endpoint: "https://example.openai.azure.com/openai/v1/",
    deployment: "gpt-5.6-terra"
  }, { client });
  const building = findBuilding("building-meridian");
  const dataUrl = "data:image/jpeg;base64,/9j/2Q==";

  const grounded = await provider.respondToTenant(
    building,
    "Where is the restaurant relative to the central stairs?",
    [],
    { asset: floorplan, dataUrl }
  );
  const imageInput = requests[0].input[1].content.find((item) => item.type === "input_image");
  assert.deepEqual(imageInput, { type: "input_image", image_url: dataUrl, detail: "original" });
  assert.equal(grounded.floorplan.imageUrl, floorplan.imageUrl);
  assert.equal(grounded.floorplan.title, floorplan.title);
  assert.deepEqual(
    grounded.floorplan.annotation.regions.map((region) => region.id).sort(),
    ["central_stairs", "restaurant"]
  );
  assert.equal(
    grounded.floorplan.annotation.regions.find((region) => region.id === "restaurant").label,
    "Restaurant"
  );
  assert.equal(grounded.floorplan.annotation.marker.kind, "direction-arrow");
  const modelInput = JSON.parse(requests[0].input[1].content[0].text);
  assert.equal(modelInput.floorplanCatalog.id, "meridian-house-level-12");
  assert.equal(modelInput.annotationAllowed, true);
  assert.doesNotMatch(JSON.stringify(modelInput.floorplanCatalog), /polygon|coordinates|axis|boundary/i);

  const plain = await provider.respondToTenant(
    building,
    "Show me the Level 12 floor plan",
    [],
    { asset: floorplan, dataUrl }
  );
  assert.equal(plain.floorplan.included, true);
  assert.equal(plain.floorplan.annotation, null);
  assert.equal(plain.floorplan.caption, floorplan.description);
  const plainModelInput = JSON.parse(requests[1].input[1].content[0].text);
  assert.equal(plainModelInput.annotationAllowed, true);
  assert.equal(plainModelInput.floorplanCatalog.id, "meridian-house-level-12");
  const tenantInstructions = requests[1].input[0].content[0].text;
  assert.match(tenantInstructions, /broad request .* is an overview/i);
  assert.match(tenantInstructions, /at most two concise sentences/i);
  assert.match(tenantInstructions, /keep the original plan unannotated/i);
  assert.match(tenantInstructions, /do not enumerate individual toilet fixtures/i);
  assert.match(tenantInstructions, /route safety disclaimer .* precedence over brevity/i);

  const textOnly = await provider.respondToTenant(building, "What are the concierge hours?", []);
  assert.equal(requests[2].input[1].content.some((item) => item.type === "input_image"), false);
  assert.equal(textOnly.floorplan.included, false);
});

test("tenant provider lets the model resolve an indirect reverse route while the server draws it", async () => {
  const requests = [];
  const floorplan = findFloorplanAsset("floorplan-meridian-level-12");
  const modelResponse = assistantResponse({
    included: true,
    assetId: floorplan.id,
    caption: "The return route from the restaurant to the Gents washroom is highlighted.",
    annotation: {
      selections: [
        { regionId: "toilets_gents", role: "primary", reason: "This is the requested destination." },
        { regionId: "restaurant", role: "secondary", reason: "This is the requested starting point." }
      ],
      relationship: {
        type: "route",
        fromRegionId: "restaurant",
        toRegionId: "toilets_gents",
        direction: null
      }
    }
  });
  modelResponse.reply = "From the Restaurant, head southwest into the Verandah, continue west through the Passage, then north into the Toilets block and west into the Gents washroom. This route is not checked for step-free access, door locking or emergency egress.";
  const client = {
    responses: {
      create: async (request) => {
        requests.push(request);
        return { output_text: JSON.stringify(modelResponse) };
      }
    }
  };
  const provider = createGptProvider({
    configured: true,
    authMode: "api-key",
    apiKey: "test",
    endpoint: "https://example.openai.azure.com/openai/v1/",
    deployment: "gpt-5.6-terra"
  }, { client });

  const result = await provider.respondToTenant(
    findBuilding("building-meridian"),
    "the other way round, from restaurant to gents washroom?",
    [
      { role: "user", content: "How do I get from the gents washroom to the restaurant?" },
      { role: "assistant", content: "Go through the Toilets block, Passage and Verandah to the Restaurant." }
    ],
    { asset: floorplan, dataUrl: "data:image/jpeg;base64,/9j/2Q==" }
  );

  assert.equal(result.floorplan.annotation.relationship.type, "route");
  assert.equal(result.floorplan.annotation.relationship.fromRegionId, "restaurant");
  assert.equal(result.floorplan.annotation.relationship.toRegionId, "toilets_gents");
  assert.deepEqual(
    result.floorplan.annotation.regions.map((region) => region.id),
    ["toilets_gents", "restaurant", "verandah", "passage", "toilets"]
  );
  assert.equal(result.floorplan.annotation.marker.kind, "route-path");
  assert.equal(result.reply, modelResponse.reply);
  const modelInput = JSON.parse(requests[0].input[1].content[0].text);
  assert.equal(modelInput.annotationAllowed, true);
  assert.equal(Object.hasOwn(modelInput, "floorplanRoute"), false);
  assert.equal(modelInput.history.length, 2);
});

test("tenant floorplan grounding rejects unknown model asset identifiers", () => {
  const floorplan = findFloorplanAsset("floorplan-meridian-level-12");
  assert.throws(
    () => groundTenantFloorplan(
      assistantResponse({
        included: true,
        assetId: "invented-floorplan",
        caption: "Invented",
        annotation: null
      }),
      { asset: floorplan, dataUrl: "data:image/jpeg;base64,/9j/2Q==" }
    ),
    ModelResponseError
  );
});

test("tenant floorplan grounding honors exclusion of a carried-over image", () => {
  const floorplan = findFloorplanAsset("floorplan-meridian-level-12");
  const grounded = groundTenantFloorplan(
    assistantResponse({
      included: false,
      assetId: "",
      caption: "",
      annotation: null
    }),
    { asset: floorplan, dataUrl: "data:image/jpeg;base64,/9j/2Q==" }
  );
  assert.deepEqual(grounded.floorplan, {
    included: false,
    assetId: "",
    title: "",
    floor: "",
    imageUrl: "",
    alt: "",
    caption: "",
    annotation: null
  });
});

test("tenant floorplan grounding uses an authoritative fallback when visual intent is null", () => {
  const floorplan = findFloorplanAsset("floorplan-meridian-level-12");
  const fallbackIntent = {
    selections: [
      { regionId: "toilets", role: "primary", reason: "This is the requested washroom area." }
    ],
    relationship: {
      type: "count",
      fromRegionId: null,
      toRegionId: null,
      direction: null
    }
  };
  const grounded = groundTenantFloorplan(
    assistantResponse({
      included: true,
      assetId: floorplan.id,
      caption: "The washroom area is highlighted.",
      annotation: null
    }),
    { asset: floorplan, dataUrl: "data:image/jpeg;base64,/9j/2Q==" },
    true,
    fallbackIntent
  );
  assert.deepEqual(grounded.floorplan.annotation.regions.map((region) => region.id), ["toilets"]);
  assert.equal(grounded.floorplan.annotation.relationship.type, "count");
});

test("tenant floorplan grounding prefers valid model selections over phrase fallbacks", () => {
  const floorplan = findFloorplanAsset("floorplan-meridian-level-12");
  const fallbackIntent = {
    selections: [
      { regionId: "toilets", role: "primary", reason: "This is the requested toilet block." },
      { regionId: "passage", role: "secondary", reason: "This is the adjacent passage." }
    ],
    relationship: {
      type: "adjacency",
      fromRegionId: "toilets",
      toRegionId: "passage",
      direction: null
    }
  };
  const grounded = groundTenantFloorplan(
    assistantResponse({
      included: true,
      assetId: floorplan.id,
      caption: "The toilet block and passage are highlighted.",
      annotation: {
        selections: [
          { regionId: "toilets", role: "primary", reason: "This is the requested toilet block." },
          { regionId: "restaurant", role: "secondary", reason: "This extra region was not requested." }
        ],
        relationship: {
          type: "location",
          fromRegionId: "toilets",
          toRegionId: "restaurant",
          direction: "northeast"
        }
      }
    }),
    { asset: floorplan, dataUrl: "data:image/jpeg;base64,/9j/2Q==" },
    true,
    fallbackIntent
  );
  assert.deepEqual(grounded.floorplan.annotation.regions.map((region) => region.id), [
    "toilets",
    "restaurant"
  ]);
  assert.equal(grounded.floorplan.annotation.marker.kind, "direction-arrow");
});

test("tenant floorplan grounding rejects unknown model region identifiers", () => {
  const floorplan = findFloorplanAsset("floorplan-meridian-level-12");
  assert.throws(
    () => groundTenantFloorplan(
      assistantResponse({
        included: true,
        assetId: floorplan.id,
        caption: "Invented",
        annotation: {
          selections: [
            { regionId: "invented-region", role: "primary", reason: "Invented region." }
          ],
          relationship: {
            type: "count",
            fromRegionId: null,
            toRegionId: null,
            direction: null
          }
        }
      }),
      { asset: floorplan, dataUrl: "data:image/jpeg;base64,/9j/2Q==" }
    ),
    ModelResponseError
  );
});

test("assistant qualification questions stay with Aurelia", () => {
  const result = normalizeAssistantFollowUps({
    reply: "I have created an urgent work order.",
    suggestions: [
      "Has building security been contacted?",
      "Building security has been contacted.",
      "Which level is affected?",
      "I can confirm the affected floor and area.",
      "I need temporary access."
    ]
  }, [{ role: "user", content: "Building security has been contacted." }]);

  assert.match(result.reply, /Has building security been contacted\?/);
  assert.match(result.reply, /Which level is affected\?/);
  assert.deepEqual(result.suggestions, ["I need temporary access."]);
});
