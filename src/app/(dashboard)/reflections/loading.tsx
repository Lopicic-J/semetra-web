import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function ReflectionsLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-300">
      <Skeleton className="h-8 w-44" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }, (_, i) => <SkeletonCard key={i} className="h-[80px]" />)}
      </div>
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
