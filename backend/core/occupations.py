"""Field-agnostic occupation and employment vocabularies.

Shared across discovery (lead scoring / role detection) and profile ingestion
(deterministic résumé parsing) so every layer recognizes a real professional
role in ANY field — healthcare, trades, business, education, creative, science,
public service, software — not just tech. Lives in ``core`` because both the
``discovery`` and ``profile`` packages need it and neither may import the other.

Kept deliberately broad-but-finite: enough coverage to recognize the great
majority of real job titles, without trying to enumerate every occupation on
Earth (that would add noise). Structure-based heuristics handle the long tail.
"""

from __future__ import annotations

# Employment-structure terms: domain-neutral signals that a text describes a job.
EMPLOYMENT_TERMS: tuple[str, ...] = (
    "full-time", "full time", "part-time", "part time", "contract",
    "permanent", "temporary", "internship", "apprenticeship", "salary",
    "wage", "hourly", "per hour", "per year", "per annum", "benefits",
    "shift", "responsibilities", "qualifications", "requirements",
    "job description", "position", "vacancy", "opening", "we are looking for",
    "looking for", "join our team", "join the team",
    "cdi", "cdd", "alternance", "apprentissage", "stage", "freelance",
    "temps plein", "temps partiel", "contrat", "salaire", "rémunération",
    "remuneration", "télétravail", "teletravail", "hybride", "présentiel",
    "presentiel", "mission", "poste", "offre d'emploi", "nous recherchons",
    "rejoignez", "vos missions", "profil recherché", "profil recherche",
)

# Occupation nouns across major fields. Not exhaustive by design.
OCCUPATION_TERMS: tuple[str, ...] = (
    # tech
    "engineer", "developer", "programmer", "designer", "analyst", "scientist",
    "administrator", "architect",
    "ingénieur", "ingenieur", "développeur", "developpeur", "développeuse",
    "developpeuse", "programmeur", "programmeuse", "concepteur", "conceptrice",
    "analyste", "scientifique", "administrateur", "administratrice",
    "architecte", "data engineer", "data analyst",
    # healthcare
    "nurse", "doctor", "physician", "therapist", "technician", "pharmacist",
    "caregiver", "dentist", "paramedic", "surgeon", "practitioner",
    # trades / labor
    "welder", "electrician", "plumber", "carpenter", "mechanic", "machinist",
    "driver", "operator", "fabricator", "installer",
    # business / office
    "accountant", "bookkeeper", "manager", "coordinator", "specialist",
    "consultant", "associate", "assistant", "clerk", "officer", "executive",
    "representative", "agent", "supervisor", "director", "controller",
    "chef de projet", "chargé", "charge", "responsable", "coordinateur",
    "coordinatrice", "spécialiste", "specialiste", "commercial", "comptable",
    "conseiller", "conseillère", "conseillere", "assistant", "assistante",
    "technico-commercial", "technico commercial",
    # education / public / service
    "teacher", "tutor", "instructor", "professor", "lecturer", "trainer",
    "chef", "cook", "baker", "barista", "server", "bartender", "housekeeper",
    "stylist", "barber", "cleaner", "guard", "receptionist",
    "enseignant", "enseignante", "formateur", "formatrice", "professeur",
    "cuisinier", "cuisinière", "cuisiniere", "serveur", "serveuse",
    "réceptionniste", "receptionniste",
    # creative / marketing / legal / science
    "writer", "editor", "translator", "photographer", "marketer", "recruiter",
    "lawyer", "paralegal", "attorney", "auditor", "surveyor", "researcher",
    "nutritionist", "counselor", "social worker",
)
