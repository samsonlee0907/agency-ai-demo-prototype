import test from "node:test";
import assert from "node:assert/strict";
import {
  FLOORPLAN_REGION_IDS,
  findFloorplanRegionCatalog,
  floorplanCatalogForModel,
  groundFloorplanAnnotation,
  validateFloorplanRegionCatalog
} from "../src/floorplan-regions.js";
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
