"use server";

import { HMAC_HEADER, parseSecrets, sign } from "@/lib/hmac";

export type SimulateResult =
  | { ok: true; status: string; reason?: string }
  | { ok: false; error: string; status?: number };

function endpointUrl(): string {
  const base = process.env.SIMULATOR_TARGET_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/waitlist/joined`;
}

export async function simulateWaitlistJoin(formData: FormData): Promise<SimulateResult> {
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!email) return { ok: false, error: "email obrigatório" };

  const secrets = parseSecrets(process.env.WAITLIST_EMAIL_HMAC_SECRET);
  if (secrets.length === 0) return { ok: false, error: "WAITLIST_EMAIL_HMAC_SECRET não setado" };

  const payload = {
    email,
    name: name || undefined,
    source: "local_simulator",
    append_to_waitlist: true,
  };
  const body = JSON.stringify(payload);
  const t = Math.floor(Date.now() / 1000);
  const signature = sign(body, secrets[0], t);

  try {
    const res = await fetch(endpointUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [HMAC_HEADER]: signature,
      },
      body,
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: typeof json.error === "string" ? json.error : `HTTP ${res.status}`,
      };
    }
    return {
      ok: true,
      status: typeof json.status === "string" ? json.status : "sent",
      reason: typeof json.reason === "string" ? json.reason : undefined,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
