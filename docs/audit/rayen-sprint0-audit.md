# Audit Technique — Sprint 0 (Rayen)

> **Date d'audit :** 26 juin 2026
> **Auditeur :** Antigravity (IA Senior Technical Auditor)
> **Projet :** IAD & SmartQueue AI — Express Display
> **Développeur audité :** Rayen
> **Méthodologie :** Analyse statique du code source réellement présent — zéro supposition, zéro spéculation

---

## Résumé Exécutif

| Indicateur | Valeur |
|---|---|
| **Progression globale** | **83 %** |
| Tâches COMPLETED | **3 / 4** (T-002, T-003, T-006) |
| Tâches PARTIAL | **1 / 4** (T-007) |
| Tâches NOT_STARTED | **0 / 4** |

Rayen a fourni un travail technique de très bonne facture pour un Sprint 0. L'infrastructure Docker, le POC Computer Vision YOLOv8, le schéma de base de données et la pipeline CI/CD sont tous présents et en grande partie fonctionnels. La seule lacune notable concerne le CI/CD (T-007) : les scripts `lint`, `test:ci`, `test:e2e` et `type-check` sont référencés dans le workflow GitHub Actions mais **absents du `package.json`** du backend, ce qui rendrait le CI non fonctionnel tel quel.

---

## Détail par Tâche

### T-002 — Setup Environnements (Docker Compose, GitHub, .env)

**Statut : COMPLETED**
**Progression : 97 %**

#### Fichiers trouvés

| Fichier | Taille | Présent |
|---|---|---|
| `docker-compose.yml` | 11 542 o (359 lignes) | OUI |
| `.env.example` | 4 911 o (140 lignes) | OUI |
| `apps/backend/Dockerfile` | 2 617 o (91 lignes) | OUI |
| `apps/frontend/Dockerfile` | 2 509 o (85 lignes) | OUI |
| `apps/edge-cv/Dockerfile` | 3 027 o (93 lignes) | OUI |
| `apps/smartqueue-ml/Dockerfile` | 2 334 o (75 lignes) | OUI |
| `scripts/start.sh` | 5 697 o (144 lignes) | OUI |
| `scripts/stop.sh` | 947 o (32 lignes) | OUI |
| `scripts/reset.sh` | 2 221 o (70 lignes) | OUI |
| `scripts/seed.sh` | 2 477 o (75 lignes) | OUI |
| `infrastructure/docker/postgres/init.sql` | 652 o | OUI |
| `infrastructure/docker/mosquitto/mosquitto.conf` | 2 075 o | OUI |
| `infrastructure/docker/mosquitto/passwd` | 955 o | OUI |

#### Fonctionnalités réellement implémentées

**`docker-compose.yml`** — 10 services complets configurés :
- `postgres` : `timescale/timescaledb:latest-pg16` avec healthcheck `pg_isready`, volume persistant, injection `.env`
- `redis` : `redis:7.2-alpine` avec auth, `maxmemory 256mb`, politique LRU, healthcheck
- `mosquitto` : `eclipse-mosquitto:2.0` avec ports TCP (1883) et WebSocket (9001), healthcheck
- `minio` : MinIO Release 2024-01-01 avec healthcheck, volume persistant
- `backend` : Build multi-stage NestJS, depends_on (healthcheck), env injection complète
- `frontend` : React/Vite, hot reload via volume
- `edge-cv` : FastAPI + YOLOv8, volume `data/models`
- `smartqueue-ml` : FastAPI + scikit-learn
- `prometheus` : v2.51.0, 15j de rétention, lifecycle API activée
- `grafana` : v10.4.0, provisioning via volume

**Réseaux Docker** : 2 réseaux isolés (`iad_core` + `iad_monitoring`) — bonne pratique de segmentation.

**`.env.example`** : 140 lignes documentant toutes les variables (PostgreSQL, Redis, MQTT, JWT, MinIO, Grafana, Prometheus, CV, ML, Frontend). Instructions de copie incluses. Marqueurs `CHANGE_ME` explicites pour les secrets.

**Dockerfiles multi-stage** : Tous les 4 services utilisent le pattern `base → dependencies → development → production`. Les images de production utilisent des utilisateurs non-root (sécurité).

