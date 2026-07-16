import OpenAI from "openai";
import {
  matchJsonSchema,
  matchOutputSchema,
  marketingJsonSchema,
  marketingOutputSchema,
  qualificationJsonSchema,
  qualificationOutputSchema
} from "../schemas.js";

export class ModelResponseError extends Error {
  constructor(message, cause) {
    super(message, { cause });
    this.name = "ModelResponseError";
  }
}

function parseJsonOutput(text, schema) {
  if (!text || typeof text !== "string") {
    throw new ModelResponseError("GPT returned an empty response.");
  }

  let parsed;
  try {
    parsed = JSON.parse(text.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, ""));
  } catch (error) {
    throw new ModelResponseError("GPT returned malformed JSON.", error);
  }

  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    throw new ModelResponseError(`GPT response failed validation: ${validated.error.issues[0]?.message || "invalid shape"}`);
  }
  return validated.data;
}

export function createGptProvider(config) {
  if (!config.configured) return null;

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.endpoint,
    timeout: 120000,
    maxRetries: 1
  });

  async function generateStructured({ name, instructions, input, jsonSchema, outputSchema }) {
    let response;
    try {
      response = await client.responses.create({
        model: config.deployment,
        input: [
          {
            role: "developer",
            content: [{ type: "input_text", text: `${instructions}\nReturn only data matching the supplied strict JSON schema. Do not invent property or lead identifiers.` }]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: JSON.stringify(input) }]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name,
            strict: true,
            schema: jsonSchema
          }
        }
      });
    } catch (error) {
      throw new ModelResponseError(`GPT request failed: ${error.message}`, error);
    }

    return parseJsonOutput(response.output_text, outputSchema);
  }

  return {
    async rankProperties(brief, listings) {
      const result = await generateStructured({
        name: "property_matches",
        instructions: "You are a senior Sydney buyer's agent. Rank the supplied listings against the buyer brief. Use only listing IDs provided. Scores must be calibrated, rationales concise and evidence-based, and trade-offs candid.",
        input: { brief, listings },
        jsonSchema: matchJsonSchema,
        outputSchema: matchOutputSchema
      });
      const validIds = new Set(listings.map((listing) => listing.id));
      const resultIds = result.results.map((item) => item.id);
      if (resultIds.some((id) => !validIds.has(id)) || new Set(resultIds).size !== resultIds.length) {
        throw new ModelResponseError("GPT returned an unknown or duplicate property identifier.");
      }
      return result;
    },
    generateMarketing(property, settings) {
      return generateStructured({
        name: "property_campaign",
        instructions: "You are an award-winning real estate creative director. Create polished, accurate campaign content grounded only in the property facts. Avoid clichés, unsupported superlatives and fair-housing-sensitive audience assumptions.",
        input: { property, settings },
        jsonSchema: marketingJsonSchema,
        outputSchema: marketingOutputSchema
      });
    },
    qualifyLead(lead, property) {
      return generateStructured({
        name: "lead_qualification",
        instructions: "You are an experienced real estate sales operations agent. Extract requirements, assess purchase intent without overstating certainty, recommend a practical next action, and draft a concise personal follow-up.",
        input: { lead, property },
        jsonSchema: qualificationJsonSchema,
        outputSchema: qualificationOutputSchema
      });
    }
  };
}
