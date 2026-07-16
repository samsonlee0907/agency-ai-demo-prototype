import { findListing, findLead, listings } from "./data.js";

const priorityMap = new Map([
  ["water", "water views"],
  ["harbour", "water views"],
  ["ocean", "water views"],
  ["school", "schools"],
  ["quiet", "quiet street"],
  ["outdoor", "outdoor entertaining"],
  ["garden", "outdoor entertaining"],
  ["walk", "walkability"],
  ["restaurant", "restaurants"],
  ["design", "design"],
  ["light", "natural light"],
  ["maintenance", "low maintenance"],
  ["beach", "beach"],
  ["character", "character"],
  ["luxury", "luxury"]
]);

function formatMoney(value) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(value);
}

function extractPriorities(text) {
  const normalized = text.toLowerCase();
  return [...new Set(
    [...priorityMap.entries()]
      .filter(([term]) => normalized.includes(term))
      .map(([, attribute]) => attribute)
  )];
}

function scoreListing(listing, brief) {
  const locationMatch = brief.location === "Any Sydney" || listing.area.toLowerCase() === brief.location.toLowerCase();
  const budgetRatio = listing.price / brief.budget;
  const budgetScore = budgetRatio <= 1 ? 25 : Math.max(0, 25 - Math.round((budgetRatio - 1) * 80));
  const bedsScore = listing.beds >= brief.beds ? 14 : Math.max(0, 14 - (brief.beds - listing.beds) * 7);
  const typeMatch = brief.propertyType === "Any type" || listing.type === brief.propertyType;
  const priorities = extractPriorities(brief.priorities);
  const priorityMatches = priorities.filter((priority) => listing.attributes.includes(priority));
  const priorityScore = priorities.length ? Math.round((priorityMatches.length / priorities.length) * 29) : 20;
  const score = Math.min(99, Math.max(35, budgetScore + (locationMatch ? 22 : 8) + bedsScore + (typeMatch ? 10 : 3) + priorityScore));

  const tags = [
    ...(locationMatch ? ["Location fit"] : []),
    ...(listing.price <= brief.budget ? ["Within budget"] : []),
    ...(listing.beds >= brief.beds ? [`${listing.beds} bedrooms`] : []),
    ...priorityMatches.slice(0, 2).map((value) => value.replace(/\b\w/g, (letter) => letter.toUpperCase()))
  ].slice(0, 5);

  const strengths = [
    locationMatch ? `in the preferred ${listing.area} pocket` : `within reach of ${brief.location}`,
    listing.beds >= brief.beds ? `meets the ${brief.beds}-bedroom requirement` : "offers efficient, flexible accommodation",
    priorityMatches.length ? `aligns with ${priorityMatches.join(" and ")}` : listing.features[0].toLowerCase()
  ];

  const tradeoffs = [];
  if (listing.price > brief.budget) tradeoffs.push(`${formatMoney(listing.price - brief.budget)} above the stated budget`);
  if (!locationMatch) tradeoffs.push(`Outside the preferred ${brief.location} area`);
  if (listing.beds < brief.beds) tradeoffs.push(`One fewer bedroom than requested`);
  if (!typeMatch) tradeoffs.push(`${listing.type} rather than ${brief.propertyType.toLowerCase()}`);
  if (!tradeoffs.length) tradeoffs.push("Strong demand may require decisive inspection timing");

  return {
    id: listing.id,
    score,
    tags: tags.length ? tags : ["Considered match"],
    rationale: `${listing.name} stands out because it is ${strengths.join(", and ")}.`,
    tradeoffs: tradeoffs.slice(0, 2)
  };
}

export function matchProperties(brief) {
  const results = listings
    .map((listing) => scoreListing(listing, brief))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 4);

  return {
    summary: `We assessed ${listings.length} curated properties against budget, location, accommodation and the buyer's stated lifestyle priorities. ${results[0].id === "harbour-house" ? "Harbour House leads the shortlist." : `${findListing(results[0].id).name} is the strongest overall fit.`}`,
    results
  };
}

const toneWords = {
  "Refined editorial": "considered",
  "Warm and inviting": "welcoming",
  "Confident luxury": "exceptional",
  "Direct and modern": "distinctive"
};

export function generateMarketing(propertyId, settings) {
  const property = findListing(propertyId);
  const toneWord = toneWords[settings.tone] || "considered";
  const audience = settings.audience.toLowerCase();
  const featureLead = property.features.slice(0, 3).join(", ");

  return {
    headline: `${property.name} — ${toneWord} living in ${property.area}`,
    description: `For ${audience}, ${property.name} offers a rare sense of arrival in one of ${property.area}'s most desirable settings. ${property.description} Across ${property.beds} bedrooms and ${property.baths} beautifully appointed bathrooms, every space has been shaped for an easy, elevated rhythm of life. ${featureLead} complete a home of enduring appeal.`,
    socialCopy: `A new perspective on ${property.area}. ${property.name} pairs ${property.features[0].toLowerCase()} with ${property.features[1].toLowerCase()} — designed for ${audience}. ${formatMoney(property.price)} · ${property.beds} bed · ${property.baths} bath. #SydneyProperty #${property.area.replace(/\s/g, "")}`,
    highlights: property.features.slice(0, 4),
    imagePrompt: `Premium editorial real estate campaign photograph of ${property.name}, a ${property.type.toLowerCase()} in ${property.area}, Sydney. Emphasise ${property.features.slice(0, 3).join(", ").toLowerCase()}. Warm late-afternoon natural light, restrained ivory and sandstone palette, refined architectural photography, authentic materials, cinematic 4:3 composition, no people, no text, suitable for ${settings.channel.toLowerCase()}.`
  };
}

