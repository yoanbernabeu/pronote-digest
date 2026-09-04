# pronote-digest

Chaque soir, le planning ou les devoirs du lendemain de vos enfants, à partir des flux iCal de Pronote,
envoyés par mail ou sur un autre canal. Une GitHub Action et une CLI, sans serveur à héberger.

- **Planning** : les cours du prochain jour de classe, heure de début et de fin, salles, cours annulés ou
  déplacés, rappel de la tenue de sport.
- **Devoirs** : le travail à faire pour ce jour, tel que saisi par les enseignants dans le cahier de textes.
- **Introduction rédigée** (optionnelle) : quelques phrases générées par le fournisseur d'IA de votre choix.
- **Canaux** : mail via n'importe quel SMTP, fichiers sur disque. D'autres canaux se branchent en quelques
  lignes (voir [docs/architecture.md](docs/architecture.md)).

## Prérequis

1. **Les URL iCal de Pronote.** Dans Pronote, espace Parents ou Élève, ouvrez l'emploi du temps et cherchez
   l'export iCal (icône de calendrier ou menu « Exporter »). Vous obtenez une URL du type
   `https://XXXXXXXX.index-education.net/pronote/ical/Edt_prenom.ics?icalsecurise=…&version=…&param=…`.
   Cette URL contient un jeton : traitez-la comme un mot de passe.
2. **Un fournisseur SMTP** pour le canal mail : Brevo, Mailgun, Postmark, OVH, Infomaniak, Gmail avec mot de
   passe d'application, ou votre propre relais.
3. **Un dépôt GitHub privé** pour faire tourner l'action. Il contiendra vos secrets et l'archive des envois.

> Le cahier de textes n'est présent dans l'export iCal que si l'établissement l'a activé. Sans lui, le digest
> planning fonctionne et le digest devoirs échoue avec un message explicite.

## Utilisation en GitHub Action

Dans votre dépôt privé, créez `.github/workflows/planning.yml` :

```yaml
name: Planning du lendemain

on:
  schedule:
    # 19h00 Paris. Deux entrées pour couvrir l'heure d'été (UTC+2) et l'heure d'hiver (UTC+1).
    - cron: '0 17 * * *'
    - cron: '0 18 * * *'
  workflow_dispatch:
    inputs:
      date:
        description: 'Jour de préparation (AAAA-MM-JJ), vide pour aujourd’hui'
        default: ''
      dry_run:
        description: 'Ne rien envoyer'
        type: boolean
        default: false

permissions:
  contents: write

jobs:
  digest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      # Ne tourne qu'une fois par jour : la bonne entrée cron selon la saison.
      - name: Heure de Paris
        id: paris
        run: echo "hour=$(TZ=Europe/Paris date +%H)" >> "$GITHUB_OUTPUT"

      - name: Digest
        if: github.event_name != 'schedule' || steps.paris.outputs.hour == '19'
        uses: yoanbernabeu/pronote-digest@v0
        with:
          children: ${{ secrets.CHILDREN }}
          digest: planning
          smtp_host: ${{ secrets.SMTP_HOST }}
          smtp_port: 587
          smtp_user: ${{ secrets.SMTP_USER }}
          smtp_pass: ${{ secrets.SMTP_PASS }}
          mail_from: 'Pronote Digest <digest@example.com>'
          mail_to: ${{ secrets.MAIL_TO }}
          date: ${{ inputs.date }}
          dry_run: ${{ inputs.dry_run }}

      - name: Archive
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add archive
          git diff --cached --quiet || git commit -m "chore: archive $(date -u +%F)"
          git pull --rebase --autostash
          git push
```

Le secret `CHILDREN` contient un tableau JSON :

```json
[
  { "name": "Alice", "ics": "https://…/Edt_alice.ics?icalsecurise=…" },
  { "name": "Bob",   "ics": "https://…/Edt_bob.ics?icalsecurise=…" }
]
```

> Tant que le projet est en version 0.x, le tag mobile est `v0`. Il deviendra `v1` à la première version stable.

Puis `.github/workflows/devoirs.yml`, même structure, plus tôt dans la soirée et silencieux les jours sans
cours :

```yaml
name: Devoirs du lendemain

on:
  schedule:
    # 17h30 Paris, heure d'été et heure d'hiver.
    - cron: '30 15 * * *'
    - cron: '30 16 * * *'
  workflow_dispatch:
    inputs:
      date:
        description: 'Jour de préparation (AAAA-MM-JJ), vide pour aujourd’hui'
        default: ''
      dry_run:
        description: 'Ne rien envoyer'
        type: boolean
        default: false

permissions:
  contents: write

jobs:
  digest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - name: Heure de Paris
        id: paris
        run: echo "hour=$(TZ=Europe/Paris date +%H)" >> "$GITHUB_OUTPUT"

      - name: Digest
        if: github.event_name != 'schedule' || steps.paris.outputs.hour == '17'
        uses: yoanbernabeu/pronote-digest@v0
        with:
          children: ${{ secrets.CHILDREN }}
          digest: homework
          on_no_school: skip
          smtp_host: ${{ secrets.SMTP_HOST }}
          smtp_port: 587
          smtp_user: ${{ secrets.SMTP_USER }}
          smtp_pass: ${{ secrets.SMTP_PASS }}
          mail_from: 'Pronote Digest <digest@example.com>'
          mail_to: ${{ secrets.MAIL_TO }}
          date: ${{ inputs.date }}
          dry_run: ${{ inputs.dry_run }}

      - name: Archive
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add archive
          git diff --cached --quiet || git commit -m "chore: archive $(date -u +%F)"
          git pull --rebase --autostash
          git push
```

