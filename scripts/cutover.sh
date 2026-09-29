#!/usr/bin/env bash
# Bascule vers le monorepo. À lancer UNE fois, depuis play-game-online :  bash _monorepo/scripts/cutover.sh
#  1. reprend les derniers commits des anciens dépôts (template, Courtisans…)
#  2. crée le dépôt GitHub aurelienlouvel/play-game-online
#  3. range les anciens dossiers dans _archive/, installe le monorepo à la racine, recopie assets + fichiers locaux (.env, liens)
#  4. rebranche les projets Vercel sur le monorepo (domaines inchangés), puis pousse → déploiement
set -uo pipefail
M="$(cd "$(dirname "$0")/.." && pwd)"; P="$(dirname "$M")"; cd "$P"
[ "$(basename "$M")" = _monorepo ] || { echo "Lance : bash _monorepo/scripts/cutover.sh depuis play-game-online"; exit 1; }
GH_USER="aurelienlouvel"; REPO="$GH_USER/play-game-online"; TEAM="team_5AgMIBlJbSmZXWxmJ1pDPHQi"
ok()   { printf "  \033[32m✓\033[0m %s\n" "$*"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$*"; }
err()  { printf "  \033[31m✗\033[0m %s\n" "$*"; }
title(){ printf "\n\033[1m━━━ %s ━━━\033[0m\n" "$*"; }
json() { node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const o=JSON.parse(d);const v=($1);console.log(v??'')}catch{console.log('')}})"; }
for t in gh node pnpm git curl; do command -v $t >/dev/null || { echo "$t manquant"; exit 1; }; done

GAMES="courtisans hanabi skull-king flip-7 love-letter timebomb welcome-to omens odin trio skyjo cry-baby sky-team dracula-vs-van-helsing"
src() { case "$1" in template) echo "$P/play-game-online-template" ;; *) echo "$P/$1-online/$1" ;; esac; }
dest() { case "$1" in template) echo template ;; *) echo "games/$1" ;; esac; }

# ---------- 1. derniers commits ----------
title "Anciens dépôts"
for u in template $GAMES; do
  s="$(src $u)"; [ -d "$s/.git" ] || { err "$s introuvable"; exit 1; }
  [ -n "$(git -C "$s" status --porcelain)" ] && { warn "$u : modifications non commitées (non reprises) :"; git -C "$s" status --short | head -5; }
  if git -C "$M" subtree pull -q --prefix="$(dest $u)" "$s" main -m "📦 Reprise des derniers commits de $u" >/dev/null 2>&1; then ok "$u à jour"
  else err "$u : conflit en reprenant les derniers commits → cd _monorepo && git status"; exit 1; fi
done
read -r -p "Tout est à jour. Continuer la bascule ? [o/N] " a; [ "$a" = o ] || exit 0

# ---------- 2. GitHub ----------
title "GitHub"
gh auth status >/dev/null 2>&1 || gh auth login
gh repo view "$REPO" >/dev/null 2>&1 && ok "Dépôt $REPO" || { gh repo create "$REPO" --private >/dev/null && ok "Dépôt $REPO créé" || { err "création du dépôt"; exit 1; }; }
git -C "$M" remote get-url origin >/dev/null 2>&1 || git -C "$M" remote add origin "https://github.com/$REPO.git"

# ---------- 3. dossiers ----------
title "Dossiers"
mkdir -p _archive
for u in template $GAMES; do
  old="$( [ $u = template ] && echo play-game-online-template || echo "$u-online")"
  [ -e "$old" ] && mv -n "$old" "_archive/$old"
done
for f in setup-games.sh setup-nuit.log ASSETS; do [ -e "$f" ] && mv -n "$f" "_archive/$f"; done
( shopt -s dotglob; for f in "$M"/*; do mv -n "$f" "$P/"; done ); rmdir "$M" 2>/dev/null
ok "Monorepo installé à la racine, anciens dossiers dans _archive/"
for u in template $GAMES; do
  d="$(dest $u)"; old="_archive/$( [ $u = template ] && echo play-game-online-template || echo "$u-online/$u")"
  [ -d "_archive/$u-online/ASSETS" ] && mv -n "_archive/$u-online/ASSETS" "$d/assets"
  for f in .vercel .sanity-project-id .env.local apps/web/.env.local apps/studio/.env studio/.env; do
    [ -e "$old/$f" ] && { mkdir -p "$d/$(dirname "$f")"; cp -Rn "$old/$f" "$d/$f"; }
  done
done
ok "Assets et fichiers locaux (.env, liens Vercel, id Sanity) recopiés"
pnpm install >/dev/null 2>&1 && ok "pnpm install" || warn "pnpm install a signalé une erreur"

# ---------- 4. Vercel ----------
title "Vercel"
vt() { for f in "$HOME/Library/Application Support/com.vercel.cli/auth.json" "$HOME/.local/share/com.vercel.cli/auth.json"; do [ -f "$f" ] && node -e 'console.log(require(process.argv[1]).token||"")' "$f" && return; done; }
npx -y vercel@latest whoami >/dev/null 2>&1 || npx -y vercel@latest login
VT="$(vt)"; V() { curl -s -H "Authorization: Bearer $VT" -H "Content-Type: application/json" "$@"; }
root_of() { case "$1" in template) echo template/apps/web ;; hanabi) echo games/hanabi ;; *) echo "games/$1/apps/web" ;; esac; }
FAILED=""
for u in template $GAMES; do
  d="$(dest $u)"; name="$(node -e "try{console.log(require('./$d/.vercel/project.json').projectName)}catch{}")"
  [ -z "$name" ] && { warn "$u : pas de projet Vercel lié, ignoré"; continue; }
  r="$(V -X PATCH "https://api.vercel.com/v9/projects/$name?teamId=$TEAM" -d "{\"rootDirectory\":\"$(root_of $u)\",\"enableAffectedProjectsDeployments\":true}" | json "o.rootDirectory")"
  (cd "$d" && npx -y vercel@latest git disconnect --yes >/dev/null 2>&1; npx -y vercel@latest git connect "https://github.com/$REPO.git" --yes >/dev/null 2>&1)
  l="$(V "https://api.vercel.com/v9/projects/$name?teamId=$TEAM" | json "o.link?.repo")"
  if [ "$r" = "$(root_of $u)" ] && [ "$l" = play-game-online ]; then ok "$name → $r"
  else err "$name : root=$r repo=$l"; FAILED="$FAILED $name"; fi
done

# ---------- 5. push ----------
title "Push"
git push -qu origin main && ok "Poussé sur $REPO → les projets Vercel se déploient" || err "push impossible"
[ -n "$FAILED" ] && warn "À relier à la main (Vercel → Settings → Git) :$FAILED"

echo
read -r -p "Archiver les anciens dépôts GitHub (lecture seule, rien n'est supprimé) ? [o/N] " a
if [ "$a" = o ]; then
  for r in play-game-online-template courtisans hanabi skull-king flip-7 love-letter timebomb welcome-to omens odin trio skyjo cry-baby sky-team dracula-vs-van-helsing; do
    gh repo archive "$GH_USER/$r" --yes >/dev/null 2>&1 && ok "archivé : $r" || warn "$r non archivé"
  done
fi
echo; echo "Terminé. Travaille maintenant depuis play-game-online (pnpm dev <jeu>)."
