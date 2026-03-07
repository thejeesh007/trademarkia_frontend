"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthUser, signInWithGoogle, signOutCurrentUser, subscribeToAuthState } from "@/lib/firebase/auth";
import { createDocument, listDocuments } from "@/lib/firebase/documents";
import { hasFirebaseConfig } from "@/lib/firebase/client";
import { SpreadsheetDocument } from "@/types/spreadsheet";

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(timestamp);
}

export function DocumentDashboard() {
  const [documents, setDocuments] = useState<SpreadsheetDocument[]>([]);
  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canCreate = useMemo(
    () => title.trim().length > 0 && authorName.trim().length > 0 && !isCreating,
    [title, authorName, isCreating]
  );

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((user) => {
      setAuthUser(user);
      setIsAuthLoading(false);
      if (user?.displayName) {
        setAuthorName((prev) => (prev.trim() ? prev : user.displayName));
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadDocuments() {
      if (!hasFirebaseConfig()) {
        if (isMounted) {
          setError("Firebase env is missing. Add NEXT_PUBLIC_FIREBASE_* values.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const fetched = await listDocuments();
        if (isMounted) {
          setDocuments(fetched);
        }
      } catch (err) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : "Failed to load documents from Firestore.";
          setError(message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDocuments();

    return () => {
      isMounted = false;
    };
  }, []);

  async function onGoogleSignIn() {
    try {
      const user = await signInWithGoogle();
      setAuthUser(user);
      if (user.displayName) {
        setAuthorName((prev) => (prev.trim() ? prev : user.displayName));
      }
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Google sign-in failed.";
      setError(message);
    }
  }

  async function onSignOut() {
    try {
      await signOutCurrentUser();
      setAuthUser(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-out failed.";
      setError(message);
    }
  }

  async function onCreateDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canCreate) {
      setError("Title and author are required.");
      return;
    }

    try {
      setIsCreating(true);
      const created = await createDocument({ title, authorName });
      setDocuments((prev) => [created, ...prev]);
      setTitle("");
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create document.";
      setError(message);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-12">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Document Dashboard</h1>
            <p className="themed-muted mt-2">
              Create and manage spreadsheet documents stored in Firestore.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {authUser ? (
              <>
                <span className="glass-panel rounded-full px-4 py-1 text-xs font-semibold">
                  {authUser.displayName}
                </span>
                <button
                  type="button"
                  className="dark-btn rounded-full px-3 py-1 text-xs font-semibold"
                  onClick={onSignOut}
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                type="button"
                className="accent-btn rounded-full px-4 py-1.5 text-xs font-bold disabled:opacity-60"
                onClick={onGoogleSignIn}
                disabled={isAuthLoading}
              >
                {isAuthLoading ? "Loading..." : "Sign in with Google"}
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="glass-panel rounded-[22px] p-6">
        <h2 className="text-lg font-semibold">Create New Document</h2>

        <form className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={onCreateDocument}>
          <input
            className="themed-input rounded-xl px-4 py-3 text-sm"
            placeholder="Document title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />

          <input
            className="themed-input rounded-xl px-4 py-3 text-sm"
            placeholder="Author name"
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
          />

          <button
            type="submit"
            className="accent-btn rounded-xl px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canCreate}
          >
            {isCreating ? "Creating..." : "Create"}
          </button>
        </form>

        {error ? <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{error}</p> : null}
      </section>

      <section className="glass-panel rounded-[22px] p-6">
        <h2 className="text-lg font-semibold">Existing Documents</h2>

        {isLoading ? (
          <p className="themed-muted mt-4 text-sm">Loading documents...</p>
        ) : documents.length === 0 ? (
          <p className="themed-muted mt-4 text-sm">No documents yet. Create your first sheet.</p>
        ) : (
          <ul className="mt-4 divide-y" style={{ borderColor: "var(--border)" }}>
            {documents.map((doc) => (
              <li key={doc.id} className="py-3">
                <Link className="group flex items-center justify-between gap-3" href={`/doc/${doc.id}`}>
                  <div>
                    <p className="text-sm font-medium group-hover:opacity-70">{doc.title}</p>
                    <p className="themed-muted text-xs">by {doc.authorName}</p>
                  </div>

                  <p className="themed-muted text-xs">Updated {formatDate(doc.updatedAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
