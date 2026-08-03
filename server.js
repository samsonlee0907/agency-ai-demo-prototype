import "dotenv/config";
import express from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { getConfig, publicStatus } from "./src/config.js";
import { buildingProfiles, comparableSales, findBuilding, findLead, findLease, findListing, leads, leaseDocuments, listings } from "./src/data.js";
import { findFloorplanForMessage, loadFloorplanImage } from "./src/floorplan-assets.js";
import { abstractLease, analyseMaintenance, answerTenant, buildEsgEvidence, createEsgReport, draftValuation, generateMarketing, getMockImage, matchProperties, qualifyLead } from "./src/mock-services.js";
import { esgPortfolio, findMaintenanceAsset, maintenanceAssets } from "./src/operations-data.js";
import { createGptProvider, ModelResponseError } from "./src/providers/gpt.js";
import { createMaiImageProvider } from "./src/providers/mai-image.js";
import { createCampaignEditPrompt } from "./src/property-image-prompts.js";
import {
  createPortalSessionToken,
  readPortalSessionCookie,
  verifyPortalCredential,
  verifyPortalSessionToken
} from "./src/portal-auth.js";
import { saveSettings, settingsToEnv } from "./src/settings-store.js";
import {
  assistantRequestSchema,
  esgRequestSchema,
  imageRequestSchema,
  leaseRequestSchema,
  marketingRequestSchema,
  matchRequestSchema,
  maintenanceRequestSchema,
  qualificationRequestSchema,
  settingsRequestSchema,
  valuationRequestSchema
} from "./src/schemas.js";

const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(root, ".env");
const loginPath = path.join(root, "public", "login.html");
const runtime = {};
let settingsUpdateQueue = Promise.resolve();
const loginAttempts = new Map();
const loginWindowMs = 15 * 60 * 1000;
const loginAttemptLimit = 5;

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

function resolveMaintenanceAsset(id) {
  const asset = findMaintenanceAsset(id);
  if (!asset) {
    const error = new Error("Maintenance asset not found.");
    error.status = 404;
    throw error;
  }
  return asset;
}

applyConfig();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "10kb" }));
app.use((_request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Frame-Options", "SAMEORIGIN");
  response.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
  next();
});

function hasPortalSession(request) {
  const token = readPortalSessionCookie(request.headers.cookie);
  return verifyPortalSessionToken(token, runtime.config.portalAuth.sessionSecret);
}

async function sendLoginPage(response, status = 200, error = "") {
  const template = await readFile(loginPath, "utf8");
  const escapedError = error.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
  response.status(status).type("html").send(template.replace("{{LOGIN_ERROR}}", escapedError));
}

function loginAttemptState(address, now = Date.now()) {
  const existing = loginAttempts.get(address);
  if (!existing || now - existing.startedAt >= loginWindowMs) {
    const state = { failures: 0, startedAt: now };
    loginAttempts.set(address, state);
    return state;
  }
  return existing;
}

app.get("/login.css", (_request, response) => {
  response.sendFile(path.join(root, "public", "login.css"));
});

app.get("/login", async (request, response) => {
  if (!runtime.config.portalAuth.enabled || hasPortalSession(request)) {
    response.redirect(302, "/");
    return;
  }
  await sendLoginPage(response);
});

app.post("/auth/login", async (request, response) => {
  if (!runtime.config.portalAuth.enabled) {
    response.status(404).send("Portal authentication is not configured.");
    return;
  }

  const attempts = loginAttemptState(request.ip);
  if (attempts.failures >= loginAttemptLimit) {
    await sendLoginPage(response, 429, "Too many failed attempts. Try again in 15 minutes.");
    return;
  }

  const valid = verifyPortalCredential(
    request.body.username,
    request.body.password,
    runtime.config.portalAuth.credentialHash
  );
  if (!valid) {
    attempts.failures += 1;
    console.warn(`Portal login rejected for ${request.ip}.`);
    await sendLoginPage(response, 401, "The username or password is incorrect.");
    return;
  }

  loginAttempts.delete(request.ip);
  const maxAgeSeconds = 8 * 60 * 60;
  const token = createPortalSessionToken(runtime.config.portalAuth.sessionSecret, maxAgeSeconds);
  response.setHeader("Set-Cookie", `aurelia_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`);
  response.redirect(303, "/");
});

