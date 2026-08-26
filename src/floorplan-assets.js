import { readFile } from "node:fs/promises";
import path from "node:path";

const meridianLevel12Floorplan = Object.freeze({
  id: "floorplan-meridian-level-12",
  buildingId: "building-meridian",
  floor: "Level 12",
  title: "Meridian House Level 12 floor plan",
  imageUrl: "/assets/floorplans/meridian-house-level-12-floorplan.jpeg",
  mimeType: "image/jpeg",
  alt: "Floor plan of Meridian House Level 12 showing office areas, amenities, central stairs, reception, kitchen and restaurant space",
  description: "Neutral demonstration plan showing three office areas, a central stair and storage core, western toilets, and eastern reception, restaurant, kitchen and amenity areas."
});

const records = [
  {
    asset: meridianLevel12Floorplan,
    relativePath: path.join("public", "assets", "floorplans", "meridian-house-level-12-floorplan.jpeg")
  }
];

const recordsById = new Map(records.map((record) => [record.asset.id, record]));

export const floorplanAssets = Object.freeze(records.map((record) => record.asset));

export function findFloorplanAsset(id) {
  return recordsById.get(id)?.asset;
}

function referencesFloorplan(normalized) {
  const asksForPlan = /\b(floor\s*plan|floorplan|layout|map|wayfinding|navigate|navigation)\b/.test(normalized);
  const asksAboutPlanFeature = /\b(offices?|rooms?|meeting room|reception|restaurant|dining|bar|kitchen|storage|toilets?|washrooms?|bathrooms?|restrooms?|wc|loos?|lavator(?:y|ies)|gents?|gent'?s|ladies|lady'?s|cubicles?|sinks?|basins?|urinals?|fixtures?|capacity|occupancy|occupants?|seats?|seating|diners?|amenit(?:y|ies)|balcony|verandah|passage|stairs?|lifts?|elevators?|exits?)\b/.test(normalized);
  return asksForPlan || asksAboutPlanFeature;
}

export function findFloorplanForMessage(building, message, history = []) {
  if (!building?.floorplans?.length) return null;
  const normalized = String(message || "").toLowerCase();
  // Keep the image available for the next conversational turn after a
  // floorplan exchange. Terra can then interpret unrestricted follow-up
  // language instead of the server maintaining a synonym list.
  const recentFloorplanContext = history
    .slice(-2)
    .some((turn) => referencesFloorplan(String(turn?.content || "").toLowerCase()));
  if (!referencesFloorplan(normalized) && !recentFloorplanContext) return null;
  return building.floorplans.map((floorplan) => findFloorplanAsset(floorplan.id)).find(Boolean) || null;
}

// Mock mode remains deterministic and uses this narrower classifier to decide
// whether its canned answer should include an overlay. Live mode lets Terra
// decide visual intent whenever an approved floorplan is supplied.
export function floorplanAnnotationRequested(message) {
  const normalized = String(message || "").toLowerCase();
  return /\b(annotat(?:e|ed|ion)|highlight|mark|point|locate|find|identify|where|which|nearest|closest|relative|relationship|adjacent|adjoin(?:s|ing)?|beside|between|near|direction|towards?|north|south|east|west|how many|number of|count|capacity|occupancy|occupants?|people|persons?|seats?|seating|diners?|hold|contain|fit|largest|biggest|smallest|size|area|compare|comparison)\b/.test(normalized)
    || /\b(next to|wayfinding|navigate|navigation|route|directions?|which way|show me the way)\b/.test(normalized)
    || /\bhow (?:do|can|would|should) i get\b/.test(normalized)
    || /\bhow to (?:get|reach|find)\b/.test(normalized)
    || /\bget (?:to|from)\b/.test(normalized)
    || /\bway (?:to|from)\b/.test(normalized)
    || /\b(?:ladies|lady'?s?|women'?s?|woman'?s?|female|girls|gents?'?s?|men'?s?|male'?s?|males|boys)\b/.test(normalized);
}

export function emptyFloorplanAttachment() {
  return {
    included: false,
    assetId: "",
    title: "",
    floor: "",
    imageUrl: "",
    alt: "",
    caption: "",
    annotation: null
  };
}

export function buildFloorplanAttachment(asset, caption = "", annotation = null) {
  return {
    included: true,
    assetId: asset.id,
    title: asset.title,
    floor: asset.floor,
    imageUrl: asset.imageUrl,
    alt: asset.alt,
    caption: caption || asset.description,
    annotation
  };
}

export async function loadFloorplanImage(rootPath, asset) {
  const record = recordsById.get(asset?.id);
  if (!record || record.asset.imageUrl !== asset.imageUrl) {
    throw new Error("Floorplan asset is not approved.");
  }
  const base64 = await readFile(path.join(rootPath, record.relativePath), "base64");
  return {
    asset: record.asset,
    dataUrl: `data:${record.asset.mimeType};base64,${base64}`
  };
}
