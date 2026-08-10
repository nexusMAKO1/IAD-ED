# 15 - Logging et Monitoring

La visibilité sur l'état de santé et les performances du système est critique, particulièrement pour un système gérant des modèles de Computer Vision en bordure de réseau.

## 15.1 Monitoring (Prometheus & Grafana)

L'infrastructure inclut nativement une stack complète de monitoring.

* **Prometheus (`:9090`)** : Scrape (collecte) régulièrement les métriques depuis les cibles.
  * Les exporters inclus : `postgres-exporter`, `redis-exporter`, `mosquitto-exporter`.
  * Le backend expose ses propres métriques d'application et de base de données (Prisma) sur `/metrics` via `prom-client`.
  * Le composant `edge-cv` expose des métriques applicatives :
    * `edge_cv_fps`
    * `edge_cv_yolo_latency_seconds`
    * `edge_cv_people_detected`

* **Grafana (`:3001`)** : Interface de visualisation des données collectées par Prometheus. Le répertoire `infrastructure/monitoring/grafana/provisioning` indique que des dashboards sont automatiquement injectés au démarrage du système.

## 15.2 Logging

**Logs Applicatifs** :
* **Backend NestJS** : Utilise le logger interne de NestJS, qui imprime les logs sur la sortie standard (STDOUT) de Docker.
* **Edge-CV & ML (Python)** : Utilisent la bibliothèque `structlog` pour un logging structuré (formaté idéalement pour des collecteurs JSON), configuré via la variable d'environnement `LOG_LEVEL` (ex: `INFO`, `DEBUG`).

**Collecte des Logs** :
Actuellement, les logs ne sont pas centralisés (pas de stack ELK ou Loki dans le `docker-compose.yml`). Les logs sont gérés par le daemon Docker.

**Commande pour consulter les logs :**
```bash
# Voir les logs du backend
docker compose logs -f backend

# Voir les logs de l'Edge CV
docker compose logs -f edge-cv
```
