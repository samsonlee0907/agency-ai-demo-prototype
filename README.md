# Aurelia Agency AI Studio

A lightweight, client-facing web app demonstrating eight Microsoft Foundry use cases for property agencies, brokerages and managed-property teams:

1. **Intelligent property matching** — turns a structured buyer brief into an explainable ranked shortlist.
2. **Marketing content studio** — creates coordinated property copy and uses MAI image editing to polish the selected authentic base photograph.
3. **Lead qualification agent** — extracts intent, prioritises the enquiry and drafts a personal follow-up.
4. **Valuation assistant (AVM copilot)** — reconciles fictional comparable transactions into an indicative range and valuer-review draft.
5. **Lease and contract abstraction** — extracts commercial terms, obligations, critical dates and review flags from sample agreements.
6. **Tenant virtual assistant** — answers grounded building questions, triages maintenance and creates transparent work-order hand-offs in a conversational interface.
7. **Predictive maintenance and energy** — correlates fictional BMS and condition signals into explainable failure risk, energy impact and technician-ready actions.
8. **ESG and sustainability copilot** — calculates portfolio KPIs, identifies evidence gaps and prepares a management review draft with owned next actions.

The app works immediately with deterministic mock data. Live mode uses GPT-5.6 Terra and MAI-Image-2.5 through server-side providers, so browser code never receives model credentials.

Detailed technical flows, API payloads, data schemas, model inputs, and grounding controls are documented in [`docs/scenarios/`](docs/scenarios/):

1. [Intelligent property matching](docs/scenarios/01-property-matching.md)
2. [Marketing content and image studio](docs/scenarios/02-marketing-content-studio.md)
3. [Lead qualification](docs/scenarios/03-lead-qualification.md)
4. [Valuation assistant](docs/scenarios/04-valuation-assistant.md)
5. [Lease abstraction](docs/scenarios/05-lease-abstraction.md)
6. [Tenant virtual assistant](docs/scenarios/06-tenant-virtual-assistant.md)
7. [Predictive maintenance and energy](docs/scenarios/07-predictive-maintenance-energy.md)
8. [ESG and sustainability copilot](docs/scenarios/08-esg-sustainability-copilot.md)

For a complete deployment of a new independent Azure environment, see [Reproduce the demo on Azure](docs/deployment.md). The repository includes Bicep, a guarded provisioning/deployment script, a reproducible ZIP builder, and an integrity manifest for all committed image and PDF artifacts.

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
npm run verify:assets # verify committed image/PDF hashes
npm run generate:property-images # regenerate authentic listing photography with MAI
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
| `GPT_DEPLOYMENT` | `gpt-5.6-terra` | Azure deployment name |
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

For resources with key authentication disabled, choose **Microsoft Entra ID** for both providers in the portal. The app uses `DefaultAzureCredential`: GPT requests use `https://ai.azure.com/.default`, while MAI follows the current Microsoft guidance with `https://cognitiveservices.azure.com/.default`. Locally this can use your `az login` session; in Azure it can use managed identity. The reproducible Azure template assigns the App Service identity the tested **Cognitive Services User** role on only its Foundry resource.

MAI routing is isolated in `src/providers/mai-image.js`, following the route used by the referenced Microsoft model portal:

```text
POST {MAI_ENDPOINT}/mai/v1/images/generations
api-key: <server-side key>
{ "model": "MAI-Image-2.5", "prompt": "...", "width": 1024, "height": 1024 }
```

The provider extracts `data[0].b64_json`. If a resource uses a different route, only that provider module needs adjustment.

The six catalogue photographs in `public/assets/properties/` are generated from restrained, property-specific prompts by `scripts/generate-property-images.mjs`. Campaign imagery uses the official MAI image-to-image edit API with the selected photograph sent as server-side multipart form data:

```text
POST {MAI_ENDPOINT}/mai/v1/images/edits
model=<deployment>
prompt=<restrained campaign edit direction>
image=@<bundled property photograph>
```

The edit prompt explicitly preserves the property's architecture, materials, landscaping and camera position. See Microsoft's [MAI image generation and editing guidance](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/how-to/use-foundry-models-mai-image).

## Architecture

```text
public/                       responsive vanilla HTML/CSS/JS client
server.js                     Express static host and secure API proxy
src/config.js                 endpoint normalization and public readiness state
src/data.js                   realistic agency, lease and tenant fixtures
src/operations-data.js        fictional asset telemetry and ESG source records
src/mock-services.js          deterministic workflows and portfolio calculations
src/providers/gpt.js          GPT Responses API + strict output validation
src/providers/mai-image.js    MAI generation/edit routes and response parsing
src/property-image-prompts.js restrained base-generation and edit directions
src/schemas.js                request and model-output contracts
scripts/                      syntax checks and reproducible property imagery
infra/                        subscription-scoped Bicep for an isolated Azure copy
artifacts/                    committed asset integrity manifest
docs/scenarios/               detailed scenario data-flow and schema guides
test/                         focused unit and API smoke tests
```

`GET /api/status` reports only model readiness and deployment names—never endpoints or secrets. Live provider failures return explicit API errors and are never replaced with mock success.

`POST /api/valuation`, `POST /api/lease`, `POST /api/assistant`, `POST /api/maintenance` and `POST /api/esg` use the same server-side GPT-5.6 Terra Responses provider and strict schema validation as the original scenarios. Comparable sales, leases, buildings, telemetry and sustainability records are fictional demo data. Predictive-maintenance readings and ESG metrics are calculated and restored from server evidence after generation, so GPT explains the data without replacing source facts. All advisory, legal, maintenance and sustainability outputs require appropriate professional review.
