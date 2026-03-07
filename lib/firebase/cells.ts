import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp
} from "firebase/firestore";
import { FIREBASE_COLLECTIONS } from "@/lib/firebase/constants";
import { getFirestoreDb, hasFirebaseConfig } from "@/lib/firebase/client";
import { CellFormat } from "@/types/spreadsheet";

type FirestoreCellData = {
  raw?: unknown;
  format?: unknown;
};

export type DocumentCellsSnapshot = {
  values: Record<string, string>;
  formats: Record<string, CellFormat>;
};

export function subscribeToDocumentCells(
  documentId: string,
  onCells: (cells: DocumentCellsSnapshot) => void,
  onError?: (error: Error) => void
): () => void {
  if (!hasFirebaseConfig()) {
    onCells({ values: {}, formats: {} });
    return () => undefined;
  }

  const db = getFirestoreDb();
  const cellsCollection = collection(db, FIREBASE_COLLECTIONS.documents, documentId, FIREBASE_COLLECTIONS.cells);

  return onSnapshot(
    cellsCollection,
    (snapshot) => {
      const nextValues: Record<string, string> = {};
      const nextFormats: Record<string, CellFormat> = {};
      snapshot.forEach((entry) => {
        const data = entry.data() as FirestoreCellData;
        if (typeof data.raw === "string") {
          nextValues[entry.id] = data.raw;
        }

        const rawFormat = data.format as Partial<CellFormat> | undefined;
        if (rawFormat && typeof rawFormat === "object") {
          nextFormats[entry.id] = {
            bold: Boolean(rawFormat.bold),
            italic: Boolean(rawFormat.italic),
            color: typeof rawFormat.color === "string" ? rawFormat.color : "#0f172a"
          };
        }
      });
      onCells({ values: nextValues, formats: nextFormats });
    },
    (error) => {
      onError?.(error);
    }
  );
}

export async function upsertCellValue(
  documentId: string,
  cellId: string,
  rawValue: string,
  format: CellFormat
): Promise<void> {
  if (!hasFirebaseConfig()) {
    throw new Error("Firebase is not configured.");
  }

  const db = getFirestoreDb();
  const cellRef = doc(db, FIREBASE_COLLECTIONS.documents, documentId, FIREBASE_COLLECTIONS.cells, cellId);
  const isDefaultFormat = !format.bold && !format.italic && format.color === "#0f172a";

  if (rawValue.trim().length === 0 && isDefaultFormat) {
    await deleteDoc(cellRef);
    return;
  }

  await setDoc(
    cellRef,
    {
      raw: rawValue,
      format,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}
