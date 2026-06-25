import { MatchResult } from '../types';

interface Props {
  match: MatchResult;
}

const dimensionLabels = {
  skillsMatch: { label: 'Skills', icon: '🛠️', color: '#6366f1' },
  experienceMatch: { label: 'Experience', icon: '📊', color: '#8b5cf6' },
  seniorityMatch: { label: 'Seniority', icon: '⭐', color: '#a855f7' },
  educationMatch: { label: 'Education', icon: '🎓', color: '#d946ef' },
  interestsMatch: { label: 'Interests', icon: '🎯', color: '#ec4899' },
};

export default function MatchRadar({ match }: Props) {
  const dimensions = [
    { key: 'skillsMatch' as const, value: match.breakdown.skillsMatch },
    { key: 'experienceMatch' as const, value: match.breakdown.experienceMatch },
    { key: 'seniorityMatch' as const, value: match.breakdown.seniorityMatch },
    { key: 'educationMatch' as const, value: match.breakdown.educationMatch },
    { key: 'interestsMatch' as const, value: match.breakdown.interestsMatch },
  ];

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 mb-6">
      <h3 className="font-bold text-slate-800 mb-4">Match Breakdown</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {dimensions.map(({ key, value }) => {
          const info = dimensionLabels[key];
          const percentage = Math.round(value);

          return (
            <div key={key} className="text-center">
              <div className="mb-3 flex justify-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
                  style={{
                    background: `conic-gradient(${info.color} ${percentage}%, #e2e8f0 0%)`,
                    boxShadow: `0 0 0 2px white, inset 0 0 0 3px ${info.color}20`
                  }}
                >
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-xl font-bold" style={{ color: info.color }}>
                    {percentage}%
                  </div>
                </div>
              </div>
              <p className="text-xs font-semibold text-slate-600 mb-1">
                {info.icon} {info.label}
              </p>
              <p className="text-xs text-slate-500">
                {value < 40 ? '❌ Poor' : value < 60 ? '⚠️ Fair' : value < 80 ? '✓ Good' : '✨ Excellent'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <p className="text-xs text-slate-500 text-center mb-2 font-medium">Score meanings:</p>
        <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-600">
          <span>✨ 80-100: Exceptional</span>
          <span>✓ 60-79: Good</span>
          <span>⚠️ 40-59: Fair</span>
          <span>❌ &lt;40: Poor</span>
        </div>
      </div>
    </div>
  );
}
