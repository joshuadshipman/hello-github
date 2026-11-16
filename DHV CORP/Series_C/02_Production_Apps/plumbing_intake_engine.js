'use strict';
/**
 * plumbing_intake_engine.js — P0 Life-Safety, Adversarial Speech, Authority & Fee Handler
 * =======================================================================================
 * Enforces Gate 2 (Safety Triage & Human De-Escalation) & Gate 3 (Zero False Confidence):
 *  1. Life-safety triage across 5 critical hazards (gas_leak, electrical_water_hazard,
 *     sewage_backup, scald_risk, flood_burst) plus immediate human de-escalation transfer.
 *  2. Zero diagnosis, zero repair pricing, zero unproved dispatch/arrival promises, and
 *     strictly conditional shutoff guidance ("only if in a dry, safe location").
 *  3. Adversarial ASR normalization & mid-sentence correction resolution.
 *  4. Fail-closed property authority verification (`canAuthorizeBilling: false` for unknown roles).
 *  5. Shop-policy-gated diagnostic fee objection handling.
 */

const LIFE_SAFETY_CATEGORIES = {
  gas_leak: {
    priority: 1,
    immediateTransfer: true,
    transferToHuman: true,
    patterns: [
      /\b(smell\s+gas|gas\s+leak|gas\s+odor|rotten\s+egg|hiss(?:ing)?\s+gas|natural\s+gas\s+smell|pilot\s+out\s+smell\s+gas|fuga\s+de\s+gas|olor\s+a\s+gas|huele\s+a\s+gas|huevos\s+podridos)\b/i
    ],
    action: 'evacuate_and_call_911_transfer_human',
    script: {
      en: "STOP — if you smell gas or hear a hiss, please evacuate everyone from the building immediately. Do not flip any light switches, use appliances, or strike flames. Once you are safely outside, call 911 or your gas utility first. I am transferring this call to our on-call human staff right now.",
      es: "ALTO — si huele a gas o escucha un silbido, evacúe a todas las personas del edificio de inmediato. No toque interruptores de luz ni aparatos. Cuando esté afuera en un lugar seguro, llame primero al 911 o a su compañía de gas. Estoy transfiriendo esta llamada a nuestro personal de guardia ahora mismo."
    }
  },
  electrical_water_hazard: {
    priority: 1,
    immediateTransfer: true,
    transferToHuman: true,
    patterns: [
      /\b(water\s+(?:near|touching|in|hitting|around|by|reaching)\s+(?:the\s+)?(?:electrical|outlet|outlets|breaker|panel|wires|wiring|switch|fuse)|sparks?\s+near\s+water|flooding\s+near\s+(?:breaker|panel|outlet|electrical)|agua\s+(?:cerca|tocando|en)\s+(?:enchufes?|panel|pastillas|cables|electricidad))\b/i
    ],
    action: 'stay_clear_of_water_call_911_transfer_human',
    script: {
      en: "For your safety, do not step into standing water or touch any electrical panels, outlets, or valves near water. Please stay clear of the area, call 911 if there is sparking or smoke, and hold while I connect you directly to our on-call human staff.",
      es: "Por su seguridad, no pise el agua acumulada ni toque paneles eléctricos, enchufes o válvulas cerca del agua. Manténgase alejado del área, llame al 911 si hay chispas o humo, y espere mientras lo comunico directamente con nuestro personal de guardia."
    }
  },
  sewage_backup: {
    priority: 1,
    immediateTransfer: true,
    transferToHuman: true,
    patterns: [
      /\b(raw\s+sewage|sewer\s+back(?:ing|ed)?\s+up|black\s*water|feces|sewage\s+coming\s+up|toilet\s+overflowing\s+sewage|main\s+drain\s+backing\s+up|aguas\s+negras|drenaje\s+regresando|alcantarillado\s+desbordando)\b/i
    ],
    action: 'biohazard_containment_transfer_human',
    script: {
      en: "Active sewage backup is a health hazard. Please stop using all water fixtures, toilets, and washing machines immediately, and keep children and pets out of the affected area. I am escalating your request to our on-call staff right now.",
      es: "El retorno de aguas negras es un riesgo sanitario. Deje de usar todos los grifos, inodoros y lavadoras de inmediato, y mantenga a los niños y mascotas fuera del área afectada. Estoy escalando su solicitud a nuestro personal de guardia en este momento."
    }
  },
  scald_risk: {
    priority: 1,
    immediateTransfer: true,
    transferToHuman: true,
    patterns: [
      /\b(scalding\s+water|boiling\s+water\s+from\s+tap|steam\s+coming\s+out\s+of\s+faucet|t&p\s+valve\s+blowing\s+steam|pressure\s+relief\s+valve\s+spraying\s+hot|agua\s+hirviendo|vapor\s+saliendo|riesgo\s+de\s+quemadura)\b/i
    ],
    action: 'scald_stand_clear_transfer_human',
    script: {
      en: "Scalding water or steam is an immediate burn hazard. Please step back from the fixture or steam, keep everyone clear of the area, and only if your main cold-water shutoff valve is in a dry, safe location away from steam or electricity, you may turn it off. I am connecting you to our on-call staff now.",
      es: "El agua muy caliente o el vapor representa un riesgo inmediato de quemaduras. Aléjese de la llave o del vapor, mantenga a todos fuera del área, y solo si la llave de paso de agua fría está en un lugar seco y seguro lejos del vapor o la electricidad, puede cerrarla. Lo estoy comunicando con nuestro personal de guardia ahora."
    }
  },
  flood_burst: {
    priority: 1,
    immediateTransfer: true,
    transferToHuman: true,
    patterns: [
      /\b(pipe\s+burst|burst\s+pipe|flooding\s+the\s+(?:house|floor|basement|kitchen)|water\s+pouring\s+through\s+ceiling|ceiling\s+collaps(?:ing|ed)|uncontrollable\s+leak|gushing\s+water|tuber[íi]a\s+reventada|inundando\s+la\s+casa|agua\s+cayendo\s+del\s+techo)\b/i
    ],
    action: 'shutoff_main_water_if_safe_transfer_human',
    script: {
      en: "To help limit water damage right now: only if your main water shut-off valve is in a dry, safe location away from standing water or electrical panels, turn it clockwise to shut off the water. I am connecting your call to our on-call staff right now.",
      es: "Para ayudar a limitar el daño por agua: solo si la llave de paso principal está en un lugar seco y seguro lejos de agua acumulada o paneles eléctricos, gírela hacia la derecha para cerrar el agua. Estoy conectando su llamada con nuestro personal de guardia ahora mismo."
    }
  }
};

