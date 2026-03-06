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

type FirestoreCellData = {
  raw?: unknown;
};

export function subscribeToDocumentCells(
  documentId: string,
  onCells: (cells: Record<string, string>) => void,
  onError?: (error: Error) => void
): () => void {
  if (!hasFirebaseConfig()) {
    onCells({});
    return () => undefined;
  }

  const db = getFirestoreDb();
  const cellsCollection = collection(db, FIREBASE_COLLECTIONS.documents, documentId, FIREBASE_COLLECTIONS.cells);

  return onSnapshot(
    cellsCollection,
    (snapshot) => {
      const nextCells: Record<string, string> = {};
      snapshot.forEach((entry) => {
        const data = entry.data() as FirestoreCellData;
        if (typeof data.raw === "string") {
          nextCells[entry.id] = data.raw;
        }
      });
      onCells(nextCells);
    },
    (error) => {
      onError?.(error);
    }
  );
}

export async function upsertCellValue(
  documentId: string,
  cellId: string,
  rawValue: string
): Promise<void> {
  if (!hasFirebaseConfig()) {
    throw new Error("Firebase is not configured.");
  }

  const db = getFirestoreDb();
  const cellRef = doc(db, FIREBASE_COLLECTIONS.documents, documentId, FIREBASE_COLLECTIONS.cells, cellId);

  if (rawValue.trim().length === 0) {
    await deleteDoc(cellRef);
    return;
  }

  await setDoc(
    cellRef,
    {
      raw: rawValue,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}
