import { comparableSales, findBuilding, findLease, findListing, findLead, listings } from "./data.js";

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
    imagePrompt: `Polish the supplied base photograph of ${property.name} in ${property.area} for a ${settings.channel.toLowerCase()} campaign aimed at ${audience}. Preserve the exact property and camera composition. Gently emphasise ${property.features.slice(0, 3).join(", ").toLowerCase()} through natural light, balanced exposure and restrained editorial colour. Keep materials and architecture authentic; no added features, people or text.`
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
    model: "Authentic base image · enhancement preview"
  };
}

function roundTo(value, increment = 5000) {
  return Math.round(value / increment) * increment;
}

function comparableScore(comparable, property) {
  return (comparable.type === property.type ? 4 : 0)
    + (comparable.area === property.area ? 3 : 0)
    + (Math.abs(comparable.beds - property.beds) <= 1 ? 2 : 0)
    + (Math.abs(comparable.baths - property.baths) <= 1 ? 1 : 0);
}

export function draftValuation(propertyId, settings) {
  const property = findListing(propertyId);
  if (!property) throw new Error("Property not found.");
  const comparables = comparableSales
    .map((comparable) => ({ comparable, score: comparableScore(comparable, property) }))
    .sort((a, b) => b.score - a.score || b.comparable.salePrice - a.comparable.salePrice)
    .slice(0, 4)
    .map(({ comparable }, index) => {
      const accommodationAdjustment = (property.beds - comparable.beds) * (property.type === "Apartment" || property.type === "Penthouse" ? 110000 : 150000);
      const bathroomAdjustment = (property.baths - comparable.baths) * 70000;
      const parkingAdjustment = (property.parking - comparable.parking) * 90000;
      const locationAdjustment = comparable.area === property.area ? 0 : roundTo((property.price - comparable.salePrice) * 0.12);
      const conditionAdjustment = settings.condition === comparable.condition ? 0 : settings.condition === "Renovated" ? 125000 : -75000;
      const adjustedValue = roundTo(comparable.salePrice + accommodationAdjustment + bathroomAdjustment + parkingAdjustment + locationAdjustment + conditionAdjustment);
      const adjustments = [
        accommodationAdjustment ? `${accommodationAdjustment > 0 ? "+" : "−"} accommodation` : "Comparable accommodation",
        locationAdjustment ? `${locationAdjustment > 0 ? "+" : "−"} location` : "Same-suburb evidence",
        conditionAdjustment ? `${conditionAdjustment > 0 ? "+" : "−"} condition` : "Similar presentation"
      ];
      return {
        id: comparable.id,
        address: `${comparable.address}, ${comparable.area}`,
        saleDate: comparable.saleDate,
        salePrice: comparable.salePrice,
        adjustedValue,
        weight: [35, 30, 20, 15][index],
        adjustments,
        rationale: `${comparable.type} evidence with ${comparable.beds} bedrooms and ${comparable.baths} bathrooms. ${comparable.notes}.`
      };
    });

  const weightedEvidence = comparables.reduce((total, comparable) => total + comparable.adjustedValue * (comparable.weight / 100), 0);
  const valueMid = roundTo(weightedEvidence * 0.75 + property.price * 0.25, 25000);
  const valueLow = roundTo(valueMid * 0.96, 25000);
  const valueHigh = roundTo(valueMid * 1.04, 25000);
  const sameTypeCount = comparables.filter((comparable) => comparable.rationale.startsWith(property.type)).length;

  return {
    valueLow,
    valueMid,
    valueHigh,
    confidence: sameTypeCount >= 3 ? "High" : sameTypeCount >= 2 ? "Medium" : "Limited",
    effectiveDate: "16 July 2026",
    summary: `${property.name} is assessed at ${formatMoney(valueMid)}, within an indicative range of ${formatMoney(valueLow)} to ${formatMoney(valueHigh)} for ${settings.purpose.toLowerCase()}. The conclusion reconciles four recent fictional comparable transactions with the subject's accommodation, position and ${settings.condition.toLowerCase()} presentation.`,
    comparables,
    marketCommentary: `${property.area} demand remains selective but well-presented ${property.type.toLowerCase()} stock continues to attract depth where pricing is evidence-led. The subject's ${property.features.slice(0, 2).join(" and ").toLowerCase()} support its position within the adopted range.`,
    assumptions: [
      "Clear title and no undisclosed encumbrances, contamination or structural defects",
      "Areas, accommodation and property attributes supplied in the demo brief are accurate",
      settings.valuerNotes || "Vacant possession and normal arm's-length marketing conditions"
    ],
    risks: [
      "Limited directly comparable transactions can widen the range",
      "Interest-rate or prestige-market sentiment may change before exchange",
      "A physical inspection and verified title, planning and area data remain required"
    ],
    signOff: "AI-assisted draft only. A qualified valuer must inspect the property, verify all source evidence and approve the final opinion."
  };
}

