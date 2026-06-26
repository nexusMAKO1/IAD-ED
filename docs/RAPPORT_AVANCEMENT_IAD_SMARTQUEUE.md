# RAPPORT D'AVANCEMENT DU PROJET : IAD & SmartQueue AI

---

| | |
|---|---|
| **Date du rapport** | 26 Juin 2026 |
| **Destinataire** | M. Arafet Boussaid — CTO & Fondateur, Express Display |
| **Équipe Projet** | Ferdaous (Slice ML/Prédiction & Dashboard/CMS) — Rayen (Slice Edge CV & Core API/Backend) |
| **Référence projet** | IAD-SQ-AI / Agile Sprint Review |
| **Statut global** | 🟡 **Sprint 1 en cours — avancement conforme au planning** |

---

## 1. Synthèse Exécutive (Executive Summary)

Le projet **IAD & SmartQueue AI** est une plateforme d'intelligence artificielle unifiée, conçue pour combiner deux capacités complémentaires au sein d'une seule infrastructure cloud-native :

- **IAD (Intelligent Audience Display)** : Analyse de flux vidéo en temps réel sur des dispositifs périphériques (*edge*) par Computer Vision (YOLOv8), permettant la détection et la profilisation démographique anonymisée des audiences devant les écrans d'affichage dynamique.
- **SmartQueue AI** : Prédiction intelligente et en boucle fermée (*closed-loop feedback*) des temps d'attente en file par des modèles de Machine Learning supervisé (Random Forest, scikit-learn), avec une architecture de rétroaction pilotée par MQTT Mosquitto permettant au contenu affiché de s'adapter dynamiquement à l'état réel de la file d'attente.

**Cas d'usage de référence :** Agence bancaire physique, déployant la plateforme sur des bornes kiosque tactiles (émission de tickets), des caméras RTSP et des écrans d'affichage connectés.

### Bénéfices stratégiques clés pour Express Display

| Axe | Bénéfice |
|---|---|
| **Modèle économique** | Potentiel de revenus SaaS récurrents (licence par site, par écran) |
| **Différenciation marché** | Offre de niche sur le marché tunisien combinant *edge AI* et ML prédictif sans dépendance à l'IA générative exposée — architecture maîtrisable et auditée |
| **Maîtrise des risques** | Pas de stockage d'images biométriques, pas de modèle de fondation externe — conformité facilitée avec la loi organique tunisienne n° 2004-63 sur la protection des données personnelles |
| **Reproductibilité** | Architecture Docker Compose multi-services prête à être répliquée sur tout nouveau site client |

---

## 2. État d'Avancement par Sprints et Tâches

### 2.1 Sprint 0 — Cadrage & Preuves de Concept ✅ TERMINÉ
**Durée :** 2 semaines | **Statut :** Complété

L'objectif du Sprint 0 était de valider la faisabilité technique de l'ensemble de la chaîne de valeur avant tout investissement de développement majeur.

| Tâche | Responsable | Statut | Livrable |
|---|---|---|---|
| T-001 — Définition des contrats d'interface (MQTT topics, schémas API REST, JSON Schemas) | Binôme | ✅ | `docs/contracts/T-001-interface-contracts.md` (42 Ko, 1 347 lignes) |
| T-002 — Setup environnements (Docker Compose, GitHub, `.env.example`, scripts `start.sh` / `stop.sh` / `reset.sh` / `seed.sh`) | Rayen | ✅ | `docker-compose.yml` — 9 services orchestrés |
| T-003 — POC détection de personnes YOLOv8n (latence < 200 ms, webcam USB & RTSP) | Rayen | ✅ | `apps/edge-cv/app/main.py` — architecture modulaire 4 fichiers |
| T-004 — Génération du dataset synthétique de tickets | Ferdaous | ✅ | — |
| T-005 — POC modèle Random Forest — prédiction temps d'attente | Ferdaous | ✅ | — |
| T-006 — Schéma PostgreSQL + TimescaleDB (Prisma ORM, hypertable `audience_events`, migrations, seed) | Rayen | ✅ | `apps/backend/prisma/schema.prisma` + migration SQL + `docs/database/database-schema.md` |
| T-007 — Pipeline CI/CD GitHub Actions (lint, tests, build Docker, scan sécurité Trivy) | Rayen | ✅ | `.github/workflows/ci.yml` — 7 jobs |
| T-008 — Architecture technique v1 (README, diagramme services) | Binôme | ✅ | `README.md` — documentation complète |

