# Moving the project to another account

The project lives on oré's accounts: GitHub (`playboardgamesonline/playboardgamesonline`), one Vercel project (`playboardgamesonline`), one Sanity project per game, one Supabase project for production and one for previews (`pbgo-preview`).

Defaults tied to the current accounts, all overridable:
- `scripts/setup-env.sh`: the Vercel team, used when `VERCEL_TEAM_ID` is not set
- `scripts/go-live.sh`: new Sanity projects go to the organization named "Main", else to the organization of the Courtisans project
- `packages/core/lib/site-url.ts`: `https://playboardgamesonline.app`, unless `NEXT_PUBLIC_SITE_URL` is set
- Author and publisher shown on the pages: `AUTHOR` in each game's `src/lib/site.ts`, `PUBLISHER` in `apps/web/src/site.ts`

## Recommended order

1. **GitHub**: Settings › Transfer ownership of the repository. Issues, pull requests and history follow; the old URL redirects.
2. **Vercel**: the receiving team needs the GitHub integration. Transfer the project `playboardgamesonline` (Settings › Advanced › Transfer Project): environment variables, the domain `playboardgamesonline.app` and deployments follow. Reconnect the repository if Vercel asks. Then set `VERCEL_TEAM_ID` to the new team (secrets file and `apps/web/.env.local`).
3. **Sanity**: for each game (`sanityProjectId` in `packages/games/src/registry.ts`), sanity.io/manage › project › Settings › Transfer project, or invite the new account as Administrator. Then replace the write tokens as a precaution: empty the `SANITY_API_WRITE_TOKEN_<SLUG>` values in `apps/web/.env.local` and run `pnpm setup-env`, which creates the missing tokens with the `npx sanity login` session and pushes them to Vercel.
4. **Supabase**: Project Settings › General › Transfer project, for the production project and `pbgo-preview`. The keys don't change. Update `~/.config/pbgo/secrets.env`: `SUPABASE_ACCESS_TOKEN` (a token of the new account), `SUPABASE_PROJECT_REF`, `SUPABASE_PREVIEW_PROJECT_REF`.
5. **Domain**: `playboardgamesonline.app` follows the Vercel project; otherwise attach it to the new team (Domains › Transfer, or add it again to the project).
6. **Git identity**: update `git config user.email` on every machine. It must be the address of the GitHub account that deploys, or Vercel blocks the deployment.
7. **Variables to check after the move** (Production, Preview, Development): `ADMIN_LOGIN`, `ADMIN_PASSWORD`, `SANITY_API_WRITE_TOKEN_<SLUG>`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_ANALYTICS_PROJECT_ID`, `NEXT_PUBLIC_SITE_URL`. `pnpm setup-env` sets them from the secrets file.
