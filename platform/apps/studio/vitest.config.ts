import { defineConfig } from "vitest/config"

// The Studio's tsconfig keeps the JSX as it is (`jsx: preserve`), for the Studio's own build: the tests transform it themselves
export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  test: { environment: "node" },
})
