import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp
} from "firebase/firestore";
import { FIREBASE_COLLECTIONS } from "@/lib/firebase/constants";
import { getFirestoreDb, hasFirebaseConfig } from "@/lib/firebase/client";
import { CreateDocumentInput, SpreadsheetDocument } from "@/types/spreadsheet";

type FirestoreDocumentData = {
  title?: unknown;
  authorName?: unknown;
  updatedAt?: { toMillis?: () => number } | null;
};

function toMillis(value: FirestoreDocumentData["updatedAt"]): number {
  return typeof value?.toMillis === "function" ? value.toMillis() : Date.now();
}

export async function listDocuments(): Promise<SpreadsheetDocument[]> {
  if (!hasFirebaseConfig()) {
    return [];
  }

  const db = getFirestoreDb();
  const docsQuery = query(
    collection(db, FIREBASE_COLLECTIONS.documents),
    orderBy("updatedAt", "desc"),
    limit(100)
  );
  const snapshot = await getDocs(docsQuery);

  return snapshot.docs.map((doc) => {
    const data = doc.data() as FirestoreDocumentData;
    return {
      id: doc.id,
      title: typeof data.title === "string" ? data.title : "Untitled",
      authorName: typeof data.authorName === "string" ? data.authorName : "Unknown",
      updatedAt: toMillis(data.updatedAt)
    };
  });
}

export async function createDocument(input: CreateDocumentInput): Promise<SpreadsheetDocument> {
  if (!hasFirebaseConfig()) {
    throw new Error("Firebase is not configured.");
  }

  const title = input.title.trim();
  const authorName = input.authorName.trim();
  const db = getFirestoreDb();
  const payload = {
    title,
    authorName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const docRef = await addDoc(collection(db, FIREBASE_COLLECTIONS.documents), payload);

  return {
    id: docRef.id,
    title,
    authorName,
    updatedAt: Date.now()
  };
}
