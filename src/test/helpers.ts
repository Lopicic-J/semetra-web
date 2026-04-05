/**
 * Test Helpers
 *
 * Utilities for building test requests and parsing responses.
 */

import { NextRequest } from "next/server";

/**
 * Build a NextRequest for testing API routes
 */
export function createTestRequest(
  url: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
    searchParams?: Record<string, string>;
  } = {}
) {
  const { method = "GET", body, headers = {}, searchParams } = options;
  const fullUrl = new URL(url, "http://localhost:3000");

  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => {
      fullUrl.searchParams.set(k, v);
    });
  }

  const init: any = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body && method !== "GET") {
    init.body = JSON.stringify(body);
  }

  return new NextRequest(fullUrl, init);
}

/**
 * Parse JSON response from API route
 */
export async function parseResponse(response: Response) {
  const text = await response.text();
  let json;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    status: response.status,
    json,
    text,
  };
}

/**
 * Assert response has specific status and contains error
 */
export async function expectError(
  response: Response,
  expectedStatus: number,
  expectedMessage?: string,
) {
  const { status, json } = await parseResponse(response);
  if (status !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus}, got ${status}`);
  }
  if (expectedMessage && json?.error && !json.error.includes(expectedMessage)) {
    throw new Error(`Expected error to contain "${expectedMessage}", got "${json.error}"`);
  }
  return json;
}

/**
 * Assert response is successful with specific status
 */
export async function expectSuccess(response: Response, expectedStatus = 200) {
  const { status, json } = await parseResponse(response);
  if (status !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus}, got ${status}`);
  }
  return json;
}

/**
 * Create sample data objects for common tables
 */
export const sampleData = {
  grade: (overrides?: any) => ({
    id: "grade-1",
    user_id: "test-user-id-12345",
    title: "Datenbanken",
    grade: 5.5,
    weight: 1,
    date: "2024-01-15",
    module_id: "mod-1",
    exam_id: null,
    exam_type: null,
    notes: "Good performance",
    ects_earned: 3,
    created_at: "2024-01-15T10:00:00Z",
    ...overrides,
  }),

  profile: (overrides?: any) => ({
    id: "test-user-id-12345",
    email: "test@semetra.ch",
    username: "testuser",
    full_name: "Test User",
    avatar_url: null,
    xp_total: 150,
    level: 2,
    country: "CH",
    ...overrides,
  }),

  achievement: (overrides?: any) => ({
    id: "ach-1",
    name: "Grade Master",
    description: "Submit your first grade",
    icon_url: "https://example.com/ach1.png",
    sort_order: 1,
    ...overrides,
  }),

  group: (overrides?: any) => ({
    id: "group-1",
    name: "Semester 1 Study Group",
    description: "Study group for first semester",
    color: "#6d28d9",
    owner_id: "test-user-id-12345",
    invite_code: "ABC123DEF",
    max_members: 20,
    created_at: "2024-01-01T00:00:00Z",
    ...overrides,
  }),

  apiKey: (overrides?: any) => ({
    id: "key-1",
    user_id: "test-user-id-12345",
    name: "Production Key",
    key_prefix: "sk_live_",
    key_hash: "abc123def456",
    scopes: ["read", "write"],
    rate_limit: 1000,
    last_used: "2024-01-15T10:00:00Z",
    expires_at: null,
    active: true,
    created_at: "2024-01-01T00:00:00Z",
    ...overrides,
  }),

  plugin: (overrides?: any) => ({
    id: "plugin-1",
    name: "Pomodoro Timer",
    description: "Study timer using Pomodoro technique",
    version: "1.0.0",
    author: "Semetra",
    active: true,
    icon_url: "https://example.com/timer.png",
    repository: "https://github.com/semetra/timer",
    ...overrides,
  }),

  userAchievement: (overrides?: any) => ({
    id: "ua-1",
    user_id: "test-user-id-12345",
    achievement_id: "ach-1",
    unlocked_at: "2024-01-15T10:00:00Z",
    progress: 1,
    ...overrides,
  }),

  leaderboardUser: (overrides?: any) => ({
    id: "user-1",
    username: "johndoe",
    full_name: "John Doe",
    avatar_url: "https://example.com/john.jpg",
    xp_total: 500,
    level: 5,
    ...overrides,
  }),
};
