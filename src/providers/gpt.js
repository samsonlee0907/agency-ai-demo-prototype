import OpenAI from "openai";
import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";
import {
  assistantJsonSchema,
  assistantOutputSchema,
  esgJsonSchema,
  esgOutputSchema,
  matchJsonSchema,
  matchOutputSchema,
  maintenanceJsonSchema,
  maintenanceOutputSchema,
  marketingJsonSchema,
  marketingOutputSchema,
  leaseJsonSchema,
  leaseOutputSchema,
  qualificationJsonSchema,
  qualificationOutputSchema,
  valuationJsonSchema,
  valuationOutputSchema
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
    const issue = validated.error.issues[0];
    const location = issue?.path?.length ? ` at ${issue.path.join(".")}` : "";
    throw new ModelResponseError(`GPT response failed validation${location}: ${issue?.message || "invalid shape"}`);
  }
  return validated.data;
}

export function groundValuationComparables(result, comparables) {
  const sources = new Map(comparables.map((comparable) => [comparable.id, comparable]));
  const ids = result.comparables.map((comparable) => comparable.id);
  if (ids.some((id) => !sources.has(id)) || new Set(ids).size !== ids.length) {
    throw new ModelResponseError("GPT returned an unknown or duplicate comparable identifier.");
  }
  return {
    ...result,
    comparables: result.comparables.map((comparable) => {
      const source = sources.get(comparable.id);
      return {
        ...comparable,
        address: `${source.address}, ${source.area}`,
        saleDate: source.saleDate,
        salePrice: source.salePrice
      };
    })
  };
}

export function groundMaintenanceAnalysis(result, asset, baseline) {
    const signals = new Map(asset.signals.map((signal) => [signal.id, signal]));
    const ids = result.evidence.map((item) => item.signalId);
    if (ids.length !== signals.size || ids.some((id) => !signals.has(id)) || new Set(ids).size !== ids.length) {
      throw new ModelResponseError("GPT returned an incomplete, unknown or duplicate maintenance signal identifier.");
    }
    const baselineEvidence = new Map(baseline.evidence.map((item) => [item.signalId, item]));
    return {
      ...result,
      healthScore: baseline.healthScore,
      failureRisk: baseline.failureRisk,
      confidence: baseline.confidence,
      predictedIssue: baseline.predictedIssue,
      forecastWindow: baseline.forecastWindow,
      evidence: result.evidence.map((item) => {
        const source = baselineEvidence.get(item.signalId);
        return {
          ...item,
          label: source.label,
          reading: source.reading,
          severity: source.severity
        };
      }),
      energyImpact: {
        ...baseline.energyImpact,
        narrative: result.energyImpact.narrative
      },
      actions: baseline.actions,
      workOrder: baseline.workOrder
    };
  }

export function groundEsgReport(result, evidence) {
    const metrics = new Map(evidence.metrics.map((metric) => [metric.key, metric]));
    const metricIds = result.metrics.map((metric) => metric.key);
    const buildings = new Map(evidence.buildings.map((building) => [building.buildingId, building]));
    const buildingIds = result.buildings.map((building) => building.buildingId);
    const disclosures = new Map(evidence.disclosures.map((disclosure) => [disclosure.topic, disclosure]));
    const disclosureIds = result.disclosures.map((disclosure) => disclosure.topic);
    const exactSet = (actual, expected) => actual.length === expected.size
      && new Set(actual).size === actual.length
      && actual.every((id) => expected.has(id));

    if (!exactSet(metricIds, metrics) || !exactSet(buildingIds, buildings) || !exactSet(disclosureIds, disclosures)) {
      throw new ModelResponseError("GPT returned incomplete, unknown or duplicate ESG evidence identifiers.");
    }

    const hasGap = evidence.disclosures.some((item) => item.status === "Gap");
    const hasPartial = evidence.disclosures.some((item) => item.status === "Partial");
    return {
      ...result,
      scope: evidence.scope,
      reportingPeriod: evidence.reportingPeriod,
      framework: evidence.framework,
      assuranceStatus: hasGap ? "Data gaps" : hasPartial ? "Draft" : "Review ready",
      metrics: result.metrics.map((metric) => ({ ...metric, ...metrics.get(metric.key), commentary: metric.commentary })),
      buildings: result.buildings.map((building) => ({ ...building, ...buildings.get(building.buildingId), insight: building.insight })),
      disclosures: result.disclosures.map((disclosure) => ({
        ...disclosure,
        ...disclosures.get(disclosure.topic),
        summary: disclosure.summary
      })),
      methodology: evidence.methodology
    };
  }
