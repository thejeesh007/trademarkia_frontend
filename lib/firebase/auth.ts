import {
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "firebase/auth";
import { getFirebaseAuth, hasFirebaseConfig } from "@/lib/firebase/client";

export type AuthUser = {
  uid: string;
  displayName: string;
  email: string | null;
};

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    displayName: user.displayName || "Google User",
    email: user.email
  };
}

export function subscribeToAuthState(onChange: (user: AuthUser | null) => void): () => void {
  if (!hasFirebaseConfig()) {
    onChange(null);
    return () => undefined;
  }

  return onAuthStateChanged(getFirebaseAuth(), (user) => {
    onChange(user ? toAuthUser(user) : null);
  });
}

export async function signInWithGoogle(): Promise<AuthUser> {
  if (!hasFirebaseConfig()) {
    throw new Error("Firebase is not configured.");
  }

  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(getFirebaseAuth(), provider);
  return toAuthUser(result.user);
}

export async function signOutCurrentUser(): Promise<void> {
  if (!hasFirebaseConfig()) {
    return;
  }
  await signOut(getFirebaseAuth());
}
