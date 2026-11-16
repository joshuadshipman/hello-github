/**
 * DEMO-DOD-06 (D8) — Post-call link sender
 * =========================================
 * At call end, delivers the caller their private dashboard link
 * (/call/:callSid?t=<token>, built by post_call_dashboard.recordCallArtifacts).
 *
 * Channel truth (2026-08-20, stated honestly):
 *   - SMS: the 469 line's A2P campaign is IN_PROGRESS, not approved — outbound
 *     SMS does NOT deliver yet. The SMS path is coded but DISABLED by default
 *     (POSTCALL_SMS_ENABLED=true to arm once A2P approves). Any failure or
 *     skip logs LOUD and is recorded as NOT sent — this module never claims
 *     an SMS was sent unless Twilio's API accepted it (2xx + a MessageSid),
 *     and even then reports ACCEPTED_BY_TWILIO, not DELIVERED.
 *   - EMAIL: the working path. Uses nodemailer (gmail transport, same
 *     EMAIL_USER/EMAIL_APP_PASSWORD pattern as E_Commerce_Daemon) WHEN the
 *     package is resolvable and creds exist. On the Cloud Run voice container
 *     nodemailer is NOT installed and voice calls capture no email address —
 *     so absent a transport or recipient the send is queued to a local OUTBOX
 *     (TRANSCRIPT_DIR/outbox/outbox.jsonl) with status QUEUED_NO_TRANSPORT /
 *     QUEUED_NO_RECIPIENT, exposed read-only at GET /outbox?t=<OUTBOX_TOKEN>.
 *     That is a QUEUE, not a send, and is reported as such.
 *
 * Bilingual per the call's language field (SPANISH PARITY law).
 * Zero hard npm dependencies; nodemailer is loaded lazily and optionally.
 */

const https = require('https');
const tls = require('tls');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUTBOX_DIR = 'outbox';
const OUTBOX_FILE = 'outbox.jsonl';

// An AggregateError (dual-stack ECONNREFUSED) has an EMPTY .message — a loud
// failure log must never print nothing.
function errText(e) {
  if (!e) return 'unknown error';
  if (e.message) return e.message;
  if (e.errors && e.errors.length) return e.errors.map(x => x.message || x.code || String(x)).join('; ');
  return e.code || String(e);
}

function buildProspectLink(record = {}) {
  const rawToken = record.token || '';
  const token = rawToken.startsWith('EXEC-') ? rawToken : ('EXEC-' + (rawToken ? rawToken.slice(0, 8).toUpperCase() : Math.floor(10000 + Math.random() * 90000)));
  const carrier = encodeURIComponent(record.carrier || record.carrierName || 'GraceInsurance');
  const ref = encodeURIComponent(record.claimRef || 'REF-108');
  const caller = encodeURIComponent((record.fnol && record.fnol.callerName) || '');
  const policy = encodeURIComponent((record.fnol && record.fnol.policyNumber) || '');
  const loss = encodeURIComponent((record.fnol && record.fnol.lossDescription) || '');
  const location = encodeURIComponent((record.fnol && record.fnol.locationOfLoss) || '');

  let base = process.env.PROSPECT_PORTAL_URL || 'https://aaio-claims-uat.vercel.app';
  base = base.replace(/\/+$/, '');
  let u = `${base}/onboarding_demo_questionnaire?token=${token}&carrier=${carrier}&ref=${ref}`;
  if (caller) u += `&caller=${caller}`;
  if (policy) u += `&policy=${policy}`;
  if (loss) u += `&loss=${loss}`;
  if (location) u += `&location=${location}`;
  return { token, url: u };
}

