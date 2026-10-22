import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["content/**/*.test.ts", "src/**/*.test.ts"],
    environment: "node",
  },
})
