# Aegis-Sim — portable container for online hosting.
# Works as-is on Hugging Face Spaces (Docker), Google Cloud Run, Fly.io,
# Render, or any VM that can run Docker. Pure Python + NumPy, no build step.
FROM python:3.12-slim

# NumPy needs a couple of runtime libs; keep the image small.
RUN pip install --no-cache-dir numpy

# Non-root user (Hugging Face Spaces requires this; harmless elsewhere).
RUN useradd -m -u 1000 app
WORKDIR /app
COPY --chown=app:app . /app
USER app

# The tactical engine uses a process pool (multiprocessing "spawn"); this env
# keeps NumPy from over-subscribing threads inside each worker.
ENV OMP_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    AEGIS_HOST=0.0.0.0 \
    PORT=7860

# 7860 is the port Hugging Face Spaces expects; other hosts inject $PORT and
# run.py reads it. Bind 0.0.0.0 so the container is reachable.
EXPOSE 7860
CMD ["python", "run.py", "--no-browser", "--host", "0.0.0.0"]
