import test from "node:test";
import assert from "node:assert/strict";
import {
  createPortalCredentialHash,
  createPortalSessionToken,
  readPortalSessionCookie,
  verifyPortalCredential,
  verifyPortalSessionToken
} from "../src/portal-auth.js";

test("portal credentials are stored as a salted combined hash", () => {
  const encoded = createPortalCredentialHash("demo-user", "correct-password", Buffer.alloc(16, 7));

  assert.equal(encoded.includes("demo-user"), false);
  assert.equal(encoded.includes("correct-password"), false);
  assert.equal(verifyPortalCredential("demo-user", "correct-password", encoded), true);
  assert.equal(verifyPortalCredential("demo-user", "wrong-password", encoded), false);
  assert.equal(verifyPortalCredential("wrong-user", "correct-password", encoded), false);
});

test("portal sessions reject tampering and expiration", () => {
  const now = Date.parse("2026-07-17T00:00:00Z");
  const token = createPortalSessionToken("a".repeat(32), 3600, now);

  assert.equal(verifyPortalSessionToken(token, "a".repeat(32), now + 1000), true);
  assert.equal(verifyPortalSessionToken(`${token}x`, "a".repeat(32), now + 1000), false);
  assert.equal(verifyPortalSessionToken(token, "a".repeat(32), now + 3601000), false);
  assert.equal(readPortalSessionCookie(`other=1; aurelia_session=${token}; theme=light`), token);
});
