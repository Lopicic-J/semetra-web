"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import toast from "react-hot-toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Copy, Check, Code, Lock, BookOpen } from "lucide-react";

interface Endpoint {
  method: string;
  path: string;
  description: string;
  scope: string;
  example: {
    request: string;
    response: object;
  };
  curl: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/api/v1/modules",
    description: "Gibt alle Module des authentifizierten Benutzers zurück.",
    scope: "modules",
    example: {
      request: "GET https://app.semetra.ch/api/v1/modules",
      response: {
        modules: [
          {
            id: "mod_1",
            name: "Mathematik I",
            ects: 6,
            status: "active",
          },
          {
            id: "mod_2",
            name: "Informatik Grundlagen",
            ects: 4,
            status: "active",
          },
        ],
      },
    },
    curl: 'curl -H "Authorization: Bearer sk_live_xxxx" https://app.semetra.ch/api/v1/modules',
  },
  {
    method: "GET",
    path: "/api/v1/grades",
    description: "Gibt alle Noten des authentifizierten Benutzers zurück.",
    scope: "grades",
    example: {
      request: "GET https://app.semetra.ch/api/v1/grades",
      response: {
        grades: [
          {
            id: "gr_1",
            module_id: "mod_1",
            value: 5.5,
            weight: 1.0,
            date: "2026-03-15",
          },
          {
            id: "gr_2",
            module_id: "mod_2",
            value: 6.0,
            weight: 1.0,
            date: "2026-04-01",
          },
        ],
      },
    },
    curl: 'curl -H "Authorization: Bearer sk_live_xxxx" https://app.semetra.ch/api/v1/grades',
  },
];

const BASE_URL = "https://app.semetra.ch/api/v1";

export default function ApiDocsPage() {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<number | null>(0);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  function copyCurl(curl: string, id: number) {
    navigator.clipboard.writeText(curl);
    setCopiedId(id);
    toast.success(t("developer.docs.copyCurl") || "Curl kopiert!");
    setTimeout(() => setCopiedId(null), 3000);
  }

  return (
    <ErrorBoundary feature="API Docs">
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="text-brand-600" size={28} />
            <h1 className="text-3xl font-bold text-surface-900">{t("developer.docs.title") || "API-Dokumentation"}</h1>
          </div>
          <p className="text-surface-500 text-sm">{t("developer.docs.subtitle") || "Referenz für die Semetra Public API"}</p>
        </div>

        {/* Authentication section */}
        <div className="card mb-8 p-6 border-brand-200">
          <h2 className="text-lg font-semibold text-surface-900 mb-4 flex items-center gap-2">
            <Lock size={20} className="text-brand-600" />
            {t("developer.docs.auth") || "Authentifizierung"}
          </h2>
          <p className="text-sm text-surface-600 mb-4">
            {t("developer.docs.authDesc") || "Alle Anfragen benötigen einen Bearer Token im Authorization-Header."}
          </p>
          <div className="bg-surface-900 text-surface-100 p-4 rounded-lg font-mono text-xs overflow-x-auto mb-4">
            <pre>{`Authorization: Bearer sk_live_xxxx`}</pre>
          </div>
          <p className="text-xs text-surface-500">
            {t("developer.docs.baseUrl") || "Base-URL"}: <code className="bg-surface-50 px-2 py-1 rounded">{BASE_URL}</code>
          </p>
        </div>

        {/* Endpoints */}
        <div className="space-y-4">
          {ENDPOINTS.map((endpoint, idx) => (
            <div
              key={idx}
              className="card border border-surface-200 overflow-hidden"
            >
              {/* Header */}
              <button
                onClick={() => setExpandedId(expandedId === idx ? null : idx)}
                className="w-full p-4 hover:bg-surface-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Code size={18} className="text-brand-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold text-white ${
                        endpoint.method === "GET" ? "bg-blue-500" : "bg-green-500"
                      }`}>
                        {endpoint.method}
                      </span>
                      <code className="text-sm font-mono text-surface-700">{endpoint.path}</code>
                    </div>
                    <p className="text-sm text-surface-600 mt-2">{endpoint.description}</p>
                  </div>
                  <span className="text-surface-400 shrink-0">{expandedId === idx ? "−" : "+"}</span>
                </div>
              </button>

              {/* Expanded content */}
              {expandedId === idx && (
                <div className="border-t border-surface-200 p-4 bg-surface-50 space-y-4">
                  {/* Scope */}
                  <div>
                    <p className="text-xs font-semibold text-surface-600 mb-1">
                      {t("developer.docs.scope") || "Erforderlicher Scope"}
                    </p>
                    <div className="px-3 py-2 bg-surface-100 rounded-lg border border-surface-200 inline-block">
                      <code className="text-xs text-surface-700">{endpoint.scope}</code>
                    </div>
                  </div>

                  {/* Example Response */}
                  <div>
                    <p className="text-xs font-semibold text-surface-600 mb-2">
                      {t("developer.docs.response") || "Beispielantwort"}
                    </p>
                    <pre className="text-xs bg-surface-900 text-surface-100 p-4 rounded-lg overflow-x-auto font-mono">
                      {JSON.stringify(endpoint.example.response, null, 2)}
                    </pre>
                  </div>

                  {/* Curl */}
                  <div>
                    <p className="text-xs font-semibold text-surface-600 mb-2">curl</p>
                    <div className="flex gap-2">
                      <pre className="flex-1 text-xs bg-surface-900 text-surface-100 p-3 rounded-lg overflow-x-auto font-mono">
                        {endpoint.curl}
                      </pre>
                      <button
                        onClick={() => copyCurl(endpoint.curl, idx)}
                        className="p-2 bg-white rounded-lg border border-surface-200 hover:bg-surface-100 transition-colors shrink-0"
                      >
                        {copiedId === idx ? (
                          <Check size={14} className="text-green-600" />
                        ) : (
                          <Copy size={14} className="text-surface-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Info */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Info:</span> Weitere Endpoints werden in zukünftigen Versionen hinzugefügt. Für aktuelle Endpoints siehe unsere Website.
          </p>
        </div>
      </div>
    </ErrorBoundary>
  );
}
