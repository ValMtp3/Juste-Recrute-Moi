function detailToMessage(detail: unknown) {
  if (typeof detail === "string") return detail.trim();
  if (Array.isArray(detail)) {
    return detail.map(item => {
      if (!item || typeof item !== "object") return "";
      const record = item as Record<string, unknown>;
      const loc = Array.isArray(record.loc) ? record.loc.filter(Boolean).join(".") : "";
      const msg = typeof record.msg === "string" ? record.msg : "";
      return [loc, msg].filter(Boolean).join(" : ");
    }).filter(Boolean).join(" · ");
  }
  if (detail && typeof detail === "object") {
    const record = detail as Record<string, unknown>;
    for (const key of ["message", "error", "detail"]) {
      if (typeof record[key] === "string" && record[key]) return String(record[key]);
    }
  }
  return "";
}

export async function responseErrorMessage(response: Response, fallback: string) {
  try {
    const data = await response.clone().json();
    const record = data && typeof data === "object" ? data as Record<string, unknown> : {};
    const message = detailToMessage(record.detail ?? record.error ?? record.message);
    if (message) return message;
  } catch {
    // Fall through to text/plain bodies.
  }

  try {
    const text = await response.text();
    if (text.trim()) return text.trim();
  } catch {
    // Fall through to fallback.
  }

  return fallback;
}

export async function readJsonResponse<T = unknown>(response: Response, fallback: string): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    throw new Error(fallback);
  }
}
