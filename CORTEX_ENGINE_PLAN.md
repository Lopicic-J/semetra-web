# Semetra Cortex Engine — Masterplan

> Der Cortex ist die Grosshirnrinde von Semetra. Er verbindet alle bestehenden Engines zu einem intelligenten, selbstkorrigierenden System, das proaktiv handelt statt nur zu reagieren.

---

## Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CORTEX ENGINE                                     │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │  Layer 1      │  │  Layer 2      │  │  Layer 3      │                   │
│  │  INTEGRITY    │  │  INTELLIGENCE │  │  FEEDBACK     │                   │
│  │  MONITOR      │  │  ORCHESTRATOR │  │  LOOP         │                   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                   │
│         │                  │                  │                           │
│         ▼                  ▼                  ▼                           │
│  Engine-Health      Proaktive KI       Lern-Adaptation                   │
│  Data-Konsistenz    Cross-Engine       Empfehlungs-                      │
│  Auto-Reparatur     Insights           Optimierung                       │
└─────────────────────────────────────────────────────────────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    BESTEHENDE ENGINES                                      │
│                                                                           │
│  Decision    Schedule    Academic    Timer    Learning DNA    Streaks      │
│  Engine      Engine      Engine      Engine   Analyzer        Intelligence │
│                                                                           │
│  Pattern     Rescheduler  Weekly    Decision   Grade     Daily Nudge      │
│  Analyzer                 Review    Bridge     Bridge    Engine            │
└──────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    DATENQUELLEN (Supabase)                                 │
│  modules | grades | exams | tasks | timer_sessions | time_logs |          │
│  flashcards | topics | enrollments | study_patterns | dna_snapshots       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Sprint-Plan

### Sprint C1 — Cortex Foundation & Integrity Monitor
**Ziel**: Engine-Gesundheit überwachen, Datenkonsistenz sicherstellen, Auto-Reparatur

#### C1.1 — Cortex Core (`src/lib/cortex/core.ts`)
- `CortexState`-Interface definieren (Gesundheit aller Engines)
- `runCortexCycle()` — Hauptfunktion die alle Checks durchläuft
- Zeitstempel-basiertes Staleness-Tracking pro Engine
- Severity-Levels: `healthy | stale | degraded | critical`

```typescript
interface CortexState {
  timestamp: string;
  overallHealth: "healthy" | "degraded" | "critical";
  engines: {
    decision:    EngineHealth;
    schedule:    EngineHealth;
    academic:    EngineHealth;
    dna:         EngineHealth;
    streaks:     EngineHealth;
    patterns:    EngineHealth;
  };
  dataIntegrity: IntegrityReport;
  recommendations: CortexAction[];
}

interface EngineHealth {
  status: "healthy" | "stale" | "degraded" | "critical";
  lastComputed: string | null;
  staleSince: string | null;
  dataAge: number; // Sekunden seit letzter Aktualisierung
  issues: string[];
}
```

#### C1.2 — Integrity Monitor (`src/lib/cortex/integrity.ts`)
Prüft bei jedem Cortex-Zyklus:

| Check | Was wird geprüft | Auto-Reparatur |
|-------|-------------------|----------------|
| DNA Freshness | Letzter Snapshot > 7 Tage? | Trigger Neuberechnung |
| Grade Bridge Sync | `grades` ↔ `enrollments.current_final_grade` Abweichung? | Re-sync via Grade Bridge |
| Timer Orphans | `timer_sessions` mit status=active > 4h? | Auto-abandon |
| Schedule Conflicts | Überlappende Blöcke? | Loggen + Warnung |
| Task Staleness | Überfällige Tasks ohne Aktivität > 14 Tage? | Nudge generieren |
| Streak Continuity | Letzte Session > 24h + aktiver Streak? | Streak-Risk-Nudge |
| Pattern Currency | `study_patterns` > 3 Tage alt? | Neuberechnung anstossen |

```typescript
interface IntegrityReport {
  checksRun: number;
  issuesFound: number;
  autoRepaired: number;
  issues: IntegrityIssue[];
}

interface IntegrityIssue {
  code: string;
  severity: "info" | "warning" | "error" | "critical";
  engine: string;
  message: string;
  autoRepairable: boolean;
  repaired: boolean;
}
```

#### C1.3 — Cortex API Route (`src/app/api/cortex/route.ts`)
- `GET /api/cortex` — Voller Cortex-Zustand (für Dashboard)
- `POST /api/cortex/cycle` — Manueller Cortex-Zyklus + Auto-Reparatur
- `GET /api/cortex/health` — Kompakter Health-Check (für Monitoring)
- Caching: Ergebnis 5min cachen, stale-while-revalidate

