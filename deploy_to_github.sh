#!/usr/bin/env bash
# Push this repo to a NEW GitHub repo, ready to deploy on Render/Koyeb.
# Usage:  ./deploy_to_github.sh <your-github-username> <repo-name>
# Example: ./deploy_to_github.sh aadith aegis-sim
#
# Before running: create an EMPTY repo at https://github.com/new
#   (no README, no .gitignore — this project already has them).
# When git asks for a password, paste a token from
#   https://github.com/settings/tokens  →  "Generate new token (classic)"
#   →  tick the "repo" scope.  Username = your GitHub username.
set -e
USER="${1:?usage: ./deploy_to_github.sh <github-username> <repo-name>}"
REPO="${2:?usage: ./deploy_to_github.sh <github-username> <repo-name>}"
REMOTE="https://github.com/${USER}/${REPO}.git"

echo "→ pointing 'origin' at ${REMOTE}"
git remote remove origin 2>/dev/null || true
git remote add origin "${REMOTE}"
git branch -M main

echo "→ pushing (you'll be asked for your GitHub username + a token as the password)"
git push -u origin main

echo
echo "✅ Pushed to ${REMOTE%.git}"
echo "   Next: go to https://render.com → New → Blueprint (or Web Service) → pick this repo →"
echo "   Free plan → Create. Live in a few minutes at https://${REPO}.onrender.com (or similar)."
