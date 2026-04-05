/**
 * Global Test Setup
 *
 * Initializes mocks for Next.js infrastructure and common dependencies
 * used across all API route tests.
 */

import { vi } from "vitest";

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    getAll: vi.fn(() => []),
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
  headers: vi.fn(() => new Map()),
}));

// Mock next/server - use actual implementation but allow mocking
vi.mock("next/server", async () => {
  const actual = await vi.importActual("next/server");
  return { ...actual };
});

// Global test configuration
export const TEST_USER_ID = "test-user-id-12345";
export const TEST_USER_EMAIL = "test@semetra.ch";

// Helper to reset all mocks between tests
export function resetMocks() {
  vi.clearAllMocks();
}
