# Auto Claims & Trade Specialists — Twilio Voice Webhook Container
# ================================================================
# Production-grade containerized intake & dispatch handler.

FROM node:20-alpine

ARG GIT_SHA=unknown
ARG SERVICE_REVISION=local-build
ENV GIT_SHA=$GIT_SHA
ENV SERVICE_REVISION=$SERVICE_REVISION

WORKDIR /app

# Dependencies first (layer cache) — fail build if package install fails
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Pre-build syntax and module integrity verification
RUN node -c voice_webhook_server.js && node -c claims_intake_engine.js && node -c specialist_engines.js && node -c plumbing_intake_engine.js && node -c fsm_plumbing_dispatch_adapter.js

# Pre-create writable directories for logs, queues, and audits
RUN mkdir -p /app/call_records/mirofish /app/outreach_queue /tmp/data /tmp/call_records && chown -R node:node /app /tmp/data /tmp/call_records

USER node

EXPOSE 8080

CMD ["node", "voice_webhook_server.js"]
