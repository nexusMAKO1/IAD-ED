# 20 - Roadmap et Recommandations

Cette section propose une vision des prochaines étapes pour améliorer l'infrastructure, la sécurité et les fonctionnalités du projet.

## 20.1 Améliorations Critiques (Court-terme)

* **TLS pour MQTT et HTTP** : Sécuriser les flux de données (WebSockets et TCP) en production avec des certificats TLS/SSL.
* **Accélération Matérielle (GPU)** : S'assurer que le service Edge-CV utilise l'accélération matérielle locale (CUDA, TensorRT) en configurant correctement les environnements d'exécution Docker.
* **Rétention des données TimescaleDB** : Définir une politique de nettoyage automatique des événements de séries temporelles de plus de 6 mois pour éviter la saturation disque.

## 20.2 Améliorations Importantes (High - Moyen-terme)

* **Tests de Charge (Load Testing)** : Simuler 100+ caméras envoyant des événements d'audience simultanément pour vérifier la résilience du Broker MQTT et la capacité d'ingestion du Backend NestJS.
* **Mise en cache Redis** : Optimiser les requêtes lourdes (comme le calcul des statistiques démographiques mensuelles) en utilisant Redis Cache de manière proactive.
* **Orchestration (Kubernetes)** : Migrer le `docker-compose.yml` monolithique vers une architecture distribuée (K3s / Kubernetes) si le projet doit supporter une scalabilité horizontale (multiples instances backend).

## 20.3 Optimisations Utiles (Medium)

* **Modèle ML Démographique** : Remplacer l'estimation de l'âge heuristique (Edge-CV) par un modèle de Machine Learning ONNX léger et précis.
* **Alerting Automatisé (Grafana)** : Configurer Grafana ou Alertmanager (via `alerts.yml`) pour envoyer des notifications (Slack/Email) lorsqu'un appareil Edge-CV passe en mode `OFFLINE` ou `DEGRADED`.

## 20.4 Optimisations Secondaires (Low)

* **Tests E2E Frontend** : Implémenter Playwright.
* **Mode Hors-Ligne (Edge)** : Permettre au service `edge-cv` de stocker localement les `audience_events` si la connexion réseau est coupée, et de les synchroniser avec le backend dès le retour de la connexion (Store and Forward).
