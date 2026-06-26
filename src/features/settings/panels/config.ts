export interface Cfg {
  llm_provider: string;
  embedding_provider: string; embedding_openai_api_key: string;
  anthropic_key: string; anthropic_model: string; openai_api_key: string; openai_model: string;
  deepseek_api_key: string; deepseek_model: string; gemini_api_key: string; gemini_model: string;
  groq_api_key: string; groq_model: string; nvidia_api_key: string;
  nvidia_model: string; xai_api_key: string; xai_model: string; kimi_api_key: string; kimi_model: string;
  mistral_api_key: string; mistral_model: string; openrouter_api_key: string; openrouter_model: string;
  together_api_key: string; together_model: string; fireworks_api_key: string; fireworks_model: string;
  cerebras_api_key: string; cerebras_model: string; perplexity_api_key: string; perplexity_model: string;
  huggingface_api_key: string; huggingface_model: string; cohere_api_key: string; cohere_model: string;
  sambanova_api_key: string; sambanova_model: string; qwen_api_key: string; qwen_model: string;
  azure_openai_api_key: string; azure_model: string; azure_openai_endpoint: string;
  custom_api_key: string; custom_model: string; custom_base_url: string;
  ollama_url: string;
  claude_cli_model: string; codex_cli_model: string; gemini_cli_model: string; copilot_cli_model: string;
  scout_provider: string;     scout_api_key: string;     scout_model: string;
  evaluator_provider: string; evaluator_api_key: string; evaluator_model: string;
  generator_provider: string; generator_api_key: string; generator_model: string;
  ingestor_provider: string;  ingestor_api_key: string;  ingestor_model: string;
  actuator_provider: string;  actuator_api_key: string;  actuator_model: string;
  apify_token: string; apify_actor: string; linkedin_cookie: string; france_travail_client_id: string; france_travail_client_secret: string; x_bearer_token: string; x_search_queries: string; x_watchlist: string;
  hunter_api_key: string; proxycurl_api_key: string; contact_lookup_enabled: string;
  x_max_requests_per_scan: string; x_max_results_per_query: string; x_min_signal_score: string; x_hot_lead_threshold: string; x_enable_notifications: string;
  free_sources_enabled: string; free_source_targets: string; company_watchlist: string; free_source_max_requests: string; free_source_min_signal_score: string;
  custom_connectors_enabled: string; custom_connectors: string; custom_connector_headers: string;
  desired_position: string; onboarding_target_role: string; job_boards: string; job_market_focus: string;
  browser_scan_enabled: string; browser_scan_concurrency: string; browser_scan_max_targets: string; llm_scan_mode: string;
  ghost_mode: string; auto_apply: string; headed_browser: string;
}

export const EMPTY: Cfg = {
  llm_provider: "ollama",
  embedding_provider: "onnx", embedding_openai_api_key: "",
  anthropic_key: "", anthropic_model: "claude-sonnet-4-6", openai_api_key: "", openai_model: "gpt-4o-mini",
  deepseek_api_key: "", deepseek_model: "deepseek-chat", gemini_api_key: "", gemini_model: "gemini-2.5-flash",
  groq_api_key: "", groq_model: "llama-3.3-70b-versatile", nvidia_api_key: "",
  nvidia_model: "z-ai/glm-5.1", xai_api_key: "", xai_model: "grok-4", kimi_api_key: "", kimi_model: "kimi-k2.6",
  mistral_api_key: "", mistral_model: "mistral-large-latest", openrouter_api_key: "", openrouter_model: "openrouter/auto",
  together_api_key: "", together_model: "openai/gpt-oss-120b", fireworks_api_key: "", fireworks_model: "accounts/fireworks/models/llama-v3p1-70b-instruct",
  cerebras_api_key: "", cerebras_model: "llama-3.3-70b", perplexity_api_key: "", perplexity_model: "sonar",
  huggingface_api_key: "", huggingface_model: "openai/gpt-oss-120b", cohere_api_key: "", cohere_model: "command-a-03-2025",
  sambanova_api_key: "", sambanova_model: "Meta-Llama-3.3-70B-Instruct", qwen_api_key: "", qwen_model: "qwen-plus",
  azure_openai_api_key: "", azure_model: "gpt-4o-mini", azure_openai_endpoint: "",
  custom_api_key: "", custom_model: "model-id", custom_base_url: "https://api.openai.com/v1",
  ollama_url: "http://localhost:11434/v1",
  claude_cli_model: "claude-sonnet-4-6", codex_cli_model: "", gemini_cli_model: "", copilot_cli_model: "",
  scout_provider: "", scout_api_key: "", scout_model: "",
  evaluator_provider: "", evaluator_api_key: "", evaluator_model: "",
  generator_provider: "", generator_api_key: "", generator_model: "",
  ingestor_provider: "", ingestor_api_key: "", ingestor_model: "",
  actuator_provider: "", actuator_api_key: "", actuator_model: "",
  apify_token: "", apify_actor: "", linkedin_cookie: "", france_travail_client_id: "", france_travail_client_secret: "", x_bearer_token: "", x_search_queries: "", x_watchlist: "",
  hunter_api_key: "", proxycurl_api_key: "", contact_lookup_enabled: "true",
  x_max_requests_per_scan: "5", x_max_results_per_query: "50", x_min_signal_score: "60", x_hot_lead_threshold: "80", x_enable_notifications: "false",
  free_sources_enabled: "true", free_source_targets: "", company_watchlist: "", free_source_max_requests: "20", free_source_min_signal_score: "60",
  custom_connectors_enabled: "false", custom_connectors: "", custom_connector_headers: "",
  desired_position: "", onboarding_target_role: "", job_boards: "", job_market_focus: "france",
  browser_scan_enabled: "true", browser_scan_concurrency: "4", browser_scan_max_targets: "32", llm_scan_mode: "balanced",
  ghost_mode: "false", auto_apply: "false", headed_browser: "false",
};

