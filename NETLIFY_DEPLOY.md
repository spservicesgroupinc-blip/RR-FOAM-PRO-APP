# Netlify Deployment Guide

## Deploy to Netlify

This app is configured for easy deployment to Netlify.

### Quick Deploy

1. **Connect your repository to Netlify**
   - Go to https://app.netlify.com
   - Click "Add new site" > "Import an existing project"
   - Choose your Git provider and select this repository

2. **Build settings** (auto-configured via netlify.toml)
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: 18

3. **Environment Variables**
   - Add `GEMINI_API_KEY` in Netlify's environment variables section
   - Site settings > Environment variables > Add a variable

4. **Deploy!**
   - Click "Deploy site"
   - Your app will be live in a few minutes

### Features Enabled

✅ **Progressive Web App (PWA)**
- Installable on desktop and mobile devices
- Offline support with service worker
- App-like experience

✅ **Responsive Design**
- Mobile-first design
- Touch-friendly interactions
- Works great on phones, tablets, and desktop

✅ **Optimized Performance**
- Static asset caching
- Service worker for offline functionality
- Fast load times

### Testing Locally

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### PWA Installation

Once deployed, users can install the app:

- **Desktop (Chrome/Edge)**: Click the install icon in the address bar
- **Mobile (iOS)**: Safari > Share > Add to Home Screen
- **Mobile (Android)**: Chrome > Menu > Install app

### Troubleshooting

If you encounter issues:

1. Clear browser cache and service workers
2. Check environment variables are set correctly
3. Review Netlify build logs
4. Ensure `GEMINI_API_KEY` is configured

### Production URL

After deployment, your app will be available at:
`https://[your-site-name].netlify.app`

You can customize this domain in Netlify settings.
