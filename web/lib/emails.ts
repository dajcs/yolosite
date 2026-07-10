import { db } from "./db";
import type { EmailHeader } from "./email";
import {
  EMAIL_CLASSIFICATIONS,
  type EmailClassification,
  type EmailRow,
} from "./types";

const COLUMNS = `message_id, uid, to_char(date, 'YYYY-MM-DD HH24:MI') AS date,
  from_addr, to_addr, subject, classification, manual,
  (pulled_at IS NOT NULL) AS pulled, offers_found`;

export async function upsertEmails(headers: EmailHeader[]): Promise<void> {
  for (const h of headers) {
    // Predict from the sender's most recent classified email.
    const prior = await db()`
      SELECT classification FROM emails
      WHERE from_addr = ${h.from} AND classification <> 'unknown'
      ORDER BY date DESC LIMIT 1`;
    const predicted = prior.length
      ? (prior[0] as { classification: string }).classification
      : "unknown";
    await db()`
      INSERT INTO emails (message_id, uid, date, from_addr, to_addr, subject, classification)
      VALUES (${h.messageId}, ${h.uid}, ${h.date}, ${h.from}, ${h.to}, ${h.subject}, ${predicted})
      ON CONFLICT (message_id) DO UPDATE
        SET uid = EXCLUDED.uid, date = EXCLUDED.date, from_addr = EXCLUDED.from_addr,
            to_addr = EXCLUDED.to_addr, subject = EXCLUDED.subject`;
  }
}

export async function listEmails(start: Date, end: Date): Promise<EmailRow[]> {
  const endExclusive = new Date(end);
  endExclusive.setDate(endExclusive.getDate() + 1);
  const rows = await db().query(
    `SELECT ${COLUMNS} FROM emails WHERE date >= $1 AND date < $2 ORDER BY date DESC`,
    [start, endExclusive],
  );
  return rows as unknown as EmailRow[];
}

export async function getEmail(messageId: string): Promise<EmailRow | null> {
  const rows = await db().query(
    `SELECT ${COLUMNS} FROM emails WHERE message_id = $1`,
    [messageId],
  );
  return rows.length ? (rows as unknown as EmailRow[])[0] : null;
}

export async function setClassification(
  messageId: string,
  classification: string,
): Promise<boolean> {
  if (!EMAIL_CLASSIFICATIONS.includes(classification as EmailClassification)) {
    return false;
  }
  await db()`
    UPDATE emails SET classification = ${classification}, manual = true
    WHERE message_id = ${messageId}`;
  return true;
}

export async function markPulled(
  messageId: string,
  offersFound: number,
): Promise<void> {
  await db()`
    UPDATE emails
    SET pulled_at = now(), offers_found = ${offersFound},
        classification = CASE
          WHEN manual THEN classification
          WHEN ${offersFound} > 0 THEN 'job'
          ELSE 'no_job'
        END
    WHERE message_id = ${messageId}`;
}