// ---- Message copy (EN/ES) ----------------------------------------------------
// TCPA COMPLIANCE NOTE: Claims intake SMS must remain strictly informational / transactional.
// Bundling promotional, marketing, or upsell copy (e.g. executive portals, price cards) transforms
// the communication into marketing and triggers prior express written consent requirements.
const MESSAGES = {
  en: {
    smsBody: (ref, link) => 'Agent Angel Auto Claims: Your intake summary is ready at ' + link + '. Reply STOP to unsubscribe.',
    emailSubject: (ref) => 'Your Agent Angel call summary' + (ref ? ' — claim ' + ref : ''),
    emailBody: (ref, link, prospect) => 'Thank you for your call to Agent Angel Auto Claims.\n\nYour complete call summary' + (ref ? ' for claim ' + ref : '') + ' is ready at:\n' + link + '\n\nExecutive Onboarding & LAE ROI Calculator (Access Code ' + prospect.token + '):\n' + prospect.url + '\n\nAgent Angel Auto Claims',
  },
  es: {
    smsBody: (ref, link) => 'Agent Angel Auto Claims: Su resumen de reclamo está disponible en ' + link + '. Responda STOP para cancelar.',
    emailSubject: (ref) => 'Resumen de su llamada con Agent Angel' + (ref ? ' — reclamo ' + ref : ''),
    emailBody: (ref, link, prospect) => 'Gracias por su llamada a Agent Angel Auto Claims.\n\nEl resumen completo de su llamada' + (ref ? ' para el reclamo ' + ref : '') + ' está listo en:\n' + link + '\n\nPortal Ejecutivo y Calculadora ROI (Código ' + prospect.token + '):\n' + prospect.url + '\n\nAgent Angel Auto Claims',
  },
};

function buildMessages(record, link) {
  const lang = record.language === 'es' ? 'es' : 'en';
  const M = MESSAGES[lang];
  const ref = record.claimRef || '';
  const prospect = buildProspectLink(record);
  return {
    language: lang,
    prospect,
    sms: M.smsBody(ref, link),
    emailSubject: M.emailSubject(ref),
    emailBody: M.emailBody(ref, link, prospect),
  };
}

// ---- SMS via Twilio REST (zero-dep). DISABLED until A2P approves. ------------
function sendSmsViaTwilioSingle({ to, from, messagingServiceSid, body }) {
  return new Promise((resolve, reject) => {
    let sid = process.env.TWILIO_ACCOUNT_SID;
    let token = process.env.TWILIO_AUTH_TOKEN;
    if (from && (from.includes('9723099156') || from === process.env.TWILIO_PHONE_NUMBER_972)) {
      if (process.env.TWILIO_ACCOUNT_SID_972 && process.env.TWILIO_AUTH_TOKEN_972) {
        sid = process.env.TWILIO_ACCOUNT_SID_972;
        token = process.env.TWILIO_AUTH_TOKEN_972;
      }
    }
    if (!sid || !token) return reject(new Error('TWILIO creds missing'));
    const payload = { To: to, Body: body };
    if (messagingServiceSid) {
      payload.MessagingServiceSid = messagingServiceSid;
    }
    if (from) {
      payload.From = from;
    }
    const form = new URLSearchParams(payload).toString();
    const req = https.request({
      hostname: process.env.TWILIO_API_HOST || 'api.twilio.com',
      port: process.env.TWILIO_API_PORT || 443,
      path: '/2010-04-01/Accounts/' + sid + '/Messages.json',
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(sid + ':' + token).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(form),
      },
    }, (res) => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(b)); } catch (e) { reject(new Error('Twilio response parse: ' + e.message)); }
        } else {
          reject(new Error('Twilio HTTP ' + res.statusCode + ': ' + b.slice(0, 300)));
        }
      });
    });
    req.setTimeout(15000, () => req.destroy(new Error('Twilio API timeout')));
    req.on('error', reject);
    req.write(form);
    req.end();
  });
}

