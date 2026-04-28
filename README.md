# CareerMatch AI

AI-powered job board exclusively for engineers — finds, scores, and tailors your application to every match.

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

## Getting Started

```bash
# Clone and install
git clone https://github.com/<your-username>/careermatch-ai.git
cd careermatch-ai
npm install

# Configure
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY (and optional Gmail creds)

# Run
npm run dev
```

Open http://localhost:5173.

## Environment

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Claude API key from https://console.anthropic.com/ |
| `GMAIL_USER` | optional | Your Gmail address (sender for alerts) |
| `GMAIL_APP_PASSWORD` | optional | 16-char app password from https://myaccount.google.com/apppasswords |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts both the frontend (Vite, port 5173) and backend (Express, port 3001) |
| `npm run server` | Backend only |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

## Project Structure

```
src/
  components/    JobBoard, JobCard, JobDetail, MapModal, Setup
  hooks/         useJobAlerts (browser + email notifications)
  services/      claude.ts (analyze, tailor resume, interview prep)
  utils/         interestMatch, distance (geocoding + haversine)
  data/          jobs.ts (175+ curated engineering jobs)
server.mjs       Express API proxy + live job fetching + email
```

## License

MIT
