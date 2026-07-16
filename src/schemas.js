import { z } from "zod";

export const modeSchema = z.enum(["mock", "live"]).default("mock");

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
