import { beforeEach, describe, expect, it, vi } from "vitest";

import { sign } from "@/lib/hmac";

const SECRET = "test-secret-32-bytes-or-longer-hex-string";

const insertReturning = vi.fn();
const insertOnConflict = vi.fn(() => ({ returning: insertReturning }));
const insertValues = vi.fn(() => ({ onConflictDoNothing: insertOnConflict }));
const insert = vi.fn(() => ({ values: insertValues }));

const updateWhere = vi.fn(async () => undefined);
const updateSet = vi.fn(() => ({ where: updateWhere }));
const update = vi.fn(() => ({ set: updateSet }));

const sendWaitlistEmail = vi.fn();

vi.mock("@/lib/db/client", () => ({
  getDb: () => ({ insert, update }),
}));

vi.mock("@/lib/resend", () => ({
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
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("sends on first insert and returns status=sent", async () => {
    insertReturning.mockResolvedValueOnce([{ id: 1n }]);
    sendWaitlistEmail.mockResolvedValueOnce({ ok: true, resendId: "re_123" });

    const { POST } = await loadRoute();
    const res = await POST(buildReq({ email: "user@example.com", name: "Fulano" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "sent" });
    expect(sendWaitlistEmail).toHaveBeenCalledWith({ to: "user@example.com", name: "Fulano" });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("returns noop when dedupe hits (insert returns empty)", async () => {
    insertReturning.mockResolvedValueOnce([]);

    const { POST } = await loadRoute();
    const res = await POST(buildReq({ email: "user@example.com" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "noop", reason: "already_sent" });
    expect(sendWaitlistEmail).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid email", async () => {
    const { POST } = await loadRoute();
    const res = await POST(buildReq({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(sendWaitlistEmail).not.toHaveBeenCalled();
  });

  it("returns 401 on missing signature", async () => {
    const { POST } = await loadRoute();
    const req = new Request("http://test.local/api/waitlist/joined", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 on tampered body", async () => {
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

  it("returns 500 and marks row failed when Resend errors", async () => {
    insertReturning.mockResolvedValueOnce([{ id: 2n }]);
    sendWaitlistEmail.mockResolvedValueOnce({ ok: false, error: "domain not verified" });

    const { POST } = await loadRoute();
    const res = await POST(buildReq({ email: "user@example.com" }));

    expect(res.status).toBe(500);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", errorMessage: "domain not verified" }),
    );
  });
});
