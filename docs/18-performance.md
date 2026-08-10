# 18 - Performance

Cette section identifie les goulets d'étranglement potentiels et les impacts sur les performances du système actuel.

## 18.1 Analyse des Performances

| Problème Potentiel | Impact | Priorité | Recommandation |
| ------------------ | ------ | -------- | -------------- |
| **Inférence YOLO sans GPU** | Si le service `edge-cv` tourne sur un CPU standard, le framerate (FPS) sera drastiquement réduit (potentiellement < 5 FPS), entraînant un suivi erratique par ByteTrack. | Critical | Utiliser le package `onnxruntime-gpu` (ou le backend PyTorch CUDA) et s'assurer que le container Docker a accès aux drivers (`runtime: nvidia`). |
| **Volume de données PostgreSQL (TimescaleDB)** | La table `audience_events` reçoit potentiellement des requêtes chaque seconde de chaque caméra. Si TimescaleDB n'est pas configuré pour compresser ou purger les vieilles données (Retention Policies), le disque va saturer. | High | Mettre en place des politiques de rétention (Data Retention Policies) dans TimescaleDB pour agréger les données vieilles de plus de X mois. |
| **Latence Réseau (MQTT)** | Des latences réseau élevées entre l'Edge et le Broker MQTT peuvent créer une asynchronie dans l'affichage des campagnes. | Medium | Configurer des paramètres de QoS adaptés et vérifier la stabilité de la connexion des caméras distantes. |
| **Cache non exploité** | Redis est présent dans le `docker-compose.yml` mais aucune utilisation massive du cache applicatif n'a été mise en évidence dans les contrôleurs (les calculs statistiques interrogent directement la BDD). | Low | Mettre en cache (Redis) les réponses des requêtes `LiveAnalytics` très sollicitées par le Frontend. |

## 18.2 Suivi

La surveillance des performances s'effectue via Grafana (`http://localhost:3001`), qui lit les métriques exposées par :
* **Node.js** : Consommation RAM, Latence Event Loop.
* **Edge CV** : `edge_cv_fps` (framerate d'inférence), `edge_cv_yolo_latency_seconds`.
* **PostgreSQL Exporter** : Locks, Buffer Cache hit ratio.
