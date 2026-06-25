import { useState } from "react";
import type { ApiFetch } from "../../types";
import { settingsApi } from "../../api/settings";
import Icon from "./Icon";

const DEBUG_RESET_CONFIRM_MESSAGE = [
  "Tout effacer (debug) va supprimer les données locales de travail.",
  "",
  "Supprimé :",
  "- toutes les offres et leur historique ;",
  "- le profil candidat, le graphe et les vecteurs ;",
  "- les documents et assets générés.",
  "",
  "Conservé :",
  "- les réglages, clés API et templates de CV.",
  "",
  "L'application sera ensuite rechargée. Continuer ?",
].join("\n");

/**
 * Debug wipe for fast reset/re-test loops. It still requires an explicit
 * browser confirmation because it deletes local work data immediately.
 */
export function DebugResetButton({ api }: { api: ApiFetch | null }) {
  const [busy, setBusy] = useState(false);

  const wipe = async () => {
    if (!api || busy) return;
    if (!window.confirm(DEBUG_RESET_CONFIRM_MESSAGE)) return;
    setBusy(true);
    try {
      const res = await settingsApi.resetData(api); // clearSettings defaults to false
      if (!res.ok) {
        const detail = await res.json().then((d: { detail?: string }) => d.detail).catch(() => "");
        throw new Error(detail || `Réinitialisation échouée (${res.status})`);
      }
      window.location.reload();
    } catch (e) {
      setBusy(false);
      alert("Suppression échouée : " + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
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
      <Icon name="trash" size={13} color="#fff" /> {busy ? "Suppression..." : "Tout effacer (debug)"}
    </button>
  );
}
