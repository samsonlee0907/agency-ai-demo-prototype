export const listings = [
  {
    id: "harbour-house",
    name: "Harbour House",
    location: "Double Bay, Sydney",
    area: "Double Bay",
    price: 4650000,
    beds: 4,
    baths: 3,
    parking: 2,
    type: "House",
    image: "/assets/harbour-house.svg",
    description: "A composed family residence with harbour glimpses, a private garden and effortless village access.",
    features: ["Harbour outlook", "Private garden", "Walkable village", "Home office"],
    attributes: ["water views", "schools", "quiet street", "outdoor entertaining", "walkability"]
  },
  {
    id: "atelier-residence",
    name: "The Atelier Residence",
    location: "Surry Hills, Sydney",
    area: "Surry Hills",
    price: 2380000,
    beds: 3,
    baths: 2,
    parking: 1,
    type: "Apartment",
    image: "/assets/atelier-residence.svg",
    description: "An architectural warehouse conversion balancing dramatic volume with a warm, highly resolved interior.",
    features: ["Warehouse volume", "Designer kitchen", "City fringe", "Secure parking"],
    attributes: ["design", "restaurants", "walkability", "natural light", "low maintenance"]
  },
  {
    id: "palm-court",
    name: "Palm Court",
    location: "Mosman, Sydney",
    area: "Mosman",
    price: 3890000,
    beds: 4,
    baths: 3,
    parking: 2,
    type: "Townhouse",
    image: "/assets/palm-court.svg",
    description: "A private north-facing townhouse with house-like proportions and a sunlit courtyard garden.",
    features: ["North facing", "Courtyard", "Village setting", "Turnkey finish"],
    attributes: ["schools", "quiet street", "outdoor entertaining", "natural light", "low maintenance"]
  },
  {
    id: "coastline-pavilion",
    name: "Coastline Pavilion",
    location: "Bronte, Sydney",
    area: "Bronte",
    price: 5250000,
    beds: 5,
    baths: 4,
    parking: 2,
    type: "House",
    image: "/assets/coastline-pavilion.svg",
    description: "A sculptural coastal home designed around ocean light, layered terraces and relaxed family living.",
    features: ["Ocean views", "Pool", "Five bedrooms", "Beach access"],
    attributes: ["water views", "beach", "outdoor entertaining", "schools", "natural light"]
  },
  {
    id: "gardenia",
    name: "Gardenia",
    location: "Woollahra, Sydney",
    area: "Woollahra",
    price: 3150000,
    beds: 3,
    baths: 2,
    parking: 1,
    type: "Terrace",
    image: "/assets/gardenia.svg",
    description: "A refined Victorian terrace reimagined with a quiet material palette and a lush rear garden.",
    features: ["Period detail", "Landscaped garden", "Village lifestyle", "Custom joinery"],
    attributes: ["character", "walkability", "restaurants", "quiet street", "outdoor entertaining"]
  },
  {
    id: "skyline-penthouse",
    name: "Skyline Penthouse",
    location: "Barangaroo, Sydney",
    area: "Barangaroo",
    price: 6950000,
    beds: 3,
    baths: 3,
    parking: 2,
    type: "Penthouse",
    image: "/assets/skyline-penthouse.svg",
    description: "A panoramic harbour penthouse with hotel-level amenities and exacting contemporary detailing.",
    features: ["Panoramic harbour", "Concierge", "Private lift", "Entertainer terrace"],
    attributes: ["water views", "luxury", "restaurants", "walkability", "low maintenance"]
  }
];

export const leads = [
  {
    id: "lead-amanda",
    name: "Amanda Chen",
    initials: "AC",
    source: "Website enquiry",
    received: "12 min ago",
    propertyId: "harbour-house",
    message: "We have sold in Melbourne and are relocating in six weeks. Harbour House looks ideal. We need four bedrooms, a quiet street and good schools. Can inspect this Saturday and have finance approved to $4.8m.",
    contact: "amanda.chen@example.com"
  },
  {
    id: "lead-james",
    name: "James Walker",
    initials: "JW",
    source: "REA campaign",
    received: "48 min ago",
    propertyId: "atelier-residence",
    message: "I like the warehouse style and work near Central. Still comparing a few suburbs and likely 6-12 months away. Could you send strata details and recent comparable sales?",
    contact: "j.walker@example.com"
  },
  {
    id: "lead-priya",
    name: "Priya & Arun Mehta",
    initials: "PM",
    source: "Agent referral",
    received: "Yesterday",
    propertyId: "palm-court",
    message: "Looking to downsize from our family home. We want three or four bedrooms, minimal stairs, outdoor space and village access. Cash buyers once our auction settles next month.",
    contact: "priya.mehta@example.com"
  },
  {
    id: "lead-oliver",
    name: "Oliver Grant",
    initials: "OG",
    source: "Instagram",
    received: "2 days ago",
    propertyId: "coastline-pavilion",
    message: "Beautiful place. Just curious what the guide is and whether short-term holiday letting is permitted?",
    contact: "oliver.g@example.com"
  }
];

export function findListing(id) {
  return listings.find((listing) => listing.id === id);
}

export function findLead(id) {
  return leads.find((lead) => lead.id === id);
}
