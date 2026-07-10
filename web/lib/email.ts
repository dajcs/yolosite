import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { htmlToPostingText } from "./fetchPosting";

export type EmailHeader = {
  messageId: string;
  uid: number;
  date: Date;
  from: string;
  to: string;
  subject: string;
};

function imapClient(): ImapFlow {
  return new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER!,
      pass: process.env.GMAIL_APP_PASSWORD!,
    },
    logger: false,
  });
}

function addressList(
  entries: { address?: string; name?: string }[] | undefined,
): string {
  return (entries ?? []).map((a) => a.address ?? a.name ?? "").join(", ");
}

export async function listEmailHeaders(
  start: Date,
  end: Date,
): Promise<EmailHeader[]> {
  const client = imapClient();
  await client.connect();
  const headers: EmailHeader[] = [];
  const lock = await client.getMailboxLock("INBOX");
  try {
    // IMAP date search is day-granular and BEFORE is exclusive.
    const before = new Date(end);
    before.setDate(before.getDate() + 1);
    const uids = await client.search({ since: start, before }, { uid: true });
    if (uids && uids.length > 0) {
      for await (const msg of client.fetch(
        uids,
        { envelope: true, uid: true },
        { uid: true },
      )) {
        const env = msg.envelope;
        if (!env) continue;
        headers.push({
          messageId: env.messageId ?? `uid-${msg.uid}`,
          uid: msg.uid,
          date: env.date ?? new Date(),
          from: addressList(env.from),
          to: addressList(env.to),
          subject: env.subject ?? "(no subject)",
        });
      }
    }
  } finally {
    lock.release();
  }
  await client.logout();
  return headers;
}

export async function fetchEmailBody(
  uid: number,
): Promise<{ subject: string; from: string; body: string } | null> {
  const client = imapClient();
  await client.connect();
  let result: { subject: string; from: string; body: string } | null = null;
  const lock = await client.getMailboxLock("INBOX");
  try {
    const msg = await client.fetchOne(
      String(uid),
      { source: true },
      { uid: true },
    );
    if (msg && msg.source) {
      const parsed = await simpleParser(msg.source);
      result = {
        subject: parsed.subject ?? "(no subject)",
        from: parsed.from?.text ?? "",
        body:
          parsed.text?.trim() ||
          (parsed.html ? htmlToPostingText(parsed.html) : ""),
      };
    }
  } finally {
    lock.release();
  }
  await client.logout();
  return result;
}