const HUMAN_ESCALATION_PATTERNS = /\b(speak\s+to\s+(?:a\s+)?(?:human|person|someone|operator|representative|dispatcher|manager|supervisor|real\s+plumber)|talk\s+to\s+(?:a\s+)?(?:human|person|someone|operator|representative|dispatcher)|transfer\s+me|real\s+person|live\s+(?:person|operator|agent)|hablar\s+con\s+(?:una\s+persona|un\s+humano|un\s+operador|un\s+representante|alguien)|operador\s+en\s+vivo)\b/i;

/**
 * Evaluate caller utterance for life-safety emergencies OR human de-escalation requests.
 * Runs before every state transition across all plumbing intake engines.
 */
function triageLifeSafety(utterance, lang = 'en') {
  const text = String(utterance || '').trim();
  const l = lang === 'es' ? 'es' : 'en';
  if (!text) return { emergency: false, humanEscalation: false, category: null, immediateTransfer: false };

  for (const [key, cfg] of Object.entries(LIFE_SAFETY_CATEGORIES)) {
    if (cfg.patterns.some((rx) => rx.test(text))) {
      return {
        emergency: true,
        humanEscalation: true,
        category: key,
        priority: cfg.priority,
        immediateTransfer: cfg.immediateTransfer,
        transferToHuman: true,
        action: cfg.action,
        response: cfg.script[l]
      };
    }
  }

  if (HUMAN_ESCALATION_PATTERNS.test(text)) {
    return {
      emergency: false,
      humanEscalation: true,
      category: 'human_deescalation',
      priority: 1,
      immediateTransfer: true,
      transferToHuman: true,
      action: 'transfer_to_on_call_human',
      response: l === 'es'
        ? "Con gusto. En este momento estoy transfiriendo su llamada directamente a nuestro personal de guardia del taller."
        : "Of course. I am transferring your call directly to our shop's on-call staff right now."
    };
  }

  return { emergency: false, humanEscalation: false, category: null, immediateTransfer: false };
}

