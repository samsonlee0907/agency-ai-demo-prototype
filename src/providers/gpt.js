import OpenAI from "openai";
import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";
import { filterSuggestedReplies } from "../assistant-conversation.js";
import {
  buildFloorplanAttachment,
  emptyFloorplanAttachment
} from "../floorplan-assets.js";
import {
  floorplanCatalogForModel,
  groundFloorplanAnnotation,
  verifyFloorplanReply
} from "../floorplan-regions.js";
import {
  ASSISTANT_REPLY_MAX_LENGTH,
  assistantJsonSchema,
  assistantModelOutputSchema,
  assistantOutputSchema,
  esgJsonSchema,
  esgOutputSchema,
  matchJsonSchema,
  matchOutputSchema,
  maintenanceJsonSchema,
  maintenanceOutputSchema,
  marketingJsonSchema,
  marketingOutputSchema,
  LEASE_CLAUSE_SUMMARY_MAX_LENGTH,
  LEASE_REVIEW_NOTE_MAX_LENGTH,
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

const emergencyGuidance = "If there is immediate danger, fire, injury or an electrical hazard, call 000 now and keep clear of the area.";

export function ensureEmergencyGuidance(result) {
  if (result.urgency !== "Emergency" || /\b000\b/.test(result.reply)) {
    return result;
  }

  const availableLength = ASSISTANT_REPLY_MAX_LENGTH - emergencyGuidance.length - 1;
  const originalReply = result.reply.length <= availableLength
    ? result.reply
    : `${result.reply.slice(0, availableLength - 3).trimEnd()}...`;
  return {
    ...result,
    reply: `${emergencyGuidance} ${originalReply}`
  };
}

export function normalizeAssistantFollowUps(result, history = []) {
  const questions = result.suggestions.filter((suggestion) => suggestion.trim().endsWith("?"));
  let reply = result.reply;
  for (const question of questions) {
    if (!reply.includes(question) && reply.length + question.length + 1 <= ASSISTANT_REPLY_MAX_LENGTH) {
      reply += ` ${question}`;
    }
  }
  return {
    ...result,
    reply,
    suggestions: filterSuggestedReplies(
      result.suggestions.filter((suggestion) => !suggestion.trim().endsWith("?")),
      history
    )
  };
}

export function groundTenantFloorplan(result, floorplan, allowAnnotation = true, fallbackIntent = null) {
  const modelAttachment = result.floorplan;
  if (!floorplan) {
    if (modelAttachment.included || modelAttachment.assetId || modelAttachment.annotation !== null) {
      throw new ModelResponseError("GPT returned a floorplan that was not supplied for this request.");
    }
    return { ...result, floorplan: emptyFloorplanAttachment() };
  }
  if (modelAttachment.assetId && modelAttachment.assetId !== floorplan.asset.id) {
    throw new ModelResponseError("GPT returned an unknown floorplan identifier.");
  }
  if (!modelAttachment.included && modelAttachment.annotation !== null) {
    throw new ModelResponseError("GPT returned annotations for an excluded floorplan.");
  }
  // The server may carry the image for one turn so Terra can understand an
  // unrestricted follow-up. If the current question is unrelated, honor the
  // model's explicit exclusion instead of reattaching the original plan.
  if (!modelAttachment.included) {
    return { ...result, floorplan: emptyFloorplanAttachment() };
  }
  let annotation = null;
  try {
    if (allowAnnotation) {
      // Live visual intent is model-led. Deterministic phrase matching is only a
      // recovery path when the model returns no usable intent; it must never
      // override a valid interpretation of the current message and history.
      try {
        annotation = groundFloorplanAnnotation(
          floorplan.asset.id,
          modelAttachment.annotation
        );
      } catch (error) {
        const recoverableRelationshipError = /relationship|endpoint|direction|adjacency marker|route/.test(error.message);
        if (!fallbackIntent || !recoverableRelationshipError) throw error;
      }
      if (!annotation && fallbackIntent) {
        annotation = groundFloorplanAnnotation(floorplan.asset.id, fallbackIntent);
      }
    }
  } catch (error) {
    throw new ModelResponseError(`GPT returned an invalid floorplan annotation: ${error.message}`, error);
  }
  return {
    ...result,
    floorplan: buildFloorplanAttachment(
      floorplan.asset,
      allowAnnotation ? modelAttachment.caption : "",
      annotation
    )
  };
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
export function createGptProvider(config, { client: clientOverride } = {}) {
  if (!config.configured) return null;

  const client = clientOverride || new OpenAI({
    apiKey: config.authMode === "entra"
      ? getBearerTokenProvider(new DefaultAzureCredential(), "https://ai.azure.com/.default")
      : config.apiKey,
    baseURL: config.endpoint,
    timeout: 120000,
    maxRetries: 1
  });

  async function generateStructured({ name, instructions, input, jsonSchema, outputSchema, userContent = [] }) {
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
            content: [{ type: "input_text", text: JSON.stringify(input) }, ...userContent]
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
        instructions: [
          "You are the creative director of a highly regarded Australian property agency.",
          "Develop one distinctive campaign idea from the property's most ownable combination of place, architecture and lived experience; do not merely restate the feature list.",
          "Write in assured, intelligent Australian English with concrete imagery, varied sentence rhythm and editorial restraint.",
          "campaignConcept is a memorable 2–5 word internal idea. headline is public-facing, ideally under eight words, and should not default to the property name or suburb. strapline is one precise supporting sentence.",
          "description should be 150–220 words in two short paragraphs: open with a specific sense of arrival, move naturally through the home and setting, and close on the life the factual features enable.",
          "socialCopy should feel native to the selected channel, lead with a strong hook, stay between 60 and 100 words, and end with a useful next step. Use no more than two hashtags, and only for Instagram.",
          "highlights must be concise, benefit-led and factually traceable. callToAction must be specific to an inspection or agent conversation rather than generic marketing language.",
          "Avoid stock phrases and empty luxury language, including 'rare opportunity', 'prestigious', 'exceptional', 'elevated living', 'effortless', 'sanctuary', 'masterpiece', 'discover', and 'where X meets Y'.",
          "Treat audience as campaign context only; never infer protected characteristics or make exclusionary claims.",
          "The imagePrompt is an editing direction for the supplied base photograph. Make the before-and-after transformation immediately visible: choose a noticeable but believable shift in time of day, natural light, practical lighting, presentation and editorial colour, using precise imperative language rather than words such as 'gently enhance'. Preserve the exact building, materials, landscaping and camera composition; never add or remove permanent property features. Temporary campaign elements are allowed. Do not include text or brand marks in the starter prompt; the user can explicitly add those in the editable field.",
          "Use only the supplied property facts. Every sentence should earn its place."
        ].join(" "),
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
        instructions: `You are a careful commercial lease abstraction assistant. Extract only terms supported by the supplied pre-extracted document text. Preserve uncertainty and conflicts, identify material deadlines and obligations, and flag the output for professional legal review. Do not infer missing clauses. Keep each clause summary (term.options, all rent fields, incentive, security, outgoings, permittedUse and breakClause) at most ${LEASE_CLAUSE_SUMMARY_MAX_LENGTH} characters. Keep reviewNote concise: one to three sentences and at most ${LEASE_REVIEW_NOTE_MAX_LENGTH} characters.`,
        input: { lease },
        jsonSchema: leaseJsonSchema,
        outputSchema: leaseOutputSchema
      });
    },
    async respondToTenant(building, message, history, floorplan = null) {
      const annotationAllowed = Boolean(floorplan);
      const buildingContext = {
        ...building,
        floorplans: floorplan ? [floorplan.asset] : []
      };
      const floorplanCatalog = floorplan
        ? floorplanCatalogForModel(floorplan.asset.id)
        : null;
      const result = await generateStructured({
        name: "tenant_assistant_response",
        instructions: "You are a concise tenant virtual assistant for a managed property. Answer only from the supplied building knowledge, conversation and approved floorplan image when present. Triage maintenance safely and never invent access, lease or account facts. Reason over the full conversation: acknowledge confirmed facts once, advance the task, and never repeat or lightly rephrase a prior reply, question, user message or previously offered quick reply. Do not prefix reply with 'Aurelia:'. If urgency is Emergency, the reply must first tell the occupant to call 000 when there is immediate danger, then give safe keep-clear guidance before any building-security handoff. A static floorplan is for general spatial orientation only: never treat it as proof of accessibility, current occupancy, obstructions or an emergency route, and direct emergency-egress questions to posted signage and wardens. When an approved floorplan catalog and image are supplied, interpret the user's spatial intent from the current message, conversation and image rather than relying on fixed wording. Understand indirect follow-ups such as 'the other way round', 'opposite direction', 'back again' and equivalent requests. The image may have been carried over solely to let you interpret an indirect follow-up: if the current message is unrelated to the plan, set floorplan.included false, all floorplan strings empty and annotation null even though an image is present. The catalog is a verified segmentation: its exact region IDs, labels, derived fixture counts, positions, adjacency relations and circulation links are authoritative, so never re-count fixtures or override an index value from the picture. Use the image to make the answer vivid and helpful. For a question about a particular location, comparison, count or route, return visual intent using only exact catalog region IDs, primary/secondary/context roles, a relationship type, optional endpoint IDs and short reasons. For a route, set fromRegionId to the actual starting place and toRegionId to the actual destination, select those two endpoints, and use the listed circulation links to explain the connected sequence in natural prose. The server will compute and draw the exact intermediate route, so do not return coordinates or try to author the path. Say that a route is not checked for step-free access, door locking or emergency egress. For count and size relationships, set both endpoint IDs and direction to null. For location and direction relationships, include both endpoints; the server derives any omitted compass direction. Use adjacency only for a pair explicitly listed as adjacent. Never return coordinates, boxes, polygons, paths, SVG, colors, labels or dimensions. Return annotation null only when the user merely asks to view the unannotated plan or when no catalog region confidently supports the answer. Do not claim there is no connected route when the circulation links connect the selected endpoints. Ask any qualification or follow-up question directly in reply as Aurelia. Create a work order only when the user reports an actionable facilities fault. Citations must name supplied knowledge articles or building contact details. The floorplan object is required: use only the supplied asset ID when an image is supplied and relevant; otherwise set included false, strings empty and annotation null. suggestions are optional ready-to-send tenant answers or decisions that materially advance the conversation. Return an empty suggestions array when the next response requires open-ended tenant details such as a floor, area, time or description. Never offer placeholders such as 'I can confirm...' or 'I will provide...', repeat an earlier choice, put a question or Aurelia prompt in suggestions, instruct support staff, or invent a tenant fact.",
        input: { building: buildingContext, floorplanCatalog, annotationAllowed, message, history },
        jsonSchema: assistantJsonSchema,
        outputSchema: assistantModelOutputSchema,
        userContent: floorplan
          ? [{ type: "input_image", image_url: floorplan.dataUrl, detail: "original" }]
          : []
      });
      const grounded = groundTenantFloorplan(
        result,
        floorplan,
        annotationAllowed
      );
      grounded.reply = verifyFloorplanReply(
        message,
        grounded.reply,
        grounded.floorplan.annotation
      );
      const normalized = ensureEmergencyGuidance(normalizeAssistantFollowUps(
        grounded,
        [...history, { role: "user", content: message }]
      ));
      const validated = assistantOutputSchema.safeParse(normalized);
      if (!validated.success) {
        const issue = validated.error.issues[0];
        throw new ModelResponseError(`Grounded assistant response failed validation at ${issue.path.join(".")}: ${issue.message}`);
      }
      return validated.data;
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
