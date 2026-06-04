import { render } from "@react-email/components";
import { Resend } from "resend";

import WaitlistJoined, { SUBJECT } from "@/emails/WaitlistJoined";

export type SendWaitlistEmailInput = {
  to: string;
  name?: string | null;
};

export type SendWaitlistEmailResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

let cached: Resend | null = null;

function client(): Resend {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  cached = new Resend(key);
  return cached;
}

export async function sendWaitlistEmail(
  input: SendWaitlistEmailInput,
): Promise<SendWaitlistEmailResult> {
  const from = process.env.WAITLIST_EMAIL_FROM || "Teller <onboarding@resend.dev>";
  const replyTo = process.env.WAITLIST_EMAIL_REPLY_TO || undefined;

  const html = await render(WaitlistJoined({ name: input.name }));
  const text = await render(WaitlistJoined({ name: input.name }), { plainText: true });

  try {
    const result = await client().emails.send({
      from,
      to: input.to,
      subject: SUBJECT,
      html,
      text,
      replyTo,
    });
    if (result.error) return { ok: false, error: result.error.message };
    if (!result.data?.id) return { ok: false, error: "resend returned no id" };
    return { ok: true, messageId: result.data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function __resetClientForTests() {
  cached = null;
}
