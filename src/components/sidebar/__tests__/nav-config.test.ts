/**
 * Navigation Config Tests
 *
 * Validiert die Navigationsstruktur auf Konsistenz.
 */

import { describe, it, expect } from "vitest";
import { NAV_GROUPS, BOTTOM_ITEMS, getAllNavItems } from "../nav-config";

describe("nav-config", () => {
  it("hat mindestens 5 Navigationsgruppen", () => {
    expect(NAV_GROUPS.length).toBeGreaterThanOrEqual(5);
  });

  it("hat Bottom-Items (Profile, Settings, About)", () => {
    expect(BOTTOM_ITEMS.length).toBeGreaterThanOrEqual(3);
    const hrefs = BOTTOM_ITEMS.map(i => i.href);
    expect(hrefs).toContain("/profile");
    expect(hrefs).toContain("/settings");
    expect(hrefs).toContain("/about");
  });

  it("getAllNavItems() enthält alle Items", () => {
    const all = getAllNavItems();
    const totalFromGroups = NAV_GROUPS.reduce((sum, g) => sum + g.items.length, 0);
    expect(all.length).toBe(totalFromGroups + BOTTOM_ITEMS.length);
  });

  it("alle Items haben gültige href (beginnt mit /)", () => {
    const all = getAllNavItems();
    all.forEach(item => {
      expect(item.href).toMatch(/^\//);
    });
  });

  it("alle Items haben einen labelKey", () => {
    const all = getAllNavItems();
    all.forEach(item => {
      expect(item.labelKey).toBeTruthy();
      expect(item.labelKey.length).toBeGreaterThan(0);
    });
  });

  it("keine doppelten hrefs", () => {
    const all = getAllNavItems();
    const hrefs = all.map(i => i.href);
    const unique = new Set(hrefs);
    expect(unique.size).toBe(hrefs.length);
  });

  it("alle Items haben ein Icon", () => {
    const all = getAllNavItems();
    all.forEach(item => {
      expect(item.icon).toBeDefined();
    });
  });

  it("pro-Flag ist ein Boolean", () => {
    const all = getAllNavItems();
    all.forEach(item => {
      expect(typeof item.pro).toBe("boolean");
    });
  });

  it("Dashboard ist das erste Item", () => {
    const first = NAV_GROUPS[0]?.items[0];
    expect(first?.href).toBe("/dashboard");
  });

  it("Developer ist als Pro markiert", () => {
    const devItem = getAllNavItems().find(i => i.href === "/developer");
    expect(devItem?.pro).toBe(true);
  });

  it("Leaderboard existiert in Fortschritt-Gruppe", () => {
    const progressGroup = NAV_GROUPS.find(g => g.labelKey === "navGroup.progress");
    expect(progressGroup).toBeDefined();
    const leaderboard = progressGroup?.items.find(i => i.href === "/leaderboard");
    expect(leaderboard).toBeDefined();
  });
});
