# 10 - Sécurité

Ce document présente l'audit de sécurité technique basé sur l'infrastructure et le code actuels du projet.

## 10.1 Vecteurs de Sécurité Analysés

* **Authentification** : Gestion par JWT (NestJS Passport) standardisée. Mots de passe hachés avec `bcryptjs`. ✅
* **Injections SQL** : Prévenues par l'utilisation de l'ORM Prisma. ✅
* **CORS** : Le Backend NestJS et le service FastAPI Edge-CV possèdent un middleware CORS. ✅ *(Attention : vérifier que les origines sont bien restrictives en production, pas de `*`)*.
* **Headers HTTP** : Le Backend utilise `helmet` pour sécuriser les headers HTTP (`X-XSS-Protection`, etc.). ✅
* **Validation des entrées** : Le Backend utilise `class-validator` et des DTOs pour valider les payloads entrants, empêchant les payloads inattendus. ✅
* **Secrets** : Les clés JWT, mots de passe MQTT et mots de passe BDD sont gérés par le fichier `.env`. ⚠️ *(Le fichier `.env.example` ne contient pas de secrets, mais il faut veiller à ne jamais commiter `.env`)*.

## 10.2 Tableau des vulnérabilités potentielles et recommandations

| Sévérité | Problème (Risque) | Localisation | Impact | Recommandation |
| -------- | ----------------- | ------------ | ------ | -------------- |
| High | **MQTT sans TLS** | Port 1883 / 9003 | Interception du trafic (sniffing) sur le réseau local. | Configurer Mosquitto avec des certificats TLS (port 8883) en production. |
| Medium | **Stockage des JWT** | Frontend React | Si le token est stocké dans le `localStorage`, il est vulnérable au XSS. | Stocker le JWT dans un cookie `HttpOnly` depuis le backend si possible. |
| Medium | **Endpoints FastAPI ouverts** | Edge-CV (8001) | Un utilisateur sur le même réseau peut appeler `/snapshot` sans authentification. | Ajouter une API Key (Header) ou restreindre l'accès IP via le reverse proxy pour l'API Edge-CV. |
| Low | **Mots de passe par défaut** | `docker-compose.yml` | Si un administrateur ne change pas le `.env`, les services démarrent avec des mots de passe exposés. | Forcer l'échec du démarrage si les mots de passe sont détectés comme étant "CHANGE_ME". |

## 10.3 Politique RGPD / Confidentialité

Le composant Edge-CV est conçu selon le principe de **Privacy by Design**.
* Les images (frames vidéo) **ne sont jamais sauvegardées** sur le disque.
* Les inférences YOLO extraient des boîtes englobantes et une estimation de l'âge (ex: "Adulte"), mais **aucune donnée biométrique permettant d'identifier un individu** n'est conservée.
* Les données transmises au backend (MQTT) ne contiennent que des nombres et des pourcentages anonymes.