#### C1.4 — Cortex Cron Job (`src/app/api/cortex/cron/route.ts`)
- Vercel Cron: Alle 15 Minuten ausführen
- Läuft `runCortexCycle()` im Hintergrund
- Schreibt Ergebnis in `cortex_snapshots`-Tabelle
- Generiert Notifications bei kritischen Issues

#### C1.5 — DB-Tabellen
```sql
-- Cortex Snapshots (History)
CREATE TABLE cortex_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  overall_health text NOT NULL,
  engines jsonb NOT NULL,
  integrity_report jsonb NOT NULL,
  recommendations jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- Cortex Actions Log (Was wurde automatisch repariert?)
CREATE TABLE cortex_actions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  action_type text NOT NULL,
  engine text NOT NULL,
  description text NOT NULL,
  auto_executed boolean DEFAULT false,
  result jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
```

---

### Sprint C2 — Intelligence Orchestrator
**Ziel**: Cross-Engine-Analyse, proaktive KI-Empfehlungen, intelligente Aktionen

#### C2.1 — Cross-Engine Analyzer (`src/lib/cortex/analyzer.ts`)
Insights die kein einzelner Engine allein erkennen kann:

```typescript
interface CrossEngineInsight {
  id: string;
  type: InsightType;
  severity: "info" | "attention" | "warning" | "critical";
  title: string;
  description: string;
  evidence: Evidence[];     // Daten aus mehreren Engines
  suggestion: string;       // Konkrete Handlungsempfehlung
  actionHref?: string;      // Link zur relevanten Seite
  engines: string[];        // Welche Engines beteiligt
}

type InsightType =
  | "planning_execution_gap"    // Hoher Planning-Score + tiefer Consistency-Score
  | "burnout_risk"              // Hohe Endurance + sinkender Focus + viele Sessions
  | "exam_underprep"            // Prüfung < 14 Tage + < 50% Lernzeit-Ziel
  | "module_neglect"            // Modul ohne Aktivität > 21 Tage + kommende Prüfung
  | "grade_trajectory_alert"    // Notentrend fällt unter Bestehensgrenze
  | "optimal_time_unused"       // Beste Lernstunden (Pattern) nie genutzt
  | "streak_momentum"           // Streak + steigende Focus = positive Verstärkung
  | "knowledge_decay"           // Flashcard-SR: viele überfällige Reviews
  | "schedule_overload"         // > 80% Zeitslots gefüllt + sinkende Energie
  | "quick_win_available";      // Aufgabe < 15min + hohe Priorität
```

**Analyse-Logik pro Insight:**

1. **Planning-Execution Gap**: DNA.planning > 70 && DNA.consistency < 40 → "Du planst super, aber hältst dich nicht dran. Versuche kürzere, realistischere Blöcke."

2. **Burnout Risk**: sessions_last_7d > 25 && avg_focus_rating sinkend && energy_level < 3 → "Dein Lernpensum ist hoch, aber deine Energie sinkt. Gönn dir morgen eine Pause."

3. **Exam Underprep**: exam_days_remaining < 14 && study_hours_for_module < 50% target → "Für [Modul] hast du erst X von Y Stunden gelernt. Prüfung in Z Tagen."

4. **Knowledge Decay**: overdue_flashcards > 50 && last_review > 7 Tage → "Du hast 67 überfällige Karteikarten. 15min Review heute sichert dein Wissen."

5. **Optimal Time Unused**: pattern.bestHours = [9-11] && schedule hat freie Slots [9-11] aber keine Blöcke → "Deine produktivsten Stunden (9-11 Uhr) sind frei. Soll ich einen Lernblock einplanen?"

#### C2.2 — Proactive Action Generator (`src/lib/cortex/actions.ts`)
Verwandelt Insights in konkrete, ausführbare Aktionen:

```typescript
interface CortexAction {
  id: string;
  type: ActionType;
  priority: number;        // 0-100
  title: string;
  description: string;
  autoExecutable: boolean; // Kann der Cortex das selbst machen?
  executeFn?: string;      // API-Endpoint für Auto-Execution
  payload?: Record<string, unknown>;
  expiresAt: string;       // Wann ist die Aktion nicht mehr relevant?
  sourceInsight: string;   // Referenz zum Insight
}

type ActionType =
  | "create_study_block"       // Lernblock vorschlagen/erstellen
  | "reschedule_block"         // Verpassten Block verschieben
  | "trigger_flashcard_review" // SR-Review anstossen
  | "adjust_study_target"      // Lernziel anpassen (realistischer)
  | "recompute_dna"            // DNA neu berechnen
  | "sync_grades"              // Grade Bridge triggern
  | "send_nudge"               // Personalisierte Benachrichtigung
  | "suggest_break"            // Pause empfehlen
  | "prioritize_module"        // Modul-Priorität im Decision Engine anpassen
  | "generate_exam_plan";      // Prüfungsplan erstellen
```