**Scripts shell** :
- `start.sh` : Vérification Docker, copie `.env`, création `data/`, démarrage séquencé (infra → backend → frontend+monitoring), attente `pg_isready`
- `stop.sh` : `docker compose down --remove-orphans`
- `reset.sh` : Confirmation RESET, suppression volumes, nettoyage `data/`, recréation structure
- `seed.sh` : Migrations Prisma + seed + création buckets MinIO

#### Éléments manquants (3 %)

- `pnpm-lock.yaml` absent ou non versionné (le Dockerfile utilise `pnpm install --frozen-lockfile`)
- `apps/frontend` non initialisé (seulement Dockerfile + nginx.conf, pas de code source React/Vite)
- MinIO image version tag `RELEASE.2024-01-01T00-00-00.000000000Z` — tag exact potentiellement introuvable

#### Risques

| Niveau | Risque |
|---|---|
| MOYEN | Port MQTT WebSocket (9001) conflit avec MinIO Console (9001) dans le docker-compose — deux services déclarent le même port hôte |
| FAIBLE | Valeurs `CHANGE_ME` dans `.env.example` — documenté mais à surveiller |

---

### T-003 — POC Détection de Personnes YOLOv8n

**Statut : COMPLETED**
**Progression : 92 %**

#### Fichiers trouvés

| Fichier | Taille | Rôle |
|---|---|---|
| `apps/edge-cv/app/detector.py` | 5 338 o (177 lignes) | Wrapper YOLOv8 — classe `PersonDetector` |
| `apps/edge-cv/app/main.py` | 8 692 o (284 lignes) | Point d'entrée POC — boucle temps-réel |
| `apps/edge-cv/app/video_stream.py` | 5 595 o (157 lignes) | Capture vidéo thread-safe |
| `apps/edge-cv/app/utils.py` | 6 163 o (210 lignes) | Métriques FPS/latence, CSV logger, HUD |
| `apps/edge-cv/requirements.txt` | 742 o | `ultralytics==8.2.0`, `torch==2.3.0`, `opencv-python-headless==4.9.0.80` |
| `apps/edge-cv/Dockerfile` | 3 027 o | Téléchargement `yolov8n.pt` au build |

#### Fonctionnalités réellement implémentées

**`detector.py` — `PersonDetector`** :
- Import `ultralytics.YOLO` — modèle `yolov8n.pt` chargé (auto-téléchargement)
- Filtrage **classe 0 uniquement** (COCO = "person")
- Détection device automatique : `cuda` → `mps` → `cpu` (via `torch`)
- Support FP16 (`half=True`) pour GPU
- Warm-up : passe dummy 480×640 au démarrage (réduit la latence du 1er frame)
- `DetectionResult` : liste `Detection` (x1,y1,x2,y2,conf) + `inference_ms` en ms
- Export ONNX (`export_onnx()`) pour déploiement edge

**`video_stream.py` — `VideoStream`** :
- Thread daemon dédié à la lecture de frames (non-bloquant)
- Lock `threading.Lock` pour accès concurrent sécurisé
- Support : index webcam (0–64) + RTSP/RTSPS + fichiers locaux
- Validation source : regex allow-list sécurisée (empêche injection URL)
- Timeout 5s d'attente du premier frame
- Context manager (`__enter__`/`__exit__`)

**`main.py` — Boucle POC** :
- CLI complet : `--source`, `--model`, `--conf`, `--device`, `--half`, `--headless`, `--log-csv`, `--export-onnx`, `--width`, `--height`
- Support webcam (index 0), RTSP, fichier vidéo
- `FPSCounter` : rolling average 30 frames via `deque`
- `LatencyTracker` : rolling average + max latency
- `PerformanceLogger` : CSV avec timestamp, fps, latency_ms, person_count
- Affichage HUD OpenCV : FPS, latence (rouge si >200ms), compteur personnes
- Graceful shutdown via SIGINT/SIGTERM
- Mode `--headless` pour benchmarking sans écran

**Latence** : Mesurée en ms via `time.perf_counter()` — tracking rolling window 30 frames. Alerte HUD si >200ms.

