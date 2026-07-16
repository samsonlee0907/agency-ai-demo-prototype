import { z } from "zod";

export const modeSchema = z.enum(["mock", "live"]).default("mock");

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
  headline: z.string().min(5).max(140),
  description: z.string().min(30).max(1400),
  socialCopy: z.string().min(10).max(700),
  highlights: z.array(z.string()).min(3).max(6),
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
    options: z.string().min(2).max(300)
  }),
  rent: z.object({
    baseAnnual: z.string().min(2).max(160),
    payment: z.string().min(2).max(160),
    review: z.string().min(2).max(300)
  }),
  incentive: z.string().min(2).max(300),
  security: z.string().min(2).max(300),
  outgoings: z.string().min(2).max(400),
  permittedUse: z.string().min(2).max(300),
  breakClause: z.string().min(2).max(400),
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
  reviewNote: z.string().min(10).max(400)
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
  reply: z.string().min(20).max(1600),
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
  suggestions: z.array(z.string().min(2).max(160)).min(1).max(3)
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
  required: ["headline", "description", "socialCopy", "highlights", "imagePrompt"],
  properties: {
    headline: { type: "string" },
    description: { type: "string" },
    socialCopy: { type: "string" },
    highlights: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
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
        options: { type: "string" }
      }
    },
    rent: {
      type: "object",
      additionalProperties: false,
      required: ["baseAnnual", "payment", "review"],
      properties: {
        baseAnnual: { type: "string" },
        payment: { type: "string" },
        review: { type: "string" }
      }
    },
    incentive: { type: "string" },
    security: { type: "string" },
    outgoings: { type: "string" },
    permittedUse: { type: "string" },
    breakClause: { type: "string" },
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
    reviewNote: { type: "string" }
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
    suggestions: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 }
  }
};
