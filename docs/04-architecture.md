# 04 - Architecture Globale

Cette section détaille l'architecture générale du système IAD & SmartQueue AI. L'architecture est orientée microservices et s'articule autour d'un flux de données temps réel (MQTT) et transactionnel (REST).

## 4.1 Vue d'ensemble des Composants

L'infrastructure se divise en quatre grandes zones :

1. **Frontend (Client Web)** :
   * Interface utilisateur développée en React (Vite) en TypeScript.
   * Communique avec le Backend via API REST et reçoit des données en temps réel via MQTT sur WebSockets.
2. **Backend (Logique Métier & API)** :
   * Serveur Node.js développé avec le framework NestJS.
   * Utilise Prisma ORM pour dialoguer avec la base de données.
   * Point de contrôle central : authentification, gestion de flotte, campagnes publicitaires, historique des audiences.
3. **Services IA (Edge & ML)** :
   * **Edge-CV** : Application Python (FastAPI + YOLOv8 + ByteTrack) conçue pour s'exécuter "en périphérie" (sur la caméra ou un boîtier local). Intercepte le flux vidéo, détecte et suit les personnes, estime leur âge, et publie l'audience sur MQTT.
   * **SmartQueue ML** : Application Python (FastAPI + scikit-learn) dédiée aux modèles prédictifs des files d'attente (temps d'attente, détection d'anomalies).
4. **Infrastructure de données & Services Tiers** :
   * **PostgreSQL + TimescaleDB** : Base de données principale relationnelle et séries temporelles.
   * **Redis** : Cache en mémoire et éventuellement Pub/Sub interne.
   * **Mosquitto** : Broker MQTT pour la communication asynchrone et IoT.
   * **MinIO** : Stockage objet (S3-compatible) pour les médias de campagnes et les modèles YOLO/ML.
   * **Prometheus & Grafana** : Monitoring, scraping des métriques (`/metrics`) et tableaux de bord opérationnels.

## 4.2 Diagramme d'Architecture

*Voir également [diagrams/architecture.md](diagrams/architecture.md) pour le code Mermaid.*

```mermaid
flowchart TD
    subgraph Clients
        WebUI[Dashboard Frontend (React)]
        EdgeCam[Edge Camera (FastAPI + YOLO)]
        Kiosk[Display / Kiosk]
    end

    subgraph Infrastructure
        Broker((Mosquitto MQTT))
        Cache[(Redis)]
        DB[(PostgreSQL + TimescaleDB)]
        Storage[(MinIO S3)]
    end

    subgraph Core Services
        API[Backend API (NestJS)]
        ML[SmartQueue ML (FastAPI)]
    end

    WebUI -- "REST (HTTP)" --> API
    WebUI -- "WebSockets (Port 9003)" --> Broker
    
    EdgeCam -- "Pub/Sub (Port 1883)" --> Broker
    EdgeCam -- "Pull Models" --> Storage
    
    Kiosk -- "Pub/Sub" --> Broker
    Kiosk -- "Fetch Media" --> Storage

    Broker -- "Pub/Sub" --> API
    
    API -- "Prisma" --> DB
    API -- "Cache" --> Cache
    API -- "Media Upload" --> Storage
    
    API -- "REST (Predict)" --> ML
    ML -- "SQL" --> DB
    ML -- "Cache" --> Cache
```

## 4.3 Flux de données principal (Data Flow)

1. **Génération (Edge)** : `edge-cv` traite 30 images par seconde, détecte 5 personnes, et publie `{ count: 5, ... }` sur un topic MQTT.
2. **Ingestion (Backend)** : `backend` est abonné au topic MQTT. Il reçoit le payload JSON, l'enrichit (validation, rattachement au `siteId`) et l'insère massivement dans la table hypertable `audience_events` (TimescaleDB) via Prisma.
3. **Restitution (Frontend)** : Le `frontend` interroge le backend via REST pour les graphiques historiques (agrégation par heure/jour). En parallèle, il est connecté au broker MQTT via WebSockets pour afficher le "Live Analytics" sans recharger la page.
