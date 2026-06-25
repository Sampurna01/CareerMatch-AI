import { useState } from 'react';
import { MapPin, Clock, Wifi, Loader2, Sparkles, Navigation, TrendingUp, ExternalLink, Heart } from 'lucide-react';
import { Job, MatchResult } from '../types';
import { scoreColor, scoreLabel, scoreBg, scoreGlow } from './MatchRing';
import { formatDistance } from '../utils/distance';
import MapModal from './MapModal';

interface Props {
  job: Job;
  match?: MatchResult;
  analyzing?: boolean;
  analyzeError?: string;
  userCity?: string;
  distanceMiles?: number;
  isSaved?: boolean;
  onAnalyze: () => void;
  onClick: () => void;
  onSave?: () => void;
}

const TYPE_STYLES: Record<string, string> = {
  Internship:  'bg-violet-100 text-violet-700 ring-1 ring-violet-200/80',
  'Full-time': 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/80',
  'Part-time': 'bg-sky-100 text-sky-700 ring-1 ring-sky-200/80',
  Contract:    'bg-orange-100 text-orange-700 ring-1 ring-orange-200/80',
};

const FIELD_GRADIENTS: Record<string, string> = {
  'Software Engineering':  'from-blue-500 to-indigo-500',
  'Data Science':          'from-violet-500 to-purple-600',
  'Electrical Engineering':'from-amber-500 to-orange-500',
  'Mechanical Engineering':'from-green-500 to-teal-500',
  'Civil Engineering':     'from-stone-500 to-slate-600',
  'Chemical Engineering':  'from-cyan-500 to-blue-600',
  'DevOps / Cloud':        'from-sky-500 to-blue-600',
  'Cybersecurity':         'from-red-500 to-rose-600',
  'Product Management':    'from-fuchsia-500 to-pink-600',
  'Design':                'from-pink-500 to-rose-500',
  'Finance':               'from-green-600 to-emerald-500',
  'Marketing':             'from-yellow-500 to-amber-500',
  'Human Resources':       'from-teal-500 to-cyan-500',
  'Healthcare':            'from-blue-400 to-indigo-500',
  'Technology':            'from-indigo-500 to-violet-500',
};

const AVATAR_GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-violet-500 to-purple-600',
  'from-rose-500 to-pink-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-sky-500 to-cyan-600',
];

