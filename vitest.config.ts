/**
 * Vitest Configuration for Semetra Web
 *
 * Comprehensive testing setup for Next.js academic domain
 * - Unit tests for calculation engines and validators
 * - Integration tests for realistic workflows
 * - Fast, isolated test execution
 */

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    // Test environment — happy-dom for component tests (supports JSX)
    environment: "happy-dom",

    // Setup files — run before each test file
    setupFiles: ["./src/test/setup.ts"],

    // Test patterns
    include: [
      "src/**/__tests__/**/*.test.ts",
      "src/**/__tests__/**/*.test.tsx",
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
    ],
    exclude: ["node_modules", ".next", "dist", "coverage"],

    // Coverage
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/lib/**/*.ts", "src/components/**/*.tsx"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/__tests__/**",
        "**/*.d.ts",
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },

    // Globals: describe, it, expect without imports
    globals: true,

    // Reporter
    reporters: ["verbose"],

    // Timeout
    testTimeout: 10000,
    hookTimeout: 10000,
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
