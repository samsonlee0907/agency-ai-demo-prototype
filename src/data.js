import { meridianLeasePages, meridianLeaseSourceText } from "./lease-source.js";
import { floorplanAssets } from "./floorplan-assets.js";

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
    image: "/assets/properties/harbour-house.png",
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
    image: "/assets/properties/atelier-residence.png",
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
    image: "/assets/properties/palm-court.png",
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
    image: "/assets/properties/coastline-pavilion.png",
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
    image: "/assets/properties/gardenia.png",
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
    image: "/assets/properties/skyline-penthouse.png",
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

export const comparableSales = [
  { id: "comp-double-bay", address: "14 Carlotta Road", area: "Double Bay", type: "House", saleDate: "18 Jun 2026", salePrice: 4480000, beds: 4, baths: 3, parking: 2, landArea: 462, condition: "Renovated", notes: "Landscaped garden; filtered harbour outlook" },
  { id: "comp-bellevue", address: "27 Victoria Road", area: "Bellevue Hill", type: "House", saleDate: "29 May 2026", salePrice: 4725000, beds: 5, baths: 3, parking: 2, landArea: 505, condition: "Good", notes: "Larger accommodation; less walkable position" },
  { id: "comp-rose-bay", address: "8 Conway Avenue", area: "Rose Bay", type: "House", saleDate: "11 Apr 2026", salePrice: 4290000, beds: 4, baths: 2, parking: 2, landArea: 478, condition: "Good", notes: "Quiet street; dated rear living zone" },
  { id: "comp-bronte", address: "31 Pacific Street", area: "Bronte", type: "House", saleDate: "3 Jul 2026", salePrice: 5180000, beds: 5, baths: 4, parking: 2, landArea: 391, condition: "Renovated", notes: "Ocean outlook and pool; compact landholding" },
  { id: "comp-mosman", address: "6A Muston Street", area: "Mosman", type: "Townhouse", saleDate: "20 Jun 2026", salePrice: 3740000, beds: 4, baths: 3, parking: 2, landArea: 286, condition: "Renovated", notes: "North-facing courtyard; boutique complex" },
  { id: "comp-neutral-bay", address: "3/22 Yeo Street", area: "Neutral Bay", type: "Townhouse", saleDate: "8 May 2026", salePrice: 3460000, beds: 3, baths: 2, parking: 2, landArea: 244, condition: "Good", notes: "Village access; smaller internal area" },
  { id: "comp-surry-hills", address: "12/46 Foster Street", area: "Surry Hills", type: "Apartment", saleDate: "26 Jun 2026", salePrice: 2290000, beds: 3, baths: 2, parking: 1, landArea: 0, condition: "Renovated", notes: "Converted warehouse; strong natural light" },
  { id: "comp-redfern", address: "5/18 Cope Street", area: "Redfern", type: "Apartment", saleDate: "15 May 2026", salePrice: 2145000, beds: 3, baths: 2, parking: 1, landArea: 0, condition: "Good", notes: "Warehouse volume; secondary location" },
  { id: "comp-woollahra", address: "19 Ocean Street", area: "Woollahra", type: "Terrace", saleDate: "7 Jun 2026", salePrice: 3075000, beds: 3, baths: 2, parking: 1, landArea: 164, condition: "Renovated", notes: "Period detail; established rear garden" },
  { id: "comp-paddington", address: "42 Underwood Street", area: "Paddington", type: "Terrace", saleDate: "23 Apr 2026", salePrice: 3210000, beds: 3, baths: 2, parking: 1, landArea: 151, condition: "Renovated", notes: "High-quality finish; smaller garden" },
  { id: "comp-barangaroo", address: "Residence 71, Barangaroo Avenue", area: "Barangaroo", type: "Penthouse", saleDate: "30 Jun 2026", salePrice: 6710000, beds: 3, baths: 3, parking: 2, landArea: 0, condition: "Renovated", notes: "Harbour aspect; full-service building" },
  { id: "comp-rocks", address: "Penthouse 2, 7 Gloucester Street", area: "The Rocks", type: "Penthouse", saleDate: "2 May 2026", salePrice: 6325000, beds: 3, baths: 3, parking: 2, landArea: 0, condition: "Good", notes: "Bridge outlook; older building amenities" }
];

