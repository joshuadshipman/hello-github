'use strict';
/**
 * redteam_safety_guards.js — GL-VOICE-03 (Red-Team ledger 2026-10-13)
 * Pure, deterministic pre-slot guards for the 469 claims line.
 *
 *  L-01  AxiScore must never be null/undefined in the post-call payload.
 *  L-04  Coverage / payout questions must be explicitly DECLINED, not ignored.
 *  L-06  Injury + hazard (smoking car, fire, trapped) => spoken 911 direction.
 *  L-07  Caller states they are a minor => ask for adult policyholder.
 *  L-08  Language must be a defined 'en' | 'es' on session + record.
 *  L-15  No auto-enroll in the 7-day outreach queue without explicit consent.
 *  L-20  Downstream journey (SMS/ACORD/dispatch/fulfillment) must not advance
 *        while an emergency or minor hold is unresolved (Pass 4 hardening).
 *
 * Pass 4 (adversarial persona & multi-turn stress): callers are frequently
 * interrupted, self-correct mid-sentence, code-switch EN/ES mid-call, or are
 * picked up over noisy roadside audio that leaves ASR disfluency artifacts
 * ("um", "uh", stutters, truncated word fragments) in the transcript. The
 * detectors below normalize disfluencies before matching so an interrupted
 * or garbled utterance still triggers the same safety guard as a clean one.
 *
 * No network, no I/O. Every function is safe to unit-test offline.
 */

const SUPPORTED_LANGS = ['en', 'es'];

const COPY = {
  en: {
    emergency: 'Before anything else: if anyone is injured or the vehicle is smoking or on fire, please hang up and call 9 1 1 right now, and move everyone a safe distance away. Your claim can wait; your safety cannot. If you are already safe, we can continue.',
    minor: 'Thank you for telling me. Because you are under eighteen, I need an adult policyholder or a parent or guardian on the line to continue this report. Could you please hand the phone to them, or have them call us back at this number?',
    coverage: 'I understand that is the most important question for you. I am not able to tell you whether this loss is covered or how much will be paid. This call only records the facts of what happened as a preliminary report. A licensed adjuster will review coverage and contact you.',
    minorHold: 'I can continue as soon as an adult policyholder, parent, or guardian is on the line. Please hand them the phone, or have them call us back at this number.',
    adultAck: 'Thank you. I have you noted as the adult policyholder or guardian on this call, and we can continue with the report now.',
  },
  es: {
    emergency: 'Antes que nada: si alguien está herido o el vehículo está echando humo o en llamas, por favor cuelgue y llame al 9 1 1 ahora mismo, y aléjense a una distancia segura. Su reclamo puede esperar; su seguridad no. Si ya está a salvo, podemos continuar.',
    minor: 'Gracias por decírmelo. Como es menor de dieciocho años, necesito que un asegurado adulto, padre, madre o tutor esté en la línea para continuar este reporte. ¿Podría pasarle el teléfono, o pedirle que nos llame a este número?',
    coverage: 'Entiendo que esa es la pregunta más importante para usted. No puedo decirle si este siniestro está cubierto ni cuánto se pagará. Esta llamada solo registra los hechos como un reporte preliminar. Un ajustador con licencia revisará la cobertura y se comunicará con usted.',
    minorHold: 'Puedo continuar en cuanto un asegurado adulto, padre, madre o tutor esté en la línea. Por favor páseles el teléfono, o pídales que nos llamen a este número.',
    adultAck: 'Gracias. Lo tengo registrado como el asegurado adulto o tutor en esta llamada, y podemos continuar con el reporte ahora.',
  },
};

