# 12 - Installation & Démarrage

Ce guide permet à un développeur ou un opérateur de lancer le projet IAD & SmartQueue AI sur sa machine locale ou sur un serveur.

## 12.1 Prérequis

Assurez-vous que votre environnement dispose de :
* **Docker** (version 24.0+)
* **Docker Compose** (V2)
* **Git**
* Un OS compatible (Linux, macOS, Windows WSL2).
* Port libres (3000, 5173, 8001, 8002, 5432, 6379, 1883, 9003, 9000, 9001, 9090, 3001).

## 12.2 Procédure d'installation

1. **Cloner le repository** :
   ```bash
   git clone https://github.com/express-display/iad-smartqueue-ai.git
   cd iad-smartqueue-ai
   ```

2. **Configurer les variables d'environnement** :
   ```bash
   cp .env.example .env
   ```
   *Ouvrez `.env` avec un éditeur et remplacez les valeurs par défaut (notamment les mots de passe) par des valeurs sécurisées si vous êtes sur un serveur distant.*

3. **Générer le fichier de mots de passe MQTT (Optionnel en dev, requis si modif .env)** :
   Si vous modifiez `MQTT_USER` et `MQTT_PASSWORD`, vous devrez peut-être regénérer le fichier `passwd` pour Mosquitto, ou vous fier au script de démarrage s'il le fait automatiquement.

4. **Démarrer l'infrastructure complète** :
   Le projet fournit un script de lancement qui exécute `docker compose`.
   ```bash
   ./scripts/start.sh
   ```
   *(Alternative : `docker compose up -d`)*

5. **Initialiser la base de données (Migrations et Seed)** :
   Une fois que le conteneur PostgreSQL (`postgres`) et le `backend` sont sains (vérifiable avec `docker compose ps`), exécutez le script d'initialisation :
   ```bash
   ./scripts/seed.sh
   ```
   Ce script exécute `prisma migrate deploy` (création du schéma) puis `prisma db seed` (création des données par défaut, comme l'utilisateur Admin).

## 12.3 Vérification

Pour confirmer que le système est opérationnel, vérifiez les accès suivants dans votre navigateur :

* **Frontend** : http://localhost:5173
* **Backend Health** : http://localhost:3000/health (doit retourner HTTP 200)
* **Swagger API** : http://localhost:3000/api
* **MinIO Console** : http://localhost:9001
* **Grafana** : http://localhost:3001
* **Prometheus** : http://localhost:9090

Pour voir les logs des services IA :
```bash
docker compose logs -f edge-cv smartqueue-ml
```
