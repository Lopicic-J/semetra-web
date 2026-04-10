/**
 * Command Center Page
 *
 * Delegates to the shared <CommandCenter /> component which orchestrates:
 *   - useCommandCenter()      → Decision Engine (real-time risk, priority, predictions)
 *   - useSmartAutomations()   → Reactive toast notifications
 *   - useStreaks()             → Study streak tracking
 *   - Sub-components: AlertBanner, OverviewCards, DailyActions,
 *                     ModulePriorityList, RiskOverview, PredictionPanel
 *
 * This ensures the /command-center route and any embedded usage share
 * exactly the same logic and presentation.
 */
import CommandCenter from "@/components/command-center/CommandCenter";

export default function CommandCenterPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <CommandCenter />
    </div>
  );
}