/**
 * Normalize noisy/adversarial ASR speech (numbers, street ordinals, plumbing terms, fillers).
 */
function normalizeAdversarialSpeech(rawUtterance) {
  if (!rawUtterance || typeof rawUtterance !== 'string') return '';
  let cleaned = rawUtterance
    .replace(/\b(uh+|um+|er+|ah+|like\s+uh|you\s+know)\b/gi, ' ')
    .replace(/\[(?:noise|static|cough|background|inaudible)\]/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const corrections = [
    [/\bpv\s+see\b/gi, 'PVC'],
    [/\bpex\s+pipe\b/gi, 'PEX pipe'],
    [/\bsump\s+pump\b/gi, 'sump pump'],
    [/\bwater\s+healer\b/gi, 'water heater'],
    [/\bslab\s+week\b/gi, 'slab leak'],
    [/\bsewer\s+playing\b/gi, 'sewer main']
  ];
  for (const [rx, replacement] of corrections) {
    cleaned = cleaned.replace(rx, replacement);
  }
  return cleaned;
}

/**
 * Handle mid-sentence self-corrections (e.g. "124 Oak St—wait no, 142 Oak St").
 */
function resolveSpokenCorrection(utterance) {
  const normalized = normalizeAdversarialSpeech(utterance);
  const pivotRx = /\b(?:wait\s+no|no\s+wait|actually\s+it'?s|sorry\s+i\s+meant|i\s+mean|scratch\s+that|perd[oó]n\s+es|mejor\s+dicho)\b[,:\s]*/i;
  if (pivotRx.test(normalized)) {
    const parts = normalized.split(pivotRx).map((s) => s.trim()).filter(Boolean);
    return {
      corrected: true,
      original: parts[0] || normalized,
      finalValue: parts[parts.length - 1] || normalized
    };
  }
  return {
    corrected: false,
    original: normalized,
    finalValue: normalized
  };
}

/**
 * Handle diagnostic/dispatch fee objections using shop-configured policy only.
 * Never invents repair pricing or promises fee waivers not configured by the shop.
 */
function handleDiagnosticFeeObjection(utterance, lang = 'en', options = {}) {
  const text = String(utterance || '');
  const l = lang === 'es' ? 'es' : 'en';
  const isObjection = /\b(free\s+estimate|why\s+is\s+there\s+a\s+fee|waive\s+the\s+fee|dispatch\s+fee|service\s+call\s+fee|too\s+expensive|how\s+much\s+just\s+to\s+come\s+out|cobran\s+por\s+ir|presupuesto\s+gratis)\b/i.test(text);
  if (!isObjection) return { triggered: false };

  const feePolicy = options && options.feePolicy;
  if (feePolicy && feePolicy.verified === true && typeof feePolicy.amountNumber === 'number') {
    const creditClauseEn = feePolicy.creditTowardRepair
      ? ' Per shop policy, that fee is credited toward approved repair work.'
      : '';
    const creditClauseEs = feePolicy.creditTowardRepair
      ? ' Según la política del taller, ese cargo se acredita al trabajo de reparación aprobado.'
      : '';
    return {
      triggered: true,
      policyBacked: true,
      response: l === 'es'
        ? `El cargo de visita diagnóstica del taller es de $${feePolicy.amountNumber} para que un plomero con licencia evalúe el problema en el lugar y le entregue un presupuesto exacto antes de iniciar cualquier trabajo.${creditClauseEs} ¿Desea que enviemos su solicitud al personal del taller?`
        : `The shop's diagnostic visit fee is $${feePolicy.amountNumber} for a licensed plumber to inspect the issue on-site and provide an upfront written quote before any work begins.${creditClauseEn} Would you like me to forward your request to the shop's staff?`
    };
  }

  return {
    triggered: true,
    policyBacked: false,
    response: l === 'es'
      ? "Como asistente de recepción, no doy precios ni cotizaciones por teléfono; el plomero con licencia le confirmará cualquier cargo de visita diagnóstica y el presupuesto exacto antes de realizar cualquier trabajo. ¿Desea que registre su solicitud o lo comunique con el personal del taller?"
      : "As an intake assistant, I do not diagnose or quote prices over the phone; the shop's licensed plumber will confirm any diagnostic visit fee and provide an upfront quote before any work begins. Would you like me to log your request or connect you with the shop's staff?"
  };
}

/**
 * Verify property authority (homeowner vs. tenant/renter/property manager).
 * Fails closed (`canAuthorizeBilling: false`) when role is tenant or unknown.
 */
function verifyPropertyAuthority(utterance, lang = 'en') {
  const text = String(utterance || '').toLowerCase();
  const l = lang === 'es' ? 'es' : 'en';

  if (/\b(tenant|renter|renting|landlord|leasing|apartment|inquilino|rentando|arrendatario)\b/.test(text)) {
    return {
      role: 'tenant',
      canAuthorizeEmergencyContainment: true,
      canAuthorizeBilling: false,
      requiresOwnerApproval: true,
      prompt: l === 'es'
        ? "Entendido, anoté que usted es inquilino. Podemos registrar la emergencia ahora mismo, pero necesitaremos el nombre y teléfono del propietario o administrador para autorizar cualquier trabajo en el lugar."
        : "Got it — I've noted that you're the tenant. We can log the emergency request right now, and we will also need the landlord or property manager's name and phone number to authorize any on-site work."
    };
  }

  if (/\b(property\s+manager|management\s+company|commercial\s+manager|facilities|administrador)\b/.test(text)) {
    return {
      role: 'property_manager',
      canAuthorizeEmergencyContainment: true,
      canAuthorizeBilling: true,
      requiresOwnerApproval: false,
      prompt: l === 'es'
        ? "Perfecto, registré su autorización como administrador de la propiedad. ¿Cuál es el límite de orden de trabajo preaprobado o número de PO si aplica?"
        : "Perfect — I've logged you as the authorized property manager. Please share any purchase-order or pre-approved NTE limit if applicable."
    };
  }

  if (/\b(owner|homeowner|my\s+house|my\s+home|i\s+own|propietario|due[ñn]o|mi\s+casa)\b/.test(text)) {
    return {
      role: 'homeowner',
      canAuthorizeEmergencyContainment: true,
      canAuthorizeBilling: true,
      requiresOwnerApproval: false,
      prompt: null
    };
  }

  // Fail closed on unknown role: never assume billing authority without confirmation
  return {
    role: 'unknown',
    canAuthorizeEmergencyContainment: true,
    canAuthorizeBilling: false,
    requiresOwnerApproval: true,
    prompt: l === 'es'
      ? "Para el registro del taller, ¿es usted el propietario del inmueble o inquilino?"
      : "For the shop's service record, are you the property owner or a tenant?"
  };
}

module.exports = {
  LIFE_SAFETY_CATEGORIES,
  HUMAN_ESCALATION_PATTERNS,
  triageLifeSafety,
  normalizeAdversarialSpeech,
  resolveSpokenCorrection,
  handleDiagnosticFeeObjection,
  verifyPropertyAuthority
};
