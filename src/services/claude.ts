import { UserProfile, Job, MatchResult } from '../types';

const MODEL_FAST = 'claude-haiku-4-5-20251001';
const MODEL_MAIN = 'claude-opus-4-6';

async function callApi(endpoint: string, body: object): Promise<Response> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res;
}

export async function checkServerReady(): Promise<void> {
  const res = await fetch('/api/health');
  const data = await res.json();
  if (!data.ready) throw new Error('API key not configured on server');
}

export async function analyzeMatch(profile: UserProfile, job: Job): Promise<MatchResult> {
  const resumeSection = profile.resumeText
    ? `\nRESUME / ADDITIONAL CONTEXT:\n${profile.resumeText.slice(0, 2500)}`
    : '';

  const prompt = `You are a senior technical recruiter and career advisor with 15+ years of real-world hiring experience. Your task is to produce a realistic, market-calibrated match score between a candidate and a job posting—reflecting how actual hiring teams evaluate fit.

══════════════════════════════════════════════
CANDIDATE PROFILE
══════════════════════════════════════════════
Name: ${profile.name}
Field of Study/Work: ${profile.field}
Self-Reported Skills: ${profile.skills.length ? profile.skills.join(', ') : 'None listed'}
Career Interests: ${profile.interests.length ? profile.interests.join(', ') : 'None listed'}
Experience Level: ${profile.experience}
Education: ${profile.education}${resumeSection}

══════════════════════════════════════════════
JOB POSTING
══════════════════════════════════════════════
Title: ${job.title}
Company: ${job.company}
Job Type: ${job.type}
Field/Industry: ${job.field}
Description: ${job.description}
REQUIRED Qualifications: ${job.requirements.join(' | ')}
NICE-TO-HAVE Qualifications: ${job.niceToHave.join(' | ')}

══════════════════════════════════════════════
SCORING INSTRUCTIONS — REALISTIC MARKET STANDARDS
══════════════════════════════════════════════

CRITICAL: These scores must reflect actual hiring behavior, not best-case scenarios. Many candidates will score below 70.

── DIMENSION 1: skillsMatch (weight 45%) ──
Assess required skills first — these are non-negotiable in real hiring:

Step 1 — Identify CRITICAL required skills (core tech stack, key frameworks):
  • MATCHED: candidate has this skill (exact match or proven equivalent)
  • PARTIAL: candidate has related skill but not exact match
  • MISSING: no evidence of this skill

Step 2 — Score based on critical skills:
  • Count the CRITICAL required skills (usually 3-5 per job)
  • If 1+ critical skills MISSING: max score = 50 (this is a hard barrier in real hiring)
  • If all critical skills matched: Start at 95
  • Each PARTIAL critical skill: −15 points
  • Non-critical MISSING required skills: −8 points each
  • PARTIAL non-critical required: −4 points
  • Each nice-to-have matched: +2 points (max +10 bonus)
  • Clamp to [0, 100]

── DIMENSION 2: experienceMatch (weight 30%) ──
Map experience to years: Student/No exp=0, <1yr=0.5, 1-2yrs=1.5, 2-4yrs=3, 4-7yrs=5.5, 7+yrs=9
Infer job requirement from title: intern=0, junior=1.5, mid=3.5, senior=6, staff=9

REALISTIC scoring (hiring is strict on underexperience):
  • Exact match (±0.5 years): 95-100
  • 0.5-1 year under: 75-85
  • 1-2 years under: 45-60 (noticeable gap, needs mentoring)
  • 2+ years under: 15-40 (unlikely to succeed without significant support)
  • 1-2 years over: 85-92 (slight overqualification, generally acceptable)
  • 3-5 years over: 70-80 (overqualification concern — flight risk)
  • 6+ years over: 35-55 (likely overqualified, won't stay long)

── DIMENSION 3: seniorityMatch (weight 15%) ──
Does the candidate's career stage match the role?
  • Perfect match (same level): 92-100
  • One level below (e.g., junior applying for mid): 60-75 (risky, may struggle)
  • One level above (e.g., mid applying for junior): 70-85 (overqualified)
  • Two+ levels off: 15-40 (significant mismatch)

── DIMENSION 4: educationMatch (weight 5%) ──
Education matters less in tech if skills are strong; otherwise it's a barrier:
  • Required degree + directly relevant field: 95-100
  • Required degree + adjacent field: 80-90
  • Required degree + unrelated field: 65-75
  • No degree, but strong skills/portfolio: 75-85 (modern tech values ability over credentials)
  • One level below required degree: 30-50 (if job explicitly requires, this is a barrier)
  • Two+ levels below: 10-30

── DIMENSION 5: interestsMatch (weight 5%) ──
Do stated career interests align with the job's domain and growth trajectory?
  • Strong alignment (2+ interest matches): 90-100
  • Moderate alignment (1 match or related area): 60-75
  • Weak/no alignment: 20-45
  • Strongly opposed interests (e.g., wants consulting, job is solo IC): 15-25

── OVERALL SCORE ──
Compute: (skillsMatch×0.45) + (experienceMatch×0.30) + (seniorityMatch×0.15) + (educationMatch×0.05) + (interestsMatch×0.05)
Round to nearest integer.

CALIBRATION BENCHMARKS (realistic distribution):
  90-100: Exceptional fit — strong hire, advance immediately
  75-89: Solid candidate — good fit, competitive pool
  60-74: Viable but with gaps — needs to address specific weaknesses
  45-59: Long shot — significant gaps, unlikely to advance past screening
  Below 45: Not a fit — lacks critical qualifications

IMPORTANT: Most candidates will score 50-70. Scores above 80 are relatively rare. Scores below 50 mean the candidate is unlikely to progress in real hiring.

══════════════════════════════════════════════
OUTPUT FORMAT — respond with ONLY valid JSON, no markdown, no text outside JSON
══════════════════════════════════════════════
{
  "overallScore": <integer 0-100>,
  "breakdown": {
    "skillsMatch": <integer 0-100>,
    "experienceMatch": <integer 0-100>,
    "seniorityMatch": <integer 0-100>,
    "educationMatch": <integer 0-100>,
    "interestsMatch": <integer 0-100>
  },
  "matchedRequiredSkills": ["<skill>", ...],
  "missingRequiredSkills": ["<skill>", ...],
  "matchedNiceToHave": ["<skill>", ...],
  "strengths": ["<specific strength 1>", "<specific strength 2>", "<specific strength 3>"],
  "gaps": ["<specific gap 1>", "<specific gap 2>", "<specific gap 3>"],
  "assessment": "<3 sentences: (1) overall fit verdict, (2) biggest strength, (3) most critical gap or next step>"
}`;

  const res = await callApi('/api/analyze', {
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e: any = new Error(err.error ?? 'Analysis failed');
    e.status = res.status;
    throw e;
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found in response');
  return { ...JSON.parse(match[0]), jobId: job.id };
}

export async function* streamTailorResume(
  profile: UserProfile,
  job: Job,
): AsyncGenerator<string> {
  const resumeSection = profile.resumeText?.trim()
    ? profile.resumeText.slice(0, 4000)
    : `Name: ${profile.name}\nField: ${profile.field}\nSkills: ${profile.skills.join(', ')}\nExperience: ${profile.experience}\nEducation: ${profile.education}\nInterests: ${profile.interests.join(', ')}`;

  const prompt = `You are an expert resume writer and career coach. Your task is to rewrite the candidate's resume so it is perfectly tailored to the target job posting below — maximizing ATS keyword matching and highlighting the most relevant experience.

══════════════════════════════════════════════
TARGET JOB
══════════════════════════════════════════════
Title: ${job.title}
Company: ${job.company}
Field: ${job.field}
Description: ${job.description}
Required qualifications: ${job.requirements.join(' | ')}
Nice-to-have: ${job.niceToHave.join(' | ')}

══════════════════════════════════════════════
CANDIDATE'S ORIGINAL RESUME / PROFILE
══════════════════════════════════════════════
${resumeSection}

══════════════════════════════════════════════
INSTRUCTIONS
══════════════════════════════════════════════
Rewrite the resume with these goals:
1. **Mirror the job's language** — use exact keywords from the job posting naturally (ATS optimization).
2. **Lead with impact** — rewrite bullet points to be achievement-oriented (quantify where possible).
3. **Reorder & emphasize** — surface the most relevant skills, projects, and experience first.
4. **Professional Summary** — write a 2–3 sentence summary that directly speaks to this role.
5. **Skills section** — list the matched required and nice-to-have skills prominently.
6. Do NOT invent experience the candidate doesn't have. Only reframe and reorder what exists.
7. Keep the output clean and ready to paste — use clear section headers.

Format the output as a complete, ready-to-use resume with these sections (use **bold** for section headers):

**PROFESSIONAL SUMMARY**
**SKILLS**
**EXPERIENCE** (or PROJECTS if student/intern)
**EDUCATION**
**ADDITIONAL** (certifications, awards, interests — if relevant)

Write only the tailored resume. No commentary before or after.`;

  const res = await callApi('/api/tailor-resume', {
    model: MODEL_MAIN,
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  });

  if (!res.ok || !res.body) throw new Error('Stream request failed');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        if (json.text) yield json.text;
        if (json.error) throw new Error(json.error);
      } catch { /* skip malformed */ }
    }
  }
}

