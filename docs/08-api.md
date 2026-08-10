# 08 - API (Interfaces de Programmation)

Le système expose deux formes d'API : une API RESTful classique via NestJS pour le portail d'administration, et des API spécialisées via FastAPI (ML, Edge CV).

## 8.1 API Backend Principale (NestJS - Port 3000)

Toutes les requêtes (sauf Auth) nécessitent un jeton JWT valide dans l'en-tête : `Authorization: Bearer <token>`.

### Authentication
* `POST /auth/login` : Authentification utilisateur.
* `POST /auth/refresh` : Rafraîchir un JWT via le refresh token.
* `GET /auth/profile` : Obtenir les infos de l'utilisateur connecté.

### Sites & Devices
* `GET /sites` : Liste des sites (filtrée selon le rôle).
* `POST /sites` : Création de site (Admin uniquement).
* `GET /devices` : Liste des périphériques et de leur état en direct.
* `POST /devices/:id/assign-site` : Appairage d'un périphérique à un site.
* `POST /devices/:id/restart` : Envoie un ordre MQTT de redémarrage à l'appareil matériel.

### Campaigns
* `POST /campaigns` : Création d'une nouvelle campagne.
* `POST /campaigns/upload` : Upload de fichier média vers MinIO (multipart/form-data).
* `GET /campaigns/active` : Récupération par un écran de sa playlist actuelle.
* `GET /campaigns/:id/performance` : Indicateurs de performance d'une campagne.

### Audience Analytics
* `GET /sites/:siteId/audience-events` : Historique brut filtrable.
* `GET /sites/:siteId/demographics` : Agrégration d'âge et de genre sur une période.
* `GET /sites/:siteId/timeseries` : Données formatées pour être dessinées par les graphiques du frontend.

---

## 8.2 API Edge-CV (FastAPI - Port 8001)

Ces endpoints sont exposés par la caméra ou le processeur périphérique.

### Détection
* `POST /detect` : Exécute l'inférence YOLO sur une image binaire envoyée en `multipart/form-data`. Retourne un JSON avec les "Bounding boxes" et le score de confiance.

### Télémétrie et Diagnostic
* `GET /snapshot` : Renvoie une image JPEG capturée directement depuis la caméra en temps réel (utilisé pour un live feed sans RTSP ou pour débugger).
* `GET /status` : Informations de runtime (CPU, RAM, état de la caméra, FPS).
* `GET /metrics/json` : Idem mais formaté pour les tableaux de bord.

---

## 8.3 API SmartQueue ML (FastAPI - Port 8002)

Service interrogé par le Backend ou directement par les Kiosques à tickets.

* `GET /queue/predict` : Prédit le temps d'attente estimé en fonction de la charge actuelle et du type de service.
* `GET /queue/status` : État global de la file d'attente (longueur, engorgement).
* `GET /queue/anomalies` : Détecte statistiquement (Z-Score) les temps d'attente anormalement longs pour déclencher des alertes côté backend.
