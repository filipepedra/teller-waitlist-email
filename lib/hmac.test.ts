import { describe, expect, it } from "vitest";

import { parseSecrets, sign, verify } from "./hmac";

const SECRET = "test-secret-32-bytes-or-longer-hex-string";
const BODY = JSON.stringify({ email: "user@example.com" });

describe("hmac", () => {
  it("verifies a freshly-signed payload", () => {
    const t = Math.floor(Date.now() / 1000);
    const header = sign(BODY, SECRET, t);
    expect(verify(BODY, header, [SECRET])).toEqual({ ok: true });
  });

  it("rejects missing header", () => {
    expect(verify(BODY, null, [SECRET])).toEqual({ ok: false, reason: "missing_header" });
  });

  it("rejects malformed header", () => {
    expect(verify(BODY, "garbage", [SECRET])).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects stale timestamp (>300s)", () => {
    const t = Math.floor(Date.now() / 1000) - 301;
    const header = sign(BODY, SECRET, t);
    expect(verify(BODY, header, [SECRET])).toEqual({ ok: false, reason: "stale_timestamp" });
  });

  it("rejects mismatched signature", () => {
    const t = Math.floor(Date.now() / 1000);
    const header = sign(BODY, "other-secret", t);
    expect(verify(BODY, header, [SECRET])).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("accepts any secret in the list (rotation)", () => {
    const t = Math.floor(Date.now() / 1000);
    const header = sign(BODY, "secret-b", t);
    expect(verify(BODY, header, ["secret-a", "secret-b"])).toEqual({ ok: true });
  });

  it("body tampering invalidates signature", () => {
    const t = Math.floor(Date.now() / 1000);
    const header = sign(BODY, SECRET, t);
    expect(verify(BODY + "x", header, [SECRET])).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("parseSecrets splits CSV and trims", () => {
    expect(parseSecrets("a, b ,c")).toEqual(["a", "b", "c"]);
    expect(parseSecrets(undefined)).toEqual([]);
    expect(parseSecrets("")).toEqual([]);
  });
});