export const leaseDocuments = [
  {
    id: "lease-meridian",
    title: "Meridian House · Office lease",
    fileName: "meridian-house-office-lease-demo.pdf",
    source: "Demo document library · Executed leases",
    pageCount: meridianLeasePages.length,
    pdfUrl: "/assets/documents/meridian-house-office-lease-demo.pdf",
    updated: "Executed 12 June 2026",
    content: meridianLeaseSourceText
  },
  {
    id: "lease-arcade",
    title: "The Arcade · Retail lease",
    fileName: "Arcade-Shop-6-Retail-Lease.pdf",
    source: "SharePoint · Retail portfolio",
    pageCount: 62,
    updated: "Executed 4 March 2026",
    content: `RETAIL SHOP LEASE — EXECUTED
Lessor: East Quarter Property Fund Pty Ltd
Lessee: Field & Form Homewares Pty Ltd
Premises: Shop 6, The Arcade, 112 Oxford Street, Paddington NSW 2021
Term: Four years from 15 March 2026 to 14 March 2030.
Option: One option of four years, exercisable not earlier than 12 months and not later than 9 months before expiry.
Base rent: AUD 186,000 per annum plus GST, paid monthly.
Turnover rent: 8% of annual gross sales above AUD 2,900,000.
Review: CPI annually with a minimum increase of 2.5%; market review at option.
Incentive: Lessor contribution of AUD 90,000 plus GST to approved fitout.
Security: Bank guarantee for four months base rent plus GST.
Outgoings: Lessee proportion 7.8%, excluding capital expenditure and land tax.
Permitted use: Premium homewares, gifts and related design consultation.
Core trading: 10am–5pm Monday to Saturday and 11am–4pm Sunday.
Relocation: Lessor may relocate after year two on six months notice and must pay reasonable relocation costs.
Demolition clause: Lessor may terminate after year three on six months notice with statutory compensation.
Make good: Remove signage and loose fixtures; approved fixed fitout may remain at lessor election.`
  },
  {
    id: "lease-logistics",
    title: "Southbank Exchange · Warehouse lease",
    fileName: "Southbank-Exchange-Warehouse-Lease.pdf",
    source: "Dataverse · Industrial portfolio",
    pageCount: 55,
    updated: "Draft v7 · 8 July 2026",
    content: `DRAFT INDUSTRIAL LEASE — SUBJECT TO EXECUTION
Landlord: Southbank Exchange Developments Pty Ltd
Tenant: ParcelPath Logistics Australia Pty Ltd
Premises: Warehouse 3, 18 Distribution Drive, Alexandria NSW 2015, including 18 car spaces.
Term: Seven years proposed from 1 October 2026 to 30 September 2033.
Option: Two further terms of five years each. Exercise notice between 9 and 12 months before expiry.
Base rent: AUD 985,000 per annum plus GST.
Review: 3.75% fixed annually; market review at each option with a ratchet preventing decrease.
Incentive: Twelve months net rent free, conditional on no tenant default.
Security: Bank guarantee equal to nine months gross rent. Draft schedule elsewhere states six months.
Outgoings: Tenant pays 100% of recoverable property outgoings, excluding structural capital works.
Permitted use: Storage, fulfilment and distribution of consumer goods, subject to approvals.
Break option: Tenant may break on 30 September 2031 with 12 months notice and payment equal to unamortised incentive plus six months rent.
Repairs: Tenant responsible for all non-structural repairs, loading equipment, dock levellers and service contracts.
Environmental: Baseline report required before access; tenant remediates contamination caused by its occupation.
Make good: Full reinstatement unless landlord elects to retain works.`
  }
];

export const buildingProfiles = [
  {
    id: "building-meridian",
    name: "Meridian House",
    address: "88 Pitt Street, Sydney NSW 2000",
    type: "Premium office",
    serviceHours: "Concierge 7am–7pm weekdays · Security 24/7",
    emergencyContact: "Building security · 02 9000 0188",
    floorplans: [floorplanAssets[0]],
    knowledge: [
      { title: "Building access guide", content: "Tenant passes provide 24/7 lobby and lift access. Lost passes should be reported to concierge; temporary passes require photo identification and tenant-authorised approval." },
      { title: "HVAC operating guide", content: "Base-building air conditioning runs 8am–6pm weekdays. After-hours service can be requested before 3pm and is charged to the tenant in 30-minute increments." },
      { title: "End-of-trip facilities", content: "Level B1 includes bicycle racks, showers and lockers. Day lockers release automatically at midnight; permanent lockers are allocated through the tenant facilities contact." },
      { title: "Maintenance response standard", content: "Safety and active-water incidents are dispatched immediately. Comfort issues receive an acknowledgement within 30 minutes and attendance within four business hours." },
      { title: "Meridian House Level 12 floor plan", content: "The demonstration plan shows three office areas, a central stair and storage core, toilets to the west, and reception, restaurant, kitchen and amenity areas to the east. It does not label lifts, accessible routes or emergency exits. Follow posted signage and building warden directions rather than this static plan in an emergency." }
    ]
  },
  {
    id: "building-arcade",
    name: "The Arcade",
    address: "112 Oxford Street, Paddington NSW 2021",
    type: "Retail precinct",
    serviceHours: "Centre management 8am–6pm daily · Security 24/7",
    emergencyContact: "Centre security · 02 9000 0266",
    floorplans: [],
    knowledge: [
      { title: "Retail access and deliveries", content: "Service-lane deliveries are permitted 6am–9am. Couriers arriving later must use the Oxford Street entrance and may not obstruct customer circulation." },
      { title: "Waste and recycling", content: "Cardboard must be flattened in the blue compactor. Food and general waste use the secured loading-dock bins accessible with a tenant pass." },
      { title: "After-hours faults", content: "Loss of power, active leaks and security incidents should be reported to centre security. Non-urgent lighting and comfort faults are logged for the next service window." }
    ]
  },
  {
    id: "building-southbank",
    name: "Southbank Exchange",
    address: "18 Distribution Drive, Alexandria NSW 2015",
    type: "Industrial estate",
    serviceHours: "Facilities desk 7am–5pm weekdays · Security patrol 24/7",
    emergencyContact: "Estate security · 02 9000 0344",
    floorplans: [],
    knowledge: [
      { title: "Dock and vehicle access", content: "Heavy-vehicle arrivals use Gate 2 and must book a dock window. The 10 km/h estate speed limit applies at all times." },
      { title: "Maintenance responsibilities", content: "The facilities team maintains structure and shared estate services. Tenants maintain dock equipment, warehouse lighting and equipment dedicated to their premises." },
      { title: "Emergency isolation", content: "For fire, gas, serious injury or uncontrolled spills, call 000 first and then estate security. Do not enter a plant room or attempt electrical isolation without authorization." }
    ]
  }
];

export function findListing(id) {
  return listings.find((listing) => listing.id === id);
}

export function findLead(id) {
  return leads.find((lead) => lead.id === id);
}

export function findLease(id) {
  return leaseDocuments.find((lease) => lease.id === id);
}

export function findBuilding(id) {
  return buildingProfiles.find((building) => building.id === id);
}
