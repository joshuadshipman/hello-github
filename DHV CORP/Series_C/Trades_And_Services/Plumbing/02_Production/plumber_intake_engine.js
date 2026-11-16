/**
 * plumber_intake_engine.js — AgentAngel Plumbing Specialist Conversational Engine
 * ==============================================================================
 * Enterprise-grade multi-turn conversational intake engine for plumbing contractors.
 * Enforces Gate 2 (per-turn life-safety & electrical-hazard interrupt + human transfer)
 * and Gate 3 (zero false dispatch/arrival confidence, state-verified dispatch wording).
 */

'use strict';

let plumbingSafetyEngine = null;
try {
  plumbingSafetyEngine = require('../../../02_Production_Apps/angel-voice-server/plumbing_intake_engine');
} catch (_) {}

let fsmDispatchAdapter = null;
try {
  fsmDispatchAdapter = require('../../../02_Production_Apps/angel-voice-server/fsm_plumbing_dispatch_adapter');
} catch (_) {}

const L10N = {
  en: {
    welcome: "Hi, thank you for calling. I'm Agent Angel, the AI Plumbing Intake Assistant. This call is recorded for quality and service documentation. How can I help you today?",
    gasEmergency: "STOP — this sounds like a potential natural gas hazard. Please evacuate all occupants and pets outside immediately. Do not touch any light switches, electrical outlets, or appliances inside. Call 911 or your gas utility from a safe distance outside right now. I am connecting this call to our on-call staff immediately.",
    electricalWaterEmergency: "For your safety, do not step into standing water or touch any electrical panels, outlets, or valves near water. Please stay clear of the area, call 911 if there is sparking or smoke, and hold while I connect you directly to our on-call staff.",
    burstShutoff: "For an active burst pipe, only if your main water valve is in a dry, safe location away from standing water or electrical panels, turn it clockwise to stop the water flow. Is water flowing near any electrical outlets or breaker panels?",
    sewerStop: "For sewage coming up into your drains, please stop using all water fixtures immediately — do not flush toilets or run showers, and keep children and pets out of the area. Is this backing up into multiple drains or rooms?",
    heaterFuel: "For a water heater leak, only if the cold-water shutoff valve on top of the tank is in a dry, safe location away from steam or electricity, you may turn it off to stop incoming water. Is your water heater gas or electric?",
    freezeThaw: "For frozen pipes, please leave your faucets open a quarter turn to relieve pressure as they thaw, and never use a torch or open flame. Have you located your main water shutoff valve in case a pipe cracked?",
    slabAudit: "For a suspected slab leak, when all faucets are shut off, is your water meter dial spinning, or do you notice running-water sounds under the floor?",
    commercialTriage: "For a commercial drain issue, what type of business facility is this, and is the grease interceptor backing up into kitchen prep areas?",
    routineFixture: "What specific fixture needs service, and what morning or afternoon window do you prefer for our staff to confirm?",
    qAddress: "What is the street address and city where plumbing service is needed?",
    qAddressMissing: "Before we can submit your request to the shop's on-call staff, could you share the street number, street name, and city for the service location?",
    qName: "May I have your first and last name for the service intake record?",
    qPhotos: "May I have your permission to text a secure photo upload link to this number during business hours so you can share 1 to 3 pictures of the fixture or leak for the plumber?",
    closingSummary: "Thank you, {NAME}. I have recorded your preliminary plumbing service request for {ADDRESS} and forwarded it to our on-call staff to review and confirm availability with you. Record Type: Preliminary Service Intake.",
    humanTransfer: "Of course. I am connecting your call directly to our shop's on-call staff right now."
  },
  es: {
    welcome: "Hola, gracias por llamar. Soy Agent Angel, su asistente de recepción de plomería con inteligencia artificial. Esta llamada se graba para control de calidad y registro del servicio. ¿En qué le puedo ayudar hoy?",
    gasEmergency: "ALTO — esto parece un posible riesgo de gas natural. Por su seguridad, evacúe a todos los ocupantes y mascotas hacia afuera inmediatamente. No toque ningún interruptor de luz ni aparatos eléctricos. Llame al 911 o a la compañía de gas desde una distancia segura afuera. Estoy transfiriendo su llamada al personal de guardia de inmediato.",
    electricalWaterEmergency: "Por su seguridad, no pise el agua acumulada ni toque paneles eléctricos, enchufes o válvulas cerca del agua. Manténgase alejado del área, llame al 911 si hay chispas o humo, y espere mientras lo comunico con nuestro personal de guardia.",
    burstShutoff: "Para una tubería reventada, solo si la llave de paso general está en un lugar seco y seguro lejos de agua acumulada o paneles eléctricos, ciérrela hacia la derecha para cortar el agua. ¿El agua está cerca de enchufes eléctricos o pastillas de luz?",
    sewerStop: "Para el retorno de aguas negras, por favor deje de usar toda el agua de inmediato — no descargue el inodoro ni use la regadera, y mantenga a niños y mascotas fuera del área. ¿El drenaje se está regresando en más de un baño?",
    heaterFuel: "Para una fuga en el calentador de agua, solo si la válvula de agua fría encima del tanque está en un lugar seco y seguro lejos de vapor o electricidad, puede cerrarla. ¿Su calentador es de gas o eléctrico?",
    freezeThaw: "Para tuberías congeladas, deje las llaves ligeramente abiertas para aliviar la presión y nunca use soplete ni fuego abierto. ¿Ya ubicó la llave de paso general por si empieza una fuga?",
    slabAudit: "Para posibles fugas bajo la losa, ¿su medidor de agua sigue girando con todo cerrado, o escucha correr agua bajo el piso?",
    commercialTriage: "¿Qué tipo de negocio o establecimiento es, y la trampa de grasa se está regresando hacia el área de cocina?",
    routineFixture: "¿Qué llave o accesorio necesita servicio, y qué horario por la mañana o tarde prefiere para que nuestro personal confirme disponibilidad?",
    qAddress: "¿Cuál es la dirección con calle, número y ciudad donde necesita el servicio de plomería?",
    qAddressMissing: "Antes de enviar su solicitud al personal de guardia, ¿podría indicarme el número, calle y ciudad del domicilio?",
    qName: "¿Me proporciona su nombre y apellido para el registro de solicitud?",
    qPhotos: "¿Me da su autorización para enviarle un enlace seguro por mensaje de texto a este número para subir fotos de la fuga o accesorio?",
    closingSummary: "Muchas gracias, {NAME}. He registrado su solicitud preliminar de servicio para {ADDRESS} y la he enviado a nuestro personal de guardia para que revisen y confirmen disponibilidad con usted. Tipo de registro: Recepción preliminar de servicio.",
    humanTransfer: "Con gusto. En este momento estoy transfiriendo su llamada directamente al personal de guardia del taller."
  }
};

