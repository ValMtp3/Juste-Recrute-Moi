# Protection du depot

Cette checklist s'applique au depot `ValMtp3/Juste-Recrute-Moi` avant toute ouverture publique serieuse.

## Protection de `main`

Dans les reglages GitHub :

1. Ouvrir `Settings -> Branches`.
2. Ajouter une regle de protection pour `main`.
3. Activer :
   - pull request obligatoire avant merge ;
   - au moins une approbation ;
   - revue Code Owners si le fichier existe ;
   - annulation des approbations quand de nouveaux commits sont pousses ;
   - status checks obligatoires ;
   - branche a jour avant merge ;
   - conversations resolues ;
   - administrateurs inclus ;
   - pas de contournement ;
   - push direct limite aux mainteneurs.

Status checks recommandes :

- `Dependency audit`
- `Frontend`
- `Website`
- `Backend`
- `Rust check`

## Politique de merge

- Preferer le squash merge pour les PR externes.
- Garder les push directs sur `main` pour les correctifs de release urgents.
- Faire les features sur branches courtes.
- Traiter les correctifs de securite en prive tant que la divulgation n'est pas sure.

## Securite des releases

- Garder les permissions GitHub Actions minimales.
- Utiliser les GitHub Environments pour les jobs de publication.
- Demander une approbation mainteneur avant publication de binaires desktop signes.
- Rotation immediate des jetons apres suspicion de fuite.

## Issues de feedback

Les retours du site doivent utiliser ces labels :

- `website-feedback`
- `feedback`
- `review`

Inbox filtree :

```txt
https://github.com/ValMtp3/Juste-Recrute-Moi/issues?q=is%3Aissue%20label%3Awebsite-feedback
```
