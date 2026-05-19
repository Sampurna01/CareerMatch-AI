import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import nodemailer from 'nodemailer';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Load .env manually (works with all Node versions)
try {
  const env = readFileSync(new URL('.env', import.meta.url), 'utf8');
  for (const line of env.split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  }
} catch { /* no .env file */ }

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 3001;
const CACHE_FILE = new URL('jobs-live.json', import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, 'dist');
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || existsSync(DIST_DIR);
const EMAILED_FILE = new URL('emailed-jobs.json', import.meta.url);

// ─── Email transporter (Gmail SMTP via app password) ──────────────────────────
let mailer = null;
function getMailer() {
  if (mailer) return mailer;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  mailer = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  return mailer;
}

// Persistent set of jobIds we've already emailed about (so we don't spam)
function loadEmailed() {
  try { return new Set(JSON.parse(readFileSync(EMAILED_FILE, 'utf8'))); }
  catch { return new Set(); }
}
function saveEmailed(set) {
  try {
    const arr = [...set].slice(-2000); // keep last 2000
    writeFileSync(EMAILED_FILE, JSON.stringify(arr));
  } catch { /* ignore */ }
}
const emailedJobs = loadEmailed();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html = '') {
  return html.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function daysSince(dateStr) {
  if (!dateStr) return 0;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function normalizeType(t = '') {
  const s = t.toLowerCase();
  if (s.includes('intern') || s.includes('co-op') || s.includes('coop')) return 'Internship';
  if (s.includes('part')) return 'Part-time';
  if (s.includes('contract') || s.includes('freelance')) return 'Contract';
  return 'Full-time';
}

// Returns null for non-engineering — those jobs will be filtered out
function mapCategory(cat = '') {
  const c = cat.toLowerCase();
  if (c.includes('software') || c.includes('web') || c.includes('mobile') || c.includes('frontend') || c.includes('backend') || c.includes('fullstack') || c.includes('full-stack')) return 'Software Engineering';
  if (c.includes('data') || c.includes('analytics') || c.includes('ml') || c.includes('machine') || c.includes(' ai') || c.includes('deep learning') || c.includes('nlp')) return 'Data Science / AI';
  if (c.includes('devops') || c.includes('cloud') || c.includes('infra') || c.includes('sre') || c.includes('platform') || c.includes('sysadmin') || c.includes('reliability')) return 'DevOps / Cloud';
  if (c.includes('cyber') || c.includes('security') || c.includes('infosec')) return 'Cybersecurity';
  if (c.includes('electrical')) return 'Electrical Engineering';
  if (c.includes('mechanical')) return 'Mechanical Engineering';
  if (c.includes('civil')) return 'Civil Engineering';
  if (c.includes('chemical') || c.includes('chemistry')) return 'Chemical Engineering';
  if (c.includes('biomedical') || c.includes('biomed')) return 'Biomedical Engineering';
  if (c.includes('environ')) return 'Environmental Science';
  if (c.includes('engineer')) return 'Software Engineering'; // generic "engineering" → software
  return null; // non-engineering — skip
}

// ─── Live Job Fetchers ─────────────────────────────────────────────────────────

async function fetchRemotive() {
  const categories = ['software-dev', 'engineering', 'data', 'devops-sysadmin'];
  const all = [];
  for (const cat of categories) {
    try {
      const r = await fetch(`https://remotive.com/api/remote-jobs?category=${cat}&limit=40`, {
        headers: { 'User-Agent': 'CareerMatchAI/1.0' },
        signal: AbortSignal.timeout(10_000),
      });
      const d = await r.json();
      for (const j of (d.jobs || [])) {
        const field = mapCategory(j.category);
        if (!field) continue; // skip non-engineering
        all.push({
          id: `remotive-${j.id}`,
          title: j.title,
          company: j.company_name,
          location: j.candidate_required_location || 'Remote',
          type: normalizeType(j.job_type),
          field,
          description: stripHtml(j.description).slice(0, 700),
          requirements: (j.tags || []).filter(Boolean).slice(0, 10),
          niceToHave: [],
          salary: j.salary || 'Competitive',
          remote: true,
          postedDaysAgo: daysSince(j.publication_date),
          isLive: true,
          applyUrl: j.url,
          source: 'Remotive',
        });
      }
    } catch (e) {
      console.warn(`[Jobs] Remotive [${cat}] failed:`, e.message);
    }
  }
  return all;
}

async function fetchArbeitnow() {
  try {
    const r = await fetch('https://www.arbeitnow.com/api/job-board-api?page=1', {
      headers: { 'User-Agent': 'CareerMatchAI/1.0' },
      signal: AbortSignal.timeout(10_000),
    });
    const d = await r.json();
    return (d.data || []).flatMap(j => {
      const field = mapCategory((j.tags || []).join(' ') + ' ' + j.title);
      if (!field) return []; // skip non-engineering
      return [{
        id: `arbeitnow-${j.slug}`,
        title: j.title,
        company: j.company_name,
        location: j.location || 'Remote',
        type: normalizeType((j.job_types || [])[0]),
        field,
        description: stripHtml(j.description).slice(0, 700),
        requirements: (j.tags || []).filter(Boolean).slice(0, 10),
        niceToHave: [],
        salary: 'Competitive',
        remote: !!j.remote,
        postedDaysAgo: daysSince(j.created_at),
        isLive: true,
        applyUrl: j.url,
        source: 'Arbeitnow',
      }];
    });
  } catch (e) {
    console.warn('[Jobs] Arbeitnow failed:', e.message);
    return [];
  }
}

// ─── Cache & Auto-refresh ──────────────────────────────────────────────────────

let liveJobsCache = [];
let lastFetched = null;

async function refreshLiveJobs() {
  console.log('[Jobs] Fetching live jobs from APIs…');
  const [remotive, arbeitnow] = await Promise.all([fetchRemotive(), fetchArbeitnow()]);

  // Deduplicate by id
  const seen = new Set();
  const merged = [...remotive, ...arbeitnow].filter(j => {
    if (seen.has(j.id)) return false;
    seen.add(j.id);
    return true;
  });

  liveJobsCache = merged;
  lastFetched = new Date().toISOString();

  console.log(`[Jobs] ✓ ${liveJobsCache.length} live jobs (${remotive.length} Remotive, ${arbeitnow.length} Arbeitnow)`);

  try {
    writeFileSync(CACHE_FILE, JSON.stringify({ jobs: liveJobsCache, lastFetched }, null, 2));
  } catch (e) {
    console.warn('[Jobs] Cache write failed:', e.message);
  }
}

// Load cache on startup, then do a fresh fetch in background
try {
  const cached = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
  liveJobsCache = cached.jobs || [];
  lastFetched = cached.lastFetched;
  const ageHours = (Date.now() - new Date(lastFetched).getTime()) / 3_600_000;
  console.log(`[Jobs] Loaded ${liveJobsCache.length} cached jobs (${ageHours.toFixed(1)}h old)`);
  if (ageHours > 2) refreshLiveJobs();  // stale — refresh immediately
} catch {
  refreshLiveJobs();  // no cache — fetch now
}

// Auto-refresh every 2 hours
setInterval(refreshLiveJobs, 2 * 60 * 60 * 1000);

// ─── Groq client (via OpenAI SDK) ────────────────────────────────────────────────

function getClient() {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY is not set on the server');
  return new OpenAI({
    apiKey: key,
    baseURL: 'https://api.groq.com/openai/v1',
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ready: !!process.env.GROQ_API_KEY });
});

// Geocode city → { lat, lon }
app.get('/api/geocode', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'Missing query' });
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=us`;
    const r = await fetch(url, { headers: { 'User-Agent': 'CareerMatchAI/1.0' } });
    const data = await r.json();
    if (!data.length) return res.json(null);
    res.json({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
  } catch (e) {
    res.status(500).json({ error: e?.message });
  }
});

// Live jobs endpoint
app.get('/api/jobs/live', (_req, res) => {
  res.json({ jobs: liveJobsCache, lastFetched, count: liveJobsCache.length });
});

// Force-refresh live jobs (handy for testing)
app.post('/api/jobs/refresh', async (_req, res) => {
  await refreshLiveJobs();
  res.json({ count: liveJobsCache.length, lastFetched });
});

// Non-streaming: job match analysis
app.post('/api/analyze', async (req, res) => {
  try {
    const client = getClient();
    const { messages, max_tokens } = req.body;
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: max_tokens || 1024,
    });
    res.json(response);
  } catch (e) {
    console.error('[API] Analyze error:', e?.message, e?.error, e?.response?.data);
    const status = e?.status ?? 500;
    res.status(status).json({ error: e?.message ?? 'Server error' });
  }
});

// Streaming: interview prep via Server-Sent Events
app.post('/api/interview', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  try {
    const client = getClient();
    const { messages, max_tokens } = req.body;
    const stream = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: max_tokens || 1024,
      stream: true,
    });
    for await (const chunk of stream) {
      if (chunk.choices[0]?.delta?.content) {
        res.write(`data: ${JSON.stringify({ text: chunk.choices[0].delta.content })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e?.message ?? 'Server error' })}\n\n`);
  } finally {
    res.end();
  }
});

// Streaming: tailor resume to a specific job description
app.post('/api/tailor-resume', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  try {
    const client = getClient();
    const { messages, max_tokens } = req.body;
    const stream = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: max_tokens || 1024,
      stream: true,
    });
    for await (const chunk of stream) {
      if (chunk.choices[0]?.delta?.content) {
        res.write(`data: ${JSON.stringify({ text: chunk.choices[0].delta.content })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e?.message ?? 'Server error' })}\n\n`);
  } finally {
    res.end();
  }
});

// ─── Email job alerts ─────────────────────────────────────────────────────────

// Status — does the server have email credentials set up?
app.get('/api/alerts/status', (_req, res) => {
  res.json({
    configured: !!getMailer(),
    sender: process.env.GMAIL_USER || null,
  });
});

// Send a test email
app.post('/api/alerts/test', async (req, res) => {
  const { to } = req.body || {};
  if (!to) return res.status(400).json({ error: 'Missing recipient email' });
  const m = getMailer();
  if (!m) return res.status(503).json({ error: 'Email not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env' });
  try {
    await m.sendMail({
      from: `"CareerMatch AI" <${process.env.GMAIL_USER}>`,
      to,
      subject: '✓ CareerMatch AI alerts are active',
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#1e293b">
          <h2 style="margin:0 0 16px;font-size:22px;background:linear-gradient(90deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent">CareerMatch AI</h2>
          <p style="font-size:16px;line-height:1.6">You're all set! 🎉 You'll get an email here whenever we find an engineering job that matches your interests.</p>
          <p style="font-size:14px;color:#64748b;margin-top:24px">— sent from your CareerMatch AI server</p>
        </div>`,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e?.message ?? 'Send failed' });
  }
});

