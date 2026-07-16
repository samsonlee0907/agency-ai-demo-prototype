import test from "node:test";
import assert from "node:assert/strict";
import { createCampaignEditPrompt } from "../src/property-image-prompts.js";

test("campaign edits allow explicitly requested temporary elements", () => {
  const direction = "Add residents walking through the garden for a lively, crowded mood.";
  const prompt = createCampaignEditPrompt(direction);

  assert.match(prompt, /people, furniture, vehicles, plants or decorations/);
  assert.match(prompt, new RegExp(direction));
  assert.doesNotMatch(prompt, /no people/i);
  assert.match(prompt, /Do not add rooms, pools, views, structures/);
});
