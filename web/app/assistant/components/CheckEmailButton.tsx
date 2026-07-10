"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CheckEmailButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function check() {
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/assistant/check-email", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      setMessage(((await res.json()) as { error?: string }).error ?? "Failed");
      return;
    }
    const { scanned, offersAdded, remaining } = (await res.json()) as {
      scanned: number;
      offersAdded: number;
      remaining: number;
    };
    setMessage(
      `Scanned ${scanned} email${scanned === 1 ? "" : "s"}, added ${offersAdded} offer${offersAdded === 1 ? "" : "s"}` +
        (remaining > 0 ? `. ${remaining} more to scan — click again.` : "."),
    );
    router.refresh();
  }

  return (
    <span className="flex items-center gap-3">
      <button
        onClick={check}
        disabled={busy}
        className="rounded bg-blue px-3 py-1 text-sm disabled:opacity-50"
      >
        {busy ? "Checking…" : "Check email"}
      </button>
      {message && <span className="text-sm text-gray">{message}</span>}
    </span>
  );
}
