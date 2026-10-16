#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "==> Upgrading pip..."
pip install --upgrade pip

echo "==> Installing dependencies from requirements.txt..."
pip install -r requirements.txt

echo "==> Installing face-recognition without compiling dlib from source..."
pip install --no-deps face-recognition==1.3.0

echo "==> Verifying installation..."
python -c "import face_recognition; print('Face recognition engine is verified!')"
