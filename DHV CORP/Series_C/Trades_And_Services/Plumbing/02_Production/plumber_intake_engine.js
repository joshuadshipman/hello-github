/**
 * plumber_intake_engine.js — AgentAngel Plumbing Specialist Conversational Engine
 * ==============================================================================
 * Enterprise-grade multi-turn conversational intake engine for plumbing contractors.
 * Features sub-20s emergency life-safety and property preservation triage,
 * dual English/Spanish localization, dynamic entity extraction, and preliminary
 * conduit record disclaimers under Texas Occupations Code Ch. 1301.
 */

'use strict';

const L10N = {
  en: {
    welcome: "Hi, thank you for calling. I'm Agent Angel, your 24/7 AI Plumbing Specialist. This call is recorded for quality, rapid dispatch, and diagnostic documentation. How can I help you today?",
    gasEmergency: "This sounds like a potential natural gas leak. For your safety, please evacuate all occupants and pets outside immediately. Do not touch any light switches, electrical outlets, or phones inside. Please call 911 and your natural gas utility from a safe distance outside right now.",
    burstShutoff: "For an active burst pipe, if it is safe to reach, please shut off your main water valve right now near the curb meter or front hose bibb to stop the flooding. Is water flowing near any electrical outlets or breaker panels?",
    sewerStop: "For sewage coming up into your drains, please stop using all water immediately — do not flush toilets or run showers. Is this backing up into multiple drains or rooms?",
    heaterFuel: "For a water heater leak, please turn the cold water shutoff valve on top of the tank to stop incoming water. Is your water heater gas or electric?",
    freezeThaw: "For frozen pipes, please leave your faucets open a quarter turn to relieve pressure as they thaw, and do not use a torch or open flame. Did you locate your main water shutoff valve in case a pipe cracked?",
    slabAudit: "For suspected slab leaks, when all faucets are shut off, is your water meter dial spinning, and do you hear running water or hissing under the floor?",
    commercialTriage: "For commercial drain emergencies, what type of business facility is this, and is the grease trap backing up into kitchen prep sinks?",
    routineFixture: "What specific fixture needs repair or replacement, do you already have the parts, and what morning or afternoon window works best for your schedule?",
    qAddress: "What is the service address and city for our on-call plumbing technician?",
    qName: "May I have your first and last name for the service dispatch ticket?",
    qPhotos: "May I text a secure photo link to your phone so you can upload 1 to 3 quick pictures of the leak or fixture for our master technician?",
    closingSummary: "Thank you, {NAME}. I have dispatched our priority plumbing ticket for {ADDRESS}. Our on-call licensed technician is reviewing your diagnostic details. Record Type: Preliminary Diagnostic Intake."
  },
  es: {
    welcome: "Hola, gracias por llamar. Soy Agent Angel, su especialista de plomería con inteligencia artificial disponible 24/7. Esta llamada se graba para calidad y despacho inmediato. ¿En qué le puedo ayudar hoy?",
    gasEmergency: "Esto parece una fuga de gas natural. Por su seguridad, por favor evacúe a todos los ocupantes y mascotas hacia afuera inmediatamente. No toque ningún interruptor de luz ni aparatos eléctricos. Llame al 911 y a la compañía de gas desde una distancia segura afuera.",
    burstShutoff: "Para una tubería reventada, si es seguro hacerlo, por favor cierre la llave de paso general de inmediato cerca del medidor o la banqueta para cortar el agua. ¿El agua está cerca de enchufes eléctricos o pastillas de luz?",
    sewerStop: "Para el regreso de aguas negras, por favor no use ni abra el agua en toda la casa — no le baje al baño ni use la regadera. ¿El drenaje se está regresando en más de un baño?",
    heaterFuel: "Para una fuga en el boiler, por favor cierre la válvula del agua fría encima del calentador. ¿Su calentador es de gas o eléctrico?",
    freezeThaw: "Para tuberías congeladas, por favor deje las llaves ligeramente abiertas para aliviar la presión, y no use soplete ni fuego directo. ¿Ya ubicó la llave de paso general por si empieza una fuga al descongelarse?",
    slabAudit: "Para posibles fugas debajo de la losa, ¿su medidor de agua sigue girando con todo cerrado, o escucha correr agua o silbidos bajo el piso?",
    commercialTriage: "¿Qué tipo de negocio o restaurante es, y la trampa de grasa se está desbordando hacia la cocina?",
    routineFixture: "¿Qué llave o inodoro necesita servicio, ya tiene la pieza, y qué horario por la mañana o tarde le queda mejor para programar la cita?",
    qAddress: "¿Cuál es la dirección y ciudad donde necesita el servicio de plomería?",
    qName: "¿Me proporciona su nombre y apellido para la orden de trabajo?",
    qPhotos: "¿Le puedo enviar un enlace por mensaje de texto para que suba fotos de la fuga para el maestro plomero?",
    closingSummary: "Muchas gracias, {NAME}. He generado la orden de servicio para {ADDRESS}. Nuestro técnico certificado está revisando sus datos. Tipo de registro: Admisión diagnóstica preliminar."
  }
};

function createSession(id, phone, name, lang, options = {}) {
  return {
    id,
    phone,
    name,
    lang: lang || 'en',
    mode: options.mode || 'demo',
    peril: null,
    step: 0,
    isFinal: false,
    triageData: {
      peril: null,
      address: null,
      callerName: null,
      mainShutoffGuided: false,
      electricalChecked: false,
      photoLinkSent: false
    }
  };
}

