# Google Cloud Run Deployment Guide

## Prerequisites

1. [Google Cloud SDK (`gcloud`)](https://cloud.google.com/sdk/docs/install) installed
2. A GCP project with billing enabled
3. Docker installed (for local builds) — or use Cloud Build for remote builds
4. Supabase project configured with proper redirect URLs (see [Supabase Configuration](#supabase-configuration))

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

## Continuous Deployment via GitHub Actions (Recommended)

Every push to `main` automatically builds the container and deploys it to Cloud Run.

### 1. Create a GCP Service Account

```bash
PROJECT_ID=your-project-id
SA_NAME=github-cloudrun-deployer

gcloud iam service-accounts create $SA_NAME \
  --display-name="GitHub Actions Cloud Run Deployer"

# Grant required roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

### 2. Set up Workload Identity Federation (keyless auth)

```bash
POOL_NAME=github-actions-pool
PROVIDER_NAME=github-provider
REPO=your-github-org/your-repo-name

# Create pool
gcloud iam workload-identity-pools create $POOL_NAME \
  --location="global" \
  --display-name="GitHub Actions Pool"

POOL_ID=$(gcloud iam workload-identity-pools describe $POOL_NAME \
  --location="global" --format="value(name)")

# Create provider
gcloud iam workload-identity-pools providers create-oidc $PROVIDER_NAME \
  --location="global" \
  --workload-identity-pool=$POOL_NAME \
  --display-name="GitHub OIDC Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Allow the GitHub repo to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding \
  "${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL_ID}/attribute.repository/${REPO}"

# Print the provider resource name (needed for the GitHub secret below)
gcloud iam workload-identity-pools providers describe $PROVIDER_NAME \
  --location="global" \
  --workload-identity-pool=$POOL_NAME \
  --format="value(name)"
```

### 3. Add GitHub Actions Secrets

Go to **Settings → Secrets and variables → Actions** in your GitHub repository and add:

| Secret | Value |
|---|---|
| `GCP_PROJECT_ID` | Your GCP project ID |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Output of the `describe` command above |
| `GCP_SERVICE_ACCOUNT` | `github-cloudrun-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com` |
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |
| `GEMINI_API_KEY` | *(Optional)* Your Gemini API key |

> **Alternative auth**: If you prefer a service-account key JSON instead of WIF, store the key JSON in `GCP_SA_KEY` and update the auth step in `.github/workflows/deploy.yml` to use `credentials_json: ${{ secrets.GCP_SA_KEY }}`.

### 4. Push to main

```bash
git push origin main
```

The workflow in `.github/workflows/deploy.yml` runs automatically and prints the live URL when done.

---

## Manual Deploy Options

### Option A — Using Cloud Build

```bash
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions _VITE_SUPABASE_URL="https://your-project.supabase.co",_VITE_SUPABASE_ANON_KEY="your-anon-key",_GEMINI_API_KEY="your-key-here" \
  .
```

### Option B — Local Docker build + deploy

```bash
export GCP_PROJECT_ID=your-project-id
export VITE_SUPABASE_URL=https://your-project.supabase.co
export VITE_SUPABASE_ANON_KEY=your-anon-key
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

---

## Environment Variables

| Variable | Type | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Build-time | Supabase project URL — baked into JS bundle |
| `VITE_SUPABASE_ANON_KEY` | Build-time | Supabase anon key — baked into JS bundle |
| `GEMINI_API_KEY` | Build-time | Gemini API key — baked into JS bundle (optional) |
| `PORT` | Runtime (auto) | Injected by Cloud Run — nginx reads it automatically |

> See `.env.example` for a template of local development values.

## Architecture

```
GitHub push to main
  └── GitHub Actions (.github/workflows/deploy.yml)
       ├── docker build  (Vite SPA + nginx)
       ├── docker push   (gcr.io)
       └── gcloud run deploy
            └── Cloud Run
                 └── nginx (listens on $PORT = 8080)
                      └── serves /dist (SPA)
                           └── Client-side JS talks to Supabase directly
```

- **No backend server** — all API calls go directly from the browser to Supabase
- **Static SPA** — Nginx serves the built assets with SPA fallback routing
- **Health check** — `GET /healthz` returns `200 ok` (used by Cloud Run)

## Supabase Configuration

After deploying to Cloud Run, you **must** configure the deployment URL in your Supabase project for authentication to work properly.

### Current Production URL

The production deployment is currently running at:
```
https://rr-foam-pro-app-737284866566.us-east5.run.app
```

### Steps to Configure Supabase

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Navigate to **Authentication** → **URL Configuration**
3. Add your deployment URL to the following fields:

   **Site URL:**
   ```
   https://rr-foam-pro-app-737284866566.us-east5.run.app
   ```
   
   For other deployments, use your Cloud Run service URL (format: `https://SERVICE-NAME-PROJECT-ID.REGION.run.app`)

   **Redirect URLs:** (add to the allowed list)
   ```
   https://rr-foam-pro-app-737284866566.us-east5.run.app/**
   ```
   
   > The `**` is Supabase's wildcard pattern that matches all paths under your domain (e.g., `/auth/callback`, `/dashboard`, etc.)
   
   For other deployments, use: `https://YOUR-SERVICE-URL/**`

4. Click **Save** to apply the changes

> **Note**: Without this configuration, authentication will fail because Supabase will reject OAuth callbacks from unregistered URLs. This is a security feature to prevent unauthorized redirects.

### For New Deployments

If you deploy to a different region or with a different service name, make sure to:
1. Get your Cloud Run service URL: `gcloud run services describe rr-foam-pro --region YOUR_REGION --format='value(status.url)'`
2. Add that URL to Supabase's allowed redirect URLs following the steps above

## Custom Domain

```bash
gcloud run domain-mappings create \
  --service rr-foam-pro \
  --domain your-domain.com \
  --region us-central1
```

Follow the DNS verification instructions printed by the command.

> **Important**: If you configure a custom domain, remember to add it to Supabase's redirect URLs as well!

## Cost Optimization

The deployment is configured with:
- **min-instances: 0** — scales to zero when idle (no cost)
- **max-instances: 3** — caps scaling
- **256Mi memory / 1 CPU** — minimal footprint for a static SPA
- **concurrency: 80** — nginx handles many concurrent requests per instance

Estimated cost for low-traffic: **~$0/month** (free tier covers 2M requests/month).

