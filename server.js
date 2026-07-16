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
import { saveSettings, settingsToEnv } from "./src/settings-store.js";
import {
  imageRequestSchema,
  marketingRequestSchema,
  matchRequestSchema,
  qualificationRequestSchema,
  settingsRequestSchema
} from "./src/schemas.js";

const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(root, ".env");
const runtime = {};

function applyConfig(env = process.env) {
  runtime.config = getConfig(env);
  runtime.gpt = createGptProvider(runtime.config.gpt);
  runtime.mai = createMaiImageProvider(runtime.config.mai);
}

applyConfig();

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

function requireLocalRequest(request, _response, next) {
  const address = request.socket.remoteAddress;
  if (address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1") {
    next();
    return;
  }
  const error = new Error("Portal model settings can only be changed from the local machine.");
  error.status = 403;
  next(error);
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
  response.json(publicStatus(runtime.config));
});

app.get("/api/settings", requireLocalRequest, (_request, response) => {
  response.json({
    defaultMode: runtime.config.requestedMode,
    gpt: {
      endpoint: runtime.config.gpt.endpoint,
      identifier: runtime.config.gpt.deployment,
      hasApiKey: Boolean(runtime.config.gpt.apiKey)
    },
    mai: {
      endpoint: runtime.config.mai.endpoint,
      identifier: runtime.config.mai.model,
      hasApiKey: Boolean(runtime.config.mai.apiKey)
    }
  });
});

app.put("/api/settings", requireLocalRequest, async (request, response, next) => {
  try {
    const settings = settingsRequestSchema.parse(request.body);
    const values = settingsToEnv(settings, runtime.config);
    await saveSettings(envPath, values);
    Object.assign(process.env, values);
    applyConfig(process.env);
    response.json(publicStatus(runtime.config));
  } catch (error) {
    next(error);
  }
});

app.get("/api/bootstrap", (_request, response) => {
  response.json({ listings, leads });
});

app.post("/api/match", async (request, response, next) => {
  try {
    const { mode, brief } = matchRequestSchema.parse(request.body);
    const output = mode === "live"
      ? await requireLiveProvider(runtime.gpt, "GPT-5.4").rankProperties(brief, listings)
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
      ? await requireLiveProvider(runtime.gpt, "GPT-5.4").generateMarketing(property, settings)
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
      ? await requireLiveProvider(runtime.gpt, "GPT-5.4").qualifyLead(lead, resolveListing(lead.propertyId))
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
      ? await requireLiveProvider(runtime.mai, "MAI-Image-2.5").generate({ prompt, width, height })
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

export function startServer(port = runtime.config.port) {
  return app.listen(port, () => {
    console.log(`Aurelia Agency AI is running at http://localhost:${port}`);
    console.log(`Mode: ${runtime.config.defaultMode} | GPT: ${runtime.config.gpt.configured ? "configured" : "not configured"} | MAI: ${runtime.config.mai.configured ? "configured" : "not configured"}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer();
}

export { app };
