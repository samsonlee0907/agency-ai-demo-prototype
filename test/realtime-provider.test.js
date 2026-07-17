import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRealtimeClientSecretUrl,
  buildRealtimeSession,
  createRealtimeProvider,
  RealtimeResponseError
} from "../src/providers/realtime.js";

const building = {
  id: "building-meridian",
  name: "Meridian House",
  address: "88 Pitt Street, Sydney NSW 2000",
  serviceHours: "Concierge 7am-7pm weekdays",
  emergencyContact: "Building security",
  knowledge: [
    { title: "Access", content: "Lost passes must be reported to concierge." }
  ]
};

test("builds a grounded realtime session with server VAD and emergency guidance", () => {
  const session = buildRealtimeSession(building, "gpt-realtime-2.1");

  assert.equal(session.type, "realtime");
  assert.equal(session.model, "gpt-realtime-2.1");
  assert.equal(session.audio.output.voice, "coral");
  assert.equal(session.audio.input.turn_detection.type, "server_vad");
  assert.match(session.instructions, /call 000 first/i);
  assert.match(session.instructions, /Lost passes must be reported to concierge/);
  assert.match(session.instructions, /Do not claim that a work order/);
});

test("mints an ephemeral secret using an Entra bearer token", async () => {
  let request;
  const provider = createRealtimeProvider(
    {
      configured: true,
      endpoint: "https://contoso.openai.azure.com",
      deployment: "gpt-realtime-2.1"
    },
    {
      credential: {
        async getToken(scope) {
          assert.equal(scope, "https://ai.azure.com/.default");
          return { token: "entra-token" };
        }
      },
      async fetchImpl(url, options) {
        request = { url, options };
        return new Response(JSON.stringify({ value: "ephemeral", expires_at: 1234 }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
  );

  const result = await provider.createClientSecret(building);
  assert.equal(request.url, buildRealtimeClientSecretUrl("https://contoso.openai.azure.com"));
  assert.equal(request.options.headers.Authorization, ["Bearer", "entra-token"].join(" "));
  assert.equal(JSON.parse(request.options.body).session.model, "gpt-realtime-2.1");
  assert.deepEqual(result, {
    clientSecret: "ephemeral",
    expiresAt: 1234,
    endpoint: "https://contoso.openai.azure.com",
    deployment: "gpt-realtime-2.1"
  });
});

test("retries with the Cognitive Services audience when the AI audience masks the deployment", async () => {
  const scopes = [];
  let calls = 0;
  const provider = createRealtimeProvider(
    {
      configured: true,
      endpoint: "https://contoso.openai.azure.com",
      deployment: "gpt-realtime-2.1"
    },
    {
      credential: {
        async getToken(scope) {
          scopes.push(scope);
          return { token: `token-${scopes.length}` };
        }
      },
      async fetchImpl() {
        calls += 1;
        if (calls === 1) {
          return new Response(JSON.stringify({
            error: { message: "The realtime operation does not work with the specified model." }
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ value: "ephemeral", expires_at: 1234 }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
  );

  const result = await provider.createClientSecret(building);
  assert.deepEqual(scopes, [
    "https://ai.azure.com/.default",
    "https://cognitiveservices.azure.com/.default"
  ]);
  assert.equal(result.clientSecret, "ephemeral");
});

test("does not return success-shaped output when Azure rejects the session", async () => {
  const provider = createRealtimeProvider(
    {
      configured: true,
      endpoint: "https://contoso.openai.azure.com",
      deployment: "gpt-realtime-2.1"
    },
    {
      credential: { async getToken() { return { token: "entra-token" }; } },
      async fetchImpl() {
        return new Response(JSON.stringify({ error: { message: "deployment unavailable" } }), {
          status: 503,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
  );

  await assert.rejects(
    () => provider.createClientSecret(building),
    (error) => error instanceof RealtimeResponseError && /deployment unavailable/.test(error.message)
  );
});