export const PROVIDERS = [
  { id: "claude_cli", label: "Claude · abo", tone: "purple", sub: "Votre offre" },
  { id: "codex_cli",  label: "Codex · abo",  tone: "blue",   sub: "Votre offre" },
  { id: "gemini_cli", label: "Gemini · abo", tone: "orange", sub: "Votre offre" },
  { id: "copilot_cli", label: "Copilot · abo", tone: "green", sub: "Votre offre" },
  { id: "gemini",    label: "Gemini",    tone: "green",  sub: "2.5 Flash" },
  { id: "deepseek",  label: "DeepSeek",  tone: "teal",   sub: "V3 / R1"   },
  { id: "nvidia",    label: "NVIDIA",    tone: "green",  sub: "GLM / NIM" },
  { id: "groq",      label: "Groq",      tone: "orange", sub: "Llama 3.3" },
  { id: "xai",       label: "Grok",      tone: "blue",   sub: "xAI"       },
  { id: "kimi",      label: "Kimi",      tone: "purple", sub: "Moonshot"  },
  { id: "mistral",   label: "Mistral",   tone: "orange", sub: "Large"     },
  { id: "openrouter", label: "OpenRouter", tone: "teal", sub: "Multi"     },
  { id: "together",  label: "Together",  tone: "pink",   sub: "OSS"       },
  { id: "fireworks", label: "Fireworks", tone: "yellow", sub: "OSS rapide" },
  { id: "cerebras",  label: "Cerebras",  tone: "green",  sub: "Rapide"    },
  { id: "perplexity", label: "Perplexity", tone: "blue", sub: "Recherche" },
  { id: "huggingface", label: "HuggingFace", tone: "yellow", sub: "Router" },
  { id: "cohere",   label: "Cohere",   tone: "green",  sub: "Command"   },
  { id: "sambanova", label: "SambaNova", tone: "orange", sub: "Cloud"    },
  { id: "qwen",     label: "Qwen",      tone: "teal",   sub: "DashScope" },
  { id: "azure",    label: "Azure",     tone: "blue",   sub: "OpenAI"    },
  { id: "openai",    label: "OpenAI",    tone: "blue",   sub: "GPT-4o"    },
  { id: "anthropic", label: "Anthropic", tone: "purple", sub: "Claude"    },
  { id: "custom",    label: "Custom",    tone: "pink",   sub: "API OpenAI" },
  { id: "ollama",    label: "Ollama",    tone: "pink",   sub: "Local"     },
];

export const SUBSCRIPTION_PROVIDERS = new Set(["claude_cli", "codex_cli", "gemini_cli", "copilot_cli"]);
export const isSubscriptionProvider = (id: string) => SUBSCRIPTION_PROVIDERS.has(id);

