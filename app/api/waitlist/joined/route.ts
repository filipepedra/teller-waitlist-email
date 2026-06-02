import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/lib/db/client";
import { sentEmails } from "@/lib/db/schema";
import { dedupeKeyFor, hashEmail, payloadHash, TEMPLATE_ID } from "@/lib/dedupe";
import { HMAC_HEADER, parseSecrets, verify } from "@/lib/hmac";
import { log } from "@/lib/log";
import { sendWaitlistEmail } from "@/lib/resend";

export const runtime = "nodejs";

const PayloadSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().max(200).optional().nullable(),
  source: z.string().max(64).optional().nullable(),
  event_id: z.string().max(128).optional().nullable(),
});

export async function POST(req: Request) {
  const started = Date.now();
  const rawBody = await req.text();

  const secrets = parseSecrets(process.env.WAITLIST_EMAIL_HMAC_SECRET);
  if (secrets.length === 0) {
    log({ level: "error", event: "config_missing", detail: "WAITLIST_EMAIL_HMAC_SECRET unset" });
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const sig = req.headers.get(HMAC_HEADER);
  const auth = verify(rawBody, sig, secrets);
  if (!auth.ok) {
    log({ level: "warn", event: "hmac_rejected", reason: auth.reason });
    return NextResponse.json({ error: "unauthorized", reason: auth.reason }, { status: 401 });
  }

  let parsed: z.infer<typeof PayloadSchema>;
  try {
    parsed = PayloadSchema.parse(JSON.parse(rawBody));
  } catch (err) {
    log({
      level: "warn",
      event: "payload_invalid",
      detail: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const dedupeKey = dedupeKeyFor({ email: parsed.email, event_id: parsed.event_id });
  const emailHash = hashEmail(parsed.email);
  const db = getDb();

  const inserted = await db
    .insert(sentEmails)
    .values({
      dedupeKey,
      email: parsed.email,
      templateId: TEMPLATE_ID,
      source: parsed.source ?? null,
      status: "pending",
      payloadHash: payloadHash(rawBody),
    })
    .onConflictDoNothing({ target: sentEmails.dedupeKey })
    .returning({ id: sentEmails.id });

  if (inserted.length === 0) {
    log({
      level: "info",
      event: "waitlist_email_noop",
      reason: "already_sent",
      dedupe_key: dedupeKey,
      email_hash: emailHash,
      latency_ms: Date.now() - started,
    });
    return NextResponse.json({ status: "noop", reason: "already_sent" }, { status: 200 });
  }

  const sendResult = await sendWaitlistEmail({ to: parsed.email, name: parsed.name });
  const insertedId = inserted[0].id;

  if (!sendResult.ok) {
    await db
      .update(sentEmails)
      .set({ status: "failed", errorMessage: sendResult.error })
      .where(eq(sentEmails.id, insertedId));
    log({
      level: "error",
      event: "waitlist_email_failed",
      dedupe_key: dedupeKey,
      email_hash: emailHash,
      error: sendResult.error,
      latency_ms: Date.now() - started,
    });
    return NextResponse.json({ error: "send_failed" }, { status: 500 });
  }

  await db
    .update(sentEmails)
    .set({ status: "sent", resendId: sendResult.resendId, sentAt: new Date() })
    .where(eq(sentEmails.id, insertedId));

  log({
    level: "info",
    event: "waitlist_email_sent",
    dedupe_key: dedupeKey,
    email_hash: emailHash,
    resend_id: sendResult.resendId,
    latency_ms: Date.now() - started,
  });
  return NextResponse.json({ status: "sent" }, { status: 200 });
}
