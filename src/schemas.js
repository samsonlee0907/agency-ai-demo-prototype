import { z } from "zod";

export const modeSchema = z.enum(["mock", "live"]).default("mock");
export const ASSISTANT_REPLY_MAX_LENGTH = 1600;

const providerSettingsSchema = z.object({
  endpoint: z.union([z.string().trim().url().max(500), z.literal("")]),
  apiKey: z.string().trim().max(4096).optional().default(""),
  identifier: z.string().trim().min(1).max(120),
  authMode: z.enum(["api-key", "entra"])
});

export const settingsRequestSchema = z.object({
  defaultMode: z.enum(["mock", "live"]),
  gpt: providerSettingsSchema,
  mai: providerSettingsSchema
});

export const buyerBriefSchema = z.object({
  location: z.string().trim().min(1).max(80),
  budget: z.coerce.number().int().min(500000).max(20000000),
  beds: z.coerce.number().int().min(1).max(10),
  propertyType: z.string().trim().min(1).max(40),
  priorities: z.string().trim().max(800).default("")
});

export const matchRequestSchema = z.object({
  mode: modeSchema,
  brief: buyerBriefSchema
});

const matchItemSchema = z.object({
  id: z.string(),
  score: z.number().int().min(0).max(100),
  tags: z.array(z.string()).min(1).max(5),
  rationale: z.string().min(10).max(600),
  tradeoffs: z.array(z.string()).min(1).max(3)
});

export const matchOutputSchema = z.object({
  summary: z.string().min(10).max(600),
  results: z.array(matchItemSchema).min(1).max(6)
});

export const marketingRequestSchema = z.object({
  mode: modeSchema,
  propertyId: z.string().min(1),
  settings: z.object({
    audience: z.string().trim().min(1).max(80),
    channel: z.string().trim().min(1).max(80),
    tone: z.string().trim().min(1).max(80)
  })
});

export const marketingOutputSchema = z.object({
  campaignConcept: z.string().min(3).max(80),
  headline: z.string().min(5).max(100),
  strapline: z.string().min(10).max(180),
  description: z.string().min(120).max(1800),
  socialCopy: z.string().min(40).max(900),
  highlights: z.array(z.string()).min(3).max(6),
  callToAction: z.string().min(5).max(140),
  imagePrompt: z.string().min(20).max(1200)
});

export const qualificationRequestSchema = z.object({
  mode: modeSchema,
  leadId: z.string().min(1)
});

export const qualificationOutputSchema = z.object({
  score: z.number().int().min(0).max(100),
  grade: z.enum(["Priority", "Qualified", "Nurture", "Low intent"]),
  urgency: z.enum(["Immediate", "Near term", "Exploratory"]),
  intent: z.enum(["High", "Medium", "Low"]),
  requirements: z.array(z.string()).min(2).max(8),
  rationale: z.string().min(20).max(800),
  nextAction: z.string().min(10).max(400),
  followUpSubject: z.string().min(5).max(140),
  followUpDraft: z.string().min(30).max(1600)
});

export const imageRequestSchema = z.object({
  mode: modeSchema,
  propertyId: z.string().min(1),
  prompt: z.string().trim().min(20).max(2000),
  width: z.coerce.number().int().min(768).max(1536).default(1024),
  height: z.coerce.number().int().min(768).max(1536).default(1024)
});

export const valuationRequestSchema = z.object({
  mode: modeSchema,
  propertyId: z.string().min(1),
  settings: z.object({
    purpose: z.string().trim().min(1).max(80),
    condition: z.string().trim().min(1).max(40),
    valuerNotes: z.string().trim().max(800).default("")
  })
});

const valuationComparableSchema = z.object({
  id: z.string(),
  address: z.string(),
  saleDate: z.string(),
  salePrice: z.number().int().positive(),
  adjustedValue: z.number().int().positive(),
  weight: z.number().int().min(1).max(100),
  adjustments: z.array(z.string()).min(1).max(6),
  rationale: z.string().min(10).max(500)
});

export const valuationOutputSchema = z.object({
  valueLow: z.number().int().positive(),
  valueMid: z.number().int().positive(),
  valueHigh: z.number().int().positive(),
  confidence: z.enum(["High", "Medium", "Limited"]),
  effectiveDate: z.string().min(5).max(80),
  summary: z.string().min(20).max(1000),
  comparables: z.array(valuationComparableSchema).min(3).max(5),
  marketCommentary: z.string().min(20).max(1000),
  assumptions: z.array(z.string()).min(2).max(8),
  risks: z.array(z.string()).min(1).max(6),
  signOff: z.string().min(10).max(400)
}).refine((value) => value.valueLow <= value.valueMid && value.valueMid <= value.valueHigh, {
  message: "Valuation range must be ordered low to high."
});