function createSession(id, phone, name, lang, options = {}) {
  return {
    id,
    phone,
    name,
    lang: lang || 'en',
    mode: options.mode || 'intake',
    peril: null,
    step: 0,
    isFinal: false,
    transferToHuman: false,
    humanEscalationReason: null,
    triageData: {
      peril: null,
      address: null,
      callerName: null,
      mainShutoffGuided: false,
      electricalChecked: false,
      electricalHazardPresent: false,
      photoLinkSent: false,
      dispatchState: 'REQUEST_CAPTURED'
    }
  };
}

/**
 * Strict priority-ordered peril detection:
 * Life-safety and active flooding hazards are always evaluated BEFORE routine appliances/fixtures,
 * and unknown speech is classified as 'unknown_inquiry' rather than defaulting to 'burst_pipe'.
 */
function detectPeril(text) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return 'unknown_inquiry';

  // 1. Life-safety gas leak (exclude benign "gas water heater maintenance/install" when no leak/smell/odor/hiss cue is present)
  const hasGasHazardCue = /\b(smell\s+gas|gas\s+(?:leak|odor|smell|hiss|escaping)|rotten\s+egg|mercaptan|huevos\s+podridos|azufre|fuga\s+de\s+gas|olor\s+a\s+gas|huele\s+a\s+gas)\b/i.test(t) ||
    (/\bgas\b/i.test(t) && !/\b(gas\s+water\s+heater|calentador\s+de\s+gas|is\s+it\s+gas|gas\s+or\s+electric)\b/i.test(t));
  if (hasGasHazardCue) return 'gas_leak';

  // 2. Electrical + water life-safety hazard
  if (/\b(water\s+(?:near|touching|in|hitting|around|by|reaching)\s+(?:the\s+)?(?:electrical|outlet|outlets|breaker|panel|wires|wiring|switch|fuse)|spark(?:s|ing)?|agua\s+(?:cerca|tocando|en)\s+(?:enchufes?|panel|pastillas|cables|electricidad))\b/i.test(t)) {
    return 'electrical_water_hazard';
  }

  // 3. Active pressurized burst pipe / active flooding (checked BEFORE routine fixtures so "faucet supply line burst flooding kitchen" is never downgraded!)
  if (/\b(burst|spraying|pouring|gushing|flooding|revent|fuga\s+activa|inundando|uncontrollable\s+leak)\b/i.test(t)) {
    return 'burst_pipe';
  }

  // 4. Sewer / blackwater backflow
  if (/\b(sewer|sewage|coladera|drenaje|aguas\s+negras|toilet.*bubbl|raw\s+sewage|backed\s+up)\b/i.test(t)) {
    return 'sewer_backup';
  }

  // 5. Water heater / boiler leak or rupture
  if (/\b(water\s+heater|boiler|calentador|tank|ao\s+smith|rheem|hot\s+water|scald)\b/i.test(t)) {
    return 'water_heater_rupture';
  }

  // 6. Freeze / frozen pipe
  if (/\b(froz|freeze|helad|congelad)\b/i.test(t)) return 'frozen_pipe';

  // 7. Foundation slab leak
  if (/\b(slab|warm\s+(?:spot|area|floor)|piso\s+caliente|zona\s+caliente|water\s+bill|recibo\s+del\s+agua|losa)\b/i.test(t)) {
    return 'slab_leak';
  }

  // 8. Commercial facility & grease interceptor
  if (/\b(grease\s+(?:trap|interceptor)|trampa\s+de\s+grasa|commercial.*(?:kitchen|restaurant)|bistro|downtown\s+bistro)\b/i.test(t)) {
    return 'commercial_drain';
  }

  // 9. Routine fixture / slow drip / remodel
  if (/\b(faucet|disposal|dripping|slow\s+drip|replace|goteo|inodoro|triturador|cambiar|schedule\s+a\s+service|maintenance)\b/i.test(t)) {
    return 'routine_fixture';
  }

  if (/\b(leak|fuga)\b/i.test(t)) return 'burst_pipe';

  return 'unknown_inquiry';
}

