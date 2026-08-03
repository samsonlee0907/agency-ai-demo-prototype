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

export function findFloorplanForMessage(building, message) {
  if (!building?.floorplans?.length) return null;
  const normalized = String(message || "").toLowerCase();
  const asksForPlan = /\b(floor\s*plan|floorplan|layout|map|wayfinding|navigate|navigation)\b/.test(normalized);
  const asksAboutPlanFeature = /\b(offices?|rooms?|meeting room|reception|restaurant|dining|bar|kitchen|storage|toilets?|bathrooms?|amenit(?:y|ies)|balcony|verandah|passage|stairs?|lifts?|elevators?|exits?)\b/.test(normalized);
  if (!asksForPlan && !asksAboutPlanFeature) return null;
  return building.floorplans.map((floorplan) => findFloorplanAsset(floorplan.id)).find(Boolean) || null;
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
