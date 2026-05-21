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

  const prompt = `You are a strict technical recruiter. Produce a HARSH, unforgiving match score between this candidate and job—only candidates clearly ready should score above 70.

CANDIDATE: ${profile.name}
Field: ${profile.field} | Skills: ${profile.skills.join(', ') || 'None'} | Interests: ${profile.interests.join(', ') || 'None'} | Exp: ${profile.experience} | Edu: ${profile.education}${resumeSection}

JOB: ${job.title} @ ${job.company} | Type: ${job.type} | Field: ${job.field}
Description: ${job.description}
Required: ${job.requirements.join(' | ')} | Nice-to-have: ${job.niceToHave.join(' | ')}

SCORING (HARSH STANDARDS):
1. skillsMatch (45%): Missing 1+ critical skills=max 35; all matched=start 85; each partial=-20; non-critical missing=-10; nice-to-have=+1 each
2. experienceMatch (30%): Exact match=95-100; 0.5-1yr under=60-75; 1-2yr under=25-45; 2+yr under=5-30; 1-2yr over=80-88; 3-5yr over=60-70; 6+yr over=25-45
3. seniorityMatch (15%): Perfect=92-100; 1 level below=50-65; 1 level above=65-75; 2+levels off=5-25
4. educationMatch (5%): Degree+relevant=95-100; degree+adjacent=75-85; no degree+skills=70-80; 1 level below=20-40; 2+below=5-20
5. interestsMatch (5%): 2+ matches=90-100; 1 match=50-70; weak=15-35; opposed=5-15

Formula: (skills×0.45) + (exp×0.30) + (senior×0.15) + (edu×0.05) + (interests×0.05)

Most score 35-55. Scores 85+ are rare. Below 50 is common.

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
