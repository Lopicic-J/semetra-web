export default function AboutPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Über Semetra</h1>
      <div className="card mb-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-violet-600 text-white flex items-center justify-center text-3xl">📖</div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Semetra</h2>
            <p className="text-gray-500">FH Edition · Web v1.1</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          Semetra ist dein smarter Studienplaner für die Fachhochschule. Organisiere deine Module, tracke Aufgaben, plane Prüfungen und behalte deine Noten im Blick — alles an einem Ort.
        </p>
      </div>
      <div className="card mb-4">
        <h3 className="font-semibold text-gray-900 mb-3">Features</h3>
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
          {[
            "Modul-Verwaltung",
            "ECTS-Tracking",
            "Aufgaben & Tasks",
            "Kalender & Stundenplan",
            "Notenrechner",
            "Lernziele & Spaced Repetition",
            "Timer & Zeiterfassung",
            "Studiengänge Import",
            "FFHS Portal Scraper",
            "Prüfungsplanung",
          ].map(t => (
            <span key={t} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-3">Tech Stack</h3>
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
          {["Next.js 14", "TypeScript", "Tailwind CSS", "Supabase", "PostgreSQL", "Lucide Icons"].map(t => (
            <span key={t} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
