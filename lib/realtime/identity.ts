export type SessionIdentity = {
  uid: string;
  name: string;
  color: string;
};

const STORAGE_KEY = "tm_identity_v1";
const COLORS = ["#2563eb", "#0891b2", "#16a34a", "#ca8a04", "#db2777", "#9333ea", "#ea580c", "#0f766e"];

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function randomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function seededColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return COLORS[hash % COLORS.length];
}

export function readSessionIdentity(): SessionIdentity | null {
  if (!isBrowser()) {
    return null;
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as SessionIdentity;
    if (parsed.uid && parsed.name && parsed.color) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSessionIdentity(name: string): SessionIdentity {
  const existing = readSessionIdentity();
  const identity: SessionIdentity = {
    uid: existing?.uid ?? randomId(),
    name: name.trim(),
    color: existing?.color ?? randomColor()
  };

  if (isBrowser()) {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  }

  return identity;
}

export function saveSessionIdentityFromAuth(uid: string, name: string): SessionIdentity {
  const identity: SessionIdentity = {
    uid,
    name: name.trim() || "Google User",
    color: seededColor(uid)
  };

  if (isBrowser()) {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  }

  return identity;
}
