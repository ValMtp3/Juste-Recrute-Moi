from profile.service import _cleanup_profile_snapshot


def test_cleanup_profile_snapshot_normalizes_and_deduplicates_rows():
    cleaned, stats = _cleanup_profile_snapshot({
        "n": " Jane Doe ",
        "s": " Email: jane@example.com\nApplied AI engineer ",
        "skills": [
            {"name": " Python ", "category": " language "},
            {"n": "python", "cat": "duplicate"},
            {"name": ""},
        ],
        "projects": [
            {"name": "Search Agent", "skills": ["Python", "FastAPI"], "description": "Built it"},
            {"title": " search agent "},
            {"title": ""},
        ],
        "exp": [
            {"title": "Engineer", "company": "Acme", "description": "Backend"},
            {"role": " Engineer ", "co": " Acme "},
            {"role": "", "co": ""},
        ],
        "education": [{"title": "MSc AI"}, " MSc AI ", ""],
        "certifications": [],
        "achievements": [],
        "identity": {"email": " jane@example.com "},
    })

    assert cleaned["n"] == "Jane Doe"
    assert cleaned["s"] == "Applied AI engineer"
    assert cleaned["identity"]["email"] == "jane@example.com"
    assert cleaned["skills"] == [{"id": cleaned["skills"][0]["id"], "n": "Python", "cat": "language"}]
    assert cleaned["projects"][0]["title"] == "Search Agent"
    assert cleaned["projects"][0]["stack"] == ["Python", "FastAPI"]
    assert cleaned["exp"][0]["role"] == "Engineer"
    assert cleaned["exp"][0]["co"] == "Acme"
    assert cleaned["education"] == ["MSc AI"]
    assert stats["deduplicated"] >= 4
    assert stats["removed"] >= 3
