'use strict';
/**
 * twilio_voice_webhook_guard.js — GL-INT-01 (P0, GOLIVE-LAUNCH-BLOCKER)
 * Twilio request signature validation for the /voice webhook surface.
 * Reuses the same HMAC-SHA1 X-Twilio-Signature primitive already used by
 * sms_inbound_engine.js so voice and SMS webhooks share one verified
 * implementation. Fail-closed: a request with no/invalid signature is
 * rejected (403) whenever TWILIO_AUTH_TOKEN is configured, or whenever the
 * service is running in production (NODE_ENV=production or Cloud Run's
 * K_SERVICE) even if the token is missing — misconfiguration must never
 * silently degrade into "accept anything".
 */
const { validateTwilioSignature } = require('../sms_inbound_engine');

function isProdLike() {
  return process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE;
}

function isValidTwilioRequest(req, params, opts = {}) {
  const authToken = opts.authToken !== undefined ? opts.authToken : (process.env.TWILIO_AUTH_TOKEN || '');
  if (!authToken) {
    // No secret configured: fail-closed in prod, allow in local dev/test only.
    return !isProdLike();
  }
  const signature = req.headers['x-twilio-signature'] || '';
  if (!signature) return false;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['host'] || '';
  const fullUrl = (process.env.PUBLIC_URL || (proto + '://' + host)) + req.url;
  return validateTwilioSignature({ authToken, fullUrl, params, signature });
}

module.exports = { isValidTwilioRequest, isProdLike };
