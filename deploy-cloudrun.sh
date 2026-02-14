#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# deploy-cloudrun.sh — One-command deploy to Google Cloud Run
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Configuration (override with env vars) ───────────────────────────────────
PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-rr-foam-pro}"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Optional build-time env var
GEMINI_API_KEY="${GEMINI_API_KEY:-}"

echo "══════════════════════════════════════════════════════════"
echo "  Deploying ${SERVICE_NAME} to Cloud Run"
echo "  Project : ${PROJECT_ID}"
echo "  Region  : ${REGION}"
echo "══════════════════════════════════════════════════════════"

# ── 1. Build ─────────────────────────────────────────────────────────────────
echo "→ Building container image..."
docker build \
  --build-arg GEMINI_API_KEY="${GEMINI_API_KEY}" \
  -t "${IMAGE}:latest" \
  .

# ── 2. Push ──────────────────────────────────────────────────────────────────
echo "→ Pushing to Container Registry..."
docker push "${IMAGE}:latest"

# ── 3. Deploy ────────────────────────────────────────────────────────────────
echo "→ Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}:latest" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --concurrency 80

echo ""
echo "✅ Deployment complete!"
gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format='value(status.url)'
