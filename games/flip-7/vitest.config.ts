import { defineConfig } from "vitest/config"

// The binding's own tests (`src`: the contract of the engine, the takeover, the error codes) and the content's (`content`: the seed, and its parity with the engine). The engine, in packages/engine, has its own `test` script.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "content/**/*.test.ts"],
    environment: "node",
    // The camera tests fit the table for every window and player count: a few seconds on a laptop, more than the default five on a shared CI runner that runs every package at once
    testTimeout: 60_000,
  },
})
