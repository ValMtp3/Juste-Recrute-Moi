from __future__ import annotations

import zipfile
from io import BytesIO

import pytest

import data.backup as backup


def test_backup_export_import_roundtrip_all_app_data_files(tmp_path, monkeypatch):
    app_dir = tmp_path / "app-data"
    app_dir.mkdir()
    (app_dir / "crm.db").write_bytes(b"sqlite")
    (app_dir / "crm.db.migration.lock").write_text("lock", encoding="utf-8")
    (app_dir / "assets").mkdir()
    (app_dir / "assets" / "resume.pdf").write_bytes(b"%PDF")
    (app_dir / "graph.kuzu").mkdir()
    (app_dir / "graph.kuzu" / "data.bin").write_bytes(b"graph")
    (app_dir / "vector").mkdir()
    (app_dir / "vector" / "table.lance").write_bytes(b"vector")

    monkeypatch.setenv("JHM_APP_DATA_DIR", str(app_dir))
    monkeypatch.setattr(backup, "_close_runtime_handles", lambda: [])
    monkeypatch.setattr(backup, "_refresh_runtime_after_import", lambda summary: None)

    content, filename, export_summary = backup.export_app_data_backup()

    assert filename.endswith(".zip")
    assert export_summary["files_exported"] == 4
    with zipfile.ZipFile(BytesIO(content)) as archive:
        names = set(archive.namelist())
    assert "manifest.json" in names
    assert "files/crm.db" in names
    assert "files/assets/resume.pdf" in names
    assert "files/graph.kuzu/data.bin" in names
    assert "files/vector/table.lance" in names
    assert "files/crm.db.migration.lock" not in names

    (app_dir / "old.txt").write_text("old", encoding="utf-8")
    summary = backup.import_app_data_backup(content)

    assert summary["files_restored"] == 4
    assert (app_dir / "crm.db").read_bytes() == b"sqlite"
    assert (app_dir / "assets" / "resume.pdf").read_bytes() == b"%PDF"
    assert not (app_dir / "old.txt").exists()


def test_backup_import_rejects_path_traversal(tmp_path, monkeypatch):
    app_dir = tmp_path / "app-data"
    monkeypatch.setenv("JHM_APP_DATA_DIR", str(app_dir))
    monkeypatch.setattr(backup, "_close_runtime_handles", lambda: [])
    monkeypatch.setattr(backup, "_refresh_runtime_after_import", lambda summary: None)

    content = BytesIO()
    with zipfile.ZipFile(content, "w") as archive:
        archive.writestr("manifest.json", '{"format":"juste-recrute-moi.backup","version":1}')
        archive.writestr("files/../evil.txt", "bad")

    with pytest.raises(ValueError, match="chemin dangereux"):
        backup.import_app_data_backup(content.getvalue())