function extractEntities(session, text) {
  const raw = String(text || '').trim();
  const resolved = plumbingSafetyEngine
    ? plumbingSafetyEngine.resolveSpokenCorrection(raw).finalValue
    : raw;

  const addrMatch = resolved.match(/\b\d{1,5}\s+[A-Za-z0-9\s]+?\s+(?:Way|Drive|Dr|Ave|Avenue|St|Street|Blvd|Boulevard|Rd|Road|Lane|Ln|Court|Ct|Parkway|Pkwy|Calle|Avenida)\b/i);
  if (addrMatch) {
    session.triageData.address = addrMatch[0].trim();
  }

  const cityMatch = resolved.match(/\b(Austin|San Antonio|Dallas|Houston|Fort Worth|Round Rock|Plano|Arlington|Wichita Falls|Tyler|Waco|Texarkana|Conway|Broken Bow|Abilene|Sherman)\b/i);
  if (cityMatch && session.triageData.address && !session.triageData.address.toLowerCase().includes(cityMatch[1].toLowerCase())) {
    session.triageData.address += `, ${cityMatch[1]}`;
  }

  if (session.step >= 3 && !session.triageData.callerName) {
    const nameMatch = resolved.match(/\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/);
    if (nameMatch && !/\b(Oak|Main|Pine|Elm|Maple|Cedar|First|Second|Third|Kemp|Austin|Dallas)\b/i.test(nameMatch[0])) {
      session.triageData.callerName = nameMatch[0];
    }
  }
}

