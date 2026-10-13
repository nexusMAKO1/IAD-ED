# Graph Report - IAD ED  (2026-10-13)

## Corpus Check
- 325 files · ~138,206 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 24 file(s) not represented in the graph (top: (none) 11, .css 4, .map 2)

## Summary
- 3111 nodes · 6178 edges · 197 communities (131 shown, 66 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 234 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ddf827fd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- campaign-analytics.dto.ts
- onnx_optimization.py
- OverviewPage.tsx
- test_onnx_optimization.py
- OnnxInferenceSession
- CreateSiteDto
- Button
- index.ts
- AgeEstimator
- ref_react
- TopBar.tsx
- mqtt.service.ts
- app.module.ts
- @prisma/client
- CampaignsService
- AuthService
- PersonDetector
- MQTTClient
- FleetPage.tsx
- _make_frame
- backend/package.json
- MqttService
- Playlist
- test_t015.py
- ndarray
- frontend/package.json
- make_det
- dependencies
- train.py
- ByteTracker
- 03 - Documentation Fonctionnelle
- services/mqtt_client.py
- test_gender_estimation.py
- dependencies
- Roles
- KalmanTrack
- OfflinePlaylistManager
- predict.py
- devDependencies
- RefreshTokenDto
- GenderEstimator
- MQTTClient
- compilerOptions
- SettingsService
- test_mqtt_client.py
- BaseEventDto
- display-kiosk/package.json
- edge-cv/app/main.py
- compilerOptions
- smartqueue-ml/app/main.py
- docs/README.md
- 🚀 IAD & SmartQueue AI
- compilerOptions
- CampaignsPage.tsx
- mqtt.types.ts
- SmartVision End-to-End Live Demonstration Guide
- AudienceEventsController
- CampaignImpressionService
- compilerOptions
- make_client_with_mocks
- DevicesTable.tsx
- MqttClientService
- patch
- RAPPORT D'AVANCEMENT DU PROJET : IAD & SmartQueue AI
- VideoStream
- main.js
- mqtt.service.spec.ts
- electron/main.ts
- compilerOptions
- test_bytetrack.py
- 01 - Aperçu du projet
- generate_dataset.py
- 21 - Glossaire
- PerformanceLogger
- 3. Contrat REST API
- qa_t014.py
- scripts
- health.controller.ts
- README.md
- frontend/src/main.tsx
- BaseModel
- OnnxError
- test_offline_playlist.py
- .download_media
- _validate_detection
- alert-dialog.tsx
- use-toast.ts
- devDependencies
- TestGenderFieldInDetections
- CreateUserDto
- AlertsService
- OnnxConfig
- CameraManager
- devDependencies
- prediction.py
- 07 - Base de Données
- 8.1 API Backend Principale (NestJS - Port 3000)
- 2. Description des Tables
- CampaignDecisionService
- CreateDeviceDto
- App.tsx
- ProcessedFrameResult
- 2. Contrat MQTT
- 5. Conventions techniques
- Monitoring Stack — IAD & SmartQueue AI
- DevicesService
- 06 - Architecture Backend
- 23 - Audit de la Documentation
- Audit Technique — Sprint 0 (Rayen)
- 4. JSON Schemas & TypeScript Types
- 🛠️ Détail des Corrections Effectuées
- Guide Utilisateur
- @nestjs/common
- DeviceRegistryService
- UpdateDeviceDto
- scripts
- _iou_batch
- TestSubscribeAndHandlers
- storage.service.ts
- Problèmes fréquents
- 3.3 Campagnes Publicitaires et Analytics (Impressions)
- MQTT Architecture — Express Display SmartVision
- package.json
- demo.sh
- start.sh
- dependencies
- AppSettings
- AgeBarChart.tsx
- 02 - Contexte métier
- 04 - Architecture Globale
- TestBenchmark
- nest-cli.json
- MetricsController
- .oxlintrc.json
- CampaignScorer
- TestOutputFormat
- scripts
- 5. End-to-End Workflow Testing
- Gender Classification (T-011)
- 20 - Roadmap et Recommandations
- reset.sh
- seed.sh
- 17 - Maintenance (Where to change what?)
- TestInvalidDetections
- TestPerformanceValidation
- i18n.ts
- 10 - Sécurité
- 12 - Installation & Démarrage
- 13 - Déploiement
- Contrat d'Interface Technique (T-001) - IAD & SmartQueue AI
- 3.5. Campaigns
- stop.sh
- tsconfig.build.json
- electron
- React + TypeScript + Vite
- _xywh_to_xyxy
- app/config.py
- 🔧 Commandes utiles
- 3.2. Tickets
- Diagrammes de Séquences (Mermaid)
- display-kiosk/tsconfig.json
- TestStatusAndProperties
- test-compute.js
- rules/graphify.md
- workflows/graphify.md
- entrypoint.sh
- download_gender_model.sh
- deployment.md
- TECH_DEBT.md
- 15 - Logging et Monitoring
- ⚡ Installation rapide & Démarrage
- 3.6. Devices

## God Nodes (most connected - your core abstractions)
1. `@nestjs/common` - 63 edges
2. `MqttService` - 56 edges
3. `OnnxInferenceSession` - 53 edges
4. `MQTTClient` - 48 edges
5. `Button` - 47 edges
6. `PrismaService` - 40 edges
7. `lucide-react` - 32 edges
8. `PageHeader()` - 30 edges
9. `ByteTracker` - 28 edges
10. `useToast()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `1. NestJS Backend (`apps/backend/`)` --references--> `MetricsController`  [INFERRED]
  infrastructure/monitoring/README.md → apps/backend/src/common/metrics/metrics.controller.ts
- `Heartbeat & Presence` --references--> `PresenceService`  [INFERRED]
  docs/camera-auto-pairing.md → apps/backend/src/devices/presence.service.ts
- `Architecture` --references--> `GenderEstimator`  [INFERRED]
  docs/gender-classification.md → apps/edge-cv/app/demographics/gender_estimation.py
- `4.2 Plans de Mitigation` --references--> `VideoStream`  [INFERRED]
  docs/RAPPORT_AVANCEMENT_IAD_SMARTQUEUE.md → apps/edge-cv/app/video_stream.py
- `6. Implementation Locations` --references--> `useMqtt()`  [INFERRED]
  docs/mqtt-architecture.md → apps/frontend/src/mqtt/useMqtt.ts

## Import Cycles
- None detected.

## Communities (197 total, 66 thin omitted)

### Community 0 - "campaign-analytics.dto.ts"
Cohesion: 0.05
Nodes (22): CampaignAggregationService, CampaignAnalyticsController, CampaignAnalyticsService, CampaignInsightsService, InsightInput, CampaignKpiService, KpiInputs, KpiScores (+14 more)

### Community 1 - "onnx_optimization.py"
Cohesion: 0.08
Nodes (10): Detection, DetectionResult, Detection, TrackedPerson, TrackState, draw_detections(), draw_hud(), draw_tracked_persons() (+2 more)

### Community 2 - "OverviewPage.tsx"
Cohesion: 0.09
Nodes (33): getAudienceStats(), getVisitorTimeseries(), densityConfig, DensityGauge, DensityGaugeProps, DensityLevel, CustomTooltip(), MultiSeriesPoint (+25 more)

### Community 3 - "test_onnx_optimization.py"
Cohesion: 0.08
Nodes (13): benchmark(), BenchmarkResult, DetectionResult, inference(), validate_model(), warmup(), cfg(), _clear_session_cache() (+5 more)

### Community 4 - "OnnxInferenceSession"
Cohesion: 0.09
Nodes (5): OnnxInferenceSession, TestRunRaw, TestSessionLoading, TestValidateModel, TestWarmup

### Community 5 - "CreateSiteDto"
Cohesion: 0.07
Nodes (6): CreateSiteDto, OperatingHoursDto, UpdateSiteDto, UpdateSiteThresholdsDto, SitesController, SitesService

### Community 6 - "Button"
Cohesion: 0.11
Nodes (44): assignSiteDevice(), deleteDevice(), getDevices(), restartDevice(), unpairDevice(), updateDevice(), deleteSite(), getSites() (+36 more)

### Community 7 - "index.ts"
Cohesion: 0.06
Nodes (28): apiClient, failedQueue, AlertSeverity, AlertType, ApiValidationError, AudienceBreakdownDto, AudienceEvent, AudienceStats (+20 more)

### Community 8 - "AgeEstimator"
Cohesion: 0.05
Nodes (15): AgeEstimationError, AgeEstimator, InferenceError, InvalidInputError, ModelNotLoadedError, FrameProcessor, dummy_frame(), estimator() (+7 more)

### Community 9 - "ref_react"
Cohesion: 0.13
Nodes (19): login(), updateSiteThresholds(), colorMap, KpiCardProps, KpiColor, KpiTrend, trendConfig, BadgeProps (+11 more)

### Community 10 - "TopBar.tsx"
Cohesion: 0.08
Nodes (29): AuthTokens, changePassword(), getProfile(), LoginDto, logout(), RefreshTokenDto, updateProfile(), UserProfile (+21 more)

### Community 11 - "mqtt.service.ts"
Cohesion: 0.08
Nodes (13): AudienceEventsService, DetectionItemDto, DetectionsPayloadDto, DecisionState, IadMetricsService, MetricsInterceptor, requestCounter, requestDuration (+5 more)

### Community 12 - "app.module.ts"
Cohesion: 0.10
Nodes (12): AlertsModule, AudienceEventsModule, CampaignAnalyticsModule, CampaignsModule, MetricsModule, envValidationSchema, DevicesModule, MqttModule (+4 more)

### Community 13 - "@prisma/client"
Cohesion: 0.11
Nodes (9): AlertItem, ChangePasswordDto, JwtPayload, ROLES_KEY, JwtAuthGuard, RolesGuard, class-validator, @nestjs/swagger (+1 more)

### Community 14 - "CampaignsService"
Cohesion: 0.07
Nodes (6): CampaignsController, CampaignsService, CreateCampaignDto, UpdateCampaignDto, StorageService, @nestjs/platform-express

### Community 15 - "AuthService"
Cohesion: 0.09
Nodes (5): AuthController, AuthService, LoginDto, UpdateProfileDto, CurrentUser

### Community 16 - "PersonDetector"
Cohesion: 0.07
Nodes (9): main(), PersonDetector, FPSCounter, LatencyTracker, Fichiers trouvés, Fonctionnalités réellement implémentées, Risques, T-003 — POC Détection de Personnes YOLOv8n (+1 more)

### Community 17 - "MQTTClient"
Cohesion: 0.08
Nodes (3): MQTTClient, TestConnectionFailure, TestConnectionState

### Community 18 - "FleetPage.tsx"
Cohesion: 0.12
Nodes (37): createDevice(), createSite(), updateSite(), TopBarProps, DialogContent, DialogDescription, DialogFooter(), DialogHeader() (+29 more)

### Community 19 - "_make_frame"
Cohesion: 0.09
Nodes (7): _letterbox(), _make_frame(), TestDynamicInputShapes, TestLetterbox, TestPreprocess, TestRunBatch, TestRunDetection

### Community 20 - "backend/package.json"
Cohesion: 0.04
Nodes (46): dotenv, mqtt, @types/node, typescript, name, prisma, seed, private (+38 more)

### Community 22 - "Playlist"
Cohesion: 0.11
Nodes (9): MediaItem, Playlist, test_campaign_activation(), test_get_active_playlist_priority(), test_get_next_media_round_robin(), test_playlist_crud(), test_playlist_model(), test_remove_obsolete_media() (+1 more)

### Community 23 - "test_t015.py"
Cohesion: 0.10
Nodes (5): AnomalyAlert, AnomalyDetector, clean_anomaly_detector(), test_ack_endpoint_200_path(), test_ack_endpoint_404_path()

### Community 24 - "ndarray"
Cohesion: 0.13
Nodes (3): _iou(), _nms(), TestNMS

### Community 25 - "frontend/package.json"
Cohesion: 0.07
Nodes (29): autoprefixer, axios, mqtt, postcss, react, react-dom, tailwindcss, @types/node (+21 more)

### Community 26 - "make_det"
Cohesion: 0.11
Nodes (7): make_det(), TestConfidenceFiltering, TestDisappearAndReappear, TestMultiplePeople, TestSinglePerson, TestTentativeState, TestTrackerReset

### Community 27 - "dependencies"
Cohesion: 0.07
Nodes (29): dependencies, axios, class-variance-authority, clsx, framer-motion, @hookform/resolvers, i18next, i18next-browser-languagedetector (+21 more)

### Community 28 - "train.py"
Cohesion: 0.19
Nodes (4): _build_pipeline(), _encode_categoricals(), _load_data(), train_and_evaluate()

### Community 29 - "ByteTracker"
Cohesion: 0.10
Nodes (5): ByteTracker, TrackerInitError, TrackingError, TestEnvConfig, TestTrackerInit

### Community 30 - "03 - Documentation Fonctionnelle"
Cohesion: 0.09
Nodes (21): 03 - Documentation Fonctionnelle, 3.1 Gestion des Sites et des Appareils (Fleet Management), 3.2 Vision par Ordinateur (Détection et Démographie), 3.4 Prédiction de File d'Attente, 3.5 Gestion de la Configuration et des Identifiants MQTT, Fichiers concernés, Fichiers concernés, Fichiers concernés (+13 more)

### Community 31 - "services/mqtt_client.py"
Cohesion: 0.14
Nodes (15): BaseEvent, CameraCommand, CameraHealthPayload, ConfigUpdateCommand, CrowdDensityPayload, DemographicsItem, DemographicsPayload, DetectionItem (+7 more)

### Community 32 - "test_gender_estimation.py"
Cohesion: 0.08
Nodes (7): GenderEstimationError, InferenceError, InvalidInputError, client(), mock_gender_estimator(), test_extract_face_roi_invalid_input(), client()

### Community 33 - "dependencies"
Cohesion: 0.08
Nodes (26): dependencies, bcryptjs, class-transformer, class-validator, compression, dotenv, helmet, joi (+18 more)

### Community 35 - "KalmanTrack"
Cohesion: 0.11
Nodes (3): _associate(), KalmanTrack, _linear_assignment()

### Community 36 - "OfflinePlaylistManager"
Cohesion: 0.12
Nodes (4): InvalidPlaylistError, OfflinePlaylistManager, PlaylistManagerError, StorageError

### Community 37 - "predict.py"
Cohesion: 0.12
Nodes (13): predict(), predict_batch(), _predict_side_effects(), queue_anomalies(), queue_stats(), queue_status(), BatchPredictRequest, MQTTPredictionPayload (+5 more)

### Community 38 - "devDependencies"
Cohesion: 0.08
Nodes (24): devDependencies, eslint, eslint-config-prettier, eslint-plugin-prettier, jest, @nestjs/cli, @nestjs/schematics, @nestjs/testing (+16 more)

### Community 42 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, baseUrl, esModuleInterop, isolatedModules, jsx, lib (+14 more)

### Community 44 - "test_mqtt_client.py"
Cohesion: 0.15
Nodes (7): CommandTopics, EdgeTopics, SystemTopics, client(), mock_paho(), reset_command_schemas(), TestTopicConstants

### Community 45 - "BaseEventDto"
Cohesion: 0.13
Nodes (9): BaseEventDto, CameraHealthPayloadDto, CrowdDensityPayloadDto, DemographicsPayloadDto, DetectionBoundingBoxDto, DetectionPayloadDto, HealthPayloadDto, PerformancePayloadDto (+1 more)

### Community 46 - "display-kiosk/package.json"
Cohesion: 0.10
Nodes (20): axios, dotenv, mqtt, react, react-dom, @types/node, @types/react, @types/react-dom (+12 more)

### Community 47 - "edge-cv/app/main.py"
Cohesion: 0.08
Nodes (16): save_identity(), _cpu_usage_percent(), detect(), _get_device_status(), _global_exception_handler(), health(), lifespan(), discovery_loop() (+8 more)

### Community 48 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 49 - "smartqueue-ml/app/main.py"
Cohesion: 0.11
Nodes (7): lifespan(), read_root(), health_check(), get_encoder(), is_model_loaded(), load_model(), predict_with_uncertainty()

### Community 50 - "docs/README.md"
Cohesion: 0.08
Nodes (18): 11.1 Fichiers de Configuration Importants, 11.2 Variables d'Environnement (.env.example), 11 - Configuration, 14.1 Tests Backend (NestJS), 14.2 Tests Edge CV (Python), 14.3 Tests SmartQueue ML (Python), 14.4 Pipeline CI (GitHub Actions), 14 - Tests (+10 more)

### Community 51 - "🚀 IAD & SmartQueue AI"
Cohesion: 0.14
Nodes (14): 🏗️ Architecture Globale des Services, ✅ Checklist de vérification post-démarrage, 🤝 Contribution & Règles Git, 📚 Documentation Technique Détaillée, 🌟 Fonctionnalités Clés, 🚀 IAD & SmartQueue AI, 📄 Licence, Plateforme d'Intelligence Artificielle, Computer Vision & File d'Attente Intelligente (+6 more)

### Community 52 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, experimentalDecorators, forceConsistentCasingInFileNames, incremental (+10 more)

### Community 53 - "CampaignsPage.tsx"
Cohesion: 0.44
Nodes (9): Campaign, createCampaign(), deleteCampaign(), getCampaigns(), updateCampaign(), updateCampaignOrder(), uploadCampaignMedia(), CampaignForm() (+1 more)

### Community 54 - "mqtt.types.ts"
Cohesion: 0.21
Nodes (15): AlertPayload, BaseEvent, CameraHealthPayload, CrowdDensityPayload, DashboardPayload, DensityLevel, DetectionBoundingBox, DetectionPayload (+7 more)

### Community 55 - "SmartVision End-to-End Live Demonstration Guide"
Cohesion: 0.17
Nodes (12): 1. Prerequisites, 2. Installation, 3. Launching the Demonstration (Automatic), 4. Manual Startup (Alternative), 6. Monitoring & Swagger Documentation, 7. Troubleshooting, A. Docker Startup, A. Swagger API Docs (+4 more)

### Community 58 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 59 - "make_client_with_mocks"
Cohesion: 0.18
Nodes (3): make_client_with_mocks(), TestPublish, TestQoSLevels

### Community 60 - "DevicesTable.tsx"
Cohesion: 0.14
Nodes (22): Badge(), badgeVariants, Table, TableBody, TableCaption, TableCell, TableFooter, TableHead (+14 more)

### Community 62 - "patch"
Cohesion: 0.17
Nodes (5): test_concurrency(), test_min_samples_gating(), test_per_service_type_window_separation(), test_predict_side_effects_independent(), test_unconditional_publish_no_suppression()

### Community 63 - "RAPPORT D'AVANCEMENT DU PROJET : IAD & SmartQueue AI"
Cohesion: 0.11
Nodes (17): 1. Synthèse Exécutive (Executive Summary), 2.1 Sprint 0 — Cadrage & Preuves de Concept ✅ TERMINÉ, 2.2 Sprint 1 — MVP IAD + SmartQueue Core 🟡 EN COURS, 2.3 Sprint 2 — Convergence, Robustesse & Démonstration Finale 🔵 À VENIR, 2. État d'Avancement par Sprints et Tâches, 3. Répartition de la Charge et Collaboration, 4.1 Registre des Risques Techniques, 4.2 Plans de Mitigation (+9 more)

### Community 65 - "main.js"
Cohesion: 0.12
Nodes (11): CACHE_DIR, cachedPlaylist, electron_1, fs, http, https, identityPath, MediaCacheService (+3 more)

### Community 66 - "mqtt.service.spec.ts"
Cohesion: 0.12
Nodes (10): MqttConfigService, MqttConnectionConfig, MqttMessageHandler, eventListeners, mockEnd, mockMqttClient, mockOn, mockPublish (+2 more)

### Community 67 - "electron/main.ts"
Cohesion: 0.13
Nodes (4): CACHE_DIR, cachedPlaylist, identityPath, MediaCacheService

### Community 68 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, allowSyntheticDefaultImports, esModuleInterop, lib, module, moduleResolution, outDir, resolveJsonModule (+6 more)

### Community 69 - "test_bytetrack.py"
Cohesion: 0.15
Nodes (5): reset_id_counter(), strict_tracker(), TestNoDetections, TestPeopleCrossing, tracker()

### Community 70 - "01 - Aperçu du projet"
Cohesion: 0.13
Nodes (13): UserRole, 01 - Aperçu du projet, 1.1 Contexte, 1.2 Problématique, 1.3 Objectifs, 1.4 Utilisateurs, 1.5 Périmètre, 1.6 État du projet (+5 more)

### Community 71 - "generate_dataset.py"
Cohesion: 0.16
Nodes (4): _clip(), generate_dataset(), main(), _rand_timestamps()

### Community 72 - "21 - Glossaire"
Cohesion: 0.13
Nodes (15): 21 - Glossaire, A, B, C, D, E, H, I (+7 more)

### Community 74 - "3. Contrat REST API"
Cohesion: 0.17
Nodes (12): 3.1. Authentication, 3.3. Queue, 3.4. Audience, 3.7. Health, 3. Contrat REST API, `GET /api/v1/audience-events`, `GET /api/v1/queue/predict`, `GET /api/v1/queue/status` (+4 more)

### Community 75 - "qa_t014.py"
Cohesion: 0.33
Nodes (13): check_a_health(), check_b_valid_prediction(), check_c_invalid_category(), check_d_congestion_tiers(), check_e_priority_discount(), check_f_batch_valid(), check_g_batch_oversized(), check_h_queue_status() (+5 more)

### Community 76 - "scripts"
Cohesion: 0.14
Nodes (14): scripts, build, lint, prisma:generate, prisma:migrate, start, start:dev, start:prod (+6 more)

### Community 77 - "health.controller.ts"
Cohesion: 0.21
Nodes (4): HealthController, HealthResponse, SystemController, HealthModule

### Community 78 - "README.md"
Cohesion: 0.22
Nodes (4): Camera Auto-Pairing Architecture, Heartbeat & Presence, Identity Flow, Troubleshooting Auto-Pairing

### Community 79 - "frontend/src/main.tsx"
Cohesion: 0.11
Nodes (45): getAudienceEvents(), campaignAnalyticsApi, getSettings(), updateSettings(), AgeBarChart, DemographicsPieChart, Card, CardContent (+37 more)

### Community 80 - "BaseModel"
Cohesion: 0.33
Nodes (3): AnomalyAlert, HealthResponse, PredictRequest

### Community 81 - "OnnxError"
Cohesion: 0.08
Nodes (7): CorruptedModelError, InvalidInputError, ModelNotFoundError, OnnxError, ProviderError, UnsupportedOperatorError, TestGenericInference

### Community 82 - "test_offline_playlist.py"
Cohesion: 0.12
Nodes (7): DownloadError, test_cache_maintenance_lru(), test_download_media_existing_valid(), test_download_media_retries_and_failure(), test_media_item_model(), test_media_validation(), test_online_offline_modes()

### Community 84 - "_validate_detection"
Cohesion: 0.26
Nodes (3): InvalidDetectionError, _validate_detection(), TestValidateDetection

### Community 85 - "alert-dialog.tsx"
Cohesion: 0.30
Nodes (12): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+4 more)

### Community 86 - "use-toast.ts"
Cohesion: 0.13
Nodes (23): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+15 more)

### Community 87 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, concurrently, cross-env, electron, oxlint, @types/node, @types/react, @types/react-dom (+4 more)

### Community 91 - "OnnxConfig"
Cohesion: 0.09
Nodes (6): export_to_onnx(), load_model(), OnnxConfig, _parse_input_size(), _try_simplify(), TestOnnxConfig

### Community 93 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, autoprefixer, postcss, tailwindcss, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom (+3 more)

### Community 94 - "prediction.py"
Cohesion: 0.15
Nodes (3): acknowledge_alert(), AckRequestBody, AlertAcknowledgment

### Community 95 - "07 - Base de Données"
Cohesion: 0.18
Nodes (9): 07 - Base de Données, 7.1 Schéma de la Base de Données (Aperçu), 7.2 Diagramme Entité-Relation (ERD), 7.3 Tables Principales Détaillées, 7.4 Migrations, `audience_events` (Hypertable probable), `campaigns`, `devices` (+1 more)

### Community 96 - "8.1 API Backend Principale (NestJS - Port 3000)"
Cohesion: 0.18
Nodes (10): 08 - API (Interfaces de Programmation), 8.1 API Backend Principale (NestJS - Port 3000), 8.2 API Edge-CV (FastAPI - Port 8001), 8.3 API SmartQueue ML (FastAPI - Port 8002), Audience Analytics, Authentication, Campaigns, Détection (+2 more)

### Community 97 - "2. Description des Tables"
Cohesion: 0.18
Nodes (10): 1. Diagramme Entité-Association (ERD), 2.1. `sites` (Site), 2.4. `campaigns` (Campagnes d'affichage), 2.5. `audience_events` (Événements de détection), 2.6. `tickets` (Tickets de file d'attente), 2. Description des Tables, 3. Optimisations & Indexation, Index configurés : (+2 more)

### Community 100 - "App.tsx"
Cohesion: 0.27
Nodes (5): App(), Campaign, OverlayState, Campaign, DisplayPlayer()

### Community 103 - "2. Contrat MQTT"
Cohesion: 0.20
Nodes (8): 2.1. Topic : `iad/audience/events`, 2.2. Topic : `iad/audience/aggregates`, 2.3. Topic : `smartqueue/status`, 2.4. Topic : `smartqueue/predictions`, 2.5. Topic : `iad/content/update`, 2.6. Topic : `system/health`, 2.7. Topic : `alerts/anomalies`, 2. Contrat MQTT

### Community 104 - "5. Conventions techniques"
Cohesion: 0.11
Nodes (13): dummy_image(), dummy_video(), manager(), temp_media_dir(), 5.1. Naming Conventions (Conventions de nommage), 5.2. Versioning API, 5.3. Gestion des erreurs, 5.4. Pagination (REST API) (+5 more)

### Community 105 - "Monitoring Stack — IAD & SmartQueue AI"
Cohesion: 0.20
Nodes (9): 1. NestJS Backend (`apps/backend/`), 2. FastAPI Services (`apps/edge-cv/` and `apps/smartqueue-ml/`), Accessing Grafana, Accessing Prometheus, Available Alerts, How to Add New Metrics, How to Create New Dashboards, How to Start Monitoring (+1 more)

### Community 107 - "06 - Architecture Backend"
Cohesion: 0.22
Nodes (7): Config, Settings, 06 - Architecture Backend, 6.1 Technologies, 6.2 Modèle MVC / Modulaire (NestJS), 6.3 Contrôleurs & Modules identifiés, 6.4 Communication Asynchrone (MQTT)

### Community 108 - "23 - Audit de la Documentation"
Cohesion: 0.22
Nodes (8): 23.1 Fichiers Analysés, 23.2 Technologies Détectées, 23.3 API et Routes Détectées, 23.5 Tests Détectés, 23.6 Incohérences Notées, 23.7 Informations Manquantes, 23.8 Recommandations Prioritaires (Top 3), 23 - Audit de la Documentation

### Community 109 - "Audit Technique — Sprint 0 (Rayen)"
Cohesion: 0.07
Nodes (26): Audit Technique — Sprint 0 (Rayen), Détail par Tâche, Fichiers trouvés, Fichiers trouvés, Fichiers trouvés, Fonctionnalités réellement implémentées, Jobs déclarés dans `ci.yml`, Priorité 1 — Corrections bloquantes (avant prochain push) (+18 more)

### Community 110 - "4. JSON Schemas & TypeScript Types"
Cohesion: 0.22
Nodes (9): 4.1. AudienceEvent, 4.2. QueueStatus, 4.3. QueuePrediction, 4.4. Ticket, 4.5. Campaign, 4.6. Device, 4.7. User, 4.8. HealthStatus (+1 more)

### Community 111 - "🛠️ Détail des Corrections Effectuées"
Cohesion: 0.22
Nodes (8): 1. Infrastructure & Docker Compose (T-002), 2. Service Edge CV FastAPI (T-003), 3. Service SmartQueue ML (T-006), 4. Tests & CI/CD (T-007), 🛠️ Détail des Corrections Effectuées, Rapport de Validation Final — Sprint 0 (Rayen), 🧪 Résultats de la Vérification Locale, 📋 Résumé de la Situation

### Community 112 - "Guide Utilisateur"
Cohesion: 0.22
Nodes (8): 1. Première Connexion, 2. Tableau de Bord (Overview), 3. Gestion des Sites (Sites), 4. Gestion de la Flotte (Fleet), 5. Analytique en direct (Live Analytics), 6. Création de Campagnes Publicitaires, 7. Performances des Campagnes, Guide Utilisateur

### Community 113 - "@nestjs/common"
Cohesion: 0.10
Nodes (17): prisma, AppModule, ErrorResponse, HttpExceptionFilter, mockDevice, mockDeviceRegistryService, mockMqttService, mockPrismaService (+9 more)

### Community 116 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, electron:build, electron:start, lint, preview, start

### Community 118 - "TestSubscribeAndHandlers"
Cohesion: 0.36
Nodes (3): _make_message(), TestSubscribeAndHandlers, _valid_envelope()

### Community 119 - "storage.service.ts"
Cohesion: 0.25
Nodes (4): StorageModule, ALLOWED_MIME_TYPES, UploadResult, minio

### Community 120 - "Problèmes fréquents"
Cohesion: 0.25
Nodes (7): 16 - Troubleshooting (Guide de Dépannage), 1. Impossible de se connecter à la base de données, 2. Le service Edge-CV affiche le statut "DEGRADED", 3. Les appareils n'apparaissent pas dans le tableau de bord, 4. Erreur "No image file was provided" (API `/detect`), 5. L'interface React affiche une page blanche ou des erreurs CORS, Problèmes fréquents

### Community 121 - "3.3 Campagnes Publicitaires et Analytics (Impressions)"
Cohesion: 0.33
Nodes (6): 3.3 Campagnes Publicitaires et Analytics (Impressions), API utilisées, Fichiers concernés, Objectif, Utilisateur concerné, Étapes

### Community 122 - "MQTT Architecture — Express Display SmartVision"
Cohesion: 0.29
Nodes (7): 1. Broker Infrastructure, 2. Topic Hierarchy, 3. Payload Standardisation, 4. Resilience & Reconnection, 5. Last Will & Testament (LWT), 6. Implementation Locations, MQTT Architecture — Express Display SmartVision

### Community 123 - "package.json"
Cohesion: 0.25
Nodes (7): devDependencies, autoprefixer, postcss, tailwindcss, autoprefixer, postcss, tailwindcss

### Community 124 - "demo.sh"
Cohesion: 0.46
Nodes (6): header(), info(), open_browser(), demo.sh script, success(), warn()

### Community 125 - "start.sh"
Cohesion: 0.54
Nodes (7): check_command(), error(), header(), info(), start.sh script, success(), warn()

### Community 126 - "dependencies"
Cohesion: 0.29
Nodes (7): dependencies, axios, dotenv, electron-store, mqtt, react, react-dom

### Community 128 - "AgeBarChart.tsx"
Cohesion: 0.17
Nodes (9): AGE_COLORS, AgeBarChartProps, AgeGroupPoint, GenderByHourPoint, GenderHourChart, GenderHourChartProps, DemographicsPieChartProps, PieDataPoint (+1 more)

### Community 129 - "02 - Contexte métier"
Cohesion: 0.29
Nodes (6): 02 - Contexte métier, 2.1 Enjeux, 2.2.1 Utilisateurs Humains, 2.2.2 Acteurs Systèmes / Périphériques (Devices), 2.2 Acteurs et Rôles, 2.3 Cas d'utilisation (Use Cases) principaux

### Community 130 - "04 - Architecture Globale"
Cohesion: 0.29
Nodes (5): 04 - Architecture Globale, 4.1 Vue d'ensemble des Composants, 4.2 Diagramme d'Architecture, 4.3 Flux de données principal (Data Flow), Diagramme d'Architecture (Mermaid)

### Community 132 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 134 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 135 - "CampaignScorer"
Cohesion: 0.44
Nodes (3): AgeDetectionSample, CampaignScorer, CandidateCampaign

### Community 137 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, preview, type-check

### Community 138 - "5. End-to-End Workflow Testing"
Cohesion: 0.33
Nodes (6): 5. End-to-End Workflow Testing, A. Opening the Frontend, B. Testing with Webcam, C. Testing with Video Upload, D. Testing MQTT Publication, E. Database Verification

### Community 139 - "Gender Classification (T-011)"
Cohesion: 0.33
Nodes (6): Architecture, Configuration, Developer Tools, Fallback Behavior, Gender Classification (T-011), Setup & Model Download

### Community 140 - "20 - Roadmap et Recommandations"
Cohesion: 0.33
Nodes (5): 20.1 Améliorations Critiques (Court-terme), 20.2 Améliorations Importantes (High - Moyen-terme), 20.3 Optimisations Utiles (Medium), 20.4 Optimisations Secondaires (Low), 20 - Roadmap et Recommandations

### Community 141 - "reset.sh"
Cohesion: 0.60
Nodes (5): header(), info(), reset.sh script, success(), warn()

### Community 142 - "seed.sh"
Cohesion: 0.60
Nodes (5): error(), header(), info(), seed.sh script, success()

### Community 144 - "17 - Maintenance (Where to change what?)"
Cohesion: 0.40
Nodes (4): 17.1 Where to change what?, 17.2 Mise à jour des dépendances, 17.3 Backups de la Base de données, 17 - Maintenance (Where to change what?)

### Community 147 - "i18n.ts"
Cohesion: 0.40
Nodes (3): i18next, i18next-browser-languagedetector, react-i18next

### Community 148 - "10 - Sécurité"
Cohesion: 0.40
Nodes (4): 10.1 Vecteurs de Sécurité Analysés, 10.2 Tableau des vulnérabilités potentielles et recommandations, 10.3 Politique RGPD / Confidentialité, 10 - Sécurité

### Community 149 - "12 - Installation & Démarrage"
Cohesion: 0.40
Nodes (4): 12.1 Prérequis, 12.2 Procédure d'installation, 12.3 Vérification, 12 - Installation & Démarrage

### Community 150 - "13 - Déploiement"
Cohesion: 0.40
Nodes (4): 13.1 Stratégie Actuelle (VPS / Bare Metal), 13.2 Déploiement des Caméras (Edge), 13.3 Recommandations pour la Production, 13 - Déploiement

### Community 151 - "Contrat d'Interface Technique (T-001) - IAD & SmartQueue AI"
Cohesion: 0.40
Nodes (4): 1. Vue d'ensemble de l'architecture des échanges, 6. Catalogue des erreurs, 7. Spécification OpenAPI 3.1 (Minimale et Valide), Contrat d'Interface Technique (T-001) - IAD & SmartQueue AI

### Community 152 - "3.5. Campaigns"
Cohesion: 0.40
Nodes (5): 3.5. Campaigns, `DELETE /api/v1/campaigns/{id}`, `GET /api/v1/campaigns`, `POST /api/v1/campaigns`, `PUT /api/v1/campaigns/{id}`

### Community 153 - "stop.sh"
Cohesion: 0.70
Nodes (4): header(), info(), stop.sh script, success()

### Community 154 - "tsconfig.build.json"
Cohesion: 0.50
Nodes (3): exclude, extends, ./tsconfig.json

### Community 156 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 159 - "🔧 Commandes utiles"
Cohesion: 0.40
Nodes (5): Base de données & Migrations (Prisma), 🔧 Commandes utiles, Docker Compose, Gestion de l'infrastructure, Tests et Validation Qualité

### Community 160 - "3.2. Tickets"
Cohesion: 0.50
Nodes (4): 3.2. Tickets, `GET /api/v1/tickets`, `PATCH /api/v1/tickets/{id}`, `POST /api/v1/tickets`

### Community 161 - "Diagrammes de Séquences (Mermaid)"
Cohesion: 0.50
Nodes (3): Diagrammes de Séquences (Mermaid), Découverte et Appairage d'un Appareil, Inférence et Analytics

### Community 193 - "15 - Logging et Monitoring"
Cohesion: 0.50
Nodes (3): 15.1 Monitoring (Prometheus & Grafana), 15.2 Logging, 15 - Logging et Monitoring

### Community 194 - "⚡ Installation rapide & Démarrage"
Cohesion: 0.50
Nodes (4): 🔑 Identifiants de connexion par défaut, ⚡ Installation rapide & Démarrage, Option 1 : Démonstration E2E Automatisée (Recommandée) 🚀, Option 2 : Démarrage Standard

### Community 195 - "3.6. Devices"
Cohesion: 0.67
Nodes (3): 3.6. Devices, `GET /api/v1/devices`, `POST /api/v1/devices`

## Knowledge Gaps
- **700 isolated node(s):** `entrypoint.sh script`, `$schema`, `collection`, `sourceRoot`, `deleteOutDir` (+695 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1421 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **66 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `T-003 — POC Détection de Personnes YOLOv8n` connect `PersonDetector` to `Audit Technique — Sprint 0 (Rayen)`?**
  _High betweenness centrality (0.300) - this node is a cross-community bridge._
- **Why does `Détail par Tâche` connect `Audit Technique — Sprint 0 (Rayen)` to `PersonDetector`?**
  _High betweenness centrality (0.299) - this node is a cross-community bridge._
- **Why does `T-006 — Schéma PostgreSQL + TimescaleDB` connect `Audit Technique — Sprint 0 (Rayen)` to `FleetPage.tsx`?**
  _High betweenness centrality (0.289) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `OnnxInferenceSession` (e.g. with `Detection` and `DetectionResult`) actually correct?**
  _`OnnxInferenceSession` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 8 inferred relationships involving `MQTTClient` (e.g. with `BaseEvent` and `EdgeTopics`) actually correct?**
  _`MQTTClient` has 8 INFERRED edges - model-reasoned connections that need verification._
- **What connects `entrypoint.sh script`, `$schema`, `collection` to the rest of the system?**
  _700 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `campaign-analytics.dto.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05347985347985348 - nodes in this community are weakly interconnected._