export function createGptProvider(config) {
  if (!config.configured) return null;

  const apiKey = config.authMode === "entra"
    ? getBearerTokenProvider(new DefaultAzureCredential(), "https://ai.azure.com/.default")
    : config.apiKey;
  const client = new OpenAI({
    apiKey,
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
      const keyAuthDisabled = error.status === 403 && /key based authentication is disabled/i.test(error.message);
      const roleDenied = config.authMode === "entra" && error.status === 403;
      const message = keyAuthDisabled
        ? "This resource disables API keys. Open Live Foundry settings and select Microsoft Entra ID authentication."
        : roleDenied
          ? "Microsoft Entra ID was authenticated but is not authorized for inference. Assign this identity the Cognitive Services OpenAI User role on the resource, then retry."
          : error.message;
      throw new ModelResponseError(`GPT request failed: ${message}`, error);
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
        instructions: "You are an award-winning real estate creative director. Create polished, accurate campaign content grounded only in the property facts. Avoid clichés, unsupported superlatives and fair-housing-sensitive audience assumptions. The imagePrompt is an editing direction for the property's supplied base photograph: preserve the exact architecture and camera composition, use restrained exposure, natural-light and colour improvements, and never add property features.",
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
    },
    async draftValuation(property, settings, comparables) {
      const result = await generateStructured({
        name: "valuation_draft",
        instructions: "You are an experienced Australian property valuation copilot. Draft an evidence-led indicative valuation for qualified-valuer review. Use only the supplied fictional comparable IDs and facts. Explain adjustments candidly, keep the range ordered and never represent the output as a certified valuation.",
        input: { property, settings, comparables, effectiveDate: "16 July 2026" },
        jsonSchema: valuationJsonSchema,
        outputSchema: valuationOutputSchema
      });
      return groundValuationComparables(result, comparables);
    },
    abstractLease(lease) {
      return generateStructured({
        name: "lease_abstraction",
        instructions: "You are a careful commercial lease abstraction assistant. Extract only terms supported by the supplied document text. Preserve uncertainty and conflicts, identify material deadlines and obligations, and flag the output for professional legal review. Do not infer missing clauses.",
        input: { lease },
        jsonSchema: leaseJsonSchema,
        outputSchema: leaseOutputSchema
      });
    },
    async respondToTenant(building, message, history) {
      const result = await generateStructured({
        name: "tenant_assistant_response",
        instructions: "You are a concise tenant virtual assistant for a managed property. Answer only from the supplied building knowledge and conversation. Triage maintenance safely, never invent access, lease or account facts, and direct emergencies to local emergency services before building security. Create a work order only when the user reports an actionable facilities fault. Citations must name supplied knowledge articles or building contact details.",
        input: { building, message, history },
        jsonSchema: assistantJsonSchema,
        outputSchema: assistantOutputSchema
      });
      if (result.urgency === "Emergency" && !/\b000\b/.test(result.reply)) {
        throw new ModelResponseError("GPT emergency guidance did not direct the tenant to emergency services.");
      }
      return result;
    },
    async analyseMaintenance(asset, horizon, baseline) {
      const result = await generateStructured({
        name: "predictive_maintenance_analysis",
        instructions: "You are a facilities condition-monitoring copilot. Diagnose only from the supplied fictional asset metadata and telemetry. Distinguish observed signals from predicted risk, explain uncertainty, prioritise safe technician verification, and never claim the language model itself measured the equipment. Use only supplied signal IDs and do not invent readings, costs or emissions.",
        input: { asset, horizonDays: horizon, analysisDate: "16 July 2026" },
        jsonSchema: maintenanceJsonSchema,
        outputSchema: maintenanceOutputSchema
      });
      return groundMaintenanceAnalysis(result, asset, baseline);
    },
    async draftEsgReport(settings, evidence) {
      const result = await generateStructured({
        name: "esg_sustainability_draft",
        instructions: "You are a property-portfolio sustainability reporting copilot. Produce a concise management review draft grounded only in the calculated fictional evidence supplied. Preserve all metric keys, building IDs and disclosure topics exactly once. Do not claim certification, regulatory compliance or external assurance. Flag partial evidence candidly and recommend practical owners and actions.",
        input: { settings, evidence, reportDate: "16 July 2026" },
        jsonSchema: esgJsonSchema,
        outputSchema: esgOutputSchema
      });
      return groundEsgReport(result, evidence);
    }
  };
}