export const leaseRequestSchema = z.object({
  mode: modeSchema,
  leaseId: z.string().min(1)
});

export const LEASE_REVIEW_NOTE_MAX_LENGTH = 900;
export const LEASE_CLAUSE_SUMMARY_MAX_LENGTH = 600;

export const leaseOutputSchema = z.object({
  documentTitle: z.string().min(3).max(180),
  executiveSummary: z.string().min(20).max(1000),
  parties: z.object({
    landlord: z.string().min(2).max(200),
    tenant: z.string().min(2).max(200)
  }),
  premises: z.string().min(5).max(300),
  term: z.object({
    commencement: z.string().min(3).max(100),
    expiry: z.string().min(3).max(100),
    initialTerm: z.string().min(2).max(100),
    options: z.string().min(2).max(LEASE_CLAUSE_SUMMARY_MAX_LENGTH)
  }),
  rent: z.object({
    baseAnnual: z.string().min(2).max(LEASE_CLAUSE_SUMMARY_MAX_LENGTH),
    payment: z.string().min(2).max(LEASE_CLAUSE_SUMMARY_MAX_LENGTH),
    review: z.string().min(2).max(LEASE_CLAUSE_SUMMARY_MAX_LENGTH)
  }),
  incentive: z.string().min(2).max(LEASE_CLAUSE_SUMMARY_MAX_LENGTH),
  security: z.string().min(2).max(LEASE_CLAUSE_SUMMARY_MAX_LENGTH),
  outgoings: z.string().min(2).max(LEASE_CLAUSE_SUMMARY_MAX_LENGTH),
  permittedUse: z.string().min(2).max(LEASE_CLAUSE_SUMMARY_MAX_LENGTH),
  breakClause: z.string().min(2).max(LEASE_CLAUSE_SUMMARY_MAX_LENGTH),
  criticalDates: z.array(z.object({
    date: z.string().min(2).max(100),
    event: z.string().min(3).max(240),
    owner: z.enum(["Landlord", "Tenant", "Both"])
  })).min(2).max(8),
  tenantObligations: z.array(z.string()).min(2).max(10),
  landlordObligations: z.array(z.string()).min(1).max(8),
  risks: z.array(z.object({
    severity: z.enum(["High", "Medium", "Low"]),
    title: z.string().min(3).max(120),
    detail: z.string().min(10).max(500),
    clause: z.string().min(2).max(120)
  })).min(1).max(8),
  reviewNote: z.string().min(10).max(LEASE_REVIEW_NOTE_MAX_LENGTH)
});

const assistantHistoryItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1600)
});

export const assistantRequestSchema = z.object({
  mode: modeSchema,
  buildingId: z.string().min(1),
  message: z.string().trim().min(2).max(1200),
  history: z.array(assistantHistoryItemSchema).max(10).default([])
});

export const assistantOutputSchema = z.object({
  reply: z.string().min(20).max(ASSISTANT_REPLY_MAX_LENGTH),
  category: z.enum(["Building information", "Maintenance", "Access & security", "Lease & payments", "Amenity booking", "Emergency"]),
  urgency: z.enum(["Routine", "Priority", "Emergency"]),
  recommendedAction: z.string().min(5).max(500),
  citations: z.array(z.string().min(2).max(160)).min(1).max(4),
  workOrder: z.object({
    created: z.boolean(),
    reference: z.string().max(80),
    summary: z.string().max(300),
    nextUpdate: z.string().max(200)
  }),
  suggestions: z.array(
    z.string().min(2).max(160).describe("A ready-to-send tenant confirmation or answer statement, never a question.")
  ).max(3)
});

export const maintenanceRequestSchema = z.object({
  mode: modeSchema,
  assetId: z.string().min(1),
  horizon: z.coerce.number().int().refine((value) => [7, 30, 90].includes(value), "Forecast horizon must be 7, 30 or 90 days.")
});

const maintenanceEvidenceSchema = z.object({
  signalId: z.string().min(1),
  label: z.string().min(2).max(120),
  reading: z.string().min(1).max(80),
  severity: z.enum(["Normal", "Watch", "Elevated", "Critical"]),
  interpretation: z.string().min(10).max(500)
});

