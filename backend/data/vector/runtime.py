from __future__ import annotations

import importlib.util
import importlib
import os
import platform
import shutil
import ssl
import stat
import sys
import tempfile
import threading
import time
import urllib.request
import warnings
import zipfile
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import url2pathname


_RELEASE_DOWNLOAD_BASE = "https://github.com/ValMtp3/Juste-Recrute-Moi/releases/latest/download"
_INSTALL_LOCK = threading.RLock()
_PROGRESS_LOCK = threading.RLock()
_DLL_DIRS: set[str] = set()
_DLL_HANDLES: list[object] = []
_INSTALL_PROGRESS: dict = {
    "status": "idle",
    "message": "",
    "percent": 0,
    "downloaded": 0,
    "total": 0,
    "error": "",
    "active": False,
    "started_at": None,
    "updated_at": None,
}
_NATIVE_REINIT_ERROR_MARKERS = (
    "initialized once per interpreter",
    "cannot load module more than once per process",
)

warnings.filterwarnings(
    "ignore",
    message=r"The NumPy module was reloaded.*",
    category=UserWarning,
    module=r"lancedb\.common",
)


def sys_platform() -> str:
    return platform.system().lower()


def _app_version() -> str:
    """Return the app version from the JHM_APP_VERSION env var set by Tauri."""
    return os.environ.get("JHM_APP_VERSION", "")


def _expected_runtime_pack_version() -> str:
    """Return the runtime pack *content* version this build requires.

    The runtime pack (Chromium + vector libs + embedding model) changes far less
    often than the app itself, so its identity is keyed off a content version
    baked in at build time (``JHM_RUNTIME_PACK_VERSION``) rather than the app
    version. This is what lets a routine app update reuse an already-installed
    pack instead of re-downloading hundreds of MB on every release. When the
    build env var is absent (dev, or older builds), fall back to the app version
    so behaviour is unchanged.
    """
    return os.environ.get("JHM_RUNTIME_PACK_VERSION", "").strip() or _app_version()


def _version_stamp_path() -> Path:
    return _data_root() / "runtime-pack-version"


def _installed_runtime_version() -> str:
    """Read the version stamp written after a successful runtime pack install."""
    stamp = _version_stamp_path()
    if stamp.exists():
        try:
            return stamp.read_text(encoding="utf-8").strip()
        except OSError:
            return ""
    return ""


def _write_version_stamp() -> None:
    """Stamp the installed runtime pack with the content version it satisfies."""
    version = _expected_runtime_pack_version()
    if not version:
        return
    stamp = _version_stamp_path()
    stamp.parent.mkdir(parents=True, exist_ok=True)
    stamp.write_text(version, encoding="utf-8")


def _runtime_pack_is_stale() -> bool:
    """Return True if the installed runtime pack predates the version this build needs.

    Compares the installed stamp against the required *content* version, not the
    app version, so a routine app update whose runtime pack is unchanged is not
    treated as stale (and therefore not re-downloaded).
    """
    expected = _expected_runtime_pack_version()
    if not expected:
        return False  # No version info available (dev mode), skip staleness check
    installed = _installed_runtime_version()
    if not installed:
        return False  # No stamp yet — first install, not stale
    return installed != expected


def _data_root() -> Path:
    configured = os.environ.get("JHM_APP_DATA_DIR")
    if configured:
        return Path(configured)
    if os.name == "nt":
        root = Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local")
    elif sys_platform() == "darwin":
        root = Path.home() / "Library" / "Application Support"
    else:
        root = Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share")
    return root / "Juste Recrute Moi"


def vector_runtime_dir() -> Path:
    configured = os.environ.get("JHM_VECTOR_RUNTIME_DIR")
    if configured:
        return Path(configured)
    return _data_root() / "vector-runtime"


def browser_runtime_dir() -> Path:
    configured = os.environ.get("JHM_BROWSER_RUNTIME_DIR") or os.environ.get("PLAYWRIGHT_BROWSERS_PATH")
    if configured:
        return Path(configured)
    return _data_root() / "browser-runtime" / "ms-playwright"


