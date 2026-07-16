export const maintenanceAssets = [
  {
    id: "asset-meridian-chiller-02",
    buildingId: "building-meridian",
    buildingName: "Meridian House",
    name: "Chiller CH-02",
    system: "Central chilled water",
    location: "Level 24 plant room",
    criticality: "Business critical",
    commissioned: "March 2017",
    lastService: "28 May 2026",
    operatingHours: 41862,
    dataCompleteness: 97,
    diagnosis: "Condenser fouling with developing compressor-bearing wear",
    riskOnsetDays: 14,
    forecastWindow: "14–30 days at current operating profile",
    energyImpact: { excessKwhPerDay: 186, costPerMonth: 1420, annualEmissionsTonnes: 42.7 },
    trend: [2.4, 2.5, 2.6, 2.8, 3.1, 3.5, 3.9, 4.4, 5.1, 5.8, 6.3, 6.8],
    trendUnit: "mm/s RMS vibration",
    signals: [
      { id: "compressor-vibration", label: "Compressor vibration", current: 6.8, unit: "mm/s RMS", baseline: 2.4, warning: 4.5, critical: 7.2, direction: "high" },
      { id: "condenser-approach", label: "Condenser approach temperature", current: 6.9, unit: "°C", baseline: 3.1, warning: 5, critical: 7.5, direction: "high" },
      { id: "power-draw", label: "Electrical demand", current: 176, unit: "kW", baseline: 142, warning: 165, critical: 190, direction: "high" }
    ],
    recommendedActions: [
      { priority: "Now", action: "Inspect compressor bearings and verify vibration with a calibrated handheld analyser.", owner: "Mechanical contractor", timing: "Within 24 hours" },
      { priority: "7 days", action: "Clean condenser tubes and confirm water-treatment readings before returning to full load.", owner: "Facilities manager", timing: "Next low-occupancy window" },
      { priority: "30 days", action: "Review staging logic across CH-01 and CH-02 after the maintenance intervention.", owner: "BMS engineer", timing: "After two weeks of stable data" }
    ]
  },
  {
    id: "asset-arcade-ahu-03",
    buildingId: "building-arcade",
    buildingName: "The Arcade",
    name: "Air handler AHU-03",
    system: "Retail common-area ventilation",
    location: "Roof plant deck",
    criticality: "Operational",
    commissioned: "September 2020",
    lastService: "8 July 2026",
    operatingHours: 23640,
    dataCompleteness: 94,
    diagnosis: "Filter loading and early fan-belt slip",
    riskOnsetDays: 30,
    forecastWindow: "30–60 days under current occupancy",
    energyImpact: { excessKwhPerDay: 48, costPerMonth: 365, annualEmissionsTonnes: 11 },
    trend: [286, 291, 294, 302, 310, 322, 337, 351, 364, 379, 391, 408],
    trendUnit: "Pa filter differential",
    signals: [
      { id: "filter-pressure", label: "Filter differential pressure", current: 408, unit: "Pa", baseline: 285, warning: 380, critical: 500, direction: "high" },
      { id: "fan-current", label: "Supply fan current", current: 18.7, unit: "A", baseline: 16.1, warning: 18, critical: 21, direction: "high" },
      { id: "airflow", label: "Delivered airflow", current: 8.2, unit: "m³/s", baseline: 9.1, warning: 8.5, critical: 7.8, direction: "low" }
    ],
    recommendedActions: [
      { priority: "7 days", action: "Replace the filter bank and inspect belt tension during the next approved service window.", owner: "HVAC contractor", timing: "Within 7 days" },
      { priority: "30 days", action: "Rebalance airflow after filter replacement and reset the clean-filter baseline.", owner: "BMS engineer", timing: "After filter replacement" }
    ]
  },
  {
    id: "asset-southbank-dock-07",
    buildingId: "building-southbank",
    buildingName: "Southbank Exchange",
    name: "Dock leveller DL-07",
    system: "Hydraulic loading equipment",
    location: "Warehouse 3 · Dock 7",
    criticality: "Safety critical",
    commissioned: "January 2018",
    lastService: "16 April 2026",
    operatingHours: 12810,
    dataCompleteness: 91,
    diagnosis: "Hydraulic pressure decay consistent with a developing seal leak",
    riskOnsetDays: 7,
    forecastWindow: "7–21 days based on recent cycle demand",
    energyImpact: { excessKwhPerDay: 9, costPerMonth: 68, annualEmissionsTonnes: 2.1 },
    trend: [188, 187, 185, 184, 181, 179, 176, 173, 169, 161, 154, 148],
    trendUnit: "bar peak hydraulic pressure",
    signals: [
      { id: "hydraulic-pressure", label: "Peak hydraulic pressure", current: 148, unit: "bar", baseline: 188, warning: 168, critical: 150, direction: "low" },
      { id: "cycle-time", label: "Extension cycle time", current: 20.4, unit: "s", baseline: 12.8, warning: 16, critical: 20, direction: "high" },
      { id: "motor-starts", label: "Motor starts per lift", current: 2.6, unit: "starts", baseline: 1, warning: 1.6, critical: 2.5, direction: "high" }
    ],
    recommendedActions: [
      { priority: "Now", action: "Isolate Dock 7 after the current safe unloading cycle and inspect cylinders, hoses and reservoir level.", owner: "Estate facilities", timing: "Before the next booking" },
      { priority: "7 days", action: "Complete a loaded proof test after seal repair and retain the result in the asset register.", owner: "Specialist dock contractor", timing: "Before return to service" }
    ]
  },
  {
    id: "asset-meridian-lift-03",
    buildingId: "building-meridian",
    buildingName: "Meridian House",
    name: "Passenger lift L-03",
    system: "Vertical transport",
    location: "High-rise lift bank",
    criticality: "Operational",
    commissioned: "November 2019",
    lastService: "3 July 2026",
    operatingHours: 19420,
    dataCompleteness: 99,
    diagnosis: "No developing fault detected; door-cycle time remains stable",
    riskOnsetDays: 91,
    forecastWindow: "No elevated failure risk in the next 90 days",
    energyImpact: { excessKwhPerDay: 0, costPerMonth: 0, annualEmissionsTonnes: 0 },
    trend: [4.8, 4.7, 4.8, 4.9, 4.8, 4.8, 4.7, 4.8, 4.9, 4.8, 4.8, 4.7],
    trendUnit: "seconds door cycle",
    signals: [
      { id: "door-cycle", label: "Door cycle time", current: 4.7, unit: "s", baseline: 4.8, warning: 5.8, critical: 6.5, direction: "high" },
      { id: "drive-temperature", label: "Drive temperature", current: 46, unit: "°C", baseline: 45, warning: 58, critical: 68, direction: "high" },
      { id: "levelling-error", label: "Levelling variance", current: 2.1, unit: "mm", baseline: 2, warning: 5, critical: 8, direction: "high" }
    ],
    recommendedActions: [
      { priority: "30 days", action: "Continue routine condition monitoring and retain the scheduled monthly service.", owner: "Lift contractor", timing: "Next planned service" }
    ]
  }
];

