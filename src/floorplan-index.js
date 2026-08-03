import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const indexDirectory = join(dirname(fileURLToPath(import.meta.url)), "floorplan-index");

export const FLOORPLAN_FIXTURE_KINDS = Object.freeze(["wc", "urinal", "basin"]);

export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current, current += 1) {
    const a = polygon[current];
    const b = polygon[previous];
    const straddles = (a.y > point.y) !== (b.y > point.y);
    if (straddles && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

function fixturesInside(region, fixtures) {
  return fixtures.filter((fixture) => pointInPolygon(fixture.at, region.polygon));
}

// Counts are never authored in the index: they are computed by testing which
// fixture points fall inside which region polygon.
function deriveFacts(region, fixtures) {
  const inside = fixturesInside(region, fixtures);
  if (!inside.length && !region.genderDesignation) return null;
  const countOf = (kind) => inside.filter((fixture) => fixture.kind === kind).length;
  return {
    genderDesignation: region.genderDesignation ?? null,
    enclosedCubicleCount: countOf("wc"),
    totalFixtureCount: inside.length,
    basinCount: countOf("basin"),
    urinalCount: countOf("urinal")
  };
}

export function validateFloorplanIndex(index) {
  const errors = [];
  const regions = Array.isArray(index?.regions) ? index.regions : [];
  const fixtures = Array.isArray(index?.fixtures) ? index.fixtures : [];
  const regionsById = new Map(regions.map((region) => [region.id, region]));
  const parentIds = new Set(regions.map((region) => region.parentId).filter(Boolean));

  for (const region of regions) {
    if (!region.parentId) continue;
    const parent = regionsById.get(region.parentId);
    if (!parent) {
      errors.push(`Region ${region.id} references unknown parent ${region.parentId}.`);
      continue;
    }
    if (!region.polygon.every((point) => pointInPolygon(point, parent.polygon))) {
      errors.push(`Region ${region.id} is not contained by its parent ${region.parentId}.`);
    }
  }

  const fixtureIds = new Set();
  const leafRegions = regions.filter((region) => !parentIds.has(region.id));
  for (const fixture of fixtures) {
    if (fixtureIds.has(fixture.id)) errors.push(`Duplicate fixture ID: ${fixture.id}.`);
    fixtureIds.add(fixture.id);
    if (!FLOORPLAN_FIXTURE_KINDS.includes(fixture.kind)) {
      errors.push(`Fixture ${fixture.id} has an unsupported kind: ${fixture.kind}.`);
    }
    const containing = leafRegions.filter((region) => pointInPolygon(fixture.at, region.polygon));
    if (containing.length !== 1) {
      errors.push(`Fixture ${fixture.id} must sit inside exactly one leaf region but matched ${containing.length}.`);
    }
  }

  for (const relation of index?.relations || []) {
    if (!Array.isArray(relation.regionIds)
      || relation.regionIds.length !== 2
      || relation.regionIds.some((id) => !regionsById.has(id))) {
      errors.push("Relations must reference two known regions.");
    }
  }
  return errors;
}

function toCatalog(index) {
  const fixtures = index.fixtures || [];
  return {
    id: index.id,
    assetId: index.assetId,
    source: index.source,
    scale: index.scale,
    regions: index.regions.map((region) => {
      const facts = deriveFacts(region, fixtures);
      return {
        id: region.id,
        label: region.label,
        proseName: region.proseName || region.label,
        type: region.type,
        ...(region.parentId ? { parentId: region.parentId } : {}),
        ...(region.areaSqm === undefined ? {} : { areaSqm: region.areaSqm }),
        description: region.description,
        ...(facts ? { facts } : {}),
        polygon: region.polygon,
        labelAnchor: region.labelAnchor,
        ...(region.axis ? { axis: region.axis } : {}),
        ...(region.directionRegionIds ? { directionRegionIds: region.directionRegionIds } : {})
      };
    }),
    fixtures,
    adjacencies: (index.relations || [])
      .filter((relation) => relation.type === "adjacent")
      .map((relation) => ({ regionIds: relation.regionIds, boundary: relation.boundary }))
  };
}

export function loadFloorplanIndexes() {
  return readdirSync(indexDirectory)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => {
      const index = JSON.parse(readFileSync(join(indexDirectory, name), "utf8"));
      const errors = validateFloorplanIndex(index);
      if (errors.length) throw new Error(`Invalid floorplan index ${name}: ${errors.join(" ")}`);
      return toCatalog(index);
    });
}
