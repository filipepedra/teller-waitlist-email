import { NextResponse } from "next/server";
import { z } from "zod";

import { dedupeKeyFor, hashEmail, TEMPLATE_ID } from "@/lib/dedupe";
import { HMAC_HEADER, parseSecrets, verify } from "@/lib/hmac";
import { log } from "@/lib/log";
import { sendWaitlistEmail } from "@/lib/mailer";
import {
  appendEmailSend,
  appendWaitlistRow,
  findEmailSendByDedupeKey,
  updateEmailSend,
} from "@/lib/sheets";

export const runtime = "nodejs";

const DEV = process.env.NODE_ENV === "development";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": DEV ? "*" : (process.env.WAITLIST_ALLOWED_ORIGIN ?? ""),
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Teller-Signature",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function sheetEnabled() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.WAITLIST_SHEET_ID);
}

const PayloadSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().max(200).optional().nullable(),
  source: z.string().max(64).optional().nullable(),
  event_id: z.string().max(128).optional().nullable(),
  append_to_waitlist: z.boolean().optional(),
});

export async function POST(req: Request) {
  const started = Date.now();
  const rawBody = await req.text();

  const sig = req.headers.get(HMAC_HEADER);
  if (sig) {
    const secrets = parseSecrets(process.env.WAITLIST_EMAIL_HMAC_SECRET);
    if (secrets.length === 0) {
      log({ level: "error", event: "config_missing", detail: "WAITLIST_EMAIL_HMAC_SECRET unset" });
      return NextResponse.json({ error: "server_misconfigured" }, { status: 500, headers: CORS_HEADERS });
    }
    const auth = verify(rawBody, sig, secrets);
    if (!auth.ok) {
      log({ level: "warn", event: "hmac_rejected", reason: auth.reason });
      return NextResponse.json({ error: "unauthorized", reason: auth.reason }, { status: 401 });
    }
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
    return NextResponse.json({ error: "bad_request" }, { status: 400, headers: CORS_HEADERS });
  }

  const dedupeKey = dedupeKeyFor({ email: parsed.email, event_id: parsed.event_id });
  const emailHash = hashEmail(parsed.email);
  const sheetOn = sheetEnabled();

  let rowIndex = 0;
  if (sheetOn) {
    const existing = await findEmailSendByDedupeKey(dedupeKey);
    if (existing && existing.row.status === "sent") {
      log({
        level: "info",
        event: "waitlist_email_noop",
        reason: "already_sent",
        dedupe_key: dedupeKey,
        email_hash: emailHash,
        latency_ms: Date.now() - started,
      });
      return NextResponse.json({ status: "noop", reason: "already_sent" }, { status: 200, headers: CORS_HEADERS });
    }

    if (parsed.append_to_waitlist) {
      try {
        await appendWaitlistRow({
          email: parsed.email,
          name: parsed.name,
          source: parsed.source,
        });
        log({
          level: "info",
          event: "waitlist_row_appended",
          email_hash: emailHash,
          source: parsed.source ?? null,
        });
      } catch (err) {
        log({
          level: "error",
          event: "waitlist_row_failed",
          email_hash: emailHash,
          error: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json({ error: "waitlist_append_failed" }, { status: 500, headers: CORS_HEADERS });
      }
    }

    rowIndex =
      existing?.rowIndex ??
      (await appendEmailSend({
        dedupe_key: dedupeKey,
        email_hash: emailHash,
        template_id: TEMPLATE_ID,
        status: "pending",
        source: parsed.source ?? "",
        created_at: new Date().toISOString(),
      }));
  } else {
    log({
      level: "warn",
      event: "sheet_disabled",
      detail: "GOOGLE_SERVICE_ACCOUNT_JSON ou WAITLIST_SHEET_ID ausente — pulando Sheet",
      email_hash: emailHash,
    });
  }

  const sendResult = await sendWaitlistEmail({ to: parsed.email, name: parsed.name });

  if (!sendResult.ok) {
    if (sheetOn && rowIndex > 0) {
      await updateEmailSend(rowIndex, { status: "failed", error: sendResult.error });
    }
    log({
      level: "error",
      event: "waitlist_email_failed",
      dedupe_key: dedupeKey,
      email_hash: emailHash,
      error: sendResult.error,
      latency_ms: Date.now() - started,
    });
    return NextResponse.json({ error: "send_failed" }, { status: 500, headers: CORS_HEADERS });
  }

  if (sheetOn && rowIndex > 0) {
    await updateEmailSend(rowIndex, {
      status: "sent",
      sent_at: new Date().toISOString(),
      message_id: sendResult.messageId,
    });
  }

  log({
    level: "info",
    event: "waitlist_email_sent",
    dedupe_key: dedupeKey,
    email_hash: emailHash,
    message_id: sendResult.messageId,
    latency_ms: Date.now() - started,
  });
  return NextResponse.json({ status: "sent" }, { status: 200, headers: CORS_HEADERS });
}
