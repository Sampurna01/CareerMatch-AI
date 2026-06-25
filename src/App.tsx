import { useState } from 'react';
import { UserProfile } from './types';
import Setup from './components/Setup';
import JobBoard from './components/JobBoard';
import ErrorBoundary from './components/ErrorBoundary';

const STORAGE_KEY = 'careermatch_profile';

function loadSavedProfile(): UserProfile | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    if (!saved.name || !saved.field || !saved.experience || !saved.education) return null;
    return {
      name: saved.name,
      city: saved.city || undefined,
      field: saved.field,
      skills: (saved.skillsRaw ?? '').split(',').map((s: string) => s.trim()).filter(Boolean),
      interests: (saved.interestsRaw ?? '').split(',').map((s: string) => s.trim()).filter(Boolean),
      experience: saved.experience,
      education: saved.education,
      resumeText: saved.resumeText || undefined,
    };
  } catch { return null; }
}

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(loadSavedProfile);

  function handleSetupComplete(p: UserProfile) {
    setProfile(p);
  }

  function handleLogout() {
    setProfile(null);
  }

  return (
    <ErrorBoundary>
      {!profile ? (
        <Setup onComplete={handleSetupComplete} />
      ) : (
        <JobBoard
          profile={profile}
          onLogout={handleLogout}
          onProfileUpdate={setProfile}
        />
      )}
    </ErrorBoundary>
  );
}