#### C2.3 — AI Context Enrichment (`src/lib/cortex/ai-context.ts`)
Erweitert den bestehenden `buildAIContext()` im Decision Engine:

```typescript
function buildCortexAIContext(
  cortexState: CortexState,
  insights: CrossEngineInsight[],
  moduleId?: string
): string {
  // Bestehender Decision Context
  // + Cortex Health Summary
  // + Top 3 Insights mit Evidenz
  // + Aktive Aktionen
  // + Personalisierte Empfehlungen basierend auf DNA
  // → Wird in jeden AI-Chat injiziert
}
```

#### C2.4 — Cortex Dashboard Widget (`src/components/cortex/CortexWidget.tsx`)
Kompaktes Widget für das Dashboard:
- Gesundheitsampel (grün/gelb/rot) pro Engine
- Top 3 Insights mit Action-Buttons
- "Cortex sagt:" — Tagesempfehlung in natürlicher Sprache
- Expandierbar für detaillierten Health-Report

#### C2.5 — Cortex Insights API (`src/app/api/cortex/insights/route.ts`)
- `GET /api/cortex/insights` — Aktuelle Insights (max 10, priorisiert)
- `POST /api/cortex/insights/:id/dismiss` — Insight verwerfen
- `POST /api/cortex/insights/:id/execute` — Vorgeschlagene Aktion ausführen

---

### Sprint C3 — Feedback Loop & Adaptive Learning
**Ziel**: Aus Benutzerverhalten lernen, Empfehlungen verbessern, Kreislauf schliessen

#### C3.1 — Recommendation Tracker (`src/lib/cortex/feedback.ts`)
Trackt ob Cortex-Empfehlungen befolgt und erfolgreich waren:

```typescript
interface RecommendationOutcome {
  recommendationId: string;
  type: ActionType;
  presented: boolean;       // Wurde dem User angezeigt?
  dismissed: boolean;       // Wurde verworfen?
  executed: boolean;        // Wurde ausgeführt?
  executedAt: string | null;
  outcomePositive: boolean | null;  // Hat es geholfen?
  feedbackScore: number | null;     // User-Feedback (1-5)
}
```

#### C3.2 — Adaptive Weight System (`src/lib/cortex/weights.ts`)
Passt die Gewichtungen der Engines dynamisch an:

```typescript
interface CortexWeights {
  userId: string;
  // Wie stark beeinflusst jeder Engine die Gesamtempfehlung?
  decisionWeight: number;   // Default: 0.25
  scheduleWeight: number;   // Default: 0.20
  dnaWeight: number;        // Default: 0.20
  patternWeight: number;    // Default: 0.15
  streakWeight: number;     // Default: 0.10
  academicWeight: number;   // Default: 0.10
  // Angepasst basierend auf:
  // - Welche Insights werden befolgt vs verworfen?
  // - Welche Engines liefern die besten Vorhersagen?
  lastAdjusted: string;
}
```

**Beispiel**: Wenn ein Student Pattern-basierte Empfehlungen (optimale Lernzeiten) konsequent befolgt und seine Noten steigen, erhöht der Cortex `patternWeight`. Wenn DNA-basierte Empfehlungen ignoriert werden, sinkt `dnaWeight`.

#### C3.3 — Learning Curve Tracker (`src/lib/cortex/learning-curve.ts`)
Berechnet pro Modul eine individuelle Lernkurve:

```typescript
interface ModuleLearningCurve {
  moduleId: string;
  dataPoints: Array<{
    date: string;
    knowledgeEstimate: number;  // 0-100
    source: "flashcard_review" | "exam_result" | "time_spent" | "self_assessment";
  }>;
  currentKnowledge: number;
  projectedExamKnowledge: number;  // Bei aktuellem Tempo
  requiredDailyMinutes: number;    // Um Ziel zu erreichen
  forgettingRate: number;          // Wie schnell vergisst dieser Student dieses Fach?
  optimalReviewInterval: number;   // Tage
}
```

#### C3.4 — Cortex Weekly Digest (`src/lib/cortex/digest.ts`)
Wöchentlicher Bericht der Cortex-Aktivität:
- Was hat der Cortex diese Woche entdeckt?
- Welche Reparaturen wurden durchgeführt?
- Welche Empfehlungen wurden befolgt?
- Wie hat sich die Gesundheit verändert?
- Vorhersage für nächste Woche

