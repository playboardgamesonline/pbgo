# play-board-games-online-template

Base des jeux de société en ligne : lobby avec options de partie, table 3D temps réel, fin de partie partageable, règles Sanity, administration sur `/admin` (Setup, Tasks, Monitoring).

## Démarrer

```bash
pnpm install
pnpm go-live                                   # GitHub + Sanity + Vercel, puis setup:env → site en ligne
pnpm setup:env                                 # questions guidées → .env.local + variables Vercel
pnpm dev                                       # http://localhost:3000
pnpm dev:studio                                # Sanity Studio
pnpm test && pnpm typecheck
```

`pnpm go-live` (scripts/go-live.sh) : repo GitHub privé + push, projet Sanity + CORS + studio, projet Vercel relié au repo (root `apps/web`) + domaine (`play-board-games-online-template.vercel.app` pour le template, `play-<jeu>-online.vercel.app` pour un jeu), sans modifier les fichiers suivis. Il enchaîne sur `pnpm setup:env`.

`pnpm setup:env` (scripts/setup-env.sh) : crée le token d'écriture Sanity et déploie le schéma, demande les clés Supabase et applique les migrations manquantes, crée le compte admin (mot de passe généré), ajoute le token Vercel pour /admin/monitoring, écrit `apps/web/.env.local` puis pousse les variables sur Vercel et redéploie. Relançable : Entrée garde la valeur actuelle.

## Administration

- `/admin` › Setup : paramètres du site enregistrés dans Sanity (titre, description, logo, min/max joueurs, thème, polices, règles PDF FR/EN) + to-do du projet
- `/admin` › Monitoring : parties en cours, créées, joueurs uniques, dernières parties, audience Vercel Web Analytics, état de la config et liste des sites du compte Vercel
- Connexion : `ADMIN_LOGIN` / `ADMIN_PASSWORD`. Style shadcn preset `b1VlJAwK` (luma, neutral, Inter, Hugeicons), composants dans `apps/web/src/components/admin/ui`

## Nouveau jeu

Voir `CLAUDE.md` (section « Adapter à un nouveau jeu ») et le guide complet `docs/GUIDE_TEMPLATE_JEU_EN_LIGNE.md`.
