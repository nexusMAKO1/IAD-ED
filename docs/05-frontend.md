# 05 - Architecture Frontend

Le frontend est une Single Page Application (SPA) robuste développée avec React et TypeScript, servant de tableau de bord de gestion et de monitoring.

## 5.1 Technologies

| Technologie | Version | Utilisation | Localisation |
| ----------- | ------- | ----------- | ------------ |
| **React** | 18.2.0 | Librairie UI principale | `apps/frontend/` |
| **Vite** | 5.0.0 | Bundler et serveur de développement | `apps/frontend/vite.config.ts` |
| **TypeScript** | 5.2.0 | Typage statique | `apps/frontend/tsconfig.json` |
| **React Router** | 7.18.1 | Routage client | `apps/frontend/package.json` |
| **TailwindCSS** | 4.3.2 | Framework CSS utilitaire | `apps/frontend/tailwind.config.js` |
| **Radix UI** | 1.x / 2.x | Composants accessibles (Headless) | `apps/frontend/package.json` |
| **Framer Motion** | 12.42.2 | Animations | `apps/frontend/package.json` |
| **React Query** | 5.101.2 | Data fetching & cache (TanStack) | `apps/frontend/package.json` |
| **MQTT.js** | 5.10.1 | Client MQTT via WebSockets | `apps/frontend/package.json` |
| **Recharts** | 3.9.2 | Bibliothèque de graphiques | `apps/frontend/package.json` |
| **React Hook Form / Zod** | 7.81 / 4.4 | Formulaires et validation | `apps/frontend/package.json` |

## 5.2 Structure du projet

La structure du code source (`apps/frontend/src/`) est organisée par fonctionnalités et composants génériques :
* `api/` : Clients HTTP (Axios) pour communiquer avec le backend (NestJS).
* `components/` : Composants UI réutilisables (boutons, modales, `PageHeader`, `StatusBadge`, `SkeletonCard`). Basés sur Radix UI et Tailwind.
* `layouts/` : Mises en page principales (ex: `DashboardLayout.tsx`).
* `mqtt/` : Configuration et logique de connexion au broker MQTT (`mqtt.topics.ts`).
* `pages/` : Vues principales de l'application (routage).

## 5.3 Pages Principales

* `LoginPage.tsx` : Authentification.
* `OverviewPage.tsx` : Tableau de bord principal.
* `sites/SitesPage.tsx` : Gestion des sites physiques.
* `fleet/FleetPage.tsx` : Vue d'ensemble de la flotte de périphériques (`DevicesTable`).
* `displays/DisplaysPage.tsx` : Gestion spécifique des écrans de diffusion.
* `cameras/CamerasPage.tsx` : Gestion spécifique des caméras (Edge CV).
* `campaigns/CampaignsPage.tsx` : Création et gestion des campagnes publicitaires.
* `campaign-analytics/CampaignPerformancePage.tsx` : Statistiques des campagnes.
* `audience/AudienceAnalyticsPage.tsx` : Statistiques démographiques.
* `analytics/LiveAnalyticsPage.tsx` : Monitoring en temps réel via MQTT.
* `heatmap/HeatmapPage.tsx` : Carte de chaleur de fréquentation.
* `alerts/AlertsPage.tsx` : Gestion des anomalies.
* `settings/SettingsPage.tsx` : Configuration utilisateur et système.

## 5.4 State Management & Data Fetching

L'application n'utilise pas Redux ou Zustand pour un état global massif. Elle s'appuie plutôt sur une séparation claire :
1. **État serveur (Server State)** : Géré par **React Query** (@tanstack/react-query). Il gère la mise en cache, la refetching, et les états de chargement (`isLoading`, `isError`) pour les requêtes HTTP (ex: liste des campagnes, statistiques d'audience).
2. **État temps réel (Real-time State)** : Géré via **MQTT.js**. Les données "live" d'audience ou de statut des appareils sont reçues via WebSocket (`ws://localhost:9003`) et injectées dans des états locaux de composants (`useState` / `useEffect`).
3. **État UI (UI State)** : Géré par des contextes React ou localement dans les composants.

## 5.5 Composants UI

Une collection de composants headless (Radix UI) stylisés avec Tailwind est utilisée, garantissant une bonne accessibilité (a11y) et un design system cohérent. Des bibliothèques comme `lucide-react` fournissent l'iconographie, et `framer-motion` apporte des micro-interactions.
