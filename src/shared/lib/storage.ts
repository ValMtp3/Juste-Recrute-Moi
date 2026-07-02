type WebStorage = "local" | "session";

function getStorage(kind: WebStorage): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readLocalStorage(key: string, fallback = "") {
  try {
    return getStorage("local")?.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeLocalStorage(key: string, value: string) {
  try {
    getStorage("local")?.setItem(key, value);
  } catch {
    // Storage is optional UX state; failure must not break the app.
  }
}

export function removeLocalStorage(key: string) {
  try {
    getStorage("local")?.removeItem(key);
  } catch {
    // Ignore unavailable storage.
  }
}

export function readSessionStorage(key: string, fallback = "") {
  try {
    return getStorage("session")?.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeSessionStorage(key: string, value: string) {
  try {
    getStorage("session")?.setItem(key, value);
  } catch {
    // Session persistence is best effort.
  }
}

export function removeSessionStorage(key: string) {
  try {
    getStorage("session")?.removeItem(key);
  } catch {
    // Ignore unavailable storage.
  }
}
