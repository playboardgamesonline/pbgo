import { readFileSync } from "node:fs"
import { writeTokenName } from "@pbgo/core/sanity/env.ts"

/** `KEY=value` lines of an env file; comments, blank lines, `export ` and quotes are understood. */
export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq < 1) continue
    const key = line.slice(0, eq).replace(/^export\s+/, "").trim()
    let value = line.slice(eq + 1).trim()
    const quote = value[0]
    if ((quote === '"' || quote === "'") && value.length > 1 && value.endsWith(quote)) value = value.slice(1, -1)
    else value = value.replace(/\s+#.*$/, "")
    out[key] = value
  }
  return out
}

/**
 * The game's Sanity write token: `SANITY_API_WRITE_TOKEN_<SLUG>` from the environment, else from the env file.
 * The value is never printed or put in an error message: only the variable name and the file path are.
 */
export function readToken({ slug, envFile, env = process.env }: { slug: string; envFile: string; env?: Record<string, string | undefined> }): string {
  const name = writeTokenName(slug)
  const fromEnv = env[name]?.trim()
  if (fromEnv) return fromEnv
  let fromFile: string | undefined
  try {
    fromFile = parseEnv(readFileSync(envFile, "utf8"))[name]?.trim()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error(`Cannot read ${envFile}`)
  }
  if (!fromFile) throw new Error(`${name} is not set (looked in the environment and in ${envFile})`)
  return fromFile
}