Les deux workflows committent dans le même dépôt : le `git pull --rebase` avant le `push` évite un conflit si
l'un tourne pendant l'autre. Un exemple complet et à jour est maintenu dans le dépôt privé de l'auteur, il est
identique à ceux-ci.

L'étape « Archive » committe le JSON et les rendus de chaque envoi dans `archive/<date visée>/`. Ça permet de
relire ce qui a été envoyé, et ça garde le dépôt actif pour que GitHub ne désactive pas le cron après 60 jours
d'inactivité.

### Entrées

| Entrée | Défaut | Description |
|---|---|---|
| `children` | requis | Tableau JSON `[{name, ics}]`. À passer via un secret. |
| `digest` | requis | `planning` ou `homework`. |
| `channels` | `email` | Canaux, séparés par des virgules : `email`, `file`. |
| `subject_prefix` | `[Pronote]` | Préfixe du sujet. |
| `archive_dir` | `archive` | Répertoire d'archive. `none` pour désactiver. |
| `on_no_school` | `notify` | Jour sans cours : `notify` envoie un message court, `skip` n'envoie rien. |
| `require_homework_data` | `true` | Échouer si aucun flux ne contient de cahier de textes (digest `homework`). |
| `date` | aujourd'hui | Jour de préparation `AAAA-MM-JJ`, en heure de Paris. Utile pour tester. |
| `dry_run` | `false` | Ne rien envoyer. L'archive est tout de même écrite. |
| `fetch_timeout_ms` | `20000` | Délai maximal de téléchargement d'un flux. |
| `smtp_host`, `smtp_port`, `smtp_secure`, `smtp_user`, `smtp_pass` | | Serveur SMTP. `smtp_secure: true` pour le port 465. |
| `mail_from`, `mail_to` | | Expéditeur et destinataires (séparés par des virgules). |
| `file_dir` | `out` | Répertoire de sortie du canal `file`. |
| `ai_provider` | vide | `anthropic`, `openai`, `mistral`, `google`, `ollama`, `openai-compatible`. Vide : pas d'intro. |
| `ai_model`, `ai_api_key`, `ai_base_url` | | Modèle, clé et URL de base du fournisseur. |
| `ai_digests` | `planning` | Digests qui reçoivent l'intro : `planning`, `homework`. |

### Sorties

`skipped`, `target-date`, `school-day`, `subject`, `archive-json`, `archive-html`,
`archive-markdown`, `delivered`. Elles permettent d'enchaîner d'autres étapes, par exemple une notification
push à partir du Markdown archivé.

## Utilisation en ligne de commande

```bash
git clone https://github.com/yoanbernabeu/pronote-digest && cd pronote-digest
pnpm install
cp .env.example .env   # puis renseignez CHILDREN et le SMTP
set -a && source .env && set +a

pnpm cli planning --dry-run            # rien n'est envoyé, l'archive est écrite
pnpm cli homework --date 2026-09-07    # devoirs pour le jour de classe suivant le 7 septembre
pnpm cli planning --channels file      # rendus dans ./out sans SMTP
```

Les URL `file://` sont acceptées à la place des URL Pronote : pratique pour rejouer un flux sauvegardé.

## Le jour visé

Le digest préparé le soir vise le prochain jour de classe : demain en semaine, lundi le vendredi soir, le jour
de reprise la veille des vacances. Le dimanche soir de fin de vacances, le lundi de reprise est bien envoyé. Les
jours de classe sont déduits des cours présents dans le flux, donc les fériés et journées banalisées sont
gérés sans configuration.

## Introduction rédigée par IA (optionnel)

Renseignez `ai_provider`, `ai_model` et `ai_api_key` (ou `ai_base_url` pour Ollama et les endpoints
compatibles OpenAI). Le modèle reçoit le digest en texte et rédige trois à cinq phrases placées en tête du
message, sur le planning seulement par défaut (`ai_digests`). Tout ce qui est factuel reste produit par le code ; si le modèle cite une heure absente des
données, l'intro est écartée et le message part sans. Un échec du fournisseur n'empêche jamais l'envoi.

## Sécurité et données personnelles

- Les URL iCal contiennent un jeton : secrets GitHub uniquement, jamais dans le code ni dans les logs. L'action
  les masque dans la sortie du workflow.
- L'archive contient les prénoms, les enseignants, les salles et les consignes : gardez le dépôt qui l'héberge
  **privé**.
- Le HTML saisi par les enseignants est assaini avant d'être inclus dans le mail.
- Le jeton peut être régénéré par l'établissement, en général à la rentrée. Le run échoue alors clairement et
  GitHub vous en informe par mail.

## Limites connues

- GitHub Actions ne garantit pas l'heure exacte d'un cron : des retards de quelques minutes à une demi-heure
  sont courants. Le message arrive « dans la soirée », pas « à 19h00 pile ».
- Seul ce que Pronote met dans l'export iCal est visible : pas de notes, pas d'absences, pas de messagerie,
  pas de statut « fait / à faire » des devoirs.
- Les libellés Pronote sont reconnus en français.

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md) et [docs/architecture.md](docs/architecture.md).

## Licence

MIT.
