// The terminal of the command: what it prints, and one line from the owner. On a terminal each question has its own line editor; on a pipe (a test, a script)
// the lines that came in are kept in order and handed out one by one, and a closed input is the answer `null`: a gate is never answered by itself.
import { spawn } from "node:child_process"
import { createInterface } from "node:readline"
import type { Readable } from "node:stream"
import type { Io } from "./pipeline.ts"

export function makeIo(input: Readable & { isTTY?: boolean }, output: NodeJS.WritableStream, errorOutput: NodeJS.WritableStream): Io & { close: () => void } {
  let interrupted = false
  const tty = Boolean(input.isTTY)
  const queue: string[] = []
  const waiting: ((line: string | null) => void)[] = []
  let closed = false
  const reader = tty ? null : createInterface({ input, terminal: false })
  reader?.on("line", (line) => {
    const waiter = waiting.shift()
    if (waiter) waiter(line)
    else queue.push(line)
  })
  reader?.on("close", () => {
    closed = true
    for (const waiter of waiting.splice(0)) waiter(null)
  })

  return {
    out: (text) => void output.write(`${text}\n`),
    err: (text) => void errorOutput.write(`${text}\n`),
    interrupted: () => interrupted,
    ask: (prompt) => {
      if (!tty) {
        output.write(prompt)
        return new Promise((resolve) => {
          const answer = (line: string | null) => {
            output.write(line === null ? "\n" : `${line}\n`)
            resolve(line)
          }
          const next = queue.shift()
          if (next !== undefined) answer(next)
          else if (closed) answer(null)
          else waiting.push(answer)
        })
      }
      return new Promise((resolve) => {
        const line = createInterface({ input, output: output as NodeJS.WriteStream, terminal: true })
        let answered = false
        line.on("SIGINT", () => {
          interrupted = true
          line.close()
        })
        line.on("close", () => {
          if (!answered) resolve(null)
        })
        line.question(prompt, (text) => {
          answered = true
          line.close()
          resolve(text)
        })
      })
    },
    open: (target) => {
      const command = process.platform === "darwin" ? "open" : "xdg-open"
      try {
        spawn(command, [target], { stdio: "ignore", detached: true }).on("error", () => {}).unref()
      } catch {
        // no way to open it here: the address is printed anyway
      }
    },
    close: () => reader?.close(),
  }
}