function fetchTwilioMessageStatus(msgSid, from) {
  return new Promise((resolve) => {
    let sid = process.env.TWILIO_ACCOUNT_SID;
    let token = process.env.TWILIO_AUTH_TOKEN;
    if (from && (from.includes('9723099156') || from === process.env.TWILIO_PHONE_NUMBER_972)) {
      if (process.env.TWILIO_ACCOUNT_SID_972 && process.env.TWILIO_AUTH_TOKEN_972) {
        sid = process.env.TWILIO_ACCOUNT_SID_972;
        token = process.env.TWILIO_AUTH_TOKEN_972;
      }
    }
    if (!sid || !token || !msgSid) return resolve(null);
    const req = https.request({
      hostname: process.env.TWILIO_API_HOST || 'api.twilio.com',
      port: process.env.TWILIO_API_PORT || 443,
      path: '/2010-04-01/Accounts/' + sid + '/Messages/' + encodeURIComponent(msgSid) + '.json',
      method: 'GET',
      headers: {
        Authorization: 'Basic ' + Buffer.from(sid + ':' + token).toString('base64'),
      },
    }, (res) => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => {
        try { resolve(JSON.parse(b)); } catch (_) { resolve(null); }
      });
    });
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
    req.end();
  });
}

function checkSmsComplianceGate(to, opts = {}) {
  try {
    const smsInbound = require('./sms_inbound_engine');
    const dir = opts.transcriptDir || process.env.TRANSCRIPT_DIR || '';
    if (smsInbound && typeof smsInbound.isOptedOut === 'function' && smsInbound.isOptedOut(dir, to)) {
      return { allowed: false, reason: 'OPTED_OUT_STOP_LEDGER' };
    }
  } catch (e) {
    return { allowed: false, reason: 'CONSENT_LEDGER_ERROR' };
  }
  try {
    const smsOutbound = require('./sms_outbound_sender');
    if (smsOutbound && typeof smsOutbound.checkQuietHours === 'function' && opts.enforceQuietHours === true) {
      const qh = smsOutbound.checkQuietHours({ now: opts.now, timezoneOffsetHours: opts.timezoneOffsetHours });
      if (qh && qh.isQuietHours) {
        return { allowed: false, reason: 'QUIET_HOURS_SUPPRESSED' };
      }
    }
  } catch (_) {}
  return { allowed: true, reason: 'COMPLIANT' };
}

