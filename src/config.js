function normalizeUrl(value, path) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid endpoint URL: ${raw}`);
  }

  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
    throw new Error("Model endpoints must use HTTPS.");
  }

  return `${parsed.origin}${path}`;
}

export function normalizeAzureOpenAIBaseUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const parsed = new URL(raw);
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
  const routeIndex = parsed.pathname.toLowerCase().indexOf("/mai/v1/");
  const basePath = routeIndex >= 0 ? parsed.pathname.slice(0, routeIndex) : parsed.pathname;
  return `${parsed.origin}${basePath}`.replace(/\/+$/, "");
}

export function getConfig(env = process.env) {
  const gptEndpoint = normalizeAzureOpenAIBaseUrl(env.GPT_ENDPOINT);
  const maiEndpoint = normalizeMaiEndpoint(env.MAI_ENDPOINT);
  const requestedMode = env.MODEL_MODE === "live" ? "live" : "mock";

  const config = {
    port: Number.parseInt(env.PORT || "3000", 10),
    requestedMode,
    gpt: {
      endpoint: gptEndpoint,
      apiKey: String(env.GPT_API_KEY || "").trim(),
      deployment: String(env.GPT_DEPLOYMENT || "gpt-5.4").trim()
    },
    mai: {
      endpoint: maiEndpoint,
      apiKey: String(env.MAI_API_KEY || "").trim(),
      model: String(env.MAI_MODEL || "MAI-Image-2.5").trim()
    }
  };

  config.gpt.configured = Boolean(config.gpt.endpoint && config.gpt.apiKey);
  config.mai.configured = Boolean(config.mai.endpoint && config.mai.apiKey);
  config.defaultMode = requestedMode === "live" && config.gpt.configured ? "live" : "mock";
  return config;
}

export function publicStatus(config) {
  return {
    defaultMode: config.defaultMode,
    requestedMode: config.requestedMode,
    gpt: {
      configured: config.gpt.configured,
      deployment: config.gpt.deployment
    },
    mai: {
      configured: config.mai.configured,
      model: config.mai.model
    }
  };
}
