import { DefaultAzureCredential } from "@azure/identity";

const REALTIME_SCOPES = [
  "https://ai.azure.com/.default",
  "https://cognitiveservices.azure.com/.default"
];

export class RealtimeResponseError extends Error {
  constructor(message, cause) {
    super(message, { cause });
    this.name = "RealtimeResponseError";
  }
}

export function buildRealtimeClientSecretUrl(endpoint) {
  return `${String(endpoint).replace(/\/+$/, "")}/openai/v1/realtime/client_secrets`;
}

export function buildRealtimeCallsEndpoint(endpoint) {
  const parsed = new URL(endpoint);
  if (parsed.hostname.endsWith(".services.ai.azure.com")) {
    parsed.hostname = parsed.hostname.replace(/\.services\.ai\.azure\.com$/, ".openai.azure.com");
  } else if (parsed.hostname.endsWith(".cognitiveservices.azure.com")) {
    parsed.hostname = parsed.hostname.replace(/\.cognitiveservices\.azure\.com$/, ".openai.azure.com");
  }
  return parsed.origin;
}

export function buildRealtimeSession(building, deployment) {
  const knowledge = building.knowledge
    .map((item) => `${item.title}: ${item.content}`)
    .join("\n");
  return {
    type: "realtime",
    model: deployment,
    instructions: [
      `You are Aurelia Tenant Assist, the voice concierge for ${building.name} at ${building.address}.`,
      "Use only the fictional building information below. If the answer is not present, say that the facilities team must confirm it.",
      "For fire, gas, serious injury, an active electrical hazard, or immediate danger, tell the caller to call 000 first, then contact building security.",
      "Do not claim that a work order, booking, access pass, or escalation has been created. Explain the next human action instead.",
      "Keep spoken answers natural, concise, and under four sentences. Ask at most one necessary follow-up question.",
      `Service desk: ${building.serviceHours}`,
      `Urgent support: ${building.emergencyContact}`,
      `Building guide:\n${knowledge}`
    ].join("\n\n"),
    audio: {
      input: {
        noise_reduction: { type: "near_field" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
          create_response: true,
          interrupt_response: true
        }
      },
      output: { voice: "coral" }
    }
  };
}

export function createRealtimeProvider(config, options = {}) {
  if (!config.configured) return null;

  const credential = options.credential || new DefaultAzureCredential();
  const fetchImpl = options.fetchImpl || fetch;

  return {
    async createClientSecret(building) {
      for (const [index, scope] of REALTIME_SCOPES.entries()) {
        let response;
        try {
          const token = await credential.getToken(scope);
          if (!token?.token) throw new Error("Microsoft Entra ID did not return an access token.");
          response = await fetchImpl(buildRealtimeClientSecretUrl(config.endpoint), {
            method: "POST",
            headers: {
              Authorization: ["Bearer", token.token].join(" "),
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              session: buildRealtimeSession(building, config.deployment)
            }),
            signal: AbortSignal.timeout(30000)
          });
        } catch (error) {
          throw new RealtimeResponseError(`Realtime session request failed: ${error.message}`, error);
        }

        const payload = await response.json().catch(() => ({}));
        if (response.ok) {
          if (typeof payload.value !== "string" || !payload.value) {
            throw new RealtimeResponseError("Realtime session response did not contain an ephemeral client secret.");
          }
          return {
            clientSecret: payload.value,
            expiresAt: payload.expires_at,
            endpoint: buildRealtimeCallsEndpoint(config.endpoint),
            deployment: config.deployment
          };
        }

        const detail = payload?.error?.message || `${response.status} ${response.statusText}`;
        const audienceRetry = index === 0 && (
          response.status === 401
          || response.status === 403
          || /realtime operation does not work with the specified model/i.test(detail)
        );
        if (!audienceRetry) {
          throw new RealtimeResponseError(`Realtime session request failed: ${detail}`);
        }
      }
      throw new RealtimeResponseError("Realtime session request failed for all supported Microsoft Entra audiences.");
    }
  };
}
