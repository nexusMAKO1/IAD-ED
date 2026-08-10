# 23 - Audit de la Documentation

Ce document résume l'audit technique réalisé pour générer cette documentation. Les constatations ci-dessous reflètent l'état de l'art du code source au moment de l'analyse.

## 23.1 Fichiers Analysés

**Principaux Fichiers Explorés :**
* `docker-compose.yml` (428 lignes - Architecture DevOps)
* `README.md` (Original - 320 lignes)
* `apps/backend/package.json` (Dépendances Node/NestJS)
* `apps/frontend/package.json` (Dépendances React)
* `apps/edge-cv/requirements.txt` (Dépendances ML Vision)
* `apps/smartqueue-ml/requirements.txt` (Dépendances ML Temps réel)
* `apps/backend/prisma/schema.prisma` (Schéma BDD - 394 lignes)
* `apps/edge-cv/app/main.py` (Script d'inférence Python - >1100 lignes)
* *Plusieurs contrôleurs NestJS et fichiers React ont été parsés par script.*

## 23.2 Technologies Détectées

| Module | Technologie Principale |
| ------ | ---------------------- |
| **Backend** | Node.js 20, NestJS 11, Prisma 5, MQTT.js |
| **Frontend** | React 18, Vite 5, Tailwind 4, Radix UI |
| **Vision (Edge)** | Python 3, FastAPI, YOLOv8, ByteTrack, OpenCV |
| **Queue (ML)** | Python 3, FastAPI, scikit-learn |
| **Infrastructure**| Docker, PostgreSQL, TimescaleDB, Redis, Mosquitto, MinIO, Prometheus, Grafana |

## 23.3 API et Routes Détectées

**Backend (NestJS)** :
* `Auth` (5 endpoints)
* `Sites` (5 endpoints)
* `Devices` (7 endpoints)
* `Campaigns` (7 endpoints)
* `CampaignAnalytics` (9 endpoints)
* `AudienceEvents` (4 endpoints)
* `Health`, `Metrics`

**Vision (Edge CV)** :
* `GET /`, `GET /health`, `GET /status`, `GET /metrics/json`, `GET /snapshot`
* `POST /detect` (inférence YOLO en direct)

**SmartQueue ML** :
* `/queue/predict`, `/queue/status`, `/queue/anomalies`

## 23.4 Tables Détectées (Prisma)

14 Modèles majeurs identifiés :
1. `Device`
2. `Site`
3. `User`
4. `CameraMetadata`
5. `DisplayMetadata`
6. `Campaign`
7. `CampaignImpression`
8. `CampaignViewEvent`
9. `CampaignDailyStatistic`
10. `CampaignMetric`
11. `CampaignInsight`
12. `AudienceEvent`
13. `Ticket`
14. `MLModel`

## 23.5 Tests Détectés

* **NestJS** : Configuration Jest présente (`test`, `test:cov`, `test:e2e`).
* **Python** : Configuration Pytest présente dans `edge-cv` et `smartqueue-ml` avec des tests réels (ex: `test_e2e.py`).

## 23.6 Incohérences Notées

⚠️ **Documentation Inconsistency**

* **Documented Behavior (README original)** : "Les données de Machine Learning sont poussées vers AWS S3." (Supposition fréquente).
* **Actual Implementation** : Le projet utilise un serveur local **MinIO** S3-Compatible orchestré par Docker. Aucun export vers un véritable cloud AWS n'a été détecté dans le code.
* **Recommendation** : Les schémas d'architecture et les documentations (maintenant à jour) doivent refléter cet usage local/hybride exclusif de MinIO pour éviter toute confusion lors des audits de sécurité (data residency).

## 23.7 Informations Manquantes

Certains éléments n'ont pas pu être identifiés et restent à confirmer par l'équipe métier :
* Le processus d'intégration du matériel physique (Caméras et Écrans). Y a-t-il un firmware maison ou l'Edge-CV est-il flashé manuellement ?
* Les détails de la CI/CD (`.github/workflows/ci.yml`) car le fichier n'a pas été inspecté ligne par ligne.

## 23.8 Recommandations Prioritaires (Top 3)

1. **Gérer les Secrets** : Éviter d'utiliser `.env` pour stocker des mots de passe en production, préférer Docker Secrets ou HashiCorp Vault.
2. **TLS MQTT** : Activer le TLS (port 8883 et 9004 WSS) sur Mosquitto pour éviter que les `audience_events` soient interceptables sur le réseau local.
3. **Data Retention** : Mettre en place la politique de rétention (compression TimescaleDB) pour la table `audience_events` avant un déploiement réel.
