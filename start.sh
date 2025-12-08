#!/bin/sh
set -e

echo "Starting Chroma server on port 8000..."
# Start Chroma in background
uvicorn chromadb.app:app --host 0.0.0.0 --port 8000 &
CHROMA_PID=$!

echo "Waiting a bit for Chroma to start..."
sleep 3

echo "Starting Node/Express on port ${PORT:-8080}..."
npm run dev

# If Node exits, kill Chroma (not strictly necessary in Cloud Run)
kill $CHROMA_PID || true
