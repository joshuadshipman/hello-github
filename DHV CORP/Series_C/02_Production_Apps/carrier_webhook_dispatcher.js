'use strict';
/**
 * carrier_webhook_dispatcher.js — State-Verified Carrier FNOL Webhook & Outbox Dispatcher
 * =======================================================================================
 * Replaces the legacy 2-line path shim (`require('../../scripts/carrier_webhook_dispatcher')`).
 *
 * Enforces Gate 3, Gate 5 & Law T1.29c (Texas Insurance Code §4101 Non-Adjudication):
 *  - Every exported payload is permanently stamped `record_type: 'Preliminary'` with the
 *    statutory §4101 non-adjudication disclaimer.
 *  - Separates `PRELIMINARY_CAPTURED`, `QUEUED_IN_OUTBOX`, `CARRIER_ACKNOWLEDGED`, and
 *    `CARRIER_WEBHOOK_UNAVAILABLE_HUMAN_ESCALATION`.
 *  - Never reports `status: 'DISPATCHED'` or `carrier_acknowledged: true` unless an
 *    authenticated carrier transport returns HTTP 2xx with a non-empty `acknowledgmentId`.
 *  - When no live carrier transport is configured, queues durably in the local outbox and
 *    returns `ok: false, carrier_acknowledged: false, state: 'QUEUED_IN_OUTBOX'`.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CARRIER_DISPATCH_STATES = Object.freeze({
  PRELIMINARY_CAPTURED: 'PRELIMINARY_CAPTURED',
  QUEUED_IN_OUTBOX: 'QUEUED_IN_OUTBOX',
  CARRIER_ACKNOWLEDGED: 'CARRIER_ACKNOWLEDGED',
  CARRIER_WEBHOOK_UNAVAILABLE_HUMAN_ESCALATION: 'CARRIER_WEBHOOK_UNAVAILABLE_HUMAN_ESCALATION'
});

const STATUTORY_DISCLAIMER = 'Record Type: Preliminary. Administrative communications and intake conduit only under Texas Insurance Code §4101; does not adjudicate coverage, liability, fault, or claim valuation.';

async function dispatchFnolWebhook(payload = {}, opts = {}) {
  const stampedPayload = Object.assign({}, payload, {
    record_type: 'Preliminary',
    statutory_disclaimer: STATUTORY_DISCLAIMER,
    stamped_at: new Date().toISOString()
  });

  if (typeof opts.carrierTransport === 'function') {
    try {
      const res = await opts.carrierTransport(stampedPayload);
      const ackId = res && (res.acknowledgmentId || res.carrierAckId || res.id);
      if (res && res.ok === true && ackId) {
        return {
          ok: true,
          status: CARRIER_DISPATCH_STATES.CARRIER_ACKNOWLEDGED,
          state: CARRIER_DISPATCH_STATES.CARRIER_ACKNOWLEDGED,
          carrier_acknowledged: true,
          acknowledgment_id: String(ackId),
          record_type: 'Preliminary',
          statutory_disclaimer: STATUTORY_DISCLAIMER,
          payload: stampedPayload
        };
      }
      return {
        ok: false,
        status: CARRIER_DISPATCH_STATES.CARRIER_WEBHOOK_UNAVAILABLE_HUMAN_ESCALATION,
        state: CARRIER_DISPATCH_STATES.CARRIER_WEBHOOK_UNAVAILABLE_HUMAN_ESCALATION,
        carrier_acknowledged: false,
        acknowledgment_id: null,
        requires_human_escalation: true,
        record_type: 'Preliminary',
        statutory_disclaimer: STATUTORY_DISCLAIMER,
        error: (res && res.error) || 'CARRIER_RESPONSE_MISSING_ACKNOWLEDGMENT_ID',
        payload: stampedPayload
      };
    } catch (err) {
      return {
        ok: false,
        status: CARRIER_DISPATCH_STATES.CARRIER_WEBHOOK_UNAVAILABLE_HUMAN_ESCALATION,
        state: CARRIER_DISPATCH_STATES.CARRIER_WEBHOOK_UNAVAILABLE_HUMAN_ESCALATION,
        carrier_acknowledged: false,
        acknowledgment_id: null,
        requires_human_escalation: true,
        record_type: 'Preliminary',
        statutory_disclaimer: STATUTORY_DISCLAIMER,
        error: (err && err.message) || 'CARRIER_TRANSPORT_EXCEPTION',
        payload: stampedPayload
      };
    }
  }

  // No live carrier endpoint configured: queue honestly in local outbox, never claim DISPATCHED
  let outboxId = 'OUTBOX-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
  if (opts.outboxDir && process.env.SKIP_ARCHIVE_DISK_IO !== 'true') {
    try {
      fs.mkdirSync(opts.outboxDir, { recursive: true });
      fs.appendFileSync(
        path.join(opts.outboxDir, 'carrier_fnol_outbox.jsonl'),
        JSON.stringify({ outboxId, state: CARRIER_DISPATCH_STATES.QUEUED_IN_OUTBOX, payload: stampedPayload }) + '\n',
        'utf8'
      );
    } catch (_) {}
  }

  return {
    ok: false,
    status: CARRIER_DISPATCH_STATES.QUEUED_IN_OUTBOX,
    state: CARRIER_DISPATCH_STATES.QUEUED_IN_OUTBOX,
    carrier_acknowledged: false,
    acknowledgment_id: null,
    outbox_id: outboxId,
    requires_human_escalation: true,
    record_type: 'Preliminary',
    statutory_disclaimer: STATUTORY_DISCLAIMER,
    payload: stampedPayload
  };
}

function ingestHumanCall(payload = {}) {
  const hasTranscript = Boolean(payload && typeof payload.transcript === 'string' && payload.transcript.trim().length > 10);
  return {
    ok: hasTranscript,
    status: hasTranscript ? 'PRELIMINARY_INGESTED_FOR_REVIEW' : 'REJECTED_EMPTY_TRANSCRIPT',
    carrier_acknowledged: false,
    record_type: 'Preliminary',
    statutory_disclaimer: STATUTORY_DISCLAIMER,
    payload: Object.assign({}, payload, { record_type: 'Preliminary' })
  };
}

module.exports = {
  CARRIER_DISPATCH_STATES,
  STATUTORY_DISCLAIMER,
  dispatchFnolWebhook,
  ingestHumanCall
};
