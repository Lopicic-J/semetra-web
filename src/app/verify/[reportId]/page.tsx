"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { clsx } from "clsx";
import { ShieldCheck, ShieldAlert, Loader2, ExternalLink } from "lucide-react";
import type { VerificationResult } from "@/lib/verification/hash";

export default function VerifyReportPage() {
  const params = useParams();
  const reportId = params.reportId as string;
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!reportId) return;
    fetch(`/api/verification/report?report_id=${encodeURIComponent(reportId)}`)
      .then((r) => r.json())
      .then((data) => setResult(data))
      .catch(() =>
        setResult({ valid: false, reportId, reportType: "unknown", generatedAt: "" })
      )
      .finally(() => setLoading(false));
  }, [reportId]);

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Brand */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-surface-900">Semetra</h1>
          <p className="text-sm text-surface-500">Dokumenten-Verifizierung</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-surface-100 rounded-2xl shadow-lg border border-surface-200/60 overflow-hidden">
          {/* Status Header */}
          <div
            className={clsx(
              "px-6 py-5 flex items-center gap-4",
              loading
                ? "bg-surface-50"
                : result?.valid
                  ? "bg-green-50 dark:bg-green-900/20"
                  : "bg-red-50 dark:bg-red-900/20"
            )}
          >
            {loading ? (
              <Loader2 size={28} className="animate-spin text-surface-400" />
            ) : result?.valid ? (
              <ShieldCheck size={28} className="text-green-600 dark:text-green-400" />
            ) : (
              <ShieldAlert size={28} className="text-red-600 dark:text-red-400" />
            )}
            <div>
              <h2
                className={clsx(
                  "text-lg font-bold",
                  loading
                    ? "text-surface-600"
                    : result?.valid
                      ? "text-green-800 dark:text-green-300"
                      : "text-red-800 dark:text-red-300"
                )}
              >
                {loading
                  ? "Wird überprüft…"
                  : result?.valid
                    ? "Dokument verifiziert"
                    : "Nicht verifiziert"}
              </h2>
              <p className="text-sm text-surface-500 mt-0.5">
                Report-ID: <span className="font-mono font-medium">{reportId}</span>
              </p>
            </div>
          </div>

          {/* Details */}
          {!loading && result?.valid && (
            <div className="px-6 py-4 space-y-3">
              <DetailRow label="Typ" value={
                result.reportType === "semester-report"
                  ? "Semester-Report"
                  : result.reportType === "module-certificate"
                    ? "Modul-Zertifikat"
                    : result.reportType
              } />
              {result.userName && (
                <DetailRow label="Erstellt von" value={result.userName} />
              )}
              {result.university && (
                <DetailRow label="Hochschule" value={result.university} />
              )}
              <DetailRow
                label="Erstellt am"
                value={new Date(result.generatedAt).toLocaleDateString("de-CH", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
              {result.verifiedAt && (
                <DetailRow
                  label="Geprüft am"
                  value={new Date(result.verifiedAt).toLocaleDateString("de-CH", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                />
              )}
            </div>
          )}

          {!loading && !result?.valid && (
            <div className="px-6 py-4">
              <p className="text-sm text-surface-600">
                Dieses Dokument konnte nicht in unserer Datenbank gefunden werden.
                Möglicherweise wurde die Report-ID falsch eingegeben oder das
                Dokument wurde manipuliert.
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="px-6 py-3 bg-surface-50 border-t border-surface-200/60">
            <a
              href="https://app.semetra.ch"
              className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              app.semetra.ch <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start">
      <span className="text-xs text-surface-500">{label}</span>
      <span className="text-sm font-medium text-surface-800 text-right">{value}</span>
    </div>
  );
}
