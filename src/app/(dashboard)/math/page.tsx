"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Module, MathHistory, MathFormula, MathTool, FormulaCategory } from "@/types/database";

/* ─── Constants ───────────────────────────────────────────────────────────── */

const TOOLS: { key: MathTool; label: string; icon: string; desc: string }[] = [
  { key: "calculator",  label: "Taschenrechner",   icon: "🧮", desc: "Wissenschaftlicher Rechner" },
  { key: "equations",   label: "Gleichungen",       icon: "⚖️", desc: "Löser & Umsteller" },
  { key: "matrices",    label: "Matrizen",          icon: "📐", desc: "Matrizen-Rechner" },
  { key: "plotter",     label: "Plotter",           icon: "📈", desc: "Funktions-Graphen" },
  { key: "statistics",  label: "Statistik",         icon: "📊", desc: "Analyse-Werkzeug" },
  { key: "units",       label: "Einheiten",         icon: "🔄", desc: "Umrechner & Konstanten" },
  { key: "formulas",    label: "Formeln",           icon: "📋", desc: "Formel-Sammlung" },
];

const FORMULA_CATEGORIES: { key: FormulaCategory; label: string }[] = [
  { key: "allgemein",       label: "Allgemein" },
  { key: "analysis",        label: "Analysis" },
  { key: "lineare_algebra", label: "Lineare Algebra" },
  { key: "statistik",       label: "Statistik" },
  { key: "trigonometrie",   label: "Trigonometrie" },
  { key: "physik",          label: "Physik" },
  { key: "finanzen",        label: "Finanzen" },
  { key: "informatik",      label: "Informatik" },
];

const CALC_BUTTONS = [
  ["C", "(", ")", "⌫"],
  ["sin", "cos", "tan", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "−"],
  ["1", "2", "3", "+"],
  ["0", ".", "π", "="],
  ["√", "^", "ln", "log"],
  ["e", "!", "%", "abs"],
];

const CONSTANTS: { name: string; symbol: string; value: string; unit: string }[] = [
  { name: "Lichtgeschwindigkeit", symbol: "c", value: "299 792 458", unit: "m/s" },
  { name: "Gravitationskonstante", symbol: "G", value: "6.674 × 10⁻¹¹", unit: "m³/(kg·s²)" },
  { name: "Planck-Konstante", symbol: "h", value: "6.626 × 10⁻³⁴", unit: "J·s" },
  { name: "Boltzmann-Konstante", symbol: "k_B", value: "1.381 × 10⁻²³", unit: "J/K" },
  { name: "Elementarladung", symbol: "e", value: "1.602 × 10⁻¹⁹", unit: "C" },
  { name: "Avogadro-Konstante", symbol: "N_A", value: "6.022 × 10²³", unit: "1/mol" },
  { name: "Gaskonstante", symbol: "R", value: "8.314", unit: "J/(mol·K)" },
  { name: "Vakuum-Permittivität", symbol: "ε₀", value: "8.854 × 10⁻¹²", unit: "F/m" },
  { name: "Euler-Zahl", symbol: "e", value: "2.71828 18284", unit: "" },
  { name: "Pi", symbol: "π", value: "3.14159 26535", unit: "" },
  { name: "Goldener Schnitt", symbol: "φ", value: "1.61803 39887", unit: "" },
  { name: "Erdbeschleunigung", symbol: "g", value: "9.80665", unit: "m/s²" },
];

const UNIT_GROUPS: { label: string; units: { name: string; factor: number; symbol: string }[] }[] = [
  {
    label: "Länge",
    units: [
      { name: "Meter", factor: 1, symbol: "m" },
      { name: "Kilometer", factor: 1000, symbol: "km" },
      { name: "Zentimeter", factor: 0.01, symbol: "cm" },
      { name: "Millimeter", factor: 0.001, symbol: "mm" },
      { name: "Meile", factor: 1609.344, symbol: "mi" },
      { name: "Fuss", factor: 0.3048, symbol: "ft" },
      { name: "Zoll", factor: 0.0254, symbol: "in" },
    ],
  },
  {
    label: "Gewicht",
    units: [
      { name: "Kilogramm", factor: 1, symbol: "kg" },
      { name: "Gramm", factor: 0.001, symbol: "g" },
      { name: "Milligramm", factor: 0.000001, symbol: "mg" },
      { name: "Tonne", factor: 1000, symbol: "t" },
      { name: "Pfund", factor: 0.453592, symbol: "lb" },
      { name: "Unze", factor: 0.0283495, symbol: "oz" },
    ],
  },
  {
    label: "Temperatur",
    units: [
      { name: "Celsius", factor: 1, symbol: "°C" },
      { name: "Fahrenheit", factor: 1, symbol: "°F" },
      { name: "Kelvin", factor: 1, symbol: "K" },
    ],
  },
  {
    label: "Fläche",
    units: [
      { name: "Quadratmeter", factor: 1, symbol: "m²" },
      { name: "Quadratkilometer", factor: 1e6, symbol: "km²" },
      { name: "Hektar", factor: 1e4, symbol: "ha" },
      { name: "Quadratzentimeter", factor: 1e-4, symbol: "cm²" },
      { name: "Ar", factor: 100, symbol: "a" },
    ],
  },
  {
    label: "Volumen",
    units: [
      { name: "Liter", factor: 1, symbol: "L" },
      { name: "Milliliter", factor: 0.001, symbol: "mL" },
      { name: "Kubikmeter", factor: 1000, symbol: "m³" },
      { name: "Gallone (US)", factor: 3.78541, symbol: "gal" },
    ],
  },
  {
    label: "Zeit",
    units: [
      { name: "Sekunde", factor: 1, symbol: "s" },
      { name: "Minute", factor: 60, symbol: "min" },
      { name: "Stunde", factor: 3600, symbol: "h" },
      { name: "Tag", factor: 86400, symbol: "d" },
      { name: "Woche", factor: 604800, symbol: "w" },
    ],
  },
];

