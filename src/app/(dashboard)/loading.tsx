export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-surface-50">
      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-brand-100"></div>
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-600 border-r-brand-600 animate-spin"></div>
        </div>

        {/* Loading Text */}
        <p className="text-surface-600 font-medium">Laden...</p>

        {/* Optional loading animation text */}
        <p className="text-sm text-surface-400">Bitte warten Sie einen Moment</p>
      </div>
    </div>
  );
}
