# 21 - Glossaire

Ce glossaire répertorie les termes techniques et métier utilisés au sein du projet **IAD & SmartQueue AI**.

## A

* **Agent** : Employé travaillant sur un site physique (ex: au guichet) et utilisant l'application pour gérer la file d'attente ou consulter des alertes.
* **Audience Event** : Événement horodaté représentant une mesure d'audience (nombre de personnes, densité, répartition par âge) capturé par une caméra (Edge-CV).

## B

* **ByteTrack** : Algorithme de suivi multi-objets (Multi-Object Tracking) utilisé dans le service `edge-cv` pour attribuer un identifiant unique temporaire (Track ID) à chaque personne détectée, évitant de la recompter à chaque frame.

## C

* **Campaign (Campagne)** : Contenu publicitaire (vidéo ou image) configuré pour être diffusé sur des écrans (Kiosques) sous certaines conditions (ciblage).
* **Computer Vision (CV)** : Branche de l'intelligence artificielle permettant aux ordinateurs de comprendre le contenu d'images ou de vidéos. Utilisé ici pour la détection de personnes.

## D

* **Device (Appareil)** : Périphérique matériel connecté au système. Peut être une caméra (Edge Camera) ou un écran (Display).
* **Dwell Time** : Temps d'arrêt ou temps passé par une personne dans une zone donnée (souvent devant un écran).

## E

* **Edge Computing (Edge)** : Paradigme consistant à traiter les données (ici l'inférence YOLO) directement sur l'appareil source (la caméra ou un boîtier connecté) plutôt que d'envoyer tout le flux vidéo sur le cloud. Cela préserve la bande passante et la vie privée.

## H

* **Heartbeat** : Signal régulier envoyé par un appareil (via MQTT) au serveur pour indiquer qu'il est en ligne et fonctionnel.

## I

* **IAD** : Intelligence Artificielle en Détection.
* **Impression** : Fait qu'une campagne publicitaire ait été jouée sur un écran pendant une durée déterminée.

## M

* **MinIO** : Serveur de stockage d'objets compatible avec l'API Amazon S3. Utilisé pour stocker les fichiers médias (vidéos, images) des campagnes publicitaires.
* **MQTT (Message Queuing Telemetry Transport)** : Protocole de messagerie léger (Publish/Subscribe) conçu pour l'Internet des objets (IoT). Utilisé pour la communication en temps réel entre le backend, le frontend (via WebSockets), et les appareils physiques (caméras).

## N

* **NestJS** : Framework Node.js progressif utilisé pour construire l'API Backend du projet.

## P

* **Prisma** : ORM (Object-Relational Mapping) moderne pour Node.js et TypeScript, utilisé par le Backend pour interagir avec la base de données PostgreSQL de manière typée.
* **Prometheus** : Système de monitoring open-source. Il collecte ("scrape") les métriques exposées par les différents services.

## S

* **Scikit-learn** : Bibliothèque Python d'apprentissage automatique (Machine Learning) utilisée par le service SmartQueue ML.
* **Site** : Emplacement physique (magasin, bâtiment) regroupant des appareils (caméras, écrans) et des utilisateurs.
* **SmartQueue** : Système intelligent de gestion de file d'attente (prédictions, temps d'attente).

## T

* **TimescaleDB** : Extension pour PostgreSQL optimisée pour les données de séries temporelles (time-series). Utilisée pour stocker et interroger efficacement les millions d'événements d'audience générés par les caméras.

## V

* **Vite** : Outil de build frontend rapide utilisé pour l'application React.

## Y

* **YOLO (You Only Look Once)** : Modèle de détection d'objets en temps réel par réseau de neurones. La version YOLOv8 est utilisée dans ce projet pour la détection de personnes.
