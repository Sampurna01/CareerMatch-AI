export default function SkeletonJobCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100 animate-pulse">
      {/* Header */}
      <div className="flex gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-slate-200" />
        <div className="flex-1">
          <div className="h-5 bg-slate-200 rounded mb-2 w-3/4" />
          <div className="h-3 bg-slate-100 rounded w-1/2" />
        </div>
      </div>

      {/* Description */}
      <div className="mb-4 space-y-2">
        <div className="h-3 bg-slate-100 rounded" />
        <div className="h-3 bg-slate-100 rounded w-5/6" />
      </div>

      {/* Badges */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="h-6 bg-slate-100 rounded-full w-16" />
        <div className="h-6 bg-slate-100 rounded-full w-20" />
        <div className="h-6 bg-slate-100 rounded-full w-14" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <div className="h-8 bg-slate-100 rounded w-16" />
          <div className="h-8 bg-slate-100 rounded w-16" />
        </div>
        <div className="w-12 h-12 rounded-lg bg-slate-100" />
      </div>
    </div>
  );
}
