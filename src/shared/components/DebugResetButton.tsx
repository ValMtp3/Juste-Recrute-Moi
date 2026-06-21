import { useState } from "react";
import type { ApiFetch } from "../../types";
import { settingsApi } from "../../api/settings";
import Icon from "./Icon";

/**
 * One-click debug wipe. Deletes all leads, the profile (graph + vectors), and
 * generated documents on the spot — no confirmation typing — then reloads so
 * every view returns to a clean first-run state. Settings and provider keys are
 * KEPT, so you can immediately re-ingest and re-test without re-entering config.
 *
 * This is a developer convenience for fast reset/re-test loops; the guarded,
 * type-DELETE-to-confirm flow still lives in Settings → Danger zone.
 */
export function DebugResetButton({ api }: { api: ApiFetch | null }) {
  const [busy, setBusy] = useState(false);

  const wipe = async () => {
    if (!api || busy) return;
    setBusy(true);
    try {
      const res = await settingsApi.resetData(api); // clearSettings defaults to false
      if (!res.ok) {
        const detail = await res.json().then((d: { detail?: string }) => d.detail).catch(() => "");
        throw new Error(detail || `Reset failed (${res.status})`);
      }
      window.location.reload();
    } catch (e) {
      setBusy(false);
      alert("Wipe failed: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <button
      onClick={wipe}
      disabled={!api || busy}
      title="DEBUG: delete all leads, profile (graph + vectors) and generated docs now. Settings/keys are kept."
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: "var(--bad, #dc2626)",
        color: "#fff",
        border: "1px solid var(--bad, #dc2626)",
        borderRadius: 8,
        padding: "8px 16px",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        cursor: api && !busy ? "pointer" : "not-allowed",
        opacity: !api || busy ? 0.6 : 1,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <Icon name="trash" size={13} color="#fff" /> {busy ? "Wiping…" : "Wipe all data (debug)"}
    </button>
  );
}
