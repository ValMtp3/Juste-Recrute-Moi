# Politique De Sécurité

Juste Recrute Moi est local-first, mais manipule des données sensibles : CV, historique d'offres, clés API, graphe de profil, documents générés et bases locales.

## Signalement

N'ouvrez pas d'issue publique contenant des secrets, CV privés, dumps de bases locales ou clés API. Ouvrez une issue minimale décrivant la catégorie du problème, puis indiquez que les détails sensibles doivent être transmis en privé.

## Clés API

En v1, les clés API sont stockées dans les réglages locaux de l'application. Traitez le dossier de données local comme sensible. Le stockage dans le trousseau système est une amélioration prévue.

## Rapports Publics Acceptables

Un bon rapport public peut inclure :

- un motif d'URL source sans identifiants privés ;
- des extraits d'offres anonymisés ;
- le score attendu et le score obtenu ;
- des étapes de reproduction avec fausses clés ou fournisseur local.

## À Ne Pas Publier

- vraies clés API ;
- cookies ou bearer tokens ;
- CV complets avec coordonnées ;
- fichiers SQLite, Kuzu ou LanceDB locaux ;
- captures montrant des secrets.
