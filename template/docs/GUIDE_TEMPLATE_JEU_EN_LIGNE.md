# Guide template — Jeu de société en ligne (base : play-game-online-template)

Ce document décrit le repo **Courtisans Online** pour le réutiliser comme **template** d'autres jeux de société multijoueurs en ligne. Il est destiné à **Oré** (porteur du projet, designer) et à **Claude** (l'IA qui code). Chaque section indique clairement **qui fait quoi**.

> Légende : 👤 = à faire par Oré · 🤖 = à faire par l'IA · ⭐ = point de validation obligatoire (l'IA s'arrête et attend le retour d'Oré)

---

## 1. Stack

| Couche | Techno | Rôle |
|---|---|---|
| Monorepo | **pnpm** workspaces (`apps/*`, `packages/*`) | un seul repo, 3 paquets |
| Front | **Next.js 16** (App Router, React 19, TypeScript) | site, lobby, jeu, routes API |
| UI | **Tailwind CSS 4**, **shadcn/ui** (Radix), **motion** (motion.dev), **sonner** (toasts), icônes **lucide-react** + **Hugeicons** | interface DOM |
| 3D | **three**, **@react-three/fiber**, **@react-three/drei**, **maath** (easing) | plateau de jeu en 3D |
| Debug | **leva** (panneaux de réglages, onglets custom) | réglages en direct, copiables |
| Moteur | **TypeScript pur** + **Vitest** (`packages/engine`) | règles du jeu, aucune dépendance UI |
| Temps réel / BDD | **Supabase** (Postgres + Realtime) | stockage des parties + diffusion des mises à jour |
| CMS | **Sanity** (Studio autonome dans `apps/studio`) | images, textes, règles, cartes, missions |
| Hébergement | **Vercel** (déploiement auto depuis GitHub `main`) | prod + previews |

⚠️ Next.js 16 a des changements cassants : l'IA doit lire `node_modules/next/dist/docs/` avant de coder (voir `apps/web/AGENTS.md`).

---

## 2. Architecture (les principes à garder dans chaque jeu)

1. **Le moteur est la seule source des règles.** Tout ce qui est règle (setup, tour, actions légales, score, fin) vit dans `packages/engine`, en TypeScript pur, testé. Il implémente le contrat `GameDefinition<State, Action, View>` (`setup`, `apply`, `view`, `isOver`, `options`, `clientActions`, `debug`). Le front et le serveur ne font qu'appeler `GAME`.
2. **Serveur autoritaire.** Le client n'envoie que des *intentions* (`POST /api/games/[code]/action`). Le serveur charge l'état, appelle le moteur, sauvegarde, diffuse.
3. **Vue filtrée par joueur.** L'état complet (`State`) est secret (mains, cartes cachées). Chaque joueur reçoit uniquement `GAME.view(state, playerId)` via `GET /api/games/[code]`.
4. **Temps réel "ping + refetch".** Après chaque écriture (verrou optimiste sur `version`), le serveur diffuse `maj` sur le canal Supabase `game:{code}` ; les clients refetch leur vue. Pas de données sensibles dans le canal.
5. **Identité sans compte.** Cookie httpOnly (`<slug>_player`) = id joueur. Pseudo stocké dans le profil local (`<slug>:profile`).
6. **Options de partie déclaratives.** Le jeu déclare `options` (`number` / `choice` / `boolean`) ; le lobby les affiche et l'hôte les modifie (`POST /api/games/[code]/options`, valeurs passées dans `normalizeOptions`).
7. **Contenu dans Sanity, valeurs par défaut dans le code.** Le site fonctionne même si Sanity est vide (`DEFAULT_RULES`), Sanity surcharge.
8. **3D = présentation seulement.** `layout.ts` calcule des *poses* (position/rotation) pour chaque carte selon la vue ; `scene.tsx` anime chaque objet vers sa pose. Même clé React = même objet ⇒ vrais trajets (main → table).
9. **UI DOM par-dessus la 3D** (bandeau, journal, annonces, fin de partie, règles).

---

## 3. Organisation des fichiers

