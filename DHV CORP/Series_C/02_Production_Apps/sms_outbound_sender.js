'use strict';
/**
 * sms_outbound_sender.js — Truth-Gated Outbound SMS Transport & Compliance Contract
 * =================================================================================
 * Replaces the legacy 5-line `{ sent: true, dryRun: true }` stub.
 *
 * Enforces Gate 3 & Gate 4:
 *  - Dry-run or unconfigured provider NEVER returns `sent: true` (`sent: false`, `status: 'DRY_RUN_NOT_SENT'`).
 *  - Separates `QUEUED`, `PROVIDER_ACCEPTED`, `DELIVERED`, `SUPPRESSED`, and `FAILED` states.
 *  - Checks durable STOP opt-out suppression, explicit affirmative consent, and recipient-local
 *    quiet hours (8:00 AM – 8:00 PM local time, covering Federal TCPA + TX SB 140 / FL FTSA)
 *    before any outbound send.
 *  - Requires a non-empty provider `messageSid` before reporting `PROVIDER_ACCEPTED`, and
 *    requires a correlated carrier delivery receipt before reporting `DELIVERED`.
 */

let smsInboundEngine = null;
try {
  smsInboundEngine = require('./sms_inbound_engine');
} catch (_) {
  try { smsInboundEngine = require('../sms_inbound_engine'); } catch (_e) {}
}

const SMS_STATES = Object.freeze({
  QUEUED: 'QUEUED',
  PROVIDER_ACCEPTED: 'PROVIDER_ACCEPTED',
  DELIVERED: 'DELIVERED',
  SUPPRESSED: 'SUPPRESSED',
  DRY_RUN_NOT_SENT: 'DRY_RUN_NOT_SENT',
  FAILED: 'FAILED'
});

/**
 * Evaluate recipient-local quiet hours (8:00 AM <= localHour < 8:00 PM).
 * Satisfies both Federal TCPA (8am-9pm) and stricter state rules (TX SB 140 / FL FTSA 8am-8pm).
 */
function checkQuietHours(opts = {}) {
  if (opts.emergencySafetyBypass === true) {
    return { allowed: true, reason: 'EMERGENCY_SAFETY_EXEMPTION' };
  }
  const tz = opts.recipientTimezone || 'America/Chicago';
  const now = opts.now instanceof Date ? opts.now : (opts.now ? new Date(opts.now) : new Date());
  let localHour = now.getUTCHours();
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false
    });
    const parts = fmt.formatToParts(now);
    const hrPart = parts.find(p => p.type === 'hour');
    if (hrPart) localHour = parseInt(hrPart.value, 10) % 24;
  } catch (_) {}

  if (typeof opts.localHourOverride === 'number') {
    localHour = opts.localHourOverride;
  }

  const allowed = localHour >= 8 && localHour < 20;
  return {
    allowed,
    localHour,
    timezone: tz,
    reason: allowed ? 'WITHIN_PERMITTED_WINDOW_0800_2000' : 'QUIET_HOURS_BLOCK_OUTSIDE_0800_2000'
  };
}

