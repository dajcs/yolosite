"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STATUSES, STATUS_LABELS, type Application } from "@/lib/types";
import { docName } from "@/lib/docLinks";

export default function ApplicationsTable({
  applications,
}: {
  applications: Application[];
}) {
  const router = useRouter();

  async function patch(id: number, fields: Record<string, unknown>) {
    await fetch(`/api/assistant/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    router.refresh();
  }

  async function remove(id: number) {
    if (!confirm("Delete this application?")) return;
    await fetch(`/api/assistant/applications/${id}`, { method: "DELETE" });
    router.refresh();
  }

  if (applications.length === 0) {
    return <p className="text-gray">No applications yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded border border-surface2">
      <table className="w-full text-sm">
        <thead className="bg-surface2 text-left">
          <tr>
            <th className="p-2">ID</th>
            <th className="p-2">Date</th>
            <th className="p-2">Employer</th>
            <th className="p-2">Position</th>
            <th className="p-2">Ref</th>
            <th className="p-2">Status</th>
            <th className="p-2">Notes</th>
            <th className="p-2">Docs</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {applications.map((a) => (
            <tr key={a.id} className="border-t border-surface2 align-top">
              <td className="p-2">{a.id}</td>
              <td className="whitespace-nowrap p-2">{a.date}</td>
              <td className="p-2">{a.employer}</td>
              <td className="p-2">
                {a.link ? (
                  <a
                    href={a.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue hover:underline"
                  >
                    {a.title ?? a.link}
                  </a>
                ) : (
                  a.title
                )}
              </td>
              <td className="p-2">{a.ref_id}</td>
              <td className="p-2">
                <select
                  value={a.status}
                  onChange={(e) => patch(a.id, { status: e.target.value })}
                  className="rounded bg-surface2 p-1"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="p-2">
                <NotesCell id={a.id} notes={a.notes} onSave={patch} />
              </td>
              <td className="whitespace-nowrap p-2">
                {a.cv_url && (
                  <a
                    href={a.cv_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-purple hover:underline"
                  >
                    {docName(a.cv_url)}
                  </a>
                )}
                {a.letter_url && (
                  <a
                    href={a.letter_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 text-purple hover:underline"
                  >
                    {docName(a.letter_url)}
                  </a>
                )}
              </td>
              <td className="p-2">
                <button
                  onClick={() => remove(a.id)}
                  className="text-gray hover:text-text"
                  aria-label="Delete"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotesCell({
  id,
  notes,
  onSave,
}: {
  id: number;
  notes: string | null;
  onSave: (id: number, fields: Record<string, unknown>) => Promise<void>;
}) {
  const [value, setValue] = useState(notes ?? "");
  return (
    <textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value !== (notes ?? "")) onSave(id, { notes: value });
      }}
      rows={1}
      className="w-40 rounded bg-surface2 p-1"
    />
  );
}
