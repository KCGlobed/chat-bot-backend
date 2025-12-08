# Use a Python image with Node installed via apt
FROM python:3.11-slim

# Install Node + npm
RUN apt-get update && apt-get install -y nodejs npm && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# ---------- Python / Chroma setup ----------
# Install Chroma server + dependencies
RUN pip install --no-cache-dir "chromadb[server]" uvicorn

# ---------- Node / Express setup ----------
COPY package*.json ./
RUN npm ci --only=production

# Copy app source
COPY . .

# Ensure start.sh is executable
RUN chmod +x /usr/src/app/start.sh

# Env vars
ENV NODE_ENV=production
ENV PORT=8080
ENV CHROMA_URL=http://127.0.0.1:8000
ENV IS_PERSISTENT=TRUE

# Cloud Run will hit the container on PORT; Express listens there
EXPOSE 8080

CMD ["/usr/src/app/start.sh"]