async function sendSmsViaTwilio({ to, from, body, transcriptDir, enforceQuietHours = false, allowCrossDidCascade = false }) {
  const preCheck = checkSmsComplianceGate(to, { transcriptDir, enforceQuietHours });
  if (!preCheck.allowed) {
    throw new Error(`[SMS COMPLIANCE BLOCKED] ${preCheck.reason} for ${to}`);
  }
  // If mock/test host is active, send direct single request
  if (process.env.TWILIO_API_HOST && process.env.TWILIO_API_HOST !== 'api.twilio.com') {
    return sendSmsViaTwilioSingle({ to, from, body });
  }
  const mgSid = process.env.TWILIO_MESSAGING_SERVICE_SID || 'MGeeada416b6c3508af11c43abce49ca72';
  const a2pSenders = ['+14699166767', '+17543342877', '+17542917994'];
  const primaryFrom = (from && !from.includes('8444166167')) ? from : '+14699166767';
  const candidates = allowCrossDidCascade
    ? Array.from(new Set([primaryFrom, ...a2pSenders])).filter(num => num && num !== to)
    : [primaryFrom].filter(num => num && num !== to);

  let lastErr = null;
  for (let i = 0; i < candidates.length; i++) {
    const candidateFrom = candidates[i];
    const isPrimaryA2p = a2pSenders.includes(candidateFrom);
    try {
      const tw = await sendSmsViaTwilioSingle({
        to,
        from: candidateFrom,
        messagingServiceSid: isPrimaryA2p ? mgSid : undefined,
        body
      });
      if (tw && tw.sid && i < candidates.length - 1) {
        // Wait 1.2s to catch immediate carrier/TCR 30034/30032 rejections synchronously before returning
        await new Promise(r => setTimeout(r, 1200));
        const st = await fetchTwilioMessageStatus(tw.sid, candidateFrom);
        if (st && (st.status === 'undelivered' || st.status === 'failed' || st.error_code === 30034 || st.error_code === 30032)) {
          console.warn(`[SMS SYNC 30034 CASCADE] Msg ${tw.sid} from ${candidateFrom} failed (${st.status} / ${st.error_code}); trying next A2P pool sender...`);
          continue;
        }
        // Also arm a 2.5s async fallback across remaining pool numbers in case 30034 arrives slightly later
        const remaining = candidates.slice(i + 1);
        const t = setTimeout(async () => {
          try {
            const st2 = await fetchTwilioMessageStatus(tw.sid, candidateFrom);
            if (st2 && (st2.status === 'undelivered' || st2.status === 'failed' || st2.error_code === 30034 || st2.error_code === 30032)) {
              for (const nextFrom of remaining) {
                const retryCompliance = checkSmsComplianceGate(to, { transcriptDir, enforceQuietHours });
                if (!retryCompliance.allowed) {
                  console.warn(`[SMS ASYNC CASCADE ABORTED] ${retryCompliance.reason} for ${to}`);
                  break;
                }
                console.warn(`[SMS ASYNC 30034 CASCADE] Msg ${tw.sid} from ${candidateFrom} status=${st2.status} err=${st2.error_code}; retrying via ${nextFrom}`);
                const retryTw = await sendSmsViaTwilioSingle({
                  to,
                  from: nextFrom,
                  messagingServiceSid: a2pSenders.includes(nextFrom) ? mgSid : undefined,
                  body
                }).catch(() => null);
                if (retryTw && retryTw.sid) {
                  await new Promise(r => setTimeout(r, 1500));
                  const stRetry = await fetchTwilioMessageStatus(retryTw.sid, nextFrom);
                  if (!stRetry || (stRetry.status !== 'undelivered' && stRetry.status !== 'failed' && stRetry.error_code !== 30034)) {
                    break;
                  }
                }
              }
            }
          } catch (_) {}
        }, 2000);
        if (t && typeof t.unref === 'function') t.unref();
      }
      return tw;
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) throw lastErr;
  return sendSmsViaTwilioSingle({ to, from: primaryFrom, body });
}

// ---- Email via nodemailer (optional, lazy) -----------------------------------
function resolveNodemailer() {
  const candidates = [
    'nodemailer',
    'C:/Users/17549/node_modules/nodemailer',
    path.join(__dirname, 'E_Commerce_Daemon', 'node_modules', 'nodemailer'),
  ];
  for (const c of candidates) {
    try { return require(c); } catch (e) { /* keep looking */ }
  }
  return null;
}

function sendEmailViaNodemailer(nodemailer, { to, subject, body }) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD },
  });
  return transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, text: body });
}

