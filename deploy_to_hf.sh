#!/usr/bin/env bash
# One-shot: push this repo to your Hugging Face Space.
# Usage:  ./deploy_to_hf.sh <your-hf-username> <space-name>
# Example: ./deploy_to_hf.sh aadith aegis-sim
#
# Before running: create the Space at https://huggingface.co/new-space
#   SDK = Docker (Blank),  Hardware = CPU basic (free).
# When git asks for a password, paste a WRITE token from
#   https://huggingface.co/settings/tokens   (username = your HF username).
set -e
USER="${1:?usage: ./deploy_to_hf.sh <hf-username> <space-name>}"
SPACE="${2:?usage: ./deploy_to_hf.sh <hf-username> <space-name>}"
REMOTE="https://huggingface.co/spaces/${USER}/${SPACE}"

echo "→ pointing 'hf' remote at ${REMOTE}"
git remote remove hf 2>/dev/null || true
git remote add hf "${REMOTE}"

echo "→ pushing main branch (you'll be asked for your HF username + a WRITE token)"
git push hf main

echo
echo "✅ Pushed. Your Space is building now:"
echo "   Build logs:  ${REMOTE}"
echo "   Live app:    https://${USER}-${SPACE}.hf.space   (ready in ~2–4 min)"
echo
echo "Send friends the Live app link. It stays up whether your Mac is on or off."
