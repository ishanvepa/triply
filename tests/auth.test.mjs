import assert from "node:assert/strict";
import test from "node:test";
import { getSafeNextPath, getLoginPath } from "../src/lib/auth/redirect.ts";
import { validateCredentials } from "../src/lib/auth/validation.ts";

test("return paths preserve trip and invitation destinations", () => {
  for (const path of ["/trips/abc?tab=flights", "/invite/opaque-token?source=friend", "/settings?from=invite#profile"]) {
    assert.equal(getSafeNextPath(path), path);
    assert.equal(new URL(getLoginPath(path), "https://app.test").searchParams.get("next"), path);
  }
});

test("return paths reject external destinations, auth loops, and encoded tricks", () => {
  for (const path of [undefined, [], "https://evil.test", "//evil.test", "/\\evil.test", "/login?next=/trips", "/auth/callback",
    "/settings-elsewhere", "/trips/../../login", "/trips/%2f%2fevil.test", "/settings/%5cevil", "/settings/%0d%0aLocation:evil", "/trips\n", "/invite/%not-hex"]) {
    assert.equal(getSafeNextPath(path), "/settings");
  }
});

test("credential validation trims email and names but preserves passwords", () => {
  const form = new FormData();
  form.set("email", "  traveler@example.test  ");
  form.set("fullName", "  Alex  ");
  form.set("password", "  long password  ");
  const result = validateCredentials(form, true);
  assert.equal(result.valid, true);
  assert.equal(result.email, "traveler@example.test");
  assert.equal(result.fullName, "Alex");
  assert.equal(result.password, "  long password  ");
});

test("signup enforces profile and password bounds; login permits legacy passwords", () => {
  const form = new FormData();
  form.set("email", "traveler@example.test");
  form.set("password", "short");
  form.set("fullName", " ");
  const signup = validateCredentials(form, true);
  assert.ok(signup.fields.fullName);
  assert.ok(signup.fields.password);
  assert.equal(validateCredentials(form, false).valid, true);
  form.set("email", "not-an-email");
  assert.ok(validateCredentials(form, false).fields.email);
  form.set("fullName", "x".repeat(81));
  form.set("password", "x".repeat(129));
  assert.ok(validateCredentials(form, true).fields.fullName);
  assert.ok(validateCredentials(form, true).fields.password);
});
