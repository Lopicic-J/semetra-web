# Semetra API Test Suite

Comprehensive testing setup for Semetra Web's Next.js 14 API routes using Vitest.

## Directory Structure

```
src/test/
├── README.md              # This file
├── setup.ts              # Global test configuration
├── helpers.ts            # Utility functions for tests
└── mocks/
    └── supabase.ts       # Supabase mock factory

src/app/api/
├── achievements/__tests__/route.test.ts
├── grades/__tests__/route.test.ts
├── groups/__tests__/route.test.ts
├── auth/__tests__/me.test.ts
├── leaderboard/__tests__/route.test.ts
├── developer/keys/__tests__/route.test.ts
└── plugins/__tests__/route.test.ts
```

## Core Testing Utilities

### `setup.ts` - Global Configuration

Initializes mocks for Next.js infrastructure:
- `next/headers` - Cookie and header APIs
- `next/server` - NextRequest/NextResponse
- Test constants (TEST_USER_ID, TEST_USER_EMAIL)

```typescript
import "@/test/setup"; // Required in vitest config
```

### `mocks/supabase.ts` - Supabase Mocking

Provides realistic Supabase client mocks with chainable query builders.

**Key Functions:**

#### `createMockQueryBuilder(data?, error?)`
Creates a chainable query builder supporting all Supabase query methods:

```typescript
const builder = createMockQueryBuilder([{ id: 1, name: "Test" }]);
const result = await builder
  .from("table")
  .select("*")
  .eq("id", 1)
  .single();
// Returns: { data: { id: 1, name: "Test" }, error: null }
```

#### `createMockSupabase(overrides?)`
Creates a complete Supabase client mock with auth and table methods:

```typescript
const supabase = createMockSupabase({
  user: { id: "custom-id", email: "user@example.com" },
  grades: [{ id: "g1", title: "Test", grade: 5.5 }],
});

// Set data dynamically
supabase._setTableData("grades", [...]);
supabase._setUser({ id: "new-id", ... });
supabase._setAuthError("Not found");
supabase._setRpcResponse({ data: true }, null);
```

### `helpers.ts` - Test Utilities

Utilities for creating requests, parsing responses, and generating test data.

**Request/Response Functions:**

```typescript
// Create test request
const req = createTestRequest("/api/grades", {
  method: "POST",
  body: { title: "Test", grade: 5.5 },
  headers: { "Authorization": "Bearer token" },
  searchParams: { filter: "active" },
});

// Parse response
const { status, json, text } = await parseResponse(response);

// Assert patterns
await expectError(response, 401, "Unauthorized");
const json = await expectSuccess(response, 200);
```

**Sample Data Factory:**

```typescript
import { sampleData } from "@/test/helpers";

sampleData.grade()                    // Full grade object
sampleData.grade({ title: "Custom" }) // With overrides

sampleData.profile({ level: 5 })
sampleData.achievement()
sampleData.group()
sampleData.apiKey()
sampleData.plugin()
sampleData.leaderboardUser()
```

## Test File Organization

Each API route has a comprehensive test suite in `__tests__/route.test.ts`:

### GET /api/achievements
- ✓ Authentication check
- ✓ Empty achievements list
- ✓ Merge achievements with user progress
- ✓ XP level threshold calculation

### POST /api/achievements
- ✓ Achievement unlock checking
- ✓ Multiple achievement types (grade, module, task, time, learning)
- ✓ Check-type parameter handling

### GET /api/grades
- ✓ Fetch with module joins
- ✓ Sort by date descending
- ✓ Empty list handling

### POST /api/grades
- ✓ Validation (title required)
- ✓ Grade bridge integration
- ✓ Null value handling
- ✓ ECTS computation

### PATCH /api/grades
- ✓ Partial updates
- ✓ Multiple field updates
- ✓ Null value setting

### DELETE /api/grades
- ✓ Grade deletion with cleanup
- ✓ User ownership verification
- ✓ Query parameter parsing

### GET /api/groups
- ✓ List user groups with roles
- ✓ Group metadata (invite code, owner)
- ✓ Sorting by join date

### POST /api/groups
- ✓ Validation (name required)
- ✓ Default color assignment
- ✓ String trimming
- ✓ Owner auto-assignment

### GET /api/auth/me
- ✓ Return current user ID and email
- ✓ Minimal user info (no metadata leak)

### GET /api/leaderboard
- ✓ Top users by XP
- ✓ User ranking calculation
- ✓ Query parameter handling (limit, scope)
- ✓ Current user profile inclusion

### GET /api/developer/keys
- ✓ List API keys (without full key)
- ✓ Key metadata (scopes, rate limit, expiry)

### POST /api/developer/keys
- ✓ Key generation with sk_live_ prefix
- ✓ Expiration date setting
- ✓ Return full key once

### DELETE /api/developer/keys
- ✓ Key revocation (deactivation)
- ✓ Ownership verification

### GET /api/plugins
- ✓ List active plugins
- ✓ Installation status
- ✓ User configuration

