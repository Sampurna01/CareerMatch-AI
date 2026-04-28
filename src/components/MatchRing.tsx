interface Props {
  score: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

export function scoreColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#3b82f6';
  if (score >= 40) return '#f59e0b';
  return '#f43f5e';
}

export function scoreLabel(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good fit';
  if (score >= 55) return 'Partial fit';
  if (score >= 40) return 'Weak fit';
  return 'Poor fit';
}

export function scoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  if (score >= 60) return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200';
  if (score >= 40) return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
  return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200';
}

export function scoreGlow(score: number): string {
  if (score >= 80) return 'score-glow-emerald';
  if (score >= 60) return 'score-glow-blue';
  if (score >= 40) return 'score-glow-amber';
  return 'score-glow-rose';
}

export default function MatchRing({ score, size = 80, strokeWidth = 7 }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full opacity-20 blur-sm"
        style={{ background: color }}
      />
      <svg width={size} height={size} className="-rotate-90 absolute inset-0">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
        <circle
          cx={size/2} cy={size/2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="relative flex flex-col items-center justify-center">
        <span className="font-black leading-none" style={{ fontSize: size * 0.24, color }}>{score}</span>
        <span className="font-semibold text-slate-400" style={{ fontSize: size * 0.12 }}>%</span>
      </div>
    </div>
  );
}
