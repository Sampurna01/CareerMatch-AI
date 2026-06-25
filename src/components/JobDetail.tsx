import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  MapPin,
  Wifi,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  Sparkles,
  BookOpen,
  ExternalLink,
  FileText,
  Copy,
  Check,
  Download,
} from 'lucide-react';
import { Job, UserProfile, MatchResult } from '../types';
import { analyzeMatch, streamInterviewPrep, streamTailorResume } from '../services/claude';
import { scoreColor, scoreLabel } from './MatchRing';
import MatchRadar from './MatchRadar';

interface Props {
  job: Job;
  profile: UserProfile;
  existingMatch?: MatchResult;
  onBack: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  Internship:  'bg-violet-100 text-violet-700',
  'Full-time': 'bg-emerald-100 text-emerald-700',
  'Part-time': 'bg-sky-100 text-sky-700',
  Contract:    'bg-orange-100 text-orange-700',
};

// Field → Unsplash photo for the hero banner
const FIELD_PHOTOS: Record<string, string> = {
  'Software Engineering':   'photo-1555066931-4365d14bab8c',
  'Data Science':           'photo-1551288049-bebda4e38f71',
  'Electrical Engineering': 'photo-1518770660439-4636190af475',
  'Mechanical Engineering': 'photo-1581091226825-a6a2a5aee158',
  'DevOps / Cloud':         'photo-1451187580459-43490279c0fa',
  'Cybersecurity':          'photo-1614064641938-3bbee52942c7',
  'Product Management':     'photo-1531403009284-440f080d1e12',
  'Design':                 'photo-1558655146-364adaf1fcc9',
  'Finance':                'photo-1611974789855-9c2a0a7236a3',
  'Marketing':              'photo-1460925895917-afdab827c52f',
  'Civil Engineering':      'photo-1503387762-592deb58ef4e',
};

function fieldPhoto(field: string): string {
  const id = FIELD_PHOTOS[field] ?? 'photo-1497366216548-37526070297c';
  return `https://images.unsplash.com/${id}?w=1200&q=70&auto=format&fit=crop`;
}

