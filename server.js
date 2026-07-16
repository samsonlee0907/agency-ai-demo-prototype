import "dotenv/config";
import express from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { getConfig, publicStatus } from "./src/config.js";
import { buildingProfiles, comparableSales, findBuilding, findLead, findLease, findListing, leads, leaseDocuments, listings } from "./src/data.js";
import { abstractLease, answerTenant, draftValuation, generateMarketing, getMockImage, matchProperties, qualifyLead } from "./src/mock-services.js";
import { createGptProvider, ModelResponseError } from "./src/providers/gpt.js";
import { createMaiImageProvider } from "./src/providers/mai-image.js";
import { createCampaignEditPrompt } from "./src/property-image-prompts.js";
import { saveSettings, settingsToEnv } from "./src/settings-store.js";
import {
  assistantRequestSchema,
  imageRequestSchema,
  leaseRequestSchema,
  marketingRequestSchema,
  matchRequestSchema,
  qualificationRequestSchema,
  settingsRequestSchema,
  valuationRequestSchema
} from "./src/schemas.js";

const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(root, ".env");
const runtime = {};
let settingsUpdateQueue = Promise.resolve();

function applyConfig(env = process.env) {
  runtime.config = getConfig(env);
  runtime.gpt = createGptProvider(runtime.config.gpt);
  runtime.mai = createMaiImageProvider(runtime.config.mai);
}

function resolveBuilding(id) {
  const building = findBuilding(id);
  if (!building) {
    const error = new Error("Building not found.");
    error.status = 404;
    throw error;
  }
  return building;
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
  const host = String(request.headers.host || "").toLowerCase();
  const origin = String(request.headers.origin || "");
  const localAddress = address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
  const localHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) || /^\[::1\](?::\d+)?$/.test(host);
  let localOrigin = true;
  if (origin) {
    try {
      localOrigin = ["localhost", "127.0.0.1", "::1"].includes(new URL(origin).hostname);
    } catch {
      localOrigin = false;
    }
  }
  if (localAddress && localHost && localOrigin) {
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

function resolveLease(id) {
  const lease = findLease(id);
  if (!lease) {
    const error = new Error("Lease not found.");
    error.status = 404;
    throw error;
  }
  return lease;
}

app.get("/api/status", (_request, response) => {
  response.json(publicStatus(runtime.config));
});

app.post("/api/assistant", async (request, response, next) => {
  try {
    const { mode, buildingId, message, history } = assistantRequestSchema.parse(request.body);
    const building = resolveBuilding(buildingId);
    const output = mode === "live"
      ? await requireLiveProvider(runtime.gpt, "GPT-5.4").respondToTenant(building, message, history)
      : answerTenant(buildingId, message);
    response.json({ mode, buildingId, ...output });
  } catch (error) {
    next(error);
  }
});

app.get("/api/settings", requireLocalRequest, (_request, response) => {
  response.json({
    defaultMode: runtime.config.requestedMode,
    gpt: {
      endpoint: runtime.config.gpt.endpoint,
      identifier: runtime.config.gpt.deployment,
      authMode: runtime.config.gpt.authMode,
      hasApiKey: Boolean(runtime.config.gpt.apiKey)
    },
    mai: {
      endpoint: runtime.config.mai.endpoint,
      identifier: runtime.config.mai.model,
      authMode: runtime.config.mai.authMode,
      hasApiKey: Boolean(runtime.config.mai.apiKey)
    }
  });
});

app.put("/api/settings", requireLocalRequest, async (request, response, next) => {
  try {
    const settings = settingsRequestSchema.parse(request.body);
    const update = settingsUpdateQueue.then(async () => {
      const values = settingsToEnv(settings, runtime.config);
      const prospectiveEnv = { ...process.env, ...values };
      try {
        getConfig(prospectiveEnv);
      } catch (error) {
        error.status = 400;
        throw error;
      }
      await saveSettings(envPath, values);
      Object.assign(process.env, values);
      applyConfig(process.env);
      return publicStatus(runtime.config);
    });
    settingsUpdateQueue = update.catch(() => {});
    response.json(await update);
  } catch (error) {
    next(error);
  }
});

app.get("/api/bootstrap", (_request, response) => {
  response.json({ listings, leads, leaseDocuments, buildingProfiles });
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
    const { mode, propertyId, prompt } = imageRequestSchema.parse(request.body);
    const property = resolveListing(propertyId);
    const sourcePath = path.join(root, "public", property.image.replace(/^\//, ""));
    const output = mode === "live"
      ? await requireLiveProvider(runtime.mai, "MAI-Image-2.5").edit({
          prompt: createCampaignEditPrompt(prompt),
          image: await readFile(sourcePath),
          filename: path.basename(sourcePath),
          mimeType: path.extname(sourcePath).toLowerCase() === ".jpg" ? "image/jpeg" : "image/png"
        })
      : getMockImage(propertyId, prompt);
    response.json({ mode, propertyId, ...output });
  } catch (error) {
    next(error);
  }
});

app.post("/api/valuation", async (request, response, next) => {
  try {
    const { mode, propertyId, settings } = valuationRequestSchema.parse(request.body);
    const property = resolveListing(propertyId);
    const output = mode === "live"
      ? await requireLiveProvider(runtime.gpt, "GPT-5.4").draftValuation(property, settings, comparableSales)
      : draftValuation(propertyId, settings);
    response.json({ mode, propertyId, ...output });
  } catch (error) {
    next(error);
  }
});

app.post("/api/lease", async (request, response, next) => {
  try {
    const { mode, leaseId } = leaseRequestSchema.parse(request.body);
    const lease = resolveLease(leaseId);
    const output = mode === "live"
      ? await requireLiveProvider(runtime.gpt, "GPT-5.4").abstractLease(lease)
      : abstractLease(leaseId);
    response.json({ mode, leaseId, ...output });
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
  return app.listen(port, "127.0.0.1", () => {
    console.log(`Aurelia Agency AI is running at http://localhost:${port}`);
    console.log(`Mode: ${runtime.config.defaultMode} | GPT: ${runtime.config.gpt.configured ? "configured" : "not configured"} | MAI: ${runtime.config.mai.configured ? "configured" : "not configured"}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer();
}

export { app };
