"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { createStoredDocument, getStoredDocuments } from "@/lib/utils/document-storage";
import { SpreadsheetDocument } from "@/types/spreadsheet";

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(timestamp);
}

export function DocumentDashboard() {
  const [documents, setDocuments] = useState<SpreadsheetDocument[]>(() => getStoredDocuments());
  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canCreate = useMemo(
    () => title.trim().length > 0 && authorName.trim().length > 0,
    [title, authorName]
  );

  function onCreateDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canCreate) {
      setError("Title and author are required.");
      return;
    }

    const created = createStoredDocument({ title, authorName });
    setDocuments((prev) => [created, ...prev]);
    setTitle("");
    setError(null);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Document Dashboard</h1>
        <p className="mt-2 text-slate-600">
          Create and manage spreadsheet documents. Real backend sync comes in the next step.
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Create New Document</h2>

        <form className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={onCreateDocument}>
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring"
            placeholder="Document title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />

          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring"
            placeholder="Author name"
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
          />

          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canCreate}
          >
            Create
          </button>
        </form>

        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Existing Documents</h2>

        {documents.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No documents yet. Create your first sheet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200">
            {documents.map((doc) => (
              <li key={doc.id} className="py-3">
                <Link className="group flex items-center justify-between gap-3" href={`/doc/${doc.id}`}>
                  <div>
                    <p className="text-sm font-medium text-slate-900 group-hover:text-blue-700">{doc.title}</p>
                    <p className="text-xs text-slate-600">by {doc.authorName}</p>
                  </div>

                  <p className="text-xs text-slate-500">Updated {formatDate(doc.updatedAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
