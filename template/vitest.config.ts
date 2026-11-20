import { defineConfig } from "vitest/config"

// Only the binding's own tests: the engine, in packages/engine, has its own `test` script. The tests of the board's layout look at every table of two to six players in four window shapes, which takes a few seconds on a busy machine: a long timeout
export default defineConfig({ test: { include: ["src/**/*.test.ts"], testTimeout: 30_000 } })
