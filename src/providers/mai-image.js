import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";

export function buildMaiGenerationUrl(endpoint) {
  return `${String(endpoint).replace(/\/+$/, "")}/mai/v1/images/generations`;
}

export function buildMaiEditUrl(endpoint) {
  return `${String(endpoint).replace(/\/+$/, "")}/mai/v1/images/edits`;
}

export function extractMaiImage(payload) {
  const image = payload?.data?.[0]?.b64_json;
  if (typeof image !== "string" || image.length === 0) {
    throw new Error("MAI response did not contain data[0].b64_json.");
  }
  return image;
}

export function getMaiRetryDelayMs(headers, fallbackMs = 65000) {
  const millisecondsHeader = headers.get("x-ms-retry-after-ms") ?? headers.get("retry-after-ms");
  const milliseconds = Number(millisecondsHeader);
  if (millisecondsHeader !== null && Number.isFinite(milliseconds) && milliseconds >= 0) {
    return Math.min(milliseconds, 120000);
  }

  const retryAfter = headers.get("retry-after");
  const seconds = Number(retryAfter);
  if (retryAfter !== null && Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, 120000);
  }
  const retryDate = retryAfter ? Date.parse(retryAfter) : NaN;
  if (Number.isFinite(retryDate)) return Math.min(Math.max(retryDate - Date.now(), 1000), 120000);
  return Math.min(Math.max(fallbackMs, 0), 120000);
}

export function createMaiImageProvider(config) {
  if (!config.configured) return null;

  const tokenProvider = config.authMode === "entra"
    ? getBearerTokenProvider(new DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default")
    : null;

  async function getAuthHeaders() {
    return tokenProvider
      ? { Authorization: `Bearer ${await tokenProvider()}` }
      : { "api-key": config.apiKey };
  }

  async function parseImageResponse(response, operation) {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload?.error?.message || payload?.message || `${response.status} ${response.statusText}`;
      throw new Error(`MAI ${operation} failed: ${detail}`);
    }
    return extractMaiImage(payload);
  }

  async function fetchWithRetry(request) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let response;
      try {
        response = await request();
      } catch (error) {
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          continue;
        }
        throw error;
      }

      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === 1) return response;
      const delayMs = response.status === 429 ? getMaiRetryDelayMs(response.headers) : 2000;
      await response.body?.cancel();
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new Error("MAI request exhausted its retry attempts.");
  }

  return {
    async generate({ prompt, width, height }) {
      let response;
      try {
        response = await fetchWithRetry(async () => fetch(buildMaiGenerationUrl(config.endpoint), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...await getAuthHeaders()
          },
          body: JSON.stringify({
            model: config.model,
            prompt,
            width,
            height
          }),
          signal: AbortSignal.timeout(120000)
        }));
      } catch (error) {
        throw new Error(`MAI request failed: ${error.message}`, { cause: error });
      }

      const image = await parseImageResponse(response, "generation");
      return {
        imageUrl: `data:image/png;base64,${image}`,
        prompt,
        generated: true,
        model: config.model
      };
    },
    async edit({ prompt, image, filename = "property.png", mimeType = "image/png" }) {
      const form = new FormData();
      form.set("model", config.model);
      form.set("prompt", prompt);
      form.set("image", new Blob([image], { type: mimeType }), filename);

      let response;
      try {
        response = await fetchWithRetry(async () => fetch(buildMaiEditUrl(config.endpoint), {
          method: "POST",
          headers: await getAuthHeaders(),
          body: form,
          signal: AbortSignal.timeout(300000)
        }));
      } catch (error) {
        throw new Error(`MAI edit request failed: ${error.message}`, { cause: error });
      }

      const editedImage = await parseImageResponse(response, "edit");
      return {
        imageUrl: `data:image/png;base64,${editedImage}`,
        prompt,
        generated: true,
        edited: true,
        model: config.model
      };
    }
  };
}
