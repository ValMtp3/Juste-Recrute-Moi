import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { check, type DownloadEvent, type DownloadOptions, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type UpdateState = "checking" | "available" | "downloading" | "installing" | "relaunching" | "ready" | "error";
type UpdateInstallStatus = {
  platform: string;
  canUpdate: boolean;
  needsManualInstall: boolean;
  reason: string;
  installDir: string | null;
  appBundle: string | null;
};

const DISMISSED_UPDATE_KEY = "jhm.dismissedUpdate";
const PENDING_RESTART_KEY = "jhm.pendingUpdateRestart";
const RELEASES_URL = "https://github.com/vasu-devs/JustHireMe/releases/latest";
const UPDATE_DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;
const UPDATE_DOWNLOAD_HEADERS = {
  Accept: "application/octet-stream",
};
const UPDATE_DOWNLOAD_RETRY_HEADERS = {
  ...UPDATE_DOWNLOAD_HEADERS,
  "Cache-Control": "no-cache",
};

function updateDownloadOptions(headers: Record<string, string> = UPDATE_DOWNLOAD_HEADERS): DownloadOptions {
  return {
    headers,
    timeout: UPDATE_DOWNLOAD_TIMEOUT_MS,
  };
}

function formatBytes(value: number) {
  if (!value) return "0 MB";
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "a moment";
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  return `${Math.round(seconds / 60)} min`;
}

async function readUpdateInstallStatus() {
  try {
    return await invoke<UpdateInstallStatus>("get_update_install_status");
  } catch {
    return null;
  }
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function isRetryableUpdateDownloadError(err: unknown) {
  const message = errorMessage(err).toLowerCase();
  return (
    message.includes("error decoding response body") ||
    message.includes("request timed out") ||
    message.includes("connection") ||
    message.includes("network") ||
    message.includes("body")
  );
}

export function UpdatePrompt() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [installStatus, setInstallStatus] = useState<UpdateInstallStatus | null>(null);
  const [state, setState] = useState<UpdateState>("checking");
  const [error, setError] = useState("");
  const [downloaded, setDownloaded] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [dismissedVersion, setDismissedVersion] = useState(() => localStorage.getItem(DISMISSED_UPDATE_KEY) || "");
  const [pendingRestartVersion, setPendingRestartVersion] = useState(() => sessionStorage.getItem(PENDING_RESTART_KEY) || "");

  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      check({ timeout: 12000 })
        .then(async next => {
          if (!alive) return;
          if (!next || next.version === dismissedVersion) {
            setUpdate(null);
            setInstallStatus(null);
            return;
          }
          const status = await readUpdateInstallStatus();
          if (!alive) return;
          setInstallStatus(status);
          setUpdate(next);
          setState(next.version === pendingRestartVersion ? "ready" : "available");
        })
        .catch(() => {
          if (alive) {
            setUpdate(null);
            setInstallStatus(null);
          }
        });
    }, 4500);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [dismissedVersion, pendingRestartVersion]);

  const progress = useMemo(() => {
    if (!total) return null;
    return Math.min(100, Math.round((downloaded / total) * 100));
  }, [downloaded, total]);

  useEffect(() => {
    if (state !== "downloading" && state !== "installing") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state]);

  const elapsedSeconds = startedAt ? Math.max(1, (now - startedAt) / 1000) : 0;
  const bytesPerSecond = state === "downloading" && elapsedSeconds > 0 ? downloaded / elapsedSeconds : 0;
  const etaSeconds = total && bytesPerSecond > 0 ? Math.max(0, (total - downloaded) / bytesPerSecond) : null;
  const blockedByInstallLocation = Boolean(installStatus && !installStatus.canUpdate && state !== "ready");
  const updateMessage = (() => {
    if (state === "ready") return "The update is installed. Restart to finish if JustHireMe did not reopen automatically.";
    if (state === "relaunching") return "Update installed. Reopening JustHireMe with the new version.";
    if (blockedByInstallLocation) return installStatus?.reason || "Move JustHireMe to a writable Applications folder before updating.";
    if (state === "installing") return "Download complete. Applying the signed update in the background.";
    if (state === "downloading") return "Downloading the signed update. You can keep using JustHireMe while this runs.";
    return `You are running ${update?.currentVersion}. Update to ${update?.version} now.`;
  })();
  const progressLabel = (() => {
    if (state === "relaunching") return "Reopening the app with the updated build.";
    if (state === "installing") return `Applying update, elapsed ${formatDuration(elapsedSeconds)}.`;
    if (progress !== null && total) {
      const eta = etaSeconds !== null ? `, about ${formatDuration(etaSeconds)} left` : "";
      return `${progress}% - ${formatBytes(downloaded)} of ${formatBytes(total)}${eta}`;
    }
    if (downloaded > 0) return `${formatBytes(downloaded)} downloaded - estimating time remaining`;
    return "Preparing download - usually a few minutes on a normal connection";
  })();

  if (!update) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_UPDATE_KEY, update.version);
    setDismissedVersion(update.version);
    setUpdate(null);
  };

  const relaunchIntoUpdate = async () => {
    try {
      sessionStorage.removeItem(PENDING_RESTART_KEY);
      await relaunch();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("ready");
    }
  };

  const install = async () => {
    if (installStatus && !installStatus.canUpdate) {
      setError(`${installStatus.reason} Download the latest DMG from ${RELEASES_URL} if you need to repair this install now.`);
      setState("error");
      return;
    }
    setState("downloading");
    setError("");
    setDownloaded(0);
    setTotal(null);
    setStartedAt(Date.now());
    setNow(Date.now());
    try {
      const onEvent = (event: DownloadEvent) => {
        if (event.event === "Started") {
          setTotal(event.data.contentLength ?? null);
          setDownloaded(0);
        } else if (event.event === "Progress") {
          setDownloaded(prev => prev + event.data.chunkLength);
        } else if (event.event === "Finished") {
          setState("installing");
        }
      };

      try {
        await update.downloadAndInstall(onEvent, updateDownloadOptions());
      } catch (firstError) {
        if (!isRetryableUpdateDownloadError(firstError)) throw firstError;
        setDownloaded(0);
        setTotal(null);
        setStartedAt(Date.now());
        setNow(Date.now());
        await update.downloadAndInstall(onEvent, updateDownloadOptions(UPDATE_DOWNLOAD_RETRY_HEADERS));
      }

      sessionStorage.setItem(PENDING_RESTART_KEY, update.version);
      setPendingRestartVersion(update.version);
      setState("relaunching");
      window.setTimeout(() => {
        void relaunchIntoUpdate();
      }, 650);
    } catch (err) {
      setError(errorMessage(err));
      setState("error");
    }
  };

  const isBusy = state === "downloading" || state === "installing" || state === "relaunching";

  return (
    <aside className="update-toast" role="status" aria-live="polite">
      <div>
        <div className="eyebrow">Update available</div>
        <strong>JustHireMe {update.version}</strong>
        <p>{updateMessage}</p>
        {isBusy && (
          <div className={`update-progress ${progress === null || state !== "downloading" ? "is-indeterminate" : ""}`}>
            <div style={progress !== null && state === "downloading" ? { width: `${progress}%` } : undefined} />
            <span>{progressLabel}</span>
          </div>
        )}
        {state === "error" && <p className="update-error">{error || `Update failed. Try again from ${RELEASES_URL}.`}</p>}
      </div>
      <div className="update-actions">
        {state === "ready" ? (
          <button
            className="btn btn-accent"
            onClick={() => {
              void relaunchIntoUpdate();
            }}
          >
            Restart
          </button>
        ) : (
          <button className="btn btn-accent" onClick={install} disabled={blockedByInstallLocation || isBusy}>
            {blockedByInstallLocation ? "Move app first" : state === "downloading" ? "Downloading..." : state === "installing" ? "Applying..." : state === "relaunching" ? "Reopening..." : "Update"}
          </button>
        )}
        <button className="btn btn-ghost" onClick={dismiss} disabled={isBusy}>Later</button>
      </div>
    </aside>
  );
}
