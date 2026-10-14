import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["content/**/*.test.ts"],
    environment: "node",
  },
})
