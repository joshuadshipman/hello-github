/**
 * VOICE-SMS-ROUTE-01 — Inbound SMS/MMS engine for the 469 Auto Claims line
 * ========================================================================
 * The 469 number's SMS webhook pointed at angel-voice-server/sms which 404'd
 * at the app layer — an inbound text (including the DEMO-DOD-04 photo upload)
 * got nothing at all. This module implements the inbound side:
 *
 *   - Accepts a Twilio inbound SMS/MMS webhook payload (form fields).
 *   - STOP/HELP keyword handling (EN + ES, SPANISH PARITY law).
 *   - Downloads MMS media (photos) and stores them DURABLY:
 *       * primary store   = GCS bucket (FNOL_MEDIA_BUCKET, default
 *         gravityclaw-hub-2026-fnol-media) via the Cloud Run metadata-server
 *         token — container-local disk dies on redeploy (VOICE-PERSIST-01).
 *       * secondary store = TRANSCRIPT_DIR/sms_media/<MessageSid>/ best-effort.
 *   - Matches the sender (From) to the most recent call session — live
 *     activeSessions first, then the recent-call index written by archiveCall —
 *     and attaches the photos to that call's FNOL record.
 *   - Replies with valid TwiML <Message> in the caller's language. NOTE:
 *     outbound delivery is still subject to the A2P campaign (pending);
 *     inbound receive + storage is independent of carrier approval.
 *
 * Twilio signature validation: enforced when SMS_VALIDATE_SIGNATURE=true and
 * TWILIO_AUTH_TOKEN is set. Default off — matching the server's existing
 * /voice posture (no signature validation anywhere on this service yet).
 *
 * Zero npm dependencies, matching voice_webhook_server.js.
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FNOL_MEDIA_BUCKET = process.env.FNOL_MEDIA_BUCKET || 'gravityclaw-hub-2026-fnol-media';
const MEDIA_MAX_BYTES = parseInt(process.env.SMS_MEDIA_MAX_BYTES || String(5 * 1024 * 1024), 10);
const MEDIA_MAX_COUNT = 10;
const RECENT_INDEX_FILE = 'recent_calls_index.json';
const RECENT_MATCH_WINDOW_MS = parseInt(process.env.SMS_MATCH_WINDOW_MS || String(24 * 60 * 60 * 1000), 10);

// ---- Spanish parity (language is a first-class field on every reply) --------
const SMS_STRINGS = {
  en: {
    photosReceived: (n, ref, isTrade = false) => `Thank you — ${n} photo${n === 1 ? '' : 's'} received and attached to your ${isTrade ? 'service request' : 'claim'}${ref ? ' ' + ref : ''}. Reply HELP for help or STOP to opt out.`,
    textReceived: (ref, isTrade = false) => `Thank you — your message was received${ref ? ' and added to ' + (isTrade ? 'service request ' : 'claim ') + ref : ''}. If you were asked to send photos, please attach them to a text to this number. Reply HELP for help or STOP to opt out.`,
    help: 'Agent Angel Service & Claims Intake line. Text photos of your issue to this number to attach them to your record. Msg&data rates may apply. Reply STOP to opt out.',
    stop: 'You have been unsubscribed from Agent Angel messages. No further messages will be sent. Reply START to resubscribe.',
  },
  es: {
    photosReceived: (n, ref, isTrade = false) => `Gracias — ${n} foto${n === 1 ? '' : 's'} recibida${n === 1 ? '' : 's'} y adjuntada${n === 1 ? '' : 's'} a su ${isTrade ? 'solicitud de servicio' : 'reclamo'}${ref ? ' ' + ref : ''}. Responda AYUDA para ayuda o STOP para darse de baja.`,
    textReceived: (ref, isTrade = false) => `Gracias — su mensaje fue recibido${ref ? ' y agregado a ' + (isTrade ? 'la solicitud ' : 'el reclamo ') + ref : ''}. Si le pedimos fotos, por favor adjúntelas a un mensaje de texto a este número. Responda AYUDA para ayuda o STOP para darse de baja.`,
    help: 'Línea de recepción de Agent Angel. Envíe fotos del problema a este número para adjuntarlas a su expediente. Pueden aplicar tarifas de mensajes y datos. Responda STOP para darse de baja.',
    stop: 'Se ha dado de baja de los mensajes de Agent Angel. No se enviarán más mensajes. Responda START para volver a suscribirse.',
  },
};

const STOP_WORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'BAJA']);
const HELP_WORDS = new Set(['HELP', 'INFO', 'AYUDA', 'INFORMACION', 'INFORMACIÓN']);
const START_WORDS = new Set(['START', 'YES', 'UNSTOP', 'INICIAR', 'SI', 'SÍ']);

const ES_BODY = /\b(hola|gracias|fotos?|reclamo|siniestro|póliza|poliza|accidente|choque|granizo|ayuda|adjunt\w*|da[ñn]os?|veh[ií]culo)\b/i;

function xmlEscape(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function smsPack(lang) { return SMS_STRINGS[lang] || SMS_STRINGS.en; }

function detectSmsLanguage(body, matchedLanguage) {
  if (matchedLanguage === 'es' || matchedLanguage === 'en') return matchedLanguage;
  if (body && ES_BODY.test(body)) return 'es';
  return 'en';
}

function messageTwiml(text) {
  if (!text) return '<?xml version="1.0" encoding="UTF-8"?><Response/>';
  return '<?xml version="1.0" encoding="UTF-8"?><Response><Message>' + xmlEscape(text) + '</Message></Response>';
}

// ---- Twilio signature (X-Twilio-Signature) ----------------------------------
function computeTwilioSignature(authToken, fullUrl, params) {
  const data = fullUrl + Object.keys(params).sort().map(k => k + params[k]).join('');
  return crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf8')).digest('base64');
}

function validateTwilioSignature({ authToken, fullUrl, params, signature }) {
  if (!authToken || !signature) return false;
  const expected = computeTwilioSignature(authToken, fullUrl, params);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch (e) { return false; }
}

// ---- Recent-call index (written by archiveCall) ------------------------------
function recentIndexPath(dir) { return path.join(dir, RECENT_INDEX_FILE); }

function recordRecentCall(dir, entry) {
  try {
    const p = recentIndexPath(dir);
    let list = [];
    if (fs.existsSync(p)) { try { list = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { list = []; } }
    if (!Array.isArray(list)) list = [];
    list.push({
      callSid: entry.callSid, from: entry.from, claimRef: entry.claimRef,
      language: entry.language || 'en', ts: entry.ts || Date.now(),
    });
    if (list.length > 200) list = list.slice(-200);
    fs.writeFileSync(p, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    console.log('[SMS RECENT INDEX WARNING] could not record call: ' + e.message);
  }
}

function findRecentCall(dir, from) {
  try {
    const p = recentIndexPath(dir);
    if (!fs.existsSync(p)) return null;
    const list = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!Array.isArray(list)) return null;
    const cutoff = Date.now() - RECENT_MATCH_WINDOW_MS;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i] && list[i].from === from && (list[i].ts || 0) >= cutoff) return list[i];
    }
  } catch (e) {}
  return null;
}

function findActiveSession(activeSessions, from) {
  let best = null;
  if (!activeSessions) return null;
  for (const session of activeSessions.values()) {
    if (session && session.fromNumber === from) {
      if (!best || (session.startTimestamp || 0) > (best.startTimestamp || 0)) best = session;
    }
  }
  return best;
}

// ---- Media download ----------------------------------------------------------
function fetchUrl(rawUrl, { auth, maxBytes = MEDIA_MAX_BYTES, redirectsLeft = 4 } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(rawUrl); } catch (e) { return reject(new Error('bad media url')); }
    const isLocal = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && isLocal)) {
      return reject(new Error('media url protocol refused: ' + u.protocol));
    }
    // SSRF guard (validator finding 2026-08-19): never fetch link-local/private
    // IP literals — 169.254.169.254 (metadata), RFC1918, loopback-by-IP over
    // https. Twilio media hosts are always public DNS names.
    if (!isLocal && /^(\d+\.\d+\.\d+\.\d+|\[?[0-9a-f:]+\]?)$/i.test(u.hostname)) {
      const h = u.hostname.replace(/[[\]]/g, '');
      if (/^(10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|::1$|f[cd][0-9a-f]{2}:|fe80:)/i.test(h)) {
        return reject(new Error('media url host refused (private/link-local IP): ' + h));
      }
    }
    const lib = u.protocol === 'https:' ? https : http;
    const headers = {};
    // Only present Twilio credentials to Twilio itself.
    if (auth && /(^|\.)twilio\.com$/.test(u.hostname)) {
      headers.Authorization = 'Basic ' + Buffer.from(auth).toString('base64');
    }
    // settled guards the stream hardening below: once we've resolved/rejected
    // once (cap exceeded, timeout, socket error), every further 'data'/'error'
    // event on this stream is a no-op instead of re-buffering, re-destroying,
    // or re-settling the promise (GOV-DESTRUCTIVE-TEE-03 — a slow/malicious
    // media host that keeps pushing bytes after destroy() must not keep this
    // handler doing work or touching an already-settled promise).
    let settled = false;
    const settle = (fn, arg) => { if (settled) return; settled = true; fn(arg); };
    const req = lib.get(u, { headers }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        res.resume();
        return settle(resolve, fetchUrl(new URL(res.headers.location, u).toString(), { auth, maxBytes, redirectsLeft: redirectsLeft - 1 }));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return settle(reject, new Error('media fetch HTTP ' + res.statusCode));
      }
      // Fail fast on an honest oversized Content-Length before buffering any
      // body bytes at all — cheaper and lower-latency than streaming the
      // whole payload in just to discard it once the running total trips
      // the cap below.
      const declaredLen = Number(res.headers['content-length']);
      if (Number.isFinite(declaredLen) && declaredLen > maxBytes) {
        res.destroy();
        req.destroy();
        return settle(reject, new Error('media exceeds cap ' + maxBytes));
      }
      const chunks = [];
      let size = 0;
      res.on('data', (c) => {
        if (settled) return;
        size += c.length;
        if (size > maxBytes) {
          res.destroy();
          req.destroy();
          return settle(reject, new Error('media exceeds cap ' + maxBytes));
        }
        chunks.push(c);
      });
      res.on('end', () => settle(resolve, { buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] || 'application/octet-stream' }));
      res.on('error', (e) => settle(reject, e));
    });
    req.setTimeout(15000, () => { req.destroy(); settle(reject, new Error('media fetch timeout')); });
    req.on('error', (e) => settle(reject, e));
  });
}

function extFor(contentType) {
  const map = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp', 'image/heic': '.heic', 'application/pdf': '.pdf', 'video/mp4': '.mp4', 'text/vcard': '.vcf' };
  return map[(contentType || '').split(';')[0].trim().toLowerCase()] || '.bin';
}

// ---- GCS (durable store — VOICE-PERSIST-01) ----------------------------------
function getGcpToken() {
  if (process.env.GOOGLE_OAUTH_TOKEN) return Promise.resolve(process.env.GOOGLE_OAUTH_TOKEN);
  return new Promise((resolve, reject) => {
    const req = http.get({
      hostname: 'metadata.google.internal',
      path: '/computeMetadata/v1/instance/service-accounts/default/token',
      headers: { 'Metadata-Flavor': 'Google' },
    }, (res) => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => {
        try { resolve(JSON.parse(b).access_token); } catch (e) { reject(new Error('metadata token parse: ' + e.message)); }
      });
    });
    req.setTimeout(3000, () => req.destroy(new Error('metadata token timeout')));
    req.on('error', reject);
  });
}

async function gcsUpload(token, objectName, buffer, contentType) {
  // One retry on transient failure (validator finding 2026-08-19): a single
  // network blip must not lose a claimant's photo.
  try {
    return await gcsUploadOnce(token, objectName, buffer, contentType);
  } catch (e) {
    console.log('[SMS GCS RETRY] ' + objectName + ': ' + e.message);
    await new Promise(r => setTimeout(r, 750));
    return gcsUploadOnce(token, objectName, buffer, contentType);
  }
}

function gcsUploadOnce(token, objectName, buffer, contentType) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'storage.googleapis.com',
      path: '/upload/storage/v1/b/' + FNOL_MEDIA_BUCKET + '/o?uploadType=media&name=' + encodeURIComponent(objectName),
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': contentType || 'application/octet-stream', 'Content-Length': buffer.length },
    }, (res) => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => {
        if (res.statusCode === 200) resolve(JSON.parse(b));
        else reject(new Error('GCS upload HTTP ' + res.statusCode + ': ' + b.slice(0, 300)));
      });
    });
    req.setTimeout(20000, () => req.destroy(new Error('GCS upload timeout')));
    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
}

// ---- Main handler --------------------------------------------------------------
/**
 * @param {object} data   parsed Twilio form fields (From, To, Body, MessageSid, NumMedia, MediaUrl{i}, MediaContentType{i})
 * @param {object} ctx    { activeSessions, transcriptDir, fullUrl, signature }
 * @returns {Promise<{status:number, body:string, meta:object}>} TwiML response + stored metadata
 */
