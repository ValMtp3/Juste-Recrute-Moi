from __future__ import annotations
import logging

import re
from pathlib import Path

from llm import call_raw, resolve_config


_DOCS = (
    "README.md",
    "docs/windows-release.md",
    "docs/source-adapters.md",
    "docs/ARCHITECTURE.md",
)

_USER_GUIDE = """
## Guide utilisateur integre

Ton et style de reponse :
- Repondre comme un support pratique integre a l application.
- Preferer des etapes numerotees quand l utilisateur demande comment faire.
- Utiliser les vrais noms de pages et libelles de l application.
- Rester concis pour un panneau de chat, sans oublier les etapes necessaires.
- Si la fonctionnalite n est pas supportee, dire ce qui existe et le parcours le plus proche.
- Ne jamais demander de coller des cles API, CV, cookies, tokens ou bases locales dans le chat.

Premiere configuration :
1. Ouvrez Juste Recrute Moi.
2. Attendez le demarrage du backend local. L ecran de lancement affiche la connexion et le port.
3. Ouvrez Reglages.
4. Dans IA globale, choisissez un fournisseur : Gemini, DeepSeek, NVIDIA, Groq, Grok/xAI, Kimi, Mistral, OpenRouter, Together, Fireworks, Cerebras, Perplexity, Hugging Face, OpenAI, Anthropic, Custom ou Ollama.
5. Pour les fournisseurs cloud, collez la cle API dans le champ du fournisseur.
6. Choisissez un modele propose ou saisissez son identifiant.
7. Utilisez le panneau de verification du fournisseur.
8. Ouvrez Ajouter du contexte ou Profil et ajoutez votre CV/profil avant de vous fier aux scores ou documents generes.
9. Ouvrez Réglages > Sources et découverte, puis ajoutez vos sources.
10. Allez au Tableau de bord et lancez un scan.
11. Relisez les offres, puis generez les documents dans Adapter.

Obtenir une cle API :
- OpenAI: allez sur https://platform.openai.com/api-keys, connectez-vous, creez une cle secrete, copiez-la une seule fois, collez-la ensuite dans Reglages > IA globale apres avoir selectionne OpenAI.
- Gemini: allez sur https://aistudio.google.com/app/apikey, connectez-vous with Google, creez une cle API, collez-la ensuite dans Reglages > IA globale apres avoir selectionne Gemini.
- Groq: allez sur https://console.groq.com/keys, connectez-vous, creez une cle API, collez-la ensuite dans Reglages > IA globale apres avoir selectionne Groq.
- Anthropic: allez sur https://console.anthropic.com/settings/keys, connectez-vous, creez une cle API, collez-la ensuite dans Reglages > IA globale apres avoir selectionne Anthropic.
- DeepSeek: allez sur https://platform.deepseek.com/api_keys, connectez-vous, creez une cle API, collez-la ensuite dans Reglages > IA globale apres avoir selectionne DeepSeek.
- NVIDIA: allez sur https://build.nvidia.com/, connectez-vous, open a model page, use Get API Key, collez-la ensuite dans Reglages > IA globale apres avoir selectionne NVIDIA.
- Grok/xAI: allez sur https://console.x.ai/, creez une cle API, collez-la ensuite dans Reglages > IA globale apres avoir selectionne Grok.
- Kimi/Moonshot: allez sur https://platform.kimi.ai/, creez une cle API, collez-la ensuite dans Reglages > IA globale apres avoir selectionne Kimi.
- Mistral: allez sur https://console.mistral.ai/, creez une cle API, collez-la ensuite dans Reglages > IA globale apres avoir selectionne Mistral.
- OpenRouter: allez sur https://openrouter.ai/keys, creez une cle API, collez-la ensuite dans Reglages > IA globale apres avoir selectionne OpenRouter.
- Together: allez sur https://api.together.ai/settings/api-keys, creez une cle API, collez-la ensuite dans Reglages > IA globale apres avoir selectionne Together.
- Fireworks: allez sur https://fireworks.ai/account/api-keys, creez une cle API, collez-la ensuite dans Reglages > IA globale apres avoir selectionne Fireworks.
- Cerebras: allez sur https://cloud.cerebras.ai/platform, creez une cle API, collez-la ensuite dans Reglages > IA globale apres avoir selectionne Cerebras.
- Perplexity: allez sur https://www.perplexity.ai/settings/api, creez une cle API, collez-la ensuite dans Reglages > IA globale apres avoir selectionne Perplexity.
- Hugging Face: allez sur https://huggingface.co/settings/tokens, create a token, collez-la ensuite dans Reglages > IA globale apres avoir selectionne Hugging Face.
- Custom: choose Custom, paste any OpenAI-compatible API key, set the base URL from your provider, and type the model id.
- Ollama : installez et lancez Ollama localement, telechargez un modele comme llama3 or mistral, conservez l URL http://localhost:11434/v1 in Reglages > IA globale, and select Ollama. Ollama does not use a cloud API key.

Securite des cles API :
- Les cles API sont sensibles. Ne les publiez jamais dans les issues, captures, logs ou chats.
- Juste Recrute Moi stocke les reglages localement pour l instant ; le stockage dans le trousseau systeme est prevu.
- Si une cle fuite, revoquez-la chez le fournisseur et creez-en une nouvelle.
- Si un fournisseur echoue, verifiez la cle, les credits, le modele choisi et l etat du service.

Configuration fournisseur et modele :
- IA globale definit le fournisseur et le modele par defaut des agents.
- La configuration par etape peut remplacer Scout, Evaluator, Generator, Ingestor ou Actuator.
- Laissez un fournisseur vide pour heriter d IA globale.
- Utilisez Scout pour collecter/parser, Evaluator pour analyser l'adéquation, Generator pour CV/lettre/messages, Ingestor pour extraire le contexte profil, et Actuator seulement pour l'automatisation expérimentale.
- Si les documents sont faibles, enrichissez d abord Profil/Ajouter du contexte, puis utilisez un modele Generator plus fort.

Ajouter des sources et liens d offres :
1. Ouvrez Reglages.
2. Allez dans Sources et découverte.
3. Choisissez le marché France pour les sources françaises, ou International pour des sources plus larges.
4. Renseignez éventuellement les postes ou intitulés ciblés pour orienter la recherche.
5. Utilisez les boutons rapides : preset France, preset international, HN Hiring, RemoteOK, Remotive, Jobicy, We Work Remotely, LinkedIn, Indeed et autres sources utiles.
6. Pour ajouter une source personnalisee, collez un jobboard, un ATS, une URL RSS/API ou un domaine into the Add source input.
7. Cliquez sur Ajouter une source.
8. Verifiez la zone Sources cibles / URLs de recherche.
9. Lancez un scan depuis le Tableau de bord.

Jobboards cibles et marches :
- Juste Recrute Moi n est pas limite a la tech. Le preset France vise le marche francais ; Global reste plus large.
- Query generation tailors site: sources using the user's profile, skills, role themes, seniority, and selected market.
- marche Inde keeps India intent in generated searches and avoids broad global-only feeds.

Formats de sources :
- hn-hiring : Hacker News Who is Hiring.
- https://remoteok.com/api, Remotive API, Jobicy API : sources API directes.
- URLs RSS/XML/feed : analysées comme des flux.
- ATS et pages carrière Greenhouse, Lever, Ashby et Workable : privilégier les URLs directes quand c'est possible.
- site:company-careers.test jobs India : cible de recherche large.
- Domaine simple comme company-careers.test : l'app le convertit en cible site: avec termes de poste et de localisation.

Connecteurs personnalises :
- Ouvrez Réglages > Sources et découverte > Connecteurs personnalisés.
- Activez le scan des connecteurs.
- Ajoutez les définitions sous forme de tableau JSON. Chaque connecteur a besoin de name, url, method GET, items_path et d'un mapping fields.
- Placez les headers API privés dans les headers de connecteur, pas dans les définitions. Ils sont traités comme des réglages sensibles.
- Les connecteurs personnalisés servent aux APIs JSON privées/premium, flux internes et fournisseurs payants. Ils sont normalisés en offres puis passent par le même filtre qualité.

Ameliorer la qualite de collecte :
- Préférez les URLs directes d'ATS, API ou pages carrière aux sites génériques.
- Préférez des cibles récentes et précises aux requêtes trop larges.
- Ajoutez poste et localisation dans les cibles site:.
- Utilisez HN Hiring pour les startups, avec une mise en forme parfois irrégulière.
- Les offres pauvres, obsolètes, spammy, trop senior ou sans contexte sont filtrées avant le pipeline.
- Une bonne offre normalisée contient titre, entreprise, URL, plateforme, description, date si visible, score qualité et raison qualité.

Scan :
1. Configurez les sources dans Réglages > Sources et découverte.
2. Ouvrez le tableau de bord.
3. Lancez le scan des sources.
4. Surveillez Activité pour voir les événements de scan et les erreurs.
5. Ouvrez Offres pour relire les résultats acceptés.
6. Si les résultats sont bruyants, resserrez les sources puis relancez nettoyage/scan.

Offres :
- Offres affiche les pistes pertinentes et leurs signaux de qualité/adéquation.
- Ouvrez Détails pour inspecter description, informations extraites, signal et URL source.
- Supprimez les lignes faibles ou hors sujet.
- Qualité décrit la qualité de la source/offre. Match décrit l'adéquation avec le profil utilisateur.

Adapter / generer un dossier :
1. Ouvrez Adapter.
2. Collez une URL d'offre ou la description complète.
3. Cliquez sur Analyser & générer / Générer le CV.
4. Attendez le CV PDF, la lettre PDF et les brouillons de messages.
5. Relisez les aperçus PDF et le texte avant de les utiliser.
6. Si la génération est faible, ajoutez du contexte dans Profil/Ajouter du contexte et utilisez un modèle Generator plus fort.

Profil et ajout de contexte :
- Profil stocke identité, compétences, projets, expériences et liens.
- Ajouter du contexte ingère CV, GitHub, portfolio, notes et compléments de parcours.
- Un meilleur contexte profil améliore classement, choix des projets, CV adapté et lettres.
- Gardez les données personnelles en local et évitez de partager des captures contenant du contenu sensible.

Connaissances :
- Connaissances affiche le graphe local et le contexte vectoriel du profil.
- Si le matching semble générique, ajoutez plus de contexte CV/projets puis réingérez.
- Les données vectorielles et le graphe restent des données locales de l'app.

Pipeline et relances :
- Le pipeline d'offres suit les statuts et les relances.
- Utilisez-le après avoir relu les offres ou généré des dossiers.
- Activité affiche les scans, scores, générations, nettoyages et erreurs.

Automatisation experimentale :
- L'auto-apply expérimental est un laboratoire contributeur, désactivé par défaut et hors workflow cœur supporté.
- Le workflow supporté est : collecter, classer, relire, adapter, puis candidater manuellement.
- Si on demande l'auto-apply, préciser qu'il est expérimental et réservé aux tests.

Installation et alerte de securite Windows :
1. Téléchargez l'installeur depuis les releases GitHub.
2. Lancez le .exe.
3. Si Windows SmartScreen apparaît, cliquez sur Informations complémentaires.
4. Cliquez sur Exécuter quand même.
5. L'installeur inclut l'app desktop et les éléments backend nécessaires pour démarrer sans profil technique. Les fonctions IA nécessitent toujours une clé LLM personnelle ou une configuration Ollama locale.
6. Les notes de release incluent les checksums SHA256 pour vérifier l'intégrité de l'installeur.

Depannage courant :
- Backend bloqué au démarrage : relancez l'app, puis consultez Activité après le démarrage.
- LLM indisponible : vérifiez Réglages > IA globale, fournisseur, clé, modèle, crédits/facturation et connexion internet.
- Aucune offre : ajoutez des sources dans Réglages > Sources et découverte, privilégiez les ATS/APIs directs, puis lancez le scan depuis le tableau de bord.
- Offres faibles : supprimez-les, resserrez les cibles, lancez le nettoyage et privilégiez les pages directes.
- CV/lettre non générés : vérifiez clé API/modèle, collez une description complète d'offre et assurez-vous que Profil/Ajouter du contexte contient des données utiles.
- Aperçu PDF bloqué ou vide : relancez l'app et régénérez ; si le problème persiste, reportez l'erreur d'Activité.
- Auto Apply bloqué : activez l'automatisation expérimentale seulement pour tester le laboratoire ; sinon, candidatez manuellement.
"""

