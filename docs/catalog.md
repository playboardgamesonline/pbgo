# Catalog

The list of games the hub can show: the live games of the registry and the planned games of the Notion Games database, joined by `@pbgo/catalog`. Part of PLT-56 ("the hub catalog shows every game").

## What exists
- Step 1 (PLT-71): the reader and the join, in this package. Step 2 (PLT-72): the route that serves the pictures of the planned games, `/api/catalog/<slug>/<logo|icon|background>` (below). No page reads the catalog yet: the hub still lists the live games of the registry, and `[game]` still serves the registry's slugs only
- Next, one pull request each, started after the previous one is merged: the hub lists every game (PLT-73), the page of a planned game, `noindex` (PLT-74), the SEO pass (PLT-75). This file describes what has landed; each step updates it

## Where a game comes from
- A **live** game (`live: true` in `packages/games/src/registry.ts`): the registry and the game's own Sanity project. Its Notion row, if any, is ignored
- A **planned** game: its row in the Notion Games database, whatever its status. A game of the registry that is not live takes its row too, and Notion's name with it; with no row it is not listed
- `template` is never listed (`UNLISTED_SLUGS`), and neither are the expansions: a row whose `Parent item` is filled is counted and left out (today 20 of the 43 rows)
- No sync to Sanity: Notion is read, never copied. The registry stays the source of the slug, `live` and the Sanity project

## The package (`packages/catalog`, `@pbgo/catalog`)
- `.` (`src/catalog.ts`, pure: no I/O, no framework) — the types (`PlannedGame`, `CatalogEntry`, `Catalog`, `Publisher`), `buildCatalog(games, planned)`, `comparePlanned`, `STATUS_ORDER`, `UNLISTED_SLUGS`, `pickLocalized(values, locale)`, `ART_SLOTS`, `pictureUrl(game, slot)`, `pictureVersion(editedAt)`
- `./server` (`src/server.ts`, server only) — `getCatalog()`, `CATALOG_TAG`, `CATALOG_REVALIDATE_SECONDS`, `notionToken()`, `reportOnce(message)`. `getCatalog` is the one call a page makes
- `./route` (`src/route.ts`, server only) — `pictureRoute()`, the handler of the picture route; `apps/web/src/app/api/catalog/[slug]/[slot]/route.ts` is `export const GET = pictureRoute()`
- `src/notion.ts` — the reader, `readPlannedGames({ token, fetch?, init?, timeoutMs? })`: a plain `fetch` against Notion's REST API (`Notion-Version: 2022-06-28`), no SDK, no framework. The caller hands in the token and the cache options. `readPictureLinks(options)` reads the same database for the links of the pictures. A failure is a `NotionError` (`status`, `code`, and for a 429 the `retryAfter` it asks, in seconds)
- `src/picture.ts` — `fetchPicture(link)`: downloads a picture from a link and checks it (below)
- `scripts/list.ts` — `pnpm catalog:list`; `src/testing.ts` — the fixtures of the tests (a row as Notion writes it, a fake Notion, fake picture hosts), not exported
- Order of the list: the live games (registry order), then the planned ones by status (the furthest along first: Live, PlayTest, Table, Content, Engine, Rules, Not started; Paused last; a status that is not in the list counts as Not started), then priority (P1 first, none last), then name (case-insensitive, numbers in order)
- `pickLocalized` gives a text for a visitor: their language, else English, else French, else any other; it says which one it took, so a page can mark a text that is not in the visitor's language

