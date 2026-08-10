# 06 - Architecture Backend

Le Backend central est le chef d'orchestre du projet. Il expose des API REST, communique avec la base de données via Prisma, s'abonne au broker MQTT, et coordonne les actions des autres services.

## 6.1 Technologies

| Technologie | Version | Utilisation | Localisation |
| ----------- | ------- | ----------- | ------------ |
| **Node.js** | 20 LTS | Environnement d'exécution | `apps/backend/package.json` |
| **NestJS** | 11.1.27 | Framework Backend principal | `apps/backend/package.json` |
| **Prisma** | 5.16.0 | ORM (Object-Relational Mapping) | `apps/backend/prisma/` |
| **TypeScript** | 5.4.5 | Typage statique | `apps/backend/tsconfig.json` |
| **Passport & JWT** | 11.x / 4.x | Authentification | `apps/backend/package.json` |
| **MQTT.js** | 5.10.1 | Client MQTT (Broker) | `apps/backend/package.json` |
| **MinIO (SDK)** | 8.0.7 | Accès au stockage d'objets (S3) | `apps/backend/package.json` |
| **Prom-client** | 15.1.3 | Exposition de métriques Prometheus | `apps/backend/package.json` |

## 6.2 Modèle MVC / Modulaire (NestJS)

Le code (dans `apps/backend/src/`) est architecturé selon les concepts de modules, contrôleurs et services propres à NestJS :

```text
Client (Web/Mobile)
       ↓ (HTTP REST)
Controller (ex: CampaignsController)  <-- Validation (class-validator / DTO)
       ↓
Service (ex: CampaignsService)        <-- Logique métier
       ↓
Repository (Prisma Service)           <-- Couche d'abstraction BDD
       ↓
Database (PostgreSQL)
```

## 6.3 Contrôleurs & Modules identifiés

L'analyse du code source révèle l'existence des modules et contrôleurs suivants :

* **`Auth`** (`auth.controller.ts`) : Connexion, déconnexion, rafraîchissement de jeton, profil.
* **`Sites`** (`sites.controller.ts`) : CRUD des sites physiques et gestion de leurs seuils.
* **`Devices`** (`devices.controller.ts`) : CRUD et gestion du cycle de vie des périphériques matériels (assignation à un site, redémarrage).
* **`Campaigns`** (`campaigns.controller.ts`) : CRUD des campagnes publicitaires, gestion de l'upload des médias vers MinIO.
* **`CampaignAnalytics`** (`campaign-analytics.controller.ts`) : Lecture des statistiques, performances, leaderboards et exports des campagnes.
* **`AudienceEvents`** (`audience-events.controller.ts`) : Restitution des données démographiques, statistiques et timeseries de fréquentation collectées par les caméras.
* **`Settings`** (`settings.controller.ts`) : Gestion des paramètres système (accès réservé ADMIN/MANAGER).
* **`Health`** (`health.controller.ts`) : Sondes de vérification pour Docker/Kubernetes.
* **`Metrics`** (`metrics.controller.ts`) : Exposition des métriques (y compris Prisma) au format Prometheus pour le scraping.

## 6.4 Communication Asynchrone (MQTT)

Le backend agit comme un client MQTT majeur :
1. Il écoute les envois de "découverte" (heartbeats) des nouveaux périphériques et les enregistre dans la base.
2. Il écoute les événements d'audience (`audience_events`) provenant de `edge-cv` et les persiste.
3. Il envoie des commandes de mise à jour de configuration ou de redémarrage aux périphériques.
