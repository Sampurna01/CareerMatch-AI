import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, SlidersHorizontal, Wifi, LogOut, Navigation2, RefreshCw, Bell, BellOff, Sparkles } from 'lucide-react';
import { Job, UserProfile, MatchResult } from '../types';
import { JOBS, ALL_FIELDS } from '../data/jobs';
import { analyzeMatch } from '../services/claude';
import { geocodeCity, haversine, type Coords } from '../utils/distance';
import { interestScore } from '../utils/interestMatch';
import { useJobAlerts } from '../hooks/useJobAlerts';
import JobCard from './JobCard';
import JobDetail from './JobDetail';

interface Props {
  profile: UserProfile;
  onLogout: () => void;
}

export default function JobBoard({ profile, onLogout }: Props) {
  const [searchQ, setSearchQ] = useState('');
  const [fieldFilter, setFieldFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'match' | 'distance' | 'interest'>('interest');
  const [topMatchesOnly, setTopMatchesOnly] = useState(false);
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [jobCoords, setJobCoords] = useState<Record<string, Coords | null>>({});
  const [geocoding, setGeocoding] = useState(false);

  // ── Live jobs ──────────────────────────────────────────────────────────────
  const [liveJobs, setLiveJobs] = useState<Job[]>([]);
  const [liveLastFetched, setLiveLastFetched] = useState<string | null>(null);
  const [loadingLive, setLoadingLive] = useState(false);

  async function fetchLiveJobs(force = false) {
    setLoadingLive(true);
    try {
      const url = force ? '/api/jobs/refresh' : '/api/jobs/live';
      const method = force ? 'POST' : 'GET';
      const res = await fetch(url, { method });
      const data = await res.json();
      setLiveJobs(data.jobs ?? []);
      setLiveLastFetched(data.lastFetched ?? null);
    } catch { /* live jobs unavailable */ }
    finally { setLoadingLive(false); }
  }

  useEffect(() => { fetchLiveJobs(); }, []);

  // Stable poll callback for the alerts hook (avoid re-subscribing on every render)
  const pollLive = useCallback(() => fetchLiveJobs(true), []);

  // All jobs = static + live (deduplicated by id)
  const allJobs = useMemo(() => {
    const ids = new Set(JOBS.map(j => j.id));
    const uniqueLive = liveJobs.filter(j => !ids.has(j.id));
    return [...JOBS, ...uniqueLive];
  }, [liveJobs]);

  // All fields = static + live fields
  const allFields = useMemo(() => {
    const extra = new Set(liveJobs.map(j => j.field).filter(Boolean));
    ALL_FIELDS.forEach(f => extra.delete(f));
    return [...ALL_FIELDS, ...extra].sort();
  }, [liveJobs]);

  // Build sorted list of unique states from all jobs
  const allStates = useMemo(() => {
    const states = new Set(allJobs.map((j) => j.location.split(', ')[1]).filter(Boolean));
    return [...states].sort();
  }, [allJobs]);

  // Geocode user city + all unique job locations when city is available
  useEffect(() => {
    if (!profile.city) return;
    setGeocoding(true);

    const uniqueLocations = [...new Set(allJobs.filter(j => !j.remote).map(j => j.location))];

    Promise.all([
      geocodeCity(profile.city),
      ...uniqueLocations.map(loc => geocodeCity(loc)),
    ]).then(([uCoords, ...jCoordsArr]) => {
      setUserCoords(uCoords);
      const map: Record<string, Coords | null> = {};
      uniqueLocations.forEach((loc, i) => { map[loc] = jCoordsArr[i]; });
      setJobCoords(map);
    }).finally(() => setGeocoding(false));
  }, [profile.city, allJobs]);

  const [matchScores, setMatchScores] = useState<Record<string, MatchResult>>({});
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [analyzeErrors, setAnalyzeErrors] = useState<Record<string, string>>({});
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Only engineering disciplines shown
  const ENGINEERING_FIELDS = new Set(ALL_FIELDS);

  // Job alerts: notify on high interest matches + poll in background
  const alerts = useJobAlerts({ jobs: allJobs, profile, onPoll: pollLive, threshold: 65 });

  // Cache interest score per job (cheap pure function but called many times)
  const interestScores = useMemo(() => {
    const map: Record<string, number> = {};
    for (const j of allJobs) map[j.id] = interestScore(j, profile);
    return map;
  }, [allJobs, profile]);

  // Filter jobs
  const filtered = useMemo(() => {
    const q = searchQ.toLowerCase();
    return allJobs.filter((job) => {
      if (!ENGINEERING_FIELDS.has(job.field)) return false;
      if (q && !job.title.toLowerCase().includes(q) && !job.company.toLowerCase().includes(q) && !job.description.toLowerCase().includes(q)) return false;
      if (fieldFilter && job.field !== fieldFilter) return false;
      if (typeFilter && job.type !== typeFilter) return false;
      if (locationFilter && !job.location.includes(locationFilter)) return false;
      if (remoteOnly && !job.remote) return false;
      if (topMatchesOnly && (interestScores[job.id] ?? 0) < 60) return false;
      return true;
    });
  }, [allJobs, searchQ, fieldFilter, typeFilter, locationFilter, remoteOnly, topMatchesOnly, interestScores]);

  // Helper: distance from user to a job in miles
  function distanceTo(job: Job): number {
    if (job.remote || !userCoords || !jobCoords[job.location]) return Infinity;
    return haversine(userCoords, jobCoords[job.location]!);
  }

  // Sort jobs
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === 'distance') {
        return distanceTo(a) - distanceTo(b);
      }
      if (sortBy === 'interest') {
        // Primary: interest score; tiebreak with AI score if available
        const ia = interestScores[a.id] ?? 0;
        const ib = interestScores[b.id] ?? 0;
        if (ib !== ia) return ib - ia;
        const sa = matchScores[a.id]?.overallScore ?? -1;
        const sb = matchScores[b.id]?.overallScore ?? -1;
        return sb - sa;
      }
      const sa = matchScores[a.id]?.overallScore ?? -1;
      const sb = matchScores[b.id]?.overallScore ?? -1;
      return sb - sa;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, matchScores, interestScores, sortBy, userCoords, jobCoords]);

  async function handleAnalyze(job: Job) {
    if (analyzingIds.has(job.id) || matchScores[job.id]) return;
    setAnalyzingIds((s) => new Set(s).add(job.id));
    setAnalyzeErrors((e) => { const n = { ...e }; delete n[job.id]; return n; });
    try {
      const result = await analyzeMatch(profile, job);
      setMatchScores((m) => ({ ...m, [job.id]: result }));
    } catch (e: any) {
      const status = e?.status;
      const errMsg: string = e?.message ?? '';
      const isBilling = status === 402 || errMsg.toLowerCase().includes('credit') || errMsg.toLowerCase().includes('billing');
      const msg =
        isBilling ? 'No API credits — add billing at console.anthropic.com' :
        status === 401 ? 'Invalid API key' :
        status === 429 ? 'Rate limited — wait a moment' :
        (status >= 500) ? 'Server error — try again' :
        'Analysis failed';
      setAnalyzeErrors((errs) => ({ ...errs, [job.id]: msg }));
    } finally {
      setAnalyzingIds((s) => { const n = new Set(s); n.delete(job.id); return n; });
    }
  }

  async function handleAnalyzeAll() {
    const unscored = filtered.filter((j) => !matchScores[j.id] && !analyzingIds.has(j.id)).slice(0, 10);
    for (const job of unscored) {
      await handleAnalyze(job);
    }
  }

  const AppHeader = () => (
    <header className="sticky top-0 z-20" style={{
      background: 'linear-gradient(135deg,#0f0c29 0%,#1a1040 50%,#1e1245 100%)',
      boxShadow: '0 1px 0 rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.3)'
    }}>
      <div className="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between">
        {/* Logo — click to go home */}
        <button
          onClick={() => {
            setSelectedJob(null);
            setSearchQ('');
            setFieldFilter('');
            setTypeFilter('');
            setLocationFilter('');
            setRemoteOnly(false);
            setTopMatchesOnly(false);
            setSortBy('interest');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-center gap-2.5 group cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
          title="Back to home"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-shadow group-hover:shadow-lg group-hover:shadow-indigo-500/40"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
            <SlidersHorizontal className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-white text-lg tracking-tight">
            CareerMatch <span className="text-gradient">AI</span>
          </span>
        </button>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-white/8 rounded-xl px-3 py-1.5 border border-white/10">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
              {profile.name.slice(0,1).toUpperCase()}
            </div>
            <div className="text-xs">
              <span className="text-white/90 font-semibold">{profile.name}</span>
              <span className="text-white/40 mx-1">·</span>
              <span className="text-white/50">{profile.field}</span>
            </div>
          </div>
          {/* Job alerts bell + email popover */}
          <div className="relative">
            <button
              onClick={() => { alerts.clearBadge(); setAlertsOpen(o => !o); }}
              className={`relative flex items-center gap-1.5 transition-colors text-xs font-medium px-2 py-1.5 rounded-lg ${
                alerts.enabled || alerts.emailEnabled
                  ? 'text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20'
                  : 'text-white/40 hover:text-white/80 hover:bg-white/8'
              }`}
              title="Job alerts"
            >
              {alerts.enabled || alerts.emailEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">
                {alerts.emailEnabled ? 'Email on' : alerts.enabled ? 'Alerts on' : 'Alerts'}
              </span>
              {alerts.newMatchCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-slate-900">
                  {alerts.newMatchCount > 9 ? '9+' : alerts.newMatchCount}
                </span>
              )}
            </button>

            {alertsOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 z-50"
                style={{ color: '#1e293b' }}
              >
                {/* Backdrop click to close */}
                <button
                  className="fixed inset-0 -z-10 cursor-default"
                  onClick={() => setAlertsOpen(false)}
                  aria-label="close"
                  style={{ background: 'transparent' }}
                />

                <h3 className="font-bold text-base mb-1 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-emerald-500" /> Job Alerts
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Get notified the moment we find a job that matches your interests.
                </p>

                {/* ── Email alerts (primary) ── */}
                <div className="mb-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">Email alerts</div>
                    {alerts.emailEnabled && (
                      <button
                        onClick={() => { alerts.disableEmail(); setEmailMsg(null); }}
                        className="text-[11px] text-rose-500 hover:text-rose-700 font-semibold"
                      >Turn off</button>
                    )}
                  </div>

                  {alerts.emailConfigured === false ? (
                    <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <strong className="block mb-1">Server email not configured.</strong>
                      Add <code className="bg-white px-1 rounded">GMAIL_USER</code> and <code className="bg-white px-1 rounded">GMAIL_APP_PASSWORD</code> to your <code className="bg-white px-1 rounded">.env</code>, then restart the server.
                      <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer"
                        className="block mt-1 text-amber-800 underline">How to create a Gmail app password →</a>
                    </div>
                  ) : alerts.emailEnabled ? (
                    <div>
                      <div className="text-xs text-slate-600 mb-2">
                        Sending matches to <strong className="text-slate-800">{alerts.emailAddress}</strong>
                      </div>
                      <button
                        onClick={async () => {
                          setEmailMsg(null);
                          const r = await alerts.sendTestEmail();
                          setEmailMsg(r.ok ? { ok: true, text: 'Test email sent! Check your inbox.' } : { ok: false, text: r.error || 'Failed' });
                        }}
                        className="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700"
                      >Send test email</button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="email"
                        value={emailDraft}
                        onChange={e => setEmailDraft(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                      />
                      <button
                        onClick={async () => {
                          setEmailMsg(null);
                          const r = await alerts.enableEmail(emailDraft);
                          if (!r.ok) setEmailMsg({ ok: false, text: r.error || 'Invalid' });
                          else setEmailMsg({ ok: true, text: 'Email alerts on. We\'ll send a confirmation.' });
                          if (r.ok) {
                            // Auto send a test
                            await alerts.sendTestEmail();
                          }
                        }}
                        className="w-full text-xs font-bold py-2 rounded-lg text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-md shadow-emerald-200/60"
                      >
                        Enable email alerts
                      </button>
                    </div>
                  )}
                  {emailMsg && (
                    <div className={`mt-2 text-xs ${emailMsg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {emailMsg.text}
                    </div>
                  )}
                </div>

                {/* ── Browser notifications (secondary) ── */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">Browser notifications</div>
                    {alerts.enabled && (
                      <button
                        onClick={alerts.disable}
                        className="text-[11px] text-rose-500 hover:text-rose-700 font-semibold"
                      >Turn off</button>
                    )}
                  </div>
                  {alerts.permission === 'unsupported' ? (
                    <div className="text-xs text-slate-400">Not supported in this browser.</div>
                  ) : alerts.enabled ? (
                    <div className="text-xs text-slate-600">Pop-up notifications are active.</div>
                  ) : (
                    <button
                      onClick={alerts.enable}
                      className="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700"
                    >
                      Enable browser pop-ups
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <button onClick={onLogout}
            className="flex items-center gap-1.5 text-white/40 hover:text-white/80 transition-colors text-xs font-medium px-2 py-1.5 rounded-lg hover:bg-white/8"
            title="Start over"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );

  if (selectedJob) {
    return (
      <div className="min-h-screen bg-dot-grid">
        <AppHeader />
        <JobDetail
          job={selectedJob}
          profile={profile}
          existingMatch={matchScores[selectedJob.id]}
          onBack={() => setSelectedJob(null)}
        />
      </div>
    );
  }

  const scoredCount = Object.keys(matchScores).length;

  return (
    <div className="min-h-screen bg-dot-grid">
      <AppHeader />

      {/* ── Hero banner ── */}
      <div className="relative overflow-hidden" style={{ height: 200 }}>
        {/* Photo */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1920&q=80&auto=format&fit=crop')",
          }}
        />
        {/* Overlay */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to bottom, rgba(15,12,41,0.82) 0%, rgba(26,16,64,0.78) 60%, rgba(248,250,252,0.0) 100%)'
        }} />
        {/* Side fade to blend with dot-grid bg */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(to bottom, transparent 50%, #f8fafc 100%)'
        }} />
        {/* Text content */}
        <div className="relative max-w-6xl mx-auto px-5 h-full flex flex-col justify-center gap-1">
          <p className="text-white/50 text-sm font-medium tracking-wide">
            Welcome back, <span className="text-white/90 font-semibold">{profile.name}</span>
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
            Find Your <span className="text-gradient">Engineering Job</span>
          </h2>
          <p className="text-white/50 text-sm mt-0.5">
            {profile.field} · {profile.city ?? 'Anywhere'} ·{' '}
            <span className="text-emerald-400 font-semibold">{liveJobs.length} live listings</span> refreshed automatically
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-6 -mt-2">
        {/* ── Search + Filters ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-5 flex flex-wrap gap-2.5">
          {/* Search */}
          <div className="flex-1 min-w-48 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search jobs, companies, keywords…"
              className="w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-xl
                         focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400
                         transition-all bg-slate-50/60 placeholder:text-slate-400"
            />
          </div>

          <select value={fieldFilter} onChange={(e) => setFieldFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white text-slate-600 cursor-pointer">
            <option value="">All Fields</option>
            {allFields.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>

          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white text-slate-600 cursor-pointer">
            <option value="">All Types</option>
            <option value="Internship">Internship</option>
            <option value="Full-time">Full-time</option>
            <option value="Part-time">Part-time</option>
            <option value="Contract">Contract</option>
          </select>

          <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white text-slate-600 cursor-pointer">
            <option value="">All Locations</option>
            {allStates.map((state) => <option key={state} value={state}>{state}</option>)}
          </select>

          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer px-1 select-none">
            <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
            <Wifi className="w-3.5 h-3.5 text-teal-500" />
            <span className="font-medium">Remote</span>
          </label>

          {/* Top matches filter (interest-keyword based, instant) */}
          <button
            onClick={() => {
              setTopMatchesOnly(v => !v);
              setSortBy('interest');
            }}
            className={`text-sm px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition-all border ${
              topMatchesOnly
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200'
                : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-600'
            }`}
            title="Show only jobs matching your interests & skills"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Top matches
          </button>

          {profile.city && (
            <button
              onClick={() => setSortBy(s => s === 'distance' ? 'interest' : 'distance')}
              disabled={geocoding}
              className={`text-sm px-3.5 py-2 rounded-xl font-semibold flex items-center gap-1.5 transition-all border ${
                sortBy === 'distance'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              <Navigation2 className="w-3.5 h-3.5" />
              {geocoding ? 'Locating…' : 'Nearest first'}
            </button>
          )}

          <button onClick={handleAnalyzeAll}
            className="ml-auto text-sm px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all
                       bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700
                       text-white shadow-md shadow-indigo-200/60 hover:shadow-lg hover:shadow-indigo-200/80">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Analyze All
          </button>
        </div>

        {/* ── Stats bar ── */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-700">{filtered.length}</span>
            <span className="text-sm text-slate-400">jobs found</span>
            {liveJobs.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full ring-1 ring-emerald-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {liveJobs.length} live
              </span>
            )}
            {scoredCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full ring-1 ring-indigo-200/60">
                ✦ {scoredCount} scored
              </span>
            )}
            {(() => {
              const topCount = filtered.filter(j => (interestScores[j.id] ?? 0) >= 60).length;
              return topCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full ring-1 ring-amber-200/60">
                  <Sparkles className="w-3 h-3" /> {topCount} match your interests
                </span>
              ) : null;
            })()}
          </div>
          <div className="flex items-center gap-3">
            {liveLastFetched && (
              <span className="text-xs text-slate-400">
                Updated {new Date(liveLastFetched).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={() => fetchLiveJobs(true)}
              disabled={loadingLive}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 transition-colors disabled:opacity-50"
              title="Fetch latest jobs now"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLive ? 'animate-spin' : ''}`} />
              {loadingLive ? 'Fetching…' : 'Refresh jobs'}
            </button>
          </div>
        </div>

        {/* Job grid */}
        {sorted.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No jobs match your filters</p>
            <p className="text-sm">Try adjusting the search or filters above</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map((job) => {
              const dist = (!job.remote && userCoords && jobCoords[job.location])
                ? haversine(userCoords, jobCoords[job.location]!)
                : null;
              return (
              <JobCard
                key={job.id}
                job={job}
                match={matchScores[job.id]}
                analyzing={analyzingIds.has(job.id)}
                analyzeError={analyzeErrors[job.id]}
                userCity={profile.city}
                distanceMiles={dist ?? undefined}
                onAnalyze={() => handleAnalyze(job)}
                onClick={() => setSelectedJob(job)}
              />
              );
            })}
          </div>
        )}
      </div> {/* end max-w-6xl */}
    </div>
  );
}
