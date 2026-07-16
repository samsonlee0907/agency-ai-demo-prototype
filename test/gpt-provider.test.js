import test from "node:test";
import assert from "node:assert/strict";
import { groundValuationComparables, ModelResponseError } from "../src/providers/gpt.js";

const sources = [
  { id: "comp-one", address: "1 Sample Street", area: "Sydney", saleDate: "1 Jul 2026", salePrice: 1000000 },
  { id: "comp-two", address: "2 Sample Street", area: "Sydney", saleDate: "2 Jul 2026", salePrice: 1100000 },
  { id: "comp-three", address: "3 Sample Street", area: "Sydney", saleDate: "3 Jul 2026", salePrice: 1200000 }
];

function comparable(id) {
  return {
    id,
    address: "fabricated",
    saleDate: "fabricated",
    salePrice: 1,
    adjustedValue: 1150000,
    weight: 33,
    adjustments: ["Comparable evidence"],
    rationale: "Evidence-led comparable rationale."
  };
}

test("valuation grounding restores immutable source facts", () => {
  const result = groundValuationComparables(
    { comparables: sources.map((source) => comparable(source.id)) },
    sources
  );
  assert.equal(result.comparables[0].address, "1 Sample Street, Sydney");
  assert.equal(result.comparables[0].saleDate, "1 Jul 2026");
  assert.equal(result.comparables[0].salePrice, 1000000);
});

test("valuation grounding rejects duplicate comparable IDs", () => {
  assert.throws(
    () => groundValuationComparables(
      { comparables: [comparable("comp-one"), comparable("comp-one"), comparable("comp-two")] },
      sources
    ),
    ModelResponseError
  );
});
