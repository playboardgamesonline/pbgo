#!/usr/bin/env bash
# Crée : repo GitHub vierge + projet Sanity (studio sur hanabi.sanity.studio) + projet Vercel hanabi-online
set -euo pipefail
cd "$(dirname "$0")"
NAME="hanabi-online"

echo "▶ 0. Vérifs / connexions"
command -v gh >/dev/null || { echo "gh manquant → brew install gh"; exit 1; }
gh auth status >/dev/null 2>&1 || gh auth login
npx -y vercel@latest whoami >/dev/null 2>&1 || npx -y vercel@latest login

echo "▶ 1. Repo GitHub vierge"
[ -d .git ] || git init -b main
GH_USER=$(gh api user -q .login)
gh repo view "$GH_USER/$NAME" >/dev/null 2>&1 || gh repo create "$NAME" --private
git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$GH_USER/$NAME.git"

echo "▶ 2. Projet Sanity + studio (dossier studio/)"
npx -y sanity@latest init \
  --project-name "Hanabi Online" --dataset production \
  --output-path studio --template clean --typescript \
  --package-manager npm --no-git --no-mcp --no-skills
(cd studio && npx sanity deploy --url hanabi)

echo "▶ 3. Projet Vercel relié au repo"
npx -y vercel@latest project add "$NAME"
npx -y vercel@latest link --yes --project "$NAME"
npx -y vercel@latest git connect "https://github.com/$GH_USER/$NAME.git"

echo "✅ Terminé : github.com/$GH_USER/$NAME · https://hanabi.sanity.studio · projet Vercel $NAME"
