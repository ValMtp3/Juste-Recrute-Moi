# Contrat Des Connecteurs De Sources

Un connecteur transforme une source externe d'offres d'emploi en dictionnaires de leads normalisés. Un bon connecteur doit être prévisible, déterministe et simple à tester.

## Champs Normalisés

Champs requis :

- `title` : intitulé du poste ;
- `company` : entreprise ou propriétaire de la source ;
- `url` : URL canonique de l'offre ou de candidature ;
- `platform` : identifiant stable de source, par exemple `france_travail`, `greenhouse`, `lever` ;
- `description` : texte utile pour le scoring et la génération.

Champs recommandés :

- `posted_date` : date visible de publication si disponible ;
- `location` : lieu, remote ou hybride ;
- `tech_stack` : technologies détectées ;
- `signal_score` : score de qualité source ;
- `signal_reason` : explication courte du signal ;
- `signal_tags` : tags source ;
- `source_meta` : métadonnées propres à la source.

## Filtre Qualité

Avant sauvegarde, les offres doivent passer par la quality gate. Elle rejette ou dégrade notamment :

- les offres sans URL ;
- les lignes trop pauvres ;
- les offres obsolètes ;
- les offres trop senior pour un flux orienté débutant ;
- les annonces spammy, non rémunérées ou peu fiables ;
- les offres sans entreprise ou contexte clair.

Les leads sauvegardés doivent conserver `source_meta.lead_quality_score` et `source_meta.lead_quality_reason` pour expliquer pourquoi l'offre a été affichée.

## Ajouter Une Source

- [ ] Le connecteur renvoie les champs normalisés.
- [ ] Les URLs sont canonisées et déduplicables.
- [ ] Les dates sont parsées ou conservées proprement.
- [ ] Les tests de base ne nécessitent pas d'identifiants privés.
- [ ] Au moins une fixture valide passe.
- [ ] Au moins une fixture bruitée est filtrée.
- [ ] La documentation explique comment activer la source.

Privilégiez les API ATS ou pages carrière directes. Utilisez les recherches larges seulement comme solution de secours.