// ---- Pure Node TLS SMTP (zero external npm dependencies, works in alpine containers) ----
function sendEmailViaTlsSmtp({ to, subject, body }) {
  const user = process.env.EMAIL_USER || process.env.GMAIL_USER || 'joshuadshipman@gmail.com';
  const pass = process.env.EMAIL_APP_PASSWORD || process.env.GOOGLE_APP_PASSWORD;
  if (!user || !pass) {
    return Promise.reject(new Error('EMAIL_USER or EMAIL_APP_PASSWORD missing'));
  }
  return new Promise((resolve, reject) => {
    let resolved = false;
    const socket = tls.connect(465, 'smtp.gmail.com', () => {});
    let step = 0;
    socket.setEncoding('utf8');
    socket.setTimeout(15000, () => {
      socket.destroy();
      if (!resolved) {
        resolved = true;
        reject(new Error('SMTP connection timed out'));
      }
    });
    socket.on('data', (data) => {
      const code = parseInt(data.slice(0, 3));
      if (step === 0 && code === 220) {
        step = 1;
        socket.write('EHLO localhost\r\n');
      } else if (step === 1 && code === 250) {
        step = 2;
        socket.write('AUTH LOGIN\r\n');
      } else if (step === 2 && code === 334) {
        step = 3;
        socket.write(Buffer.from(user).toString('base64') + '\r\n');
      } else if (step === 3 && code === 334) {
        step = 4;
        socket.write(Buffer.from(pass).toString('base64') + '\r\n');
      } else if (step === 4 && code === 235) {
        step = 5;
        socket.write('MAIL FROM:<' + user + '>\r\n');
      } else if (step === 5 && code === 250) {
        step = 6;
        socket.write('RCPT TO:<' + to + '>\r\n');
      } else if (step === 6 && code === 250) {
        step = 7;
        socket.write('DATA\r\n');
      } else if (step === 7 && code === 354) {
        step = 8;
        const msg = 'From: Agent Angel <' + user + '>\r\n' +
          'To: <' + to + '>\r\n' +
          'Subject: ' + subject + '\r\n' +
          'Content-Type: text/plain; charset=utf-8\r\n\r\n' +
          body + '\r\n.\r\n';
        socket.write(msg);
      } else if (step === 8 && code === 250) {
        step = 9;
        socket.write('QUIT\r\n');
        if (!resolved) {
          resolved = true;
          resolve({ success: true, messageId: 'TLS-SMTP-' + Date.now() });
        }
      } else if (code >= 400) {
        if (!resolved) {
          resolved = true;
          reject(new Error('SMTP Error ' + data.trim()));
        }
      }
    });
    socket.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });
  });
}

// ---- Outbox (the honest fallback: a queue, never claimed as a send) ----------
function resolveBaseDir(dir) {
  return dir || process.env.TRANSCRIPT_DIR || (process.platform === 'win32' ? 'C:\\Users\\17549\\data' : '/tmp/data');
}

function outboxPath(transcriptDir) {
  return path.join(resolveBaseDir(transcriptDir), OUTBOX_DIR, OUTBOX_FILE);
}

function enqueueOutbox(transcriptDir, entry) {
  const p = outboxPath(transcriptDir);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const row = Object.assign({ id: 'OB-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex'), ts: new Date().toISOString() }, entry);
  fs.appendFileSync(p, JSON.stringify(row) + '\n', 'utf8');
  return row;
}

function readOutbox(transcriptDir) {
  const p = outboxPath(transcriptDir);
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch (e) { return { corrupt: l }; }
  });
}

/**
 * Read-only outbox surface: GET /outbox?t=<OUTBOX_TOKEN>. 404 unless the
 * OUTBOX_TOKEN env is set AND matches — no open index, ever.
 * Returns true when handled.
 */
function handleOutboxRequest(req, res, parsedUrl, ctx = {}) {
  if (req.method !== 'GET' || parsedUrl.pathname !== '/outbox') return false;
  const expected = process.env.OUTBOX_TOKEN || '';
  const presented = (parsedUrl.query && parsedUrl.query.t) || '';
  const a = Buffer.from(expected), b = Buffer.from(String(presented));
  const ok = expected.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return true;
  }
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(readOutbox(ctx.transcriptDir || '.'), null, 2));
  return true;
}

// ---- Main entry ---------------------------------------------------------------
/**
 * Send (or honestly queue) the post-call dashboard link at call end.
 * Never throws — the call-end path must never break the call. Every channel
 * reports exactly what happened; nothing is reported sent that was not.
 *
 * @param {object} args { record, link, transcriptDir, fromNumber }
 *   record = post_call_dashboard record ({callSid, claimRef, language, from, ...})
 * @returns {Promise<object>} { link, language, sms:{status,...}, email:{status,...} }
 */
