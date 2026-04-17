/**
 * Navigation Config Tests
 *
 * Validiert die Navigationsstruktur auf Konsistenz.
 */

import { describe, it, expect } from "vitest";
import { NAV_GROUPS, BOTTOM_ITEMS, getAllNavItems, getFilteredNavGroups } from "../nav-config";

describe("nav-config", () => {
  it("hat mindestens 3 Navigationsgruppen", () => {
    expect(NAV_GROUPS.length).toBeGreaterThanOrEqual(3);
  });

  it("hat Bottom-Items (Profile, Settings)", () => {
    expect(BOTTOM_ITEMS.length).toBeGreaterThanOrEqual(2);
    const hrefs = BOTTOM_ITEMS.map(i => i.href);
    expect(hrefs).toContain("/profile");
    expect(hrefs).toContain("/settings");
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

  // ── Role-based filtering tests ──

  it("getFilteredNavGroups: student sieht keine Admin-Gruppe", () => {
    const groups = getFilteredNavGroups("student");
    const adminGroup = groups.find(g => g.labelKey === "navGroup.admin");
    expect(adminGroup).toBeUndefined();
  });

  it("getFilteredNavGroups: admin sieht Admin-Gruppe mit /admin", () => {
    const groups = getFilteredNavGroups("admin");
    const adminGroup = groups.find(g => g.labelKey === "navGroup.admin");
    expect(adminGroup).toBeDefined();
    const adminItem = adminGroup?.items.find(i => i.href === "/admin");
    expect(adminItem).toBeDefined();
  });

  it("getFilteredNavGroups: institution sieht Builder und /admin aber nicht /developer", () => {
    const groups = getFilteredNavGroups("institution");
    const adminGroup = groups.find(g => g.labelKey === "navGroup.admin");
    expect(adminGroup).toBeDefined();
    const builderItem = adminGroup?.items.find(i => i.href === "/builder");
    expect(builderItem).toBeDefined();
    const adminItem = adminGroup?.items.find(i => i.href === "/admin");
    expect(adminItem).toBeDefined(); // /admin has requiredRoles: ["admin", "institution"]
    const developerItem = adminGroup?.items.find(i => i.href === "/developer");
    expect(developerItem).toBeUndefined(); // /developer is admin-only
  });

  it("getFilteredNavGroups: student sieht Kern + Mehr Gruppen", () => {
    const groups = getFilteredNavGroups("student");
    const labelKeys = groups.map(g => g.labelKey);
    expect(labelKeys).toContain(""); // Kern (Hauptbereich)
    expect(labelKeys).toContain("navGroup.more"); // Erweiterte Features
  });
});
