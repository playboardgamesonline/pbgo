// Running a command of the repo (a check) and keeping what it printed. Passed in everywhere, so that a test reaches no process.
import { execFile } from "node:child_process"

export type ExecResult = { code: number | null; stdout: string; stderr: string }
export type Exec = (file: string, args: string[], options?: { cwd?: string; timeoutMs?: number }) => Promise<ExecResult>

/** One process, run to its end: its exit code (`null` when it did not start or was stopped) and what it printed. */
export const nodeExec: Exec = (file, args, options = {}) =>
  new Promise((resolve) => {
    execFile(file, args, { cwd: options.cwd, timeout: options.timeoutMs ?? 60_000, maxBuffer: 16 * 1024 * 1024, encoding: "utf8" }, (error, stdout, stderr) => {
      const failure = error as (Error & { code?: number | string | null }) | null
      const code = failure === null ? 0 : typeof failure.code === "number" ? failure.code : null
      resolve({ code, stdout: String(stdout), stderr: failure !== null && code === null ? `${String(stderr)}\n${failure.message}` : String(stderr) })
    })
  })
