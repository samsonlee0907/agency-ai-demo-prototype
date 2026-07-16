import "dotenv/config";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getConfig } from "../src/config.js";
import { listings } from "../src/data.js";
import { createBaseImagePrompt } from "../src/property-image-prompts.js";
import { createMaiImageProvider } from "../src/providers/mai-image.js";

const outputDirectory = path.resolve("public", "assets", "properties");
const minimumStartIntervalMs = 35000;
const rateLimitBackoffMs = 65000;
const force = process.argv.includes("--force");
const config = getConfig();
const provider = createMaiImageProvider(config.mai);

if (!provider) {
  throw new Error("MAI-Image-2.5 is not configured. Configure the live endpoint before generating property images.");
}

await mkdir(outputDirectory, { recursive: true });
let previousStart = 0;

for (const [index, listing] of listings.entries()) {
  const outputPath = path.join(outputDirectory, `${listing.id}.png`);
  if (!force && existsSync(outputPath)) {
    console.log(`[${index + 1}/${listings.length}] Keeping existing ${listing.id}.png`);
    continue;
  }

  const waitMs = Math.max(0, previousStart + minimumStartIntervalMs - Date.now());
  if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));

  console.log(`[${index + 1}/${listings.length}] Generating ${listing.name}...`);
  let result;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    previousStart = Date.now();
    try {
      result = await provider.generate({
        prompt: createBaseImagePrompt(listing),
        width: 1024,
        height: 1024
      });
      break;
    } catch (error) {
      if (attempt === 3 || !/rate limit/i.test(error.message)) throw error;
      console.log(`Rate limit reached; retrying ${listing.name} in 65 seconds...`);
      await new Promise((resolve) => setTimeout(resolve, rateLimitBackoffMs));
    }
  }
  const encoded = result.imageUrl.split(",", 2)[1];
  if (!encoded) throw new Error(`MAI returned an invalid data URL for ${listing.name}.`);
  await writeFile(outputPath, Buffer.from(encoded, "base64"));
  console.log(`Saved ${path.relative(process.cwd(), outputPath)}`);
}

console.log("Authentic property base images are ready.");
