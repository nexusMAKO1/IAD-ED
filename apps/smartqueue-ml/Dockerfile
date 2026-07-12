# =============================================================================
# SmartQueue ML — Machine Learning Service Dockerfile
# Python 3.11 + FastAPI + scikit-learn + pandas + numpy
# Multi-stage: development | production
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Base
# ---------------------------------------------------------------------------
FROM python:3.11-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Docker Desktop injects HTTPS_PROXY=http.docker.internal:3128 which only handles
# docker.io registry traffic. pip needs direct HTTPS to pypi.org.
ENV HTTPS_PROXY="" HTTP_PROXY="" https_proxy="" http_proxy=""

RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# ---------------------------------------------------------------------------
# Stage 2: Dependencies
# ---------------------------------------------------------------------------
FROM base AS dependencies

# Re-clear proxy: Docker Desktop re-injects it at each new stage
ENV HTTPS_PROXY="" HTTP_PROXY="" https_proxy="" http_proxy="" NO_PROXY="*" no_proxy="*"

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# ---------------------------------------------------------------------------
# Stage 3: Development
# ---------------------------------------------------------------------------
FROM dependencies AS development

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV LOG_LEVEL=INFO

COPY . .

EXPOSE 8002

HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=5 \
  CMD curl -f http://localhost:8002/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002", "--reload", "--workers", "1"]

# ---------------------------------------------------------------------------
# Stage 4: Production
# ---------------------------------------------------------------------------
FROM dependencies AS production

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV LOG_LEVEL=INFO

# Create non-root user
RUN groupadd --gid 1001 mluser && \
    useradd --uid 1001 --gid mluser --shell /bin/bash --create-home mluser

COPY --chown=mluser:mluser . .

RUN mkdir -p /app/model_store && chown -R mluser:mluser /app/model_store

USER mluser

EXPOSE 8002

HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=5 \
  CMD curl -f http://localhost:8002/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002", "--workers", "2"]