const BUILTIN_FORMULAS: { title: string; formula: string; category: FormulaCategory; description: string }[] = [
  // Analysis
  { title: "Ableitungsregel (Potenz)", formula: "f(x) = xⁿ  →  f'(x) = n·xⁿ⁻¹", category: "analysis", description: "Potenzregel für Ableitungen" },
  { title: "Kettenregel", formula: "(f∘g)'(x) = f'(g(x)) · g'(x)", category: "analysis", description: "Ableitung verketteter Funktionen" },
  { title: "Produktregel", formula: "(f·g)' = f'·g + f·g'", category: "analysis", description: "Ableitung eines Produkts" },
  { title: "Quotientenregel", formula: "(f/g)' = (f'·g − f·g') / g²", category: "analysis", description: "Ableitung eines Quotienten" },
  { title: "Integral (Potenz)", formula: "∫ xⁿ dx = xⁿ⁺¹/(n+1) + C", category: "analysis", description: "Stammfunktion der Potenzfunktion" },
  { title: "Partielle Integration", formula: "∫ u·v' dx = u·v − ∫ u'·v dx", category: "analysis", description: "" },
  // Lineare Algebra
  { title: "Determinante 2×2", formula: "det(A) = a·d − b·c", category: "lineare_algebra", description: "Für Matrix [[a,b],[c,d]]" },
  { title: "Kreuzprodukt", formula: "a × b = |a|·|b|·sin(θ)·n̂", category: "lineare_algebra", description: "Vektorprodukt" },
  { title: "Skalarprodukt", formula: "a · b = |a|·|b|·cos(θ)", category: "lineare_algebra", description: "Inneres Produkt" },
  { title: "Inverse 2×2", formula: "A⁻¹ = (1/det(A))·[[d,−b],[−c,a]]", category: "lineare_algebra", description: "" },
  // Trigonometrie
  { title: "Sinus-Satz", formula: "a/sin(A) = b/sin(B) = c/sin(C)", category: "trigonometrie", description: "" },
  { title: "Kosinus-Satz", formula: "c² = a² + b² − 2ab·cos(C)", category: "trigonometrie", description: "" },
  { title: "Pythagoras", formula: "a² + b² = c²", category: "trigonometrie", description: "Rechtwinkliges Dreieck" },
  { title: "sin² + cos² = 1", formula: "sin²(x) + cos²(x) = 1", category: "trigonometrie", description: "Trigonometrische Identität" },
  // Statistik
  { title: "Mittelwert", formula: "x̄ = (1/n) · Σxᵢ", category: "statistik", description: "Arithmetisches Mittel" },
  { title: "Standardabweichung", formula: "σ = √[(1/n)·Σ(xᵢ − x̄)²]", category: "statistik", description: "Population" },
  { title: "Varianz", formula: "σ² = (1/n)·Σ(xᵢ − x̄)²", category: "statistik", description: "" },
  { title: "Normalverteilung", formula: "f(x) = (1/(σ√(2π)))·e^(−(x−μ)²/(2σ²))", category: "statistik", description: "Gauss-Verteilung" },
  // Physik
  { title: "Kraft (Newton)", formula: "F = m · a", category: "physik", description: "Kraft = Masse × Beschleunigung" },
  { title: "Kinetische Energie", formula: "E_kin = ½·m·v²", category: "physik", description: "" },
  { title: "Potenzielle Energie", formula: "E_pot = m·g·h", category: "physik", description: "" },
  { title: "Ohmsches Gesetz", formula: "U = R · I", category: "physik", description: "Spannung = Widerstand × Strom" },
  // Finanzen
  { title: "Zinseszins", formula: "K_n = K₀ · (1 + p/100)ⁿ", category: "finanzen", description: "Kapital nach n Perioden" },
  { title: "Barwert", formula: "BW = K_n / (1 + i)ⁿ", category: "finanzen", description: "Abgezinster Wert" },
  // Informatik
  { title: "Big-O Notation", formula: "O(1) < O(log n) < O(n) < O(n log n) < O(n²)", category: "informatik", description: "Laufzeitkomplexität" },
  { title: "Binär → Dezimal", formula: "Σ bᵢ · 2ⁱ", category: "informatik", description: "Zahlensystem-Umrechnung" },
];

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function safeEval(expr: string): string {
  try {
    let e = expr
      .replace(/π/g, `(${Math.PI})`)
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/−/g, "-")
      .replace(/√\(([^)]+)\)/g, "Math.sqrt($1)")
      .replace(/√(\d+)/g, "Math.sqrt($1)")
      .replace(/sin\(/g, "Math.sin(")
      .replace(/cos\(/g, "Math.cos(")
      .replace(/tan\(/g, "Math.tan(")
      .replace(/asin\(/g, "Math.asin(")
      .replace(/acos\(/g, "Math.acos(")
      .replace(/atan\(/g, "Math.atan(")
      .replace(/ln\(/g, "Math.log(")
      .replace(/log\(/g, "Math.log10(")
      .replace(/abs\(/g, "Math.abs(")
      .replace(/(\d+)!/g, (_m, n) => {
        let f = 1;
        for (let i = 2; i <= Number(n); i++) f *= i;
        return String(f);
      })
      .replace(/\^/g, "**")
      .replace(/e(?!\w)/g, `(${Math.E})`);
    // safety: only allow math
    if (/[a-zA-Z_$]/.test(e.replace(/Math\.\w+/g, "").replace(/Infinity|NaN/g, ""))) {
      return "Fehler: Ungültiger Ausdruck";
    }
    const result = Function(`"use strict"; return (${e})`)();
    if (typeof result === "number") {
      if (Number.isNaN(result)) return "NaN";
      if (!Number.isFinite(result)) return "∞";
      return Number.isInteger(result) ? String(result) : result.toPrecision(10).replace(/\.?0+$/, "");
    }
    return String(result);
  } catch {
    return "Fehler";
  }
}

function solveLinear(a: number, b: number): string {
  if (a === 0) return b === 0 ? "Unendlich viele Lösungen" : "Keine Lösung";
  return `x = ${(-b / a).toPrecision(10).replace(/\.?0+$/, "")}`;
}

function solveQuadratic(a: number, b: number, c: number): string {
  if (a === 0) return solveLinear(b, c);
  const disc = b * b - 4 * a * c;
  if (disc < 0) {
    const re = (-b / (2 * a)).toPrecision(6).replace(/\.?0+$/, "");
    const im = (Math.sqrt(-disc) / (2 * a)).toPrecision(6).replace(/\.?0+$/, "");
    return `x₁ = ${re} + ${im}i\nx₂ = ${re} − ${im}i`;
  }
  const x1 = (-b + Math.sqrt(disc)) / (2 * a);
  const x2 = (-b - Math.sqrt(disc)) / (2 * a);
  const f = (n: number) => n.toPrecision(10).replace(/\.?0+$/, "");
  if (disc === 0) return `x = ${f(x1)} (Doppelte Nullstelle)`;
  return `x₁ = ${f(x1)}\nx₂ = ${f(x2)}`;
}

function solveSystem2(a1: number, b1: number, c1: number, a2: number, b2: number, c2: number): string {
  const det = a1 * b2 - a2 * b1;
  if (det === 0) return "Keine eindeutige Lösung (det = 0)";
  const x = (c1 * b2 - c2 * b1) / det;
  const y = (a1 * c2 - a2 * c1) / det;
  const f = (n: number) => n.toPrecision(10).replace(/\.?0+$/, "");
  return `x = ${f(x)}\ny = ${f(y)}`;
}

function matDet(m: number[][]): number {
  const n = m.length;
  if (n === 1) return m[0][0];
  if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0];
  let d = 0;
  for (let j = 0; j < n; j++) {
    const sub = m.slice(1).map((r) => [...r.slice(0, j), ...r.slice(j + 1)]);
    d += (j % 2 === 0 ? 1 : -1) * m[0][j] * matDet(sub);
  }
  return d;
}

function matTranspose(m: number[][]): number[][] {
  return m[0].map((_, i) => m.map((r) => r[i]));
}

function matMultiply(a: number[][], b: number[][]): number[][] | null {
  if (a[0].length !== b.length) return null;
  return a.map((row) => b[0].map((_, j) => row.reduce((s, v, k) => s + v * b[k][j], 0)));
}

function matInverse2(m: number[][]): number[][] | null {
  const d = matDet(m);
  if (d === 0) return null;
  if (m.length === 2) {
    return [
      [m[1][1] / d, -m[0][1] / d],
      [-m[1][0] / d, m[0][0] / d],
    ];
  }
  // 3×3 inverse via cofactor
  const n = m.length;
  const cofactors: number[][] = [];
  for (let i = 0; i < n; i++) {
    cofactors[i] = [];
    for (let j = 0; j < n; j++) {
      const sub = m.filter((_, ri) => ri !== i).map((r) => r.filter((_, ci) => ci !== j));
      cofactors[i][j] = ((i + j) % 2 === 0 ? 1 : -1) * matDet(sub);
    }
  }
  const adj = matTranspose(cofactors);
  return adj.map((r) => r.map((v) => v / d));
}

function convertTemp(val: number, from: string, to: string): number {
  let celsius: number;
  if (from === "°C") celsius = val;
  else if (from === "°F") celsius = (val - 32) * (5 / 9);
  else celsius = val - 273.15; // K
  if (to === "°C") return celsius;
  if (to === "°F") return celsius * (9 / 5) + 32;
  return celsius + 273.15; // K
}

function numberToBase(num: number, base: number): string {
  if (!Number.isInteger(num)) return "Nur ganze Zahlen";
  return num.toString(base).toUpperCase();
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */

export default function MathPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [activeTool, setActiveTool] = useState<MathTool>("calculator");
  const [history, setHistory] = useState<MathHistory[]>([]);
  const [formulas, setFormulas] = useState<MathFormula[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  /* Auth + data */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        supabase.from("modules").select("*").eq("user_id", data.user.id).then(({ data: m }) => m && setModules(m));
        supabase.from("math_history").select("*").eq("user_id", data.user.id).order("created_at", { ascending: false }).limit(100).then(({ data: h }) => h && setHistory(h as MathHistory[]));
        supabase.from("math_formulas").select("*").eq("user_id", data.user.id).order("created_at", { ascending: false }).then(({ data: f }) => f && setFormulas(f as MathFormula[]));
      }
    });
  }, []);

  const saveToHistory = useCallback(async (tool: MathTool, expression: string, result: string, moduleId?: string | null) => {
    if (!userId) return;
    const entry: Partial<MathHistory> = { user_id: userId, tool, expression, result, module_id: moduleId || null };
    const { data } = await supabase.from("math_history").insert(entry).select().single();
    if (data) setHistory((prev) => [data as MathHistory, ...prev]);
  }, [userId, supabase]);

  const toolHistory = useMemo(() => history.filter((h) => h.tool === activeTool), [history, activeTool]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">🧮 Mathe-Raum</h1>
          <p className="text-zinc-400 text-sm mt-1">Dein wissenschaftlicher Arbeitsplatz für Mathematik</p>
        </div>
        <button onClick={() => setShowHistory(!showHistory)} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-sm flex items-center gap-2">
          📜 Verlauf {history.length > 0 && <span className="bg-violet-600 text-white text-xs rounded-full px-2">{history.length}</span>}
        </button>
      </div>

      {/* Tool Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {TOOLS.map((t) => (
          <button key={t.key} onClick={() => setActiveTool(t.key)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTool === t.key ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"}`}>
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* History Sidebar */}
      {showHistory && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <h3 className="text-white font-semibold mb-3">Berechnungsverlauf</h3>
          {history.length === 0 ? (
            <p className="text-zinc-500 text-sm">Noch keine Berechnungen gespeichert.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {history.slice(0, 30).map((h) => (
                <div key={h.id} className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <span className="text-xs text-violet-400 mr-2">{TOOLS.find((t) => t.key === h.tool)?.icon}</span>
                    <span className="text-zinc-300 text-sm font-mono truncate">{h.expression}</span>
                    <span className="text-zinc-500 mx-2">=</span>
                    <span className="text-emerald-400 text-sm font-mono">{h.result}</span>
                  </div>
                  <span className="text-zinc-600 text-xs ml-2 whitespace-nowrap">{new Date(h.created_at).toLocaleDateString("de-CH")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tool Content */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
        {activeTool === "calculator" && <CalculatorTool onSave={saveToHistory} modules={modules} />}
        {activeTool === "equations" && <EquationsTool onSave={saveToHistory} modules={modules} />}
        {activeTool === "matrices" && <MatricesTool onSave={saveToHistory} modules={modules} />}
        {activeTool === "plotter" && <PlotterTool onSave={saveToHistory} modules={modules} />}
        {activeTool === "statistics" && <StatisticsTool onSave={saveToHistory} modules={modules} />}
        {activeTool === "units" && <UnitsTool onSave={saveToHistory} modules={modules} />}
        {activeTool === "formulas" && <FormulasTool userId={userId} supabase={supabase} formulas={formulas} setFormulas={setFormulas} modules={modules} />}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* TOOL 1: Scientific Calculator                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

function CalculatorTool({ onSave, modules }: { onSave: (t: MathTool, e: string, r: string, m?: string | null) => void; modules: Module[] }) {
  const [display, setDisplay] = useState("");
  const [result, setResult] = useState("");
  const [angleMode, setAngleMode] = useState<"deg" | "rad">("deg");
  const [moduleId, setModuleId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleButton = (btn: string) => {
    if (btn === "C") { setDisplay(""); setResult(""); return; }
    if (btn === "⌫") { setDisplay((p) => p.slice(0, -1)); return; }
    if (btn === "=") {
      let expr = display;
      if (angleMode === "deg") {
        expr = expr.replace(/sin\(([^)]+)\)/g, `sin(($1)*${Math.PI}/180)`);
        expr = expr.replace(/cos\(([^)]+)\)/g, `cos(($1)*${Math.PI}/180)`);
        expr = expr.replace(/tan\(([^)]+)\)/g, `tan(($1)*${Math.PI}/180)`);
      }
      const r = safeEval(expr);
      setResult(r);
      onSave("calculator", display, r, moduleId);
      return;
    }
    const fnBtns = ["sin", "cos", "tan", "ln", "log", "abs", "√"];
    if (fnBtns.includes(btn)) {
      setDisplay((p) => p + (btn === "√" ? "√(" : btn + "("));
      return;
    }
    setDisplay((p) => p + btn);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Wissenschaftlicher Taschenrechner</h2>
        <div className="flex items-center gap-3">
          <select value={moduleId || ""} onChange={(e) => setModuleId(e.target.value || null)} className="bg-zinc-800 text-zinc-300 text-sm rounded-lg px-3 py-1.5 border border-zinc-700">
            <option value="">Kein Modul</option>
            {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button onClick={() => setAngleMode(angleMode === "deg" ? "rad" : "deg")} className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-sm border border-zinc-700 hover:bg-zinc-700">
            {angleMode === "deg" ? "DEG" : "RAD"}
          </button>
        </div>
      </div>

      {/* Display */}
      <div className="bg-zinc-950 rounded-xl p-4 mb-4 border border-zinc-800">
        <input ref={inputRef} value={display} onChange={(e) => setDisplay(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleButton("="); }} placeholder="Ausdruck eingeben..." className="w-full bg-transparent text-white text-xl font-mono outline-none text-right" />
        {result && <div className="text-right text-emerald-400 text-2xl font-mono mt-2 font-bold">= {result}</div>}
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-4 gap-2">
        {CALC_BUTTONS.flat().map((btn, i) => {
          const isOp = ["÷", "×", "−", "+", "="].includes(btn);
          const isFn = ["sin", "cos", "tan", "ln", "log", "√", "^", "!", "%", "abs", "e", "π"].includes(btn);
          const isClear = btn === "C" || btn === "⌫";
          return (
            <button key={i} onClick={() => handleButton(btn)} className={`py-3 rounded-lg font-mono text-base font-semibold transition-all hover:scale-105 ${btn === "=" ? "bg-violet-600 text-white hover:bg-violet-500" : isClear ? "bg-red-900 text-red-300 hover:bg-red-800" : isOp ? "bg-zinc-700 text-violet-300 hover:bg-zinc-600" : isFn ? "bg-zinc-800 text-blue-300 hover:bg-zinc-700" : "bg-zinc-800 text-white hover:bg-zinc-700"}`}>
              {btn}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* TOOL 2: Equation Solver                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

function EquationsTool({ onSave, modules }: { onSave: (t: MathTool, e: string, r: string, m?: string | null) => void; modules: Module[] }) {
  const [mode, setMode] = useState<"linear" | "quadratic" | "system" | "custom">("quadratic");
  const [a, setA] = useState("1");
  const [b, setB] = useState("0");
  const [c, setC] = useState("0");
  const [a2, setA2] = useState("0");
  const [b2, setB2] = useState("0");
  const [c2, setC2] = useState("0");
  const [customExpr, setCustomExpr] = useState("");
  const [customVar, setCustomVar] = useState("x");
  const [result, setResult] = useState("");
  const [moduleId, setModuleId] = useState<string | null>(null);

  const solve = () => {
    let expr = "", res = "";
    if (mode === "linear") {
      expr = `${a}x + ${b} = 0`;
      res = solveLinear(Number(a), Number(b));
    } else if (mode === "quadratic") {
      expr = `${a}x² + ${b}x + ${c} = 0`;
      res = solveQuadratic(Number(a), Number(b), Number(c));
    } else if (mode === "system") {
      expr = `${a}x + ${b}y = ${c}\n${a2}x + ${b2}y = ${c2}`;
      res = solveSystem2(Number(a), Number(b), Number(c), Number(a2), Number(b2), Number(c2));
    } else {
      expr = customExpr;
      // Simple variable isolation for ax + b = c pattern
      res = "Bitte verwende die Standard-Modi für exakte Lösungen";
      try {
        // Try numeric approximation via bisection for f(x) = 0
        const fn = customExpr.replace(/=/g, "-(") + ")";
        const evalFn = (x: number) => {
          const e = fn.replace(new RegExp(customVar, "g"), `(${x})`);
          return Number(safeEval(e));
        };
        // Simple Newton-like search
        let lo = -100, hi = 100;
        const fLo = evalFn(lo), fHi = evalFn(hi);
        if (fLo * fHi <= 0) {
          for (let i = 0; i < 100; i++) {
            const mid = (lo + hi) / 2;
            if (evalFn(mid) * evalFn(lo) <= 0) hi = mid; else lo = mid;
          }
          res = `${customVar} ≈ ${((lo + hi) / 2).toPrecision(8).replace(/\.?0+$/, "")}`;
        }
      } catch { /* keep default message */ }
    }
    setResult(res);
    onSave("equations", expr, res, moduleId);
  };

  const inputCls = "bg-zinc-800 text-white rounded-lg px-3 py-2 border border-zinc-700 text-center font-mono w-20";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Gleichungslöser & Umsteller</h2>
        <select value={moduleId || ""} onChange={(e) => setModuleId(e.target.value || null)} className="bg-zinc-800 text-zinc-300 text-sm rounded-lg px-3 py-1.5 border border-zinc-700">
          <option value="">Kein Modul</option>
          {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-2 mb-6">
        {([ ["linear", "Linear (ax+b=0)"], ["quadratic", "Quadratisch (ax²+bx+c=0)"], ["system", "Gleichungssystem (2×2)"], ["custom", "Benutzerdefiniert"] ] as [string, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setMode(k as typeof mode)} className={`px-3 py-1.5 rounded-lg text-sm ${mode === k ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>{l}</button>
        ))}
      </div>

      {/* Inputs */}
      <div className="bg-zinc-800 rounded-xl p-6 mb-4">
        {mode === "linear" && (
          <div className="flex items-center gap-2 justify-center text-lg text-white font-mono">
            <input value={a} onChange={(e) => setA(e.target.value)} className={inputCls} />
            <span>x +</span>
            <input value={b} onChange={(e) => setB(e.target.value)} className={inputCls} />
            <span>= 0</span>
          </div>
        )}
        {mode === "quadratic" && (
          <div className="flex items-center gap-2 justify-center text-lg text-white font-mono">
            <input value={a} onChange={(e) => setA(e.target.value)} className={inputCls} />
            <span>x² +</span>
            <input value={b} onChange={(e) => setB(e.target.value)} className={inputCls} />
            <span>x +</span>
            <input value={c} onChange={(e) => setC(e.target.value)} className={inputCls} />
            <span>= 0</span>
          </div>
        )}
        {mode === "system" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 justify-center text-lg text-white font-mono">
              <input value={a} onChange={(e) => setA(e.target.value)} className={inputCls} /><span>x +</span>
              <input value={b} onChange={(e) => setB(e.target.value)} className={inputCls} /><span>y =</span>
              <input value={c} onChange={(e) => setC(e.target.value)} className={inputCls} />
            </div>
            <div className="flex items-center gap-2 justify-center text-lg text-white font-mono">
              <input value={a2} onChange={(e) => setA2(e.target.value)} className={inputCls} /><span>x +</span>
              <input value={b2} onChange={(e) => setB2(e.target.value)} className={inputCls} /><span>y =</span>
              <input value={c2} onChange={(e) => setC2(e.target.value)} className={inputCls} />
            </div>
          </div>
        )}
        {mode === "custom" && (
          <div className="space-y-3">
            <input value={customExpr} onChange={(e) => setCustomExpr(e.target.value)} placeholder="z.B. 2*x^2 + 3*x - 5 = 0" className="w-full bg-zinc-900 text-white rounded-lg px-4 py-3 border border-zinc-700 font-mono" />
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span>Variable:</span>
              <input value={customVar} onChange={(e) => setCustomVar(e.target.value)} className="bg-zinc-900 text-white rounded px-2 py-1 border border-zinc-700 font-mono w-12 text-center" />
            </div>
          </div>
        )}
      </div>

      <button onClick={solve} className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500 transition-colors mb-4">Lösen</button>

      {result && (
        <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800">
          <div className="text-zinc-400 text-sm mb-1">Ergebnis:</div>
          <div className="text-emerald-400 text-xl font-mono whitespace-pre-line">{result}</div>
        </div>
      )}

      {/* Quick formulas */}
      <div className="mt-6">
        <h3 className="text-zinc-400 text-sm font-semibold mb-2">Schnell-Referenz</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["pq-Formel", "x = −p/2 ± √((p/2)² − q)"],
            ["abc-Formel", "x = (−b ± √(b²−4ac)) / 2a"],
            ["Vieta", "x₁+x₂ = −b/a,  x₁·x₂ = c/a"],
            ["Cramersche Regel", "x = det(Aₓ)/det(A)"],
          ].map(([t, f]) => (
            <div key={t} className="bg-zinc-800 rounded-lg px-3 py-2">
              <div className="text-zinc-400 text-xs">{t}</div>
              <div className="text-zinc-200 text-sm font-mono">{f}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* TOOL 3: Matrix Calculator                                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

function MatricesTool({ onSave, modules }: { onSave: (t: MathTool, e: string, r: string, m?: string | null) => void; modules: Module[] }) {
  const [size, setSize] = useState(3);
  const [matA, setMatA] = useState<number[][]>(Array.from({ length: 3 }, () => Array(3).fill(0)));
  const [matB, setMatB] = useState<number[][]>(Array.from({ length: 3 }, () => Array(3).fill(0)));
  const [result, setResult] = useState("");
  const [resultMatrix, setResultMatrix] = useState<number[][] | null>(null);
  const [operation, setOperation] = useState<string>("det");
  const [moduleId, setModuleId] = useState<string | null>(null);

  useEffect(() => {
    setMatA(Array.from({ length: size }, () => Array(size).fill(0)));
    setMatB(Array.from({ length: size }, () => Array(size).fill(0)));
    setResult("");
    setResultMatrix(null);
  }, [size]);

  const updateCell = (mat: "A" | "B", r: number, c: number, val: string) => {
    const setter = mat === "A" ? setMatA : setMatB;
    setter((prev) => {
      const copy = prev.map((row) => [...row]);
      copy[r][c] = Number(val) || 0;
      return copy;
    });
  };

  const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/\.?0+$/, "");

  const compute = () => {
    let expr = "", res = "";
    setResultMatrix(null);

    if (operation === "det") {
      const d = matDet(matA);
      expr = `det(A) [${size}×${size}]`;
      res = fmt(d);
      setResult(`Determinante = ${res}`);
    } else if (operation === "transpose") {
      const t = matTranspose(matA);
      expr = `Aᵀ [${size}×${size}]`;
      res = t.map((r) => r.map(fmt).join(", ")).join(" | ");
      setResultMatrix(t);
      setResult("Transponierte:");
    } else if (operation === "inverse") {
      const inv = matInverse2(matA);
      if (!inv) { setResult("Nicht invertierbar (det = 0)"); return; }
      expr = `A⁻¹ [${size}×${size}]`;
      res = inv.map((r) => r.map(fmt).join(", ")).join(" | ");
      setResultMatrix(inv);
      setResult("Inverse:");
    } else if (operation === "multiply") {
      const prod = matMultiply(matA, matB);
      if (!prod) { setResult("Fehler: Dimensionen passen nicht"); return; }
      expr = `A × B [${size}×${size}]`;
      res = prod.map((r) => r.map(fmt).join(", ")).join(" | ");
      setResultMatrix(prod);
      setResult("A × B =");
    } else if (operation === "add") {
      const sum = matA.map((r, i) => r.map((v, j) => v + matB[i][j]));
      expr = `A + B [${size}×${size}]`;
      res = sum.map((r) => r.map(fmt).join(", ")).join(" | ");
      setResultMatrix(sum);
      setResult("A + B =");
    } else if (operation === "eigenvalues") {
      if (size === 2) {
        const trace = matA[0][0] + matA[1][1];
        const det = matDet(matA);
        const disc = trace * trace - 4 * det;
        if (disc >= 0) {
          const l1 = (trace + Math.sqrt(disc)) / 2;
          const l2 = (trace - Math.sqrt(disc)) / 2;
          res = `λ₁ = ${fmt(l1)}, λ₂ = ${fmt(l2)}`;
        } else {
          const re = trace / 2;
          const im = Math.sqrt(-disc) / 2;
          res = `λ₁ = ${fmt(re)} + ${fmt(im)}i, λ₂ = ${fmt(re)} − ${fmt(im)}i`;
        }
        expr = `Eigenwerte [2×2]`;
        setResult(res);
      } else {
        setResult("Eigenwerte nur für 2×2 implementiert");
        return;
      }
    } else if (operation === "rank") {
      // Row echelon form to count rank
      const m = matA.map((r) => [...r]);
      let rank = 0;
      for (let col = 0; col < size; col++) {
        let pivotRow = -1;
        for (let row = rank; row < size; row++) {
          if (Math.abs(m[row][col]) > 1e-10) { pivotRow = row; break; }
        }
        if (pivotRow === -1) continue;
        [m[rank], m[pivotRow]] = [m[pivotRow], m[rank]];
        const scale = m[rank][col];
        for (let j = col; j < size; j++) m[rank][j] /= scale;
        for (let row = 0; row < size; row++) {
          if (row !== rank && Math.abs(m[row][col]) > 1e-10) {
            const f = m[row][col];
            for (let j = col; j < size; j++) m[row][j] -= f * m[rank][j];
          }
        }
        rank++;
      }
      expr = `Rang(A) [${size}×${size}]`;
      res = String(rank);
      setResult(`Rang = ${rank}`);
    }

    onSave("matrices", expr, res, moduleId);
  };

  const renderMatrix = (mat: number[][], setter: "A" | "B") => (
    <div className="inline-block">
      <div className="text-zinc-400 text-xs mb-1 text-center">Matrix {setter}</div>
      <div className="border-l-2 border-r-2 border-zinc-600 px-2 py-1">
        {mat.map((row, r) => (
          <div key={r} className="flex gap-1">
            {row.map((v, c) => (
              <input key={c} value={v || ""} onChange={(e) => updateCell(setter, r, c, e.target.value)} className="w-14 h-10 bg-zinc-800 text-white text-center rounded border border-zinc-700 font-mono text-sm" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Matrizen-Rechner</h2>
        <div className="flex items-center gap-3">
          <select value={moduleId || ""} onChange={(e) => setModuleId(e.target.value || null)} className="bg-zinc-800 text-zinc-300 text-sm rounded-lg px-3 py-1.5 border border-zinc-700">
            <option value="">Kein Modul</option>
            {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select value={size} onChange={(e) => setSize(Number(e.target.value))} className="bg-zinc-800 text-zinc-300 text-sm rounded-lg px-3 py-1.5 border border-zinc-700">
            <option value={2}>2×2</option>
            <option value={3}>3×3</option>
            <option value={4}>4×4</option>
          </select>
        </div>
      </div>

      {/* Operations */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          ["det", "Determinante"], ["transpose", "Transponierte"], ["inverse", "Inverse"], ["eigenvalues", "Eigenwerte"], ["rank", "Rang"], ["multiply", "A × B"], ["add", "A + B"],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setOperation(k)} className={`px-3 py-1.5 rounded-lg text-sm ${operation === k ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>{l}</button>
        ))}
      </div>

      {/* Matrix Inputs */}
      <div className="flex flex-wrap gap-6 justify-center mb-4">
        {renderMatrix(matA, "A")}
        {(operation === "multiply" || operation === "add") && renderMatrix(matB, "B")}
      </div>

      <button onClick={compute} className="w-full py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500 transition-colors mb-4">Berechnen</button>

      {result && (
        <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800">
          <div className="text-emerald-400 font-mono text-lg mb-2">{result}</div>
          {resultMatrix && (
            <div className="border-l-2 border-r-2 border-emerald-800 px-2 py-1 inline-block">
              {resultMatrix.map((row, r) => (
                <div key={r} className="flex gap-2">
                  {row.map((v, c) => (
                    <div key={c} className="w-16 h-10 flex items-center justify-center text-emerald-300 font-mono text-sm">{fmt(v)}</div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* TOOL 4: Function Plotter                                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

function PlotterTool({ onSave, modules }: { onSave: (t: MathTool, e: string, r: string, m?: string | null) => void; modules: Module[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [functions, setFunctions] = useState<{ expr: string; color: string }[]>([
    { expr: "sin(x)", color: "#8b5cf6" },
  ]);
  const [xMin, setXMin] = useState(-10);
  const [xMax, setXMax] = useState(10);
  const [yMin, setYMin] = useState(-5);
  const [yMax, setYMax] = useState(5);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);

  const COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

  const evalExpr = useCallback((expr: string, x: number): number => {
    const e = expr
      .replace(/\bx\b/g, `(${x})`)
      .replace(/π/g, `(${Math.PI})`)
      .replace(/\be\b/g, `(${Math.E})`)
      .replace(/sin\(/g, "Math.sin(")
      .replace(/cos\(/g, "Math.cos(")
      .replace(/tan\(/g, "Math.tan(")
      .replace(/sqrt\(/g, "Math.sqrt(")
      .replace(/abs\(/g, "Math.abs(")
      .replace(/ln\(/g, "Math.log(")
      .replace(/log\(/g, "Math.log10(")
      .replace(/\^/g, "**");
    try {
      return Function(`"use strict"; return (${e})`)();
    } catch {
      return NaN;
    }
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, W, H);

    // Grid
    const toScreen = (mx: number, my: number): [number, number] => [
      ((mx - xMin) / (xMax - xMin)) * W,
      H - ((my - yMin) / (yMax - yMin)) * H,
    ];

    // Grid lines
    ctx.strokeStyle = "#27272a";
    ctx.lineWidth = 1;
    const stepX = Math.pow(10, Math.floor(Math.log10(xMax - xMin)) - 1) * 2;
    const stepY = Math.pow(10, Math.floor(Math.log10(yMax - yMin)) - 1) * 2;
    for (let gx = Math.ceil(xMin / stepX) * stepX; gx <= xMax; gx += stepX) {
      const [sx] = toScreen(gx, 0);
      ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
    }
    for (let gy = Math.ceil(yMin / stepY) * stepY; gy <= yMax; gy += stepY) {
      const [, sy] = toScreen(0, gy);
      ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = "#52525b";
    ctx.lineWidth = 2;
    const [ox, oy] = toScreen(0, 0);
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(W, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, H); ctx.stroke();

    // Axis labels
    ctx.fillStyle = "#71717a";
    ctx.font = "11px monospace";
    for (let gx = Math.ceil(xMin / stepX) * stepX; gx <= xMax; gx += stepX) {
      if (Math.abs(gx) < 0.001) continue;
      const [sx] = toScreen(gx, 0);
      ctx.fillText(gx.toFixed(1).replace(/\.0$/, ""), sx - 8, oy + 14);
    }
    for (let gy = Math.ceil(yMin / stepY) * stepY; gy <= yMax; gy += stepY) {
      if (Math.abs(gy) < 0.001) continue;
      const [, sy] = toScreen(0, gy);
      ctx.fillText(gy.toFixed(1).replace(/\.0$/, ""), ox + 5, sy + 4);
    }

    // Functions
    functions.forEach((fn) => {
      if (!fn.expr.trim()) return;
      ctx.strokeStyle = fn.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      let started = false;
      for (let px = 0; px < W; px++) {
        const mx = xMin + (px / W) * (xMax - xMin);
        const my = evalExpr(fn.expr, mx);
        if (isNaN(my) || !isFinite(my)) { started = false; continue; }
        const [, sy] = toScreen(mx, my);
        if (!started) { ctx.moveTo(px, sy); started = true; } else { ctx.lineTo(px, sy); }
      }
      ctx.stroke();
    });

    // Crosshair
    if (mousePos) {
      ctx.strokeStyle = "#ffffff30";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(mousePos.x, 0); ctx.lineTo(mousePos.x, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, mousePos.y); ctx.lineTo(W, mousePos.y); ctx.stroke();
      ctx.setLineDash([]);
      const mx = xMin + (mousePos.x / W) * (xMax - xMin);
      const my = yMax - (mousePos.y / H) * (yMax - yMin);
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "12px monospace";
      ctx.fillText(`(${mx.toFixed(2)}, ${my.toFixed(2)})`, mousePos.x + 10, mousePos.y - 10);
    }
  }, [functions, xMin, xMax, yMin, yMax, mousePos, evalExpr]);

  useEffect(() => { draw(); }, [draw]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const addFunction = () => {
    setFunctions([...functions, { expr: "", color: COLORS[functions.length % COLORS.length] }]);
  };

  const savePlot = () => {
    const expr = functions.map((f) => f.expr).filter(Boolean).join(", ");
    onSave("plotter", `f(x) = ${expr}`, `[${xMin}, ${xMax}] × [${yMin}, ${yMax}]`, moduleId);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Funktions-Plotter</h2>
        <div className="flex items-center gap-2">
          <select value={moduleId || ""} onChange={(e) => setModuleId(e.target.value || null)} className="bg-zinc-800 text-zinc-300 text-sm rounded-lg px-3 py-1.5 border border-zinc-700">
            <option value="">Kein Modul</option>
            {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button onClick={savePlot} className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700">💾 Speichern</button>
        </div>
      </div>

      {/* Function inputs */}
      <div className="space-y-2 mb-4">
        {functions.map((fn, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: fn.color }} />
            <span className="text-zinc-400 text-sm font-mono">f{i > 0 ? i + 1 : ""}(x) =</span>
            <input value={fn.expr} onChange={(e) => { const copy = [...functions]; copy[i] = { ...copy[i], expr: e.target.value }; setFunctions(copy); }} placeholder="z.B. sin(x), x^2, 2*x+1" className="flex-1 bg-zinc-800 text-white rounded-lg px-3 py-2 border border-zinc-700 font-mono text-sm" />
            {functions.length > 1 && (
              <button onClick={() => setFunctions(functions.filter((_, j) => j !== i))} className="text-zinc-500 hover:text-red-400">✕</button>
            )}
          </div>
        ))}
        <button onClick={addFunction} className="text-violet-400 text-sm hover:text-violet-300">+ Funktion hinzufügen</button>
      </div>

      {/* Range controls */}
      <div className="flex gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1 text-zinc-400">
          x: <input value={xMin} onChange={(e) => setXMin(Number(e.target.value))} className="w-16 bg-zinc-800 text-white rounded px-2 py-1 border border-zinc-700 font-mono text-center" />
          bis <input value={xMax} onChange={(e) => setXMax(Number(e.target.value))} className="w-16 bg-zinc-800 text-white rounded px-2 py-1 border border-zinc-700 font-mono text-center" />
        </div>
        <div className="flex items-center gap-1 text-zinc-400">
          y: <input value={yMin} onChange={(e) => setYMin(Number(e.target.value))} className="w-16 bg-zinc-800 text-white rounded px-2 py-1 border border-zinc-700 font-mono text-center" />
          bis <input value={yMax} onChange={(e) => setYMax(Number(e.target.value))} className="w-16 bg-zinc-800 text-white rounded px-2 py-1 border border-zinc-700 font-mono text-center" />
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => { setXMin(xMin * 0.5); setXMax(xMax * 0.5); setYMin(yMin * 0.5); setYMax(yMax * 0.5); }} className="px-2 py-1 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 text-xs">🔍+</button>
          <button onClick={() => { setXMin(xMin * 2); setXMax(xMax * 2); setYMin(yMin * 2); setYMax(yMax * 2); }} className="px-2 py-1 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 text-xs">🔍−</button>
          <button onClick={() => { setXMin(-10); setXMax(10); setYMin(-5); setYMax(5); }} className="px-2 py-1 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 text-xs">↺</button>
        </div>
      </div>

      {/* Canvas */}
      <canvas ref={canvasRef} width={800} height={500} onMouseMove={handleMouseMove} onMouseLeave={() => setMousePos(null)} className="w-full rounded-xl border border-zinc-800 cursor-crosshair" />

      {/* Quick functions */}
      <div className="mt-4 flex flex-wrap gap-2">
        {["sin(x)", "cos(x)", "tan(x)", "x^2", "x^3", "sqrt(x)", "1/x", "ln(x)", "e^x", "abs(x)"].map((f) => (
          <button key={f} onClick={() => setFunctions([{ expr: f, color: COLORS[0] }])} className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-xs font-mono hover:bg-zinc-700 hover:text-white">{f}</button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* TOOL 5: Statistics Tool                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

function StatisticsTool({ onSave, modules }: { onSave: (t: MathTool, e: string, r: string, m?: string | null) => void; modules: Module[] }) {
  const [data, setData] = useState("5, 8, 12, 7, 9, 15, 6, 11, 10, 8");
  const [moduleId, setModuleId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const numbers = useMemo(() => data.split(/[,;\s]+/).map(Number).filter((n) => !isNaN(n)), [data]);

  const stats = useMemo(() => {
    if (numbers.length === 0) return null;
    const n = numbers.length;
    const sorted = [...numbers].sort((a, b) => a - b);
    const sum = numbers.reduce((s, v) => s + v, 0);
    const mean = sum / n;
    const variance = numbers.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const stddev = Math.sqrt(variance);
    const sampleVar = n > 1 ? numbers.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const min = sorted[0];
    const max = sorted[n - 1];
    const range = max - min;

    // Mode
    const freq: Record<number, number> = {};
    numbers.forEach((v) => { freq[v] = (freq[v] || 0) + 1; });
    const maxFreq = Math.max(...Object.values(freq));
    const modes = Object.entries(freq).filter(([, f]) => f === maxFreq).map(([v]) => Number(v));

    return { n, sum, mean, median, variance, sampleVariance: sampleVar, stddev, sampleStddev: Math.sqrt(sampleVar), min, max, range, q1, q3, iqr: q3 - q1, modes, sorted };
  }, [numbers]);

  // Draw histogram
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !stats) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, W, H);

    const bins = 10;
    const binWidth = (stats.max - stats.min) / bins || 1;
    const counts = Array(bins).fill(0);
    numbers.forEach((v) => {
      const idx = Math.min(Math.floor((v - stats.min) / binWidth), bins - 1);
      counts[idx]++;
    });
    const maxCount = Math.max(...counts);
    const barW = (W - 60) / bins;
    const barArea = H - 50;

    counts.forEach((c, i) => {
      const barH = maxCount > 0 ? (c / maxCount) * barArea : 0;
      ctx.fillStyle = "#7c3aed";
      ctx.fillRect(40 + i * barW + 2, H - 30 - barH, barW - 4, barH);
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "10px monospace";
      ctx.fillText(String(c), 40 + i * barW + barW / 2 - 4, H - 30 - barH - 5);
      ctx.fillText((stats.min + i * binWidth).toFixed(1), 40 + i * barW, H - 15);
    });

    // Mean line
    const meanX = 40 + ((stats.mean - stats.min) / (stats.range || 1)) * (W - 60);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(meanX, 0); ctx.lineTo(meanX, H - 30); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#ef4444";
    ctx.font = "11px monospace";
    ctx.fillText(`x̄=${stats.mean.toFixed(2)}`, meanX + 5, 15);
  }, [stats, numbers]);

  const handleSave = () => {
    if (!stats) return;
    onSave("statistics", `Daten (n=${stats.n})`, `x̄=${stats.mean.toFixed(4)}, σ=${stats.stddev.toFixed(4)}, Median=${stats.median}`, moduleId);
  };

  const fmt = (n: number) => n.toFixed(4).replace(/\.?0+$/, "");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Statistik-Werkzeug</h2>
        <div className="flex items-center gap-2">
          <select value={moduleId || ""} onChange={(e) => setModuleId(e.target.value || null)} className="bg-zinc-800 text-zinc-300 text-sm rounded-lg px-3 py-1.5 border border-zinc-700">
            <option value="">Kein Modul</option>
            {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button onClick={handleSave} className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700">💾 Speichern</button>
        </div>
      </div>

      <textarea value={data} onChange={(e) => setData(e.target.value)} placeholder="Daten eingeben (komma- oder leerzeichen-getrennt)..." className="w-full bg-zinc-800 text-white rounded-lg px-4 py-3 border border-zinc-700 font-mono text-sm mb-4 h-20 resize-none" />

      {stats && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              ["Anzahl (n)", String(stats.n)],
              ["Summe", fmt(stats.sum)],
              ["Mittelwert (x̄)", fmt(stats.mean)],
              ["Median", fmt(stats.median)],
              ["Varianz (σ²)", fmt(stats.variance)],
              ["Stichproben-Var.", fmt(stats.sampleVariance)],
              ["Std.-Abw. (σ)", fmt(stats.stddev)],
              ["Stichpr.-Std.", fmt(stats.sampleStddev)],
              ["Minimum", fmt(stats.min)],
              ["Maximum", fmt(stats.max)],
              ["Spannweite", fmt(stats.range)],
              ["IQR (Q3−Q1)", fmt(stats.iqr)],
              ["Q1 (25%)", fmt(stats.q1)],
              ["Q3 (75%)", fmt(stats.q3)],
              ["Modalwert", stats.modes.join(", ")],
            ].map(([label, val]) => (
              <div key={label} className="bg-zinc-800 rounded-lg px-3 py-2">
                <div className="text-zinc-500 text-xs">{label}</div>
                <div className="text-white font-mono text-sm">{val}</div>
              </div>
            ))}
          </div>

          {/* Histogram */}
          <canvas ref={canvasRef} width={700} height={250} className="w-full rounded-xl border border-zinc-800" />
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* TOOL 6: Units & Constants                                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

function UnitsTool({ onSave, modules }: { onSave: (t: MathTool, e: string, r: string, m?: string | null) => void; modules: Module[] }) {
  const [tab, setTab] = useState<"convert" | "constants" | "bases">("convert");
  const [group, setGroup] = useState(0);
  const [fromUnit, setFromUnit] = useState(0);
  const [toUnit, setToUnit] = useState(1);
  const [value, setValue] = useState("1");
  const [baseInput, setBaseInput] = useState("255");
  const [baseFrom, setBaseFrom] = useState(10);
  const [moduleId, setModuleId] = useState<string | null>(null);

  const currentGroup = UNIT_GROUPS[group];
  const isTemp = currentGroup.label === "Temperatur";

  const convertResult = useMemo(() => {
    const v = Number(value);
    if (isNaN(v)) return "—";
    if (isTemp) {
      const fromSym = currentGroup.units[fromUnit].symbol;
      const toSym = currentGroup.units[toUnit].symbol;
      return convertTemp(v, fromSym, toSym).toPrecision(10).replace(/\.?0+$/, "");
    }
    const fromF = currentGroup.units[fromUnit].factor;
    const toF = currentGroup.units[toUnit].factor;
    return ((v * fromF) / toF).toPrecision(10).replace(/\.?0+$/, "");
  }, [value, group, fromUnit, toUnit, isTemp, currentGroup]);

  const baseResults = useMemo(() => {
    const num = parseInt(baseInput, baseFrom);
    if (isNaN(num)) return null;
    return { bin: numberToBase(num, 2), oct: numberToBase(num, 8), dec: numberToBase(num, 10), hex: numberToBase(num, 16) };
  }, [baseInput, baseFrom]);

  const handleSaveConvert = () => {
    const from = currentGroup.units[fromUnit];
    const to = currentGroup.units[toUnit];
    onSave("units", `${value} ${from.symbol} → ${to.symbol}`, `${convertResult} ${to.symbol}`, moduleId);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Einheiten & Konstanten</h2>
        <select value={moduleId || ""} onChange={(e) => setModuleId(e.target.value || null)} className="bg-zinc-800 text-zinc-300 text-sm rounded-lg px-3 py-1.5 border border-zinc-700">
          <option value="">Kein Modul</option>
          {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <div className="flex gap-2 mb-6">
        {([["convert", "Umrechner"], ["constants", "Konstanten"], ["bases", "Zahlensysteme"]] as [string, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as typeof tab)} className={`px-4 py-2 rounded-lg text-sm ${tab === k ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>{l}</button>
        ))}
      </div>

      {tab === "convert" && (
        <div>
          {/* Group selector */}
          <div className="flex flex-wrap gap-2 mb-4">
            {UNIT_GROUPS.map((g, i) => (
              <button key={g.label} onClick={() => { setGroup(i); setFromUnit(0); setToUnit(1); }} className={`px-3 py-1.5 rounded-lg text-sm ${group === i ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>{g.label}</button>
            ))}
          </div>

          <div className="bg-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-4 justify-center">
              <div className="text-center">
                <input value={value} onChange={(e) => setValue(e.target.value)} className="w-40 bg-zinc-900 text-white text-xl rounded-lg px-4 py-3 border border-zinc-700 font-mono text-center" />
                <select value={fromUnit} onChange={(e) => setFromUnit(Number(e.target.value))} className="mt-2 w-40 bg-zinc-900 text-zinc-300 rounded-lg px-3 py-2 border border-zinc-700 text-sm">
                  {currentGroup.units.map((u, i) => <option key={i} value={i}>{u.name} ({u.symbol})</option>)}
                </select>
              </div>
              <button onClick={() => { setFromUnit(toUnit); setToUnit(fromUnit); }} className="text-2xl text-zinc-400 hover:text-violet-400">⇄</button>
              <div className="text-center">
                <div className="w-40 text-emerald-400 text-xl font-mono py-3 px-4 text-center">{convertResult}</div>
                <select value={toUnit} onChange={(e) => setToUnit(Number(e.target.value))} className="mt-2 w-40 bg-zinc-900 text-zinc-300 rounded-lg px-3 py-2 border border-zinc-700 text-sm">
                  {currentGroup.units.map((u, i) => <option key={i} value={i}>{u.name} ({u.symbol})</option>)}
                </select>
              </div>
            </div>
            <div className="text-center mt-4">
              <button onClick={handleSaveConvert} className="text-violet-400 text-sm hover:text-violet-300">💾 Im Verlauf speichern</button>
            </div>
          </div>
        </div>
      )}

      {tab === "constants" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CONSTANTS.map((c) => (
            <div key={c.name} className="bg-zinc-800 rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-white text-sm font-medium">{c.name}</div>
                <div className="text-zinc-500 text-xs">{c.unit}</div>
              </div>
              <div className="text-right">
                <div className="text-violet-400 font-mono text-sm">{c.symbol}</div>
                <div className="text-emerald-400 font-mono text-sm">{c.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "bases" && (
        <div className="bg-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <input value={baseInput} onChange={(e) => setBaseInput(e.target.value)} className="flex-1 bg-zinc-900 text-white text-xl rounded-lg px-4 py-3 border border-zinc-700 font-mono" placeholder="Zahl eingeben..." />
            <select value={baseFrom} onChange={(e) => setBaseFrom(Number(e.target.value))} className="bg-zinc-900 text-zinc-300 rounded-lg px-3 py-3 border border-zinc-700 text-sm">
              <option value={2}>Binär (2)</option>
              <option value={8}>Oktal (8)</option>
              <option value={10}>Dezimal (10)</option>
              <option value={16}>Hexadezimal (16)</option>
            </select>
          </div>
          {baseResults && (
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Binär (2)", baseResults.bin, "BIN"],
                ["Oktal (8)", baseResults.oct, "OCT"],
                ["Dezimal (10)", baseResults.dec, "DEC"],
                ["Hexadezimal (16)", baseResults.hex, "HEX"],
              ].map(([label, val, tag]) => (
                <div key={label} className="bg-zinc-900 rounded-lg px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-zinc-500 text-xs">{label}</span>
                    <span className="text-violet-400 text-xs font-mono">{tag}</span>
                  </div>
                  <div className="text-emerald-400 font-mono text-lg break-all">{val}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* TOOL 7: Formula Collection                                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

function FormulasTool({ userId, supabase, formulas, setFormulas, modules }: { userId: string | null; supabase: ReturnType<typeof createClient>; formulas: MathFormula[]; setFormulas: React.Dispatch<React.SetStateAction<MathFormula[]>>; modules: Module[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<FormulaCategory | "all">("all");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [formula, setFormula] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState<FormulaCategory>("allgemein");
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [tags, setTags] = useState("");

  const allFormulas = useMemo(() => {
    const custom = formulas.map((f) => ({ ...f, isCustom: true }));
    const builtin = BUILTIN_FORMULAS.map((f, i) => ({
      id: `builtin-${i}`, user_id: "", title: f.title, formula: f.formula, category: f.category, description: f.description, module_id: null, tags: [] as string[], pinned: false, created_at: "", updated_at: "", isCustom: false,
    }));
    let all = [...custom, ...builtin];
    if (category !== "all") all = all.filter((f) => f.category === category);
    if (search) {
      const q = search.toLowerCase();
      all = all.filter((f) => f.title.toLowerCase().includes(q) || f.formula.toLowerCase().includes(q) || f.description.toLowerCase().includes(q));
    }
    return all;
  }, [formulas, category, search]);

  const openNew = () => { setEditId(null); setTitle(""); setFormula(""); setDesc(""); setCat("allgemein"); setModuleId(null); setTags(""); setShowModal(true); };
  const openEdit = (f: MathFormula) => { setEditId(f.id); setTitle(f.title); setFormula(f.formula); setDesc(f.description); setCat(f.category); setModuleId(f.module_id); setTags(f.tags.join(", ")); setShowModal(true); };

  const save = async () => {
    if (!userId || !title || !formula) return;
    const entry = { user_id: userId, title, formula, category: cat, description: desc, module_id: moduleId, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) };
    if (editId) {
      const { data } = await supabase.from("math_formulas").update(entry).eq("id", editId).select().single();
      if (data) setFormulas((prev) => prev.map((f) => f.id === editId ? (data as MathFormula) : f));
    } else {
      const { data } = await supabase.from("math_formulas").insert(entry).select().single();
      if (data) setFormulas((prev) => [data as MathFormula, ...prev]);
    }
    setShowModal(false);
  };

  const remove = async (id: string) => {
    await supabase.from("math_formulas").delete().eq("id", id);
    setFormulas((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Formel-Sammlung</h2>
        <button onClick={openNew} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500">+ Eigene Formel</button>
      </div>

      {/* Search + Category filter */}
      <div className="flex gap-3 mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Formeln durchsuchen..." className="flex-1 bg-zinc-800 text-white rounded-lg px-4 py-2 border border-zinc-700 text-sm" />
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setCategory("all")} className={`px-3 py-1.5 rounded-lg text-xs ${category === "all" ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>Alle</button>
        {FORMULA_CATEGORIES.map((c) => (
          <button key={c.key} onClick={() => setCategory(c.key)} className={`px-3 py-1.5 rounded-lg text-xs ${category === c.key ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>{c.label}</button>
        ))}
      </div>

      {/* Formulas List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {allFormulas.map((f) => (
          <div key={f.id} className="bg-zinc-800 rounded-lg px-4 py-3 group">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {(f as { isCustom?: boolean }).isCustom && <span className="text-xs bg-violet-900 text-violet-300 px-1.5 py-0.5 rounded">Eigene</span>}
                  <span className="text-xs bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded">{FORMULA_CATEGORIES.find((c) => c.key === f.category)?.label}</span>
                </div>
                <div className="text-white font-medium text-sm mt-1">{f.title}</div>
                <div className="text-emerald-400 font-mono text-sm mt-1">{f.formula}</div>
                {f.description && <div className="text-zinc-500 text-xs mt-1">{f.description}</div>}
              </div>
              {(f as { isCustom?: boolean }).isCustom && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(f as MathFormula)} className="text-zinc-500 hover:text-violet-400 text-xs">✏️</button>
                  <button onClick={() => remove(f.id)} className="text-zinc-500 hover:text-red-400 text-xs">🗑️</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {allFormulas.length === 0 && <p className="text-zinc-500 text-sm text-center py-8">Keine Formeln gefunden.</p>}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-zinc-900 rounded-2xl p-6 w-full max-w-lg border border-zinc-800" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">{editId ? "Formel bearbeiten" : "Neue Formel"}</h3>
            <div className="space-y-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titel *" className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2.5 border border-zinc-700 text-sm" />
              <input value={formula} onChange={(e) => setFormula(e.target.value)} placeholder="Formel * (z.B. a² + b² = c²)" className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2.5 border border-zinc-700 font-mono text-sm" />
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Beschreibung (optional)" className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2.5 border border-zinc-700 text-sm" />
              <select value={cat} onChange={(e) => setCat(e.target.value as FormulaCategory)} className="w-full bg-zinc-800 text-zinc-300 rounded-lg px-4 py-2.5 border border-zinc-700 text-sm">
                {FORMULA_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <select value={moduleId || ""} onChange={(e) => setModuleId(e.target.value || null)} className="w-full bg-zinc-800 text-zinc-300 rounded-lg px-4 py-2.5 border border-zinc-700 text-sm">
                <option value="">Kein Modul</option>
                {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (komma-getrennt)" className="w-full bg-zinc-800 text-white rounded-lg px-4 py-2.5 border border-zinc-700 text-sm" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700">Abbrechen</button>
              <button onClick={save} className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500">Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