> **Résultat Sprint 0 :** Les deux preuves de concept critiques (vision par ordinateur et prédiction ML) ont été validées avec succès. L'infrastructure d'hébergement complète (PostgreSQL/TimescaleDB, Redis, MQTT Mosquitto, MinIO, Prometheus/Grafana) est opérationnelle via Docker Compose.

---

### 2.2 Sprint 1 — MVP IAD + SmartQueue Core 🟡 EN COURS
**Durée :** 3 semaines | **Statut :** En cours de développement

#### Volet Rayen — Edge CV & Core API/Backend

| Tâche | Statut | Description technique |
|---|---|---|
| T-009 — Service Edge CV | 🔵 À démarrer | FastAPI + YOLOv8n — capture RTSP/USB, calcul dwell time, publication MQTT `iad/audience/events` |
| T-010 — Estimation tranche d'âge | 🔵 À démarrer | Modèle MobileNetV3 ONNX intégré au pipeline Edge CV — classification `child / young_adult / adult / senior` |
| T-011 — Playlist de secours offline | 🔵 À démarrer | Lecture locale des médias en cas de perte de connectivité réseau — résilience edge |
| T-012 — Core API REST | 🔵 À démarrer | NestJS — endpoints `/tickets`, `/audience-events`, `/campaigns`, `/devices`, `/queue/status` |
| T-013 — Authentification JWT + RBAC | 🔵 À démarrer | Tokens JWT HS256, rôles `ADMIN / MANAGER / AGENT`, middleware NestJS Guards |

#### Volet Ferdaous — ML Prédictif & Frontend

| Tâche | Statut | Description technique |
|---|---|---|
| T-014 — Pipeline ML complet | 🔵 À démarrer | Entraînement Random Forest (features : heure, jour, agents actifs, historique) — scikit-learn, FastAPI `/predict` |
| T-015 — Détection d'anomalies | 🔵 À démarrer | Détection par z-score sur les métriques de file d'attente — alerte email en cas de dépassement de seuil |
| T-016 — Interface borne tactile (kiosque) | 🔵 À démarrer | Application React 18 — émission ticket, affichage temps d'attente estimé, accessible offline |
| T-017 — Dashboard Manager V1 | 🔵 À démarrer | React 18 + Vite — visualisation temps réel des KPI file d'attente et audience |
| T-018 — CMS Campagnes | 🔵 À démarrer | Interface de gestion et planification des médias (upload, ciblage démographique, activation) |

#### Volet Partagé — Qualité & Intégration

| Tâche | Statut | Description |
|---|---|---|
| T-019 — Tests d'intégration E2E | 🔵 À démarrer | Scénario complet sur matériel physique : mini PC + caméra RTSP + écran d'affichage |

---

### 2.3 Sprint 2 — Convergence, Robustesse & Démonstration Finale 🔵 À VENIR
**Durée :** 3 semaines | **Statut :** Planifié

Ce sprint constitue la phase de convergence de la plateforme et prépare la démonstration finale devant la direction.

| Tâche | Responsable | Description |
|---|---|---|
| T-020 — Tracking multi-objets ByteTrack | Rayen | Suivi de trajectoires individuelles sans ré-identification biométrique — améliore la précision du dwell time |
| T-021 — Intégration MQTT convergence (**F3.1 — Fonctionnalité différenciante clé**) | Binôme | Le contenu IAD sur les écrans réagit en temps réel à l'état de la file SmartQueue via MQTT — boucle de rétroaction fermée |
| T-022 — Optimisation ONNX INT8 | Rayen | Quantification 8 bits du modèle YOLOv8n — réduction de la latence d'inférence sur CPU embarqué |
| T-023 — Supervision (Prometheus + Grafana) | Rayen | Dashboards opérationnels, alertes latence et taux d'erreur, métriques métier |
| T-024 — Prévision J+1 (Prophet / SARIMA) | Ferdaous | Modèle de prévision de l'affluence du lendemain pour optimiser la dotation en agents |
| T-025 — Réentraînement automatique | Ferdaous | Pipeline de réentraînement déclenché sur dérive de données |
| T-026 — Profil journalier unifié | Ferdaous | Agrégation quotidienne des métriques audience et file d'attente |
| T-027 — Rapport PDF automatique | Ferdaous | Génération de rapports hebdomadaires à destination des responsables d'agence |
| T-028 — Export CSV/Excel | Ferdaous | Export des données historiques pour analyse externe |
| T-029 à T-032 — Planification campagnes, prévisualisation écran, audit sécurité, gestion parc d'écrans | Binôme | Fonctionnalités produit avancées |
| T-033 — Démonstration finale | Binôme | Scénario bancaire complet en conditions réelles |

