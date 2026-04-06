"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/useProfile";
import { FREE_LIMITS, mathUsageToday, mathUsageIncrement } from "@/lib/gates";
import { LimitNudge, UpgradeModal } from "@/components/ui/ProGate";
import type { Module, MathHistory, MathFormula, MathTool, FormulaCategory } from "@/types/database";
import { useTranslation } from "@/lib/i18n";
import {
  Calculator, Scale, Grid3X3, TrendingUp,
  BarChart3, RefreshCw, ClipboardList, ScrollText,
  ZoomIn, ZoomOut, RotateCcw, Save, Trash2,
} from "lucide-react";

/* ─── Constants ───────────────────────────────────────────────────────────── */

function getTools(t: (key: string) => string): { key: MathTool; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; desc: string }[] {
  return [
    { key: "calculator",  label: t("math.calculator"),    icon: Calculator,    desc: t("math.scientific") },
    { key: "equations",   label: t("math.equations"),     icon: Scale,         desc: t("math.solver") },
    { key: "matrices",    label: t("math.matrices"),      icon: Grid3X3,       desc: t("math.matricesCalc") },
    { key: "plotter",     label: t("math.plotter"),       icon: TrendingUp,    desc: t("math.functionGraphs") },
    { key: "statistics",  label: t("math.statistics"),    icon: BarChart3,     desc: t("math.analysis") },
    { key: "units",       label: t("math.units"),         icon: RefreshCw,     desc: t("math.converter") },
    { key: "formulas",    label: t("math.formulas"),      icon: ClipboardList, desc: t("math.formulas") },
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

const CALC_BASIC = [
  ["C", "(", ")", "\u232b"],
  ["7", "8", "9", "\u00f7"],
  ["4", "5", "6", "\u00d7"],
  ["1", "2", "3", "\u2212"],
  ["0", ".", "Ans", "+"],
  ["\u03c0", "e", "%", "="],
];
const CALC_SCI = [
  ["sin", "cos", "tan", "^"],
  ["asin", "acos", "atan", "\u221a"],
  ["sinh", "cosh", "tanh", "!"],
  ["ln", "log", "log\u2082", "mod"],
  ["e\u02e3", "10\u02e3", "|x|", "1/x"],
  ["(", ")", ",", "EE"],
];

/* getConstants and getUnitGroups moved into UnitsTool component */

interface RichFormula {
  id: string;
  title: string;
  formula: string;
  category: FormulaCategory;
  description: string;
  vars: string;
  usage: string;
  example: string;
  mistakes: string;
  synonyms: string[];
  related: string[];
  calc?: { vars: string[]; expr: string };
}

function getBuiltinFormulas(t: (key: string) => string): { title: string; formula: string; category: FormulaCategory; description: string }[] {
  return RICH_FORMULAS.map(f => ({ title: f.title, formula: f.formula, category: f.category, description: f.description }));
}

const RICH_FORMULAS: RichFormula[] = [
  /* ═══ ANALYSIS ═══ */
  { id: "potenzregel", title: "Potenzregel", formula: "f(x) = x\u207f \u2192 f'(x) = n\u00b7x\u207f\u207b\u00b9", category: "analysis",
    description: "Ableitung von Potenzfunktionen", vars: "n = Exponent, x = Variable",
    usage: "Wenn f(x) eine Potenz von x ist", example: "f(x) = x\u00b3 \u2192 f'(x) = 3x\u00b2",
    mistakes: "n=0 vergessen (Konstante \u2192 Ableitung=0), negativen Exponenten falsch ableiten",
    synonyms: ["ableitung", "potenz", "derivative", "power rule"], related: ["kettenregel", "produktregel"] },
  { id: "kettenregel", title: "Kettenregel", formula: "(f\u2218g)'(x) = f'(g(x)) \u00b7 g'(x)", category: "analysis",
    description: "Ableitung verketteter Funktionen", vars: "f = \u00e4ussere Funktion, g = innere Funktion",
    usage: "Bei verschachtelten Funktionen wie sin(x\u00b2)", example: "f(x)=sin(x\u00b2) \u2192 f'(x)=cos(x\u00b2)\u00b72x",
    mistakes: "Innere Ableitung g'(x) vergessen", synonyms: ["chain rule", "verkettung", "innere ableitung"], related: ["potenzregel", "produktregel"] },
  { id: "produktregel", title: "Produktregel", formula: "(f\u00b7g)' = f'\u00b7g + f\u00b7g'", category: "analysis",
    description: "Ableitung eines Produkts zweier Funktionen", vars: "f, g = differenzierbare Funktionen",
    usage: "Wenn zwei Funktionen multipliziert werden", example: "f(x)=x\u00b7sin(x) \u2192 f'(x)=sin(x)+x\u00b7cos(x)",
    mistakes: "Einfach f'\u00b7g' statt der Summe", synonyms: ["product rule", "leibniz"], related: ["quotientenregel", "kettenregel"] },
  { id: "quotientenregel", title: "Quotientenregel", formula: "(f/g)' = (f'\u00b7g \u2212 f\u00b7g') / g\u00b2", category: "analysis",
    description: "Ableitung eines Quotienten", vars: "f = Z\u00e4hler, g = Nenner (g\u22600)",
    usage: "Bei Division zweier Funktionen", example: "f(x)=sin(x)/x \u2192 (cos(x)\u00b7x\u2212sin(x))/x\u00b2",
    mistakes: "Reihenfolge Z\u00e4hler/Nenner vertauschen, g\u00b2 vergessen",
    synonyms: ["quotient rule", "bruch ableitung"], related: ["produktregel"] },
  { id: "integral_potenz", title: "Integral (Potenz)", formula: "\u222b x\u207f dx = x\u207f\u207a\u00b9/(n+1) + C", category: "analysis",
    description: "Stammfunktion der Potenzfunktion", vars: "n \u2260 -1, C = Integrationskonstante",
    usage: "Aufleitung von Potenzfunktionen", example: "\u222b x\u00b2 dx = x\u00b3/3 + C",
    mistakes: "+C vergessen, n=-1 nicht beachten (dann ln|x|+C)",
    synonyms: ["stammfunktion", "aufleitung", "antiderivative", "integral"], related: ["partielle_integration"] },
  { id: "partielle_integration", title: "Partielle Integration", formula: "\u222b u\u00b7v' dx = u\u00b7v \u2212 \u222b u'\u00b7v dx", category: "analysis",
    description: "Integration durch Teile", vars: "u = einfach abzuleiten, v' = einfach aufzuleiten",
    usage: "Produkt von Funktionen integrieren (z.B. x\u00b7e\u02e3)", example: "\u222b x\u00b7e\u02e3 dx = x\u00b7e\u02e3 \u2212 \u222b e\u02e3 dx = x\u00b7e\u02e3 \u2212 e\u02e3 + C",
    mistakes: "Falsche Wahl von u und v', LIATE-Regel beachten",
    synonyms: ["integration by parts", "teilweise integration"], related: ["integral_potenz"] },
  { id: "substitution", title: "Substitution", formula: "\u222b f(g(x))\u00b7g'(x) dx = \u222b f(u) du", category: "analysis",
    description: "Integration durch Substitution", vars: "u = g(x), du = g'(x)\u00b7dx",
    usage: "Bei verschachtelten Funktionen im Integral", example: "\u222b 2x\u00b7cos(x\u00b2) dx, u=x\u00b2 \u2192 \u222b cos(u) du = sin(u) + C",
    mistakes: "R\u00fccksubstitution vergessen, du/dx nicht korrekt",
    synonyms: ["u-substitution", "integration substitution"], related: ["kettenregel", "integral_potenz"] },
  { id: "taylor", title: "Taylor-Reihe", formula: "f(x) = \u03a3 f\u207d\u207f\u207e(a)/n! \u00b7 (x\u2212a)\u207f", category: "analysis",
    description: "Approximation einer Funktion durch Polynome", vars: "a = Entwicklungspunkt, n = Ordnung, f\u207d\u207f\u207e = n-te Ableitung",
    usage: "Funktion lokal durch Polynom ann\u00e4hern", example: "e\u02e3 \u2248 1 + x + x\u00b2/2 + x\u00b3/6 (um a=0)",
    mistakes: "Fakult\u00e4t n! im Nenner vergessen, Konvergenzradius nicht pr\u00fcfen",
    synonyms: ["taylorreihe", "maclaurin", "reihenentwicklung", "taylor series"], related: [] },
  { id: "grenzwert_lhopital", title: "L'H\u00f4pital", formula: "lim f(x)/g(x) = lim f'(x)/g'(x)", category: "analysis",
    description: "Grenzwerte bei 0/0 oder \u221e/\u221e", vars: "f(a)=g(a)=0 oder \u00b1\u221e",
    usage: "Wenn direktes Einsetzen 0/0 ergibt", example: "lim(x\u21920) sin(x)/x = lim cos(x)/1 = 1",
    mistakes: "Anwenden ohne 0/0 oder \u221e/\u221e Bedingung zu pr\u00fcfen",
    synonyms: ["hopital", "grenzwert", "limit", "lhopital"], related: [] },
  /* ═══ LINEARE ALGEBRA ═══ */
  { id: "det_2x2", title: "Determinante 2\u00d72", formula: "det(A) = a\u00b7d \u2212 b\u00b7c", category: "lineare_algebra",
    description: "Determinante einer 2\u00d72 Matrix", vars: "A = [[a,b],[c,d]]",
    usage: "Invertierbarkeit pr\u00fcfen, Fl\u00e4chenberechnung", example: "A=[[3,1],[2,4]] \u2192 det=3\u00b74\u22121\u00b72=10",
    mistakes: "Vorzeichen: ad\u2212bc, nicht ad+bc",
    synonyms: ["determinante", "det", "2x2 matrix"], related: ["inverse_2x2"], calc: { vars: ["a","b","c","d"], expr: "a*d-b*c" } },
  { id: "inverse_2x2", title: "Inverse 2\u00d72", formula: "A\u207b\u00b9 = (1/det)\u00b7[[d,\u2212b],[\u2212c,a]]", category: "lineare_algebra",
    description: "Inverse einer 2\u00d72 Matrix", vars: "det(A) \u2260 0",
    usage: "Gleichungssysteme l\u00f6sen, Matrizengleichungen", example: "A=[[2,1],[1,1]] \u2192 A\u207b\u00b9=[[1,\u22121],[\u22121,2]]",
    mistakes: "Vorzeichen bei b und c vergessen, det=0 nicht pr\u00fcfen",
    synonyms: ["inverse", "umkehrmatrix"], related: ["det_2x2"] },
  { id: "skalarprodukt", title: "Skalarprodukt", formula: "a \u00b7 b = |a|\u00b7|b|\u00b7cos(\u03b8) = \u03a3 a\u1d62\u00b7b\u1d62", category: "lineare_algebra",
    description: "Inneres Produkt zweier Vektoren", vars: "a, b = Vektoren, \u03b8 = eingeschlossener Winkel",
    usage: "Winkelberechnung, Orthogonalit\u00e4tstest (=0)", example: "(1,2)\u00b7(3,4) = 1\u00b73+2\u00b74 = 11",
    mistakes: "Kreuzprodukt verwechseln, Ergebnis ist Skalar nicht Vektor",
    synonyms: ["dot product", "inner product", "inneres produkt"], related: ["kreuzprodukt"] },
  { id: "kreuzprodukt", title: "Kreuzprodukt", formula: "a \u00d7 b = |a|\u00b7|b|\u00b7sin(\u03b8)\u00b7n\u0302", category: "lineare_algebra",
    description: "Vektorprodukt (nur \u211d\u00b3)", vars: "n\u0302 = Normalenvektor, \u03b8 = Winkel",
    usage: "Fl\u00e4chenberechnung, Normalenvektoren", example: "(1,0,0)\u00d7(0,1,0) = (0,0,1)",
    mistakes: "Reihenfolge wichtig: a\u00d7b \u2260 b\u00d7a, Ergebnis ist Vektor",
    synonyms: ["cross product", "vektorprodukt"], related: ["skalarprodukt"] },
  { id: "eigenwerte", title: "Eigenwerte", formula: "det(A \u2212 \u03bbI) = 0", category: "lineare_algebra",
    description: "Eigenwerte einer Matrix finden", vars: "\u03bb = Eigenwert, I = Einheitsmatrix",
    usage: "Stabilit\u00e4tsanalyse, Diagonalisierung", example: "A=[[2,1],[0,3]] \u2192 (2\u2212\u03bb)(3\u2212\u03bb)=0 \u2192 \u03bb=2,3",
    mistakes: "Determinante falsch entwickeln, I vergessen",
    synonyms: ["eigenvalue", "eigenwert", "charakteristisches polynom"], related: ["det_2x2"] },
  /* ═══ TRIGONOMETRIE ═══ */
  { id: "pythagoras", title: "Pythagoras", formula: "a\u00b2 + b\u00b2 = c\u00b2", category: "trigonometrie",
    description: "Satzlängen im rechtwinkligen Dreieck", vars: "a, b = Katheten, c = Hypotenuse",
    usage: "Seitenl\u00e4ngen berechnen bei 90\u00b0-Winkel", example: "a=3, b=4 \u2192 c=\u221a(9+16)=5",
    mistakes: "c ist IMMER die Hypotenuse (l\u00e4ngste Seite)",
    synonyms: ["pythagorean theorem", "satz des pythagoras", "hypotenuse"], related: ["sinussatz", "kosinussatz"],
    calc: { vars: ["a","b"], expr: "Math.sqrt(a*a+b*b)" } },
  { id: "sinussatz", title: "Sinussatz", formula: "a/sin(A) = b/sin(B) = c/sin(C)", category: "trigonometrie",
    description: "Verh\u00e4ltnis Seite/Gegenwinkel ist konstant", vars: "a,b,c = Seiten, A,B,C = gegen\u00fcberliegende Winkel",
    usage: "Wenn Winkel + gegen\u00fcberliegende Seite bekannt", example: "a=5, A=30\u00b0, B=45\u00b0 \u2192 b = 5\u00b7sin(45\u00b0)/sin(30\u00b0)",
    mistakes: "Mehrdeutigkeit bei SSA (zwei L\u00f6sungen m\u00f6glich)",
    synonyms: ["sine rule", "law of sines"], related: ["kosinussatz", "pythagoras"] },
  { id: "kosinussatz", title: "Kosinussatz", formula: "c\u00b2 = a\u00b2 + b\u00b2 \u2212 2ab\u00b7cos(C)", category: "trigonometrie",
    description: "Verallgemeinerung von Pythagoras", vars: "C = Winkel gegen\u00fcber c",
    usage: "Bei SSS oder SWS gegeben", example: "a=3, b=4, C=60\u00b0 \u2192 c\u00b2=9+16\u221212=13",
    mistakes: "Vorzeichen vor 2ab\u00b7cos vergessen, C=90\u00b0 \u2192 Pythagoras",
    synonyms: ["cosine rule", "law of cosines", "cosinussatz"], related: ["pythagoras", "sinussatz"] },
  { id: "trig_identitaet", title: "Trigonometrische Identit\u00e4t", formula: "sin\u00b2(x) + cos\u00b2(x) = 1", category: "trigonometrie",
    description: "Fundamentale Beziehung am Einheitskreis", vars: "x = beliebiger Winkel",
    usage: "Umformungen, Vereinfachungen", example: "sin\u00b2(x) = 1 \u2212 cos\u00b2(x)",
    mistakes: "Gilt f\u00fcr alle x, nicht nur spezielle Winkel",
    synonyms: ["pythagorean identity", "sin cos", "einheitskreis"], related: [] },
  { id: "additionstheoreme", title: "Additionstheoreme", formula: "sin(a\u00b1b) = sin(a)cos(b) \u00b1 cos(a)sin(b)", category: "trigonometrie",
    description: "Sinus/Kosinus von Winkelsummen", vars: "a, b = Winkel",
    usage: "Zusammengesetzte Winkel aufl\u00f6sen", example: "sin(75\u00b0)=sin(45\u00b0+30\u00b0)=sin45\u00b7cos30+cos45\u00b7sin30",
    mistakes: "Vorzeichen bei cos(a\u2212b) vs cos(a+b) verwechseln",
    synonyms: ["addition theorem", "winkeladdition"], related: ["trig_identitaet"] },
  /* ═══ STATISTIK ═══ */
  { id: "mittelwert", title: "Arithmetisches Mittel", formula: "x\u0304 = (1/n) \u00b7 \u03a3x\u1d62", category: "statistik",
    description: "Durchschnitt aller Werte", vars: "n = Anzahl Werte, x\u1d62 = einzelne Werte",
    usage: "Zentraltendenz einer Stichprobe", example: "x = {2,4,6} \u2192 x\u0304 = 12/3 = 4",
    mistakes: "Median und Mittelwert verwechseln, Ausreisser nicht beachten",
    synonyms: ["mean", "durchschnitt", "average", "mittel"], related: ["varianz", "standardabweichung"] },
  { id: "varianz", title: "Varianz", formula: "\u03c3\u00b2 = (1/n)\u00b7\u03a3(x\u1d62 \u2212 x\u0304)\u00b2", category: "statistik",
    description: "Mittlere quadratische Abweichung", vars: "\u03c3\u00b2 = Varianz, x\u0304 = Mittelwert",
    usage: "Streuung messen", example: "x={2,4,6}, x\u0304=4 \u2192 \u03c3\u00b2=[(4+0+4)/3]=8/3",
    mistakes: "Stichprobe: 1/(n\u22121) statt 1/n, Quadrat vergessen",
    synonyms: ["variance", "streuung"], related: ["mittelwert", "standardabweichung"],
    calc: { vars: ["x1","x2","x3"], expr: "((v=>(s=>s/3)((x1-v)**2+(x2-v)**2+(x3-v)**2))((x1+x2+x3)/3))" } },
  { id: "standardabweichung", title: "Standardabweichung", formula: "\u03c3 = \u221a[(1/n)\u00b7\u03a3(x\u1d62 \u2212 x\u0304)\u00b2]", category: "statistik",
    description: "Wurzel der Varianz", vars: "\u03c3 = Standardabweichung",
    usage: "Streuung in gleicher Einheit wie Daten", example: "\u03c3\u00b2=4 \u2192 \u03c3=2",
    mistakes: "\u03c3 vs \u03c3\u00b2 verwechseln, s (Stichprobe) vs \u03c3 (Population)",
    synonyms: ["standard deviation", "sigma", "std"], related: ["varianz", "mittelwert"] },
  { id: "normalverteilung", title: "Normalverteilung", formula: "f(x) = (1/(\u03c3\u221a(2\u03c0)))\u00b7e^(\u2212(x\u2212\u03bc)\u00b2/(2\u03c3\u00b2))", category: "statistik",
    description: "Gauss-Verteilung / Glockenkurve", vars: "\u03bc = Erwartungswert, \u03c3 = Standardabweichung",
    usage: "Modellierung vieler nat\u00fcrlicher Prozesse", example: "68% der Werte liegen in [\u03bc\u2212\u03c3, \u03bc+\u03c3]",
    mistakes: "68-95-99.7-Regel falsch anwenden, \u03c3\u00b2 vs \u03c3 in Formel",
    synonyms: ["gaussian", "gauss", "bell curve", "glockenkurve"], related: ["mittelwert", "standardabweichung"] },
  { id: "binomial", title: "Binomialkoeffizient", formula: "P(X=k) = C(n,k) \u00b7 p\u1d4f \u00b7 (1\u2212p)\u207f\u207b\u1d4f", category: "statistik",
    description: "Wahrscheinlichkeit bei n Versuchen", vars: "n = Versuche, k = Erfolge, p = Erfolgswahrscheinlichkeit",
    usage: "M\u00fcnzwurf, Qualit\u00e4tskontrolle", example: "3 W\u00fcrfe M\u00fcnze, P(2\u00d7Kopf) = C(3,2)\u00b70.5\u00b2\u00b70.5 = 0.375",
    mistakes: "C(n,k) = n!/(k!\u00b7(n\u2212k)!) nicht vergessen",
    synonyms: ["binomial distribution", "binomialverteilung", "bernoulli"], related: ["normalverteilung"] },
  { id: "erwartungswert", title: "Erwartungswert", formula: "E(X) = \u03a3 x\u1d62 \u00b7 P(x\u1d62)", category: "statistik",
    description: "Gewichteter Durchschnitt einer Zufallsvariable", vars: "x\u1d62 = Werte, P(x\u1d62) = Wahrscheinlichkeiten",
    usage: "Langfristiger Durchschnitt bei Wiederholung", example: "W\u00fcrfel: E = (1+2+3+4+5+6)/6 = 3.5",
    mistakes: "\u03a3P muss 1 ergeben, E(X) muss kein m\u00f6glicher Wert sein",
    synonyms: ["expected value", "expectation", "mu"], related: ["mittelwert", "varianz"] },
  /* ═══ GLEICHUNGEN ═══ */
  { id: "quadratische_formel", title: "Quadratische Formel", formula: "x = (\u2212b \u00b1 \u221a(b\u00b2\u22124ac)) / (2a)", category: "allgemein",
    description: "L\u00f6sung von ax\u00b2+bx+c=0", vars: "a \u2260 0, D = b\u00b2\u22124ac (Diskriminante)",
    usage: "Jede quadratische Gleichung l\u00f6sen", example: "x\u00b2\u22125x+6=0 \u2192 x=(5\u00b1\u221a1)/2 \u2192 x=2 oder x=3",
    mistakes: "Vorzeichen von b vergessen, a\u22600 pr\u00fcfen, D<0 = keine reelle L\u00f6sung",
    synonyms: ["abc formel", "mitternachtsformel", "quadratic formula", "pq formel", "l\u00f6sungsformel"], related: [],
    calc: { vars: ["a","b","c"], expr: "(-b+Math.sqrt(b*b-4*a*c))/(2*a)" } },
  { id: "logarithmen", title: "Logarithmus-Regeln", formula: "log_a(x\u00b7y) = log_a(x) + log_a(y)", category: "allgemein",
    description: "Rechenregeln f\u00fcr Logarithmen", vars: "a = Basis, x,y > 0",
    usage: "Gleichungen mit Exponenten l\u00f6sen", example: "log\u2082(8) = log\u2082(2\u00b3) = 3\u00b7log\u2082(2) = 3",
    mistakes: "log(a+b) \u2260 log(a)+log(b), Basis verwechseln",
    synonyms: ["logarithm", "log regeln", "ln", "natuerlicher logarithmus"], related: [] },
  { id: "binomische_formeln", title: "Binomische Formeln", formula: "(a\u00b1b)\u00b2 = a\u00b2 \u00b1 2ab + b\u00b2", category: "allgemein",
    description: "Drei binomische Formeln", vars: "a, b = beliebige Ausdr\u00fccke",
    usage: "Vereinfachung, Faktorisierung", example: "(x+3)\u00b2 = x\u00b2+6x+9, (a\u2212b)(a+b)=a\u00b2\u2212b\u00b2",
    mistakes: "Mischterm 2ab vergessen, 3. Formel: (a+b)(a\u2212b)=a\u00b2\u2212b\u00b2",
    synonyms: ["binomial formula", "binomisch", "quadrat aufl\u00f6sen"], related: ["quadratische_formel"] },
  /* ═══ PHYSIK ═══ */
  { id: "newton_kraft", title: "Newtons 2. Gesetz", formula: "F = m \u00b7 a", category: "physik",
    description: "Kraft = Masse \u00d7 Beschleunigung", vars: "F [N], m [kg], a [m/s\u00b2]",
    usage: "Grundgleichung der Mechanik", example: "m=10kg, a=2m/s\u00b2 \u2192 F=20N",
    mistakes: "Einheiten mischen (g statt kg), Reibung vergessen",
    synonyms: ["kraft", "force", "newton", "f=ma", "beschleunigung"], related: ["kinetische_energie", "arbeit"],
    calc: { vars: ["m","a"], expr: "m*a" } },
  { id: "kinetische_energie", title: "Kinetische Energie", formula: "E_kin = \u00bd\u00b7m\u00b7v\u00b2", category: "physik",
    description: "Bewegungsenergie", vars: "E [J], m [kg], v [m/s]",
    usage: "Energie eines bewegten K\u00f6rpers", example: "m=2kg, v=3m/s \u2192 E=\u00bd\u00b72\u00b79=9J",
    mistakes: "Faktor \u00bd vergessen, v quadrieren nicht vergessen",
    synonyms: ["kinetic energy", "bewegungsenergie", "ekin"], related: ["potenzielle_energie", "arbeit"],
    calc: { vars: ["m","v"], expr: "0.5*m*v*v" } },
  { id: "potenzielle_energie", title: "Potenzielle Energie", formula: "E_pot = m\u00b7g\u00b7h", category: "physik",
    description: "Lageenergie", vars: "m [kg], g=9.81 m/s\u00b2, h [m]",
    usage: "H\u00f6henenergie bei Schwerkraft", example: "m=5kg, h=10m \u2192 E=5\u00b79.81\u00b710=490.5J",
    mistakes: "g\u224810 verwenden statt 9.81, H\u00f6hendifferenz nicht Absolutwert",
    synonyms: ["potential energy", "lageenergie", "epot"], related: ["kinetische_energie"],
    calc: { vars: ["m","h"], expr: "m*9.80665*h" } },
  { id: "arbeit", title: "Arbeit", formula: "W = F \u00b7 s \u00b7 cos(\u03b1)", category: "physik",
    description: "Kraft \u00d7 Weg in Kraftrichtung", vars: "W [J], F [N], s [m], \u03b1 = Winkel zwischen F und s",
    usage: "Energieumwandlung durch Kraft", example: "F=50N, s=3m, \u03b1=0\u00b0 \u2192 W=150J",
    mistakes: "Winkel vergessen (wenn F nicht parallel zu s), cos(90\u00b0)=0",
    synonyms: ["work", "energy", "kraft mal weg"], related: ["newton_kraft", "kinetische_energie"],
    calc: { vars: ["F","s"], expr: "F*s" } },
  { id: "ohm", title: "Ohmsches Gesetz", formula: "U = R \u00b7 I", category: "physik",
    description: "Spannung = Widerstand \u00d7 Strom", vars: "U [V], R [\u03a9], I [A]",
    usage: "Grundgleichung der Elektrotechnik", example: "R=100\u03a9, I=0.5A \u2192 U=50V",
    mistakes: "Einheiten: mA statt A, k\u03a9 statt \u03a9 umrechnen",
    synonyms: ["ohm's law", "ohmsches gesetz", "spannung", "widerstand", "strom", "u=ri"], related: ["leistung_elek"],
    calc: { vars: ["R","I"], expr: "R*I" } },
  { id: "leistung_elek", title: "Elektrische Leistung", formula: "P = U \u00b7 I = R\u00b7I\u00b2 = U\u00b2/R", category: "physik",
    description: "Drei \u00e4quivalente Formen", vars: "P [W], U [V], I [A], R [\u03a9]",
    usage: "Energieverbrauch, Dimensionierung", example: "U=230V, I=2A \u2192 P=460W",
    mistakes: "Richtige Form w\u00e4hlen je nach gegebenen Gr\u00f6ssen",
    synonyms: ["electric power", "watt", "leistung"], related: ["ohm"],
    calc: { vars: ["U","I"], expr: "U*I" } },
  { id: "frequenz_welle", title: "Wellengleichung", formula: "v = f \u00b7 \u03bb", category: "physik",
    description: "Geschwindigkeit = Frequenz \u00d7 Wellenl\u00e4nge", vars: "v [m/s], f [Hz], \u03bb [m]",
    usage: "Schall, Licht, elektromagnetische Wellen", example: "f=440Hz, \u03bb=0.78m \u2192 v\u2248343m/s (Schall)",
    mistakes: "Einheiten: kHz \u2192 Hz umrechnen, \u03bb in nm vs m",
    synonyms: ["wave equation", "frequenz", "wellenlaenge", "wavelength"], related: [],
    calc: { vars: ["f","lambda"], expr: "f*lambda" } },
  { id: "gravitationsgesetz", title: "Gravitationsgesetz", formula: "F = G\u00b7m\u2081\u00b7m\u2082/r\u00b2", category: "physik",
    description: "Anziehungskraft zweier Massen", vars: "G=6.674\u00d710\u207b\u00b9\u00b9, m\u2081,m\u2082 [kg], r [m]",
    usage: "Planetenbahnen, Satellitenorbits", example: "Erde-Mond: F\u22481.98\u00d710\u00b2\u2070 N",
    mistakes: "r ist Abstand der Schwerpunkte, nicht der Oberfl\u00e4chen",
    synonyms: ["gravitation", "newton gravitation", "anziehungskraft"], related: ["newton_kraft"] },
  /* ═══ FINANZEN ═══ */
  { id: "zinseszins", title: "Zinseszins", formula: "K\u2099 = K\u2080 \u00b7 (1 + p/100)\u207f", category: "finanzen",
    description: "Kapital nach n Perioden", vars: "K\u2080 = Anfangskapital, p = Zinssatz [%], n = Perioden",
    usage: "Sparpl\u00e4ne, Kreditberechnung", example: "K\u2080=1000\u20ac, p=5%, n=10 \u2192 K=1628.89\u20ac",
    mistakes: "p als Dezimalzahl (0.05) vs Prozent (5), j\u00e4hrlich vs monatlich",
    synonyms: ["compound interest", "zins", "kapitalverzinsung", "zinsen"], related: ["barwert"],
    calc: { vars: ["K0","p","n"], expr: "K0*Math.pow(1+p/100,n)" } },
  { id: "barwert", title: "Barwert", formula: "BW = K\u2099 / (1 + i)\u207f", category: "finanzen",
    description: "Heutiger Wert eines zuk\u00fcnftigen Betrags", vars: "i = Diskontierungssatz, n = Perioden",
    usage: "Investitionsentscheidungen, NPV", example: "K\u2099=1000\u20ac in 5 Jahren, i=3% \u2192 BW=862.61\u20ac",
    mistakes: "i als Dezimalzahl, nicht Prozent",
    synonyms: ["present value", "abzinsung", "discounting", "npv"], related: ["zinseszins"],
    calc: { vars: ["Kn","i","n"], expr: "Kn/Math.pow(1+i/100,n)" } },
  { id: "annuitaet", title: "Annuit\u00e4t", formula: "A = K\u2080 \u00b7 q\u207f\u00b7(q\u22121)/(q\u207f\u22121)", category: "finanzen",
    description: "Gleichbleibende Ratenzahlung", vars: "q = 1+i, K\u2080 = Kreditbetrag",
    usage: "Hypotheken, Ratenkredite", example: "K=200k\u20ac, i=2%, n=20 \u2192 A\u224812.178\u20ac/Jahr",
    mistakes: "q = 1+i nicht vergessen, i monatlich vs j\u00e4hrlich",
    synonyms: ["annuity", "rate", "tilgung", "hypothek"], related: ["zinseszins", "barwert"] },
  /* ═══ INFORMATIK ═══ */
  { id: "bigo", title: "Big-O Notation", formula: "O(1) < O(log n) < O(n) < O(n log n) < O(n\u00b2) < O(2\u207f)", category: "informatik",
    description: "Laufzeitkomplexit\u00e4t von Algorithmen", vars: "n = Eingabegr\u00f6sse",
    usage: "Algorithmen vergleichen und bewerten", example: "Bin\u00e4re Suche: O(log n), Bubblesort: O(n\u00b2)",
    mistakes: "Best/Average/Worst Case unterscheiden, Konstanten weglassen",
    synonyms: ["complexity", "laufzeit", "algorithmus", "runtime", "zeitkomplexit\u00e4t"], related: ["ds_komplexitaet"] },
  { id: "ds_komplexitaet", title: "Datenstruktur-Komplexit\u00e4ten", formula: "Array: O(1) Zugriff, O(n) Suche | HashMap: O(1) avg", category: "informatik",
    description: "Typische Laufzeiten wichtiger Datenstrukturen", vars: "n = Anzahl Elemente",
    usage: "Richtige Datenstruktur w\u00e4hlen", example: "Array-Lookup: O(1), LinkedList-Suche: O(n), BST: O(log n)",
    mistakes: "HashMap Worst-Case ist O(n), nicht O(1)",
    synonyms: ["data structure", "datenstruktur", "hashmap", "array", "linked list", "bst"], related: ["bigo"] },
  { id: "boolesche_algebra", title: "Boolesche Algebra", formula: "A \u2227 (B \u2228 C) = (A\u2227B) \u2228 (A\u2227C)", category: "informatik",
    description: "Distributivgesetz und De Morgan", vars: "A, B, C = boolesche Variablen (0/1)",
    usage: "Logikschaltungen, SQL WHERE, Programmierung", example: "De Morgan: \u00ac(A\u2227B) = \u00acA \u2228 \u00acB",
    mistakes: "De Morgan: Negation \u00e4ndert \u2227\u2194\u2228",
    synonyms: ["boolean algebra", "logik", "de morgan", "and or not", "wahrheitstabelle"], related: [] },
  { id: "binaer_dezimal", title: "Bin\u00e4r \u2194 Dezimal", formula: "\u03a3 b\u1d62 \u00b7 2\u2071 (von rechts, i ab 0)", category: "informatik",
    description: "Umrechnung Bin\u00e4r-Dezimal", vars: "b\u1d62 = Bit (0 oder 1)",
    usage: "Zahlensysteme, Speicherberechnung", example: "1011\u2082 = 1\u00b78 + 0\u00b74 + 1\u00b72 + 1\u00b71 = 11\u2081\u2080",
    mistakes: "Bits von rechts z\u00e4hlen (LSB=Position 0)",
    synonyms: ["binary", "binaer", "hex", "dezimal", "zahlensystem"], related: ["bigo"] },
  { id: "rekursion", title: "Master-Theorem", formula: "T(n) = aT(n/b) + O(n\u1d48)", category: "informatik",
    description: "L\u00f6sung von Divide-and-Conquer Rekurrenzen", vars: "a = Teilprobleme, b = Teilungsfaktor, d = Kombinationskosten",
    usage: "Mergesort, Quicksort, Bin\u00e4re Suche analysieren", example: "Mergesort: T(n)=2T(n/2)+O(n) \u2192 O(n log n)",
    mistakes: "Drei F\u00e4lle unterscheiden: d vs log_b(a)",
    synonyms: ["master theorem", "rekurrenz", "divide and conquer", "rekursion"], related: ["bigo", "ds_komplexitaet"] },
];


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
  /* constants & unitGroups now inside UnitsTool */
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
          <h1 className="text-xl sm:text-2xl font-bold text-surface-900 flex items-center gap-2"><Calculator size={24} className="text-brand-600" /> {t("math.title")}</h1>
          <p className="text-surface-500 text-xs sm:text-sm mt-1">{t("math.subtitle")}</p>
        </div>
        <button onClick={() => setShowHistory(!showHistory)} className="px-3 sm:px-4 py-2 rounded-lg bg-surface-100 text-surface-700 hover:bg-surface-200 text-sm flex items-center gap-2 self-start sm:self-auto">
          <ScrollText size={16} /> {t("math.history")} {history.length > 0 && <span className="bg-brand-600 text-white text-xs rounded-full px-2">{history.length}</span>}
        </button>
      </div>

      {/* Tool Tabs */}
      <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {tools.map((tool) => (
          <button key={tool.key} onClick={() => setActiveTool(tool.key)} className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${activeTool === tool.key ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-500 hover:bg-surface-200 hover:text-surface-800"}`}>
            <tool.icon size={16} />
            <span className="hidden sm:inline">{tool.label}</span>
          </button>
        ))}
      </div>

      {/* History Sidebar */}
      {showHistory && (
        <div className="bg-[rgb(var(--card-bg))] rounded-xl border border-surface-200 p-4">
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
      <div className="bg-[rgb(var(--card-bg))] rounded-xl border border-surface-200 p-3 sm:p-6">
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
  const [showSci, setShowSci] = useState(true);
  const [lastAns, setLastAns] = useState("0");
  const [history, setHistory] = useState<{ expr: string; result: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [vars, setVars] = useState<Record<string, string>>({});
  const [showVars, setShowVars] = useState(false);
  const [varName, setVarName] = useState("");
  const [showSteps, setShowSteps] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Enhanced eval with more functions ── */
  const evalExpr = useCallback((raw: string): string => {
    try {
      let expr = raw;
      // Replace stored variables
      for (const [vn, vv] of Object.entries(vars)) {
        expr = expr.replace(new RegExp(`\\b${vn}\\b`, "g"), `(${vv})`);
      }
      // Replace Ans
      expr = expr.replace(/\bAns\b/g, `(${lastAns})`);
      // Scientific notation: 3.2EE-5 → 3.2e-5
      expr = expr.replace(/EE/g, "e");
      // Constants
      expr = expr.replace(/\u03c0/g, `(${Math.PI})`);
      expr = expr.replace(/\be\b(?!\w)/g, `(${Math.E})`);
      // Functions
      expr = expr.replace(/\u221a\(([^)]+)\)/g, "Math.sqrt($1)");
      expr = expr.replace(/\u221a(\d+)/g, "Math.sqrt($1)");
      const degWrap = (fn: string) => angleMode === "deg"
        ? `Math.${fn}(($1)*${Math.PI}/180)` : `Math.${fn}($1)`;
      const invDegWrap = (fn: string) => angleMode === "deg"
        ? `(Math.${fn}($1)*180/${Math.PI})` : `Math.${fn}($1)`;
      expr = expr.replace(/\bsin\(([^)]+)\)/g, degWrap("sin"));
      expr = expr.replace(/\bcos\(([^)]+)\)/g, degWrap("cos"));
      expr = expr.replace(/\btan\(([^)]+)\)/g, degWrap("tan"));
      expr = expr.replace(/\basin\(([^)]+)\)/g, invDegWrap("asin"));
      expr = expr.replace(/\bacos\(([^)]+)\)/g, invDegWrap("acos"));
      expr = expr.replace(/\batan\(([^)]+)\)/g, invDegWrap("atan"));
      expr = expr.replace(/\bsinh\(([^)]+)\)/g, "Math.sinh($1)");
      expr = expr.replace(/\bcosh\(([^)]+)\)/g, "Math.cosh($1)");
      expr = expr.replace(/\btanh\(([^)]+)\)/g, "Math.tanh($1)");
      expr = expr.replace(/\bln\(([^)]+)\)/g, "Math.log($1)");
      expr = expr.replace(/\blog\(([^)]+)\)/g, "Math.log10($1)");
      expr = expr.replace(/\blog\u2082\(([^)]+)\)/g, "(Math.log($1)/Math.LN2)");
      expr = expr.replace(/\babs\(([^)]+)\)/g, "Math.abs($1)");
      expr = expr.replace(/\|([^|]+)\|/g, "Math.abs($1)");
      // Operators
      expr = expr.replace(/\u00d7/g, "*").replace(/\u00f7/g, "/").replace(/\u2212/g, "-");
      expr = expr.replace(/\^/g, "**");
      // e^x and 10^x buttons
      expr = expr.replace(/e\u02e3\(([^)]+)\)/g, "Math.exp($1)");
      expr = expr.replace(/10\u02e3\(([^)]+)\)/g, "Math.pow(10,$1)");
      // 1/x
      expr = expr.replace(/1\/x\(([^)]+)\)/g, "(1/($1))");
      // Factorial
      expr = expr.replace(/(\d+)!/g, (_: string, n: string) => {
        let f = 1;
        for (let i = 2; i <= Number(n); i++) f *= i;
        return String(f);
      });
      // Modulo
      expr = expr.replace(/\bmod\b/g, "%");
      // Percentage: handle patterns like 200+10% → 200*(1+10/100)
      // Simple: just replace standalone % with /100
      expr = expr.replace(/(\d+\.?\d*)%/g, "($1/100)");
      // Safety check
      if (/[a-zA-Z_$]/.test(expr.replace(/Math\.\w+/g, "").replace(/Infinity|NaN/g, ""))) {
        return t("math.invalidExpression");
      }
      const res = Function(`"use strict"; return (${expr})`)();
      if (typeof res === "number") {
        if (Number.isNaN(res)) return "NaN";
        if (!Number.isFinite(res)) return "\u221e";
        return Number.isInteger(res) ? String(res) : res.toPrecision(12).replace(/\.?0+$/, "");
      }
      return String(res);
    } catch {
      return t("math.error");
    }
  }, [angleMode, lastAns, vars, t]);

  /* ── Generate steps for basic arithmetic ── */
  const generateSteps = useCallback((expr: string, res: string): string[] => {
    const stepsArr: string[] = [];
    stepsArr.push(`${t("math.calc.input")}: ${expr}`);
    // Show substitutions if variables were used
    let sub = expr;
    for (const [vn, vv] of Object.entries(vars)) {
      if (expr.includes(vn)) {
        sub = sub.replace(new RegExp(`\\b${vn}\\b`, "g"), vv);
        stepsArr.push(`${vn} = ${vv} ${t("math.calc.substituted")}`);
      }
    }
    if (expr.includes("Ans")) {
      sub = sub.replace(/\bAns\b/g, lastAns);
      stepsArr.push(`Ans = ${lastAns}`);
    }
    if (sub !== expr) stepsArr.push(`= ${sub}`);
    stepsArr.push(`= ${res}`);
    return stepsArr;
  }, [vars, lastAns, t]);

  const handleButton = (btn: string) => {
    if (btn === "C") { setDisplay(""); setResult(""); setSteps([]); return; }
    if (btn === "\u232b") { setDisplay(p => p.slice(0, -1)); return; }
    if (btn === "=") {
      if (!display.trim()) return;
      if (checkLimit && !checkLimit()) return;
      const r = evalExpr(display);
      setResult(r);
      if (r !== t("math.error") && r !== t("math.invalidExpression")) {
        setLastAns(r);
        setHistory(prev => [{ expr: display, result: r }, ...prev].slice(0, 50));
        setSteps(generateSteps(display, r));
      }
      onSave("calculator", display, r, moduleId);
      return;
    }
    // Function buttons that need opening paren
    const fnBtns = ["sin", "cos", "tan", "asin", "acos", "atan", "sinh", "cosh", "tanh",
      "ln", "log", "log\u2082", "abs", "\u221a", "e\u02e3", "10\u02e3", "1/x"];
    if (fnBtns.includes(btn)) {
      setDisplay(p => p + (btn === "\u221a" ? "\u221a(" : btn + "("));
      return;
    }
    if (btn === "EE") { setDisplay(p => p + "e"); return; }
    if (btn === "|x|") { setDisplay(p => p + "|"); return; }
    setDisplay(p => p + btn);
  };

  /* ── Save variable ── */
  const saveVar = () => {
    if (varName && result && result !== t("math.error")) {
      setVars(prev => ({ ...prev, [varName]: result }));
      setVarName("");
    }
  };

  /* ── Button style helper ── */
  const btnStyle = (btn: string) => {
    if (btn === "=") return "bg-brand-600 text-white hover:bg-brand-700";
    if (btn === "C" || btn === "\u232b") return "bg-danger-600/10 text-danger-600 hover:bg-danger-600/20";
    if (["\u00f7", "\u00d7", "\u2212", "+", "^", "mod"].includes(btn)) return "bg-surface-200 text-brand-600 hover:bg-surface-300";
    if (btn.length > 1 || ["\u221a", "\u03c0", "!", "%", "|x|", "EE"].includes(btn)) return "bg-surface-50 text-brand-600 hover:bg-surface-100";
    return "bg-surface-100 text-surface-900 hover:bg-surface-200";
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-surface-900">{t("math.scientificCalculator")}</h2>
        <div className="flex items-center gap-2">
          <select value={moduleId || ""} onChange={e => setModuleId(e.target.value || null)} className="bg-surface-100 text-surface-700 text-xs rounded-lg px-2 py-1.5 border border-surface-200">
            <option value="">{t("math.noModule")}</option>
            {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button onClick={() => setAngleMode(angleMode === "deg" ? "rad" : "deg")} className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition ${angleMode === "deg" ? "bg-brand-600 text-white border-brand-600" : "bg-surface-100 text-surface-700 border-surface-200"}`}>
            {angleMode === "deg" ? "DEG" : "RAD"}
          </button>
          <button onClick={() => setShowSci(!showSci)} className="px-2.5 py-1.5 rounded-lg bg-surface-100 text-surface-700 text-xs border border-surface-200 hover:bg-surface-200">
            {showSci ? t("math.calc.basic") : t("math.calc.scientific")}
          </button>
        </div>
      </div>

      {/* Display */}
      <div className="bg-surface-50 rounded-xl p-4 mb-3 border border-surface-200">
        <input ref={inputRef} value={display} onChange={e => setDisplay(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleButton("="); }} placeholder={t("math.enterExpression")} className="w-full bg-transparent text-surface-900 text-lg sm:text-xl font-mono outline-none text-right" />
        {result && <div className="text-right text-success-600 text-xl sm:text-2xl font-mono mt-2 font-bold break-all">= {result}</div>}
      </div>

      {/* Quick actions bar */}
      <div className="flex gap-2 mb-3 overflow-x-auto">
        <button onClick={() => setShowHistory(!showHistory)} className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition ${showHistory ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-700 hover:bg-surface-200"}`}>
          {t("math.calc.history")} ({history.length})
        </button>
        <button onClick={() => setShowVars(!showVars)} className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition ${showVars ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-700 hover:bg-surface-200"}`}>
          {t("math.calc.variables")} ({Object.keys(vars).length})
        </button>
        <button onClick={() => setShowSteps(!showSteps)} className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition ${showSteps ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-700 hover:bg-surface-200"}`}>
          {t("math.calc.steps")}
        </button>
      </div>

      {/* Steps display */}
      {showSteps && steps.length > 0 && (
        <div className="bg-surface-50 rounded-lg p-3 mb-3 border border-surface-200">
          <p className="text-xs font-medium text-surface-700 mb-1">{t("math.calc.stepByStep")}</p>
          {steps.map((s, i) => (
            <div key={i} className="text-xs font-mono text-surface-600 py-0.5">{s}</div>
          ))}
        </div>
      )}

      {/* History panel */}
      {showHistory && (
        <div className="bg-surface-50 rounded-lg p-3 mb-3 border border-surface-200 max-h-40 overflow-y-auto">
          <p className="text-xs font-medium text-surface-700 mb-2">{t("math.calc.history")}</p>
          {history.length === 0 && <p className="text-xs text-surface-400">{t("math.calc.noHistory")}</p>}
          {history.map((h, i) => (
            <div key={i} className="flex items-center justify-between py-1 border-b border-surface-100 last:border-0 cursor-pointer hover:bg-surface-100 rounded px-1" onClick={() => { setDisplay(h.expr); setResult(h.result); setShowHistory(false); }}>
              <span className="text-xs font-mono text-surface-600 truncate">{h.expr}</span>
              <span className="text-xs font-mono text-success-600 ml-2 shrink-0">= {h.result}</span>
            </div>
          ))}
        </div>
      )}

      {/* Variables panel */}
      {showVars && (
        <div className="bg-surface-50 rounded-lg p-3 mb-3 border border-surface-200">
          <p className="text-xs font-medium text-surface-700 mb-2">{t("math.calc.variables")}</p>
          <div className="flex gap-2 mb-2">
            <input value={varName} onChange={e => setVarName(e.target.value.replace(/[^a-zA-Z]/g, ""))} placeholder={t("math.calc.varName")} className="flex-1 bg-[rgb(var(--card-bg))] text-surface-900 rounded px-2 py-1.5 border border-surface-200 text-xs font-mono" maxLength={5} />
            <span className="text-xs text-surface-400 self-center">= {result || "?"}</span>
            <button onClick={saveVar} disabled={!varName || !result} className="px-3 py-1.5 rounded bg-brand-600 text-white text-xs disabled:opacity-40">{t("math.save")}</button>
          </div>
          {Object.keys(vars).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(vars).map(([vn, vv]) => (
                <div key={vn} className="flex items-center gap-1 bg-[rgb(var(--card-bg))] rounded px-2 py-1 border border-surface-200">
                  <span className="text-xs font-mono text-brand-600 cursor-pointer" onClick={() => setDisplay(p => p + vn)}>{vn}={vv}</span>
                  <button onClick={() => setVars(prev => { const n = { ...prev }; delete n[vn]; return n; })} className="text-surface-400 hover:text-danger-600 text-xs ml-1">\u00d7</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Button Grid */}
      {showSci ? (
        <div className="flex gap-3">
          {/* Scientific panel */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-4 gap-1">
              {CALC_SCI.map((row, ri) => (
                row.map((btn, ci) => (
                  <button key={`sci-${ri}-${ci}`} onClick={() => handleButton(btn)} className={`py-2 sm:py-2.5 rounded-lg font-mono text-[11px] sm:text-xs font-medium transition-all active:scale-95 ${btnStyle(btn)}`}>
                    {btn}
                  </button>
                ))
              ))}
            </div>
          </div>
          {/* Basic number pad */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-4 gap-1.5">
              {CALC_BASIC.map((row, ri) => (
                row.map((btn, ci) => (
                  <button key={`basic-${ri}-${ci}`} onClick={() => handleButton(btn)} className={`py-2.5 sm:py-3 rounded-lg font-mono text-sm sm:text-base font-semibold transition-all active:scale-95 ${btnStyle(btn)}`}>
                    {btn}
                  </button>
                ))
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1.5 max-w-xs mx-auto">
          {CALC_BASIC.map((row, ri) => (
            row.map((btn, ci) => (
              <button key={`basic-${ri}-${ci}`} onClick={() => handleButton(btn)} className={`py-3 rounded-lg font-mono text-base font-semibold transition-all active:scale-95 ${btnStyle(btn)}`}>
                {btn}
              </button>
            ))
          ))}
        </div>
      )}

      {/* Keyboard hint */}
      <p className="text-surface-400 text-xs mt-2 text-center">{t("math.calc.keyboardHint")}</p>
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
  const { t, locale } = useTranslation();
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
  const [sysA1, setSysA1] = useState(""); const [sysB1, setSysB1] = useState(""); const [sysR1, setSysR1] = useState("");
  const [sysA2, setSysA2] = useState(""); const [sysB2, setSysB2] = useState(""); const [sysR2, setSysR2] = useState("");
  const [sysC1, setSysC1] = useState(""); const [sysC2, setSysC2] = useState("");
  const [sysA3, setSysA3] = useState(""); const [sysB3, setSysB3] = useState(""); const [sysC3, setSysC3] = useState(""); const [sysR3, setSysR3] = useState("");
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
      const res = solveSystem2Steps(Number(sysA1), Number(sysB1), Number(sysR1), Number(sysA2), Number(sysB2), Number(sysR2));
      setResult(res);
      setError("");
      onSave("equations", `${sysA1}x+${sysB1}y=${sysR1}; ${sysA2}x+${sysB2}y=${sysR2}`, res.solutions.join(", "), moduleId);
    } else {
      // 3x3 → use AI
      solveWithAI(`${sysA1}x + ${sysB1}y + ${sysC1}z = ${sysR1}\n${sysA2}x + ${sysB2}y + ${sysC2}z = ${sysR2}\n${sysA3}x + ${sysB3}y + ${sysC3}z = ${sysR3}`, "system");
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
      if (!session) { setError(t("math.notLoggedIn")); setLoading(false); return; }

      const res = await fetch("/api/math/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          equation: eqToSolve,
          variable,
          mode: aiMode || mode,
          targetVariable: targetVar || variable,
          language: locale,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("math.error"));
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
              className="w-full bg-[rgb(var(--card-bg))] text-surface-900 rounded-lg px-4 py-3 border border-surface-200 font-mono text-base focus:border-brand-500 focus:outline-none"
            />
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-surface-500">{t("math.variable")}:</span>
              <input value={variable} onChange={e => setVariable(e.target.value)} className="bg-[rgb(var(--card-bg))] text-surface-900 rounded px-2 py-1 border border-surface-200 font-mono w-12 text-center text-sm" />
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
              className="w-full bg-[rgb(var(--card-bg))] text-surface-900 rounded-lg px-4 py-3 border border-surface-200 font-mono text-base focus:border-brand-500 focus:outline-none"
            />
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-surface-500">{t("math.rearrangeFor")}:</span>
              <input value={targetVar} onChange={e => setTargetVar(e.target.value)} placeholder="U" className="bg-[rgb(var(--card-bg))] text-surface-900 rounded px-2 py-1 border border-surface-200 font-mono w-16 text-center text-sm" />
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
              <span>=</span><input value={sysR1} onChange={e => setSysR1(e.target.value)} className={inputCls} placeholder="r₁" />
            </div>
            <div className="flex items-center gap-1.5 justify-center text-sm text-surface-900 font-mono flex-wrap">
              <input value={sysA2} onChange={e => setSysA2(e.target.value)} className={inputCls} placeholder="a₂" /><span>x +</span>
              <input value={sysB2} onChange={e => setSysB2(e.target.value)} className={inputCls} placeholder="b₂" /><span>y</span>
              {sysSize === 3 && <><span>+</span><input value={sysC2} onChange={e => setSysC2(e.target.value)} className={inputCls} placeholder="c₂" /><span>z</span></>}
              <span>=</span><input value={sysR2} onChange={e => setSysR2(e.target.value)} className={inputCls} placeholder="r₂" />
            </div>
            {sysSize === 3 && (
              <div className="flex items-center gap-1.5 justify-center text-sm text-surface-900 font-mono flex-wrap">
                <input value={sysA3} onChange={e => setSysA3(e.target.value)} className={inputCls} placeholder="a₃" /><span>x +</span>
                <input value={sysB3} onChange={e => setSysB3(e.target.value)} className={inputCls} placeholder="b₃" /><span>y +</span>
                <input value={sysC3} onChange={e => setSysC3(e.target.value)} className={inputCls} placeholder="c₃" /><span>z =</span>
                <input value={sysR3} onChange={e => setSysR3(e.target.value)} className={inputCls} placeholder="r₃" />
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
        <div className="bg-[rgb(var(--card-bg))] border border-surface-200 rounded-xl overflow-hidden mb-4">
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
        <div className="text-sm text-surface-600 mb-2">{t("math.matrixA")}</div>
        <div className="border-l-2 border-r-2 border-surface-300 px-2 py-1 inline-block">
          {matA.map((row, r) => (
            <div key={r} className="flex gap-1">
              {row.map((v, c) => (
                <input key={c} type="number" value={v || ""} onChange={(e) => { const copy = matA.map(r => [...r]); copy[r][c] = Number(e.target.value) || 0; setMatA(copy); }} className="w-12 h-9 bg-[rgb(var(--card-bg))] text-surface-900 text-center rounded border border-surface-200 text-sm font-mono" />
              ))}
            </div>
          ))}
        </div>
      </div>

      {(operation === "multiply" || operation === "add" || operation === "subtract") && (
        <div className="bg-surface-50 rounded-lg p-3 border border-surface-200">
          <div className="text-sm text-surface-600 mb-2">{t("math.matrixB")}</div>
          <div className="border-l-2 border-r-2 border-surface-300 px-2 py-1 inline-block">
            {matB.map((row, r) => (
              <div key={r} className="flex gap-1">
                {row.map((v, c) => (
                  <input key={c} type="number" value={v || ""} onChange={(e) => { const copy = matB.map(r => [...r]); copy[r][c] = Number(e.target.value) || 0; setMatB(copy); }} className="w-12 h-9 bg-[rgb(var(--card-bg))] text-surface-900 text-center rounded border border-surface-200 text-sm font-mono" />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {operation === "scalar_mul" && (
        <div className="bg-surface-50 rounded-lg p-3 border border-surface-200">
          <label className="text-sm text-surface-600">{t("math.matScalar")} k</label>
          <input type="number" value={scalar} onChange={(e) => setScalar(Number(e.target.value))} className="w-20 h-9 bg-[rgb(var(--card-bg))] text-surface-900 px-2 rounded border border-surface-200 text-sm font-mono mt-1" />
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
          setResult(t("math.error"));
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
                  <input key={c} type="number" value={v || ""} onChange={(e) => { const copy = augmentedMat.map(r => [...r]); copy[r][c] = Number(e.target.value) || 0; setAugmentedMat(copy); }} className={`w-12 h-9 bg-[rgb(var(--card-bg))] text-surface-900 text-center rounded border ${c === n ? "border-brand-400" : "border-surface-200"} text-sm font-mono`} />
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 500 });
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
  const touchStartRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);

  /* ── Responsive canvas sizing ── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.round(entry.contentRect.width * (window.devicePixelRatio || 1));
        const h = Math.round(w * 0.625); // 5:8 ratio
        setCanvasSize({ w, h });
      }
    });
    ro.observe(container);
    // Initial size
    const w = Math.round(container.clientWidth * (window.devicePixelRatio || 1));
    setCanvasSize({ w, h: Math.round(w * 0.625) });
    return () => ro.disconnect();
  }, []);

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
  }, [functions, xMin, xMax, yMin, yMax, mousePos, evalExpr, derivative, showDerivative, tangentPoint, paramMode, params, findIntersections, canvasSize]);

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
      setDragStart({ x, y }); // update so next move is a delta, not cumulative
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // prevent text selection while dragging
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

  /* Native wheel handler (passive: false) so preventDefault() actually blocks page zoom */
  const handleWheelNative = useCallback((e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const factor = e.deltaY > 0 ? 1.2 : 0.8;
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    setXMin((prev) => {
      const cx = prev + (px / rect.width) * (xMax - prev);
      const w = (xMax - prev) * factor;
      return cx - (w * px) / rect.width;
    });
    setXMax((prev) => {
      const cx = xMin + (px / rect.width) * (prev - xMin);
      const w = (prev - xMin) * factor;
      return cx + (w * (rect.width - px)) / rect.width;
    });
  }, [xMin, xMax]);

  /* Attach wheel with { passive: false } to actually prevent page zoom */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("wheel", handleWheelNative, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheelNative);
  }, [handleWheelNative]);

  /* ── Touch events for mobile ── */
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = ((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) / rect.width;
      const cy = ((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top) / rect.height;
      touchStartRef.current = { dist, cx, cy };
    } else if (e.touches.length === 1) {
      const rect = e.currentTarget.getBoundingClientRect();
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.touches.length === 2 && touchStartRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const factor = touchStartRef.current.dist / dist;
      const cx = xMin + touchStartRef.current.cx * (xMax - xMin);
      const w = (xMax - xMin) * factor;
      const h = (yMax - yMin) * factor;
      setXMin(cx - touchStartRef.current.cx * w);
      setXMax(cx + (1 - touchStartRef.current.cx) * w);
      const cy = yMin + (1 - touchStartRef.current.cy) * (yMax - yMin);
      setYMin(cy - (1 - touchStartRef.current.cy) * h);
      setYMax(cy + touchStartRef.current.cy * h);
      touchStartRef.current.dist = dist;
    } else if (e.touches.length === 1 && isDragging && dragStart) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.touches[0].clientX - rect.left;
      const y = e.touches[0].clientY - rect.top;
      const ddx = (dragStart.x - x) / rect.width * (xMax - xMin);
      const ddy = (y - dragStart.y) / rect.height * (yMax - yMin);
      setXMin(xMin + ddx); setXMax(xMax + ddx);
      setYMin(yMin + ddy); setYMax(yMax + ddy);
      setDragStart({ x, y });
    }
  };

  const handleTouchEnd = () => { setIsDragging(false); setDragStart(null); touchStartRef.current = null; };

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
          <button onClick={savePlot} className="px-3 py-1.5 rounded-lg bg-surface-100 text-surface-700 text-sm hover:bg-surface-200 whitespace-nowrap"><Save size={14} className="inline -mt-0.5 mr-1" />{t("math.save")}</button>
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
        <div className="mb-4">
          <p className="text-xs text-surface-400 mb-2">{t("math.plotParamHint") || "Verwende a, b, c in deiner Funktion, z.B. a*sin(b*x+c)"}</p>
          <div className="grid grid-cols-3 gap-3 text-sm">
            {Object.entries(params).map(([key, val]) => (
              <div key={key}>
                <label className="text-surface-600 block text-xs mb-1 font-mono font-semibold">{key} = {val.toFixed(1)}</label>
                <input type="range" min="-10" max="10" step="0.1" value={val} onChange={(e) => setParams(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))} className="w-full accent-brand-600" />
              </div>
            ))}
          </div>
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
          <button onClick={() => { setXMin(xMin * 0.5); setXMax(xMax * 0.5); setYMin(yMin * 0.5); setYMax(yMax * 0.5); }} className="px-2 py-1 bg-surface-100 text-surface-700 rounded hover:bg-surface-200 text-xs"><ZoomIn size={14} /></button>
          <button onClick={() => { setXMin(xMin * 2); setXMax(xMax * 2); setYMin(yMin * 2); setYMax(yMax * 2); }} className="px-2 py-1 bg-surface-100 text-surface-700 rounded hover:bg-surface-200 text-xs"><ZoomOut size={14} /></button>
          <button onClick={() => { setXMin(-10); setXMax(10); setYMin(-5); setYMax(5); }} className="px-2 py-1 bg-surface-100 text-surface-700 rounded hover:bg-surface-200 text-xs"><RotateCcw size={14} /></button>
        </div>
      </div>

      <div ref={containerRef} className="w-full">
        <canvas ref={canvasRef} width={canvasSize.w} height={canvasSize.h}
          onMouseMove={handleMouseMove} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onClick={handleCanvasClick}
          onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
          className="w-full rounded-xl border border-surface-200 cursor-crosshair touch-none"
          style={{ height: "auto", aspectRatio: "8 / 5" }} />
      </div>

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
          <button onClick={handleSave} className="px-3 py-1.5 rounded-lg bg-surface-100 text-surface-700 text-sm hover:bg-surface-200 whitespace-nowrap"><Save size={14} className="inline -mt-0.5 mr-1" />{t("math.save")}</button>
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
/* TOOL 6: Einheiten & Konstanten — Lernsystem                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

interface UnitDef { symbol: string; nameKey: string; dim: number[]; factor: number; isTemp?: boolean }
interface ConstDef { nameKey: string; symbol: string; value: number; display: string; unit: string; cat: string; descKey: string }
interface ConvResult { value: number; display: string; from: string; to: string; steps: string[]; error?: never }
interface ConvError { error: string; value?: never }

const UNIT_DB: Record<string, UnitDef> = {
  /* Length [1,0,0,0,0,0,0] */
  m:   { symbol: "m",   nameKey: "math.unit.meter",      dim: [1,0,0,0,0,0,0], factor: 1 },
  km:  { symbol: "km",  nameKey: "math.unit.kilometer",  dim: [1,0,0,0,0,0,0], factor: 1000 },
  cm:  { symbol: "cm",  nameKey: "math.unit.centimeter",  dim: [1,0,0,0,0,0,0], factor: 0.01 },
  mm:  { symbol: "mm",  nameKey: "math.unit.millimeter",  dim: [1,0,0,0,0,0,0], factor: 0.001 },
  "\u00b5m": { symbol: "\u00b5m", nameKey: "math.unit.micrometer", dim: [1,0,0,0,0,0,0], factor: 1e-6 },
  nm:  { symbol: "nm",  nameKey: "math.unit.nanometer",   dim: [1,0,0,0,0,0,0], factor: 1e-9 },
  mi:  { symbol: "mi",  nameKey: "math.unit.mile",        dim: [1,0,0,0,0,0,0], factor: 1609.344 },
  ft:  { symbol: "ft",  nameKey: "math.unit.foot",        dim: [1,0,0,0,0,0,0], factor: 0.3048 },
  "in": { symbol: "in", nameKey: "math.unit.inch",        dim: [1,0,0,0,0,0,0], factor: 0.0254 },
  yd:  { symbol: "yd",  nameKey: "math.unit.yard",        dim: [1,0,0,0,0,0,0], factor: 0.9144 },
  nmi: { symbol: "nmi", nameKey: "math.unit.nauticalMile",dim: [1,0,0,0,0,0,0], factor: 1852 },
  /* Mass [0,1,0,0,0,0,0] */
  kg:  { symbol: "kg",  nameKey: "math.unit.kilogram",    dim: [0,1,0,0,0,0,0], factor: 1 },
  g:   { symbol: "g",   nameKey: "math.unit.gram",        dim: [0,1,0,0,0,0,0], factor: 0.001 },
  mg:  { symbol: "mg",  nameKey: "math.unit.milligram",   dim: [0,1,0,0,0,0,0], factor: 1e-6 },
  "\u00b5g": { symbol: "\u00b5g", nameKey: "math.unit.microgram", dim: [0,1,0,0,0,0,0], factor: 1e-9 },
  t:   { symbol: "t",   nameKey: "math.unit.ton",         dim: [0,1,0,0,0,0,0], factor: 1000 },
  lb:  { symbol: "lb",  nameKey: "math.unit.pound",       dim: [0,1,0,0,0,0,0], factor: 0.453592 },
  oz:  { symbol: "oz",  nameKey: "math.unit.ounce",       dim: [0,1,0,0,0,0,0], factor: 0.0283495 },
  /* Time [0,0,1,0,0,0,0] */
  s:   { symbol: "s",   nameKey: "math.unit.second",      dim: [0,0,1,0,0,0,0], factor: 1 },
  ms:  { symbol: "ms",  nameKey: "math.unit.millisecond", dim: [0,0,1,0,0,0,0], factor: 0.001 },
  "\u00b5s": { symbol: "\u00b5s", nameKey: "math.unit.microsecond", dim: [0,0,1,0,0,0,0], factor: 1e-6 },
  min: { symbol: "min", nameKey: "math.unit.minute",      dim: [0,0,1,0,0,0,0], factor: 60 },
  h:   { symbol: "h",   nameKey: "math.unit.hour",        dim: [0,0,1,0,0,0,0], factor: 3600 },
  d:   { symbol: "d",   nameKey: "math.unit.day",         dim: [0,0,1,0,0,0,0], factor: 86400 },
  week:{ symbol: "week",nameKey: "math.unit.week",        dim: [0,0,1,0,0,0,0], factor: 604800 },
  year:{ symbol: "year",nameKey: "math.unit.year",        dim: [0,0,1,0,0,0,0], factor: 3.15576e7 },
  /* Temperature [0,0,0,0,1,0,0] — special handling */
  K:     { symbol: "K",   nameKey: "math.unit.kelvin",     dim: [0,0,0,0,1,0,0], factor: 1, isTemp: true },
  "\u00b0C": { symbol: "\u00b0C", nameKey: "math.unit.celsius",    dim: [0,0,0,0,1,0,0], factor: 1, isTemp: true },
  "\u00b0F": { symbol: "\u00b0F", nameKey: "math.unit.fahrenheit", dim: [0,0,0,0,1,0,0], factor: 1, isTemp: true },
  /* Speed [1,0,-1,0,0,0,0] */
  "m/s":  { symbol: "m/s",  nameKey: "math.unit.meterPerSecond",    dim: [1,0,-1,0,0,0,0], factor: 1 },
  "km/h": { symbol: "km/h", nameKey: "math.unit.kilometerPerHour",  dim: [1,0,-1,0,0,0,0], factor: 1/3.6 },
  mph:    { symbol: "mph",  nameKey: "math.unit.milePerHour",       dim: [1,0,-1,0,0,0,0], factor: 0.44704 },
  kn:     { symbol: "kn",   nameKey: "math.unit.knot",              dim: [1,0,-1,0,0,0,0], factor: 0.51444 },
  /* Force [1,1,-2,0,0,0,0] */
  N:   { symbol: "N",   nameKey: "math.unit.newton",      dim: [1,1,-2,0,0,0,0], factor: 1 },
  kN:  { symbol: "kN",  nameKey: "math.unit.kilonewton",  dim: [1,1,-2,0,0,0,0], factor: 1000 },
  dyn: { symbol: "dyn", nameKey: "math.unit.dyne",        dim: [1,1,-2,0,0,0,0], factor: 1e-5 },
  lbf: { symbol: "lbf", nameKey: "math.unit.poundForce",  dim: [1,1,-2,0,0,0,0], factor: 4.44822 },
  /* Energy [2,1,-2,0,0,0,0] */
  J:    { symbol: "J",    nameKey: "math.unit.joule",         dim: [2,1,-2,0,0,0,0], factor: 1 },
  kJ:   { symbol: "kJ",   nameKey: "math.unit.kilojoule",     dim: [2,1,-2,0,0,0,0], factor: 1000 },
  MJ:   { symbol: "MJ",   nameKey: "math.unit.megajoule",     dim: [2,1,-2,0,0,0,0], factor: 1e6 },
  cal:  { symbol: "cal",  nameKey: "math.unit.calorie",       dim: [2,1,-2,0,0,0,0], factor: 4.184 },
  kcal: { symbol: "kcal", nameKey: "math.unit.kilocalorie",   dim: [2,1,-2,0,0,0,0], factor: 4184 },
  eV:   { symbol: "eV",   nameKey: "math.unit.electronVolt",  dim: [2,1,-2,0,0,0,0], factor: 1.60218e-19 },
  kWh:  { symbol: "kWh",  nameKey: "math.unit.kilowattHour",  dim: [2,1,-2,0,0,0,0], factor: 3.6e6 },
  Wh:   { symbol: "Wh",   nameKey: "math.unit.wattHour",      dim: [2,1,-2,0,0,0,0], factor: 3600 },
  /* Power [2,1,-3,0,0,0,0] */
  W:   { symbol: "W",   nameKey: "math.unit.watt",         dim: [2,1,-3,0,0,0,0], factor: 1 },
  kW:  { symbol: "kW",  nameKey: "math.unit.kilowatt",     dim: [2,1,-3,0,0,0,0], factor: 1000 },
  MW:  { symbol: "MW",  nameKey: "math.unit.megawatt",     dim: [2,1,-3,0,0,0,0], factor: 1e6 },
  hp:  { symbol: "hp",  nameKey: "math.unit.horsepower",   dim: [2,1,-3,0,0,0,0], factor: 745.7 },
  PS:  { symbol: "PS",  nameKey: "math.unit.pferdestaerke",dim: [2,1,-3,0,0,0,0], factor: 735.5 },
  /* Pressure [-1,1,-2,0,0,0,0] */
  Pa:   { symbol: "Pa",   nameKey: "math.unit.pascal",      dim: [-1,1,-2,0,0,0,0], factor: 1 },
  kPa:  { symbol: "kPa",  nameKey: "math.unit.kilopascal",  dim: [-1,1,-2,0,0,0,0], factor: 1000 },
  MPa:  { symbol: "MPa",  nameKey: "math.unit.megapascal",  dim: [-1,1,-2,0,0,0,0], factor: 1e6 },
  bar:  { symbol: "bar",  nameKey: "math.unit.bar",         dim: [-1,1,-2,0,0,0,0], factor: 1e5 },
  mbar: { symbol: "mbar", nameKey: "math.unit.millibar",    dim: [-1,1,-2,0,0,0,0], factor: 100 },
  atm:  { symbol: "atm",  nameKey: "math.unit.atmosphere",  dim: [-1,1,-2,0,0,0,0], factor: 101325 },
  psi:  { symbol: "psi",  nameKey: "math.unit.psi",         dim: [-1,1,-2,0,0,0,0], factor: 6894.76 },
  mmHg: { symbol: "mmHg", nameKey: "math.unit.mmHg",        dim: [-1,1,-2,0,0,0,0], factor: 133.322 },
  Torr: { symbol: "Torr", nameKey: "math.unit.torr",        dim: [-1,1,-2,0,0,0,0], factor: 133.322 },
  /* Volume [3,0,0,0,0,0,0] — L is 0.001 m³ */
  L:    { symbol: "L",    nameKey: "math.unit.liter",          dim: [3,0,0,0,0,0,0], factor: 0.001 },
  mL:   { symbol: "mL",   nameKey: "math.unit.milliliter",     dim: [3,0,0,0,0,0,0], factor: 1e-6 },
  "m\u00b3": { symbol: "m\u00b3", nameKey: "math.unit.cubicMeter",  dim: [3,0,0,0,0,0,0], factor: 1 },
  "cm\u00b3":{ symbol: "cm\u00b3",nameKey: "math.unit.cubicCentimeter",dim:[3,0,0,0,0,0,0],factor:1e-6},
  gal:  { symbol: "gal",  nameKey: "math.unit.gallon",         dim: [3,0,0,0,0,0,0], factor: 0.00378541 },
  /* Area [2,0,0,0,0,0,0] */
  "m\u00b2":  { symbol: "m\u00b2",  nameKey: "math.unit.sqMeter",   dim: [2,0,0,0,0,0,0], factor: 1 },
  "km\u00b2": { symbol: "km\u00b2", nameKey: "math.unit.sqKm",      dim: [2,0,0,0,0,0,0], factor: 1e6 },
  "cm\u00b2": { symbol: "cm\u00b2", nameKey: "math.unit.sqCm",      dim: [2,0,0,0,0,0,0], factor: 1e-4 },
  ha:   { symbol: "ha",   nameKey: "math.unit.hectare",   dim: [2,0,0,0,0,0,0], factor: 10000 },
  acre: { symbol: "acre", nameKey: "math.unit.acre",      dim: [2,0,0,0,0,0,0], factor: 4046.86 },
  /* Electric */
  A:  { symbol: "A",  nameKey: "math.unit.ampere",  dim: [0,0,0,1,0,0,0], factor: 1 },
  V:  { symbol: "V",  nameKey: "math.unit.volt",    dim: [2,1,-3,-1,0,0,0], factor: 1 },
  "\u03a9": { symbol: "\u03a9", nameKey: "math.unit.ohm", dim: [2,1,-3,-2,0,0,0], factor: 1 },
  F:  { symbol: "F",  nameKey: "math.unit.farad",   dim: [-2,-1,4,2,0,0,0], factor: 1 },
  C:  { symbol: "C",  nameKey: "math.unit.coulomb", dim: [0,0,1,1,0,0,0], factor: 1 },
  T:  { symbol: "T",  nameKey: "math.unit.tesla",   dim: [0,1,-2,-1,0,0,0], factor: 1 },
  Wb: { symbol: "Wb", nameKey: "math.unit.weber",   dim: [2,1,-2,-1,0,0,0], factor: 1 },
  /* Frequency [0,0,-1,0,0,0,0] */
  Hz:  { symbol: "Hz",  nameKey: "math.unit.hertz",     dim: [0,0,-1,0,0,0,0], factor: 1 },
  kHz: { symbol: "kHz", nameKey: "math.unit.kilohertz", dim: [0,0,-1,0,0,0,0], factor: 1000 },
  MHz: { symbol: "MHz", nameKey: "math.unit.megahertz", dim: [0,0,-1,0,0,0,0], factor: 1e6 },
  GHz: { symbol: "GHz", nameKey: "math.unit.gigahertz", dim: [0,0,-1,0,0,0,0], factor: 1e9 },
  rpm: { symbol: "rpm", nameKey: "math.unit.rpm",       dim: [0,0,-1,0,0,0,0], factor: 1/60 },
};

/* Reverse lookup: case-insensitive symbol → key */
const UNIT_LOOKUP: Record<string, string> = {};
for (const [key, def] of Object.entries(UNIT_DB)) {
  UNIT_LOOKUP[key.toLowerCase()] = key;
  UNIT_LOOKUP[def.symbol.toLowerCase()] = key;
}
/* Explicit aliases for common inputs */
UNIT_LOOKUP["c"] = "\u00b0C"; UNIT_LOOKUP["°c"] = "\u00b0C";
UNIT_LOOKUP["f"] = "\u00b0F"; UNIT_LOOKUP["°f"] = "\u00b0F";
UNIT_LOOKUP["k"] = "K";
UNIT_LOOKUP["ohm"] = "\u03a9";
UNIT_LOOKUP["um"] = "\u00b5m"; UNIT_LOOKUP["ug"] = "\u00b5g"; UNIT_LOOKUP["us"] = "\u00b5s";

function lookupUnit(s: string): UnitDef | null {
  const key = UNIT_LOOKUP[s.toLowerCase()] ?? UNIT_LOOKUP[s];
  return key ? UNIT_DB[key] ?? null : null;
}

function dimEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function convertUnits(val: number, from: UnitDef, to: UnitDef): { result: number; steps: string[] } {
  if (from.isTemp && to.isTemp) {
    let celsius: number;
    const steps: string[] = [];
    if (from.symbol === "\u00b0C") { celsius = val; steps.push(`${val} \u00b0C`); }
    else if (from.symbol === "\u00b0F") { celsius = (val - 32) * 5/9; steps.push(`(${val} - 32) \u00d7 5/9 = ${celsius.toPrecision(10).replace(/\.?0+$/,"")}\u00b0C`); }
    else { celsius = val - 273.15; steps.push(`${val} - 273.15 = ${celsius.toPrecision(10).replace(/\.?0+$/,"")}\u00b0C`); }
    let result: number;
    if (to.symbol === "\u00b0C") { result = celsius; }
    else if (to.symbol === "\u00b0F") { result = celsius * 9/5 + 32; steps.push(`${celsius.toPrecision(6).replace(/\.?0+$/,"")} \u00d7 9/5 + 32 = ${result.toPrecision(10).replace(/\.?0+$/,"")} \u00b0F`); }
    else { result = celsius + 273.15; steps.push(`${celsius.toPrecision(6).replace(/\.?0+$/,"")} + 273.15 = ${result.toPrecision(10).replace(/\.?0+$/,"")} K`); }
    return { result, steps };
  }
  const si = val * from.factor;
  const result = si / to.factor;
  const steps = [
    `${val} ${from.symbol} \u00d7 ${from.factor} = ${si.toPrecision(10).replace(/\.?0+$/,"")} (SI)`,
    `${si.toPrecision(10).replace(/\.?0+$/,"")} \u00f7 ${to.factor} = ${result.toPrecision(10).replace(/\.?0+$/,"")} ${to.symbol}`,
  ];
  return { result, steps };
}

const CONST_DB: Omit<ConstDef, "nameKey" | "descKey">[] = [
  { symbol: "c",    value: 299792458,        display: "299 792 458",       unit: "m/s",       cat: "physics" },
  { symbol: "h",    value: 6.62607015e-34,   display: "6.626\u00d710\u207b\u00b3\u2074", unit: "J\u00b7s", cat: "physics" },
  { symbol: "\u0127",value:1.054571817e-34,   display: "1.055\u00d710\u207b\u00b3\u2074", unit: "J\u00b7s", cat: "physics" },
  { symbol: "G",    value: 6.674e-11,        display: "6.674\u00d710\u207b\u00b9\u00b9", unit: "m\u00b3/(kg\u00b7s\u00b2)", cat: "physics" },
  { symbol: "g",    value: 9.80665,          display: "9.80665",           unit: "m/s\u00b2", cat: "physics" },
  { symbol: "k_B",  value: 1.380649e-23,     display: "1.381\u00d710\u207b\u00b2\u00b3", unit: "J/K",       cat: "physics" },
  { symbol: "e",    value: 1.602176634e-19,  display: "1.602\u00d710\u207b\u00b9\u2079", unit: "C",         cat: "physics" },
  { symbol: "\u03b5\u2080",value:8.854187817e-12,display:"8.854\u00d710\u207b\u00b9\u00b2",unit:"F/m", cat:"physics" },
  { symbol: "\u00b5\u2080",value:1.25663706212e-6,display:"1.257\u00d710\u207b\u2076",unit:"H/m",cat:"physics" },
  { symbol: "\u03c3",value:5.670374419e-8,   display: "5.670\u00d710\u207b\u2078", unit: "W/(m\u00b2\u00b7K\u2074)", cat: "physics" },
  { symbol: "R\u221e",value:1.0973731568e7,  display: "1.097\u00d710\u2077", unit: "m\u207b\u00b9", cat: "physics" },
  { symbol: "N_A",  value: 6.02214076e23,    display: "6.022\u00d710\u00b2\u00b3", unit: "1/mol", cat: "chemistry" },
  { symbol: "R",    value: 8.31446261815,    display: "8.314",             unit: "J/(mol\u00b7K)", cat: "chemistry" },
  { symbol: "F",    value: 96485.33212,      display: "96 485.3",         unit: "C/mol",     cat: "chemistry" },
  { symbol: "u",    value: 1.66053906660e-27,display: "1.661\u00d710\u207b\u00b2\u2077", unit: "kg", cat: "chemistry" },
  { symbol: "\u03c0",value:Math.PI,          display: "3.14159 26535",     unit: "",          cat: "math" },
  { symbol: "e",    value: Math.E,           display: "2.71828 18284",     unit: "",          cat: "math" },
  { symbol: "\u03c6",value:1.618033988749895, display:"1.61803 39887",     unit: "",          cat: "math" },
  { symbol: "\u221a2",value:Math.SQRT2,      display: "1.41421 35623",     unit: "",          cat: "math" },
  { symbol: "ln(2)",value: Math.LN2,         display: "0.69314 71805",     unit: "",          cat: "math" },
  { symbol: "AU",   value: 1.495978707e11,   display: "1.496\u00d710\u00b9\u00b9", unit: "m", cat: "astronomy" },
  { symbol: "ly",   value: 9.46073047258e15, display: "9.461\u00d710\u00b9\u2075", unit: "m", cat: "astronomy" },
  { symbol: "M\u2609",value:1.98892e30,      display: "1.989\u00d710\u00b3\u2070", unit: "kg", cat: "astronomy" },
  { symbol: "M_E",  value: 5.9722e24,        display: "5.972\u00d710\u00b2\u2074", unit: "kg", cat: "astronomy" },
  { symbol: "R_E",  value: 6.371e6,          display: "6.371\u00d710\u2076", unit: "m",       cat: "astronomy" },
];

const DIM_LABELS = ["L","M","T","I","\u0398","N","J"];
const DIM_QUANTITIES: Record<string, string> = {
  "1,0,0,0,0,0,0":  "math.dim.length",
  "0,1,0,0,0,0,0":  "math.dim.mass",
  "0,0,1,0,0,0,0":  "math.dim.time",
  "0,0,0,1,0,0,0":  "math.dim.current",
  "0,0,0,0,1,0,0":  "math.dim.temperature",
  "1,0,-1,0,0,0,0": "math.dim.velocity",
  "1,0,-2,0,0,0,0": "math.dim.acceleration",
  "1,1,-2,0,0,0,0": "math.dim.force",
  "2,1,-2,0,0,0,0": "math.dim.energy",
  "2,1,-3,0,0,0,0": "math.dim.power",
  "-1,1,-2,0,0,0,0":"math.dim.pressure",
  "0,0,-1,0,0,0,0": "math.dim.frequency",
  "3,0,0,0,0,0,0":  "math.dim.volume",
  "2,0,0,0,0,0,0":  "math.dim.area",
  "2,1,-3,-1,0,0,0":"math.dim.voltage",
  "2,1,-3,-2,0,0,0":"math.dim.resistance",
  "0,0,1,1,0,0,0":  "math.dim.charge",
};

function UnitsTool({ onSave, modules, checkLimit }: { onSave: (t: MathTool, e: string, r: string, m?: string | null) => void; modules: Module[]; checkLimit?: () => boolean }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"converter"|"constants"|"formula"|"dimAnalysis"|"bases">("converter");
  const [moduleId, setModuleId] = useState<string | null>(null);

  /* ── Tab 1: Smart Converter ────────────────────────────────────── */
  const [convInput, setConvInput] = useState("");
  const convResult = useMemo<ConvResult | ConvError | null>(() => {
    const s = convInput.trim();
    if (!s) return null;
    // pattern: number unit (in|to|→|nach) unit
    const m = s.match(/^([\d.,]+)\s*(.+?)\s+(?:in|to|nach|\u2192)\s+(.+)$/i);
    if (!m) return { error: t("math.units.invalidFormat") };
    const val = parseFloat(m[1].replace(",", "."));
    if (isNaN(val)) return { error: t("math.units.invalidNumber") };
    const fromDef = lookupUnit(m[2].trim());
    const toDef = lookupUnit(m[3].trim());
    if (!fromDef) return { error: t("math.units.unknownUnit") + `: "${m[2].trim()}"` };
    if (!toDef) return { error: t("math.units.unknownUnit") + `: "${m[3].trim()}"` };
    if (!dimEqual(fromDef.dim, toDef.dim)) {
      const fromQ = DIM_QUANTITIES[fromDef.dim.join(",")] || "?";
      const toQ = DIM_QUANTITIES[toDef.dim.join(",")] || "?";
      return { error: t("math.units.dimMismatch") + ` (${t(fromQ)} \u2260 ${t(toQ)})` };
    }
    const { result, steps } = convertUnits(val, fromDef, toDef);
    return { value: result, display: result.toPrecision(10).replace(/\.?0+$/, ""), from: fromDef.symbol, to: toDef.symbol, steps };
  }, [convInput, t]);

  const [showSteps, setShowSteps] = useState(false);

  const favorites = useMemo(() => [
    { q: "1 km/h in m/s",  label: "km/h \u2194 m/s" },
    { q: "1 \u00b0C in K", label: "\u00b0C \u2194 K" },
    { q: "1 bar in Pa",    label: "bar \u2194 Pa" },
    { q: "1 kJ in kcal",   label: "kJ \u2194 kcal" },
    { q: "1 atm in Pa",    label: "atm \u2194 Pa" },
    { q: "1 hp in kW",     label: "hp \u2194 kW" },
    { q: "1 mi in km",     label: "mi \u2194 km" },
    { q: "1 lb in kg",     label: "lb \u2194 kg" },
  ], []);

  /* ── Tab 2: Constants ──────────────────────────────────────────── */
  const [constSearch, setConstSearch] = useState("");
  const [constCat, setConstCat] = useState("all");

  const constList = useMemo(() => CONST_DB.map((c, i) => ({
    ...c,
    name: t(`math.const.${["lightSpeed","planck","reducedPlanck","gravity","earthGravity","boltzmann","elemCharge","vacuumPerm","vacuumPermMag","stefanBoltzmann","rydberg","avogadro","gasConst","faradayConst","atomicMassUnit","pi","euler","goldenRatio","sqrt2","ln2","au","lightYear","solarMass","earthMass","earthRadius"][i]}`),
    desc: t(`math.const.desc.${["lightSpeed","planck","reducedPlanck","gravity","earthGravity","boltzmann","elemCharge","vacuumPerm","vacuumPermMag","stefanBoltzmann","rydberg","avogadro","gasConst","faradayConst","atomicMassUnit","pi","euler","goldenRatio","sqrt2","ln2","au","lightYear","solarMass","earthMass","earthRadius"][i]}`),
  })), [t]);

  const filteredConsts = useMemo(() => {
    let list = constList;
    if (constCat !== "all") list = list.filter(c => c.cat === constCat);
    if (constSearch) {
      const q = constSearch.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q));
    }
    return list;
  }, [constList, constCat, constSearch]);

  /* ── Tab 3: Formula Calculator ─────────────────────────────────── */
  const [fExpr, setFExpr] = useState("");
  const [fVars, setFVars] = useState<Record<string, string>>({});

  const presetFormulas = useMemo(() => [
    { label: "F = m \u00b7 a",           expr: "F = m * a",      hint: t("math.formula.force") },
    { label: "E = m \u00b7 c\u00b2",     expr: "E = m * c^2",    hint: t("math.formula.energy") },
    { label: "P = U \u00b7 I",           expr: "P = U * I",      hint: t("math.formula.power") },
    { label: "E = \u00bd\u00b7m\u00b7v\u00b2", expr: "E = 0.5*m*v^2", hint: t("math.formula.kinetic") },
    { label: "p = F / A",               expr: "p = F / A",      hint: t("math.formula.pressure") },
    { label: "W = F \u00b7 s",           expr: "W = F * s",      hint: t("math.formula.work") },
    { label: "v = s / t",               expr: "v = s / t",      hint: t("math.formula.velocity") },
    { label: "U = R \u00b7 I",           expr: "U = R * I",      hint: t("math.formula.ohm") },
  ], [t]);

  const fParsed = useMemo(() => {
    if (!fExpr) return null;
    // split on =
    const parts = fExpr.split("=").map(p => p.trim());
    if (parts.length !== 2) return null;
    const lhs = parts[0];
    const rhs = parts[1];
    // extract variable names (single uppercase or lowercase letters, or multi-char)
    const varNames = (rhs.match(/[a-zA-Z_]\w*/g) || []).filter(v => !["sin","cos","tan","log","ln","sqrt","abs","exp","PI","pi"].includes(v));
    return { lhs, rhs, vars: Array.from(new Set(varNames)) };
  }, [fExpr]);

  useEffect(() => {
    if (fParsed) {
      setFVars(prev => {
        const next: Record<string, string> = {};
        fParsed.vars.forEach(v => { next[v] = prev[v] || ""; });
        return next;
      });
    }
  }, [fParsed]);

  const fResult = useMemo(() => {
    if (!fParsed) return null;
    const allFilled = fParsed.vars.every(v => fVars[v] && !isNaN(parseFloat(fVars[v])));
    if (!allFilled) return null;
    try {
      // Build known constants
      const knownConsts: Record<string, number> = { c: 299792458, g: 9.80665, pi: Math.PI, PI: Math.PI, e: Math.E };
      CONST_DB.forEach(cd => { if (cd.symbol.length <= 3 && !cd.symbol.includes("(")) knownConsts[cd.symbol] = cd.value; });
      let expr = fParsed.rhs;
      // substitute variables
      for (const [v, val] of Object.entries(fVars)) {
        expr = expr.replace(new RegExp(`\\b${v}\\b`, "g"), `(${parseFloat(val)})`);
      }
      // substitute known constants that weren't overridden by variables
      for (const [k, val] of Object.entries(knownConsts)) {
        if (!fVars[k]) expr = expr.replace(new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "g"), `(${val})`);
      }
      expr = expr.replace(/\^/g, "**");
      if (/[a-zA-Z_]/.test(expr.replace(/Math\.\w+/g, "").replace(/Infinity|NaN/g, ""))) return null;
      const result = Function(`"use strict"; return (${expr})`)();
      if (typeof result !== "number" || !isFinite(result)) return null;
      return { lhs: fParsed.lhs, value: result, display: result.toPrecision(10).replace(/\.?0+$/, "") };
    } catch { return null; }
  }, [fParsed, fVars]);

  /* ── Tab 4: Dimensional Analysis ───────────────────────────────── */
  const [dimInput, setDimInput] = useState("");
  const dimResult = useMemo(() => {
    const s = dimInput.trim();
    if (!s) return null;
    const u = lookupUnit(s);
    if (u) {
      const key = u.dim.join(",");
      const qKey = DIM_QUANTITIES[key];
      const eqs: string[] = [];
      Object.values(UNIT_DB).forEach(d => { if (dimEqual(d.dim, u.dim) && d.symbol !== u.symbol && d.symbol.length <= 5) eqs.push(d.symbol); });
      // SI decomposition
      const siParts: string[] = [];
      const siBase = ["m","kg","s","A","K","mol","cd"];
      u.dim.forEach((exp, i) => { if (exp !== 0) siParts.push(exp === 1 ? siBase[i] : `${siBase[i]}${exp < 0 ? "\u207b" : ""}${Math.abs(exp) === 1 ? "\u00b9" : Math.abs(exp) === 2 ? "\u00b2" : Math.abs(exp) === 3 ? "\u00b3" : String(Math.abs(exp))}`); });
      return { dim: u.dim, quantity: qKey ? t(qKey) : t("math.dim.unknown"), equivalents: Array.from(new Set(eqs)).slice(0, 10), siDecomp: siParts.join("\u00b7") || "1", dimStr: u.dim.map((v, i) => `${DIM_LABELS[i]}:${v}`).join(", ") };
    }
    return null;
  }, [dimInput, t]);

  /* ── Tab 5: Number Systems ─────────────────────────────────────── */
  const [baseInput, setBaseInput] = useState("255");
  const [baseFrom, setBaseFrom] = useState(10);
  const baseResults = useMemo(() => {
    const num = parseInt(baseInput, baseFrom);
    if (isNaN(num) || num < 0) return null;
    const res: Record<string, string> = {
      bin: num.toString(2),
      oct: num.toString(8),
      dec: num.toString(10),
      hex: num.toString(16).toUpperCase(),
    };
    if (num >= 0 && num < 256) res.bits = num.toString(2).padStart(8, "0").split("").join(" ");
    if (num >= 32 && num <= 126) res.ascii = String.fromCharCode(num);
    if (!Number.isInteger(num)) return null;
    return res;
  }, [baseInput, baseFrom]);

  /* ── Render ────────────────────────────────────────────────────── */
  const tabs: [string, string][] = [
    ["converter", t("math.units.smartConverter")],
    ["constants", t("math.units.constants")],
    ["formula", t("math.units.formulaCalc")],
    ["dimAnalysis", t("math.units.dimAnalysis")],
    ["bases", t("math.units.numberSystems")],
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold text-surface-900">{t("math.unitsConstants")}</h2>
        <select value={moduleId || ""} onChange={e => setModuleId(e.target.value || null)} className="bg-surface-100 text-surface-700 text-sm rounded-lg px-3 py-1.5 border border-surface-200">
          <option value="">{t("math.noModule")}</option>
          {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as typeof tab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === k ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-700 hover:bg-surface-200"}`}>{l}</button>
        ))}
      </div>

      {/* ═══ TAB 1: Smart Converter ═══ */}
      {tab === "converter" && (
        <div className="space-y-4">
          <div className="bg-surface-100 rounded-xl p-4 sm:p-6">
            <label className="block text-sm font-medium text-surface-900 mb-2">{t("math.units.enterConversion")}</label>
            <input value={convInput} onChange={e => setConvInput(e.target.value)} placeholder={t("math.units.exampleConversion")} className="w-full bg-[rgb(var(--card-bg))] text-surface-900 rounded-lg px-4 py-3 border border-surface-200 font-mono text-sm" autoFocus />

            {convResult && "error" in convResult && (
              <div className="mt-3 bg-danger-600/10 border border-danger-600/30 rounded-lg px-4 py-3">
                <p className="text-danger-600 text-sm">{convResult.error}</p>
              </div>
            )}

            {convResult && "value" in convResult && (() => {
              const cr = convResult as ConvResult;
              return (
                <div className="mt-4">
                  <div className="flex items-baseline gap-3">
                    <span className="text-success-600 text-2xl font-mono font-semibold">{cr.display}</span>
                    <span className="text-surface-500 text-sm">{cr.to}</span>
                  </div>
                  <button onClick={() => setShowSteps(!showSteps)} className="text-brand-600 text-xs mt-2 hover:text-brand-500">
                    {showSteps ? t("math.units.hideSteps") : t("math.units.showSteps")}
                  </button>
                  {showSteps && (
                    <div className="mt-2 bg-[rgb(var(--card-bg))] rounded-lg p-3 space-y-1">
                      {cr.steps.map((step: string, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-brand-600 text-xs font-mono w-5">{i + 1}.</span>
                          <span className="text-surface-700 text-xs font-mono">{step}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3">
                    <button onClick={() => { if (checkLimit && !checkLimit()) return; onSave("units", `${convInput}`, `${cr.display} ${cr.to}`, moduleId); }} className="text-brand-600 text-sm hover:text-brand-500">
                      {t("math.saveToHistory")}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Favorites */}
          <div className="bg-surface-100 rounded-xl p-4">
            <p className="text-xs font-medium text-surface-700 mb-2">{t("math.units.favorites")}</p>
            <div className="flex flex-wrap gap-2">
              {favorites.map(f => (
                <button key={f.label} onClick={() => setConvInput(f.q)} className="px-3 py-1.5 rounded-lg bg-[rgb(var(--card-bg))] border border-surface-200 text-surface-700 hover:bg-surface-200 text-xs font-mono">{f.label}</button>
              ))}
            </div>
          </div>

          {/* Supported units hint */}
          <details className="text-surface-400 text-xs">
            <summary className="cursor-pointer font-medium text-surface-500 hover:text-surface-700">{t("math.units.supportedUnits")}</summary>
            <div className="mt-2 bg-surface-100 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-1">
              {Object.values(UNIT_DB).slice(0, 40).map(u => (
                <span key={u.symbol} className="text-surface-600 font-mono">{u.symbol}</span>
              ))}
              <span className="text-surface-400">...</span>
            </div>
          </details>
        </div>
      )}

      {/* ═══ TAB 2: Constants ═══ */}
      {tab === "constants" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={constSearch} onChange={e => setConstSearch(e.target.value)} placeholder={t("math.units.searchConstants")} className="flex-1 bg-surface-100 text-surface-900 rounded-lg px-4 py-2 border border-surface-200 text-sm" />
            <select value={constCat} onChange={e => setConstCat(e.target.value)} className="bg-surface-100 text-surface-700 rounded-lg px-4 py-2 border border-surface-200 text-sm">
              <option value="all">{t("math.units.allCategories")}</option>
              <option value="physics">{t("math.units.category.physics")}</option>
              <option value="chemistry">{t("math.units.category.chemistry")}</option>
              <option value="math">{t("math.units.category.math")}</option>
              <option value="astronomy">{t("math.units.category.astronomy")}</option>
            </select>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {filteredConsts.map((c, i) => (
              <div key={`${c.symbol}-${i}`} onClick={() => navigator.clipboard?.writeText(c.symbol)} className="bg-surface-100 rounded-lg px-4 py-3 cursor-pointer hover:bg-surface-200 transition group">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-brand-600 font-mono text-sm font-semibold">{c.symbol}</span>
                      <span className="text-surface-900 text-sm font-medium truncate">{c.name}</span>
                    </div>
                    <p className="text-surface-400 text-xs mt-0.5">{c.desc}</p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className="text-success-600 font-mono text-xs">{c.display}</div>
                    {c.unit && <div className="text-surface-400 text-xs">{c.unit}</div>}
                  </div>
                </div>
                <p className="text-surface-400 text-xs mt-1 opacity-0 group-hover:opacity-100 transition">{t("math.units.clickToCopy")}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ TAB 3: Formula Calculator ═══ */}
      {tab === "formula" && (
        <div className="space-y-4">
          <div className="bg-surface-100 rounded-xl p-4 sm:p-6">
            <label className="block text-sm font-medium text-surface-900 mb-2">{t("math.units.enterFormula")}</label>
            <input value={fExpr} onChange={e => setFExpr(e.target.value)} placeholder="E = m * c^2" className="w-full bg-[rgb(var(--card-bg))] text-surface-900 rounded-lg px-4 py-3 border border-surface-200 font-mono text-sm" />

            {/* Preset formulas */}
            <div className="flex flex-wrap gap-2 mt-3">
              {presetFormulas.map(pf => (
                <button key={pf.expr} onClick={() => setFExpr(pf.expr)} className={`px-3 py-1.5 rounded-lg text-xs border transition ${fExpr === pf.expr ? "bg-brand-600 text-white border-brand-600" : "bg-[rgb(var(--card-bg))] border-surface-200 text-surface-700 hover:bg-surface-200"}`} title={pf.hint}>
                  {pf.label}
                </button>
              ))}
            </div>

            {/* Variable inputs */}
            {fParsed && fParsed.vars.length > 0 && (
              <div className="mt-4 bg-[rgb(var(--card-bg))] rounded-lg p-4 space-y-3">
                <p className="text-xs font-medium text-surface-700">{t("math.units.variables")}</p>
                {fParsed.vars.map(v => (
                  <div key={v} className="flex items-center gap-3">
                    <span className="text-surface-900 font-mono text-sm w-8 shrink-0">{v} =</span>
                    <input value={fVars[v] || ""} onChange={e => setFVars(prev => ({ ...prev, [v]: e.target.value }))} placeholder="0" className="flex-1 bg-surface-50 text-surface-900 rounded-lg px-3 py-2 border border-surface-200 font-mono text-sm" />
                  </div>
                ))}
              </div>
            )}

            {/* Result */}
            {fResult && (
              <div className="mt-4 bg-[rgb(var(--card-bg))] rounded-lg p-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-surface-700 font-mono text-sm">{fResult.lhs} =</span>
                  <span className="text-success-600 text-xl font-mono font-semibold">{fResult.display}</span>
                </div>
                <div className="mt-2">
                  <button onClick={() => { if (checkLimit && !checkLimit()) return; onSave("units", fExpr, `${fResult.lhs} = ${fResult.display}`, moduleId); }} className="text-brand-600 text-sm hover:text-brand-500">{t("math.saveToHistory")}</button>
                </div>
              </div>
            )}
          </div>

          {/* Constants hint */}
          <p className="text-surface-400 text-xs px-2">{t("math.units.constantsHint")}</p>
        </div>
      )}

      {/* ═══ TAB 4: Dimensional Analysis ═══ */}
      {tab === "dimAnalysis" && (
        <div className="space-y-4">
          <div className="bg-surface-100 rounded-xl p-4 sm:p-6">
            <label className="block text-sm font-medium text-surface-900 mb-2">{t("math.units.dimAnalysis")}</label>
            <input value={dimInput} onChange={e => setDimInput(e.target.value)} placeholder={t("math.units.dimPlaceholder")} className="w-full bg-[rgb(var(--card-bg))] text-surface-900 rounded-lg px-4 py-3 border border-surface-200 font-mono text-sm" />

            {/* Quick unit chips */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {["N", "J", "Pa", "W", "V", "Hz", "T", "C"].map(u => (
                <button key={u} onClick={() => setDimInput(u)} className={`px-2.5 py-1 rounded text-xs font-mono transition ${dimInput === u ? "bg-brand-600 text-white" : "bg-[rgb(var(--card-bg))] border border-surface-200 text-surface-700 hover:bg-surface-200"}`}>{u}</button>
              ))}
            </div>

            {dimResult && (
              <div className="mt-4 space-y-3">
                {/* SI Decomposition */}
                <div className="bg-[rgb(var(--card-bg))] rounded-lg p-3">
                  <p className="text-xs text-surface-400 font-medium mb-1">{t("math.units.siDecomposition")}</p>
                  <p className="text-surface-900 font-mono text-lg">{dimResult.siDecomp}</p>
                </div>

                {/* Dimension Vector */}
                <div className="bg-[rgb(var(--card-bg))] rounded-lg p-3">
                  <p className="text-xs text-surface-400 font-medium mb-2">{t("math.units.dimVector")}</p>
                  <div className="flex gap-2">
                    {dimResult.dim.map((v, i) => (
                      <div key={i} className={`flex flex-col items-center px-2 py-1 rounded ${v !== 0 ? "bg-brand-600/10" : "bg-surface-100"}`}>
                        <span className="text-xs text-surface-500">{DIM_LABELS[i]}</span>
                        <span className={`font-mono text-sm font-medium ${v !== 0 ? "text-brand-600" : "text-surface-400"}`}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Physical Quantity */}
                <div className="bg-[rgb(var(--card-bg))] rounded-lg p-3">
                  <p className="text-xs text-surface-400 font-medium mb-1">{t("math.units.physicalQuantity")}</p>
                  <p className="text-success-600 font-medium">{dimResult.quantity}</p>
                </div>

                {/* Equivalent Units */}
                {dimResult.equivalents.length > 0 && (
                  <div className="bg-[rgb(var(--card-bg))] rounded-lg p-3">
                    <p className="text-xs text-surface-400 font-medium mb-2">{t("math.units.equivalent")}</p>
                    <div className="flex flex-wrap gap-2">
                      {dimResult.equivalents.map(eq => (
                        <span key={eq} className="px-2.5 py-1 rounded-lg bg-brand-600/10 text-brand-600 text-xs font-mono font-medium">{eq}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {dimInput && !dimResult && (
              <p className="text-danger-600 text-sm mt-3">{t("math.units.unknownUnit")}: &quot;{dimInput}&quot;</p>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB 5: Number Systems ═══ */}
      {tab === "bases" && (
        <div className="bg-surface-100 rounded-xl p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mb-6">
            <input value={baseInput} onChange={e => setBaseInput(e.target.value)} className="flex-1 bg-[rgb(var(--card-bg))] text-surface-900 text-lg rounded-lg px-4 py-3 border border-surface-200 font-mono min-w-0" placeholder={t("math.enterNumber")} />
            <select value={baseFrom} onChange={e => setBaseFrom(Number(e.target.value))} className="bg-[rgb(var(--card-bg))] text-surface-700 rounded-lg px-3 py-3 border border-surface-200 text-sm">
              <option value={2}>{t("math.binary")} (2)</option>
              <option value={8}>{t("math.octal")} (8)</option>
              <option value={10}>{t("math.decimal")} (10)</option>
              <option value={16}>{t("math.hexadecimal")} (16)</option>
            </select>
          </div>
          {baseResults ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {([
                  [t("math.binary") + " (2)", baseResults.bin, "BIN"],
                  [t("math.octal") + " (8)", baseResults.oct, "OCT"],
                  [t("math.decimal") + " (10)", baseResults.dec, "DEC"],
                  [t("math.hexadecimal") + " (16)", baseResults.hex, "HEX"],
                ] as [string, string, string][]).map(([label, val, tag]) => (
                  <div key={label} className="bg-[rgb(var(--card-bg))] rounded-lg px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-surface-400 text-xs">{label}</span>
                      <span className="text-brand-600 text-xs font-mono">{tag}</span>
                    </div>
                    <div className="text-success-600 font-mono text-lg break-all">{val}</div>
                  </div>
                ))}
              </div>
              {baseResults.bits && (
                <div className="bg-[rgb(var(--card-bg))] rounded-lg px-4 py-3">
                  <p className="text-xs text-surface-400 font-medium mb-2">{t("math.units.bitView")}</p>
                  <div className="flex gap-1 justify-center">
                    {baseResults.bits.split(" ").map((bit, i) => (
                      <div key={i} className={`w-8 h-8 flex items-center justify-center rounded text-sm font-mono font-medium ${bit === "1" ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-400"}`}>{bit}</div>
                    ))}
                  </div>
                  <div className="flex gap-1 justify-center mt-0.5">
                    {[7,6,5,4,3,2,1,0].map(i => <div key={i} className="w-8 text-center text-surface-400 text-xs">{i}</div>)}
                  </div>
                </div>
              )}
              {baseResults.ascii && (
                <div className="bg-[rgb(var(--card-bg))] rounded-lg px-4 py-3">
                  <p className="text-xs text-surface-400 font-medium mb-1">{t("math.units.asciiChar")}</p>
                  <p className="text-brand-600 text-2xl font-mono">&quot;{baseResults.ascii}&quot;</p>
                </div>
              )}
            </div>
          ) : baseInput && (
            <p className="text-danger-600 text-sm">{t("math.integerOnly")}</p>
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
  const [fTitle, setFTitle] = useState("");
  const [fFormula, setFFormula] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fCat, setFCat] = useState<FormulaCategory>("allgemein");
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [fTags, setFTags] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [examMode, setExamMode] = useState(false);
  const [calcVars, setCalcVars] = useState<Record<string, string>>({});

  /* ─── Rich + Custom formulas merged ─── */
  const allFormulas = useMemo(() => {
    const custom = formulas.map(f => ({ ...f, isCustom: true, isRich: false, rich: null as RichFormula | null }));
    const rich = RICH_FORMULAS.map(rf => ({
      id: rf.id, user_id: "", title: rf.title, formula: rf.formula, category: rf.category, description: rf.description,
      module_id: null, tags: rf.synonyms, pinned: false, created_at: "", updated_at: "",
      isCustom: false, isRich: true, rich: rf,
    }));
    let all = [...custom, ...rich];
    if (category !== "all") all = all.filter(f => f.category === category);
    if (search) {
      const q = search.toLowerCase();
      all = all.filter(f =>
        f.title.toLowerCase().includes(q) ||
        f.formula.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        (f.tags && f.tags.some(tag => tag.toLowerCase().includes(q))) ||
        (f.rich && (f.rich.vars.toLowerCase().includes(q) || f.rich.usage.toLowerCase().includes(q)))
      );
    }
    return all;
  }, [formulas, category, search]);

  const openNew = () => { setEditId(null); setFTitle(""); setFFormula(""); setFDesc(""); setFCat("allgemein"); setModuleId(null); setFTags(""); setShowModal(true); };
  const openEdit = (f: MathFormula) => { setEditId(f.id); setFTitle(f.title); setFFormula(f.formula); setFDesc(f.description); setFCat(f.category); setModuleId(f.module_id); setFTags(f.tags.join(", ")); setShowModal(true); };

  const save = async () => {
    if (!userId || !fTitle || !fFormula) return;
    const entry = { user_id: userId, title: fTitle, formula: fFormula, category: fCat, description: fDesc, module_id: moduleId, tags: fTags.split(",").map(tg => tg.trim()).filter(Boolean) };
    if (editId) {
      const { data } = await supabase.from("math_formulas").update(entry).eq("id", editId).select().single();
      if (data) setFormulas(prev => prev.map(f => f.id === editId ? (data as MathFormula) : f));
    } else {
      const { data } = await supabase.from("math_formulas").insert(entry).select().single();
      if (data) setFormulas(prev => [data as MathFormula, ...prev]);
    }
    setShowModal(false);
  };

  const remove = async (id: string) => {
    await supabase.from("math_formulas").delete().eq("id", id);
    setFormulas(prev => prev.filter(f => f.id !== id));
  };

  /* ─── Interactive calculator for a formula ─── */
  const calcResult = useCallback((calc: { vars: string[]; expr: string }, vars: Record<string, string>): string | null => {
    const allFilled = calc.vars.every(v => vars[v] && !isNaN(parseFloat(vars[v])));
    if (!allFilled) return null;
    try {
      let expr = calc.expr;
      for (const [v, val] of Object.entries(vars)) {
        expr = expr.replace(new RegExp(`\\b${v}\\b`, "g"), `(${parseFloat(val)})`);
      }
      const result = Function(`"use strict"; return (${expr})`)();
      if (typeof result !== "number" || !isFinite(result)) return null;
      return result.toPrecision(10).replace(/\.?0+$/, "");
    } catch { return null; }
  }, []);

  /* ─── Navigate to related formula ─── */
  const goToRelated = (id: string) => {
    setExpandedId(id);
    setSearch("");
    setCategory("all");
    setTimeout(() => {
      document.getElementById(`formula-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = { all: RICH_FORMULAS.length + formulas.length };
    RICH_FORMULAS.forEach(f => { counts[f.category] = (counts[f.category] || 0) + 1; });
    formulas.forEach(f => { counts[f.category] = (counts[f.category] || 0) + 1; });
    return counts;
  }, [formulas]);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold text-surface-900">{t("math.formulaCollection")}</h2>
        <div className="flex gap-2 self-start sm:self-auto">
          <button onClick={() => setExamMode(!examMode)} className={`px-3 py-2 rounded-lg text-xs font-medium transition ${examMode ? "bg-danger-600 text-white" : "bg-surface-100 text-surface-700 hover:bg-surface-200"}`}>
            {examMode ? t("math.fc.examModeOn") : t("math.fc.examMode")}
          </button>
          <button onClick={openNew} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 whitespace-nowrap">+ {t("math.ownFormula")}</button>
        </div>
      </div>

      {/* Search with synonym support */}
      <div className="mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("math.fc.searchPlaceholder")} className="w-full bg-surface-100 text-surface-900 rounded-lg px-4 py-2.5 border border-surface-200 text-sm" />
      </div>

      {/* Category filter with counts */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setCategory("all")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${category === "all" ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-500 hover:bg-surface-200"}`}>
          {t("math.all")} ({catCounts.all || 0})
        </button>
        {formulaCategories.map(c => (
          <button key={c.key} onClick={() => setCategory(c.key)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${category === c.key ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-500 hover:bg-surface-200"}`}>
            {c.label} ({catCounts[c.key] || 0})
          </button>
        ))}
      </div>

      {/* Formula count */}
      <p className="text-surface-400 text-xs mb-3">{allFormulas.length} {t("math.fc.formulasFound")}</p>

      {/* Formulas Grid */}
      <div className="space-y-2">
        {allFormulas.map(f => {
          const isExpanded = expandedId === f.id && !examMode;
          const rf = f.rich;
          return (
            <div key={f.id} id={`formula-${f.id}`} className={`bg-surface-100 rounded-lg transition ${isExpanded ? "ring-2 ring-brand-600/30" : ""}`}>
              {/* Compact card */}
              <div className="px-4 py-3 cursor-pointer group" onClick={() => setExpandedId(isExpanded ? null : f.id)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {f.isCustom && <span className="text-xs bg-brand-600/10 text-brand-600 px-1.5 py-0.5 rounded">{t("math.custom")}</span>}
                      <span className="text-xs bg-surface-200 text-surface-700 px-1.5 py-0.5 rounded">{formulaCategories.find(c => c.key === f.category)?.label}</span>
                      {!examMode && <span className="text-surface-400 text-xs opacity-0 group-hover:opacity-100 transition">{isExpanded ? t("math.fc.collapse") : t("math.fc.expand")}</span>}
                    </div>
                    <div className="text-surface-900 font-medium text-sm mt-1">{f.title}</div>
                    <div className="text-success-600 font-mono text-sm mt-1">{f.formula}</div>
                    {!examMode && f.description && <div className="text-surface-400 text-xs mt-1">{f.description}</div>}
                  </div>
                  {f.isCustom && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={e => { e.stopPropagation(); openEdit(f as MathFormula); }} className="text-surface-400 hover:text-brand-600 text-sm px-1"><span className="text-xs">Edit</span></button>
                      <button onClick={e => { e.stopPropagation(); remove(f.id); }} className="text-surface-400 hover:text-danger-600 text-sm px-1"><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded detail (only for rich formulas, not in exam mode) */}
              {isExpanded && rf && (
                <div className="border-t border-surface-200 px-4 py-4 space-y-3">
                  {/* Variables */}
                  <div>
                    <p className="text-xs font-semibold text-surface-700 mb-1">{t("math.fc.variables")}</p>
                    <p className="text-surface-600 text-xs">{rf.vars}</p>
                  </div>

                  {/* When to use */}
                  <div>
                    <p className="text-xs font-semibold text-surface-700 mb-1">{t("math.fc.whenToUse")}</p>
                    <p className="text-surface-600 text-xs">{rf.usage}</p>
                  </div>

                  {/* Example */}
                  <div>
                    <p className="text-xs font-semibold text-surface-700 mb-1">{t("math.fc.example")}</p>
                    <div className="bg-[rgb(var(--card-bg))] rounded-lg px-3 py-2 font-mono text-xs text-surface-900">{rf.example}</div>
                  </div>

                  {/* Common mistakes */}
                  <div>
                    <p className="text-xs font-semibold text-danger-600 mb-1">{t("math.fc.commonMistakes")}</p>
                    <p className="text-surface-600 text-xs">{rf.mistakes}</p>
                  </div>

                  {/* Interactive Calculator */}
                  {rf.calc && (
                    <div className="bg-[rgb(var(--card-bg))] rounded-lg p-3">
                      <p className="text-xs font-semibold text-brand-600 mb-2">{t("math.fc.tryIt")}</p>
                      <div className="flex flex-wrap gap-2 items-center">
                        {rf.calc.vars.map(v => (
                          <div key={v} className="flex items-center gap-1">
                            <span className="text-xs font-mono text-surface-700">{v}=</span>
                            <input
                              value={calcVars[`${rf.id}_${v}`] || ""}
                              onChange={e => setCalcVars(prev => ({ ...prev, [`${rf.id}_${v}`]: e.target.value }))}
                              className="w-16 bg-surface-50 text-surface-900 rounded px-2 py-1 border border-surface-200 text-xs font-mono"
                              placeholder="0"
                              onClick={e => e.stopPropagation()}
                            />
                          </div>
                        ))}
                        {(() => {
                          const vars: Record<string, string> = {};
                          rf.calc!.vars.forEach(v => { vars[v] = calcVars[`${rf.id}_${v}`] || ""; });
                          const result = calcResult(rf.calc!, vars);
                          return result ? (
                            <span className="text-success-600 font-mono text-sm font-semibold ml-2">= {result}</span>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Related formulas */}
                  {rf.related.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-surface-700 mb-1">{t("math.fc.related")}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {rf.related.map(relId => {
                          const rel = RICH_FORMULAS.find(r => r.id === relId);
                          return rel ? (
                            <button key={relId} onClick={e => { e.stopPropagation(); goToRelated(relId); }} className="px-2.5 py-1 rounded-lg bg-brand-600/10 text-brand-600 text-xs font-medium hover:bg-brand-600/20 transition">
                              {rel.title}
                            </button>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {allFormulas.length === 0 && <p className="text-surface-400 text-sm text-center py-8">{t("math.noFormulasFound")}</p>}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-[rgb(var(--card-bg))] rounded-2xl p-6 w-full max-w-lg border border-surface-200" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-surface-900 mb-4">{editId ? t("math.editFormula") : t("math.newFormula")}</h3>
            <div className="space-y-3">
              <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder={t("math.title")} className="w-full bg-surface-100 text-surface-900 rounded-lg px-4 py-2.5 border border-surface-200 text-sm" />
              <input value={fFormula} onChange={e => setFFormula(e.target.value)} placeholder={t("math.formulaPlaceholder")} className="w-full bg-surface-100 text-surface-900 rounded-lg px-4 py-2.5 border border-surface-200 font-mono text-sm" />
              <input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder={t("math.description")} className="w-full bg-surface-100 text-surface-900 rounded-lg px-4 py-2.5 border border-surface-200 text-sm" />
              <select value={fCat} onChange={e => setFCat(e.target.value as FormulaCategory)} className="w-full bg-surface-100 text-surface-700 rounded-lg px-4 py-2.5 border border-surface-200 text-sm">
                {formulaCategories.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <select value={moduleId || ""} onChange={e => setModuleId(e.target.value || null)} className="w-full bg-surface-100 text-surface-700 rounded-lg px-4 py-2.5 border border-surface-200 text-sm">
                <option value="">{t("math.noModule")}</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <input value={fTags} onChange={e => setFTags(e.target.value)} placeholder={t("math.tagsPlaceholder")} className="w-full bg-surface-100 text-surface-900 rounded-lg px-4 py-2.5 border border-surface-200 text-sm" />
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
