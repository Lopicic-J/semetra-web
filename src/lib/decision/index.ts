/**
 * Semetra Decision Engine — Public API
 *
 * Einziger Entry-Point für alle Decision-Engine-Funktionalität.
 */

// Types
export type {
  RiskLevel,
  ActionUrgency,
  TrendDirection,
  ModuleIntelligence,
  ComponentSnapshot,
  ExamSnapshot,
  ModuleRisk,
  RiskFactor,
  RiskFactorType,
  ModulePriority,
  PriorityReason,
  OutcomePrediction,
  RequiredPerformance,
  Scenario,
  Action,
  ActionType,
  DailyPlan,
  Alert,
  CommandCenterState,
  AIDecisionContext,
  StudyBehavior,
  DailyPattern,
  DecisionEngineConfig,
  DnaProfile,
  OnboardingProfile,
  SemesterPhase,
  AdaptiveBudgetContext,
} from "./types";

export { DEFAULT_ENGINE_CONFIG } from "./types";

// Engine functions
export {
  assessModuleRisk,
  calculateModulePriority,
  rankModules,
  predictOutcome,
  generateActions,
  buildDailyPlan,
  buildCommandCenterState,
  buildAIContext,
  calculateTrend,
  calculateWeightedAverage,
  filterActionsByUrgency,
  groupActionsByModule,
  totalActionMinutes,
  buildDailySummary,
  applyDnaModifiers,
  detectSemesterPhase,
  computeAdaptiveWeights,
} from "./engine";

export type { AdaptiveWeightProfile } from "./engine";

// Automations
export type {
  AutomationType,
  AutomationPriority,
  Automation,
} from "./automations";

export {
  evaluateAutomations,
  filterNewAutomations,
} from "./automations";
