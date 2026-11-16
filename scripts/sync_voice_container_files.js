#!/usr/bin/env node
/**
 * scripts/sync_voice_container_files.js
 * Explicitly synchronizes canonical voice engine modules between
 * DHV CORP/Series_C/02_Production_Apps and DHV CORP/Series_C/02_Production_Apps/angel-voice-server
 * prior to validation and container build, so validate_specialist.js can remain a pure read-only auditor.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const PROD_APPS_DIR = path.join(REPO_ROOT, 'DHV CORP', 'Series_C', '02_Production_Apps');
const CONTAINER_DIR = path.join(PROD_APPS_DIR, 'angel-voice-server');

const SYNC_FILES = [
  'voice_webhook_server.js',
  'claims_intake_engine.js',
  'second_listener_rag_engine.js',
  'customer_identity_engine.js',
  'call_review_agent.js',
  'specialist_engines.js',
  'trades_sales_demo_engine.js',
  'post_call_dashboard.js',
  'scene_diagram_engine.js',
  'sop_sla_document_chaser_engine.js',
  'trades_pricing_tiers.js',
  'trade_after_hours_intake_engine.js',
  'stripe_onboarding_bridge.js',
  'sla_metrics_store.js',
  'exif_haversine_and_pii_engine.js',
  'dispatch_sms_checkin_and_coaching_engine.js',
  'customer_service_followup_refund_invoice_engine.js',
  'tenant_fleet_health_and_owner_sms_engine.js',
  'redteam_safety_guards.js',
  'did_tenant_router.js',
  'outbound_audio_frame_hardener.js',
  'audio_ingress_guard.js',
  'voice_visual_state_tokens.js',
  'media_stream_ws_guard.js',
  'portal_login_and_tenant_auth_engine.js',
  'voice_service_quality_telemetry_and_bargein_guard.js',
  'plumbing_regional_and_lifecycle_sales_engine.js',
  'plumbing_intake_engine.js',
  'fsm_plumbing_dispatch_adapter.js',
  'sms_outbound_sender.js',
  'twilio_voice_webhook_guard.js',
  'sms_inbound_engine.js',
  'post_call_link_sender.js',
  'carrier_webhook_dispatcher.js'
];

function syncAll() {
  let synced = 0;
  for (const f of SYNC_FILES) {
    const p1 = path.join(PROD_APPS_DIR, f);
    const p2 = path.join(CONTAINER_DIR, f);
    if (fs.existsSync(p1)) {
      const s1 = fs.statSync(p1).size;
      const s2 = fs.existsSync(p2) ? fs.statSync(p2).size : 0;
      // Guard against accidental stub overwrite (<100 bytes when container has >1000 bytes)
      if (s1 < 100 && s2 > 1000) {
        fs.copyFileSync(p2, p1);
        synced++;
      } else {
        const b1 = fs.readFileSync(p1, 'utf8').replace(/\r\n/g, '\n');
        const b2 = fs.existsSync(p2) ? fs.readFileSync(p2, 'utf8').replace(/\r\n/g, '\n') : '';
        if (b1 !== b2) {
          fs.writeFileSync(p2, b1, 'utf8');
          synced++;
        }
      }
    } else if (fs.existsSync(p2)) {
      fs.copyFileSync(p2, p1);
      synced++;
    }
  }
  console.log(`[SYNC VOICE CONTAINER] Verified ${SYNC_FILES.length} modules (${synced} updated).`);
  return { total: SYNC_FILES.length, synced };
}

if (require.main === module) {
  syncAll();
}

module.exports = { SYNC_FILES, syncAll };