export const maintenanceOutputSchema = z.object({
  healthScore: z.number().int().min(0).max(100),
  failureRisk: z.enum(["Low", "Moderate", "High", "Critical"]),
  confidence: z.number().int().min(0).max(100),
  predictedIssue: z.string().min(10).max(300),
  forecastWindow: z.string().min(5).max(180),
  summary: z.string().min(20).max(1000),
  evidence: z.array(maintenanceEvidenceSchema).min(2).max(5),
  actions: z.array(z.object({
    priority: z.enum(["Now", "7 days", "30 days"]),
    action: z.string().min(10).max(500),
    owner: z.string().min(2).max(120),
    timing: z.string().min(2).max(160)
  })).min(1).max(5),
  energyImpact: z.object({
    excessKwhPerDay: z.number().min(0),
    costPerMonth: z.number().min(0),
    annualEmissionsTonnes: z.number().min(0),
    narrative: z.string().min(10).max(400)
  }),
  workOrder: z.object({
    created: z.boolean(),
    reference: z.string().max(80),
    title: z.string().max(200),
    status: z.string().max(120)
  }),
  assumptions: z.array(z.string().min(5).max(300)).min(1).max(5)
});

export const esgRequestSchema = z.object({
  mode: modeSchema,
  settings: z.object({
    scope: z.string().min(1).max(80),
    reportingPeriod: z.literal("FY2026 · 1 July 2025–30 June 2026"),
    framework: z.enum(["GRESB review draft", "NABERS evidence pack", "Internal net-zero review"]),
    focus: z.enum(["Balanced portfolio", "Carbon & energy", "Resource efficiency"])
  })
});

const esgMetricSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(2).max(120),
  value: z.number(),
  unit: z.string().min(1).max(40),
  changePercent: z.number(),
  target: z.string().min(1).max(100),
  status: z.enum(["On track", "Watch", "Off track"]),
  commentary: z.string().min(10).max(400)
});

const esgBuildingSchema = z.object({
  buildingId: z.string().min(1),
  name: z.string().min(2).max(120),
  energyIntensity: z.number().min(0),
  carbonIntensity: z.number().min(0),
  waterIntensity: z.number().min(0),
  dataCompleteness: z.number().min(0).max(100),
  status: z.enum(["On track", "Watch", "Off track"]),
  insight: z.string().min(10).max(400)
});

export const esgOutputSchema = z.object({
  scope: z.string().min(2).max(120),
  reportingPeriod: z.string().min(2).max(120),
  framework: z.string().min(2).max(120),
  assuranceStatus: z.enum(["Draft", "Review ready", "Data gaps"]),
  executiveSummary: z.string().min(30).max(1400),
  metrics: z.array(esgMetricSchema).min(4).max(8),
  buildings: z.array(esgBuildingSchema).min(1).max(3),
  disclosures: z.array(z.object({
    topic: z.string().min(2).max(120),
    status: z.enum(["Ready", "Partial", "Gap"]),
    summary: z.string().min(10).max(500),
    evidence: z.string().min(2).max(300),
    gap: z.string().max(300)
  })).min(3).max(6),
  actions: z.array(z.object({
    priority: z.enum(["High", "Medium", "Low"]),
    action: z.string().min(10).max(500),
    owner: z.string().min(2).max(120),
    dueDate: z.string().min(2).max(100),
    impact: z.string().min(5).max(300)
  })).min(2).max(6),
  methodology: z.string().min(10).max(600),
  caveats: z.array(z.string().min(5).max(300)).min(2).max(6)
});

export const matchJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "results"],
  properties: {
    summary: { type: "string" },
    results: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "score", "tags", "rationale", "tradeoffs"],
        properties: {
          id: { type: "string" },
          score: { type: "integer", minimum: 0, maximum: 100 },
          tags: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
          rationale: { type: "string" },
          tradeoffs: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 }
        }
      }
    }
  }
};

export const marketingJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["campaignConcept", "headline", "strapline", "description", "socialCopy", "highlights", "callToAction", "imagePrompt"],
  properties: {
    campaignConcept: { type: "string" },
    headline: { type: "string" },
    strapline: { type: "string" },
    description: { type: "string" },
    socialCopy: { type: "string" },
    highlights: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
    callToAction: { type: "string" },
    imagePrompt: { type: "string" }
  }
};

export const qualificationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "grade", "urgency", "intent", "requirements", "rationale", "nextAction", "followUpSubject", "followUpDraft"],
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    grade: { type: "string", enum: ["Priority", "Qualified", "Nurture", "Low intent"] },
    urgency: { type: "string", enum: ["Immediate", "Near term", "Exploratory"] },
    intent: { type: "string", enum: ["High", "Medium", "Low"] },
    requirements: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 8 },
    rationale: { type: "string" },
    nextAction: { type: "string" },
    followUpSubject: { type: "string" },
    followUpDraft: { type: "string" }
  }
};