_PROVIDER_GUIDE = """
Ce qu est une cle API :
- Une clé API est un mot de passe/token privé fourni par un fournisseur IA. Juste Recrute Moi l'utilise pour appeler le LLM depuis votre app locale.
- Collez la clé uniquement dans Réglages > IA globale ou dans un champ de configuration par étape. Ne la collez jamais dans un chat, une capture, une issue ou des logs.
- Ollama est l'option locale et ne nécessite pas de clé cloud.

Fournisseurs LLM disponibles dans Juste Recrute Moi :
- Gemini: gemini-2.5-flash, gemini-2.5-pro, gemini-2.0-flash.
- DeepSeek: deepseek-chat, deepseek-reasoner.
- NVIDIA: z-ai/glm-5.1, meta/llama-3.1-70b-instruct, Nemotron/NIM models.
- Groq: llama-3.3-70b-versatile, llama-3.1-8b-instant, openai/gpt-oss-120b.
- Grok/xAI: grok-4, grok-3, grok-3-mini.
- Kimi/Moonshot: kimi-k2-turbo-preview, kimi-k2.5, moonshot-v1-128k.
- Mistral: mistral-large-latest, mistral-medium-latest, mistral-small-latest, ministral-8b-latest.
- OpenRouter : openrouter/auto et de nombreux modèles routés.
- Together: openai/gpt-oss-120b, Llama, DeepSeek, Kimi.
- Fireworks: Llama, Qwen, DeepSeek models.
- Cerebras: llama-3.3-70b, llama3.1-8b, gpt-oss-120b.
- Perplexity: sonar, sonar-pro, sonar-reasoning, sonar-deep-research.
- Hugging Face Router: openai/gpt-oss-120b, Llama, Qwen and other hosted models.
- OpenAI: gpt-4o-mini, gpt-4o, gpt-4-turbo.
- Anthropic: Claude Sonnet, Haiku, Opus.
- Custom : toute URL de base compatible OpenAI et tout id de modèle.
- Ollama : modèles locaux comme llama3, mistral, gemma2, codellama.

Configurer un LLM :
1. Ouvrez Réglages > IA globale.
2. Choisissez le fournisseur voulu.
3. Pour les fournisseurs cloud, créez une clé API sur leur tableau de bord, puis collez-la dans le champ correspondant.
4. Choisissez une puce modèle ou saisissez l'id exact du modèle.
5. Lancez la vérification du fournisseur.
6. Optionnel : utilisez la configuration par étape pour choisir des modèles différents pour Scout, Evaluator, Generator, Ingestor ou l'Actuator expérimental.
7. Si un modèle échoue, vérifiez clé, crédits/facturation, identifiant du modèle, connexion internet et statut du fournisseur.
"""