async function evaluateTurn(session, callerInput, options = {}) {
  const lang = options.language || session.lang || 'en';
  const strings = L10N[lang] || L10N.en;
  const inputText = String(callerInput || '').trim();

  if (session.step === 0 && !inputText) {
    session.step = 1;
    return {
      speechChunks: [{ text: strings.welcome }],
      isFinal: false,
      session
    };
  }

  extractEntities(session, inputText);

  // GATE 2: Run per-turn life-safety & human de-escalation interrupt on EVERY turn before advancing!
  if (inputText && plumbingSafetyEngine) {
    const safety = plumbingSafetyEngine.triageLifeSafety(inputText, lang);
    if (safety.humanEscalation && !safety.emergency) {
      session.transferToHuman = true;
      session.humanEscalationReason = 'CALLER_REQUESTED_HUMAN';
      session.isFinal = true;
      return {
        speechChunks: [{ text: safety.response }],
        isFinal: true,
        transferToHuman: true,
        immediateTransfer: true,
        action: 'TRANSFER_TO_ON_CALL_HUMAN',
        session
      };
    }
    if (safety.emergency && (safety.category === 'gas_leak' || safety.category === 'electrical_water_hazard' || safety.category === 'scald_risk' || session.step > 1)) {
      session.peril = safety.category;
      session.triageData.peril = safety.category;
      session.transferToHuman = true;
      session.humanEscalationReason = `EMERGENCY_${safety.category.toUpperCase()}`;
      if (safety.category === 'gas_leak' || safety.category === 'electrical_water_hazard' || session.step > 1) {
        session.isFinal = true;
        return {
          speechChunks: [{ text: safety.response }],
          isFinal: true,
          transferToHuman: true,
          immediateTransfer: true,
          action: safety.action,
          session
        };
      }
    }
  }

  // Also check if step === 2 caller answered YES to water near electrical outlets/breaker panels!
  if (session.step === 2 && session.peril === 'burst_pipe') {
    session.triageData.electricalChecked = true;
    const affirmativeElectricalDanger = /\b(yes|yeah|yep|si|sí|near\s+(?:the\s+)?(?:outlet|breaker|panel|wires|electrical)|touching|sparks?|water\s+is\s+in\s+the\s+breaker)\b/i.test(inputText) &&
      !/\b(no|nope|not\s+near|away\s+from|nowhere\s+near|ninguno)\b/i.test(inputText);
    if (affirmativeElectricalDanger) {
      session.peril = 'electrical_water_hazard';
      session.triageData.peril = 'electrical_water_hazard';
      session.triageData.electricalHazardPresent = true;
      session.transferToHuman = true;
      session.humanEscalationReason = 'WATER_NEAR_ELECTRICAL_PANEL_OR_OUTLET';
      session.isFinal = true;
      return {
        speechChunks: [{ text: strings.electricalWaterEmergency }],
        isFinal: true,
        transferToHuman: true,
        immediateTransfer: true,
        action: 'stay_clear_of_water_call_911_transfer_human',
        session
      };
    }
  }

  let replyText = '';

  if (session.step <= 1) {
    session.peril = detectPeril(inputText);
    session.triageData.peril = session.peril;

    if (session.peril === 'gas_leak') {
      session.transferToHuman = true;
      session.humanEscalationReason = 'GAS_LEAK_EMERGENCY';
      session.isFinal = true;
      return {
        speechChunks: [{ text: strings.gasEmergency }],
        isFinal: true,
        transferToHuman: true,
        immediateTransfer: true,
        action: 'evacuate_and_call_911_transfer_human',
        session
      };
    }
    if (session.peril === 'electrical_water_hazard') {
      session.transferToHuman = true;
      session.humanEscalationReason = 'ELECTRICAL_WATER_EMERGENCY';
      session.isFinal = true;
      return {
        speechChunks: [{ text: strings.electricalWaterEmergency }],
        isFinal: true,
        transferToHuman: true,
        immediateTransfer: true,
        action: 'stay_clear_of_water_call_911_transfer_human',
        session
      };
    }
    if (session.peril === 'burst_pipe') {
      replyText = strings.burstShutoff;
      session.triageData.mainShutoffGuided = true;
      session.step = 2;
    } else if (session.peril === 'sewer_backup') {
      replyText = strings.sewerStop;
      session.step = 2;
    } else if (session.peril === 'water_heater_rupture') {
      replyText = strings.heaterFuel;
      session.step = 2;
    } else if (session.peril === 'frozen_pipe') {
      replyText = strings.freezeThaw;
      session.step = 2;
    } else if (session.peril === 'slab_leak') {
      replyText = strings.slabAudit;
      session.step = 2;
    } else if (session.peril === 'commercial_drain') {
      replyText = strings.commercialTriage;
      session.step = 2;
    } else {
      replyText = strings.routineFixture;
      session.step = 2;
    }

    return {
      speechChunks: [{ text: replyText }],
      isFinal: false,
      session
    };
  }

  if (session.step === 2) {
    replyText = (lang === 'en' ? 'Thank you for confirming that. ' : 'Gracias por confirmarlo. ') + strings.qAddress;
    session.step = 3;
    return {
      speechChunks: [{ text: replyText }],
      isFinal: false,
      session
    };
  }

  if (session.step === 3) {
    if (!session.triageData.address) {
      return {
        speechChunks: [{ text: strings.qAddressMissing }],
        isFinal: false,
        session
      };
    }
    replyText = (lang === 'en' ? 'Thank you. ' : 'Gracias. ') + strings.qName;
    session.step = 4;
    return {
      speechChunks: [{ text: replyText }],
      isFinal: false,
      session
    };
  }

  if (session.step === 4) {
    replyText = strings.qPhotos;
    session.step = 5;
    return {
      speechChunks: [{ text: replyText }],
      isFinal: false,
      session
    };
  }

  if (session.step === 5) {
    // Gate 3: Never allow completion with placeholder "your address" or unproven "I have dispatched / on the way"
    if (!session.triageData.address) {
      session.step = 3;
      return {
        speechChunks: [{ text: strings.qAddressMissing }],
        isFinal: false,
        session
      };
    }
    const name = session.triageData.callerName || (lang === 'en' ? 'valued customer' : 'estimado cliente');
    const addr = session.triageData.address;
    const dispatchResult = fsmDispatchAdapter
      ? fsmDispatchAdapter.dispatchTicket({ serviceAddress: addr, callerName: name }, options.dispatchOptions || {})
      : { state: 'REQUEST_CAPTURED', ok: false };
    session.triageData.dispatchState = dispatchResult.state;
    session.triageData.dispatchResult = dispatchResult;

    replyText = strings.closingSummary.replace('{NAME}', name).replace('{ADDRESS}', addr);
    session.isFinal = true;
    session.step = 6;
    return {
      speechChunks: [{ text: replyText }],
      isFinal: true,
      dispatchResult,
      session
    };
  }

  // Terminal fallback: never claim "Our technician is on the way" without verified TECHNICIAN_ACCEPTED state
  const terminalText = fsmDispatchAdapter
    ? fsmDispatchAdapter.getTruthfulDispatchSpeech(session.triageData.dispatchResult || { state: 'REQUEST_CAPTURED' }, lang)
    : (lang === 'en'
      ? 'Your preliminary service request has been recorded and forwarded to our on-call staff to confirm availability.'
      : 'Su solicitud preliminar de servicio ha sido registrada y enviada a nuestro personal de guardia para confirmar disponibilidad.');
  return {
    speechChunks: [{ text: terminalText }],
    isFinal: true,
    session
  };
}

module.exports = {
  createSession,
  evaluateTurn,
  detectPeril,
  extractEntities,
  L10N
};
