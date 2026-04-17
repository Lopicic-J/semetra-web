import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function WellnessLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-300">
      <Skeleton className="h-8 w-40" />
      <SkeletonCard className="h-[120px]" />
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} className="h-[80px]" />)}
      </div>
    </div>
  );
}
