import { beforeEach, describe, expect, it, vi } from "vitest";

import { sign } from "@/lib/hmac";

const SECRET = "test-secret-32-bytes-or-longer-hex-string";

const findEmailSendByDedupeKey = vi.fn();
const appendEmailSend = vi.fn();
const updateEmailSend = vi.fn();
const appendWaitlistRow = vi.fn();
const sendWaitlistEmail = vi.fn();

vi.mock("@/lib/sheets", () => ({
  findEmailSendByDedupeKey: (...args: unknown[]) => findEmailSendByDedupeKey(...args),
  appendEmailSend: (...args: unknown[]) => appendEmailSend(...args),
  updateEmailSend: (...args: unknown[]) => updateEmailSend(...args),
  appendWaitlistRow: (...args: unknown[]) => appendWaitlistRow(...args),
}));

vi.mock("@/lib/mailer", () => ({
  sendWaitlistEmail: (...args: unknown[]) => sendWaitlistEmail(...args),
}));

async function loadRoute() {
  return await import("./route");
}

function buildReq(body: object) {
  const raw = JSON.stringify(body);
  const t = Math.floor(Date.now() / 1000);
  const header = sign(raw, SECRET, t);
  return new Request("http://test.local/api/waitlist/joined", {
    method: "POST",
    headers: { "content-type": "application/json", "x-teller-signature": header },
    body: raw,
  });
}

describe("POST /api/waitlist/joined", () => {
  beforeEach(() => {
    process.env.WAITLIST_EMAIL_HMAC_SECRET = SECRET;
    process.env.WAITLIST_EMAIL_FROM = "Teller <no-reply@useteller.com.br>";
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = "{}";
    process.env.WAITLIST_SHEET_ID = "sheet-id";
    vi.clearAllMocks();
    vi.resetModules();
    findEmailSendByDedupeKey.mockResolvedValue(null);
    appendEmailSend.mockResolvedValue(42);
    updateEmailSend.mockResolvedValue(undefined);
    appendWaitlistRow.mockResolvedValue(undefined);
  });

  it("envia email no primeiro hit e retorna status=sent", async () => {
    sendWaitlistEmail.mockResolvedValueOnce({ ok: true, messageId: "msg_123" });

    const { POST } = await loadRoute();
    const res = await POST(buildReq({ email: "user@example.com", name: "Fulano" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "sent" });
    expect(sendWaitlistEmail).toHaveBeenCalledWith({ to: "user@example.com", name: "Fulano" });
    expect(appendEmailSend).toHaveBeenCalledTimes(1);
    expect(updateEmailSend).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ status: "sent", message_id: "msg_123" }),
    );
    expect(appendWaitlistRow).not.toHaveBeenCalled();
  });

  it("também appenda na aba waitlist quando append_to_waitlist=true", async () => {
    sendWaitlistEmail.mockResolvedValueOnce({ ok: true, messageId: "msg_xyz" });

    const { POST } = await loadRoute();
    const res = await POST(
      buildReq({
        email: "user@example.com",
        name: "Fulano",
        source: "local_simulator",
        append_to_waitlist: true,
      }),
    );

    expect(res.status).toBe(200);
    expect(appendWaitlistRow).toHaveBeenCalledWith({
      email: "user@example.com",
      name: "Fulano",
      source: "local_simulator",
    });
  });

  it("retorna noop quando dedupe encontra status=sent", async () => {
    findEmailSendByDedupeKey.mockResolvedValueOnce({
      rowIndex: 7,
      row: { status: "sent" },
    });

    const { POST } = await loadRoute();
    const res = await POST(buildReq({ email: "user@example.com" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "noop", reason: "already_sent" });
    expect(sendWaitlistEmail).not.toHaveBeenCalled();
    expect(appendEmailSend).not.toHaveBeenCalled();
  });

  it("retenta envio quando linha existe mas status != sent", async () => {
    findEmailSendByDedupeKey.mockResolvedValueOnce({
      rowIndex: 9,
      row: { status: "failed" },
    });
    sendWaitlistEmail.mockResolvedValueOnce({ ok: true, messageId: "msg_retry" });

    const { POST } = await loadRoute();
    const res = await POST(buildReq({ email: "user@example.com" }));

    expect(res.status).toBe(200);
    expect(appendEmailSend).not.toHaveBeenCalled();
    expect(updateEmailSend).toHaveBeenCalledWith(
      9,
      expect.objectContaining({ status: "sent", message_id: "msg_retry" }),
    );
  });

  it("retorna 400 em email inválido", async () => {
    const { POST } = await loadRoute();
    const res = await POST(buildReq({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(sendWaitlistEmail).not.toHaveBeenCalled();
  });

  it("retorna 401 sem assinatura HMAC", async () => {
    const { POST } = await loadRoute();
    const req = new Request("http://test.local/api/waitlist/joined", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("retorna 401 com body adulterado", async () => {
    const t = Math.floor(Date.now() / 1000);
    const header = sign(JSON.stringify({ email: "a@x.com" }), SECRET, t);
    const req = new Request("http://test.local/api/waitlist/joined", {
      method: "POST",
      headers: { "content-type": "application/json", "x-teller-signature": header },
      body: JSON.stringify({ email: "evil@x.com" }),
    });
    const { POST } = await loadRoute();
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("retorna 500 e marca status=failed quando Resend falha", async () => {
    sendWaitlistEmail.mockResolvedValueOnce({ ok: false, error: "domain not verified" });

    const { POST } = await loadRoute();
    const res = await POST(buildReq({ email: "user@example.com" }));

    expect(res.status).toBe(500);
    expect(updateEmailSend).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ status: "failed", error: "domain not verified" }),
    );
  });

  it("modo só-email: envia sem chamar Sheet quando GOOGLE_SERVICE_ACCOUNT_JSON ausente", async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    sendWaitlistEmail.mockResolvedValueOnce({ ok: true, messageId: "msg_only_email" });

    const { POST } = await loadRoute();
    const res = await POST(
      buildReq({ email: "user@example.com", append_to_waitlist: true }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "sent" });
    expect(findEmailSendByDedupeKey).not.toHaveBeenCalled();
    expect(appendEmailSend).not.toHaveBeenCalled();
    expect(updateEmailSend).not.toHaveBeenCalled();
    expect(appendWaitlistRow).not.toHaveBeenCalled();
    expect(sendWaitlistEmail).toHaveBeenCalledWith({ to: "user@example.com", name: undefined });
  });

  it("modo só-email: retorna 500 quando Resend falha (sem Sheet update)", async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    sendWaitlistEmail.mockResolvedValueOnce({ ok: false, error: "resend rate limit" });

    const { POST } = await loadRoute();
    const res = await POST(buildReq({ email: "user@example.com" }));

    expect(res.status).toBe(500);
    expect(updateEmailSend).not.toHaveBeenCalled();
  });

  it("retorna 500 se append na waitlist falha (sem enviar email)", async () => {
    appendWaitlistRow.mockRejectedValueOnce(new Error("sheet not found"));

    const { POST } = await loadRoute();
    const res = await POST(
      buildReq({
        email: "user@example.com",
        append_to_waitlist: true,
      }),
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "waitlist_append_failed" });
    expect(sendWaitlistEmail).not.toHaveBeenCalled();
  });
});
