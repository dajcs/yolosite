"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Offer } from "@/lib/types";

export default function OfferCard({ offer }: { offer: Offer }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: "dismiss" | "apply") {
    setBusy(true);
    const res = await fetch(`/api/assistant/offers/${offer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (action === "apply" && res.ok) {
      router.push("/assistant/applications");
    } else {
      router.refresh();
    }
  }

  return (
    <div className="rounded border border-surface2 bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="font-bold">{offer.title ?? "Untitled position"}</span>
          {offer.employer && <span className="text-gray"> — {offer.employer}</span>}
        </div>
        <span className="text-xs text-gray">
          {offer.source} · {offer.created_at}
        </span>
      </div>
      <div className="mt-1 space-y-1 text-sm text-gray">
        {offer.location && <div>Location: {offer.location}</div>}
        {offer.ref_id && <div>Ref: {offer.ref_id}</div>}
        {offer.deadline && <div>Deadline: {offer.deadline}</div>}
        {offer.requirements && <div className="text-text">{offer.requirements}</div>}
        {offer.email_ref && <div className="text-xs">From email: {offer.email_ref}</div>}
        {offer.link && (
          <a
            href={offer.link}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-blue hover:underline"
          >
            {offer.link}
          </a>
        )}
      </div>
      {offer.posting_text && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-blue">Full posting</summary>
          <pre className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap rounded bg-surface2 p-3 font-sans">
            {offer.posting_text}
          </pre>
        </details>
      )}
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => act("apply")}
          disabled={busy}
          className="rounded bg-purple px-3 py-1 text-sm disabled:opacity-50"
        >
          Apply
        </button>
        <button
          onClick={() => act("dismiss")}
          disabled={busy}
          className="rounded bg-surface2 px-3 py-1 text-sm disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