async function handleInboundSms(data, ctx) {
  const { activeSessions, transcriptDir } = ctx;

  if (process.env.SMS_VALIDATE_SIGNATURE === 'true' && process.env.TWILIO_AUTH_TOKEN) {
    const ok = validateTwilioSignature({
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fullUrl: ctx.fullUrl || '',
      params: data,
      signature: ctx.signature || '',
    });
    if (!ok) return { status: 403, body: 'invalid twilio signature', meta: { rejected: 'signature' } };
  }

  const from = data.From || '';
  const body = (data.Body || '').trim();
  const messageSid = data.MessageSid || data.SmsSid || ('SMS-' + Date.now());
  const numMedia = Math.min(parseInt(data.NumMedia || '0', 10) || 0, MEDIA_MAX_COUNT);

  // Match sender to the most recent call (live session first, then archive index).
  const liveSession = findActiveSession(activeSessions, from);
  const recentCall = liveSession ? null : findRecentCall(transcriptDir, from);
  const matchedCallSid = liveSession ? liveSession.callSid : (recentCall ? recentCall.callSid : null);
  const matchedClaimRef = liveSession ? liveSession.claimRef : (recentCall ? recentCall.claimRef : null);
  const matchedLanguage = liveSession ? liveSession.language : (recentCall ? recentCall.language : null);
  const language = detectSmsLanguage(body, matchedLanguage);
  const S = smsPack(language);

  // NFKC-normalize so full-width/compatibility Unicode can't evade STOP/HELP.
  const keyword = body.normalize('NFKC').toUpperCase().replace(/[.!¡¿?]/g, '').trim();

  const meta = {
    messageSid, from, to: data.To || '', body, numMedia,
    language,                       // first-class field — SPANISH PARITY law
    matchedCallSid, matchedClaimRef,
    receivedAt: new Date().toISOString(),
    media: [],
    storage: { bucket: FNOL_MEDIA_BUCKET, gcs: 'PENDING', local: 'PENDING' },
  };

  // ---- STOP / HELP -------------------------------------------------------------
  if (STOP_WORDS.has(keyword)) {
    meta.keyword = 'STOP';
    recordOptOut(transcriptDir, from, 'STOP', language);
    await persistMeta(meta, transcriptDir);
    return { status: 200, body: messageTwiml(S.stop), meta };
  }
  if (HELP_WORDS.has(keyword)) {
    meta.keyword = 'HELP';
    await persistMeta(meta, transcriptDir);
    return { status: 200, body: messageTwiml(S.help), meta };
  }
  if (START_WORDS.has(keyword)) {
    meta.keyword = 'START';
    recordOptOut(transcriptDir, from, 'START', language);
    await persistMeta(meta, transcriptDir);
    return { status: 200, body: messageTwiml(S.textReceived(matchedClaimRef)), meta };
  }

  // ---- MMS media download + durable storage -------------------------------------
  const auth = (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
    ? process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN : null;

  let totalBytes = 0; // per-MESSAGE cap: 10 items at the per-item cap is too much
  const TOTAL_MAX = parseInt(process.env.SMS_MEDIA_TOTAL_MAX_BYTES || String(20 * 1024 * 1024), 10);
  for (let i = 0; i < numMedia; i++) {
    const mediaUrl = data['MediaUrl' + i];
    const declaredType = data['MediaContentType' + i] || '';
    if (!mediaUrl) continue;
    const item = { index: i, sourceUrl: mediaUrl, contentType: declaredType, status: 'PENDING' };
    meta.media.push(item);
    if (totalBytes >= TOTAL_MAX) {
      item.status = 'SKIPPED';
      item.error = 'per-message media cap reached (' + TOTAL_MAX + ' bytes)';
      console.log('[SMS MEDIA CAP] ' + messageSid + ' media ' + i + ' skipped: total cap');
      continue;
    }
    try {
      const fetched = await fetchUrl(mediaUrl, { auth });
      totalBytes += fetched.buffer.length;
      item.contentType = declaredType || fetched.contentType;
      item.bytes = fetched.buffer.length;
      item.sha256 = crypto.createHash('sha256').update(fetched.buffer).digest('hex');
      item.object = 'sms/' + messageSid + '/media_' + i + extFor(item.contentType);
      item.buffer = fetched.buffer; // consumed by persistMeta, stripped before write
      item.status = 'FETCHED';
      try {
        const photoStorage = require('./photo_storage');
        const rec = photoStorage.savePhotoBuffer(from || messageSid, fetched.buffer, {
          mimeType: (item.contentType || '').split(';')[0].trim().toLowerCase(),
          source: 'mms',
        });
        if (matchedClaimRef && matchedClaimRef !== from) {
          photoStorage.linkToCallRecord(matchedClaimRef, rec);
        }
        item.photoRecord = rec;
      } catch (psErr) {
        console.log('[SMS PHOTO STORAGE WARNING] ' + psErr.message);
      }
    } catch (e) {
      item.status = 'FETCH_FAILED';
      item.error = e.message;
      console.log('[SMS MEDIA ERROR] ' + messageSid + ' media ' + i + ': ' + e.message); // fail LOUD
    }
  }

  await persistMeta(meta, transcriptDir);

  // ---- Attach to the FNOL record --------------------------------------------------
  const storedMedia = meta.media.filter(m => m.status === 'STORED' || m.status === 'FETCHED' || m.status === 'LOCAL_ONLY');
  if (liveSession) {
    liveSession.fnolData.photos = liveSession.fnolData.photos || [];
    for (const m of storedMedia) {
      liveSession.fnolData.photos.push({ object: m.object, bucket: FNOL_MEDIA_BUCKET, contentType: m.contentType, sha256: m.sha256, via: 'MMS', messageSid, ts: meta.receivedAt });
    }
    liveSession.fnolData.photosReceived = (liveSession.fnolData.photos || []).length;
    liveSession.transcript = (liveSession.transcript || '') + '\n[MMS] ' + storedMedia.length + ' photo(s) received from ' + from + ' (msg ' + messageSid + ')';
  }

  const reply = numMedia > 0
    ? S.photosReceived(storedMedia.length || numMedia, matchedClaimRef)
    : S.textReceived(matchedClaimRef);
  return { status: 200, body: messageTwiml(reply), meta };
}

function recordOptOut(dir, from, action, language) {
  try {
    const p = path.join(dir, 'sms_optouts.json');
    let list = [];
    if (fs.existsSync(p)) { try { list = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { list = []; } }
    list.push({ from, action, language, ts: new Date().toISOString() });
    fs.writeFileSync(p, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) { console.log('[SMS OPTOUT WARNING] ' + e.message); }
}

function isOptedOut(dir, phone) {
  if (typeof dir === 'string' && !phone && /^\+?\d[\d\s()-]{7,}$/.test(dir)) {
    phone = dir;
    dir = process.env.TRANSCRIPT_DIR || '';
  }
  if (!phone) return true;
  const digits = String(phone).replace(/\D/g, '').slice(-10);
  if (digits.length < 10) return true;
  try {
    const p = path.join(dir || '', 'sms_optouts.json');
    if (fs.existsSync(p)) {
      const list = JSON.parse(fs.readFileSync(p, 'utf8')) || [];
      for (let i = list.length - 1; i >= 0; i--) {
        const item = list[i];
        const itemDigits = String(item.from || '').replace(/\D/g, '').slice(-10);
        if (itemDigits === digits) {
          if (item.action === 'STOP') return true;
          if (item.action === 'START') return false;
        }
      }
    }
  } catch (e) {
    console.error('[SMS OPTOUT READ ERROR — FAIL CLOSED]', e.message);
    return true;
  }
  return false;
}

function getMessagingConsent(dir, phone, opts = {}) {
  if (typeof dir === 'string' && (!phone || typeof phone === 'object') && /^\+?\d[\d\s()-]{7,}$/.test(dir)) {
    opts = (phone && typeof phone === 'object') ? phone : {};
    phone = dir;
    dir = process.env.TRANSCRIPT_DIR || '';
  }
  if (!phone) return { consented: false, reason: 'NO_PHONE' };
  const digits = String(phone).replace(/\D/g, '').slice(-10);
  if (digits.length < 10) return { consented: false, reason: 'INVALID_PHONE' };
  try {
    const p = path.join(dir || '', 'sms_optouts.json');
    if (fs.existsSync(p)) {
      const list = JSON.parse(fs.readFileSync(p, 'utf8')) || [];
      for (let i = list.length - 1; i >= 0; i--) {
        const item = list[i];
        const itemDigits = String(item.from || '').replace(/\D/g, '').slice(-10);
        if (itemDigits === digits) {
          if (item.action === 'STOP') {
            return { consented: false, reason: 'PRIOR_STOP', event: item };
          }
          if (item.action === 'START') {
            return { consented: true, reason: 'EXPLICIT_START', event: item };
          }
        }
      }
    }
  } catch (e) {
    console.error('[SMS CONSENT READ ERROR — FAIL CLOSED]', e.message);
    return { consented: false, reason: 'LEDGER_READ_ERROR_FAIL_CLOSED' };
  }
  if (opts && opts.requireAffirmativeConsent === true && opts.hasAffirmativeConsent !== true) {
    return { consented: false, reason: 'AFFIRMATIVE_CONSENT_REQUIRED' };
  }
  return { consented: true, reason: 'NO_PRIOR_OPTOUT' };
}

/**
 * Persist media buffers + metadata: GCS (durable, primary) and local disk
 * (best-effort secondary). Mutates meta.media[].status and meta.storage.
 */
async function persistMeta(meta, transcriptDir) {
  // Local (container-local: survives the call, NOT a redeploy — secondary only)
  try {
    const localDir = path.join(transcriptDir, 'sms_media', meta.messageSid);
    fs.mkdirSync(localDir, { recursive: true });
    for (const m of meta.media) {
      if (m.buffer) fs.writeFileSync(path.join(localDir, path.basename(m.object)), m.buffer);
    }
    fs.writeFileSync(path.join(localDir, 'message.json'), JSON.stringify(stripBuffers(meta), null, 2), 'utf8');
    meta.storage.local = 'OK:' + localDir;
  } catch (e) {
    meta.storage.local = 'FAILED: ' + e.message;
    console.log('[SMS LOCAL STORE WARNING] ' + e.message);
  }

  // GCS — the durable record
  if (process.env.SMS_MEDIA_STORE === 'local') {
    meta.storage.gcs = 'DISABLED (SMS_MEDIA_STORE=local)';
  } else {
    try {
      const token = await getGcpToken();
      for (const m of meta.media) {
        if (!m.buffer) continue;
        await gcsUpload(token, m.object, m.buffer, m.contentType);
        m.status = 'STORED';
      }
      const metaObject = 'sms/' + meta.messageSid + '/message.json';
      await gcsUpload(token, metaObject, Buffer.from(JSON.stringify(stripBuffers(meta), null, 2), 'utf8'), 'application/json');
      meta.storage.gcs = 'OK:gs://' + FNOL_MEDIA_BUCKET + '/' + metaObject;
      console.log('[SMS GCS STORE] ' + meta.messageSid + ' -> gs://' + FNOL_MEDIA_BUCKET + '/sms/' + meta.messageSid + '/');
    } catch (e) {
      meta.storage.gcs = 'FAILED: ' + e.message;
      for (const m of meta.media) if (m.status === 'FETCHED') m.status = 'LOCAL_ONLY';
      console.log('[SMS GCS STORE ERROR] ' + meta.messageSid + ': ' + e.message); // fail LOUD, never silently
    }
  }
  for (const m of meta.media) delete m.buffer;
  return meta;
}

function stripBuffers(meta) {
  return Object.assign({}, meta, { media: meta.media.map(m => { const c = Object.assign({}, m); delete c.buffer; return c; }) });
}

module.exports = {
  handleInboundSms,
  recordRecentCall,
  findRecentCall,
  findActiveSession,
  detectSmsLanguage,
  computeTwilioSignature,
  validateTwilioSignature,
  messageTwiml,
  getMessagingConsent,
  isOptedOut,
  recordOptOut,
  fetchUrl,
  SMS_STRINGS,
  FNOL_MEDIA_BUCKET,
};