const leaseAbstractionFixtures = {
  "lease-meridian": {
    documentTitle: "Meridian House · Office lease",
    executiveSummary: "Five-year Sydney CBD office lease with one three-year option, fixed 3.5% annual reviews and an eight-month gross rent incentive. No break right is granted. The tenant carries internal maintenance, insurance and make-good obligations.",
    parties: { landlord: "Harbour Asset Holdings Pty Ltd", tenant: "Northstar Advisory Pty Ltd" },
    premises: "Suite 4.02, Level 4, Meridian House, 88 Pitt Street, Sydney NSW 2000",
    term: { commencement: "1 August 2026", expiry: "31 July 2031", initialTerm: "5 years", options: "One further 3-year term; exercise 9–12 months before expiry" },
    rent: { baseAnnual: "AUD 420,000 plus GST", payment: "Monthly in advance", review: "3.5% fixed annually; market review at option commencement" },
    incentive: "Eight months gross rent abatement applied across the first lease year",
    security: "Unconditional bank guarantee equal to six months gross rent; replenishment required after a draw",
    outgoings: "Tenant pays 12.5% of increases in statutory and operating outgoings above the 2026 base year",
    permittedUse: "Corporate advisory and ancillary office use",
    breakClause: "No break clause",
    criticalDates: [
      { date: "1 Aug 2026", event: "Lease commencement and first incentive period", owner: "Both" },
      { date: "31 Jul 2030", event: "Option exercise window opens", owner: "Tenant" },
      { date: "31 Oct 2030", event: "Option exercise deadline", owner: "Tenant" },
      { date: "31 Jul 2031", event: "Initial term expiry and make-good", owner: "Both" }
    ],
    tenantObligations: ["Maintain internal finishes and tenant services", "Maintain AUD 20 million public liability insurance", "Comply with building rules", "Remove fitout additions and repair damage at expiry"],
    landlordObligations: ["Maintain structure, lifts, common services and base-building plant", "Provide reasonable after-hours access"],
    risks: [
      { severity: "Medium", title: "No early exit", detail: "The tenant has no contractual break right during the five-year initial term.", clause: "Break clause" },
      { severity: "Medium", title: "Make-good exposure", detail: "Fitout additions must be removed and resulting damage repaired unless otherwise agreed.", clause: "Tenant obligations" },
      { severity: "Low", title: "Base-year outgoings", detail: "Only increases above the 2026 base year are recoverable at the stated proportion.", clause: "Outgoings" }
    ],
    reviewNote: "Structured abstraction for review only; confirm defined terms, schedules, amendments and execution pages against the source PDF."
  },
  "lease-arcade": {
    documentTitle: "The Arcade · Retail lease",
    executiveSummary: "Four-year retail lease with CPI reviews subject to a 2.5% floor, turnover rent above a sales threshold and one four-year option. Relocation and demolition rights create material continuity considerations for the tenant.",
    parties: { landlord: "East Quarter Property Fund Pty Ltd", tenant: "Field & Form Homewares Pty Ltd" },
    premises: "Shop 6, The Arcade, 112 Oxford Street, Paddington NSW 2021",
    term: { commencement: "15 March 2026", expiry: "14 March 2030", initialTerm: "4 years", options: "One further 4-year term; exercise 9–12 months before expiry" },
    rent: { baseAnnual: "AUD 186,000 plus GST", payment: "Monthly", review: "Annual CPI with 2.5% minimum; market review at option; 8% turnover rent above AUD 2.9m sales" },
    incentive: "AUD 90,000 plus GST contribution to approved fitout",
    security: "Bank guarantee equal to four months base rent plus GST",
    outgoings: "7.8% tenant proportion; capital expenditure and land tax excluded",
    permittedUse: "Premium homewares, gifts and related design consultation",
    breakClause: "No tenant break; landlord relocation after year two and demolition termination after year three",
    criticalDates: [
      { date: "15 Mar 2026", event: "Lease commencement", owner: "Both" },
      { date: "14 Mar 2028", event: "Relocation right becomes available", owner: "Landlord" },
      { date: "14 Mar 2029", event: "Demolition right becomes available", owner: "Landlord" },
      { date: "14 Mar 2030", event: "Initial term expiry", owner: "Both" }
    ],
    tenantObligations: ["Trade during stated core hours", "Report gross sales for turnover-rent calculation", "Maintain approved retail use", "Remove signage and loose fixtures at expiry"],
    landlordObligations: ["Pay reasonable relocation costs if relocation right is exercised", "Pay applicable statutory compensation for demolition termination"],
    risks: [
      { severity: "High", title: "Continuity risk", detail: "Relocation and demolition rights may interrupt the tenant's established retail position.", clause: "Relocation / demolition" },
      { severity: "Medium", title: "Turnover rent", detail: "Sales above AUD 2.9 million create an additional 8% rent obligation.", clause: "Rent" },
      { severity: "Low", title: "Trading-hours covenant", detail: "Mandatory seven-day core hours may increase staffing costs.", clause: "Core trading" }
    ],
    reviewNote: "Retail leasing legislation and disclosure statements should be reviewed by counsel before relying on this abstraction."
  },
  "lease-logistics": {
    documentTitle: "Southbank Exchange · Warehouse lease",
    executiveSummary: "Draft seven-year industrial lease with fixed 3.75% annual reviews, two five-year options and a year-five tenant break subject to 12 months notice and a substantial exit payment. The draft contains inconsistent security requirements.",
    parties: { landlord: "Southbank Exchange Developments Pty Ltd", tenant: "ParcelPath Logistics Australia Pty Ltd" },
    premises: "Warehouse 3, 18 Distribution Drive, Alexandria NSW 2015, including 18 car spaces",
    term: { commencement: "1 October 2026 (proposed)", expiry: "30 September 2033", initialTerm: "7 years", options: "Two further 5-year terms; exercise 9–12 months before expiry" },
    rent: { baseAnnual: "AUD 985,000 plus GST", payment: "Not stated in extracted text", review: "3.75% fixed annually; market review at options with ratchet" },
    incentive: "Twelve months net rent free, conditional on no tenant default",
    security: "Conflict: nine months gross rent in operative clause; six months in draft schedule",
    outgoings: "Tenant pays 100% of recoverable property outgoings, excluding structural capital works",
    permittedUse: "Storage, fulfilment and distribution of consumer goods, subject to approvals",
    breakClause: "Tenant may break on 30 September 2031 with 12 months notice and payment of unamortised incentive plus six months rent",
    criticalDates: [
      { date: "1 Oct 2026", event: "Proposed commencement", owner: "Both" },
      { date: "30 Sep 2030", event: "Deadline for year-five break notice", owner: "Tenant" },
      { date: "30 Sep 2031", event: "Possible break date", owner: "Tenant" },
      { date: "30 Sep 2033", event: "Initial term expiry", owner: "Both" }
    ],
    tenantObligations: ["Maintain non-structural elements, dock equipment and service contracts", "Remediate contamination caused during occupation", "Obtain approvals for permitted use", "Complete full reinstatement unless landlord elects otherwise"],
    landlordObligations: ["Maintain structural capital elements", "Commission baseline environmental report before access"],
    risks: [
      { severity: "High", title: "Security conflict", detail: "The operative clause requires nine months gross rent while the draft schedule states six months.", clause: "Security / schedule" },
      { severity: "High", title: "Costly break right", detail: "Exercising the break requires repayment of unamortised incentive plus six months rent.", clause: "Break option" },
      { severity: "Medium", title: "Incentive clawback", detail: "The rent-free incentive is conditional on no tenant default, but consequences require clarification.", clause: "Incentive" }
    ],
    reviewNote: "Draft document: resolve the security inconsistency, payment frequency and incentive clawback mechanics before execution."
  }
};

