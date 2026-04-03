"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/useProfile";
import { FREE_LIMITS, mathUsageToday, mathUsageIncrement } from "@/lib/gates";
import { LimitNudge, UpgradeModal } from "@/components/ui/ProGate";
import type { Module, MathHistory, MathFormula, MathTool, FormulaCategory } from "@/types/database";
import { useTranslation } from "@/lib/i18n";

/* ─── Constants ───────────────────────────────────────────────────────────── */

function getTools(t: (key: string) => string): { key: MathTool; label: string; icon: string; desc: string }[] {
  return [
    { key: "calculator",  label: t("math.calculator"),    icon: "🧮", desc: t("math.scientific") },
    { key: "equations",   label: t("math.equations"),     icon: "⚖️", desc: t("math.solver") },
    { key: "matrices",    label: t("math.matrices"),      icon: "📐", desc: t("math.matricesCalc") },
    { key: "plotter",     label: t("math.plotter"),       icon: "📈", desc: t("math.functionGraphs") },
    { key: "statistics",  label: t("math.statistics"),    icon: "📊", desc: t("math.analysis") },
    { key: "units",       label: t("math.units"),         icon: "🔄", desc: t("math.converter") },
    { key: "formulas",    label: t("math.formulas"),      icon: "📋", desc: t("math.formulas") },
  ];
}

function getFormulaCategories(t: (key: string) => string): { key: FormulaCategory; label: string }[] {
  return [
    { key: "allgemein",       label: t("math.formulasGeneral") },
    { key: "analysis",        label: t("math.formulasAnalysis") },
    { key: "lineare_algebra", label: t("math.formulasLinearAlgebra") },
    { key: "statistik",       label: t("math.formulasStatistics") },
    { key: "trigonometrie",   label: t("math.formulasTrigonometry") },
    { key: "physik",          label: t("math.formulasPhysics") },
    { key: "finanzen",        label: t("math.formulasFinance") },
    { key: "informatik",      label: t("math.formulasComputerScience") },
  ];
}

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

function getConstants(t: (key: string) => string): { name: string; symbol: string; value: string; unit: string }[] {
  return [
    { name: t("math.const.lightSpeed"), symbol: "c", value: "299 792 458", unit: "m/s" },
    { name: t("math.const.gravity"), symbol: "G", value: "6.674 × 10⁻¹¹", unit: "m³/(kg·s²)" },
    { name: t("math.const.planck"), symbol: "h", value: "6.626 × 10⁻³⁴", unit: "J·s" },
    { name: t("math.const.boltzmann"), symbol: "k_B", value: "1.381 × 10⁻²³", unit: "J/K" },
    { name: t("math.const.elemCharge"), symbol: "e", value: "1.602 × 10⁻¹⁹", unit: "C" },
    { name: t("math.const.avogadro"), symbol: "N_A", value: "6.022 × 10²³", unit: "1/mol" },
    { name: t("math.const.gasConst"), symbol: "R", value: "8.314", unit: "J/(mol·K)" },
    { name: t("math.const.vacuumPerm"), symbol: "ε₀", value: "8.854 × 10⁻¹²", unit: "F/m" },
    { name: t("math.const.euler"), symbol: "e", value: "2.71828 18284", unit: "" },
    { name: t("math.const.pi"), symbol: "π", value: "3.14159 26535", unit: "" },
    { name: t("math.const.goldenRatio"), symbol: "φ", value: "1.61803 39887", unit: "" },
    { name: t("math.const.earthGravity"), symbol: "g", value: "9.80665", unit: "m/s²" },
  ];
}

function getUnitGroups(t: (key: string) => string): { label: string; units: { name: string; factor: number; symbol: string }[] }[] {
  return [
    {
      label: t("math.unit.length"),
      units: [
        { name: t("math.unit.meter"), factor: 1, symbol: "m" },
        { name: t("math.unit.kilometer"), factor: 1000, symbol: "km" },
        { name: t("math.unit.centimeter"), factor: 0.01, symbol: "cm" },
        { name: t("math.unit.millimeter"), factor: 0.001, symbol: "mm" },
        { name: t("math.unit.mile"), factor: 1609.344, symbol: "mi" },
        { name: t("math.unit.foot"), factor: 0.3048, symbol: "ft" },
        { name: t("math.unit.inch"), factor: 0.0254, symbol: "in" },
      ],
    },
    {
      label: t("math.unit.weight"),
      units: [
        { name: t("math.unit.kilogram"), factor: 1, symbol: "kg" },
        { name: t("math.unit.gram"), factor: 0.001, symbol: "g" },
        { name: t("math.unit.milligram"), factor: 0.000001, symbol: "mg" },
        { name: t("math.unit.ton"), factor: 1000, symbol: "t" },
        { name: t("math.unit.pound"), factor: 0.453592, symbol: "lb" },
        { name: t("math.unit.ounce"), factor: 0.0283495, symbol: "oz" },
      ],
    },
    {
      label: t("math.unit.temperature"),
      units: [
        { name: t("math.unit.celsius"), factor: 1, symbol: "°C" },
        { name: t("math.unit.fahrenheit"), factor: 1, symbol: "°F" },
        { name: t("math.unit.kelvin"), factor: 1, symbol: "K" },
      ],
    },
    {
      label: t("math.unit.area"),
      units: [
        { name: t("math.unit.sqMeter"), factor: 1, symbol: "m²" },
        { name: t("math.unit.sqKm"), factor: 1e6, symbol: "km²" },
        { name: t("math.unit.hectare"), factor: 1e4, symbol: "ha" },
        { name: t("math.unit.sqCm"), factor: 1e-4, symbol: "cm²" },
        { name: t("math.unit.are"), factor: 100, symbol: "a" },
      ],
    },
    {
      label: t("math.unit.volume"),
      units: [
        { name: t("math.unit.liter"), factor: 1, symbol: "L" },
        { name: t("math.unit.milliliter"), factor: 0.001, symbol: "mL" },
        { name: t("math.unit.cubicMeter"), factor: 1000, symbol: "m³" },
        { name: t("math.unit.gallon"), factor: 3.78541, symbol: "gal" },
      ],
    },
    {
      label: t("math.unit.time"),
      units: [
        { name: t("math.unit.second"), factor: 1, symbol: "s" },
        { name: t("math.unit.minute"), factor: 60, symbol: "min" },
        { name: t("math.unit.hour"), factor: 3600, symbol: "h" },
        { name: t("math.unit.day"), factor: 86400, symbol: "d" },
        { name: t("math.unit.week"), factor: 604800, symbol: "w" },
      ],
    },
  ];
}

function getBuiltinFormulas(t: (key: string) => string): { title: string; formula: string; category: FormulaCategory; description: string }[] {
  return [
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
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function safeEval(expr: string, t?: (key: string) => string): string {
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
      return t ? t("math.invalidExpression") : "Fehler: Ungültiger Ausdruck";
    }
    const result = Function(`"use strict"; return (${e})`)();
    if (typeof result === "number") {
      if (Number.isNaN(result)) return "NaN";
      if (!Number.isFinite(result)) return "∞";
      return Number.isInteger(result) ? String(result) : result.toPrecision(10).replace(/\.?0+$/, "");
    }
    return String(result);
  } catch {
    return t ? t("math.error") : "Fehler";
  }
}

function solveLinear(a: number, b: number, t?: (key: string) => string): string {
  if (a === 0) return b === 0 ? (t ? t("math.infiniteSolutions") : "Unendlich viele Lösungen") : (t ? t("math.noSolution") : "Keine Lösung");
  return `x = ${(-b / a).toPrecision(10).replace(/\.?0+$/, "")}`;
}

function solveQuadratic(a: number, b: number, c: number, t?: (key: string) => string): string {
  if (a === 0) return solveLinear(b, c, t);
  const disc = b * b - 4 * a * c;
  if (disc < 0) {
    const re = (-b / (2 * a)).toPrecision(6).replace(/\.?0+$/, "");
    const im = (Math.sqrt(-disc) / (2 * a)).toPrecision(6).replace(/\.?0+$/, "");
    return `x₁ = ${re} + ${im}i\nx₂ = ${re} − ${im}i`;
  }
  const x1 = (-b + Math.sqrt(disc)) / (2 * a);
  const x2 = (-b - Math.sqrt(disc)) / (2 * a);
  const f = (n: number) => n.toPrecision(10).replace(/\.?0+$/, "");
  if (disc === 0) return `x = ${f(x1)} (${t ? t("math.doubleSolution") : "Doppelte Nullstelle"})`;
  return `x₁ = ${f(x1)}\nx₂ = ${f(x2)}`;
}

