// Fast keyword-based interest scoring — no API calls, runs in milliseconds.
// Used to surface top matches and decide what's worth notifying.

import { Job, UserProfile } from '../types';

// Common stopwords + filler we don't want to weight
const STOP = new Set([
  'a', 'an', 'and', 'or', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'with',
  'by', 'from', 'as', 'is', 'are', 'be', 'will', 'this', 'that', 'we', 'you',
  'your', 'our', 'their', 'have', 'has', 'had', 'can', 'do', 'does', 'using',
  'use', 'used', 'work', 'working', 'experience', 'engineer', 'engineering',
  'company', 'team', 'role', 'job', 'position', 'opportunity',
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .split(/[^a-z0-9+#./-]+/)
      .filter(t => t.length > 1 && !STOP.has(t))
  );
}

function expand(term: string): string[] {
  // Split things like "AI/ML" into ["ai", "ml"], handle plurals etc.
  return term.toLowerCase()
    .split(/[\s,/&]+/)
    .map(t => t.replace(/[^a-z0-9+#.-]/g, '').trim())
    .filter(t => t.length > 1 && !STOP.has(t));
}

/**
 * Score a job against a user profile based on keyword overlap.
 * Returns 0–100. Pure function, no API calls.
 *
 * Weights:
 *   • Field exact match:       +25
 *   • Each interest hit:       +10 (cap +40)
 *   • Each skill hit:          +6  (cap +30)
 *   • Internship type bonus:   +5  (if profile says student)
 *   • Recent posting bonus:    +5  (if posted ≤ 7d ago)
 */
export function interestScore(job: Job, profile: UserProfile): number {
  const haystack = `${job.title} ${job.description} ${job.requirements.join(' ')} ${job.niceToHave.join(' ')}`;
  const tokens = tokenize(haystack);

  let score = 0;
  const matched: string[] = [];

  // 1. Field match
  if (job.field === profile.field) score += 25;

  // 2. Interest matching
  let interestHits = 0;
  for (const interest of profile.interests) {
    const terms = expand(interest);
    const hit = terms.some(t => tokens.has(t));
    if (hit) {
      interestHits++;
      matched.push(interest);
    }
  }
  score += Math.min(interestHits * 10, 40);

  // 3. Skill matching
  let skillHits = 0;
  for (const skill of profile.skills) {
    const terms = expand(skill);
    const hit = terms.some(t => tokens.has(t));
    if (hit) {
      skillHits++;
      matched.push(skill);
    }
  }
  score += Math.min(skillHits * 6, 30);

  // 4. Internship bonus for students
  const isStudent = profile.experience?.toLowerCase().includes('student') ||
    profile.experience?.toLowerCase().includes('no exp');
  if (isStudent && job.type === 'Internship') score += 5;

  // 5. Freshness bonus
  if (job.postedDaysAgo != null && job.postedDaysAgo <= 7) score += 5;

  return Math.min(score, 100);
}

/** True if the job is a strong interest match worth notifying about */
export function isHighMatch(job: Job, profile: UserProfile, threshold = 60): boolean {
  return interestScore(job, profile) >= threshold;
}

/** Returns the top N jobs by interest score, with their scores */
export function topMatches(jobs: Job[], profile: UserProfile, n = 10): Array<{ job: Job; score: number }> {
  return jobs
    .map(job => ({ job, score: interestScore(job, profile) }))
    .filter(x => x.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}
