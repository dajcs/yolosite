"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddOffer() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [dup, setDup] = useState<{
    message: string;
    link: string | null;
  } | null>(null);

  async function post(force: boolean) {
    setBusy(true);
    setMessage("");
    setDup(null);
    const res = await fetch("/api/assistant/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link, text, force }),
    });
    setBusy(false);
    if (res.status === 409) {
      const { message: dupMessage, match } = (await res.json()) as {
        message: string;
        match: { link: string | null };
      };
      setDup({ message: dupMessage, link: match.link });
      return;
    }
    if (res.status === 422) {
      const { error } = (await res.json()) as { error: string };
      setMessage(
        error === "fetch_failed"
          ? "Couldn't fetch that link (login wall or bot block). Paste the posting text below and submit again."
          : "Couldn't extract offer details. Check the text and try again.",
      );
      return;
    }
    if (!res.ok) {
      setMessage(((await res.json()) as { error?: string }).error ?? "Failed");
      return;
    }
    setLink("");
    setText("");
    setOpen(false);
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await post(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-purple px-3 py-1 text-sm"
      >
        + Add offer
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-full space-y-2 rounded border border-surface2 bg-surface p-4"
    >
      <input
        placeholder="Job posting link (optional if you paste text)"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        className="w-full rounded bg-surface2 p-2"
      />
      <textarea
        placeholder="Or paste the position description here"
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full rounded bg-surface2 p-2"
      />
      {message && <p className="text-sm text-yellow">{message}</p>}
      {dup && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <p className="text-yellow">
            {dup.link ? (
              <a
                href={dup.link}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {dup.message}
              </a>
            ) : (
              dup.message
            )}
          </p>
          <button
            type="button"
            onClick={() => post(true)}
            disabled={busy}
            className="rounded bg-surface2 px-3 py-1 disabled:opacity-50"
          >
            Add anyway
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-purple px-3 py-1 text-sm disabled:opacity-50"
        >
          {busy ? "Extracting…" : "Add"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded bg-surface2 px-3 py-1 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