const COMPANY_CAREERS: Record<string, string> = {
  'Google':                        'https://careers.google.com/jobs/results/',
  'Stripe':                        'https://stripe.com/jobs/search',
  'Amazon':                        'https://www.amazon.jobs/en/search',
  'Amazon Logistics':              'https://www.amazon.jobs/en/search',
  'Meta':                          'https://www.metacareers.com/jobs',
  'Netflix':                       'https://jobs.netflix.com/search',
  'Scale AI':                      'https://scale.com/careers#openings',
  'Spotify':                       'https://www.lifeatspotify.com/jobs',
  'DeepMind':                      'https://deepmind.google/about/careers/',
  'McKinsey & Company':            'https://www.mckinsey.com/careers/search-jobs',
  'Deloitte Consulting':           'https://apply.deloitte.com/careers/SearchJobs',
  'Goldman Sachs':                 'https://higher.gs.com/roles',
  'JPMorgan Chase':                'https://careers.jpmorgan.com/us/en/jobs',
  'Two Sigma':                     'https://careers.twosigma.com/careers/JobList',
  'HubSpot':                       'https://www.hubspot.com/careers/jobs',
  'Nike':                          'https://jobs.nike.com/',
  'Salesforce':                    'https://careers.salesforce.com/en/jobs/',
  'Tesla':                         'https://www.tesla.com/careers/search',
  'Apple':                         'https://jobs.apple.com/en-us/search',
  'SpaceX':                        'https://www.spacex.com/careers/search',
  'Intel':                         'https://jobs.intel.com/en/search-jobs',
  'Qualcomm':                      'https://careers.qualcomm.com/careers/search',
  'Texas Instruments':             'https://careers.ti.com/search/',
  'Emerson Electric':              'https://www.emerson.com/en-us/careers/search',
  'Boeing':                        'https://jobs.boeing.com/search-jobs',
  'Boeing Defense':                'https://jobs.boeing.com/search-jobs',
  'Boeing Defense, Space & Security': 'https://jobs.boeing.com/search-jobs',
  'Ameren':                        'https://ameren.jobs/search/',
  'Ameren Missouri':               'https://ameren.jobs/search/',
  'Caterpillar':                   'https://careers.caterpillar.com/en/jobs/',
  'NIH':                           'https://jobs.nih.gov/',
  'Pfizer':                        'https://www.pfizer.com/about/careers/job-search',
  'Mayo Clinic':                   'https://jobs.mayoclinic.org/search-jobs',
  'Johns Hopkins Hospital':        'https://jobs.hopkinsmedicine.org/search-jobs',
  'McLean Hospital':               'https://www.mcleanhospital.org/careers/search-jobs',
  'Microsoft':                     'https://careers.microsoft.com/v2/global/en/search',
  'Airbnb':                        'https://careers.airbnb.com/positions/',
  'Figma':                         'https://www.figma.com/careers/#job-openings',
  'Adobe':                         'https://careers.adobe.com/us/en/search-results',
  'Stanford University':           'https://stanford.taleo.net/careersection/2/jobsearch.ftl',
  'Coursera':                      'https://careers.coursera.org/jobs/search',
  'Environmental Defense Fund':    'https://www.edf.org/jobs',
  'Jacobs':                        'https://careers.jacobs.com/en_US/careers/SearchJobs',
  'Jacobs Engineering':            'https://careers.jacobs.com/en_US/careers/SearchJobs',
  'AECOM':                         'https://aecom.jobs/search/',
  'Genentech':                     'https://www.gene.com/careers/search-jobs',
  'Moderna':                       'https://modernatx.wd1.myworkdayjobs.com/en-US/M_careers',
  '3M':                            'https://www.3m.com/3M/en_US/careers-us/jobs/#',
  'Dow':                           'https://jobs.dow.com/en/search-jobs',
  'Gensler':                       'https://www.gensler.com/careers/job-openings',
  'Northrop Grumman':              'https://www.northropgrumman.com/careers/search-jobs/',
  'CrowdStrike':                   'https://careers.crowdstrike.com/us/en/search-results',
  'Palo Alto Networks':            'https://jobs.paloaltonetworks.com/en/jobs/',
  'Databricks':                    'https://www.databricks.com/company/careers/open-positions',
  'Palantir':                      'https://jobs.lever.co/palantir',
  'NVIDIA':                        'https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite',
  'Honeywell':                     'https://careers.honeywell.com/us/en/search-results',
  'Siemens':                       'https://jobs.siemens.com/careers/search',
  'Lockheed Martin':               'https://www.lockheedmartinjobs.com/search-jobs',
  'Boston Scientific':             'https://jobs.bostonscientific.com/en-US/search',
  'Philips Healthcare':            'https://www.careers.philips.com/global/en/search-results',
  'Terracon':                      'https://www.terracon.com/about/careers/open-positions/',
  'Belden':                        'https://careers.belden.com/search/',
  'Anheuser-Busch':                'https://www.anheuser-busch.com/careers/job-listings',
  'Watlow':                        'https://www.watlow.com/about-us/careers/career-search',
  'L3Harris Technologies':         'https://careers.l3harris.com/search-jobs',
  'Medtronic':                     'https://jobs.medtronic.com/jobs/search',
  'HOK':                           'https://careers.hok.com/jobs',
  'Illumina':                      'https://illumina.wd1.myworkdayjobs.com/en-US/illumina-careers',
  'AstraZeneca':                   'https://careers.astrazeneca.com/search-jobs',
  'Johnson Controls':              'https://jobs.johnsoncontrols.com/search-jobs',
  'Black & Veatch':                'https://bv.com/careers/search-open-jobs',
  'Abbott Laboratories':           'https://www.jobs.abbott/search-jobs.html',
  'Perkins&Will':                  'https://perkinswill.com/careers/',
  'Procter & Gamble':              'https://www.pgcareers.com/search-jobs',
  'World Wide Technology':         'https://www.wwt.com/careers/search',
  'Edward Jones':                  'https://jobs.edwardjones.com/search-jobs',
  'Mastercard':                    'https://careers.mastercard.com/us/en/search-results',
  'Mallinckrodt Pharmaceuticals':  'https://jobs.mallinckrodt.com/search-jobs',
  'Nidec Motor Corporation':       'https://www.nidec.com/en/career/search/',
  'MEMC / GlobalWafers':           'https://careers.globalwafers.com/search/',
  'Leidos':                        'https://careers.leidos.com/search/',
  'Kwame Building Group':          'https://kwamebg.com/careers/',
  'Kimley-Horn':                   'https://www.kimley-horn.com/careers/open-positions/',
  'OpenAI':                        'https://openai.com/careers/search',
  'DoorDash':                      'https://careers.doordash.com/jobs/search',
  'LinkedIn':                      'https://careers.linkedin.com/search',
  'Duolingo':                      'https://careers.duolingo.com/',
  'The Nature Conservancy':        'https://careers.nature.org/psc/tnccareers/EMPLOYEE/HRMS/c/HRS_HRAM.HRS_APP_SCHJOB.GBL',
  'Cloudflare':                    'https://careers.cloudflare.com/jobs/',
  'Kaiser Permanente':             'https://jobs.kaiserpermanente.org/search-jobs',
  'Khan Academy':                  'https://www.khanacademy.org/careers',
  'Edelman':                       'https://www.edelman.com/careers/open-roles',
  'Eaton Corporation':             'https://eaton.eightfold.ai/careers',
  'Waymo':                         'https://waymo.com/careers/search/',
  'Ericsson':                      'https://jobs.ericsson.com/careers/search',
  'ABB':                           'https://careers.abb.com/global/en/jobs',
  'Rockwell Automation':           'https://jobs.rockwellautomation.com/en/jobs',
  'Garmin':                        'https://careers.garmin.com/careers/SearchJobs',
  'Westinghouse Electric':         'https://careers.westinghousenuclear.com/search-jobs',
  'Boston Dynamics':               'https://bostondynamics.com/careers/',
  'Ørsted':                        'https://orsted.com/en/careers/open-positions',
  'General Electric (GE Vernova)': 'https://jobs.gecareers.com/vernova/global/en/search',
  'GE Vernova':                    'https://jobs.gecareers.com/vernova/global/en/search',
  'U.S. Steel Granite City Works': 'https://www.ussteel.com/careers',
  'U.S. Steel':                    'https://www.ussteel.com/careers',
  'Phillips 66 Wood River Refinery': 'https://jobs.phillips66.com/search-jobs',
  'Phillips 66':                   'https://jobs.phillips66.com/search-jobs',
  'General Motors Wentzville Assembly': 'https://search-careers.gm.com/en/jobs/',
  'General Motors':                'https://search-careers.gm.com/en/jobs/',
  'Bayer Crop Science':            'https://career.bayer.us/en/job-search/',
  'Bayer':                         'https://career.bayer.us/en/job-search/',
  'Spire Energy':                  'https://www.spireenergy.com/careers',
  'Centene Corporation':           'https://jobs.centene.com/us/en/search-results',
  'Centene':                       'https://jobs.centene.com/us/en/search-results',
  'Charter Communications (Spectrum)': 'https://jobs.spectrum.com/search-jobs',
  'Charter Communications':        'https://jobs.spectrum.com/search-jobs',
  'Spectrum':                      'https://jobs.spectrum.com/search-jobs',
  'Nestlé Purina PetCare':         'https://www.nestlejobs.com/job-search-results',
  'Nestle Purina':                 'https://www.nestlejobs.com/job-search-results',
  'Energizer Holdings':            'https://careers.energizer.com/search/',
  'Energizer':                     'https://careers.energizer.com/search/',
  'SunCoke Energy':                'https://www.suncoke.com/careers/job-search',
  'Archer Daniels Midland (ADM)':  'https://www.adm.com/en-us/careers/',
  'ADM':                           'https://www.adm.com/en-us/careers/',
  'Olin Brass / Wieland':          'https://www.wieland.com/en/career',
  'Wieland':                       'https://www.wieland.com/en/career',
  'Illinois Department of Transportation': 'https://idot.illinois.gov/about-idot/employment.html',
  'IDOT':                          'https://idot.illinois.gov/about-idot/employment.html',
  'Southern Illinois University Edwardsville': 'https://siue.edu/employment/',
  'SIUE':                          'https://siue.edu/employment/',
  'Bunge North America':           'https://careers.bunge.com/search/',
  'Bunge':                         'https://careers.bunge.com/search/',
  'City Water, Light & Power (Springfield)': 'https://springfield.applicantpro.com/jobs/',
  'CWLP':                          'https://springfield.applicantpro.com/jobs/',
  'Marathon Petroleum':            'https://www.marathonpetroleum.com/Careers/',
  'Watlow Electric':               'https://www.watlow.com/about-us/careers/career-search',
  'Reinsurance Group of America (RGA)': 'https://rgare.wd1.myworkdayjobs.com/RGA_Careers',
  'RGA':                           'https://rgare.wd1.myworkdayjobs.com/RGA_Careers',
  'Graybar Electric':              'https://www.graybar.com/about/careers',
  'Graybar':                       'https://www.graybar.com/about/careers',
  'HDR Engineering':               'https://hdrinc.taleo.net/careersection/ex/jobsearch.ftl',
  'HDR':                           'https://hdrinc.taleo.net/careersection/ex/jobsearch.ftl',
};

