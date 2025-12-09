# Base: Python for Chroma + Node for your TS server
FROM python:3.11-slim

# Install Node + npm
RUN apt-get update && \
    apt-get install -y nodejs npm && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# ---------- Python / Chroma setup ----------
# chromadb includes the `chroma` CLI. [server] pulls server deps.
RUN pip install --no-cache-dir "chromadb[server]"

# Directory for Chroma persistence (even though Cloud Run fs is ephemeral)
RUN mkdir -p /chroma

# ---------- Node / TypeScript setup ----------
# Copy package files + tsconfig for better build cache
COPY package*.json tsconfig.json ./

# Install all deps (including dev) so tsc works
RUN npm install

# Copy the rest of the source (including start.sh)
COPY . .

# Build TypeScript -> dist/
# Expect a script: "build": "tsc"
RUN npm run build

# Ensure start.sh is executable
RUN chmod +x /usr/src/app/start.sh

# ---------- Environment ----------
ENV NODE_ENV=production
ENV PORT=8080
ENV CHROMA_URL=http://127.0.0.1:8000
ENV IS_PERSISTENT=TRUE
# Use this at runtime to skip DB connection while testing
ENV SKIP_DB=false

EXPOSE 8080

# Start Chroma + Node
CMD ["/usr/src/app/start.sh"]