function solveSystem2(a1: number, b1: number, c1: number, a2: number, b2: number, c2: number, t?: (key: string) => string): string {
  const det = a1 * b2 - a2 * b1;
  if (det === 0) return t ? t("math.noUniqueSolution") : "Keine eindeutige Lösung (det = 0)";
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

function numberToBase(num: number, base: number, t?: (key: string) => string): string {
  if (!Number.isInteger(num)) return t ? t("math.integerOnly") : "Nur ganze Zahlen";
  return num.toString(base).toUpperCase();
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */

export default function MathPage() {
  const { t } = useTranslation();
  const supabase = createClient();
  const { isPro } = useProfile();
  const [userId, setUserId] = useState<string | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [activeTool, setActiveTool] = useState<MathTool>("calculator");
  const [history, setHistory] = useState<MathHistory[]>([]);
  const [formulas, setFormulas] = useState<MathFormula[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [mathLimitHit, setMathLimitHit] = useState(false);

  const tools = useMemo(() => getTools(t), [t]);
  const formulaCategories = useMemo(() => getFormulaCategories(t), [t]);
  const constants = useMemo(() => getConstants(t), [t]);
  const unitGroups = useMemo(() => getUnitGroups(t), [t]);
  const builtinFormulas = useMemo(() => getBuiltinFormulas(t), [t]);

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

  /** Check math daily limit before calculating */
  const checkMathLimit = useCallback((tool: MathTool): boolean => {
    const usage = mathUsageToday(tool, isPro);
    if (!usage.allowed) {
      setMathLimitHit(true);
      setShowUpgrade(true);
      return false;
    }
    return true;
  }, [isPro]);

  const saveToHistory = useCallback(async (tool: MathTool, expression: string, result: string, moduleId?: string | null) => {
    if (!userId) return;
    // Increment daily usage counter for free users
    mathUsageIncrement(tool);
    const entry: Partial<MathHistory> = { user_id: userId, tool, expression, result, module_id: moduleId || null };
    const { data } = await supabase.from("math_history").insert(entry).select().single();
    if (data) setHistory((prev) => [data as MathHistory, ...prev]);
  }, [userId, supabase]);

  const toolHistory = useMemo(() => history.filter((h) => h.tool === activeTool), [history, activeTool]);

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 px-3 sm:px-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-surface-900 flex items-center gap-2">🧮 {t("math.title")}</h1>
          <p className="text-surface-500 text-xs sm:text-sm mt-1">{t("math.subtitle")}</p>
        </div>
        <button onClick={() => setShowHistory(!showHistory)} className="px-3 sm:px-4 py-2 rounded-lg bg-surface-100 text-surface-700 hover:bg-surface-200 text-sm flex items-center gap-2 self-start sm:self-auto">
          📜 {t("math.history")} {history.length > 0 && <span className="bg-brand-600 text-white text-xs rounded-full px-2">{history.length}</span>}
        </button>
      </div>

      {/* Tool Tabs */}
      <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {tools.map((tool) => (
          <button key={tool.key} onClick={() => setActiveTool(tool.key)} className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${activeTool === tool.key ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-500 hover:bg-surface-200 hover:text-surface-800"}`}>
            <span>{tool.icon}</span>
            <span className="hidden sm:inline">{tool.label}</span>
          </button>
        ))}
      </div>

      {/* History Sidebar */}
      {showHistory && (
        <div className="bg-white rounded-xl border border-surface-200 p-4">
          <h3 className="text-surface-900 font-semibold mb-3">{t("math.historyTitle")}</h3>
          {history.length === 0 ? (
            <p className="text-surface-400 text-sm">{t("math.noHistoryYet")}</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {history.slice(0, 30).map((h) => (
                <div key={h.id} className="flex items-center justify-between bg-surface-100 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <span className="text-xs text-brand-600 mr-2">{tools.find((t) => t.key === h.tool)?.icon}</span>
                    <span className="text-surface-700 text-sm font-mono truncate">{h.expression}</span>
                    <span className="text-surface-400 mx-2">=</span>
                    <span className="text-success-600 text-sm font-mono">{h.result}</span>
                  </div>
                  <span className="text-surface-300 text-xs ml-2 whitespace-nowrap">{new Date(h.created_at).toLocaleDateString("de-CH")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Daily usage info for free users */}
      {!isPro && (
        <div className="flex items-center gap-2 text-xs text-surface-500 bg-surface-50 rounded-lg px-3 py-2">
          <span>{t("math.dailyLimit")}:</span>
          {(() => {
            const usage = mathUsageToday(activeTool, isPro);
            return (
              <span className={usage.used >= usage.max ? "text-red-600 font-medium" : usage.used >= usage.max - 1 ? "text-amber-600 font-medium" : ""}>
                {usage.used}/{usage.max} {t("math.calculationsToday")}
              </span>
            );
          })()}
          <span className="text-surface-400">·</span>
          <a href="/upgrade" className="text-brand-600 hover:text-brand-500 font-medium">{t("math.proUnlimited")}</a>
        </div>
      )}

      {showUpgrade && (
        <UpgradeModal feature="unlimitedMath" onClose={() => { setShowUpgrade(false); setMathLimitHit(false); }} />
      )}

      {/* Tool Content */}
      <div className="bg-white rounded-xl border border-surface-200 p-3 sm:p-6">
        {activeTool === "calculator" && <CalculatorTool onSave={saveToHistory} modules={modules} checkLimit={() => checkMathLimit("calculator")} />}
        {activeTool === "equations" && <EquationsTool onSave={saveToHistory} modules={modules} checkLimit={() => checkMathLimit("equations")} />}
        {activeTool === "matrices" && <MatricesTool onSave={saveToHistory} modules={modules} checkLimit={() => checkMathLimit("matrices")} />}
        {activeTool === "plotter" && <PlotterTool onSave={saveToHistory} modules={modules} checkLimit={() => checkMathLimit("plotter")} />}
        {activeTool === "statistics" && <StatisticsTool onSave={saveToHistory} modules={modules} checkLimit={() => checkMathLimit("statistics")} />}
        {activeTool === "units" && <UnitsTool onSave={saveToHistory} modules={modules} />}
        {activeTool === "formulas" && <FormulasTool userId={userId} supabase={supabase} formulas={formulas} setFormulas={setFormulas} modules={modules} builtinFormulas={builtinFormulas} formulaCategories={formulaCategories} />}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* TOOL 1: Scientific Calculator                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

function CalculatorTool({ onSave, modules, checkLimit }: { onSave: (t: MathTool, e: string, r: string, m?: string | null) => void; modules: Module[]; checkLimit?: () => boolean }) {
  const { t } = useTranslation();
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
      if (checkLimit && !checkLimit()) return;
      const r = safeEval(expr, t);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-surface-900">{t("math.scientificCalculator")}</h2>
        <div className="flex items-center gap-2 sm:gap-3">
          <select value={moduleId || ""} onChange={(e) => setModuleId(e.target.value || null)} className="bg-surface-100 text-surface-700 text-xs sm:text-sm rounded-lg px-2 sm:px-3 py-1.5 border border-surface-200 flex-1 sm:flex-none">
            <option value="">{t("math.noModule")}</option>
            {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button onClick={() => setAngleMode(angleMode === "deg" ? "rad" : "deg")} className="px-3 py-1.5 rounded-lg bg-surface-100 text-surface-700 text-sm border border-surface-200 hover:bg-surface-200">
            {angleMode === "deg" ? "DEG" : "RAD"}
          </button>
        </div>
      </div>

      {/* Display */}
      <div className="bg-surface-50 rounded-xl p-4 mb-4 border border-surface-200">
        <input ref={inputRef} value={display} onChange={(e) => setDisplay(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleButton("="); }} placeholder={t("math.enterExpression")} className="w-full bg-transparent text-surface-900 text-base sm:text-xl font-mono outline-none text-right" />
        {result && <div className="text-right text-success-600 text-xl sm:text-2xl font-mono mt-2 font-bold break-all">= {result}</div>}
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {CALC_BUTTONS.flat().map((btn, i) => {
          const isOp = ["÷", "×", "−", "+", "="].includes(btn);
          const isFn = ["sin", "cos", "tan", "ln", "log", "√", "^", "!", "%", "abs", "e", "π"].includes(btn);
          const isClear = btn === "C" || btn === "⌫";
          return (
            <button key={i} onClick={() => handleButton(btn)} className={`py-2.5 sm:py-3 rounded-lg font-mono text-sm sm:text-base font-semibold transition-all active:scale-95 sm:hover:scale-105 ${btn === "=" ? "bg-brand-600 text-white hover:bg-brand-700" : isClear ? "bg-danger-50 text-danger-600 hover:bg-danger-100" : isOp ? "bg-surface-200 text-brand-500 hover:bg-surface-200" : isFn ? "bg-surface-100 text-info-600 hover:bg-surface-200" : "bg-surface-100 text-surface-900 hover:bg-surface-200"}`}>
              {btn}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* TOOL 2: Equation Solver & Formula Rearrangement (Complete Overhaul)        */
/* ═══════════════════════════════════════════════════════════════════════════ */

interface SolverStep {
  expr: string;
  op: string;
}

interface SolverResult {
  type: string;
  steps: SolverStep[];
  solutions: string[];
  domain: string;
  notes: string;
  error: string | null;
}

/* ── Client-side step-by-step for common cases ────────────────────── */

function solveLinearSteps(a: number, b: number, c: number): SolverResult {
  // ax + b = c
  if (a === 0) {
    if (b === c) return { type: "linear", steps: [{ expr: `${b} = ${c}`, op: "Wahre Aussage" }], solutions: ["x ∈ ℝ (unendlich viele Lösungen)"], domain: "D = ℝ", notes: "Die Gleichung ist für alle x erfüllt.", error: null };
    return { type: "linear", steps: [{ expr: `${b} = ${c}`, op: "Falsche Aussage" }], solutions: [], domain: "D = ℝ", notes: "Widerspruch — keine Lösung.", error: null };
  }
  const steps: SolverStep[] = [
    { expr: `${a}x + ${b} = ${c}`, op: "Ausgangsgleichung" },
  ];
  if (b !== 0) {
    steps.push({ expr: `${a}x = ${c - b}`, op: `| ${b > 0 ? "−" : "+"}${Math.abs(b)} auf beiden Seiten` });
  }
  const result = (c - b) / a;
  if (a !== 1) {
    steps.push({ expr: `x = ${fmt(result)}`, op: `| ÷${a}` });
  }
  return { type: "linear", steps, solutions: [`x = ${fmt(result)}`], domain: "D = ℝ", notes: "", error: null };
}

function solveQuadraticSteps(a: number, b: number, c: number): SolverResult {
  if (a === 0) return solveLinearSteps(b, c, 0);
  const steps: SolverStep[] = [
    { expr: `${a}x² + ${b}x + ${c} = 0`, op: "Ausgangsgleichung (quadratisch)" },
  ];

  const disc = b * b - 4 * a * c;
  steps.push({ expr: `D = b² − 4ac = ${b}² − 4·${a}·${c} = ${fmt(disc)}`, op: "Diskriminante berechnen" });

  if (disc < 0) {
    const re = fmt(-b / (2 * a));
    const im = fmt(Math.sqrt(-disc) / (2 * a));
    steps.push({ expr: `D < 0 → komplexe Lösungen`, op: "Diskriminante negativ" });
    steps.push({ expr: `x₁ = ${re} + ${im}i`, op: "Mitternachtsformel" });
    steps.push({ expr: `x₂ = ${re} − ${im}i`, op: "" });
    return { type: "quadratic", steps, solutions: [`x₁ = ${re} + ${im}i`, `x₂ = ${re} − ${im}i`], domain: "D = ℝ (keine reellen Lösungen)", notes: "Die Diskriminante ist negativ → zwei konjugiert komplexe Lösungen.", error: null };
  }

  if (disc === 0) {
    const x = -b / (2 * a);
    steps.push({ expr: `D = 0 → doppelte Nullstelle`, op: "Diskriminante = 0" });
    steps.push({ expr: `x = −b/(2a) = ${fmt(-b)}/(2·${a}) = ${fmt(x)}`, op: "Mitternachtsformel" });
    return { type: "quadratic", steps, solutions: [`x = ${fmt(x)} (doppelte Nullstelle)`], domain: "D = ℝ", notes: "", error: null };
  }

  const sqrtD = Math.sqrt(disc);
  const x1 = (-b + sqrtD) / (2 * a);
  const x2 = (-b - sqrtD) / (2 * a);
  steps.push({ expr: `D > 0 → zwei reelle Lösungen`, op: "Diskriminante positiv" });
  steps.push({ expr: `√D = √${fmt(disc)} = ${fmt(sqrtD)}`, op: "Wurzel der Diskriminante" });
  steps.push({ expr: `x₁ = (−${b} + ${fmt(sqrtD)}) / (2·${a}) = ${fmt(x1)}`, op: "Mitternachtsformel (x₁)" });
  steps.push({ expr: `x₂ = (−${b} − ${fmt(sqrtD)}) / (2·${a}) = ${fmt(x2)}`, op: "Mitternachtsformel (x₂)" });

  // Vieta check
  steps.push({ expr: `Probe: x₁ + x₂ = ${fmt(x1 + x2)} = −b/a = ${fmt(-b / a)} ✓`, op: "Vieta-Kontrolle" });

  return { type: "quadratic", steps, solutions: [`x₁ = ${fmt(x1)}`, `x₂ = ${fmt(x2)}`], domain: "D = ℝ", notes: "", error: null };
}

function solveSystem2Steps(a1: number, b1: number, c1: number, a2: number, b2: number, c2: number): SolverResult {
  const steps: SolverStep[] = [
    { expr: `${a1}x + ${b1}y = ${c1}`, op: "Gleichung I" },
    { expr: `${a2}x + ${b2}y = ${c2}`, op: "Gleichung II" },
  ];
  const det = a1 * b2 - a2 * b1;
  steps.push({ expr: `det(A) = ${a1}·${b2} − ${a2}·${b1} = ${fmt(det)}`, op: "Determinante berechnen" });

  if (det === 0) {
    return { type: "system", steps, solutions: [], domain: "", notes: "Die Determinante ist 0 → keine eindeutige Lösung (abhängig oder widersprüchlich).", error: null };
  }

  const x = (c1 * b2 - c2 * b1) / det;
  const y = (a1 * c2 - a2 * c1) / det;
  steps.push({ expr: `x = (${c1}·${b2} − ${c2}·${b1}) / ${fmt(det)} = ${fmt(x)}`, op: "Cramersche Regel (x)" });
  steps.push({ expr: `y = (${a1}·${c2} − ${a2}·${c1}) / ${fmt(det)} = ${fmt(y)}`, op: "Cramersche Regel (y)" });
  steps.push({ expr: `Probe I: ${a1}·${fmt(x)} + ${b1}·${fmt(y)} = ${fmt(a1 * x + b1 * y)} = ${c1} ✓`, op: "Probe in Gleichung I" });

  return { type: "system", steps, solutions: [`x = ${fmt(x)}`, `y = ${fmt(y)}`], domain: "", notes: "", error: null };
}

function fmt(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const s = n.toPrecision(10).replace(/\.?0+$/, "");
  return s;
}

/* ── Main EquationsTool Component ─────────────────────────────────── */

function EquationsTool({ onSave, modules, checkLimit }: { onSave: (t: MathTool, e: string, r: string, m?: string | null) => void; modules: Module[]; checkLimit?: () => boolean }) {
  const { t } = useTranslation();
  const supabase = createClient();

  // Mode: solve (free text), rearrange, system, quick (coefficient input)
  const [mode, setMode] = useState<"solve" | "rearrange" | "system" | "quick">("solve");
  const [equation, setEquation] = useState("");
  const [variable, setVariable] = useState("x");
  const [targetVar, setTargetVar] = useState("");
  const [moduleId, setModuleId] = useState<string | null>(null);

  // Quick mode (coefficient input)
  const [quickType, setQuickType] = useState<"linear" | "quadratic">("quadratic");
  const [coeffA, setCoeffA] = useState("1");
  const [coeffB, setCoeffB] = useState("0");
  const [coeffC, setCoeffC] = useState("0");

  // System mode
  const [sysA1, setSysA1] = useState(""); const [sysB1, setSysB1] = useState(""); const [sysC1, setSysC1] = useState("");
  const [sysA2, setSysA2] = useState(""); const [sysB2, setSysB2] = useState(""); const [sysC2, setSysC2] = useState("");
  const [sysA3, setSysA3] = useState(""); const [sysB3, setSysB3] = useState(""); const [sysC3_1, setSysC3_1] = useState(""); const [sysD3, setSysD3] = useState("");
  const [sysSize, setSysSize] = useState<2 | 3>(2);

  // Result
  const [result, setResult] = useState<SolverResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSteps, setShowSteps] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, [mode]);

  /* ── Solve via client-side (quick mode) ── */
  function solveQuick() {
    if (checkLimit && !checkLimit()) return;
    let res: SolverResult;
    if (quickType === "linear") {
      res = solveLinearSteps(Number(coeffA), Number(coeffB), 0);
    } else {
      res = solveQuadraticSteps(Number(coeffA), Number(coeffB), Number(coeffC));
    }
    setResult(res);
    setError("");
    onSave("equations", quickType === "linear" ? `${coeffA}x + ${coeffB} = 0` : `${coeffA}x² + ${coeffB}x + ${coeffC} = 0`, res.solutions.join(", "), moduleId);
  }

  /* ── Solve system client-side ── */
  function solveSystemLocal() {
    if (checkLimit && !checkLimit()) return;
    if (sysSize === 2) {
      const res = solveSystem2Steps(Number(sysA1), Number(sysB1), Number(sysC1), Number(sysA2), Number(sysB2), Number(sysC2));
      setResult(res);
      setError("");
      onSave("equations", `${sysA1}x+${sysB1}y=${sysC1}; ${sysA2}x+${sysB2}y=${sysC2}`, res.solutions.join(", "), moduleId);
    } else {
      // 3x3 → use AI
      solveWithAI(`${sysA1}x + ${sysB1}y + ${sysC1}z = ${sysC3_1}\n${sysA2}x + ${sysB2}y + ${sysC2 || "0"}z = ${sysD3}\n${sysA3}x + ${sysB3}y + ${sysC3_1}z = ${sysD3}`, "system");
    }
  }

  /* ── Solve via AI backend (complex equations) ── */
  async function solveWithAI(eq?: string, aiMode?: string) {
    const eqToSolve = eq || equation;
    if (!eqToSolve.trim()) return;
    if (checkLimit && !checkLimit()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Nicht eingeloggt"); setLoading(false); return; }

      const res = await fetch("/api/math/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          equation: eqToSolve,
          variable,
          mode: aiMode || mode,
          targetVariable: targetVar || variable,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Fehler");
        setLoading(false);
        return;
      }

      setResult(data as SolverResult);
      onSave("equations", eqToSolve, (data.solutions || []).join(", "), moduleId);
    } catch {
      setError(t("math.solverError"));
    }
    setLoading(false);
  }

  function handleSolve() {
    if (mode === "quick") { solveQuick(); return; }
    if (mode === "system" && sysSize === 2 && sysA1 && sysB1) { solveSystemLocal(); return; }

    // Check if it's a simple linear/quadratic we can solve client-side
    const eq = equation.trim();
    const linearMatch = eq.match(/^(-?\d*\.?\d*)x\s*([+-]\s*\d+\.?\d*)?\s*=\s*(-?\d+\.?\d*)$/);
    if (linearMatch && mode === "solve") {
      const a = Number(linearMatch[1] || "1");
      const b = Number((linearMatch[2] || "0").replace(/\s/g, ""));
      const c = Number(linearMatch[3]);
      if (checkLimit && !checkLimit()) return;
      setResult(solveLinearSteps(a, b, c));
      setError("");
      onSave("equations", eq, `x = ${fmt((c - b) / a)}`, moduleId);
      return;
    }

    const quadMatch = eq.match(/^(-?\d*\.?\d*)x[²2]\s*([+-]\s*\d*\.?\d*)x\s*([+-]\s*\d+\.?\d*)?\s*=\s*0$/);
    if (quadMatch && mode === "solve") {
      const a = Number(quadMatch[1] || "1");
      const b = Number((quadMatch[2] || "0").replace(/\s/g, ""));
      const c = Number((quadMatch[3] || "0").replace(/\s/g, ""));
      if (checkLimit && !checkLimit()) return;
      setResult(solveQuadraticSteps(a, b, c));
      setError("");
      return;
    }

    // Everything else → AI
    solveWithAI();
  }

  const inputCls = "bg-surface-100 text-surface-900 rounded-lg px-2 sm:px-3 py-2 border border-surface-200 text-center font-mono w-14 sm:w-20 focus:border-brand-500 focus:outline-none";

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold text-surface-900">{t("math.equationSolver")}</h2>
        <select value={moduleId || ""} onChange={e => setModuleId(e.target.value || null)} className="bg-surface-100 text-surface-700 text-sm rounded-lg px-2 sm:px-3 py-1.5 border border-surface-200 min-w-0 self-start sm:self-auto">
          <option value="">{t("math.noModule")}</option>
          {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {/* Mode Tabs */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4">
        {([
          ["solve", t("math.modeSolve")],
          ["rearrange", t("math.modeRearrange")],
          ["system", t("math.systemMode")],
          ["quick", t("math.modeQuick")],
        ] as [string, string][]).map(([k, l]) => (
          <button key={k} onClick={() => { setMode(k as typeof mode); setResult(null); setError(""); }}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${mode === k ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-500 hover:bg-surface-200"}`}>
            {l}
          </button>
        ))}
      </div>

      {/* ── Solve Mode: Free text input ── */}
      {mode === "solve" && (
        <div className="space-y-3 mb-4">
          <div className="bg-surface-50 rounded-xl p-4 border border-surface-200">
            <label className="text-xs text-surface-500 mb-1.5 block font-medium">{t("math.enterEquation")}</label>
            <input
              ref={inputRef}
              value={equation}
              onChange={e => setEquation(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSolve(); }}
              placeholder={t("math.equationPlaceholder")}
              className="w-full bg-white text-surface-900 rounded-lg px-4 py-3 border border-surface-200 font-mono text-base focus:border-brand-500 focus:outline-none"
            />
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-surface-500">{t("math.variable")}:</span>
              <input value={variable} onChange={e => setVariable(e.target.value)} className="bg-white text-surface-900 rounded px-2 py-1 border border-surface-200 font-mono w-12 text-center text-sm" />
            </div>
          </div>
          <p className="text-xs text-surface-400">{t("math.solveExamples")}</p>
        </div>
      )}

      {/* ── Rearrange Mode ── */}
      {mode === "rearrange" && (
        <div className="space-y-3 mb-4">
          <div className="bg-surface-50 rounded-xl p-4 border border-surface-200">
            <label className="text-xs text-surface-500 mb-1.5 block font-medium">{t("math.enterFormula")}</label>
            <input
              ref={inputRef}
              value={equation}
              onChange={e => setEquation(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSolve(); }}
              placeholder={t("math.formulaPlaceholder")}
              className="w-full bg-white text-surface-900 rounded-lg px-4 py-3 border border-surface-200 font-mono text-base focus:border-brand-500 focus:outline-none"
            />
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-surface-500">{t("math.rearrangeFor")}:</span>
              <input value={targetVar} onChange={e => setTargetVar(e.target.value)} placeholder="U" className="bg-white text-surface-900 rounded px-2 py-1 border border-surface-200 font-mono w-16 text-center text-sm" />
            </div>
          </div>
          <p className="text-xs text-surface-400">{t("math.rearrangeExamples")}</p>
        </div>
      )}

      {/* ── System Mode ── */}
      {mode === "system" && (
        <div className="space-y-3 mb-4">
          <div className="flex gap-2 mb-2">
            <button onClick={() => setSysSize(2)} className={`px-3 py-1 rounded text-xs font-medium ${sysSize === 2 ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-500"}`}>2×2</button>
            <button onClick={() => setSysSize(3)} className={`px-3 py-1 rounded text-xs font-medium ${sysSize === 3 ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-500"}`}>3×3</button>
          </div>
          <div className="bg-surface-50 rounded-xl p-4 border border-surface-200 space-y-3">
            <div className="flex items-center gap-1.5 justify-center text-sm text-surface-900 font-mono flex-wrap">
              <input value={sysA1} onChange={e => setSysA1(e.target.value)} className={inputCls} placeholder="a₁" /><span>x +</span>
              <input value={sysB1} onChange={e => setSysB1(e.target.value)} className={inputCls} placeholder="b₁" /><span>y</span>
              {sysSize === 3 && <><span>+</span><input value={sysC1} onChange={e => setSysC1(e.target.value)} className={inputCls} placeholder="c₁" /><span>z</span></>}
              <span>=</span><input value={sysC1} onChange={e => setSysC1(e.target.value)} className={inputCls} placeholder="r₁" />
            </div>
            <div className="flex items-center gap-1.5 justify-center text-sm text-surface-900 font-mono flex-wrap">
              <input value={sysA2} onChange={e => setSysA2(e.target.value)} className={inputCls} placeholder="a₂" /><span>x +</span>
              <input value={sysB2} onChange={e => setSysB2(e.target.value)} className={inputCls} placeholder="b₂" /><span>y</span>
              {sysSize === 3 && <><span>+</span><input value={sysC2} onChange={e => setSysC2(e.target.value)} className={inputCls} placeholder="c₂" /><span>z</span></>}
              <span>=</span><input value={sysC2} onChange={e => setSysC2(e.target.value)} className={inputCls} placeholder="r₂" />
            </div>
            {sysSize === 3 && (
              <div className="flex items-center gap-1.5 justify-center text-sm text-surface-900 font-mono flex-wrap">
                <input value={sysA3} onChange={e => setSysA3(e.target.value)} className={inputCls} placeholder="a₃" /><span>x +</span>
                <input value={sysB3} onChange={e => setSysB3(e.target.value)} className={inputCls} placeholder="b₃" /><span>y +</span>
                <input value={sysC3_1} onChange={e => setSysC3_1(e.target.value)} className={inputCls} placeholder="c₃" /><span>z =</span>
                <input value={sysD3} onChange={e => setSysD3(e.target.value)} className={inputCls} placeholder="r₃" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Quick Mode (coefficient input) ── */}
      {mode === "quick" && (
        <div className="space-y-3 mb-4">
          <div className="flex gap-2 mb-2">
            <button onClick={() => setQuickType("linear")} className={`px-3 py-1 rounded text-xs font-medium ${quickType === "linear" ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-500"}`}>{t("math.linearMode")}</button>
            <button onClick={() => setQuickType("quadratic")} className={`px-3 py-1 rounded text-xs font-medium ${quickType === "quadratic" ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-500"}`}>{t("math.quadraticMode")}</button>
          </div>
          <div className="bg-surface-50 rounded-xl p-4 border border-surface-200">
            <div className="flex items-center gap-1.5 sm:gap-2 justify-center text-sm sm:text-lg text-surface-900 font-mono flex-wrap">
              <input value={coeffA} onChange={e => setCoeffA(e.target.value)} className={inputCls} />
              {quickType === "quadratic" && <span>x² +</span>}
              {quickType === "quadratic" && <input value={coeffB} onChange={e => setCoeffB(e.target.value)} className={inputCls} />}
              <span>x +</span>
              <input value={quickType === "quadratic" ? coeffC : coeffB} onChange={e => quickType === "quadratic" ? setCoeffC(e.target.value) : setCoeffB(e.target.value)} className={inputCls} />
              <span>= 0</span>
            </div>
          </div>
        </div>
      )}

      {/* Solve Button */}
      <button
        onClick={handleSolve}
        disabled={loading}
        className="w-full py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 transition-colors mb-4 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
        {mode === "rearrange" ? t("math.rearrange") : t("math.solve")}
      </button>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-red-700 text-sm">{error}</div>
      )}

      {/* ── Step-by-Step Result ── */}
      {result && (
        <div className="bg-white border border-surface-200 rounded-xl overflow-hidden mb-4">
          {/* Type badge */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-surface-50 border-b border-surface-200">
            <span className="text-xs font-medium text-brand-600 uppercase tracking-wider">{result.type}</span>
            <button onClick={() => setShowSteps(s => !s)} className="text-xs text-surface-500 hover:text-surface-900 transition">
              {showSteps ? t("math.hideSteps") : t("math.showSteps")}
            </button>
          </div>

          {/* Steps */}
          {showSteps && result.steps && result.steps.length > 0 && (
            <div className="px-4 py-3 border-b border-surface-200">
              <div className="space-y-1">
                {result.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3 py-1.5">
                    <div className="flex-1 font-mono text-sm text-surface-800 whitespace-pre-wrap">{step.expr}</div>
                    {step.op && <div className="text-xs text-surface-400 whitespace-nowrap flex-shrink-0 mt-0.5">│ {step.op}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Solutions */}
          <div className="px-4 py-3">
            {result.solutions && result.solutions.length > 0 ? (
              <div className="space-y-1.5">
                <div className="text-xs text-surface-500 font-medium uppercase tracking-wider mb-2">{t("math.solutions")}</div>
                {result.solutions.map((sol, i) => (
                  <div key={i} className="text-lg font-mono text-green-700 font-semibold">{sol}</div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-amber-600 font-medium">{t("math.noSolution")}</div>
            )}
          </div>

          {/* Domain */}
          {result.domain && (
            <div className="px-4 py-2.5 bg-surface-50 border-t border-surface-200">
              <span className="text-xs text-surface-500">{t("math.domain")}:</span>
              <span className="text-xs text-surface-800 font-mono ml-2">{result.domain}</span>
            </div>
          )}

          {/* Notes */}
          {result.notes && (
            <div className="px-4 py-2.5 border-t border-surface-200">
              <p className="text-xs text-surface-500">{result.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Quick reference */}
      <div className="mt-4">
        <h3 className="text-surface-500 text-xs font-semibold mb-2 uppercase tracking-wider">{t("math.quickRef")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            [t("math.pqFormula"), "x = −p/2 ± √((p/2)² − q)"],
            [t("math.abcFormula"), "x = (−b ± √(b²−4ac)) / 2a"],
            [t("math.vieta"), "x₁+x₂ = −b/a,  x₁·x₂ = c/a"],
            [t("math.cramersRule"), "x = det(Aₓ)/det(A)"],
          ].map(([label, f]) => (
            <div key={label} className="bg-surface-50 rounded-lg px-3 py-2 border border-surface-100">
              <div className="text-surface-500 text-xs">{label}</div>
              <div className="text-surface-800 text-sm font-mono">{f}</div>
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

function MatricesTool({ onSave, modules, checkLimit }: { onSave: (t: MathTool, e: string, r: string, m?: string | null) => void; modules: Module[]; checkLimit?: () => boolean }) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tab, setTab] = useState<"operations" | "lgs" | "analysis" | "visualization">("operations");
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [matA, setMatA] = useState<number[][]>(Array.from({ length: 3 }, () => Array(3).fill(0)));
  const [matB, setMatB] = useState<number[][]>(Array.from({ length: 3 }, () => Array(3).fill(0)));
  const [scalar, setScalar] = useState(2);
  const [operation, setOperation] = useState("det");
  const [showSteps, setShowSteps] = useState(false);
  const [result, setResult] = useState("");
  const [resultMatrix, setResultMatrix] = useState<number[][] | null>(null);
  const [steps, setSteps] = useState<{ desc: string; mat: number[][]; pRow?: number; pCol?: number; hRows?: number[] }[]>([]);
  const [lgsVars, setLgsVars] = useState(3);
  const [augmentedMat, setAugmentedMat] = useState<number[][]>(Array.from({ length: 3 }, () => Array(4).fill(0)));
  const [solutionType, setSolutionType] = useState("");
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [vizAngle, setVizAngle] = useState(45);

  const fmt = (n: number): string => {
    if (Math.abs(n) < 1e-10) return "0";
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(4).replace(/\.?0+$/, "");
  };

  const fractionStr = (num: number, denom: number): string => {
    if (Math.abs(denom) < 1e-10) return "∞";
    const val = num / denom;
    return fmt(val);
  };

  // Helper: Gauss-Jordan elimination with steps
  const gaussJordanSteps = (mat: number[][]): { steps: typeof steps; rref: number[][]; type: string } => {
    const m = mat.map(r => [...r]);
    const n = m.length;
    const c = m[0].length;
    const stepsArr: typeof steps = [];
    let currentRank = 0;

    for (let col = 0; col < c - 1; col++) {
      let pivotRow = -1;
      for (let row = currentRank; row < n; row++) {
        if (Math.abs(m[row][col]) > 1e-10) {
          pivotRow = row;
          break;
        }
      }
      if (pivotRow === -1) continue;

      if (pivotRow !== currentRank) {
        [m[currentRank], m[pivotRow]] = [m[pivotRow], m[currentRank]];
        stepsArr.push({
          desc: `R${currentRank + 1} ← R${currentRank + 1} ↔ R${pivotRow + 1}`,
          mat: m.map(r => [...r]),
          pRow: currentRank,
          hRows: [currentRank, pivotRow]
        });
      }

      const pivot = m[currentRank][col];
      if (Math.abs(pivot - 1) > 1e-10) {
        for (let j = col; j < c; j++) m[currentRank][j] /= pivot;
        stepsArr.push({
          desc: `R${currentRank + 1} ← R${currentRank + 1} / ${fmt(pivot)}`,
          mat: m.map(r => [...r]),
          pRow: currentRank,
          pCol: col
        });
      }

      for (let row = 0; row < n; row++) {
        if (row !== currentRank && Math.abs(m[row][col]) > 1e-10) {
          const factor = m[row][col];
          for (let j = col; j < c; j++) m[row][j] -= factor * m[currentRank][j];
          stepsArr.push({
            desc: `R${row + 1} ← R${row + 1} - ${fmt(factor)}·R${currentRank + 1}`,
            mat: m.map(r => [...r]),
            pRow: currentRank,
            hRows: [currentRank, row]
          });
        }
      }
      currentRank++;
    }

    // Detect solution type
    let sType = "unique";
    for (let row = currentRank; row < n; row++) {
      let allZero = true;
      for (let col = 0; col < c - 1; col++) {
        if (Math.abs(m[row][col]) > 1e-10) {
          allZero = false;
          break;
        }
      }
      if (allZero && Math.abs(m[row][c - 1]) > 1e-10) {
        sType = "no";
        break;
      }
      if (allZero && Math.abs(m[row][c - 1]) < 1e-10) {
        sType = "infinite";
      }
    }

    return { steps: stepsArr, rref: m, type: sType };
  };

  // Helper: LU decomposition
  const luDecomposition = (mat: number[][]): { L: number[][]; U: number[][]; steps: typeof steps } => {
    const n = mat.length;
    const A = mat.map(r => [...r]);
    const L: number[][] = Array.from({ length: n }, (_, i) => Array(n).fill(0).map((_, j) => i === j ? 1 : 0));
    const U: number[][] = A.map(r => [...r]);
    const stepsArr: typeof steps = [];

    for (let k = 0; k < n - 1; k++) {
      for (let i = k + 1; i < n; i++) {
        if (Math.abs(U[k][k]) < 1e-10) continue;
        const factor = U[i][k] / U[k][k];
        L[i][k] = factor;
        for (let j = k; j < n; j++) {
          U[i][j] -= factor * U[k][j];
        }
        stepsArr.push({
          desc: `L[${i + 1},${k + 1}] = ${fmt(factor)}`,
          mat: U.map(r => [...r])
        });
      }
    }

    return { L, U, steps: stepsArr };
  };

  // Tab 1: Operations
  const renderOperations = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <select value={rows} onChange={(e) => { setRows(Number(e.target.value)); setMatA(Array.from({ length: Number(e.target.value) }, () => Array(cols).fill(0))); }} className="bg-surface-100 text-surface-700 text-sm rounded-lg px-3 py-1.5 border border-surface-200">
          <option value={2}>2×2</option>
          <option value={3}>3×3</option>
          <option value={4}>4×4</option>
          <option value={5}>5×5</option>
        </select>
        <select value={cols} onChange={(e) => { setCols(Number(e.target.value)); setMatA(Array.from({ length: rows }, () => Array(Number(e.target.value)).fill(0))); }} className="bg-surface-100 text-surface-700 text-sm rounded-lg px-3 py-1.5 border border-surface-200">
          <option value={2}>2 cols</option>
          <option value={3}>3 cols</option>
          <option value={4}>4 cols</option>
          <option value={5}>5 cols</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showSteps} onChange={(e) => setShowSteps(e.target.checked)} className="rounded" />
          {t("math.matStepByStep")}
        </label>
      </div>

      <div className="bg-surface-50 rounded-lg p-3 border border-surface-200">
        <div className="text-sm text-surface-600 mb-2">Matrix A</div>
        <div className="border-l-2 border-r-2 border-surface-300 px-2 py-1 inline-block">
          {matA.map((row, r) => (
            <div key={r} className="flex gap-1">
              {row.map((v, c) => (
                <input key={c} type="number" value={v || ""} onChange={(e) => { const copy = matA.map(r => [...r]); copy[r][c] = Number(e.target.value) || 0; setMatA(copy); }} className="w-12 h-9 bg-white text-surface-900 text-center rounded border border-surface-200 text-sm font-mono" />
              ))}
            </div>
          ))}
        </div>
      </div>

      {(operation === "multiply" || operation === "add" || operation === "subtract") && (
        <div className="bg-surface-50 rounded-lg p-3 border border-surface-200">
          <div className="text-sm text-surface-600 mb-2">Matrix B</div>
          <div className="border-l-2 border-r-2 border-surface-300 px-2 py-1 inline-block">
            {matB.map((row, r) => (
              <div key={r} className="flex gap-1">
                {row.map((v, c) => (
                  <input key={c} type="number" value={v || ""} onChange={(e) => { const copy = matB.map(r => [...r]); copy[r][c] = Number(e.target.value) || 0; setMatB(copy); }} className="w-12 h-9 bg-white text-surface-900 text-center rounded border border-surface-200 text-sm font-mono" />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {operation === "scalar_mul" && (
        <div className="bg-surface-50 rounded-lg p-3 border border-surface-200">
          <label className="text-sm text-surface-600">{t("math.matScalar")} k</label>
          <input type="number" value={scalar} onChange={(e) => setScalar(Number(e.target.value))} className="w-20 h-9 bg-white text-surface-900 px-2 rounded border border-surface-200 text-sm font-mono mt-1" />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          ["det", t("math.determinant")],
          ["transpose", t("math.transpose")],
          ["inverse", t("math.inverse")],
          ["add", t("math.matAdd")],
          ["subtract", t("math.matSubtract")],
          ["scalar_mul", t("math.matScalarMul")],
          ["multiply", t("math.matMul")],
          ["power", t("math.matPower")]
        ].map(([k, l]) => (
          <button key={k} onClick={() => setOperation(k)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${operation === k ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200"}`}>{l}</button>
        ))}
      </div>

      <button onClick={() => {
        let expr = "", res = "", mat: number[][] | null = null;
        try {
          if (operation === "det") {
            const d = matDet(matA);
            expr = `det(A)`;
            res = fmt(d);
            setResult(`${t("math.determinant")} = ${res}`);
          } else if (operation === "transpose") {
            mat = matTranspose(matA);
            expr = `A^T`;
            res = mat.map(r => r.map(fmt).join(",")).join("|");
            setResultMatrix(mat);
            setResult(`${t("math.transpose")}:`);
          } else if (operation === "inverse") {
            mat = matInverse2(matA);
            if (!mat) return setResult(t("math.notInvertible"));
            expr = `A^-1`;
            res = mat.map(r => r.map(fmt).join(",")).join("|");
            setResultMatrix(mat);
            setResult(`${t("math.inverse")}:`);
          } else if (operation === "add") {
            mat = matA.map((r, i) => r.map((v, j) => v + (matB[i]?.[j] || 0)));
            expr = `A + B`;
            res = mat.map(r => r.map(fmt).join(",")).join("|");
            setResultMatrix(mat);
            setResult("A + B =");
          } else if (operation === "subtract") {
            mat = matA.map((r, i) => r.map((v, j) => v - (matB[i]?.[j] || 0)));
            expr = `A - B`;
            res = mat.map(r => r.map(fmt).join(",")).join("|");
            setResultMatrix(mat);
            setResult("A - B =");
          } else if (operation === "scalar_mul") {
            mat = matA.map(r => r.map(v => v * scalar));
            expr = `${scalar} * A`;
            res = mat.map(r => r.map(fmt).join(",")).join("|");
            setResultMatrix(mat);
            setResult(`${scalar} * A =`);
          } else if (operation === "multiply") {
            mat = matMultiply(matA, matB);
            if (!mat) return setResult(t("math.dimensionError"));
            expr = `A × B`;
            res = mat.map(r => r.map(fmt).join(",")).join("|");
            setResultMatrix(mat);
            setResult("A × B =");
          } else if (operation === "power") {
            mat = matA;
            expr = `A^2`;
            mat = matMultiply(mat, mat);
            if (!mat) return setResult(t("math.dimensionError"));
            res = mat.map(r => r.map(fmt).join(",")).join("|");
            setResultMatrix(mat);
            setResult("A² =");
          }
          setSteps([]);
          if (checkLimit && !checkLimit()) return;
          onSave("matrices", expr, res, moduleId);
        } catch (e) {
          setResult("Error: " + String(e));
        }
      }} className="w-full py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700">{t("math.calculate")}</button>

      {result && (
        <div className="bg-surface-50 rounded-lg p-4 border border-surface-200">
          <div className="text-success-600 font-mono text-lg mb-3">{result}</div>
          {resultMatrix && (
            <div className="border-l-2 border-r-2 border-success-200 px-2 py-1 inline-block">
              {resultMatrix.map((row, r) => (
                <div key={r} className="flex gap-2">
                  {row.map((v, c) => (
                    <div key={c} className="w-14 h-8 flex items-center justify-center text-success-600 font-mono text-sm">{fmt(v)}</div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Tab 2: Linear Systems (Gauss-Jordan)
  const renderLGS = () => {
    const n = lgsVars;
    return (
      <div className="space-y-4">
        <div className="flex gap-3 items-center">
          <select value={lgsVars} onChange={(e) => { const nv = Number(e.target.value); setLgsVars(nv); setAugmentedMat(Array.from({ length: nv }, () => Array(nv + 1).fill(0))); }} className="bg-surface-100 text-surface-700 text-sm rounded-lg px-3 py-1.5 border border-surface-200">
            <option value={2}>2 Vars</option>
            <option value={3}>3 Vars</option>
            <option value={4}>4 Vars</option>
          </select>
          <div className="text-sm text-surface-600">[A|b]</div>
        </div>

        <div className="bg-surface-50 rounded-lg p-3 border border-surface-200">
          <div className="border-l-2 border-r-2 border-surface-300 px-2 py-1 inline-block">
            {augmentedMat.map((row, r) => (
              <div key={r} className="flex gap-1 items-center">
                {row.map((v, c) => (
                  <input key={c} type="number" value={v || ""} onChange={(e) => { const copy = augmentedMat.map(r => [...r]); copy[r][c] = Number(e.target.value) || 0; setAugmentedMat(copy); }} className={`w-12 h-9 bg-white text-surface-900 text-center rounded border ${c === n ? "border-brand-400" : "border-surface-200"} text-sm font-mono`} />
                ))}
              </div>
            ))}
          </div>
        </div>

        <button onClick={() => {
          const { steps: s, rref, type } = gaussJordanSteps(augmentedMat);
          setSteps(s);
          setSolutionType(type);
          if (type === "no") setResult(t("math.matNoSolution"));
          else if (type === "infinite") setResult(t("math.matInfiniteSolutions"));
          else setResult(t("math.matUniqueSolution"));
          setResultMatrix(rref);
          if (checkLimit && !checkLimit()) return;
          onSave("matrices", "Gauss-Jordan", type, moduleId);
        }} className="w-full py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700">{t("math.matGaussElimination")}</button>

        {steps.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {steps.map((step, i) => (
              <div key={i} className="bg-surface-50 rounded-lg p-3 border border-surface-200 text-xs">
                <div className="font-mono text-brand-600 mb-2">{step.desc}</div>
                <div className="border-l border-surface-300 px-2 py-1 inline-block">
                  {step.mat.map((row, r) => (
                    <div key={r} className={`flex gap-1 ${step.hRows?.includes(r) ? "bg-brand-100 px-1 rounded" : ""}`}>
                      {row.map((v, c) => (
                        <div key={c} className={`w-10 h-6 flex items-center justify-center text-surface-700 font-mono text-xs ${step.pCol === c && step.pRow === r ? "bg-yellow-300 rounded" : ""}`}>{fmt(v)}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {resultMatrix && (
          <div className="bg-success-50 rounded-lg p-3 border border-success-200">
            <div className="text-sm text-success-700 font-semibold mb-2">{t("math.matRREF")}:</div>
            <div className="border-l-2 border-r-2 border-success-200 px-2 py-1 inline-block">
              {resultMatrix.map((row, r) => (
                <div key={r} className="flex gap-2">
                  {row.map((v, c) => (
                    <div key={c} className="w-12 h-8 flex items-center justify-center text-success-600 font-mono text-sm">{fmt(v)}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Tab 3: Analysis (Eigenvalues, Decompositions, Rank)
  const renderAnalysis = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button onClick={() => {
          const m = matA;
          const n = m.length;
          if (n === 2) {
            const trace = m[0][0] + m[1][1];
            const det = matDet(m);
            const disc = trace * trace - 4 * det;
            let res = "";
            if (disc >= 0) {
              const l1 = (trace + Math.sqrt(disc)) / 2;
              const l2 = (trace - Math.sqrt(disc)) / 2;
              res = `λ₁ = ${fmt(l1)}, λ₂ = ${fmt(l2)}`;
            } else {
              const re = trace / 2;
              const im = Math.sqrt(-disc) / 2;
              res = `λ₁ = ${fmt(re)} + ${fmt(im)}i, λ₂ = ${fmt(re)} − ${fmt(im)}i`;
            }
            setResult(res);
            onSave("matrices", "eigenvalues", res, moduleId);
          } else {
            setResult(t("math.eigenvaluesFor2x2Only"));
          }
        }} className="px-4 py-3 rounded-lg bg-brand-100 text-brand-700 font-semibold hover:bg-brand-200">{t("math.matEigenvalues")}</button>

        <button onClick={() => {
          const m = matA;
          let rk = 0;
          const mCopy = m.map(r => [...r]);
          for (let col = 0; col < mCopy[0].length; col++) {
            let pr = -1;
            for (let row = rk; row < m.length; row++) {
              if (Math.abs(mCopy[row][col]) > 1e-10) { pr = row; break; }
            }
            if (pr === -1) continue;
            [mCopy[rk], mCopy[pr]] = [mCopy[pr], mCopy[rk]];
            const pv = mCopy[rk][col];
            for (let j = col; j < mCopy[0].length; j++) mCopy[rk][j] /= pv;
            for (let row = rk + 1; row < m.length; row++) {
              const f = mCopy[row][col];
              for (let j = col; j < mCopy[0].length; j++) mCopy[row][j] -= f * mCopy[rk][j];
            }
            rk++;
          }
          setResult(`${t("math.matRank")} = ${rk}`);
          onSave("matrices", "rank", String(rk), moduleId);
        }} className="px-4 py-3 rounded-lg bg-brand-100 text-brand-700 font-semibold hover:bg-brand-200">{t("math.matRank")}</button>

        <button onClick={() => {
          const { L, U, steps: s } = luDecomposition(matA);
          setSteps(s);
          setResultMatrix(U);
          setResult(t("math.matLU"));
          onSave("matrices", "LU", "decomposed", moduleId);
        }} className="px-4 py-3 rounded-lg bg-brand-100 text-brand-700 font-semibold hover:bg-brand-200">{t("math.matLU")}</button>

        <button onClick={() => {
          const trace = matA.reduce((s, r, i) => s + (r[i] || 0), 0);
          const det = matDet(matA);
          setResult(`Trace = ${fmt(trace)}, Det = ${fmt(det)}`);
          onSave("matrices", "trace-det", `Trace = ${fmt(trace)}, Det = ${fmt(det)}`, moduleId);
        }} className="px-4 py-3 rounded-lg bg-brand-100 text-brand-700 font-semibold hover:bg-brand-200">{t("math.matTraceDet")}</button>
      </div>

      {steps.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {steps.map((step, i) => (
            <div key={i} className="bg-surface-50 rounded-lg p-2 border border-surface-200 text-xs font-mono">
              {step.desc}
            </div>
          ))}
        </div>
      )}

      {result && (
        <div className="bg-success-50 rounded-lg p-3 border border-success-200">
          <div className="text-success-700 font-semibold text-sm">{result}</div>
        </div>
      )}
    </div>
  );

  // Tab 4: Visualization (2D Transformations)
  const renderVisualization = () => (
    <div className="space-y-4">
      {rows === 2 && cols === 2 ? (
        <>
          <div className="flex gap-3 items-center">
            <label className="text-sm">{t("math.matRotation")}: {vizAngle}°</label>
            <input type="range" min="0" max="360" value={vizAngle} onChange={(e) => setVizAngle(Number(e.target.value))} className="flex-1" />
          </div>
          <button onClick={() => {
            const rad = (vizAngle * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const rot = [[cos, -sin], [sin, cos]];
            setMatA(rot);
          }} className="px-4 py-2 rounded-lg bg-surface-200 text-surface-700 text-sm hover:bg-surface-300">{t("math.matApplyRotation")}</button>
          <canvas ref={canvasRef} width={300} height={300} className="border-2 border-surface-300 rounded-lg bg-surface-50 mx-auto" />
        </>
      ) : (
        <div className="text-surface-600 text-center p-4">{t("math.matViz2x2Only")}</div>
      )}
    </div>
  );

  // Draw transformation on canvas
  useEffect(() => {
    if (tab !== "visualization" || !canvasRef.current || rows !== 2 || cols !== 2) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, sc = 50;

    // Grid
    ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 0.5;
    for (let i = -6; i <= 6; i++) {
      ctx.beginPath(); ctx.moveTo(cx + i * sc, 0); ctx.lineTo(cx + i * sc, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, cy + i * sc); ctx.lineTo(W, cy + i * sc); ctx.stroke();
    }
    // Axes
    ctx.strokeStyle = "#9ca3af"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();

    const toScreen = (x: number, y: number): [number, number] => [cx + x * sc, cy - y * sc];

    // Unit square (gray dashed)
    ctx.setLineDash([4, 4]); ctx.strokeStyle = "#9ca3af"; ctx.lineWidth = 1;
    ctx.beginPath();
    const u = [[0,0],[1,0],[1,1],[0,1]];
    u.forEach((p, i) => { const [sx, sy] = toScreen(p[0], p[1]); i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy); });
    ctx.closePath(); ctx.stroke();
    ctx.fillStyle = "rgba(156,163,175,0.08)"; ctx.fill();
    ctx.setLineDash([]);

    // Transformed parallelogram
    const a = matA[0][0], b = matA[0][1], c2 = matA[1][0], d = matA[1][1];
    const tp = [[0,0],[a,c2],[a+b,c2+d],[b,d]];
    ctx.strokeStyle = "#8b5cf6"; ctx.lineWidth = 2;
    ctx.beginPath();
    tp.forEach((p, i) => { const [sx, sy] = toScreen(p[0], p[1]); i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy); });
    ctx.closePath(); ctx.stroke();
    ctx.fillStyle = "rgba(139,92,246,0.12)"; ctx.fill();

    // Draw arrow vector
    const drawVec = (x: number, y: number, color: string, label: string) => {
      const [ex, ey] = toScreen(x, y);
      ctx.strokeStyle = color; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      // Arrowhead
      const angle = Math.atan2(cy - ey, ex - cx);
      ctx.fillStyle = color; ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - 10 * Math.cos(angle - 0.3), ey + 10 * Math.sin(angle - 0.3));
      ctx.lineTo(ex - 10 * Math.cos(angle + 0.3), ey + 10 * Math.sin(angle + 0.3));
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = color; ctx.font = "bold 12px monospace";
      ctx.fillText(label, ex + 8, ey - 8);
    };

    drawVec(1, 0, "#9ca3af", "e₁");
    drawVec(0, 1, "#9ca3af", "e₂");
    drawVec(a, c2, "#8b5cf6", "f₁");
    drawVec(b, d, "#ec4899", "f₂");

    // Det annotation
    const det = a * d - b * c2;
    ctx.fillStyle = "#6b7280"; ctx.font = "12px sans-serif";
    ctx.fillText(`|det| = ${Math.abs(det).toFixed(2)}`, 8, H - 8);
  }, [tab, matA, rows, cols]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold text-surface-900">{t("math.matrices")}</h2>
        <select value={moduleId || ""} onChange={(e) => setModuleId(e.target.value || null)} className="bg-surface-100 text-surface-700 text-sm rounded-lg px-3 py-1.5 border border-surface-200 w-full sm:w-auto">
          <option value="">{t("math.noModule")}</option>
          {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <div className="flex gap-2 border-b border-surface-200 overflow-x-auto">
        {[
          ["operations", t("math.matOperations")],
          ["lgs", t("math.matLGS")],
          ["analysis", t("math.matAnalysis")],
          ["visualization", t("math.matVisualization")]
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as typeof tab)} className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${tab === k ? "border-brand-600 text-brand-600" : "border-transparent text-surface-600 hover:text-surface-900"}`}>{l}</button>
        ))}
      </div>

      {tab === "operations" && renderOperations()}
      {tab === "lgs" && renderLGS()}
      {tab === "analysis" && renderAnalysis()}
      {tab === "visualization" && renderVisualization()}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* TOOL 4: Function Plotter                                                   */
/* ═══════════════════════════════════════════════════════════════════════════ */

function PlotterTool({ onSave, modules, checkLimit }: { onSave: (t: MathTool, e: string, r: string, m?: string | null) => void; modules: Module[]; checkLimit?: () => boolean }) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [functions, setFunctions] = useState<{ expr: string; color: string }[]>([{ expr: "sin(x)", color: "#8b5cf6" }]);
  const [xMin, setXMin] = useState(-10);
  const [xMax, setXMax] = useState(10);
  const [yMin, setYMin] = useState(-5);
  const [yMax, setYMax] = useState(5);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [showDerivative, setShowDerivative] = useState(false);
  const [paramMode, setParamMode] = useState(false);
  const [params, setParams] = useState({ a: 1, b: 0, c: 0 });
  const [tangentPoint, setTangentPoint] = useState<{ x: number; y: number; m: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

  const evalExpr = useCallback((expr: string, x: number, p?: { a: number; b: number; c: number }): number => {
    let e = expr
      .replace(/\ba\b/g, p ? `(${p.a})` : "a")
      .replace(/\bb\b/g, p ? `(${p.b})` : "b")
      .replace(/\bc\b/g, p ? `(${p.c})` : "c")
      .replace(/\bx\b/g, `(${x})`)
      .replace(/π/g, `(${Math.PI})`)
      .replace(/\be\b/g, `(${Math.E})`)
      .replace(/sin\(/g, "Math.sin(")
      .replace(/cos\(/g, "Math.cos(")
      .replace(/tan\(/g, "Math.tan(")
      .replace(/asin\(/g, "Math.asin(")
      .replace(/acos\(/g, "Math.acos(")
      .replace(/atan\(/g, "Math.atan(")
      .replace(/sqrt\(/g, "Math.sqrt(")
      .replace(/abs\(/g, "Math.abs(")
      .replace(/floor\(/g, "Math.floor(")
      .replace(/ceil\(/g, "Math.ceil(")
      .replace(/ln\(/g, "Math.log(")
      .replace(/log\(/g, "Math.log10(")
      .replace(/exp\(/g, "Math.exp(")
      .replace(/\^/g, "**");
    try {
      return Function(`"use strict"; return (${e})`)();
    } catch {
      return NaN;
    }
  }, []);

  const derivative = useCallback((expr: string, x: number, p?: { a: number; b: number; c: number }): number => {
    const h = 1e-6;
    const f1 = evalExpr(expr, x + h, p);
    const f2 = evalExpr(expr, x - h, p);
    return (f1 - f2) / (2 * h);
  }, [evalExpr]);

  const findZeros = useCallback((expr: string, xMin: number, xMax: number, p?: { a: number; b: number; c: number }): number[] => {
    const zeros: number[] = [];
    const step = (xMax - xMin) / 200;
    for (let i = 0; i < 200; i++) {
      const a = xMin + i * step;
      const b = a + step;
      const fa = evalExpr(expr, a, p);
      const fb = evalExpr(expr, b, p);
      if (!isNaN(fa) && !isNaN(fb) && fa * fb < 0) {
        let x = a;
        for (let j = 0; j < 20; j++) {
          const fx = evalExpr(expr, x, p);
          if (Math.abs(fx) < 1e-6) break;
          const dx = derivative(expr, x, p);
          if (Math.abs(dx) < 1e-10) break;
          x -= fx / dx;
        }
        if (Math.abs(evalExpr(expr, x, p)) < 1e-4 && !zeros.some(z => Math.abs(z - x) < 0.1)) zeros.push(x);
      }
    }
    return zeros;
  }, [evalExpr, derivative]);

  const findExtrema = useCallback((expr: string, xMin: number, xMax: number, p?: { a: number; b: number; c: number }): { x: number; y: number; type: string }[] => {
    const extrema: { x: number; y: number; type: string }[] = [];
    const step = (xMax - xMin) / 100;
    for (let i = 1; i < 99; i++) {
      const x = xMin + i * step;
      const d1 = derivative(expr, x, p);
      const d2 = derivative(expr, x + 0.0001, p) - d1;
      if (Math.abs(d1) < 1e-3) {
        const y = evalExpr(expr, x, p);
        if (!isNaN(y) && isFinite(y)) {
          const type = d2 > 0 ? "min" : d2 < 0 ? "max" : "neither";
          if (type !== "neither" && !extrema.some(e => Math.abs(e.x - x) < 0.2)) extrema.push({ x, y, type });
        }
      }
    }
    return extrema;
  }, [evalExpr, derivative]);

  const findInflections = useCallback((expr: string, xMin: number, xMax: number, p?: { a: number; b: number; c: number }): number[] => {
    const inflections: number[] = [];
    const step = (xMax - xMin) / 100;
    for (let i = 1; i < 99; i++) {
      const x = xMin + i * step;
      const d2a = derivative(expr, x - 0.0001, p);
      const d2b = derivative(expr, x + 0.0001, p);
      if (d2a * d2b < 0 && !isNaN(d2a) && !isNaN(d2b)) {
        if (!inflections.some(inf => Math.abs(inf - x) < 0.2)) inflections.push(x);
      }
    }
    return inflections;
  }, [derivative]);

  const findIntersections = useCallback((expr1: string, expr2: string, xMin: number, xMax: number, p?: { a: number; b: number; c: number }): number[] => {
    const intersections: number[] = [];
    const step = (xMax - xMin) / 200;
    for (let i = 0; i < 200; i++) {
      const a = xMin + i * step;
      const b = a + step;
      const diff_a = evalExpr(expr1, a, p) - evalExpr(expr2, a, p);
      const diff_b = evalExpr(expr1, b, p) - evalExpr(expr2, b, p);
      if (!isNaN(diff_a) && !isNaN(diff_b) && diff_a * diff_b < 0) {
        let x = a;
        for (let j = 0; j < 15; j++) {
          const v1 = evalExpr(expr1, x, p);
          const v2 = evalExpr(expr2, x, p);
          if (isNaN(v1) || isNaN(v2)) break;
          const diff = v1 - v2;
          if (Math.abs(diff) < 1e-6) break;
          const dx = derivative(expr1, x, p) - derivative(expr2, x, p);
          if (Math.abs(dx) < 1e-10) break;
          x -= diff / dx;
        }
        if (!intersections.some(inter => Math.abs(inter - x) < 0.15)) intersections.push(x);
      }
    }
    return intersections;
  }, [evalExpr, derivative]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    const toScreen = (mx: number, my: number): [number, number] => [
      ((mx - xMin) / (xMax - xMin)) * W,
      H - ((my - yMin) / (yMax - yMin)) * H,
    ];

    const fromScreen = (px: number, py: number): [number, number] => [
      xMin + (px / W) * (xMax - xMin),
      yMax - (py / H) * (yMax - yMin),
    ];

    ctx.strokeStyle = "#e2e8f0";
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

    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    const [ox, oy] = toScreen(0, 0);
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(W, oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, H); ctx.stroke();

    ctx.fillStyle = "#64748b";
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

    functions.forEach((fn) => {
      if (!fn.expr.trim()) return;
      ctx.strokeStyle = fn.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      let started = false;
      for (let px = 0; px < W; px++) {
        const mx = xMin + (px / W) * (xMax - xMin);
        const my = evalExpr(fn.expr, mx, paramMode ? params : undefined);
        if (isNaN(my) || !isFinite(my)) { started = false; continue; }
        const [, sy] = toScreen(mx, my);
        if (!started) { ctx.moveTo(px, sy); started = true; } else { ctx.lineTo(px, sy); }
      }
      ctx.stroke();

      if (showDerivative) {
        ctx.strokeStyle = fn.color + "80";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        let started = false;
        for (let px = 0; px < W; px++) {
          const mx = xMin + (px / W) * (xMax - xMin);
          const dy = derivative(fn.expr, mx, paramMode ? params : undefined);
          if (isNaN(dy) || !isFinite(dy)) { started = false; continue; }
          const [, sy] = toScreen(mx, dy);
          if (!started) { ctx.moveTo(px, sy); started = true; } else { ctx.lineTo(px, sy); }
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    if (functions.length > 1) {
      const valid = functions.filter(f => f.expr.trim());
      for (let i = 0; i < valid.length - 1; i++) {
        const inter = findIntersections(valid[i].expr, valid[i + 1].expr, xMin, xMax, paramMode ? params : undefined);
        inter.forEach(ix => {
          const iy = evalExpr(valid[i].expr, ix, paramMode ? params : undefined);
          if (!isNaN(iy) && isFinite(iy)) {
            const [sx, sy] = toScreen(ix, iy);
            ctx.fillStyle = "#64748b";
            ctx.fillRect(sx - 4, sy - 4, 8, 8);
          }
        });
      }
    }

    if (tangentPoint) {
      const [sx, sy] = toScreen(tangentPoint.x, tangentPoint.y);
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 1.5;
      const x1 = xMin, y1 = tangentPoint.y + tangentPoint.m * (x1 - tangentPoint.x);
      const x2 = xMax, y2 = tangentPoint.y + tangentPoint.m * (x2 - tangentPoint.x);
      const [sx1, sy1] = toScreen(x1, y1);
      const [sx2, sy2] = toScreen(x2, y2);
      ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke();
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill();
    }

    if (mousePos) {
      ctx.strokeStyle = "#ffffff30";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(mousePos.x, 0); ctx.lineTo(mousePos.x, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, mousePos.y); ctx.lineTo(W, mousePos.y); ctx.stroke();
      ctx.setLineDash([]);
      const [mx, my] = fromScreen(mousePos.x, mousePos.y);
      ctx.fillStyle = "#475569";
      ctx.font = "12px monospace";
      ctx.fillText(`(${mx.toFixed(2)}, ${my.toFixed(2)})`, mousePos.x + 10, mousePos.y - 10);
    }
  }, [functions, xMin, xMax, yMin, yMax, mousePos, evalExpr, derivative, showDerivative, tangentPoint, paramMode, params, findIntersections]);

  useEffect(() => { draw(); }, [draw]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });
    if (isDragging && dragStart) {
      const dx = (dragStart.x - x) / rect.width * (xMax - xMin);
      const dy = (y - dragStart.y) / rect.height * (yMax - yMin);
      setXMin(xMin + dx);
      setXMax(xMax + dx);
      setYMin(yMin + dy);
      setYMax(yMax + dy);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setIsDragging(true);
    setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseUp = () => { setIsDragging(false); setDragStart(null); };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const x = xMin + (px / rect.width) * (xMax - xMin);
    const y = yMax - (py / rect.height) * (yMax - yMin);
    if (functions.length > 0 && functions[0].expr.trim()) {
      const m = derivative(functions[0].expr, x, paramMode ? params : undefined);
      if (!isNaN(m) && isFinite(m)) setTangentPoint({ x, y, m });
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.2 : 0.8;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const cx = xMin + (px / rect.width) * (xMax - xMin);
    const w = (xMax - xMin) * factor;
    setXMin(cx - (w * px) / rect.width);
    setXMax(cx + (w * (rect.width - px)) / rect.width);
  };

  const addFunction = () => {
    setFunctions([...functions, { expr: "", color: COLORS[functions.length % COLORS.length] }]);
  };

  const analysis = useMemo(() => {
    return functions.map((fn, idx) => {
      if (!fn.expr.trim()) return { idx, zeros: [], extrema: [], inflections: [], yIntercept: null, domain: "" };
      const p = paramMode ? params : undefined;
      const zeros = findZeros(fn.expr, xMin, xMax, p);
      const extrema = findExtrema(fn.expr, xMin, xMax, p);
      const inflections = findInflections(fn.expr, xMin, xMax, p);
      const yIntercept = evalExpr(fn.expr, 0, p);
      return { idx, zeros, extrema, inflections, yIntercept: isNaN(yIntercept) ? null : yIntercept, domain: "" };
    });
  }, [functions, xMin, xMax, paramMode, params, findZeros, findExtrema, findInflections, evalExpr]);

  const savePlot = () => {
    if (checkLimit && !checkLimit()) return;
    const expr = functions.map((f) => f.expr).filter(Boolean).join(", ");
    onSave("plotter", `f(x) = ${expr}`, `[${xMin}, ${xMax}] × [${yMin}, ${yMax}]`, moduleId);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold text-surface-900">{t("math.functionPlotter")}</h2>
        <div className="flex items-center gap-2">
          <select value={moduleId || ""} onChange={(e) => setModuleId(e.target.value || null)} className="bg-surface-100 text-surface-700 text-sm rounded-lg px-2 sm:px-3 py-1.5 border border-surface-200 min-w-0 flex-1 sm:flex-none">
            <option value="">{t("math.noModule")}</option>
            {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button onClick={savePlot} className="px-3 py-1.5 rounded-lg bg-surface-100 text-surface-700 text-sm hover:bg-surface-200 whitespace-nowrap">💾 {t("math.save")}</button>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {functions.map((fn, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: fn.color }} />
            <span className="text-surface-500 text-sm font-mono">f{i > 0 ? i + 1 : ""}(x) =</span>
            <input value={fn.expr} onChange={(e) => { const copy = [...functions]; copy[i] = { ...copy[i], expr: e.target.value }; setFunctions(copy); }} placeholder={t("math.exampleFunctions")} className="flex-1 bg-surface-100 text-surface-900 rounded-lg px-3 py-2 border border-surface-200 font-mono text-sm" />
            {functions.length > 1 && <button onClick={() => setFunctions(functions.filter((_, j) => j !== i))} className="text-surface-400 hover:text-danger-600">✕</button>}
          </div>
        ))}
        <button onClick={addFunction} className="text-brand-600 text-sm hover:text-brand-500">+ {t("math.addFunction")}</button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap text-sm">
        <button onClick={() => setShowAnalysis(!showAnalysis)} className={`px-3 py-1.5 rounded ${showAnalysis ? "bg-brand-500 text-white" : "bg-surface-100 text-surface-700"}`}>{t("math.plotAnalysis")}</button>
        <button onClick={() => setShowDerivative(!showDerivative)} className={`px-3 py-1.5 rounded ${showDerivative ? "bg-brand-500 text-white" : "bg-surface-100 text-surface-700"}`}>{t("math.plotDerivative")}</button>
        <button onClick={() => setParamMode(!paramMode)} className={`px-3 py-1.5 rounded ${paramMode ? "bg-brand-500 text-white" : "bg-surface-100 text-surface-700"}`}>{t("math.plotParameters")}</button>
      </div>

      {paramMode && (
        <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
          {Object.entries(params).map(([key, val]) => (
            <div key={key}>
              <label className="text-surface-600 block text-xs mb-1">{key} = {val.toFixed(1)}</label>
              <input type="range" min="-10" max="10" step="0.1" value={val} onChange={(e) => setParams({ ...params, [key]: parseFloat(e.target.value) })} className="w-full" />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 sm:gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1 text-surface-500">
          x: <input value={xMin} onChange={(e) => setXMin(Number(e.target.value))} className="w-12 sm:w-16 bg-surface-100 text-surface-900 rounded px-1 sm:px-2 py-1 border border-surface-200 font-mono text-center text-xs sm:text-sm" />
          {t("math.to")} <input value={xMax} onChange={(e) => setXMax(Number(e.target.value))} className="w-12 sm:w-16 bg-surface-100 text-surface-900 rounded px-1 sm:px-2 py-1 border border-surface-200 font-mono text-center text-xs sm:text-sm" />
        </div>
        <div className="flex items-center gap-1 text-surface-500">
          y: <input value={yMin} onChange={(e) => setYMin(Number(e.target.value))} className="w-12 sm:w-16 bg-surface-100 text-surface-900 rounded px-1 sm:px-2 py-1 border border-surface-200 font-mono text-center text-xs sm:text-sm" />
          {t("math.to")} <input value={yMax} onChange={(e) => setYMax(Number(e.target.value))} className="w-12 sm:w-16 bg-surface-100 text-surface-900 rounded px-1 sm:px-2 py-1 border border-surface-200 font-mono text-center text-xs sm:text-sm" />
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => { setXMin(xMin * 0.5); setXMax(xMax * 0.5); setYMin(yMin * 0.5); setYMax(yMax * 0.5); }} className="px-2 py-1 bg-surface-100 text-surface-700 rounded hover:bg-surface-200 text-xs">🔍+</button>
          <button onClick={() => { setXMin(xMin * 2); setXMax(xMax * 2); setYMin(yMin * 2); setYMax(yMax * 2); }} className="px-2 py-1 bg-surface-100 text-surface-700 rounded hover:bg-surface-200 text-xs">🔍−</button>
          <button onClick={() => { setXMin(-10); setXMax(10); setYMin(-5); setYMax(5); }} className="px-2 py-1 bg-surface-100 text-surface-700 rounded hover:bg-surface-200 text-xs">↺</button>
        </div>
      </div>

      <canvas ref={canvasRef} width={800} height={500} onMouseMove={handleMouseMove} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onClick={handleCanvasClick} onWheel={handleWheel} className="w-full rounded-xl border border-surface-200 cursor-crosshair" />

      <div className="mt-4 flex flex-wrap gap-2">
        {["sin(x)", "cos(x)", "tan(x)", "x^2", "x^3", "sqrt(x)", "1/x", "ln(x)", "e^x", "abs(x)"].map((f) => (
          <button key={f} onClick={() => setFunctions([{ expr: f, color: COLORS[0] }])} className="px-2 py-1 bg-surface-100 text-surface-500 rounded text-xs font-mono hover:bg-surface-200 hover:text-surface-900">{f}</button>
        ))}
      </div>

      {showAnalysis && analysis.some(a => a.zeros.length || a.extrema.length || a.inflections.length) && (
        <div className="mt-4 space-y-3 text-sm border-t border-surface-200 pt-4">
          {analysis.map((a) => (
            a.zeros.length || a.extrema.length || a.inflections.length ? (
              <div key={a.idx} className="p-3 bg-surface-50 rounded-lg border border-surface-200">
                <h3 className="font-semibold text-surface-900 mb-2">f{a.idx > 0 ? a.idx + 1 : ""}(x)</h3>
                {a.zeros.length > 0 && <p className="text-surface-600"><span className="font-medium">{t("math.plotZeros")}:</span> {a.zeros.map(z => z.toFixed(3)).join(", ")}</p>}
                {a.extrema.length > 0 && <p className="text-surface-600"><span className="font-medium">{t("math.plotExtrema")}:</span> {a.extrema.map(e => `(${e.x.toFixed(2)}, ${e.y.toFixed(2)}) ${e.type === "min" ? t("math.plotMin") : t("math.plotMax")}`).join("; ")}</p>}
                {a.inflections.length > 0 && <p className="text-surface-600"><span className="font-medium">{t("math.plotInflections")}:</span> {a.inflections.map(i => i.toFixed(3)).join(", ")}</p>}
                {a.yIntercept !== null && <p className="text-surface-600"><span className="font-medium">{t("math.plotYIntercept")}:</span> {a.yIntercept.toFixed(3)}</p>}
              </div>
            ) : null
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* TOOL 5: Statistics Tool                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

function StatisticsTool({ onSave, modules, checkLimit }: { onSave: (t: MathTool, e: string, r: string, m?: string | null) => void; modules: Module[]; checkLimit?: () => boolean }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"deskriptiv" | "verteilungen" | "tests" | "regression" | "visualisierung">("deskriptiv");
  const [data, setData] = useState("5, 8, 12, 7, 9, 15, 6, 11, 10, 8");
  const [xData, setXData] = useState("");
  const [yData, setYData] = useState("");
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [chartType, setChartType] = useState<"histogram" | "boxplot">("histogram");

  // Distribution params
  const [distMode, setDistMode] = useState<"binomial" | "normal" | "poisson">("binomial");
  const [binN, setBinN] = useState("10");
  const [binP, setBinP] = useState("0.5");
  const [binK, setBinK] = useState("5");
  const [normMu, setNormMu] = useState("0");
  const [normSigma, setNormSigma] = useState("1");
  const [normX, setNormX] = useState("0");
  const [poisLambda, setPoisLambda] = useState("3");
  const [poisK, setPoisK] = useState("2");

  // Test params
  const [testMode, setTestMode] = useState<"z" | "t" | "chi2">("z");
  const [testSampleMean, setTestSampleMean] = useState("");
  const [testPopMean, setTestPopMean] = useState("");
  const [testSigma, setTestSigma] = useState("");
  const [testN, setTestN] = useState("");
  const [testAlpha, setTestAlpha] = useState("0.05");
  const [testTailed, setTestTailed] = useState<"two" | "one">("two");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const normCanvasRef = useRef<HTMLCanvasElement>(null);

  const numbers = useMemo(() => data.split(/[,;\s]+/).map(Number).filter((n) => !isNaN(n)), [data]);
  const xNumbers = useMemo(() => xData.split(/[,;\s]+/).map(Number).filter((n) => !isNaN(n)), [xData]);
  const yNumbers = useMemo(() => yData.split(/[,;\s]+/).map(Number).filter((n) => !isNaN(n)), [yData]);

  const stats = useMemo(() => {
    if (numbers.length === 0) return null;
    const n = numbers.length;
    const sorted = [...numbers].sort((a, b) => a - b);
    const sum = numbers.reduce((s, v) => s + v, 0);
    const mean = sum / n;
    const variance = numbers.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const stddev = Math.sqrt(variance);
    const sampleVar = n > 1 ? numbers.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
    const sampleStddev = Math.sqrt(sampleVar);
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
    const q1Idx = Math.floor(n * 0.25);
    const q3Idx = Math.floor(n * 0.75);
    const q1 = sorted[q1Idx];
    const q3 = sorted[q3Idx];
    const min = sorted[0];
    const max = sorted[n - 1];
    const range = max - min;
    const iqr = q3 - q1;

    // Frequency table
    const freq: Record<number, number> = {};
    numbers.forEach((v) => { freq[v] = (freq[v] || 0) + 1; });
    const maxFreq = Math.max(...Object.values(freq));
    const modes = Object.entries(freq).filter(([, f]) => f === maxFreq).map(([v]) => Number(v));
    const freqTable = sorted.filter((v, i) => i === 0 || v !== sorted[i - 1]).map(val => {
      const absFreq = freq[val];
      return { value: val, absFreq, relFreq: absFreq / n, cumFreq: sorted.filter(v => v <= val).length / n };
    });

    // Enhanced stats
    const geoMean = numbers.every(v => v > 0) ? Math.pow(numbers.reduce((p, v) => p * v, 1), 1 / n) : null;
    const harMean = numbers.every(v => v !== 0) ? n / numbers.reduce((s, v) => s + 1 / v, 0) : null;
    const cv = mean !== 0 ? (stddev / Math.abs(mean)) * 100 : null;
    const skewness = stddev > 0 ? numbers.reduce((s, v) => s + Math.pow((v - mean) / stddev, 3), 0) / n : null;
    const kurtosis = stddev > 0 ? numbers.reduce((s, v) => s + Math.pow((v - mean) / stddev, 4), 0) / n - 3 : null;

    return { n, sum, mean, median, variance, sampleVariance: sampleVar, stddev, sampleStddev, min, max, range, q1, q3, iqr, modes, sorted, freqTable, geoMean, harMean, cv, skewness, kurtosis };
  }, [numbers]);

  const regressionStats = useMemo(() => {
    if (xNumbers.length === 0 || yNumbers.length === 0 || xNumbers.length !== yNumbers.length) return null;
    const n = xNumbers.length;
    const xMean = xNumbers.reduce((s, v) => s + v, 0) / n;
    const yMean = yNumbers.reduce((s, v) => s + v, 0) / n;
    const ssXY = xNumbers.reduce((s, x, i) => s + (x - xMean) * (yNumbers[i] - yMean), 0);
    const ssXX = xNumbers.reduce((s, x) => s + (x - xMean) ** 2, 0);
    const ssYY = yNumbers.reduce((s, y) => s + (y - yMean) ** 2, 0);
    if (ssXX === 0) return null;
    const b = ssXY / ssXX;
    const a = yMean - b * xMean;
    const r = ssXX > 0 && ssYY > 0 ? ssXY / Math.sqrt(ssXX * ssYY) : 0;
    const r2 = r * r;
    return { a, b, r, r2, xMean, yMean, ssXX, ssYY, ssXY };
  }, [xNumbers, yNumbers]);

  // Helpers
  const fmt = (n: number | null) => n === null ? "—" : n.toFixed(4).replace(/\.?0+$/, "");
  const normalCDF = (z: number) => {
    if (z < -8) return 0;
    if (z > 8) return 1;
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = z < 0 ? -1 : 1;
    const x = Math.abs(z) / Math.sqrt(2);
    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1 + sign * y);
  };

  const binomial = (n: number, k: number, p: number) => {
    let c = 1;
    for (let i = 0; i < k; i++) c *= (n - i) / (i + 1);
    return c * Math.pow(p, k) * Math.pow(1 - p, n - k);
  };

  const factorial = (n: number): number => n <= 1 ? 1 : n * factorial(n - 1);

  // Draw histogram
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !stats) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (chartType === "histogram") {
      const W = canvas.width, H = canvas.height;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);

      const bins = Math.min(10, Math.ceil(stats.range / 2 || 1));
      const binWidth = (stats.range + 1) / bins;
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
        ctx.fillStyle = "#4f46e5";
        ctx.fillRect(40 + i * barW + 2, H - 30 - barH, barW - 4, barH);
        ctx.fillStyle = "#475569";
        ctx.font = "10px monospace";
        ctx.fillText(String(c), 40 + i * barW + barW / 2 - 4, H - 30 - barH - 5);
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
    } else {
      // Boxplot
      const W = canvas.width, H = canvas.height;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);

      const plotH = 80;
      const y = H / 2;
      const dataRange = stats.max - stats.min || 1;
      const scale = (W - 80) / dataRange;
      const plot = (v: number) => 40 + (v - stats.min) * scale;

      // Box
      ctx.fillStyle = "#4f46e5";
      ctx.fillRect(plot(stats.q1), y - plotH / 2, plot(stats.q3) - plot(stats.q1), plotH);

      // Median line
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(plot(stats.median) - 2, y - plotH / 2, 4, plotH);

      // Whiskers
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(plot(stats.min), y); ctx.lineTo(plot(stats.q1), y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(plot(stats.q3), y); ctx.lineTo(plot(stats.max), y); ctx.stroke();

      // Outliers
      const iqr = stats.q3 - stats.q1;
      const lowerBound = stats.q1 - 1.5 * iqr;
      const upperBound = stats.q3 + 1.5 * iqr;
      ctx.fillStyle = "#ef4444";
      numbers.forEach(v => {
        if (v < lowerBound || v > upperBound) {
          ctx.beginPath();
          ctx.arc(plot(v), y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Labels
      ctx.fillStyle = "#475569";
      ctx.font = "10px monospace";
      ctx.fillText(stats.min.toFixed(1), plot(stats.min) - 15, y + 25);
      ctx.fillText(stats.median.toFixed(1), plot(stats.median) - 15, y - 25);
      ctx.fillText(stats.max.toFixed(1), plot(stats.max) - 15, y + 25);
    }
  }, [stats, numbers, chartType]);

  // Draw normal curve
  useEffect(() => {
    const canvas = normCanvasRef.current;
    if (!canvas || distMode !== "normal") return;
    const mu = Number(normMu), sigma = Number(normSigma), x = Number(normX);
    if (isNaN(mu) || isNaN(sigma) || sigma <= 0 || isNaN(x)) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    const xMin = mu - 4 * sigma, xMax = mu + 4 * sigma;
    const scale = (W - 80) / (xMax - xMin);
    const plot = (v: number) => 40 + (v - xMin) * scale;

    // Draw curve
    ctx.strokeStyle = "#4f46e5";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = 0; px <= W - 80; px += 2) {
      const xx = xMin + (px / (W - 80)) * (xMax - xMin);
      const z = (xx - mu) / sigma;
      const pdfVal = (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-z * z / 2);
      const py = H - 30 - pdfVal * (H - 60) * sigma * Math.sqrt(2 * Math.PI);
      if (px === 0) ctx.moveTo(40 + px, py);
      else ctx.lineTo(40 + px, py);
    }
    ctx.stroke();

    // Shade area
    const zX = (x - mu) / sigma;
    const phiX = normalCDF(zX);
    ctx.fillStyle = "rgba(79, 70, 229, 0.3)";
    ctx.beginPath();
    ctx.moveTo(40, H - 30);
    for (let px = 0; px <= Math.min((x - xMin) * scale, W - 80); px += 2) {
      const xx = xMin + (px / (W - 80)) * (xMax - xMin);
      const z = (xx - mu) / sigma;
      const pdfVal = (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-z * z / 2);
      const py = H - 30 - pdfVal * (H - 60) * sigma * Math.sqrt(2 * Math.PI);
      if (px === 0) ctx.moveTo(40 + px, py);
      else ctx.lineTo(40 + px, py);
    }
    ctx.lineTo(plot(x), H - 30);
    ctx.fill();

    // Axes
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, H - 30);
    ctx.lineTo(W - 20, H - 30);
    ctx.stroke();
  }, [distMode, normMu, normSigma, normX]);

  const handleSave = () => {
    if (checkLimit && !checkLimit()) return;
    if (!stats) return;
    onSave("statistics", t("math.statSaveLabel", { n: String(stats.n) }), t("math.statSaveResult", { mean: stats.mean.toFixed(4), stddev: stats.stddev.toFixed(4), median: String(stats.median) }), moduleId);
  };

  const interpretation = () => {
    if (!stats) return "";
    let hints = [];
    if (stats.cv !== null && stats.cv > 30) hints.push(t("math.statHighSpread"));
    if (stats.skewness !== null && stats.skewness > 0.5) hints.push(t("math.statRightSkew"));
    if (stats.skewness !== null && stats.skewness < -0.5) hints.push(t("math.statLeftSkew"));
    return hints.join(" | ");
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold text-surface-900">{t("math.statisticsTool")}</h2>
        <div className="flex items-center gap-2">
          <select value={moduleId || ""} onChange={(e) => setModuleId(e.target.value || null)} className="bg-surface-100 text-surface-700 text-sm rounded-lg px-2 sm:px-3 py-1.5 border border-surface-200 min-w-0 flex-1 sm:flex-none">
            <option value="">{t("math.noModule")}</option>
            {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button onClick={handleSave} className="px-3 py-1.5 rounded-lg bg-surface-100 text-surface-700 text-sm hover:bg-surface-200 whitespace-nowrap">💾 {t("math.save")}</button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 mb-4 border-b border-surface-200">
        {[
          { key: "deskriptiv", label: t("math.statDescriptive") },
          { key: "verteilungen", label: t("math.statDistributions") },
          { key: "tests", label: t("math.statTests") },
          { key: "regression", label: t("math.statRegression") },
          { key: "visualisierung", label: t("math.statVisualization") },
        ].map((t_) => (
          <button key={t_.key} onClick={() => setTab(t_.key as any)} className={`px-3 py-2 text-sm font-medium border-b-2 transition ${tab === t_.key ? "border-brand-500 text-brand-600" : "border-transparent text-surface-600 hover:text-surface-900"}`}>
            {t_.label}
          </button>
        ))}
      </div>

      {/* Tab: Deskriptiv */}
      {tab === "deskriptiv" && (
        <div className="space-y-4">
          <textarea value={data} onChange={(e) => setData(e.target.value)} placeholder={t("math.enterDataPlaceholder")} className="w-full bg-surface-100 text-surface-900 rounded-lg px-4 py-3 border border-surface-200 font-mono text-sm h-20 resize-none" />

          {stats && (
            <>
              <div className="flex gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={showSteps} onChange={(e) => setShowSteps(e.target.checked)} className="rounded" />
                  Schritte anzeigen
                </label>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                {[
                  [t("math.statCount"), String(stats.n)],
                  [t("math.statSum"), fmt(stats.sum)],
                  [t("math.statMean"), fmt(stats.mean)],
                  [t("math.statMedian"), fmt(stats.median)],
                  [t("math.statVariance"), fmt(stats.variance)],
                  [t("math.statSampleVariance"), fmt(stats.sampleVariance)],
                  [t("math.statStddev"), fmt(stats.stddev)],
                  [t("math.statSampleStddev"), fmt(stats.sampleStddev)],
                  [t("math.statMin"), fmt(stats.min)],
                  [t("math.statMax"), fmt(stats.max)],
                  [t("math.statRange"), fmt(stats.range)],
                  [t("math.statIqr"), fmt(stats.iqr)],
                  [t("math.statQ1"), fmt(stats.q1)],
                  [t("math.statQ3"), fmt(stats.q3)],
                  [t("math.statMode"), stats.modes.join(", ")],
                  ...(stats.geoMean ? [[t("math.statGeoMean"), fmt(stats.geoMean)]] : []),
                  ...(stats.harMean ? [[t("math.statHarMean"), fmt(stats.harMean)]] : []),
                  ...(stats.cv !== null ? [[t("math.statCV"), fmt(stats.cv) + "%"]] : []),
                  ...(stats.skewness !== null ? [[t("math.statSkewness"), fmt(stats.skewness)]] : []),
                  ...(stats.kurtosis !== null ? [[t("math.statKurtosis"), fmt(stats.kurtosis)]] : []),
                ].map(([label, val]) => (
                  <div key={label as string} className="bg-surface-100 rounded-lg px-3 py-2">
                    <div className="text-surface-400 text-xs">{label}</div>
                    <div className="text-surface-900 font-mono text-sm">{val}</div>
                  </div>
                ))}
              </div>

              {showSteps && (
                <div className="bg-surface-50 rounded-lg p-3 text-sm space-y-1 font-mono text-surface-700">
                  <div>Schritt 1: Σxᵢ = {numbers.join("+")} = {stats.sum.toFixed(2)}</div>
                  <div>Schritt 2: x̄ = {stats.sum.toFixed(2)} / {stats.n} = {stats.mean.toFixed(2)}</div>
                  <div>Schritt 3: Σ(xᵢ-x̄)² = {(numbers.map(v => `(${v}-${stats.mean.toFixed(2)})²`).join("+")).substring(0, 40)}... = {(stats.variance * stats.n).toFixed(2)}</div>
                  <div>Schritt 4: σ² = {(stats.variance * stats.n).toFixed(2)} / {stats.n} = {stats.variance.toFixed(2)}</div>
                  <div>Schritt 5: σ = √{stats.variance.toFixed(2)} = {stats.stddev.toFixed(2)}</div>
                </div>
              )}

              {interpretation() && <div className="text-sm text-surface-600">Interpretation: {interpretation()}</div>}

              {/* Frequency Table */}
              <div className="bg-surface-50 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-surface-200">
                    <tr><th className="px-3 py-2 text-left">Wert</th><th className="px-3 py-2 text-left">Abs. Freq</th><th className="px-3 py-2 text-left">Rel. Freq</th><th className="px-3 py-2 text-left">Kum. Freq</th></tr>
                  </thead>
                  <tbody>
                    {stats.freqTable.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-t border-surface-200">
                        <td className="px-3 py-2 font-mono">{row.value}</td>
                        <td className="px-3 py-2">{row.absFreq}</td>
                        <td className="px-3 py-2 font-mono">{(row.relFreq * 100).toFixed(1)}%</td>
                        <td className="px-3 py-2 font-mono">{(row.cumFreq * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Histogram */}
              <canvas ref={canvasRef} width={700} height={250} className="w-full rounded-xl border border-surface-200" />
            </>
          )}
        </div>
      )}

      {/* Tab: Verteilungen */}
      {tab === "verteilungen" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(["binomial", "normal", "poisson"] as const).map((m) => (
              <button key={m} onClick={() => setDistMode(m)} className={`px-3 py-2 rounded-lg text-sm ${distMode === m ? "bg-brand-500 text-white" : "bg-surface-100 text-surface-700"}`}>
                {m === "binomial" ? t("math.statBinomial") : m === "normal" ? t("math.statNormal") : t("math.statPoisson")}
              </button>
            ))}
          </div>

          {distMode === "binomial" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-sm text-surface-600 mb-1">n (Versuche)</label><input type="number" value={binN} onChange={(e) => setBinN(e.target.value)} className="w-full bg-surface-100 rounded-lg px-2 py-1.5 border border-surface-200" /></div>
                <div><label className="block text-sm text-surface-600 mb-1">p (Wahrscheinlichkeit)</label><input type="number" value={binP} onChange={(e) => setBinP(e.target.value)} step="0.01" min="0" max="1" className="w-full bg-surface-100 rounded-lg px-2 py-1.5 border border-surface-200" /></div>
                <div><label className="block text-sm text-surface-600 mb-1">k (Erfolge)</label><input type="number" value={binK} onChange={(e) => setBinK(e.target.value)} className="w-full bg-surface-100 rounded-lg px-2 py-1.5 border border-surface-200" /></div>
              </div>
              {Number(binN) > 0 && Number(binP) > 0 && Number(binK) >= 0 && (
                <div className="bg-surface-50 rounded-lg p-3 text-sm space-y-1 font-mono text-surface-700">
                  <div>P(X={binK}) = C({binN},{binK}) · {binP}^{binK} · (1-{binP})^{Number(binN)-Number(binK)}</div>
                  <div>P(X={binK}) = {binomial(Number(binN), Number(binK), Number(binP)).toFixed(6)}</div>
                  <div>E(X) = np = {(Number(binN) * Number(binP)).toFixed(2)}</div>
                  <div>Var(X) = np(1-p) = {(Number(binN) * Number(binP) * (1 - Number(binP))).toFixed(2)}</div>
                </div>
              )}
            </div>
          )}

          {distMode === "normal" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-sm text-surface-600 mb-1">μ (Mittelwert)</label><input type="number" value={normMu} onChange={(e) => setNormMu(e.target.value)} className="w-full bg-surface-100 rounded-lg px-2 py-1.5 border border-surface-200" /></div>
                <div><label className="block text-sm text-surface-600 mb-1">σ (Std. Abw.)</label><input type="number" value={normSigma} onChange={(e) => setNormSigma(e.target.value)} className="w-full bg-surface-100 rounded-lg px-2 py-1.5 border border-surface-200" /></div>
                <div><label className="block text-sm text-surface-600 mb-1">x (Wert)</label><input type="number" value={normX} onChange={(e) => setNormX(e.target.value)} className="w-full bg-surface-100 rounded-lg px-2 py-1.5 border border-surface-200" /></div>
              </div>
              {Number(normSigma) > 0 && !isNaN(Number(normMu)) && !isNaN(Number(normX)) && (
                <>
                  <div className="bg-surface-50 rounded-lg p-3 text-sm space-y-1 font-mono text-surface-700">
                    <div>z = (x - μ) / σ = ({Number(normX).toFixed(2)} - {Number(normMu).toFixed(2)}) / {Number(normSigma).toFixed(2)} = {((Number(normX) - Number(normMu)) / Number(normSigma)).toFixed(3)}</div>
                    <div>Φ(z) = P(X ≤ x) = {normalCDF((Number(normX) - Number(normMu)) / Number(normSigma)).toFixed(4)}</div>
                  </div>
                  <canvas ref={normCanvasRef} width={700} height={250} className="w-full rounded-xl border border-surface-200" />
                </>
              )}
            </div>
          )}

          {distMode === "poisson" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm text-surface-600 mb-1">λ (Rate)</label><input type="number" value={poisLambda} onChange={(e) => setPoisLambda(e.target.value)} className="w-full bg-surface-100 rounded-lg px-2 py-1.5 border border-surface-200" /></div>
                <div><label className="block text-sm text-surface-600 mb-1">k (Ereignisse)</label><input type="number" value={poisK} onChange={(e) => setPoisK(e.target.value)} className="w-full bg-surface-100 rounded-lg px-2 py-1.5 border border-surface-200" /></div>
              </div>
              {Number(poisLambda) > 0 && Number(poisK) >= 0 && (
                <div className="bg-surface-50 rounded-lg p-3 text-sm space-y-1 font-mono text-surface-700">
                  <div>P(X={poisK}) = e^(-{Number(poisLambda).toFixed(2)}) · {Number(poisLambda).toFixed(2)}^{poisK} / {poisK}!</div>
                  <div>P(X={poisK}) = {(Math.exp(-Number(poisLambda)) * Math.pow(Number(poisLambda), Number(poisK)) / factorial(Number(poisK))).toFixed(6)}</div>
                  <div>E(X) = λ = {Number(poisLambda).toFixed(2)}</div>
                  <div>Var(X) = λ = {Number(poisLambda).toFixed(2)}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Tests */}
      {tab === "tests" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(["z", "t", "chi2"] as const).map((m) => (
              <button key={m} onClick={() => setTestMode(m)} className={`px-3 py-2 rounded-lg text-sm ${testMode === m ? "bg-brand-500 text-white" : "bg-surface-100 text-surface-700"}`}>
                {m === "z" ? t("math.statZTest") : m === "t" ? t("math.statTTest") : t("math.statChiTest")}
              </button>
            ))}
          </div>

          {(testMode === "z" || testMode === "t") && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm text-surface-600 mb-1">Stichprobenmittelwert (x̄)</label><input type="number" value={testSampleMean} onChange={(e) => setTestSampleMean(e.target.value)} className="w-full bg-surface-100 rounded-lg px-2 py-1.5 border border-surface-200" /></div>
                <div><label className="block text-sm text-surface-600 mb-1">Grundgesamtheitsmittelwert (μ₀)</label><input type="number" value={testPopMean} onChange={(e) => setTestPopMean(e.target.value)} className="w-full bg-surface-100 rounded-lg px-2 py-1.5 border border-surface-200" /></div>
                <div><label className="block text-sm text-surface-600 mb-1">{testMode === "z" ? "σ (bekannt)" : "s (Stichprobe)"}</label><input type="number" value={testSigma} onChange={(e) => setTestSigma(e.target.value)} className="w-full bg-surface-100 rounded-lg px-2 py-1.5 border border-surface-200" /></div>
                <div><label className="block text-sm text-surface-600 mb-1">n (Stichprobengröße)</label><input type="number" value={testN} onChange={(e) => setTestN(e.target.value)} className="w-full bg-surface-100 rounded-lg px-2 py-1.5 border border-surface-200" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm text-surface-600 mb-1">α (Signifikanz)</label><input type="number" value={testAlpha} onChange={(e) => setTestAlpha(e.target.value)} step="0.01" min="0" max="1" className="w-full bg-surface-100 rounded-lg px-2 py-1.5 border border-surface-200" /></div>
                <div><label className="block text-sm text-surface-600 mb-1">Test</label><select value={testTailed} onChange={(e) => setTestTailed(e.target.value as any)} className="w-full bg-surface-100 text-surface-700 rounded-lg px-2 py-1.5 border border-surface-200"><option value="two">{t("math.statTwoTailed")}</option><option value="one">{t("math.statOneTailed")}</option></select></div>
              </div>

              {testSampleMean && testPopMean && testSigma && testN && (
                <div className="bg-surface-50 rounded-lg p-3 text-sm space-y-2 font-mono text-surface-700">
                  <div>H₀: μ = {Number(testPopMean).toFixed(2)}</div>
                  <div>H₁: μ ≠ {Number(testPopMean).toFixed(2)} {testTailed === "one" ? " (einseitig)" : ""}</div>
                  <div className={testMode === "z" ? "" : "hidden"}>Teststatistik: z = ({testSampleMean} - {testPopMean}) / ({testSigma} / √{testN}) = {testSigma && testN ? (((Number(testSampleMean) - Number(testPopMean)) / (Number(testSigma) / Math.sqrt(Number(testN))))).toFixed(3) : "—"}</div>
                  <div className={testMode === "t" ? "" : "hidden"}>Teststatistik: t = ({testSampleMean} - {testPopMean}) / ({testSigma} / √{testN}) = {testSigma && testN ? (((Number(testSampleMean) - Number(testPopMean)) / (Number(testSigma) / Math.sqrt(Number(testN))))).toFixed(3) : "—"}</div>
                  <div className={testSigma && testN && Number(testSigma) > 0 && Number(testN) > 0 ? "text-success-600" : "text-danger-600"}>{testSigma && testN && Number(testSigma) > 0 && Number(testN) > 0 ? t("math.statKeepH0") : t("math.statInvalid")}</div>
                </div>
              )}
            </div>
          )}

          {testMode === "chi2" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm text-surface-600 mb-1">Beobachtete Häufigkeiten (Komma-getrennt)</label><input type="text" placeholder="10, 20, 15" className="w-full bg-surface-100 rounded-lg px-2 py-1.5 border border-surface-200" /></div>
                <div><label className="block text-sm text-surface-600 mb-1">Erwartete Häufigkeiten (Komma-getrennt)</label><input type="text" placeholder="15, 15, 15" className="w-full bg-surface-100 rounded-lg px-2 py-1.5 border border-surface-200" /></div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Regression */}
      {tab === "regression" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm text-surface-600 mb-1">X-Werte (Komma-getrennt)</label><textarea value={xData} onChange={(e) => setXData(e.target.value)} placeholder="1, 2, 3, 4, 5" className="w-full bg-surface-100 text-surface-900 rounded-lg px-3 py-2 border border-surface-200 font-mono text-sm h-16 resize-none" /></div>
            <div><label className="block text-sm text-surface-600 mb-1">Y-Werte (Komma-getrennt)</label><textarea value={yData} onChange={(e) => setYData(e.target.value)} placeholder="2, 4, 5, 8, 10" className="w-full bg-surface-100 text-surface-900 rounded-lg px-3 py-2 border border-surface-200 font-mono text-sm h-16 resize-none" /></div>
          </div>

          {regressionStats && (
            <div className="bg-surface-50 rounded-lg p-3 text-sm space-y-2 font-mono text-surface-700">
              <div>y = {regressionStats.a.toFixed(4)} + {regressionStats.b.toFixed(4)} · x</div>
              <div>{t("math.statCorrelation")} (r) = {regressionStats.r.toFixed(4)}</div>
              <div>R² = {regressionStats.r2.toFixed(4)}</div>
              {Math.abs(regressionStats.r) > 0.7 && <div className="text-success-600">{t("math.statStrongCorr")}</div>}
            </div>
          )}
        </div>
      )}

      {/* Tab: Visualisierung */}
      {tab === "visualisierung" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(["histogram", "boxplot"] as const).map((c) => (
              <button key={c} onClick={() => setChartType(c)} className={`px-3 py-2 rounded-lg text-sm ${chartType === c ? "bg-brand-500 text-white" : "bg-surface-100 text-surface-700"}`}>
                {c === "histogram" ? t("math.statHistogram") : t("math.statBoxplot")}
              </button>
            ))}
          </div>
          {stats && <canvas ref={canvasRef} width={700} height={250} className="w-full rounded-xl border border-surface-200" />}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* TOOL 6: Units & Constants                                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

function UnitsTool({ onSave, modules }: { onSave: (t: MathTool, e: string, r: string, m?: string | null) => void; modules: Module[] }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"convert" | "constants" | "bases">("convert");
  const [group, setGroup] = useState(0);
  const [fromUnit, setFromUnit] = useState(0);
  const [toUnit, setToUnit] = useState(1);
  const [value, setValue] = useState("1");
  const [baseInput, setBaseInput] = useState("255");
  const [baseFrom, setBaseFrom] = useState(10);
  const [moduleId, setModuleId] = useState<string | null>(null);

  const unitGroups = useMemo(() => getUnitGroups(t), [t]);
  const constants = useMemo(() => getConstants(t), [t]);
  const currentGroup = unitGroups[group];
  const isTemp = currentGroup.label === t("math.unit.temperature");

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
    return { bin: numberToBase(num, 2, t), oct: numberToBase(num, 8, t), dec: numberToBase(num, 10, t), hex: numberToBase(num, 16, t) };
  }, [baseInput, baseFrom, t]);

  const handleSaveConvert = () => {
    const from = currentGroup.units[fromUnit];
    const to = currentGroup.units[toUnit];
    onSave("units", `${value} ${from.symbol} → ${to.symbol}`, `${convertResult} ${to.symbol}`, moduleId);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold text-surface-900">{t("math.unitsConstants")}</h2>
        <select value={moduleId || ""} onChange={(e) => setModuleId(e.target.value || null)} className="bg-surface-100 text-surface-700 text-sm rounded-lg px-2 sm:px-3 py-1.5 border border-surface-200 min-w-0 self-start sm:self-auto">
          <option value="">{t("math.noModule")}</option>
          {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <div className="flex gap-2 mb-6">
        {([["convert", t("math.converter")], ["constants", t("math.constants")], ["bases", t("math.numberSystems")]] as [string, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as typeof tab)} className={`px-4 py-2 rounded-lg text-sm ${tab === k ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-500 hover:bg-surface-200"}`}>{l}</button>
        ))}
      </div>

      {tab === "convert" && (
        <div>
          {/* Group selector */}
          <div className="flex flex-wrap gap-2 mb-4">
            {unitGroups.map((g, i) => (
              <button key={g.label} onClick={() => { setGroup(i); setFromUnit(0); setToUnit(1); }} className={`px-3 py-1.5 rounded-lg text-sm ${group === i ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-500 hover:bg-surface-200"}`}>{g.label}</button>
            ))}
          </div>

          <div className="bg-surface-100 rounded-xl p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 justify-center">
              <div className="text-center w-full sm:w-auto">
                <input value={value} onChange={(e) => setValue(e.target.value)} className="w-full sm:w-40 bg-white text-surface-900 text-lg sm:text-xl rounded-lg px-4 py-3 border border-surface-200 font-mono text-center" />
                <select value={fromUnit} onChange={(e) => setFromUnit(Number(e.target.value))} className="mt-2 w-full sm:w-40 bg-white text-surface-700 rounded-lg px-3 py-2 border border-surface-200 text-sm">
                  {currentGroup.units.map((u, i) => <option key={i} value={i}>{u.name} ({u.symbol})</option>)}
                </select>
              </div>
              <button onClick={() => { setFromUnit(toUnit); setToUnit(fromUnit); }} className="text-2xl text-surface-500 hover:text-brand-600 rotate-90 sm:rotate-0">⇄</button>
              <div className="text-center w-full sm:w-auto">
                <div className="w-full sm:w-40 text-success-600 text-lg sm:text-xl font-mono py-3 px-4 text-center break-all">{convertResult}</div>
                <select value={toUnit} onChange={(e) => setToUnit(Number(e.target.value))} className="mt-2 w-full sm:w-40 bg-white text-surface-700 rounded-lg px-3 py-2 border border-surface-200 text-sm">
                  {currentGroup.units.map((u, i) => <option key={i} value={i}>{u.name} ({u.symbol})</option>)}
                </select>
              </div>
            </div>
            <div className="text-center mt-4">
              <button onClick={handleSaveConvert} className="text-brand-600 text-sm hover:text-brand-500">💾 {t("math.saveToHistory")}</button>
            </div>
          </div>
        </div>
      )}

      {tab === "constants" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3">
          {constants.map((c) => (
            <div key={c.name} className="bg-surface-100 rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-surface-900 text-sm font-medium">{c.name}</div>
                <div className="text-surface-400 text-xs">{c.unit}</div>
              </div>
              <div className="text-right">
                <div className="text-brand-600 font-mono text-sm">{c.symbol}</div>
                <div className="text-success-600 font-mono text-sm">{c.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "bases" && (
        <div className="bg-surface-100 rounded-xl p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mb-6">
            <input value={baseInput} onChange={(e) => setBaseInput(e.target.value)} className="flex-1 bg-white text-surface-900 text-lg sm:text-xl rounded-lg px-4 py-3 border border-surface-200 font-mono min-w-0" placeholder={t("math.enterNumber")} />
            <select value={baseFrom} onChange={(e) => setBaseFrom(Number(e.target.value))} className="bg-white text-surface-700 rounded-lg px-3 py-3 border border-surface-200 text-sm">
              <option value={2}>{t("math.binary")} (2)</option>
              <option value={8}>{t("math.octal")} (8)</option>
              <option value={10}>{t("math.decimal")} (10)</option>
              <option value={16}>{t("math.hexadecimal")} (16)</option>
            </select>
          </div>
          {baseResults && (
            <div className="grid grid-cols-2 gap-3">
              {[
                [t("math.binary") + " (2)", baseResults.bin, "BIN"],
                [t("math.octal") + " (8)", baseResults.oct, "OCT"],
                [t("math.decimal") + " (10)", baseResults.dec, "DEC"],
                [t("math.hexadecimal") + " (16)", baseResults.hex, "HEX"],
              ].map(([label, val, tag]) => (
                <div key={label} className="bg-white rounded-lg px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-surface-400 text-xs">{label}</span>
                    <span className="text-brand-600 text-xs font-mono">{tag}</span>
                  </div>
                  <div className="text-success-600 font-mono text-lg break-all">{val}</div>
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

function FormulasTool({ userId, supabase, formulas, setFormulas, modules, builtinFormulas, formulaCategories }: { userId: string | null; supabase: ReturnType<typeof createClient>; formulas: MathFormula[]; setFormulas: React.Dispatch<React.SetStateAction<MathFormula[]>>; modules: Module[]; builtinFormulas: { title: string; formula: string; category: FormulaCategory; description: string }[]; formulaCategories: { key: FormulaCategory; label: string }[] }) {
  const { t } = useTranslation();
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
    const builtin = builtinFormulas.map((f, i) => ({
      id: `builtin-${i}`, user_id: "", title: f.title, formula: f.formula, category: f.category, description: f.description, module_id: null, tags: [] as string[], pinned: false, created_at: "", updated_at: "", isCustom: false,
    }));
    let all = [...custom, ...builtin];
    if (category !== "all") all = all.filter((f) => f.category === category);
    if (search) {
      const q = search.toLowerCase();
      all = all.filter((f) => f.title.toLowerCase().includes(q) || f.formula.toLowerCase().includes(q) || f.description.toLowerCase().includes(q));
    }
    return all;
  }, [formulas, category, search, builtinFormulas]);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold text-surface-900">{t("math.formulaCollection")}</h2>
        <button onClick={openNew} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 self-start sm:self-auto whitespace-nowrap">+ {t("math.ownFormula")}</button>
      </div>

      {/* Search + Category filter */}
      <div className="flex gap-3 mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("math.searchFormulas")} className="flex-1 bg-surface-100 text-surface-900 rounded-lg px-4 py-2 border border-surface-200 text-sm" />
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setCategory("all")} className={`px-3 py-1.5 rounded-lg text-xs ${category === "all" ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-500 hover:bg-surface-200"}`}>{t("math.all")}</button>
        {formulaCategories.map((c) => (
          <button key={c.key} onClick={() => setCategory(c.key)} className={`px-3 py-1.5 rounded-lg text-xs ${category === c.key ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-500 hover:bg-surface-200"}`}>{c.label}</button>
        ))}
      </div>

      {/* Formulas List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3">
        {allFormulas.map((f) => (
          <div key={f.id} className="bg-surface-100 rounded-lg px-4 py-3 group">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {(f as { isCustom?: boolean }).isCustom && <span className="text-xs bg-brand-50 text-brand-500 px-1.5 py-0.5 rounded">{t("math.custom")}</span>}
                  <span className="text-xs bg-surface-200 text-surface-700 px-1.5 py-0.5 rounded">{formulaCategories.find((c) => c.key === f.category)?.label}</span>
                </div>
                <div className="text-surface-900 font-medium text-sm mt-1">{f.title}</div>
                <div className="text-success-600 font-mono text-sm mt-1">{f.formula}</div>
                {f.description && <div className="text-surface-400 text-xs mt-1">{f.description}</div>}
              </div>
              {(f as { isCustom?: boolean }).isCustom && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(f as MathFormula)} className="text-surface-400 hover:text-brand-600 text-xs">✏️</button>
                  <button onClick={() => remove(f.id)} className="text-surface-400 hover:text-danger-600 text-xs">🗑️</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {allFormulas.length === 0 && <p className="text-surface-400 text-sm text-center py-8">{t("math.noFormulasFound")}</p>}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg border border-surface-200" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-surface-900 mb-4">{editId ? t("math.editFormula") : t("math.newFormula")}</h3>
            <div className="space-y-3">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("math.title")} className="w-full bg-surface-100 text-surface-900 rounded-lg px-4 py-2.5 border border-surface-200 text-sm" />
              <input value={formula} onChange={(e) => setFormula(e.target.value)} placeholder={t("math.formulaPlaceholder")} className="w-full bg-surface-100 text-surface-900 rounded-lg px-4 py-2.5 border border-surface-200 font-mono text-sm" />
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("math.description")} className="w-full bg-surface-100 text-surface-900 rounded-lg px-4 py-2.5 border border-surface-200 text-sm" />
              <select value={cat} onChange={(e) => setCat(e.target.value as FormulaCategory)} className="w-full bg-surface-100 text-surface-700 rounded-lg px-4 py-2.5 border border-surface-200 text-sm">
                {formulaCategories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <select value={moduleId || ""} onChange={(e) => setModuleId(e.target.value || null)} className="w-full bg-surface-100 text-surface-700 rounded-lg px-4 py-2.5 border border-surface-200 text-sm">
                <option value="">{t("math.noModule")}</option>
                {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t("math.tagsPlaceholder")} className="w-full bg-surface-100 text-surface-900 rounded-lg px-4 py-2.5 border border-surface-200 text-sm" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl bg-surface-100 text-surface-700 hover:bg-surface-200">{t("math.cancel")}</button>
              <button onClick={save} className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700">{t("math.save")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
