#!/bin/sh
set -e

echo "Starting Chroma server on port 8000..."
uvicorn chromadb.app:app --host 0.0.0.0 --port 8000 &
CHROMA_PID=$!

echo "Waiting for Chroma to start..."
sleep 3

echo "Starting Node/Express on port ${PORT:-8080}..."
# For TypeScript build: entry is dist/server.js
node dist/server.js

# If Node exits, stop Chroma
kill $CHROMA_PID || true