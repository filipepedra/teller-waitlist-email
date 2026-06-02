import { createHash } from "node:crypto";

export const TEMPLATE_ID = "waitlist_joined_v1";

export function hashEmail(email: string): string {
  return createHash("sha256").update(email.toLowerCase()).digest("hex");
}

export function dedupeKeyFor(payload: { email: string; event_id?: string | null }): string {
  if (payload.event_id) return payload.event_id;
  return createHash("sha256")
    .update(`${payload.email.toLowerCase()}|waitlist_joined`)
    .digest("hex");
}

export function payloadHash(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