---

## 3. Répartition de la Charge et Collaboration

### Principe appliqué : "Chaque développeur possède un slice IA + un slice produit"

Ce principe garantit que chaque membre de l'équipe dispose d'une vision bout-en-bout de la plateforme et peut contribuer à toutes les phases, réduisant ainsi les dépendances critiques entre personnes.

| | Ferdaous | Rayen |
|---|---|---|
| **Slice IA/Données** | ML Prédictif — Random Forest, détection d'anomalies, prévision temporelle (Prophet) | Computer Vision Edge — YOLOv8n, MobileNetV3 ONNX, ByteTrack |
| **Slice Produit** | Dashboard Manager, CMS Campagnes, interface Kiosque (React 18) | Core API NestJS/Prisma, Service Edge CV FastAPI |
| **Phases partagées** | Contrats d'interface (Sprint 0), architecture v1, tests E2E (Sprint 1), boucle MQTT F3.1 (Sprint 2), démonstration finale | |

### Mode de collaboration opérationnelle

- **Sprint 0 :** Co-rédaction des contrats MQTT et API (T-001) — socle commun garantissant l'interopérabilité des services développés en parallèle.
- **Sprint 1 :** Développement en parallèle sur des branches feature distinctes — revue de code croisée avant merge.
- **Sprint 2 :** Phase de convergence physique — intégration de la boucle MQTT (T-021) réalisée en binôme sur le matériel de démonstration.

---

## 4. Gestion des Risques, Alertes et Prochaines Étapes

### 4.1 Registre des Risques Techniques

| # | Risque | Probabilité | Impact | Criticité |
|---|---|---|---|---|
| R1 | **Latence d'inférence Edge dépassant 200 ms** sur CPU embarqué sans GPU dédié | Modérée | Élevé | 🔴 Critique |
| R2 | **Qualité des données du client pilote bancaire** insuffisante pour affiner les modèles (volumes faibles, données manquantes) | Modérée | Élevé | 🟠 Élevé |
| R3 | **Conformité loi organique tunisienne n° 2004-63** sur la protection des données personnelles — traitement d'images de personnes physiques | Faible | Très élevé | 🟠 Élevé |

### 4.2 Plans de Mitigation

**R1 — Latence Edge :**
- ✅ POC T-003 valide la chaîne sur CPU avec architecture non-bloquante (`VideoStream` threadé).
- 🔧 Action Sprint 2 (T-022) : Quantification INT8 ONNX — réduction estimée de 40 à 60 % de la charge CPU sur architecture ARM.

**R2 — Qualité données client pilote :**
- 🔧 Utilisation du dataset synthétique (T-004) pour l'entraînement initial — le modèle est opérationnel dès le déploiement J+0.
- 🔧 Pipeline de réentraînement automatique (T-025) déclenché dès que le volume de données réelles dépasse un seuil de fiabilité statistique.

**R3 — Conformité données personnelles :**
- ✅ Architecture *privacy-by-design* : aucune image brute n'est stockée. Seules les métadonnées agrégées et anonymisées (`peopleCount`, `densityScore`, `youngCount`, `adultCount`, `seniorCount`) sont persistées en base.
- ✅ Le tracking ByteTrack (Sprint 2) assigne des identifiants locaux éphémères, non corrélables entre sessions.
- 🔧 Audit de sécurité formel (T-031) prévu en Sprint 2.

### 4.3 Jalons Immédiats — Avant la Répétition de Démonstration

| Priorité | Jalon | Responsable | Échéance cible |
|---|---|---|---|
| 🔴 P1 | Finalisation Service Edge CV (T-009) + publication MQTT opérationnelle | Rayen | Fin Sprint 1 |
| 🔴 P1 | Pipeline ML Random Forest déployé via API `/predict` (T-014) | Ferdaous | Fin Sprint 1 |
| 🟠 P2 | Intégration boucle MQTT F3.1 — contenu réactif à la file (T-021) | Binôme | Début Sprint 2 |
| 🟠 P2 | Démonstration partielle sur matériel physique (mini PC + caméra) | Binôme | Mi Sprint 2 |
| 🟡 P3 | Optimisation ONNX INT8 et validation latence < 200 ms (T-022) | Rayen | Mi Sprint 2 |
| 🟡 P3 | Répétition générale complète du scénario bancaire | Binôme | Fin Sprint 2 — J-3 avant démo |

---

*Document préparé par l'équipe projet IAD & SmartQueue AI — Express Display*
*Diffusion restreinte — Comité de Pilotage*
