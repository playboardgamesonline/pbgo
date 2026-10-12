import { defineConfig } from "vitest/config"

// Only the binding's own tests: the engine, in packages/engine, has its own `test` script
export default defineConfig({ test: { include: ["src/**/*.test.ts"] } })
