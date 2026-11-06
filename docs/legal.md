# Legal pages and personal data

The Privacy Policy, the Terms of Use and the Cookie Policy (`/legal/privacy`, `/legal/terms`, `/legal/cookies`), the inventory of personal data they are written from, who receives it, how long it is kept, and the rule that keeps text and code in step (PLT-11, PLT-110). The pages describe what the site does; they do not claim that it complies with a law. The Privacy Policy and the Terms are a draft for the owner, or a lawyer, to validate: none of this is legal advice.

## The pages
- `/legal/cookies` (`(hub)/legal/cookies/page.tsx`): every cookie and storage key by name, what the site counts, what a refusal stores. The cookie banner links to it. Its entries are `Stored` (`LegalEntries` in mono)
- `/legal/privacy` (`(hub)/legal/privacy/page.tsx`): who we are, then what is collected in the order a person meets it (visit, table, sign-in, feedback, statistics), why (legal bases), who receives it, outside the EU, security, rights, changes. The sentences about PostHog follow `ANALYTICS_ENABLED`, as the Cookie Policy's do
- `/legal/terms` (`(hub)/legal/terms/page.tsx`): the service, accounts and nicknames, playing fair, the games and other people's rights, what belongs to whom, availability and responsibility, ending, changes. The sign-in page says that continuing accepts them (`login-card.tsx`)
- `/legal` (the notice) stays as it is, unlinked
- The frame and its pieces are `apps/web/src/components/legal-page.tsx` (`LegalPage`, `LegalSection`, `LegalText`, `LegalEntries`, `LegalList`, `LegalUpdated`); the footer's list is `apps/web/src/lib/legal-pages.ts`. A page ends with `Last updated <date>`: change the date with the text
- Draft state: the two new pages keep the stub's "This page is being written" line and `noindex` until the owner (or a lawyer) has read them. Going final is a small change in each page: delete the line, drop `robots: { index: false }`, and add the page to the sitemap if the owner wants it there
- Not on the pages, because each waits for the owner's answer (below): the paid plans, the governing law and the courts, the publisher's identity beyond "oré" and the contact address
- On the pages as proposals the owner has not confirmed: the minimum age (13, and a parent's agreement under 15), the retention periods. On the Terms as a plan that does not exist yet: the chat's banned-word filter (below)

## The rule
A change that adds, moves or removes personal data changes the legal pages **in the same pull request**, and this inventory with them:
- a cookie or a storage key (browser): the Cookie Policy's list, and "On the device" below
- an analytics event, a property, a tool or a recording rule: `packages/analytics/src/events.ts`, the Cookie Policy's "Statistics", the Privacy Policy's "Statistics" and the rows below
- a column, a table, a field or a log that holds personal data: the rows below, the Privacy Policy's section for the situation it belongs to, and its retention. A stored field needs a way to be deleted
- a processor, or a request from the visitor's browser to a third party (a font, a picture, a script, a widget): the table of recipients below, the Privacy Policy's "Who receives your data" and "Outside the European Union"
- a sign-in provider, or any account data (profile, friends, ranks, history, stored chat): the Privacy Policy first. PLT-13 (profiles, ratings, tables, results) and PLT-23 (friends and conversations) both add personal data, and the policy has to say so before they ship. PLT-23 also needs the French law on minors and social networks read again (Findings 11)
- a paid plan opening, or a rule of play (what is forbidden, what gets a visitor removed): the Terms

## Inventory (read from the code, 2026-11-06)
How to read it: *Basis* is the GDPR article 6 basis the pages give (service = contract; strictly necessary = no consent for the cookie or storage). *Kept* says what the code does; **bold** is a proposal that the code does not do yet.

### On the device
Every cookie and storage key is listed by name in the Cookie Policy. Browser-side keys written beyond it: none. The server writes the per-game player cookie, the language cookie, the sign-in cookies and the gamemaster's cookie. Nothing is written on arrival (checked on production: no `Set-Cookie` on `/`, `/login` or the API).

### At a table
| Data | Purpose | Where it goes | Kept | Basis | Code |
| --- | --- | --- | --- | --- | --- |
| Player identifier (`<slug>_player`, random UUID, httpOnly, 30 days) | recognise the player at their table; key of the per-player rate limits; distinct id of the server-side counts | the device; Vercel (read on every request); `games.players[].id`, `host_id`, `seen` in Supabase; PostHog (counts) | cookie 30 days; in `games` as long as the row | strictly necessary | `packages/core/server/player.ts` |
| Guest nickname (20 characters at most) | sit at a table | `<slug>:profile` in the browser; `games.players[].nickname` | the device until cleared; the row as long as the table | service | `core/server/profile.ts`, `core/lib/profile.ts` |
| Account name (20 characters at most) and picture address (https, 2048 at most) copied onto a table | the seats of the lobby and the labels of the board | `games.players[]` (`nickname`, `avatarUrl`); the picture itself stays with the provider and every viewer's browser loads it from there; the address can hold the provider's account id (Discord, Facebook) | as the table | service | `core/server/profile.ts` (`profileOf`) |
| The table: code, host, status, options, game state (hidden information included), moves, takeover votes, last time each player was seen, dates | play, reload, play for an absent player, the count of players online | Supabase `public.games` (RLS on, no policy: the server only) | **30 days after `updated_at`**. Today never deleted: 6 rows, 12 October to 2 November 2026 | service | migrations `0001`, `0002`, `0003`; `core/server/games.ts`, `presence.ts`, `takeover.ts` |
| Chat message (200 characters at most) or reaction; the author is the player id | talk at the table | Supabase Realtime broadcast `chat:<slug>:<code>` (public channel); not stored | not kept: it lives in the players' browsers while the page is open | service | `core/routes/api/games/[code]/chat/route.ts`, `core/lib/chat.ts`, `core/lib/realtime.ts` |
| The browser's connection to Supabase Realtime | live updates of the table and the chat | Supabase (Paris) sees the IP address | the connection | service | `core/lib/realtime.ts` |

### Accounts
No account exists yet in production (`auth.users`, `auth.identities`, `auth.sessions` and `auth.audit_log_entries` are empty on 2026-11-06). Sign-in is built, and the providers are not enabled.

| Data | Purpose | Where it goes | Kept | Basis | Code |
| --- | --- | --- | --- | --- | --- |
| What the provider gives: id, e-mail, name, picture address, whether the address is verified, and whatever else is in its claims | sign in; show the name and picture | Supabase Auth (Paris): `auth.users` (`email`, `raw_user_meta_data`, `raw_app_meta_data`), `auth.identities` (`identity_data`, `email`) | until the account is deleted. No self-service (PLT-36): the owner deletes it on request | service | `packages/accounts/src/account.ts`; `apps/web/src/app/auth/callback/route.ts` |
| Password hash (accounts made by hand with an e-mail address) | sign in | `auth.users.encrypted_password` | as the account | service | `packages/accounts` (`signInWithPassword`) |
| Language (`user_metadata.pbgo_locale`; cookie `pbgo-locale`, one year) | show the site in it | Supabase Auth; the device | as the account; the cookie one year | service | `packages/accounts/src/language.ts`, `client.tsx` |
| Session: cookies `sb-<ref>-auth-token`; `auth.sessions` (IP, user agent, dates), `auth.refresh_tokens` | stay signed in | the device; Supabase Auth | until sign-out | service; legitimate interest (security) | `packages/accounts/src/proxy.ts`, `server.ts` |
| Auth audit log (`auth.audit_log_entries`: event, user id, IP address) | security | the project's database **and** the dashboard's log storage (Supabase's default) | nothing deletes the table; the log storage per plan. **Switch off "write auth audit logs to the project database" (Authentication › Audit Logs)** | legitimate interest | Supabase "Auth Audit Logs" |

### Feedback
| Data | Purpose | Where it goes | Kept | Basis | Code |
| --- | --- | --- | --- | --- | --- |
| Message (2,000 characters at most), type, optional e-mail, nickname (40), player id, table code, page path, user agent (300), status | read the feedback, fix, answer | Supabase `public.feedback`, read in the gamemaster | **12 months after receipt**. Today until the owner deletes it: 1 row, 25 October 2026 | legitimate interest; the e-mail and the text are given by the person | `core/routes/api/feedback/route.ts`, `0001_init.sql` |
| Screenshot (optional; decoded, 1600 px at most, re-encoded to WebP, so EXIF and GPS are gone) | show what the person saw | private Supabase Storage bucket `feedback` (signed links of one hour for the owner) | with the row; deleted with it | same | same |
| IP fingerprint (HMAC-SHA256 with a server key, 32 hex characters) | limit sends per IP (10 s, 5 an hour); the IP itself is not stored | `feedback.ip_hash` | with the row | legitimate interest | same |

### Statistics
| Data | Purpose | Where it goes | Kept | Basis | Code |
| --- | --- | --- | --- | --- | --- |
| Server counts: `game_created`, `player_joined`, `game_started`, `game_finished`, `rematch_started`, takeover events, `chat_message_sent` (kind only) with game, counts, options, locale; distinct id = the player id; no name, text or table code; geoip off | know how the games are played | PostHog, European cloud | **12 months** (⚠ check the plan) | legitimate interest (runs whatever the banner answer) | `core/server/analytics.ts`, `analytics/src/server.ts`, `events.ts` |
| Browser counts before the answer: page views, clicks, loading times, errors; `persistence: memory` (no identifier on the device); IP discarded; table codes scrubbed | fix what breaks | PostHog, through `/ingest` on the site's own domain | as above | legitimate interest | `analytics/src/options.ts`, `scrub.ts` |
| After "Accept": identifier in a cookie and local storage (`ph_…`), `identify(<player id>)` at a table, session replays (inputs masked, chat and nicknames masked, canvas not recorded) | see where people get stuck | PostHog | counts 12 months (⚠), **replays 30 days** (⚠ check the project of the site) | consent | `analytics/src/driver.ts`, `browser.ts`, `consent.ts` |
| Visits of the games' boards | audience | Vercel Analytics: no cookie, no persistent identifier | per Vercel | legitimate interest | `apps/web/src/app/[game]/layout.tsx` |
| The answer to the banner (`pbgo-consent`) | remember the choice | local storage only | 13 months | strictly necessary | `analytics/src/consent.ts` |

### Delivery and hosting
| Data | Purpose | Where it goes | Kept | Basis |
| --- | --- | --- | --- | --- |
| Request logs: IP, user agent, URL, status | serve, operate, block abuse | Vercel; its functions run in Paris (`x-vercel-id: cdg1::cdg1` on `/login` and the API, 2026-11-06); static pages come from the nearest edge, anywhere | per Vercel's plan (⚠ check); no log drain in the reachable team | legitimate interest |
| Rate-limit counters: IP and player id | stop floods | the memory of a function instance; never written | seconds to minutes (`core/server/rate-limiter.ts`) | legitimate interest |
| Pictures and videos of the hub and the games, loaded by the browser from `cdn.sanity.io` (home, `/games` and `/game/<slug>` all do) | show the site | Sanity sees the IP address and browser of every visitor, before any choice | per Sanity | legitimate interest |
| Signed-in players' pictures, loaded by every viewer's browser from the provider's servers (`table-card.tsx` has no referrer policy; the board's canvas fetches with `crossOrigin`) | show who sits at a table | Google, Facebook, Discord: they see the viewer's IP address | per provider | legitimate interest |
| Google Fonts, only when a game's Sanity settings name a font and upload no file (`app/[game]/layout.tsx`); Courtisans names none | typeface of a game | Google (`fonts.googleapis.com`, `fonts.gstatic.com`) | per Google | legitimate interest |
| Figures of the home: `online_player_count()`, `member_count()` | show totals | aggregates, nobody named | — | — |

### Back office
The gamemaster (`gamemaster_session`, 7 days, the owner only) reads feedback and tasks. `ADMIN_LOGIN`, `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` are environment variables. Tasks hold no visitor data. The Sanity Studios hold the team's own accounts only.

### Not collected
No payment data (nothing is on sale), no location, no contacts, no advertising identifier, no marketing cookie, no cross-site tracking, no profiling, no automated decision with legal effects. The marketing switch of the banner is kept for the day a tool needs it (`CONSENT_REVISION`, `docs/analytics.md`).

## Recipients
| Who | Role | What it sees | Where | Checked on 2026-11-06 |
| --- | --- | --- | --- | --- |
| Vercel Inc. | host, processor | IP, browser, URL of every request | functions Paris (`cdg1`); edge worldwide | region from the `x-vercel-id` header. The project `pbgo` is not in the Vercel team that the tools reach, so its settings (log retention, Web Analytics) were not read |
| Supabase Inc. | database, sign-in, Realtime, Storage; processor | everything in the tables, the accounts, the live connection's IP | both projects (`pbgo`, `pbgo-preview`) in `eu-west-3` (Paris) | region and plan (free) from the Supabase API |
| PostHog Inc. | statistics, processor | counts; with consent the identifier and replays | `eu.i.posthog.com` (European cloud), from the code | the PostHog project that the tools reach is `aurelienlouvel-space`, not the site's: **IP discard and retention of the site's project were not read** |
| Sanity | content, processor | IP and browser of the visitor who loads a picture or a video; the server reads the catalog through `apicdn.sanity.io` | global CDN | production HTML: `cdn.sanity.io` is the one third-party host of the hub and of a game's page |
| Facebook (Meta), Google, Apple, Discord | sign-in providers; they act for themselves | that a person signs in to the site; the picture requests | their own | not enabled yet |
| The other people at a table | players | nickname or account name, picture, chat, the table's data | — | — |

Data processing agreements and the transfer mechanism (standard contractual clauses, or the EU–US Data Privacy Framework) are what the Privacy Policy's "Outside the European Union" relies on: ⚠ the owner confirms that each processor's agreement is in force (Vercel, Supabase, PostHog and Sanity put theirs in their terms or ask to sign it in the dashboard).

## Settings outside the repository
Read on 2026-11-06 with read-only calls where the tools reached them. To check by hand where they could not:
- Production has analytics: the Cookie Policy of the deployed site shows the PostHog paragraph, and `/ingest/static/array.js` answers 200
- ⚠ PostHog, project of the site: "Discard client IP data" on (the Cookie Policy says IP addresses are discarded), the retention of session replays (the reachable project has 30 days), the retention of events (the free plan: one year), the EU cloud
- ⚠ Supabase, `pbgo` (Authentication › Audit Logs): switch off the writing of auth audit logs to the project database, or accept that IP addresses stay in `auth.audit_log_entries`
- ⚠ Vercel, project `pbgo`: the function region is Paris (seen in the headers; Project Settings › Functions); the retention of runtime logs follows the plan; no log drain; whether Web Analytics is on
- ⚠ Providers (Authentication › Providers), once enabled: after a test sign-in, read `raw_user_meta_data` of the user in the dashboard, to see what each provider really sends, and compare with the Privacy Policy's "What your provider gives us"

## Findings of the inventory
What surprised, in the order of weight. None is fixed by PLT-110, which writes texts; each is either said in the pages as it is, or waits for a ticket.
1. **Tables and feedback are never deleted.** There is no sweeper, no `pg_cron`, no retention anywhere. `games` holds nicknames and account picture addresses of every table since 12 October. The pages propose 30 days (tables) and 12 months (feedback): the clean-up has to exist before they go live
2. **The player id is public and is also the credential.** `GET /api/<slug>/games/<code>` needs no cookie and returns `players[].id`, `hostId`, `present` and `waitingFor`, which are the values of the players' unsigned `<slug>_player` cookies, and the server believes that cookie (`getPlayerId`, `chat/route.ts`). Anyone who has a table's link can read another player's id, set it as their own cookie, and play, chat or read the private view in their place. PLT-13 replaces the cookie with a Supabase session; until then the pages say nothing of hidden information
3. **No way to find an account's tables.** A table records the player cookie's id, never the account (PLT-13's `table_players.user_id` will). Erasure by account is by name or picture address in `games.players`, or by letting the tables expire
4. **The picture address of a provider can hold the account id** (Discord: `cdn.discordapp.com/avatars/<user id>/<hash>`; Facebook: an app-scoped id), and it is written into `games.players` and shown to everyone at the table
5. **A third party sees every visitor's IP address before any choice**: Sanity's CDN, on every hub page. Not a cookie, and the Privacy Policy says so
6. **Supabase Auth keeps the IP address** of each session (`auth.sessions.ip`) and, by default, of each event in a table of the project's database that nothing empties
7. **The chat channel is public**: `core/lib/chat.ts` says the publishable key can listen to `chat:<slug>:<code>`. A table code is the secret
8. **The Cookie Policy missed two keys**: `pbgo:queue` (session storage, "Play ranked") and `game:debug` (local storage, Shift+D). Added in PLT-110
9. **The site's PostHog project is not the one the tools reach.** `docs/analytics.md` says the project is `pbgo`; the one reachable is `aurelienlouvel-space` (only `$pageview` events in 30 days). The IP discard and the retention that the pages state are therefore not verified
10. Server-side counts run whatever the banner answer, keyed on the player cookie. The pages call it legitimate interest, which a lawyer should validate
11. **Friends, profiles and conversations may make the site a "social network" in the French sense.** Parliament adopted a ban of social networks for under-15s on 21 July 2026 and the Conseil constitutionnel struck it down on 14 August 2026 (decision 2026-911 DC); the government plans a new text for spring 2027. A game is not in itself a social network and a chat between the players of a table is outside the definition, but profiles, friend lists and conversations (PLT-23) are the features that could bring the site in. Read the law again when they ship

## Decisions waiting for the owner
Each has the default the pages already use, or the sentence the page leaves out until the answer.
1. **The publisher**: an individual or a company, the name to print and the address (in France a non-professional may give only the host's, but the Privacy Policy still names who decides about the data). Today the pages say "published by oré" and give `hey@playboardgamesonline.app`, as the legal notice does
2. **The minimum age**, in the Terms ("Who can use the site") and the Privacy Policy ("Children"). The owner found 15 too high. The GDPR's floor for consenting alone to an online service is 13; France set 15 (loi Informatique et Libertés): under 15, a processing that rests on consent needs the child and a parent together, while a contract (the account) may be concluded by the child or on their behalf (CNIL, recommendation 4). The pages say 13, and a parent's agreement under 15. Providers' own minimums (Facebook, Discord, Google: 13 and up) apply on top
3. **The governing law and the courts**, for the Terms. Proposal: French law, the courts of the owner's seat, the consumer's own protections kept
4. **The chat** (answered 2026-11-06): no moderation by us; each player will be able to choose whether banned words are replaced by stars. The Terms say so, and that the chat is not stored or read and that reports go to the contact address. **The filter does not exist yet: the sentence must not go live before it does**, and its setting (on or off, on the device) is a new storage key for the Cookie Policy
5. **The paid plans** (Plus, Club, on the Pricing page, disabled): a sentence in the Terms, or none. Proposal: "Nothing is on sale; before any plan opens, its price, billing and cancellation are published and these terms updated"
6. **The contact for the games' rights holders** and for privacy requests: today `hey@playboardgamesonline.app` (`CONTACT`) for everything
7. **Retention**: tables 30 days after the last activity, feedback 12 months, replays 30 days, counts 12 months, accounts until deleted on request. The first two need the clean-up of finding 1