```
<slug>-online/<slug>/
├─ CLAUDE.md                     # règles du projet pour l'IA (glossaire FR → EN du jeu inclus)
├─ package.json                  # scripts racine (dev, dev:studio, build, test, typecheck, deploy:studio)
├─ pnpm-workspace.yaml
├─ docs/                         # ce guide
├─ supabase/migrations/          # 0001_games.sql (table `games`), 0002_tasks.sql (to-do) — RLS sans policy
├─ packages/engine/src/          # 🧠 MOTEUR `@game/engine` (TS pur)
│  ├─ contract.ts                # GameDefinition, PlayerInfo, Results, DebugCommand
│  ├─ options.ts                 # OptionDefinition, defaultOptions, normalizeOptions
│  ├─ rng.ts / errors.ts
│  ├─ demo/                      # jeu démo « La Plus Haute » (types.ts, game.ts, game.test.ts) → remplacé par le vrai jeu
│  └─ index.ts                   # export { … as GAME } = le jeu actif
├─ apps/studio/                  # 🗂 SANITY STUDIO (singletons interface, game, rules, texts ; locale.ts)
└─ apps/web/src/                 # 🌐 NEXT.JS
   ├─ app/
   │  ├─ page.tsx, layout.tsx    # accueil, SEO
   │  ├─ game/[code]/            # page de partie (lobby puis jeu)
   │  ├─ (admin)/setup, status/  # admin (ADMIN_LOGIN / ADMIN_PASSWORD) : paramètres Sanity + to-do, dashboard
   │  ├─ api/games/…             # create, [code], join, leave, options, start, action, replay, debug
   │  ├─ api/tasks/…, api/admin/… # to-do, login/logout, paramètres, logo
   │  └─ api/media, robots.ts, sitemap.ts, manifest.ts
   ├─ server/                    # supabase.ts, games.ts (updateGame + verrou), player.ts (cookie), profile.ts, tasks.ts, api.ts (handle/ApiError)
   ├─ sanity/                    # client, env, image
   ├─ lib/                       # api.ts, use-live-game.ts, realtime.ts, game-types.ts, profile.ts, rules.ts, rules-server.ts, i18n.ts, site.ts
   └─ components/
      ├─ ui/                     # shadcn
      ├─ home/                   # home.tsx (créer / rejoindre), screen.tsx (Screen, PrimaryButton, champs)
      ├─ lobby/                  # lobby.tsx (PlayerList, LobbyButton), game-options.tsx
      ├─ game/                   # game-client.tsx (lobby → jeu), game.tsx, game-over.tsx, sharing.ts, preview-sharing.tsx, context.tsx
      ├─ game3d/                 # scene, card3d, layout, textures, announcement, aura, table-text, photo, debug, debug-tabs, settings
      ├─ admin/                  # UI admin shadcn preset b1VlJAwK (luma) : ui/, settings-form, task-list, admin-shell
      └─ rules.tsx               # règles en onglets
```

---

## 4. Conventions

### Langue & nommage
- **Tout le code est en anglais**, y compris le vocabulaire métier du jeu : fonctions, variables, types, fichiers, dossiers, routes API, URL, tables et colonnes SQL, clés de stockage, codes d'erreur (`playCard`, `PlayerView`, `updateGame`, `CARD_SETTINGS`, `components/game/game-over.tsx`, `/api/games/[code]/join`, table `games`, `GAME_NOT_FOUND`).
- Pour un nouveau jeu, fixer dans `CLAUDE.md` un **glossaire FR → EN** des mots du jeu (ex. Courtisans : courtisan → `courtier`, famille → `family`, domaine → `domain`, pioche → `deck`, lumière / disgrâce → `favor` / `disgrace`) pour que l'IA nomme toujours pareil.
- **Prévu pour le multilingue** : seuls les textes affichés au joueur sont en français. Ils vivent dans Sanity (`{ fr, en }` via `localeString` / `localeText`, lus avec `translate()`) ou, pour l'interface, dans les composants en attendant des dictionnaires `fr` / `en`. Jamais de mot français dans un identifiant.
- **Peu de commentaires**, en anglais ; noms explicites.
- **Sanity 100 % anglais** (types, ids, champs, titres). Ids déterministes : `family-butterfly`, `role-spy`, `courtier-noble-hare`. Le champ `key` contient la clé du moteur (`butterfly`, `spy`).

### Assets (`apps/web/public`)
- Dossiers en anglais minuscules : `home/`, `cards/`, `pictograms/`, `rules/`, `sounds/`, `textures/`.
- Fichiers en anglais `UPPER_SNAKE_CASE` : `cards/SPY_HARE.webp`, `home/QUEEN.webp`, `sounds/HOVER.mp3`, `pictograms/PICTOGRAM_ARROW_UP.svg`.
- Format : `.webp` pour les images, `.svg` pour les pictos, `.mp3` pour le son.

### Commits
- Gitmoji : `<emoji>(<scope>): <description>` — scopes `nextjs` · `studio` (ajouter `engine` si besoin).
- Commits fréquents, un par feature significative.

### Debug
- Panneau **Shift+D** (ou `?debug`). Onglets `GAME / SCENE / AUDIO / TRANSITION` + compteur FPS.
- **Tout paramètre visuel est réglable** (via `useReglages(dossier, objetMutable, champs)`) avec un bouton **Copy values** : Oré règle en live puis colle le JSON à l'IA, qui fige les valeurs par défaut.
- Boutons de phase (START / NEXT TURN / END) branchés sur `POST /api/games/[code]/debug` (désactivé en prod sauf `DEBUG_GAMES=1`).

