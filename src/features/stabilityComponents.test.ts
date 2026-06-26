import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const dashboard = readFileSync(new URL("./dashboard/DashboardView.tsx", import.meta.url), "utf8");
const applyJobView = readFileSync(new URL("./apply/ApplyJobView.tsx", import.meta.url), "utf8");
const formReader = readFileSync(new URL("./apply/components/FormReader.tsx", import.meta.url), "utf8");
const jobCard = readFileSync(new URL("./pipeline/components/JobCard.tsx", import.meta.url), "utf8");
const profile = readFileSync(new URL("./profile/ProfileView.tsx", import.meta.url), "utf8");
const ingestion = readFileSync(new URL("./profile/IngestionView.tsx", import.meta.url), "utf8");
const errorBoundary = readFileSync(new URL("../shared/components/ErrorBoundary.tsx", import.meta.url), "utf8");
const approvalDrawer = readFileSync(new URL("./pipeline/components/ApprovalDrawer.tsx", import.meta.url), "utf8");
const semanticRuntimePrompt = readFileSync(new URL("../shared/components/SemanticRuntimePrompt.tsx", import.meta.url), "utf8");
const updatePrompt = readFileSync(new URL("../shared/components/UpdatePrompt.tsx", import.meta.url), "utf8");
const helpChat = readFileSync(new URL("../shared/components/HelpChat.tsx", import.meta.url), "utf8");
const settingsModal = readFileSync(new URL("./settings/SettingsModal.tsx", import.meta.url), "utf8");
const onboardingWizard = readFileSync(new URL("../shared/components/OnboardingWizard.tsx", import.meta.url), "utf8");
const keyboardShortcuts = readFileSync(new URL("../shared/hooks/useKeyboardShortcuts.ts", import.meta.url), "utf8");
const topbar = readFileSync(new URL("../shared/components/Topbar.tsx", import.meta.url), "utf8");
const subsystemHealth = readFileSync(new URL("../shared/hooks/useSubsystemHealth.ts", import.meta.url), "utf8");
const stylesheet = readFileSync(new URL("../index.css", import.meta.url), "utf8");