export async function* streamInterviewPrep(
  profile: UserProfile,
  job: Job,
): AsyncGenerator<string> {
  const prompt = `You are an expert interview coach. Create a comprehensive, personalized interview preparation guide for this candidate applying to the role below.

CANDIDATE:
- Field: ${profile.field}
- Skills: ${profile.skills.join(', ')}
- Experience: ${profile.experience}
- Education: ${profile.education}

ROLE:
- Title: ${job.title} at ${job.company}
- Type: ${job.type}
- Requirements: ${job.requirements.join(', ')}
- Description: ${job.description.slice(0, 600)}

Please provide a well-structured guide with these sections using **bold headers**:

**Common Interview Questions**
List 5–7 questions they're very likely to ask, with a brief tip for each.

**Technical / Skills Questions**
List 4–5 specific technical questions relevant to this exact role and skills required.

**Behavioral Questions (STAR Method)**
List 3–4 behavioral questions with guidance on structuring your answer.

**Smart Questions to Ask the Interviewer**
List 4 thoughtful questions that will impress the interviewer.

**Key Topics to Study**
List 6–8 specific topics, frameworks, or concepts to review before the interview.

**Pro Tips for This Role**
List 4 specific, actionable tips tailored to this company and position.

Be specific and practical. Tailor advice to this exact role and candidate background.`;

  const res = await callApi('/api/interview', {
    model: MODEL_MAIN,
    max_tokens: 2500,
    messages: [{ role: 'user', content: prompt }],
  });

  if (!res.ok || !res.body) throw new Error('Stream request failed');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') return;
      try {
        const json = JSON.parse(payload);
        if (json.text) yield json.text;
        if (json.error) throw new Error(json.error);
      } catch { /* skip malformed lines */ }
    }
  }
}
