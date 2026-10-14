# Code Review Remediation Report — IAD / SmartVision Platform

**Status:** REMEDIATION COMPLETE  
**Date:** 2026-10-14  
**Scope:** `apps/backend/`, `apps/edge-cv/`, `apps/frontend/`  
**Strict Excluded Scope:** `apps/smartqueue-ml/` (verified 100% untouched)

---

## 1. Summary of Review Findings & Confirmation

| # | Code Review Finding | Confirmed? | Root Cause & Initial State |
|---|---------------------|------------|----------------------------|
| 1 | **SmartQueue Proxy Misconfiguration** | **CONFIRMED** | `AlertsService` defaulted to `http://smartqueue:8000`, whereas Docker Compose deployed the service as `smartqueue-ml` on port `8002`. This caused ECONNREFUSED in production whenever alerts tried to fetch queue metrics. |
| 2 | **Alert Storage Volatility & Concurrency** | **CONFIRMED** | Alerts were stored in an unbounded in-memory array (`private alerts: AlertItem[] = []`). On backend restart or crash, all operator acknowledgements and alert history were lost. High volumes caused unbounded memory growth. |
| 3 | **Edge-CV Demographics Misalignment** | **CONFIRMED** | `FrameProcessor` assumed positional alignment between tracked bounding boxes and demographic estimator outputs (`preds[i]`). Whenever a face crop was skipped or failed in `age_estimator` or `gender_estimator`, the array length shrank, causing subsequent predictions to be assigned to the wrong tracked person. |
| 4 | **Unbounded Storage Upload Memory Pressure** | **CONFIRMED** | `MulterModule.register()` used default `memoryStorage()`, buffering entire multipart file uploads (up to 50MB) in Node.js V8 heap. Multiple simultaneous uploads risked Out-Of-Memory process crashes. |
| 5 | **Missing File Signature Validation (MIME Spoofing)** | **CONFIRMED** | Uploaded file validation relied solely on client-provided `file.mimetype` headers. Attackers could disguise executable scripts or PHP payloads as `image/jpeg` or `video/mp4`. |
| 6 | **Monolithic Frontend Bundle & Missing Code-Splitting** | **CONFIRMED** | `apps/frontend/src/main.tsx` eagerly imported all 16 route components. Vite bundled everything into a single monolithic bundle of 2,202.21 kB (619.79 kB gzip), triggering bundle size warnings. |
| 7 | **Unused `currentCampaignId` & Campaign Switching Flapping** | **CONFIRMED** | In `CampaignScorer.selectBestCampaign`, the `currentCampaignId` parameter was accepted but never evaluated. Tied campaign scores caused screen flapping due to arbitrary list order. |

---

## 2. Files Changed and Justification

