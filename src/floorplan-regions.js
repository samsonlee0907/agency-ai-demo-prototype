export const FLOORPLAN_REGION_SCALE = 1000;

export const FLOORPLAN_REGION_IDS = Object.freeze([
  "reception",
  "restaurant",
  "office_west_64_2",
  "office_east_64_2",
  "office_114_4",
  "verandah",
  "central_stairs",
  "storage_west",
  "storage_east",
  "toilets",
  "toilets_gents",
  "toilets_ladies",
  "passage",
  "kitchen"
]);

// Coordinates are transcribed from the visually verified Terra experiment overlays.
const meridianLevel12Catalog = {
  id: "meridian-house-level-12",
  assetId: "floorplan-meridian-level-12",
  source: { width: 2256, height: 1304 },
  scale: FLOORPLAN_REGION_SCALE,
  regions: [
    {
      id: "reception",
      label: "Reception",
      type: "room",
      description: "The labelled reception room directly below the restaurant.",
      polygon: [{ x: 738, y: 648 }, { x: 850, y: 648 }, { x: 850, y: 745 }, { x: 738, y: 745 }],
      labelAnchor: { x: 794, y: 697 }
    },
    {
      id: "restaurant",
      label: "Restaurant",
      type: "room",
      areaSqm: 207.2,
      description: "The complete labelled restaurant footprint, excluding the balcony, bar, reception, kitchen and changing rooms.",
      polygon: [
        { x: 689, y: 238 }, { x: 950, y: 238 }, { x: 950, y: 374 }, { x: 903, y: 374 },
        { x: 903, y: 618 }, { x: 738, y: 618 }, { x: 738, y: 547 }, { x: 689, y: 547 }
      ],
      labelAnchor: { x: 820, y: 500 }
    },
    {
      id: "office_west_64_2",
      label: "West office 64.2 m²",
      type: "room",
      areaSqm: 64.2,
      description: "The western or left office labelled 64.2 m².",
      polygon: [{ x: 283, y: 239 }, { x: 492, y: 239 }, { x: 492, y: 544 }, { x: 283, y: 544 }],
      labelAnchor: { x: 387, y: 392 }
    },
    {
      id: "office_east_64_2",
      label: "East office 64.2 m²",
      type: "room",
      areaSqm: 64.2,
      description: "The eastern or right office labelled 64.2 m², immediately beside the restaurant.",
      polygon: [{ x: 493, y: 239 }, { x: 699, y: 239 }, { x: 699, y: 544 }, { x: 493, y: 544 }],
      labelAnchor: { x: 596, y: 392 }
    },
    {
      id: "office_114_4",
      label: "Largest office 114.4 m²",
      type: "room",
      areaSqm: 114.4,
      description: "The largest labelled office in the lower-left of the plan.",
      polygon: [
        { x: 34, y: 382 }, { x: 222, y: 382 }, { x: 222, y: 663 }, { x: 248, y: 663 },
        { x: 248, y: 966 }, { x: 81, y: 966 }, { x: 81, y: 928 }, { x: 34, y: 928 }
      ],
      labelAnchor: { x: 141, y: 700 }
    },
    {
      id: "verandah",
      label: "Verandah",
      type: "transition",
      description: "The labelled horizontal transition strip along the office fronts toward the restaurant.",
      polygon: [{ x: 281, y: 544 }, { x: 738, y: 544 }, { x: 738, y: 666 }, { x: 281, y: 666 }],
      labelAnchor: { x: 510, y: 605 },
      axis: [{ x: 320, y: 605 }, { x: 700, y: 605 }],
      directionRegionIds: ["office_114_4", "restaurant"]
    },
    {
      id: "central_stairs",
      label: "Central stairs",
      type: "circulation",
      description: "The central stair core between the two storage rooms.",
      polygon: [{ x: 477, y: 620 }, { x: 521, y: 620 }, { x: 521, y: 782 }, { x: 477, y: 782 }],
      labelAnchor: { x: 499, y: 701 }
    },
    {
      id: "storage_west",
      label: "West stair storage",
      type: "service",
      description: "The storage room immediately left of the central stairs.",
      polygon: [{ x: 433, y: 621 }, { x: 467, y: 621 }, { x: 467, y: 780 }, { x: 433, y: 780 }],
      labelAnchor: { x: 450, y: 701 }
    },
    {
      id: "storage_east",
      label: "East stair storage",
      type: "service",
      description: "The storage room immediately right of the central stairs.",
      polygon: [{ x: 520, y: 621 }, { x: 553, y: 621 }, { x: 553, y: 780 }, { x: 520, y: 780 }],
      labelAnchor: { x: 537, y: 701 }
    },
    {
      id: "toilets",
      label: "Toilets",
      type: "service",
      description: "The complete western block labelled Toilets beside the passage. It contains the labelled Gents washroom at its western end and the labelled Ladies washroom to the east of the Gents.",
      facts: {
        genderDesignation: "separate gents and ladies washrooms",
        enclosedCubicleCount: 5,
        totalFixtureCount: 15,
        basinCount: 6,
        urinalCount: 4
      },
      polygon: [{ x: 35, y: 137 }, { x: 227, y: 137 }, { x: 227, y: 384 }, { x: 35, y: 384 }],
      labelAnchor: { x: 131, y: 261 }
    },
    {
      id: "toilets_gents",
      label: "Gents washroom",
      type: "service",
      description: "The labelled Gents washroom at the western end of the Toilets block, beyond the Ladies washroom.",
      facts: {
        genderDesignation: "gents",
        enclosedCubicleCount: 2,
        totalFixtureCount: 8,
        basinCount: 2,
        urinalCount: 4
      },
      polygon: [{ x: 39, y: 147 }, { x: 114, y: 147 }, { x: 114, y: 376 }, { x: 39, y: 376 }],
      labelAnchor: { x: 76, y: 261 }
    },
    {
      id: "toilets_ladies",
      label: "Ladies washroom",
      type: "service",
      description: "The labelled Ladies washroom in the eastern half of the Toilets block, immediately west of the passage.",
      facts: {
        genderDesignation: "ladies",
        enclosedCubicleCount: 3,
        totalFixtureCount: 7,
        basinCount: 4,
        urinalCount: 0
      },
      polygon: [{ x: 119, y: 147 }, { x: 218, y: 147 }, { x: 218, y: 307 }, { x: 119, y: 307 }],
      labelAnchor: { x: 168, y: 227 }
    },
    {
      id: "passage",
      label: "Passage",
      type: "circulation",
      description: "The labelled north-south passage between the toilets and office areas.",
      polygon: [{ x: 220, y: 232 }, { x: 282, y: 232 }, { x: 282, y: 670 }, { x: 220, y: 670 }],
      labelAnchor: { x: 251, y: 451 }
    },
    {
      id: "kitchen",
      label: "Kitchen",
      type: "service",
      description: "The labelled kitchen below and slightly right of reception.",
      polygon: [{ x: 741, y: 779 }, { x: 846, y: 779 }, { x: 846, y: 957 }, { x: 741, y: 957 }],
      labelAnchor: { x: 794, y: 868 }
    }
  ],
  adjacencies: [
    {
      regionIds: ["office_east_64_2", "restaurant"],
      boundary: [{ x: 699, y: 270 }, { x: 699, y: 520 }]
    },
    {
      regionIds: ["toilets", "passage"],
      boundary: [{ x: 224, y: 232 }, { x: 224, y: 384 }]
    },
    {
      regionIds: ["toilets_ladies", "passage"],
      boundary: [{ x: 219, y: 232 }, { x: 219, y: 307 }]
    },
    {
      regionIds: ["toilets_gents", "toilets_ladies"],
      boundary: [{ x: 116, y: 147 }, { x: 116, y: 307 }]
    }
  ]
};

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

