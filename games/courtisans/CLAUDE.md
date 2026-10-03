# Courtisans Online

Version en ligne du jeu de société **Courtisans** (Catch Up Games), branchée sur le socle commun `@pbgo/core`.
Architecture détaillée (intentions, réglages, pièges) : `ARCHITECTURE.md` — rédigée avant le passage sur core et en anglais, les noms y sont encore en français.

## Conventions de code
- Code **entièrement en anglais** (identifiants, fichiers, valeurs du moteur, champs Sanity) ; commentaires et textes affichés en français
- Glossaire : courtisan → `courtier`, famille → `family` (`butterfly`, `toad`, `nightingale`, `hare`, `stag`, `carp`), rôle → `role` (`noble`, `spy`, `assassin`, `guard`), domaine → `domain`, table de la Reine → `table` (niveaux `up` = lumière / `down` = disgrâce), statut → `status` (`light`, `disgrace`, `neutral`), pioche → `deck`, main → `hand`, tapis → `mat`, siège → `seat`, journal → `log`, partie → `game`

## Assets
Fichiers dans `apps/web/public` nommés en anglais, `EN_MAJUSCULES_AVEC_DES_TIRETS_DU_BAS` (ex. `home/QUEEN.webp`, `cards/SPY_HARE.webp`, `sounds/HOVER.mp3`), dossiers en anglais minuscules.

## Structure
- `apps/web` — Next.js sur `@pbgo/core` (lobby, temps réel, routes API, /admin viennent de core)
  - `src/binding.ts` (moteur, constantes du site, `SOUNDS`, `DEFAULT_SKIN`, `SETTINGS_DEFAULTS`), `src/binding-ui.ts` (`Logo`, `Game`, `captureGamePhoto`, `RulesButton`), `src/binding-server.ts` (`loadSetupData` = missions, `loadGameData` = catalogue, `loadRules`)
  - `src/components/game` — plateau (`game.tsx` : ouverture, interactions, annonces, fin), messages, pictos, détail des points
    - ouverture : le banquet attend la lecture des missions de tous les joueurs (phase `missions` du moteur) ; après 60 s sans écriture, les joueurs prêts peuvent voter pour commencer sans les retardataires (`stalled-opening.tsx`, route `app/api/games/[code]/banquet`)
  - `src/components/game3d` — scène react-three-fiber (`layout.ts` calcule les poses, `scene.tsx` anime chaque carte vers sa pose)
  - `src/lib/catalog.ts` (catalogue par défaut), `src/lib/skin.ts` (habillage banquet par défaut), `src/lib/sounds.ts`
- `apps/studio` — Sanity Studio sur `@pbgo/studio-kit` (`rules` et `texts` propres au jeu remplacent les versions communes)
- `packages/engine` — moteur pur TypeScript (`@courtisans/engine`), `GAME` = contrat `@pbgo/engine-kit`, testé avec Vitest

## Sanity
- Projet `2lo2f5sv`, dataset `production`, studio `courtisans.sanity.studio`
- Communs (studio-kit) : `settings` (logo, thème, polices, crédits), `interface` (décor haut/bas, personnage = la Reine, motif, picto de l'hôte, couleurs des joueurs), `texts` (libellés d'interface, phrases de victoire + `missionsButton`, `banquetStarts`)
- Propres au jeu : `game` (tapis, dos, pictos, flèches, papier), `rules` (onglets illustrés), `family`, `role`, `courtier`, `mission` + objet récursif `condition` (valeurs = clés du moteur)
- Requêtes dans `apps/web/src/sanity/queries.ts`, puis `pnpm --filter courtisans-studio typegen`
- Migration vers core (valeurs en anglais, habillage commun) : `pnpm sanity:migrate-core` (simulation) puis `pnpm sanity:migrate-core --confirm`, puis `schema:deploy` et `deploy` du studio

## Supabase
- Tables `games` et `tasks` (migrations `0002`, `0003`, identiques au template) ; `parties` (`0001`) n'est plus utilisée
- Anciens liens `/partie/CODE` redirigés vers `/game/CODE`

## Commits
Format gitmoji : `<emoji>(<scope>): <description>` · scopes `web`, `studio`, `engine`
