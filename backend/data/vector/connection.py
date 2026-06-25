from __future__ import annotations
import importlib
import logging

import os
import sys
import threading
import warnings

from core.logging import get_logger
from core.paths import app_data_dir
from data.vector.runtime import (
    add_vector_runtime_to_path,
    clear_vector_runtime_modules,
    vector_runtime_files_complete,
    vector_runtime_ready,
)

_log = get_logger(__name__)
lancedb = None
_LANCEDB_IMPORT_ERROR = ""
_LANCEDB_RESTART_REQUIRED = False
_LANCEDB_PYO3_DEGRADED = False
PYO3_RESTART_MESSAGE = "La recherche vectorielle native est temporairement indisponible ; Juste Recrute Moi continue avec le rapprochement déterministe."

warnings.filterwarnings(
    "ignore",
    message=r"The NumPy module was reloaded.*",
    category=UserWarning,
    module=r"lancedb\.common",
)


def default_base_dir() -> str:
    return str(app_data_dir())


def default_vector_dir() -> str:
    return os.path.join(default_base_dir(), "vector")


BASE_DIR = default_base_dir()
VECTOR_DIR = default_vector_dir()
# STABILITY: thread-safe vector store reconnect/status
_vector_lock = threading.RLock()


class NullVectorStore:
    """No-op vector store so profile CRUD never fails because embeddings are unavailable.

    Every operation is logged at WARNING level so dropped writes are visible
    in diagnostics rather than silently swallowed.
    """

    available = False
    _null_log = logging.getLogger("data.vector.null")

    def __init__(self, reason: str = ""):
        self.reason = reason

    def list_tables(self):
        self._null_log.warning("Stockage vectoriel indisponible : list_tables ignoré (%s)", self.reason)
        return []

    def create_table(self, *_args, **_kwargs):
        name = _args[0] if _args else _kwargs.get("name", "?")
        self._null_log.warning("create_table(%s) - stockage vectoriel indisponible, création ignorée (%s)", name, self.reason)
        return None

    def open_table(self, *_args, **_kwargs):
        name = _args[0] if _args else _kwargs.get("name", "?")
        self._null_log.warning("open_table(%s) - stockage vectoriel indisponible, table neutre renvoyée (%s)", name, self.reason)
        return self

    def add(self, *_args, **_kwargs):
        self._null_log.warning("add() - stockage vectoriel indisponible, ajout ignoré (%s)", self.reason)
        return None

    def delete(self, *_args, **_kwargs):
        self._null_log.warning("delete() - stockage vectoriel indisponible, suppression ignorée (%s)", self.reason)
        return None

    def search(self, *_args, **_kwargs):
        self._null_log.warning("Stockage vectoriel indisponible : résultats vides renvoyés (%s)", self.reason)
        return self

    def metric(self, *_args, **_kwargs):
        """Chained after search() — returns self so .limit()/.to_list() etc. keep chaining."""
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def where(self, *_args, **_kwargs):
        return self

    def to_list(self):
        return []

    def to_pandas(self):
        import types
        # Return a minimal object with empty-DataFrame-like behavior
        df = types.SimpleNamespace(empty=True, to_dict=lambda orient="records": [])
        return df

    def drop_table(self, *_args, **_kwargs):
        name = _args[0] if _args else _kwargs.get("name", "?")
        self._null_log.warning("Stockage vectoriel indisponible : suppression de table ignorée pour %s (%s)", name, self.reason)
        return None


def _usable_lancedb_module(module) -> bool:
    return module is not None and callable(getattr(module, "connect", None))


def _clear_lancedb_modules() -> None:
    for name in list(sys.modules):
        if name == "lancedb" or name.startswith("lancedb."):
            sys.modules.pop(name, None)


def _runtime_package_installed() -> bool:
    return vector_runtime_files_complete()


def _is_pyo3_reinit_error(exc: BaseException) -> bool:
    """Detect the PyO3 'may only be initialized once per interpreter process' error."""
    return "initialized once per interpreter" in str(exc).lower()


def _set_lancedb_module(module):
    global lancedb, _LANCEDB_IMPORT_ERROR, _LANCEDB_RESTART_REQUIRED, _LANCEDB_PYO3_DEGRADED
    lancedb = module
    _LANCEDB_IMPORT_ERROR = ""
    _LANCEDB_RESTART_REQUIRED = False
    _LANCEDB_PYO3_DEGRADED = False
    return module


