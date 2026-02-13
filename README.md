<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# RFE Foam Pro - Enterprise Spray Foam Suite

Professional spray foam estimation and rig management application built as a Progressive Web App (PWA).

[![Netlify Status](https://api.netlify.com/api/v1/badges/YOUR-SITE-ID/deploy-status)](https://app.netlify.com/sites/YOUR-SITE-NAME/deploys)

## Features

✨ **Progressive Web App** - Install on desktop and mobile  
📱 **Fully Responsive** - Optimized for smartphones, tablets, and desktop  
🔄 **Offline Support** - Works without internet connection  
⚡ **Fast & Modern** - Built with React and Vite  
🎨 **Professional UI** - Clean, intuitive interface

## Quick Start

View your app in AI Studio: https://ai.studio/apps/drive/19fddk-P3p4E_IAL4siYhV5yTPiUk8kpR

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set the `GEMINI_API_KEY` in `.env.local`:
   ```bash
   GEMINI_API_KEY=your_api_key_here
   ```

3. Run the app:
   ```bash
   npm run dev
   ```

## Deploy to Netlify

See [NETLIFY_DEPLOY.md](./NETLIFY_DEPLOY.md) for detailed deployment instructions.

**Quick Deploy:**
1. Connect repository to Netlify
2. Set `GEMINI_API_KEY` environment variable
3. Deploy! (Auto-configured with `netlify.toml`)

## PWA Installation

Once deployed or running locally, you can install the app:

- **Desktop (Chrome/Edge)**: Click install icon in address bar
- **iOS Safari**: Share → Add to Home Screen  
- **Android Chrome**: Menu → Install app

## Tech Stack

- **Frontend**: React 19, TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS (CDN)
- **Icons**: Lucide React
- **PDF Generation**: jsPDF
- **Backend**: Supabase (Postgres, Auth, Storage)
- **Deployment**: Netlify (optimized)

## Development

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```
