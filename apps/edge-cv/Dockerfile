# =============================================================================
# Edge CV — Computer Vision Service Dockerfile
# Python 3.11 + FastAPI + OpenCV + Ultralytics YOLOv8
# Multi-stage: development | production
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Base — Python with system deps for OpenCV & YOLOv8
# ---------------------------------------------------------------------------
FROM python:3.11-slim AS base

# Install OS dependencies for OpenCV and YOLO
RUN apt-get update && apt-get install -y --no-install-recommends \
    # OpenCV deps
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    # Build tools
    gcc \
    g++ \
    # Networking / Health
    curl \
    # Video processing
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Docker Desktop injects HTTPS_PROXY=http.docker.internal:3128 which only handles
# docker.io registry traffic. pip needs direct HTTPS to pypi.org.
ENV HTTPS_PROXY="" HTTP_PROXY="" https_proxy="" http_proxy=""

# Install pip-tools pour la gestion des dépendances
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# ---------------------------------------------------------------------------
# Stage 2: Dependencies installation
# ---------------------------------------------------------------------------
FROM base AS dependencies

# Re-clear proxy: Docker Desktop re-injects it at each new stage
ENV HTTPS_PROXY="" HTTP_PROXY="" https_proxy="" http_proxy="" NO_PROXY="*" no_proxy="*"

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Télécharger le modèle YOLOv8n par défaut (nano — le plus léger)
# En production, utiliser des modèles custom stockés dans MinIO
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')" || true

# ---------------------------------------------------------------------------
# Stage 3: Development (avec hot reload uvicorn)
# ---------------------------------------------------------------------------
FROM dependencies AS development

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV LOG_LEVEL=INFO

COPY . .

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=5 \
  CMD curl -f http://localhost:8001/health || exit 1

# --reload supprimé pour éviter les redémarrages intempestifs en développement (WatchFiles)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]

# ---------------------------------------------------------------------------
# Stage 4: Production (multi-workers, no reload)
# ---------------------------------------------------------------------------
FROM dependencies AS production

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV LOG_LEVEL=INFO

# Create non-root user
RUN groupadd --gid 1001 cvuser && \
    useradd --uid 1001 --gid cvuser --shell /bin/bash --create-home cvuser

COPY --chown=cvuser:cvuser . .

# Ensure model directory exists and is writable
RUN mkdir -p /app/models && chown -R cvuser:cvuser /app/models

USER cvuser

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=5 \
  CMD curl -f http://localhost:8001/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
