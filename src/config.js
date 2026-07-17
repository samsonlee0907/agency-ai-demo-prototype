function normalizeUrl(value, path) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid endpoint URL: ${raw}`);
  }

  assertSecureEndpoint(parsed);

  return `${parsed.origin}${path}`;
}

function assertSecureEndpoint(parsed) {
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (parsed.protocol !== "https:" && !localHosts.has(parsed.hostname)) {
    throw new Error("Model endpoints must use HTTPS.");
  }
}

export function normalizeAzureOpenAIBaseUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const parsed = new URL(raw);
  assertSecureEndpoint(parsed);
  const path = parsed.pathname.replace(/\/+$/, "");
  const v1Index = path.toLowerCase().indexOf("/openai/v1");
  if (v1Index >= 0) {
    return `${parsed.origin}${path.slice(0, v1Index)}/openai/v1/`;
  }
  return normalizeUrl(raw, "/openai/v1/");
}

export function normalizeMaiEndpoint(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const parsed = new URL(raw);
  assertSecureEndpoint(parsed);
  const routeIndex = parsed.pathname.toLowerCase().indexOf("/mai/v1/");
  const basePath = routeIndex >= 0 ? parsed.pathname.slice(0, routeIndex) : parsed.pathname;
  return `${parsed.origin}${basePath}`.replace(/\/+$/, "");
}

export function getConfig(env = process.env) {
  const gptEndpoint = normalizeAzureOpenAIBaseUrl(env.GPT_ENDPOINT);
  const maiEndpoint = normalizeMaiEndpoint(env.MAI_ENDPOINT);
  const requestedMode = env.MODEL_MODE === "live" ? "live" : "mock";
  const portalCredentialHash = String(env.PORTAL_CREDENTIAL_HASH || "").trim();
  const portalSessionSecret = String(env.PORTAL_SESSION_SECRET || "").trim();

  if (Boolean(portalCredentialHash) !== Boolean(portalSessionSecret)) {
    throw new Error("Portal authentication requires both PORTAL_CREDENTIAL_HASH and PORTAL_SESSION_SECRET.");
  }
  if (portalSessionSecret && portalSessionSecret.length < 32) {
    throw new Error("PORTAL_SESSION_SECRET must contain at least 32 characters.");
  }

  const config = {
    port: Number.parseInt(env.PORT || "3000", 10),
    host: String(env.HOST || (env.WEBSITE_HOSTNAME ? "0.0.0.0" : "127.0.0.1")).trim(),
    settingsEditable: !env.WEBSITE_HOSTNAME,
    requestedMode,
    portalAuth: {
      enabled: Boolean(portalCredentialHash && portalSessionSecret),
      credentialHash: portalCredentialHash,
      sessionSecret: portalSessionSecret
    },
    gpt: {
      endpoint: gptEndpoint,
      apiKey: String(env.GPT_API_KEY || "").trim(),
      deployment: String(env.GPT_DEPLOYMENT || "gpt-5.6-terra").trim(),
      authMode: env.GPT_AUTH_MODE === "entra" ? "entra" : "api-key"
    },
    mai: {
      endpoint: maiEndpoint,
      apiKey: String(env.MAI_API_KEY || "").trim(),
      model: String(env.MAI_MODEL || "MAI-Image-2.5").trim(),
      authMode: env.MAI_AUTH_MODE === "entra" ? "entra" : "api-key"
    }
  };

  config.gpt.configured = Boolean(
    config.gpt.endpoint && (config.gpt.authMode === "entra" || config.gpt.apiKey)
  );
  config.mai.configured = Boolean(
    config.mai.endpoint && (config.mai.authMode === "entra" || config.mai.apiKey)
  );
  config.defaultMode = requestedMode === "live" && config.gpt.configured ? "live" : "mock";
  return config;
}

export function publicStatus(config) {
  return {
    defaultMode: config.defaultMode,
    requestedMode: config.requestedMode,
    settingsEditable: config.settingsEditable,
    portalAuthEnabled: config.portalAuth.enabled,
    gpt: {
      configured: config.gpt.configured,
      deployment: config.gpt.deployment,
      authMode: config.gpt.authMode
    },
    mai: {
      configured: config.mai.configured,
      model: config.mai.model,
      authMode: config.mai.authMode
    }
  };
}
