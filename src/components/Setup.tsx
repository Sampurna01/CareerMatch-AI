import { useState } from 'react';
import { UserProfile } from '../types';
import { ALL_FIELDS } from '../data/jobs';
import { MapPin, Zap, ArrowRight, Sparkles, GraduationCap, Briefcase as BriefcaseIcon } from 'lucide-react';
import CareerMatchLogo from '../assets/careermatch-logo.svg';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface Props {
  onComplete: (profile: UserProfile) => void;
  /** When true, renders Cancel button + "Edit Profile" labels instead of initial setup */
  editMode?: boolean;
  onCancel?: () => void;
}
const STORAGE_KEY = 'careermatch_profile';
function loadSaved() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); } catch { return {}; } }

export default function Setup({ onComplete, editMode = false, onCancel }: Props) {
  const saved = loadSaved();
  const [name, setName]               = useState(saved.name ?? '');
  const [city, setCity]               = useState(saved.city ?? '');
  const [field, setField]             = useState(saved.field ?? '');
  const [skillsRaw, setSkillsRaw]     = useState(saved.skillsRaw ?? '');
  const [interestsRaw, setInterestsRaw] = useState(saved.interestsRaw ?? '');
  const [experience, setExperience]   = useState(saved.experience ?? '');
  const [education, setEducation]     = useState(saved.education ?? '');
  const [resumeText, setResumeText]   = useState(saved.resumeText ?? '');
  const [resumeName, setResumeName]   = useState('');
  const [parsingResume, setParsingResume] = useState(false);

  // Validation tracking
  const fields = { name, field, experience, education };
  const completedFields = Object.values(fields).filter(f => f && f.trim()).length;
  const progress = Math.round((completedFields / 4) * 100);
  const skills = skillsRaw.split(',').map(s => s.trim()).filter(Boolean);
  const interests = interestsRaw.split(',').map(s => s.trim()).filter(Boolean);
  const isValid = name && field && experience && education;

  async function handleResumeFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsingResume(true);
    setResumeName(file.name);
    try {
      if (file.name.endsWith('.pdf')) {
        const buf = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        const pages = await Promise.all(Array.from({ length: pdf.numPages }, (_, i) =>
          pdf.getPage(i+1).then(p => p.getTextContent()).then(c => c.items.map((x: any) => x.str).join(' '))
        ));
        setResumeText(pages.join('\n'));
      } else if (file.name.endsWith('.docx')) {
        const buf = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer: buf });
        setResumeText(res.value);
      } else {
        const reader = new FileReader();
        reader.onload = ev => setResumeText(ev.target?.result as string);
        reader.readAsText(file);
      }
    } finally { setParsingResume(false); }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !field || !experience || !education) return;
    const profile: UserProfile = {
      name, city: city.trim() || undefined, field,
      skills: skillsRaw.split(',').map((s: string) => s.trim()).filter(Boolean),
      interests: interestsRaw.split(',').map((s: string) => s.trim()).filter(Boolean),
      experience, education, resumeText: resumeText || undefined,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, city, field, skillsRaw, interestsRaw, experience, education, resumeText }));
    onComplete(profile);
  }

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">{children}</label>
  );

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* ── Photo background ── */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&q=80&auto=format&fit=crop')",
        }}
      />
      {/* Dark gradient overlay on top of photo */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(145deg,rgba(10,8,28,0.93) 0%,rgba(20,10,46,0.90) 45%,rgba(10,15,30,0.93) 100%)' }}
      />

      {/* ── Animated colour orbs (layered over photo) ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-[520px] h-[520px] rounded-full opacity-[0.22] blur-[90px] animate-float"
          style={{ background: 'radial-gradient(circle,#7c3aed,#4f46e5)' }} />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full opacity-[0.16] blur-[75px] animate-float-delay"
          style={{ background: 'radial-gradient(circle,#ec4899,#a855f7)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full opacity-[0.10] blur-[60px] animate-float-slow"
          style={{ background: 'radial-gradient(circle,#38bdf8,#6366f1)' }} />
        {/* Star-like dots */}
        {[...Array(18)].map((_, i) => (
          <div key={i}
            className="absolute rounded-full bg-white opacity-[0.12] animate-pulse"
            style={{
              width: Math.random() * 3 + 1,
              height: Math.random() * 3 + 1,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-lg relative z-10 animate-slide-up">
        {/* ── Hero ── */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-[68px] h-[68px] rounded-2xl mb-4 shadow-2xl shadow-indigo-500/40" style={{ background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#a855f7 100%)' }}>
            <img src={CareerMatchLogo} alt="CareerMatch AI" className="w-10 h-10 drop-shadow-sm" />
          </div>
          <h1 className="text-[2.2rem] font-black text-white tracking-tight leading-none">
            CareerMatch <span className="text-gradient">AI</span>
          </h1>
          <p className="text-indigo-200/60 mt-2.5 text-sm font-medium tracking-wide">
            Exclusively for Engineers · Powered by Claude AI
          </p>
        </div>

        {/* ── Card ── */}
        <div className="glass rounded-3xl shadow-2xl shadow-black/40 px-8 py-7">
          {/* Card header */}
          <div className="flex items-center gap-3 mb-6 pb-5 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#eef2ff,#ede9fe)' }}>
              <BriefcaseIcon className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-bold text-slate-800">
                {editMode ? 'Edit your profile' : 'Build your profile'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {editMode
                  ? 'Update your details, skills, or upload a new resume'
                  : 'Used to compute accurate engineering match scores via AI'}
              </p>
            </div>
            {editMode && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100"
              >Cancel</button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="px-8 py-3 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1">
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-600">{progress}%</span>
            </div>
            <p className="text-xs text-slate-500">
              {completedFields} of 4 required fields completed
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 1. Full Name */}
            <div>
              <Label>👤 Full Name *</Label>
              <input required value={name} onChange={e => setName(e.target.value)}
                placeholder="Jane Smith" className="input-field" />
              <p className="text-xs text-slate-400 mt-1">Used to personalize your results</p>
            </div>

            {/* 2. City (Location) */}
            <div>
              <Label>📍 City / Location <span className="normal-case font-normal text-slate-400">(optional)</span></Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input value={city} onChange={e => setCity(e.target.value)}
                  placeholder="St. Louis, MO" className="input-field pl-9" />
              </div>
              <p className="text-xs text-slate-400 mt-1">Helps us find local opportunities</p>
            </div>

            {/* 3. Field of Study / Work */}
            <div>
              <Label>💼 Field of Study / Work *</Label>
              <select required value={field} onChange={e => setField(e.target.value)} className="input-field">
                <option value="">Select a field…</option>
                {ALL_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <p className="text-xs text-slate-400 mt-1">Example: Software Engineering, Data Science, DevOps</p>
            </div>

            {/* 4. Resume Upload (MOVED UP) */}
            <div className="bg-indigo-50/40 border border-indigo-200 rounded-xl p-4 -mx-4 px-4">
              <Label className="mb-3">📄 Resume <span className="normal-case font-normal text-indigo-600">(optional but recommended)</span></Label>
              <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
                resumeText
                  ? 'border-emerald-300 bg-emerald-50/60 hover:bg-emerald-50'
                  : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40'
              }`}>
                <input type="file" accept=".txt,.text,.pdf,.docx" onChange={handleResumeFile} className="hidden" />
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  resumeText ? 'bg-emerald-100' : 'bg-slate-100'
                }`}>
                  {parsingResume
                    ? <Sparkles className="w-4 h-4 text-indigo-500 animate-spin" />
                    : resumeText
                    ? <Zap className="w-4 h-4 text-emerald-600" />
                    : <GraduationCap className="w-4 h-4 text-slate-400" />
                  }
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${resumeText ? 'text-emerald-700' : 'text-slate-600'}`}>
                    {parsingResume
                      ? 'Parsing resume…'
                      : resumeText
                      ? `✓ ${resumeName || 'Resume on file'}`
                      : 'Upload your resume'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {resumeText ? 'We found your key skills & experience' : 'PDF, DOCX, or TXT · Boosts accuracy 3x'}
                  </p>
                </div>
              </label>
            </div>

            {/* 5 & 6. Experience + Education */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>📊 Experience *</Label>
                <select required value={experience} onChange={e => setExperience(e.target.value)} className="input-field">
                  <option value="">Select…</option>
                  <option value="Student / No experience">Student / None</option>
                  <option value="Less than 1 year">{'< 1 year'}</option>
                  <option value="1–2 years">1–2 years</option>
                  <option value="2–4 years">2–4 years</option>
                  <option value="4–7 years">4–7 years</option>
                  <option value="7+ years">7+ years</option>
                </select>
              </div>
              <div>
                <Label>🎓 Education *</Label>
                <select required value={education} onChange={e => setEducation(e.target.value)} className="input-field">
                  <option value="">Select…</option>
                  <option value="High School / GED">High School</option>
                  <option value="Associate Degree">Associate</option>
                  <option value="Bachelor's Degree (In Progress)">Bachelor's (In Progress)</option>
                  <option value="Bachelor's Degree">Bachelor's Degree</option>
                  <option value="Master's Degree (In Progress)">Master's (In Progress)</option>
                  <option value="Master's Degree">Master's Degree</option>
                  <option value="PhD (In Progress)">PhD (In Progress)</option>
                  <option value="PhD">PhD</option>
                </select>
              </div>
            </div>

            {/* 7. Key Skills */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>🛠️ Key Skills <span className="normal-case font-normal text-slate-400">(comma-separated)</span></Label>
                {skills.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                    ✓ {skills.length} skill{skills.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <input value={skillsRaw} onChange={e => setSkillsRaw(e.target.value)}
                placeholder="Python, React, MATLAB, Circuit Design…" className="input-field" />
              <p className="text-xs text-slate-400 mt-1">Technical skills you know well — helps us find better matches</p>
            </div>

            {/* 8. Career Interests */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>🎯 Career Interests <span className="normal-case font-normal text-slate-400">(comma-separated)</span></Label>
                {interests.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                    ✓ {interests.length} interest{interests.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <input value={interestsRaw} onChange={e => setInterestsRaw(e.target.value)}
                placeholder="AI/ML, Remote work, Startups, Embedded systems…" className="input-field" />
              <p className="text-xs text-slate-400 mt-1">What excites you about your next role? Used to find cultural fit</p>
            </div>

            <button type="submit" className="btn-primary w-full py-3 text-sm mt-1">
              <span>{editMode ? 'Save Changes' : 'Find My Jobs'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        <p className="text-center text-white/20 text-xs mt-5 tracking-wide">
          Your data stays on your device · No account required
        </p>
      </div>
    </div>
  );
}
