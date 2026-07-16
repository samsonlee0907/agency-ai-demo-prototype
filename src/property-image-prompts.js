const propertyScenes = {
  "harbour-house": "Street-facing view of a renovated two-storey Sydney family house with pale rendered masonry, sandstone details, a compact landscaped front garden, mature hedge and a subtle harbour glimpse down the side boundary.",
  "atelier-residence": "Street-level view of a genuine converted red-brick warehouse apartment building in Surry Hills, with retained industrial windows, a modest contemporary entrance, neighbouring terraces and an established urban streetscape.",
  "palm-court": "Courtyard-facing view of a well-kept two-storey Mosman townhouse with warm brick, painted timber, a practical paved terrace, established palms and comfortable house-like proportions.",
  "coastline-pavilion": "Coastal-side view of a contemporary but believable Bronte family house in concrete, timber and glass, with a compact pool terrace, native planting and a partial ocean outlook on a dense residential site.",
  gardenia: "Straight-on street photograph of a restored Victorian terrace in Woollahra, with original iron lacework, cream stucco, a narrow frontage, small established garden and neighbouring terrace facades visible.",
  "skyline-penthouse": "Authentic interior photograph of a Barangaroo penthouse living room opening to a practical balcony, with refined but restrained furnishings, large windows and a credible Sydney harbour and city outlook."
};

const authenticPhotographyDirection = [
  "Create an authentic professional real-estate listing photograph.",
  "The property should look physically plausible, established and ready to inspect, not like a fantasy concept or luxury resort.",
  "Use natural mid-morning daylight, an eye-level architectural camera, straight verticals, realistic room and building proportions, subtle material variation and restrained neutral colour.",
  "Include small signs of real life such as mature planting and natural weathering while keeping the property tidy.",
  "No people, text, logos, signs, watermarks, fisheye distortion, dramatic sunset, cinematic colour grading or impossible architecture."
].join(" ");

export function createBaseImagePrompt(listing) {
  const scene = propertyScenes[listing.id];
  if (!scene) throw new Error(`No base image scene is defined for ${listing.id}.`);
  return `${authenticPhotographyDirection} ${scene} Represent these facts faithfully: ${listing.type}, ${listing.beds} bedrooms, ${listing.baths} bathrooms, ${listing.features.join(", ")}. Landscape 4:3 composition with the property as the clear subject.`;
}

export function createCampaignEditPrompt(direction) {
  return [
    "Edit the supplied property photograph rather than inventing a different property.",
    "Preserve the exact building identity, architecture, massing, windows, materials, landscaping, room layout and camera position.",
    "Apply the requested campaign direction with a clearly visible but still authentic change to exposure, natural light, colour balance, clarity, staging or atmosphere.",
    "Do not add rooms, pools, views, structures or features that are not visible in the source. Do not make the property more luxurious or dramatic than it is.",
    direction,
    "Return a photorealistic real-estate campaign image with no people, text, logos or watermark."
  ].join(" ");
}