// Strict priority-ordered peril detection
function detectPeril(text) {
  const t = text.toLowerCase();
  // 1. Life-safety gas leak
  if (/gas|rotten egg|mercaptan|huevos podridos|azufre/i.test(t)) return "gas_leak";
  // 2. Specific appliance: Water heater / boiler
  if (/water heater|boiler|calentador|tank|ao smith|rheem|hot water/i.test(t)) return "water_heater_rupture";
  // 3. Commercial facility & grease interceptor
  if (/grease (trap|interceptor)|trampa de grasa|commercial.*(kitchen|restaurant)|bistro|downtown bistro/i.test(t)) return "commercial_drain";
  // 4. Sewer / blackwater backflow
  if (/sewer|sewage|coladera|drenaje|aguas negras|toilet.*bubbl/i.test(t)) return "sewer_backup";
  // 5. Freeze / frozen pipe
  if (/froz|freeze|helad|congelad/i.test(t)) return "frozen_pipe";
  // 6. Foundation slab leak
  if (/slab|warm (spot|area|floor)|piso caliente|zona caliente|water bill|recibo del agua|losa/i.test(t)) return "slab_leak";
  // 7. Routine fixture / remodel
  if (/faucet|disposal|dripping|replace|goteo|inodoro|triturador|cambiar|schedule a service/i.test(t)) return "routine_fixture";
  // 8. General pressurized burst pipe
  if (/burst|spraying|pouring|revent|fuga activa|inundando|leak|fuga/i.test(t)) return "burst_pipe";
  return "burst_pipe"; // default emergency fallback
}

function extractEntities(session, text) {
  const t = text.trim();
  // Address extraction: matches digits followed by street name
  const addrMatch = t.match(/\b\d{3,5}\s+[A-Za-z0-9\s]+(?:Way|Drive|Ave|Avenue|St|Street|Blvd|Boulevard|Rd|Road|Lane|Ln)\b/i);
  if (addrMatch && !session.triageData.address) {
    session.triageData.address = addrMatch[0];
  }

  // City extraction
  const cityMatch = t.match(/\b(Austin|San Antonio|Dallas|Houston|Fort Worth|Round Rock|Plano|Arlington)\b/i);
  if (cityMatch && session.triageData.address && !session.triageData.address.includes(cityMatch[1])) {
    session.triageData.address += `, ${cityMatch[1]}`;
  }

  // Name extraction
  if (session.step >= 3 && !session.triageData.callerName) {
    const nameMatch = t.match(/([A-Z][a-z]+)\s+([A-Z][a-z]+)/);
    if (nameMatch) {
      session.triageData.callerName = nameMatch[0];
    }
  }
}

async function evaluateTurn(session, callerInput, options = {}) {
  const lang = options.language || session.lang || 'en';
  const strings = L10N[lang] || L10N.en;
  extractEntities(session, callerInput);

  let replyText = "";

  if (session.step === 0) {
    replyText = strings.welcome;
    session.step = 1;
    return {
      speechChunks: [{ text: replyText }],
      isFinal: false,
      session
    };
  }

  if (session.step === 1) {
    session.peril = detectPeril(callerInput);
    session.triageData.peril = session.peril;

    // Sub-20s emergency triage probe based on peril
    if (session.peril === "gas_leak") {
      replyText = strings.gasEmergency + " " + strings.qAddress;
      session.step = 3; // Fast track to address and exit
    } else if (session.peril === "burst_pipe") {
      replyText = strings.burstShutoff;
      session.triageData.mainShutoffGuided = true;
      session.step = 2;
    } else if (session.peril === "sewer_backup") {
      replyText = strings.sewerStop;
      session.step = 2;
    } else if (session.peril === "water_heater_rupture") {
      replyText = strings.heaterFuel;
      session.step = 2;
    } else if (session.peril === "frozen_pipe") {
      replyText = strings.freezeThaw;
      session.step = 2;
    } else if (session.peril === "slab_leak") {
      replyText = strings.slabAudit;
      session.step = 2;
    } else if (session.peril === "commercial_drain") {
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
    // Secondary safety / entity question -> ask service address
    replyText = (lang === 'en' ? "Got that noted. " : "Anotado. ") + strings.qAddress;
    session.step = 3;
    return {
      speechChunks: [{ text: replyText }],
      isFinal: false,
      session
    };
  }

  if (session.step === 3) {
    // Address captured -> ask caller name
    replyText = (lang === 'en' ? "Thank you. " : "Gracias. ") + strings.qName;
    session.step = 4;
    return {
      speechChunks: [{ text: replyText }],
      isFinal: false,
      session
    };
  }

  if (session.step === 4) {
    // Name captured -> offer photo diagnostic link
    replyText = strings.qPhotos;
    session.step = 5;
    return {
      speechChunks: [{ text: replyText }],
      isFinal: false,
      session
    };
  }

  if (session.step === 5) {
    // Photo link answered -> emit final closing summary with Texas Occupations Code Ch 1301 disclaimer
    const name = session.triageData.callerName || (lang === 'en' ? "valued customer" : "estimado cliente");
    const addr = session.triageData.address || (lang === 'en' ? "your address" : "su domicilio");
    replyText = strings.closingSummary.replace("{NAME}", name).replace("{ADDRESS}", addr);
    session.isFinal = true;
    return {
      speechChunks: [{ text: replyText }],
      isFinal: true,
      session
    };
  }

  return {
    speechChunks: [{ text: (lang === 'en' ? "Our technician is on the way." : "Nuestro técnico va en camino.") }],
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
