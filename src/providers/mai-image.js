export function buildMaiGenerationUrl(endpoint) {
  return `${String(endpoint).replace(/\/+$/, "")}/mai/v1/images/generations`;
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

  return {
    async generate({ prompt, width, height }) {
      let response;
      try {
        response = await fetch(buildMaiGenerationUrl(config.endpoint), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": config.apiKey
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

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = payload?.error?.message || payload?.message || `${response.status} ${response.statusText}`;
        throw new Error(`MAI request failed: ${detail}`);
      }

      return {
        imageUrl: `data:image/png;base64,${extractMaiImage(payload)}`,
        prompt,
        generated: true,
        model: config.model
      };
    }
  };
}
