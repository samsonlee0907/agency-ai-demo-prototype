import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FLOORPLAN_FIXTURE_KINDS,
  pointInPolygon,
  validateFloorplanIndex,
  distanceToPolygon,
  loadFloorplanIndexes
} from "../src/floorplan-index.js";
import { routeBetweenRegions } from "../src/floorplan-routing.js";

const indexPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "floorplan-index",
  "meridian-house-level-12.json"
);

function readIndex() {
  return JSON.parse(readFileSync(indexPath, "utf8"));
}

test("the committed Level 12 index validates and records its provenance", () => {
  const index = readIndex();
  assert.deepEqual(validateFloorplanIndex(index), []);
  assert.equal(index.assetId, "floorplan-meridian-level-12");
  assert.ok(index.provenance?.method, "index must record how it was segmented");
  assert.ok(index.fixtures.length > 0, "index must carry individual fixtures");
  for (const fixture of index.fixtures) {
    assert.ok(FLOORPLAN_FIXTURE_KINDS.includes(fixture.kind));
    assert.equal(typeof fixture.at.x, "number");
    assert.equal(typeof fixture.at.y, "number");
  }
});

test("region facts are derived from fixture geometry, not authored", () => {
  const index = readIndex();
  for (const region of index.regions) {
    assert.equal(region.facts, undefined, `${region.id} must not hard-code facts`);
  }

  const [catalog] = loadFloorplanIndexes();
  const factsFor = (id) => catalog.regions.find((region) => region.id === id).facts;

  assert.deepEqual(factsFor("toilets_gents"), {
    genderDesignation: "gents",
    enclosedCubicleCount: 2,
    totalFixtureCount: 8,
    basinCount: 2,
    urinalCount: 4
  });
  assert.deepEqual(factsFor("toilets_ladies"), {
    genderDesignation: "ladies",
    enclosedCubicleCount: 3,
    totalFixtureCount: 7,
    basinCount: 4,
    urinalCount: 0
  });

  const gents = factsFor("toilets_gents");
  const ladies = factsFor("toilets_ladies");
  const block = factsFor("toilets");
  const restaurant = factsFor("restaurant");
  assert.equal(block.enclosedCubicleCount, gents.enclosedCubicleCount + ladies.enclosedCubicleCount);
  assert.equal(block.basinCount, gents.basinCount + ladies.basinCount);
  assert.equal(block.urinalCount, gents.urinalCount + ladies.urinalCount);
  assert.equal(block.totalFixtureCount, gents.totalFixtureCount + ladies.totalFixtureCount);
  assert.deepEqual(restaurant, {
    diningTableCount: 15,
    diningSeatCount: 60
  });
});

test("every fixture sits inside exactly one leaf room", () => {
  const index = readIndex();
  const parentIds = new Set(index.regions.map((region) => region.parentId).filter(Boolean));
  const leaves = index.regions.filter((region) => !parentIds.has(region.id));
  for (const fixture of index.fixtures) {
    const containing = leaves.filter((region) => pointInPolygon(fixture.at, region.polygon));
    assert.equal(containing.length, 1, `${fixture.id} matched ${containing.length} leaf rooms`);
  }
});

test("the validator rejects fixtures and children that fall outside their room", () => {
  const strayFixture = readIndex();
  strayFixture.fixtures[0].at = { x: 5, y: 5 };
  assert.ok(
    validateFloorplanIndex(strayFixture).some((error) => error.includes("exactly one leaf region")),
    "a fixture outside every room must be rejected"
  );

  const strayChild = readIndex();
  const child = strayChild.regions.find((region) => region.id === "toilets_ladies");
  child.polygon = child.polygon.map((point) => ({ x: point.x + 400, y: point.y }));
  assert.ok(
    validateFloorplanIndex(strayChild).some((error) => error.includes("not contained by its parent")),
    "a child room outside its parent must be rejected"
  );

  const duplicated = readIndex();
  duplicated.fixtures.push({ ...duplicated.fixtures[0] });
  assert.ok(validateFloorplanIndex(duplicated).some((error) => error.includes("Duplicate fixture ID")));

  const tableWithoutSeats = readIndex();
  const restaurantTable = tableWithoutSeats.fixtures.find((fixture) => fixture.kind === "dining_table");
  delete restaurantTable.seatCount;
  assert.ok(validateFloorplanIndex(tableWithoutSeats).some((error) => error.includes("must have a seat count")));

  const badRelation = readIndex();
  badRelation.relations.push({ type: "adjacent", regionIds: ["toilets", "nowhere"] });
  assert.ok(validateFloorplanIndex(badRelation).some((error) => error.includes("two known regions")));
});

test("every circulation link sits on a threshold shared by both rooms", () => {
  const index = readIndex();
  const regionsById = new Map(index.regions.map((region) => [region.id, region]));
  const links = index.relations.filter((relation) => relation.type === "connects");
  assert.ok(links.length >= 12, "the plan draws many doorways");
  for (const link of links) {
    for (const id of link.regionIds) {
      assert.ok(
        distanceToPolygon(link.at, regionsById.get(id).polygon) <= 20,
        `${link.regionIds.join("/")} must touch ${id}`
      );
    }
  }
  // Every region the assistant can route to has to be reachable from the graph.
  const connected = new Set(links.flatMap((link) => link.regionIds));
  for (const region of index.regions) {
    assert.ok(connected.has(region.id), `${region.id} has no drawn circulation link`);
  }
});

test("the validator rejects doorways that do not touch the rooms they claim to join", () => {
  const floating = readIndex();
  const link = floating.relations.find((relation) => relation.type === "connects");
  link.at = { x: link.at.x + 300, y: link.at.y };
  assert.ok(validateFloorplanIndex(floating).some((error) => /threshold/.test(error)));

  const duplicated = readIndex();
  const original = duplicated.relations.find((relation) => relation.type === "connects");
  duplicated.relations.push({ ...original, regionIds: [...original.regionIds].reverse() });
  assert.ok(validateFloorplanIndex(duplicated).some((error) => /Duplicate connection/.test(error)));
});

test("routes only ever step between rooms the plan connects", () => {
  const catalog = loadFloorplanIndexes()[0];
  const linked = new Set(catalog.connections.map((link) => [...link.regionIds].sort().join(":")));
  const route = routeBetweenRegions(catalog, "toilets_gents", "kitchen");
  assert.deepEqual(route.regionIds, ["toilets_gents", "toilets", "passage", "verandah", "restaurant", "reception", "kitchen"]);
  for (const leg of route.legs) {
    assert.ok(linked.has([leg.fromRegionId, leg.toRegionId].sort().join(":")), `${leg.fromRegionId} to ${leg.toRegionId}`);
  }
  // Waypoints are the reviewed doorways, never a straight line through walls.
  const doorways = new Set(catalog.connections.map((link) => `${link.at.x},${link.at.y}`));
  for (const point of route.points.slice(1, -1)) {
    assert.ok(doorways.has(`${point.x},${point.y}`), "every intermediate point is a drawn doorway");
  }
  assert.equal(routeBetweenRegions(catalog, "kitchen", "kitchen"), null);
});