def _system_browser_candidates() -> list[str]:
    system = sys_platform()
    if system == "windows":
        return [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
            r"C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe",
        ]
    if system == "darwin":
        return [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
            os.path.expanduser("~/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
            os.path.expanduser("~/Applications/Chromium.app/Contents/MacOS/Chromium"),
            os.path.expanduser("~/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"),
        ]
    return [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/usr/bin/microsoft-edge",
        "/usr/bin/microsoft-edge-stable",
        "/usr/bin/brave-browser",
        "/usr/bin/brave-browser-stable",
        "/snap/bin/chromium",
        "/usr/local/bin/chromium",
    ]


def system_browser_executable() -> str | None:
    configured = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE", "")
    for candidate in [configured, *_system_browser_candidates()]:
        if candidate and Path(candidate).exists():
            return candidate
    return None


def system_browser_ready() -> bool:
    return bool(system_browser_executable())


def runtime_pack_asset_name() -> str:
    system = sys_platform()
    if system == "windows":
        return "Juste-Recrute-Moi-runtime-pack-windows.zip"
    if system == "darwin":
        return "Juste-Recrute-Moi-runtime-pack-macos.zip"
    return "Juste-Recrute-Moi-runtime-pack-linux.zip"


def vector_runtime_asset_name() -> str:
    system = sys_platform()
    if system == "windows":
        return "Juste-Recrute-Moi-vector-runtime-windows.zip"
    if system == "darwin":
        return "Juste-Recrute-Moi-vector-runtime-macos.zip"
    return "Juste-Recrute-Moi-vector-runtime-linux.zip"


def runtime_pack_url() -> str:
    return os.environ.get(
        "JHM_RUNTIME_PACK_URL",
        os.environ.get(
            "JHM_BUNDLED_RUNTIME_PACK_URL",
            f"{_RELEASE_DOWNLOAD_BASE}/{runtime_pack_asset_name()}",
        ),
    )


def release_runtime_pack_url() -> str:
    return os.environ.get(
        "JHM_RELEASE_RUNTIME_PACK_URL",
        f"{_RELEASE_DOWNLOAD_BASE}/{runtime_pack_asset_name()}",
    )


def vector_runtime_url() -> str:
    return os.environ.get(
        "JHM_VECTOR_RUNTIME_URL",
        f"{_RELEASE_DOWNLOAD_BASE}/{vector_runtime_asset_name()}",
    )


def _repo_runtime_pack_path() -> str:
    candidate = Path(__file__).resolve().parents[3] / "release-assets" / runtime_pack_asset_name()
    return str(candidate) if candidate.exists() else ""


def _legacy_vector_runtime_override() -> bool:
    return bool(os.environ.get("JHM_VECTOR_RUNTIME_URL") and not os.environ.get("JHM_RUNTIME_PACK_URL"))


def _set_progress(**updates) -> None:
    with _PROGRESS_LOCK:
        now = time.time()
        if updates.get("status") in {"starting", "downloading", "extracting", "copying", "verifying", "syncing"}:
            updates.setdefault("active", True)
            if not _INSTALL_PROGRESS.get("started_at"):
                updates.setdefault("started_at", now)
        elif updates.get("status") in {"installed", "error", "idle"}:
            updates.setdefault("active", False)
        updates.setdefault("updated_at", now)
        _INSTALL_PROGRESS.update(updates)


def vector_runtime_progress() -> dict:
    with _PROGRESS_LOCK:
        return dict(_INSTALL_PROGRESS)


def vector_runtime_roots(path: Path | None = None) -> list[Path]:
    root = path or vector_runtime_dir()
    return [
        root,
        root / "site-packages",
        root / "Lib" / "site-packages",
        root / "_internal",
    ]


def _runtime_has_any_vector_payload(root: Path) -> bool:
    return any((candidate / "lancedb" / "__init__.py").exists() for candidate in vector_runtime_roots(root))


def _lancedb_native_binary_present(lancedb_dir: Path) -> bool:
    suffixes = (".pyd", ".so", ".dylib")
    return any(
        child.is_file() and child.name.startswith("_lancedb") and child.name.lower().endswith(suffixes)
        for child in lancedb_dir.iterdir()
    ) if lancedb_dir.exists() else False


def vector_runtime_files_complete(path: Path | None = None) -> bool:
    root = path or vector_runtime_dir()
    for candidate in vector_runtime_roots(root):
        lancedb_dir = candidate / "lancedb"
        pyarrow_dir = candidate / "pyarrow"
        if not (lancedb_dir / "__init__.py").exists():
            continue
        required_lancedb = [
            lancedb_dir / "common.py",
            lancedb_dir / "db.py",
            lancedb_dir / "table.py",
        ]
        required_pyarrow = [
            pyarrow_dir / "__init__.py",
        ]
        if (
            all(item.exists() for item in required_lancedb)
            and _lancedb_native_binary_present(lancedb_dir)
            and all(item.exists() for item in required_pyarrow)
        ):
            return True
    return False


def _add_dll_dir(path: Path) -> None:
    if os.name != "nt" or not path.exists() or not path.is_dir() or not hasattr(os, "add_dll_directory"):
        return
    key = str(path.resolve())
    if key in _DLL_DIRS:
        return
    _DLL_DIRS.add(key)
    _DLL_HANDLES.append(os.add_dll_directory(key))


def add_vector_runtime_to_path(path: Path | None = None) -> None:
    root = path or vector_runtime_dir()
    for candidate in vector_runtime_roots(root):
        if candidate.exists() and candidate.is_dir():
            value = str(candidate)
            if value not in sys.path:
                sys.path.insert(0, value)
            _add_dll_dir(candidate)
            _add_dll_dir(candidate / "pyarrow.libs")
            _add_dll_dir(candidate / "numpy.libs")


def clear_vector_runtime_modules() -> None:
    for key in list(sys.modules):
        if key in {"lancedb", "pyarrow", "numpy"} or key.startswith(("lancedb.", "pyarrow.", "numpy.")):
            sys.modules.pop(key, None)


def is_native_module_reinit_error(exc: BaseException) -> bool:
    message = str(exc).lower()
    return any(marker in message for marker in _NATIVE_REINIT_ERROR_MARKERS)


def _runtime_module_loaded(module) -> bool:
    return module is not None


def _runtime_module_location(module) -> str:
    return getattr(module, "__file__", "") or ",".join(map(str, getattr(module, "__path__", []))) or "unknown location"


def _import_runtime_module(module_name: str) -> str:
    cached = sys.modules.get(module_name)
    if _runtime_module_loaded(cached):
        return ""
    try:
        module = importlib.import_module(module_name)
    except Exception as exc:
        if is_native_module_reinit_error(exc):
            return ""
        return f"{module_name}: {type(exc).__name__}: {exc}"
    if not _runtime_module_loaded(module):
        return f"{module_name}: module incomplet dans {_runtime_module_location(module)}"
    return ""


def _vector_runtime_import_error(path: Path | None = None) -> str:
    root = path or vector_runtime_dir()
    has_payload = _runtime_has_any_vector_payload(root)
    if has_payload and not vector_runtime_files_complete(root):
        return "les fichiers du runtime vectoriel sont incomplets"
    if getattr(sys, "frozen", False) and not vector_runtime_files_complete(root):
        return "les fichiers du runtime vectoriel sont incomplets"
    add_vector_runtime_to_path(root)
    try:
        for module_name in ("pyarrow", "lancedb"):
            cached = sys.modules.get(module_name)
            module_available = cached is not None or bool(importlib.util.find_spec(module_name))
            if not module_available:
                return f"le module {module_name} est introuvable"
            error = _import_runtime_module(module_name)
            if error:
                return error
        return ""
    except (ImportError, ValueError, AttributeError) as exc:
        return f"{type(exc).__name__}: {exc}"


def vector_runtime_ready(path: Path | None = None) -> bool:
    return not _vector_runtime_import_error(path)


def browser_runtime_ready(path: Path | None = None) -> bool:
    root = path or browser_runtime_dir()
    if not root.exists():
        return False
    return any(candidate.name.lower().startswith("chromium") for candidate in root.iterdir() if candidate.is_dir())


def _browser_runtime_has_headless_shell(path: Path | None = None) -> bool:
    root = path or browser_runtime_dir()
    if not root.exists():
        return False
    return any(
        candidate.exists()
        for pattern in (
            "chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell",
            "chromium_headless_shell-*/chrome-headless-shell",
        )
        for candidate in root.glob(pattern)
    )


def _ensure_browser_runtime_executable_permissions(path: Path | None = None) -> None:
    if sys_platform() == "windows":
        return
    root = path or browser_runtime_dir()
    if not root.exists():
        return
    if sys_platform() == "darwin":
        for app_root in root.glob("chromium-*/chrome-mac*/*.app"):
            _clear_macos_extended_attrs(app_root)
            for subdir in (app_root / "Contents" / "MacOS", app_root / "Contents" / "Frameworks"):
                if not subdir.exists():
                    continue
                for candidate in subdir.rglob("*"):
                    if not candidate.is_file():
                        continue
                    try:
                        mode = candidate.stat().st_mode
                        candidate.chmod(mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
                    except OSError:
                        continue
    for pattern in (
        "chromium-*/chrome-mac*/*.app/Contents/MacOS/*",
        "chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell",
        "chromium_headless_shell-*/chrome-headless-shell",
        "chromium-*/chrome-linux*/chrome",
        "chromium-*/chrome",
    ):
        for candidate in root.glob(pattern):
            if not candidate.is_file():
                continue
            try:
                mode = candidate.stat().st_mode
                candidate.chmod(mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
            except OSError:
                continue


def _clear_macos_extended_attrs(path: Path) -> None:
    removexattr = getattr(os, "removexattr", None)
    if sys_platform() != "darwin" or not hasattr(os, "listxattr") or removexattr is None:
        return
    candidates = [path, *path.rglob("*")]
    for candidate in candidates:
        try:
            attrs = os.listxattr(candidate)
        except OSError:
            continue
        for attr in attrs:
            if attr.startswith("com.apple."):
                try:
                    removexattr(candidate, attr)
                except OSError:
                    continue


def runtime_pack_ready() -> bool:
    return vector_runtime_ready(vector_runtime_dir()) and (
        browser_runtime_ready(browser_runtime_dir()) or system_browser_ready()
    )


def _archive_payload_dir(extract_dir: Path) -> Path | None:
    candidates = [extract_dir, *[path for path in extract_dir.rglob("*") if path.is_dir()]]
    for candidate in candidates:
        if (candidate / "lancedb").exists() and (candidate / "pyarrow").exists():
            return candidate
    return None


def _runtime_pack_payloads(extract_dir: Path) -> tuple[Path | None, Path | None, Path | None]:
    """Return (vector_payload, browser_payload, models_payload) from extracted pack."""
    candidates = [extract_dir, *[path for path in extract_dir.rglob("*") if path.is_dir()]]
    for candidate in candidates:
        vector_payload = candidate / "vector-runtime"
        browser_payload = candidate / "browser-runtime" / "ms-playwright"
        models_payload = candidate / "models"
        if (vector_payload / "lancedb").exists() and (vector_payload / "pyarrow").exists():
            return (
                vector_payload,
                browser_payload if browser_payload.exists() else None,
                models_payload if models_payload.exists() else None,
            )

    return _archive_payload_dir(extract_dir), None, None


def _safe_extract(archive_path: Path, extract_dir: Path) -> None:
    root = extract_dir.resolve()
    with zipfile.ZipFile(archive_path) as archive:
        members = archive.infolist()
        total = max(1, len(members))
        for index, member in enumerate(members, start=1):
            target = (extract_dir / member.filename).resolve()
            if root != target and root not in target.parents:
                raise RuntimeError("Le pack runtime téléchargé contient un chemin non sécurisé.")
            archive.extract(member, extract_dir)
            _set_progress(
                status="extracting",
                message="Décompression du pack runtime Juste Recrute Moi.",
                percent=min(84, 70 + round((index / total) * 14)),
            )


def _https_ssl_context() -> ssl.SSLContext | None:
    """Build an SSL context backed by certifi's CA bundle for HTTPS downloads.

    The bundled sidecar Python (PyInstaller) has no system CA store wired into
    OpenSSL on macOS, so urllib's default verification fails with
    CERTIFICATE_VERIFY_FAILED ("unable to get local issuer certificate") when
    fetching the runtime pack from GitHub. Windows falls back to the OS cert
    store, which is why it works there. certifi ships a CA bundle (collected
    into the frozen app by PyInstaller's certifi hook); point OpenSSL at it.
    Falls back to the default context if certifi is unavailable.
    """
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        try:
            return ssl.create_default_context()
        except Exception:
            return None


def _download(url: str, archive_path: Path) -> None:
    direct_path = Path(url)
    if direct_path.exists():
        _copy_file_with_progress(direct_path, archive_path)
        return
    parsed = urlparse(url)
    if parsed.scheme in {"", "file"}:
        source = Path(url2pathname(parsed.path) if parsed.scheme == "file" else url)
        if os.name == "nt" and parsed.scheme == "file" and parsed.netloc:
            source = Path(f"//{parsed.netloc}{url2pathname(parsed.path)}")
        if source.exists():
            _copy_file_with_progress(source, archive_path)
            return

    request = urllib.request.Request(url, headers={"User-Agent": "Juste Recrute Moi-runtime-installer"})
    context = _https_ssl_context() if parsed.scheme == "https" else None
    with urllib.request.urlopen(request, timeout=60, context=context) as response, archive_path.open("wb") as target:
        total = int(response.headers.get("Content-Length") or 0)
        _stream_to_file(response, target, total)


def _runtime_pack_sources() -> list[str]:
    sources: list[str] = []
    for candidate in (
        os.environ.get("JHM_BUNDLED_RUNTIME_PACK_URL"),
        os.environ.get("JHM_RUNTIME_PACK_URL"),
        _repo_runtime_pack_path(),
        release_runtime_pack_url(),
    ):
        if candidate and candidate not in sources:
            sources.append(candidate)
    return sources


def _copy_file_with_progress(source: Path, target: Path) -> None:
    total = source.stat().st_size
    with source.open("rb") as reader, target.open("wb") as writer:
        _stream_to_file(reader, writer, total)
    shutil.copystat(source, target)


def _stream_to_file(reader, writer, total: int) -> None:
    downloaded = 0
    _set_progress(
        status="downloading",
        message="Téléchargement du pack runtime Juste Recrute Moi.",
        percent=1,
        downloaded=0,
        total=total,
        error="",
    )
    while True:
        chunk = reader.read(1024 * 1024)
        if not chunk:
            break
        writer.write(chunk)
        downloaded += len(chunk)
        percent = min(70, max(1, round((downloaded / total) * 70))) if total else min(65, _INSTALL_PROGRESS.get("percent", 1) + 1)
        _set_progress(
            status="downloading",
            message="Téléchargement du pack runtime Juste Recrute Moi.",
            percent=percent,
            downloaded=downloaded,
            total=total,
        )


def _directory_size(path: Path) -> int:
    total = 0
    for source in path.rglob("*"):
        if source.is_file() and not source.is_symlink():
            total += source.stat().st_size
    return total


def _copy_payload(
    payload: Path,
    runtime_dir: Path,
    *,
    message: str = "Installation du pack runtime Juste Recrute Moi.",
    start_percent: int = 84,
    end_percent: int = 94,
) -> None:
    if runtime_dir.exists():
        shutil.rmtree(runtime_dir)
    runtime_dir.mkdir(parents=True, exist_ok=True)

    total = max(1, _directory_size(payload))
    copied = 0
    for source in payload.rglob("*"):
        target = runtime_dir / source.relative_to(payload)
        if source.is_dir():
            target.mkdir(parents=True, exist_ok=True)
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        if source.is_symlink():
            if target.exists():
                target.unlink()
            os.symlink(os.readlink(source), target)
            continue
        with source.open("rb") as reader, target.open("wb") as writer:
            while True:
                chunk = reader.read(1024 * 1024)
                if not chunk:
                    break
                writer.write(chunk)
                copied += len(chunk)
                span = max(1, end_percent - start_percent)
                _set_progress(
                    status="copying",
                    message=message,
                    percent=min(end_percent, start_percent + round((copied / total) * span)),
                )
        shutil.copystat(source, target)


def install_vector_runtime() -> Path:
    with _INSTALL_LOCK:
        runtime_dir = vector_runtime_dir()
        browser_dir = browser_runtime_dir()
        stale = _runtime_pack_is_stale()
        vector_ready_before = vector_runtime_ready(runtime_dir) and not stale
        vector_files_complete_before = vector_runtime_files_complete(runtime_dir) and not stale
        bundled_browser_ready = browser_runtime_ready(browser_dir) and _browser_runtime_has_headless_shell(browser_dir)
        browser_ready_before = (bundled_browser_ready or system_browser_ready()) and not stale
        if vector_ready_before and vector_files_complete_before and browser_ready_before:
            _ensure_browser_runtime_executable_permissions(browser_dir)
            _set_progress(
                status="installed",
                message="Le pack runtime requis est installé.",
                percent=100,
                downloaded=0,
                total=0,
                error="",
            )
            _write_version_stamp()
            return runtime_dir

        runtime_dir.parent.mkdir(parents=True, exist_ok=True)
        browser_dir.parent.mkdir(parents=True, exist_ok=True)
        sources = [vector_runtime_url()] if _legacy_vector_runtime_override() else _runtime_pack_sources()
        url = sources[0]
        _set_progress(
            status="starting",
            message="Préparation de l'installation du pack runtime Juste Recrute Moi.",
            percent=0,
            downloaded=0,
            total=0,
            error="",
            started_at=time.time(),
        )
        try:
            with tempfile.TemporaryDirectory(prefix="jhm-vector-runtime-") as tmp:
                tmp_dir = Path(tmp)
                archive_path = tmp_dir / (vector_runtime_asset_name() if _legacy_vector_runtime_override() else runtime_pack_asset_name())
                try:
                    download_errors: list[str] = []
                    for source in sources:
                        url = source
                        try:
                            _download(source, archive_path)
                            break
                        except Exception as exc:
                            download_errors.append(f"{source}: {type(exc).__name__}: {exc}")
                            if archive_path.exists():
                                archive_path.unlink()
                    else:
                        details = "; ".join(download_errors) or "no runtime pack source was configured"
                        raise RuntimeError(details)
                    extract_dir = tmp_dir / "extract"
                    extract_dir.mkdir(parents=True, exist_ok=True)
                    _set_progress(
                        status="extracting",
                        message="Décompression du pack runtime Juste Recrute Moi.",
                        percent=70,
                    )
                    _safe_extract(archive_path, extract_dir)
                except Exception as exc:
                    error = (
                        "Le pack runtime Juste Recrute Moi est nécessaire pour continuer. "
                        f"Impossible de l'installer depuis {url}. Détails : {exc}"
                    )
                    _set_progress(status="error", message=error, error=error)
                    raise RuntimeError(error) from exc

                vector_payload, browser_payload, models_payload = _runtime_pack_payloads(extract_dir)
                if vector_payload is None:
                    error = "Le pack runtime téléchargé ne contient pas LanceDB et PyArrow."
                    _set_progress(status="error", message=error, error=error)
                    raise RuntimeError(error)
                if vector_ready_before and vector_files_complete_before:
                    _set_progress(
                        status="copying",
                        message="Conservation du runtime vectoriel LanceDB existant.",
                        percent=92,
                    )
                else:
                    _set_progress(
                        status="copying",
                        message="Installation de LanceDB et de la recherche vectorielle.",
                        percent=84,
                    )
                    _copy_payload(
                        vector_payload,
                        runtime_dir,
                        message="Installation de LanceDB et de la recherche vectorielle.",
                        start_percent=84,
                        end_percent=92,
                    )
                if browser_payload is not None and not browser_ready_before:
                    _set_progress(
                        status="copying",
                        message="Installation du navigateur Chromium intégré.",
                        percent=92,
                    )
                    _copy_payload(
                        browser_payload,
                        browser_dir,
                        message="Installation du navigateur Chromium intégré.",
                        start_percent=92,
                        end_percent=98,
                    )
                    _ensure_browser_runtime_executable_permissions(browser_dir)
                elif browser_ready_before:
                    _ensure_browser_runtime_executable_permissions(browser_dir)
                    _set_progress(
                        status="copying",
                        message="Conservation du navigateur Chromium intégré existant.",
                        percent=98,
                    )

                # Copy ONNX embedding model if bundled in the pack
                if models_payload is not None:
                    models_dest = _data_root() / "models"
                    _set_progress(
                        status="copying",
                        message="Installation du modèle d'embeddings ONNX.",
                        percent=98,
                    )
                    _copy_payload(
                        models_payload,
                        models_dest,
                        message="Installation du modèle d'embeddings ONNX.",
                        start_percent=98,
                        end_percent=99,
                    )

            _set_progress(status="verifying", message="Vérification du pack runtime Juste Recrute Moi.", percent=99)
            add_vector_runtime_to_path(runtime_dir)
            vector_import_error = _vector_runtime_import_error(runtime_dir)
            if vector_import_error:
                error = (
                    "L'installation du runtime vectoriel est terminée, mais LanceDB ou PyArrow ne peut pas être importé. "
                    f"Détails : {vector_import_error}"
                )
                _set_progress(status="error", message=error, error=error)
                raise RuntimeError(error)
            _write_version_stamp()
            _set_progress(
                status="installed",
                message="Le pack runtime Juste Recrute Moi requis est prêt.",
                percent=100,
                downloaded=0,
                total=0,
                error="",
            )
            return runtime_dir
        except Exception as exc:
            progress = vector_runtime_progress()
            if progress.get("status") != "error":
                error = str(exc)
                _set_progress(status="error", message=error, error=error)
            raise


def vector_runtime_status() -> dict:
    runtime_dir = vector_runtime_dir()
    browser_dir = browser_runtime_dir()
    stale = _runtime_pack_is_stale()
    vector_ready = vector_runtime_ready(runtime_dir) and not stale
    bundled_browser_ready = browser_runtime_ready(browser_dir) and _browser_runtime_has_headless_shell(browser_dir)
    browser_ready = (bundled_browser_ready or system_browser_ready()) and not stale
    ready = vector_ready and browser_ready
    if ready and runtime_dir.exists():
        status = "installed"
    elif ready:
        status = "bundled"
    elif stale:
        status = "stale"
    else:
        status = "missing"
    return {
        "status": status,
        "ready": ready,
        "required": True,
        "stale": stale,
        "dir": str(runtime_dir),
        "asset": runtime_pack_asset_name(),
        "url": runtime_pack_url(),
        "installed_version": _installed_runtime_version(),
        "app_version": _app_version(),
        "vector": {
            "ready": vector_ready,
            "files_complete": vector_runtime_files_complete(runtime_dir) and not stale,
            "dir": str(runtime_dir),
            "legacy_asset": vector_runtime_asset_name(),
            "legacy_url": vector_runtime_url(),
        },
        "browser": {
            "ready": browser_ready,
            "dir": str(browser_dir),
            "system_executable": system_browser_executable() or "",
        },
    }
