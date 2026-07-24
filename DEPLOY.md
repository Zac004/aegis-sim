# Hosting Aegis-Sim

The app is a self-contained Python server (NumPy only, no build step). The
included `Dockerfile` runs it on any container host. It's currently deployed on
**Render** (free tier) from this repo.

---

## How it's deployed (Render)

Render builds the `Dockerfile` and reads `render.yaml` for its config. It injects
a `$PORT`, which `run.py` reads; the container binds `0.0.0.0` so it's reachable.

- **Live URL:** your `https://<name>.onrender.com` (see the service page on
  <https://dashboard.render.com>).
- **Free tier note:** the service sleeps after ~15 min idle and cold-starts (~1
  min) on the next visit. Normal for free; snappy afterwards.

### Push an update

The site auto-redeploys on every push to `main`:

```bash
git add -A && git commit -m "your change" && git push
```

Render sees the new commit, rebuilds, and swaps in the new version with zero
downtime. Watch progress on the service's **Events / Logs** tab.

---

## Moving to another host (optional)

The same `Dockerfile` runs anywhere:

- **Koyeb** (<https://koyeb.com>) — free, no card: New → Web Service → GitHub →
  this repo → it detects the Dockerfile → Free instance → Deploy.
- **Google Cloud Run** — faster, no cold starts, free tier is \$0 but needs a
  card on file: `gcloud run deploy aegis-sim --source . --allow-unauthenticated
  --cpu 2 --memory 1Gi --timeout 300`. Give it ≥2 vCPU so the Tactical-AI
  parallelises and a 300 s timeout so long studies finish.
- **A small VPS** (Hetzner/DigitalOcean/etc.) — best CPU-per-dollar:
  ```bash
  docker build -t aegis-sim .
  docker run -d --restart unless-stopped -p 80:7860 aegis-sim
  ```
  Put Caddy in front for automatic HTTPS.

## Run the container locally to test

```bash
docker build -t aegis-sim .
docker run --rm -p 7860:7860 aegis-sim   # then open http://localhost:7860
```

`AEGIS_MAX_WORKERS` caps the Tactical-AI process pool for small instances
(default 2 in the Dockerfile); unset it or raise it on a beefier host.
