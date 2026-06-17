from __future__ import annotations

from core.taxonomy import TECH_CATEGORY, TECH_TAXONOMY

__all__ = [
    "COMMERCIAL_TERMS",
    "DELIVERABLE_KEYWORDS",
    "RED_FLAGS",
    "ROLE_KEYWORDS",
    "TECH_CATEGORY",
    "TECH_TAXONOMY",
    "WRONG_FIELD_TERMS",
    "_MONTHS",
]


ROLE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "ai": (
        "ai engineer", "ai developer", "ai/ml engineer", "ai/ml developer",
        "applied ai", "applied ml", "ml engineer", "machine learning engineer",
        "llm engineer", "llm developer", "ai agent", "agentic", "rag engineer",
        "prompt engineer", "genai", "generative ai", "ai automation",
        "chatbot developer", "chatbot engineer",
    ),
    "backend": (
        "backend", "back-end", "back end", "server engineer", "microservice",
        "platform engineer", "python developer", "node developer",
        "api engineer", "api developer",
    ),
    "frontend": (
        "frontend", "front-end", "front end", "react developer", "react engineer",
        "next.js developer", "web developer", "ui engineer", "ui developer",
    ),
    "fullstack": (
        "full stack", "full-stack", "software engineer", "product engineer",
        "web app developer", "saas engineer", "application developer",
    ),
    "data": ("data engineer", "analytics engineer", "etl engineer", "data pipeline"),
    "devops": ("devops", "cloud engineer", "sre", "site reliability", "infrastructure engineer", "platform reliability"),
    "mobile": ("mobile developer", "ios developer", "android developer", "react native", "flutter developer"),
    "desktop": ("desktop app", "electron developer", "tauri developer"),
    "testing": ("qa automation", "test automation", "playwright engineer"),
}


DELIVERABLE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "ai agent": ("ai agent", "agentic", "multi-agent", "workflow agent"),
    "rag": ("rag", "retrieval", "knowledge base", "semantic search"),
    "chatbot": ("chatbot", "chat bot", "assistant", "copilot"),
    "voice ai": ("voice ai", "voice agent", "speech", "deepgram", "livekit"),
    "automation": ("automation", "workflow", "scraper", "bot"),
    "dashboard": ("dashboard", "admin panel", "analytics"),
    "saas": ("saas", "multi-tenant", "subscription"),
    "api": ("rest api", "graphql api", "backend api", "server api"),
    "frontend app": ("frontend", "ui", "landing page", "web app"),
    "full-stack app": ("full stack", "full-stack", "end-to-end", "web app"),
    "data pipeline": ("data pipeline", "etl", "ingestion"),
    "fintech": ("fintech", "finance", "payments", "stripe"),
    "desktop app": ("desktop app", "tauri", "electron"),
    "testing": ("test automation", "qa automation", "playwright"),
}


WRONG_FIELD_TERMS = (
    "nurse", "doctor", "physician", "medical assistant", "pharmacist",
    "accountant", "bookkeeper", "tax preparer", "lawyer", "paralegal",
    "cashier", "retail associate", "warehouse", "driver", "delivery",
    "cook", "chef", "mechanic", "civil engineer", "mechanical engineer",
    "electrical engineer", "chemical engineer", "petroleum engineer",
    "embedded systems engineer", "rtos", "arm cortex", "can bus", "autosar",
    "real estate agent", "insurance agent", "teacher", "tutor", "data entry",
    "marketing analyst", "marketing manager", "marketing specialist",
    "marketing coordinator", "social media manager", "content writer",
    "copywriter", "blog writer", "seo specialist", "seo writer",
    "sales representative", "sales manager", "sales executive", "sdr",
    "account executive", "account manager", "customer success",
    "customer service", "customer support agent", "call center",
    "recruiter", "talent acquisition", "human resources", "hr manager",
    "executive assistant", "virtual assistant", "personal assistant",
    "graphic designer", "video editor", "animator", "illustrator",
    "translator", "transcriber", "voice actor", "video producer",
    "construction", "plumber", "electrician", "welder", "carpenter",
    "barista", "waiter", "waitress", "bartender",
    "security guard", "janitor", "housekeeper", "babysitter",
)


RED_FLAGS = (
    "unpaid", "for exposure", "equity only", "college assignment", "homework",
    "no budget", "cheap", "lowest bidder", "free trial", "commission only",
    "crypto token", "urgent cheap", "do not apply", "training course",
)


COMMERCIAL_TERMS = (
    "hiring", "job opening", "open role", "role available", "apply",
    "we're hiring", "we are hiring", "is hiring", "internship",
    "junior", "entry level", "new grad", "graduate",
)


_MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12,
}
