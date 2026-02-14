# ── Build Stage ──────────────────────────────────────────────────────────────
FROM node:18-alpine AS build

WORKDIR /app

# Install dependencies first (layer cache optimisation)
COPY package*.json ./
RUN npm ci

# Copy source & build the Vite SPA
COPY . .

# Accept optional build-time env vars (e.g. GEMINI_API_KEY)
ARG GEMINI_API_KEY=""
ENV GEMINI_API_KEY=${GEMINI_API_KEY}

RUN npm run build

# ── Production Stage (Nginx on Cloud Run) ────────────────────────────────────
FROM nginx:stable-alpine

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config template
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Cloud Run injects PORT env var (default 8080).
# The official nginx image auto-processes *.template files in
# /etc/nginx/templates/ using envsubst on container start.
ENV PORT=8080

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
