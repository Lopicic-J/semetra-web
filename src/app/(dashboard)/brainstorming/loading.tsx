import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function BrainstormingLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-300">
      <Skeleton className="h-6 w-36" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  );
}
