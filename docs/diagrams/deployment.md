# Diagramme de Déploiement (Mermaid)

```mermaid
flowchart TD
    subgraph Physical Site
        Camera1[Edge Camera]
        Camera2[Edge Camera]
        Screen1[Digital Kiosk]
    end

    subgraph Docker Host (Server / VPS)
        Proxy[Nginx / Reverse Proxy]
        
        subgraph Docker Compose Network
            FE[Frontend React]
            BE[Backend NestJS]
            ML[SmartQueue ML]
            
            MQTT((Mosquitto Broker))
            Cache[(Redis Cache)]
            DB[(PostgreSQL + TimescaleDB)]
            Minio[(MinIO S3 Storage)]
            
            Prom[Prometheus]
            Graf[Grafana]
        end
    end

    Camera1 -- MQTT --> MQTT
    Camera2 -- MQTT --> MQTT
    Screen1 -- MQTT / HTTP --> Proxy

    Proxy -- HTTP :3000 --> BE
    Proxy -- HTTP :5173 --> FE
    Proxy -- WS :9003 --> MQTT
    
    FE --> Proxy
    
    BE --> DB
    BE --> Cache
    BE --> MQTT
    BE --> ML
    BE --> Minio
```
