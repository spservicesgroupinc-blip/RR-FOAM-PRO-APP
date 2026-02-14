# Google Cloud Run Deployment Guide

## Prerequisites

1. [Google Cloud SDK (`gcloud`)](https://cloud.google.com/sdk/docs/install) installed
2. A GCP project with billing enabled
3. Docker installed (for local builds) — or use Cloud Build for remote builds

## Quick Setup

```bash
# Authenticate & set project
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com
```

## Deploy

### Option A — Using Cloud Build (recommended for CI/CD)

```bash
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions=_GEMINI_API_KEY="your-key-here" \
  .
```

### Option B — Local Docker build + deploy

```bash
export GCP_PROJECT_ID=your-project-id
export GEMINI_API_KEY=your-key-here   # optional
bash deploy-cloudrun.sh
```

### Option C — Minimal `gcloud` one-liner (source deploy)

```bash
gcloud run deploy rr-foam-pro \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

This auto-detects the Dockerfile and builds via Cloud Build.

## Environment Variables

| Variable | Type | Purpose |
|---|---|---|
| `PORT` | Runtime (auto) | Injected by Cloud Run — nginx reads it automatically |
| `GEMINI_API_KEY` | Build-time | Baked into the JS bundle via Vite `define` |

> **Note**: Supabase URL and anon key are currently hardcoded in `src/lib/supabase.ts`. For multi-environment setups, consider moving them to Vite env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and passing them as build args.

## Architecture

```
Cloud Run
  └── nginx (listens on $PORT = 8080)
       └── serves /dist (SPA)
            └── Client-side JS talks to Supabase directly
```

- **No backend server** — all API calls go directly from the browser to Supabase
- **Static SPA** — Nginx serves the built assets with SPA fallback routing
- **Health check** — `GET /healthz` returns `200 ok` (used by Cloud Run)

## Custom Domain

```bash
gcloud run domain-mappings create \
  --service rr-foam-pro \
  --domain your-domain.com \
  --region us-central1
```

Follow the DNS verification instructions printed by the command.

## Cost Optimization

The deployment is configured with:
- **min-instances: 0** — scales to zero when idle (no cost)
- **max-instances: 3** — caps scaling
- **256Mi memory / 1 CPU** — minimal footprint for a static SPA
- **concurrency: 80** — nginx handles many concurrent requests per instance

Estimated cost for low-traffic: **~$0/month** (free tier covers 2M requests/month).
