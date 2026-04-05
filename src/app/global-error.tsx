"use client";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1rem" }}>Etwas ist schiefgelaufen</h2>
          <p style={{ color: "#666", marginBottom: "1.5rem" }}>Ein unerwarteter Fehler ist aufgetreten.</p>
          <button
            onClick={reset}
            style={{ padding: "0.75rem 1.5rem", backgroundColor: "#6366f1", color: "white", borderRadius: "0.75rem", border: "none", cursor: "pointer", fontSize: "0.875rem", fontWeight: 500 }}
          >
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  );
}
