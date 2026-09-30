# Migrer le projet vers un autre compte

Le projet vit sur le compte GitHub d'oré. Rien n'est lié à un nom de compte dans le code : les seuls endroits qui le mentionnent sont les valeurs par défaut de `scripts/go-live.sh` (`GH_REPO`) et `template/scripts/go-live.sh` (`GH_USER`), surchargeables par variable d'environnement (`GH_REPO=nouveau/play-board-games-online pnpm go-live <jeu>`).

## Ordre conseillé

1. **GitHub** : Settings › Transfer ownership du dépôt `play-board-games-online` (et du dépôt template). Les issues, PR et l'historique suivent ; l'ancienne adresse redirige.
2. **Vercel** : le compte qui reçoit doit avoir l'intégration GitHub installée. Puis, par projet : Settings › Advanced › Transfer Project vers la nouvelle équipe. Variables d'environnement, domaines et déploiements suivent. Reconnecter le dépôt si Vercel le demande.
3. **Sanity** : sanity.io/manage › projet › Settings › Transfer project (ou inviter le nouveau compte comme Administrateur). Les jetons (`SANITY_API_WRITE_TOKEN`) restent valables ; en créer un nouveau après le transfert par précaution.
4. **Supabase** : Project Settings › General › Transfer project vers la nouvelle organisation. Les clés ne changent pas.
5. **Domaines** : à rattacher à la nouvelle équipe Vercel (Domains › Transfer ou ré-ajouter le domaine au projet).
6. **Identité git** : mettre à jour `git config user.email` sur les machines. L'adresse doit être celle du compte GitHub qui déploie, sinon Vercel bloque le déploiement.
7. **Variables à re-vérifier après transfert** : `ADMIN_LOGIN`, `ADMIN_PASSWORD`, `SANITY_API_WRITE_TOKEN`, `SUPABASE_*`, `NEXT_PUBLIC_SITE_URL` (Production et Preview).
