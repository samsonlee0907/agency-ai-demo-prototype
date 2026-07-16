import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { getConfig, publicStatus } from "./src/config.js";
import { findLead, findListing, leads, listings } from "./src/data.js";
import { generateMarketing, getMockImage, matchProperties, qualifyLead } from "./src/mock-services.js";
import { createGptProvider, ModelResponseError } from "./src/providers/gpt.js";
import { createMaiImageProvider } from "./src/providers/mai-image.js";
import {
  imageRequestSchema,
  marketingRequestSchema,
  matchRequestSchema,
  qualificationRequestSchema
} from "./src/schemas.js";

const config = getConfig();
const gpt = createGptProvider(config.gpt);
const mai = createMaiImageProvider(config.mai);
const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(root, "public"), {
  etag: true,
  maxAge: process.env.NODE_ENV === "production" ? "1h" : 0
}));

function requireLiveProvider(provider, name) {
  if (!provider) {
    const error = new Error(`${name} is not configured. Add server-side credentials before using Live Foundry mode.`);
    error.status = 503;
    throw error;
  }
  return provider;
}

function resolveListing(id) {
  const listing = findListing(id);
  if (!listing) {
    const error = new Error("Property not found.");
    error.status = 404;
    throw error;
  }
  return listing;
}

function resolveLead(id) {
  const lead = findLead(id);
  if (!lead) {
    const error = new Error("Lead not found.");
    error.status = 404;
    throw error;
  }
  return lead;
}

app.get("/api/status", (_request, response) => {
  response.json(publicStatus(config));
});

app.get("/api/bootstrap", (_request, response) => {
  response.json({ listings, leads });
});

app.post("/api/match", async (request, response, next) => {
  try {
    const { mode, brief } = matchRequestSchema.parse(request.body);
    const output = mode === "live"
      ? await requireLiveProvider(gpt, "GPT-5.4").rankProperties(brief, listings)
      : matchProperties(brief);
    response.json({ mode, ...output });
  } catch (error) {
    next(error);
  }
});

app.post("/api/marketing", async (request, response, next) => {
  try {
    const { mode, propertyId, settings } = marketingRequestSchema.parse(request.body);
    const property = resolveListing(propertyId);
    const output = mode === "live"
      ? await requireLiveProvider(gpt, "GPT-5.4").generateMarketing(property, settings)
      : generateMarketing(propertyId, settings);
    response.json({ mode, propertyId, ...output });
  } catch (error) {
    next(error);
  }
});

app.post("/api/qualify", async (request, response, next) => {
  try {
    const { mode, leadId } = qualificationRequestSchema.parse(request.body);
    const lead = resolveLead(leadId);
    const output = mode === "live"
      ? await requireLiveProvider(gpt, "GPT-5.4").qualifyLead(lead, resolveListing(lead.propertyId))
      : qualifyLead(leadId);
    response.json({ mode, leadId, ...output });
  } catch (error) {
    next(error);
  }
});

app.post("/api/image", async (request, response, next) => {
  try {
    const { mode, propertyId, prompt, width, height } = imageRequestSchema.parse(request.body);
    resolveListing(propertyId);
    const output = mode === "live"
      ? await requireLiveProvider(mai, "MAI-Image-2.5").generate({ prompt, width, height })
      : getMockImage(propertyId, prompt);
    response.json({ mode, propertyId, ...output });
  } catch (error) {
    next(error);
  }
});

app.use("/api", (request, response) => {
  response.status(404).json({ error: `Unknown API route: ${request.method} ${request.path}` });
});

app.get("*splat", (_request, response) => {
  response.sendFile(path.join(root, "public", "index.html"));
});

app.use((error, _request, response, _next) => {
  const validationError = error instanceof ZodError;
  const status = validationError ? 400 : error.status || (error instanceof ModelResponseError ? 502 : 500);
  const message = validationError
    ? `Invalid request: ${error.issues.map((issue) => issue.message).join(", ")}`
    : error.message || "Unexpected server error.";
  if (status >= 500) console.error(error);
  response.status(status).json({ error: message });
});

export function startServer(port = config.port) {
  return app.listen(port, () => {
    console.log(`Aurelia Agency AI is running at http://localhost:${port}`);
    console.log(`Mode: ${config.defaultMode} | GPT: ${config.gpt.configured ? "configured" : "not configured"} | MAI: ${config.mai.configured ? "configured" : "not configured"}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer();
}

export { app };