export const valuationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["valueLow", "valueMid", "valueHigh", "confidence", "effectiveDate", "summary", "comparables", "marketCommentary", "assumptions", "risks", "signOff"],
  properties: {
    valueLow: { type: "integer" },
    valueMid: { type: "integer" },
    valueHigh: { type: "integer" },
    confidence: { type: "string", enum: ["High", "Medium", "Limited"] },
    effectiveDate: { type: "string" },
    summary: { type: "string" },
    comparables: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "address", "saleDate", "salePrice", "adjustedValue", "weight", "adjustments", "rationale"],
        properties: {
          id: { type: "string" },
          address: { type: "string" },
          saleDate: { type: "string" },
          salePrice: { type: "integer" },
          adjustedValue: { type: "integer" },
          weight: { type: "integer", minimum: 1, maximum: 100 },
          adjustments: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
          rationale: { type: "string" }
        }
      }
    },
    marketCommentary: { type: "string" },
    assumptions: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 8 },
    risks: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
    signOff: { type: "string" }
  }
};

export const leaseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["documentTitle", "executiveSummary", "parties", "premises", "term", "rent", "incentive", "security", "outgoings", "permittedUse", "breakClause", "criticalDates", "tenantObligations", "landlordObligations", "risks", "reviewNote"],
  properties: {
    documentTitle: { type: "string" },
    executiveSummary: { type: "string" },
    parties: {
      type: "object",
      additionalProperties: false,
      required: ["landlord", "tenant"],
      properties: { landlord: { type: "string" }, tenant: { type: "string" } }
    },
    premises: { type: "string" },
    term: {
      type: "object",
      additionalProperties: false,
      required: ["commencement", "expiry", "initialTerm", "options"],
      properties: {
        commencement: { type: "string" },
        expiry: { type: "string" },
        initialTerm: { type: "string" },
        options: {
          type: "string",
          description: `Lease renewal options and conditions, at most ${LEASE_CLAUSE_SUMMARY_MAX_LENGTH} characters.`
        }
      }
    },
    rent: {
      type: "object",
      additionalProperties: false,
      required: ["baseAnnual", "payment", "review"],
      properties: {
        baseAnnual: {
          type: "string",
          description: `Base-rent terms, at most ${LEASE_CLAUSE_SUMMARY_MAX_LENGTH} characters.`
        },
        payment: {
          type: "string",
          description: `Rent-payment terms, at most ${LEASE_CLAUSE_SUMMARY_MAX_LENGTH} characters.`
        },
        review: {
          type: "string",
          description: `Rent review terms, at most ${LEASE_CLAUSE_SUMMARY_MAX_LENGTH} characters.`
        }
      }
    },
    incentive: { type: "string", description: `Incentive terms, at most ${LEASE_CLAUSE_SUMMARY_MAX_LENGTH} characters.` },
    security: { type: "string", description: `Security terms, at most ${LEASE_CLAUSE_SUMMARY_MAX_LENGTH} characters.` },
    outgoings: { type: "string", description: `Outgoings terms, at most ${LEASE_CLAUSE_SUMMARY_MAX_LENGTH} characters.` },
    permittedUse: { type: "string", description: `Permitted-use terms, at most ${LEASE_CLAUSE_SUMMARY_MAX_LENGTH} characters.` },
    breakClause: { type: "string", description: `Break-clause terms, at most ${LEASE_CLAUSE_SUMMARY_MAX_LENGTH} characters.` },
    criticalDates: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "event", "owner"],
        properties: {
          date: { type: "string" },
          event: { type: "string" },
          owner: { type: "string", enum: ["Landlord", "Tenant", "Both"] }
        }
      }
    },
    tenantObligations: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 10 },
    landlordObligations: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 },
    risks: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "title", "detail", "clause"],
        properties: {
          severity: { type: "string", enum: ["High", "Medium", "Low"] },
          title: { type: "string" },
          detail: { type: "string" },
          clause: { type: "string" }
        }
      }
    },
    reviewNote: {
      type: "string",
      description: `Concise professional-review warning in one to three sentences, at most ${LEASE_REVIEW_NOTE_MAX_LENGTH} characters.`
    }
  }
};

