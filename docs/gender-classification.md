# Gender Classification (T-011)

Express Display SmartVision (Edge-CV) performs real-time gender estimation alongside age and person tracking.

## Architecture

1.  **Person Detection**: YOLOv8 detects bounding boxes for persons.
2.  **Object Tracking**: ByteTrack assigns stable IDs across frames.
3.  **Face Extraction**: The `GenderEstimator` class extracts the facial region (top 35% of the bounding box, centered horizontally).
4.  **Classification**: The extracted faces are batched, resized to `1x3x224x224`, and passed through a lightweight **GoogLeNet Gender Classification Model** using ONNX Runtime.
5.  **Telemetry**: The results are emitted via MQTT payloads to the backend for analytics.

## Setup & Model Download

To respect repository size limits, the ONNX model is **not** committed to version control. You must download it before starting Edge-CV.

```bash
cd apps/edge-cv
./scripts/download_gender_model.sh
```
This downloads `gender_googlenet.onnx` (approx. 23MB) into `apps/edge-cv/models/`.

## Configuration

Gender classification is enabled by default but can be tuned via `.env`:

```env
GENDER_ENABLED=true
GENDER_MODEL_PATH=models/gender_googlenet.onnx
GENDER_CONFIDENCE_THRESHOLD=0.70
```

- **GENDER_ENABLED**: Set to `false` to disable gender inference entirely.
- **GENDER_CONFIDENCE_THRESHOLD**: If the model confidence is below this value, the prediction falls back to `unknown`.

## Fallback Behavior

Gender classification is treated as an ML estimate, not an absolute truth. Edge-CV gracefully falls back to `"gender": "unknown"` without crashing if:
- `GENDER_ENABLED=false`
- `onnxruntime` is missing or fails to load the model.
- The face crop is invalid or out of bounds.
- The model confidence is lower than `GENDER_CONFIDENCE_THRESHOLD`.

## Developer Tools

Test the model against a single image without running the entire tracking pipeline:

```bash
cd apps/edge-cv
python3 scripts/test_gender.py path/to/image.jpg
```
