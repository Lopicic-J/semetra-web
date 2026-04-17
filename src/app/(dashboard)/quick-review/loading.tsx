import { Skeleton } from "@/components/ui/Skeleton";

export default function QuickReviewLoading() {
  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center animate-in fade-in duration-300">
      <Skeleton className="h-14 w-14 rounded-2xl mx-auto mb-4" />
      <Skeleton className="h-4 w-32 mx-auto" />
    </div>
  );
}
