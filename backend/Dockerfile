FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl \
    tini \
    ca-certificates \
    libvips42 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN groupadd -r worklenz && useradd -r -g worklenz worklenz && \
    mkdir -p /app/logs && chown -R worklenz:worklenz /app

USER worklenz

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "src-new/server.js"]
