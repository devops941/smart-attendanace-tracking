FROM python:3.10-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

# Install essential system runtime libraries (OpenCV headless & image decoding)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifest first for Docker layer caching
COPY requirements.txt .

# Install prebuilt binary dependencies (zero C++ compile overhead)
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir --no-deps face-recognition==1.3.0

# Copy application source code (respecting .dockerignore)
COPY . .

# Expose default backend port
EXPOSE 8000

# Run FastAPI via Uvicorn (supports Render/Cloud $PORT environment variable)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
