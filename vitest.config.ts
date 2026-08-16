import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"],
    // Remove once Phase 2 lands its first test; until then an empty run is
    // the honest result, not a failure.
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
});