---

## 5. Qui fait quoi

### 👤 Oré (humain) — ce que l'IA ne peut pas faire
- **Comptes & secrets** : créer le projet Supabase, Sanity, Vercel, le repo GitHub ; remplir `apps/web/.env.local` et les variables Vercel. **Ne jamais coller de token dans le chat** : les mettre dans `.env.local`.
- **Pousser le code** : `git push` (l'IA commite, Oré pousse).
- **Commandes Sanity avec son compte** :
  - `pnpm --filter template-studio schema:deploy` (après un changement de schéma)
  - `pnpm --filter template-studio migrate` (migration du contenu)
  - `pnpm --filter template-studio run deploy` (déployer le Studio)
- **Appliquer la migration SQL** Supabase (`supabase/migrations/*.sql`).
- **Fournir les assets** : PDF des règles, images des cartes, pictos (SVG), textures, polices, sons — nommés selon la convention, ou dans un dossier `ASSETS/` à trier.
- **Saisir / valider le contenu dans Sanity** (textes, missions, images).
- **Tester en vrai à plusieurs** (l'IA ne peut pas joindre Supabase depuis son environnement cloud : elle teste avec des données simulées).
- **Search Console / domaine / SEO** (validation de propriété, DNS).

### 🤖 IA (Claude)
- Écrire et tester le **moteur** (règles + tests Vitest, dont simulations de parties complètes).
- Schémas Sanity, requêtes GROQ, `typegen`, script `migrate.ts` idempotent.
- Routes API, vue filtrée, temps réel, lobby.
- Scène 3D, animations, UI DOM, règles, fin de partie, partage.
- Exposer **chaque réglage visuel dans le debug** avec "Copy values".
- Vérifier chaque changement : `tsc`, `eslint`, `next build`, captures Playwright (le rendu 3D headless est lent : les captures servent à vérifier la mise en page, pas les FPS).
- Commiter (gitmoji) ; ne jamais committer `.env.local` ni les modifs locales non liées (`package.json`, `pnpm-lock.yaml`… sauf si voulu).
- Ne jamais envoyer l'email d'Oré à un service tiers ; ne pas contourner les blocages réseau.

---

## 6. Déroulé pour un nouveau jeu (avec points de validation ⭐)

| # | Étape | Qui | Livrable |
|---|---|---|---|
| 0 | Fournir le PDF des règles + assets bruts + nom du jeu | 👤 | dossier `ASSETS/` |
| 1 | Lire les règles, rédiger **`plan-v1.md`** (règles formalisées, matériel, cas limites, infos cachées, glossaire FR → EN des mots du jeu) | 🤖 | plan |
| ⭐ | **Valider l'interprétation des règles** (c'est le point le plus critique : une règle mal comprise se propage partout) | 👤 | ok / corrections |
| 2 | Dupliquer le template (`setup-games.sh`), adapter `lib/site.ts` et `CLAUDE.md` (glossaire FR → EN) | 🤖 | repo propre |
| 3 | Créer comptes + `.env.local` + table Supabase + projet Sanity | 👤 | env prêts |
| 4 | **Moteur** : types, setup, actions, scoring, vue filtrée, tests + simulation | 🤖 | tests verts |
| ⭐ | Valider le moteur via un récap des règles codées (et, si possible, une partie texte simulée) | 👤 | ok |
| 5 | Schémas Sanity + migration + seed (images extraites du PDF si besoin) | 🤖 | studio |
| 6 | `schema:deploy`, `migrate`, deploy studio, vérifier le contenu | 👤 | contenu en ligne |
| 7 | Accueil + lobby (réutiliser `home/`, `lobby/`) — adapter l’habillage | 🤖 | écrans |
| ⭐ | **Direction artistique** : ambiance, typos, couleurs, décor d'accueil | 👤 | retours visuels |
| 8 | Plateau 3D : layout, cartes, main, zones jouables, ciblage | 🤖 | jeu jouable |
| ⭐ | **Jouabilité / lisibilité** : taille des cartes, caméra, feedbacks, ce qui est caché | 👤 | retours + JSON de réglages copiés |
| 9 | Ouverture (installation animée), annonces de tour | 🤖 | |
| 10 | Fin de partie : séquence de décompte, tableau des scores, rejouer, partage image | 🤖 | |
| ⭐ | **Fin de partie & partage** (moment émotionnel du jeu) | 👤 | retours |
| 11 | Règles in-app (textes Sanity, illustrations), SEO, OG image | 🤖 + 👤 (textes) | |
| 12 | **Test réel multijoueur** (2 → max joueurs, reconnexion, départ en cours) | 👤 | bugs remontés |
| 13 | Perf (FPS sur machine moyenne), accessibilité, mobile | 🤖 | |
| 14 | Son (en dernier) | 🤖 + 👤 (sons) | |

### Comment donner ses retours efficacement 👤
- **Capture d'écran annotée** + phrase courte ("plus petit", "moins saturé", "à cheval sur la bordure").
- **JSON "Copy values"** du debug quand un réglage est trouvé → l'IA en fait la valeur par défaut.
- Préciser **quelle phase** (ouverture, tour, fin) et **quel état** (mon tour / tour adverse).
- Un retour = une liste de points : l'IA les traite tous puis envoie un récap.

---

## 7. Ce qui est générique (réutilisable tel quel) vs spécifique au jeu

**Générique (garder)**
- `server/` (supabase, games avec verrou optimiste, cookie joueur, `handle`/`ApiError`), routes `api/games/*`, `lib/api.ts`, `use-live-game.ts`, `realtime.ts`
- Accueil, lobby et options de partie (rendues depuis `GAME.options`)
- Debug : `debug.tsx`, `debug-tabs.ts`, `settings.ts` (`useSettings`, Copy values, FPS), boutons START / NEXT TURN / END
- Annonces (`announcement.tsx`), auras, `table-text.tsx`, carte 3D (`card3d.tsx` : pli, reflets, contour), textures
- Règles en onglets (`rules.tsx` + `lib/rules.ts` + singleton Sanity `rules`)
- Fin de partie (`game-over.tsx`), partage (`photo.tsx` + `sharing.ts` + `preview-sharing.tsx`)
- SEO (metadata, robots, sitemap, manifest), proxy `api/media`, pages `/setup` (paramètres du site + to-do) et `/status` (dashboard + Vercel Web Analytics)

**Spécifique (à réécrire par jeu)**
- `packages/engine/src/<jeu>/` (règles, vue, options, debug) et l'export `GAME`
- `layout.ts` (où vont les cartes), `scene.tsx` (zones, interactions), `textures.ts`, `game.tsx` (bandeau, annonces du jeu)
- `lib/site.ts`, thème dans `globals.css`, textes, assets, types de contenu Sanity propres au jeu

---

## 8. Pièges connus (à transmettre à l'IA)
- **Phase "missions"** : dans Courtisans, le moteur démarre directement en phase `jeu` ; l'ouverture est déclenchée côté client par "missions non lues". Vérifier que les déclencheurs UI correspondent aux vrais états du moteur (bug trouvé tard car les données simulées ne reflétaient pas le moteur) → **toujours générer les mocks depuis le moteur**.
- **Images Sanity en CSS mask** : bloquées cross-origin → passer par `/api/media` (same-origin). `next/image` n'accepte que les qualités configurées (75 par défaut).
- **SVG à petite taille intrinsèque** (24×24) en texture 3D → floues : les rasteriser en 512 px avant `CanvasTexture`.
- **Effets React** dépendant d'objets recréés à chaque rendu (vue filtrée, réglages) → dépendre d'une clé stable (string) sinon timers annulés en boucle.
- **Canvas 2D coûteux** (`shadowBlur` par frame) → pré-rendre les sprites.
- **Capture WebGL** : `preserveDrawingBuffer: true` + caméra dédiée ; masquer les objets attachés à la caméra (`userData.horsPhoto`).
- **Textes du livret** : l'IA reformule (droits d'auteur) ; Oré peut coller le texte officiel lui-même dans Sanity.
- **Verrous git** : si l'IA n'a pas le droit de supprimer dans le dossier, git peut laisser des `.lock` → donner la permission de suppression ou les retirer à la main.

---

## 9. Commandes utiles
```bash
pnpm install
pnpm dev                     # site (apps/web)
pnpm dev:studio              # Sanity Studio local
pnpm test                    # tests du moteur
pnpm typecheck
pnpm --filter template-studio typegen # régénère apps/web/src/sanity/types.ts
pnpm --filter template-studio schema:deploy
pnpm --filter template-studio migrate
pnpm --filter template-studio run deploy
```

### Variables d'environnement (`apps/web/.env.local`, jamais commité)

`pnpm setup:env` pose les questions une par une (secrets masqués), crée le token Sanity, applique les migrations Supabase manquantes, génère le mot de passe admin, écrit `.env.local` et pousse tout sur Vercel.

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ou `ANON_KEY`), `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `NEXT_PUBLIC_SITE_URL`, `ADMIN_LOGIN`, `ADMIN_PASSWORD`, `SANITY_API_WRITE_TOKEN` (Editor, pour /setup), optionnels `VERCEL_TOKEN` (+ `VERCEL_TEAM_ID`) pour les stats de /status et `DEBUG_GAMES=1`.
