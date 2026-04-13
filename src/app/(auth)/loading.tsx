export default function AuthLoading() {
  return (
 <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50">
      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <div className="relative w-12 h-12">
 <div className="absolute inset-0 rounded-full border-4 border-violet-100"></div>
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-violet-600 border-r-violet-600 animate-spin"></div>
        </div>

        {/* Loading Text */}
        <p className="text-surface-600 font-medium">Laden...</p>
      </div>
    </div>
  );
}
