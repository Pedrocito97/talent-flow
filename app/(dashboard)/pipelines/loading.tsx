import { Skeleton } from '@/components/ui/skeleton';

export default function PipelinesLoading() {
  return (
    <div className="space-y-8 p-1">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-40" />
          <Skeleton className="mt-2 h-5 w-72" />
        </div>
        <Skeleton className="h-11 w-36 rounded-xl" />
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-56 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
