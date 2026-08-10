# 16 - Troubleshooting (Guide de Dépannage)

Ce guide répertorie les problèmes communs et leurs solutions.

## Problèmes fréquents

### 1. Impossible de se connecter à la base de données
**Symptôme** : Le conteneur backend affiche une erreur de connexion Prisma (timeout) ou crash en boucle.
**Cause** : Le conteneur `postgres` n'a pas fini de s'initialiser ou les identifiants `.env` sont incorrects.
**Solution** :
Vérifiez l'état de Postgres : `docker compose logs postgres`.
Si c'est un problème d'identifiants, vérifiez que `POSTGRES_PASSWORD` correspond bien à l'URL `DATABASE_URL` du backend.
Si c'est la première installation, assurez-vous d'avoir lancé le script `./scripts/seed.sh` pour migrer le schéma Prisma.

### 2. Le service Edge-CV affiche le statut "DEGRADED"
**Symptôme** : L'API `/health` retourne `{"status": "degraded"}`. La détection ne fonctionne pas.
**Cause** : Le modèle YOLO (`yolov8n.pt`) est introuvable ou la caméra source n'a pu être ouverte.
**Solution** :
* Assurez-vous que le fichier du modèle existe bien au chemin configuré (`MODEL_PATH`).
* Vérifiez les permissions si la caméra matérielle locale est utilisée sur l'hôte Docker (sous Linux, il faut mapper `/dev/video0`).

### 3. Les appareils n'apparaissent pas dans le tableau de bord
**Symptôme** : L'interface Frontend n'affiche aucun nouvel appareil (UNPAIRED).
**Cause** : Le broker MQTT (Mosquitto) refuse la connexion de `edge-cv` ou le backend ne s'y connecte pas.
**Solution** :
* Vérifiez les logs MQTT : `docker compose logs mosquitto`.
* Si une erreur d'authentification apparaît, le fichier de mot de passe `passwd` de Mosquitto n'est pas synchronisé avec le `.env`.
* **Commande** : Regénérez le fichier de mot de passe MQTT si nécessaire.

### 4. Erreur "No image file was provided" (API `/detect`)
**Symptôme** : L'envoi d'une image depuis le kiosque retourne une erreur 400.
**Cause** : Le paramètre `multipart/form-data` est manquant ou le champ n'est pas nommé `file`.
**Solution** : Le frontend/client doit structurer sa requête correctement avec un objet `FormData` contenant `file`.

### 5. L'interface React affiche une page blanche ou des erreurs CORS
**Symptôme** : Erreurs `Access-Control-Allow-Origin` dans la console du navigateur.
**Cause** : Le frontend (tournant sur le port 5173) tente d'accéder au backend sans passer par le proxy Vite, ou le `VITE_API_URL` est mal défini.
**Solution** : Assurez-vous que la variable `VITE_API_URL` pointe bien vers `http://localhost:3000` (ou l'IP du serveur). Le backend NestJS gère le CORS, vérifiez ses origines autorisées dans le code source si le domaine a changé.
