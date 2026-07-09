"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const EMPTY = {
  employer: "",
  title: "",
  link: "",
  ref_id: "",
  offer_text: "",
  notes: "",
};

export default function AddApplication() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");

  function set(key: keyof typeof EMPTY) {
    return (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => setForm({ ...form, [key]: e.target.value });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/assistant/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      setError(((await res.json()) as { error?: string }).error ?? "Failed");
      return;
    }
    setForm(EMPTY);
    setError("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-purple px-3 py-1 text-sm"
      >
        + Add application
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-full space-y-2 rounded border border-surface2 bg-surface p-4"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          placeholder="Employer"
          value={form.employer}
          onChange={set("employer")}
          className="rounded bg-surface2 p-2"
        />
        <input
          placeholder="Position"
          value={form.title}
          onChange={set("title")}
          className="rounded bg-surface2 p-2"
        />
        <input
          placeholder="Link"
          value={form.link}
          onChange={set("link")}
          className="rounded bg-surface2 p-2"
        />
        <input
          placeholder="Ref. ID"
          value={form.ref_id}
          onChange={set("ref_id")}
          className="rounded bg-surface2 p-2"
        />
      </div>
      <textarea
        placeholder="Job offer text"
        rows={4}
        value={form.offer_text}
        onChange={set("offer_text")}
        className="w-full rounded bg-surface2 p-2"
      />
      <textarea
        placeholder="Notes"
        rows={2}
        value={form.notes}
        onChange={set("notes")}
        className="w-full rounded bg-surface2 p-2"
      />
      {error && <p className="text-sm text-yellow">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="rounded bg-purple px-3 py-1 text-sm">
          Save
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
