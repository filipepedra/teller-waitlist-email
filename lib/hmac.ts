import { createHmac, timingSafeEqual } from "node:crypto";

const HEADER_NAME = "x-teller-signature";
const MAX_SKEW_SECONDS = 300;

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "missing_header" | "malformed" | "stale_timestamp" | "bad_signature" };

export function sign(body: string, secret: string, timestampSeconds: number): string {
  const mac = createHmac("sha256", secret).update(`${timestampSeconds}.${body}`).digest("hex");
  return `t=${timestampSeconds},v1=${mac}`;
}

export function verify(
  body: string,
  header: string | null | undefined,
  secrets: string[],
  now: () => number = Date.now,
): VerifyResult {
  if (!header) return { ok: false, reason: "missing_header" };

  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const eq = part.indexOf("=");
      if (eq === -1) return ["", ""];
      return [part.slice(0, eq).trim(), part.slice(eq + 1).trim()];
    }),
  );

  const ts = Number(parts.t);
  const v1 = parts.v1;
  if (!ts || !v1 || !Number.isFinite(ts)) return { ok: false, reason: "malformed" };

  const nowSec = Math.floor(now() / 1000);
  if (Math.abs(nowSec - ts) > MAX_SKEW_SECONDS) return { ok: false, reason: "stale_timestamp" };

  const candidate = Buffer.from(v1, "hex");
  if (candidate.length !== 32) return { ok: false, reason: "malformed" };

  for (const secret of secrets) {
    const expected = createHmac("sha256", secret).update(`${ts}.${body}`).digest();
    if (expected.length === candidate.length && timingSafeEqual(expected, candidate)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: "bad_signature" };
}

export function parseSecrets(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const HMAC_HEADER = HEADER_NAME;
