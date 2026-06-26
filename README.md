<div align="center">

# 🚀 IAD & SmartQueue AI

### Infrastructure Intelligence Artificielle & File d'Attente Intelligente
**Express Display**

[![CI](https://github.com/express-display/iad-smartqueue-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/express-display/iad-smartqueue-ai/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js 20](https://img.shields.io/badge/Node.js-20-green?logo=node.js)](https://nodejs.org)
[![Python 3.11](https://img.shields.io/badge/Python-3.11-blue?logo=python)](https://python.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue?logo=docker)](https://docs.docker.com/compose)

</div>

---

## 📋 Présentation du projet

**IAD & SmartQueue AI** est une plateforme d'intelligence artificielle combinant :

- 🎯 **IAD (Intelligence Artificielle en Détection)** : Computer Vision en temps réel avec détection d'objets et de personnes via YOLOv8
- 📊 **SmartQueue AI** : Système de gestion et prédiction intelligente de files d'attente alimenté par du Machine Learning (scikit-learn)

La plateforme permet aux opérateurs d'Express Display d'analyser des flux vidéo en temps réel, de prédire l'affluence, et d'optimiser dynamiquement la gestion des files d'attente.

---

## 🧑‍💻 Équipe & Responsabilités

| Rôle | Scope |
|------|-------|
| **Backend / DevOps / CV** | NestJS, Infrastructure Docker, Computer Vision (YOLOv8) |
| **Frontend** | React 18 + Vite + TypeScript |
| **ML Engineer** | SmartQueue ML (scikit-learn, séries temporelles) |

---

## 📦 Prérequis

Avant de commencer, assurez-vous d'avoir installé :

| Outil | Version minimale | Installation |
|-------|-----------------|--------------|
| **Docker** | 24.0+ | [docs.docker.com](https://docs.docker.com/get-docker/) |
| **Docker Compose** | 2.20+ | Inclus avec Docker Desktop |
| **Git** | 2.40+ | [git-scm.com](https://git-scm.com) |
| **Node.js** *(optionnel en dev local)* | 20 LTS | [nodejs.org](https://nodejs.org) |
| **Python** *(optionnel en dev local)* | 3.11+ | [python.org](https://python.org) |

> **Note WSL** : Si vous utilisez Windows avec WSL2, assurez-vous que Docker Desktop est configuré avec l'intégration WSL2 activée.

---

## ⚡ Installation rapide

```bash
# 1. Cloner le repository
git clone https://github.com/express-display/iad-smartqueue-ai.git
cd iad-smartqueue-ai

# 2. Configurer les variables d'environnement
cp .env.example .env
# ⚠️ Éditez .env et changez TOUS les mots de passe CHANGE_ME

# 3. Démarrer toute l'infrastructure
./scripts/start.sh

# 4. (Première fois) Initialiser la base de données
./scripts/seed.sh
```

C'est tout ! L'infrastructure complète est disponible.

---

## 🌐 Services & Ports

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:5173 | Interface React (dev) |
| **Backend API** | http://localhost:3000 | API NestJS REST |
| **Swagger UI** | http://localhost:3000/api | Documentation API interactive |
| **Edge CV** | http://localhost:8001 | Service Computer Vision (FastAPI) |
| **SmartQueue ML** | http://localhost:8002 | Service ML (FastAPI) |
| **PostgreSQL** | localhost:5432 | Base de données principale |
| **Redis** | localhost:6379 | Cache & sessions |
| **MQTT Broker** | localhost:1883 | Messaging temps-réel |
| **MQTT WebSocket** | localhost:9001 | MQTT via WebSocket (frontend) |
| **MinIO API** | http://localhost:9000 | Object Storage S3-compatible |
| **MinIO Console** | http://localhost:9001 | Interface web MinIO |
| **Prometheus** | http://localhost:9090 | Métriques & scraping |
| **Grafana** | http://localhost:3001 | Dashboards & alerting |

---

## 🏗️ Architecture des services

```
┌─────────────────────────────────────────────────────────────────┐
│                         IAD & SmartQueue AI                      │
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐                           │
│  │   Frontend   │    │   Backend    │                           │
│  │  React/Vite  │───▶│   NestJS     │                           │
│  │  TypeScript  │    │   Prisma ORM │                           │
│  └──────────────┘    └──────┬───────┘                           │
│                             │                                     │
│              ┌──────────────┼──────────────┐                    │
│              ▼              ▼              ▼                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  PostgreSQL  │  │    Redis     │  │  Mosquitto   │          │
│  │  TimescaleDB │  │   Cache      │  │   MQTT       │          │
│  └──────────────┘  └──────────────┘  └──────┬───────┘          │
│                                             │                    │
│              ┌──────────────────────────────┘                   │
│              ▼                                                    │
│  ┌──────────────┐    ┌──────────────┐                           │
│  │   Edge CV    │    │SmartQueue ML │                           │
│  │  FastAPI     │    │  FastAPI     │                           │
│  │  YOLOv8      │    │  scikit-learn│                           │
│  └──────────────┘    └──────────────┘                           │
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │    MinIO     │    │  Prometheus  │    │   Grafana    │       │
│  │  Object      │    │  Métriques   │───▶│  Dashboards  │       │
│  │  Storage     │    │              │    │              │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Commandes utiles

### Gestion de l'infrastructure

```bash
# Démarrer tous les services
./scripts/start.sh

# Arrêter tous les services (données conservées)
./scripts/stop.sh

# Réinitialiser complètement (⚠️ supprime toutes les données)
./scripts/reset.sh

# Initialiser / seeder la base de données
./scripts/seed.sh
```

### Docker Compose

```bash
# Voir l'état de tous les services
docker compose ps

# Voir les logs d'un service spécifique
docker compose logs -f backend
docker compose logs -f edge-cv
docker compose logs -f postgres

# Voir les logs de tous les services
docker compose logs -f

# Redémarrer un service
docker compose restart backend

# Reconstruire une image
docker compose build --no-cache backend

# Accéder au shell d'un container
docker compose exec backend sh
docker compose exec postgres psql -U iad_user -d iad_db
docker compose exec redis redis-cli -a $REDIS_PASSWORD
```

### Base de données (Prisma)

```bash
# Depuis le container backend
docker compose exec backend npx prisma studio          # Interface web Prisma
docker compose exec backend npx prisma migrate dev     # Nouvelle migration
docker compose exec backend npx prisma migrate deploy  # Appliquer migrations
docker compose exec backend npx prisma generate        # Régénérer le client
docker compose exec backend npx prisma db seed         # Seeder
```

### Monitoring

```bash
# Ouvrir Grafana
open http://localhost:3001  # admin / voir .env GRAFANA_ADMIN_PASSWORD

# Ouvrir Prometheus
open http://localhost:9090

# Vérifier que Prometheus scrape correctement
curl http://localhost:9090/api/v1/targets
```

---

## 🔒 Sécurité

> **IMPORTANT** : Ne commitez **jamais** le fichier `.env` sur Git.

En production :
- Changez **tous** les mots de passe `CHANGE_ME` dans `.env`
- Utilisez un gestionnaire de secrets (HashiCorp Vault, AWS Secrets Manager, etc.)
- Activez TLS/HTTPS sur tous les services exposés publiquement
- Configurez un CSP strict dans Nginx
- Limitez l'accès aux ports des services internes (PostgreSQL, Redis, MQTT)

---

## 📁 Structure du repository

```
/
├── apps/
│   ├── backend/              # NestJS + Prisma ORM
│   │   ├── src/
│   │   ├── prisma/
│   │   └── Dockerfile
│   ├── frontend/             # React 18 + Vite + TypeScript
│   │   ├── src/
│   │   ├── nginx.conf
│   │   └── Dockerfile
│   ├── edge-cv/              # Computer Vision — FastAPI + YOLOv8
│   │   ├── app/
│   │   ├── tests/
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   └── smartqueue-ml/        # ML Service — FastAPI + scikit-learn
│       ├── app/
│       ├── tests/
│       ├── requirements.txt
│       └── Dockerfile
│
├── infrastructure/
│   ├── docker/
│   │   ├── postgres/         # Script init SQL (TimescaleDB)
│   │   └── mosquitto/        # Config MQTT + passwords
│   ├── nginx/                # Config Nginx (reverse proxy)
│   └── monitoring/
│       ├── prometheus.yml    # Config Prometheus
│       ├── alerts.yml        # Règles d'alerting
│       └── grafana/
│           ├── provisioning/ # Datasources + Dashboards auto
│           └── dashboards/   # JSON dashboards
│
├── docs/                     # Documentation technique
│   └── README.md
│
├── scripts/
│   ├── start.sh              # Démarrage complet
│   ├── stop.sh               # Arrêt gracieux
│   ├── reset.sh              # Reset complet (⚠️ données supprimées)
│   └── seed.sh               # Migrations + seed BDD
│
├── data/                     # Données persistantes (gitignored)
│   ├── models/               # Modèles YOLOv8
│   ├── model_store/          # Modèles ML
│   └── uploads/              # Uploads temporaires
│
├── .github/
│   └── workflows/
│       └── ci.yml            # Pipeline CI/CD GitHub Actions
│
├── docker-compose.yml        # Orchestration de tous les services
├── .env.example              # Template de configuration
├── .gitignore
└── README.md
```

---

## ✅ Checklist de vérification

Après `./scripts/start.sh`, vérifiez :

- [ ] **Docker** : `docker compose ps` — tous les services en `Up`
- [ ] **PostgreSQL** : `docker compose exec postgres pg_isready -U iad_user`
- [ ] **Redis** : `docker compose exec redis redis-cli -a $REDIS_PASSWORD ping` → `PONG`
- [ ] **MQTT** : Broker Mosquitto accessible sur `localhost:1883`
- [ ] **Backend** : `curl http://localhost:3000/health` → `{"status":"ok"}`
- [ ] **Frontend** : `curl -s http://localhost:5173` → HTML de l'app React
- [ ] **Edge CV** : `curl http://localhost:8001/health` → `{"status":"ok"}`
- [ ] **SmartQueue ML** : `curl http://localhost:8002/health` → `{"status":"ok"}`
- [ ] **MinIO** : Console accessible sur http://localhost:9001
- [ ] **Grafana** : Interface accessible sur http://localhost:3001
- [ ] **Prometheus** : Targets visibles sur http://localhost:9090/targets

---

## 🤝 Contribution

1. Créez une branche feature : `git checkout -b feature/ma-fonctionnalite`
2. Committez vos changements : `git commit -m "feat: description claire"`
3. Ouvrez une Pull Request vers `develop`

### Conventions de commit (Conventional Commits)

```
feat:     Nouvelle fonctionnalité
fix:      Correction de bug
chore:    Maintenance (deps, config, scripts)
docs:     Documentation
refactor: Refactoring sans changement de comportement
test:     Ajout ou modification de tests
ci:       Pipeline CI/CD
```

---

## 📄 Licence

MIT © Express Display 2025–2026
