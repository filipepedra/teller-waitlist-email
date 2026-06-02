import { sql } from "drizzle-orm";
import { bigserial, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const sentEmails = pgTable(
  "sent_emails",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    dedupeKey: text("dedupe_key").notNull().unique(),
    email: text("email").notNull(),
    templateId: text("template_id").notNull(),
    source: text("source"),
    status: text("status", { enum: ["pending", "sent", "failed"] }).notNull(),
    resendId: text("resend_id"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    payloadHash: text("payload_hash"),
  },
  (t) => ({
    emailIdx: index("sent_emails_email_idx").on(t.email),
    statusIdx: index("sent_emails_status_idx").on(t.status),
  }),
);

export type SentEmail = typeof sentEmails.$inferSelect;
export type NewSentEmail = typeof sentEmails.$inferInsert;
