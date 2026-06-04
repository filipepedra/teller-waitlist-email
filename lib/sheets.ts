import { google, type sheets_v4 } from "googleapis";

export type EmailSendStatus = "pending" | "sent" | "failed";

export type EmailSendRow = {
  dedupe_key: string;
  email_hash: string;
  template_id: string;
  status: EmailSendStatus;
  source: string;
  created_at: string;
  sent_at: string;
  message_id: string;
  error: string;
};

const EMAIL_SENDS_HEADERS: (keyof EmailSendRow)[] = [
  "dedupe_key",
  "email_hash",
  "template_id",
  "status",
  "source",
  "created_at",
  "sent_at",
  "message_id",
  "error",
];

const EMAIL_SENDS_TAB = "email_sends";

let cachedClient: sheets_v4.Sheets | null = null;

function loadCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
}

export function getSheetsClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;
  const creds = loadCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

export function getSpreadsheetId(): string {
  const id = process.env.WAITLIST_SHEET_ID;
  if (!id) throw new Error("WAITLIST_SHEET_ID is not set");
  return id;
}

async function ensureEmailSendsTab(sheets: sheets_v4.Sheets, spreadsheetId: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === EMAIL_SENDS_TAB);
  if (exists) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: EMAIL_SENDS_TAB } } }],
    },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${EMAIL_SENDS_TAB}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [EMAIL_SENDS_HEADERS] },
  });
}

export async function findEmailSendByDedupeKey(
  dedupeKey: string,
): Promise<{ rowIndex: number; row: Partial<EmailSendRow> } | null> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await ensureEmailSendsTab(sheets, spreadsheetId);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${EMAIL_SENDS_TAB}!A:I`,
  });
  const values = res.data.values ?? [];
  if (values.length < 2) return null;

  const header = values[0] as string[];
  const keyCol = header.indexOf("dedupe_key");
  if (keyCol === -1) return null;

  for (let i = 1; i < values.length; i++) {
    if (values[i][keyCol] === dedupeKey) {
      const row: Partial<EmailSendRow> = {};
      header.forEach((h, idx) => {
        (row as Record<string, string>)[h] = values[i][idx] ?? "";
      });
      return { rowIndex: i + 1, row };
    }
  }
  return null;
}

export async function appendEmailSend(row: Partial<EmailSendRow>): Promise<number> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await ensureEmailSendsTab(sheets, spreadsheetId);

  const values = EMAIL_SENDS_HEADERS.map((h) => row[h] ?? "");
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${EMAIL_SENDS_TAB}!A:I`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  });

  const updatedRange = res.data.updates?.updatedRange ?? "";
  const match = updatedRange.match(/!A(\d+):/);
  return match ? Number(match[1]) : 0;
}

export async function updateEmailSend(
  rowIndex: number,
  patch: Partial<EmailSendRow>,
): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${EMAIL_SENDS_TAB}!A${rowIndex}:I${rowIndex}`,
  });
  const current = (res.data.values?.[0] ?? []) as string[];
  const merged = EMAIL_SENDS_HEADERS.map((h, idx) => patch[h] ?? current[idx] ?? "");
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${EMAIL_SENDS_TAB}!A${rowIndex}:I${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [merged] },
  });
}

export async function appendWaitlistRow(record: {
  email: string;
  name?: string | null;
  source?: string | null;
}): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const tab = process.env.WAITLIST_SHEET_TAB ?? "waitlist";
  const headerRow = Number(process.env.WAITLIST_SHEET_HEADER_ROW ?? "1");

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!${headerRow}:${headerRow}`,
  });
  const headers = (headerRes.data.values?.[0] ?? []) as string[];
  if (headers.length === 0) {
    throw new Error(`waitlist tab "${tab}" has no header row at row ${headerRow}`);
  }

  const lookup: Record<string, string> = {
    email: record.email,
    name: record.name ?? "",
    source: record.source ?? "",
    created_at: new Date().toISOString(),
    timestamp: new Date().toISOString(),
  };

  const row = headers.map((h) => {
    const key = h.trim().toLowerCase();
    return lookup[key] ?? "";
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tab}!A:A`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

export function __resetClientForTests() {
  cachedClient = null;
}