async function sendSms({ to, from, body, hasAffirmativeConsent, recipientTimezone, localHourOverride, now, dryRun, providerTransport, deliveryReceipt } = {}) {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.K_SERVICE);
  const effectiveDryRun = Boolean(dryRun === true || process.env.UAT_SIDE_EFFECTS === 'off' || process.env.SMS_DRY_RUN === 'true');

  if (!to || !body) {
    return {
      sent: false,
      delivered: false,
      state: SMS_STATES.FAILED,
      reason: 'MISSING_RECIPIENT_OR_BODY',
      dryRun: effectiveDryRun,
      messageSid: null,
      to: to || null,
      from: from || null
    };
  }

  // 1. Check durable STOP opt-out & consent via sms_inbound_engine
  if (smsInboundEngine && typeof smsInboundEngine.isOptedOut === 'function') {
    const optOutCheck = smsInboundEngine.isOptedOut(to);
    if (optOutCheck && optOutCheck.optedOut) {
      return {
        sent: false,
        delivered: false,
        state: SMS_STATES.SUPPRESSED,
        reason: optOutCheck.reason || 'OPTED_OUT_STOP_LEDGER',
        dryRun: effectiveDryRun,
        messageSid: null,
        to,
        from: from || null
      };
    }
  }

  // 2. Affirmative consent check (fail-closed unless explicitly granted)
  let consentGranted = hasAffirmativeConsent === true;
  if (!consentGranted && smsInboundEngine && typeof smsInboundEngine.getMessagingConsent === 'function') {
    const consentStatus = smsInboundEngine.getMessagingConsent(to, { hasAffirmativeConsent });
    consentGranted = Boolean(consentStatus && consentStatus.consented === true);
  }
  if (!consentGranted) {
    return {
      sent: false,
      delivered: false,
      state: SMS_STATES.SUPPRESSED,
      reason: 'NO_AFFIRMATIVE_CONSENT',
      dryRun: effectiveDryRun,
      messageSid: null,
      to,
      from: from || null
    };
  }

  // 3. Quiet hours enforcement (08:00 - 20:00 recipient local time)
  const qh = checkQuietHours({ recipientTimezone, localHourOverride, now });
  if (!qh.allowed) {
    return {
      sent: false,
      delivered: false,
      state: SMS_STATES.SUPPRESSED,
      reason: qh.reason,
      localHour: qh.localHour,
      timezone: qh.timezone,
      dryRun: effectiveDryRun,
      messageSid: null,
      to,
      from: from || null
    };
  }

  // 4. Dry-run / test transport handling — NEVER report `sent: true` on dry-run!
  if (effectiveDryRun) {
    if (isProd) {
      return {
        sent: false,
        delivered: false,
        state: SMS_STATES.FAILED,
        reason: 'DRY_RUN_TRANSPORT_REJECTED_IN_PRODUCTION',
        dryRun: true,
        messageSid: null,
        to,
        from: from || null
      };
    }
    return {
      sent: false,
      delivered: false,
      state: SMS_STATES.DRY_RUN_NOT_SENT,
      reason: 'DRY_RUN_NO_PROVIDER_REQUEST',
      dryRun: true,
      messageSid: null,
      to,
      from: from || null,
      body
    };
  }

  // 5. Execute real provider transport if injected or configured
  if (typeof providerTransport === 'function') {
    try {
      const resp = await providerTransport({ to, from, body });
      const sid = resp && (resp.sid || resp.messageSid);
      if (!sid || typeof sid !== 'string') {
        return {
          sent: false,
          delivered: false,
          state: SMS_STATES.FAILED,
          reason: 'PROVIDER_RESPONSE_MISSING_MESSAGESID',
          dryRun: false,
          messageSid: null,
          to,
          from: from || null
        };
      }
      const isDelivered = Boolean(deliveryReceipt && deliveryReceipt.messageSid === sid && deliveryReceipt.status === 'delivered');
      return {
        sent: true,
        delivered: isDelivered,
        state: isDelivered ? SMS_STATES.DELIVERED : SMS_STATES.PROVIDER_ACCEPTED,
        reason: isDelivered ? 'CARRIER_DELIVERY_CONFIRMED' : 'PROVIDER_ACCEPTED_AWAITING_DLV_RECEIPT',
        dryRun: false,
        messageSid: sid,
        to,
        from: from || null
      };
    } catch (err) {
      return {
        sent: false,
        delivered: false,
        state: SMS_STATES.FAILED,
        reason: (err && err.message) || 'PROVIDER_TRANSPORT_ERROR',
        dryRun: false,
        messageSid: null,
        to,
        from: from || null
      };
    }
  }

  return {
    sent: false,
    delivered: false,
    state: SMS_STATES.FAILED,
    reason: 'TWILIO_TRANSPORT_NOT_INJECTED',
    dryRun: false,
    messageSid: null,
    to,
    from: from || null
  };
}

module.exports = {
  SMS_STATES,
  checkQuietHours,
  sendSms
};
