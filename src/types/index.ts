export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  type: 'Internship' | 'Full-time' | 'Part-time' | 'Contract';
  field: string;
  description: string;
  requirements: string[];
  niceToHave: string[];
  salary: string;
  remote: boolean;
  postedDaysAgo: number;
  isLive?: boolean;   // fetched from real job boards
  applyUrl?: string;  // direct link to application
  source?: string;    // e.g. "Remotive", "Arbeitnow"
}

export interface UserProfile {
  name: string;
  city?: string;
  field: string;
  skills: string[];
  interests: string[];
  experience: string;
  education: string;
  resumeText?: string;
}

export interface MatchBreakdown {
  skillsMatch: number;        // 40% weight — required + nice-to-have skills
  experienceMatch: number;    // 25% weight — years/level alignment
  seniorityMatch: number;     // 15% weight — title/role level fit
  educationMatch: number;     // 12% weight — level + field relevance
  interestsMatch: number;     //  8% weight — career interests vs job domain
}

export interface MatchResult {
  jobId: string;
  overallScore: number;
  breakdown: MatchBreakdown;
  matchedRequiredSkills: string[];
  missingRequiredSkills: string[];
  matchedNiceToHave: string[];
  strengths: string[];
  gaps: string[];
  assessment: string;
}
