import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { db } from "./db";
import { htmlToPostingText } from "./fetchPosting";

export type InboxEmail = {
  messageId: string;
  subject: string;
  from: string;
  date: Date;
  body: string;
};

export async function fetchEmailsSince(since: Date): Promise<InboxEmail[]> {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER!,
      pass: process.env.GMAIL_APP_PASSWORD!,
    },
    logger: false,
  });

  await client.connect();
  const emails: InboxEmail[] = [];
  const lock = await client.getMailboxLock("INBOX");
  try {
    const uids = await client.search({ since });
    const recent = (uids || []).slice(-50); // hard cap per connection
    if (recent.length > 0) {
      for await (const message of client.fetch(recent, { source: true })) {
        if (!message.source) continue;
        const parsed = await simpleParser(message.source);
        const body =
          parsed.text?.trim() ||
          (parsed.html ? htmlToPostingText(parsed.html) : "");
        emails.push({
          messageId: parsed.messageId ?? `uid-${message.uid}`,
          subject: parsed.subject ?? "(no subject)",
          from: parsed.from?.text ?? "",
          date: parsed.date ?? new Date(),
          body,
        });
      }
    }
  } finally {
    lock.release();
  }
  await client.logout();
  return emails;
}

export async function isProcessed(messageId: string): Promise<boolean> {
  const rows = await db()`
    SELECT 1 FROM processed_emails WHERE message_id = ${messageId}`;
  return rows.length > 0;
}

export async function markProcessed(messageId: string): Promise<void> {
  await db()`
    INSERT INTO processed_emails (message_id) VALUES (${messageId})
    ON CONFLICT DO NOTHING`;
}
