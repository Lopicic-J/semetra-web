import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function ChallengesLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-300">
      <Skeleton className="h-8 w-40" />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
