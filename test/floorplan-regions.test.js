import test from "node:test";
import assert from "node:assert/strict";
import {
  FLOORPLAN_REGION_IDS,
  findFloorplanRegionCatalog,
  floorplanAnnotationFallbackForMessage,
  floorplanCatalogForModel,
  groundFloorplanAnnotation,
  groundFloorplanReply,
  validateFloorplanRegionCatalog
} from "../src/floorplan-regions.js";
import { floorplanAnnotationRequested } from "../src/floorplan-assets.js";
import {
  assistantJsonSchema,
  floorplanAnnotationIntentSchema
} from "../src/schemas.js";

const assetId = "floorplan-meridian-level-12";

function selection(regionId, role = "primary") {
  return { regionId, role, reason: `${regionId} is relevant to this answer.` };
}

test("Meridian region catalog contains unique valid non-intersecting polygons", () => {
  const catalog = findFloorplanRegionCatalog(assetId);
  assert.equal(catalog.id, "meridian-house-level-12");
  assert.deepEqual(catalog.source, { width: 2256, height: 1304 });
  assert.equal(validateFloorplanRegionCatalog(catalog).length, 0);
  assert.equal(new Set(catalog.regions.map((region) => region.id)).size, FLOORPLAN_REGION_IDS.length);
  assert.deepEqual(catalog.regions.map((region) => region.id), FLOORPLAN_REGION_IDS);
});

test("catalog validation rejects self-intersecting region geometry", () => {
  const catalog = structuredClone(findFloorplanRegionCatalog(assetId));
  catalog.regions[0].polygon = [
    { x: 100, y: 100 },
    { x: 200, y: 200 },
    { x: 100, y: 200 },
    { x: 200, y: 100 }
  ];
  assert.ok(validateFloorplanRegionCatalog(catalog).some((error) => /self-intersecting/.test(error)));
});

test("model catalog exposes semantics without any renderer geometry", () => {
  const modelCatalog = floorplanCatalogForModel(assetId);
  const serialized = JSON.stringify(modelCatalog);
  assert.equal(modelCatalog.regions.length, FLOORPLAN_REGION_IDS.length);
  assert.doesNotMatch(serialized, /polygon|labelAnchor|boundary|axis|coordinates/i);
  const toilets = modelCatalog.regions.find((region) => region.id === "toilets");
  assert.deepEqual(toilets.facts, {
    genderDesignation: null,
    enclosedCubicleCount: 5,
    totalFixtureCount: null,
    basinCount: null,
    urinalCount: null
  });
});

test("floorplan intent recognizes washroom and wayfinding wording without annotating generic display", () => {
  for (const message of [
    "How many cubicles are in the ladies washroom?",
    "Where is the men's washroom?",
    "How do I get from reception to the restaurant?",
    "Show a route from the stairs to the restaurant.",
    "Navigate me from the toilets to reception."
  ]) {
    assert.equal(floorplanAnnotationRequested(message), true, message);
  }
  assert.equal(floorplanAnnotationRequested("Show me the Level 12 floor plan"), false);
});

test("toilet and wayfinding questions have authoritative fallback intents", () => {
  const scenarios = [
    ["how many toilets does the ladies washroom have?", ["toilets"], "count"],
    ["How many cubicles are in the ladies washroom?", ["toilets"], "count"],
    ["How many sinks are in the ladies washroom?", ["toilets", "passage"], "location"],
    ["How many urinals are shown?", ["toilets", "passage"], "location"],
    ["Where is the men's washroom?", ["toilets", "passage"], "location"],
    ["Is the ladies washroom next to the passage?", ["toilets", "passage"], "adjacency"],
    ["Where's the stairs?", ["central_stairs", "storage_west", "storage_east"], "location"],
    ["Where is the restaurant relative to the central stairs?", ["restaurant", "central_stairs"], "direction"],
    ["How do I get from reception to the restaurant?", ["restaurant", "reception"], "direction"],
    ["Navigate me from the toilets to reception.", ["reception", "toilets"], "direction"],
    ["Show a route from the stairs to the restaurant.", ["restaurant", "central_stairs"], "direction"],
    ["How do I get to the toilets?", ["toilets", "passage"], "location"]
  ];
  for (const [message, regionIds, relationship] of scenarios) {
    const intent = floorplanAnnotationFallbackForMessage(message);
    assert.deepEqual(intent.selections.map((item) => item.regionId), regionIds, message);
    assert.equal(intent.relationship.type, relationship, message);
    assert.doesNotThrow(() => groundFloorplanAnnotation(assetId, intent), message);
  }
  assert.equal(floorplanAnnotationFallbackForMessage("Show me the Level 12 floor plan"), null);
  assert.equal(floorplanAnnotationFallbackForMessage("Where is the nearest lift?"), null);
});