## The Notion databases (`notion.ts` holds the ids and the column names)
- **Games** `3ffd1ca3-468f-80e8-a371-ed666deecc9a`, **Editors** `3ffd1ca3-468f-80e0-ba62-fb466ca8a6c8` (publishers: `Name`, `URL`). The integration must be connected to both, or a game has no publisher (the Games database alone still works, with a warning)
- `Slug` (text) is the slug of the page, written by hand: a row with none is skipped, never guessed. A slug must pass `slugProblem` (`@pbgo/games/slug`: not a reserved slug, lower-case, 40 characters at most); two rows with one slug: the older row wins, the other is reported
- Shown: `Name`, `Description FR|EN|ES|DE`, `Players` (`4`, `2 - 5`, `3+`), `Duration` (minutes), `Age` (`8+`), `Author(s)`, `Artwork`, `Editor` (relation to the Editors database), `Rules FR|EN|ES|DE` (links, http(s) only), `Logo`, `Icon`, `Background`
- Sort only, never shown: `Status`, `Priority` (`P1 · Now` → 1 … `P4 · Someday` → 4). Read, unused: `Effort`. Every other column (`Already online`, `Tags`, `Engine needs`, the dates, the fonts) is ignored
- The pictures are only flagged (`art`): a file that Notion hosts has a link that expires after about an hour, so a link is never kept in the cache. `notionPageId` finds the row again and `editedAt` changes when the row does; the picture route serves the picture from a fresh link. A link to somewhere else (`external`) counts only if it is https: a picture with any other link is not flagged
- A row that is archived or in the trash is ignored. Text is trimmed and control characters are removed from what a row says about itself (it goes to a terminal and to the logs)
- A column that is missing from the database (renamed, deleted) is not an error: the field is empty for every game and the reader says so (`The Games database has no "<column>" column`). A database without `Name` or `Slug` is not the Games database: the read fails. So does a database of more than 1 000 rows (ten requests of 100, twenty times today's), which is a runaway cursor more than a catalog

## Cache and failure
- `getCatalog` is wrapped in React's `cache` (one read per request); the Notion calls themselves are cached by Next for ten minutes (`next: { revalidate: 600, tags: ["catalog"] }` on the `fetch`, which is what makes a POST cacheable; the stale answer is served while a fresh one is fetched). `revalidateTag(CATALOG_TAG, { expire: 0 })` makes the next read ask Notion again. Next does not cache an answer over 2 MB (the Games database is about 350 KB)
- Notion is the one optional part. Without `NOTION_API_KEY`, or when Notion does not answer (a bad key, a database not shared, a timeout of 5 s per request, an outage), the catalog is the live games alone, exactly what the hub showed before, `notion` is `"off"` or `"unavailable"`, and a Notion-only slug has no page
- What is wrong is logged once per distinct line and per server instance, as `[catalog] …` on `console.warn`: Notion unavailable, the Editors database not readable, a missing column, a row left out and why. Nothing logged holds the token

## The picture route (`GET /api/catalog/<slug>/<logo|icon|background>`)
- Why it exists: the pictures of a planned game are files of its Notion row, and Notion's links to them expire after about an hour, so the catalog only flags them (`art`) and this route serves them: it asks Notion for a fresh link, downloads the picture and sends it, and the CDN keeps it. A page draws a picture from `pictureUrl(game, slot)`, the route followed by `?v=<pictureVersion(editedAt)>`, the version of the row the catalog read. A live game's pictures are in its Sanity project and never come through here
- No picture is no error page: the answer is a 404 and the page that asked draws a black background (a platform token: no initials, no placeholder art). The hub and the pages draw it from PLT-73 and PLT-74 on
- The order, so that nothing costs more than it has to. 1) The slot is one of the three and the slug is a planned game of the catalog whose row has that picture, else 404 (503 when Notion could not be read at all: the game may well exist). 2) `v` is the current version of the row, else a 307 to the right URL, before anything is read or downloaded, so nobody can make the server fetch a picture under a `v` of their own. 3) A fresh read of the Games database for the links, then the download

| Answer | `Cache-Control` |
| --- | --- |
| 200, the row is still the one `v` names | `public, max-age=3600, s-maxage=86400` |
| 200, the row was edited since the catalog read it | `public, max-age=60, s-maxage=60` |
| 307 to the current `?v=` | `public, max-age=0, s-maxage=10` |
| 404 | `public, max-age=60, s-maxage=60` |
| 503, with `Retry-After` (Notion, the catalog or the picture host cannot answer now) | `no-store` |

