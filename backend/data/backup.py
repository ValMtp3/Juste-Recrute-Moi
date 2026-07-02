from __future__ import annotations

import io
import json
import shutil
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from uuid import uuid4

from core.paths import app_data_dir
from core.version import APP_VERSION


BACKUP_FORMAT = "juste-recrute-moi.backup"
BACKUP_VERSION = 1
MAX_IMPORT_FILES = 50_000
MAX_IMPORT_UNCOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024

_ARCHIVE_DATA_DIR = "files"
_SKIP_NAMES = {".DS_Store"}
_SKIP_SUFFIXES = (".migration.lock", ".lock")


def _now_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _should_skip_file(rel_path: Path) -> bool:
    if any(part in {"__pycache__", ".pytest_cache"} for part in rel_path.parts):
        return True
    name = rel_path.name
    return name in _SKIP_NAMES or any(name.endswith(suffix) for suffix in _SKIP_SUFFIXES)


def _close_runtime_handles() -> list[str]:
    errors: list[str] = []
    try:
        from data.sqlite import connection as sqlite_connection

        sqlite_connection.close_all()
    except Exception as exc:
        errors.append(f"sqlite close: {exc}")

    try:
        from data.graph import connection as graph_connection

        def _close_graph() -> None:
            for attr in ("conn", "db"):
                handle = getattr(graph_connection, attr, None)
                close = getattr(handle, "close", None)
                if callable(close):
                    close()
                setattr(graph_connection, attr, None)
            graph_connection._GRAPH_DIR_READY = False

        lock = getattr(graph_connection, "_graph_lock", None)
        if lock is not None:
            with lock:
                _close_graph()
        else:
            _close_graph()
    except Exception as exc:
        errors.append(f"graph close: {exc}")

    try:
        from data.vector import connection as vector_connection

        handle = getattr(vector_connection, "vec", None)
        close = getattr(handle, "close", None)
        if callable(close):
            close()
    except Exception as exc:
        errors.append(f"vector close: {exc}")

    return errors


def _refresh_runtime_after_import(summary: dict) -> None:
    try:
        from data.sqlite import connection as sqlite_connection

        sqlite_connection.close_all()
        sqlite_connection.init_sql()
    except Exception as exc:
        summary["errors"].append(f"sqlite init: {exc}")

    try:
        from data.graph import connection as graph_connection

        graph_connection.db = None
        graph_connection.conn = None
        graph_connection.init_graph()
    except Exception as exc:
        summary["errors"].append(f"graph init: {exc}")

    try:
        from data.vector import connection as vector_connection

        summary["vector_status"] = vector_connection.refresh_vector_store()
    except Exception as exc:
        summary["errors"].append(f"vector init: {exc}")


def export_app_data_backup() -> tuple[bytes, str, dict]:
    warnings = _close_runtime_handles()
    root = app_data_dir()
    root.mkdir(parents=True, exist_ok=True)

    created_at = datetime.now(timezone.utc).isoformat()
    files: list[dict[str, object]] = []
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(root.rglob("*")):
            if not path.is_file():
                continue
            rel_path = path.relative_to(root)
            if _should_skip_file(rel_path):
                continue
            stat = path.stat()
            archive.write(path, f"{_ARCHIVE_DATA_DIR}/{rel_path.as_posix()}")
            files.append({"path": rel_path.as_posix(), "bytes": stat.st_size})

        manifest = {
            "format": BACKUP_FORMAT,
            "version": BACKUP_VERSION,
            "app": "Juste Recrute Moi",
            "app_version": APP_VERSION,
            "created_at": created_at,
            "stores": {
                "sqlite": (root / "crm.db").exists(),
                "graph": (root / "graph.kuzu").exists(),
                "vector": (root / "vector").exists(),
                "assets": (root / "assets").exists(),
            },
            "contents": {
                "file_count": len(files),
                "total_bytes": sum(int(item["bytes"]) for item in files),
            },
            "warnings": warnings,
        }
        archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))

    filename = f"juste-recrute-moi-backup-{_now_stamp()}.zip"
    summary = {
        "files_exported": len(files),
        "bytes_exported": sum(int(item["bytes"]) for item in files),
        "warnings": warnings,
        "filename": filename,
    }
    return buffer.getvalue(), filename, summary


