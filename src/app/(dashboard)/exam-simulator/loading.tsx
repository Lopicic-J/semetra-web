import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function ExamSimulatorLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-300">
      <Skeleton className="h-8 w-52" />
      <SkeletonCard className="h-[300px]" />
    </div>
  );
}