const qualificationFixtures = {
  "lead-amanda": {
    score: 94,
    grade: "Priority",
    urgency: "Immediate",
    intent: "High",
    requirements: ["Four bedrooms", "Quiet street", "Strong local schools", "Budget to $4.8m", "Saturday inspection", "Relocating within six weeks"],
    rationale: "Amanda has a defined six-week timeline, approved finance, a budget aligned with the guide and a specific inspection request. The enquiry contains both strong need and clear ability to proceed.",
    nextAction: "Call within 15 minutes to confirm Saturday access and offer a private relocation briefing.",
    followUpSubject: "Harbour House — Saturday inspection",
    followUpDraft: "Hi Amanda,\n\nThank you for your enquiry about Harbour House. Its four-bedroom layout, quiet setting and proximity to leading schools align closely with what you described for your move from Melbourne.\n\nI can arrange an inspection this Saturday and would be pleased to share a concise relocation overview before you visit. Would 10:30am or 12:00pm suit you better?\n\nWarm regards,\nAlex"
  },
  "lead-james": {
    score: 68,
    grade: "Qualified",
    urgency: "Exploratory",
    intent: "Medium",
    requirements: ["Warehouse character", "Near Central", "Strata information", "Comparable sales", "6–12 month horizon"],
    rationale: "James has a credible property preference and asks detailed due-diligence questions, but his broad timeline and active suburb comparison indicate an early-stage search.",
    nextAction: "Send the strata pack and two relevant comparables, then schedule a 10-minute search brief.",
    followUpSubject: "The Atelier Residence — strata and recent sales",
    followUpDraft: "Hi James,\n\nThanks for reaching out about The Atelier Residence. I agree its warehouse proportions and Central access make it a compelling city-fringe option.\n\nI’ll send through the strata summary and a selection of recent comparable sales. Once you have reviewed them, a short call would help me refine the right suburbs and opportunities for your 6–12 month timeframe.\n\nKind regards,\nAlex"
  },
  "lead-priya": {
    score: 86,
    grade: "Priority",
    urgency: "Near term",
    intent: "High",
    requirements: ["Three or four bedrooms", "Minimal stairs", "Private outdoor space", "Village access", "Cash purchase after next month"],
    rationale: "Priya and Arun have a defined downsizing brief, a near-term liquidity event and requirements that strongly align with Palm Court. Their timing and likely purchase position warrant priority follow-up.",
    nextAction: "Call today to clarify accessibility needs and arrange a quiet pre-market-style inspection.",
    followUpSubject: "Palm Court — a considered downsizing option",
    followUpDraft: "Hi Priya and Arun,\n\nThank you for the introduction. Palm Court’s house-like proportions, private courtyard and easy village access appear well matched to your downsizing brief.\n\nI’d like to clarify your preferences around stairs and can then arrange a relaxed private inspection. I’m available later today or tomorrow morning if either suits.\n\nWarm regards,\nAlex"
  },
  "lead-oliver": {
    score: 39,
    grade: "Nurture",
    urgency: "Exploratory",
    intent: "Low",
    requirements: ["Price guide", "Short-term letting rules", "Coastal property interest"],
    rationale: "Oliver's enquiry is property-specific but lacks a purchase timeframe, financing context or stated residential need. The short-term letting question may indicate investment curiosity rather than active intent.",
    nextAction: "Reply with the guide and planning caveat, then invite him to share investment criteria.",
    followUpSubject: "Coastline Pavilion — price guide and letting information",
    followUpDraft: "Hi Oliver,\n\nThank you for your message about Coastline Pavilion. The current guide is $5.25m.\n\nShort-term letting can depend on council, strata and intended-use requirements, so I can share the relevant property information but recommend confirming the position independently. If you’re considering a coastal investment, I’d be happy to understand your preferred return and timeframe.\n\nKind regards,\nAlex"
  }
};

export function qualifyLead(leadId) {
  if (!findLead(leadId)) throw new Error("Lead not found.");
  return structuredClone(qualificationFixtures[leadId]);
}

export function getMockImage(propertyId, prompt) {
  const property = findListing(propertyId);
  return {
    imageUrl: property.image,
    prompt,
    generated: false,
    model: "Mock creative preview"
  };
}
