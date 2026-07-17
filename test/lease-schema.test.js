import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { abstractLease } from "../src/mock-services.js";
import { findLease } from "../src/data.js";
import {
  LEASE_CLAUSE_SUMMARY_MAX_LENGTH,
  LEASE_REVIEW_NOTE_MAX_LENGTH,
  leaseJsonSchema,
  leaseOutputSchema
} from "../src/schemas.js";

test("lease review note guidance and runtime validation share one limit", () => {
  const lease = abstractLease("lease-meridian");
  const description = leaseJsonSchema.properties.reviewNote.description;

  assert.equal("maxLength" in leaseJsonSchema.properties.reviewNote, false);
  assert.match(description, new RegExp(`at most ${LEASE_REVIEW_NOTE_MAX_LENGTH} characters`));
  assert.equal(leaseOutputSchema.safeParse({
    ...lease,
    reviewNote: "x".repeat(LEASE_REVIEW_NOTE_MAX_LENGTH)
  }).success, true);
  assert.equal(leaseOutputSchema.safeParse({
    ...lease,
    reviewNote: "x".repeat(LEASE_REVIEW_NOTE_MAX_LENGTH + 1)
  }).success, false);
});

test("lease clause guidance and runtime validation share one limit", () => {
  const lease = abstractLease("lease-meridian");
  const descriptions = [
    leaseJsonSchema.properties.term.properties.options.description,
    leaseJsonSchema.properties.rent.properties.baseAnnual.description,
    leaseJsonSchema.properties.rent.properties.payment.description,
    leaseJsonSchema.properties.rent.properties.review.description,
    leaseJsonSchema.properties.incentive.description,
    leaseJsonSchema.properties.security.description,
    leaseJsonSchema.properties.outgoings.description,
    leaseJsonSchema.properties.permittedUse.description,
    leaseJsonSchema.properties.breakClause.description
  ];

  assert.equal("maxLength" in leaseJsonSchema.properties.term.properties.options, false);
  assert.ok(descriptions.every((description) => description.includes(`at most ${LEASE_CLAUSE_SUMMARY_MAX_LENGTH} characters`)));
  assert.equal(leaseOutputSchema.safeParse({
    ...lease,
    term: { ...lease.term, options: "x".repeat(LEASE_CLAUSE_SUMMARY_MAX_LENGTH) },
    rent: { ...lease.rent, review: "x".repeat(LEASE_CLAUSE_SUMMARY_MAX_LENGTH) }
  }).success, true);
  assert.equal(leaseOutputSchema.safeParse({
    ...lease,
    rent: { ...lease.rent, review: "x".repeat(LEASE_CLAUSE_SUMMARY_MAX_LENGTH + 1) }
  }).success, false);
});

test("Meridian demo includes a real multi-page PDF and matching lengthy source text", async () => {
  const lease = findLease("lease-meridian");
  const pdf = await readFile(new URL("../public/assets/documents/meridian-house-office-lease-demo.pdf", import.meta.url));
  const pdfText = pdf.toString("ascii");

  assert.equal(pdf.subarray(0, 8).toString("ascii"), "%PDF-1.4");
  assert.equal((pdfText.match(/\/Type \/Page\b/g) || []).length, lease.pageCount);
  assert.ok(lease.pageCount >= 20);
  assert.ok(lease.content.length > 10000);
  assert.match(lease.content, new RegExp(`PAGE ${lease.pageCount} OF ${lease.pageCount}`));
  assert.equal(lease.fileName, lease.pdfUrl.split("/").at(-1));
});
