import type { ApiFetch } from "./types";

const DEFAULT_TIMEOUT_MS = 30000;

export function isAbortLikeError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("signal is aborted") || message.toLowerCase().includes("aborted");
}

export function createApiFetch(port: number, token: string): ApiFetch {
  return (path, opts) => {
    const headers = new Headers(opts?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    const controller = new AbortController();
    const abort = () => controller.abort(new DOMException("Requête annulée", "AbortError"));
    const timeoutMs = Math.max(0, opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const timeoutId = timeoutMs > 0
      ? window.setTimeout(() => controller.abort(new DOMException("Délai d'attente dépassé", "TimeoutError")), timeoutMs)
      : null;
    if (opts?.signal) {
      if (opts.signal.aborted) controller.abort(new DOMException("Requête annulée", "AbortError"));
      else opts.signal.addEventListener("abort", abort, { once: true });
    }
    return fetch(`http://127.0.0.1:${port}${path}`, { ...opts, headers, signal: controller.signal })
      .catch(error => {
        if (controller.signal.aborted || isAbortLikeError(error)) {
          const reason = controller.signal.reason;
          if (reason instanceof DOMException && reason.name === "TimeoutError") {
            throw new Error(`Le backend local n'a pas répondu après ${Math.round(timeoutMs / 1000)} s sur le port ${port}.`);
          }
          throw new DOMException("Requête annulée", "AbortError");
        }
        const message = error instanceof Error ? error.message : String(error);
        if (message === "Failed to fetch" || message.includes("NetworkError")) {
          throw new Error(`Le backend local est inaccessible sur le port ${port}. Le sidecar a peut-être redémarré ; patientez un instant ou relancez l'application si le problème persiste.`);
        }
        throw error;
      })
      .finally(() => {
        if (timeoutId !== null) window.clearTimeout(timeoutId);
        opts?.signal?.removeEventListener("abort", abort);
      });
  };
}