const RX = {
  injury: /\b(hurt|injur(?:ed|y|ies)|bleeding|unconscious|neck|back pain|broken|can'?t move|ambulance|herid[oa]s?|sangrando|inconsciente|lastimad[oa]|ambulancia|dolor)\b/i,
  hazard: /\b(smok(?:e|ing)|on fire|fire|flames?|burning|trapped|pinned|leaking (?:gas|fuel)|fuel leak|gas leak|humo|echando humo|en llamas|fuego|incendi(?:o|ando)|atrapad[oa]|fuga de (?:gas|gasolina))\b/i,
  explicitEmergency: /\b(emergency|911|nine one one|emergencia)\b/i,
  severe: /\b(badly|severe(?:ly)?|serious(?:ly)?|a lot of blood|can'?t breathe|grave|mucha sangre)\b/i,
  minor: /(\bi(?:'m| am) (?:only )?(?:1[0-7]|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen)(?: years?(?: old)?)?\b|\bi(?:'m| am) (?:a )?minor\b|\bi(?:'m| am) under (?:18|eighteen)\b|\bi(?:'m| am) (?:just )?a kid\b|\btengo (?:1[0-7]|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete) a[ñn]os\b|\bsoy menor(?: de edad)?\b)/i,
  adultTakeover: /(\b(?:this is|it's|i'?m|i am|soy|habla) (?:his|her|their|the|el|la|su)? ?(?:dad|father|mom|mother|parent|guardian|policyholder|policy holder|named insured|papá|padre|mamá|madre|tutor|asegurad[oa])\b|\bi(?:'m| am) (?:an adult|over (?:18|eighteen)|the (?:insured|policyholder))\b|\b(?:i|we) have the policy\b|\bsoy (?:mayor de edad|adulto|adulta)\b)/i,
  coverage: /(\bis (?:this|it|that|my \w+) covered\b|\bam i covered\b|\bwill (?:this|it|that) be covered\b|\bdoes my policy cover\b|\bhow much (?:will|would|do|are) (?:you|i|we|they) ?(?:pay|get|receive|owe)\b|\bhow much (?:is|am i) (?:going to|gonna) (?:get|receive)\b|\bwhat(?:'s| is) my payout\b|\bpay(?:out|ment) amount\b|\best[aá] cubierto\b|\bme cubre\b|\bcubre (?:esto|mi p[oó]liza)\b|\bcu[aá]nto (?:me )?(?:van a )?pagar\b|\bcu[aá]nto recibo\b|\bthat'?s too (?:expensive|much)\b|\bi can'?t afford\b|\bno puedo pagar\b|\bes muy caro\b)/i,
};

// Pass 4: fillers and self-correction markers that noisy/interrupted ASR
// transcripts leave behind. Stripped before any detector runs a regex.
const FILLER_RX = /\b(?:um+|uh+|erm+|hm+|like|you know|i mean|o sea|pues|eh+)\b/gi;
// Collapse an immediately-repeated word/phrase ("I'm I'm hurt", "no no espere").
const STUTTER_RX = /\b(\w[\w'-]*)(?:\s+\1\b)+/gi;
// Drop a truncated word fragment left by a mid-word interruption ("sm- smoking").
const TRUNCATION_RX = /\b[a-zA-Záéíóúñ]{1,3}-\s+/g;

/**
 * Normalize ASR disfluency artifacts (fillers, stutters, mid-word
 * interruption fragments, extra whitespace) without altering the substantive
 * words a caller said. Idempotent and pure.
 */
function normalizeDisfluency(text) {
  let s = String(text || '');
  if (!s) return s;
  s = s.replace(TRUNCATION_RX, '');
  s = s.replace(FILLER_RX, ' ');
  s = s.replace(STUTTER_RX, '$1');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function normalizeLanguage(lang, fallback) {
  const l = String(lang || '').toLowerCase().trim();
  if (l.startsWith('es')) return 'es';
  if (l.startsWith('en')) return 'en';
  const fb = String(fallback || 'en').toLowerCase();
  return fb.startsWith('es') ? 'es' : 'en';
}

function detectEmergency(text) {
  const s = normalizeDisfluency(text);
  if (!s) return false;
  const hazard = RX.hazard.test(s);
  const injury = RX.injury.test(s);
  return hazard || (injury && RX.explicitEmergency.test(s)) || (injury && RX.severe.test(s));
}

function detectMinorCaller(text) {
  return RX.minor.test(normalizeDisfluency(text));
}

function detectAdultTakeover(text) {
  return RX.adultTakeover.test(normalizeDisfluency(text));
}

function detectCoverageQuestion(text) {
  return RX.coverage.test(normalizeDisfluency(text));
}

/**
 * Evaluate all pre-slot guards for a single caller utterance.
 * Mutates `session.fnolData` flags (idempotent) and returns speech chunks to prepend.
 * Emergency + minor guards speak at most once per call (flag-gated) so the bot never loops;
 * the coverage decline is spoken every time the question is asked (L-04: never ignored).
 */
function evaluateGuards(session, userSpeech, options = {}) {
  const lang = normalizeLanguage(options.language || (session && session.language), 'en');
  const chunks = [];
  const triggered = [];
  if (!session || typeof session !== 'object') return { chunks, triggered, lang };
  if (!session.fnolData || typeof session.fnolData !== 'object') session.fnolData = {};
  const d = session.fnolData;
  const s = String(userSpeech || '');
  if (!s.trim()) return { chunks, triggered, lang };
  const C = COPY[lang];

  if (detectEmergency(s)) {
    d.emergency = true;
    if (d.emergency_disclosure_spoken !== true) {
      d.emergency_disclosure_spoken = true;
      d.emergency_disclosure_text = C.emergency;
      chunks.push({ voice: 'agent', text: C.emergency });
      triggered.push('L-06');
    }
  }
  let hold = false;
  if (d.caller_is_minor === true && d.guardian_consent_captured !== true && detectAdultTakeover(s)) {
    // An adult policyholder / parent / guardian has taken the line: release the hold.
    d.guardian_consent_captured = true;
    d.guardian_takeover_text = s.slice(0, 200);
    chunks.push({ voice: 'agent', text: C.adultAck });
    triggered.push('L-07-RELEASED');
  } else if (detectMinorCaller(s)) {
    d.caller_is_minor = true;
    if (d.adult_policyholder_requested !== true) {
      d.adult_policyholder_requested = true;
      d.guardian_consent_captured = d.guardian_consent_captured === true;
      chunks.push({ voice: 'agent', text: C.minor });
      triggered.push('L-07');
    }
  }
  if (d.caller_is_minor === true && d.guardian_consent_captured !== true) {
    // L-07: intake is HELD until an adult is on the line — no slot questions are asked of a minor.
    hold = true;
    d.intake_held_reason = 'MINOR_CALLER_AWAITING_ADULT_POLICYHOLDER';
    if (!chunks.length) chunks.push({ voice: 'agent', text: C.minorHold });
  }
  if (detectCoverageQuestion(s)) {
    d.coverage_question_asked = true;
    d.coverage_question_declined = true;
    d.coverage_decline_count = (d.coverage_decline_count || 0) + 1;
    chunks.push({ voice: 'agent', text: C.coverage });
    triggered.push('L-04');
  }
  if (chunks.length) {
    session.transcript = (session.transcript || '') + chunks.map(c => '\nAI Agent Angel: ' + c.text).join('');
  }
  return { chunks, triggered, lang, hold };
}

/** L-01: coerce any score into a finite integer 0..100, never null. */
function coerceAxiScore(value, fallback) {
  let n = Number(value);
  if (value == null || !Number.isFinite(n)) n = Number(fallback);
  if (fallback == null || !Number.isFinite(n)) n = Number.isFinite(Number(value)) && value != null ? Number(value) : 0;
  if (!Number.isFinite(n)) n = 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** L-15: outreach enrollment requires explicit, affirmative consent captured on the call. */
function autoEnrollDecision(session) {
  const d = (session && session.fnolData) || {};
  const explicit = Boolean(session && (session.smsConsent === true || session.outreachConsent === true || d.explicit_consent === true || d.outreachConsent === true));
  return {
    allowed: explicit,
    reason: explicit ? 'EXPLICIT_CONSENT_ON_CALL' : 'SUPPRESSED_NO_EXPLICIT_CONSENT',
    auto_enroll: explicit,
    explicit_consent: explicit,
  };
}

/**
 * L-20 (Pass 4 cross-file seam hardening): gate for every downstream
 * workflow/journey step (SMS link handoff, ACORD/dispatch ticket build,
 * Stripe/Gumroad fulfillment, outreach enrollment). Multi-turn adversarial
 * callers routinely interrupt mid-disclosure or re-ask after being told to
 * call 911; this guard holds the ENTIRE journey, not just the next prompt,
 * until the unresolved condition clears.
 */
function canAdvanceJourney(session) {
  const d = (session && session.fnolData) || {};
  if (d.caller_is_minor === true && d.guardian_consent_captured !== true) {
    return { allowed: false, reason: 'HELD_MINOR_AWAITING_ADULT_POLICYHOLDER', blocked_stage: 'ALL' };
  }
  if (d.emergency === true && d.emergency_resolved !== true) {
    return { allowed: false, reason: 'HELD_EMERGENCY_911_DIRECTIVE_UNRESOLVED', blocked_stage: 'ALL' };
  }
  return { allowed: true, reason: 'NO_ACTIVE_HOLD', blocked_stage: null };
}

/** Merge a barge-in-interrupted caller turn with its continuation, dropping the
 * duplicated trailing/leading overlap so digits/words spoken twice are not doubled. */
function mergeInterruptedSpeech(priorFragment, continuationFragment) {
  const a = String(priorFragment || '').trim();
  const b = String(continuationFragment || '').trim();
  if (!a) return b;
  if (!b) return a;
  const aWords = a.split(/\s+/);
  const bWords = b.split(/\s+/);
  const maxOverlap = Math.min(aWords.length, bWords.length);
  let overlap = 0;
  for (let n = maxOverlap; n > 0; n--) {
    const tail = aWords.slice(aWords.length - n).join(' ').toLowerCase();
    const head = bWords.slice(0, n).join(' ').toLowerCase();
    if (tail === head) { overlap = n; break; }
  }
  return (aWords.join(' ') + ' ' + bWords.slice(overlap).join(' ')).trim();
}

/** Resolve a mid-sentence digit self-correction ("four oh five, no wait, four oh six")
 * to the LAST stated digit run — the correction always wins, never the first guess. */
function resolveDigitCorrection(text) {
  const s = String(text || '');
  const correctionSplit = /\b(?:no wait|i mean|sorry|correction|actually|no,? make that|perdón|digo|mejor dicho|corrección)\b/i;
  const parts = s.split(correctionSplit);
  const digitRun = (chunk) => {
    const found = chunk.match(/\d[\d\s-]*\d|\d/g) || [];
    return found.join('').replace(/[\s-]/g, '');
  };
  const last = parts[parts.length - 1];
  const resolved = digitRun(last);
  if (resolved) return { corrected: true, value: resolved, turns: parts.length };
  // No correction marker found: fall back to the only/last digit run in the whole utterance.
  const fallback = digitRun(s);
  return { corrected: false, value: fallback, turns: 1 };
}

/** Detect EN/ES code-switching WITHIN a single caller utterance (not just session language). */
function detectCodeSwitch(text) {
  const s = String(text || '');
  const enHit = /\b(the|is|was|my|car|crash|sorry|please|continue|insurance)\b/i.test(s);
  const esHit = /\b(el|la|mi|choque|carro|coche|seguro|por favor|perdón|gracias|lo siento)\b/i.test(s);
  return { isCodeSwitch: enHit && esHit, hasEnglish: enHit, hasSpanish: esHit };
}

/** Gate noisy/roadside audio turns: below the confidence or SNR floor, the agent must
 * ask the caller to repeat rather than silently guessing at safety-critical content. */
function assessNoisyAudioConfidence(meta) {
  const m = meta || {};
  const confidence = Number.isFinite(Number(m.confidence)) ? Number(m.confidence) : 1;
  const snrDb = Number.isFinite(Number(m.snrDb)) ? Number(m.snrDb) : 99;
  const noisy = confidence < 0.55 || snrDb < 6;
  return {
    noisy,
    action: noisy ? 'ASK_TO_REPEAT' : 'ACCEPT',
    reason: noisy ? 'LOW_CONFIDENCE_OR_SNR_ROADSIDE_AUDIO' : 'CLEAR_AUDIO',
  };
}

/** Detect an SMB buyer price objection so it can be routed to a value-reframe, never
 * a silent discount and never ignored like a coverage question (mirrors L-04's honesty bar). */
function detectPriceObjection(text) {
  const s = String(text || '');
  return /\b(too expensive|that'?s a lot|can'?t afford|cheaper|lower price|discount|price is too high|out of (?:my|our) budget|demasiado caro|muy caro|no puedo pagar|más barato|descuento)\b/i.test(s);
}

module.exports = {
  SUPPORTED_LANGS,
  COPY,
  normalizeDisfluency,
  normalizeLanguage,
  detectEmergency,
  detectMinorCaller,
  detectAdultTakeover,
  detectCoverageQuestion,
  evaluateGuards,
  coerceAxiScore,
  autoEnrollDecision,
  canAdvanceJourney,
  mergeInterruptedSpeech,
  resolveDigitCorrection,
  detectCodeSwitch,
  assessNoisyAudioConfidence,
  detectPriceObjection,
};
