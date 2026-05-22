import { useEffect } from 'react';
import { X, MapPin, Navigation, ExternalLink, Wifi } from 'lucide-react';
import { Job } from '../types';
import { formatDistance } from '../utils/distance';

interface Props {
  job: Job;
  userCity?: string;
  distanceMiles?: number | null;
  onClose: () => void;
}

export default function MapModal({ job, userCity, distanceMiles, onClose }: Props) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Build the embed URL — Google Maps directions if we have a user city, else just the job location
  // Use proper iframe-compatible URLs without output=embed (Google handles iframes automatically)
  const embedUrl = userCity && !job.remote
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(userCity)}&destination=${encodeURIComponent(job.location)}`
    : `https://www.google.com/maps/search/${encodeURIComponent(job.location)}`;

  // External "open in Google Maps" link
  const openExternal = userCity && !job.remote
    ? `https://www.google.com/maps/dir/${encodeURIComponent(userCity)}/${encodeURIComponent(job.location)}`
    : `https://www.google.com/maps/search/${encodeURIComponent(job.location)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'slide-up 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-indigo-500 flex-shrink-0" />
              <h3 className="font-bold text-slate-800 truncate">{job.location}</h3>
              {job.remote && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full ring-1 ring-teal-200/60">
                  <Wifi className="w-3 h-3" /> Remote
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 truncate">
              {job.title} · <span className="font-semibold text-slate-600">{job.company}</span>
            </p>
            {userCity && distanceMiles != null && !isNaN(distanceMiles) && !job.remote && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-xs font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full ring-1 ring-indigo-200/60">
                  <Navigation className="w-3 h-3" />
                  {formatDistance(distanceMiles)} from {userCity}
                </span>
                <span className="text-xs text-slate-400">
                  ~{Math.round(distanceMiles / 55 * 60)} min drive
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-700 flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Map */}
        <div className="flex-1 relative bg-slate-50" style={{ minHeight: 380 }}>
          {job.remote ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center mb-4">
                <Wifi className="w-8 h-8 text-white" />
              </div>
              <h4 className="font-bold text-slate-800 text-lg mb-1">Remote position</h4>
              <p className="text-sm text-slate-500 max-w-sm">
                This role can be done from anywhere — no commute, no geographic constraints.
              </p>
            </div>
          ) : (
            <iframe
              src={embedUrl}
              width="100%"
              height="100%"
              style={{ border: 0, minHeight: 380 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`Map to ${job.location}`}
              className="w-full h-full"
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-slate-400">
            {userCity && !job.remote
              ? `Showing route from ${userCity} to ${job.location}`
              : `Map of ${job.location}`}
          </p>
          <a
            href={openExternal}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold flex items-center gap-1.5 px-4 py-2 rounded-lg
                       bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700
                       text-white shadow-md shadow-indigo-200/60"
          >
            Open in Google Maps <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