_SOURCE_GUIDE = """
Ajouter une source et lancer un scan :
1. Ouvrez Réglages > Sources et découverte.
2. Choisissez le marché France pour les sources françaises, ou International pour des sources plus larges.
3. Renseignez éventuellement les postes ou intitulés ciblés pour orienter la recherche.
4. Utilisez les presets rapides France, International, Inde, HN Hiring, RemoteOK, Remotive, Jobicy, We Work Remotely, LinkedIn ou Indeed si besoin.
5. Pour une source personnalisée, collez une page carrière, un ATS, une URL RSS/API, une cible de recherche ou un domaine dans Ajouter.
6. Cliquez sur Ajouter une source.
7. Vérifiez la zone Jobboards / URLs de recherche ciblés.
8. Allez au Tableau de bord et cliquez sur Scanner les sources.
9. Ouvrez Offres pour relire les résultats acceptés.

Pour les APIs JSON privées ou premium :
1. Ouvrez Connecteurs personnalisés dans le même panneau.
2. Activez le scan des connecteurs.
3. Ajoutez une définition JSON avec name, url, items_path et fields.
4. Ajoutez les headers API privés dans Headers des connecteurs.
5. Lancez un scan depuis le tableau de bord ; les résultats passent par le même filtre qualité que les autres offres.

Meilleurs formats de source :
- APIs/RSS directs : RemoteOK API, Remotive API, Jobicy API, We Work Remotely RSS.
- ATS/jobboards : Greenhouse, Lever, Ashby, Workable, LinkedIn, Indeed, Naukri, Foundit, Internshala, Glassdoor, SmartRecruiters et Workday.
- HN Hiring : hn-hiring.
- Cibles de recherche : site:jobs.lever.co France, site:boards.greenhouse.io remote marketing, site:welcometothejungle.com/fr/jobs France.
- Domaine simple : company-careers.test, que l'app convertit en recherche d'offres ciblée.

Pour une meilleure qualité de collecte :
1. Préférez les liens ATS/API/RSS directs aux sites génériques.
2. Ajoutez poste et localisation aux recherches site:.
3. Gardez des sources fraîches et précises.
4. Utilisez le nettoyage si des lignes faibles ou obsolètes passent.
5. Rappelez-vous : qualité = qualité de l'offre ; match = adéquation avec votre profil.
"""

