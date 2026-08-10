# 17 - Maintenance (Where to change what?)

Ce guide permet à un futur développeur de savoir rapidement où modifier le code en fonction des évolutions demandées par le métier.

## 17.1 Where to change what?

| Besoin | Emplacement (Projet) | Fichiers / Modules impactés |
| ------ | -------------------- | --------------------------- |
| **Modifier le schéma de base de données** | Backend | `apps/backend/prisma/schema.prisma` (exécuter `prisma migrate dev` après modif). |
| **Ajouter une nouvelle route API** | Backend | Créer un nouveau controller dans `apps/backend/src/` et l'enregistrer dans un module. |
| **Modifier la détection d'objets (YOLO)** | Edge CV | `apps/edge-cv/app/detector.py` et `app/main.py`. |
| **Ajouter une page au Tableau de bord** | Frontend | `apps/frontend/src/pages/` (créer le composant) et l'ajouter au router principal. |
| **Modifier le tracking multi-objets** | Edge CV | `apps/edge-cv/app/tracking/bytetrack.py`. |
| **Ajouter une nouvelle métrique Prometheus** | Backend | `apps/backend/src/metrics/metrics.controller.ts` (ou le service associé utilisant `prom-client`). |
| **Mettre à jour l'estimation d'âge** | Edge CV | `apps/edge-cv/app/demographics/age_estimation.py`. |
| **Changer l'algorithme de prédiction (File d'attente)**| ML | `apps/smartqueue-ml/app/routers/predict.py`. |
| **Gérer l'upload des médias (S3)** | Backend | `apps/backend/src/campaigns/campaigns.controller.ts`. |
| **Modifier les composants graphiques natifs** | Frontend | `apps/frontend/src/components/ui/` (Tailwind / Radix UI). |

## 17.2 Mise à jour des dépendances

* **Node.js (Backend & Frontend)** : Utiliser `npm install <package>@latest` dans les dossiers respectifs `apps/backend` ou `apps/frontend`.
* **Python (Edge CV & ML)** : Modifier manuellement les versions dans les fichiers `requirements.txt` puis reconstruire les images Docker (`docker compose build`).

## 17.3 Backups de la Base de données

La base PostgreSQL (TimescaleDB) contient le volume massif d'historique. 
Pour effectuer un dump :
```bash
docker compose exec postgres pg_dump -U iad_user -d iad_db -F c -f /tmp/backup.dump
```
