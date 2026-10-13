import { test } from "node:test";
import assert from "node:assert/strict";
import { configurationReady, ownerAllowed } from "../lib/config.ts";
const valid = { NODE_ENV: "production", DATABASE_URL: "postgres://example", BETTER_AUTH_SECRET: "x".repeat(40), BETTER_AUTH_URL: "https://portal.example.com", GOOGLE_CLIENT_ID: "example", GOOGLE_CLIENT_SECRET: "example", PORTAL_OWNER_EMAIL: "owner@example.com" };
test("missing secrets disable authentication", () => {
  assert.equal(configurationReady({}), false);
  assert.equal(configurationReady({ ...valid, GOOGLE_CLIENT_SECRET: "" }), false);
});
test("production rejects insecure or ambiguous origins", () => {
  for (const origin of ["http://localhost:3000", "http://portal.example.com", "https://user:pass@example.com", "https://example.com/path", "https://example.com?x=1"]) assert.equal(configurationReady({ ...valid, BETTER_AUTH_URL: origin }), false);
  assert.equal(configurationReady(valid), true);
});
test("access requires verified owner and fails closed", () => {
  assert.equal(ownerAllowed("OWNER@example.com", true, "owner@example.com"), true);
  assert.equal(ownerAllowed("owner@example.com", false, "owner@example.com"), false);
  assert.equal(ownerAllowed("other@example.com", true, "owner@example.com"), false);
  assert.equal(ownerAllowed("owner@example.com", true, ""), false);
});
