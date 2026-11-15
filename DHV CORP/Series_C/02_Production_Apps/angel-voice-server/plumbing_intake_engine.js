/**
 * Enterprise Plumbing Intake Engine — SC-PLUMB-AUDIT-P0-02
 * =========================================================================
 * Remediates Finding P2 of PLUMBING_SPECIALIST_LAUNCH_READINESS_AUDIT.md:
 * the old URGENT.plumbing cue in specialist_engines.js was one flat regex
 * (`/flood|sewage|gas|.../`) that could only set a single boolean. Gas,
 * sewage and scald are three different life-safety protocols with three
 * different spoken instructions (evacuate vs. do-not-flush vs. shut off the
 * water heater) — flattening them into one "emergency=true" bit meant the
 * agent never spoke the right protocol line.
 *
 * This module adds, as three independently callable, independently testable
 * surfaces (EN+ES, day-1 parity law):
 *   1. triageLifeSafety(text)        — gas / sewage / scald / flood-burst
 *                                       classification + the protocol line
 *                                       the agent must speak for each.
 *   2. handleDiagnosticFeeObjection() — detects a caller pushing back on the
 *                                       diagnostic/trip fee and returns the
 *                                       rebuttal line to speak.
 *   3. verifyPropertyAuthority()     — classifies the caller as owner /
 *                                       tenant / property_manager / unknown
 *                                       and whether they can authorize paid
 *                                       work without a third party.
 *
 * SC-PLUMB-AUDIT-P04: adversarial-persona / multi-turn stress hardening.
 * Live ASR transcripts of real callers break the three classifiers above in
 * ways a clean-text unit test never exercises:
 *   - noisy roadside audio inserts parenthetical noise tags ("(static)",
 *     "[inaudible]") and ellipsis/dash fillers for dropped audio, which can
 *     split a two-word cue like "gas leak" across a gap the regex can't
 *     bridge;
 *   - ASR output routinely drops apostrophes ("im the owner" instead of
 *     "i'm the owner"), which silently failed verifyPropertyAuthority;
 *   - a caller mid-sentence self-correction ("it's 555-123, no wait,
 *     555-1234") used to get stored verbatim, polluting the ticket field
 *     with the retracted value instead of the correction.
 * normalizeAdversarialSpeech() and resolveSpokenCorrection() below are the
 * fixes; both are applied before classification / before a field is
 * persisted to the ticket (see specialist_engines.js call sites).
 */

'use strict';

// ---------------------------------------------------------------------------
// 0) Adversarial-persona / noisy-audio normalization (SC-PLUMB-AUDIT-P04).
// Strips ASR noise tags and interrupted-speech fillers before any cue regex
// runs, so a noisy transcript like "(static) ...gas... (noise) ...leak..."
// still classifies as gas_leak instead of silently falling through to
// "no emergency detected".
// ---------------------------------------------------------------------------
function normalizeAdversarialSpeech(text) {
  let s = String(text || '');
  s = s.replace(/[(\[][^)\]]*[)\]]/g, ' '); // "(static)", "[inaudible]"
  s = s.replace(/[.]{2,}|[-–—]{2,}/g, ' '); // interrupted-speech ellipses/dashes
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

// Resolves a mid-utterance self-correction ("it's 555-123, no wait,
// 555-1234") to the caller's final, corrected value so cross-file callers
// (specialist_engines.js) persist the correction, not the retracted value.
const SPOKEN_CORRECTION_RE =
  /\b(no wait|i meant?|sorry|actually|scratch that|correction|let me correct that|perd[oó]n|digo|mejor dicho)\b/gi;

function resolveSpokenCorrection(text) {
  const input = String(text || '');
  let lastEnd = -1;
  let match;
  const re = new RegExp(SPOKEN_CORRECTION_RE);
  while ((match = re.exec(input)) !== null) {
    lastEnd = match.index + match[0].length;
  }
  if (lastEnd === -1) return input.trim();
  return input
    .slice(lastEnd)
    .replace(/^[\s,.;:!-]+/, '')
    .trim() || input.trim();
}