const AVATAR_GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-violet-500 to-purple-600',
  'from-rose-500 to-pink-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-sky-500 to-cyan-600',
];
function avatarGrad(company: string) {
  return AVATAR_GRADIENTS[(company.charCodeAt(0) + company.charCodeAt(company.length - 1)) % AVATAR_GRADIENTS.length];
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  const color = scoreColor(value);
  const gradients: Record<string, string> = {
    '#10b981': 'linear-gradient(90deg,#10b981,#34d399)',
    '#3b82f6': 'linear-gradient(90deg,#3b82f6,#60a5fa)',
    '#f59e0b': 'linear-gradient(90deg,#f59e0b,#fbbf24)',
    '#f43f5e': 'linear-gradient(90deg,#f43f5e,#fb7185)',
  };
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-slate-600 font-semibold">{label}</span>
        <span className="font-bold tabular-nums" style={{ color }}>{value}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: gradients[color] ?? color }}
        />
      </div>
    </div>
  );
}

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Markdown-to-HTML renderer for bold headers and lists (XSS-safe)
function renderMarkdown(text: string): string {
  const boldify = (s: string): string => {
    // Replace **text** with <strong>text</strong> while escaping content
    return s.replace(/\*\*(.+?)\*\*/g, (_, content) => `<strong>${escapeHtml(content)}</strong>`);
  };

  const lines = text.split('\n');
  const out: string[] = [];
  let inList = false;

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      if (inList) { out.push('</ul>'); inList = false; }
      continue;
    }

    if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      const plainText = line.replace(/^#+\s+/, '');
      out.push(`<h3>${boldify(plainText)}</h3>`);
      continue;
    }

    const listMatch = line.match(/^(?:[-•*]|\d+\.)\s+(.*)/);
    if (listMatch) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${boldify(listMatch[1])}</li>`);
      continue;
    }

    if (inList) { out.push('</ul>'); inList = false; }
    out.push(`<p>${boldify(line.trim())}</p>`);
  }

  if (inList) out.push('</ul>');
  return out.join('');
}

export default function JobDetail({ job, profile, existingMatch, onBack }: Props) {
  const [match, setMatch] = useState<MatchResult | undefined>(existingMatch);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [prepText, setPrepText] = useState('');
  const [generatingPrep, setGeneratingPrep] = useState(false);
  const [prepOpen, setPrepOpen] = useState(false);

  const [tailoredResume, setTailoredResume] = useState('');
  const [generatingResume, setGeneratingResume] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Auto-analyze if no match yet
  useEffect(() => {
    if (!existingMatch) runAnalysis();
  }, []);

  async function runAnalysis() {
    setAnalyzing(true);
    setAnalyzeError('');
    try {
      const result = await analyzeMatch(profile, job);
      setMatch(result);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Analysis failed. Check your API key.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function generateTailoredResume() {
    setGeneratingResume(true);
    setTailoredResume('');
    setResumeOpen(true);
    try {
      for await (const chunk of streamTailorResume(profile, job)) {
        setTailoredResume((t) => t + chunk);
      }
    } catch (err) {
      setTailoredResume('Failed to generate tailored resume. Please try again.');
    } finally {
      setGeneratingResume(false);
    }
  }

  function copyResume() {
    navigator.clipboard.writeText(tailoredResume).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadResume() {
    const blob = new Blob([tailoredResume], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${profile.name.replace(/\s+/g, '_')}_Resume_${job.company.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function generatePrep() {
    setGeneratingPrep(true);
    setPrepText('');
    setPrepOpen(true);
    try {
      for await (const chunk of streamInterviewPrep(profile, job)) {
        setPrepText((t) => t + chunk);
      }
    } catch (err) {
      setPrepText('Failed to generate interview prep. Please try again.');
    } finally {
      setGeneratingPrep(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-white/70 hover:text-white mb-4 transition-colors"
        style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
      >
        <ArrowLeft className="w-4 h-4" /> Back to jobs
      </button>

      {/* ── Hero header with photo ── */}
      <div className="relative rounded-2xl overflow-hidden mb-4 shadow-xl" style={{ minHeight: 180 }}>
        {/* Photo */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${fieldPhoto(job.field)}')` }}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(135deg, rgba(15,10,40,0.88) 0%, rgba(30,20,70,0.80) 60%, rgba(0,0,0,0.70) 100%)'
        }} />

        {/* Content */}
        <div className="relative p-6 flex items-end gap-4 flex-wrap" style={{ minHeight: 180 }}>
          {/* Company avatar */}
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarGrad(job.company)} flex items-center justify-center text-xl font-black text-white shadow-lg flex-shrink-0 border-2 border-white/20`}>
            {job.company.slice(0, 2).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-white leading-tight">{job.title}</h1>
            <p className="text-white/70 font-semibold mt-0.5">{job.company}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${TYPE_COLORS[job.type]}`}>
                {job.type}
              </span>
              {job.remote && (
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-teal-500/20 text-teal-300 border border-teal-400/30 flex items-center gap-1">
                  <Wifi className="w-3 h-3" /> Remote
                </span>
              )}
              <span className="text-xs text-white/50 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {job.location}
              </span>
              <span className="text-xs font-bold text-white/80">{job.salary}</span>
              {job.isLive && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live · {job.source}
                </span>
              )}
            </div>
          </div>

          <a
            href={job.applyUrl ?? `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(job.title + ' ' + job.company)}&location=${encodeURIComponent(job.location)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 flex items-center gap-1.5 bg-white hover:bg-indigo-50 text-indigo-700 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors shadow-lg"
          >
            Apply Now <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Match Analysis */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-4">
        <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          AI Match Analysis
        </h2>

        {analyzing && (
          <div className="flex flex-col items-center py-8 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
            <p className="text-sm">Analyzing your fit for this role…</p>
          </div>
        )}

        {analyzeError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
            {analyzeError}
            <button
              onClick={runAnalysis}
              className="ml-2 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {match && !analyzing && (
          <div>
            {/* Big score */}
            <div className="flex items-center gap-5 mb-6 p-5 rounded-2xl overflow-hidden relative" style={{
              background: 'linear-gradient(135deg, #0f0c29 0%, #1a1040 60%, #24243e 100%)'
            }}>
              {/* subtle photo bg */}
              <div className="absolute inset-0 opacity-10 bg-cover bg-center" style={{
                backgroundImage: `url('${fieldPhoto(job.field)}')`
              }} />
              <div className="relative flex flex-col items-center flex-shrink-0">
                <div className="text-5xl font-black leading-none" style={{ color: scoreColor(match.overallScore) }}>
                  {match.overallScore}
                </div>
                <div className="text-white/40 text-sm font-bold">%</div>
                <div className="text-xs font-bold mt-1 px-2.5 py-0.5 rounded-full" style={{
                  color: scoreColor(match.overallScore),
                  background: `${scoreColor(match.overallScore)}20`,
                  border: `1px solid ${scoreColor(match.overallScore)}40`
                }}>
                  {scoreLabel(match.overallScore)}
                </div>
              </div>
              <p className="relative text-sm text-white/70 flex-1 leading-relaxed">{match.assessment}</p>
            </div>

            {/* Match Radar Visualization */}
            <MatchRadar match={match} />

            {/* Skills audit */}
            {(match.matchedRequiredSkills?.length > 0 || match.missingRequiredSkills?.length > 0 || match.matchedNiceToHave?.length > 0) && (
              <div className="mb-5 p-4 bg-slate-50 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Skills Audit</h4>
                {match.matchedRequiredSkills?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-green-600 mb-1.5">✓ Required skills you have</p>
                    <div className="flex flex-wrap gap-1.5">
                      {match.matchedRequiredSkills.map((s, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {match.missingRequiredSkills?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-500 mb-1.5">✗ Required skills to develop</p>
                    <div className="flex flex-wrap gap-1.5">
                      {match.missingRequiredSkills.map((s, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {match.matchedNiceToHave?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-indigo-500 mb-1.5">★ Nice-to-haves you already have</p>
                    <div className="flex flex-wrap gap-1.5">
                      {match.matchedNiceToHave.map((s, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Strengths & Gaps */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-bold text-green-600 uppercase tracking-wide mb-2">Your Strengths</h4>
                <ul className="space-y-1.5">
                  {match.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-bold text-red-500 uppercase tracking-wide mb-2">Areas to Address</h4>
                <ul className="space-y-1.5">
                  {match.gaps.map((g, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                      <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                      {g}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Job Description */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-4">
        <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-base">📋</div>
          About the Role
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">{job.description}</p>

        <h3 className="font-semibold text-slate-700 mb-2 text-sm">Requirements</h3>
        <ul className="space-y-1.5 mb-4">
          {job.requirements.map((r, i) => {
            const matched = match?.matchedRequiredSkills?.some(
              (s) => r.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(r.toLowerCase())
            );
            const missing = match?.missingRequiredSkills?.some(
              (s) => r.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(r.toLowerCase())
            );
            return (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                {matched ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                ) : missing ? (
                  <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 ml-[1px] flex-shrink-0" />
                )}
                {r}
              </li>
            );
          })}
        </ul>

        {job.niceToHave.length > 0 && (
          <>
            <h3 className="font-semibold text-slate-700 mb-2 text-sm">Nice to Have</h3>
            <ul className="space-y-1.5">
              {job.niceToHave.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 flex-shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Tailor Resume */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-4">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => {
            if (!tailoredResume && !generatingResume) generateTailoredResume();
            else setResumeOpen((o) => !o);
          }}
        >
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-white" />
            </div>
            Tailor Resume to This Job
          </h2>
          {tailoredResume || generatingResume ? (
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${resumeOpen ? 'rotate-180' : ''}`} />
          ) : (
            <span className="text-sm text-emerald-600 font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Generate
            </span>
          )}
        </button>

        <p className="text-xs text-slate-400 mt-1">
          AI rewrites your resume with keywords from this job description — ATS-optimized and ready to send.
        </p>

        {generatingResume && !tailoredResume && (
          <div className="flex items-center gap-2 mt-4 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
            Tailoring your resume for {job.company}…
          </div>
        )}

        {resumeOpen && tailoredResume && (
          <div className="mt-4">
            {/* Action buttons */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={copyResume}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={downloadResume}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Download .txt
              </button>
              <button
                onClick={generateTailoredResume}
                disabled={generatingResume}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors ml-auto"
              >
                <Sparkles className="w-3.5 h-3.5" /> Regenerate
              </button>
            </div>
            {/* Resume content */}
            <div
              className="prose-interview bg-slate-50 rounded-xl p-4 border border-slate-200 text-sm whitespace-pre-wrap font-mono leading-relaxed"
              style={{ whiteSpace: 'pre-wrap' }}
            >
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(tailoredResume) }} />
            </div>
            {generatingResume && (
              <span className="inline-block w-1 h-4 bg-emerald-500 animate-pulse ml-0.5 mt-1" />
            )}
          </div>
        )}

        {generatingResume && tailoredResume && resumeOpen && (
          <span className="inline-block w-1 h-4 bg-emerald-500 animate-pulse ml-0.5" />
        )}
      </div>

      {/* Interview Prep */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-8">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => {
            if (!prepText && !generatingPrep) generatePrep();
            else setPrepOpen((o) => !o);
          }}
        >
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5 text-white" />
            </div>
            Interview Preparation Guide
          </h2>
          {prepText || generatingPrep ? (
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${prepOpen ? 'rotate-180' : ''}`} />
          ) : (
            <span className="text-sm text-indigo-600 font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Generate
            </span>
          )}
        </button>

        {generatingPrep && !prepText && (
          <div className="flex items-center gap-2 mt-4 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
            Generating personalized interview guide…
          </div>
        )}

        {prepOpen && prepText && (
          <div
            className="mt-4 prose-interview"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(prepText) }}
          />
        )}
        {generatingPrep && prepText && prepOpen && (
          <span className="inline-block w-1 h-4 bg-indigo-500 animate-pulse ml-0.5" />
        )}
      </div>
    </div>
  );
}
