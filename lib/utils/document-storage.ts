import { SpreadsheetDocument, CreateDocumentInput } from "@/types/spreadsheet";

const STORAGE_KEY = "tm_docs_v1";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getStoredDocuments(): SpreadsheetDocument[] {
  if (!isBrowser()) {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as SpreadsheetDocument[];
    return parsed
      .filter((item) => Boolean(item?.id && item?.title && item?.authorName))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function createStoredDocument(input: CreateDocumentInput): SpreadsheetDocument {
  const newDocument: SpreadsheetDocument = {
    id: crypto.randomUUID(),
    title: input.title.trim(),
    authorName: input.authorName.trim(),
    updatedAt: Date.now()
  };

  if (!isBrowser()) {
    return newDocument;
  }

  const existing = getStoredDocuments();
  const next = [newDocument, ...existing];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

  return newDocument;
}
