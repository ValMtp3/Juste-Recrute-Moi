"""Document text extraction for profile ingestion.

Reads raw text out of uploaded resume files (PDF via pypdf, DOCX via the docx
XML, plain .txt/.md) and provides the markdown-strip / PDF-spacing-repair
cleaners used on extracted text. No dependency on the rest of the ingestor.
"""

import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from core.logging import get_logger

_log = get_logger(__name__)


def _docx(path: str) -> str:
    try:
        with zipfile.ZipFile(path) as archive:
            xml = archive.read("word/document.xml")
        root = ET.fromstring(xml)
        ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        paragraphs = []
        for paragraph in root.findall(".//w:p", ns):
            text = "".join(node.text or "" for node in paragraph.findall(".//w:t", ns))
            if text.strip():
                paragraphs.append(text)
        return "\n".join(paragraphs)
    except Exception as exc:
        _log.error("DOCX read error for %s: %s", path, exc)
        return ""


def _text_file(path: str) -> str:
    try:
        return Path(path).read_text(encoding="utf-8", errors="ignore")
    except Exception as exc:
        _log.error("text resume read error for %s: %s", path, exc)
        return ""


def _document(path: str) -> str:
    suffix = Path(path).suffix.lower()
    if suffix == ".pdf":
        return _pdf(path)
    if suffix == ".docx":
        return _docx(path)
    if suffix in {".txt", ".md"}:
        return _text_file(path)
    if suffix == ".doc":
        _log.error("Legacy .doc resume uploads are not supported; export the resume as PDF or DOCX")
        return ""
    return _text_file(path)


def _pdf(path: str) -> str:
    try:
        from pypdf import PdfReader
        pages = PdfReader(path).pages
        text = "\n".join(pg.extract_text() or "" for pg in pages)
        if not text.strip():
            _log.warning("PDF has no extractable text (may be scanned/image-only): %s", path)
        return text
    except Exception as exc:
        _log.error("PDF read error for %s: %s", path, exc)
        return ""


def _strip_md(text: str) -> str:
    text = re.sub(r"`([^`]+)`", r"\1", text or "")
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = text.replace("→", "->").replace("·", "-")
    text = re.sub(r"^\s*(?:[-*]|•|â€¢)\s*", "", text)
    text = _repair_pdf_spacing(text)
    return re.sub(r"\s+", " ", text).strip()


def _repair_pdf_spacing(text: str) -> str:
    text = re.sub(r"\b([A-Z]\.[A-Z])\s+([a-z]{2,})\b", r"\1\2", text or "")
    text = re.sub(r"\b([A-Z])\.\s+([A-Za-z]{2,})\b", r"\1.\2", text or "")
    return re.sub(r"\b([BFV])\s+([a-z]{2,})\b", r"\1\2", text)
