"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Download, Loader2, CheckCircle, AlertCircle, BookOpen,
  Clock, Calendar, Globe, ChevronDown, ChevronUp
} from "lucide-react";

type ScrapedModule = {
  name: string;
  code: string;
  ects: number;
  semester: string;
  day?: string;
  time_start?: string;
  time_end?: string;
  room?: string;
  link?: string;
};

type ScrapResult = {
  modules: ScrapedModule[];
  events: Array<{ title: string; start_dt: string; end_dt?: string; location?: string }>;
  rawHtml?: string;
};

export default function ScrapPage() {
  const supabase = createClient();

  const [moodleUrl, setMoodleUrl] = useState("https://moodle.ffhs.ch");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "scraping" | "preview" | "done">("idle");
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showRaw, setShowRaw] = useState(false);

  async function handleScrape(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setStep("scraping");

    try {
      const res = await fetch("/api/scrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moodleUrl, username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scraping fehlgeschlagen");
      setResult(data);
      setSelected(new Set(data.modules.map((_: ScrapedModule, i: number) => i)));
      setStep("preview");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setStep("idle");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!result) return;
    setImporting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setImporting(false); return; }

    const toImport = result.modules.filter((_, i) => selected.has(i));
    const moduleRows = toImport.map(m => ({
      user_id: user.id,
      name: m.name,
      code: m.code || null,
      ects: m.ects || null,
      semester: m.semester || null,
      day: m.day || null,
      time_start: m.time_start || null,
      time_end: m.time_end || null,
      room: m.room || null,
      link: m.link || null,
      status: "active",
      module_type: "pflicht",
      color: "#6d28d9",
      in_plan: true,
    }));

    if (moduleRows.length > 0) {
      await supabase.from("modules").insert(moduleRows);
    }

    // Import calendar events if any
    if (result.events && result.events.length > 0) {
      const eventRows = result.events.map(ev => ({
        user_id: user.id,
        title: ev.title,
        start_dt: ev.start_dt,
        end_dt: ev.end_dt ?? null,
        location: ev.location ?? null,
        color: "#dc2626",
        event_type: "exam",
      }));
      await supabase.from("calendar_events").insert(eventRows);
    }

    setImporting(false);
    setStep("done");
  }

  function toggleSelect(i: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Download className="text-violet-600" size={26} />
          Scrap — FFHS Portal Import
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Importiere deine Module und Termine automatisch aus dem FFHS Moodle Portal.
        </p>
      </div>

      {/* Info banner */}
      <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
        <strong>Hinweis:</strong> Deine Zugangsdaten werden ausschließlich für den einmaligen Scraping-Vorgang verwendet und nicht gespeichert. Die Verbindung erfolgt verschlüsselt über HTTPS.
      </div>

      {step === "idle" || step === "scraping" ? (
        <form onSubmit={handleScrape} className="card space-y-4">
          <h2 className="font-semibold text-gray-800">FFHS Portal Login</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Moodle URL</label>
            <input
              className="input"
              type="url"
              value={moodleUrl}
              onChange={e => setMoodleUrl(e.target.value)}
              placeholder="https://moodle.ffhs.ch"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Benutzername / E-Mail</label>
            <input
              className="input"
              type="text"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="vorname.nachname@students.ffhs.ch"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
            <input
              className="input"
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center gap-2">
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> Scrappe Portal…</>
            ) : (
              <><Globe size={16} /> Portal importieren</>
            )}
          </button>

          {loading && (
            <div className="text-center text-sm text-gray-500 space-y-1">
              <p>Verbinde mit FFHS Moodle…</p>
              <p className="text-xs text-gray-400">Dies kann 10–30 Sekunden dauern.</p>
            </div>
          )}
        </form>
      ) : null}

      {step === "preview" && result && (
        <div>
          {/* Modules preview */}
          {result.modules.length > 0 && (
            <div className="card p-0 overflow-hidden mb-6">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-violet-600" />
                  <span className="font-semibold text-gray-800 text-sm">
                    {result.modules.length} Module gefunden
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (selected.size === result.modules.length) {
                      setSelected(new Set());
                    } else {
                      setSelected(new Set(result.modules.map((_, i) => i)));
                    }
                  }}
                  className="text-xs text-violet-600 hover:underline"
                >
                  {selected.size === result.modules.length ? "Alle abwählen" : "Alle wählen"}
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {result.modules.map((m, i) => (
                  <label key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={() => toggleSelect(i)}
                      className="w-4 h-4 accent-violet-600"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{m.name}</p>
                      <p className="text-xs text-gray-500">
                        {m.code && <span className="font-mono mr-2">{m.code}</span>}
                        {m.ects > 0 && <span>{m.ects} ECTS · </span>}
                        {m.semester && <span>{m.semester}</span>}
                      </p>
                    </div>
                    {m.day && (
                      <span className="text-xs text-gray-400">
                        {m.day} {m.time_start}–{m.time_end}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Events preview */}
          {result.events && result.events.length > 0 && (
            <div className="card p-0 overflow-hidden mb-6">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                <Calendar size={16} className="text-red-500" />
                <span className="font-semibold text-gray-800 text-sm">
                  {result.events.length} Prüfungstermine gefunden (werden alle importiert)
                </span>
              </div>
              <div className="divide-y divide-gray-50">
                {result.events.map((ev, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                    <Clock size={14} className="text-red-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-800">{ev.title}</p>
                      <p className="text-xs text-gray-500">{ev.start_dt} {ev.location && `· ${ev.location}`}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw HTML toggle for debugging */}
          {result.rawHtml && (
            <div className="mb-6">
              <button
                type="button"
                onClick={() => setShowRaw(!showRaw)}
                className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700"
              >
                {showRaw ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Debug: Rohdaten anzeigen
              </button>
              {showRaw && (
                <pre className="mt-2 p-3 bg-gray-100 rounded-xl text-xs text-gray-600 overflow-auto max-h-60">
                  {result.rawHtml.substring(0, 3000)}…
                </pre>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setStep("idle"); setResult(null); setError(null); }}
              className="btn-secondary flex-1"
            >
              Zurück
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || selected.size === 0}
              className="btn-primary flex-1 justify-center gap-2"
            >
              {importing
                ? <><Loader2 size={16} className="animate-spin" /> Importiere…</>
                : <><Download size={16} /> {selected.size} Module importieren</>
              }
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-green-600" size={36} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Import erfolgreich!</h2>
          <p className="text-gray-500 mb-6">
            Deine Module und Termine wurden aus dem FFHS Portal importiert.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setStep("idle"); setResult(null); }} className="btn-secondary">
              Erneut importieren
            </button>
            <a href="/modules" className="btn-primary">
              Module ansehen →
            </a>
          </div>
        </div>
      )}

      {/* Manual import hint */}
      {step === "idle" && (
        <div className="mt-8 p-4 rounded-xl border border-dashed border-gray-200 text-center text-sm text-gray-500">
          <p className="font-medium text-gray-600 mb-1">Kein automatischer Import möglich?</p>
          <p>Wähle deinen Studiengang manuell unter <a href="/studiengaenge" className="text-violet-600 hover:underline">Studiengänge</a> und passe die Module an.</p>
        </div>
      )}
    </div>
  );
}