export function abstractLease(leaseId) {
  if (!findLease(leaseId)) throw new Error("Lease not found.");
  return structuredClone(leaseAbstractionFixtures[leaseId]);
}

export function answerTenant(buildingId, message) {
  const building = findBuilding(buildingId);
  if (!building) throw new Error("Building not found.");
  const normalized = message.toLowerCase();
  const findKnowledge = (pattern) => building.knowledge.find((article) => pattern.test(`${article.title} ${article.content}`));

  if (/(fire|smoke|gas|serious injury|uncontrolled spill)/.test(normalized)) {
    const emergencyGuide = findKnowledge(/emergency|after-hours|fault|safety/i) || building.knowledge[0];
    return {
      reply: `Please call emergency services on 000 now, then contact ${building.emergencyContact}. Move to a safe location and follow building warden instructions. I have not created a routine work order because this requires immediate emergency response.`,
      category: "Emergency",
      urgency: "Emergency",
      recommendedAction: "Call 000, move to safety, then notify building security.",
      citations: [emergencyGuide.title, building.emergencyContact],
      workOrder: { created: false, reference: "", summary: "Emergency escalation only", nextUpdate: "Not applicable" },
      suggestions: ["Show me the evacuation guidance", "Contact building security"]
    };
  }

  if (/(leak|water|flood|burst)/.test(normalized)) {
    const responseGuide = findKnowledge(/maintenance|fault|emergency|repair/i) || building.knowledge[0];
    const nextUpdate = /dispatched immediately/i.test(responseGuide.content)
      ? "Dispatch follows the building's immediate-response standard"
      : "Facilities will confirm attendance timing";
    return {
      reply: `I’ve logged this as a priority active-water incident for ${building.name}. If safe, move items away from the affected area and do not touch electrical equipment near the water. ${responseGuide.content}`,
      category: "Maintenance",
      urgency: "Priority",
      recommendedAction: `Keep clear of affected electrics and call ${building.emergencyContact} if the leak is worsening.`,
      citations: [responseGuide.title, building.emergencyContact],
      workOrder: { created: true, reference: "FM-260716-104", summary: "Priority water leak investigation", nextUpdate },
      suggestions: ["Add a photo to the work order", "Where is the nearest safe exit?"]
    };
  }

  if (/(air.?con|temperature|\bhot\b|\bcold\b|hvac)/.test(normalized)) {
    const hvacGuide = findKnowledge(/hvac|air conditioning|comfort|fault|maintenance/i) || building.knowledge[0];
    const scheduleDetail = /hvac|air conditioning/i.test(`${hvacGuide.title} ${hvacGuide.content}`)
      ? hvacGuide.content
      : "The available building guide does not state the HVAC schedule, so facilities will confirm the operating conditions.";
    return {
      reply: `I’ve created a comfort work order for ${building.name} so facilities can check the zone temperature, controls and airflow. ${scheduleDetail}`,
      category: "Maintenance",
      urgency: "Routine",
      recommendedAction: "Keep the local thermostat unchanged while facilities checks the zone.",
      citations: [hvacGuide.title, building.emergencyContact],
      workOrder: { created: true, reference: "FM-260716-105", summary: "Inspect HVAC comfort issue", nextUpdate: "Facilities will confirm attendance timing" },
      suggestions: ["What are the HVAC hours?", "Request after-hours air conditioning"]
    };
  }

  if (/(pass|access|card|visitor|entry)/.test(normalized)) {
    const accessGuide = findKnowledge(/access|entry|visitor|deliver/i) || building.knowledge[0];
    return {
      reply: `${accessGuide.content} If the guide does not cover your specific access issue, contact ${building.emergencyContact} so the team can verify authorization before changing access.`,
      category: "Access & security",
      urgency: "Routine",
      recommendedAction: "Report a lost credential promptly so the building team can secure access.",
      citations: [accessGuide.title, building.emergencyContact],
      workOrder: { created: false, reference: "", summary: "No work order required", nextUpdate: "Not applicable" },
      suggestions: ["What are concierge hours?", "How do I arrange visitor access?"]
    };
  }

  if (/(rent|invoice|lease|payment|outgoings)/.test(normalized)) {
    return {
      reply: "I can explain general building processes, but account balances and lease interpretation need your tenancy or property-management contact. I can route the question without exposing financial information in chat.",
      category: "Lease & payments",
      urgency: "Routine",
      recommendedAction: "Send the enquiry to the authorised property-management contact.",
      citations: [`${building.name} service hours`, building.serviceHours],
      workOrder: { created: false, reference: "", summary: "Commercial enquiry routing", nextUpdate: "Property team response within one business day" },
      suggestions: ["Find my property manager", "Ask about building outgoings"]
    };
  }

  const firstArticle = building.knowledge[0];
  return {
    reply: `${building.name} is supported by ${building.serviceHours}. ${firstArticle.content}`,
    category: "Building information",
    urgency: "Routine",
    recommendedAction: "Choose a suggested question or describe the maintenance issue in more detail.",
    citations: [firstArticle.title, building.serviceHours],
    workOrder: { created: false, reference: "", summary: "No work order required", nextUpdate: "Not applicable" },
    suggestions: ["What are the access hours?", "Report an air-conditioning issue", "Where are the building amenities?"]
  };
}
