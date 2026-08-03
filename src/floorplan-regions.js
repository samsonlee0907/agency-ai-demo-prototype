import { loadFloorplanIndexes } from "./floorplan-index.js";
import { routeBetweenRegions, floorplanRegionIsConnected, circulationForModel } from "./floorplan-routing.js";

export const FLOORPLAN_REGION_SCALE = 1000;

// Regions, fixtures and relations are loaded from reviewed floorplan index
// artifacts under src/floorplan-index. No plan fact is authored in code: region
// facts such as cubicle, basin and urinal counts are derived from fixture points.
const indexCatalogs = loadFloorplanIndexes();

export const FLOORPLAN_REGION_IDS = Object.freeze(
  indexCatalogs.flatMap((catalog) => catalog.regions.map((region) => region.id))
);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function signedPolygonArea(points) {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

function cross(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a, b, point) {
  return Math.min(a.x, b.x) <= point.x
    && point.x <= Math.max(a.x, b.x)
    && Math.min(a.y, b.y) <= point.y
    && point.y <= Math.max(a.y, b.y);
}

function segmentsIntersect(a, b, c, d) {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  if ((abC > 0 && abD < 0 || abC < 0 && abD > 0)
    && (cdA > 0 && cdB < 0 || cdA < 0 && cdB > 0)) {
    return true;
  }
  return (abC === 0 && onSegment(a, b, c))
    || (abD === 0 && onSegment(a, b, d))
    || (cdA === 0 && onSegment(c, d, a))
    || (cdB === 0 && onSegment(c, d, b));
}

function polygonSelfIntersects(points) {
  for (let first = 0; first < points.length; first += 1) {
    const firstNext = (first + 1) % points.length;
    for (let second = first + 1; second < points.length; second += 1) {
      const secondNext = (second + 1) % points.length;
      const adjacent = first === second
        || firstNext === second
        || secondNext === first;
      if (!adjacent && segmentsIntersect(points[first], points[firstNext], points[second], points[secondNext])) {
        return true;
      }
    }
  }
  return false;
}

function pointIsValid(point, scale) {
  return Number.isFinite(point?.x)
    && Number.isFinite(point?.y)
    && point.x >= 0
    && point.x <= scale
    && point.y >= 0
    && point.y <= scale;
}

export function validateFloorplanRegionCatalog(catalog) {
  const errors = [];
  if (!catalog?.id || !catalog?.assetId) errors.push("Catalog identifiers are required.");
  if (!Number.isInteger(catalog?.source?.width) || !Number.isInteger(catalog?.source?.height)) {
    errors.push("Source image dimensions must be integers.");
  }
  if (!Number.isInteger(catalog?.scale) || catalog.scale <= 0) errors.push("A positive coordinate scale is required.");

  const ids = new Set();
  for (const region of catalog?.regions || []) {
    if (ids.has(region.id)) errors.push(`Duplicate region ID: ${region.id}.`);
    ids.add(region.id);
    if (!region.label || !region.type || !region.description) errors.push(`Region ${region.id} is missing semantic metadata.`);
    if (!Array.isArray(region.polygon) || region.polygon.length < 3) {
      errors.push(`Region ${region.id} must have at least three polygon points.`);
      continue;
    }
    if (!region.polygon.every((point) => pointIsValid(point, catalog.scale))) {
      errors.push(`Region ${region.id} has an out-of-range polygon point.`);
    }
    if (Math.abs(signedPolygonArea(region.polygon)) < 1) errors.push(`Region ${region.id} has zero polygon area.`);
    if (polygonSelfIntersects(region.polygon)) errors.push(`Region ${region.id} has a self-intersecting polygon.`);
    if (!pointIsValid(region.labelAnchor, catalog.scale)) errors.push(`Region ${region.id} has an invalid label anchor.`);
    if (region.axis && (!Array.isArray(region.axis) || region.axis.length !== 2 || !region.axis.every((point) => pointIsValid(point, catalog.scale)))) {
      errors.push(`Region ${region.id} has an invalid transition axis.`);
    }
    if (region.directionRegionIds
      && (!Array.isArray(region.directionRegionIds)
        || region.directionRegionIds.length !== 2
        || region.directionRegionIds.some((id) => !FLOORPLAN_REGION_IDS.includes(id)))) {
      errors.push(`Region ${region.id} has invalid transition endpoints.`);
    }
  }

  for (const adjacency of catalog?.adjacencies || []) {
    if (!Array.isArray(adjacency.regionIds)
      || adjacency.regionIds.length !== 2
      || adjacency.regionIds.some((id) => !ids.has(id))) {
      errors.push("Adjacency hints must reference two known regions.");
    }
    if (!Array.isArray(adjacency.boundary)
      || adjacency.boundary.length !== 2
      || !adjacency.boundary.every((point) => pointIsValid(point, catalog.scale))) {
      errors.push("Adjacency hints must include a valid two-point boundary.");
    }
  }
  return errors;
}

const catalogs = deepFreeze(indexCatalogs);
for (const catalog of catalogs) {
  const errors = validateFloorplanRegionCatalog(catalog);
  if (errors.length) throw new Error(`Invalid floorplan region catalog: ${errors.join(" ")}`);
}

const catalogsByAssetId = new Map(catalogs.map((catalog) => [catalog.assetId, catalog]));

export function findFloorplanRegionCatalog(assetId) {
  return catalogsByAssetId.get(assetId);
}

export function floorplanCatalogForModel(assetId) {
  const catalog = findFloorplanRegionCatalog(assetId);
  if (!catalog) return null;
  return {
    id: catalog.id,
    assetId: catalog.assetId,
    note: "This index was segmented and verified against the plan image. Treat its labels, counts and spatial relations as authoritative and never re-count or re-estimate them from the picture.",
    regions: catalog.regions.map(({ id, label, type, parentId = null, areaSqm = null, description, facts = null, polygon }) => ({
      id,
      label,
      type,
      parentId,
      areaSqm,
      description,
      facts,
      position: planPosition(catalog, polygon)
    })),
    relations: (catalog.adjacencies || []).map(({ regionIds }) => ({
      type: "adjacent",
      regionIds,
      note: `${regionIds[1]} lies to the ${relativeSide(findRegionById(regionIds[1]), findRegionById(regionIds[0]))} of ${regionIds[0]}.`
    })),
    circulation: {
      note: "Each entry is a doorway, sliding partition or open threshold drawn on the plan. You may only describe walking between two places by following these links; never invent a connection that is not listed.",
      links: circulationForModel(catalog)
    }
  };
}

/**
 * The walking route the server has already resolved for a question, in the
 * geometry-free form the model narrates from.
 */
export function floorplanRouteForModel(assetId, fromRegionId, toRegionId) {
  const catalog = findFloorplanRegionCatalog(assetId);
  const route = catalog ? routeBetweenRegions(catalog, fromRegionId, toRegionId) : null;
  if (!route) return null;
  return {
    note: "This is the route the verified circulation graph resolved. Narrate these steps; do not add, reorder or invent any.",
    fromRegionId,
    toRegionId,
    steps: route.legs.map((leg) => ({
      fromRegionId: leg.fromRegionId,
      toRegionId: leg.toRegionId,
      heading: leg.direction,
      via: leg.via
    }))
  };
}

// Coarse ninth-of-the-plan placement so the model can speak about position without
// ever receiving drawing geometry.
function planPosition(catalog, polygon) {
  const all = catalog.regions.flatMap((region) => region.polygon);
  const plan = boundingBox(all);
  const centre = polygonCentroid(polygon);
  const band = (value, min, max, low, high) => {
    const span = (max - min) / 3;
    if (value < min + span) return low;
    if (value > max - span) return high;
    return "";
  };
  const vertical = band(centre.y, plan.minY, plan.maxY, "north", "south");
  const horizontal = band(centre.x, plan.minX, plan.maxX, "west", "east");
  return [vertical, horizontal].filter(Boolean).join("-") || "central";
}

const wayfindingPattern = /\b(wayfinding|navigate|navigation|route|directions?|which way|show me the way)\b|\bhow (?:do|can|would|should) i get\b|\bhow to (?:get|reach|find)\b|\bget (?:to|from)\b|\bway (?:to|from)\b/;
const ladiesPattern = /\b(?:ladies|lady'?s?|women'?s?|woman'?s?|female|girls)\b/;
const gentsPattern = /\b(?:gents?'?s?|men'?s?|male'?s?|males|boys)\b/;
const contextByTarget = {
  reception: "restaurant",
  restaurant: "reception",
  central_stairs: "storage_west",
  storage_west: "central_stairs",
  storage_east: "central_stairs",
  office_west_64_2: "office_east_64_2",
  office_east_64_2: "restaurant",
  office_114_4: "verandah",
  toilets: "passage",
  toilets_ladies: "passage",
  toilets_gents: "toilets_ladies",
  passage: "toilets",
  kitchen: "reception",
  verandah: "restaurant"
};
const toiletMentionPattern = /\b(?:toilets?|washrooms?|bathrooms?|restrooms?|cubicles?|sinks?|basins?|urinals?|fixtures?|wc|loos?|lavator(?:y|ies)|gents?|gent'?s|ladies|lady'?s|powder\s+room)\b/;
const regionMentionPatterns = [
  ["reception", /\breception\b/],
  ["restaurant", /\b(?:restaurant|dining)\b/],
  ["central_stairs", /\bstairs?\b/],
  ["toilets", toiletMentionPattern],
  ["passage", /\bpassage\b/],
  ["kitchen", /\bkitchen\b/],
  ["verandah", /\bverandah\b/],
  ["office_west_64_2", /\b(?:west|western)(?:ern)?\s+(?:64\.2\s*(?:m2|m²)?\s*)?office\b/],
  ["office_east_64_2", /\b(?:east|eastern)\s+(?:64\.2\s*(?:m2|m²)?\s*)?office\b/],
  ["office_114_4", /\b(?:largest|biggest)\s+office\b|\b114\.4\b/],
  ["storage_west", /\bwest(?:ern)?\s+storage\b/],
  ["storage_east", /\beast(?:ern)?\s+storage\b/]
];

// The plan labels a Gents and a Ladies washroom inside the Toilets block, so gendered
// wording must resolve to the specific room rather than the whole block.
function resolveToiletRegionId(normalized) {
  const ladiesIndex = normalized.search(ladiesPattern);
  const gentsIndex = normalized.search(gentsPattern);
  if (ladiesIndex >= 0 && (gentsIndex < 0 || ladiesIndex < gentsIndex)) return "toilets_ladies";
  if (gentsIndex >= 0) return "toilets_gents";
  return "toilets";
}

function mentionedRegionIds(normalized) {
  const toiletRegionId = resolveToiletRegionId(normalized);
  return regionMentionPatterns
    .map(([id, pattern]) => ({
      id: id === "toilets" ? toiletRegionId : id,
      index: normalized.search(pattern)
    }))
    .filter(({ index }) => index >= 0)
    .sort((left, right) => left.index - right.index)
    .map(({ id }) => id);
}

// "get to X from Y" states the destination first, "from Y to X" states it last.
function wayfindingEndpoints(normalized, regionIds) {
  const [first, second] = regionIds;
  const fromIndex = normalized.search(/\bfrom\b/);
  const toIndex = normalized.search(/\b(?:to|towards|into)\b/);
  if (fromIndex >= 0 && toIndex >= 0 && toIndex < fromIndex) {
    return { fromRegionId: second, toRegionId: first };
  }
  return { fromRegionId: first, toRegionId: second };
}

function findRegionById(regionId) {
  for (const catalog of catalogs) {
    const region = catalog.regions.find((item) => item.id === regionId);
    if (region) return region;
  }
  return null;
}

function catalogContaining(regionId) {
  return catalogs.find((catalog) => catalog.regions.some((region) => region.id === regionId)) || null;
}

// Routes are resolved from drawn doorways only, so a pairing the plan does not connect
// simply has no route and the answer falls back to plan orientation.
function routeForRegions(fromRegionId, toRegionId) {
  const catalog = catalogContaining(fromRegionId);
  if (!catalog || catalog !== catalogContaining(toRegionId)) return null;
  if (!floorplanRegionIsConnected(catalog, fromRegionId) || !floorplanRegionIsConnected(catalog, toRegionId)) return null;
  return routeBetweenRegions(catalog, fromRegionId, toRegionId);
}

export function floorplanRouteForMessage(message) {
  const normalized = String(message || "").toLowerCase();
  const regionIds = mentionedRegionIds(normalized);
  if (!wayfindingPattern.test(normalized) || regionIds.length < 2) return null;
  const { fromRegionId, toRegionId } = wayfindingEndpoints(normalized, regionIds);
  const route = routeForRegions(fromRegionId, toRegionId);
  return route ? { fromRegionId, toRegionId, route } : null;
}

function boundingBox(polygon) {
  return {
    minX: Math.min(...polygon.map((point) => point.x)),
    maxX: Math.max(...polygon.map((point) => point.x)),
    minY: Math.min(...polygon.map((point) => point.y)),
    maxY: Math.max(...polygon.map((point) => point.y))
  };
}

// Rooms that abut along a wall are described by which side they sit on rather than
// by centroid angle, which is misleading for long circulation regions.
function relativeSide(region, other, tolerance = 20) {
  const box = boundingBox(region.polygon);
  const otherBox = boundingBox(other.polygon);
  if (box.maxX - otherBox.minX <= tolerance) return "west";
  if (otherBox.maxX - box.minX <= tolerance) return "east";
  if (box.maxY - otherBox.minY <= tolerance) return "north";
  if (otherBox.maxY - box.minY <= tolerance) return "south";
  return directionBetweenRegions(other, region);
}

const compassAdjectives = {
  north: "northern",
  south: "southern",
  east: "eastern",
  west: "western"
};

function compassAdjective(direction) {
  return compassAdjectives[direction] || direction;
}

// Neighbours come from the index relations, so an adjacency answer can only name
// a pairing the segmentation actually validated.
function adjacentRegionIdOf(regionId, mentionedIds = []) {
  const pairs = catalogs
    .flatMap((catalog) => catalog.adjacencies || [])
    .filter((item) => item.regionIds.includes(regionId))
    .map((item) => item.regionIds.find((id) => id !== regionId));
  return pairs.find((id) => mentionedIds.includes(id)) || pairs[0] || null;
}

// Mid-sentence naming. Everything takes a definite article and parent rooms are
// named as blocks; only a region whose label reads as a proper noun overrides this.
function prosePhrase(region) {
  if (region.prosePhrase) return region.prosePhrase;
  const isParent = catalogs.some((catalog) => catalog.regions.some((item) => item.parentId === region.id));
  return `the ${region.proseName}${isParent ? " block" : ""}`;
}

// Every number below is read from the derived index facts, never authored here.
function toiletFacilityFacts(regionId) {
  const region = findRegionById(regionId);
  if (!region?.facts) return null;
  const isParent = catalogs.some((catalog) => catalog.regions.some((item) => item.parentId === regionId));
  return {
    label: isParent ? `${region.proseName || region.label} block` : region.proseName || region.label,
    cubicles: region.facts.enclosedCubicleCount,
    basins: region.facts.basinCount,
    urinals: region.facts.urinalCount,
    total: region.facts.totalFixtureCount
  };
}

function toiletCompositionNote() {
  const gents = findRegionById("toilets_gents");
  const ladies = findRegionById("toilets_ladies");
  if (!gents || !ladies) return "";
  return `The Toilets block holds a ${gents.label} to the ${relativeSide(gents, ladies)} and a ${ladies.label} to the ${relativeSide(ladies, gents)}.`;
}

// A follow-up such as "how to reach it from the kitchen?" carries the subject only in
// the conversation. Terra sees that history, but the deterministic layer used to see
// the bare message and annotated the wrong pair, so resolve the pronoun first.
const anaphoraPattern = /\bit\b|\bthem\b|\bthey\b|(?<!\b(?:is|are|was|were)\s)\bthere\b|\bthat\b(?=[\s?.!]*$)/;

const anaphoraPhrases = {
  reception: "the reception",
  restaurant: "the restaurant",
  central_stairs: "the stairs",
  toilets: "the toilets",
  toilets_gents: "the gents washroom",
  toilets_ladies: "the ladies washroom",
  passage: "the passage",
  kitchen: "the kitchen",
  verandah: "the verandah",
  office_west_64_2: "the west office",
  office_east_64_2: "the east office",
  office_114_4: "the largest office",
  storage_west: "the west storage",
  storage_east: "the east storage"
};

function antecedentRegionId(history, exclude) {
  const turns = Array.isArray(history) ? history : [];
  const scan = (wantedRole) => {
    for (let index = turns.length - 1; index >= 0; index -= 1) {
      const turn = turns[index];
      const role = String(turn?.role || "").toLowerCase();
      if (wantedRole && role !== wantedRole) continue;
      const candidate = mentionedRegionIds(String(turn?.content || "").toLowerCase())
        .find((id) => !exclude.includes(id));
      if (candidate) return candidate;
    }
    return null;
  };
  return scan("user") || scan(null);
}

export function resolveFloorplanAnaphora(message, history = []) {
  const normalized = String(message || "").toLowerCase();
  const match = normalized.match(anaphoraPattern);
  if (!match) return normalized;
  const antecedent = antecedentRegionId(history, mentionedRegionIds(normalized));
  if (!antecedent) return normalized;
  const before = normalized.slice(0, match.index);
  // "get there" needs the preposition the pronoun was carrying: "get to the kitchen".
  const needsPreposition = match[0] === "there"
    && !/\b(?:to|from|into|towards?|near|beside|at|by|of)\s+$/.test(before);
  return before
    + (needsPreposition ? "to " : "")
    + anaphoraPhrases[antecedent]
    + normalized.slice(match.index + match[0].length);
}

export function floorplanAnnotationFallbackForMessage(message) {
  const normalized = String(message || "").toLowerCase();
  const select = (regionId, role, reason) => ({ regionId, role, reason });
  const regionIds = mentionedRegionIds(normalized);
  const mentionsToilets = toiletMentionPattern.test(normalized);
  const toiletRegionId = resolveToiletRegionId(normalized);
  const asksForCount = /\b(how many|number of|count)\b/.test(normalized);
  if (wayfindingPattern.test(normalized) && regionIds.length >= 2) {
    const { fromRegionId, toRegionId } = wayfindingEndpoints(normalized, regionIds);
    const route = routeForRegions(fromRegionId, toRegionId);
    if (route) {
      const endpoints = [toRegionId, fromRegionId];
      return {
        selections: [
          select(toRegionId, "primary", "This is the requested destination."),
          select(fromRegionId, "secondary", "This is the requested starting point."),
          ...route.regionIds
            .filter((id) => !endpoints.includes(id))
            .map((id) => select(id, "context", "The route passes through here."))
        ],
        relationship: {
          type: "route",
          fromRegionId,
          toRegionId,
          direction: null
        }
      };
    }
    return {
      selections: [
        select(toRegionId, "primary", "This is the requested destination context."),
        select(fromRegionId, "secondary", "This is the requested starting context.")
      ],
      relationship: {
        type: "direction",
        fromRegionId,
        toRegionId,
        direction: null
      }
    };
  }
  if (mentionsToilets && /\b(?:next to|adjacent|adjoin(?:s|ing)?|beside)\b/.test(normalized)) {
    const neighbourId = adjacentRegionIdOf(toiletRegionId, regionIds);
    if (neighbourId) {
      return {
        selections: [
          select(toiletRegionId, "primary", "This is the washroom area referenced by the question."),
          select(neighbourId, "secondary", "This is the validated adjoining area.")
        ],
        relationship: {
          type: "adjacency",
          fromRegionId: toiletRegionId,
          toRegionId: neighbourId,
          direction: null
        }
      };
    }
  }
  if (mentionsToilets && asksForCount) {
    return {
      selections: [select(toiletRegionId, "primary", "This is the washroom area referenced by the count question.")],
      relationship: {
        type: "count",
        fromRegionId: null,
        toRegionId: null,
        direction: null
      }
    };
  }
  if (mentionsToilets && (toiletRegionId !== "toilets"
    || /\b(where|locate|find|nearest|closest)\b/.test(normalized)
    || wayfindingPattern.test(normalized))) {
    const referenceRegionId = toiletRegionId === "toilets_gents" ? "toilets_ladies" : "passage";
    return {
      selections: [
        select(toiletRegionId, "primary", "This is the washroom area referenced by the question."),
        select(referenceRegionId, "secondary", "This is the nearest validated spatial reference.")
      ],
      relationship: {
        type: "location",
        fromRegionId: referenceRegionId,
        toRegionId: toiletRegionId,
        direction: null
      }
    };
  }
  if (/\brelative to\b/.test(normalized) && regionIds.length >= 2) {
    const [targetRegionId, referenceRegionId] = regionIds;
    return {
      selections: [
        select(targetRegionId, "primary", "This is the requested location."),
        select(referenceRegionId, "secondary", "This is the requested spatial reference.")
      ],
      relationship: {
        type: "direction",
        fromRegionId: referenceRegionId,
        toRegionId: targetRegionId,
        direction: null
      }
    };
  }
  if (/\b(where|locate|find)\b/.test(normalized) && /\bstairs?\b/.test(normalized) && regionIds.length === 1) {
    return {
      selections: [
        select("central_stairs", "primary", "This is the requested central stair core."),
        select("storage_west", "secondary", "This provides validated location context beside the stairs."),
        select("storage_east", "context", "This provides validated location context on the other side.")
      ],
      relationship: {
        type: "location",
        fromRegionId: "storage_west",
        toRegionId: "central_stairs",
        direction: null
      }
    };
  }
  if (/\b(?:nearest|closest|next to|adjacent|adjoin(?:s|ing)?|beside)\b/.test(normalized) && regionIds.length) {
    const [targetId] = regionIds;
    const neighbourId = adjacentRegionIdOf(targetId, regionIds.slice(1));
    if (neighbourId) {
      return {
        selections: [
          select(targetId, "primary", "This is the area referenced by the question."),
          select(neighbourId, "secondary", "This is the validated adjoining area.")
        ],
        relationship: {
          type: "adjacency",
          fromRegionId: targetId,
          toRegionId: neighbourId,
          direction: null
        }
      };
    }
  }
  if (wayfindingPattern.test(normalized) || /\b(where|locate|find|nearest|closest)\b/.test(normalized)) {
    const [targetId] = regionIds;
    const contextId = contextByTarget[targetId];
    if (targetId && contextId) {
      return {
        selections: [
          select(targetId, "primary", "This is the requested destination context."),
          select(contextId, "secondary", "This is a nearby validated spatial reference.")
        ],
        relationship: {
          type: "location",
          fromRegionId: contextId,
          toRegionId: targetId,
          direction: null
        }
      };
    }
  }
  return null;
}

const numberWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"];

function numberWord(value) {
  return numberWords[value] || String(value);
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function describeFixtures(facts) {
  const parts = [];
  if (facts.cubicles) parts.push(plural(facts.cubicles, "enclosed cubicle"));
  if (facts.urinals) parts.push(plural(facts.urinals, "urinal"));
  if (facts.basins) parts.push(plural(facts.basins, "wash basin"));
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function childRegions(parentId) {
  return catalogs.flatMap((catalog) => catalog.regions).filter((region) => region.parentId === parentId);
}

export function describeFloorplanRoute(fromRegionId, toRegionId, route) {
  const from = findRegionById(fromRegionId);
  const to = findRegionById(toRegionId);
  const steps = route.legs.map((leg, index) => {
    const target = findRegionById(leg.toRegionId);
    const arrival = index === route.legs.length - 1 ? prosePhrase(to) : prosePhrase(target);
    const opening = leg.via === "opening" ? "the opening" : `the ${leg.via}`;
    return `head ${leg.direction} through ${opening} into ${arrival}`;
  });
  const journey = steps.length <= 2
    ? steps.join(", then ")
    : `${steps.slice(0, -1).join(", then ")}, and finally ${steps[steps.length - 1]}`;
  return `From ${prosePhrase(from)}, ${journey}. That is ${plural(route.legs.length, "doorway", "doorways")} along the circulation drawn on the Level 12 plan; it is not checked for step-free access, door locking or emergency egress.`;
}

export function groundFloorplanReply(message, reply) {
  return groundedFloorplanSentence(message) ?? reply;
}

// Live answers are written by the model, which can see the plan image and the verified
// index, so they are richer than a template. They are kept only when they agree with the
// index: a reply that states an unsupported count, wanders off the resolved route or
// contradicts the derived orientation is replaced by the deterministic sentence.
export function verifyFloorplanReply(message, reply) {
  const grounded = groundedFloorplanSentence(message);
  if (!grounded) return reply;
  return floorplanReplyConflicts(message, reply, grounded).length ? grounded : reply;
}

const fixtureNounPattern = /\b(?:cubicles?|toilets?|wcs?|basins?|sinks?|urinals?|fixtures?|washrooms?|bathrooms?|restrooms?)\b/;
const compassPattern = /\b(north|south|east|west)(?:ern|east|west)?\b/g;

function supportedFixtureCounts(normalized) {
  const regionId = resolveToiletRegionId(normalized);
  const facts = toiletFacilityFacts(regionId);
  if (!facts) return null;
  const children = childRegions(regionId);
  const values = [facts.cubicles, facts.basins, facts.urinals, facts.total, 0];
  if (children.length) {
    values.push(children.length);
    for (const child of children) {
      const childFacts = toiletFacilityFacts(child.id);
      values.push(childFacts.cubicles, childFacts.basins, childFacts.urinals, childFacts.total);
    }
  }
  return new Set(values);
}

export function floorplanReplyConflicts(message, reply, grounded) {
  const normalized = String(message || "").toLowerCase();
  const text = String(reply || "");
  if (!text.trim()) return ["The model returned no reply."];
  const conflicts = [];

  if (toiletMentionPattern.test(normalized)) {
    const supported = supportedFixtureCounts(normalized);
    for (const match of text.matchAll(/\b(\d+)\b([^.;]{0,40})/g)) {
      const value = Number(match[1]);
      if (supported && fixtureNounPattern.test(match[2]) && !supported.has(value)) {
        conflicts.push(`The index does not support a count of ${value}.`);
      }
    }
  }

  const wayfinding = floorplanRouteForMessage(normalized);
  if (wayfinding) {
    const onRoute = new Set(wayfinding.route.regionIds);
    for (const id of mentionedRegionIds(text.toLowerCase())) {
      if (!onRoute.has(id)) conflicts.push(`${id} is not on the resolved route.`);
    }
  }

  const groundedDirections = new Set([...String(grounded).matchAll(compassPattern)].map((match) => match[1]));
  if (groundedDirections.size) {
    for (const match of text.matchAll(compassPattern)) {
      if (!groundedDirections.has(match[1])) conflicts.push(`The derived geometry does not place anything ${match[1]}.`);
    }
  }
  return conflicts;
}

function groundedFloorplanSentence(message) {
  const normalized = String(message || "").toLowerCase();
  const regionIds = mentionedRegionIds(normalized);
  // "How do I get to X from Y" is answered by walking the verified circulation graph,
  // so the sentence describes the same doorways the overlay draws.
  if (wayfindingPattern.test(normalized) && regionIds.length >= 2) {
    const { fromRegionId, toRegionId } = wayfindingEndpoints(normalized, regionIds);
    const route = routeForRegions(fromRegionId, toRegionId);
    if (route) return describeFloorplanRoute(fromRegionId, toRegionId, route);
    const from = findRegionById(fromRegionId);
    const to = findRegionById(toRegionId);
    if (from && to) {
      return `${capitalize(prosePhrase(to))} is ${directionBetweenRegions(from, to)} of ${prosePhrase(from)} on the Level 12 plan. The plan does not draw a connected walking route between them, so this is general orientation only.`;
    }
  }
  // Adjacency wording for non-washroom rooms, so the sentence names the same pair the
  // overlay highlights.
  if (!toiletMentionPattern.test(normalized)
    && /\b(?:nearest|closest|next to|adjacent|adjoin(?:s|ing)?|beside)\b/.test(normalized)
    && regionIds.length) {
    const [targetId] = regionIds;
    const neighbourId = adjacentRegionIdOf(targetId, regionIds.slice(1));
    if (neighbourId) {
      const target = findRegionById(targetId);
      const neighbour = findRegionById(neighbourId);
      return `${capitalize(prosePhrase(neighbour))} directly adjoins ${prosePhrase(target)}, immediately ${relativeSide(neighbour, target)} of it on the Level 12 plan.`;
    }
  }
  if (!toiletMentionPattern.test(normalized)) return null;
  const regionId = resolveToiletRegionId(normalized);
  const facts = toiletFacilityFacts(regionId);
  if (!facts) return null;
  const composition = toiletCompositionNote();
  const asksForCount = /\b(how many|number of|count)\b/.test(normalized);
  if (asksForCount && /\burinals?\b/.test(normalized)) {
    if (facts.urinals > 0) return `The ${facts.label} shows ${plural(facts.urinals, "urinal")}. ${composition}`;
    const withUrinals = childRegions("toilets")
      .map((region) => ({ region, facts: toiletFacilityFacts(region.id) }))
      .filter((item) => item.facts.urinals > 0)
      .map((item) => `${plural(item.facts.urinals, "urinal")} in the ${item.region.label}`);
    return `The ${facts.label} shows no urinals; the plan draws ${withUrinals.join(" and ")}.`;
  }
  if (asksForCount && /\b(sinks?|basins?)\b/.test(normalized)) {
    return `The ${facts.label} shows ${plural(facts.basins, "wash basin")}. ${composition}`;
  }
  if (asksForCount && /\bfixtures?\b/.test(normalized)) {
    return `The ${facts.label} shows ${plural(facts.total, "plumbing fixture")}: ${describeFixtures(facts)}.`;
  }
  if (asksForCount && regionId === "toilets" && /\b(washrooms?|bathrooms?|restrooms?)\b/.test(normalized)) {
    const children = childRegions("toilets");
    const detail = children
      .map((region) => `the ${region.label} with ${describeFixtures(toiletFacilityFacts(region.id))}`)
      .join(", and ");
    return `Level 12 has one labelled Toilets block containing ${numberWord(children.length)} washrooms: ${detail}.`;
  }
  if (asksForCount) {
    const urinalNote = facts.urinals > 0 ? `, plus ${plural(facts.urinals, "urinal")}` : "";
    return `The ${facts.label} shows ${plural(facts.cubicles, "enclosed toilet cubicle")}${urinalNote}. ${composition}`;
  }
  if (/\b(?:is|are) there\b|\bseparate\b|\bgender(?:ed|-specific)?\b|\bdoes .*\bhave\b/.test(normalized)) {
    const children = childRegions("toilets");
    const detail = children
      .map((region) => `the ${region.label} (${describeFixtures(toiletFacilityFacts(region.id))})`)
      .join(" and ");
    return `Yes — the Level 12 plan labels ${numberWord(children.length)} separate washrooms inside the Toilets block: ${detail}.`;
  }
  if (/\b(where|locate|find|next to|adjacent|adjoin(?:s|ing)?|beside|nearest|closest)\b/.test(normalized)
    || wayfindingPattern.test(normalized)) {
    const passage = findRegionById("passage");
    const region = findRegionById(regionId);
    if (regionId === "toilets") {
      return `The ${facts.label} sits immediately ${relativeSide(region, passage)} of the labelled ${passage.label}. ${composition}`;
    }
    const sibling = childRegions("toilets").find((item) => item.id !== regionId);
    return `The ${region.label} is the ${compassAdjective(relativeSide(region, sibling))} room of the Toilets block, ${relativeSide(region, passage)} of the labelled ${passage.label} and ${relativeSide(region, sibling)} of the ${sibling.label}.`;
  }
  return null;
}

function toSourcePoint(point, catalog) {
  return {
    x: Math.round(point.x / catalog.scale * catalog.source.width),
    y: Math.round(point.y / catalog.scale * catalog.source.height)
  };
}

function polygonCentroid(points) {
  const areaFactor = signedPolygonArea(points) * 6;
  if (Math.abs(areaFactor) < 1) {
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length
    };
  }
  const weighted = points.reduce((result, point, index) => {
    const next = points[(index + 1) % points.length];
    const factor = point.x * next.y - next.x * point.y;
    result.x += (point.x + next.x) * factor;
    result.y += (point.y + next.y) * factor;
    return result;
  }, { x: 0, y: 0 });
  return { x: weighted.x / areaFactor, y: weighted.y / areaFactor };
}

function adjacencyKey(first, second) {
  return [first, second].sort().join(":");
}

function directionBetweenRegions(from, to) {
  const fromCenter = polygonCentroid(from.polygon);
  const toCenter = polygonCentroid(to.polygon);
  const angle = Math.atan2(toCenter.y - fromCenter.y, toCenter.x - fromCenter.x);
  const directions = ["east", "southeast", "south", "southwest", "west", "northwest", "north", "northeast"];
  const sector = Math.round(angle / (Math.PI / 4));
  return directions[(sector + directions.length) % directions.length];
}

function relationshipLabel(relationship, regions, transition, route) {
  const byId = new Map(regions.map((region) => [region.id, region]));
  const from = byId.get(relationship.fromRegionId);
  const to = byId.get(relationship.toRegionId);
  if (route) {
    const via = route.regionIds.slice(1, -1).map((id) => byId.get(id).label);
    const through = via.length ? ` via ${via.join(", ")}` : " directly";
    return `Walking route from ${from.label} to ${to.label}${through}`;
  }
  if (transition) return `${relationship.direction} along ${transition.label}; spatial direction only, not a route`;
  if (relationship.type === "adjacency") return `${from.label} directly adjoins ${to.label}`;
  if (relationship.type === "count") {
    const count = regions.filter((region) => region.role === "primary").length;
    return count === 1 ? "Highlighted region for visual count" : `${count} highlighted regions`;
  }
  if (relationship.type === "size") return "Highlighted size comparison";
  return `${to.label} is ${relationship.direction} of ${from.label}`;
}

export function groundFloorplanAnnotation(assetId, intent) {
  if (intent === null) return null;
  const catalog = findFloorplanRegionCatalog(assetId);
  if (!catalog) throw new Error("No approved region catalog exists for this floorplan.");
  const regionsById = new Map(catalog.regions.map((region) => [region.id, region]));
  const selectedIds = intent.selections.map((selection) => selection.regionId);
  if (selectedIds.some((id) => !regionsById.has(id))) throw new Error("Unknown floorplan region identifier.");
  if (new Set(selectedIds).size !== selectedIds.length) throw new Error("Duplicate floorplan region identifier.");
  if (!intent.selections.some((selection) => selection.role === "primary")) {
    throw new Error("At least one primary floorplan region is required.");
  }

  let relationship = ["count", "size"].includes(intent.relationship.type)
    ? {
        ...intent.relationship,
        fromRegionId: null,
        toRegionId: null,
        direction: null
      }
    : intent.relationship;
  const requiresEndpoints = ["location", "adjacency", "direction", "route"].includes(relationship.type);
  const hasBothEndpoints = relationship.fromRegionId !== null && relationship.toRegionId !== null;
  if (requiresEndpoints && !hasBothEndpoints) throw new Error("This floorplan relationship requires two region endpoints.");
  if (hasBothEndpoints) {
    if (relationship.fromRegionId === relationship.toRegionId) throw new Error("Floorplan relationship endpoints must be different.");
    if (!selectedIds.includes(relationship.fromRegionId) || !selectedIds.includes(relationship.toRegionId)) {
      throw new Error("Floorplan relationship endpoints must be selected regions.");
    }
  }
  if (["location", "direction"].includes(relationship.type) && relationship.direction === null) {
    relationship = {
      ...relationship,
      direction: directionBetweenRegions(
        regionsById.get(relationship.fromRegionId),
        regionsById.get(relationship.toRegionId)
      )
    };
  }
  const regions = intent.selections.map((selection) => {
    const region = regionsById.get(selection.regionId);
    return {
      id: region.id,
      label: region.label,
      type: region.type,
      areaSqm: region.areaSqm ?? null,
      role: selection.role,
      reason: selection.reason,
      polygon: region.polygon.map((point) => toSourcePoint(point, catalog)),
      labelAnchor: toSourcePoint(region.labelAnchor, catalog)
    };
  });

  let marker = null;
  let route = null;
  if (relationship.type === "route") {
    route = routeBetweenRegions(catalog, relationship.fromRegionId, relationship.toRegionId);
    if (!route) throw new Error("The plan does not draw a connected route between the selected regions.");
    if (route.regionIds.some((id) => !selectedIds.includes(id))) {
      throw new Error("Every region a route passes through must be a selected region.");
    }
  }
  const transition = intent.selections
    .map((selection) => regionsById.get(selection.regionId))
    .find((region) => region.type === "transition"
      && region.axis
      && adjacencyKey(...region.directionRegionIds)
        === adjacencyKey(relationship.fromRegionId, relationship.toRegionId));
  if (route) {
    // Every point comes from a reviewed doorway, so the drawn path can never cross a wall.
    marker = {
      kind: "route-path",
      points: route.points.map((point) => toSourcePoint(point, catalog))
    };
  } else if (["location", "direction"].includes(relationship.type)) {
    const points = transition
      ? transition.axis
      : [
          polygonCentroid(regionsById.get(relationship.fromRegionId).polygon),
          polygonCentroid(regionsById.get(relationship.toRegionId).polygon)
        ];
    marker = {
      kind: transition ? "axis-arrow" : "direction-arrow",
      points: points.map((point) => toSourcePoint(point, catalog))
    };
  } else if (relationship.type === "adjacency") {
    const hint = catalog.adjacencies.find((item) => adjacencyKey(...item.regionIds)
      === adjacencyKey(relationship.fromRegionId, relationship.toRegionId));
    if (!hint) throw new Error("The selected regions do not have an approved adjacency marker.");
    marker = {
      kind: "shared-boundary",
      points: hint.boundary.map((point) => toSourcePoint(point, catalog))
    };
  }

  return {
    width: catalog.source.width,
    height: catalog.source.height,
    regions,
    relationship: {
      ...relationship,
      label: relationshipLabel(relationship, regions, transition, route)
    },
    marker,
    safetyNote: route
      ? "Route follows circulation drawn on the plan. It is not verified for step-free access, door locking or emergency egress."
      : "Spatial highlight only. It is not accessibility, emergency or turn-by-turn routing guidance."
  };
}
