# Architecture

Ce document décrit comment `pronote-digest` est construit, pourquoi, et où brancher une extension.

## Vue d'ensemble

```
flux iCal Pronote ──► Source ──► événements typés
                                    │
                                    ▼
                    calendrier ─► buildDigest ─► Digest (JSON)
                                    │
                        IntroProvider (optionnel) ─► intro
                                    │
                                    ▼
                             Formatters (HTML mail, Markdown, texte)
                                    │
                                    ▼
                          Channels (email, file, …) ─► livraison
```

Le **`Digest`** est le seul contrat partagé. Il est validé par un schéma zod (`src/core/model.ts`),
sérialisable en JSON, et c'est exactement ce qui est archivé. Sources, formateurs, canaux et fournisseur
d'intro ne se connaissent pas entre eux.

## Modules

| Module | Rôle |
|---|---|
| `src/sources/pronote/fetch.ts` | Télécharge un flux (HTTP ou `file://`), sans jamais divulguer le jeton dans les erreurs. |
| `src/sources/pronote/parse.ts` | ICS → cours, périodes, blocs de cahier de textes. S'ancre sur les libellés générés par Pronote. |
| `src/core/calendar.ts` | Prochain jour de classe à partir des cours présents dans le flux. |
| `src/core/homework.ts` | Devoirs dus un jour donné, dédoublonnés. |
| `src/core/digest.ts` | Assemble le `Digest` du jour visé pour chaque enfant. |
| `src/core/archive.ts` | Lecture et écriture de l'archive (`<dir>/<date visée>/<type>.{json,html,md}`). |
| `src/core/run.ts` | Le pipeline complet, injectable pour les tests. |
| `src/formatters/` | Modèle de présentation (`view.ts`), mail MJML (`index.ts`), Markdown (`markdown.ts`). |
| `src/channels/` | Interface `Channel`, implémentations `email` et `file`, registre. |
| `src/intro/` | Interface `IntroProvider`, implémentation IA multi-fournisseurs, chargée à la demande. |
| `src/config.ts` | Validation de la configuration (variables d'environnement ou entrées de l'action). |
| `src/cli/main.ts`, `src/action/main.ts` | Points d'entrée. Même configuration, même pipeline. |

## Ce que le flux Pronote contient vraiment

Observé sur des exports réels (Pronote 2026) :

- Chaque cours est un `VEVENT` avec une description structurée par Pronote : `Matière :`, `Professeur(s) :`,
  `Salle(s) :`, `Groupe :`, `Partie(s) de classe :`, puis des sections en gras `Contenu pédagogique :`,
  `Pour le JJ/MM/AAAA :` et `Donné le JJ/MM/AAAA :`. Ces libellés viennent de Pronote, pas des enseignants.
- **Un devoir apparaît deux fois** : en `Pour le` dans le cours où il a été donné, et en `Donné le` dans le ou
  les cours du jour d'échéance. Le digest devoirs lit les `Donné le` du jour visé, avec repli sur les
  `Pour le` si l'établissement ne les émet pas.
- Pronote **recopie le même bloc** dans tous les cours du même enseignant ce jour-là, y compris sous une autre
  matière (vie de classe, accompagnement personnalisé). D'où le dédoublonnage sur (enseignants, texte).
- La date `Donné le` est la date de saisie, qui peut différer du jour du cours porteur du `Pour le`.
- Les enseignants utilisent parfois le champ devoirs comme messagerie. On ne sait pas trier de façon fiable :
  ces messages sont affichés avec les devoirs.
- Les cours annulés ou déplacés ont une catégorie dédiée (`Cours - Cours annulé`, `Cours - Cours déplacé`).
- Les vacances et jours fériés sont des événements sur journée entière, catégorie `Jours fériés`, avec une
  date de fin exclusive.
- L'inclusion du cahier de textes dans l'export iCal est un réglage de l'établissement. Sans lui, le digest
  devoirs est impossible : le pipeline le détecte et échoue avec un message clair.

## Règle du jour visé

Le digest préparé le soir du jour J vise :

1. J+1 si J+1 porte au moins un cours ;
2. sinon, le prochain jour avec des cours si J en porte lui-même (vendredi → lundi, veille de vacances →
   reprise) ;
3. sinon, rien : J+1 est marqué « pas de cours », avec la période de vacances et la date de reprise.

Les jours de classe sont déduits des cours présents dans le flux, ce qui couvre week-ends, fériés, vacances et
journées banalisées sans table à maintenir.

## Points d'extension

**Ajouter un canal** : implémenter `Channel` (`src/channels/types.ts`), l'enregistrer dans
`src/channels/registry.ts`, ajouter son nom à l'énumération `channels` de `src/config.ts` et ses variables
propres, documenter dans le README. Un canal reçoit le `Digest` et tous les rendus déjà calculés ; il choisit
le format qui lui convient.

**Ajouter un format** : une fonction `render*(digest, options)` dans `src/formatters/`, construite sur
`buildView`, et une entrée dans `Renderings`.

**Ajouter une source** : un module qui produit les mêmes structures que `parsePronoteIcs` (cours, périodes,
blocs de cahier de textes). Le reste du pipeline ne change pas.

**Changer de fournisseur IA** : configuration seulement (`AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`,
`AI_BASE_URL`). Le Vercel AI SDK fait l'abstraction. L'intro est rejetée si elle cite une heure absente des
données.

## Ce qui n'est volontairement pas fait

- Pas de système de plugins chargés dynamiquement, pas de configuration YAML générique : une interface, un
  registre, des fichiers.
- Pas de rendu des horaires par l'IA. Tout ce qui est factuel est produit par le code.
- Pas d'archive du fichier ICS brut par défaut : le JSON du digest suffit au débogage.
- Pas de comparaison entre deux envois : un mail dit l'état du jour visé au moment où il part, rien de plus.

## Qualité

- TypeScript strict avec `noUncheckedIndexedAccess` et `exactOptionalPropertyTypes`.
- TDD : chaque module a son test, écrit d'abord. Fixtures anonymisées tirées de vrais flux
  (`tests/fixtures/`), cas limites synthétiques via `tests/helpers/ics.ts`.
- Couverture minimale imposée par Vitest (90 % lignes, 85 % branches).
- Biome, `tsc --noEmit`, Knip, `pnpm audit` en CI (non bloquant), matrice Node 22 et 24, et un test de bout en bout de
  l'action elle-même sur les fixtures.
- Conventional Commits vérifiés par un hook, releases et changelog par release-please. `dist/` est compilé
  par le workflow de release dans la PR de version, donc présent dans chaque commit taggé `vX.Y.Z` ; entre
  deux versions il peut être en retard sur `src/`, c'est pourquoi on référence l'action par tag, jamais par
  `main`.
