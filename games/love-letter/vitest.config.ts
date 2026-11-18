import { defineConfig } from "vitest/config"

// The binding's own tests (`src`) and the content's (`content`: the seed). The engine, in packages/engine, has its own `test` script.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "content/**/*.test.ts"],
    environment: "node",
    // The seed's tests load the Studio's configuration and normalise images: a few seconds on a laptop, more than the default five on a shared CI runner that runs every package at once
    testTimeout: 60_000,
  },
})
