import { defineConfig } from "vitest/config"

// The app has few pure modules worth a unit test; the playground's model (`_specimens/scene/play/`: scenes, undo, shortcuts, the address) is one.
export default defineConfig({
  test: { include: ["src/**/*.test.{ts,tsx}"], environment: "node" },
})