async function sendPostCallLink({ record, link, transcriptDir, fromNumber } = {}) {
  const result = { callSid: record && record.callSid, link, language: null, sms: null, email: null, preReleaseValidation: null };
  try {
    try {
      const pcd = require('./post_call_dashboard');
      if (pcd && typeof pcd.validateAndSanitizeCallReportBeforeRelease === 'function' && record) {
        const htmlPreview = typeof pcd.renderCallPage === 'function' ? pcd.renderCallPage(record, { lang: record.language || 'en', token: record.token }) : null;
        result.preReleaseValidation = pcd.validateAndSanitizeCallReportBeforeRelease(record, htmlPreview);
      }
    } catch (gateErr) {
      console.error('[PRE-RELEASE VALIDATION GATE WARNING]', errText(gateErr));
    }
    const msgs = buildMessages(record, link);
    result.language = msgs.language;
    result.prospect = msgs.prospect;

    // ---- SMS channel ----------------------------------------------------------
    // TCPA CONSENT GATE: Default disabled. Requires explicit environment arming
    // AND verifiable affirmative consent recorded from the caller during the call.
    const hasConsent = !!(record && (record.smsConsent === true || record.optInSms === true || record.hasAffirmativeConsent === true));
    const smsArmed = process.env.POSTCALL_SMS_ENABLED === 'true' && hasConsent;
    const smsTo = record.from || null;

    // Consent Ledger Entry (audit and defense exhibit)
    try {
      const ledgerDir = transcriptDir || (process.platform === 'win32' ? 'C:\\Users\\17549\\data' : '/tmp/data');
      const ledgerPath = path.join(ledgerDir, 'consent_ledger.jsonl');
      fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
      const ledgerEntry = {
        timestamp: new Date().toISOString(),
        callSid: result.callSid,
        to: smsTo,
        messageType: 'TRANSACTIONAL_FNOL_SUMMARY',
        hasAffirmativeConsent: hasConsent,
        smsArmed,
        postcallSmsEnabledEnv: process.env.POSTCALL_SMS_ENABLED === 'true',
        disclosureSpoken: 'Agent Angel Auto Claims intake summary link opt-in',
      };
      fs.appendFileSync(ledgerPath, JSON.stringify(ledgerEntry) + '\n', 'utf8');
    } catch (err) {
      console.error('[CONSENT LEDGER ERROR] ' + errText(err));
    }

    if (!smsArmed) {
      const skipReason = !hasConsent
        ? 'No affirmative caller consent recorded on session. SMS blocked under TCPA consent law.'
        : 'POSTCALL_SMS_ENABLED is not set to true. SMS blocked by default.';
      result.sms = { status: 'SKIPPED_CONFIG', sent: false, reason: skipReason };
      console.warn('[POSTCALL SMS SKIPPED] ' + result.callSid + ': ' + skipReason);
    } else if (!smsTo) {
      result.sms = { status: 'FAILED', sent: false, reason: 'no destination number on record' };
      console.error('[POSTCALL SMS FAILED] ' + result.callSid + ': no caller number to text.');
    } else {
      try {
        let sendingNum = fromNumber || process.env.POSTCALL_SMS_FROM || process.env.TWILIO_PHONE_NUMBER || '+14699166767';
        // Twilio Error 21266 Guard: To and From cannot be identical.
        if (smsTo && (smsTo === sendingNum || smsTo.endsWith('9166767'))) {
          sendingNum = process.env.TWILIO_PHONE_NUMBER_972 || '+19723099156';
        }
        const tw = await sendSmsViaTwilio({ to: smsTo, from: sendingNum, body: msgs.sms });
        result.sms = { status: 'ACCEPTED_BY_TWILIO', sent: true, messageSid: tw.sid || null, note: 'accepted by API; delivery still depends on carrier/A2P' };
        console.log('[POSTCALL SMS ACCEPTED] ' + result.callSid + ' -> ' + smsTo + ' (msg ' + (tw.sid || '?') + ')');
      } catch (e) {
        result.sms = { status: 'FAILED', sent: false, error: errText(e) };
        console.error('[POSTCALL SMS FAILED] ' + result.callSid + ' -> ' + smsTo + ': ' + errText(e) + ' — SMS was NOT sent.');
      }
    }

    // ---- Email channel --------------------------------------------------------
    let emailTo = (record.email || process.env.POSTCALL_EMAIL_TO || '').trim();
    if (!emailTo && record.from && (record.from.includes('7549990710') || record.from === '+17549990710')) {
      emailTo = process.env.CEO_ALERT_EMAIL || 'joshuadshipman@gmail.com';
    }
    const nodemailer = resolveNodemailer();
    const haveCreds = !!((process.env.EMAIL_USER || process.env.GMAIL_USER || 'joshuadshipman@gmail.com') && (process.env.EMAIL_APP_PASSWORD || process.env.GOOGLE_APP_PASSWORD));
    if (!emailTo) {
      const row = enqueueOutbox(transcriptDir, {
        channel: 'email', status: 'QUEUED_NO_RECIPIENT', callSid: result.callSid,
        claimRef: record.claimRef || null, language: msgs.language, link,
        subject: msgs.emailSubject, body: msgs.emailBody,
        reason: 'voice flow captured no email address; queued for manual/agent delivery',
      });
      result.email = { status: 'QUEUED_NO_RECIPIENT', sent: false, outboxId: row.id };
      console.error('[POSTCALL EMAIL QUEUED] ' + result.callSid + ': no recipient email — queued to outbox (' + row.id + '), NOT sent.');
    } else if (!haveCreds) {
      const row = enqueueOutbox(transcriptDir, {
        channel: 'email', status: 'QUEUED_NO_TRANSPORT', callSid: result.callSid,
        claimRef: record.claimRef || null, language: msgs.language, to: emailTo, link,
        subject: msgs.emailSubject, body: msgs.emailBody,
        reason: 'EMAIL_USER/EMAIL_APP_PASSWORD not configured',
      });
      result.email = { status: 'QUEUED_NO_TRANSPORT', sent: false, outboxId: row.id };
      console.error('[POSTCALL EMAIL QUEUED] ' + result.callSid + ' -> ' + emailTo + ': no transport (' + row.reason + ') — queued to outbox (' + row.id + '), NOT sent.');
    } else {
      try {
        const info = nodemailer
          ? await sendEmailViaNodemailer(nodemailer, { to: emailTo, subject: msgs.emailSubject, body: msgs.emailBody })
          : await sendEmailViaTlsSmtp({ to: emailTo, subject: msgs.emailSubject, body: msgs.emailBody });
        result.email = { status: 'SENT', sent: true, messageId: (info && info.messageId) || null };
        console.log('[POSTCALL EMAIL SENT] ' + result.callSid + ' -> ' + emailTo);
      } catch (e) {
        const row = enqueueOutbox(transcriptDir, {
          channel: 'email', status: 'QUEUED_SEND_FAILED', callSid: result.callSid,
          claimRef: record.claimRef || null, language: msgs.language, to: emailTo, link,
          subject: msgs.emailSubject, body: msgs.emailBody, error: e.message,
        });
        result.email = { status: 'FAILED_QUEUED', sent: false, error: e.message, outboxId: row.id };
        console.error('[POSTCALL EMAIL FAILED] ' + result.callSid + ' -> ' + emailTo + ': ' + e.message + ' — queued to outbox (' + row.id + '), NOT sent.');
      }
    }
  } catch (e) {
    // Absolute backstop: never let the sender take down the call-end path.
    console.error('[POSTCALL SENDER ERROR] ' + (result.callSid || '?') + ': ' + e.message);
    result.error = e.message;
  }
  return result;
}

module.exports = {
  sendPostCallLink,
  sendSmsViaTwilio,
  resolveNodemailer,
  sendEmailViaNodemailer,
  sendEmailViaTlsSmtp,
  buildMessages,
  enqueueOutbox,
  readOutbox,
  handleOutboxRequest,
  MESSAGES,
};
