import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const credentialPrefix = "scrypt";
const credentialKeyLength = 64;

function credentialValue(username, password) {
  return `${String(username ?? "")}\0${String(password ?? "")}`;
}

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createPortalCredentialHash(username, password, salt = randomBytes(16)) {
  const derived = scryptSync(credentialValue(username, password), salt, credentialKeyLength);
  return `${credentialPrefix}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export function verifyPortalCredential(username, password, encodedHash) {
  const [prefix, saltValue, expectedValue, extra] = String(encodedHash || "").split("$");
  if (prefix !== credentialPrefix || !saltValue || !expectedValue || extra) return false;

  try {
    const salt = Buffer.from(saltValue, "base64url");
    const expected = Buffer.from(expectedValue, "base64url");
    const actual = scryptSync(credentialValue(username, password), salt, expected.length);
    return secureEqual(actual, expected);
  } catch {
    return false;
  }
}

export function createPortalSessionToken(secret, maxAgeSeconds, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({
    subject: "portal-user",
    expiresAt: Math.floor(now / 1000) + maxAgeSeconds
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyPortalSessionToken(token, secret, now = Date.now()) {
  if (!token || !secret) return false;
  const [payload, signature, extra] = String(token).split(".");
  if (!payload || !signature || extra) return false;

  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  if (!secureEqual(signature, expected)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return parsed.subject === "portal-user"
      && Number.isInteger(parsed.expiresAt)
      && parsed.expiresAt > Math.floor(now / 1000);
  } catch {
    return false;
  }
}

export function readPortalSessionCookie(cookieHeader) {
  for (const item of String(cookieHeader || "").split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    const name = item.slice(0, separator).trim();
    if (name === "aurelia_session") return item.slice(separator + 1).trim();
  }
  return "";
}
