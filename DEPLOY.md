# Hosting Aegis-Sim online (free)

The app is a self-contained Python server (NumPy only, no build step). The
included `Dockerfile` runs it anywhere. Recommended free host: **Hugging Face
Spaces (Docker)** — 2 free vCPUs so the parallel Tactical-AI engine works, a
public HTTPS URL, and no credit card.

---

## Option A — Hugging Face Spaces (recommended, free, no card)

1. Make a free account at <https://huggingface.co>.
2. **New → Space.** Name it, choose **SDK: Docker → Blank**, Hardware **CPU basic
   (free, 2 vCPU / 16 GB)**, visibility **Public**. Create.
3. The Space is a git repo. Push this project into it:
   ```bash
   git clone https://huggingface.co/spaces/<your-username>/<space-name> hf-space
   cp -r "WHAT_IF?/"* hf-space/          # copy the app in (Dockerfile included)
   cd hf-space
   ```
4. **Prepend** the Space metadata to `README.md` (Spaces requires this header;
   `app_port` must match the Dockerfile's 7860):
   ```markdown
   ---
   title: Aegis-Sim
   emoji: 🚀
   colorFrom: blue
   colorTo: red
   sdk: docker
   app_port: 7860
   pinned: false
   ---
   ```
5. Push:
   ```bash
   git add -A && git commit -m "Aegis-Sim" && git push
   ```
   The Space builds the Docker image and goes live at
   `https://<your-username>-<space-name>.hf.space`. First build ~2–4 min.

Notes: a free Space sleeps after inactivity and wakes on the next visit (a few
seconds). It's public and read-only-safe as shipped.

---

## Option B — Google Cloud Run (free tier, needs a Google account + card on file)

Generous free tier, scales to zero (pay nothing at idle), real CPU during
requests. Needs the `gcloud` CLI.

```bash
gcloud run deploy aegis-sim \
  --source . \
  --allow-unauthenticated \
  --cpu 2 --memory 1Gi \
  --timeout 300 \                # the tactical study is long; raise the timeout
  --region <your-region>
```
Cloud Run injects `$PORT`; `run.py` reads it. Give it ≥2 vCPU so the Tactical-AI
parallelises, and a 300 s timeout so long studies finish.

---

## Option C — Fly.io / Render / any VPS

- **Fly.io:** `fly launch` (it detects the Dockerfile), pick a small machine
  (bump RAM to ≥512 MB), `fly deploy`. Free allowance covers a small always-on VM.
- **Render:** New → Web Service → from repo → Docker. Free tier works but sleeps
  and has limited CPU (the tactical study will be slow); fine for a demo.
- **A $6–12/mo VPS (Hetzner/DigitalOcean/Linode):** best CPU-per-dollar for the
  multiprocessing workload. Install Docker, then:
  ```bash
  docker build -t aegis-sim .
  docker run -d --restart unless-stopped -p 80:7860 aegis-sim
  ```
  Put **Caddy** in front for automatic HTTPS (a 2-line Caddyfile:
  `yourdomain.com { reverse_proxy localhost:7860 }`).

---

## Run the container locally to test first

```bash
docker build -t aegis-sim .
docker run --rm -p 7860:7860 aegis-sim
# open http://localhost:7860
```

---

## Before going public (optional hardening — not yet applied)

As shipped the app is fine for a private/demo link. For a widely-shared public
URL, consider: rate-limiting the heavy `POST /api/tactical` (it uses all cores),
making the `POST /api/save` template-write endpoint session-local or disabling
it, and tightening the `Access-Control-Allow-Origin: *` header. Ask and these can
be added behind an env flag.
