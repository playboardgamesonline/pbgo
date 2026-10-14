import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { MockInstance } from "vitest"
import { HELP } from "./cli.ts"
import { runSeedCli } from "./seed-cli.ts"
import type { SeedConfig } from "./seed-cli.ts"

// Only the paths that end before the dataset is reached are run here: a seed that gets further would write to a real project.

const TOKEN_NAME = "SANITY_API_WRITE_TOKEN_KIT_TEST"
const TOKEN = "sk-this-is-not-a-real-token"

const config = (overrides: Partial<SeedConfig> = {}): SeedConfig => ({
  slug: "kit-test",
  projectId: "abc123",
  dataset: "production",
  envFile: "/nonexistent/folder/.env.local",
  docs: () => [],
  slots: [],
  ...overrides,
})

let log: MockInstance
let error: MockInstance
let exitCode: typeof process.exitCode

beforeEach(() => {
  log = vi.spyOn(console, "log").mockImplementation(() => {})
  error = vi.spyOn(console, "error").mockImplementation(() => {})
  exitCode = process.exitCode
  vi.stubEnv(TOKEN_NAME, "")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  process.exitCode = exitCode
})

const printed = (spy: MockInstance) => spy.mock.calls.map((call) => call.join(" "))

describe("runSeedCli", () => {
  it("prints the usage for --help, builds no data and reads no token", async () => {
    const docs = vi.fn(() => [])
    await runSeedCli(config({ docs }), ["--help"])
    expect(printed(log)).toEqual([HELP])
    expect(printed(error)).toEqual([])
    expect(docs).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(exitCode)
  })

  it("refuses a wrong option, says what is wrong and points to --help", async () => {
    await runSeedCli(config(), ["--frobnicate"])
    expect(printed(error)).toEqual(["Error: Unknown option --frobnicate", "Run with --help for the options."])
    expect(printed(log)).toEqual([])
    expect(process.exitCode).toBe(1)
  })

  it("names the variable and the file when there is no token, and builds no data", async () => {
    const docs = vi.fn(() => [])
    await runSeedCli(config({ docs }), ["--dry-run"])
    expect(printed(error)).toEqual([`Error: ${TOKEN_NAME} is not set (looked in the environment and in /nonexistent/folder/.env.local)`])
    expect(docs).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(1)
  })

  it("never prints the token, even when an error carries it", async () => {
    vi.stubEnv(TOKEN_NAME, TOKEN)
    await runSeedCli(
      config({
        docs: () => {
          throw new Error(`the data failed with ${TOKEN} in it`)
        },
      }),
      ["--dry-run"],
    )
    expect(printed(error)).toEqual(["Error: the data failed with [token] in it"])
    expect(printed(error).join("\n")).not.toContain(TOKEN)
    expect(process.exitCode).toBe(1)
  })

  it("prints an error that is not an Error as a message", async () => {
    vi.stubEnv(TOKEN_NAME, TOKEN)
    await runSeedCli(
      config({
        docs: () => {
          throw "plain text"
        },
      }),
      ["--dry-run"],
    )
    expect(printed(error)).toEqual(["Error: plain text"])
  })
})
