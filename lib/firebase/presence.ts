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
import { ActiveUser } from "@/types/spreadsheet";

const STALE_AFTER_MS = 45_000;

type PresenceInput = {
  uid: string;
  name: string;
  color: string;
};

type PresenceData = {
  name?: unknown;
  color?: unknown;
  lastSeenAt?: { toMillis?: () => number } | null;
};

function toMillis(value: PresenceData["lastSeenAt"]): number {
  return typeof value?.toMillis === "function" ? value.toMillis() : Date.now();
}

function presenceDocRef(documentId: string, uid: string) {
  const db = getFirestoreDb();
  return doc(db, FIREBASE_COLLECTIONS.documents, documentId, FIREBASE_COLLECTIONS.presence, uid);
}

export async function heartbeatPresence(documentId: string, input: PresenceInput): Promise<void> {
  if (!hasFirebaseConfig()) {
    return;
  }

  await setDoc(
    presenceDocRef(documentId, input.uid),
    {
      uid: input.uid,
      name: input.name,
      color: input.color,
      lastSeenAt: serverTimestamp()
    },
    { merge: true }
  );
}

export async function removePresence(documentId: string, uid: string): Promise<void> {
  if (!hasFirebaseConfig()) {
    return;
  }
  await deleteDoc(presenceDocRef(documentId, uid));
}

export function subscribeToPresence(
  documentId: string,
  onUsers: (users: ActiveUser[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!hasFirebaseConfig()) {
    onUsers([]);
    return () => undefined;
  }

  const db = getFirestoreDb();
  const presenceCollection = collection(
    db,
    FIREBASE_COLLECTIONS.documents,
    documentId,
    FIREBASE_COLLECTIONS.presence
  );

  return onSnapshot(
    presenceCollection,
    (snapshot) => {
      const now = Date.now();
      const users: ActiveUser[] = snapshot.docs
        .map((entry) => {
          const data = entry.data() as PresenceData;
          return {
            uid: entry.id,
            name: typeof data.name === "string" ? data.name : "Unknown",
            color: typeof data.color === "string" ? data.color : "#2563eb",
            lastSeenAt: toMillis(data.lastSeenAt)
          };
        })
        .filter((user) => now - user.lastSeenAt <= STALE_AFTER_MS)
        .sort((a, b) => b.lastSeenAt - a.lastSeenAt);

      onUsers(users);
    },
    (error) => {
      onError?.(error);
    }
  );
}