_WORKFLOW_GUIDE = """
Parcours recommande :
1. Ouvrez Réglages > IA globale et configurez Gemini, DeepSeek, NVIDIA, Groq, Grok/xAI, Kimi, Mistral, OpenRouter, Together, Fireworks, Cerebras, Perplexity, Hugging Face, OpenAI, Anthropic, Custom ou Ollama.
2. Ouvrez Profil ou Ajouter du contexte et ajoutez CV, compétences, projets, liens et notes.
3. Ouvrez Réglages > Sources et découverte et ajoutez des presets ou sources personnalisées.
4. Allez au Tableau de bord et cliquez sur Scanner les sources.
5. Ouvrez Offres et relisez les résultats acceptés par le filtre qualité.
6. Ouvrez Adapter sur une offre pertinente, collez l'URL ou la description complète, puis générez CV, lettre et messages.
7. Suivez les offres importantes dans le Pipeline d offres.
"""

_CUSTOMIZE_GUIDE = """
Generer un dossier adapte :
1. Ouvrez d'abord Profil/Ajouter du contexte et vérifiez que CV, compétences, projets et expériences sont présents.
2. Ouvrez Adapter.
3. Collez l'URL de l'offre ou la description complète.
4. Cliquez sur Analyser & générer / Générer le CV.
5. Attendez le CV PDF, la lettre PDF et les brouillons de messages.
6. Relisez tout avant envoi.
7. Si le résultat est faible, ajoutez du contexte projet/profil et utilisez un modèle Generator plus fort dans Réglages.
"""


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _read_doc(path: str, limit: int = 9000) -> str:
    file = _repo_root() / path
    try:
        text = file.read_text(encoding="utf-8", errors="ignore")
    except Exception as log_exc:
        logging.getLogger(__name__).warning('suppressed exception in backend/help/service.py:_read_doc: %s', log_exc)
        return ""
    return f"\n\n## {path}\n{text[:limit]}"