def _try_import_lancedb(*, log_warning: bool = True):
    global lancedb, _LANCEDB_IMPORT_ERROR, _LANCEDB_RESTART_REQUIRED, _LANCEDB_PYO3_DEGRADED
    if _usable_lancedb_module(lancedb):
        _LANCEDB_IMPORT_ERROR = ""
        _LANCEDB_RESTART_REQUIRED = False
        _LANCEDB_PYO3_DEGRADED = False
        return lancedb
    if _LANCEDB_PYO3_DEGRADED:
        return None
    add_vector_runtime_to_path()
    cached = sys.modules.get("lancedb")
    if _usable_lancedb_module(cached):
        return _set_lancedb_module(cached)
    clear_vector_runtime_modules()
    importlib.invalidate_caches()
    if getattr(sys, "frozen", False) and not _runtime_package_installed():
        _clear_lancedb_modules()
        lancedb = None
        _LANCEDB_IMPORT_ERROR = "Le runtime LanceDB n'est pas installé"
        _LANCEDB_RESTART_REQUIRED = False
        _LANCEDB_PYO3_DEGRADED = False
        return None
    if not _usable_lancedb_module(sys.modules.get("lancedb")):
        _clear_lancedb_modules()
    try:
        module = importlib.import_module("lancedb")
    except Exception as exc:
        # PyO3 native extensions can only be initialized once per process.
        # If this is a reinit error, a module may already be loaded and usable.
        cached = sys.modules.get("lancedb")
        if _is_pyo3_reinit_error(exc) and _usable_lancedb_module(cached):
            _log.info("lancedb import raised PyO3 reinit warning but the cached module is usable; continuing")
            return _set_lancedb_module(cached)
        _clear_lancedb_modules()
        lancedb = None
        if _is_pyo3_reinit_error(exc):
            _LANCEDB_IMPORT_ERROR = PYO3_RESTART_MESSAGE
            _LANCEDB_RESTART_REQUIRED = False
            _LANCEDB_PYO3_DEGRADED = True
            if log_warning:
                _log.info("native vector search disabled for this session after PyO3 reinit guard: %s", exc)
        else:
            if log_warning:
                logging.getLogger(__name__).warning(
                    "lancedb import failed: %s",
                    exc,
                )
            _LANCEDB_IMPORT_ERROR = str(exc)
            _LANCEDB_RESTART_REQUIRED = False
            _LANCEDB_PYO3_DEGRADED = False
        return None
    if not _usable_lancedb_module(module):
        location = getattr(module, "__file__", "") or ",".join(map(str, getattr(module, "__path__", []))) or "unknown location"
        _clear_lancedb_modules()
        lancedb = None
        _LANCEDB_IMPORT_ERROR = f"Le runtime LanceDB est incomplet dans {location}"
        _LANCEDB_RESTART_REQUIRED = False
        _LANCEDB_PYO3_DEGRADED = False
        return None
    return _set_lancedb_module(module)


def _connect_vector_store():
    global BASE_DIR, VECTOR_DIR
    with _vector_lock:
        BASE_DIR = default_base_dir()
        VECTOR_DIR = default_vector_dir()
        os.makedirs(VECTOR_DIR, exist_ok=True)
        module = lancedb if _usable_lancedb_module(lancedb) else _try_import_lancedb()
        if module is None:
            raise RuntimeError(_LANCEDB_IMPORT_ERROR or "LanceDB n'est pas disponible")
        return module.connect(VECTOR_DIR)


def refresh_vector_store() -> dict:
    global vec
    with _vector_lock:
        try:
            vec = _connect_vector_store()
        except Exception as exc:
            if lancedb is None:
                _log.info("stockage vectoriel désactivé : %s", exc)
            else:
                _log.warning("stockage vectoriel désactivé : %s", exc)
            vec = NullVectorStore(str(exc))
    return vector_status(refresh=False)


def vector_status(*, refresh: bool = True) -> dict:
    with _vector_lock:
        if getattr(vec, "available", True) is False:
            if refresh and not _LANCEDB_RESTART_REQUIRED and not _LANCEDB_PYO3_DEGRADED and vector_runtime_ready():
                return refresh_vector_store()
            status = {
                "status": "disabled",
            "error": getattr(vec, "reason", "") or "stockage vectoriel indisponible",
                "tables": [],
            }
            if _LANCEDB_PYO3_DEGRADED:
                status["mode"] = "fallback"
            if _LANCEDB_RESTART_REQUIRED:
                status["restart_required"] = True
            return status
        try:
            return {"status": "ok", "tables": list(vec.list_tables() or [])}
        except Exception as exc:
            _log.warning("vector store status check failed: %s", exc)
            return {"status": "degraded", "error": str(exc), "tables": []}


if os.environ.get("JHM_SKIP_VECTOR_IMPORT") == "1":
    vec = NullVectorStore("import LanceDB ignoré pendant l'empaquetage du sidecar")
else:
    _try_import_lancedb(log_warning=False)
    vec = NullVectorStore(_LANCEDB_IMPORT_ERROR or "LanceDB n'est pas disponible")
    refresh_vector_store()
