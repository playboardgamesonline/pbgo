// The rulebooks of a game, from a terminal: `node packages/content-kit/src/rulebook-bin.ts --help` (the skill game-new runs its `check` before it creates a game, and scripts/game-rules.sh calls it).
import { runRulebookCli } from "./rulebook-cli.ts"

process.exitCode = await runRulebookCli()
