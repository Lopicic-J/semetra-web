/**
 * KI-Request Gewichtung & Token-Limits
 *
 * Nicht jeder Request kostet gleich viel. Ein kurzer Chat = 1 Credit,
 * eine PDF-Analyse = 5–10 Credits. Das schützt unsere API-Kosten und
 * gibt den Usern ein faires Modell.
 *
 * Token-Limits verhindern, dass einzelne Requests unverhältnismässig
 * viel kosten (z.B. jemand schickt ein 50-seitiges PDF).
 */

export type AiActionType =
  | "chat_short"          // Kurze Antwort, einfache Frage
  | "chat_explain"        // Ausführliche Erklärung
  | "math_solve"          // Gleichung lösen
  | "flashcards_generate" // Karteikarten aus Text generieren
  | "notes_summarize"     // Notizen zusammenfassen
  | "pdf_analyze";        // PDF analysieren (teuerste Aktion)

/* ─── Gewichtung: Wie viele Credits kostet ein Request? ─── */
export const AI_WEIGHTS: Record<AiActionType, number> = {
  chat_short:          1,
  chat_explain:        2,
  math_solve:          1,
  flashcards_generate: 3,
  notes_summarize:     3,
  pdf_analyze:         5,
} as const;

/* ─── Token-Limits pro Aktion ─── */
export const AI_TOKEN_LIMITS: Record<AiActionType, { maxInput: number; maxOutput: number }> = {
  chat_short:          { maxInput: 2000,  maxOutput: 800  },
  chat_explain:        { maxInput: 3000,  maxOutput: 1500 },
  math_solve:          { maxInput: 2000,  maxOutput: 1500 },
  flashcards_generate: { maxInput: 12000, maxOutput: 4000 },  // Braucht mehr weil Text-Input lang
  notes_summarize:     { maxInput: 8000,  maxOutput: 2000 },
  pdf_analyze:         { maxInput: 15000, maxOutput: 3000 },
} as const;

/* ─── Globale Defaults (Fallback) ─── */
export const AI_DEFAULT_LIMITS = {
  maxInput: 3000,
  maxOutput: 1500,
} as const;

/**
 * Bestimme den Action-Type für Chat basierend auf der Nachricht.
 * Kurze Fragen (< 100 Zeichen) = chat_short (1 Credit)
 * Längere / "erkläre" = chat_explain (2 Credits)
 */
export function classifyChatAction(message: string): "chat_short" | "chat_explain" {
  const lower = message.toLowerCase();

  // Explizite Erklärung-Keywords
  const explainKeywords = [
    "erklär", "explain", "warum", "why", "wie funktioniert",
    "how does", "beschreib", "describe", "zusammenfass", "summarize",
    "vergleich", "compare", "analysier", "analyze", "ausführlich",
    "detail", "schritt für schritt", "step by step",
  ];

  if (explainKeywords.some(kw => lower.includes(kw))) {
    return "chat_explain";
  }

  // Kurze Nachrichten = short
  if (message.length < 120) {
    return "chat_short";
  }

  return "chat_explain";
}

/**
 * Token-Zählung approximieren (für Input-Truncation).
 * ~4 Zeichen ≈ 1 Token (grobe Schätzung für Deutsch/Englisch)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Text auf max Token-Limit kürzen.
 */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n[... gekürzt]";
}
