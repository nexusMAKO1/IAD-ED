# 13 - Déploiement

Le système de déploiement actuel repose entièrement sur **Docker** et **Docker Compose**.
Aucun processus de déploiement cloud complexe (Kubernetes, Terraform) ou pipeline CI/CD automatisé de déploiement continu n'est identifiable dans le répertoire. Une action GitHub (`.github/workflows/ci.yml`) existe, mais elle est dédiée à l'intégration continue (Tests & Build), et non au déploiement automatisé.

## 13.1 Stratégie Actuelle (VPS / Bare Metal)

Pour déployer en production, l'approche observée consiste à cloner le dépôt sur un serveur hôte (Ubuntu, Debian, etc.) disposant de Docker, et de lancer l'infrastructure via le fichier `docker-compose.yml`.

Le `docker-compose.yml` inclut une gestion fine des dépendances (`depends_on: condition: service_healthy`) et des restart policies (`restart: unless-stopped`), le rendant apte pour un serveur mono-nœud.

## 13.2 Déploiement des Caméras (Edge)

Le service `edge-cv` est conçu pour tourner sur la machine "Edge" locale (proche des caméras).
* Soit le serveur central et les caméras sont sur le même réseau local (Edge et Backend sur la même machine).
* Soit `edge-cv` tourne sur un boîtier dédié (NVIDIA Jetson, Raspberry Pi) et se connecte au serveur MQTT distant via une URL publique/VPN (spécifiée par `MQTT_HOST`).

## 13.3 Recommandations pour la Production

> Aucun processus de déploiement avancé n'est identifiable dans le projet.

Pour une véritable mise en production, il est recommandé de :
1. Configurer un **Reverse Proxy (Nginx / Traefik)** pour exposer uniquement le Frontend et l'API sur les ports 80/443.
2. Sécuriser les communications avec **SSL/TLS (Let's Encrypt)**.
3. Isoler la base de données (PostgreSQL) des accès extérieurs (ne pas exposer le port 5432 sur l'hôte public).
4. Mettre en place un outil d'orchestration (K3s ou Docker Swarm) si le nombre d'écrans et de caméras devient très important.
