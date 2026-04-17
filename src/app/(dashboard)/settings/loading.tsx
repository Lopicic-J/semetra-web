import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function SettingsLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-300">
      <Skeleton className="h-6 w-40" />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
