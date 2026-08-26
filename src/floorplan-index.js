import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const indexDirectory = join(dirname(fileURLToPath(import.meta.url)), "floorplan-index");

export const FLOORPLAN_FIXTURE_KINDS = Object.freeze(["wc", "urinal", "basin", "dining_table"]);

// Doorway points are read off the raster by eye, so a small tolerance is allowed when
// checking that a threshold really touches both of the regions it joins.
const CONNECTION_TOLERANCE = 20;

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

function distanceToSegment(point, a, b) {
  const spanX = b.x - a.x;
  const spanY = b.y - a.y;
  const lengthSquared = spanX * spanX + spanY * spanY;
  const ratio = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((point.x - a.x) * spanX + (point.y - a.y) * spanY) / lengthSquared));
  return Math.hypot(point.x - (a.x + ratio * spanX), point.y - (a.y + ratio * spanY));
}

export function distanceToPolygon(point, polygon) {
  if (pointInPolygon(point, polygon)) return 0;
  return Math.min(...polygon.map((vertex, index) => distanceToSegment(point, vertex, polygon[(index + 1) % polygon.length])));
}

// Counts are never authored in the index: they are computed by testing which
// fixture points fall inside which region polygon.
function deriveFacts(region, fixtures) {
  const inside = fixturesInside(region, fixtures);
  if (!inside.length && !region.genderDesignation) return null;
  const countOf = (kind) => inside.filter((fixture) => fixture.kind === kind).length;
  const diningTables = inside.filter((fixture) => fixture.kind === "dining_table");
  if (diningTables.length) {
    return {
      diningTableCount: diningTables.length,
      diningSeatCount: diningTables.reduce((total, fixture) => total + fixture.seatCount, 0)
    };
  }
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
    if (fixture.kind === "dining_table"
      && (!Number.isInteger(fixture.seatCount) || fixture.seatCount < 1 || fixture.seatCount > 12)) {
      errors.push(`Dining table ${fixture.id} must have a seat count from 1 to 12.`);
    }
    if (fixture.kind !== "dining_table" && fixture.seatCount !== undefined) {
      errors.push(`Only a dining table may declare a seat count: ${fixture.id}.`);
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
      continue;
    }
    if (relation.type !== "connects") continue;
    if (relation.regionIds[0] === relation.regionIds[1]) {
      errors.push("A connects relation must join two different regions.");
      continue;
    }
    // A doorway is only trustworthy if it really sits on the threshold between the two
    // regions it claims to join, so the route search can never cross a drawn wall.
    for (const id of relation.regionIds) {
      if (distanceToPolygon(relation.at, regionsById.get(id).polygon) > CONNECTION_TOLERANCE) {
        errors.push(`Connection ${relation.regionIds.join("/")} is not on the threshold of ${id}.`);
      }
    }
  }
  const connectionKeys = new Set();
  for (const relation of (index?.relations || []).filter((item) => item.type === "connects")) {
    const key = [...relation.regionIds].sort().join(":");
    if (connectionKeys.has(key)) errors.push(`Duplicate connection between ${key}.`);
    connectionKeys.add(key);
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
        ...(region.prosePhrase ? { prosePhrase: region.prosePhrase } : {}),
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
      .map((relation) => ({ regionIds: relation.regionIds, boundary: relation.boundary })),
    connections: (index.relations || [])
      .filter((relation) => relation.type === "connects")
      .map((relation) => ({ regionIds: relation.regionIds, via: relation.via || "opening", at: relation.at }))
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
