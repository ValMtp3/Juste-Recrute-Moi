-- Resume templates: users upload their own resume (PDF/DOCX/TXT) as a reusable
-- style guide. The extracted text in `content` is fed to the generator as the
-- structural/formatting guide when a template is selected for a job.
CREATE TABLE IF NOT EXISTS resume_templates(
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source_filename TEXT DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_resume_templates_default ON resume_templates(is_default);
