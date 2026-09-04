# Contribuer

Merci de votre intérêt. Quelques règles pour que le projet reste simple à maintenir.

## Mise en route

```bash
pnpm install          # installe aussi les hooks git (commitlint, vérifications avant commit)
pnpm test:watch       # tests en continu
pnpm verify           # tout ce que la CI exécute : Biome, tsc, Knip, tests avec couverture, build
```

Node 22 minimum, pnpm 10.

## Méthode

- **TDD** : le test d'abord, puis l'implémentation minimale, puis le refactor. Une fonctionnalité sans test
  n'est pas fusionnée.
- **TypeScript strict** : pas de `any`, pas de `!`, pas de cast sans commentaire qui l'explique.
- **Bibliothèques plutôt que réinvention** : parsing ICS, mail, gabarits, validation ont chacun leur
  dépendance. N'en ajoutez une que si elle remplace du code que nous aurions dû écrire et maintenir.
- **Aucune donnée réelle** dans le dépôt : les fixtures sont anonymisées. Si vous ajoutez un flux, remplacez
  prénoms, enseignants, élèves cités et établissement, et retirez le jeton de l'URL.

## Commits

Conventional Commits, vérifiés par un hook :

```
feat(channels): canal Telegram
fix(parse): tolérer une salle vide
docs: préciser l'export iCal côté établissement
```

`feat` et `fix` alimentent le changelog et déclenchent une version via release-please.

## Ajouter un canal

1. Implémentez `Channel` dans `src/channels/<nom>.ts`. Le canal reçoit le `Digest` et les rendus déjà
   calculés (`renderings.email`, `renderings.markdown`).
2. Enregistrez-le dans `src/channels/registry.ts` et ajoutez son nom à `channels` dans `src/config.ts`, avec
   ses variables propres (préfixe en majuscules, par exemple `TELEGRAM_*`).
3. Exposez ces variables comme entrées dans `action.yml`.
4. Testez-le avec une doublure du transport, comme `tests/channels/channels.test.ts`.
5. Documentez-le dans le README.

## Pull requests

- Une PR par sujet, CI verte, couverture maintenue.
- Décrivez ce que vous avez observé dans les flux Pronote si vous touchez au parseur : ce sont ces
  observations qui font la robustesse du projet (voir `docs/architecture.md`).
