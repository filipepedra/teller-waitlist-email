import { describe, expect, it } from "vitest";

import { dedupeKeyFor, hashEmail } from "./dedupe";

describe("dedupe", () => {
  it("uses event_id when provided", () => {
    expect(dedupeKeyFor({ email: "a@x.com", event_id: "evt_1" })).toBe("evt_1");
  });

  it("falls back to sha256(email|waitlist_joined) when event_id missing", () => {
    const a = dedupeKeyFor({ email: "a@x.com" });
    const b = dedupeKeyFor({ email: "a@x.com" });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("normalizes email casing for dedupe", () => {
    expect(dedupeKeyFor({ email: "A@X.COM" })).toBe(dedupeKeyFor({ email: "a@x.com" }));
  });

  it("hashEmail is stable and lowercases input", () => {
    expect(hashEmail("A@X.COM")).toBe(hashEmail("a@x.com"));
    expect(hashEmail("a@x.com")).toHaveLength(64);
  });
});