app.post("/auth/logout", (_request, response) => {
  response.setHeader("Set-Cookie", "aurelia_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  response.redirect(303, "/login");
});

app.use((request, response, next) => {
  if (!runtime.config.portalAuth.enabled || hasPortalSession(request)) {
    next();
    return;
  }
  if (request.path.startsWith("/api/")) {
    response.status(401).json({ error: "Authentication required." });
    return;
  }
  response.redirect(302, "/login");
});

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
    let output;
    if (mode === "live") {
      const floorplan = findFloorplanForMessage(building, message);
      const floorplanInput = floorplan ? await loadFloorplanImage(root, floorplan) : null;
      output = await requireLiveProvider(runtime.gpt, runtime.config.gpt.deployment)
        .respondToTenant(building, message, history, floorplanInput);
    } else {
      output = answerTenant(buildingId, message, history);
    }
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
  response.json({ listings, leads, leaseDocuments, buildingProfiles, maintenanceAssets, esgPortfolio });
});

app.post("/api/match", async (request, response, next) => {
  try {
    const { mode, brief } = matchRequestSchema.parse(request.body);
    const output = mode === "live"
      ? await requireLiveProvider(runtime.gpt, runtime.config.gpt.deployment).rankProperties(brief, listings)
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
      ? await requireLiveProvider(runtime.gpt, runtime.config.gpt.deployment).generateMarketing(property, settings)
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
      ? await requireLiveProvider(runtime.gpt, runtime.config.gpt.deployment).qualifyLead(lead, resolveListing(lead.propertyId))
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
    response.json({ mode, propertyId, ...output, prompt });
  } catch (error) {
    next(error);
  }
});

app.post("/api/valuation", async (request, response, next) => {
  try {
    const { mode, propertyId, settings } = valuationRequestSchema.parse(request.body);
    const property = resolveListing(propertyId);
    const output = mode === "live"
      ? await requireLiveProvider(runtime.gpt, runtime.config.gpt.deployment).draftValuation(property, settings, comparableSales)
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
      ? await requireLiveProvider(runtime.gpt, runtime.config.gpt.deployment).abstractLease(lease)
      : abstractLease(leaseId);
    response.json({ mode, leaseId, ...output });
  } catch (error) {
    next(error);
  }
});

app.post("/api/maintenance", async (request, response, next) => {
  try {
    const { mode, assetId, horizon } = maintenanceRequestSchema.parse(request.body);
    const asset = resolveMaintenanceAsset(assetId);
    const baseline = analyseMaintenance(assetId, horizon);
    const output = mode === "live"
      ? await requireLiveProvider(runtime.gpt, runtime.config.gpt.deployment).analyseMaintenance(asset, horizon, baseline)
      : baseline;
    response.json({ mode, assetId, ...output });
  } catch (error) {
    next(error);
  }
});

app.post("/api/esg", async (request, response, next) => {
  try {
    const { mode, settings } = esgRequestSchema.parse(request.body);
    const evidence = buildEsgEvidence(settings);
    const output = mode === "live"
      ? await requireLiveProvider(runtime.gpt, runtime.config.gpt.deployment).draftEsgReport(settings, evidence)
      : createEsgReport(settings);
    response.json({ mode, ...output });
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
  return app.listen(port, runtime.config.host, () => {
    console.log(`Aurelia Agency AI is running at http://localhost:${port}`);
    console.log(`Mode: ${runtime.config.defaultMode} | GPT: ${runtime.config.gpt.configured ? "configured" : "not configured"} | MAI: ${runtime.config.mai.configured ? "configured" : "not configured"}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer();
}

export { app };