def _load_manifest(archive: zipfile.ZipFile) -> dict:
    try:
        raw = archive.read("manifest.json")
    except KeyError as exc:
        raise ValueError("Archive invalide : manifeste manquant") from exc
    try:
        manifest = json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise ValueError("Archive invalide : manifeste illisible") from exc
    if manifest.get("format") != BACKUP_FORMAT:
        raise ValueError("Archive invalide : format non reconnu")
    if manifest.get("version") != BACKUP_VERSION:
        raise ValueError("Archive invalide : version de sauvegarde non supportée")
    return manifest


def _archive_rel_path(filename: str) -> PurePosixPath:
    path = PurePosixPath(filename)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError(f"Archive invalide : chemin dangereux ({filename})")
    return path


def _extract_archive(content: bytes, staging_dir: Path) -> tuple[dict, int, int]:
    try:
        archive = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile as exc:
        raise ValueError("Archive invalide : fichier ZIP illisible") from exc

    with archive:
        manifest = _load_manifest(archive)
        members = [info for info in archive.infolist() if not info.is_dir()]
        if len(members) > MAX_IMPORT_FILES:
            raise ValueError("Archive trop volumineuse : trop de fichiers")

        file_members: list[zipfile.ZipInfo] = []
        total_bytes = 0
        for info in members:
            rel = _archive_rel_path(info.filename)
            if rel.as_posix() == "manifest.json":
                continue
            if not rel.parts or rel.parts[0] != _ARCHIVE_DATA_DIR or len(rel.parts) < 2:
                raise ValueError(f"Archive invalide : entrée inattendue ({info.filename})")
            total_bytes += int(info.file_size or 0)
            if total_bytes > MAX_IMPORT_UNCOMPRESSED_BYTES:
                raise ValueError("Archive trop volumineuse : données décompressées excessives")
            file_members.append(info)

        for info in file_members:
            rel = _archive_rel_path(info.filename)
            dest = staging_dir.joinpath(*rel.parts[1:])
            dest.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(info) as src, open(dest, "wb") as dst:
                shutil.copyfileobj(src, dst)

    return manifest, len(file_members), total_bytes


def import_app_data_backup(content: bytes) -> dict:
    close_warnings = _close_runtime_handles()
    root = app_data_dir()
    parent = root.parent
    parent.mkdir(parents=True, exist_ok=True)

    tmp_parent = Path(tempfile.mkdtemp(prefix=f".{root.name}.import-", dir=str(parent)))
    staging = tmp_parent / "staging"
    staging.mkdir()
    rollback: Path | None = None
    installed = False
    try:
        manifest, files_restored, bytes_restored = _extract_archive(content, staging)
        if root.exists():
            rollback = parent / f".{root.name}.rollback-{_now_stamp()}-{uuid4().hex[:8]}"
            root.rename(rollback)
        shutil.move(str(staging), str(root))
        installed = True
        if rollback is not None and rollback.exists():
            shutil.rmtree(rollback, ignore_errors=True)
        summary = {
            "files_restored": files_restored,
            "bytes_restored": bytes_restored,
            "created_at": manifest.get("created_at", ""),
            "app_version": manifest.get("app_version", ""),
            "stores": manifest.get("stores", {}),
            "warnings": [*close_warnings, *(manifest.get("warnings") or [])],
            "errors": [],
        }
        _refresh_runtime_after_import(summary)
        return summary
    except Exception:
        if installed and root.exists():
            shutil.rmtree(root, ignore_errors=True)
        if rollback is not None and rollback.exists() and not root.exists():
            rollback.rename(root)
        raise
    finally:
        shutil.rmtree(tmp_parent, ignore_errors=True)
