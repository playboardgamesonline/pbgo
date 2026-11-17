import { defineConfig } from "vitest/config"

// The tests that run the command as a process start Node: a generous timeout.
export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node", testTimeout: 60_000 },
})