describe("FIX.md frontend stability contracts", () => {
  it("keeps App wrapped with recovery and subsystem degradation surfaces", () => {
    expect(app).toContain("ErrorBoundary");
    expect(app).toContain("SubsystemBanner");
    expect(app).toContain("SemanticRuntimePrompt");
    expect(app).toContain("useSubsystemHealth");
    expect(subsystemHealth).toContain("/api/v1/health/subsystems");
  });

  it("keeps dashboard primary operations wired", () => {
    expect(dashboard).toContain("onScan");
    expect(dashboard).toContain("onReevaluate");
    expect(dashboard).toContain("onCleanup");
    expect(dashboard).toContain("Agent actif");
  });

  it("keeps job cards actionable from the pipeline", () => {
    expect(jobCard).toContain("onDelete");
    expect(jobCard).toContain("showGenerate");
    expect(jobCard).toContain("/generate");
  });

  it("locks profile deletes to one confirmed backend deletion at a time", () => {
    // Rapid delete clicks must not fire concurrent backend DELETEs. Keep the
    // active row visible with a loader, disable other delete buttons, then
    // refresh the profile before another delete can start.
    expect(profile).toContain("deleteInFlightRef");
    expect(profile).toContain("setDeletingItem");
    expect(profile).toContain("Suppression...");
    expect(profile).toContain("disabled={isDeleting}");
    expect(profile).not.toContain("deleteQueueRef");
  });

  it("keeps profile and ingestion flows connected to their API contracts", () => {
    expect(profile).toContain("/api/v1/profile");
    expect(profile).toContain("profileDeletePath");
    expect(ingestion).toContain("/api/v1/ingest");
    expect(ingestion).toContain("/api/v1/template");
    expect(ingestion).toContain("Format non supporté");
    expect(ingestion).toContain("Voir le profil");
    expect(ingestion).toContain("Voir le graphe");
  });

  it("keeps error reporting and approval workflow controls present", () => {
    expect(errorBoundary).toContain("getDerivedStateFromError");
    expect(errorBoundary).toContain("/api/v1/errors");
    expect(errorBoundary).toContain("Recharger l'app");
    expect(stylesheet).toContain(".error-boundary-fallback");
    expect(approvalDrawer).toContain("/status");
    expect(approvalDrawer).toContain("/feedback");
    expect(approvalDrawer).toContain("Marquer comme postulée");
    expect(approvalDrawer).toContain("copyDraft");
    expect(approvalDrawer).toContain("pipelineMsgIsError");
  });

  it("keeps application helper copy user-facing instead of backend-facing", () => {
    expect(applyJobView).toContain("readableContactStatus");
    expect(applyJobView).toContain("readableContactMessage");
    expect(applyJobView).toContain("Clé Hunter.io manquante");
    expect(applyJobView).toContain("La recherche Hunter.io a échoué");
    expect(applyJobView).toContain("Aucune URL exploitable n'est disponible pour cette offre");
    expect(applyJobView).not.toContain("contactLookup.status.replace");
    expect(formReader).toContain("readableFieldLabel");
    expect(formReader).toContain("Lettre de motivation");
    expect(formReader).toContain("Confiance : ${CONFIDENCE_LABELS[c]");
    expect(formReader).toContain("Le navigateur automatique n'a pas pu lire la page");
    expect(formReader).toContain("Formulaire générique");
  });

  it("keeps required runtime pack mandatory", () => {
    // Simplified compact banner: still a mandatory install/restart flow, just
    // with terse button copy. Assert the guarantees the UI must keep, not the
    // old verbose strings.
    expect(semanticRuntimePrompt).toContain("/api/v1/runtime/vector");
    expect(semanticRuntimePrompt).toContain("/api/v1/runtime/vector/install");
    expect(semanticRuntimePrompt).toContain("installInFlightRef");
    expect(semanticRuntimePrompt).toContain("Le pack runtime est nécessaire pour activer le matching sémantique.");
    expect(semanticRuntimePrompt).toContain("readableRuntimeError");
    expect(semanticRuntimePrompt).toContain("runtimeInstallHttpError");
    expect(semanticRuntimePrompt).toContain("Le fichier du pack runtime est introuvable pour cette version.");
    expect(semanticRuntimePrompt).toContain("L'installation du pack runtime a échoué.");
    expect(semanticRuntimePrompt).toContain("Le backend local démarre encore.");
    expect(semanticRuntimePrompt).toContain("restart_required");
    expect(semanticRuntimePrompt).toContain("RUNTIME_STATUS_TIMEOUT_MS = 90000");
    expect(semanticRuntimePrompt).toContain("RUNTIME_INSTALL_START_TIMEOUT_MS = 0");
    expect(semanticRuntimePrompt).not.toContain("timeoutMs: 15000");
    expect(semanticRuntimePrompt).not.toContain("timeoutMs: 30000");
    expect(semanticRuntimePrompt).not.toContain("Later");
    expect(semanticRuntimePrompt).not.toContain("initialized once per interpreter");
  });

  it("keeps updater reachable above mandatory runtime blockers", () => {
    expect(stylesheet).toMatch(/\.update-toast\s*{[^}]*z-index:\s*260;/s);
    expect(stylesheet).toMatch(/\.semantic-runtime-banner\s*{[^}]*z-index:\s*180;/s);
  });

  it("keeps updater downloads resilient to release asset transport hiccups", () => {
    expect(updatePrompt).toContain("downloadAndInstall");
    expect(updatePrompt).toContain("UPDATE_DOWNLOAD_TIMEOUT_MS");
    expect(updatePrompt).toContain("Cache-Control");
    expect(updatePrompt).toContain("isRetryableUpdateDownloadError");
    expect(updatePrompt).toContain("readableUpdateError");
    expect(updatePrompt).toContain("Le téléchargement de la mise à jour a été interrompu");
    expect(updatePrompt).toContain("L'application est ouverte depuis une copie temporaire de macOS");
    expect(updatePrompt).toContain("La signature de la mise à jour n'a pas pu être vérifiée");
    expect(updatePrompt).not.toContain("setError(errorMessage(err))");
  });

  it("does not persist pending update restart state across app launches", () => {
    expect(updatePrompt).toContain("sessionStorage.getItem(PENDING_RESTART_KEY)");
    expect(updatePrompt).toContain("sessionStorage.setItem(PENDING_RESTART_KEY");
    expect(updatePrompt).not.toContain("localStorage.getItem(PENDING_RESTART_KEY)");
  });

  it("does not present expected setup states as broken UI", () => {
    expect(app).toContain("isActionableSubsystemIssue");
    expect(app).toContain("readableSubsystemStatus");
    expect(app).toContain("readableSubsystemMessage");
    expect(app).toContain('name === "llm"');
    expect(app).toContain("Sous-systèmes à vérifier");
    expect(app).toContain("Aucune clé IA n'est configurée pour le fournisseur choisi.");
    expect(app).toContain("Le runtime vectoriel LanceDB n'est pas encore installé.");
    expect(settingsModal).toContain('"Enregistré"');
    expect(settingsModal).toContain('"Enregistrement..."');
    expect(settingsModal).not.toContain("? Enregistré");
    expect(settingsModal).not.toContain("Enregistrement?");
  });

  it("keeps help chat actionable when the backend is unavailable", () => {
    expect(helpChat).toContain("/api/v1/help/chat");
    expect(helpChat).toContain("HELP_SUGGESTIONS");
    expect(helpChat).toContain("Comment configurer France Travail ?");
    expect(helpChat).toContain("Backend local injoignable");
    expect(helpChat).toContain("L'aide intégrée n'est pas disponible");
  });

  it("keeps guided setup and shortcuts from blocking normal typing", () => {
    expect(app).toContain("setShowOnboarding(false)");
    expect(onboardingWizard).toContain("Format non supporté");
    expect(onboardingWizard).toContain("timeoutMs: 0");
    expect(onboardingWizard).toContain("Configurer plus tard");
    expect(keyboardShortcuts).toContain("isEditableTarget");
    expect(keyboardShortcuts).toContain("e.isComposing");
  });

  it("explains browser-only startup instead of looking stuck", () => {
    expect(app).toContain("hasDesktopBridge");
    expect(app).toContain("Mode frontend seul détecté");
    expect(app).toContain("pnpm dev:local");
    expect(app).toContain("Copier la commande");
    expect(app).toContain("isSlow && !browserOnly");
  });

  it("keeps operation progress readable in the top bar", () => {
    expect(topbar).toContain("Nettoyage");
    expect(topbar).toContain("progress.current");
    expect(topbar).toContain("progressPercent");
  });
});
