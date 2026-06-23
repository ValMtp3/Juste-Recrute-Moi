# Politique de confidentialité

**Date d'effet :** 2026-06-23
**Périmètre :** l'application desktop Juste Recrute Moi, le site public et les pages de téléchargement associées.

> Cette politique décrit le fonctionnement actuel du projet. Elle ne remplace pas un avis juridique professionnel.

---

## 1. Le modèle de confidentialité en bref

Juste Recrute Moi est **local-first** : vos données de profil, vos offres, vos scores, vos documents générés et vos réglages restent sur votre appareil par défaut.

## 2. Données stockées localement

Quand vous utilisez l'application desktop, les données suivantes sont stockées localement et ne sont pas envoyées aux mainteneurs du projet :

| Donnée | Emplacement |
| --- | --- |
| Profil candidat, CV, expériences, compétences, projets | Fichiers locaux et graphe Kuzu local |
| Offres et historique CRM | Base SQLite locale |
| Embeddings de matching | LanceDB local et modèle ONNX local |
| CV, lettres et messages générés | Fichiers locaux |
| Réglages et clés API saisies | Réglages locaux de l'application |
| Activité et logs | Local |

Supprimer l'application et ses données locales supprime ces informations de votre machine. Les mainteneurs n'en possèdent pas de copie.

## 3. Données envoyées à des tiers à votre demande

L'application n'envoie des données hors de votre appareil que lorsqu'une fonctionnalité que vous activez le nécessite :

- **Fournisseurs LLM.** Si vous configurez OpenAI, Anthropic, Gemini, Mistral, un endpoint compatible OpenAI ou un autre fournisseur, les extraits nécessaires du profil et de l'offre peuvent être envoyés à ce fournisseur pour produire un score ou un document. Avec Ollama local, ces données restent sur votre machine.
- **Sources d'offres.** Quand vous scannez des sources, l'application contacte les API, ATS, flux ou jobboards configurés.
- **France Travail.** Si vous configurez les identifiants France Travail, l'application les utilise pour obtenir un jeton OAuth et interroger l'API d'offres.
- **Mises à jour et runtime.** L'application peut télécharger des métadonnées de version ou composants runtime depuis les canaux de release configurés.

Ces traitements sont régis par les politiques des services concernés.

## 4. Site public

Le site public peut traiter un minimum de données techniques pour fonctionner :

- compteurs anonymisés de visites ou téléchargements ;
- données publiques GitHub, par exemple les releases ;
- contenu envoyé volontairement via un formulaire ou une issue.

Ne transmettez pas de clés API, cookies, CV privés, bases locales ou données personnelles sensibles dans les issues, formulaires ou captures publiques.

## 5. Cookies et stockage navigateur

Le site peut utiliser un stockage navigateur limité pour des préférences ou compteurs. Il n'a pas vocation à utiliser de traqueurs publicitaires.

## 6. Bases légales possibles

Selon votre juridiction, les traitements limités du site peuvent reposer sur :

- l'intérêt légitime à exploiter un site de téléchargement et des compteurs agrégés ;
- votre consentement lorsque vous soumettez volontairement un message ;
- l'exécution de votre demande lorsque vous téléchargez une release ou consultez une page.

## 7. Fournisseurs tiers

Selon le déploiement, le site et les releases peuvent s'appuyer sur GitHub, Vercel, Upstash ou des services équivalents. Les fournisseurs d'IA et d'API que vous configurez dans l'application traitent les données selon leurs propres conditions.

## 8. Conservation

- **Données de l'application :** conservées localement jusqu'à suppression par vous.
- **Compteurs du site :** conservés sous forme agrégée ou pseudonymisée tant que les compteurs existent.
- **Retours publics :** conservés dans GitHub ou l'outil utilisé jusqu'à suppression.

## 9. Vos droits

Pour les données locales de l'application, vous pouvez exercer directement vos droits en modifiant ou supprimant les fichiers et réglages sur votre machine. Pour un message public ou une donnée envoyée au site, ouvrez une demande de suppression ou correction dans le dépôt.

## 10. Sécurité

Le projet vise des pratiques raisonnables : HTTPS pour les téléchargements, stockage local par défaut, redaction des secrets dans les logs lorsque possible et consignes de sécurité dans `SECURITY.md`. Aucun système n'est parfaitement sûr ; protégez vos clés API, votre appareil et vos données locales.

## 11. Enfants

Juste Recrute Moi ne s'adresse pas aux enfants de moins de 16 ans et ne collecte pas sciemment leurs données.

## 12. Contact

Pour une question de confidentialité ou de sécurité, ouvrez une issue sur https://github.com/ValMtp3/Juste-Recrute-Moi ou suivez `SECURITY.md` pour les signalements sensibles.

## 13. Changements

Cette politique peut évoluer. La date d'effet sera mise à jour et les changements importants pourront être indiqués dans les notes de release ou le changelog.
