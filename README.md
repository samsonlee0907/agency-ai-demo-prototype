# Aurelia Agency AI Studio

A lightweight, client-facing web app demonstrating three Microsoft Foundry use cases for property agencies and brokerages:

1. **Intelligent property matching** — turns a structured buyer brief into an explainable ranked shortlist.
2. **Marketing content studio** — creates coordinated property copy and an MAI image direction.
3. **Lead qualification agent** — extracts intent, prioritises the enquiry and drafts a personal follow-up.

The app works immediately with deterministic mock data. Live mode uses GPT-5.4 and MAI-Image-2.5 through server-side providers, so browser code never receives model credentials.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

Useful scripts:

```bash
npm run dev    # restart on source changes
npm test       # focused Node test suite
npm run lint   # syntax-check project JavaScript
```

## Configure live models

Open the model status control in the top-right of the portal and choose **Configure live endpoints**. The local-only settings dialog writes credentials to the server's ignored `.env` file and applies them immediately. Existing keys are never returned to the browser; leave a key field blank to retain its saved value.

You can alternatively copy `.env.example` to `.env` and edit it manually. Mock remains the safe default. The interface can switch to Live Foundry only when GPT is configured; image generation additionally requires MAI configuration.

| Variable | Default | Purpose |
| --- | --- | --- |
| `MODEL_MODE` | `mock` | Initial mode: `mock` or `live` |
| `PORT` | `3000` | Local HTTP port |
| `GPT_ENDPOINT` | — | Azure OpenAI resource endpoint |
| `GPT_AUTH_MODE` | `api-key` | `api-key` or `entra` |
| `GPT_API_KEY` | — | Server-side Azure OpenAI API key |
| `GPT_DEPLOYMENT` | `gpt-5.4` | Azure deployment name |
| `MAI_ENDPOINT` | — | Foundry endpoint; may be a separate resource |
| `MAI_AUTH_MODE` | `api-key` | `api-key` or `entra` |
| `MAI_API_KEY` | — | Server-side MAI API key |
| `MAI_MODEL` | `MAI-Image-2.5` | MAI model/deployment identifier |

### Exact endpoint contracts

GPT follows the current [Microsoft Azure OpenAI Responses API guidance](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses): the official `openai` JavaScript SDK is configured with a base URL such as:

```text
https://<resource>.openai.azure.com/openai/v1/
```

Equivalent Azure resource/deployment URLs supplied through `GPT_ENDPOINT` are normalized to that v1 base. Requests use:

```js
client.responses.create({ model: deployment, input: /* ... */ })
```

Each workflow requests a strict JSON schema and validates the parsed result with Zod before returning it to the browser.

For resources with key authentication disabled, choose **Microsoft Entra ID** for both providers in the portal. The app uses `DefaultAzureCredential` and the official `https://ai.azure.com/.default` scope. Locally this can use your `az login` session; in Azure it can use managed identity. Assign the active identity the **Foundry User** role on the Foundry resource.

MAI routing is isolated in `src/providers/mai-image.js`, following the route used by the referenced Microsoft model portal:

```text
POST {MAI_ENDPOINT}/mai/v1/images/generations
api-key: <server-side key>
{ "model": "MAI-Image-2.5", "prompt": "...", "width": 1024, "height": 1024 }
```

The provider extracts `data[0].b64_json`. If a resource uses a different route, only that provider module needs adjustment.

## Architecture

```text
public/                       responsive vanilla HTML/CSS/JS client
server.js                     Express static host and secure API proxy
src/config.js                 endpoint normalization and public readiness state
src/data.js                   realistic listings and inbound enquiries
src/mock-services.js          deterministic matching/content/qualification
src/providers/gpt.js          GPT Responses API + strict output validation
src/providers/mai-image.js    MAI generation route and response extraction
src/schemas.js                request and model-output contracts
test/                         focused unit and API smoke tests
```

`GET /api/status` reports only model readiness and deployment names—never endpoints or secrets. Live provider failures return explicit API errors and are never replaced with mock success.
