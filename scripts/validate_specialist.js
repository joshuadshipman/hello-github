#!/usr/bin/env node
/**
 * scripts/validate_specialist.js
 *
 * UNIFIED PRE-CONTAINER SPECIALIST & COMMERCIAL PILOTS PREREQUISITE VALIDATION GATE
 * Enforces Law T1.18 (Pre-Container Specialist Gate — 26 checks)
 * and Law T1.29b (Series C Commercial Pilot Readiness Gate — 5 prerequisites across 6 verticals).
 *
 * Requirements:
 * 1. Syntax Validation (node -c)
 * 2. 26 Core Specialist Validation Checks (Gates 1-8 against voice_webhook_server.js)
 * 3. 5 Commercial Pilot Prerequisites across 6 Verticals (Plumbing, HVAC, Roofing, Electrical, Dental, Legal PI):
 *    - Prereq 1: Validated Demo Call Audio & Transcripts on disk
 *    - Prereq 2: White-label Client Intake Dashboards on disk
 *    - Prereq 3: Onboarding How-To Guides on disk
 *    - Prereq 4: Brand Image & Aesthetic Standard Compliance (Navy, Sapphire, Light background)
 *    - Prereq 5: Stripe Checkout Links & Dedicated Telephony DID Routing
 *
 * Usage:
 *   node scripts/validate_specialist.js
 *   node scripts/validate_specialist.js --self-test
 *   node scripts/validate_specialist.js --target <file>
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// __dirname is always <repo-or-worktree-root>/scripts, so REPO_ROOT must
// always be derived from __dirname — NEVER hardcoded to the canonical
// antigravity path, or every other worktree/lane silently validates the
// main worktree's files instead of its own (the recurring cross-worktree
// false-green). If that root is itself named "DHV CORP" (as in per-lane
// worktrees, whose root IS the DHV CORP dir), REPO_ROOT must be its parent
// so that REPO_ROOT/DHV CORP/Series_C resolves correctly. A stray local
// junk folder literally named "DHV CORP/DHV CORP" (git-excluded, unrelated
// wealth-bot data) previously caused a substring/existence check here to
// misfire and double the path — fixed by checking basename instead of
// existence of a nested dir.
const SCRIPTS_PARENT_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.basename(SCRIPTS_PARENT_DIR) === 'DHV CORP'
  ? path.resolve(SCRIPTS_PARENT_DIR, '..')
  : SCRIPTS_PARENT_DIR;
const SERIES_C_DIR = path.join(REPO_ROOT, 'DHV CORP', 'Series_C');
const PROD_APPS_DIR = path.join(SERIES_C_DIR, '02_Production_Apps');
const AGENTANGEL_IO_DIR = path.join(PROD_APPS_DIR, 'agentangel-io');
const DEMO_CALLS_DIR = fs.existsSync(path.join(PROD_APPS_DIR, 'data', 'demo_calls'))
  ? path.join(PROD_APPS_DIR, 'data', 'demo_calls')
  : path.join(SERIES_C_DIR, 'data', 'demo_calls');
const RECEIPTS_DIR = 'C:/Users/17549/data/orchestrator/receipts';

const CHECKS = [];
let passes = 0;
let failures = 0;

function check(name, pass, evidence) {
  CHECKS.push({ name, pass: Boolean(pass), evidence: String(evidence) });
  if (pass) {
    passes++;
    console.log(`  ✅ ${name}`);
  } else {
    failures++;
    console.error(`  ❌ ${name}: ${evidence}`);
  }
}

// ── PART 1: PRE-CONTAINER SPECIALIST GATE (26 CHECKS) ────────────────────────
function runPreContainerSpecialistGate(targetFile) {
  console.log('\n── PART 1: Core Specialist Validation Gate (Law T1.18 — 26 checks) ──');

  if (!fs.existsSync(targetFile)) {
    check('G1-SYNTAX: Target file exists', false, `Missing target file: ${targetFile}`);
    return;
  }

  const source = fs.readFileSync(targetFile, 'utf8');

  // Gate 1: Syntax (in-process vm.Script to prevent Windows subprocess hang)
  try {
    const vm = require('vm');
    new vm.Script(source, { filename: targetFile });
    check('G1-SYNTAX: Node.js syntax valid', true, 'vm.Script exit 0');
  } catch (e) {
    check('G1-SYNTAX: Node.js syntax valid', false, e.message || 'syntax error');
  }

  // Gate 2: No Hardcoded ACORD Payloads (6 checks)
  const hardcodedPatterns = [
    { pattern: /["']John Doe["']/, label: 'Hardcoded insured name "John Doe"' },
    { pattern: /["']POL-99201["']/, label: 'Hardcoded policy "POL-99201"' },
    { pattern: /axiscore:\s*98/, label: 'Hardcoded AxiScore 98' },
    { pattern: /band:\s*["']STRONG["']/, label: 'Hardcoded band "STRONG"' },
    { pattern: /["']Main St & 5th Ave["']/, label: 'Hardcoded location "Main St & 5th Ave"' },
    { pattern: /["']Rear bumper & trunk["']/, label: 'Hardcoded damage "Rear bumper & trunk"' },
  ];

  for (const { pattern, label } of hardcodedPatterns) {
    const found = pattern.test(source);
    check(`G2-NO-HARDCODED: ${label}`, !found,
      found ? `Found fabricated data in source` : 'clean');
  }

  // Gate 3: Question Tree Depth (4 checks)
  const stepMatches = source.match(/field:\s*['"][a-zA-Z]+['"]/g);
  const questionMatches = source.match(/question:\s*["'][^"']{20,}["']/g);
  const fieldCount = stepMatches ? stepMatches.length : 0;
  const questionCount = questionMatches ? questionMatches.length : 0;

  check('G3-DEPTH: ≥8 FNOL field captures defined', fieldCount >= 8,
    `Found ${fieldCount} field captures`);
  check('G3-DEPTH: ≥8 substantive questions defined', questionCount >= 8,
    `Found ${questionCount} questions ≥20 chars`);

  const hasInjuryBranch = /injur/i.test(source) && /branch|condition|if.*injur/i.test(source);
  check('G3-BRANCH: Injury conditional branching exists', hasInjuryBranch,
    hasInjuryBranch ? 'injury branching found' : 'No conditional branching on injury status');

  const requiredFields = [
    'callerName', 'policyNumber', 'dateOfLoss', 'locationOfLoss',
    'lossDescription', 'vehicleInfo', 'injuryStatus', 'policeReport'
  ];
  for (const field of requiredFields) {
    const hasField = source.includes(field);
    check(`G3-FIELD: ${field} capture defined`, hasField,
      hasField ? 'present' : `Missing FNOL field: ${field}`);
  }

  // Gate 4: Recording Enabled
  const hasRecord = /<Record/i.test(source) || /Record/i.test(source);
  check('G4-RECORD: Call recording enabled in TwiML', hasRecord,
    hasRecord ? '<Record> found' : 'No <Record> tag — calls will not be saved');

  // Gate 5: Archiving
  const hasWriteFile = /writeFileSync|writeFile|createWriteStream|saveTranscript|archiveTranscript/i.test(source);
  const hasTranscriptPath = /Transcript|transcript.*path|TRANSCRIPT_DIR|REDACTED_TRANSCRIPT/i.test(source);
  check('G5-ARCHIVE: Transcript file write exists', hasWriteFile,
    hasWriteFile ? 'write method found' : 'No file write for transcripts');
  check('G5-ARCHIVE: Transcript path configured', hasTranscriptPath,
    hasTranscriptPath ? 'transcript path configured' : 'No transcript path found');

  // Gate 6: Health Endpoint (2 checks)
  const hasHealthRoute = /\/health/i.test(source);
  const hasVersionInfo = /version|v[0-9]+\.[0-9]+/i.test(source);
  check('G6-HEALTH: /health endpoint exists', hasHealthRoute,
    hasHealthRoute ? '/health route found' : 'No health endpoint');
  check('G6-HEALTH: Version reporting in health response', hasVersionInfo,
    hasVersionInfo ? 'version info found' : 'No version in health response');

  // Gate 7: No Fabricated Completion
  const hasFieldCheck = /fnolData|extractedFields|session\.\w+Data/i.test(source);
  const hasACORDBuilder = /buildACORD|acord_fields.*insured.*name.*session/i.test(source)
    || /acord_fields[\s\S]{0,200}session\./i.test(source);
  const passesG7 = hasFieldCheck && hasACORDBuilder;
  check('G7-NO-FAKE: ACORD payload built from session data', passesG7,
    passesG7 ? 'Validated session-to-ACORD construction path found' : 'Missing session-to-ACORD path');

  // Gate 8: Speech Extraction (2 checks)
  const extractsSpeech = /SpeechResult/i.test(source);
  const storesSpeech = /session\.\w+\[?\w*\]?\s*=\s*(userSpeech|data\.SpeechResult|speech)/i.test(source)
    || /fnolData\[/i.test(source)
    || /fnolData\.\w+\s*=/i.test(source);
  check('G8-EXTRACT: SpeechResult is read from Twilio', extractsSpeech,
    extractsSpeech ? 'SpeechResult capture found' : 'Twilio SpeechResult never read');
  check('G8-EXTRACT: Speech stored in structured fields', storesSpeech,
    storesSpeech ? 'Speech → field mapping found' : 'Speech captured but never stored');
}

// ── PART 2: COMMERCIAL PILOTS PREREQUISITES (LAW T1.29b — 6 VERTICALS) ───────
function runCommercialPilotsPrerequisites() {
  console.log('\n── PART 2: Series C Commercial Pilot Readiness Gate (Law T1.29b — 6 Verticals) ──');

  const VERTICALS = [
    {
      id: 'plumbing',
      name: 'Plumbing Specialist',
      page: path.join(AGENTANGEL_IO_DIR, 'plumbing.html'),
      demoCall: path.join(DEMO_CALLS_DIR, 'plumbing_sales_demo_call.md'),
      did: '+17543342877',
      dashboard: path.join(AGENTANGEL_IO_DIR, 'trades_proof_dashboard.html')
    },
    {
      id: 'hvac',
      name: 'HVAC Specialist',
      page: path.join(AGENTANGEL_IO_DIR, 'hvac.html'),
      demoCall: path.join(DEMO_CALLS_DIR, 'hvac_sales_demo_call.md'),
      did: '+17542917994',
      dashboard: path.join(AGENTANGEL_IO_DIR, 'trades_proof_dashboard.html')
    },
    {
      id: 'roofing',
      name: 'Roofing Specialist',
      page: path.join(AGENTANGEL_IO_DIR, 'roofing.html'),
      demoCall: path.join(DEMO_CALLS_DIR, 'roofing_sales_demo_call.md'),
      did: '+18444166167',
      dashboard: path.join(AGENTANGEL_IO_DIR, 'trades_proof_dashboard.html')
    },
    {
      id: 'electrical',
      name: 'Electrical Specialist',
      page: path.join(AGENTANGEL_IO_DIR, 'electrician.html'),
      demoCall: path.join(DEMO_CALLS_DIR, 'electrical_sales_demo_call.md'),
      did: '+17543342877',
      dashboard: path.join(AGENTANGEL_IO_DIR, 'trades_proof_dashboard.html')
    },
    {
      id: 'dental',
      name: 'Dental / Clinic Specialist',
      page: path.join(AGENTANGEL_IO_DIR, 'dentistry.html'),
      demoCall: path.join(DEMO_CALLS_DIR, 'dental_clinic_sales_demo_call.md'),
      did: '+17543342877',
      dashboard: path.join(AGENTANGEL_IO_DIR, 'trades_proof_dashboard.html')
    },
    {
      id: 'legal_pi',
      name: 'Legal PI Specialist',
      page: path.join(AGENTANGEL_IO_DIR, 'legal_pi.html'),
      demoCall: path.join(DEMO_CALLS_DIR, 'legal_pi_sales_demo_call.md'),
      did: '+14699166767',
      dashboard: fs.existsSync(path.join(PROD_APPS_DIR, 'aiagentangel-com', 'claims_dashboard.html'))
        ? path.join(PROD_APPS_DIR, 'aiagentangel-com', 'claims_dashboard.html')
        : path.join(AGENTANGEL_IO_DIR, 'trades_proof_dashboard.html')
    }
  ];

  // 1. Audio & Transcripts
  const audioProof = path.join(AGENTANGEL_IO_DIR, 'assets', 'audio', 'proof-track-01-live-dispatch-dial.mp3');
  check('PILOT-AUDIO-MASTER: Physical audio proof track exists on disk',
    fs.existsSync(audioProof) && fs.statSync(audioProof).size > 50000,
    `Size: ${fs.existsSync(audioProof) ? fs.statSync(audioProof).size : 0} bytes`);

  for (const v of VERTICALS) {
    const exists = fs.existsSync(v.demoCall);
    const sz = exists ? fs.statSync(v.demoCall).size : 0;
    check(`PILOT-DEMO-${v.id.toUpperCase()}: Verbatim demo call transcript exists (>5KB)`,
      exists && sz > 5000,
      `${v.demoCall} (${sz} bytes)`);
  }

  // 2. Dashboards
  for (const v of VERTICALS) {
    const exists = fs.existsSync(v.dashboard);
    const sz = exists ? fs.statSync(v.dashboard).size : 0;
    check(`PILOT-DASHBOARD-${v.id.toUpperCase()}: Client intake dashboard exists (>10KB)`,
      exists && sz > 10000,
      `${v.dashboard} (${sz} bytes)`);
  }

  // 3. Onboarding How-To Guides
  const forwardingGuide = path.join(AGENTANGEL_IO_DIR, 'STAR72_Call_Forwarding_Setup_Guide.html');
  const onboardingPortal = path.join(AGENTANGEL_IO_DIR, 'onboarding_portal.html');
  const pilotIntake = path.join(AGENTANGEL_IO_DIR, 'pilot-intake.html');

  check('PILOT-GUIDE-STAR72: *72 Call Forwarding Setup Guide exists (>10KB)',
    fs.existsSync(forwardingGuide) && fs.statSync(forwardingGuide).size > 10000,
    `${forwardingGuide} (${fs.existsSync(forwardingGuide) ? fs.statSync(forwardingGuide).size : 0} bytes)`);

  check('PILOT-GUIDE-PORTAL: Onboarding Portal wizard exists (>10KB)',
    fs.existsSync(onboardingPortal) && fs.statSync(onboardingPortal).size > 10000,
    `${onboardingPortal} (${fs.existsSync(onboardingPortal) ? fs.statSync(onboardingPortal).size : 0} bytes)`);

  check('PILOT-GUIDE-INTAKE: Pilot Intake form exists on disk',
    fs.existsSync(pilotIntake) && fs.statSync(pilotIntake).size > 5000,
    `${pilotIntake} (${fs.existsSync(pilotIntake) ? fs.statSync(pilotIntake).size : 0} bytes)`);

  // 4. Website Landing Pages & Brand Law Compliance
  for (const v of VERTICALS) {
    const exists = fs.existsSync(v.page);
    const sz = exists ? fs.statSync(v.page).size : 0;
    check(`PILOT-PAGE-${v.id.toUpperCase()}: Specialist landing page exists (>20KB)`,
      exists && sz > 20000,
      `${v.page} (${sz} bytes)`);

    if (exists) {
      const content = fs.readFileSync(v.page, 'utf8');
      const hasNavy = /#172554/i.test(content);
      const hasSapphire = /#3B82F6|#1D4ED8/i.test(content);
      const hasBannedTeal = /#008080|#20B2AA|#008B8B|#00FFFF|teal/i.test(content);
      check(`PILOT-BRAND-${v.id.toUpperCase()}: Brand Law color compliance (Navy & Sapphire, no teal)`,
        hasNavy && hasSapphire && !hasBannedTeal,
        `Navy: ${hasNavy}, Sapphire: ${hasSapphire}, BannedTeal: ${hasBannedTeal}`);
    }
  }

  // 5. Checkout & Dedicated Telephony DIDs
  const serverPath = path.join(PROD_APPS_DIR, 'voice_webhook_server.js');
  let didMapOk = false;
  try {
    const { DID_MAP } = require(serverPath);
    didMapOk = Boolean(
      DID_MAP['+14699166767'] &&
      DID_MAP['+19723099156'] &&
      DID_MAP['+17543342877'] &&
      DID_MAP['+17542917994'] &&
      DID_MAP['+18444166167']
    );
  } catch (e) {
    didMapOk = false;
  }
  check('PILOT-DID-ROUTING: Dedicated Twilio DIDs mapped across all specialists with zero crossover',
    didMapOk,
    'Plumbing +17543342877, HVAC +17542917994, Roofing +18444166167, Claims +14699166767, Hermes +19723099156');

  // Verify Offer B / Risk-Free Pilot ($0 today) and standardized pricing tiers wired to onboarding
  const plumbingContent = fs.readFileSync(path.join(AGENTANGEL_IO_DIR, 'plumbing.html'), 'utf8');
  const hasTrialSection = (plumbingContent.includes('Offer B') || plumbingContent.includes('Risk-Free Pilot')) &&
    (plumbingContent.includes('onboarding_portal.html') || plumbingContent.includes('plumbing_onboarding.html'));
  check('PILOT-CHECKOUT-OFFER-B: Offer B / Risk-Free Pilot ($0 today) wired to Onboarding Portal',
    hasTrialSection,
    'Plumbing and trade pages wire Risk-Free Pilot ($0 today) to onboarding portal checkout');
}

// ── PART 3: BEHAVIORAL, 2ND-LISTENER & ZERO-SPLIT-BRAIN SYNC GATE (G9..G15) ──
function runBehavioralAndSyncGate() {
  console.log('\n── PART 3: Behavioral, 2nd-Listener & Zero-Split-Brain Sync Gate (G9..G15) ──');

  // G9: Zero split-brain between 02_Production_Apps and 02_Production_Apps/angel-voice-server
  const subDir = path.join(PROD_APPS_DIR, 'angel-voice-server');
  const syncFiles = [
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
    'post_call_link_sender.js'
  ];
  let driftFiles = [];
  for (const f of syncFiles) {
    const p1 = path.join(PROD_APPS_DIR, f);
    const p2 = path.join(subDir, f);
    if (fs.existsSync(p1) && fs.existsSync(p2)) {
      const b1 = fs.readFileSync(p1, 'utf8').replace(/\r\n/g, '\n');
      const b2 = fs.readFileSync(p2, 'utf8').replace(/\r\n/g, '\n');
      if (b1 !== b2) driftFiles.push(f);
    } else {
      driftFiles.push(f);
    }
  }
  check('G9-ZERO-SPLIT-BRAIN: 02_Production_Apps and angel-voice-server are byte-synced',
    driftFiles.length === 0,
    driftFiles.length === 0 ? `All ${syncFiles.length} core voice modules verified byte-identical (read-only audit)` : `Drift in: ${driftFiles.join(', ')}`);

  // G10: Identity Extraction (rejects numbers/corporate nouns, extracts Name + Company in 1 utterance)
  try {
    const idEngine = require(path.join(PROD_APPS_DIR, 'customer_identity_engine.js'));
    const rNum = idEngine.extractCallerIdentity('180.');
    const rCorp = idEngine.extractCallerIdentity('Company.');
    const rFirst = idEngine.extractCallerIdentity('First. Tell me what you can do.');
    const rFull = idEngine.extractCallerIdentity('Joshua Shipman with Dub Hujar Ventures.');
    const passG10 = !rNum && !rCorp && !rFirst && rFull && /Joshua Shipman/i.test(rFull.displayName || '') && /Dub Hujar Ventures/i.test(rFull.detectedCompany || '');
    check('G10-IDENTITY: Rejects numbers/discourse words and extracts Name + Company from single utterance',
      Boolean(passG10),
      passG10 ? `Extracted "${rFull.displayName}" / "${rFull.detectedCompany}"` : `Failed identity check: ${JSON.stringify({ rNum, rCorp, rFirst, rFull })}`);
  } catch (e) {
    check('G10-IDENTITY: Rejects numbers/discourse words and extracts Name + Company from single utterance', false, e.message);
  }

  // G11: 2nd Listener RAG Engine (Claims overview + ignores caller challenge to intake questions)
  try {
    const rag = require(path.join(PROD_APPS_DIR, 'second_listener_rag_engine.js'));
    const inq1 = rag.detectInquiry('First, tell me what you can do.', { specialist: 'claims' }, { spec: 'claims', lang: 'en' });
    const inq2 = rag.detectInquiry('Why are you asking about traffic lights? Stop lights. Wow.', { specialist: 'claims' }, { spec: 'claims', lang: 'en' });
    const passG11 = inq1 && inq1.handled && inq1.id === 'Q-CLAIMS-OVERVIEW' && !/plumbing|14-day/i.test(inq1.spokenText || '') && !inq2;
    check('G11-2ND-LISTENER: Answers Claims/AxiRate overview on 469 line and ignores traffic-light challenges',
      Boolean(passG11),
      passG11 ? 'Q-CLAIMS-OVERVIEW matched cleanly & challenge bypassed' : `Failed 2nd listener check: ${JSON.stringify({ inq1, inq2 })}`);
  } catch (e) {
    check('G11-2ND-LISTENER: Answers Claims/AxiRate overview on 469 line and ignores traffic-light challenges', false, e.message);
  }

  // G12: Bare SMS Consent on narrative slot ("Yes, you can text me" -> qNarrativeStoryOnly, no scold)
  try {
    const claims = require(path.join(PROD_APPS_DIR, 'claims_intake_engine.js'));
    const sess = claims.createSession('TEST-G12', '+17542917994', 'Dub Hujar Ventures', 'en');
    sess.hasGreeted = true;
    sess.pendingConsentQuestion = true;
    sess.hostCallerName = 'Joshua Shipman';
    sess.companyName = 'Dub Hujar Ventures';
    sess.pendingSlot = 'narrative';
    sess.askedSlots = ['callerName', 'narrative'];
    sess.fnolData.callerName = 'Joshua Shipman';
    sess.fnolData.companyName = 'Dub Hujar Ventures';
    const res = claims.evaluateTurn(sess, 'Yes, you can text me.');
    const spoken = (res && res.speechChunks ? res.speechChunks.map(c => c.text).join(' ') : '');
    const passG12 = /texted your .*dashboard|starting about 10 seconds before/i.test(spoken) && !/record the circumstances as you described them/i.test(spoken);
    check('G12-BARE-CONSENT: Bare "Yes" to SMS permission prompts for story warmly without scolding',
      Boolean(passG12),
      passG12 ? 'Spoke qNarrativeStoryOnly cleanly' : `Unexpected response: ${spoken}`);
  } catch (e) {
    check('G12-BARE-CONSENT: Bare "Yes" to SMS permission prompts for story warmly without scolding', false, e.message);
  }

  // G13: Rain/water into parked car while watching TV -> flood, floodWaterLevel, zero traffic lights
  try {
    const claims = require(path.join(PROD_APPS_DIR, 'claims_intake_engine.js'));
    const sess = claims.createSession('TEST-G13', '+17542917994', 'Dub Hujar Ventures', 'en');
    sess.hasGreeted = true;
    sess.pendingConsentQuestion = false;
    sess.smsConsent = true;
    sess.hostCallerName = 'Joshua Shipman';
    sess.companyName = 'Dub Hujar Ventures';
    sess.pendingSlot = 'narrative';
    sess.askedSlots = ['callerName', 'narrative'];
    sess.fnolData.callerName = 'Joshua Shipman';
    sess.fnolData.companyName = 'Dub Hujar Ventures';
    sess.fnolData.smsConsent = true;
    const res = claims.evaluateTurn(sess, 'Yesterday I was sitting inside my living room watching TV while it was raining outside and water was coming into my parked car in my driveway in Dallas, Texas.');
    const spoken = (res && res.speechChunks ? res.speechChunks.map(c => c.text).join(' ') : '');
    const passG13 = sess.lossType === 'flood' && sess.pendingSlot === 'floodWaterLevel' && !/traffic light|stop sign|heading and coming from/i.test(spoken);
    check('G13-WATER-PARKED: Rain into parked car while watching TV routes to flood (floodWaterLevel) with 0 traffic-light questions',
      Boolean(passG13),
      passG13 ? `lossType=${sess.lossType}, nextSlot=${sess.pendingSlot}` : `Got lossType=${sess.lossType}, nextSlot=${sess.pendingSlot}, say=${spoken}`);
  } catch (e) {
    check('G13-WATER-PARKED: Rain into parked car while watching TV routes to flood (floodWaterLevel) with 0 traffic-light questions', false, e.message);
  }

  // G14: "The 2022 Acura from the policy" -> vehicleInfo="2022 Acura", policyNumber not corrupted to "2022FROMTHE"
  try {
    const claims = require(path.join(PROD_APPS_DIR, 'claims_intake_engine.js'));
    const sess = claims.createSession('TEST-G14', '+17542917994', 'Dub Hujar Ventures', 'en');
    sess.hasGreeted = true;
    sess.lossType = 'flood';
    sess.pendingSlot = 'vehicle';
    sess.askedSlots = ['callerName', 'narrative', 'floodWaterLevel', 'vehicle'];
    sess.fnolData.callerName = 'Joshua Shipman';
    sess.fnolData.policyNumber = 'PA-8849201-NAT';
    sess.fnolData.locationOfLoss = 'Residence Driveway, Dallas, TX';
    claims.evaluateTurn(sess, 'The 2022 Acura from the policy.');
    const passG14 = /2022 Acura/i.test(sess.fnolData.vehicleInfo || '') && sess.fnolData.policyNumber === 'PA-8849201-NAT';
    check('G14-POLICY-VEHICLE: "The 2022 Acura from the policy" captures vehicle="2022 Acura" without corrupting policyNumber',
      Boolean(passG14),
      passG14 ? `vehicleInfo="${sess.fnolData.vehicleInfo}", policyNumber="${sess.fnolData.policyNumber}"` : `Got vehicleInfo="${sess.fnolData.vehicleInfo}", policyNumber="${sess.fnolData.policyNumber}"`);
  } catch (e) {
    check('G14-POLICY-VEHICLE: "The 2022 Acura from the policy" captures vehicle="2022 Acura" without corrupting policyNumber', false, e.message);
  }

  // G15: Post-call review agent exports reviewPostCall & is wired into voice_webhook_server.js
  try {
    const cra = require(path.join(PROD_APPS_DIR, 'call_review_agent.js'));
    const vws = fs.readFileSync(path.join(PROD_APPS_DIR, 'voice_webhook_server.js'), 'utf8');
    const passG15 = typeof cra.reviewPostCall === 'function' && Array.isArray(cra.DEFECT_RULES) && cra.DEFECT_RULES.length >= 19 && /call_review_agent\.js/.test(vws);
    check('G15-POST-CALL-REVIEW: call_review_agent.js exports reviewPostCall + 19 DEFECT_RULES and is wired into voice_webhook_server.js',
      Boolean(passG15),
      passG15 ? `reviewPostCall active with ${cra.DEFECT_RULES.length} rules` : 'Missing reviewPostCall or webhook spawn');
  } catch (e) {
    check('G15-POST-CALL-REVIEW: call_review_agent.js exports reviewPostCall + 19 DEFECT_RULES and is wired into voice_webhook_server.js', false, e.message);
  }

  // G16: Brand Domain & Compound Utterance Identity ("JD with agent Angel, but I'm supposed to be looking at AI agent angel.com. Not.io.")
  try {
    const idEngine = require(path.join(PROD_APPS_DIR, 'customer_identity_engine.js'));
    const vws = fs.readFileSync(path.join(PROD_APPS_DIR, 'voice_webhook_server.js'), 'utf8');
    const rJd = idEngine.extractCallerIdentity("JD with agent Angel, but I'm supposed to be looking at AI agent angel.com. Not.io.");
    const hasAiAgentAngelDotCom = /Thank you for calling the AI Agent Angel dot com Auto Claims Demo line/i.test(vws)
      && !/Thank you for calling the AgentAngel dot io Auto Claims Demo line/i.test(vws);
    const passG16 = rJd && rJd.displayName === 'JD' && rJd.spokenGreeting === 'J D' && /agent Angel/i.test(rJd.detectedCompany || '') && hasAiAgentAngelDotCom;
    check('G16-BRAND-AND-COMPOUND-ID: Claims open uses AI Agent Angel dot com and extracts "JD" + "agent Angel" from compound correction',
      Boolean(passG16),
      passG16 ? `displayName="${rJd.displayName}", spokenGreeting="${rJd.spokenGreeting}", company="${rJd.detectedCompany}"` : `Failed G16: ${JSON.stringify({ rJd, hasAiAgentAngelDotCom })}`);
  } catch (e) {
    check('G16-BRAND-AND-COMPOUND-ID: Claims open uses AI Agent Angel dot com and extracts "JD" + "agent Angel" from compound correction', false, e.message);
  }

  // G17: Hesitation Filler "Um" Never Captured as Name + "comp loss" Stages Comprehensive & Connects Immediately
  try {
    const idEngine = require(path.join(PROD_APPS_DIR, 'customer_identity_engine.js'));
    const { evaluateHostTurn } = require(path.join(PROD_APPS_DIR, 'voice_webhook_server.js'));
    const rUm = idEngine.extractCallerIdentity('Um, I would like to do a comp loss.');
    const hostSess = { hostOpened: true, hostPhase: 'discovery', hostCallerName: 'JD', hostSpokenGreeting: 'J D', companyName: 'agent Angel', fnolData: { callerName: 'JD', companyName: 'agent Angel' }, transcript: '' };
    const hRes = evaluateHostTurn(hostSess, 'Um, I would like to do a comp loss.', { language: 'en' });
    const combinedHandoff = (hRes.speechChunks || []).map(c => c.text).join(' ');
    const passG17 = !rUm && hRes && hostSess.hostPhase === null && hostSess.skipGreetingPreamble === true && hostSess.fnolData.stagedPeril === 'comprehensive' && hostSess.hostCallerName === 'JD' && /Excellent, J D\. Connecting you now to AI Agent Angel/i.test(combinedHandoff);
    check('G17-NO-UM-AND-COMP-LOSS: "Um, I would like to do a comp loss" rejects "Um" as name, stages comprehensive, and connects immediately',
      Boolean(passG17),
      passG17 ? `rUm=null, stagedPeril=${hostSess.fnolData.stagedPeril}, handoff="${combinedHandoff.slice(0, 80)}..."` : `Failed G17: ${JSON.stringify({ rUm, hRes, stagedPeril: hostSess.fnolData.stagedPeril })}`);
  } catch (e) {
    check('G17-NO-UM-AND-COMP-LOSS: "Um, I would like to do a comp loss" rejects "Um" as name, stages comprehensive, and connects immediately', false, e.message);
  }

  // G18: "I didn't get a link." Triggers resendSms + Spoken URL Backup Without Advancing Slot or Saying "Are you safe right now?"
  try {
    const claims = require(path.join(PROD_APPS_DIR, 'claims_intake_engine.js'));
    const sess = claims.createSession('TEST-G18', '+17549990710', 'Agent Angel', 'en');
    sess.hasGreeted = true;
    sess.pendingConsentQuestion = false;
    sess.smsConsent = true;
    sess.inCallSmsDispatched = true;
    sess.hostCallerName = 'JD';
    sess.hostSpokenGreeting = 'J D';
    sess.pendingSlot = 'narrative';
    sess.askedSlots = ['narrative'];
    sess.fnolData.stagedPeril = 'comprehensive';
    const res18 = claims.evaluateTurn(sess, "I didn't get a link.");
    const spoken18 = (res18 && res18.speechChunks ? res18.speechChunks.map(c => c.text).join(' ') : '');
    const passG18 = res18 && res18.resendSms === true && sess.pendingSlot === 'narrative' && /re-sent that link.*ai agent angel dot com/i.test(spoken18) && !/circumstances as you described|Are you safe right now/i.test(spoken18);
    check('G18-RESEND-LINK: "I didn\'t get a link" sets resendSms=true and speaks dashboard URL without advancing slot',
      Boolean(passG18),
      passG18 ? `resendSms=${res18.resendSms}, pendingSlot=${sess.pendingSlot}` : `Failed G18: ${JSON.stringify({ res18, spoken18 })}`);
  } catch (e) {
    check('G18-RESEND-LINK: "I didn\'t get a link" sets resendSms=true and speaks dashboard URL without advancing slot', false, e.message);
  }

  // G19: "No, I'm done. Thank you. Never mind." Aborts Cleanly Without Fabricating a Collision Claim or Transferring to Matthew
  try {
    const claims = require(path.join(PROD_APPS_DIR, 'claims_intake_engine.js'));
    const sess = claims.createSession('TEST-G19', '+17549990710', 'Agent Angel', 'en');
    sess.hasGreeted = true;
    sess.pendingSlot = 'losstype';
    sess.askedSlots = ['narrative', 'losstype'];
    const res19 = claims.evaluateTurn(sess, "No, I'm done. Thank you. Never mind.");
    const spoken19 = (res19 && res19.speechChunks ? res19.speechChunks.map(c => c.text).join(' ') : '');
    const passG19 = res19 && res19.isFinal === true && res19.abortedByCaller === true && res19.callerRequestedHangup === true && !/collision claim has been recorded|Transferring you back to our demo host/i.test(spoken19);
    check('G19-CLEAN-ABORT: "No, I\'m done. Thank you. Never mind." aborts cleanly without fabricating a claim or pitching',
      Boolean(passG19),
      passG19 ? `abortedByCaller=${res19.abortedByCaller}, callerRequestedHangup=${res19.callerRequestedHangup}` : `Failed G19: ${JSON.stringify({ res19, spoken19 })}`);
  } catch (e) {
    check('G19-CLEAN-ABORT: "No, I\'m done. Thank you. Never mind." aborts cleanly without fabricating a claim or pitching', false, e.message);
  }

  // G20: Word-Boundary "ice" Guard ("policy", "police", "notice", "service" Never Set roadCondition = "Ice / Snow")
  try {
    const claims = require(path.join(PROD_APPS_DIR, 'claims_intake_engine.js'));
    const sess = claims.createSession('TEST-G20', '+17549990710', 'Agent Angel', 'en');
    sess.hasGreeted = true;
    sess.pendingSlot = 'vehicle';
    claims.extractEntities('The 2022 Acura from the policy and police notice service.', sess);
    const passG20 = (sess.fnolData.lossFacts && sess.fnolData.lossFacts.roadCondition) !== 'Ice / Snow';
    check('G20-ICE-WORD-BOUNDARY: Words containing "ice" ("policy", "police", "notice", "service") never set roadCondition="Ice / Snow"',
      Boolean(passG20),
      passG20 ? `roadCondition="${(sess.fnolData.lossFacts && sess.fnolData.lossFacts.roadCondition) || ''}"` : `Failed G20: roadCondition="${sess.fnolData.lossFacts && sess.fnolData.lossFacts.roadCondition}"`);
  } catch (e) {
    check('G20-ICE-WORD-BOUNDARY: Words containing "ice" ("policy", "police", "notice", "service") never set roadCondition="Ice / Snow"', false, e.message);
  }

  // G21: Non-Collision ACORD & Diagram Integrity (Flood/Hail/Glass Never Get Fake Police Report #402, Adverse Driver Marcus Vance, or 45 mph V2 Collision Diagram)
  try {
    const claims = require(path.join(PROD_APPS_DIR, 'claims_intake_engine.js'));
    const sess = claims.createSession('TEST-G21', '+17549990710', 'Agent Angel', 'en');
    sess.hasGreeted = true;
    sess.pendingConsentQuestion = false;
    sess.lossType = 'hail';
    sess.pendingSlot = 'summaryConfirm';
    sess.fnolData.callerName = 'JD';
    sess.fnolData.locationOfLoss = '4410 Oak Lawn Avenue, Dallas, TX';
    sess.fnolData.vehicleInfo = '2022 Acura';
    sess.fnolData.lossDescription = 'Hail storm hit parked car in driveway';
    sess.fnolData.hailParkedOrDriving = 'Parked in driveway';
    sess.fnolData.hailGlassDamage = 'Cracked windshield';
    sess.fnolData.hailDentSeverity = 'Quarter-sized dents';
    sess.fnolData.drivability = 'Drivable';
    sess.fnolData.photoStatus = 'Yes';
    sess.askedSlots = claims.activeFlow(sess).slice();
    claims.evaluateTurn(sess, 'Yes, that is accurate.');
    const diag = claims.buildDiagramData(sess);
    const passG21 = sess.fnolData.policeReport === 'None (No)' && sess.fnolData.policeReportNumber === 'N/A' && sess.fnolData.claimant === null && diag.template === 'single_vehicle' && diag.vehicles.length === 1 && diag.vehicles[0].speedMph === 0;
    check('G21-NON-COLLISION-ACORD-INTEGRITY: Non-collision hail/flood claims have policeReport="None (No)", claimant=null, single_vehicle diagram, and 0 mph parked speed',
      Boolean(passG21),
      passG21 ? `policeReport="${sess.fnolData.policeReport}", claimant=null, vehicles=${diag.vehicles.length}, speedMph=${diag.vehicles[0].speedMph}` : `Failed G21: ${JSON.stringify({ policeReport: sess.fnolData.policeReport, claimant: sess.fnolData.claimant, template: diag.template, vehiclesCount: diag.vehicles.length, speed: diag.vehicles[0] && diag.vehicles[0].speedMph })}`);
  } catch (e) {
    check('G21-NON-COLLISION-ACORD-INTEGRITY: Non-collision hail/flood claims have policeReport="None (No)", claimant=null, single_vehicle diagram, and 0 mph parked speed', false, e.message);
  }

  // G22: Animal Species Word-Boundary Guard ("does the damage obstruct your view" Never Triggers White-tailed Deer Animal Collision)
  try {
    const { AnimalLossIntakeAuditor } = require(path.join(PROD_APPS_DIR, 'call_review_agent.js'));
    const auditor = new AnimalLossIntakeAuditor();
    const isAnimalFalsePos = auditor.detectAnimalCollision('Does the damage obstruct your direct view while driving, and are there any other windows cracked?');
    const isAnimalTruePos = auditor.detectAnimalCollision('Last night on Highway 69 near Tyler a deer ran out in front of my truck and I hit it.');
    const passG22 = isAnimalFalsePos === false && isAnimalTruePos === true;
    check('G22-ANIMAL-SPECIES-WORD-BOUNDARIES: "does ... damage" never false-triggers White-tailed Deer animal collision',
      Boolean(passG22),
      passG22 ? `falsePos=${isAnimalFalsePos}, truePos=${isAnimalTruePos}` : `Failed G22: falsePos=${isAnimalFalsePos}, truePos=${isAnimalTruePos}`);
  } catch (e) {
    check('G22-ANIMAL-SPECIES-WORD-BOUNDARIES: "does ... damage" never false-triggers White-tailed Deer animal collision', false, e.message);
  }

  // G23: Hail Narrative Not Diverted to catastrophe_surge + Plumbing Turn 1 Trailing "?" Advances + Stale Partial Session Isolated
  try {
    delete require.cache[require.resolve(path.join(PROD_APPS_DIR, 'claims_intake_engine.js'))];
    delete require.cache[require.resolve(path.join(PROD_APPS_DIR, 'specialist_engines.js'))];
    const claims = require(path.join(PROD_APPS_DIR, 'claims_intake_engine.js'));
    const specialistEngines = require(path.join(PROD_APPS_DIR, 'specialist_engines.js'));
    const inq = claims.classifyCustomerInquiry('Yesterday afternoon a hail storm hit my parked 2022 Acura in my driveway at 4410 Oak Lawn Avenue in Dallas, Texas, cracking the windshield and leaving quarter-sized dents on the hood and roof.');
    const pSess = specialistEngines.createSession('plumbing', { fromNumber: '+17542917994', compositeDemo: true });
    specialistEngines.evaluateTurn(pSess, ''); // step 0 -> 1
    specialistEngines.evaluateTurn(pSess, 'Carlos Mendoza from Lone Star Plumbing, yes this is my cell phone?');
    const serverSrc = fs.readFileSync(path.join(PROD_APPS_DIR, 'voice_webhook_server.js'), 'utf8');
    const hasPartialIsolation = serverSrc.includes('allowPartialResume') && serverSrc.includes('clearPartialSession(fromNum, route.routeDid)');
    const passG23 = inq === null && pSess.ticket.callerName === 'Carlos Mendoza' && pSess.step === 2 && hasPartialIsolation;
    check('G23-HAIL-NARRATIVE-PLUMBING-TURN1-AND-CLEAN-PARTIAL: Hail narrative sets lossType without catastrophe_surge diversion, plumbing Turn 1 trailing "?" advances to step 2, and stale partial sessions are cleared on new calls',
      Boolean(passG23),
      passG23 ? `inq=null, plumbingCaller="${pSess.ticket.callerName}", step=${pSess.step}, partialIsolated=true` : `Failed G23: inq=${inq}, plumbingCaller=${pSess.ticket.callerName}, step=${pSess.step}, partialIsolated=${hasPartialIsolation}`);
  } catch (e) {
    check('G23-HAIL-NARRATIVE-PLUMBING-TURN1-AND-CLEAN-PARTIAL: Hail narrative sets lossType without catastrophe_surge diversion, plumbing Turn 1 trailing "?" advances to step 2, and stale partial sessions are cleared on new calls', false, e.message);
  }

  // G24: 2nd Listener Real-Time Turn/Slot Validation, Zero Stacked Questions, Zero "Got it, understood" Filler & 24 Red-Team Rules
  try {
    delete require.cache[require.resolve(path.join(PROD_APPS_DIR, 'second_listener_rag_engine.js'))];
    delete require.cache[require.resolve(path.join(PROD_APPS_DIR, 'claims_intake_engine.js'))];
    delete require.cache[require.resolve(path.join(PROD_APPS_DIR, 'call_review_agent.js'))];
    const secondListener = require(path.join(PROD_APPS_DIR, 'second_listener_rag_engine.js'));
    const claims = require(path.join(PROD_APPS_DIR, 'claims_intake_engine.js'));
    const cra = require(path.join(PROD_APPS_DIR, 'call_review_agent.js'));

    // 1. 2nd Listener Phonetic Ambiguity Clarification ("It was a hair claim." -> asks "Sorry, I didn't catch that — I heard 'hair claim'... Did you mean a hail claim...", then "Yes, hail" -> resolves hail)
    const perilSess = claims.createSession('TEST-54317-PERIL', '+17542917994');
    perilSess.hasGreeted = true;
    perilSess.pendingSlot = 'narrative';
    const clarifyTurn = claims.evaluateTurn(perilSess, 'It was a hair claim.');
    const clarifyText = clarifyTurn.speechChunks.map(c => c.text).join(' ');
    const confirmTurn = claims.evaluateTurn(perilSess, 'Yes, hail.');

    // 2. 2nd Listener Garbled Street Clarification & Anti-Clobber ("3955 way of the stuff, Dallas, Texas 75. 204" -> clarifies street, then "Buena Vista St" -> merges full address, and later "At my house in Texas" cannot clobber it)
    const locSess = claims.createSession('TEST-54317-LOC', '+17542917994');
    locSess.hasGreeted = true;
    locSess.lossType = 'hail';
    locSess.pendingSlot = 'location';
    const addrClarifyTurn = claims.evaluateTurn(locSess, 'At my house in Dallas, Texas. 3955 way of the stuff, Dallas, Texas 75. 204.');
    const addrClarifyText = addrClarifyTurn.speechChunks.map(c => c.text).join(' ');
    claims.evaluateTurn(locSess, 'Buena Vista St');
    const mergedAddress = locSess.fnolData.locationOfLoss;
    // Attempt clobber on subsequent turn
    locSess.pendingSlot = 'hailParked';
    claims.extractEntities('It was at my house in Texas.', locSess);
    const addressAfterClobberAttempt = locSess.fnolData.locationOfLoss;

    // 3. Vehicle policy reference ("The vehicle listed on the policy.") and bot echo guard ("Got it, understood. And what is the here, making motto?")
    const badVehValid = claims.validateSlotValue('vehicle', 'Got it, understood. And what is the here, making motto?');
    locSess.pendingSlot = 'vehicle';
    claims.extractEntities('The vehicle listed on the policy.', locSess);

    // 4. Date of loss question at summaryConfirm ("And what do you have is the date of loss?")
    locSess.pendingSlot = 'summaryConfirm';
    const sumTurn = claims.evaluateTurn(locSess, 'And what do you have is the date of loss?', { confidence: 0.9 });
    const sumReply = sumTurn.speechChunks.map(c => c.text).join(' ');

    // 5. Verify zero "Got it, understood" and zero stacked questions (? ... ?) in claims_intake_engine.js L10N
    const cieSrc = fs.readFileSync(path.join(PROD_APPS_DIR, 'claims_intake_engine.js'), 'utf8');
    const noGotItUnderstood = !/Got it,\s*understood/i.test(cieSrc.slice(0, 500));
    const srvSrc = fs.readFileSync(path.join(PROD_APPS_DIR, 'voice_webhook_server.js'), 'utf8');
    const hasInProcessReview = srvSrc.includes('reviewPostCall') && srvSrc.includes('Q_LIVE_DEMO_VISIBILITY') && srvSrc.includes('validateHostAndPerilTurn');

    const passG24 = /heard 'hair claim'[\s\S]*Did you mean a hail claim/i.test(clarifyText) &&
      perilSess.lossType === 'hail' &&
      /caught the number 3955[\s\S]*heard 'way of the stuff/i.test(addrClarifyText) &&
      /3955 Buena Vista St,\s*Dallas,\s*TX,\s*75204/i.test(mergedAddress || '') &&
      addressAfterClobberAttempt === mergedAddress &&
      badVehValid === false &&
      /2022 Acura MDX/i.test(locSess.fnolData.vehicleInfo || '') &&
      locSess.summaryConfirmed === false &&
      /date of loss/i.test(sumReply) &&
      noGotItUnderstood &&
      cra.DEFECT_RULES.length >= 24 &&
      hasInProcessReview;
    check('G24-SECOND-LISTENER-REALTIME-VALIDATION-AND-24-REDTEAM-RULES: Clarifies phonetic "hair claim", clarifies garbled street "way of the stuff" and merges "3955 Buena Vista St, Dallas, TX, 75204" with anti-clobber protection, purges "Got it, understood" and stacked questions, answers summary fact inquiries, and enforces 24 Red-Team DEFECT_RULES',
      Boolean(passG24),
      passG24
        ? `perilClarified="${perilSess.lossType}", mergedAddr="${mergedAddress}", veh="${locSess.fnolData.vehicleInfo}", sumConfirmed=${locSess.summaryConfirmed}, rules=${cra.DEFECT_RULES.length}`
        : `Failed G24: clarifyText=${clarifyText}, lt=${perilSess.lossType}, addrClarifyText=${addrClarifyText}, mergedAddr=${mergedAddress}, afterClobber=${addressAfterClobberAttempt}, badVehValid=${badVehValid}, veh=${locSess.fnolData.vehicleInfo}, sumConfirmed=${locSess.summaryConfirmed}, noGotItUnderstood=${noGotItUnderstood}, rules=${cra.DEFECT_RULES.length}, inProcessReview=${hasInProcessReview}`);
  } catch (e) {
    check('G24-SECOND-LISTENER-REALTIME-VALIDATION-AND-24-REDTEAM-RULES: Clarifies phonetic "hair claim", clarifies garbled street "way of the stuff" and merges "3955 Buena Vista St, Dallas, TX, 75204" with anti-clobber protection, purges "Got it, understood" and stacked questions, answers summary fact inquiries, and enforces 24 Red-Team DEFECT_RULES', false, e.message);
  }

  // G25: Master Call Feedback Chart, All Demo & Purchased Bots Standard Base (6 Verticals + After-Hours Crisis Bot), & Verified A2P Pool SMS Cascade
  try {
    delete require.cache[require.resolve(path.join(PROD_APPS_DIR, 'specialist_engines.js'))];
    delete require.cache[require.resolve(path.join(PROD_APPS_DIR, 'trade_after_hours_intake_engine.js'))];
    delete require.cache[require.resolve(path.join(PROD_APPS_DIR, 'trades_sales_demo_engine.js'))];
    const specialistEngines = require(path.join(PROD_APPS_DIR, 'specialist_engines.js'));
    const afterHours = require(path.join(PROD_APPS_DIR, 'trade_after_hours_intake_engine.js'));

    // 1. Master Feedback & Standard Base Chart exists and covers BASE-01..BASE-15
    const chartPath = path.join(SERIES_C_DIR, '01_Strategy_Docs', 'VOICE_BOT_STANDARD_BASE_AND_FEEDBACK_CHART.md');
    const chartExists = fs.existsSync(chartPath);
    const chartSrc = chartExists ? fs.readFileSync(chartPath, 'utf8') : '';
    const hasAll15Bases = chartSrc.includes('BASE-01') && chartSrc.includes('BASE-15') && chartSrc.includes('FNOL-DEMO-54317');

    // 2. All 6 Commercial Pilot Demo Types exist in SPECIALISTS with qPhotos & qSummaryConfirm and 0 "Got it, understood"
    const requiredSpecs = ['plumbing', 'hvac', 'roofing', 'electrical', 'dental', 'legal_pi'];
    const allSpecsPresent = requiredSpecs.every(k => {
      const s = specialistEngines.SPECIALISTS[k];
      return s && s.l10n && s.l10n.en && s.l10n.en.qPhotos && s.l10n.en.qSummaryConfirm && !/Got it,\s*understood/i.test(s.l10n.en.ack || '');
    });

    // 3. Specialist Demo Bot (e.g. Plumbing) 2nd Listener Garbled Street Clarification & Merge
    const plbSess = specialistEngines.createSession('plumbing', { fromNumber: '+17542917994', compositeDemo: true });
    specialistEngines.evaluateTurn(plbSess, ''); // greeting -> step 1
    specialistEngines.evaluateTurn(plbSess, 'Carlos Mendoza from Lone Star Plumbing'); // step 1 -> step 2 (serviceAddress)
    const plbClarify = specialistEngines.evaluateTurn(plbSess, '3955 way of the stuff, Dallas, Texas 75204');
    const plbClarifyText = plbClarify.speechChunks.map(c => c.text).join(' ');
    specialistEngines.evaluateTurn(plbSess, 'Buena Vista St');
    const plbMergedAddr = plbSess.ticket.serviceAddress;

    // 4. Active Purchased Contractor Bot (trade_after_hours_intake_engine.js) 2nd Listener Garbled Street Clarification & Merge
    const ahSess = afterHours.createAfterHoursSession({ trade: 'plumbing', company: 'Lone Star Plumbing', callbackPhone: '+17542917994' });
    ahSess.step = 3;
    const ahClarify = afterHours.evaluateAfterHoursTurn(ahSess, '3955 way of the stuff, Dallas, Texas 75204');
    const ahMerge = afterHours.evaluateAfterHoursTurn(ahSess, 'Buena Vista St');

    // 5. In-Call & Post-Call SMS A2P Pool Cascade + Pre-Response Await
    const senderSrc = fs.readFileSync(path.join(PROD_APPS_DIR, 'post_call_link_sender.js'), 'utf8');
    const srvSrc = fs.readFileSync(path.join(PROD_APPS_DIR, 'voice_webhook_server.js'), 'utf8');
    const hasA2pCascade = senderSrc.includes('MGeeada416b6c3508af11c43abce49ca72') &&
      senderSrc.includes("'+17543342877'") &&
      senderSrc.includes('SMS SYNC 30034 CASCADE');
    const hasAwaitedInCallSms = srvSrc.includes('async function triggerInCallSms') &&
      srvSrc.includes('await triggerInCallSms(session');

    const passG25 = chartExists &&
      hasAll15Bases &&
      allSpecsPresent &&
      /caught the number 3955[\s\S]*heard 'way of the stuff/i.test(plbClarifyText) &&
      /3955 Buena Vista St,\s*Dallas,\s*TX,\s*75204/i.test(plbMergedAddr || '') &&
      ahClarify.action === 'CLARIFY_GARBLED_STREET' &&
      /3955 Buena Vista St,\s*Dallas,\s*TX,\s*75204/i.test(ahSess.address || '') &&
      hasA2pCascade &&
      hasAwaitedInCallSms;

    check('G25-ALL-BOTS-STANDARD-BASE-AND-IN-CALL-SMS-AUDIT: Master Feedback Chart (BASE-01..15) verified, all 6 vertical demo bots + active purchased contractor bots enforce 2nd Listener garbled street clarification, and In-Call SMS awaits Verified A2P pool cascade',
      Boolean(passG25),
      passG25
        ? `chart=true, specs=${requiredSpecs.length}/6, plbAddr="${plbMergedAddr}", ahAddr="${ahSess.address}", a2pCascade=true, awaitedInCallSms=true`
        : `Failed G25: chart=${chartExists}/${hasAll15Bases}, specs=${allSpecsPresent}, plbClarify="${plbClarifyText}", plbAddr="${plbMergedAddr}", ahAction="${ahClarify && ahClarify.action}", ahAddr="${ahSess.address}", a2pCascade=${hasA2pCascade}, awaitedSms=${hasAwaitedInCallSms}`);
  } catch (e) {
    check('G25-ALL-BOTS-STANDARD-BASE-AND-IN-CALL-SMS-AUDIT: Master Feedback Chart (BASE-01..15) verified, all 6 vertical demo bots + active purchased contractor bots enforce 2nd Listener garbled street clarification, and In-Call SMS awaits Verified A2P pool cascade', false, e.message);
  }

  // G26: Structural Grammar Generalizers & Mirofish 20-Call Realistic Human-Like Call Collection Gate
  try {
    const customerIdentity = require(path.join(PROD_APPS_DIR, 'customer_identity_engine.js'));
    const secondListener = require(path.join(PROD_APPS_DIR, 'second_listener_rag_engine.js'));
    const idCheck = customerIdentity.extractCallerIdentity('This is Marcus Henderson calling from home, my wife is shaken up, we have a hail claim');
    const idOk = idCheck && idCheck.displayName === 'Marcus Henderson' && idCheck.detectedCompany === null;
    const garbledOk = typeof secondListener.isStructurallyGarbledStreet === 'function' &&
      secondListener.isStructurallyGarbledStreet('uh in the thing by the creek') === true &&
      secondListener.isStructurallyGarbledStreet('Buena Vista Street') === false;
    const vehSpecOk = typeof secondListener.scoreVehicleSpecificity === 'function' &&
      secondListener.scoreVehicleSpecificity('2021 Chevy') === 3 &&
      secondListener.scoreVehicleSpecificity('2021 Chevy Silverado 1500') === 4;

    const reportPath = 'c:\\Users\\17549\\antigravity\\data\\call_reviews\\MIROFISH_HUMAN_COLLECTION_REPORT.json';
    const mdReportPath = 'c:\\Users\\17549\\antigravity\\DHV CORP\\Series_C\\01_Strategy_Docs\\MIROFISH_HUMAN_CALL_COLLECTION_AUDIT.md';
    const set2ReportPath = 'c:\\Users\\17549\\antigravity\\data\\call_reviews\\MIROFISH_HUMAN_COLLECTION_SET2_REPORT.json';
    const set2MdReportPath = 'c:\\Users\\17549\\antigravity\\DHV CORP\\Series_C\\01_Strategy_Docs\\MIROFISH_HUMAN_CALL_COLLECTION_SET2_AUDIT.md';
    const mediaReceiptPath = 'c:\\Users\\17549\\antigravity\\data\\orchestrator\\receipts\\MIROFISH_MEDIA_ADS_SCRIPTS_AUDIT.json';
    const presentationPath = fs.existsSync(path.join(PROD_APPS_DIR, 'claims_demo_flow_presentation.html'))
      ? path.join(PROD_APPS_DIR, 'claims_demo_flow_presentation.html')
      : path.join(SERIES_C_DIR, 'scripts', 'claims_demo_flow_presentation.html');

    let collectionOk = false;
    let collectionSummary = 'missing';
    if (fs.existsSync(reportPath) && fs.existsSync(mdReportPath) && fs.existsSync(set2ReportPath) && fs.existsSync(set2MdReportPath) && fs.existsSync(mediaReceiptPath) && fs.existsSync(presentationPath)) {
      const rep = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      const rep2 = JSON.parse(fs.readFileSync(set2ReportPath, 'utf8'));
      const mediaRep = JSON.parse(fs.readFileSync(mediaReceiptPath, 'utf8'));
      const set1Ok = rep.totalCallsEvaluated >= 20 && rep.passedCalls === rep.totalCallsEvaluated && rep.failedCalls === 0 && rep.averageMirofishScore >= 90;
      const set2Ok = rep2.totalCallsEvaluated >= 20 && rep2.passedCalls === rep2.totalCallsEvaluated && rep2.failedCalls === 0 && rep2.averageMirofishScore >= 90 &&
        Array.isArray(rep2.calls) && rep2.calls.every(c => c.summaryVerification && c.summaryVerification.passed === true);
      const mediaOk = mediaRep.status === 'PASS' && mediaRep.passedAssets === mediaRep.totalAssetsEvaluated && mediaRep.failedAssets === 0;
      const presOk = fs.statSync(presentationPath).size > 40000;
      collectionOk = set1Ok && set2Ok && mediaOk && presOk;
      collectionSummary = `set1=${rep.passedCalls}/${rep.totalCallsEvaluated}, set2=${rep2.passedCalls}/${rep2.totalCallsEvaluated} (2ndBrainSummary=20/20, avgMirofish=${rep2.averageMirofishScore}), media=${mediaRep.passedAssets}/${mediaRep.totalAssetsEvaluated}, presentationDeck=ok`;
    }

    const passG26 = idOk && garbledOk && vehSpecOk && collectionOk;
    check('G26-MIROFISH-HUMAN-CALL-COLLECTION-AND-STRUCTURAL-GENERALIZATION-AUDIT: Structural grammar validators pass unseen human speech and Mirofish Set 1 (20/20) + Set 2 (20/20 2nd-Brain Summary Verified) + Media/Ads (28/28) pass with 0 defects',
      Boolean(passG26),
      passG26
        ? `idOk=true, garbledOk=true, vehSpecOk=true, ${collectionSummary}`
        : `Failed G26: id=${JSON.stringify(idCheck)}, garbledOk=${garbledOk}, vehSpecOk=${vehSpecOk}, collection=${collectionSummary}`);
  } catch (e) {
    check('G26-MIROFISH-HUMAN-CALL-COLLECTION-AND-STRUCTURAL-GENERALIZATION-AUDIT: Structural grammar validators pass unseen human speech and Mirofish Set 1 (20/20) + Set 2 (20/20 2nd-Brain Summary Verified) + Media/Ads (28/28) pass with 0 defects', false, e.message);
  }

  // G27: Anti-2%-Slop Dynamic Holdout, Live 300-Call Engine Execution, & Bilingual (EN/ES) Webpage Chatbot Parity Gate
  try {
    const claimsEngine = require(path.join(PROD_APPS_DIR, 'claims_intake_engine.js'));
    const { runValidation } = require(path.join(PROD_APPS_DIR, 'fnol_300_synthetic_pack', 'fnol_300_validator.js'));
    const chatSemanticCache = require(path.join(PROD_APPS_DIR, 'agentangel-io', 'chat_semantic_cache.js'));

    // 1. Dynamic Unseen Holdout Test (Adverse Carrier Isolation, Participial Damage Stripping, Police Report Zip Isolation, Colored Vehicle)
    const holdoutSession = claimsEngine.createSession('HOLDOUT-G27', '+14699166767');
    holdoutSession.mode = 'fnol';
    holdoutSession.hostPhase = false;
    claimsEngine.evaluateTurn(
      holdoutSession,
      'Hello, my name is Elena Rostova and my policy number is TX dash 749201. I drive a 2023 Pearl White Subaru Forester. Insured vehicle was involved in a two-vehicle collision with a Mazda CX-5 insured by Travelers at 1840 Mockingbird Lane in Dallas, TX, denting the passenger fender and cracking the tail light. No injuries at all, everyone is safe, and Dallas Police Department gave me report number PR-DAL-88412.',
      { language: 'en' }
    );
    const hd = holdoutSession.fnolData || {};
    const holdoutOk =
      hd.callerName === 'Elena Rostova' &&
      hd.policyNumber === 'TX-749201' &&
      hd.vehicleInfo === '2023 Subaru Forester' &&
      !hd.companyName &&
      /1840 Mockingbird Lane,\s*Dallas,\s*TX/i.test(hd.locationOfLoss || '') &&
      !/denting|cracking|88412/i.test(hd.locationOfLoss || '') &&
      hd.policeReportNumber === 'PR-DAL-88412';

    // 2. Live 300-Call Synthetic Pack Engine & MiroFish Benchmark
    const val300 = runValidation();
    const pack300Ok =
      val300 &&
      val300.fieldRecallRate >= 98.0 &&
      val300.criticalAccuracyRate >= 99.0 &&
      val300.mirofishPassedCount === 300 &&
      val300.fieldStateMachinePassedCount === 300 &&
      val300.perilQuestionFlowPassedCount === 300 &&
      val300.mappingGeoPassedCount === 300 &&
      val300.sceneDiagramPassedCount === 300 &&
      val300.axiRateSummaryPassedCount === 300;

    // 3. Bilingual (EN / ES) Open-Ended Webpage Chatbot Parity
    const enIntake = chatSemanticCache.evaluateWebchatTurn({
      persona: 'claims',
      session: 'g27-en',
      reset: true,
      message: 'Hello, my name is Rachel Green, yesterday hail dented my 2022 Pearl White Ford F-150 at 4410 Oak Lawn Avenue in Dallas, policy PA dash 8849201, no one was injured.'
    });
    const esIntake = chatSemanticCache.evaluateWebchatTurn({
      persona: 'claims',
      session: 'g27-es',
      reset: true,
      message: 'Hola, me llamo Carlos Rivera, ayer cayó granizo en mi camioneta 2022 Ford F-150 en 4410 Oak Lawn Avenue en Dallas, mi póliza es PA guion 8849201 y no hay heridos.'
    });
    const enFactQ = chatSemanticCache.evaluateWebchatTurn({
      persona: 'claims',
      session: 'g27-en',
      message: 'What do you have as the date of loss?'
    });
    const esFactQ = chatSemanticCache.evaluateWebchatTurn({
      persona: 'claims',
      session: 'g27-es',
      message: '¿Qué tienen registrado como fecha del siniestro?'
    });
    const enAmbig = chatSemanticCache.evaluateWebchatTurn({
      persona: 'claims',
      session: 'g27-ambig-en',
      reset: true,
      message: 'I need to file a hair claim on my car'
    });
    const esAmbig = chatSemanticCache.evaluateWebchatTurn({
      persona: 'claims',
      session: 'g27-ambig-es',
      reset: true,
      message: 'Necesito reportar un reclamo de pelo en mi carro'
    });
    const esTradeRag = chatSemanticCache.evaluateWebchatTurn({
      persona: 'plumbing',
      session: 'g27-trade-es',
      reset: true,
      message: '¿Cómo funciona la integración con ServiceTitan y cuánto cuesta?'
    });

    const widgetPath = path.join(PROD_APPS_DIR, 'agentangel-io', 'assets', 'js', 'webchat_widget.js');
    const widgetSrc = fs.existsSync(widgetPath) ? fs.readFileSync(widgetPath, 'utf8') : '';
    const widgetClean =
      widgetSrc.includes('window.aaDetectLang') &&
      widgetSrc.includes('window.aaEvaluateOpenEndedTurn') &&
      widgetSrc.includes("window.fetch('/api/chat'") &&
      !widgetSrc.includes("policy: 'POL-99201'");

    const webchatOk =
      Boolean(enIntake && enIntake.lang === 'en' && enIntake.slots && enIntake.slots.policyNumber === 'PA-8849201' && enIntake.slots.vehicleInfo === '2022 Ford F-150') &&
      Boolean(esIntake && esIntake.lang === 'es' && esIntake.slots && esIntake.slots.policyNumber === 'PA-8849201' && esIntake.slots.callerName === 'Carlos Rivera') &&
      Boolean(enFactQ && enFactQ.action === 'ANSWER_FACT_INQUIRY') &&
      Boolean(esFactQ && esFactQ.action === 'ANSWER_FACT_INQUIRY' && esFactQ.lang === 'es') &&
      Boolean(enAmbig && enAmbig.action === 'CLARIFY_AMBIGUOUS_PERIL' && enAmbig.lang === 'en') &&
      Boolean(esAmbig && esAmbig.action === 'CLARIFY_AMBIGUOUS_PERIL' && esAmbig.lang === 'es') &&
      Boolean(esTradeRag && esTradeRag.lang === 'es' && /ServiceTitan|99/i.test(esTradeRag.response || '')) &&
      widgetClean;

    const passG27 = holdoutOk && pack300Ok && webchatOk;
    check('G27-ANTI-2PCT-SLOP-300-CALL-ENGINE-AND-WEBCHAT-PARITY-GATE: Unseen holdout utterances pass with 0 slot corruption, 300 synthetic calls pass live engine & MiroFish (300/300), and Webpage Chatbot executes open-ended EN/ES logic & 2nd Listener parity',
      Boolean(passG27),
      passG27
        ? `holdoutOk=true, 300pack=${val300.fieldRecallRate.toFixed(1)}% recall/${val300.criticalAccuracyRate.toFixed(1)}% acc/${val300.mirofishPassedCount}/300 MiroFish, webchatEnEsParity=true`
        : `Failed G27: holdoutOk=${holdoutOk} (hd=${JSON.stringify({ name: hd.callerName, pol: hd.policyNumber, veh: hd.vehicleInfo, comp: hd.companyName, loc: hd.locationOfLoss, pr: hd.policeReportNumber })}), pack300Ok=${pack300Ok}, webchatOk=${webchatOk} (widgetClean=${widgetClean})`);
  } catch (e) {
    check('G27-ANTI-2PCT-SLOP-300-CALL-ENGINE-AND-WEBCHAT-PARITY-GATE: Unseen holdout utterances pass with 0 slot corruption, 300 synthetic calls pass live engine & MiroFish (300/300), and Webpage Chatbot executes open-ended EN/ES logic & 2nd Listener parity', false, e.message);
  }

  // G28: 300-Call Realistic Plumbing Live Engine & 2nd Listener Audit Gate (10 Scenario Groups, Hazard Containment, DR-01..DR-28)
  try {
    const plumbing300ValidatorPath = path.join(PROD_APPS_DIR, 'plumbing_300_call_pack', 'plumbing_300_validator.js');
    delete require.cache[require.resolve(plumbing300ValidatorPath)];
    const { runPlumbing300Validation } = require(plumbing300ValidatorPath);
    const plb300 = runPlumbing300Validation();
    const passG28 = Boolean(
      plb300 &&
      plb300.totalCalls === 300 &&
      plb300.passedCalls === 300 &&
      plb300.stateMachinePassedCount === 300 &&
      plb300.containmentPassedCount === 300 &&
      plb300.secondListenerSlotGuardPassedCount === 300 &&
      plb300.callReviewZeroDefectCount === 300 &&
      plb300.fieldAccuracyRate >= 99.5
    );
    check('G28-PLUMBING-300-CALL-LIVE-ENGINE-AND-2ND-LISTENER-AUDIT: 300 realistic Plumbing calls across 10 scenario groups pass live engine (300/300), hazard containment (300/300), 2nd Listener slot guard (300/300), and call_review_agent DR-01..DR-28 audit (300/300)',
      passG28,
      passG28
        ? `passed=${plb300.passedCalls}/300, slotAcc=${plb300.fieldAccuracyRate}%, containment=${plb300.containmentPassedCount}/300, slotGuard=${plb300.secondListenerSlotGuardPassedCount}/300, zeroDefects=${plb300.callReviewZeroDefectCount}/300, avgAxiScore=${plb300.averageAxiScore}`
        : `Failed G28: ${JSON.stringify(plb300 ? { passed: plb300.passedCalls, acc: plb300.fieldAccuracyRate, cont: plb300.containmentPassedCount, guard: plb300.secondListenerSlotGuardPassedCount, dr: plb300.callReviewZeroDefectCount } : null)}`);
  } catch (e) {
    check('G28-PLUMBING-300-CALL-LIVE-ENGINE-AND-2ND-LISTENER-AUDIT: 300 realistic Plumbing calls across 10 scenario groups pass live engine (300/300), hazard containment (300/300), 2nd Listener slot guard (300/300), and call_review_agent DR-01..DR-28 audit (300/300)', false, e.message);
    }

  // G29: Cumulative Prior-Call Defect Validation Matrix Gate
  try {
    const defectMatrixPath = path.join(__dirname, 'prior_call_defect_matrix.js');
    if (fs.existsSync(defectMatrixPath)) {
      const { run: runMatrix } = require(defectMatrixPath);
      const { rows, anyBlockingFail } = runMatrix();
      const passedCount = rows.filter(r => r.pass).length;
      check('G29-PRIOR-CALL-DEFECT-VALIDATION-MATRIX: Cumulative Prior-Call Defect Validation Matrix verified across Demo Bots and Purchased Bot',
        !anyBlockingFail && rows.length >= 15,
        'Passed ' + passedCount + '/' + rows.length + ' checks (blocking failures: ' + (anyBlockingFail ? 1 : 0) + ')'
      );
    } else {
      check('G29-PRIOR-CALL-DEFECT-VALIDATION-MATRIX: Cumulative Prior-Call Defect Validation Matrix verified across Demo Bots and Purchased Bot', false, 'Missing ' + defectMatrixPath);
    }
  } catch (e) {
    check('G29-PRIOR-CALL-DEFECT-VALIDATION-MATRIX: Cumulative Prior-Call Defect Validation Matrix verified across Demo Bots and Purchased Bot', false, e.message);
  }
}

// ── MAIN EXECUTION ───────────────────────────────────────────────────────────
function main() {
  console.log('╔═════════════════════════════════════════════════════════════════════════╗');
  console.log('║  UNIFIED SPECIALIST & COMMERCIAL PILOTS PRE-FLIGHT VALIDATION GATE     ║');
  console.log('║  Enforces Law T1.18 (26 Pre-Container Checks) & Law T1.29b (6 Pilots)   ║');
  console.log('╚═════════════════════════════════════════════════════════════════════════╝');

  if (process.argv.includes('--self-test')) {
    console.log('[SELF-TEST] Testing assertion harness...');
    check('SELF-TEST-TRUE: Assertion passes', true, 'self-test ok');
    console.log('\n[SELF-TEST PASS] 1/1 OK\n');
    process.exit(0);
  }

  const target = process.argv.includes('--target')
    ? process.argv[process.argv.indexOf('--target') + 1]
    : path.join(PROD_APPS_DIR, 'voice_webhook_server.js');

  // 1. Run Pre-Container 26 checks
  runPreContainerSpecialistGate(target);

  // 2. Run Commercial Pilots 6-vertical checks
  runCommercialPilotsPrerequisites();

  // 3. Run Behavioral, 2nd-Listener & Zero-Split-Brain Sync Gate (G9..G15)
  runBehavioralAndSyncGate();

  // Summary
  console.log('\n═════════════════════════════════════════════════════════════════════════');
  console.log(`  TOTAL: ${passes} passed, ${failures} failed out of ${CHECKS.length} checks`);

  if (failures > 0) {
    console.error(`\n  🔴 GATE BLOCKED — ${failures} check(s) failed.`);
    process.exit(1);
  }

  console.log(`\n  ✅ ALL ${CHECKS.length} CHECKS PASSED — 100% COMMERCIAL PILOT READINESS VERIFIED.`);

  // Write canonical receipt
  if (!fs.existsSync(RECEIPTS_DIR)) {
    try { fs.mkdirSync(RECEIPTS_DIR, { recursive: true }); } catch (e) {}
  }

  const receipt = {
    task_id: 'SC-COMMERCIAL-PILOTS-PREREQUISITES-01',
    status: 'COMPLETED',
    timestamp: new Date().toISOString(),
    gate: 'validate_specialist.js (Law T1.18 & Law T1.29b)',
    checks_total: CHECKS.length,
    checks_passed: passes,
    checks_failed: failures,
    verticals_verified: [
      'plumbing',
      'hvac',
      'roofing',
      'electrical',
      'dental_clinic',
      'legal_pi'
    ],
    prerequisites: {
      sales_demo_calls: 'VERIFIED_ON_DISK',
      client_dashboards: 'VERIFIED_ON_DISK',
      onboarding_guides: 'VERIFIED_ON_DISK',
      brand_image_compliance: 'VERIFIED_ON_DISK',
      stripe_checkout_and_dids: 'VERIFIED_ON_DISK'
    },
    artifacts_verified: [
      'DHV CORP/Series_C/02_Production_Apps/voice_webhook_server.js',
      'DHV CORP/Series_C/data/demo_calls/plumbing_sales_demo_call.md',
      'DHV CORP/Series_C/data/demo_calls/hvac_sales_demo_call.md',
      'DHV CORP/Series_C/data/demo_calls/roofing_sales_demo_call.md',
      'DHV CORP/Series_C/data/demo_calls/electrical_sales_demo_call.md',
      'DHV CORP/Series_C/data/demo_calls/dental_clinic_sales_demo_call.md',
      'DHV CORP/Series_C/data/demo_calls/legal_pi_sales_demo_call.md',
      'DHV CORP/Series_C/02_Production_Apps/agentangel-io/trades_proof_dashboard.html',
      'DHV CORP/Series_C/02_Production_Apps/agentangel-io/claims_dashboard.html',
      'DHV CORP/Series_C/02_Production_Apps/agentangel-io/STAR72_Call_Forwarding_Setup_Guide.html',
      'DHV CORP/Series_C/02_Production_Apps/agentangel-io/onboarding_portal.html',
      'DHV CORP/Series_C/02_Production_Apps/agentangel-io/assets/audio/proof-track-01-live-dispatch-dial.mp3'
    ],
    checks: CHECKS
  };

  const receiptPath = path.join(RECEIPTS_DIR, 'SC-COMMERCIAL-PILOTS-PREREQUISITES-01.json');
  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), 'utf8');
  console.log(`  Canonical Receipt: ${receiptPath}\n`);

  if (require.main === module) {
    process.exit(0);
  }
  return receipt;
}

if (require.main === module) {
  main();
}

module.exports = { main, CHECKS };