#### Éléments manquants (8 %)

- Pas d'endpoint FastAPI exposé : `main.py` est un script standalone, pas une API REST. Le Dockerfile lance `uvicorn app.main:app` mais `main.py` ne définit pas d'objet `app` FastAPI
- Aucun test pytest pour le service edge-cv (dossier `tests/` absent)
- Modèle `yolov8n.pt` non commité (normal : 6 Mo) — téléchargé au build Dockerfile

#### Risques

| Niveau | Risque |
|---|---|
| ELEVÉ | Incompatibilité Dockerfile vs code : `CMD ["uvicorn", "app.main:app", ...]` mais `main.py` ne définit pas d'objet ASGI `app` — le container `iad_edge_cv` ne démarrera pas |
| MOYEN | `opencv-python-headless` utilisé (correct pour Docker) mais `cv2.imshow()` appelé en mode GUI — incompatible sans display en container |
| FAIBLE | Absence de tests unitaires pour `PersonDetector` |

---

### T-006 — Schéma PostgreSQL + TimescaleDB

**Statut : COMPLETED**
**Progression : 88 %**

#### Fichiers trouvés

| Fichier | Taille | Rôle |
|---|---|---|
| `apps/backend/prisma/schema.prisma` | 3 333 o (144 lignes) | Schéma Prisma complet |
| `apps/backend/prisma/migrations/000000000000_init/migration.sql` | 4 653 o (152 lignes) | Migration SQL initiale |
| `apps/backend/prisma/seed.ts` | 5 866 o (205 lignes) | Seed complet |
| `infrastructure/docker/postgres/init.sql` | 652 o | Initialisation extensions PG |

#### Fonctionnalités réellement implémentées

**`schema.prisma`** — 7 modèles + 5 enums :

| Entité | Clé primaire | Relations | Index |
|---|---|---|---|
| `Site` | UUID | `Device[]`, `Ticket[]`, `AudienceEvent[]`, `User[]` | — |
| `Device` | UUID | `Site` (Cascade) | `siteId` |
| `User` | UUID | `Site` (SetNull optionnel) | `siteId`, `email UNIQUE` |
| `Campaign` | UUID | — | — |
| `AudienceEvent` | `(id, timestamp)` composite | `Site`, `Device` | `siteId`, `deviceId`, `timestamp` |
| `Ticket` | UUID | `Site` (Cascade) | `siteId`, `status`, `createdAt` |
| `MLModel` | UUID | — | — |

**Enums déclarés** :
- `DeviceType` : TOTEM, SCREEN, KIOSK, CAMERA
- `DeviceStatus` : ONLINE, OFFLINE
- `UserRole` : ADMIN, MANAGER, AGENT
- `TicketStatus` : WAITING, IN_PROGRESS, DONE, CANCELLED
- `MLModelType` : IAD, SMARTQUEUE

**Compatibilité TimescaleDB** :
- `AudienceEvent` : clé primaire composite `(id, timestamp)` — requis pour hypertable TimescaleDB
- Index sur `timestamp` — correct pour les requêtes time-series
- `migration.sql` ligne 151 : `SELECT create_hypertable('audience_events', 'timestamp');` — intégration TimescaleDB dans la migration SQL
- `infrastructure/docker/postgres/init.sql` : `CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;` + `uuid-ossp` + `pgcrypto`

**`seed.ts`** — Données de test complètes :
- 1 Site, 2 Devices (KIOSK + CAMERA)
- 1 User Admin (password bcrypt salted 12 rounds)
- 3 Campaigns avec `targetAudience` JSON structuré
- 10 Tickets avec statuts variés (DONE/IN_PROGRESS/WAITING/CANCELLED), timestamps calculés
- 100 AudienceEvents avec `createMany` (batch efficace)
- 2 MLModels (IAD v1.0.0 + SMARTQUEUE v1.2.0)

#### Éléments manquants (12 %)

- Le nom de migration `000000000000_init` est non-standard — Prisma génère normalement un timestamp
- `Campaign` non liée à `Site` ou `Device` — relation métier manquante pour le ciblage publicitaire
- `Device` n'a pas de champ `name` pour un label lisible
- `schema.prisma` ne configure pas `previewFeatures` (non bloquant)