// Send job-match alert (called by frontend when high-interest matches detected)
app.post('/api/alerts/notify', async (req, res) => {
  const { to, jobs = [], profile = {} } = req.body || {};
  if (!to) return res.status(400).json({ error: 'Missing recipient email' });
  if (!Array.isArray(jobs) || jobs.length === 0) return res.json({ ok: true, sent: 0 });

  const m = getMailer();
  if (!m) return res.status(503).json({ error: 'Email not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env' });

  // Filter out jobs we've already emailed about
  const fresh = jobs.filter(j => j?.id && !emailedJobs.has(j.id));
  if (fresh.length === 0) return res.json({ ok: true, sent: 0, skipped: jobs.length });

  // Build HTML email
  const jobCards = fresh.map(j => `
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:12px 0;background:#fff">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="background:#10b981;color:#fff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px">${j.score ?? 'NEW'}% match</span>
        <span style="font-size:11px;color:#64748b">${j.type || ''}</span>
      </div>
      <h3 style="margin:6px 0;font-size:17px;color:#0f172a">${escapeHtml(j.title)}</h3>
      <p style="margin:2px 0;font-size:14px;color:#475569"><strong>${escapeHtml(j.company)}</strong> · ${escapeHtml(j.location)}</p>
      ${j.salary ? `<p style="margin:2px 0;font-size:13px;color:#64748b">${escapeHtml(j.salary)}</p>` : ''}
      <p style="margin:8px 0 12px;font-size:13px;color:#475569;line-height:1.5">${escapeHtml((j.description || '').slice(0, 200))}${(j.description || '').length > 200 ? '…' : ''}</p>
      ${j.applyUrl ? `<a href="${j.applyUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:9px 18px;border-radius:8px;font-size:13px;font-weight:600">Apply at ${escapeHtml(j.company)} →</a>` : ''}
    </div>
  `).join('');

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f8fafc">
      <h2 style="margin:0 0 8px;font-size:22px;background:linear-gradient(90deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent">CareerMatch AI</h2>
      <p style="margin:0 0 20px;font-size:15px;color:#475569">
        ${fresh.length === 1 ? "We found a new job that matches your interests:" : `We found <strong>${fresh.length} new jobs</strong> that match your interests${profile.field ? ` in ${escapeHtml(profile.field)}` : ''}:`}
      </p>
      ${jobCards}
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;text-align:center">
        You're getting this because you enabled job alerts in CareerMatch AI.
      </p>
    </div>`;

  const subject = fresh.length === 1
    ? `✨ New match: ${fresh[0].title} at ${fresh[0].company}`
    : `🎯 ${fresh.length} new engineering matches for you`;

  try {
    await m.sendMail({
      from: `"CareerMatch AI" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    fresh.forEach(j => emailedJobs.add(j.id));
    saveEmailed(emailedJobs);
    res.json({ ok: true, sent: fresh.length, skipped: jobs.length - fresh.length });
  } catch (e) {
    res.status(500).json({ error: e?.message ?? 'Send failed' });
  }
});

function escapeHtml(s = '') {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// ─── Static frontend (production only) ───────────────────────────────────────
// In production, Express serves the built React app from /dist.
// In dev, Vite handles the frontend on port 5173.
if (IS_PRODUCTION && existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  // SPA fallback — any non-API route returns index.html
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
  console.log(`[server] Serving production build from ${DIST_DIR}`);
}

app.listen(PORT, () => console.log(`API proxy running on http://localhost:${PORT}`));
