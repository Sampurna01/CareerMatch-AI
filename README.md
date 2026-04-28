# CareerMatch AI

> AI-powered job board exclusively for engineers — finds, scores, and tailors your application to every match.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)](https://nodejs.org/)

## Features

- 🤖 **AI Match Scoring** — Claude analyzes your profile vs. each job across 5 dimensions (skills, experience, seniority, education, interests)
- ✨ **Resume Tailoring** — Rewrites your resume per job using ATS-optimized keywords
- 📚 **Interview Prep** — Generates a personalized interview guide for any job
- 🌐 **Live Job Feed** — Pulls fresh listings from Remotive & Arbeitnow every 2 hours, deduplicated
- 🔔 **Email & Browser Alerts** — Get notified the moment a job matches your interests
- 🗺️ **Map View** — Click any job's city to see the route from your location
- 📍 **Distance-aware** — Geocodes jobs and sorts by proximity
- 🎯 **Top Matches** — Instant keyword-based interest scoring (no API cost)

## Tech Stack

- **Frontend:** Vite + React 18 + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express (proxies the Anthropic API + serves live jobs)
- **AI:** Anthropic Claude (Opus & Haiku)
- **Email:** Nodemailer + Gmail SMTP
- **Maps:** Google Maps (embed) + OpenStreetMap (geocoding)

## Local Development

```bash
git clone https://github.com/Sampurna01/CareerMatch-AI.git
cd CareerMatch-AI
npm install
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:5173.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Claude API key from https://console.anthropic.com/ |
| `GMAIL_USER` | optional | Your Gmail address (sender for alerts) |
| `GMAIL_APP_PASSWORD` | optional | 16-char app password from https://myaccount.google.com/apppasswords |
| `PORT` | optional | Defaults to 3001 in dev / platform-provided in prod |

## Deploy

### Option A — Render (one click, full-stack, free tier)

1. Push to GitHub *(already done)*
2. Go to **https://render.com/deploy**, paste your repo URL
3. Render auto-detects `render.yaml` — click **Apply**
4. In the Render dashboard, set the secret env vars:
   - `ANTHROPIC_API_KEY`
   - `GMAIL_USER` *(optional)*
   - `GMAIL_APP_PASSWORD` *(optional)*
5. Wait ~3 minutes for build → done

The free tier sleeps after 15 min idle. First request after sleep takes ~30s to wake up.

### Option B — Vercel (frontend) + Render (backend)

If you want a faster frontend with no cold starts:
1. Deploy the backend on Render as above
2. In `vercel.json`, replace `YOUR-BACKEND.onrender.com` with your actual Render URL
3. Push the change, then **https://vercel.com/new** → import your repo → Deploy

### Option C — Anywhere with Node 18+

```bash
npm run build
npm start
```

Visit `http://localhost:3001` (Express serves both the API and the built frontend).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Frontend (Vite, 5173) + backend (Express, 3001) in parallel |
| `npm run build` | Production build to `dist/` |
| `npm start` | Production server (serves built frontend + API) |
| `npm run server` | Backend only (dev mode) |
| `npm run preview` | Preview the production build via Vite |

## Project Structure

```
src/
  components/    JobBoard, JobCard, JobDetail, MapModal, Setup
  hooks/         useJobAlerts (browser + email notifications)
  services/      claude.ts (analyze, tailor resume, interview prep)
  utils/         interestMatch, distance (geocoding + haversine)
  data/          jobs.ts (175+ curated engineering jobs)
server.mjs       Express API proxy + live job fetching + email
render.yaml      Render deploy blueprint
vercel.json      Vercel deploy config (frontend only)
```

## License

[MIT](LICENSE)