- Every 200 carries `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox`, like the media route. Its `Content-Type` comes from the file's first bytes (PNG, JPEG, GIF, WebP, AVIF, SVG), never from what the host said
- One read serves a whole page: the links read from Notion are believed for 30 s, one read runs at a time however many pictures ask for it, a failed read is remembered for 5 s (or as long as Notion's `Retry-After`, when longer), and a 429 that asks for 3 s or less is waited for once. A hub of 66 pictures on a cold server is one query, not 66, which Notion's rate limit (about 3 requests a second) would not take. The memo is per server instance
- What the server fetches (`picture.ts`, the one place that does it): the visitor gives a slug and a slot, never a URL. The link comes from Notion and must be https, with no credentials and the default port; an IP address, a name without a dot, `localhost` and the names a network keeps for itself (`.localhost`, `.local`, `.internal`, `.localdomain`, `.home.arpa`) are refused. A redirect is followed by hand, three at most, each one checked again. One 8 s limit covers the download, the size is capped at 4 MiB while the body streams (a function answers 4.5 MB at most), and the file must be a picture by its bytes. Notion's token goes to Notion only: the picture host gets `Accept: image/*` and nothing else. The logs name the host, never a link (a Notion link carries a signature)
- Limits, on purpose:
  - The server does not resolve names, so a public name that points at a private address (`127.0.0.1.nip.io`) passes: the links come from the Notion workspace, trusted as far as whoever can edit it
  - A row's version is its `last_edited_time`, which has a minute's grain: two edits of one row within the same minute keep the old picture until the row is edited again
  - A picture added to a row shows once the catalog has read the row again (10 minutes) and a cached 404 has expired (1 minute)
  - `getCatalog` has no single flight across concurrent requests: a server that has just started and is asked for many pictures at once may answer a few 503s (`no-store`, nothing is kept). A page that draws the pictures has already read the catalog to build their addresses, which warms the cache

## The key (`NOTION_API_KEY`)
- A read-only internal integration (Notion › Settings › Integrations › New integration, capability "Read content" only, no user information), connected to the Games and Editors databases (Connections of each database). Its secret starts with `ntn_`
- The secret goes in `~/.config/pbgo/secrets.env` (outside the repo) as `NOTION_API_KEY=…`, never in a chat, a commit or a pull request. `pnpm setup-env` writes it to `apps/web/.env.local` and pushes it to every Vercel target (encrypted; `--no-push` keeps it local); a deployed value applies from the next deployment. It only checks the shape of the value (`ntn_…` or `secret_…`): a value of another shape is neither written nor pushed and is not repeated in the message. Nothing is sent to Notion
- To try it before `setup-env`, put the same line in the `apps/web/.env.local` of the checkout (the script falls back on it) and run `pnpm catalog:list`
- The key stays server side: it has no `NEXT_PUBLIC_` prefix and no client component imports `@pbgo/catalog/server`

## `pnpm catalog:list`
What the hub would list right now: one line per game (slug, name, status, priority, which of Logo / Icon / Background and which description languages are filled, players, duration, age, publishers) and, under it, the rows Notion has that are not in the catalog and why (no slug, a slug that is not valid, a slug already taken) and the columns that are missing. It reads `NOTION_API_KEY` from the environment or `apps/web/.env.local`, calls Notion once, caches nothing and never prints the token. Without a key it lists the live games and says so; if Notion cannot be read it prints why and exits 1. Run it after filling the Slug column of a new row: a row that is not in the list is not on the site

## Working on the package
- `pnpm --filter @pbgo/catalog test` and `pnpm --filter @pbgo/catalog typecheck`. The tests run the reader against a fake Notion built from the shapes Notion really answers (`src/testing.ts`); a new field = the column in `COLUMNS`, the field of `PlannedGame`, its line in `planned()`, the fixture in `gamePage`, a test
- The picture route is tested against a fake Notion and fake picture hosts (`fakeWeb`), never the network: the answers, the headers, the memo and the refused links. A change to `route.ts` or `picture.ts` is checked by breaking it on purpose and seeing a test fail
- The source is run as it is by Node (`pnpm catalog:list`, type stripping) and bundled by Next (`transpilePackages`): in `src/`, a value import from a sibling file has no extension that both accept, so a file imports only types from its siblings (`import type`) and the pieces that need each other meet in `server.ts`, `route.ts` and `scripts/list.ts`; `scripts/` import with `.ts` extensions. `picture.ts` imports nothing at all. `server-only` throws under plain Node, so only `src/server.ts` imports it (the tests of `server.ts` and `route.ts` mock it). `list-script.test.ts` runs the script under plain Node to keep this true
