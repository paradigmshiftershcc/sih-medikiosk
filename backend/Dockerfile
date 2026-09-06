# Production-ready image for the MediKiosk backend (Render / container cloud).
# Secrets are NOT bundled here - they are supplied as runtime environment
# variables by the deployment platform (Render dashboard).
FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /app

# Install only production dependencies from the lockfile for reproducibility.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy application source only (no .env, no secrets, no local files).
COPY src ./src

# Run as a non-root user.
USER node

# Render routes traffic to the PORT env var; index.js falls back to 5000.
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]