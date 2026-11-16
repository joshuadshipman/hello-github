'use strict';
/**
 * twilio_voice_webhook_guard.js — GL-INT-01 (P0, GOLIVE-LAUNCH-BLOCKER)
 * Twilio request signature validation for the /voice webhook surface.
 * Reuses the same HMAC-SHA1 X-Twilio-Signature primitive already used by
 * sms_inbound_engine.js so voice and SMS webhooks share one verified
 * implementation. Resolves `./sms_inbound_engine` first so containerized
 * builds inside `/app` (`angel-voice-server/`) never escape `/app`.
 */
let smsInboundEngine;
try {
  smsInboundEngine = require('./sms_inbound_engine');
} catch (_) {
  smsInboundEngine = require('../sms_inbound_engine');
}
const { validateTwilioSignature } = smsInboundEngine;

function isProdLike() {
  return process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE;
}

function isValidTwilioRequest(req, params, opts = {}) {
  const authToken = opts.authToken !== undefined ? opts.authToken : (process.env.TWILIO_AUTH_TOKEN || '');
  if (!authToken) {
    // No secret configured: fail-closed in prod, allow in local dev/test only.
    return !isProdLike();
  }
  const signature = (req && req.headers && req.headers['x-twilio-signature']) || '';
  if (!signature) return false;
  const proto = (req.headers && req.headers['x-forwarded-proto']) || 'https';
  const host = (req.headers && req.headers['host']) || '';
  const fullUrl = (process.env.PUBLIC_URL || (proto + '://' + host)) + (req.url || '');
  return validateTwilioSignature({ authToken, fullUrl, params, signature });
}

module.exports = { isValidTwilioRequest, isProdLike };
