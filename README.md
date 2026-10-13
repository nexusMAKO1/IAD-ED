<div align="center">

# 🚀 IAD & SmartQueue AI

### Plateforme d'Intelligence Artificielle, Computer Vision & File d'Attente Intelligente
**Express Display**

[![CI](https://github.com/express-display/iad-smartqueue-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/express-display/iad-smartqueue-ai/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js 20](https://img.shields.io/badge/Node.js-20_LTS-green?logo=node.js)](https://nodejs.org)
[![Python 3.11](https://img.shields.io/badge/Python-3.11-blue?logo=python)](https://python.org)
[![NestJS 11](https://img.shields.io/badge/NestJS-11-red?logo=nestjs)](https://nestjs.com)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-00ffff)](https://ultralytics.com)
[![TimescaleDB](https://img.shields.io/badge/TimescaleDB-PostgreSQL_16-blue?logo=postgresql)](https://timescale.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue?logo=docker)](https://docs.docker.com/compose)

</div>

---

## 📋 Présentation du projet

**IAD & SmartQueue AI** est une solution complète d'intelligence artificielle opérationnelle conçue pour **Express Display**. Elle associe l'analyse vidéo en temps réel, la diffusion dynamique de contenus publicitaires (DOOH), la prédiction d'affluence et la détection d'anomalies de files d'attente.

### 🌟 Fonctionnalités Clés

- 🎯 **IAD — Computer Vision & Audience Analytics** :
  - Détection temps réel de personnes et d'attention via **YOLOv8** (FastAPI)
  - Profilage démographique de l'audience (tranches d'âge, classification de genre)
  - Mesure de la durée d'attention (*dwell time*), engagement et rétention
- 📊 **SmartQueue AI — Prédiction & Détection d'Anomalies** :
  - Modélisation prédictive de l'affluence et des temps d'attente (scikit-learn, séries temporelles)
  - Détection d'anomalies de flux en temps réel (modèle Z-score & ML)
  - Publication immédiate des alertes de surchauffe de files sur le bus MQTT
- 📺 **Campagnes Publicitaires Dynamiques & Smart Displays** :
  - Programmation et ciblage dynamique des contenus publicitaires selon l'audience détectée en direct
  - Mesure complète de performance (impressions ciblées, portée/reach, conversions estimées, ROI)
  - Lecteur d'affichage dynamique synchronisé (totems / écrans connectés)
- 📡 **Gestion Unifiée de Flotte (Fleet Management) & Auto-Pairing** :
  - Registre centralisé unifiant caméras Edge CV et totems d'affichage (Displays)
  - Découverte automatique et appairage instantané (*auto-pairing*) dès la première publication MQTT
  - Surveillance active de l'état de santé par *heartbeat* et détection des pannes / mode hors-ligne
- 🏢 **Multi-Sites & Heatmap Spatiale** :
  - Supervision hiérarchique avec filtrage contextuel par site ou vue consolidée (*Tous les sites*)
  - Visualisation thermique (*heatmap*) de fréquentation et d'occupation spatiale
- 🚨 **Système d'Alertes Temps Réel** :
  - Moteur d'alertes réactif (sur-affluence, seuils de file dépassés, appareils déconnectés)
  - Notifications push temps réel via MQTT WebSocket et interface de résolution
- 🌍 **Interface Moderne & Bilingue** :
  - Frontend React 18 / Vite / TypeScript avec design *glassmorphism*, animations fluides (*Framer Motion*)
  - Internationalisation complète (Français / Anglais via `i18next`)

---

## 🧑‍💻 Équipe & Responsabilités

| Rôle | Scope & Technologies |
|------|----------------------|
| **Backend / DevOps / Architecture** | NestJS 11, Prisma ORM, TimescaleDB, Docker Compose, Mosquitto MQTT, MinIO, Prometheus, Grafana |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Radix UI, TanStack Query, Framer Motion, Recharts |
| **Edge Computer Vision** | FastAPI, YOLOv8 (Ultralytics), OpenCV, WebRTC/Webcam, MQTT Telemetry |
| **ML Engineer** | FastAPI, scikit-learn, modèles de régression temporelle & détection d'anomalies (Z-score) |

---

## 📦 Prérequis

| Outil | Version minimale | Notes / Liens |
|-------|-----------------|---------------|
| **Docker** | 24.0+ | [docs.docker.com/get-docker](https://docs.docker.com/get-docker/) |
| **Docker Compose** | 2.20+ | Inclus par défaut avec Docker Desktop |
| **Git** | 2.40+ | [git-scm.com](https://git-scm.com) |
| **Node.js** *(optionnel en dev local)* | 20 LTS | Requis uniquement pour lancer les apps hors conteneur |
| **Python** *(optionnel en dev local)* | 3.11+ | Requis pour lancer les scripts ou tests ML/CV en local |
| **Webcam / Caméra** *(optionnel)* | USB ou intégrée | Pour tester le flux vidéo live du service Edge CV |

> 💡 **Ressources recommandées** : Allouez au moins 4 vCPUs et 8 Go de RAM à Docker Desktop pour un confort optimal lors de l'inférence YOLO et des builds.

---

## ⚡ Installation rapide & Démarrage

### Option 1 : Démonstration E2E Automatisée (Recommandée) 🚀

Un script maître automatise l'ensemble du cycle (démarrage de la stack, attente de l'état sain des conteneurs, migrations de la base, seed des données de démo et ouverture du navigateur) :

```bash
# 1. Cloner le repository
git clone https://github.com/express-display/iad-smartqueue-ai.git
cd iad-smartqueue-ai

# 2. Configurer les variables d'environnement
cp .env.example .env

# 3. Lancer la démo complète
./scripts/demo.sh
```

### Option 2 : Démarrage Standard

```bash
# 1. Copier le fichier d'environnement
cp .env.example .env

# 2. Démarrer toute l'infrastructure Docker
./scripts/start.sh

# 3. Appliquer les migrations TimescaleDB et seeder la base
./scripts/seed.sh
```

### 🔑 Identifiants de connexion par défaut

Une fois les données initialisées via `./scripts/seed.sh` ou `./scripts/demo.sh` :

| Application | URL | Identifiant | Mot de passe |
|-------------|-----|-------------|--------------|
| **Frontend Web** | [http://localhost:5173](http://localhost:5173) | `admin@expressdisplay.com` | `Admin1234!` |
| **MinIO Console** | [http://localhost:9001](http://localhost:9001) | `minioadmin` | `minioadmin` *(ou voir `.env`)* |
| **Grafana** | [http://localhost:3001](http://localhost:3001) | `admin` | `admin123` *(ou voir `.env`)* |

---

## 🌐 Services & Ports

| Service | URL / Port | Description |
|---------|------------|-------------|
| **Frontend** | [http://localhost:5173](http://localhost:5173) | Interface opérateur React (Vite) |
| **Backend API** | [http://localhost:3000](http://localhost:3000) | API REST NestJS & WebSocket |
| **Swagger UI** | [http://localhost:3000/api](http://localhost:3000/api) | Documentation interactive OpenAPI |
| **Prisma Studio** | [http://localhost:5555](http://localhost:5555) | Explorateur web de base de données |
| **Edge CV** | [http://localhost:8001](http://localhost:8001) | Inférence YOLOv8 & Computer Vision (FastAPI) |
| **SmartQueue ML** | [http://localhost:8002](http://localhost:8002) | Prédiction d'affluence & Anomalies (FastAPI) |
| **PostgreSQL** | `localhost:5432` | Base de données relationnelle + TimescaleDB |
| **Redis** | `localhost:6379` | Cache de sessions et files d'attente |
| **MQTT Broker** | `localhost:1883` | Bus de communication IoT / télémétrie (TCP) |
| **MQTT WebSocket** | `ws://localhost:9003` | Pont WebSocket MQTT pour le frontend |
| **MinIO API** | [http://localhost:9000](http://localhost:9000) | Stockage d'objets S3 (médias, modèles) |
| **MinIO Console** | [http://localhost:9001](http://localhost:9001) | Interface web d'administration MinIO |
| **Prometheus** | [http://localhost:9090](http://localhost:9090) | Collecte et scraping des métriques système |
| **Grafana** | [http://localhost:3001](http://localhost:3001) | Tableaux de bord de surveillance et alerting |
| **Postgres Exporter** | `localhost:9187` | Métriques Prometheus PostgreSQL |
| **Redis Exporter** | `localhost:9121` | Métriques Prometheus Redis |
| **Mosquitto Exporter** | `localhost:9234` | Métriques Prometheus Mosquitto MQTT |

---

## 🏗️ Architecture Globale des Services

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   IAD & SmartQueue AI                                  │
│                                                                                        │
│   ┌─────────────────────┐       HTTP / REST       ┌─────────────────────────────┐      │
│   │   Frontend React    │◄───────────────────────►│       Backend NestJS        │      │
│   │   (Vite + TS + i18n)│                         │      (Prisma + JWT Auth)    │      │
│   └──────────┬──────────┘                         └──────┬──────────┬───────────┘      │
│              │                                           │          │                  │
│              │ WS:9003 (Alertes & Télémétrie)            │          │                  │
│              ▼                                           ▼          │                  │
│   ┌──────────────────────────────────────────────────────────────┐  │                  │
│   │                  Mosquitto MQTT Broker (1883)                │  │                  │
│   │   • Télémétrie Audience         • Heartbeats & Auto-Pairing  │  │                  │
│   │   • Alertes Files d'Attente     • Commandes d'Affichage      │  │                  │
│   └──────────────▲───────────────────────────────▲───────────────┘  │                  │
│                  │                               │                  │                  │
│     MQTT Publish │                  MQTT Publish │                  │                  │
│                  │                               │                  │                  │
│   ┌──────────────┴───────────┐    ┌──────────────┴───────────┐      │                  │
│   │     Edge CV (FastAPI)    │    │   SmartQueue ML (FastAPI)│      │                  │
│   │ • Inférence YOLOv8       │    │ • Prédiction d'affluence │      │                  │
│   │ • Analyse d'Audience     │    │ • Détection d'anomalies  │      │                  │
│   │ • Auto-Pairing Caméra    │    │ • Alertes Z-Score        │      │                  │
│   └──────────────┬───────────┘    └──────────────────────────┘      │                  │
│                  │ (Upload snapshots)                               │                  │
│                  ▼                                                  │                  │
│   ┌──────────────────────────┐    ┌──────────────────────────┐      │                  │
│   │      MinIO (S3 API)      │    │  PostgreSQL 16 +         │◄─────┘                  │
│   │   Médias & Snapshots     │    │  TimescaleDB (Hypertables│                         │
│   └──────────────────────────┘    └──────────────┬───────────┘                         │
│                                                  │                                     │
│   ┌──────────────────────────┐    ┌──────────────┴───────────┐   ┌─────────────────┐   │
│   │     Redis (Cache)        │    │    Prometheus (Metrics)  │──►│ Grafana (3001)  │   │
│   │   Sessions & Rate-Limit  │    │    & Exporters Dédiés    │   │ Dashboards Ops  │   │
│   └──────────────────────────┘    └──────────────────────────┘   └─────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Commandes utiles

### Gestion de l'infrastructure

```bash
# Démarrage automatisé pour démonstration (build + start + wait + seed + browser)
./scripts/demo.sh

# Démarrer tous les conteneurs
./scripts/start.sh

# Arrêter tous les conteneurs (en préservant les données dans les volumes)
./scripts/stop.sh

# Réinitialiser complètement la stack (⚠️ supprime les volumes et les données)
./scripts/reset.sh

# Seeder la base de données (migrations Prisma + création des campagnes/comptes)
./scripts/seed.sh
```

### Docker Compose

```bash
# État des conteneurs
docker compose ps

# Suivre les logs en continu
docker compose logs -f backend
docker compose logs -f edge-cv
docker compose logs -f smartqueue-ml

# Redémarrer un service après modification
docker compose restart backend

# Reconstruire sans le cache
docker compose build --no-cache edge-cv
```

### Base de données & Migrations (Prisma)

```bash
# Ouvrir l'explorateur visuel Prisma Studio
docker compose exec backend npx prisma studio --port 5555

# Créer une nouvelle migration après modification du schéma
docker compose exec backend npx prisma migrate dev --name <nom_migration>

# Appliquer les migrations en production / conteneur
docker compose exec backend npx prisma migrate deploy

# Régénérer le client TypeScript Prisma
docker compose exec backend npx prisma generate
```

### Tests et Validation Qualité

```bash
# Backend (Jest unit & e2e)
docker compose exec backend npm run test
docker compose exec backend npm run test:ci

# Frontend (Vite build & lint)
docker compose exec frontend npm run build

# Edge CV (pytest)
docker compose exec edge-cv pytest tests/ -v

# SmartQueue ML (pytest & détection d'anomalies)
docker compose exec smartqueue-ml pytest tests/ -v
```

---

## 📁 Structure du repository

```
/
├── apps/
│   ├── backend/                    # API NestJS 11 + Prisma ORM
│   │   ├── src/
│   │   │   ├── alerts/             # Module de gestion du cycle de vie des alertes
│   │   │   ├── audience-events/    # Ingestion et télémétrie des flux d'audience
│   │   │   ├── auth/               # Authentification JWT, Refresh Tokens, RBAC
│   │   │   ├── campaign-analytics/ # Métriques de performance, ROI, engagement DOOH
│   │   │   ├── campaigns/          # Gestion et ciblage dynamique des campagnes
│   │   │   ├── devices/            # Registre unifié (Caméras Edge & Displays/Totems)
│   │   │   ├── mqtt/               # Client MQTT NestJS & handlers d'événements
│   │   │   ├── sites/              # Gestion multi-sites & filtrage hiérarchique
│   │   │   └── settings/           # Configuration globale et seuils d'alertes
│   │   ├── prisma/                 # Schéma Prisma, migrations et script de seed
│   │   └── Dockerfile
│   │
│   ├── frontend/                   # Application React 18 + Vite + TypeScript
│   │   ├── src/
│   │   │   ├── api/                # Clients REST (Axios + TanStack Query)
│   │   │   ├── components/         # Composants UI réutilisables (Glassmorphism)
│   │   │   ├── layouts/            # DashboardLayout avec sélecteur de site
│   │   │   ├── locales/            # Traductions i18n (Français, Anglais)
│   │   │   ├── mqtt/               # Hooks et abonnements MQTT WebSocket temps réel
│   │   │   └── pages/              # Vues applicatives :
│   │   │       ├── alerts/         # Centre de gestion des alertes
│   │   │       ├── audience/       # Statistiques et profilage démographique
│   │   │       ├── cameras/        # Supervision des caméras & auto-pairing
│   │   │       ├── campaigns/      # Gestionnaire de campagnes publicitaires
│   │   │       ├── campaign-analytics/ # Analytics détaillés par campagne
│   │   │       ├── displays/       # Écrans totems et affichage dynamique
│   │   │       ├── fleet/          # Vue unifiée du parc de terminaux
│   │   │       ├── heatmap/        # Cartographie thermique de flux
│   │   │       └── sites/          # Configuration multi-sites
│   │   └── Dockerfile
│   │
│   ├── edge-cv/                    # Service Computer Vision (FastAPI + YOLOv8)
│   │   ├── app/                    # Pipeline de détection, streaming & publisher MQTT
│   │   ├── tests/                  # Tests unitaires et d'intégration CV
│   │   ├── yolov8n.pt              # Poids du modèle YOLOv8 pré-entraîné
│   │   └── Dockerfile
│   │
│   └── smartqueue-ml/              # Service Machine Learning (FastAPI + scikit-learn)
│       ├── app/                    # Prédiction de temps d'attente & anomalies Z-Score
│       ├── model_store/            # Sérialisation des modèles entraînés
│       ├── tests/                  # Tests de prédiction et alertes
│       └── Dockerfile
│
├── infrastructure/
│   ├── docker/
│   │   ├── postgres/               # Script d'initialisation TimescaleDB
│   │   └── mosquitto/              # Configuration Mosquitto & fichier d'authentification
│   ├── monitoring/
│   │   ├── prometheus.yml          # Règles de scraping Prometheus
│   │   ├── alerts.yml              # Alertes métriques Prometheus
│   │   └── grafana/                # Provisioning automatisé des datasources & dashboards
│   └── nginx/                      # Configuration de reverse-proxy
│
├── docs/                           # Documentation technique détaillée
│   ├── demo-guide.md               # Guide complet de démonstration E2E en direct
│   ├── camera-auto-pairing.md      # Spécification du protocole d'auto-pairing caméra
│   ├── mqtt-architecture.md        # Architecture des topics et messages MQTT
│   ├── gender-classification.md    # Documentation du modèle de classification
│   └── RAPPORT_AVANCEMENT_IAD_SMARTQUEUE.md # Bilan d'avancement du projet
│
├── scripts/
│   ├── demo.sh                     # Démonstrateur E2E tout-en-un
│   ├── start.sh                    # Démarrage de l'infrastructure
│   ├── stop.sh                     # Arrêt ordonné
│   ├── reset.sh                    # Nettoyage et réinitialisation complète
│   └── seed.sh                     # Migrations et insertion des données de base
│
├── docker-compose.yml              # Définition multi-conteneurs de l'infrastructure
├── .env.example                    # Modèle de variables d'environnement
└── README.md
```

---

## 📚 Documentation Technique Détaillée

Pour approfondir les aspects techniques, consultez les guides spécialisés dans le dossier `docs/` :

- 📖 [**Guide de Démonstration E2E**](docs/demo-guide.md) : Scénario complet pas à pas pour tester l'ensemble des fonctionnalités en direct.
- 📡 [**Auto-Pairing des Caméras**](docs/camera-auto-pairing.md) : Mécanisme d'enregistrement zéro-conférence via MQTT et réconciliation backend.
- 📬 [**Architecture MQTT & Télémétrie**](docs/mqtt-architecture.md) : Matrice des topics, payloads JSON et politique de rétention.
- 👤 [**Classification Démographique**](docs/gender-classification.md) : Pipeline d'inférence âge et genre avec gestion du consentement et vie privée.
- 📑 [**Index Documentaire Général**](docs/README.md) : Vue d'ensemble des 23 chapitres de documentation d'architecture.

---

## 🔒 Sécurité & Bonnes Pratiques

> ⚠️ **IMPORTANT** : Ne commitez **jamais** de fichier `.env` contenant des secrets de production.

Pour le passage en production :
- Remplacez impérativement **toutes** les valeurs `CHANGE_ME` de `.env` par des clés cryptographiquement robustes.
- Activez le chiffrement TLS/HTTPS sur Nginx et sécurisez les communications MQTT via TLS (port 8883 / wss 9003).
- Fermez l'accès externe direct aux ports sensibles (`5432`, `6379`, `1883`) via un pare-feu réseau.
- Activez les politiques de Content Security Policy (CSP) et les en-têtes de sécurité HTTP (Helmet).

---

## ✅ Checklist de vérification post-démarrage

Après avoir exécuté `./scripts/start.sh` ou `./scripts/demo.sh`, contrôlez :

- [ ] **Docker** : `docker compose ps` — tous les services affichent l'état `Up (healthy)`
- [ ] **PostgreSQL** : `docker compose exec postgres pg_isready -U iad_user` → accessible
- [ ] **Redis** : `docker compose exec redis redis-cli -a $REDIS_PASSWORD ping` → répond `PONG`
- [ ] **Mosquitto MQTT** : Broker accessible sur le port `1883` et WebSocket sur `9003`
- [ ] **Backend NestJS** : `curl http://localhost:3000/health` → `{"status":"ok"}`
- [ ] **Swagger UI** : [http://localhost:3000/api](http://localhost:3000/api) affiche l'OpenAPI interactive
- [ ] **Frontend React** : [http://localhost:5173](http://localhost:5173) affiche la mire de connexion
- [ ] **Edge CV** : `curl http://localhost:8001/health` → `{"status":"ok"}`
- [ ] **SmartQueue ML** : `curl http://localhost:8002/health` → `{"status":"ok"}`
- [ ] **MinIO Console** : [http://localhost:9001](http://localhost:9001) permet de se connecter
- [ ] **Grafana** : [http://localhost:3001](http://localhost:3001) affiche les dashboards opérationnels

---

## 🤝 Contribution & Règles Git

1. Créez une branche de travail : `git checkout -b feature/nom-de-la-fonctionnalite`
2. Effectuez vos modifications en respectant les normes de typage et de linting.
3. Rédigez des commits selon la convention **Conventional Commits** :
   - `feat:` Nouvelle fonctionnalité
   - `fix:` Résolution d'un bug
   - `refactor:` Refonte de code sans changement fonctionnel
   - `docs:` Mise à jour de la documentation
   - `chore:` Maintenance, dépendances, scripts
   - `test:` Ajout ou correction de tests unitaires / E2E
4. Soumettez une Pull Request vers `main` ou `develop`.

---

## 📄 Licence

MIT © Express Display 2025–2026
