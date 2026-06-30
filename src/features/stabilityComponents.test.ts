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
const debugResetButton = readFileSync(new URL("../shared/components/DebugResetButton.tsx", import.meta.url), "utf8");
const settingsModal = readFileSync(new URL("./settings/SettingsModal.tsx", import.meta.url), "utf8");
const onboardingWizard = readFileSync(new URL("../shared/components/OnboardingWizard.tsx", import.meta.url), "utf8");
const keyboardShortcuts = readFileSync(new URL("../shared/hooks/useKeyboardShortcuts.ts", import.meta.url), "utf8");
const topbar = readFileSync(new URL("../shared/components/Topbar.tsx", import.meta.url), "utf8");
const subsystemHealth = readFileSync(new URL("../shared/hooks/useSubsystemHealth.ts", import.meta.url), "utf8");
const useWS = readFileSync(new URL("../shared/hooks/useWS.ts", import.meta.url), "utf8");
const storage = readFileSync(new URL("../shared/lib/storage.ts", import.meta.url), "utf8");
const clipboard = readFileSync(new URL("../shared/lib/clipboard.ts", import.meta.url), "utf8");
const stylesheet = readFileSync(new URL("../index.css", import.meta.url), "utf8");

describe("FIX.md frontend stability contracts", () => {
  it("keeps App wrapped with recovery and subsystem degradation surfaces", () => {
    expect(app).toContain("ErrorBoundary");
    expect(app).toContain("SubsystemBanner");
    expect(app).toContain("SemanticRuntimePrompt");
    expect(app).toContain("useSubsystemHealth");
    expect(app).toContain("responseErrorMessage");
    expect(app).toContain("readJsonResponse<Record<string, unknown>>");
    expect(app).toContain("Le nettoyage a répondu dans un format illisible");
    expect(app).not.toContain("const result = await r.json()");
    expect(app).toContain("readableAppError");
    expect(app).toContain("readableStartupError");
    expect(app).toContain("Diagnostic de démarrage");
    expect(app).toContain("Le backend intégré est introuvable");
    expect(app).toContain("Un ancien backend semble encore ouvert");
    expect(app).toContain("Backend local injoignable");
    expect(app).toContain("useDueFollowups(api, wsAddLog)");
    expect(app).not.toContain("function responseDetail");
    expect(subsystemHealth).toContain("/api/v1/health/subsystems");
    expect(subsystemHealth).toContain("readJsonResponse<SubsystemHealth>");
    expect(subsystemHealth).toContain("responseErrorMessage");
    expect(subsystemHealth).toContain("Backend local injoignable");
    expect(subsystemHealth).toContain("format illisible");
    expect(subsystemHealth).not.toContain("const payload = await response.json()");
  });

  it("keeps websocket status reconciliation readable", () => {
    expect(useWS).toContain("function fetchBackendStatus");
    expect(useWS).toContain("readJsonResponse<BackendStatus>");
    expect(useWS).toContain("Statut backend illisible");
    expect(useWS).toContain("Échec de synchronisation du statut");
    expect(useWS).toContain("SIDECAR_STARTUP_DIAGNOSTIC_POLLS");
    expect(useWS).toContain("sidecarStartupMessage");
    expect(useWS).toContain("Backend local en démarrage");
    expect(useWS).not.toContain("response.ok ? response.json()");
  });

  it("keeps dashboard primary operations wired", () => {
    expect(dashboard).toContain("onScan");
    expect(dashboard).toContain("onReevaluate");
    expect(dashboard).toContain("onCleanup");
    expect(dashboard).toContain("cleanupConfirm");
    expect(dashboard).toContain("Confirmer le nettoyage");
    expect(dashboard).toContain("statusTimerRef");
    expect(dashboard).toContain("window.clearTimeout(statusTimerRef.current)");
    expect(dashboard).toContain("readableDashboardError");
    expect(dashboard).toContain("responseErrorMessage");
    expect(dashboard).toContain("readJsonResponse<Record<string, unknown>>");
    expect(dashboard).toContain("Les préférences ont répondu dans un format illisible");
    expect(dashboard).toContain("responseErrorMessage(r, \"Les préférences n'ont pas pu être chargées.\")");
    expect(dashboard).toContain("Backend local injoignable");
    expect(dashboard).toContain("Les préférences n'ont pas pu être chargées.");
    expect(dashboard).toContain("unexpected token");
    expect(dashboard).not.toContain("catch { setStatus(\"error\"); }");
    expect(dashboard).not.toContain("return r.json()");
    expect(dashboard).not.toContain("settingsApi.getPreferences(api).then(r => r.json())");
    expect(dashboard).not.toContain(".catch(() => { if (alive) setLoaded(true); })");
    expect(dashboard).toContain("Agent actif");
  });

  it("keeps destructive prompts inline instead of native browser dialogs", () => {
    expect(app).not.toContain("window.confirm");
    expect(dashboard).toContain("Cliquez à nouveau pour confirmer");
    expect(debugResetButton).toContain("confirmArmed");
    expect(debugResetButton).toContain("Confirmer l'effacement");
    expect(debugResetButton).toContain("readableResetError");
    expect(debugResetButton).toContain("responseErrorMessage");
    expect(debugResetButton).toContain("Backend local injoignable");
    expect(debugResetButton).not.toContain("window.confirm");
    expect(debugResetButton).not.toContain("alert(");
    expect(debugResetButton).not.toContain("Suppression échouée : \" +");
  });

  it("keeps job cards actionable from the pipeline", () => {
    expect(jobCard).toContain("onDelete");
    expect(jobCard).toContain("deleting");
    expect(jobCard).toContain("Suppression en cours");
    expect(jobCard).toContain("showGenerate");
    expect(jobCard).toContain("/generate");
    expect(jobCard).toContain("readableGenerationError");
    expect(jobCard).toContain("readableOpenLeadError");
    expect(jobCard).toContain("openLeadUrl");
    expect(jobCard).toContain("linkError");
    expect(jobCard).toContain("generation failed");
    expect(jobCard).toContain("Réponse de génération illisible");
    expect(jobCard).toContain("readJsonResponse<{ lead?: Lead }>");
    expect(jobCard).not.toContain("return await response.json()");
    expect(jobCard).not.toContain("return response.json().catch(() => ({}));");
    expect(jobCard).toContain("Lien source invalide ou non web");
    expect(jobCard).toContain("responseErrorMessage");
    expect(jobCard).toContain("Backend local injoignable");
    expect(jobCard).not.toContain("openExternalUrl(lead.url);");
    expect(jobCard).not.toContain("setGenerationError(error instanceof Error ? error.message");
  });

  it("locks profile deletes to one confirmed backend deletion at a time", () => {
    // Rapid delete clicks must not fire concurrent backend DELETEs. Keep the
    // active row visible with a loader, disable other delete buttons, then
    // refresh the profile before another delete can start.
    expect(profile).toContain("deleteInFlightRef");
    expect(profile).toContain("setDeletingItem");
    expect(profile).toContain("Suppression...");
    expect(profile).toContain("disabled={isDeleting}");
    expect(profile).toContain("readableProfileError");
    expect(profile).toContain("responseErrorMessage");
    expect(profile).toContain("Backend local injoignable");
    expect(profile).toContain("exportProfile = useCallback");
    expect(profile).toContain("L'export du profil a échoué");
    expect(profile).toContain("Export du profil téléchargé");
    expect(profile).not.toContain("await openUrl(url);\n        } finally");
    expect(profile).not.toContain("detailFromBody");
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
    expect(errorBoundary).toContain("reportError");
    expect(errorBoundary).toContain("Le rapport d'erreur n'a pas pu être envoyé");
    expect(errorBoundary).not.toContain(".catch(() => {})");
    expect(errorBoundary).toContain("Recharger l'app");
    expect(stylesheet).toContain(".error-boundary-fallback");
    expect(stylesheet).toContain(".error-boundary-report");
    expect(approvalDrawer).toContain("/status");
    expect(approvalDrawer).toContain("/feedback");
    expect(approvalDrawer).toContain("Marquer comme postulée");
    expect(approvalDrawer).toContain("copyDraft");
    expect(approvalDrawer).toContain("pipelineMsgIsError");
    expect(approvalDrawer).toContain("readableDrawerError");
    expect(approvalDrawer).toContain("responseErrorMessage");
    expect(approvalDrawer).toContain("readJsonResponse<{ templates?: TemplateOption[] }>");
    expect(approvalDrawer).toContain("readJsonResponse<VersionEntry[]>");
    expect(approvalDrawer).toContain("readJsonResponse<Lead>");
    expect(approvalDrawer).toContain("templateErr");
    expect(approvalDrawer).toContain("Les modèles de CV ont renvoyé ${r.status}");
    expect(approvalDrawer).toContain("Les modèles de CV ont répondu dans un format illisible");
    expect(approvalDrawer).toContain("Le générateur utilisera le modèle par défaut.");
    expect(approvalDrawer).toContain("pipelineTimerRef");
    expect(approvalDrawer).toContain("Pipeline lancé, mais l'offre n'a pas pu être rafraîchie.");
    expect(approvalDrawer).toContain("refreshError");
    expect(approvalDrawer).toContain("Génération lancée, mais l'offre n'a pas pu être rafraîchie.");
    expect(approvalDrawer).not.toContain("refreshLead().catch(() => null)");
    expect(approvalDrawer).not.toContain("refreshLead(controller.signal).catch(() => null)");
    expect(approvalDrawer).toContain("responseErrorMessage(r, `Le rafraîchissement de l'offre a renvoyé ${r.status}`)");
    expect(approvalDrawer).toContain("La génération est terminée, mais les fichiers ne sont pas encore disponibles");
    expect(approvalDrawer).toContain("parseGenerationResponse");
    expect(approvalDrawer).toContain("Réponse de génération illisible");
    expect(approvalDrawer).toContain("L'historique des versions a répondu dans un format illisible");
    expect(approvalDrawer).toContain("Le rafraîchissement de l'offre a répondu dans un format illisible");
    expect(approvalDrawer).not.toContain("r.json().catch(() => ({}))");
    expect(approvalDrawer).not.toContain("return r.json()");
    expect(approvalDrawer).not.toContain("const items = await r.json()");
    expect(approvalDrawer).not.toContain("const lead = await r.json()");
    expect(approvalDrawer).toContain("Ouverture du PDF échouée");
    expect(approvalDrawer).toContain("Le PDF n'a pas pu être ouvert");
    expect(approvalDrawer).not.toContain("const openPdf = () => { if (pdfBlobUrl) openUrl(pdfBlobUrl); }");
    expect(approvalDrawer).toContain("setGenerating(false)");
    expect(approvalDrawer).toContain("Backend local injoignable");
    expect(approvalDrawer).not.toContain("setGenerateErr(err instanceof Error");
    expect(approvalDrawer).not.toContain("setPipelineMsg(err instanceof Error");
    expect(approvalDrawer).not.toContain("setFeedbackErr(err instanceof Error");
    expect(approvalDrawer).not.toContain("setStatusErr(err instanceof Error");
  });

  it("keeps application helper copy user-facing instead of backend-facing", () => {
    expect(applyJobView).toContain("readableContactStatus");
    expect(applyJobView).toContain("readableContactMessage");
    expect(applyJobView).toContain("Clé Hunter.io manquante");
    expect(applyJobView).toContain("La recherche Hunter.io a échoué");
    expect(applyJobView).toContain("Aucune URL exploitable n'est disponible pour cette offre");
    expect(applyJobView).toContain("no url available");
    expect(applyJobView).toContain("responseErrorMessage");
    expect(applyJobView).toContain("readJsonResponse<Lead>");
    expect(applyJobView).toContain("readJsonResponse<{ lead?: Lead | null }>");
    expect(applyJobView).toContain("La génération a répondu dans un format illisible");
    expect(applyJobView).toContain("Backend local injoignable");
    expect(applyJobView).toContain("Le CV est encore en préparation");
    expect(applyJobView).toContain("openDocumentBlob");
    expect(applyJobView).toContain("Le PDF n'a pas pu être ouvert");
    expect(applyJobView).toContain("function readableApplyError(error: unknown");
    expect(applyJobView).toContain("readableApplyError(e, \"Le CV n'a pas pu être chargé\")");
    expect(applyJobView).toContain("fallbackRefreshFailuresRef");
    expect(applyJobView).toContain("APPLY_REFRESH_FAILURES_BEFORE_NOTICE");
    expect(applyJobView).toContain("La génération peut continuer en arrière-plan");
    expect(applyJobView).not.toContain("doc.blob && openUrl(doc.blob)");
    expect(applyJobView).not.toContain("error instanceof Error ? error.message : `Ouvrir le PDF");
    expect(applyJobView).toContain("copyStatusTimerRef");
    expect(applyJobView).toContain("window.clearTimeout(copyStatusTimerRef.current)");
    expect(applyJobView).not.toContain("setResumeLoadErr(e instanceof Error ? e.message");
    expect(applyJobView).not.toContain("setCoverLoadErr(e instanceof Error ? e.message");
    expect(applyJobView).not.toContain("const latest = await res.json()");
    expect(applyJobView).not.toContain("const started = await r.json()");
    expect(applyJobView).not.toContain("contactLookup.status.replace");
    expect(formReader).toContain("readableFieldLabel");
    expect(formReader).toContain("Lettre de motivation");
    expect(formReader).toContain("Confiance : ${CONFIDENCE_LABELS[c]");
    expect(formReader).toContain("Le navigateur automatique n'a pas pu lire la page");
    expect(formReader).toContain("no url available");
    expect(formReader).toContain("responseErrorMessage");
    expect(formReader).toContain("readJsonResponse<FormReadResult>");
    expect(formReader).toContain("format illisible");
    expect(formReader).not.toContain("setResult(await r.json())");
    expect(formReader).toContain("function readableFormError(error: unknown");
    expect(formReader).toContain("setError(readableFormError(err))");
    expect(formReader).toContain("requestRef.current === controller");
    expect(formReader).toContain("!controller.signal.aborted");
    expect(formReader).toContain("copyTimerRef");
    expect(formReader).toContain("copyErrorTimerRef");
    expect(formReader).toContain("window.clearTimeout(copyTimerRef.current)");
    expect(formReader).toContain("Backend local injoignable");
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
    expect(semanticRuntimePrompt).toContain("function readableRuntimeError(error: unknown)");
    expect(semanticRuntimePrompt).toContain("function runtimeErrorMessage(error: unknown)");
    expect(semanticRuntimePrompt).toContain("readableRuntimeError");
    expect(semanticRuntimePrompt).toContain("responseErrorMessage");
    expect(semanticRuntimePrompt).toContain("readJsonResponse");
    expect(semanticRuntimePrompt).toContain("runtimeInstallHttpError");
    expect(semanticRuntimePrompt).toContain("parseRuntimePayload");
    expect(semanticRuntimePrompt).toContain("Réponse du runtime illisible");
    expect(semanticRuntimePrompt).not.toContain("await response.json()");
    expect(semanticRuntimePrompt).not.toContain("response.json().catch(() => ({}))");
    expect(semanticRuntimePrompt).toContain("Le fichier du pack runtime est introuvable pour cette version.");
    expect(semanticRuntimePrompt).toContain("L'installation du pack runtime a échoué.");
    expect(semanticRuntimePrompt).toContain("Le backend local démarre encore.");
    expect(semanticRuntimePrompt).toContain("restart_required");
    expect(semanticRuntimePrompt).toContain("RUNTIME_STATUS_TIMEOUT_MS = 90000");
    expect(semanticRuntimePrompt).toContain("RUNTIME_INSTALL_START_TIMEOUT_MS = 0");
    expect(semanticRuntimePrompt).not.toContain("timeoutMs: 15000");
    expect(semanticRuntimePrompt).not.toContain("timeoutMs: 30000");
    expect(semanticRuntimePrompt).not.toContain("setError(readableRuntimeError(err instanceof Error ? err.message : String(err)))");
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
    expect(updatePrompt).toContain("readSessionStorage(PENDING_RESTART_KEY)");
    expect(updatePrompt).toContain("writeSessionStorage(PENDING_RESTART_KEY");
    expect(updatePrompt).not.toContain("readLocalStorage(PENDING_RESTART_KEY)");
  });

  it("keeps optional browser storage from crashing the shell", () => {
    expect(storage).toContain("readLocalStorage");
    expect(storage).toContain("writeLocalStorage");
    expect(storage).toContain("readSessionStorage");
    expect(storage).toContain("try");
    expect(app).toContain("readLocalStorage(\"jhm-sidebar-collapsed\")");
    expect(app).toContain("writeLocalStorage(ONBOARDING_KEY");
    expect(ingestion).toContain("writeLocalStorage(ONBOARDING_KEY");
    expect(updatePrompt).toContain("writeLocalStorage(DISMISSED_UPDATE_KEY");
  });

  it("keeps clipboard actions consistent and non-fatal", () => {
    expect(clipboard).toContain("copyTextToClipboard");
    expect(clipboard).toContain("return false");
    expect(app).toContain("copyTextToClipboard(desktopCommand)");
    expect(app).toContain("copiedCommandTimerRef");
    expect(app).toContain("window.clearTimeout(copiedCommandTimerRef.current)");
    expect(applyJobView).toContain("copyTextToClipboard(value)");
    expect(formReader).toContain("copyTextToClipboard(text)");
    expect(approvalDrawer).toContain("copyTextToClipboard(value)");
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
    expect(helpChat).toContain("responseErrorMessage");
    expect(helpChat).toContain("readJsonResponse<Record<string, unknown>>");
    expect(helpChat).toContain("Backend local injoignable");
    expect(helpChat).toContain("L'aide intégrée n'est pas disponible");
    expect(helpChat).toContain("readHelpAnswer");
    expect(helpChat).toContain("format illisible");
    expect(helpChat).not.toContain("const data = await response.json()");
    expect(helpChat).not.toContain("const data = await r.json()");
  });

  it("keeps guided setup and shortcuts from blocking normal typing", () => {
    expect(app).toContain("setShowOnboarding(false)");
    expect(onboardingWizard).toContain("Format non supporté");
    expect(onboardingWizard).toContain("timeoutMs: 0");
    expect(onboardingWizard).toContain("Configurer plus tard");
    expect(onboardingWizard).toContain("readableOnboardingError");
    expect(onboardingWizard).toContain("responseErrorMessage");
    expect(onboardingWizard).toContain("Backend local injoignable");
    expect(onboardingWizard).not.toContain("setErr(e instanceof Error ? e.message");
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
