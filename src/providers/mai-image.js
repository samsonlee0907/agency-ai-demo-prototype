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

  return {
    async generate({ prompt, width, height }) {
      let response;
      try {
        response = await fetch(buildMaiGenerationUrl(config.endpoint), {
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
        });
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
        response = await fetch(buildMaiEditUrl(config.endpoint), {
          method: "POST",
          headers: await getAuthHeaders(),
          body: form,
          signal: AbortSignal.timeout(300000)
        });
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
