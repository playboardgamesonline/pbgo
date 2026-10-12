# Play Board Games Online

oré's online board games, served by one Next.js app on [playboardgamesonline.app](https://playboardgamesonline.app): the hub at `/`, each game at `/<slug>` (Courtisans at `/courtisans`).

```bash
pnpm install
pnpm dev                     # hub + every game on http://localhost:3100 (apps/web)
pnpm dev:studio courtisans   # a game's Sanity Studio
pnpm add-game the-crew       # new game from template/: package, registry entry, Sanity project
pnpm typecheck && pnpm test && pnpm check:catalog
pnpm build                   # production build of apps/web
```

- `apps/web` — the app: hub, game pages, API
- `games/<slug>` — one game: binding package `@pbgo-game/<slug>`, engine, Sanity Studio
- `packages/` — shared code, including the games registry `@pbgo/games`
- `template/` — the game template (demo game "La Plus Haute")

Local settings: `apps/web/.env.local` (never committed), copied from `apps/web/.env.example` or filled by `pnpm setup-env --no-push`. The script needs the maintainers' `~/.config/pbgo/secrets.env` (Supabase access token and both project references) and only writes the keys of the preview Supabase project. It also applies the pending `supabase/migrations` to the Supabase projects (`--no-push`: to the preview one only, production and Vercel are left alone). Without that file, copy `.env.example` and fill it in by hand.

See `CLAUDE.md` for the structure, routes and conventions, and `MIGRATION.md` to move the project to another account.