### POST /api/plugins
- ✓ Install, uninstall, toggle actions
- ✓ Default action handling

### PATCH /api/plugins
- ✓ Configuration updates
- ✓ Complex config objects

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- route.test.ts

# Run with coverage
npm test:coverage

# Run with UI
npm test:ui

# Watch mode
npm test -- --watch

# Debug specific test
npm test -- --reporter=verbose --reporter=json
```

## Mocking Patterns

### Standard Pattern

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "../route";
import { createMockSupabase, mockSupabaseServer } from "@/test/mocks/supabase";
import { createTestRequest, expectSuccess } from "@/test/helpers";

const mockSupabase = createMockSupabase();

// Mock before importing route
vi.mock("@/lib/supabase/server", () => mockSupabaseServer(mockSupabase));

describe("GET /api/example", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return data", async () => {
    mockSupabase._setTableData("table", [{ id: 1, name: "Test" }]);

    const req = createTestRequest("/api/example");
    const res = await GET();

    const json = await expectSuccess(res);
    expect(json).toHaveProperty("data");
  });
});
```

### Error Handling

```typescript
it("should reject unauthorized request", async () => {
  mockSupabase._setAuthError("User not found");

  const res = await GET();
  await expectError(res, 401, "Unauthorized");
});
```

### Dynamic Mocking

```typescript
it("should handle complex flows", async () => {
  const user = sampleData.profile({ level: 10, xp_total: 5000 });
  mockSupabase._setUser(user);

  const grades = Array(5).fill(null).map((_, i) =>
    sampleData.grade({ id: `g${i}`, grade: 5.0 + i * 0.5 })
  );
  mockSupabase._setTableData("grades", grades);

  mockSupabase.rpc.mockResolvedValue({ data: [{ rank: 1 }], error: null });

  // Test with complex data
});
```

## Test Coverage

Target coverage thresholds (from `vitest.config.ts`):
- Lines: 80%
- Functions: 80%
- Branches: 75%
- Statements: 80%

Run coverage report:
```bash
npm run test:coverage
```

## Best Practices

### 1. Test Isolation
- Use `beforeEach(() => vi.clearAllMocks())` to reset state
- Don't share state between tests
- Use fresh mock instances per test suite

### 2. Realistic Data
- Use `sampleData` factory for consistent test objects
- Include all required fields
- Test with boundary values (empty, max, null)

### 3. German-English Naming
Following Semetra convention:
```typescript
it("sollte Fehler zurückgeben wenn nicht authentifiziert", async () => {
  // Test name in German (domain language)
});
```

### 4. Assert Patterns
```typescript
// Single assertion per behavioral unit
expect(json.grades).toHaveLength(2);

// Use descriptive matchers
expect(json).toHaveProperty("user");
expect(json.status).toBe(200);

// Check both data and structure
expect(json.achievements).toEqual(
  expect.arrayContaining([expect.objectContaining({ id: "ach-1" })])
);
```

### 5. Mock Verification
```typescript
// Verify mock was called correctly
expect(mockSupabase.from).toHaveBeenCalledWith("grades");

// Verify RPC calls
expect(mockSupabase.rpc).toHaveBeenCalledWith(
  "unlock_achievement",
  expect.objectContaining({ p_user_id: "test-user-id-12345" })
);
```

## Common Issues

### "Cannot find module @/lib/supabase/server"
Ensure vi.mock() is called before importing the route handler:
```typescript
const mockSupabase = createMockSupabase();
vi.mock("@/lib/supabase/server", () => mockSupabaseServer(mockSupabase));
// Then import
import { GET } from "../route";
```

### NextRequest not properly mocked
The `setup.ts` handles next/headers and next/server mocking globally. Ensure it's loaded in vitest.config.ts via the setupFiles option.

### Async/await issues
All query builders return proper promises:
```typescript
const { data } = await builder.select("*").single();
```

## Extending the Test Suite

To add tests for a new API route:

1. Create `src/app/api/path/__tests__/route.test.ts`
2. Import test utilities and create mock Supabase
3. Mock the server module before importing route
4. Write describe blocks per HTTP method
5. Test success, error, and edge cases
6. Include German-English test names

Example:
```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "../route";
import { createMockSupabase, mockSupabaseServer } from "@/test/mocks/supabase";
import { createTestRequest, expectSuccess } from "@/test/helpers";

const mockSupabase = createMockSupabase();
vi.mock("@/lib/supabase/server", () => mockSupabaseServer(mockSupabase));

describe("GET /api/new-route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return expected data", async () => {
    // Test implementation
  });
});
```

## Integration with CI/CD

The test suite is designed to run in CI/CD pipelines:

```bash
# GitHub Actions example
- name: Run tests
  run: npm test

- name: Generate coverage
  run: npm run test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
```

## References

- [Vitest Documentation](https://vitest.dev/)
- [Next.js Testing](https://nextjs.org/docs/testing)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/)
- [Semetra Project Docs](../../README.md)