export const esgPortfolio = {
  period: "FY2026 · 1 July 2025–30 June 2026",
  methodology: "Location-based Scope 2 emissions using fictional portfolio factors; gas converted at 3.6 GJ/MWh. Metrics are illustrative and unaudited.",
  disclosures: [
    { topic: "Energy and emissions", status: "Ready", evidence: "Twelve monthly electricity and gas records mapped to all three assets", gap: "" },
    { topic: "Water stewardship", status: "Partial", evidence: "Whole-building water records available for the reporting year", gap: "Industrial tenant submeter allocation is not independently verified" },
    { topic: "Waste and circularity", status: "Partial", evidence: "Contractor weight tickets cover 11 of 12 reporting months", gap: "June waste composition is estimated from the trailing three-month mix" },
    { topic: "Targets and governance", status: "Ready", evidence: "Board-approved 2030 operational emissions target and quarterly owner register", gap: "" }
  ],
  buildings: [
    {
      buildingId: "building-meridian",
      name: "Meridian House",
      type: "Office",
      floorAreaSqm: 28500,
      electricityMwh: 2180,
      previousElectricityMwh: 2240,
      gasGj: 1640,
      renewablePercent: 38,
      previousRenewablePercent: 31,
      waterKl: 12600,
      previousWaterKl: 13200,
      wasteTonnes: 216,
      recycledTonnes: 151.2,
      previousWasteTonnes: 224,
      previousRecycledTonnes: 145.6,
      scope1Tonnes: 84,
      scope2Tonnes: 1340,
      previousEnergyMwh: 2810,
      previousEmissionsTonnes: 1515,
      targetEnergyIntensity: 88,
      occupancyPercent: 86,
      dataCompleteness: 98,
      previousDataCompleteness: 95
    },
    {
      buildingId: "building-arcade",
      name: "The Arcade",
      type: "Retail",
      floorAreaSqm: 18200,
      electricityMwh: 1740,
      previousElectricityMwh: 1880,
      gasGj: 420,
      renewablePercent: 22,
      previousRenewablePercent: 18,
      waterKl: 9400,
      previousWaterKl: 9800,
      wasteTonnes: 328,
      recycledTonnes: 196.8,
      previousWasteTonnes: 340,
      previousRecycledTonnes: 187,
      scope1Tonnes: 35,
      scope2Tonnes: 1050,
      previousEnergyMwh: 2010,
      previousEmissionsTonnes: 1168,
      targetEnergyIntensity: 96,
      occupancyPercent: 91,
      dataCompleteness: 92,
      previousDataCompleteness: 89
    },
    {
      buildingId: "building-southbank",
      name: "Southbank Exchange",
      type: "Industrial",
      floorAreaSqm: 42600,
      electricityMwh: 2980,
      previousElectricityMwh: 2890,
      gasGj: 780,
      renewablePercent: 18,
      previousRenewablePercent: 16,
      waterKl: 7400,
      previousWaterKl: 7600,
      wasteTonnes: 460,
      recycledTonnes: 368,
      previousWasteTonnes: 470,
      previousRecycledTonnes: 352.5,
      scope1Tonnes: 42,
      scope2Tonnes: 1760,
      previousEnergyMwh: 3090,
      previousEmissionsTonnes: 1804,
      targetEnergyIntensity: 72,
      occupancyPercent: 94,
      dataCompleteness: 86,
      previousDataCompleteness: 82
    }
  ]
};

export function findMaintenanceAsset(id) {
  return maintenanceAssets.find((asset) => asset.id === id);
}
