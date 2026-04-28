import { useEffect, useRef, useState } from 'react';
import { Job, UserProfile } from '../types';
import { interestScore, isHighMatch } from '../utils/interestMatch';

const NOTIFIED_KEY = 'cm_notified_jobs_v1';
const ALERTS_ENABLED_KEY = 'cm_alerts_enabled_v1';
const EMAIL_ENABLED_KEY = 'cm_alerts_email_v1';
const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

function loadNotified(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function saveNotified(ids: Set<string>) {
  try {
    // Keep set bounded — last 500 IDs
    const arr = [...ids].slice(-500);
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(arr));
  } catch { /* quota exceeded */ }
}

export type AlertsState = {
  enabled: boolean;
  permission: NotificationPermission | 'unsupported';
  newMatchCount: number;
  topMatchScore: number;
  enable: () => Promise<boolean>;
  disable: () => void;
  clearBadge: () => void;
  // Email alerts
  emailEnabled: boolean;
  emailAddress: string;
  emailConfigured: boolean | null;   // server has SMTP creds
  setEmailAddress: (email: string) => void;
  enableEmail: (email: string) => Promise<{ ok: boolean; error?: string }>;
  disableEmail: () => void;
  sendTestEmail: () => Promise<{ ok: boolean; error?: string }>;
};

interface Args {
  jobs: Job[];                           // current full job list
  profile: UserProfile;
  onPoll: () => Promise<void>;           // refresh callback (fetch new live jobs)
  threshold?: number;                    // min interest score to notify (default 65)
}

export function useJobAlerts({ jobs, profile, onPoll, threshold = 65 }: Args): AlertsState {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(ALERTS_ENABLED_KEY) === '1');
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );
  const [newMatchCount, setNewMatchCount] = useState(0);
  const [topMatchScore, setTopMatchScore] = useState(0);
  const notifiedRef = useRef<Set<string>>(loadNotified());

  // Email alert state
  const [emailAddress, setEmailAddressState] = useState(() => localStorage.getItem(EMAIL_ENABLED_KEY) ?? '');
  const [emailEnabled, setEmailEnabled] = useState(() => !!localStorage.getItem(EMAIL_ENABLED_KEY));
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);

  // Check whether server has SMTP creds
  useEffect(() => {
    fetch('/api/alerts/status')
      .then(r => r.json())
      .then(d => setEmailConfigured(!!d.configured))
      .catch(() => setEmailConfigured(false));
  }, []);

  function setEmailAddress(email: string) {
    setEmailAddressState(email);
    if (emailEnabled) localStorage.setItem(EMAIL_ENABLED_KEY, email);
  }

  async function enableEmail(email: string) {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { ok: false, error: 'Invalid email address' };
    }
    setEmailAddressState(trimmed);
    setEmailEnabled(true);
    localStorage.setItem(EMAIL_ENABLED_KEY, trimmed);
    return { ok: true };
  }

  function disableEmail() {
    setEmailEnabled(false);
    localStorage.removeItem(EMAIL_ENABLED_KEY);
  }

  async function sendTestEmail() {
    if (!emailAddress) return { ok: false, error: 'No email address set' };
    try {
      const res = await fetch('/api/alerts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: emailAddress }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || 'Send failed' };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Network error' };
    }
  }

  // ── Permission flow ───────────────────────────────────────────────
  async function enable(): Promise<boolean> {
    if (typeof Notification === 'undefined') return false;
    let perm = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm === 'granted') {
      setEnabled(true);
      localStorage.setItem(ALERTS_ENABLED_KEY, '1');
      return true;
    }
    return false;
  }

  function disable() {
    setEnabled(false);
    localStorage.removeItem(ALERTS_ENABLED_KEY);
  }

  function clearBadge() {
    setNewMatchCount(0);
  }

  // ── Detect & notify new matches whenever job list changes ─────────
  useEffect(() => {
    if (!jobs.length) return;
    const fresh: Job[] = [];
    let highest = 0;

    for (const job of jobs) {
      const score = interestScore(job, profile);
      if (score > highest) highest = score;
      if (score >= threshold && !notifiedRef.current.has(job.id)) {
        fresh.push(job);
      }
    }

    setTopMatchScore(highest);

    if (fresh.length === 0) return;

    // Mark as seen so we don't re-notify
    fresh.forEach(j => notifiedRef.current.add(j.id));
    saveNotified(notifiedRef.current);

    // Update unread badge regardless of permission
    setNewMatchCount(c => c + fresh.length);

    // Send browser notifications only if user opted in
    if (enabled && permission === 'granted') {
      if (fresh.length === 1) {
        const j = fresh[0];
        showNotification(`✨ New match: ${j.title}`, {
          body: `${j.company} · ${j.location}\n${interestScore(j, profile)}% interest match`,
          tag: `cm-job-${j.id}`,
        });
      } else if (fresh.length <= 3) {
        fresh.forEach(j => {
          showNotification(`✨ New match: ${j.title}`, {
            body: `${j.company} · ${j.location}`,
            tag: `cm-job-${j.id}`,
          });
        });
      } else {
        showNotification(`🎯 ${fresh.length} new job matches`, {
          body: `Top: ${fresh[0].title} at ${fresh[0].company}`,
          tag: 'cm-batch',
        });
      }
    }

    // Send email notifications if email alerts are on
    if (emailEnabled && emailAddress && emailConfigured) {
      const payload = fresh.slice(0, 10).map(j => ({
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location,
        type: j.type,
        salary: j.salary,
        description: j.description,
        applyUrl: j.applyUrl,
        score: interestScore(j, profile),
      }));
      fetch('/api/alerts/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailAddress,
          jobs: payload,
          profile: { name: profile.name, field: profile.field },
        }),
      }).catch(() => { /* best-effort; backend dedupes anyway */ });
    }
  }, [jobs, profile, threshold, enabled, permission, emailEnabled, emailAddress, emailConfigured]);

  // ── Background polling for new live jobs every 15 minutes ─────────
  useEffect(() => {
    const id = setInterval(() => { onPoll().catch(() => {}); }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [onPoll]);

  return {
    enabled, permission, newMatchCount, topMatchScore, enable, disable, clearBadge,
    emailEnabled, emailAddress, emailConfigured, setEmailAddress, enableEmail, disableEmail, sendTestEmail,
  };
}

function showNotification(title: string, opts: NotificationOptions) {
  try {
    new Notification(title, { icon: '/briefcase.svg', badge: '/briefcase.svg', ...opts });
  } catch { /* notification API unavailable */ }
}