export const MODEL_HINTS: Record<string, string[]> = {
  gemini:    ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
  deepseek:  ["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-chat", "deepseek-reasoner"],
  nvidia:    ["z-ai/glm-5.1", "nvidia/llama-3.3-nemotron-super-49b-v1", "meta/llama-3.1-70b-instruct", "openai/gpt-oss-120b"],
  groq:      ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  xai:       ["grok-4", "grok-3", "grok-3-mini"],
  kimi:      ["kimi-k2.6", "kimi-k2.5", "kimi-k2-thinking", "kimi-k2-turbo-preview", "moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
  mistral:   ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest", "ministral-8b-latest"],
  openrouter: ["openrouter/auto", "anthropic/claude-sonnet-4.5", "google/gemini-2.5-pro", "moonshotai/kimi-k2"],
  together:  ["openai/gpt-oss-120b", "meta-llama/Llama-3.3-70B-Instruct-Turbo", "deepseek-ai/DeepSeek-V3.1", "moonshotai/Kimi-K2-Instruct"],
  fireworks: ["accounts/fireworks/models/llama-v3p1-70b-instruct", "accounts/fireworks/models/qwen2p5-72b-instruct", "accounts/fireworks/models/deepseek-v3"],
  cerebras:  ["llama-3.3-70b", "llama3.1-8b", "gpt-oss-120b"],
  perplexity: ["sonar", "sonar-pro", "sonar-reasoning", "sonar-deep-research"],
  huggingface: ["openai/gpt-oss-120b", "meta-llama/Llama-3.1-8B-Instruct", "Qwen/Qwen2.5-72B-Instruct"],
  cohere:    ["command-a-03-2025", "command-r-plus-08-2024", "command-r-08-2024"],
  sambanova: ["Meta-Llama-3.3-70B-Instruct", "DeepSeek-R1", "Qwen3-32B"],
  qwen:      ["qwen-plus", "qwen-max", "qwen-turbo", "qwen3-coder-plus"],
  azure:     ["gpt-4o-mini", "gpt-4o", "gpt-4.1", "deployment-name"],
  openai:    ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.2", "gpt-4o-mini", "gpt-4o"],
  anthropic: ["claude-opus-4-8", "claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5-20251001"],
  custom:    ["model-id", "provider/model", "chat-model"],
  ollama:    ["llama3", "mistral", "gemma2", "codellama"],
  claude_cli: ["claude-sonnet-4-6", "claude-opus-4-8", "claude-opus-4-7", "claude-haiku-4-5-20251001"],
  codex_cli:  ["", "gpt-5.5"],
  gemini_cli: ["", "gemini-2.5-pro", "gemini-2.5-flash"],
  copilot_cli: ["", "claude-sonnet-4.5", "gpt-5.3-codex", "claude-haiku-4.5"],
};

export const STEPS = [
  { id: "scout",     label: "Recherche",   icon: "search", tone: "blue",
    desc: "Repère les offres ; un modèle rapide et économique suffit souvent." },
  { id: "evaluator", label: "Évaluation",  icon: "pulse",  tone: "purple",
    desc: "Score l'adéquation ; un modèle de raisonnement améliore les décisions." },
  { id: "generator", label: "Génération",  icon: "file",   tone: "orange",
    desc: "Rédige les CV, lettres et messages adaptés ; privilégiez la qualité." },
  { id: "ingestor",  label: "Import",      icon: "upload", tone: "green",
    desc: "Analyse votre CV et l'ajoute au graphe de connaissances." },
  { id: "actuator",  label: "Actuateur expérimental",  icon: "ghost",  tone: "pink",
    desc: "Laboratoire d'automatisation navigateur, séparé du flux OSS principal." },
];
export type StepConfig = (typeof STEPS)[number];

export const GLOBAL_SOURCE_PRESET = [
  "hn-hiring,",
  "https://remoteok.com/api,",
  "https://remotive.com/api/remote-jobs,",
  "https://jobicy.com/api/v2/remote-jobs?count=50,",
  "https://jobicy.com/feed/newjobs,",
  "https://weworkremotely.com/remote-jobs.rss,",
  "site:boards.greenhouse.io,",
  "site:jobs.lever.co,",
  "site:jobs.ashbyhq.com,",
  "site:apply.workable.com,",
  "site:wellfound.com/jobs,",
  "site:linkedin.com/jobs,",
  "site:indeed.com/jobs,",
  "site:glassdoor.com/Job,",
  "site:jobs.smartrecruiters.com,",
  "site:workdayjobs.com,",
  "site:naukri.com,",
  "site:instahyre.com,",
  "site:cutshort.io/jobs,",
].join("\n");

export const INDIA_SOURCE_PRESET = [
  "site:wellfound.com/jobs India,",
  "site:cutshort.io/jobs India startup,",
  "site:instahyre.com jobs India,",
  "site:naukri.com jobs India,",
  "site:foundit.in jobs India,",
  "site:internshala.com/jobs India,",
  "site:linkedin.com/jobs India,",
  "site:indeed.com/jobs India,",
  "site:glassdoor.co.in Job India,",
  "site:boards.greenhouse.io India,",
  "site:jobs.lever.co India,",
  "site:jobs.ashbyhq.com India,",
  "site:apply.workable.com India,",
].join("\n");

export const FRANCE_SOURCE_PRESET = [
  "france_travail:developpeur;lieu=France;range=0-49,",
  "https://remotive.com/api/remote-jobs,",
  "https://jobicy.com/api/v2/remote-jobs?count=50,",
  "https://weworkremotely.com/remote-jobs.rss,",
  "site:welcometothejungle.com/fr/jobs France,",
  "site:hellowork.com/fr-fr/emplois France,",
  "site:apec.fr/candidat/recherche-emploi.html/emploi France,",
  "site:cadremploi.fr/emploi France,",
  "site:meteojob.com/jobs France,",
  "site:lesjeudis.com/jobs France,",
  "site:linkedin.com/jobs France,",
  "site:fr.indeed.com/emplois France,",
  "site:jobs.smartrecruiters.com France,",
  "site:teamtailor.com/jobs France,",
  "site:boards.greenhouse.io France,",
  "site:jobs.lever.co France,",
  "site:jobs.ashbyhq.com France,",
  "site:apply.workable.com France,",
].join("\n");

export const KEY_FIELD: Record<string, keyof Cfg> = {
  anthropic: "anthropic_key", gemini: "gemini_api_key", groq: "groq_api_key",
  nvidia: "nvidia_api_key", openai: "openai_api_key", deepseek: "deepseek_api_key",
  xai: "xai_api_key", kimi: "kimi_api_key", mistral: "mistral_api_key",
  openrouter: "openrouter_api_key", together: "together_api_key", fireworks: "fireworks_api_key",
  cerebras: "cerebras_api_key", perplexity: "perplexity_api_key", huggingface: "huggingface_api_key",
  cohere: "cohere_api_key", sambanova: "sambanova_api_key", qwen: "qwen_api_key", azure: "azure_openai_api_key",
  custom: "custom_api_key",
};

export const GLOBAL_MODEL_FIELD: Record<string, keyof Cfg> = {
  anthropic: "anthropic_model",
  deepseek: "deepseek_model",
  gemini: "gemini_model",
  groq: "groq_model",
  nvidia: "nvidia_model",
  openai: "openai_model",
  xai: "xai_model",
  kimi: "kimi_model",
  mistral: "mistral_model",
  openrouter: "openrouter_model",
  together: "together_model",
  fireworks: "fireworks_model",
  cerebras: "cerebras_model",
  perplexity: "perplexity_model",
  huggingface: "huggingface_model",
  cohere: "cohere_model",
  sambanova: "sambanova_model",
  qwen: "qwen_model",
  azure: "azure_model",
  custom: "custom_model",
  claude_cli: "claude_cli_model",
  codex_cli: "codex_cli_model",
  gemini_cli: "gemini_cli_model",
  copilot_cli: "copilot_cli_model",
};

const SECRET_MASK = "__JHM_SECRET_SET__";
const LEGACY_BULLET_MASK = "\u2022".repeat(20);
const LEGACY_MOJIBAKE_BULLET_MASK = "\u00e2\u20ac\u00a2".repeat(20);
const LEGACY_DOUBLE_ENCODED_BULLET_MASK = "\u00c3\u00a2\u00e2\u201a\u00ac\u00c2\u00a2".repeat(20);

export const SECRET_MASKS = new Set([
  SECRET_MASK,
  LEGACY_BULLET_MASK,
  LEGACY_MOJIBAKE_BULLET_MASK,
  LEGACY_DOUBLE_ENCODED_BULLET_MASK,
]);

export type CatalogRow = {
  id: string; name?: string; release_date?: string; reasoning?: boolean;
  context?: number | null; input?: number | null; output?: number | null;
};

export interface SubStatus {
  installed: boolean;
  logged_in: boolean;
  email?: string | null;
  plan?: string | null;
  install_hint?: { name: string; cmd: string; url: string; after?: string };
}
