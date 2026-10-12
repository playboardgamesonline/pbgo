# Template · La Plus Haute

Shared base of the online board games, served by `apps/web` at `/template`: lobby with game options, realtime 3D table, shareable game over, rules from Sanity, administration at `/gamemaster/template` (Setup, Tasks, Monitoring).

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
pnpm add-game <slug>         # the same, plus the Sanity project, its studio and its write token
```

See `CLAUDE.md` ("Adapting to a new game") and the full guide `docs/GAME_GUIDE.md`.
