# 22 - Changelog

L'historique détaillé des commits Git n'est pas intégralement exposé ici. Ce document liste les évolutions majeures déduites de l'analyse du projet.

## v0.1.0 (Version Initiale)

**Fonctionnalités Principales :**
* Déploiement de l'architecture microservices via `docker-compose.yml`.
* Création de l'API Backend (NestJS 11).
* Création de l'interface d'administration Frontend (React 18 / Vite).
* Intégration de la base de données PostgreSQL avec Prisma (Modèles `Sites`, `Devices`, `Campaigns`, `AudienceEvents`).
* Composant IA Edge-CV (FastAPI + YOLOv8) avec streaming RTSP et snapshot JPEG.
* Composant IA SmartQueue ML (FastAPI) pour l'estimation d'attente (scikit-learn).
* Intégration de MQTT (Mosquitto) pour la communication bidirectionnelle en temps réel.
* Ajout de MinIO pour le stockage S3 des médias.

**Sécurité & Authentification :**
* Mise en place de l'authentification JWT (`accessToken` / `refreshToken`).
* Hiérarchie des rôles (`ADMIN`, `MANAGER`, `AGENT`).

**Monitoring :**
* Stack de monitoring avec Prometheus et Grafana incluse dès la v0.1.0.
* Exporters configurés pour Redis, Postgres, MQTT.
