# 01 - Aperçu du projet

## 1.1 Contexte

Le projet **IAD & SmartQueue AI** (Infrastructure Intelligence Artificielle & File d'Attente Intelligente - Express Display) existe pour fournir une solution globale d'analyse vidéo en temps réel et de gestion d'affluence. Il combine des modèles de vision par ordinateur déployés en périphérie (Edge Computing) avec une infrastructure centralisée pour traiter, analyser et visualiser les données.

## 1.2 Problématique

Les espaces physiques (magasins, guichets, événements) manquent souvent de visibilité en temps réel sur l'affluence, la densité de foule, et les temps d'attente. Cela entraîne une gestion sous-optimale des files d'attente et une dégradation de l'expérience client. De plus, le déploiement de modèles d'IA lourds (comme YOLO) nécessite une architecture robuste capable de traiter les flux vidéo à la source (Edge) et de remonter les informations utiles de manière asynchrone (MQTT).

## 1.3 Objectifs

**Objectifs fonctionnels :**
* Détecter les personnes en temps réel via des flux vidéo (caméras ou systèmes embarqués).
* Estimer l'âge et les attributs démographiques des personnes détectées.
* Analyser la densité des zones et gérer des files d'attente.
* Afficher des campagnes publicitaires ciblées sur des écrans (Kiosques) en fonction de l'audience.
* Fournir un tableau de bord (Dashboard) pour la visualisation des métriques (affluence, temps d'attente, efficacité des campagnes).

**Objectifs techniques :**
* Mettre en place une architecture modulaire et scalable (microservices Docker).
* Garantir une communication bas-latence entre les caméras et le serveur via MQTT.
* Assurer la persistance des données analytiques avec PostgreSQL et TimescaleDB.
* Exposer des API RESTful via NestJS et FastAPI.

## 1.4 Utilisateurs

Les différents types d'utilisateurs identifiés dans le système sont (définis par l'énumération `UserRole`) :
* **ADMIN** : Accès complet au système, configuration des sites, gestion des utilisateurs, des appareils (caméras, kiosques), et des campagnes.
* **MANAGER** : Supervision d'un ou plusieurs sites, accès aux tableaux de bord analytiques et gestion des campagnes locales.
* **AGENT** : Opérateur terrain (ex: guichet) traitant les tickets générés par la file d'attente, ou consultant les alertes d'affluence.

## 1.5 Périmètre

**Inclus dans le système :**
* Inférence de vision par ordinateur (YOLOv8) via l'application `edge-cv`.
* Prédictions et modèles statistiques de file d'attente via `smartqueue-ml`.
* Backend de gestion (API NestJS) gérant les entités (Sites, Devices, Campaigns, Tickets, Analytics).
* Base de données relationnelle et temporelle (PostgreSQL + TimescaleDB).
* Broker MQTT (Mosquitto) pour l'IoT et le temps réel.
* Stockage S3 (MinIO) pour les médias de campagnes et les modèles.
* Frontend React de visualisation (Tableau de bord).

**Exclus du système :**
* Hardware (caméras physiques, écrans, totems).
* Les systèmes externes de paiement ou CRM (non identifiés dans le projet).

## 1.6 État du projet

* **Fonctionnalités terminées** : Infrastructure Docker complète, intégration MQTT, modèles de base de données complets via Prisma, service Edge CV (YOLOv8, ByteTrack), dashboard React.
* **Fonctionnalités partielles / en développement** : À confirmer selon l'intégration fine entre SmartQueue ML et le backend.
* **Éléments manquants** : Procédures de déploiement Cloud (Kubernetes ou CI/CD de production) au-delà du `docker-compose.yml` local.
