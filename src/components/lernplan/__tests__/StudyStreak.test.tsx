/**
 * StudyStreak Component Tests
 *
 * Tests für die Streak-Berechnung und Darstellung.
 * Uses same date logic as the component (local midnight → toISOString).
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StudyStreak } from "../StudyStreak";

/**
 * Generate date string matching component's logic:
 * local midnight → toISOString().slice(0, 10)
 */
function daysAgo(n: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Helper: find text split across child nodes, restricted to <span> to avoid matching parent containers */
function hasTextContent(text: string) {
  return (_: any, element: Element | null) => {
    if (element?.tagName !== "SPAN") return false;
    return element?.textContent?.trim().replace(/\s+/g, " ") === text;
  };
}

describe("StudyStreak", () => {
  it("zeigt 0 Tage bei leerer Liste", () => {
    render(<StudyStreak items={[]} />);
    expect(screen.getByText(hasTextContent("0 Tage"))).toBeDefined();
  });

  it("zeigt 1 Tag (Singular) korrekt", () => {
    render(
      <StudyStreak
        items={[{ scheduled_date: daysAgo(0), completed: true }]}
      />,
    );
    expect(screen.getByText(hasTextContent("1 Tag"))).toBeDefined();
  });

  it("berechnet 3-Tage-Streak korrekt", () => {
    const items = [
      { scheduled_date: daysAgo(0), completed: true },
      { scheduled_date: daysAgo(1), completed: true },
      { scheduled_date: daysAgo(2), completed: true },
    ];
    render(<StudyStreak items={items} />);
    expect(screen.getByText(hasTextContent("3 Tage"))).toBeDefined();
  });

  it("bricht Streak bei Lücke ab", () => {
    const items = [
      { scheduled_date: daysAgo(0), completed: true },
      // daysAgo(1) fehlt
      { scheduled_date: daysAgo(2), completed: true },
      { scheduled_date: daysAgo(3), completed: true },
    ];
    render(<StudyStreak items={items} />);
    expect(screen.getByText(hasTextContent("1 Tag"))).toBeDefined();
  });

  it("zählt unvollständige Tage nicht", () => {
    const items = [
      { scheduled_date: daysAgo(0), completed: true },
      { scheduled_date: daysAgo(1), completed: false },
      { scheduled_date: daysAgo(2), completed: true },
    ];
    render(<StudyStreak items={items} />);
    expect(screen.getByText(hasTextContent("1 Tag"))).toBeDefined();
  });

  it("zählt mehrere Items am gleichen Tag", () => {
    const items = [
      { scheduled_date: daysAgo(0), completed: true },
      { scheduled_date: daysAgo(0), completed: true },
      { scheduled_date: daysAgo(1), completed: true },
    ];
    render(<StudyStreak items={items} />);
    expect(screen.getByText(hasTextContent("2 Tage"))).toBeDefined();
  });

  it("zeigt 0 wenn heute nichts abgeschlossen", () => {
    const items = [
      { scheduled_date: daysAgo(1), completed: true },
      { scheduled_date: daysAgo(2), completed: true },
    ];
    render(<StudyStreak items={items} />);
    // Streak starts from today — if today has nothing, streak = 0
    const span = screen.getByText(hasTextContent("0 Tage"));
    expect(span).toBeDefined();
  });
});