### `apps/backend`
- [schema.prisma](file:///Users/mako/Desktop/IAD%20ED/apps/backend/prisma/schema.prisma): Added persistent `Alert` model with fields (`id`, `siteId`, `type`, `severity`, `message`, `acknowledged`, `acknowledgedBy`, `acknowledgedAt`, `source`, `details`, `createdAt`, `updatedAt`) and indexes on `siteId`, `severity`, `acknowledged`, and `createdAt`.
- [alerts.service.ts](file:///Users/mako/Desktop/IAD%20ED/apps/backend/src/alerts/alerts.service.ts):
  - Replaced volatile in-memory array with durable PostgreSQL/Prisma persistence.
  - Implemented bounded FIFO cache (`MAX_ALERT_CACHE_SIZE = 500`) with documented eviction policy.
  - Added startup warm-up (`onModuleInit`) to restore active alerts after backend restarts.
  - Corrected SmartQueue fallback URL to `http://smartqueue-ml:8002` with 2-second timeout and robust fallback.
- [alerts.controller.ts](file:///Users/mako/Desktop/IAD%20ED/apps/backend/src/alerts/alerts.controller.ts): Made `deleteAlert` async to await database deletion.
- [alerts.service.spec.ts](file:///Users/mako/Desktop/IAD%20ED/apps/backend/src/alerts/alerts.service.spec.ts): Added comprehensive tests for persistence, restarts, cache bounds, pagination, and SmartQueue fallback / timeout.
- [storage.service.ts](file:///Users/mako/Desktop/IAD%20ED/apps/backend/src/common/storage/storage.service.ts):
  - Added `detectMimeFromBuffer` for binary magic-number validation (JPEG, PNG, WebP, WebM, MP4, QuickTime).
  - Implemented streaming upload directly from disk (`client.fPutObject` for `file.path`) to avoid loading 50MB into RAM.
  - Guaranteed temporary file cleanup (`fs.promises.unlink`) in `finally` blocks on both success and failure.
- [campaigns.controller.ts](file:///Users/mako/Desktop/IAD%20ED/apps/backend/src/campaigns/campaigns.controller.ts): Configured Multer with disk storage in `os.tmpdir()` and enforced 50MB limit before memory allocation.
- [storage.service.spec.ts](file:///Users/mako/Desktop/IAD%20ED/apps/backend/src/common/storage/storage.service.spec.ts): Created 15 unit tests covering magic numbers, MIME spoofing prevention, 50MB limit, disk streaming, and file cleanup.
- [campaign-scorer.ts](file:///Users/mako/Desktop/IAD%20ED/apps/backend/src/campaigns/campaign-scorer.ts): Implemented hysteresis bonus (`HYSTERESIS_BONUS = 2`) for currently running campaign to prevent display flapping on score ties while allowing legitimate campaign changes.
- [campaign-scorer.spec.ts](file:///Users/mako/Desktop/IAD%20ED/apps/backend/src/campaigns/campaign-scorer.spec.ts): Added regression tests for hysteresis bonus, tie-breaking, and schedule expiration.
- [app.e2e-spec.ts](file:///Users/mako/Desktop/IAD%20ED/apps/backend/test/app.e2e-spec.ts) & [modules.e2e-spec.ts](file:///Users/mako/Desktop/IAD%20ED/apps/backend/test/modules.e2e-spec.ts): Updated e2e mocks for `alert` and `campaignImpression` and verified test passing.

### `apps/edge-cv`
- [age_estimation.py](file:///Users/mako/Desktop/IAD%20ED/apps/edge-cv/app/demographics/age_estimation.py): Updated `predict_batch` to preserve and return `track_id` with prediction outputs.
- [gender_estimation.py](file:///Users/mako/Desktop/IAD%20ED/apps/edge-cv/app/demographics/gender_estimation.py): Updated `predict_batch` to preserve and return `track_id` with prediction outputs.
- [frame_processor.py](file:///Users/mako/Desktop/IAD%20ED/apps/edge-cv/app/pipeline/frame_processor.py): Mapped demographic predictions strictly by `track_id` and normalized `bbox` rather than positional array indexes. Skipped crops or model failures safely leave demographic fields `None` without shifting any other track.
- [test_frame_processor.py](file:///Users/mako/Desktop/IAD%20ED/apps/edge-cv/tests/test_frame_processor.py): Added regression test `test_demographics_mapping_safe_on_skipped_or_reordered_crops` validating that skipped crops or reordered outputs never corrupt track identities.

### `apps/frontend`
- [main.tsx](file:///Users/mako/Desktop/IAD%20ED/apps/frontend/src/main.tsx):
  - Kept critical boot pages eagerly loaded (`LoginPage`, `DashboardLayout`, `OverviewPage`).
  - Code-split 16 route pages using `React.lazy()` and wrapped routes in `<React.Suspense fallback={<PageLoadingFallback />}>`.

---

## 3. Implementation Details

### SmartQueue Proxy Alignment & Error Handling
```typescript
const smartQueueUrl =
  this.configService.get<string>('SMARTQUEUE_API_URL') ||
  this.configService.get<string>('SMARTQUEUE_URL') ||
  'http://smartqueue-ml:8002';

const res = await fetch(`${smartQueueUrl}/metrics`, {
  signal: AbortSignal.timeout(2000),
});
```
- Fully aligned with docker-compose service name `smartqueue-ml` and port `8002`.
- Handles connection errors, non-200 responses, and timeouts gracefully without throwing unhandled exceptions.

### Durable Alert Persistence & Bounded Cache
- When an alert is ingested via MQTT or API, it is upserted into PostgreSQL via `this.prisma.alert.upsert()`.
- An in-memory cache of up to `MAX_ALERT_CACHE_SIZE = 500` alerts provides sub-millisecond retrieval.
- Eviction policy: When cache reaches 500 entries, the oldest alert is pruned from memory (while remaining safely in PostgreSQL).
- Startup recovery: On backend boot (`onModuleInit`), the 500 most recent alerts are queried from PostgreSQL to restore state immediately across restarts.

### Edge-CV Identity-Safe Demographic Mapping
```python
# Build lookup maps by track_id
age_by_track = {res["track_id"]: res for res in age_results if res.get("track_id") is not None}
gender_by_track = {res["track_id"]: res for res in gender_results if res.get("track_id") is not None}

for track in active_tracks:
    tid = track.track_id
    age_res = age_by_track.get(tid)
    gender_res = gender_by_track.get(tid)
    # Assign safely; None if crop was skipped or failed
```
- Eliminates positional index shifting `preds[i]` entirely.
- Prevents cross-contamination of demographic attributes between people in frame.

### Upload Streaming & Magic Bytes Validation
- Multer `diskStorage` streams chunks to `/tmp/iad-upload-*` on disk. The Node.js heap is never burdened with 50 MB files.
- Binary signature inspection checks the first 64 bytes (`detectMimeFromBuffer`):
  - `JPEG`: `FF D8 FF`
  - `PNG`: `89 50 4E 47 0D 0A 1A 0A`
  - `WebP`: `RIFF....WEBP`
  - `WebM`: `1A 45 DF A3`
  - `MP4 / QuickTime`: `ftyp` (with `qt` brand separation)
- MinIO `fPutObject` streams directly from the disk path.
- In both success and error paths, `fs.promises.unlink` is guaranteed to run in `finally`.

### Campaign Scorer Hysteresis
- A constant `HYSTERESIS_BONUS = 2` is awarded to `candidate.id === currentCampaignId`.
- Prevents rapid screen flickering between campaigns with tied scores (e.g., both default to 5).
- If a demographic match or high priority campaign arrives (scoring +15 to +30), the incoming campaign immediately beats `25 + 2 = 27` and displays without delay.

---

## 4. Frontend Bundle Metrics (Before vs After)

| Metric | Baseline (Monolithic) | Refactored (Code-Split) | Improvement |
|--------|-----------------------|-------------------------|-------------|
| **Main JS Bundle** | `2,202.21 kB` | `1,656.18 kB` | **-546.03 kB (-24.8%)** |
| **Main Gzip Size** | `619.79 kB` | `499.87 kB` | **-119.92 kB (Under 500 kB!)** |
| **Route Chunks** | 0 (all bundled together) | 41 separate route/module chunks | On-demand lazy loading |
| `SitesPage` Chunk | — | `102.63 kB` (28.77 kB gz) | Lazy loaded on demand |
| `CamerasPage` Chunk | — | `47.42 kB` (8.45 kB gz) | Lazy loaded on demand |
| `FleetPage` Chunk | — | `46.57 kB` (11.49 kB gz) | Lazy loaded on demand |
| `AudienceAnalytics` | — | `37.08 kB` (9.60 kB gz) | Lazy loaded on demand |
| `CampaignDetailPage`| — | `25.55 kB` (3.86 kB gz) | Lazy loaded on demand |
| `LiveAnalyticsPage` | — | `10.02 kB` (1.71 kB gz) | Lazy loaded on demand |
| `HeatmapPage` Chunk | — | `5.10 kB` (1.32 kB gz) | Lazy loaded on demand |

---

## 5. Verification & Test Evidence

### A. Backend Unit & Regression Tests
```
Test Suites: 11 passed, 11 total
Tests:       102 passed, 102 total
Snapshots:   0 total
Time:        3.042 s
```
- `src/common/storage/storage.service.spec.ts` (15/15 passed): Magic numbers, MIME spoofing rejection, 50MB limit, disk streaming via `fPutObject`, disk cleanup.
- `src/alerts/alerts.service.spec.ts` (9/9 passed): Prisma persistence, bounded cache, warm-up across restarts, pagination, SmartQueue URL fallback, and timeout.
- `src/campaigns/campaign-scorer.spec.ts` (15/15 passed): Hysteresis bonus (+2), tie-breaking prevention, schedule verification, priority weighting.
- All other 8 suites passing without regressions.

### B. Backend E2E Tests
```
Test Suites: 2 passed, 2 total
Tests:       15 passed, 15 total
Snapshots:   0 total
Time:        2.972 s
```

### C. Backend Production Build
```
> nest build
Found 0 error(s).
Exit code: 0
```

### D. Edge-CV Pytest Suite
```
tests/test_frame_processor.py::test_demographics_mapping_safe_on_skipped_or_reordered_crops PASSED
======================= 194 passed, 7 warnings in 0.86s ========================
Exit code: 0
```

### E. Frontend Build & TypeScript Check
```
> vite build
✓ 3266 modules transformed.
✓ built in 3.60s
Exit code: 0
```
```
> npx tsc --noEmit
Exit code: 0 (0 type errors)
```

### F. Display Kiosk Build
```
> display-kiosk@0.0.0 build
> tsc -b && vite build
dist/assets/index-HNAWdCRJ.js   393.65 kB │ gzip: 118.81 kB
✓ built in 134ms
Exit code: 0
```

---

## 6. Strict Constraint Verification: `apps/smartqueue-ml/`

Commands executed before refactoring:
- `git status --short apps/smartqueue-ml` -> `(empty)`
- `git diff -- apps/smartqueue-ml` -> `(empty)`

Commands executed after refactoring:
- `git status --short apps/smartqueue-ml` -> `(empty)`
- `git diff -- apps/smartqueue-ml` -> `(empty)`

**Confirmation:** The `apps/smartqueue-ml/` directory was completely untouched throughout the entire remediation process.

---

## 7. Remaining Issues & Blocked Tests

- No blocked tests. All automated unit, e2e, regression, and build pipelines in the repository ran to completion and succeeded.
- Real hardware camera feeds and physical LED Totem screens were simulated in software tests and passed.

---

## Final Status

**REMEDIATION COMPLETE**