// For live jobs use their direct URL; for static jobs go to the company careers page
function getApplyUrl(job: Job): string {
  if (job.applyUrl) return job.applyUrl;
  if (COMPANY_CAREERS[job.company]) return COMPANY_CAREERS[job.company];
  // Last-resort fallback: company website search
  const domain = job.company.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\s+/g, '');
  return `https://www.${domain}.com/careers`;
}

function fieldGrad(field: string) {
  return FIELD_GRADIENTS[field] ?? 'from-indigo-500 to-violet-600';
}
function avatarGrad(company: string) {
  return AVATAR_GRADIENTS[(company.charCodeAt(0) + company.charCodeAt(company.length - 1)) % AVATAR_GRADIENTS.length];
}

export default function JobCard({ job, match, analyzing, analyzeError, userCity, distanceMiles, isSaved, onAnalyze, onSave, onClick }: Props) {
  const [mapOpen, setMapOpen] = useState(false);

  return (
    <div className="contents">
    {mapOpen && (
      <MapModal
        job={job}
        userCity={userCity}
        distanceMiles={distanceMiles}
        onClose={() => setMapOpen(false)}
      />
    )}
    <div
      className="group relative bg-white rounded-2xl border border-slate-100/80 shadow-sm
                 hover:shadow-2xl hover:shadow-slate-300/40 hover:-translate-y-1
                 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col"
      onClick={onClick}
    >
      {/* Top colour accent */}
      <div className={`h-[3px] w-full bg-gradient-to-r ${fieldGrad(job.field)}`} />

      <div className="p-5 flex flex-col flex-1 gap-3">

        {/* ── Row 1: avatar + title + score badge ── */}
        <div className="flex items-start gap-3">
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${avatarGrad(job.company)}
                           flex items-center justify-center flex-shrink-0 text-sm font-bold text-white shadow-sm`}>
            {job.company.slice(0, 2).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-slate-400 truncate mb-0.5">{job.company}</p>
            <h3 className="font-bold text-slate-800 text-sm leading-snug line-clamp-2
                           group-hover:text-indigo-700 transition-colors duration-150">
              {job.title}
            </h3>
          </div>

          {/* Score badge */}
          {match && (
            <div className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl ${scoreBg(match.overallScore)} ${scoreGlow(match.overallScore)} animate-score-in`}>
              <span className="text-xl font-black leading-none" style={{ color: scoreColor(match.overallScore) }}>
                {match.overallScore}
              </span>
              <span className="text-[9px] font-bold opacity-60 -mt-0.5">%</span>
              <span className="text-[9px] font-bold mt-0.5 opacity-75">{scoreLabel(match.overallScore)}</span>
            </div>
          )}
        </div>

        {/* ── Row 2: badges ── */}
        <div className="flex flex-wrap gap-1.5">
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${TYPE_STYLES[job.type]}`}>
            {job.type}
          </span>
          {job.remote && (
            <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-teal-100 text-teal-700 ring-1 ring-teal-200/80 flex items-center gap-1">
              <Wifi className="w-2.5 h-2.5" /> Remote
            </span>
          )}
          {job.postedDaysAgo < 3 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-rose-100 text-rose-700 ring-1 ring-rose-200/80 flex items-center gap-1 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              New
            </span>
          )}
          {job.isLive && (
            <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/80 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {job.source ?? 'Live'}
            </span>
          )}
        </div>

        {/* ── Row 3: mini score bars (after analysis) ── */}
        {match && (
          <div className="space-y-1.5 bg-slate-50 rounded-xl p-3">
            {([
              ['Skills',    match.breakdown.skillsMatch],
              ['Exp',       match.breakdown.experienceMatch],
              ['Education', match.breakdown.educationMatch],
            ] as [string, number][]).map(([label, val]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-slate-400 w-14 flex-shrink-0">{label}</span>
                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${val}%`, backgroundColor: scoreColor(val) }}
                  />
                </div>
                <span className="text-[10px] font-bold w-6 text-right tabular-nums" style={{ color: scoreColor(val) }}>{val}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Row 4: meta ── */}
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <button
            onClick={e => { e.stopPropagation(); setMapOpen(true); }}
            className="flex items-center gap-1 min-w-0 text-slate-400 hover:text-indigo-600 transition-colors group"
            title={job.remote ? 'Remote position' : `View map for ${job.location}`}
          >
            <MapPin className="w-3 h-3 flex-shrink-0 group-hover:text-indigo-500" />
            <span className="truncate underline decoration-dotted underline-offset-2 decoration-slate-300 group-hover:decoration-indigo-400">
              {job.location}
            </span>
          </button>
          {userCity && !job.remote && distanceMiles != null && !isNaN(distanceMiles) && (
            <button
              onClick={e => { e.stopPropagation(); setMapOpen(true); }}
              className="flex items-center gap-1 text-indigo-400 hover:text-indigo-600 transition-colors flex-shrink-0 font-semibold"
              title="View distance and route on map"
            >
              <Navigation className="w-3 h-3" />
              {formatDistance(distanceMiles)}
            </button>
          )}
          <span className="flex items-center gap-1 ml-auto flex-shrink-0">
            <Clock className="w-3 h-3" />
            {job.postedDaysAgo === 0 ? 'Today' : `${job.postedDaysAgo}d ago`}
          </span>
        </div>

        {/* Salary */}
        <p className="text-xs font-bold text-slate-600 -mt-1">{job.salary}</p>

        {/* Error */}
        {analyzeError && !match && (
          <p className="text-xs text-rose-500 flex items-center gap-1">⚠ {analyzeError}</p>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* ── CTA row: Analyze + Apply + Save ── */}
        <div className="flex gap-2">
          <button
            onClick={e => { e.stopPropagation(); if (!match && !analyzing) onAnalyze(); }}
            disabled={analyzing || !!match}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 ${
              match
                ? 'bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-600 border border-indigo-100/80 hover:from-indigo-100 hover:to-violet-100'
                : analyzing
                ? 'bg-indigo-50 text-indigo-400 cursor-wait'
                : analyzeError
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100'
                : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md shadow-indigo-300/50 hover:shadow-lg hover:shadow-indigo-300/60'
            }`}
          >
            {analyzing    ? <><Loader2 className="w-3 h-3 animate-spin" /> Analyzing…</> :
             match        ? <><TrendingUp className="w-3 h-3" /> View Details</> :
             analyzeError ? <><Sparkles className="w-3 h-3" /> Retry</> :
                            <><Sparkles className="w-3 h-3" /> Analyze Match</>}
          </button>

          <a
            href={getApplyUrl(job)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1 px-3.5 py-2.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200 flex-shrink-0"
          >
            Apply <ExternalLink className="w-3 h-3" />
          </a>

          {onSave && (
            <button
              onClick={e => { e.stopPropagation(); onSave(); }}
              className={`p-2.5 rounded-xl transition-all duration-200 flex-shrink-0 ${
                isSaved
                  ? 'bg-rose-100 text-rose-600 hover:bg-rose-200'
                  : 'border border-slate-200 text-slate-400 hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50'
              }`}
              title={isSaved ? 'Remove from favorites' : 'Save to favorites'}
            >
              <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
            </button>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
