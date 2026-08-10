# Diagramme d'Architecture (Mermaid)

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