const catalogs = deepFreeze([meridianLevel12Catalog]);
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
    regions: catalog.regions.map(({ id, label, type, areaSqm = null, description, facts = null }) => ({
      id,
      label,
      type,
      areaSqm,
      description,
      facts
    }))
  };
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
  ["verandah", /\bverandah\b/]
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

const toiletFacilityFacts = Object.freeze({
  toilets_ladies: { label: "Ladies washroom", cubicles: 3, basins: 4, urinals: 0 },
  toilets_gents: { label: "Gents washroom", cubicles: 2, basins: 2, urinals: 4 },
  toilets: { label: "Toilets block", cubicles: 5, basins: 6, urinals: 4 }
});

const toiletCompositionNote = "The Toilets block holds a Gents washroom at its western end and a Ladies washroom to the east of it.";

export function floorplanAnnotationFallbackForMessage(message) {
  const normalized = String(message || "").toLowerCase();
  const select = (regionId, role, reason) => ({ regionId, role, reason });
  const regionIds = mentionedRegionIds(normalized);
  const mentionsToilets = toiletMentionPattern.test(normalized);
  const toiletRegionId = resolveToiletRegionId(normalized);
  const asksForCount = /\b(how many|number of|count)\b/.test(normalized);
  if (wayfindingPattern.test(normalized) && regionIds.length >= 2) {
    const { fromRegionId, toRegionId } = wayfindingEndpoints(normalized, regionIds);
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
  if (mentionsToilets && /\b(?:next to|adjacent|adjoin(?:s|ing)?|beside)\b/.test(normalized)
    && /\bpassage\b/.test(normalized) && toiletRegionId !== "toilets_gents") {
    return {
      selections: [
        select(toiletRegionId, "primary", "This is the washroom area referenced by the question."),
        select("passage", "secondary", "This is the adjacent labelled passage.")
      ],
      relationship: {
        type: "adjacency",
        fromRegionId: toiletRegionId,
        toRegionId: "passage",
        direction: null
      }
    };
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

export function groundFloorplanReply(message, reply) {
  const normalized = String(message || "").toLowerCase();
  if (!toiletMentionPattern.test(normalized)) return reply;
  const regionId = resolveToiletRegionId(normalized);
  const facts = toiletFacilityFacts[regionId];
  const asksForCount = /\b(how many|number of|count)\b/.test(normalized);
  if (asksForCount && /\burinals?\b/.test(normalized)) {
    return facts.urinals > 0
      ? `The ${facts.label} shows ${facts.urinals} urinals. ${toiletCompositionNote}`
      : `The ${facts.label} shows no urinals; the plan draws all 4 urinals in the Gents washroom.`;
  }
  if (asksForCount && /\b(sinks?|basins?)\b/.test(normalized)) {
    return `The ${facts.label} shows ${facts.basins} wash basins. ${toiletCompositionNote}`;
  }
  if (asksForCount && /\bfixtures?\b/.test(normalized)) {
    const total = facts.cubicles + facts.basins + facts.urinals;
    return `The ${facts.label} shows ${total} plumbing fixtures: ${facts.cubicles} enclosed cubicles, ${facts.basins} wash basins and ${facts.urinals} urinals.`;
  }
  if (asksForCount && regionId === "toilets" && /\b(washrooms?|bathrooms?|restrooms?)\b/.test(normalized)) {
    return `Level 12 has one labelled Toilets block containing two washrooms: the Gents washroom with 2 enclosed cubicles, 4 urinals and 2 basins, and the Ladies washroom with 3 enclosed cubicles and 4 basins.`;
  }
  if (asksForCount) {
    const urinalNote = facts.urinals > 0 ? `, plus ${facts.urinals} urinals` : "";
    return `The ${facts.label} shows ${facts.cubicles} enclosed toilet cubicles${urinalNote}. ${toiletCompositionNote}`;
  }
  if (/\b(where|locate|find|next to|adjacent|adjoin(?:s|ing)?|beside|nearest|closest)\b/.test(normalized)
    || wayfindingPattern.test(normalized)) {
    if (regionId === "toilets_ladies") {
      return `The Ladies washroom is the eastern half of the Toilets block on the west side of Level 12, immediately west of the labelled Passage.`;
    }
    if (regionId === "toilets_gents") {
      return `The Gents washroom is at the far western end of the Toilets block, beyond the Ladies washroom and west of the labelled Passage.`;
    }
    return `The Toilets block sits immediately west of the labelled Passage. ${toiletCompositionNote}`;
  }
  return reply;
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

function relationshipLabel(relationship, regions, transition) {
  const byId = new Map(regions.map((region) => [region.id, region]));
  const from = byId.get(relationship.fromRegionId);
  const to = byId.get(relationship.toRegionId);
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
  const requiresEndpoints = ["location", "adjacency", "direction"].includes(relationship.type);
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
  const transition = intent.selections
    .map((selection) => regionsById.get(selection.regionId))
    .find((region) => region.type === "transition"
      && region.axis
      && adjacencyKey(...region.directionRegionIds)
        === adjacencyKey(relationship.fromRegionId, relationship.toRegionId));
  if (["location", "direction"].includes(relationship.type)) {
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
      label: relationshipLabel(relationship, regions, transition)
    },
    marker,
    safetyNote: "Spatial highlight only. It is not accessibility, emergency or turn-by-turn routing guidance."
  };
}
