import { defineConfig } from "vitest/config"

// The tests that run the whole command start Node processes: a generous timeout, and one file at a time keeps their output readable.
export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node", testTimeout: 60_000 },
})