#### C3.5 — DB-Tabellen für Feedback Loop
```sql
-- Recommendation Tracking
CREATE TABLE cortex_recommendations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  insight_type text NOT NULL,
  action_type text NOT NULL,
  title text NOT NULL,
  presented_at timestamptz DEFAULT now(),
  dismissed_at timestamptz,
  executed_at timestamptz,
  outcome_positive boolean,
  feedback_score smallint CHECK (feedback_score BETWEEN 1 AND 5),
  metadata jsonb DEFAULT '{}'
);

-- Adaptive Weights (per User)
CREATE TABLE cortex_weights (
  user_id uuid REFERENCES auth.users PRIMARY KEY,
  weights jsonb NOT NULL DEFAULT '{"decision":0.25,"schedule":0.20,"dna":0.20,"pattern":0.15,"streak":0.10,"academic":0.10}',
  adjustment_history jsonb DEFAULT '[]',
  updated_at timestamptz DEFAULT now()
);

-- Module Learning Curves
CREATE TABLE module_learning_curves (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  module_id uuid REFERENCES modules NOT NULL,
  data_points jsonb NOT NULL DEFAULT '[]',
  current_knowledge numeric DEFAULT 0,
  forgetting_rate numeric DEFAULT 0.1,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, module_id)
);
```

---

## Datei-Struktur

```
src/lib/cortex/
├── core.ts              # CortexState, runCortexCycle()
├── integrity.ts         # Integrity Monitor (7 Checks)
├── analyzer.ts          # Cross-Engine Analyzer (10 Insight-Typen)
├── actions.ts           # Proactive Action Generator
├── ai-context.ts        # AI Context Enrichment
├── feedback.ts          # Recommendation Tracker
├── weights.ts           # Adaptive Weight System
├── learning-curve.ts    # Per-Module Lernkurven
├── digest.ts            # Weekly Cortex Digest
└── types.ts             # Alle Cortex-Typen

src/app/api/cortex/
├── route.ts             # GET state, POST cycle
├── health/route.ts      # Kompakter Health-Check
├── insights/route.ts    # GET/POST Insights
├── cron/route.ts        # 15min Cron Job
└── digest/route.ts      # Weekly Digest

src/components/cortex/
├── CortexWidget.tsx     # Dashboard Widget
├── HealthIndicator.tsx  # Ampel-Komponente
├── InsightCard.tsx      # Einzelner Insight mit Action
└── CortexDigest.tsx     # Wochenübersicht
```

---

## Abhängigkeiten von bestehenden Engines

| Cortex-Funktion | Liest von | Schreibt an |
|-----------------|-----------|-------------|
| Integrity: DNA Check | `learning_dna_snapshots` | POST `/api/learning-dna` |
| Integrity: Grade Sync | `grades`, `enrollments` | Grade Bridge `syncGradeToEngine()` |
| Integrity: Timer Orphans | `timer_sessions` | PATCH `/api/timer-sessions` |
| Integrity: Pattern Freshness | `study_patterns` | Pattern Analyzer |
| Analyzer: Planning Gap | DNA Profile + Schedule Stats | — |
| Analyzer: Burnout Risk | Timer Sessions + DNA + Focus | Nudge generieren |
| Analyzer: Exam Underprep | Exams + Time Logs + Decision | Lernplan vorschlagen |
| Analyzer: Knowledge Decay | Flashcards (overdue) | Nudge generieren |
| Actions: Create Block | Schedule Engine Free Slots | POST `/api/schedule` |
| Actions: Reschedule | Rescheduler | POST `/api/schedule/reschedule` |
| Actions: Adjust Target | Decision Engine Priorities | PATCH module settings |
| Feedback: Track Outcome | `cortex_recommendations` | `cortex_weights` |
| Learning Curve | Flashcards + Grades + Time | `module_learning_curves` |

---

## Reihenfolge & Aufwand

| Sprint | Beschreibung | Dateien | Geschätzter Aufwand |
|--------|-------------|---------|---------------------|
| **C1** | Foundation & Integrity | 5 Dateien + 2 DB-Tabellen | Mittel |
| **C2** | Intelligence & Insights | 5 Dateien + 3 Komponenten | Gross |
| **C3** | Feedback Loop & Adaptation | 4 Dateien + 3 DB-Tabellen | Mittel |

**Empfohlene Reihenfolge**: C1 → C2 → C3 (strikt sequenziell, jeder Sprint baut auf dem vorherigen auf)

---

## Erfolgskriterien

Nach Abschluss aller 3 Sprints sollte der Cortex:

1. **Integrity**: Automatisch erkennen wenn ein Engine veraltete Daten hat und Neuberechnung anstossen
2. **Cross-Engine**: Insights generieren die kein einzelner Engine allein sehen kann (z.B. "Du planst gut aber hältst dich nicht dran")
3. **Proaktiv**: Konkrete Aktionen vorschlagen und (mit User-Bestätigung) ausführen
4. **Adaptiv**: Aus Benutzerverhalten lernen und Empfehlungen verbessern
5. **Transparent**: Dem User zeigen was der Cortex tut und warum
6. **Nicht-invasiv**: Der Cortex schlägt vor, zwingt aber nichts auf. Jede automatische Aktion kann deaktiviert werden.
