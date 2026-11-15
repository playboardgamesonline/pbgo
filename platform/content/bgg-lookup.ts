// What BoardGameGeek says of a game that is not in the catalog yet, as JSON, for the scout (GAM-32): `node content/bgg-lookup.ts --help`.
// Read only, and no token but BoardGameGeek's. Usage and guarantees: docs/platform-sanity.md ("Figures from BoardGameGeek").
import { createBggClient } from "./bgg/client.ts"
import { LOOKUP_HELP, UsageError, lookupByName, lookupItem, parseLookupArgs } from "./bgg/lookup.ts"

/** BoardGameGeek's token, from the environment (`--env-file-if-exists` of the script loads apps/web/.env.local into it). */
function readBggToken(): string {
  const token = process.env.BGG_API_TOKEN?.trim()
  if (!token) throw new Error("BGG_API_TOKEN is not set (put it in ~/.config/pbgo/secrets.env and run `pnpm setup-env --no-push`, or in apps/web/.env.local)")
  return token
}

let token = ""
try {
  const options = parseLookupArgs(process.argv.slice(2))
  if (options.help) {
    console.log(LOOKUP_HELP)
  } else {
    token = readBggToken()
    const client = createBggClient({ token })
    const answer =
      options.id === null
        ? await lookupByName(client, options.name, { limit: options.limit })
        : await lookupItem(client, options.id, { versions: options.versions, language: options.language })
    console.log(JSON.stringify(answer, null, 2))
  }
} catch (error) {
  // Only the message, and never the token, even if a library echoes it
  let message = error instanceof Error ? error.message : String(error)
  if (token) message = message.split(token).join("[token]")
  console.error(`Error: ${message}`)
  if (error instanceof UsageError) console.error("Run with --help for the options.")
  process.exitCode = 1
}
