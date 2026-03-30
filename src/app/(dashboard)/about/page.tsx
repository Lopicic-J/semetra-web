import { BookOpen, Zap, Monitor, Smartphone, Globe, Heart } from "lucide-react";
import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Über Semetra</h1>

      {/* Header */}
      <div className="card mb-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-violet-600 text-white flex items-center justify-center">
            <BookOpen size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Semetra</h2>
            <p className="text-gray-500">FH Edition · Web v2.0</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          Semetra ist dein smarter Studienplaner für die Fachhochschule. Organisiere deine Module,
          tracke Aufgaben, generiere KI-Karteikarten, plane Prüfungen und behalte deine Noten im
          Blick — alles an einem Ort. Verfügbar als Web-App, Desktop-App und bald auch mobil.
        </p>
      </div>

      {/* Features */}
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
            "Studiengänge-Import (FH)",
            "Prüfungsplanung",
            "KI-Karteikarten",
            "KI-Studien-Coach",
            "Desktop ↔ Web Sync",
          ].map(t => (
            <span key={t} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Plattformen */}
      <div className="card mb-4">
        <h3 className="font-semibold text-gray-900 mb-3">Plattformen</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Globe size={18} className="text-violet-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800">Web-App</p>
              <p className="text-xs text-gray-500">app.semetra.ch — Überall im Browser nutzbar</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Monitor size={18} className="text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800">Desktop-App</p>
              <p className="text-xs text-gray-500">Windows · Offline-First mit lokaler Datenbank</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Smartphone size={18} className="text-blue-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-800">Mobile App</p>
              <p className="text-xs text-gray-400">Bald verfügbar · iOS & Android</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pläne */}
      <div className="card mb-4">
        <h3 className="font-semibold text-gray-900 mb-3">Pläne & Preise</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-bold shrink-0 mt-0.5">FREE</span>
            <p className="text-gray-600">Grundfunktionen kostenlos — Module, Tasks, Kalender, Noten</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold shrink-0 mt-0.5">PRO</span>
            <p className="text-gray-600">Ab CHF 4,99/Mt. — KI-Features, unbegrenzte Module, Sync, Studiengänge-Import</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold shrink-0 mt-0.5">DESKTOP</span>
            <p className="text-gray-600">CHF 49,90 einmalig — Dauerhaft Pro für die Desktop-App, kein Abo</p>
          </div>
        </div>
        <Link href="/upgrade" className="inline-flex items-center gap-1.5 text-sm text-violet-600 font-medium mt-3 hover:underline">
          <Zap size={13} />
          Alle Pläne vergleichen
        </Link>
      </div>

      {/* Tech Stack */}
      <div className="card mb-4">
        <h3 className="font-semibold text-gray-900 mb-3">Tech Stack</h3>
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
          {["Next.js 15", "TypeScript", "Tailwind CSS", "Supabase", "PostgreSQL", "Python / PySide6", "Stripe", "Anthropic AI"].map(t => (
            <span key={t} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="card">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Heart size={14} className="text-red-400" />
          <span>Entwickelt von <strong className="text-gray-700">Lopicic Technologies</strong> · Schweiz</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          semetra.ch · Sichere Daten mit Schweizer Datenschutz
        </p>
      </div>
    </div>
  );
}
