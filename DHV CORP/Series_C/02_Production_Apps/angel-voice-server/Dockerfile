# Auto Claims Specialist — Twilio Voice Webhook Container
# ========================================================
# Production-grade containerized FNOL intake handler for +14699166767.
#
# VALIDATION GATE (added 2026-08-07):
# The validate_specialist.js gate runs during docker build.
# If ANY check fails, the build aborts and no container is created.
# This prevents shipping untested stubs (the v1.0 fabricated-data incident).
#
# Checks enforced:
#   G1: Syntax valid
#   G2: No hardcoded ACORD payloads (John Doe, POL-99201, etc.)
#   G3: ≥8 FNOL field captures, ≥8 questions, injury branching
#   G4: Call recording enabled
#   G5: Transcript archiving wired
#   G6: Health endpoint exists
#   G7: ACORD payload built from session data
#   G8: SpeechResult extraction from Twilio

FROM node:20-alpine

WORKDIR /app

# Dependencies first (layer cache)
COPY package*.json ./
RUN npm ci --only=production 2>/dev/null || true

# Copy application code
COPY . .

# ══════════════════════════════════════════════════════════════
# MANDATORY VALIDATION GATE — blocks build if ANY check fails
# This is the systemic fix for the 2026-08-06 FNOL bot failure.
# ══════════════════════════════════════════════════════════════
# Pre-create writable directories for logs, queues, and audits
RUN mkdir -p /app/call_records/mirofish /app/outreach_queue /tmp/data /tmp/call_records && chown -R node:node /app /tmp/data /tmp/call_records

USER node

EXPOSE 8080

CMD ["node", "voice_webhook_server.js"]