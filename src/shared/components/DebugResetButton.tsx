import { useState } from "react";
import type { ApiFetch } from "../../types";
import { settingsApi } from "../../api/settings";
import Icon from "./Icon";
import { responseErrorMessage } from "../lib/httpError";

function readableResetError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error || "");
  const trimmed = raw.trim();
  if (!trimmed) return "La suppression n'a pas pu être lancée.";
  const lower = trimmed.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("load failed") || lower.includes("backend local")) {
    return "Backend local injoignable. Vérifiez que l'app est bien démarrée, puis réessayez.";
  }
  if (lower.includes("réinitialisation") || lower.includes("reset") || lower.includes("suppression")) {
    return "La suppression n'a pas pu être lancée. Vérifiez Activité, puis réessayez.";
  }
  return trimmed;
}

/**
 * Debug wipe for fast reset/re-test loops. It requires an explicit second click
 * because it deletes local work data immediately.
 */
export function DebugResetButton({ api }: { api: ApiFetch | null }) {
  const [busy, setBusy] = useState(false);
  const [confirmArmed, setConfirmArmed] = useState(false);
  const [error, setError] = useState("");

  const wipe = async () => {
    if (!api || busy) return;
    if (!confirmArmed) {
      setConfirmArmed(true);
      setError("");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await settingsApi.resetData(api); // clearSettings defaults to false
      if (!res.ok) {
        throw new Error(await responseErrorMessage(res, `Réinitialisation échouée (${res.status})`));
      }
      window.location.reload();
    } catch (e) {
      setBusy(false);
      setConfirmArmed(false);
      setError(readableResetError(e));
    }
  };

  return (
    <div style={{ display: "grid", justifyItems: "end", gap: 8 }}>
      <button
        onClick={wipe}
        disabled={!api || busy}
        title="DEBUG : supprime toutes les offres, le profil (graphe + vecteurs) et les documents générés. Les paramètres et clés sont conservés."
        aria-label="Tout effacer en mode debug après confirmation explicite"
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
        <Icon name="trash" size={13} color="#fff" /> {busy ? "Suppression..." : confirmArmed ? "Confirmer l'effacement" : "Tout effacer (debug)"}
      </button>
      {confirmArmed && !busy && (
        <div style={{ maxWidth: 360, padding: 10, borderRadius: 8, border: "1px solid var(--bad)", background: "var(--bad-soft)", color: "var(--bad)", fontSize: 12, lineHeight: 1.45, textAlign: "left" }}>
          Supprime offres, profil, graphe, vecteurs et documents générés. Les réglages, clés API et templates sont conservés.
          <button className="btn btn-ghost" onClick={() => setConfirmArmed(false)} style={{ marginTop: 8, minHeight: 28, padding: "4px 8px", color: "inherit" }}>
            Annuler
          </button>
        </div>
      )}
      {error && (
        <div style={{ maxWidth: 360, padding: 10, borderRadius: 8, border: "1px solid var(--bad)", background: "var(--bad-soft)", color: "var(--bad)", fontSize: 12, lineHeight: 1.45, textAlign: "left" }}>
          {error}
        </div>
      )}
    </div>
  );
}
