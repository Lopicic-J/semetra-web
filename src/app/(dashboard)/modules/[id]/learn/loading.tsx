import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function LearningHubLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-300">
      <Skeleton className="h-8 w-32" />
      <div className="flex gap-1 bg-surface-100 dark:bg-surface-800 rounded-xl p-1">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="flex-1 h-8 bg-surface-200 dark:bg-surface-700 rounded-lg" />)}
      </div>
      <SkeletonCard className="h-[200px]" />
      <SkeletonCard className="h-[100px]" />
    </div>
  );
}
