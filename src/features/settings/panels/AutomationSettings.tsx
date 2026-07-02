import type { Cfg } from "./config";
import { BigToggle, SectionLabel } from "./shared";

export function AutomationSettings({ cfg, onChange }: { cfg: Cfg; onChange: (k: keyof Cfg, v: string) => void }) {
  return (
    <div style={{ borderTop: "1px dashed var(--line)", paddingTop: 18 }}>
      <SectionLabel label="Automatisation expérimentale" sub="laboratoire non supporté" />
      <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5, marginBottom: 10 }}>
        L'automatisation navigateur reste disponible pour les contributeurs. Le coeur stable reste la collecte, le classement, le matching vectoriel et la personnalisation.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <BigToggle active={cfg.ghost_mode === "true"} onToggle={() => onChange("ghost_mode", cfg.ghost_mode === "true" ? "false" : "true")}
          icon="ghost" tone="purple" label="Mode fantôme expérimental" badge={cfg.ghost_mode === "true" ? "lab actif" : "désactivé"}
          sub="Laboratoire contributeur pour les exécutions en arrière-plan ; hors parcours principal" />
        <BigToggle active={cfg.auto_apply === "true"} onToggle={() => onChange("auto_apply", cfg.auto_apply === "true" ? "false" : "true")}
          icon="fire" tone="orange" label="Candidature auto expérimentale" badge={cfg.auto_apply === "true" ? "lab actif" : "désactivé"}
          sub="Soumission navigateur non supportée ; collecte, ranking et personnalisation n'en dépendent pas" />
        <BigToggle active={cfg.headed_browser === "true"} onToggle={() => onChange("headed_browser", cfg.headed_browser === "true" ? "false" : "true")}
          icon="globe" tone="blue" label="Navigateur visible" badge={cfg.headed_browser === "true" ? "visible" : "masqué"}
          sub="Affiche la fenêtre navigateur pendant le debug de l'automatisation expérimentale" />
      </div>
    </div>
  );
}
