"use client";

export function ProspectingSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045]" key={index}>
          <div className="h-32 animate-pulse bg-gradient-to-r from-white/[0.04] via-[#8B5CF6]/20 to-white/[0.04]" />
          <div className="space-y-3 p-4">
            <div className="h-5 w-2/3 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-16 animate-pulse rounded-xl bg-white/10" />
              <div className="h-16 animate-pulse rounded-xl bg-white/10" />
            </div>
            <div className="h-10 animate-pulse rounded-xl bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}
