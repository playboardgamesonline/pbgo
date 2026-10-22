import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

// `scripts/list.ts` is run by Node itself (type stripping, no bundler), where the package's tsc and vitest cannot see what breaks:
// a value import without a `.ts` extension, a syntax Node does not strip. This runs it as `pnpm catalog:list` does.
const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url))

describe("pnpm catalog:list", () => {
  it("runs under plain Node without a token and lists the live games of the registry", () => {
    const run = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "scripts/list.ts"], {
      cwd: PACKAGE_DIR,
      env: { ...process.env, NOTION_API_KEY: "" },
      encoding: "utf8",
      timeout: 20_000,
    })
    expect(run.status, run.stderr).toBe(0)
    expect(run.stdout).toContain("NOTION_API_KEY is not set")
    expect(run.stdout).toMatch(/^slug\s+name\s+status/m)
    expect(run.stdout).toMatch(/^courtisans\s.*\blive\b/m)
    expect(run.stdout).not.toMatch(/^template\s/m)
  }, 30_000)
})
