"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EmailClassification, EmailRow } from "@/lib/types";

const ROW_TINT: Record<EmailClassification, string> = {
  job: "bg-green-500/10",
  no_job: "bg-red-500/10",
  unknown: "bg-yellow-500/10",
};
const CHIP: Record<EmailClassification, string> = {
  job: "bg-green-500",
  no_job: "bg-red-500",
  unknown: "bg-yellow-500",
};
const NEXT: Record<EmailClassification, EmailClassification> = {
  unknown: "job",
  job: "no_job",
  no_job: "unknown",
};

type PullStatus = { state: "pulling" | "done" | "error"; text: string };

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function EmailPanel({ lastCheck }: { lastCheck: string | null }) {
  const router = useRouter();
  const [start, setStart] = useState(
    lastCheck?.slice(0, 10) ?? isoDay(new Date(Date.now() - 7 * 86400_000)),
  );
  const [end, setEnd] = useState(isoDay(new Date()));
  const [emails, setEmails] = useState<EmailRow[] | null>(null);
  const [listing, setListing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [status, setStatus] = useState<Record<string, PullStatus>>({});
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  function patchRow(messageId: string, fields: Partial<EmailRow>) {
    setEmails(
      (prev) =>
        prev?.map((e) =>
          e.message_id === messageId ? { ...e, ...fields } : e,
        ) ?? null,
    );
  }

  function setRowStatus(messageId: string, s: PullStatus) {
    setStatus((prev) => ({ ...prev, [messageId]: s }));
  }

  async function list() {
    setListing(true);
    setError("");
    setStatus({});
    setProgress("");
    const res = await fetch("/api/assistant/emails/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start, end }),
    });
    setListing(false);
    if (!res.ok) {
      setError(((await res.json()) as { error?: string }).error ?? "Failed");
      return;
    }
    setEmails(((await res.json()) as { emails: EmailRow[] }).emails);
  }

  async function cycle(row: EmailRow) {
    const next = NEXT[row.classification];
    const res = await fetch(
      `/api/assistant/emails/${encodeURIComponent(row.message_id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classification: next }),
      },
    );
    if (res.ok) patchRow(row.message_id, { classification: next, manual: true });
  }

  async function pullOne(row: EmailRow): Promise<number> {
    const id = encodeURIComponent(row.message_id);
    for (let attempt = 0; attempt < 3; attempt++) {
      setRowStatus(row.message_id, {
        state: "pulling",
        text: attempt === 0 ? "pulling…" : `retry ${attempt}…`,
      });
      const res = await fetch(`/api/assistant/emails/${id}`, {
        method: "POST",
      });
      if (res.status === 429) {
        setRowStatus(row.message_id, {
          state: "pulling",
          text: "rate limited — waiting 30 s…",
        });
        await new Promise((r) => setTimeout(r, 30_000));
        continue;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setRowStatus(row.message_id, {
          state: "error",
          text: body.error ?? "failed",
        });
        return 0;
      }
      const { offersFound, titles, skipped, classification } =
        (await res.json()) as {
          offersFound: number;
          titles: string[];
          skipped: string[];
          classification: EmailClassification;
        };
      const parts = [...titles, ...skipped.map((s) => `skipped: ${s}`)];
      setRowStatus(row.message_id, {
        state: "done",
        text: parts.length > 0 ? parts.join(" · ") : "no offers",
      });
      patchRow(row.message_id, {
        pulled: true,
        offers_found: offersFound,
        classification,
      });
      router.refresh(); // offers list below updates live
      return offersFound;
    }
    setRowStatus(row.message_id, {
      state: "error",
      text: "rate limited — gave up, retry later",
    });
    return 0;
  }

  async function pullAll() {
    if (!emails) return;
    setPulling(true);
    const queue = emails.filter(
      (e) => !e.pulled && e.classification !== "no_job",
    );
    let done = 0;
    let found = 0;
    for (const row of queue) {
      found += await pullOne(row);
      done += 1;
      setProgress(
        `Pulled ${done}/${queue.length} — ${found} offer${found === 1 ? "" : "s"} found`,
      );
    }
    setPulling(false);
  }

  async function pullSingle(row: EmailRow) {
    setPulling(true);
    await pullOne(row);
    setPulling(false);
  }

  return (
    <div className="space-y-3 rounded border border-surface2 bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-bold">Email check</h2>
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="rounded bg-surface2 p-1 text-sm"
        />
        <span className="text-gray">→</span>
        <input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="rounded bg-surface2 p-1 text-sm"
        />
        <button
          onClick={list}
          disabled={listing || pulling}
          className="rounded bg-blue px-3 py-1 text-sm disabled:opacity-50"
        >
          {listing ? "Listing…" : "List emails"}
        </button>
        {emails && emails.length > 0 && (
          <button
            onClick={pullAll}
            disabled={pulling || listing}
            className="rounded bg-purple px-3 py-1 text-sm disabled:opacity-50"
          >
            {pulling ? "Pulling…" : "Pull all"}
          </button>
        )}
        {progress && <span className="text-sm text-gray">{progress}</span>}
        {error && <span className="text-sm text-yellow">{error}</span>}
      </div>

      {emails &&
        (emails.length === 0 ? (
          <p className="text-sm text-gray">No emails in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray">
                <tr>
                  <th className="p-1"></th>
                  <th className="p-1">Date</th>
                  <th className="p-1">From</th>
                  <th className="p-1">Subject</th>
                  <th className="p-1">Result</th>
                </tr>
              </thead>
              <tbody>
                {emails.map((e) => {
                  const s = status[e.message_id];
                  return (
                    <tr
                      key={e.message_id}
                      className={`border-t border-surface2 align-top ${ROW_TINT[e.classification]} ${e.pulled ? "opacity-60" : ""}`}
                    >
                      <td className="p-1">
                        <button
                          onClick={() => cycle(e)}
                          disabled={pulling}
                          aria-label={`Classification: ${e.classification} — click to change`}
                          title={e.classification}
                          className={`h-3 w-3 rounded-full ${CHIP[e.classification]}`}
                        />
                      </td>
                      <td className="whitespace-nowrap p-1">{e.date}</td>
                      <td className="max-w-48 truncate p-1">{e.from_addr}</td>
                      <td className="max-w-md truncate p-1">{e.subject}</td>
                      <td className="p-1">
                        {s ? (
                          <span
                            className={
                              s.state === "error" ? "text-yellow" : "text-gray"
                            }
                          >
                            {s.text}
                          </span>
                        ) : e.pulled ? (
                          <span className="text-gray">
                            {e.offers_found ?? 0} offer
                            {e.offers_found === 1 ? "" : "s"}
                          </span>
                        ) : (
                          <button
                            onClick={() => pullSingle(e)}
                            disabled={pulling}
                            className="text-blue hover:underline disabled:opacity-50"
                          >
                            pull
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}