test("toilet replies preserve verified cubicle evidence and facility uncertainty", () => {
  const cubicles = groundFloorplanReply(
    "How many cubicles are in the ladies washroom?",
    "Model supplied answer"
  );
  assert.match(cubicles, /5 enclosed cubicles/);
  assert.match(cubicles, /does not designate separate ladies or men's facilities/);

  const sinks = groundFloorplanReply(
    "How many sinks are in the ladies washroom?",
    "Model supplied answer"
  );
  assert.match(sinks, /does not provide an authoritative count/);
  assert.doesNotMatch(sinks, /\b5\b/);

  const washrooms = groundFloorplanReply(
    "How many washrooms are shown on Level 12?",
    "Model supplied answer"
  );
  assert.match(washrooms, /one labelled toilet area/);
});

test("strict annotation schemas accept IDs and reject raw geometry", () => {
  const valid = {
    selections: [selection("restaurant"), selection("central_stairs", "secondary")],
    relationship: {
      type: "location",
      fromRegionId: "central_stairs",
      toRegionId: "restaurant",
      direction: "northeast"
    }
  };
  assert.equal(floorplanAnnotationIntentSchema.safeParse(valid).success, true);
  assert.equal(floorplanAnnotationIntentSchema.safeParse({
    ...valid,
    selections: [{ ...valid.selections[0], polygon: [{ x: 1, y: 2 }] }, valid.selections[1]]
  }).success, false);
  assert.equal(floorplanAnnotationIntentSchema.safeParse({
    ...valid,
    selections: [selection("invented-region")]
  }).success, false);
  assert.doesNotMatch(JSON.stringify(assistantJsonSchema.properties.floorplan), /polygon|coordinates|svg|path/i);
});

test("grounding substitutes authoritative region labels and source-pixel geometry", () => {
  const annotation = groundFloorplanAnnotation(assetId, {
    selections: [
      { ...selection("restaurant"), reason: "Model reason retained." },
      selection("central_stairs", "secondary")
    ],
    relationship: {
      type: "location",
      fromRegionId: "central_stairs",
      toRegionId: "restaurant",
      direction: "northeast"
    }
  });
  assert.equal(annotation.width, 2256);
  assert.equal(annotation.height, 1304);
  assert.equal(annotation.regions[0].label, "Restaurant");
  assert.equal(annotation.regions[0].reason, "Model reason retained.");
  assert.deepEqual(annotation.regions[0].polygon[0], { x: 1554, y: 310 });
  assert.equal(annotation.marker.kind, "direction-arrow");
  assert.match(annotation.relationship.label, /Restaurant is northeast of Central stairs/);
});

test("grounding rejects unknown and duplicate region selections", () => {
  assert.throws(
    () => groundFloorplanAnnotation(assetId, {
      selections: [selection("invented-region")],
      relationship: { type: "count", fromRegionId: null, toRegionId: null, direction: null }
    }),
    /Unknown floorplan region/
  );
  assert.throws(
    () => groundFloorplanAnnotation(assetId, {
      selections: [selection("restaurant"), selection("restaurant", "secondary")],
      relationship: { type: "count", fromRegionId: null, toRegionId: null, direction: null }
    }),
    /Duplicate floorplan region/
  );
});

test("grounding discards irrelevant endpoints for count and size relationships", () => {
  for (const type of ["count", "size"]) {
    const annotation = groundFloorplanAnnotation(assetId, {
      selections: [selection("toilets")],
      relationship: {
        type,
        fromRegionId: "toilets",
        toRegionId: null,
        direction: "west"
      }
    });
    assert.deepEqual(annotation.relationship, {
      type,
      fromRegionId: null,
      toRegionId: null,
      direction: null,
      label: type === "count" ? "Highlighted region for visual count" : "Highlighted size comparison"
    });
    assert.equal(annotation.regions[0].id, "toilets");
    assert.equal(annotation.marker, null);
  }
});

test("grounding derives omitted directions from authoritative region geometry", () => {
  const annotation = groundFloorplanAnnotation(assetId, {
    selections: [selection("restaurant"), selection("central_stairs", "secondary")],
    relationship: {
      type: "location",
      fromRegionId: "central_stairs",
      toRegionId: "restaurant",
      direction: null
    }
  });
  assert.equal(annotation.relationship.direction, "northeast");
  assert.match(annotation.relationship.label, /Restaurant is northeast of Central stairs/);
  assert.equal(annotation.marker.kind, "direction-arrow");
});

test("grounding uses only approved adjacency and transition markers", () => {
  const adjacency = groundFloorplanAnnotation(assetId, {
    selections: [selection("office_east_64_2"), selection("restaurant", "secondary")],
    relationship: {
      type: "adjacency",
      fromRegionId: "office_east_64_2",
      toRegionId: "restaurant",
      direction: null
    }
  });
  assert.equal(adjacency.marker.kind, "shared-boundary");

  const toiletAdjacency = groundFloorplanAnnotation(
    assetId,
    floorplanAnnotationFallbackForMessage("Is the ladies washroom next to the passage?")
  );
  assert.equal(toiletAdjacency.marker.kind, "shared-boundary");

  const transition = groundFloorplanAnnotation(assetId, {
    selections: [
      selection("verandah"),
      selection("office_114_4", "context"),
      selection("restaurant", "secondary")
    ],
    relationship: {
      type: "direction",
      fromRegionId: "office_114_4",
      toRegionId: "restaurant",
      direction: "east"
    }
  });
  assert.equal(transition.marker.kind, "axis-arrow");
  assert.match(transition.relationship.label, /not a route/);

  assert.throws(
    () => groundFloorplanAnnotation(assetId, {
      selections: [selection("toilets"), selection("kitchen", "secondary")],
      relationship: {
        type: "adjacency",
        fromRegionId: "toilets",
        toRegionId: "kitchen",
        direction: null
      }
    }),
    /approved adjacency/
  );
});