#### Risques

| Niveau | Risque |
|---|---|
| MOYEN | Nom de migration non-standard peut poser problème avec `prisma migrate status` |
| MOYEN | `create_hypertable` nécessite TimescaleDB installé AVANT la migration — dépendance à l'ordre d'exécution `init.sql` |
| FAIBLE | `Campaign.mediaUrl` : type `String` non validé — risque injection URL côté applicatif |

---

### T-007 — CI/CD GitHub Actions

**Statut : PARTIAL**
**Progression : 65 %**

#### Fichiers trouvés

| Fichier | Taille | Présent |
|---|---|---|
| `.github/workflows/ci.yml` | 9 995 o (347 lignes) | OUI |

#### Jobs déclarés dans `ci.yml`

| Job | Déclaré | Fonctionnel réellement |
|---|---|---|
| `lint-backend` (NestJS ESLint + type-check) | OUI | NON — scripts absents du `package.json` |
| `lint-frontend` (ESLint + type-check) | OUI | NON — frontend non initialisé |
| `lint-python` (Ruff + mypy, matrix edge-cv + smartqueue-ml) | OUI | OUI — dépendances présentes dans requirements.txt |
| `test-backend` (Jest, avec PostgreSQL + Redis services) | OUI | NON — scripts `test:ci`, `test:e2e` absents |
| `test-python` (pytest + coverage, matrix) | OUI | PARTIEL — dossiers `tests/` absents |
| `build-images` (Docker Buildx + GHCR push) | OUI | OUI — configuration correcte |
| `security-scan` (Trivy SARIF) | OUI | OUI — configuration correcte |

**Points positifs dans `ci.yml`** :
- `concurrency` avec `cancel-in-progress: true` — évite les runs redondants
- `needs` chain correcte : lint → test → build → security
- Services PostgreSQL + Redis dans le job de test — bonne pratique
- TimescaleDB image en CI (`timescale/timescaledb:latest-pg16`) — cohérent avec prod
- `prisma generate` + `prisma migrate deploy` dans le CI
- Cache pip/npm activé
- Upload coverage artifacts (7j rétention)
- Secrets gérés via `secrets.GITHUB_TOKEN`

#### Éléments manquants (35 %)

Scripts manquants dans `apps/backend/package.json` (référencés dans ci.yml mais absents) :
- `lint` — référencé ligne 54
- `type-check` — référencé ligne 57
- `test:ci` — référencé ligne 192
- `test:e2e` — référencé ligne 195

Autres manquants :
- `apps/frontend/package.json` inexistant — frontend non initialisé
- Dossiers `tests/` absents dans `apps/edge-cv/` et `apps/smartqueue-ml/`
- `pnpm-lock.yaml` référencé dans les Dockerfiles mais non versionné visible

#### Risques

| Niveau | Risque |
|---|---|
| ELEVÉ | La CI échouera immédiatement sur `npm run lint` et `npm run test:ci` (scripts inexistants) |
| ELEVÉ | `test-python` échouera sur `pytest tests/` (dossier `tests/` inexistant) |
| MOYEN | `lint-frontend` échouera si `apps/frontend` n'a pas de `package.json` |
| FAIBLE | TimescaleDB `latest-pg16` tag en CI — préférer un tag versionné |

---

## Tableau Récapitulatif

| Tâche | Description | Statut | Progression | Bloquant ? |
|---|---|---|---|---|
| **T-002** | Docker Compose + .env + Dockerfiles + Scripts | COMPLETED | 97 % | Non |
| **T-003** | POC YOLOv8n détection personnes | COMPLETED | 92 % | Non (risque Dockerfile) |
| **T-006** | Schéma PostgreSQL + TimescaleDB + Migrations + Seed | COMPLETED | 88 % | Non |
| **T-007** | CI/CD GitHub Actions | PARTIAL | 65 % | Oui |
| | **GLOBAL** | | **83 %** | |

---

## Risques Techniques

### Risques Bloquants

1. **T-007 — Scripts NPM manquants** : Le workflow `ci.yml` appelle `npm run lint`, `npm run type-check`, `npm run test:ci`, `npm run test:e2e` qui n'existent pas dans `apps/backend/package.json`. La CI échouera sur le premier push.

