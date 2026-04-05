/**
 * WeeklyProgress Component Tests
 *
 * Tests für die Wochen-Fortschrittsanzeige (CSS-Barchart).
 * Uses same date logic as the component (no setHours, direct toISOString).
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WeeklyProgress } from "../WeeklyProgress";

/**
 * Generate week date matching component's logic exactly:
 * new Date() → setDate(getDate() - getDay() + 1) for Monday, then offset
 */
function weekDate(offsetFromMonday: number): string {
  const today = new Date();
  const weekStart = new Date(today);
  // Matches component: weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const d = new Date(weekStart);
  d.setDate(d.getDate() + offsetFromMonday);
  return d.toISOString().slice(0, 10);
}

describe("WeeklyProgress", () => {
  it("rendert 7 Tage", () => {
    const { container } = render(<WeeklyProgress items={[]} />);
    // 7 day columns — each has a day abbreviation span
    const spans = container.querySelectorAll("span");
    // At minimum, 7 day labels (Mo, Tu, We, ...)
    expect(spans.length).toBeGreaterThanOrEqual(7);
  });

  it("zeigt 0 Balken bei leerer Liste", () => {
    const { container } = render(<WeeklyProgress items={[]} />);
    // All bars should have 0% height (minHeight 0px)
    const bars = container.querySelectorAll("[style]");
    bars.forEach((bar) => {
      const style = bar.getAttribute("style") || "";
      if (style.includes("height")) {
        expect(style).toContain("0%");
      }
    });
  });

  it("zeigt Balken für abgeschlossene Items", () => {
    const items = [
      { scheduled_date: weekDate(0), completed: true },  // Monday
      { scheduled_date: weekDate(0), completed: true },  // Monday (2nd)
      { scheduled_date: weekDate(2), completed: true },  // Wednesday
    ];
    const { container } = render(<WeeklyProgress items={items} />);

    // There should be count labels showing "2" and "1"
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText("1")).toBeDefined();
  });

  it("ignoriert nicht-abgeschlossene Items", () => {
    const items = [
      { scheduled_date: weekDate(0), completed: false },
      { scheduled_date: weekDate(1), completed: true },
    ];
    const { container } = render(<WeeklyProgress items={items} />);

    // Only 1 count label
    expect(screen.getByText("1")).toBeDefined();
    expect(screen.queryByText("0")).toBeNull();
  });

  it("ignoriert Items ausserhalb der aktuellen Woche", () => {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 14);
    const items = [
      { scheduled_date: lastWeek.toISOString().slice(0, 10), completed: true },
    ];
    const { container } = render(<WeeklyProgress items={items} />);

    // No count labels should appear
    const countSpans = container.querySelectorAll(".font-bold.text-brand-700");
    expect(countSpans.length).toBe(0);
  });
});