def _knowledge() -> str:
    docs = "".join(_read_doc(path) for path in _DOCS)
    product_brief = """
## Product brief
Juste Recrute Moi est une application desktop Tauri local-first pour agreger, filtrer et classer des offres d emploi.
The frontend is React/TypeScript. The backend is a local FastAPI sidecar.
Parcours principaux : import profile/resume, scrape job leads, quality-gate noisy rows,
rank fit, review leads, generate tailored resume PDF, cover letter PDF, and
outreach drafts. Les donnees restent locales par defaut.

Pages principales :
- Tableau de bord : centre de commande, scans, activité et aperçu du pipeline.
- Adapter : coller une URL ou description d'offre et générer le dossier de candidature.
- Offres : relire les pistes pertinentes.
- Pipeline d'offres : suivre les statuts et relances.
- Connaissances : graphe profil et contexte vectoriel local.
- Activité : journal des scans, scores, générations et erreurs.
- Profil : identité candidat, compétences, projets, expériences et liens.
- Ajouter du contexte : ingérer CV, GitHub, portfolio, notes et compléments de profil.
- Réglages : fournisseur IA, clés API, sources de découverte et laboratoire d'automatisation.

Comportements importants :
- L'automatisation navigateur et l'auto-apply sont expérimentaux et opt-in.
- Les clés API sont stockées dans les réglages locaux pour l'instant ; le trousseau système est prévu.
- L'app utilise le fournisseur et modèle IA configurés quand un agent backend appelle llm.call_raw/call_llm.
- Si un modèle ou une clé manque, certains agents utilisent des fallbacks déterministes et doivent expliquer cette limite.
"""
    return product_brief + _USER_GUIDE + docs


