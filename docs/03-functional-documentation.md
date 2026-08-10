# 03 - Documentation Fonctionnelle

Cette section détaille les fonctionnalités réellement implémentées et observables dans le code source du projet.

## 3.1 Gestion des Sites et des Appareils (Fleet Management)

### Objectif
Permettre à un administrateur d'organiser l'infrastructure en sites physiques et d'y associer les périphériques.

### Utilisateur concerné
ADMIN, MANAGER.

### Étapes
1. Création d'un site (nom, adresse, seuils d'anomalie/densité).
2. Découverte automatique d'un appareil (`DeviceStatus.UNPAIRED`) lorsque celui-ce se connecte au broker MQTT.
3. Assignation de l'appareil à un site spécifique.
4. L'appareil passe en statut `ONLINE`.

### Résultat
La base de données relie le périphérique (ex: Caméra ou Écran) à un Site. Les données analytiques générées par cet appareil seront attribuées au Site.

### Fichiers concernés
* Backend: `sites.controller.ts`, `devices.controller.ts`
* Frontend: `SitesPage.tsx`, `FleetPage.tsx`, `DeviceFormDialog.tsx`, `PairDisplayModal.tsx`

---

## 3.2 Vision par Ordinateur (Détection et Démographie)

### Objectif
Traiter un flux vidéo en direct pour compter les personnes et extraire des métriques d'audience sans enregistrer l'image (RGPD-compliant).

### Utilisateur concerné
EDGE_CAMERA (Système automatisé).

### Étapes
1. Capture d'image par la caméra (ou flux RTSP).
2. Traitement par le modèle YOLOv8 via `edge-cv` (`POST /detect` ou boucle CLI).
3. Suivi des individus (ByteTrack) pour éviter de compter la même personne deux fois.
4. Estimation de l'âge (Adult, Senior, Young).
5. Publication d'un événement MQTT contenant : `person_count`, `age_group`, etc.
6. Le Backend ingère l'événement et l'enregistre dans la table `audience_events`.

### Règles métier
* Les images brutes ne sont jamais sauvegardées. Seules les métadonnées (coordonnées, âge estimé, ID de suivi) sont transmises.

### Fichiers concernés
* Edge CV: `app/main.py`, `app/detector.py`, `app/demographics/age_estimation.py`, `app/tracking/bytetrack.py`
* Backend: `audience-events.controller.ts`

---

## 3.3 Campagnes Publicitaires et Analytics (Impressions)

### Objectif
Gérer et diffuser des médias publicitaires, puis mesurer leur performance réelle basée sur l'attention du public.

### Utilisateur concerné
MANAGER, ADMIN, DISPLAY.

### Étapes
1. Le manager crée une campagne (vidéo/image téléversée sur MinIO) via le frontend.
2. Définition des critères de ciblage (tranche d'âge, heures actives).
3. Le backend ordonne la diffusion de la campagne sur les écrans appropriés.
4. L'écran notifie le backend qu'il joue la campagne (Création d'une `CampaignImpression`).
5. Les caméras associées mesurent les regards (`CampaignViewEvent`).
6. Les données sont agrégées (`CampaignDailyStatistic`, `CampaignMetric`) par des tâches CRON.

### API utilisées
* Backend: `/campaigns/*` (Création, Upload, Analytics, Insights).

### Fichiers concernés
* Backend: `campaigns.controller.ts`, `campaign-analytics.controller.ts`
* DB: `Campaign`, `CampaignImpression`, `CampaignViewEvent`, `CampaignDailyStatistic`
* Frontend: `CampaignsPage.tsx`, `CampaignPerformancePage.tsx`, `CampaignDetailPage.tsx`

---

## 3.4 Prédiction de File d'Attente

### Objectif
Prédire le temps d'attente et détecter les anomalies dans le flux de la file.

### Utilisateur concerné
TICKET_KIOSK, AGENT, SmartQueue ML.

### Étapes
1. Interrogation de l'API ML (`/queue/predict` ou `/queue/predict/batch`).
2. Le service ML utilise `scikit-learn` et l'historique en base de données pour formuler une prédiction.
3. Vérification des anomalies (`/queue/anomalies`) par le service ML en fonction de seuils statistiques (Z-Score).

### Fichiers concernés
* SmartQueue ML: `app/routers/predict.py`, `app/routers/alerts.py`
* DB: `Ticket`

---

## 3.5 Gestion de la Configuration et des Identifiants MQTT

### Objectif
Permettre au backend de configurer dynamiquement les caméras edge via le réseau local.

### Étapes
1. Un changement est initié depuis le frontend.
2. Le backend publie un message MQTT sur le topic de commande de la caméra.
3. Le script MQTT dans `edge-cv` (`main.py`) intercepte le message et met à jour ses configurations internes (ex: `siteId`, `zoneId`, `confidence`) en utilisant `save_identity`.