export const assistantJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "category", "urgency", "recommendedAction", "citations", "workOrder", "suggestions"],
  properties: {
    reply: { type: "string" },
    category: { type: "string", enum: ["Building information", "Maintenance", "Access & security", "Lease & payments", "Amenity booking", "Emergency"] },
    urgency: { type: "string", enum: ["Routine", "Priority", "Emergency"] },
    recommendedAction: { type: "string" },
    citations: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
    workOrder: {
      type: "object",
      additionalProperties: false,
      required: ["created", "reference", "summary", "nextUpdate"],
      properties: {
        created: { type: "boolean" },
        reference: { type: "string" },
        summary: { type: "string" },
        nextUpdate: { type: "string" }
      }
    },
    suggestions: {
      type: "array",
      items: {
        type: "string",
        description: "A ready-to-send tenant confirmation or answer statement, never a question or an instruction for support staff."
      },
      minItems: 0,
      maxItems: 3
    }
  }
};

export const maintenanceJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["healthScore", "failureRisk", "confidence", "predictedIssue", "forecastWindow", "summary", "evidence", "actions", "energyImpact", "workOrder", "assumptions"],
  properties: {
    healthScore: { type: "integer", minimum: 0, maximum: 100 },
    failureRisk: { type: "string", enum: ["Low", "Moderate", "High", "Critical"] },
    confidence: { type: "integer", minimum: 0, maximum: 100 },
    predictedIssue: { type: "string" },
    forecastWindow: { type: "string" },
    summary: { type: "string" },
    evidence: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["signalId", "label", "reading", "severity", "interpretation"],
        properties: {
          signalId: { type: "string" },
          label: { type: "string" },
          reading: { type: "string" },
          severity: { type: "string", enum: ["Normal", "Watch", "Elevated", "Critical"] },
          interpretation: { type: "string" }
        }
      }
    },
    actions: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["priority", "action", "owner", "timing"],
        properties: {
          priority: { type: "string", enum: ["Now", "7 days", "30 days"] },
          action: { type: "string" },
          owner: { type: "string" },
          timing: { type: "string" }
        }
      }
    },
    energyImpact: {
      type: "object",
      additionalProperties: false,
      required: ["excessKwhPerDay", "costPerMonth", "annualEmissionsTonnes", "narrative"],
      properties: {
        excessKwhPerDay: { type: "number", minimum: 0 },
        costPerMonth: { type: "number", minimum: 0 },
        annualEmissionsTonnes: { type: "number", minimum: 0 },
        narrative: { type: "string" }
      }
    },
    workOrder: {
      type: "object",
      additionalProperties: false,
      required: ["created", "reference", "title", "status"],
      properties: {
        created: { type: "boolean" },
        reference: { type: "string" },
        title: { type: "string" },
        status: { type: "string" }
      }
    },
    assumptions: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 }
  }
};

export const esgJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["scope", "reportingPeriod", "framework", "assuranceStatus", "executiveSummary", "metrics", "buildings", "disclosures", "actions", "methodology", "caveats"],
  properties: {
    scope: { type: "string" },
    reportingPeriod: { type: "string" },
    framework: { type: "string" },
    assuranceStatus: { type: "string", enum: ["Draft", "Review ready", "Data gaps"] },
    executiveSummary: { type: "string" },
    metrics: {
      type: "array",
      minItems: 4,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "label", "value", "unit", "changePercent", "target", "status", "commentary"],
        properties: {
          key: { type: "string" },
          label: { type: "string" },
          value: { type: "number" },
          unit: { type: "string" },
          changePercent: { type: "number" },
          target: { type: "string" },
          status: { type: "string", enum: ["On track", "Watch", "Off track"] },
          commentary: { type: "string" }
        }
      }
    },
    buildings: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["buildingId", "name", "energyIntensity", "carbonIntensity", "waterIntensity", "dataCompleteness", "status", "insight"],
        properties: {
          buildingId: { type: "string" },
          name: { type: "string" },
          energyIntensity: { type: "number" },
          carbonIntensity: { type: "number" },
          waterIntensity: { type: "number" },
          dataCompleteness: { type: "number", minimum: 0, maximum: 100 },
          status: { type: "string", enum: ["On track", "Watch", "Off track"] },
          insight: { type: "string" }
        }
      }
    },
    disclosures: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["topic", "status", "summary", "evidence", "gap"],
        properties: {
          topic: { type: "string" },
          status: { type: "string", enum: ["Ready", "Partial", "Gap"] },
          summary: { type: "string" },
          evidence: { type: "string" },
          gap: { type: "string" }
        }
      }
    },
    actions: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["priority", "action", "owner", "dueDate", "impact"],
        properties: {
          priority: { type: "string", enum: ["High", "Medium", "Low"] },
          action: { type: "string" },
          owner: { type: "string" },
          dueDate: { type: "string" },
          impact: { type: "string" }
        }
      }
    },
    methodology: { type: "string" },
    caveats: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6 }
  }
};
