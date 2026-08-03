import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FLOORPLAN_FIXTURE_KINDS,
  pointInPolygon,
  validateFloorplanIndex,
  loadFloorplanIndexes
} from "../src/floorplan-index.js";

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
  assert.equal(block.enclosedCubicleCount, gents.enclosedCubicleCount + ladies.enclosedCubicleCount);
  assert.equal(block.basinCount, gents.basinCount + ladies.basinCount);
  assert.equal(block.urinalCount, gents.urinalCount + ladies.urinalCount);
  assert.equal(block.totalFixtureCount, gents.totalFixtureCount + ladies.totalFixtureCount);
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

  const badRelation = readIndex();
  badRelation.relations.push({ type: "adjacent", regionIds: ["toilets", "nowhere"] });
  assert.ok(validateFloorplanIndex(badRelation).some((error) => error.includes("two known regions")));
});