def _words(question: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", question.lower()))


def _topic(question: str) -> str:
    w = _words(question)
    q = question.lower()
    if {"api", "key"} & w or "llm" in w or "model" in w or "provider" in w or "available" in w:
        return "providers"
    if "scrap" in q or "source" in w or "sources" in w or "job board" in q or "crawl" in q:
        return "sources"
    if "resume" in w or "cover" in w or "customize" in w or "package" in w or "generate" in w:
        return "customize"
    if "start" in w or "setup" in w or "first" in w or ("what" in w and "do" in w):
        return "workflow"
    if "auto" in w and "apply" in w:
        return "auto_apply"
    if "install" in w or "download" in w or "exe" in w or "windows" in w:
        return "install"
    return "general"


def _focused_knowledge(question: str) -> str:
    topic = _topic(question)
    brief = """
Juste Recrute Moi est une application desktop Tauri local-first. Les pages principales sont Tableau de bord,
Adapter, Offres, Pipeline d offres, Graphe, Activite, Profil, Ajouter du contexte et Reglages.
Flux principal : configurer l IA, enrichir le profil, ajouter des sources, scanner, relire les offres,
generer CV, lettre et messages, puis suivre les candidatures.
"""
    chunks = {
        "providers": _PROVIDER_GUIDE + "\n" + _USER_GUIDE[_USER_GUIDE.find("Obtenir une cle API :"):_USER_GUIDE.find("Ajouter des sources et liens d offres :")],
        "sources": _SOURCE_GUIDE,
        "customize": _CUSTOMIZE_GUIDE,
        "workflow": _WORKFLOW_GUIDE,
        "auto_apply": "L auto-apply est un laboratoire contributeur. Il est desactive par defaut et n est pas le flux normal. Le parcours supporte consiste a collecter les offres, les scorer, les relire, generer les documents, puis candidater manuellement.",
        "install": _USER_GUIDE[_USER_GUIDE.find("Installation et alerte de securite Windows :"):_USER_GUIDE.find("Depannage courant :")],
        "general": _WORKFLOW_GUIDE + "\n" + _SOURCE_GUIDE + "\n" + _CUSTOMIZE_GUIDE,
    }
    return (brief + "\n" + chunks.get(topic, chunks["general"]))[:5500]


def _steps(title: str, items: list[str]) -> str:
    lines = [title]
    for i, item in enumerate(items, 1):
        lines.append(f"{i}. {item}")
    return "\n".join(lines)


def _fallback(question: str) -> str:
    q = question.lower()
    topic = _topic(question)
    if topic == "providers":
        return (
            "Une clé API est le jeton privé fourni par votre fournisseur IA. Juste Recrute Moi l'utilise depuis votre app locale pour appeler le modèle choisi. "
            "Ne collez jamais de clé dans le chat, une capture ou une issue.\n\n"
            "Fournisseurs LLM disponibles :\n"
            "1. Gemini: gemini-2.5-flash, gemini-2.5-pro, gemini-2.0-flash.\n"
            "2. DeepSeek: deepseek-chat, deepseek-reasoner.\n"
            "3. NVIDIA: z-ai/glm-5.1, Llama/Nemotron NIM models.\n"
            "4. Groq: llama-3.3-70b-versatile, llama-3.1-8b-instant, gpt-oss.\n"
            "5. Grok/xAI: grok-4, grok-3, grok-3-mini.\n"
            "6. Kimi/Moonshot: kimi-k2, kimi-k2.5, moonshot-v1.\n"
            "7. Mistral, OpenRouter, Together, Fireworks, Cerebras, Perplexity, Hugging Face Router.\n"
            "8. OpenAI et Anthropic.\n"
            "9. Fournisseur personnalisé compatible OpenAI.\n"
            "10. Ollama pour les modèles locaux, sans clé cloud.\n\n"
            "Pour ajouter une clé :\n"
            "1. Ouvrez le tableau de bord du fournisseur.\n"
            "2. Créez une clé API et copiez-la une seule fois.\n"
            "3. Dans Juste Recrute Moi, ouvrez Réglages > IA globale.\n"
            "4. Sélectionnez le même fournisseur.\n"
            "5. Collez la clé dans le champ prévu pour ce fournisseur.\n"
            "6. Choisissez un modèle proposé ou saisissez son identifiant.\n"
            "7. Lancez la vérification. En cas d'échec, vérifiez la clé, les crédits, le modèle, la connexion et l'état du fournisseur."
        )
    if topic == "sources":
        return _steps("Ajouter une source et lancer un scan :", [
            "Ouvrez Réglages > Sources et découverte.",
            "Utilisez les raccourcis France, International, HN Hiring, RemoteOK, Remotive, Jobicy ou We Work Remotely si besoin.",
            "Pour une source personnalisée, collez une page carrière, un ATS, une URL RSS/API ou un domaine dans Ajouter une source.",
            "Cliquez sur Ajouter une source et vérifiez la zone Sources cibles / URLs de recherche.",
            "Allez au Tableau de bord et lancez un scan.",
            "Ouvrez Offres pour relire les résultats acceptés. Les lignes pauvres, obsolètes, spammy ou trop senior sont filtrées par le filtre qualité.",
        ])
    if "link" in q or "url" in q:
        return _steps("Ajouter un lien d'offre :", [
            "Pour une seule offre, ouvrez Adapter et collez l'URL ou la description complète.",
            "Cliquez sur Analyser & générer pour créer le dossier adapté.",
            "Pour une collecte récurrente, ouvrez Réglages > Sources et découverte.",
            "Collez le site, l'ATS, l'URL RSS/API ou le domaine dans Ajouter une source.",
            "Cliquez sur Ajouter une source, puis lancez un scan depuis le Tableau de bord.",
        ])
    if topic == "customize":
        return _steps("Générer un CV et une lettre adaptés :", [
            "Ouvrez d'abord Profil ou Ajouter du contexte et vérifiez que CV, compétences, projets et expériences sont présents.",
            "Ouvrez Adapter.",
            "Collez l'URL de l'offre ou sa description complète.",
            "Cliquez sur Analyser & générer.",
            "Relisez le CV PDF, la lettre PDF et les messages d'approche avant tout envoi.",
            "Si le résultat est faible, enrichissez le profil et utilisez un modèle Generator plus fort dans Réglages.",
        ])
    if topic == "workflow":
        return _steps("Configuration recommandée :", [
            "Ouvrez Réglages > IA globale et configurez un fournisseur ou Ollama.",
            "Ouvrez Profil ou Ajouter du contexte et ajoutez votre CV, vos compétences, projets, liens et notes.",
            "Ouvrez Réglages > Sources et découverte et ajoutez des sources prédéfinies ou personnalisées.",
            "Lancez un scan depuis le Tableau de bord.",
            "Relisez les offres acceptées.",
            "Utilisez Adapter pour générer CV, lettre et messages pour une offre pertinente.",
        ])
    return _steps("Ce que Juste Recrute Moi permet de faire :", [
        "Le Tableau de bord lance les scans et affiche l'état de travail.",
        "Réglages configure les fournisseurs LLM, clés API, modèles et sources.",
        "Profil et Ajouter du contexte stockent vos données candidat localement.",
        "Offres permet de relire les résultats passés par le filtre qualité.",
        "Adapter génère un CV PDF, une lettre PDF et des messages d'approche.",
        "Le Pipeline d'offres suit les statuts et les relances.",
    ])


def answer(question: str, history: list[dict] | None = None) -> dict:
    question = str(question or "").strip()
    provider, _key, model = resolve_config("help")
    if not question:
        return {"answer": "Posez-moi une question sur l utilisation de Juste Recrute Moi.", "provider": provider, "model": model}

    recent = []
    for item in (history or [])[-8:]:
        role = str(item.get("role") or "")[:20]
        content = str(item.get("content") or "")[:1000]
        if role and content:
            recent.append(f"{role}: {content}")

    topic = _topic(question)
    if topic in {"providers", "sources", "customize", "workflow"}:
        return {"answer": _fallback(question), "provider": provider, "model": model, "source": "guide"}

    system = (
        "<role>\n"
        "Tu es l assistant d aide integre de Juste Recrute Moi. Tu reponds en francais dans le "
        "panneau de chat de l application desktop. Juste Recrute Moi est un outil local-first de recherche "
        "d emploi : l utilisateur importe son profil, collecte des offres, filtre leur qualite, score la "
        "pertinence, puis genere un CV PDF, une lettre PDF et des messages adaptes.\n"
        "</role>\n\n"
        "<goal>\n"
        "Debloque l utilisateur avec la reponse correcte la plus courte. Pour une question de type "
        "'comment faire', donne les noms exacts des pages et des etapes numerotees. Pour une question "
        "de definition ou de capacite, donne une reponse directe. Commence par la reponse, pas par une "
        "reformulation de la question.\n"
        "</goal>\n\n"
        "<grounding>\n"
        "La connaissance produit ci-dessous est ta seule source de verite sur l application. Regles :\n"
        "- Si la connaissance couvre la question, reponds avec les vrais noms de pages et libelles.\n"
        "- Si une fonction, un reglage ou un fait n y apparait pas, n affirme pas son existence. Explique "
        "ce que l app supporte et le flux le plus proche, ou pose une seule question courte.\n"
        "- En cas d incertitude, nuance clairement au lieu d affirmer. N invente jamais de fonctions, menus, reglages ou etapes.\n"
        "- Presente l automatisation experimentale comme experimentale et opt-in.\n"
        "- Mentionne le fonctionnement local-first pour les questions de confidentialite ou de localisation des donnees.\n"
        "- N ajoute une etape prealable que si elle est vraiment requise, par exemple configurer un fournisseur LLM avant la generation IA.\n"
        "</grounding>\n\n"
        "<safety>\n"
        "Ne demande jamais a l utilisateur de coller dans le chat des cles API privees, cookies, bearer tokens, CV ou bases locales.\n"
        "</safety>\n\n"
        "<style>\n"
        "Concis pour un panneau de chat : environ 12 lignes courtes maximum, sans preambule, sans remplissage, "
        "sans narration du raisonnement. Utilise une liste numerotee pour les etapes ; sinon, quelques phrases courtes.\n"
        "</style>"
    )
    prompt = (
        f"Focused product knowledge:\n{_focused_knowledge(question)}\n\n"
        f"Recent chat:\n{chr(10).join(recent) or '(none)'}\n\n"
        f"User question: {question}"
    )

    try:
        response = call_raw(system, prompt, step="help").strip()
    except Exception as exc:
        logging.getLogger(__name__).warning('suppressed exception in backend/help/service.py:answer: %s', exc)
        response = ""
        provider = f"{provider} unavailable"
        model = str(exc)[:120]
    if not response:
        response = _fallback(question)
    return {"answer": response[:4000], "provider": provider, "model": model}