2. **T-003 — Conflit Dockerfile vs code** : Le Dockerfile du service `edge-cv` démarre `uvicorn app.main:app` mais `main.py` ne définit aucun objet ASGI `app` (c'est un script CLI). Le container `iad_edge_cv` ne démarrera pas.

### Risques Moyens

3. **T-002 — Conflit de ports** : Dans `docker-compose.yml`, Mosquitto expose le port `9001` (WebSocket MQTT) ET MinIO Console expose aussi le port `9001`. Ces deux services ne peuvent pas démarrer simultanément sur la même machine hôte.

4. **T-006 — Migration non-standard** : Le dossier `000000000000_init` avec ce nom non-timestampé peut perturber `prisma migrate status` et la gestion future des migrations.

5. **T-007 — Frontend non initialisé** : Le CI lint le frontend mais `apps/frontend` ne contient qu'un `Dockerfile` et un `nginx.conf`, sans `package.json` ni code source Vite/React.

### Risques Faibles

6. **T-003 — Tests absents** : Aucun test pytest pour `edge-cv` ou `smartqueue-ml`, empêchant la validation automatisée.

7. **T-002 — MinIO image tag exact** : `RELEASE.2024-01-01T00-00-00.000000000Z` peut ne pas exister exactement sur Docker Hub.

---

## Recommandations

### Priorité 1 — Corrections bloquantes (avant prochain push)

```json
// Ajouter dans apps/backend/package.json (section "scripts")
{
  "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
  "type-check": "tsc --noEmit",
  "test:ci": "jest --ci --coverage --testPathPattern=\\.spec\\.ts",
  "test:e2e": "jest --config ./test/jest-e2e.json"
}
```

```yaml
# Corriger le conflit port 9001 dans docker-compose.yml
# Mosquitto WebSocket → changer MQTT_WS_PORT en 9003
# et dans .env.example : MQTT_WS_PORT=9003
```

```python
# Créer apps/edge-cv/app/api.py avec objet FastAPI
# Le main.py POC CLI reste intact, mais le Dockerfile doit pointer vers api.py
from fastapi import FastAPI
app = FastAPI(title="IAD Edge CV Service")

@app.get("/health")
def health():
    return {"status": "ok"}
```

### Priorité 2 — Compléter T-007

```bash
# Initialiser le frontend Vite
cd apps/frontend
pnpm create vite . --template react-ts

# Créer les dossiers de tests Python
mkdir -p apps/edge-cv/tests apps/smartqueue-ml/tests
touch apps/edge-cv/tests/__init__.py
touch apps/edge-cv/tests/test_detector.py
touch apps/smartqueue-ml/tests/__init__.py
```

### Priorité 3 — Qualité et solidité

- Renommer la migration Prisma avec un timestamp standard (`prisma migrate dev --name init`)
- Ajouter la relation `Campaign <-> Site` dans le schéma Prisma
- Ajouter un champ `name` à `Device`
- Utiliser un tag versionné pour `timescale/timescaledb` en CI

---

## Prochaines Actions Prioritaires

| # | Action | Responsable | Urgence |
|---|---|---|---|
| 1 | Ajouter scripts `lint`, `type-check`, `test:ci`, `test:e2e` dans `package.json` backend | Rayen | Immédiat |
| 2 | Corriger conflit port 9001 MQTT WS vs MinIO Console | Rayen | Immédiat |
| 3 | Créer endpoint FastAPI (`app`) dans `edge-cv` séparé du script CLI POC | Rayen | Immédiat |
| 4 | Initialiser `apps/frontend` (Vite + React + TypeScript) | A assigner | Sprint 1 |
| 5 | Créer `tests/` dans `edge-cv` et `smartqueue-ml` | Rayen | Sprint 1 |
| 6 | Corriger le nom de migration Prisma (format timestampé) | Rayen | Recommandé |
| 7 | Valider le build Docker `edge-cv` de bout en bout | Rayen | Sprint 1 |

---

*Audit généré le 26/06/2026 — Basé exclusivement sur l'analyse statique du code source présent dans le repository.*
