import { Skeleton } from "@/components/ui/skeleton";

/** Shared skeletons so no route ever paints a blank/white screen. */

export const CardGridSkeleton = ({ count = 6 }: { count?: number }) => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading cards">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    ))}
  </div>
);

export const StatsSkeleton = ({ count = 4 }: { count?: number }) => (
  <div className="grid gap-4 grid-cols-2 lg:grid-cols-4" role="status" aria-label="Loading statistics">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-7 w-1/3" />
      </div>
    ))}
  </div>
);

export const TableSkeleton = ({ rows = 6 }: { rows?: number }) => (
  <div className="rounded-2xl border border-border bg-card overflow-hidden" role="status" aria-label="Loading table">
    <div className="border-b border-border p-3">
      <Skeleton className="h-4 w-1/4" />
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 p-3 border-b border-border/60 last:border-0">
        <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
        <Skeleton className="h-3 flex-1" />
        <Skeleton className="h-3 w-16 hidden sm:block" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    ))}
  </div>
);

export const ChartSkeleton = () => (
  <div className="rounded-2xl border border-border bg-card p-4 space-y-3" role="status" aria-label="Loading chart">
    <Skeleton className="h-4 w-1/3" />
    <div className="flex items-end gap-2 h-48">
      {[60, 90, 45, 120, 80, 140, 70].map((h, i) => (
        <Skeleton key={i} className="flex-1 rounded-t-lg" style={{ height: h }} />
      ))}
    </div>
  </div>
);

export const MapSkeleton = ({ className = "h-[60vh]" }: { className?: string }) => (
  <div className={`relative w-full overflow-hidden rounded-2xl border border-border ${className}`} role="status" aria-label="Loading map">
    <Skeleton className="absolute inset-0 rounded-none" />
    <div className="absolute inset-0 flex items-center justify-center">
      <p className="text-sm font-medium text-muted-foreground">Loading map…</p>
    </div>
  </div>
);

export const ProfileSkeleton = () => (
  <div className="space-y-4" role="status" aria-label="Loading profile">
    <Skeleton className="h-32 w-full rounded-2xl" />
    <div className="flex items-center gap-4">
      <Skeleton className="h-20 w-20 rounded-full" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
    <FormSkeleton />
  </div>
);

export const FormSkeleton = ({ fields = 6 }: { fields?: number }) => (
  <div className="grid gap-4 sm:grid-cols-2" role="status" aria-label="Loading form">
    {Array.from({ length: fields }).map((_, i) => (
      <div key={i} className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    ))}
  </div>
);

export const DashboardSkeleton = () => (
  <div className="p-4 md:p-6 space-y-6">
    <StatsSkeleton />
    <CardGridSkeleton count={3} />
  </div>
);

export const AdminDashboardSkeleton = () => (
  <div className="space-y-6">
    <StatsSkeleton />
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartSkeleton />
      <ChartSkeleton />
    </div>
    <TableSkeleton />
  </div>
);