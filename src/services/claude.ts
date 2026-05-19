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

  const prompt = `You are a senior technical recruiter and career advisor with 15+ years of experience. Your task is to produce a highly accurate, calibrated match score between a candidate and a job posting.

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
SCORING INSTRUCTIONS — follow exactly
══════════════════════════════════════════════

Score each dimension 0-100 using the rubrics below. Then compute the overall score using the stated weights. Do NOT round to multiples of 5 — produce precise scores.

── DIMENSION 1: skillsMatch (weight 40%) ──
Step 1 — Required skills audit: For each required qualification, classify the candidate as:
  • MATCHED (exact or semantic equivalent, e.g. "React" matches "React.js"; "SQL" matches "database querying")
  • PARTIAL (related but not the same, e.g. knowing Python partially covers "data analysis")
  • MISSING (no evidence of this skill)

Step 2 — Score:
  • Start at 100
  • Each MISSING required skill: −20 points (cap: score cannot exceed 55 if ANY required skill is missing)
  • Each PARTIAL required skill: −8 points
  • Nice-to-have skills matched: +3 points each (max +15 bonus)
  • Clamp final score to [0, 100]

── DIMENSION 2: experienceMatch (weight 25%) ──
Map experience levels to years: Student/No exp=0, <1yr=0.5, 1-2yrs=1.5, 2-4yrs=3, 4-7yrs=5.5, 7+yrs=9
Determine what the job implicitly requires based on title + description (intern=0, junior=1, mid=3, senior=6, staff/principal=10).
Score by gap:
  • Exact or ±0.5yr match: 92-100
  • 1yr under: 65-75 | 2yrs under: 40-55 | 3+yrs under: 15-35
  • 1-3yrs over: 82-90 | 4-6yrs over: 65-78 (overqualification risk) | 7+yrs over: 40-60

── DIMENSION 3: seniorityMatch (weight 15%) ──
Assess whether the candidate's career stage fits the role's seniority level.
  • Same level (e.g. student→internship, 2-4yr→mid-level): 90-100
  • One level off: 65-80
  • Two levels off: 35-55
  • Three+ levels off: 10-30

── DIMENSION 4: educationMatch (weight 12%) ──
Consider BOTH degree level AND field relevance.
  • Required level + directly relevant field: 95-100
  • Required level + related field: 75-88
  • Required level + unrelated field: 55-70
  • One level below required: 30-55 (treat as hard miss if job says "required")
  • One level above required + relevant: 85-92
  • Two levels below required: 10-28
  • Field bonus: If the candidate's field is exactly the job's field, add +5

── DIMENSION 5: interestsMatch (weight 8%) ──
Do the candidate's stated career interests align with this job's domain, mission, and tasks?
  • Strong alignment (2+ direct interest matches): 85-100
  • Moderate alignment (1 match or related): 55-80
  • Weak/no alignment: 15-45

── OVERALL SCORE ──
Compute: (skillsMatch×0.40) + (experienceMatch×0.25) + (seniorityMatch×0.15) + (educationMatch×0.12) + (interestsMatch×0.08)
Round to nearest integer. This is the overallScore.

Interpretation benchmarks (for your calibration):
  85-100: Exceptional fit — strong hire candidate
  70-84: Good fit — worth interviewing
  55-69: Partial fit — notable gaps but possible
  40-54: Weak fit — significant gaps
  Below 40: Poor fit — not ready for this role

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
