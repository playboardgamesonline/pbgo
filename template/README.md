# Template · La Plus Haute

Shared base of the online board games, served by `apps/web` at `/template`: lobby with game options, realtime table, shareable game over, administration at `/gamemaster/template` (Setup, Tasks, Monitoring).

## Start

```bash
pnpm install                 # once, at the root of the monorepo
pnpm dev                     # apps/web on http://localhost:3100, this game at /template
pnpm dev:studio template     # its Sanity Studio
pnpm --filter @template/engine test
pnpm typecheck
```

## New game

```bash
pnpm new-game <slug>         # copy of this folder in games/<slug>, registered in packages/games
pnpm add-game                # the same, asking the name and the rules PDFs, plus the Sanity project, its Studio and its write token
pnpm game-rules <slug> --rules en=rules.pdf   # a rulebook PDF added later, into the draft of the game's Settings
```

In Claude Code, the skill `game-new` (`/game-new`) runs `add-game` for you and goes on to the fields of the Studio.

See `CLAUDE.md` ("Adapting to a new game") and the full guide `docs/GAME_GUIDE.md`.
