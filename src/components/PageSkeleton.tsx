import { Skeleton } from "@/components/ui/skeleton";

export const PageSkeleton = ({ message = "Loading page…" }: { message?: string }) => (
  <div className="min-h-screen w-full p-4 md:p-6 space-y-4 pt-16" role="status" aria-live="polite">
    <p className="text-sm font-medium text-muted-foreground">{message}</p>
    <Skeleton className="h-8 w-1/3" />
    <Skeleton className="h-4 w-1/2" />
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6">
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
    <Skeleton className="h-64 rounded-xl mt-4" />
  </div>
);