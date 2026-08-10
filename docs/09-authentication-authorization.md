# 09 - Authentification et Autorisation

Le système utilise une authentification basée sur les jetons (JWT - JSON Web Tokens) pour l'API REST, et des accréditations par mot de passe pour les protocoles tiers (MQTT, MinIO).

## 9.1 Mécanisme JWT (Backend REST)

* L'utilisateur s'authentifie avec Email et Mot de passe (`POST /auth/login`). Le mot de passe est haché avec `bcryptjs` en base de données.
* Le backend retourne un `access_token` (durée courte, ex: 1h) et un `refresh_token` (durée longue, ex: 7j).
* Le Frontend stocke l'`access_token` (généralement en mémoire ou localStorage) et l'envoie dans le header `Authorization: Bearer <token>` pour chaque requête vers l'API.
* Les routes sont protégées par le Guard NestJS `@UseGuards(JwtAuthGuard)`.

## 9.2 Rôles et Autorisations (RBAC)

Un système de contrôle d'accès basé sur les rôles (RBAC) est implémenté via l'énumération `UserRole` de Prisma (`ADMIN`, `MANAGER`, `AGENT`) et le Guard `@Roles()`.

| Rôle | Périmètre d'action | Exemples de restrictions |
| ---- | ------------------ | ------------------------ |
| **ADMIN** | Global | Peut créer des sites (`POST /sites`), supprimer n'importe quel device, voir tous les rapports. |
| **MANAGER** | Un ou plusieurs sites | Peut modifier les seuils d'alertes de son site, créer des campagnes pour son site. |
| **AGENT** | Actions opérationnelles | Peut interagir avec les tickets de la file d'attente. |

## 9.3 Authentification MQTT (Mosquitto)

Le broker MQTT n'utilise pas JWT. L'accès est contrôlé par le fichier `passwd` généré par `mosquitto_passwd`.
Les identifiants (`MQTT_USER` et `MQTT_PASSWORD`) sont définis dans les variables d'environnement (`.env`) et fournis aux clients (Edge-CV, Frontend, Backend) pour se connecter au broker de manière sécurisée.
