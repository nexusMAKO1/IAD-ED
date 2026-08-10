# 02 - Contexte métier

## 2.1 Enjeux

Le besoin fondamental auquel répond **IAD & SmartQueue AI** est l'optimisation des parcours clients dans des lieux physiques (retail, aéroports, guichets d'administration) et la monétisation de l'audience par l'affichage publicitaire ciblé.

**Les défis identifiés :**
1. **Temps d'attente** : L'incertitude sur la longueur des files d'attente crée de la frustration chez les usagers.
2. **Ciblage publicitaire** : Les affichages numériques traditionnels diffusent du contenu de manière séquentielle, sans s'adapter aux personnes qui les regardent.
3. **Supervision** : Les managers d'infrastructures physiques n'ont pas de données objectives et en temps réel sur l'occupation de leurs espaces.

## 2.2 Acteurs et Rôles

Le système s'articule autour de plusieurs acteurs (humains et machines) interagissant via le réseau.

### 2.2.1 Utilisateurs Humains

| Rôle | Description | Permissions |
| ---- | ----------- | ----------- |
| **Administrateur (ADMIN)** | Gère la plateforme au niveau global. | Création/suppression de sites, gestion de tous les appareils (caméras, écrans), configuration système globale, gestion des utilisateurs, accès total aux dashboards. |
| **Manager (MANAGER)** | Supervise un ou plusieurs sites spécifiques. | Accès aux statistiques de ses sites (audience, files d'attente), gestion des campagnes publicitaires locales, configuration des seuils d'alerte (densité). |
| **Agent (AGENT)** | Employé sur le terrain interagissant avec le public. | Consultation des tickets de la file d'attente, changement de statut des tickets, réception des alertes locales. |

### 2.2.2 Acteurs Systèmes / Périphériques (Devices)

L'énumération `DeviceType` définit les types d'acteurs matériels :
* **EDGE_CAMERA** : Caméra intelligente traitant le flux vidéo localement (via le composant `edge-cv`) et publiant des événements d'audience via MQTT.
* **DISPLAY** / **TOTEM** / **WAITING_ROOM_SCREEN** : Écrans diffusant des campagnes publicitaires ou des informations d'attente. Ils reçoivent les commandes du backend et remontent des impressions publicitaires.
* **TICKET_KIOSK** : Borne permettant aux utilisateurs finaux de prendre un ticket pour une file d'attente.

## 2.3 Cas d'utilisation (Use Cases) principaux

* **Cas 1 : Détection d'audience (Edge CV)**
  * *Acteur* : EDGE_CAMERA
  * *Objectif* : Identifier combien de personnes se trouvent dans le champ de vision, leur âge estimé et leur temps d'attention.
  * *Scénario principal* : La caméra capture une image, exécute YOLOv8, suit les personnes (ByteTrack), estime leur âge, puis publie un rapport d'audience sur le broker MQTT.
* **Cas 2 : Affichage de campagne adaptative**
  * *Acteur* : DISPLAY, Backend
  * *Objectif* : Diffuser une campagne pertinente en fonction de l'audience.
  * *Scénario principal* : Le backend reçoit les données démographiques actuelles de la caméra, sélectionne la campagne publicitaire la plus pertinente pour cette audience, et ordonne à l'écran (DISPLAY) de la lire via MQTT.
* **Cas 3 : Prédiction de file d'attente (SmartQueue ML)**
  * *Acteur* : SmartQueue ML, TICKET_KIOSK, AGENT
  * *Objectif* : Estimer le temps d'attente pour un nouveau ticket.
  * *Scénario principal* : L'utilisateur prend un ticket. Le backend interroge le service ML qui calcule une estimation basée sur la moyenne historique et l'état actuel. L'estimation est affichée sur le ticket.
* **Cas 4 : Consultation des analyses (Dashboard)**
  * *Acteur* : MANAGER, ADMIN
  * *Objectif* : Analyser la performance d'un site.
  * *Scénario principal* : Le Manager se connecte, consulte la page de "Live Analytics", visualisant les graphiques de fréquentation générés par l'historique PostgreSQL (TimescaleDB).
