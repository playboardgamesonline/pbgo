// The rulebooks of a game, from a terminal: `node packages/content-kit/src/rulebook-bin.ts --help` (scripts/add-game.sh and scripts/game-rules.sh call it).
import { runRulebookCli } from "./rulebook-cli.ts"

process.exitCode = await runRulebookCli()