// ---------------------------------------------------------------------------
// 1) Life-safety triage. Order matters: gas and sewage are checked before the
// generic flood/burst cue so a call that mentions both ("burst pipe and now
// I smell gas") is classified by the more dangerous condition.
// ---------------------------------------------------------------------------
const LIFE_SAFETY_CATEGORIES = [
  {
    category: 'gas_leak',
    severity: 'critical',
    re: /\b(gas (leak|smell)|smell(ing)? gas|rotten egg smell|olor a gas|fuga de gas|huele a gas)\b/i,
    protocol: {
      en: `This is a gas-leak emergency. Leave the building now, do not use light switches or your phone inside, and call 911 or your gas utility's emergency line from outside. We're dispatching a plumber immediately in parallel.`,
      es: `Esto es una emergencia de fuga de gas. Salga del edificio ahora, no use interruptores de luz ni su teléfono dentro, y llame al 911 o a la línea de emergencia de su compañía de gas desde afuera. Estamos despachando un plomero de inmediato.`,
    },
  },
  {
    category: 'sewage_backup',
    severity: 'critical',
    re: /\b(sewage|sewer backup|aguas negras|backed? up (toilet|drain)|raw sewage|desborda(miento)? de aguas negras)\b/i,
    protocol: {
      en: `This is a sewage backup, which is a health hazard. Please keep everyone, especially children and pets, away from the affected area and do not run any water or flush toilets until the plumber arrives.`,
      es: `Esto es un retorno de aguas negras, un riesgo de salud. Mantenga a todos, especialmente niños y mascotas, alejados del área afectada y no use agua ni los baños hasta que llegue el plomero.`,
    },
  },
  {
    category: 'scald_risk',
    severity: 'critical',
    re: /\b(scald(ing)?|burn(ing|ed)? (myself|skin)|water('?s| is)? (too hot|boiling)|agua (hirviendo|demasiado caliente)|me quem[óo])\b/i,
    protocol: {
      en: `That's a scald-injury risk from the water heater. Please shut off the water heater's power or gas supply at the breaker or valve now, avoid the hot tap, and seek medical attention if anyone was burned.`,
      es: `Eso es un riesgo de quemadura por el calentador de agua. Apague la energía o el gas del calentador en el interruptor o la válvula ahora, evite la llave de agua caliente, y busque atención médica si alguien se quemó.`,
    },
  },
  {
    category: 'flood_burst',
    severity: 'urgent',
    re: /\b(burst|flood(ing)?|no water|overflow|revent[óo]|inundaci[óo]n|sin agua|desborda)\b/i,
    protocol: {
      en: `I've flagged this as an emergency and marked your request for priority dispatch. If you can safely reach it, shut off the main water valve while you wait.`,
      es: `Lo he marcado como una emergencia y su solicitud tiene despacho prioritario. Si puede llegar de forma segura, cierre la válvula principal de agua mientras espera.`,
    },
  },
];

function triageLifeSafety(text) {
  const input = normalizeAdversarialSpeech(text);
  for (const entry of LIFE_SAFETY_CATEGORIES) {
    if (entry.re.test(input)) {
      return {
        emergency: true,
        category: entry.category,
        severity: entry.severity,
        protocol: entry.protocol,
      };
    }
  }
  return { emergency: false, category: 'none', severity: 'routine', protocol: null };
}

// ---------------------------------------------------------------------------
// 2) Diagnostic-fee objection handling. Detects pushback on the trip/
// diagnostic charge and returns the rebuttal line — never waives the fee
// (no pricing authority lives in a voice script), just explains it.
// ---------------------------------------------------------------------------
const DIAGNOSTIC_FEE_OBJECTION_RE =
  /\b(why (do i|would i|should i) (have to |need to )?pay|diagnostic fee|trip fee|service call fee|waive the fee|free estimate|that'?s a rip ?off|too expensive just to (show up|look)|por qu[eé] (tengo que )?pagar|tarifa de diagn[oó]stico|cobro por venir|estimado gratis)\b/i;

function handleDiagnosticFeeObjection(text) {
  const input = normalizeAdversarialSpeech(text);
  const objectionDetected = DIAGNOSTIC_FEE_OBJECTION_RE.test(input);
  if (!objectionDetected) {
    return { objectionDetected: false, rebuttal: null };
  }
  return {
    objectionDetected: true,
    rebuttal: {
      en: `That diagnostic fee covers the technician's time and tools to accurately find the cause on-site — it's credited toward the repair cost if you move forward with the work today.`,
      es: `Esa tarifa de diagnóstico cubre el tiempo y las herramientas del técnico para encontrar la causa en el sitio, y se acredita al costo de la reparación si decide continuar con el trabajo hoy.`,
    },
  };
}

// ---------------------------------------------------------------------------
// 3) Property authority verification. A tenant cannot authorize billable
// work on someone else's property without the owner/landlord's sign-off,
// unless it's a life-safety emergency (triageLifeSafety already fired) —
// in that case we still dispatch, we just flag that billing needs the
// property owner on file before the invoice is finalized.
// ---------------------------------------------------------------------------
const AUTHORITY_PATTERNS = [
  ['owner', /\b(i own (it|the (house|home|property|building))|i'?m the owner|soy el? due[ñn][oa]|yo soy propietari[oa])\b/i],
  ['property_manager', /\b(property manager|i manage (this|the) (property|building)|administrador(a)? de la propiedad|gestor de la propiedad)\b/i],
  ['tenant', /\b(i rent|i'?m (a )?tenant|i lease|renting here|soy inquilino|soy arrendatari[oa]|rento aqu[ií])\b/i],
];

function verifyPropertyAuthority(text) {
  const input = normalizeAdversarialSpeech(text);
  for (const [role, re] of AUTHORITY_PATTERNS) {
    if (re.test(input)) {
      return {
        role: role,
        canAuthorizeBilling: role !== 'tenant',
        requiresOwnerSignoff: role === 'tenant',
      };
    }
  }
  return { role: 'unknown', canAuthorizeBilling: true, requiresOwnerSignoff: false };
}

module.exports = {
  LIFE_SAFETY_CATEGORIES,
  triageLifeSafety,
  handleDiagnosticFeeObjection,
  verifyPropertyAuthority,
  normalizeAdversarialSpeech,
  resolveSpokenCorrection,
};
