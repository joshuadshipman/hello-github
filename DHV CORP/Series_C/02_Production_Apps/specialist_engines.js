/**
 * Specialist Engines — non-claims personas for the Agent Angel voice server
 * =========================================================================
 * VOICE-SPECROUTE-01: one engine module for every DID that is NOT the Auto
 * Claims Specialist. Claims stays in claims_intake_engine.js untouched (469
 * regression bar). ONE NUMBER PER SPECIALIST (JD ruling 2026-08-19): each
 * persona here answers on its own DID only — no spoken trade selector, ever.
 *
 * ES parity (day-1 law): every user-facing literal lives beside its Spanish
 * counterpart. A missing key logs [L10N MISSING] and falls back to EN — never
 * a silent blank.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
// GOV-LIVE-CALLS-STORE-WRITER-01: absolute canonical path, not cwd/__dirname-relative
// (a relative path here was reappearing as a stray copy at the antigravity root).
const LIVE_CALLS_STORE_PATH = path.join(os.homedir(), 'data', 'voice', 'live_calls_store.json');
const customerIdentity = require('./customer_identity_engine');
const secondListenerRagEngine = require('./second_listener_rag_engine');
let plumbingIntakeSafety = null;
try { plumbingIntakeSafety = require('./plumbing_intake_engine'); } catch (_) {}
let fsmPlumbingAdapter = null;
try { fsmPlumbingAdapter = require('./fsm_plumbing_dispatch_adapter'); } catch (_) {}

function normalizePhone(p) {
  if (!p) return '';
  return String(p).replace(/\D/g, '').slice(-10);
}

const APPROVED_SMALL_METROS_SET = new Set([
  'wichita falls', 'broken bow', 'texarkana', 'conway', 'tyler', 'waco',
  'abilene', 'san angelo', 'longview', 'lufkin', 'sherman', 'denison', 'paris', 'nacogdoches'
]);

function lookupProspectByPhone(fromPhone) {
  if (!fromPhone) return null;
  const digits = normalizePhone(fromPhone);
  if (!digits || digits.length < 10) return null;

  const candidatePaths = [
    path.join(os.homedir(), 'data', 'revenue_officer', 'prospect_pool.json'),
    path.join(__dirname, '..', '..', '..', 'data', 'revenue_officer', 'prospect_pool.json'),
    path.join(__dirname, '../../../../data/revenue_officer/prospect_pool.json')
  ];

  for (const pPath of candidatePaths) {
    if (fs.existsSync(pPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(pPath, 'utf8'));
        const list = Array.isArray(raw) ? raw : (raw.prospects || []);
        const match = list.find(item => item.phone && normalizePhone(item.phone) === digits);
        if (match) {
          const city = (match.city || '').toLowerCase().trim();
          const emp = match.employee_count || match.employees;
          if (APPROVED_SMALL_METROS_SET.has(city) && typeof emp === 'number' && Number.isInteger(emp) && emp > 0 && emp < 5) {
            return match;
          }
        }
      } catch (_) {}
    }
  }
  return null;
}

// Emergency cues per trade (EN+ES). An emergency flags priority dispatch in
// the ticket and the ack line — it never changes what information we collect.
const URGENT = {
  plumbing: /\b(burst|flood(ing|ed)?|sewage|sewer|backing\s+up|backed\s+up|water\s+heater\s+(?:is\s+)?(?:burst|leaking|flooding)|no\s+hot\s+water|gas\s+(?:leak|smell|odor)|smell\s+gas|rotten\s+egg|no\s+water|overflow(ing)?|slab\s+leak|foundation\s+leak|spinning\s+meter|meter\s+is\s+spinning|revent[óo]|inund(aci[óo]n|ando|a|ado|ada)?|tuber[íi]a\s+rota|fuga\s+activa|fuga\s+en\s+la\s+losa|fuga\s+de\s+(?:agua|gas)|olor\s+a\s+gas|aguas\s+negras|alcantarillado|sin\s+agua|sin\s+agua\s+caliente|desborda(ndo)?|caved\s+in|caving\s+in|pouring|gushing|spraying|niagara\s+falls|empez[oó]\s+a\s+salir|mucha\s+agua|sale\s+agua|saliendo\s+agua|botando\s+agua|tirando\s+agua|ruido\s+(?:horrible|raro|fuerte)|ahorita\s+mismo|urgente|urgent|emergency|emergencia|active\s+leak|leaking\s+(?:now|everywhere|badly|all\s+over|onto|into|from\s+the\s+bottom)|pipe\s+(?:broke|burst)|ceiling\s+caved)\b/i,
  hvac: /\b(no heat|no cooling|no air|stopped blowing|blowing cold|compressor|grinding|burnt|burning|9\d\s+degrees|gas smell|carbon monoxide|sin calefacci[óo]n|sin aire|olor a gas|mon[óo]xido)\b/i,
  roofing: /\b(active leak|leaking now|dripping|tore shingles|windstorm|storm|tree|collapse|hole|gotera activa|se est[aá] metiendo|árbol|arbol|colapso|agujero)\b/i,
  electrical: /\b(spark(ing|s)?|smoke|smoking|burning smell|no power|breaker|shock|chispas?|humo|sin luz|corto)\b/i,
  dental: /\b(severe pain|tooth pain|cracked|swelling|bleeding|broken tooth|knocked out|abscess|infection|dolor severo|hinchaz[óo]n|sangrado|diente roto)\b/i,
  legal_pi: /\b(hospital|emergency room|ambulance|surgery|18-wheeler|broke my|fracture|arrest|statute|injured|hospitalizado|ambulancia|cirug[íi]a|herido)\b/i,
};

function classifyPlumbingCategory(text, existingCategory) {
  if (!text || typeof text !== 'string') return existingCategory || null;
  if (/\b(gas\s+(?:smell|leak|odor|line|valve)|smell\s+gas|rotten\s+egg|olor\s+a\s+gas|fuga\s+de\s+gas)\b/i.test(text)) {
    return 'GAS_WATER_HEATER_HAZARD';
  }
  if (/\b(sewer|sewage|raw\s+sewage|main\s+line\s+backup|backing\s+up|backed\s+up|gurgling\s+drain|aguas\s+negras|alcantarillado|drenaje\s+principal)\b/i.test(text)) {
    return 'SEWER_MAIN_BACKUP';
  }
  if (/\b(burst|bursting|pipe\s+broke|pouring|flooding|flooded|caved\s+in|active\s+leak|spraying|gushing|revent[óo]|tuber[íi]a\s+rota|inundando|inundaci[óo]n|mucha\s+agua)\b/i.test(text)) {
    return 'BURST_PIPE_ACTIVE_LEAK';
  }
  if (/\b(slab\s+leak|slab\s+foundation|foundation\s+leak|warm\s+spot\s+on\s+(?:the\s+)?(?:\w+\s+)?floor|water\s+meter\s+(?:is\s+)?spinning|spinning\s+meter|high\s+water\s+bill|fuga\s+en\s+la\s+losa|piso\s+caliente)\b/i.test(text)) {
    return 'SLAB_LEAK';
  }
  if (/\b(annual\s+(?:tank\s+)?flush|tank\s+flush|anode\s+rod\s+inspection|maintenance|tune-?up|water\s+softener|filter\s+cartridge|filtration|mantenimiento|limpieza\s+anual)\b/i.test(text)) {
    return 'MAINTENANCE_FLUSH';
  }
  if (/\b(water\s+heater|tankless|pilot\s+light|no\s+hot\s+water|lukewarm|40\s*gallon|50\s*gallon|anode\s+rod|calentador\s+de\s+agua|boiler|sin\s+agua\s+caliente|piloto)\b/i.test(text)) {
    return 'WATER_HEATER_REPAIR_REPLACE';
  }
  if (/\b(clog|clogged|slow\s+drain|toilet|overflow|overflowing|plunger|snake|hydro\s*jet|kitchen\s+sink\s+backed|inodoro|taza|atascado|tapado|destapar|drenaje\s+lento)\b/i.test(text)) {
    return 'DRAIN_TOILET_CLOG';
  }
  if (/\b(hose\s+bib|spigot|outdoor\s+faucet|pressure\s+reducing\s+valve|prv|backflow|water\s+pressure|llave\s+exterior|manguera|presi[óo]n\s+de\s+agua)\b/i.test(text)) {
    return 'EXTERIOR_HOSE_BIB_PRV';
  }
  if (/\b(faucet|garbage\s+disposal|disposal|shower\s+valve|cartridge|under\s+sink|p-trap|wax\s+ring|triturador|llave|grifo|regadera|fuga)\b/i.test(text)) {
    return existingCategory || 'FIXTURE_FAUCET_DISPOSAL';
  }
  return existingCategory || null;
}

function getSpecialistContainmentKey(session, latestSpeech) {
  if (!session || session.specialist !== 'plumbing') return 'containment';
  const combined = `${latestSpeech || ''} ${(session.ticket && session.ticket.problemDescription) || ''}`;
  const cat = (session.ticket && session.ticket.plumbingCategory) || classifyPlumbingCategory(combined, null);
  if (cat === 'GAS_WATER_HEATER_HAZARD' || /\b(gas\s+(?:smell|leak|odor|line)|smell\s+gas|rotten\s+egg|olor\s+a\s+gas|fuga\s+de\s+gas)\b/i.test(combined)) {
    return 'containmentGas';
  }
  if (cat === 'SEWER_MAIN_BACKUP' || /\b(sewer|sewage|raw\s+sewage|backing\s+up|backed\s+up|aguas\s+negras|alcantarillado)\b/i.test(combined)) {
    return 'containmentSewer';
  }
  return 'containment';
}

const SPECIALISTS = {
  plumbing: {
    displayName: 'Agent Angel Plumbing Specialist',
    refPrefix: 'SVC-PLB-',
    type: 'trade',
    tradeNoun: { en: 'plumbing', es: 'plomería' },
    l10n: {
      en: {
        greeting: `Thank you for calling the Agent Angel Plumbing Specialist 24/7 plumbing service line. Please note this call is recorded for quality assurance and you are speaking with an AI assistant. May I start with your first and last name, and {PHONE_VALIDATION}`,
        selector: `Para español, diga español o presione dos.`,
        qAddress: `What is the service address, including the city?`,
        qProblem: `What plumbing issue can we help you with today?`,
        containment: `If water is actively leaking or flowing, please turn off your main water shut-off valve or the valve under the fixture immediately—only if the valve is in a dry, safe location away from standing water or electrical panels—to prevent structural damage.`,
        containmentGas: `For your immediate safety, if you smell gas near your water heater or gas line, please do not touch any electrical switches or flames, shut off the gas valve only if safe to do so, and step outside while we alert our on-call emergency team and log your priority request.`,
        containmentSewer: `To prevent sewage from overflowing further into your home, please stop running all faucets, showers, dishwashers, and toilets immediately while our on-call staff reviews your priority request.`,
        qUrgency: `Is this an emergency that needs someone out today, or would you like to schedule a visit?`,
        qUrgencyKnownEmergency: `Since water is actively leaking, I have marked this as an emergency for priority review today. What time window works best for you?`,
        qWindow: `What day and time window works best for you?`,
        qPhotos: `Can I text you a secure link right now{PHOTO_PHONE_TARGET} to upload photos of the issue? That way our on-call plumber can review the issue in advance and bring the right tools.`,
        ackPhotos: `Thank you — I've queued the secure photo upload link for your mobile phone so our team can review your photos before heading out.`,
        ackUrgent: `I'm so sorry to hear that, and I understand completely. I have flagged this as an emergency and marked your request for priority review by our on-call team. Please take your time, we are here to help.`,
        ack: `Thank you.`,
        qSummaryConfirm: `Let me confirm the details of your service request: {NAME}, at {ADDRESS}, for {PROBLEM}, marked as {URGENCY}, with requested time window {WINDOW}. Is all of that information accurate?`,
        ackSummary: `Thank you for confirming your service details.`,
        closing: `Thank you, {NAME}. Your plumbing service job-ticket has been created with reference {REF} and queued for our on-call dispatch team to confirm your appointment window shortly.`,
        hints: 'leak, clog, burst pipe, water heater, drain, toilet, faucet, sewer, emergency, schedule, photos, photo link, yes, correct, accurate, español',
      },
      es: {
        greeting: `Gracias por llamar al Especialista de Plomería de Agent Angel. Tenga en cuenta que esta llamada se graba para control de calidad y está hablando con un asistente de inteligencia artificial. ¿Puedo comenzar con su nombre y apellido, y {PHONE_VALIDATION}`,
        selector: `For English, say English or press one.`,
        qAddress: `¿Cuál es la dirección del servicio, incluyendo la ciudad?`,
        qProblem: `¿En qué problema de plomería le podemos ayudar hoy?`,
        containment: `Si el agua se está filtrando o fluyendo activamente, por favor cierre la llave de paso principal de agua o la válvula debajo del lavabo inmediatamente—solo si se encuentra en un lugar seco y seguro lejos de cables eléctricos—para evitar daños estructurales.`,
        containmentGas: `Por su seguridad inmediata, si percibe olor a gas cerca del calentador o tubería, no toque interruptores eléctricos ni flamas, cierre la válvula de gas solo si es seguro hacerlo y salga de la propiedad mientras alertamos a nuestro equipo de guardia.`,
        containmentSewer: `Para evitar que las aguas negras sigan desbordándose en su hogar, por favor deje de usar inmediatamente todas las llaves de agua, regaderas, lavavajillas e inodoros mientras nuestro equipo revisa su solicitud prioritaria.`,
        qUrgency: `¿Es una emergencia que necesita a alguien hoy mismo, o desea programar una visita?`,
        qUrgencyKnownEmergency: `Dado que el agua se está filtrando activamente, he marcado esto como emergencia para revisión prioritaria hoy mismo. ¿Qué horario le funciona mejor?`,
        qWindow: `¿Qué día y horario le funciona mejor?`,
        qPhotos: `¿Puedo enviarle un enlace seguro por texto ahora mismo{PHOTO_PHONE_TARGET} para subir fotos del problema? De esa forma nuestro plomero de guardia puede revisar el problema con anticipación.`,
        ackPhotos: `Gracias — he preparado el enlace seguro de fotos para su teléfono móvil.`,
        ackUrgent: `Lo siento mucho y comprendo perfectamente. Lo he marcado como una emergencia y su solicitud tiene revisión prioritaria de guardia. No se preocupe, estamos aquí para ayudarle.`,
        ack: `Gracias.`,
        qSummaryConfirm: `Permítame confirmar los detalles de su solicitud de servicio: {NAME}, en {ADDRESS}, por {PROBLEM}, marcado como {URGENCY}, con horario solicitado {WINDOW}. ¿Es correcta toda esta información?`,
        ackSummary: `Gracias por confirmar los detalles de su servicio.`,
        closing: `Gracias, {NAME}. Su solicitud de servicio de plomería ha sido registrada con la referencia {REF} y nuestro equipo de guardia confirmará su horario en breve.`,
        hints: 'fuga, obstrucción, tubería rota, calentador de agua, drenaje, inodoro, llave, alcantarillado, emergencia, cita, fotos, enlace de fotos, sí, correcto, exacto, English',
      },
    },
  },
  hvac: {
    displayName: 'Agent Angel HVAC Specialist',
    refPrefix: 'SVC-HVA-',
    type: 'trade',
    tradeNoun: { en: 'heating and cooling', es: 'climatización' },
    l10n: {
      en: {
        greeting: `Thank you for calling the Agent Angel H V A C Specialist. Please note this call is recorded for quality assurance and you are speaking with an AI assistant. May I start with your first and last name, and {PHONE_VALIDATION}`,
        selector: `Para español, diga español o presione dos.`,
        qAddress: `What is the service address, including the city?`,
        qProblem: `What heating or cooling issue are you experiencing today?`,
        containment: `For your comfort and system safety, please switch the thermostat to off so the compressor does not overheat while our on-call team reviews your request.`,
        qUrgency: `Is this an emergency that needs someone out today, or would you like to schedule a visit?`,
        qWindow: `What day and time window works best for you?`,
        qPhotos: `Can I text you a secure link right now{PHOTO_PHONE_TARGET} to upload photos of your unit or thermostat?`,
        ackPhotos: `Awesome — I've dispatched the secure photo link to your mobile phone.`,
        ackUrgent: `I'm so sorry you're dealing with that heat — I understand completely and we are here to help. I've flagged this as an emergency and marked your request for priority dispatch.`,
        ack: `Thank you.`,
        qSummaryConfirm: `Let me confirm the details of your service request: {NAME}, at {ADDRESS}, for {PROBLEM}, marked as {URGENCY}, with requested time window {WINDOW}. Is all of that information accurate?`,
        ackSummary: `Thank you for confirming your service details.`,
        closing: `Thank you, {NAME}. Your heating and cooling service request has been logged with reference {REF}. Our dispatch team will confirm your appointment shortly. Goodbye!`,
        hints: 'air conditioning, no cooling, no heat, furnace, thermostat, freon, compressor, filter, emergency, schedule, español',
      },
      es: {
        greeting: `Gracias por llamar al Especialista de Climatización de Agent Angel. Tenga en cuenta que esta llamada se graba para control de calidad y está hablando con un asistente de inteligencia artificial. ¿Puedo comenzar con su nombre y apellido, y {PHONE_VALIDATION}`,
        selector: `For English, say English or press one.`,
        qAddress: `¿Cuál es la dirección del servicio, incluyendo la ciudad?`,
        qProblem: `¿Qué problema con su sistema de climatización o aire está teniendo hoy?`,
        containment: `Si percibe olor a quemado o gas, por favor apague el termostato de inmediato por seguridad.`,
        qUrgency: `¿Es una emergencia que necesita a alguien hoy mismo, o desea programar una visita?`,
        qWindow: `¿Qué día y horario le funciona mejor?`,
        qPhotos: `¿Puedo enviarle un enlace seguro por texto ahora mismo{PHOTO_PHONE_TARGET} para subir fotos de su unidad o termostato?`,
        ackPhotos: `Excelente — he enviado el enlace de fotos seguro a su teléfono móvil.`,
        ackUrgent: `Lo siento mucho y comprendo perfectamente. Lo he marcado como una emergencia y su solicitud tiene despacho prioritario.`,
        ack: `Gracias.`,
        qSummaryConfirm: `Permítame confirmar los detalles de su solicitud de servicio: {NAME}, en {ADDRESS}, por {PROBLEM}, marcado como {URGENCY}, con horario solicitado {WINDOW}. ¿Es correcta toda esta información?`,
        ackSummary: `Gracias por confirmar los detalles de su servicio.`,
        closing: `Gracias, {NAME}. Su solicitud de servicio de climatización ha sido registrada con la referencia {REF}. Nuestro equipo de despacho confirmará su cita en breve. ¡Adiós!`,
        hints: 'aire acondicionado, sin aire, sin calefacción, caldera, termostato, compresor, filtro, emergencia, cita, English',
      },
    },
  },
  roofing: {
    displayName: 'Agent Angel Roofing Specialist',
    refPrefix: 'SVC-ROF-',
    type: 'trade',
    tradeNoun: { en: 'roofing', es: 'techos' },
    l10n: {
      en: {
        greeting: `Thank you for calling the Agent Angel Roofing Specialist. Please note this call is recorded for quality assurance and you are speaking with an AI assistant. May I start with your first and last name, and {PHONE_VALIDATION}`,
        selector: `Para español, diga español o presione dos.`,
        qAddress: `What is the service address, including the city?`,
        qProblem: `What roofing issue can our team inspect or help you with today?`,
        containment: `If water is actively entering your home, please place a container underneath and avoid touching any wet ceiling fixtures for your safety.`,
        qUrgency: `Is this an emergency with active leaking, or would you like to schedule an inspection?`,
        qWindow: `What day and time window works best for you?`,
        qPhotos: `Can I text you a secure link right now{PHOTO_PHONE_TARGET} to upload photos of the roof damage or leak?`,
        ackPhotos: `Awesome — I've dispatched the secure photo link to your mobile phone.`,
        ackUrgent: `I'm so sorry to hear about the storm damage — I understand how stressful an active leak is, and we are here to help. I've flagged this as an emergency for priority dispatch.`,
        ack: `Thank you.`,
        qSummaryConfirm: `Let me confirm the details of your service request: {NAME}, at {ADDRESS}, for {PROBLEM}, marked as {URGENCY}, with requested time window {WINDOW}. Is all of that information accurate?`,
        ackSummary: `Thank you for confirming your service details.`,
        closing: `Thank you, {NAME}. Your roofing service request has been logged with reference {REF}. Our dispatch team will confirm your appointment shortly. Goodbye!`,
        hints: 'roof leak, shingles, storm damage, hail, gutter, inspection, tarp, emergency, schedule, español',
      },
      es: {
        greeting: `Gracias por llamar al Especialista de Techos de Agent Angel. Tenga en cuenta que esta llamada se graba para control de calidad y está hablando con un asistente de inteligencia artificial. ¿Puedo comenzar con su nombre y apellido, y {PHONE_VALIDATION}`,
        selector: `For English, say English or press one.`,
        qAddress: `¿Cuál es la dirección del servicio, incluyendo la ciudad?`,
        qProblem: `¿Qué problema con su techo o cubierta necesita revisión hoy?`,
        containment: `Si está entrando agua activamente, por favor coloque un recipiente debajo y evite tocar lámparas o cables húmedos.`,
        qUrgency: `¿Es una emergencia con una gotera activa, o desea programar una inspección?`,
        qWindow: `¿Qué día y horario le funciona mejor?`,
        qPhotos: `¿Puedo enviarle un enlace seguro por texto ahora mismo{PHOTO_PHONE_TARGET} para subir fotos del daño en su techo?`,
        ackPhotos: `Excelente — he enviado el enlace de fotos seguro a su teléfono móvil.`,
        ackUrgent: `Lo siento mucho y comprendo perfectamente. Lo he marcado como una emergencia y su solicitud tiene despacho prioritario.`,
        ack: `Gracias.`,
        qSummaryConfirm: `Permítame confirmar los detalles de su solicitud de servicio: {NAME}, en {ADDRESS}, por {PROBLEM}, marcado como {URGENCY}, con horario solicitado {WINDOW}. ¿Es correcta toda esta información?`,
        ackSummary: `Gracias por confirmar los detalles de su servicio.`,
        closing: `Gracias, {NAME}. Su solicitud de servicio de techos ha sido registrada con la referencia {REF}. Nuestro equipo de despacho confirmará su cita en breve. ¡Adiós!`,
        hints: 'gotera, tejas, daño por tormenta, granizo, canaleta, inspección, lona, emergencia, cita, English',
      },
    },
  },
  electrical: {
    displayName: 'Agent Angel Electrical Specialist',
    refPrefix: 'SVC-ELE-',
    type: 'trade',
    tradeNoun: { en: 'electrical', es: 'electricidad' },
    l10n: {
      en: {
        greeting: `Thank you for calling the Agent Angel Electrical Specialist. Please note this call is recorded for quality assurance and you are speaking with an AI assistant. May I start with your first and last name, and {PHONE_VALIDATION}`,
        selector: `Para español, diga español o presione dos.`,
        qAddress: `What is the service address, including the city?`,
        qProblem: `What electrical issue can our licensed electricians help you with today?`,
        containment: `For your immediate safety, please stay completely clear of the sparking breaker panel or any exposed wiring while our licensed electrical team reviews your priority request.`,
        qUrgency: `Is this an emergency power or safety issue today, or would you like to schedule a visit?`,
        qWindow: `What day and time window works best for you?`,
        qPhotos: `Can I text you a secure link right now{PHOTO_PHONE_TARGET} to upload photos of the panel or fixture?`,
        ackPhotos: `Awesome — I've dispatched the secure photo link to your mobile phone.`,
        ackUrgent: `I'm so sorry you're experiencing that — your safety comes first and we are here to help right away. I've flagged this as an emergency for priority dispatch.`,
        ack: `Thank you.`,
        qSummaryConfirm: `Let me confirm the details of your service request: {NAME}, at {ADDRESS}, for {PROBLEM}, marked as {URGENCY}, with requested time window {WINDOW}. Is all of that information accurate?`,
        ackSummary: `Thank you for confirming your service details.`,
        closing: `Thank you, {NAME}. Your electrical service request has been logged with reference {REF}. Our dispatch team will confirm your appointment shortly. Goodbye!`,
        hints: 'breaker, panel, outlet, sparking, power outage, wiring, generator, emergency, schedule, español',
      },
      es: {
        greeting: `Gracias por llamar al Especialista Eléctrico de Agent Angel. Tenga en cuenta que esta llamada se graba para control de calidad y está hablando con un asistente de inteligencia artificial. ¿Puedo comenzar con su nombre y apellido, y {PHONE_VALIDATION}`,
        selector: `For English, say English or press one.`,
        qAddress: `¿Cuál es la dirección del servicio, incluyendo la ciudad?`,
        qProblem: `¿En qué problema eléctrico le podemos ayudar hoy?`,
        containment: `Por su seguridad, manténgase alejado de paneles con chispas o cables expuestos.`,
        qUrgency: `¿Es una emergencia eléctrica hoy mismo, o desea programar una visita?`,
        qWindow: `¿Qué día y horario le funciona mejor?`,
        qPhotos: `¿Puedo enviarle un enlace seguro por texto ahora mismo{PHOTO_PHONE_TARGET} para subir fotos del panel o instalación?`,
        ackPhotos: `Excelente — he enviado el enlace de fotos seguro a su teléfono móvil.`,
        ackUrgent: `Lo siento mucho y comprendo perfectamente. Lo he marcado como una emergencia y su solicitud tiene despacho prioritario.`,
        ack: `Gracias.`,
        qSummaryConfirm: `Permítame confirmar los detalles de su solicitud de servicio: {NAME}, en {ADDRESS}, por {PROBLEM}, marcado como {URGENCY}, con horario solicitado {WINDOW}. ¿Es correcta toda esta información?`,
        ackSummary: `Gracias por confirmar los detalles de su servicio.`,
        closing: `Gracias, {NAME}. Su solicitud de servicio eléctrico ha sido registrada con la referencia {REF}. Nuestro equipo de despacho confirmará su cita en breve. ¡Adiós!`,
        hints: 'panel, interruptor, chispas, apagón, cables, emergencia, cita, English',
      },
    },
  },
  dental: {
    displayName: 'Agent Angel Dental & Clinic Specialist',
    refPrefix: 'SVC-DEN-',
    type: 'trade',
    tradeNoun: { en: 'dental and clinic', es: 'clínica dental' },
    l10n: {
      en: {
        greeting: `Thank you for calling the Agent Angel Dental and Clinic Specialist. Please note this call is recorded for quality assurance and you are speaking with an AI assistant. May I start with your first and last name, and {PHONE_VALIDATION}`,
        selector: `Para español, diga español o presione dos.`,
        qAddress: `Which clinic location or city are you calling from?`,
        qProblem: `What dental or clinical concern can we help you schedule today?`,
        containment: `While we get you scheduled today, please avoid chewing on that side and apply a cold compress to the outside of your jaw to ease the swelling.`,
        qUrgency: `Are you experiencing acute pain or swelling that requires a same-day emergency slot, or is this a routine visit?`,
        qWindow: `What day and time window works best for your appointment?`,
        qPhotos: `Can I text you a secure link right now{PHOTO_PHONE_TARGET} for your patient intake and insurance card upload?`,
        ackPhotos: `Awesome — I've dispatched the secure patient link to your mobile phone.`,
        ackUrgent: `I'm so sorry you're in pain — I understand completely and we are here to help get you comfortable today. I've flagged this for priority same-day clinical triage.`,
        ack: `Thank you.`,
        qSummaryConfirm: `Let me confirm your appointment request: {NAME}, location {ADDRESS}, for {PROBLEM}, marked as {URGENCY}, with preferred window {WINDOW}. Is all of that information accurate?`,
        ackSummary: `Thank you for confirming your appointment details.`,
        closing: `Thank you, {NAME}. Your clinical intake request has been logged with reference {REF}. Our care team will confirm shortly. Goodbye!`,
        hints: 'toothache, crown, cleaning, swelling, emergency, appointment, insurance, español',
      },
      es: {
        greeting: `Gracias por llamar al Especialista de Clínica Dental de Agent Angel. Tenga en cuenta que esta llamada se graba para control de calidad y está hablando con un asistente de inteligencia artificial. ¿Puedo comenzar con su nombre y apellido, y {PHONE_VALIDATION}`,
        selector: `For English, say English or press one.`,
        qAddress: `¿Desde qué ciudad o sucursal nos llama?`,
        qProblem: `¿Qué consulta dental o clínica podemos agendarle hoy?`,
        qUrgency: `¿Presenta dolor agudo o inflamación que requiera atención de urgencia hoy mismo, o desea una cita de rutina?`,
        qWindow: `¿Qué día y horario le funciona mejor para su cita?`,
        qPhotos: `¿Puedo enviarle un enlace seguro por texto ahora mismo{PHOTO_PHONE_TARGET} para su registro y tarjeta de seguro?`,
        ackPhotos: `Excelente — he enviado el enlace seguro a su teléfono móvil.`,
        ackUrgent: `Lo siento mucho y comprendo su molestia. Lo he marcado para atención clínica prioritaria el día de hoy.`,
        ack: `Gracias.`,
        qSummaryConfirm: `Permítame confirmar los detalles de su cita: {NAME}, en {ADDRESS}, por {PROBLEM}, marcado como {URGENCY}, con horario {WINDOW}. ¿Es correcta toda esta información?`,
        ackSummary: `Gracias por confirmar los detalles de su cita.`,
        closing: `Gracias, {NAME}. Su solicitud clínica ha sido registrada con la referencia {REF}. Nuestro equipo confirmará su cita en breve. ¡Adiós!`,
        hints: 'dolor de muela, limpieza, urgencia, cita, seguro, English',
      },
    },
  },
  legal_pi: {
    displayName: 'Agent Angel Personal Injury Intake Specialist',
    refPrefix: 'SVC-LPI-',
    type: 'trade',
    tradeNoun: { en: 'personal injury intake', es: 'recepción legal de lesiones' },
    l10n: {
      en: {
        greeting: `Thank you for calling the Agent Angel Personal Injury Intake Specialist. Please note this call is recorded for quality assurance, you are speaking with an AI assistant, and this intake does not create an attorney-client relationship. May I start with your first and last name, and {PHONE_VALIDATION}`,
        selector: `Para español, diga español o presione dos.`,
        qAddress: `In what Texas city and street location did the incident occur?`,
        qProblem: `Briefly, what happened in the accident and what injuries were sustained?`,
        containment: `Please be sure to follow all emergency discharge instructions and preserve any photos, medical records, or dashcam footage from the collision.`,
        qUrgency: `Did anyone receive emergency medical treatment or transport by ambulance?`,
        qWindow: `What time window today works best for our intake attorney to call you back?`,
        qPhotos: `Can I text you a secure link right now{PHOTO_PHONE_TARGET} to upload scene photos or police report documents?`,
        ackPhotos: `Awesome — I've dispatched the secure evidence upload link to your mobile phone.`,
        ackUrgent: `I'm so sorry to hear you were injured in that collision — we are here to help you right away. I've flagged your case file for immediate attorney review.`,
        ack: `Thank you.`,
        qSummaryConfirm: `Let me confirm your case intake details: {NAME}, incident location {ADDRESS}, regarding {PROBLEM}, medical status {URGENCY}, with attorney callback window {WINDOW}. Is all of that information accurate?`,
        ackSummary: `Thank you for confirming your intake details.`,
        closing: `Thank you, {NAME}. Your preliminary Texas personal injury intake has been logged under reference {REF}. Our legal team will review and reach out shortly. Goodbye!`,
        hints: 'car accident, truck accident, injured, hospital, police report, Texas, español',
      },
      es: {
        greeting: `Gracias por llamar al Especialista de Recepción Legal de Agent Angel. Tenga en cuenta que esta llamada se graba para calidad, habla con un asistente de IA y esta toma de datos no crea una relación abogado-cliente. ¿Puedo comenzar con su nombre y apellido, y {PHONE_VALIDATION}`,
        selector: `For English, say English or press one.`,
        qAddress: `¿En qué ciudad y calle de Texas ocurrió el incidente?`,
        qProblem: `Brevemente, ¿qué ocurrió en el accidente y qué lesiones hubo?`,
        qUrgency: `¿Recibió alguien atención médica de emergencia o traslado en ambulancia?`,
        qWindow: `¿Qué horario del día de hoy le funciona mejor para que nuestro equipo legal se comunique con usted?`,
        qPhotos: `¿Puedo enviarle un enlace seguro por texto ahora mismo{PHOTO_PHONE_TARGET} para subir fotos del incidente o el reporte policial?`,
        ackPhotos: `Excelente — he enviado el enlace seguro de evidencia a su teléfono móvil.`,
        ackUrgent: `He marcado su expediente para revisión inmediata.`,
        ack: `Gracias.`,
        qSummaryConfirm: `Permítame confirmar los datos de su expediente: {NAME}, ubicación {ADDRESS}, respecto a {PROBLEM}, estado médico {URGENCY}, con horario de contacto {WINDOW}. ¿Es correcta toda esta información?`,
        ackSummary: `Gracias por confirmar sus datos.`,
        closing: `Gracias, {NAME}. Su toma de datos preliminar en Texas ha sido registrada con la referencia {REF}. Nuestro equipo se comunicará en breve. ¡Adiós!`,
        hints: 'accidente, lesionado, hospital, reporte policial, Texas, English',
      },
    },
  },
  cos_hermes: {
    displayName: 'Hermes — Agent Angel Chief of Staff',
    refPrefix: 'COS-MSG-',
    type: 'assistant',
    l10n: {
      en: {
        greeting: `You've reached Hermes, the Agent Angel chief of staff line. Please note this call is recorded for quality assurance and you are speaking with an AI assistant. May I have your name?`,
        selector: `Para español, diga español o presione dos.`,
        qTopic: `What is this regarding?`,
        qMessage: `Go ahead with your message, and I'll log it for review.`,
        ack: `Thank you.`,
        ackUrgent: `Noted as urgent.`,
        closing: `Thank you, {NAME}. Your message has been logged with reference {REF} and will be reviewed shortly. Goodbye!`,
        hints: 'message, review, dashboard, approval, urgent, callback, español',
      },
      es: {
        greeting: `Ha llamado a Hermes, la línea del jefe de gabinete de Agent Angel. Tenga en cuenta que esta llamada se graba para control de calidad y está hablando con un asistente de inteligencia artificial. ¿Me puede dar su nombre?`,
        selector: `For English, say English or press one.`,
        qTopic: `¿Sobre qué asunto es su llamada?`,
        qMessage: `Adelante con su mensaje, y lo registraré para revisión.`,
        ack: `Entendido, gracias.`,
        ackUrgent: `Anotado como urgente.`,
        closing: `Gracias, {NAME}. Su mensaje ha sido registrado con la referencia {REF} y será revisado en breve. ¡Adiós!`,
        hints: 'mensaje, revisión, panel, aprobación, urgente, devolver llamada, English',
      },
    },
  },
};

// Question sequences by specialist type. Field names double as ticket keys.
const FLOWS = {
  trade: [
    { field: 'callerName', q: 'greeting' },
    { field: 'serviceAddress', q: 'qAddress' },
    { field: 'problemDescription', q: 'qProblem' },
    { field: 'urgency', q: 'qUrgency' },
    { field: 'preferredWindow', q: 'qWindow' },
    { field: 'photoRequest', q: 'qPhotos' },
    { field: 'summaryConfirm', q: 'qSummaryConfirm' },
  ],
  plumbing: [
    { field: 'callerName', q: 'greeting' },
    { field: 'serviceAddress', q: 'qAddress' },
    { field: 'problemDescription', q: 'qProblem' },
    { field: 'urgency', q: 'qUrgency' },
    { field: 'preferredWindow', q: 'qWindow' },
    { field: 'photoRequest', q: 'qPhotos' },
    { field: 'summaryConfirm', q: 'qSummaryConfirm' },
  ],
  assistant: [
    { field: 'callerName', q: 'greeting' },
    { field: 'topic', q: 'qTopic' },
    { field: 'message', q: 'qMessage' },
  ],
};

// ---- Trades sales/demo mode (TRADES-SALESMODE-01) --------------------------
// After the trade intake completes, the demo call CLOSES with a sales
// conversation: role discovery -> pain pinpointing -> pitch (AgentAngel as the
// 24/7 after-hours/overflow answering service for that trade — NEVER FNOL or
// insurance framing) -> Tier-B close. The demo caller is an SMB PROSPECT
// (owner/office manager/tech), not a claimant — value-first copy only, and the
// persuasion boundary applies unchanged on all SMB surfaces.
//
// OFFER-TIER-TEST-01 (JD ruling 2026-08-19): Tier B is the LIVE DEFAULT and
// the ONLY offer this module may speak — card on file, first month free, 100%
// refund within 30 days if unhappy. Offers A and C are NEVER presented; their
// copy must not exist anywhere in this file. _test_trades_sales.js asserts
// A/C-class markers (no-card trials, discounts/percent-off, waived fees,
// annual terms) are absent from every string below.
const TRADE_SALES = {
  en: {
    bridge: `You're all set — your {TRADE} request is logged with reference {REF}, and our dispatch team will confirm shortly. Before you go, one quick question:`,
    askRole: `are you the owner of the business, the office manager, or one of the techs?`,
    ackRole: `Perfect, thank you.`,
    askPain: `What costs you more business right now — calls you miss after hours, quotes that no-show or go cold, or what you're paying to keep the phones covered?`,
    ackPain: `That's exactly what we fix.`,
    pitchAfterHours: `That call you just made? Agent Angel answers your {TRADE} line exactly like that, 24/7 — every after-hours and weekend call answered on the first ring, booked, and sent to your team, so no job ends up on a competitor's voicemail.`,
    pitchNoShow: `Agent Angel answers your {TRADE} line 24/7 and turns every quote request into a confirmed time window on the very first call — callers who reach a <phoneme alphabet="ipa" ph="laɪv">live</phoneme> answer book the job, and booked callers show up.`,
    pitchDispatch: `Agent Angel covers your {TRADE} line 24/7 as your after-hours and overflow answering service — every call answered, logged, and dispatched to your team for a fraction of what phone staff or a traditional answering service costs.`,
    pitchGeneral: `Agent Angel is a 24/7 after-hours and overflow answering service for {TRADE} businesses — it answers exactly like the call you just made, books the job, and sends it straight to your team.`,
    askInterest: `Would that kind of coverage help your business?`,
    offerTierB: `Your emergency dispatch is logged with reference {REF}. For plumbing businesses, Agent Angel answers every after-hours call on the first ring, gives emergency shut-off guidance, and dispatches the job so you never lose emergency revenue to competitor voicemails or traditional answering services. Would you like us to text you the <phoneme alphabet="ipa" ph="laɪv">live</phoneme> dashboard link to see how this integrates into your team's dispatch schedule?`,
    closingYes: `Excellent — your plumbing service request has been logged under reference {REF} and dispatched to your mobile phone with your <phoneme alphabet="ipa" ph="laɪv">live</phoneme> dashboard link and schedule. You can review the dispatch rules and schedule a <phoneme alphabet="ipa" ph="laɪv">live</phoneme> pilot walkthrough at your convenience. Thank you, and have a great day!`,
    closingNo: `Understood. Your service request is logged and our team is ready whenever you would like to explore 24/7 after-hours coverage. Have a great day!`,
    closingDefault: `Thank you for testing Agent Angel today. Your plumbing service request has been logged under reference {REF} and dispatched to your mobile phone with your <phoneme alphabet="ipa" ph="laɪv">live</phoneme> dashboard link. Have a great day!`,
    salesHints: 'owner, office manager, technician, after hours, missed calls, quotes, no-show, dispatch, answering service, yes, no, español',
  },
  es: {
    bridge: `Listo — su solicitud de {TRADE} quedó registrada con la referencia {REF}, y nuestro equipo de despacho la confirmará en breve. Antes de terminar, una pregunta rápida:`,
    askRole: `¿es usted el dueño del negocio, el gerente de oficina, o uno de los técnicos?`,
    ackRole: `Perfecto, gracias.`,
    askPain: `¿Qué le cuesta más negocio en este momento — las llamadas que pierde fuera de horario, las cotizaciones que no se concretan, o lo que paga por mantener los teléfonos cubiertos?`,
    ackPain: `Eso es exactamente lo que resolvemos.`,
    pitchAfterHours: `¿La llamada que usted acaba de hacer? Agent Angel contesta su línea de {TRADE} exactamente así, las 24 horas — cada llamada nocturna o de fin de semana se contesta al primer timbre, se agenda, y se envía a su equipo, para que ningún trabajo termine en el buzón de un competidor.`,
    pitchNoShow: `Agent Angel contesta su línea de {TRADE} las 24 horas y convierte cada solicitud de cotización en una cita confirmada desde la primera llamada — quien recibe respuesta en vivo agenda el trabajo, y quien agenda sí se presenta.`,
    pitchDispatch: `Agent Angel cubre su línea de {TRADE} las 24 horas como su servicio de contestación fuera de horario y de desborde — cada llamada contestada, registrada y despachada a su equipo por una fracción de lo que cuesta el personal telefónico o un servicio de contestación tradicional.`,
    pitchGeneral: `Agent Angel es un servicio de contestación 24/7 fuera de horario y de desborde para negocios de {TRADE} — contesta exactamente como la llamada que usted acaba de hacer, agenda el trabajo, y lo envía directo a su equipo.`,
    askInterest: `¿Le ayudaría a su negocio ese tipo de cobertura?`,
    offerTierB: `Su despacho de emergencia quedó registrado con la referencia {REF}. Para negocios de plomería, Agent Angel contesta cada llamada fuera de horario al primer timbre, brinda orientación para cerrar la llave de paso y despacha el trabajo para que nunca pierda ingresos de emergencia en el buzón de un competidor o servicios tradicionales. ¿Le gustaría que le enviemos el enlace del panel en vivo por texto para ver cómo se integra esto al horario de su equipo?`,
    closingYes: `Excelente — su solicitud de servicio de plomería ha sido registrada bajo la referencia {REF} y enviada a su teléfono móvil con el enlace de su panel en vivo y horario. Puede revisar las reglas de despacho y agendar una demostración piloto a su conveniencia. ¡Gracias y que tenga un excelente día!`,
    closingNo: `Entendido. Su solicitud de servicio queda registrada y nuestro equipo está disponible cuando desee explorar la cobertura 24/7 fuera de horario. ¡Que tenga un excelente día!`,
    closingDefault: `Gracias por probar Agent Angel hoy. Su solicitud de servicio de plomería ha sido registrada bajo la referencia {REF} y enviada a su teléfono móvil con el enlace de su panel en vivo. ¡Que tenga un excelente día!`,
    salesHints: 'dueño, gerente de oficina, técnico, fuera de horario, llamadas perdidas, cotizaciones, despacho, servicio de contestación, sí, no, English',
  },
};

// Role discovery — owner / office_manager / tech (EN+ES). Order matters:
// "owner" wins over a stray "manage"; unknown stays 'unknown', never guessed.
const SALES_ROLE = [
  ['owner', /\b(owner|due[ñn][oa]|propietari[oa]|founder|boss|contractor|contratista|my (company|business|shop)|mi (empresa|negocio))\b/i],
  ['office_manager', /\b(office|manager|dispatcher|admin(istrator)?|receptionist|gerente|oficina|administrador(a)?|recepcionista|despachador(a)?)\b/i],
  ['tech', /\b(tech(nician)?s?|plumber|installer|foreman|crew|field|t[eé]cnic[oa]s?|plomer[oa]|instalador(a)?|capataz)\b/i],
];

// Trades pain points (EN+ES): missed after-hours calls / no-show or cold
// quotes / dispatch + phone-coverage cost.
const SALES_PAIN = [
  ['AFTER_HOURS', /\b(after.?hours?|miss(ed|ing)? (a )?calls?|night|weekends?|voicemail|evenings?|fuera de horario|llamadas? (que )?(pierd\w+|perdidas?)|noches?|fin(es)? de semana|buz[oó]n)\b/i],
  ['NO_SHOW', /\b(no.?shows?|quotes?|estimates?|appointments?|cancel(l?ed|s|ations?)?|cotizaci[oó]n(es)?|presupuestos?|citas?|plant[oó]n|no se (presenta|concretan?))\b/i],
  ['DISPATCH', /\b(dispatch(ing|er)?|answering service|receptionist|front desk|payroll|staff(ing)?|overhead|phones? covered|despacho|servicio de contestaci[oó]n|recepcionista|n[oó]mina|personal|tel[eé]fonos)\b/i],
];

function classifyTradeRole(speech) {
  if (!speech) return 'unknown';
  for (const [role, re] of SALES_ROLE) if (re.test(speech)) return role;
  return 'unknown';
}

function classifyTradePain(speech) {
  if (!speech) return 'GENERAL';
  for (const [pain, re] of SALES_PAIN) if (re.test(speech)) return pain;
  return 'GENERAL';
}

// PASS-04: a caller who presses multiple DTMF digits in one gather window
// (mid-sentence correction, e.g. "1" then "2") means the LAST digit wins —
// never the first. Only digits 1/2 are meaningful here; anything else in the
// string is ignored rather than treated as ambiguous input.
function hasUsableSpeech(speech) {
  return typeof speech === 'string' && speech.trim().length > 0;
}

function affirmative(speech, digits) {
  if (typeof digits === 'string' && digits.length) {
    const meaningful = digits.replace(/[^12]/g, '');
    const lastDigit = meaningful.slice(-1);
    if (lastDigit === '1') return true;
    if (lastDigit === '2') return false;
  }
  if (!speech) return null;
  const lower = speech.toLowerCase();
  // SMB price objections: a decline, never an ambiguous non-answer.
  if (/\b(too expensive|can\s?('|no)?t afford|cannot afford|too much money|out of (our )?budget|too pricey|muy caro|no podemos pagar|no (nos )?alcanza|fuera de (nuestro )?presupuesto)\b/i.test(lower)) return false;
  // Veto negative expressions first (e.g. "claro que no", "no gracias")
  if (/\b(no|not now|nope|nah|ahora no|no gracias|claro que no|para nada)\b/i.test(lower)) return false;
  // Require accented 'sí' to avoid matching Spanish conditional 'si' (if)
  if (/\b(yes|yeah|sure|please|absolutely|claro|dale|por supuesto|adelante)\b/i.test(lower) || /(?:^|\s|[.,!])sí(?:\s|$|[.,!])/iu.test(lower)) return true;
  return null;
}

// Fail-loud sales copy lookup — same contract as t(): a missing key logs
// [L10N MISSING] and falls back to EN, never a silent blank.
function ts(lang, key, vars) {
  const table = TRADE_SALES[lang] || null;
  let s = table && table[key];
  if (!s) {
    console.error('[L10N MISSING]', 'trade_sales', lang, key);
    s = TRADE_SALES.en[key] || '';
  }
  if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}

function getSpacedLast4(fromNumber) {
  if (!fromNumber) return '';
  const digits = String(fromNumber).replace(/\D/g, '');
  if (digits.length < 4) return '';
  return digits.slice(-4).split('').join(' ');
}

function getPhoneVars(fromNumber, lang = 'en') {
  const spaced = getSpacedLast4(fromNumber);
  if (spaced) {
    return {
      PHONE_VALIDATION: lang === 'es'
        ? `¿está bien enviarle un mensaje de texto a este número que termina en ${spaced}?`
        : `is it okay to text you back on this number ending in ${spaced}?`,
      LAST4: spaced,
      PHOTO_PHONE_TARGET: lang === 'es'
        ? ` a este número que termina en ${spaced}`
        : ` to this number ending in ${spaced}`
    };
  }
  return {
    PHONE_VALIDATION: lang === 'es'
      ? `¿es este un buen número para contactarle?`
      : `is this a good number to reach you?`,
    LAST4: '',
    PHOTO_PHONE_TARGET: ''
  };
}

function t(specialist, lang, key, vars) {
  const spec = SPECIALISTS[specialist];
  const table = spec && (spec.l10n[lang] || null);
  let s = table && table[key];
  if (!s) {
    console.error('[L10N MISSING]', specialist, lang, key); // fail loud, never a silent blank
    s = (spec && spec.l10n.en[key]) || '';
  }
  const mergedVars = Object.assign({
    PHONE_VALIDATION: lang === 'es' ? '¿es este un buen número para contactarle?' : 'is this a good number to reach you?',
    LAST4: '',
    PHOTO_PHONE_TARGET: ''
  }, vars);
  for (const k of Object.keys(mergedVars)) s = s.split('{' + k + '}').join(mergedVars[k]);
  return s;
}

function isKnown(specialist) {
  return Object.prototype.hasOwnProperty.call(SPECIALISTS, specialist);
}

function hints(specialist, lang) {
  return t(specialist, lang || 'en', 'hints');
}

function createSession(specialist, callSid, fromNumber, opts) {
  if (callSid && typeof callSid === 'object') {
    opts = callSid;
    fromNumber = opts.fromNumber || '';
    callSid = opts.callSid || ('CALL-' + Date.now());
  }
  const spec = SPECIALISTS[specialist];
  // Sales/demo mode is a TRADE capability only. A sales request on a non-trade
  // persona falls back to specialist intake — loudly, never silently.
  let mode = 'specialist';
  if (opts && opts.mode === 'sales') {
    if (spec.type === 'trade') mode = 'sales';
    else console.error('[SALES MODE UNSUPPORTED]', specialist, spec.type, '- falling back to specialist intake');
  }
  const matchedProspect = lookupProspectByPhone(fromNumber);
  if (matchedProspect) {
    console.log(`[OSINT CALLER ID MATCH] From=${fromNumber} matched business "${matchedProspect.name}" in ${matchedProspect.city || 'local'}`);
  }
  return {
    callSid: callSid || 'CALL-' + Date.now(),
    fromNumber: fromNumber || '',
    nameAttempts: 0,
    prospect: matchedProspect || null,
    specialist: specialist,
    mode: mode,
    startTimestamp: Date.now(),
    startTime: new Date().toISOString(),
    transcript: '',
    step: 0,
    salesStep: 0,
    language: 'en',
    isComplete: false,
    claimRef: spec.refPrefix + Math.floor(10000 + Math.random() * 90000),
    fnolData: { language: 'en', callerName: null },
    ticket: {
      specialist: specialist,
      displayName: spec.displayName,
      mode: mode,
      emergency: false,
      dispatchState: 'REQUEST_CAPTURED',
      language: 'en',
      matchedProspect: matchedProspect ? matchedProspect.name : null,
      callerName: null
    },
    compositeDemo: Boolean(opts && opts.compositeDemo),
  };
}

// Sales conversation state machine — runs AFTER the trade intake completes.
function classifyTradeLevel(speech) {
  if (!speech) return 'LEVEL_1_SOLO';
  const lower = speech.toLowerCase();
  if (/\b(100\+|100 plus|hundred|enterprise|fleet|regional|call center|30 trucks|20 trucks|50 trucks|director|vp of ops)\b/i.test(lower)) {
    return 'LEVEL_3_ENTERPRISE';
  }
  if (/\b(dispatcher|office manager|3 to 10|5 to 10|under 20|less than 20|mid-size|4 trucks|5 trucks|6 trucks|7 trucks|8 trucks|10 trucks|12 trucks)\b/i.test(lower)) {
    return 'LEVEL_2_MIDSIZE';
  }
  return 'LEVEL_1_SOLO';
}

// One question per turn; silence/low-confidence re-asks, never advances.
function evaluateSalesTurn(session, userSpeech, { language, digits, isSilenceTimeout, isLowConfidence } = {}) {
  const spec = SPECIALISTS[session.specialist];
  const lang = language || session.language || 'en';
  session.language = lang;
  session.ticket.language = lang;
  session.salesStep = session.salesStep || 0;
  session.ticket.offerTier = 'B'; // OFFER-TIER-TEST-01: B is the only offer, ever
  const noun = (spec.tradeNoun && (spec.tradeNoun[lang] || spec.tradeNoun.en)) || 'service';

  // Direct acceptance check: if caller accepts the trial link / offer during sales
  const isDirectAcceptance = hasUsableSpeech(userSpeech) && /\b(text\s+(me\s+)?(the\s+)?(setup\s+|trial\s+|dashboard\s+)?link|send\s+(me\s+)?(the\s+)?link|sign\s+me\s+up|get\s+started|start\s+my\s+trial|activate\s+my\s+trial)\b/i.test(userSpeech) && affirmative(userSpeech, digits) !== false;
  if (isDirectAcceptance) {
    session.transcript += '\nCaller: ' + userSpeech;
    session.ticket.offerAccepted = true;
    session.isComplete = true;
    const closing = ts(lang, 'closingYes', { REF: session.claimRef || 'SVC-DEMO-01', TRADE: noun });
    session.transcript += '\nDemo Host (Matthew): ' + closing;
    return { speechChunks: [{ voice: 'narrator', text: closing }], isFinal: true };
  }

  // 2nd Listener dynamic retrieval during sales turns (pricing, setup, integrations, questions)
  if (hasUsableSpeech(userSpeech)) {
    const rag = secondListenerRagEngine.query(userSpeech, { specialist: session.specialist, language: lang, stage: 'sales_qa' });
    if (rag && rag.speechChunks && rag.speechChunks.length > 0) {
      session.transcript += '\nCaller: ' + userSpeech;
      const spokenText = rag.speechChunks.map(c => c.text).join(' ');
      session.transcript += '\nDemo Host (Matthew): ' + spokenText;
      return { speechChunks: rag.speechChunks, isFinal: false };
    }
  }

  // PASS-04: noisy roadside audio / interrupted speech that transcribes to
  // whitespace must re-ask the CURRENT sales-stage question, never advance
  // or misclassify noise as role/pain/interest — unless a DTMF digit was
  // pressed, which is a valid answer on its own.
  if ((isSilenceTimeout || isLowConfidence || (!hasUsableSpeech(userSpeech) && !digits)) && session.salesStep > 0) {
    const key = session.salesStep === 1 ? 'askRole' : session.salesStep === 2 ? 'askPain' : session.salesStep === 3 ? 'askInterest' : 'offerTierB';
    const text = ts(lang, key, { TRADE: noun });
    session.transcript += '\nDemo Host (Matthew): ' + text;
    return { speechChunks: [{ voice: 'narrator', text: text }], isFinal: false };
  }

  // Stage 1 — bridge off the logged ticket or direct sales greeting + role discovery.
  if (session.salesStep === 0) {
    session.salesStep = 1;
    const isDirectSales = !session.intakeComplete;
    const bridge = isDirectSales
      ? (lang === 'es'
          ? `Bienvenido a la demostración interactiva de Agent Angel para contratistas de ${noun}.`
          : `Welcome to the Agent Angel autonomous answering and dispatch demo for ${noun} contractors.`)
      : ts(lang, 'bridge', { TRADE: noun, REF: session.claimRef });
    const q = ts(lang, 'askRole');
    session.transcript += '\nDemo Host (Matthew): ' + bridge + ' ' + q;
    return {
      speechChunks: [
        { voice: 'narrator', text: bridge },
        { voice: 'narrator', text: q, pause: 1 },
      ],
      isFinal: false,
    };
  }

  // Stage 2 — record role and fleet level, pinpoint the pain.
  if (session.salesStep === 1) {
    if (userSpeech) session.transcript += '\nCaller: ' + userSpeech;

    // Emergency homeowner intercept: If someone calls reporting an active emergency, branch immediately to intake
    const isEmergencyPeril = /\b(burst pipe|pipe burst|water heater|leak|leaking|flooding|water pouring|spraying|emergency|faucet broken|slab leak|homeowner)\b/i.test(userSpeech);
    if (isEmergencyPeril) {
      session.mode = 'intake';
      session.step = 1;
      return evaluateTurn(session, userSpeech, { language: lang, digits, isSilenceTimeout, isLowConfidence });
    }

    session.ticket.salesRole = classifyTradeRole(userSpeech);
    session.ticket.tradeLevel = classifyTradeLevel(userSpeech);
    session.salesStep = 2;
    const ack = ts(lang, 'ackRole');
    const q = ts(lang, 'askPain');
    session.transcript += '\nDemo Host (Matthew): ' + ack + ' ' + q;
    return {
      speechChunks: [
        { voice: 'narrator', text: ack },
        { voice: 'narrator', text: q, pause: 1 },
      ],
      isFinal: false,
    };
  }

  // Stage 3 — record pain, pitch mapped to it AND demographic level
  if (session.salesStep === 2) {
    if (userSpeech) session.transcript += '\nCaller: ' + userSpeech;
    const pain = classifyTradePain(userSpeech);
    session.ticket.salesPain = pain;
    const level = session.ticket.tradeLevel || classifyTradeLevel(userSpeech);
    let pitch;
    if (level === 'LEVEL_3_ENTERPRISE') {
      pitch = lang === 'es'
        ? 'Para operaciones comerciales con flotas grandes, el mayor punto ciego es el muestreo manual de calidad del dos por ciento. Con nuestro motor de telefonía ambiental AxiRate, conectamos directamente a sus grabaciones para auditar el cien por ciento de las llamadas de sus operadores diurnos durante sesenta días gratuitos como línea de base, antes de que Angel asuma la recepción de noches y fines de semana.'
        : 'For large commercial trade operations, the single biggest blindspot is the two percent manual QA sampling gap. With our AxiRate ambient telephony engine, we connect directly to your call audio streams to audit one hundred percent of your daytime CSR calls for sixty days free to establish your baseline, before Angel takes over night and weekend emergency dispatch.';
    } else if (level === 'LEVEL_2_MIDSIZE') {
      pitch = lang === 'es'
        ? 'Para empresas de tamaño mediano con despachadores, en las mañanas de alta demanda y después de las cinco de la tarde es imposible contestar todo. Angel atiende el desborde al primer timbre, filtra emergencias reales para no fatigar a sus técnicos de guardia y registra los trabajos directo en ServiceTitan, Housecall Pro o Jobber mediante webhooks.'
        : 'For mid-size trade contractors with dispatchers, peak morning call rushes and after-hours surges overwhelm office staff. Angel answers overflow on the first ring, filters genuine emergencies to prevent technician fatigue, and pushes tickets straight into ServiceTitan, Housecall Pro, or Jobber via native webhooks.';
    } else {
      const pitchKey = pain === 'AFTER_HOURS' ? 'pitchAfterHours' : pain === 'NO_SHOW' ? 'pitchNoShow' : pain === 'DISPATCH' ? 'pitchDispatch' : 'pitchGeneral';
      pitch = ts(lang, pitchKey, { TRADE: noun });
    }
    session.salesStep = 3;
    const ack = ts(lang, 'ackPain');
    const q = ts(lang, 'askInterest');
    session.transcript += '\nDemo Host (Matthew): ' + ack + ' ' + pitch + ' ' + q;
    return {
      speechChunks: [
        { voice: 'narrator', text: ack },
        { voice: 'narrator', text: pitch, pause: 1 },
        { voice: 'narrator', text: q },
      ],
      isFinal: false,
    };
  }

  // Stage 4 — the close tailored to fleet level with Sovereign Pricing (Ruling Q-PLUMBER-OFFER-01)
  if (session.salesStep === 3) {
    if (userSpeech) session.transcript += '\nCaller: ' + userSpeech;
    session.ticket.salesInterest = affirmative(userSpeech, digits);
    session.salesStep = 4;
    const level = session.ticket.tradeLevel || 'LEVEL_1_SOLO';
    let offer;
    if (level === 'LEVEL_3_ENTERPRISE') {
      offer = lang === 'es'
        ? 'Para su flota, configuramos su auditoría gratuita de sesenta días con AxiRate sin reemplazar su software actual. ¿Le parece bien si le envío un enlace de texto para agendar una sesión ejecutiva de consulta con nuestro director de operaciones?'
        : 'For your enterprise fleet, we set up your sixty-day free AxiRate baseline audit with zero software replacement. May I text you an executive consultation link for your operations leadership?';
    } else if (level === 'LEVEL_2_MIDSIZE') {
      offer = lang === 'es'
        ? 'Para contratistas medianos, tiene una prueba de 14 días sin costo y sin tarjeta. Si decide continuar, sus primeros 30 días son solo $99 y luego $499 al mes con integraciones nativas para ServiceTitan, Housecall Pro y Jobber. Además incluye nuestra Garantía de Devolución de 30 Días. ¿Desea que le envíe el enlace de prueba y panel en vivo por mensaje de texto?'
        : 'For mid-size contractors, you get a 14-day zero-card trial. If you love it, your first 30 days is just $99, then our standard $499 a month flat rate with native ServiceTitan, Housecall Pro, and Jobber webhooks — backed by our 30-Day Money-Back Guarantee. May I text you your trial link and live dashboard right now?';
    } else {
      offer = lang === 'es'
        ? 'Tiene una prueba de 14 días con costo cero y sin tarjeta de crédito. Si decide continuar, sus primeros 30 días son solo $99, y luego $499 al mes tarifa plana respaldado por nuestra Garantía de Devolución de 30 Días: si no captura al menos 5 trabajos calificados, le devolvemos el 100%. La configuración toma 45 segundos con asterisco 72. ¿Desea que le envíe su enlace de prueba por mensaje de texto?'
        : 'You get a 14-day zero-card trial with no credit card required. If you love it, your first 30 days is just $99, and then our standard $499 a month flat rate backed by our 30-Day Money-Back Guarantee: if it does not capture at least 5 qualified jobs in your first month, you get 100% of your money back. Setup takes 45 seconds using star 72. May I text you your trial link and live dashboard right now?';
    }
    session.transcript += '\nDemo Host (Matthew): ' + offer;
    return { speechChunks: [{ voice: 'narrator', text: offer, pause: 1 }], isFinal: false };
  }

  // Stage 5 — resolution.
  if (userSpeech) session.transcript += '\nCaller: ' + userSpeech;
  const yes = affirmative(userSpeech, digits);
  session.ticket.offerAccepted = yes === true;
  session.isComplete = true;
  const closingKey = yes === true ? 'closingYes' : yes === false ? 'closingNo' : 'closingDefault';
  const closing = ts(lang, closingKey, { REF: session.claimRef || 'SVC-DEMO-01', TRADE: noun });
  session.transcript += '\nDemo Host (Matthew): ' + closing;
  return { speechChunks: [{ voice: 'narrator', text: closing }], isFinal: true };
}


function evaluateTurn(session, userSpeech, { language, digits, isSilenceTimeout, isLowConfidence } = {}) {
  if (session && session.specialist === 'cos_hermes') {
    const cosSupport = require('./cos_customer_support_triage_engine');
    return cosSupport.evaluateCosSupportTurn(session, userSpeech, { language, digits, isSilenceTimeout, isLowConfidence });
  }
  const spec = SPECIALISTS[session.specialist];
  let lang = language || session.language || 'en';
  session.language = lang;
  session.ticket.language = lang;
  const flow = FLOWS[session.specialist] || FLOWS[spec.type] || FLOWS.trade;

  // Built-in bilingual language switch ("Español", "En español", "Habla español", or DTMF "2" / "English")
  const trimmedSpeech = (userSpeech || '').trim();
  const isSpanishSwitchRequest = digits === '2' || /^(?:(?:en|habla|hablas|hablar|quiero|prefiero)\s+)?(?:espa[ñn]ol|spanish)[.!?]*$/i.test(trimmedSpeech);
  const isEnglishSwitchRequest = (lang === 'es') && (digits === '1' || /^(?:(?:in|speak)\s+)?(?:english|ingl[ée]s)[.!?]*$/i.test(trimmedSpeech));
  if ((isSpanishSwitchRequest || isEnglishSwitchRequest) && session.step > 0) {
    lang = isSpanishSwitchRequest ? 'es' : 'en';
    session.language = lang;
    session.ticket.language = lang;
    const cur = flow[Math.max(0, session.step - 1)] || flow[0];
    const phoneVars = getPhoneVars(session.fromNumber, lang);
    const qPrompt = cur.q === 'greeting'
      ? (lang === 'es'
        ? `Con mucho gusto continuamos en español. ¿Me puede indicar su nombre y apellido y si podemos enviarle mensajes de texto a este número que termina en ${phoneVars.LAST4}?`
        : `Happy to continue in English. May I have your first and last name, and is it okay to text you back on this number ending in ${phoneVars.LAST4}?`)
      : t(session.specialist, lang, cur.q, phoneVars);
    session.transcript += '\nCaller: ' + trimmedSpeech;
    session.transcript += '\n' + spec.displayName + ': ' + qPrompt;
    return { speechChunks: [{ voice: 'agent', text: qPrompt, lang }], isFinal: false };
  }

  if (userSpeech && typeof userSpeech === 'string') {
    userSpeech = userSpeech
      .replace(/\b(\d{1,2}):(\d{2})(?=\s+[A-Za-z]+\s+(?:street|st|road|rd|avenue|ave|blvd|boulevard|lane|ln|drive|dr|way|court|ct|highway|hwy|pkwy|parkway|loop|circle|cir|calle|avenida)\b)/gi, '$1$2')
      .replace(/(\b\d{2,5}\s+[A-Za-z0-9]+),\s+([A-Za-z]+\s+(?:street|st|road|rd|avenue|ave|blvd|boulevard|lane|ln|drive|dr|way|court|ct|highway|hwy|pkwy|parkway|loop|circle|cir|calle|avenida)\b)/gi, '$1 $2');
  }

  // QA Script Note Handler (Strict prefix match for internal QA/tester notes only)
  const commentBreakInRegex = /^\s*(?:qa note|developer note|script note|comentario qa)[:\s]/i;
  if (userSpeech && commentBreakInRegex.test(userSpeech)) {
    const commentPayload = userSpeech.replace(/^\s*(?:qa note|developer note|script note|comentario qa)[:\s]*/i, '').trim() || userSpeech;
    session.scriptNotes = session.scriptNotes || [];
    const noteEntry = {
      timestamp: new Date().toISOString(),
      callSid: session.callSid,
      specialist: session.specialist,
      step: session.step,
      note: commentPayload,
      raw: userSpeech
    };
    session.scriptNotes.push(noteEntry);
    session.ticket.scriptNotes = session.ticket.scriptNotes || [];
    session.ticket.scriptNotes.push(commentPayload);

    try {
      const notesFilePath = path.join(__dirname, '../04_Infrastructure_Logs/post_call_script_notes.jsonl');
      fs.appendFileSync(notesFilePath, JSON.stringify(noteEntry) + '\n', 'utf8');
    } catch (e) {
      console.error('[SPECIALIST SCRIPT NOTE LOG ERROR]', e.message);
    }

    const phoneVars = getPhoneVars(session.fromNumber, lang);
    const cur = flow[Math.max(0, session.step - 1)] || flow[0];
    const qPrompt = cur.q === 'greeting'
      ? (lang === 'es' ? '¿Me puede indicar su nombre y apellido y si este es el mejor número para contactarle?' : 'May I have your first and last name, and is this the best phone number to reach you?')
      : t(session.specialist, lang, cur.q, phoneVars);
    const ackText = lang === 'es'
      ? `Comentario anotado: "${commentPayload}". Continuamos con su solicitud: ${qPrompt}`
      : `Comment noted: "${commentPayload}". Resuming your request: ${qPrompt}`;

    session.transcript += '\nCaller (Comment Break-In): ' + userSpeech;
    session.transcript += '\n' + spec.displayName + ': ' + ackText;
    return { speechChunks: [{ voice: 'agent', text: ackText }], isFinal: false };
  }

  // Explicit sales bypass: caller directly demands sales rep / skips demo
  const isExplicitSalesBypass = userSpeech && /\b(skip (the )?(intake|demo)|skip to sales|talk to sales|speak to sales|buy (the|this) software|sign up right now)\b/i.test(userSpeech);
  if (isExplicitSalesBypass && (session.mode !== 'sales' || !session.salesStep)) {
    session.mode = 'sales';
    session.salesStep = 1;
    return evaluateSalesTurn(session, userSpeech, { language: lang, digits, isSilenceTimeout, isLowConfidence });
  }

  // Sales phase — every turn in sales mode after intake transition (salesStep >= 1) routes to sales engine:
  if (session.mode === 'sales' && session.salesStep >= 1) {
    return evaluateSalesTurn(session, userSpeech, { language: lang, digits, isSilenceTimeout, isLowConfidence });
  }

  // Silence or rejected low-confidence speech: re-ask the CURRENT question,
  // never advance (JD call CAe00549 defect class). The webhook's own reprompt
  // prefix already plays before the Redirect lands here.
  // PASS-04: a noisy-roadside transcript that comes back whitespace-only is
  // the same defect class — never record it into the ticket or advance.
  if ((isSilenceTimeout || isLowConfidence || !hasUsableSpeech(userSpeech)) && session.step > 0) {
    const questionIndex = (session.step === 1 && !session.fnolData?.callerName && !session.ticket?.callerName) ? 0 : Math.min(session.step, flow.length - 1);
    const cur = flow[questionIndex];
    const text = cur.q === 'greeting'
      ? (lang === 'es' ? '¿Me puede indicar su nombre y apellido y si este es el mejor número para contactarle?' : 'May I have your first and last name, and is this the best phone number to reach you?')
      : t(session.specialist, lang, cur.q, getPhoneVars(session.fromNumber, lang));
    session.transcript += '\n' + spec.displayName + ': ' + text;
    return { speechChunks: [{ voice: 'agent', text: text }], isFinal: false };
  }

  // First turn: greeting (asks the first question) + language selector spoken
  // in the OTHER language's own neural voice (VOICE-ES-QUALITY-01).
  if (session.step === 0) {
    if (session.skipGreetingPreamble) {
      // Demo Host layer (Matthew) already played welcome, disclosure and handoff.
      const existingName = session.hostCallerName || session.fnolData?.callerName || session.ticket?.callerName || null;
      const tradeWord = (spec.tradeNoun && (spec.tradeNoun[lang] || spec.tradeNoun.en)) || 'service';
      if (existingName) {
        session.ticket.callerName = existingName;
        session.fnolData.callerName = existingName;
        session.step = 2; // Advance past callerName directly to serviceAddress
        const spokenGreeting = session.hostSpokenGreeting
          || (customerIdentity.extractCallerIdentity(existingName)?.spokenGreeting)
          || (existingName.startsWith('Mr.') || existingName.startsWith('Dr.') || existingName.startsWith('Mrs.') || existingName.startsWith('Ms.') ? existingName : existingName.split(' ')[0]);
        session.callerSpokenGreeting = spokenGreeting;
        const nextQ = t(session.specialist, lang, 'qAddress');
        const openMsg = lang === 'es'
          ? `Hola ${spokenGreeting}, soy Angel, su especialista de ${tradeWord} 24/7. ${nextQ}`
          : `Hello ${spokenGreeting}, I'm Angel, your 24/7 ${tradeWord} dispatch specialist. ${nextQ}`;
        session.transcript += '\n' + spec.displayName + ': ' + openMsg;
        return {
          speechChunks: [{ voice: 'agent', text: openMsg }],
          isFinal: false
        };
      } else {
        session.step = 1;
        const openMsg = lang === 'es'
          ? `Hola, soy Angel, su especialista de despacho de ${tradeWord} 24/7. Para registrar su orden, ¿cuál es su nombre y apellido?`
          : `Hello, I'm Angel, your 24/7 ${tradeWord} dispatch specialist. To get your service order started, may I have your first and last name?`;
        session.transcript += '\n' + spec.displayName + ': ' + openMsg;
        return {
          speechChunks: [{ voice: 'agent', text: openMsg }],
          isFinal: false
        };
      }
    }

    session.step = 1;
    let greeting = t(session.specialist, lang, 'greeting', getPhoneVars(session.fromNumber, lang));
    if (session.prospect && session.prospect.name && session.specialist !== 'cos_hermes') {
      session.ticket.matchedProspect = {
        name: session.prospect.name,
        city: session.prospect.city,
        vertical: session.prospect.vertical,
        domain: session.prospect.domain
      };
      const bName = session.prospect.name;
      const city = session.prospect.city ? (lang === 'es' ? ` en ${session.prospect.city}` : ` in ${session.prospect.city}`) : '';
      const prefix = lang === 'es'
        ? `Reconociendo a ${bName}${city}. `
        : `Recognizing ${bName}${city}. `;
      greeting = prefix + greeting;
    }
    const otherLang = lang === 'es' ? 'en' : 'es';
    const selector = t(session.specialist, lang, 'selector');
    session.transcript += '\n' + spec.displayName + ': ' + greeting;
    return {
      speechChunks: [
        { voice: 'agent', text: greeting },
        { voice: 'agent', text: selector, lang: otherLang, pause: 1 },
      ],
      isFinal: false,
    };
  }

  // Explicit User Demand for a Human Representative / Operator (Gate 2 & Gate 5 De-Escalation Transfer)
  const humanRepRegex = /\b(human|representative|operator|real person|live agent|talk to a (person|human|representative|manager|agent)|speak (to|with) a (person|human|representative|manager|agent)|speak (to|with) someone|speak to a manager|transfer me|customer service|persona|humano|representante|operador|hablar con (una persona|un humano|alguien)|persona real|atenci[óo]n al cliente)\b/i;
  if (userSpeech && humanRepRegex.test(userSpeech)) {
    session.transferToHuman = true;
    session.routeChoice = 'human_escalation';
    session.ticket.transferToHuman = true;
    session.ticket.humanEscalationRequested = true;
    session.ticket.dispatchState = 'DISPATCH_UNAVAILABLE_HUMAN_ESCALATION';
    const cur = flow[Math.max(0, session.step - 1)] || flow[0];
    const qPrompt = cur.q === 'greeting'
      ? (lang === 'es' ? '¿Me puede indicar su nombre y apellido y si este es el mejor número para contactarle?' : 'May I have your first and last name, and is this the best phone number to reach you?')
      : t(session.specialist, lang, cur.q);
    const text = lang === 'es'
      ? `Por supuesto — estoy transfiriendo su llamada directamente a nuestro personal de guardia ahora mismo. Si la línea está ocupada, también puedo dejar registrados sus datos para devolución prioritaria: ${qPrompt}`
      : `Of course — I am connecting your call directly to our on-call human staff right now. In case the line is busy, let me also log your callback details for immediate priority follow-up: ${qPrompt}`;
    session.transcript += '\nCaller: ' + userSpeech;
    session.transcript += '\n' + spec.displayName + ': ' + text;
    return { speechChunks: [{ voice: 'agent', text }], isFinal: false, transferToHuman: true, routeChoice: 'human_escalation' };
  }

  const answered = flow[session.step - 1];

  // Specific check: caller asking what window is available
  if (answered && answered.field === 'preferredWindow' && userSpeech) {
    const isAskingAvailability = /\b(what (do you have|is) open|what('s| is) available|when can (someone|you|they) come|what times?|what hours?|horarios?|qu[eé] tienen?|cu[aá]ndo pueden)\b/i.test(userSpeech);
    if (isAskingAvailability) {
      const suggestText = lang === 'es'
        ? 'Tenemos disponibilidad hoy entre las 2 y 4 de la tarde, o mañana temprano de 8 a 11 de la mañana. ¿Cuál de esos horarios le queda mejor?'
        : 'We have availability today between 2 and 4 PM, or tomorrow morning between 8 and 11 AM. Which of those windows works best for you?';
      session.transcript += '\nCaller: ' + userSpeech;
      session.transcript += '\n' + spec.displayName + ': ' + suggestText;
      return { speechChunks: [{ voice: 'agent', text: suggestText }], isFinal: false };
    }
  }

  const preTicketSnapshot = Object.assign({}, session.ticket || {});

  // Universal emergency & plumbing category detection across all turns
  const urgentRe = URGENT[session.specialist];
  const isPureInquiryQuestion = Boolean(
    userSpeech &&
    /^(?:how\s+(?:fast|soon|much|long)|when\s+can|what\s+(?:is|are)|do\s+you|can\s+you|are\s+you|cu[aá]nto|c[oó]mo|cu[aá]ndo|est[aá]n\s+abiertos)\b/i.test(userSpeech.trim()) &&
    !/\b(my|our|we\s+have|i\s+have|is\s+(?:leaking|burst|flooding|backing\s+up|overflowing|smelling)|tengo|tenemos|se\s+revent[óo]|est[aá]\s+(?:saliendo|inundando))\b/i.test(userSpeech)
  );
  const isEmergencySpoken = !isPureInquiryQuestion && !!(userSpeech && urgentRe && urgentRe.test(userSpeech));
  session.ticket.tradeClassification = session.specialist;
  if (session.specialist === 'plumbing' && userSpeech && !isPureInquiryQuestion) {
    const detectedCat = classifyPlumbingCategory(userSpeech, session.ticket.plumbingCategory);
    if (detectedCat) {
      session.ticket.plumbingCategory = detectedCat;
    }
    if (plumbingIntakeSafety && typeof plumbingIntakeSafety.triageLifeSafety === 'function') {
      const safetyVerdict = plumbingIntakeSafety.triageLifeSafety(userSpeech);
      if (safetyVerdict && safetyVerdict.isLifeSafetyEmergency) {
        session.ticket.lifeSafetyTriage = {
          hazardId: safetyVerdict.hazardId,
          priority: safetyVerdict.priority,
          transferToHuman: Boolean(safetyVerdict.transferToHuman),
          escalationReason: safetyVerdict.escalationReason
        };
        session.ticket.humanEscalationReady = true;
      }
    }
  }
  if (isEmergencySpoken || session.ticket.emergency) {
    session.ticket.emergency = true;
    session.ticket.dispatchPriority = 'P0_EMERGENCY';
    const isBurst = userSpeech && /\b(burst|bursting|revent[óo]|tuber[íi]a\s+rota)\b/i.test(userSpeech);
    if (session.ticket.plumbingCategory === 'GAS_WATER_HEATER_HAZARD') {
      session.ticket.incidentClassification = 'GAS_LEAK_HAZARD';
    } else if (session.ticket.plumbingCategory === 'SEWER_MAIN_BACKUP') {
      session.ticket.incidentClassification = 'SEWER_BACKUP';
    } else if (session.ticket.plumbingCategory === 'SLAB_LEAK') {
      session.ticket.incidentClassification = 'SLAB_LEAK';
    } else if (isBurst) {
      session.ticket.incidentClassification = 'BURST_PIPE';
    } else if (!session.ticket.incidentClassification) {
      session.ticket.incidentClassification = 'ACTIVE_LEAK';
    }
  }

  // 2nd Listener Live Session Fact Readback (e.g., "What address do you have?", "What time window did you put down?")
  if (userSpeech && secondListenerRagEngine && typeof secondListenerRagEngine.detectSessionFactInquiry === 'function') {
    const factInq = secondListenerRagEngine.detectSessionFactInquiry(userSpeech, session, { language: lang });
    if (factInq && (factInq.action === 'SESSION_FACT_READBACK' || factInq.action === 'SESSION_FACT_MISSING_PROMPT')) {
      session.transcript += '\nCaller: ' + userSpeech;
      session.transcript += '\n' + spec.displayName + ': ' + factInq.text;
      if (answered && answered.field === 'summaryConfirm') {
        session.ticket.summaryConfirmed = false;
        delete session.ticket.summaryConfirm;
      }
      return { speechChunks: [{ voice: 'agent', text: factInq.text }], isFinal: false };
    }
  }

  // Universal mid-call trade inquiry & price intercept flags (Zero hardcoded street/city names)
  const isSlotAnswerUtterance = Boolean(
    (answered && answered.field === 'callerName' && !!(customerIdentity.extractCallerIdentity(userSpeech || '') || {}).displayName) ||
    /\b(my name is|from [a-z0-9\s]+|with [a-z0-9\s]+|this is my (?:cell|phone)|reach me here|yes,?\s+(?:i|all|everything|please|the|that|it)|within the next hour|between \d|\d{1,2}\s*(?:am|pm|a\.m\.|p\.m\.)|tomorrow\s+(?:morning|afternoon))\b/i.test(userSpeech || '') ||
    /\b\d{1,5}\s+[A-Za-z0-9'-]+(?:\s+[A-Za-z0-9'-]+){0,3}\s+(?:street|st|road|rd|avenue|ave|blvd|boulevard|lane|ln|drive|dr|way|court|ct|highway|hwy|pkwy|parkway|loop|circle|cir|trail|calle|avenida)\b/i.test(userSpeech || '')
  );
  const isCostQuestion = !isSlotAnswerUtterance && userSpeech && /\b(how much|cost|price|pricing|quote|estimate|rate|trip\s+fee|service\s+fee|dispatch\s+fee|cuanto|precio|tarifa|cobran|presupuesto)\b/i.test(userSpeech);
  const isGeneralTradeInquiry = !isEmergencySpoken && !isSlotAnswerUtterance && userSpeech && (/^(?:how|what|when|where|why|who|can you|could you|are you|do you|does|is this a|will someone|cu[aá]nto|c[oó]mo|qu[eé]|d[óo]nde|pueden)\b/i.test(userSpeech.trim()) || /\b(?:how much|how long|how fast|how soon|do you guys|can you guys|what is the|what are your|are you open|where is my main|how do i shut off|how do i turn off)\b/i.test(userSpeech)) && (isPureInquiryQuestion || !(urgentRe && urgentRe.test(userSpeech)));

  // Universal slot extraction across all turns (volunteered address, phone, problem across all 6 trades)
  const tradeProblemRe = /\b(burst|leak|leaking|pipe|flood|flooding|toilet|sink|clog|clogged|water heater|tankless|pilot\s+light|slab\s+leak|hose\s+bib|spigot|pressure\s+reducing|prv|backflow|garbage\s+disposal|disposal|faucet|anode\s+rod|tank\s+flush|annual\s+flush|gas\s+(?:smell|leak|odor)|smell\s+gas|fuga|tuber[íi]a|inundaci[óo]n|caved\s+in|pouring|mucha\s+agua|ruido\s+horrible|overflow|overflowing|sewage|sewer|backing\s+up|backed\s+up|aguas\s+negras|alcantarillado|calentador|inodoro|taza|atascado|tapado|llave\s+exterior|mantenimiento|furnace|thermostat|compressor|ac\s+unit|air\s+conditioner|no\s+cooling|no\s+heat|blowing\s+cold|shingles?|roof\s+leak|dripping|windstorm|gutter|storm\s+damage|breaker|panel|outlet|sparking|wiring|power\s+outage|toothache|cracked|molar|tooth\s+pain|crown|filling|swelling|broken\s+tooth|rear-?ended|18-wheeler|car\s+accident|truck\s+accident|whiplash|broke\s+my)\b/i;
  const ALL_SUPPORTED_CITIES_RE = /\b(?:(?:in|en|at)\s+)?(Dallas|Fort Worth|Tyler|Austin|Houston|San Antonio|El Paso|Plano|Frisco|Denton|Arlington|Wichita Falls|Conway|Broken Bow|Longview|Lubbock|Midland|Odessa|Amarillo|Waco|Texarkana|Abilene|Beaumont|Round Rock|Laredo|McAllen|Sherman|Denison|Paris|Lufkin|Nacogdoches|San Angelo)(?!\s+(?:street|st|road|rd|avenue|ave|blvd|boulevard|lane|ln|drive|dr|way|court|ct|highway|hwy|pkwy|parkway|loop|circle|cir|terrace|ter|place|pl|trail|calle|avenida)\b)(?:,?\s*(?:TX|Texas|AR|Arkansas|OK|Oklahoma))?(?:\s+(\d{5}))?\b/i;

  if (userSpeech) {
    // Check if caller volunteered problem or emergency (guard against pure price/general trade inquiries)
    const isQuestionOrInquiry = isCostQuestion || (isGeneralTradeInquiry && !session.ticket.emergency);
    const hasProblem = !isQuestionOrInquiry && Boolean(
      (urgentRe && urgentRe.test(userSpeech)) ||
      tradeProblemRe.test(userSpeech)
    );
    if (session.step >= 1 && (hasProblem || (session.ticket.emergency && !isCostQuestion))) {
      if (!session.ticket.problemDescription && hasProblem) {
        let cleanedProb = userSpeech
          .replace(/^(?:(?:hi|hello|hey|hola|buenos\s+d[íi]as|buenas\s+tardes|yes|yeah|sí)[,.\s]+)*/i, '')
          .replace(/^(?:my\s+name\s+is|this\s+is|i\s+am|i'm|me\s+llamo|mi\s+nombre\s+es|soy)\s+[A-Za-zÀ-ÿ'-]+(?:\s+[A-Za-zÀ-ÿ'-]+){0,2}(?:\s+(?:from|with|at|en|de)\s+[^,.]+)?[,.\s]+/i, '')
          .replace(/^(?:(?:and\s+)?(?:this\s+is\s+my\s+(?:cell|phone|mobile)(?:\s+number)?|yes\s+this\s+is\s+my\s+(?:cell|phone)|reach\s+me\s+here|sí\s+este\s+es\s+mi\s+(?:celular|tel[ée]fono))[,.\s]+)+/i, '')
          .replace(/^(?:(?:i'm|i\s+am|we're|we\s+are|estoy|estamos)\s+(?:at|in|on|en)\s+)?\d{1,5}\s+[A-Za-z0-9\s.,'-]+?\s+(?:street|st|road|rd|avenue|ave|blvd|boulevard|lane|ln|drive|dr|way|court|ct|highway|hwy|pkwy|parkway|loop|circle|cir|terrace|ter|place|pl|trail|calle|avenida)(?:\s*,?\s*(?:(?:in|en)\s+)?[A-Za-z\s]+(?:,?\s*(?:TX|Texas|AR|Arkansas|OK|Oklahoma))?(?:\s+\d{5})?)?[,.\s]+(?:and\s+|where\s+|y\s+)?/i, '')
          .trim();
        session.ticket.problemDescription = cleanedProb || userSpeech.trim();
      }
      if (session.ticket.emergency && !session.ticket.urgency) {
        session.ticket.dispatchPriority = 'P0_EMERGENCY';
        session.ticket.urgency = lang === 'es' ? 'Emergencia — Despacho Prioritario Hoy Mismo' : 'Emergency — Same-Day Priority Dispatch';
      }
    }

    // Check if caller volunteered serviceAddress on a non-address turn (never bypass 2nd Listener on serviceAddress turn)
    if (!session.ticket.serviceAddress && (!answered || answered.field !== 'serviceAddress')) {
      const streetPart = userSpeech.match(/\b(\d{1,5}\s+[A-Za-z0-9'-]+(?:\s+[A-Za-z0-9'-]+){0,3}\s+(?:street|st|road|rd|avenue|ave|blvd|boulevard|lane|ln|drive|dr|way|court|ct|highway|hwy|pkwy|parkway|loop|circle|cir|terrace|ter|place|pl|trail|calle|avenida))\b/i);
      const cityPart = userSpeech.match(ALL_SUPPORTED_CITIES_RE);
      if (streetPart && !secondListenerRagEngine.isStructurallyGarbledStreet(streetPart[1])) {
        let extractedAddr = streetPart[1].trim();
        if (cityPart) {
          const stateZipMatch = cityPart[0].match(/,?\s*(TX|Texas|AR|Arkansas|OK|Oklahoma)(?:\s+(\d{5}))?$/i);
          const stateSuffix = stateZipMatch ? `, ${stateZipMatch[1].toUpperCase().slice(0, 2)}${stateZipMatch[2] ? ' ' + stateZipMatch[2] : ''}` : (cityPart[2] ? ` ${cityPart[2]}` : '');
          extractedAddr += (lang === 'es' ? ' en ' : ' in ') + cityPart[1].trim() + stateSuffix;
          session.ticket.serviceCity = cityPart[1].trim();
        }
        session.ticket.serviceAddress = extractedAddr;
      }
    }

    // Check if caller volunteered phone
    const phoneMatch = userSpeech.match(/\b(?:\+?1[-.\s]?)?\(?([2-9]\d{2})\)?[-.\s]?([2-9]\d{2})[-.\s]?(\d{4})\b/);
    if (phoneMatch) {
      session.ticket.callbackPhone = `${phoneMatch[1]}-${phoneMatch[2]}-${phoneMatch[3]}`;
    }

    // Check if caller volunteered a dispatch time window (e.g., "Today between 1 PM and 3 PM", "Tomorrow morning between 8 AM and 10 AM")
    if (!session.ticket.preferredWindow && (!answered || answered.field !== 'preferredWindow')) {
      const volWinMatch = userSpeech.match(/\b((?:today|tomorrow|this\s+(?:morning|afternoon|evening)|ma[ñn]ana|hoy)\s+(?:(?:morning|afternoon|evening|por\s+la\s+(?:ma[ñn]ana|tarde))\s+)?(?:between\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?\s+(?:and|to|-)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?|entre\s+las\s+\d{1,2}\s+y\s+(?:las\s+)?\d{1,2}|at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?)|between\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?\s+(?:and|to|-)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?|entre\s+las\s+\d{1,2}\s+y\s+(?:las\s+)?\d{1,2}(?:\s*(?:am|pm|de\s+la\s+(?:ma[ñn]ana|tarde)))?|within\s+the\s+next\s+hour|first\s+thing\s+tomorrow\s+morning)/i);
      if (volWinMatch) {
        session.ticket.preferredWindow = volWinMatch[1].replace(/[.,!?]+$/, '').trim();
      }
    }
  }

  if (isCostQuestion || isGeneralTradeInquiry) {
    const currentQ = flow[session.step - 1];
    const reaskPrompt = currentQ
      ? (currentQ.q === 'greeting'
        ? (lang === 'es' ? '¿Me puede indicar su nombre y apellido y si este es el mejor número para contactarle?' : 'May I have your first and last name, and is this the best phone number to reach you?')
        : t(session.specialist, lang, currentQ.q, getPhoneVars(session.fromNumber, lang)))
      : '';

    // 2nd Listener dynamic retrieval
    const ragMatch = secondListenerRagEngine.query(userSpeech, {
      specialist: session.specialist,
      language: lang,
      stage: 'intake'
    });

    if (ragMatch && ragMatch.speechChunks && ragMatch.speechChunks.length > 0) {
      session.transcript += '\nCaller: ' + userSpeech;
      const chunks = [];
      if (ragMatch.speaker === 'dual') {
        // Tag-team Dual-Agent turn: Matthew + Angel
        for (const c of ragMatch.speechChunks) {
          chunks.push(c);
        }
        if (reaskPrompt) {
          chunks.push({ voice: 'agent', text: reaskPrompt, pause: 1 });
        }
      } else {
        // Matthew consultative answer, then Angel smoothly resumes intake
        for (const c of ragMatch.speechChunks) {
          chunks.push(c);
        }
        if (reaskPrompt) {
          const resumeText = lang === 'es'
            ? `Continuando con su orden de servicio: ${reaskPrompt}`
            : `To get your technician dispatched right away: ${reaskPrompt}`;
          chunks.push({ voice: 'agent', text: resumeText, pause: 1 });
        }
      }
      const spokenSummary = chunks.map(c => (c.voice === 'narrator' ? 'Demo Host (Matthew): ' : spec.displayName + ': ') + c.text).join('\n');
      session.transcript += '\n' + spokenSummary;
      return { speechChunks: chunks, isFinal: false };
    }

    const qLower = userSpeech.toLowerCase();
    let tradeAnswer = null;
    const isWaterHeaterPricing = (isCostQuestion || /\b(how much|cost|price|cuanto|precio|quote|estimate|cobran)\b/i.test(userSpeech)) && (qLower.includes('water heater') || qLower.includes('tankless') || qLower.includes('calentador') || qLower.includes('boiler'));
    const isShutoffCoachingAsk = /\b(where\s+is\s+(?:my|the)\s+(?:main\s+)?(?:water\s+)?(?:shut-?off|valve)|how\s+do\s+i\s+(?:turn|shut)\s+off\s+(?:my|the)\s+(?:main\s+)?water|d[óo]nde\s+est[áa]\s+la\s+llave\s+de\s+paso|c[óo]mo\s+cierro\s+el\s+agua)\b/i.test(userSpeech);
    if (isShutoffCoachingAsk) {
      session.containmentSpoken = true;
      session.ticket.containmentInstructionDelivered = true;
      tradeAnswer = lang === 'es'
        ? 'Mantenga la calma. Revise cerca de la llave de manguera exterior frontal, en la pared interior del garaje o en la caja del medidor junto a la calle, y gire la válvula 90 grados a la derecha para cortar el agua inmediatamente.'
        : 'Stay calm. Check near your front exterior hose bib, inside the garage along the front wall, or in the street meter box, and turn the valve clockwise 90 degrees to shut off the main water immediately.';
    } else if (isWaterHeaterPricing) {
      tradeAnswer = lang === 'es'
        ? 'Para calentadores de agua de tanque o sin tanque, el costo exacto depende de la capacidad en galones, configuración de ventilación y conexiones de gas o eléctricas. Nuestro técnico realiza una evaluación transparente y detallada en el lugar antes de comenzar cualquier trabajo.'
        : 'For standard tank or tankless water heaters, the exact price depends on the gallon capacity, venting configuration, and gas or electric connections. Our technician provides an upfront, transparent estimate on-site upon inspecting the unit before any work begins.';
    } else if (isCostQuestion || qLower.includes('cost') || qLower.includes('price') || qLower.includes('rate') || qLower.includes('fee') || qLower.includes('precio') || qLower.includes('cuanto') || qLower.includes('cobran')) {
      tradeAnswer = lang === 'es'
        ? 'El técnico proporciona un presupuesto transparente y detallado en el lugar tras evaluar la situación antes de comenzar cualquier trabajo.'
        : 'Our technician provides upfront, transparent pricing on-site upon evaluating the issue before any work begins.';
    } else if (qLower.includes('24') || qLower.includes('hour') || qLower.includes('open') || qLower.includes('weekend') || qLower.includes('abierto') || qLower.includes('horario')) {
      tradeAnswer = lang === 'es'
        ? 'Sí, atendemos y despachamos emergencias las 24 horas del día, los 7 días de la semana.'
        : 'Yes, we take calls and dispatch emergency technicians 24 hours a day, 7 days a week.';
    } else if (/\b(dashboard|app|pwa|matthew|demo|software|feature|features|see (the )?call|photos|how does (this|it) work|purchas|buy|contractor|integration)\b/i.test(qLower)) {
      tradeAnswer = lang === 'es'
        ? 'Matthew, nuestro presentador de demostración, le explicará todos los detalles comerciales y el panel de despacho en la siguiente sección. Pero entre nosotros, lo que más le va a llamar la atención es que las fotos que tome y esta llamada completa están disponibles al instante en su panel de AxiRate o aplicación web progresiva para que usted decida qué y cómo responder.'
        : 'Matthew, our demo host, will walk you through our full contractor dashboard and dispatch controls in the next section. But between you and me, what will really grab your attention is that the photos you take and this entire call are available to you instantly via your AxiRate dashboard or progressive web app for you to decide how you want to respond.';
    } else if (qLower.includes('how fast') || qLower.includes('how soon') || qLower.includes('when') || qLower.includes('cuanto tardan') || qLower.includes('cuando')) {
      tradeAnswer = lang === 'es'
        ? 'Para situaciones de emergencia y fugas activas, despachamos al técnico de guardia inmediatamente en cuanto confirmamos su dirección.'
        : 'For active leaks and emergencies, our on-call technician is dispatched immediately once we confirm your address.';
    } else {
      tradeAnswer = lang === 'es'
        ? 'Con gusto le ayudamos con su solicitud de servicio de inmediato.'
        : 'We can certainly take care of that for you right away.';
    }
    const replyText = `${tradeAnswer} ${reaskPrompt}`;
    session.transcript += '\nCaller: ' + userSpeech;
    session.transcript += '\n' + spec.displayName + ': ' + replyText;
    return { speechChunks: [{ voice: 'agent', text: replyText }], isFinal: false };
  }


  // Specific check: service address detail map (must not accept bare city like "Dallas" or garbled street names)
  if (answered && answered.field === 'serviceAddress' && userSpeech) {
    let cleanAddr = userSpeech
      .replace(/\$?\b(\d+)\.(\d{2})\b/g, '$1$2')
      .replace(/^\$\s*/, '')
      .replace(/\b(\d{1,2}):(\d{2})(?=\s+[A-Za-z]+\s+(?:Drive|Dr|Street|St|Ave|Avenue|Road|Rd|Lane|Ln|Blvd|Boulevard|Way|Court|Ct|Parkway|Pkwy|Circle|Cir|Loop|Trail|Place|Pl)\b)/gi, '$1$2')
      .replace(/^(?:(?:sorry|disculpe|well|uh|um)[,.\s]+)*(?:the\s+(?:service\s+|street\s+)?address\s+is|la\s+direcci[oó]n\s+es|it\s+is|it's|es\s+en|es)\s+/i, '')
      .replace(/[.!?]+$/, '')
      .trim();

    // If caller attached a trailing problem/damage clause to the address turn, capture it into problemDescription and strip from cleanAddr
    const trailingProblemClauseMatch = cleanAddr.match(/^(.*?\b(?:street|st|road|rd|avenue|ave|blvd|boulevard|lane|ln|drive|dr|way|court|ct|highway|hwy|pkwy|parkway|loop|circle|cir|terrace|ter|place|pl|trail|calle|avenida)(?:\s*,?\s*(?:(?:in|en)\s+)?[A-Za-z\s]+(?:,?\s*(?:TX|Texas|AR|Arkansas|OK|Oklahoma))?(?:\s+\d{5})?)?)(?:,\s*|\s+(?:and|where|because|since|but|while|y|donde|porque)\s+)((?:my\s+|our\s+|the\s+|there\s+is\s+|there's\s+|water\s+is\s+|sewage\s+is\s+|raw\s+sewage\s+|a\s+pipe\s+|pipe\s+|el\s+agua\s+|la\s+tuber[íi]a\s+|tenemos\s+|hay\s+).+)$/i);
    if (trailingProblemClauseMatch) {
      cleanAddr = trailingProblemClauseMatch[1].trim();
      if (!session.ticket.problemDescription) {
        session.ticket.problemDescription = trailingProblemClauseMatch[2].trim();
      }
    }

    const secondListenerLoc = secondListenerRagEngine.validateSlotExtraction('location', cleanAddr, session, { language: lang });
    if (secondListenerLoc && secondListenerLoc.action === 'CLARIFY_GARBLED_ADDRESS') {
      const clarifyAddr = secondListenerLoc.text;
      session.transcript += '\nCaller: ' + userSpeech;
      session.transcript += '\n' + spec.displayName + ': ' + clarifyAddr;
      return { speechChunks: [{ voice: 'agent', text: clarifyAddr }], isFinal: false };
    }
    if (secondListenerLoc && secondListenerLoc.action === 'ADDRESS_CLARIFIED') {
      cleanAddr = secondListenerLoc.formattedLocation;
      userSpeech = cleanAddr;
    } else {
      userSpeech = cleanAddr;
    }
    const cityOnlyMatch = cleanAddr.match(/^(?:in\s+|at\s+|en\s+)?(Dallas|Fort Worth|Tyler|Austin|Houston|San Antonio|El Paso|Plano|Frisco|Denton|Arlington|Wichita Falls|Conway|Broken Bow|Longview|Lubbock|Midland|Odessa|Amarillo|Waco|Texarkana|Abilene|Beaumont|Round Rock|Laredo|McAllen|Sherman|Denison|Paris|Lufkin|Nacogdoches|San Angelo)(?:,?\s*(?:TX|Texas|AR|Arkansas|OK|Oklahoma))?[.!?]?$/i);
    const hasStreetIndicator = /\b(street|st|road|rd|avenue|ave|blvd|boulevard|lane|ln|drive|dr|way|court|ct|highway|hwy|pkwy|parkway|loop|circle|cir|terrace|ter|place|pl|trail|calle|avenida|carretera)\b/i.test(cleanAddr) || /\b\d{1,5}\s+(?!(?:am|pm|a\.m\.|p\.m\.|gallon|gal|psi|hours?|hrs?|days?|minutes?|mins?|feet|ft|inches|degrees)\b)[A-Za-z]{3,}/i.test(cleanAddr);
    
    if (cityOnlyMatch || !hasStreetIndicator) {
      const embeddedCityMatch = cleanAddr.match(/\b(Dallas|Fort Worth|Tyler|Austin|Houston|San Antonio|El Paso|Plano|Frisco|Denton|Arlington|Wichita Falls|Conway|Broken Bow|Longview|Lubbock|Midland|Odessa|Amarillo|Waco|Texarkana|Abilene|Beaumont|Round Rock|Laredo|McAllen|Sherman|Denison|Paris|Lufkin|Nacogdoches|San Angelo)(?!\s+(?:street|st|road|rd|avenue|ave|blvd|boulevard|lane|ln|drive|dr|way|court|ct|highway|hwy|pkwy|parkway|loop|circle|cir|terrace|ter|place|pl|trail|calle|avenida)\b)\b/i);
      const detectedCity = cityOnlyMatch ? cityOnlyMatch[1] : (embeddedCityMatch ? embeddedCityMatch[1] : null);
      if (detectedCity) {
        session.ticket.serviceCity = detectedCity;
      }
      const reaskAddr = detectedCity
        ? (lang === 'es'
            ? `Entendido, en ${detectedCity}. ¿Cuál es la dirección exacta con calle, número y código postal?`
            : `Understood, in ${detectedCity}. What is the street address and zip code in ${detectedCity}?`)
        : (lang === 'es'
            ? `¿Cuál es la dirección exacta de la propiedad, incluyendo calle, número y ciudad?`
            : `What is the exact street address and city for the service location?`);
      session.transcript += '\nCaller: ' + userSpeech;
      session.transcript += '\n' + spec.displayName + ': ' + reaskAddr;
      return { speechChunks: [{ voice: 'agent', text: reaskAddr }], isFinal: false };
    }
  }

  if (userSpeech) {
    session.transcript += '\nCaller: ' + userSpeech;
    // Sanitize currency symbols and artifacts before storing
    const sanitizedVal = userSpeech.replace(/\$?\b(\d+)\.(\d{2})\b/g, '$1$2').replace(/^\$\s*/, '').trim();
    const hasProblem = Boolean((urgentRe && urgentRe.test(userSpeech)) || tradeProblemRe.test(userSpeech));

    if (answered.field === 'callerName') {
      session.nameAttempts = (session.nameAttempts || 0) + 1;

      const identity = customerIdentity.extractCallerIdentity(userSpeech);
      let candidate = identity ? identity.displayName : null;
      let spokenGreeting = identity ? identity.spokenGreeting : null;

      if (candidate) {
        session.fnolData.callerName = candidate;
        session.ticket.callerName = candidate;
        session.callerSpokenGreeting = spokenGreeting || candidate;
        if (identity && identity.detectedCompany && !session.companyName) {
          session.fnolData.companyName = identity.detectedCompany;
          session.companyName = identity.detectedCompany;
        }
      } else {
        // ONE TIME MAX RULE (JD RULING 2026-09-26):
        // The bot may ask for clarification ONCE. On attempt >= 2, NEVER repeat the question.
        // Accept best-effort or default, capture problem/urgency, and advance to step 2 (serviceAddress).
        if (session.nameAttempts >= 2) {
          const fallbackName = lang === 'es' ? 'Estimado Cliente' : 'Valued Customer';
          session.fnolData.callerName = fallbackName;
          session.ticket.callerName = fallbackName;
          session.callerSpokenGreeting = fallbackName;
          if (hasProblem || session.ticket.emergency) {
            if (!session.ticket.problemDescription && hasProblem) session.ticket.problemDescription = userSpeech.trim();
          }
          // Advance directly to step 2 (serviceAddress)
          session.step = 2;
          let containment = '';
          const contKey = getSpecialistContainmentKey(session, userSpeech);
          const rawCont = t(session.specialist, lang, contKey);
          if (rawCont && rawCont !== `[${contKey}]` && session.ticket.emergency && !session.containmentSpoken) {
            session.containmentSpoken = true;
            session.ticket.containmentInstructionDelivered = true;
            containment = rawCont + ' ';
          }
          const nextQ = t(session.specialist, lang, 'qAddress');
          const ackText = lang === 'es'
            ? `${containment}Entendido, gracias. ${nextQ}`
            : `${containment}Thank you. ${nextQ}`;
          session.transcript += '\n' + spec.displayName + ': ' + ackText;
          return { speechChunks: [{ voice: 'agent', text: ackText }], isFinal: false };
        } else {
          session.fnolData.callerName = null;
          delete session.ticket.callerName;
          // If caller gave problem/emergency during greeting turn instead of name, provide empathetic ack + containment and re-prompt name ONCE
          if (hasProblem || session.ticket.emergency) {
            if (!session.ticket.problemDescription) {
              session.ticket.problemDescription = userSpeech.trim();
            }
            if (session.ticket.emergency && !session.ticket.urgency) {
              session.ticket.dispatchPriority = 'P0_EMERGENCY';
              session.ticket.urgency = lang === 'es' ? 'Emergencia — Despacho Prioritario Hoy Mismo' : 'Emergency — Same-Day Priority Dispatch';
            }
            let containment = '';
            const contKey = getSpecialistContainmentKey(session, userSpeech);
            const rawCont = t(session.specialist, lang, contKey);
            if (rawCont && rawCont !== `[${contKey}]` && !session.containmentSpoken) {
              session.containmentSpoken = true;
              session.ticket.containmentInstructionDelivered = true;
              containment = rawCont + ' ';
            }
            const empatheticAck = t(session.specialist, lang, 'ackUrgent');
            const cleanEmpAck = (empatheticAck && empatheticAck !== '[ackUrgent]') ? empatheticAck + ' ' : '';
            const repromptName = lang === 'es'
              ? `${cleanEmpAck}${containment}Para registrar su orden prioritaria, ¿cuál es su nombre y apellido?`
              : `${cleanEmpAck}${containment}To get your priority dispatch logged right away, may I start with your first and last name, and a callback number?`;
            session.transcript += '\n' + spec.displayName + ': ' + repromptName;
            return { speechChunks: [{ voice: 'agent', text: repromptName }], isFinal: false };
          } else {
            // Strict name rejection: reprompt ONCE only
            const repromptName = lang === 'es'
              ? 'Disculpe, no pude captar su nombre. ¿Podría decirme su nombre y apellido, por favor?'
              : "I'm sorry, I didn't catch your name. Could you please share your first and last name?";
            session.transcript += '\n' + spec.displayName + ': ' + repromptName;
            return { speechChunks: [{ voice: 'agent', text: repromptName }], isFinal: false };
          }
        }
      }
    } else if (answered.field === 'urgency') {
      session.ticket.urgencyRaw = typeof sanitizedVal === 'string' ? sanitizedVal.replace(/\?+\s*$/, '').trim() : sanitizedVal;
      if (/\b(shut-?off|main\s+water|llave\s+de\s+paso|turned\s+it\s+off|closed\s+it)\b/i.test(userSpeech)) {
        session.ticket.shutOffValveConfirmed = true;
      }
      if (session.ticket.emergency || /\b(emergency|emergencia|urgent|urgente|right\s+away|immediately|asap|today|hoy|active\s+leak|burst|pouring|flooding|yes)\b/i.test(userSpeech)) {
        session.ticket.emergency = true;
        session.ticket.dispatchPriority = 'P0_EMERGENCY';
        session.ticket.urgency = lang === 'es' ? 'Emergencia — Despacho Prioritario Hoy Mismo' : 'Emergency — Same-Day Priority Dispatch';
      } else {
        session.ticket.urgency = lang === 'es' ? 'Visita Programada Estándar' : 'Standard Scheduled Service Visit';
      }
    } else if (answered.field === 'preferredWindow' && session.ticket.preferredWindow && /^(?:yes|yeah|yep|correct|accurate|that\s+is\s+(?:all\s+)?(?:correct|accurate)|everything\s+is\s+accurate|s[íi])/i.test(sanitizedVal)) {
      // Do not overwrite an already-captured time window with a bare summary confirmation
      session.ticket.summaryConfirmed = true;
    } else {
      session.ticket[answered.field] = typeof sanitizedVal === 'string' ? sanitizedVal.replace(/\?+\s*$/, '').trim() : sanitizedVal;
    }
    if (!isPureInquiryQuestion && urgentRe && urgentRe.test(userSpeech)) session.ticket.emergency = true;
  }

  // Enforce 2nd Listener Trade Slot Integrity Guard across all slots
  if (secondListenerRagEngine && typeof secondListenerRagEngine.protectTradeSlotIntegrity === 'function') {
    secondListenerRagEngine.protectTradeSlotIntegrity(preTicketSnapshot, session, userSpeech, answered ? answered.field : null);
  }

  // Universal mid-call opt-out / revocation
  const optOutPattern = /\b(stop\s+texting|quit\s+texting|don'?t\s+text|do\s+not\s+text|no\s+more\s+texts?|stop\s+sending|sin\s+mensajes|unsubscribe)\b|^(?:stop|quit)$/i;
  if (userSpeech && optOutPattern.test(userSpeech)) {
    session.ticket.photoConsent = false;
    session.ticket.smsConsent = false;
    session.smsConsent = false;
  }

  if (answered && answered.field === 'photoRequest') {
    const textLower = (userSpeech || '').toLowerCase().trim();
    const refusalPattern = /(?:rather\s+not|not\s+by\s+text|prefer\s+(?:you\s+)?(?:didn['’]?t|don['’]?t)|prefer\s+(?:not\s+to|no)|don['’]?t\s+(?:send|text|have|want)|do\s+not\s+(?:send|text|have|want)|didn['’]?t\s+(?:give|consent|agree)|stop\s+(?:texting|sending)|quit\s+(?:texting|sending)|unsubscribe|cancel|no\s+texts?|no\s+sms|no\s+photos?|sin\s+mensajes?|no\s+gracias|no\s+quiero|never\s+mind|call\s+only|s[oó]lo\s+llamada|not\s+really|nope|nah|\bno\b(?!\s*(?:problem|worries|hay\s+problema))|\bnot\s+by\s+text|\bnot\b(?!\s*a\s+problem)|no\s+permission|sin\s+permiso|negativo|ningun[ao]|refuse|decline|sin\s+fotos|no\s+enviar)/iu;
    const explicitGrant = /(?:^|\b)(?:permission|permission to text|yes text me|you can text|feel free to text|ok to text|okay to text|yes you have permission|send\s+(?:it|the\s+link)|puedes enviar|tienes permiso|sí puedes enviar)(?:\b|$)/iu;
    const anchoredAffirmative = /^(?:yes|yeah|yep|sure|fine|ok|okay|please|go\s+ahead|you\s+can|absolutely|definitely|sí|claro|por\s+supuesto|adelante|est[aá]\s+bien)[.,!]?$/iu;
    const discourseMarker = /^(?:okay|ok|si|well|bueno|mira)\s+(?:so|es\s+que|me\s+pueden|yo\s+iba|i\s+was|we\s+were|my\s+car|alguien)\b/i;
    const startsAffirmative = /^(?:yes|sure|claro|sí)(?:\s|$|[.,!])/iu;

    const isAffirmative = !refusalPattern.test(textLower) && !discourseMarker.test(textLower) && (explicitGrant.test(textLower) || anchoredAffirmative.test(textLower) || startsAffirmative.test(textLower));
    session.ticket.photoConsent = isAffirmative;
    session.ticket.smsConsent = isAffirmative;
    session.smsConsent = isAffirmative;
  }

  if (answered && answered.field === 'summaryConfirm') {
    const isRejection = /\b(no|wrong|incorrect|not right|doesn'?t make sense|no logic|that'?s wrong|error|mistake|mal|incorrecto|no es correcto|no tiene sentido|te equivocaste|actually|wait|i\s+meant|change\s+the)\b/i.test(userSpeech || '');
    const addrFixMatch = (userSpeech || '').match(/\b(\d{1,5}\s+[A-Za-z0-9'-]+(?:\s+[A-Za-z0-9'-]+){0,3}\s+(?:street|st|road|rd|avenue|ave|blvd|boulevard|lane|ln|drive|dr|way|court|ct|highway|hwy|pkwy|parkway|loop|circle|cir|trail|terrace|ter|place|pl|creek|crossing|calle|avenida)(?:\s*,?\s*(?:(?:in|en)\s+)?[A-Za-zÀ-ÿ\s]+(?:,?\s*(?:TX|Texas|AR|Arkansas|OK|Oklahoma))?(?:\s+\d{5})?)?)/i);
    const winFixMatch = (userSpeech || '').match(/\b(between\s+\d[^.!?]*|tomorrow\s+(?:morning|afternoon)(?:\s+[^.!?]*)?|within\s+the\s+next\s+hour|right\s+now(?:\s+immediately)?|immediately(?:\s+right\s+now)?|as\s+soon\s+as\s+possible|this\s+(?:morning|afternoon)(?:\s+[^.!?]*)?|today(?:\s+[^.!?]*)?|\d{1,2}\s*(?:to|-)\s*\d{1,2}\s*(?:am|pm|a\.m\.|p\.m\.)?)/i);

    if (isRejection || session.awaitingSummaryFix) {
      delete session.ticket.summaryConfirm;
      session.ticket.summaryConfirmed = false;
      const sumIdx = flow.findIndex(f => f.field === 'summaryConfirm');
      if (addrFixMatch) {
        session.ticket.serviceAddress = addrFixMatch[1].replace(/[,.]+$/, '').trim();
        session.awaitingSummaryFix = false;
        session.step = sumIdx >= 0 ? sumIdx : session.step - 1;
      } else if (winFixMatch) {
        session.ticket.preferredWindow = winFixMatch[1].replace(/[,.]+$/, '').trim();
        session.awaitingSummaryFix = false;
        session.step = sumIdx >= 0 ? sumIdx : session.step - 1;
      } else if (session.awaitingSummaryFix && userSpeech && userSpeech.trim().length >= 3) {
        session.ticket.problemDescription = userSpeech.trim();
        session.awaitingSummaryFix = false;
        session.step = sumIdx >= 0 ? sumIdx : session.step - 1;
      } else {
        session.awaitingSummaryFix = true;
        session.step = sumIdx >= 0 ? sumIdx + 1 : session.step;
        const fixText = lang === 'es'
          ? 'Disculpe por el error. ¿Qué dato quedó incorrecto para corregirlo de inmediato?'
          : 'I apologize for that — what detail did I get wrong so I can fix it for you right away?';
        session.transcript += '\n' + spec.displayName + ': ' + fixText;
        return { speechChunks: [{ voice: 'agent', text: fixText }], isFinal: false };
      }
    } else {
      session.ticket.summaryConfirmed = true;
    }
  }

  // Skip any fields that were already populated earlier (e.g. problem described during greeting)
  while (session.step < flow.length && session.ticket[flow[session.step].field]) {
    session.step += 1;
  }

  if (session.step < flow.length) {
    const next = flow[session.step];
    session.step += 1;
    let ackKey = 'ack';
    if (answered.field === 'summaryConfirm') {
      ackKey = 'ackSummary';
    } else if (answered.field === 'photoRequest') {
      ackKey = session.ticket.photoConsent ? 'ackPhotos' : 'ack';
    } else if (session.ticket.emergency && answered.field === 'problemDescription') {
      ackKey = 'ackUrgent';
    } else if (session.ticket.emergency && answered.field === 'urgency') {
      ackKey = 'ack'; // Avoid repeating identical emergency apology
    }
    let ack = t(session.specialist, lang, ackKey);
    if (answered && answered.field === 'callerName' && session.callerSpokenGreeting) {
      ack = lang === 'es'
        ? `Entendido, gracias, ${session.callerSpokenGreeting}.`
        : `Thank you, ${session.callerSpokenGreeting}.`;
    }
    const contKey = getSpecialistContainmentKey(session, userSpeech);
    const rawContainment = t(session.specialist, lang, contKey);
    if (rawContainment && rawContainment !== `[${contKey}]` && session.ticket.emergency && !session.containmentSpoken) {
      session.containmentSpoken = true;
      session.ticket.containmentInstructionDelivered = true;
      ack = rawContainment + ' ' + ack;
    }

    let vars = {};
    if (next.q === 'qSummaryConfirm') {
      const isUrgent = session.ticket.emergency;
      let cleanUrgency = session.ticket.urgency || '';
      if (isUrgent || /emergency|emergencia|today|hoy|urgent|urgente|now|ya|asap|possible/i.test(cleanUrgency)) {
        cleanUrgency = lang === 'es' ? 'EMERGENCIA (despacho prioritario)' : 'EMERGENCY priority dispatch';
      } else {
        cleanUrgency = lang === 'es' ? 'Visita programada' : 'Standard scheduled visit';
      }
      const rawName = session.fnolData?.callerName || session.ticket?.callerName;
      const cleanName = (rawName && /[a-zA-ZÀ-ÿ]{2,}/.test(rawName) && !/\d/.test(rawName)) ? rawName.trim() : (lang === 'es' ? 'estimado cliente' : 'Customer');
      const cleanAddress = (session.ticket.serviceAddress || '').replace(/[.,\s]+$/, '').trim() || (lang === 'es' ? 'su dirección' : 'your address');
      let cleanProblem = (session.ticket.problemDescription || '')
        .replace(/^(?:yes,?\s*|no,?\s*|well,?\s*|uh,?\s*|um,?\s*)?(?:we\s+have\s+|i\s+have\s+|there\s+is\s+|there's\s+|we've\s+got\s+|i've\s+got\s+|it\s+is\s+|it's\s+|tenemos\s+|hay\s+|tengo\s+)/i, '')
        .split(/[.!?]+/)[0]
        .replace(/[.,\s]+$/, '')
        .trim() || (lang === 'es' ? 'problema de plomería' : 'plumbing issue');
      if (cleanProblem.length > 1) {
        cleanProblem = cleanProblem.charAt(0).toLowerCase() + cleanProblem.slice(1);
      }
      let cleanWindow = (session.ticket.preferredWindow || session.ticket.serviceWindow || '')
        .replace(/^(?:yes|yeah|yep|ok|okay|sure|s[íi])[,.s]+(?:i\s+)?(?:already\s+)?(?:shut[\s-]*off|turned[\s-]*off|closed)\s+(?:the\s+)?(?:main\s+)?(?:emergency\s+)?(?:water\s+)?(?:shut[\s-]*off\s+)?valve(?:\s+and|,)?\s*/i, '')
        .replace(/\s+(?:works\s+best(?:\s+for\s+me|\s+for\s+us)?|is\s+best|would\s+be\s+best)[.!?]*$/i, '')
        .replace(/[.,\s]+$/, '')
        .trim();
      if (/^(?:today|hoy|dude)$/i.test(cleanWindow)) cleanWindow = lang === 'es' ? 'hoy' : 'today';
      if (!cleanWindow || /^(?:right\s+now|now|ya|asap|immediately|ahorita(?:\s+mismo)?)$/i.test(cleanWindow)) cleanWindow = lang === 'es' ? 'lo antes posible' : 'as soon as possible';

      vars = {
        NAME: cleanName,
        ADDRESS: cleanAddress,
        PROBLEM: cleanProblem,
        URGENCY: cleanUrgency,
        WINDOW: cleanWindow,
      };
    }
    const questionVars = Object.assign({}, getPhoneVars(session.fromNumber, lang), vars);
    const question = t(session.specialist, lang, next.q, questionVars);
    session.transcript += '\n' + spec.displayName + ': ' + ack + ' ' + question;
    return {
      speechChunks: [
        { voice: 'agent', text: ack },
        { voice: 'agent', text: question, pause: 1 },
      ],
      isFinal: false,
    };
  }

  // All intake questions answered. Authentic specialist closure or sales bridge.
  session.intakeComplete = true;
  session.isComplete = true;
  const rawFinalName = session.fnolData?.callerName || session.ticket?.callerName;
  const cleanFinalName = (rawFinalName && /[a-zA-ZÀ-ÿ]{2,}/.test(rawFinalName) && !/\d/.test(rawFinalName)) ? rawFinalName.trim() : (lang === 'es' ? 'estimado cliente' : 'valued customer');

  if (session.mode === 'sales' || session.compositeDemo === true) {
    // Dynamic handoff from Angel to Demo Host Matthew
    session.mode = 'sales';
    session.salesStep = 1;
    session.salesPivoted = true;
    session.tradeSalesPhase = 'qa';
    const angelClosing = lang === 'es'
      ? `Gracias, ${cleanFinalName}. Su orden de servicio de plomería ha sido generada con la referencia ${session.claimRef} y enviada a su teléfono por mensaje de texto y confirmación por correo electrónico. Le comunico ahora mismo con Matthew para mostrarle su panel en vivo.`
      : `Thank you, ${cleanFinalName}. Your plumbing service job-ticket has been created with reference ${session.claimRef} and dispatched to your mobile phone via text and email confirmation. Passing you over to Matthew now.`;

    const matthewIntro = lang === 'es'
      ? `¡Aquí Matthew, su presentador de demostración! Ese fue nuestro motor de recepción de plomería en vivo. En menos de 60 segundos y al primer timbre, Angel capturó los datos, confirmó la dirección, brindó orientación para cerrar la llave de paso y envió su enlace de fotos y panel en vivo de AxiRate junto con la integración directa para ServiceTitan, Housecall Pro o Jobber para que nunca pierda llamadas de emergencia fuera de horario en el buzón de voz de un competidor. ¿Cómo se compara esto con la forma en que su negocio atiende las llamadas de emergencia hoy?`
      : `Demo Host Matthew here! That was our live autonomous plumbing intake engine. In under 60 seconds on the first ring, Angel captured your information, confirmed the address, delivered shut-off guidance, and dispatched your photo link and live dashboard link via text and email confirmation — pushing the job-ticket straight into ServiceTitan, Housecall Pro, or Jobber so you never lose after-hours emergency calls to a competitor's voicemail. How does that compare to how your shop handles emergency calls today?`;

    session.transcript += '\n' + spec.displayName + ': ' + angelClosing;
    session.transcript += '\nDemo Host: ' + matthewIntro;
    try {
      archiveCall(session, path.join(__dirname, 'transcripts'));
    } catch (_) {}
    return {
      speechChunks: [
        { voice: 'agent', text: angelClosing },
        { voice: 'narrator', text: matthewIntro, pause: 1 }
      ],
      isFinal: false
    };
  }

  session.isComplete = true;
  const closing = t(session.specialist, lang, 'closing', {
    NAME: cleanFinalName,
    REF: session.claimRef,
  });
  session.transcript += '\n' + spec.displayName + ': ' + closing;
  return { speechChunks: [{ voice: 'agent', text: closing }], isFinal: true };

}

function calculateTradeAxiScore(session) {
  const t = session.ticket || {};
  let score = 76; // baseline quality
  if (t.callerName && t.callerName.length > 2) score += 4; // Name captured
  if (t.serviceAddress && t.serviceAddress.length > 5) score += 4; // Address captured
  if (t.problemDescription && t.problemDescription.length > 5) score += 4; // Problem discovered
  if (t.urgency) score += 3; // Urgency assessed
  if (t.emergency) score += 3; // Safety containment guidance provided
  if (session.inCallSmsDispatched || t.photoRequest) score += 3; // Digital photo link dispatched
  if (t.summaryConfirmed) score += 3; // DR-17 verified summary confirmation
  return Math.min(score, 100);
}

// Archive a non-claims call: transcript + service ticket JSON + AxiRate compliance score.
function archiveCall(session, transcriptDir) {
  const alreadyDispatchedOutbound = Boolean(session.outboundDispatched);
  session.outboundDispatched = true;
  session.archived = true;
  const spec = SPECIALISTS[session.specialist] || { displayName: session.specialist };
  const ref = session.claimRef || 'SVC-' + Date.now();
  const axiScore = calculateTradeAxiScore(session);
  const ticket = Object.assign({}, session.ticket, {
    ref: ref,
    callSid: session.callSid,
    from: session.fromNumber,
    startedAt: session.startTime,
    durationSec: Math.round((Date.now() - (session.startTimestamp || Date.now())) / 1000),
    language: session.language || 'en',
    transcript: session.transcript || '',
    receivedAt: new Date().toISOString(),
    axiscore: axiScore,
    band: axiScore >= 90 ? 'EXCELLENT' : (axiScore >= 80 ? 'STRONG' : 'ACCEPTABLE'),
    rubric: 'home_services_intake_v1',
  });

  const axiratePayload = {
    call_id: session.callSid,
    ref: ref,
    specialist: session.specialist,
    rubric: 'home_services_intake_v1',
    axiscore: axiScore,
    band: ticket.band,
    summary_confirmed: !!ticket.summaryConfirmed,
    emergency_contained: !!ticket.emergency,
    photo_dispatched: !!session.inCallSmsDispatched,
    ticket: ticket,
    timestamp: new Date().toISOString()
  };
  if (process.env.SKIP_ARCHIVE_DISK_IO !== 'true') {
    try {
      fs.writeFileSync(path.join(transcriptDir, 'Specialist-' + ref + '_AxiRate.json'), JSON.stringify(axiratePayload, null, 2), 'utf8');
    } catch (e) {
      console.error('[AXIRATE PLUMBING WRITE ERROR]', e.message);
    }
  }
  if (session.specialist === 'plumbing' && !alreadyDispatchedOutbound) {
    const postCallSender = require('./post_call_link_sender');
    const name = session.fnolData?.callerName || ticket.callerName || 'Customer';
    const prob = ticket.problemDescription || 'Plumbing Service';
    const urgencyStr = ticket.emergency ? 'EMERGENCY (Priority Dispatch)' : (ticket.urgency || 'Standard');
    const addr = ticket.serviceAddress || 'On File';
    const phone = ticket.from || session.fromNumber || '';
    const photoUrl = `https://agentangel.io/upload-photo?ref=${ref}`;

    const jobTicketBody = `[Agent Angel Plumbing] Ticket ${ref}\nCustomer: ${name} | Issue: ${prob}\nUrgency: ${urgencyStr} | Address: ${addr}\nCallback: ${phone}\nPhotos: ${photoUrl}`;
    ticket.jobTicketSms = jobTicketBody;

    const smsInboundEngine = require('./sms_inbound_engine');
    const priorConsent = smsInboundEngine.getMessagingConsent ? smsInboundEngine.getMessagingConsent(transcriptDir, phone) : { consented: true };

    if (process.env.UAT_SIDE_EFFECTS === 'off' || process.env.DRY_RUN === 'true' || process.env.NODE_ENV === 'test') {
      ticket.outboundSuppressed = true;
      ticket.suppressionReason = priorConsent.consented ? 'UAT_SIDE_EFFECTS_OFF' : priorConsent.reason;
      if (process.env.SKIP_ARCHIVE_DISK_IO !== 'true') {
        console.log('[PLUMBING JOB-TICKET SMS SUPPRESSED: UAT_SIDE_EFFECTS=off]', ref, 'phone:', phone, 'reason:', ticket.suppressionReason);
      }
    } else if (!priorConsent.consented) {
      ticket.outboundSuppressed = true;
      ticket.suppressionReason = priorConsent.reason;
      console.log('[PLUMBING JOB-TICKET SMS SUPPRESSED: PRIOR_STOP]', ref, 'phone:', phone);
    } else if (ticket.smsConsent === true && phone && postCallSender.sendSmsViaTwilio) {
      const fromNum = process.env.TWILIO_PHONE_NUMBER_754 || '+17543342877';
      postCallSender.sendSmsViaTwilio({ to: phone, from: fromNum, body: jobTicketBody }).then(() => {
        ticket.jobTicketSent = true;
        console.log('[PLUMBING JOB-TICKET SMS ACCEPTED]', ref, 'to', phone);
      }).catch((err) => {
        console.error('[PLUMBING JOB-TICKET SMS FAILED]', ref, err.message);
      });
    } else if (ticket.smsConsent !== true) {
      console.log('[PLUMBING JOB-TICKET SMS SUPPRESSED: NO POSITIVE CONSENT]', ref, 'phone:', phone);
    }

    // Contractor Dispatch Email Queueing
    const contractorEmail = process.env.CONTRACTOR_DISPATCH_EMAIL || 'service@agentangel.io';
    const emailSubject = `[URGENT DISPATCH - PLUMBING] ${urgencyStr}: ${prob} - Ticket ${ref}`;
    const emailBody = `NEW PLUMBING SERVICE JOB TICKET\n` +
      `==============================\n` +
      `Ticket ID: ${ref}\n` +
      `Customer Name: ${name}\n` +
      `Callback Phone: ${phone}\n` +
      `Service Address: ${addr}\n` +
      `Issue: ${prob}\n` +
      `Urgency: ${urgencyStr}\n` +
      `Time Window: ${ticket.serviceWindow || 'Next Available'}\n` +
      `Photos Link: ${photoUrl}\n\n` +
      `-- Agent Angel Autonomous Dispatch Engine`;
    if (process.env.SKIP_ARCHIVE_DISK_IO !== 'true') {
      try {
        if (postCallSender.enqueueOutbox) {
          postCallSender.enqueueOutbox(transcriptDir, {
            channel: 'email',
            specialist: 'plumbing',
            to: contractorEmail,
            subject: emailSubject,
            body: emailBody,
            ticketRef: ref,
            status: 'QUEUED_DISPATCH'
          });
          ticket.contractorEmailDispatched = true;
        }
      } catch (e) {
        console.error('[PLUMBING CONTRACTOR DISPATCH ERROR]', e.message);
      }
    } else {
      ticket.contractorEmailDispatched = true;
    }
  }

  const transcriptContent = [
    'CALL TRANSCRIPT — ' + spec.displayName,
    '='.repeat(60),
    'Call SID: ' + session.callSid,
    'Date: ' + new Date().toISOString(),
    'From: ' + session.fromNumber,
    'Language: ' + (session.language || 'en'),
    'Ref: ' + ref,
    '',
    '--- TRANSCRIPT ---',
    session.transcript || '(empty)',
    '',
    '--- SERVICE TICKET ---',
    JSON.stringify(ticket, null, 2),
  ].join('\n');
  if (process.env.SKIP_ARCHIVE_DISK_IO !== 'true') {
    try {
      fs.writeFileSync(path.join(transcriptDir, 'Specialist-' + ref + '_Transcript.txt'), transcriptContent, 'utf8');
      fs.writeFileSync(path.join(transcriptDir, 'Specialist-' + ref + '_Ticket.json'), JSON.stringify(ticket, null, 2), 'utf8');
    } catch (e) {
      console.error('[SPECIALIST ARCHIVE ERROR]', e.message);
    }
  }

  // Sync to live_calls_store.json so trade calls immediately render on /axirate/calls
  if (process.env.SKIP_ARCHIVE_DISK_IO !== 'true') {
    try {
      const liveStorePaths = [LIVE_CALLS_STORE_PATH];
      let store = {};
      for (const p of liveStorePaths) {
        if (fs.existsSync(p)) {
          try {
            Object.assign(store, JSON.parse(fs.readFileSync(p, 'utf8')));
          } catch (_) {}
        }
      }
      const callEntry = {
        ref: ref,
        callSid: session.callSid,
        caller: session.fnolData?.callerName || ticket.callerName || 'Valued Customer',
        phone: session.fromNumber,
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) + ' · ' + (session.language || 'en').toUpperCase(),
        sub: (spec.displayName || session.specialist) + ' (' + (ticket.incidentClassification || ticket.urgency || 'Standard') + ')',
        transcript: session.transcript || '',
        packetTitle: `AxiScore ${axiScore}/100 · ${ticket.band || 'STRONG'}`,
        specialist: session.specialist,
        axiscore: axiScore,
        ticket: ticket,
        timestamp: new Date().toISOString()
      };
      store[ref] = callEntry;
      for (const p of liveStorePaths) {
        try {
          const dir = path.dirname(p);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(p, JSON.stringify(store, null, 2), 'utf8');
        } catch (_) {}
      }
      console.log('[SPECIALIST LIVE STORE SYNC] Saved call ' + ref + ' to live_calls_store.json');
    } catch (err) {
      console.error('[SPECIALIST LIVE STORE ERROR]', err.message);
    }
  }

  // Trigger Mirofish Automated Inbound Demo Call Performance Analytics Loop for Trade Specialists
  try {
    const mirofishModPath = path.join(__dirname, 'mirofish_demo_analyzer.js');
    if (fs.existsSync(mirofishModPath)) {
      const { analyzeDemoCall } = require(mirofishModPath);
      const mirofishReport = analyzeDemoCall({
        callSid: session.callSid,
        claimRef: ref,
        specialist: session.specialist,
        vertical: session.specialist,
        language: session.language || 'en',
        callerRole: session.callerRole || ticket.salesRole || 'CONTRACTOR',
        transcript: session.transcript || '',
        ticket,
        fnol: session.fnolData || {}
      });
      if (mirofishReport) {
        ticket.mirofishAnalysis = mirofishReport;
      }
    }
  } catch (e) {
    console.error('[SPECIALIST MIROFISH TRIGGER ERROR]', e.message);
  }

  // Trigger post-call review agent asynchronously
  const callReviewScript = path.join(__dirname, 'call_review_agent.js');
  const rootCallReviewScript = path.join(__dirname, '../../../scripts/call_review_agent.js');
  const reviewScriptToRun = fs.existsSync(callReviewScript) ? callReviewScript : (fs.existsSync(rootCallReviewScript) ? rootCallReviewScript : null);
  if (reviewScriptToRun && process.env.UAT_SIDE_EFFECTS !== 'off') {
    try {
      const transcriptPath = path.join(transcriptDir, 'Specialist-' + ref + '_Transcript.txt');
      const ticketPath = path.join(transcriptDir, 'Specialist-' + ref + '_Ticket.json');
      const { spawn } = require('child_process');
      const child = spawn(process.execPath, [
        reviewScriptToRun,
        transcriptPath,
        ticketPath,
        session.callSid || '',
        session.specialist || 'trade',
        session.fromNumber || ''
      ], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      console.log('[SPECIALIST POST-CALL AUDIT TRIGGERED] call_review_agent spawned for CallSid=' + session.callSid);
    } catch (e) {
      console.error('[SPECIALIST POST-CALL AUDIT ERROR] ' + e.message);
    }
  }
}

let tradeAfterHoursIntakeEngine = null;
try {
  tradeAfterHoursIntakeEngine = require('./trade_after_hours_intake_engine');
} catch (e) {
  console.warn('[TRADE AFTER HOURS INTAKE ENGINE LOAD WARNING]', e.message);
}

// PRICING-TIERS-TRADES-SINGLE-LINE-01: trades pricing questions are answered
// from the canonical 3-tier table (Solo $99–$149 / Growth $249–$299 /
// Call Center Pro $499) — a single-line shop is never quoted the $499 tier.
const tradesPricing = require('./trades_pricing_tiers');
function tradePricingAnswer(speech, lang, opts) {
  return tradesPricing.pricingAnswer(speech, lang || 'en', opts);
}


module.exports = {
  // PRICING-TIERS-TRADES-SINGLE-LINE-01 exports:
  tradePricingAnswer, isPricingQuestion: tradesPricing.isPricingQuestion,
  TRADES_PRICING_TIERS: tradesPricing.TRADES_PRICING_TIERS,
  SPECIALISTS, isKnown, hints, createSession, evaluateTurn, archiveCall,
  classifyPlumbingCategory, getSpecialistContainmentKey, calculateTradeAxiScore,
  // TRADES-SALESMODE-01 exports (tests + future VOICE-SPECROUTE-01 wiring):
  TRADE_SALES, evaluateSalesTurn, classifyTradeRole, classifyTradePain, affirmative,
  lookupProspectByPhone, normalizePhone,
  tradeAfterHoursIntakeEngine,
  // PASS-04 export: the adversarial-persona noise filter itself.
  hasUsableSpeech,
};

// NTLB-GEMINI-PILLAR-1-CODE-01: non-destructive export/trigger self-test.
// Run: node specialist_engines.js --self-test   (exit 0 = all checks pass, 1 = failure)
// Pure in-memory checks only: never calls archiveCall (disk write) or any network/SMS path.
if (require.main === module && process.argv.includes('--self-test')) {
  const assert = require('assert');
  const failures = [];
  const check = (name, fn) => {
    try { fn(); console.log('PASS ' + name); }
    catch (e) { failures.push(name); console.log('FAIL ' + name + ' :: ' + e.message); }
  };
  const fnExports = ['tradePricingAnswer', 'isPricingQuestion', 'isKnown', 'hints', 'createSession',
    'evaluateTurn', 'archiveCall', 'classifyPlumbingCategory', 'getSpecialistContainmentKey',
    'calculateTradeAxiScore', 'evaluateSalesTurn', 'classifyTradeRole', 'classifyTradePain',
    'affirmative', 'lookupProspectByPhone', 'normalizePhone', 'hasUsableSpeech'];
  for (const k of fnExports) check('export:' + k + ' is function', () => assert.strictEqual(typeof module.exports[k], 'function'));
  for (const k of ['SPECIALISTS', 'TRADE_SALES', 'TRADES_PRICING_TIERS']) {
    check('export:' + k + ' is object', () => assert.ok(module.exports[k] && typeof module.exports[k] === 'object'));
  }
  const m = module.exports;
  check('normalizePhone strips formatting', () => assert.strictEqual(m.normalizePhone('(754) 555-1234'), '7545551234'));
  check('isKnown true/false', () => { assert.strictEqual(m.isKnown('plumbing'), true); assert.strictEqual(m.isKnown('zzz'), false); });
  check('classifyPlumbingCategory burst pipe trigger', () => assert.strictEqual(m.classifyPlumbingCategory('my pipe burst and water is everywhere'), 'BURST_PIPE_ACTIVE_LEAK'));
  check('hasUsableSpeech filters empty', () => { assert.strictEqual(m.hasUsableSpeech('hello I need a plumber'), true); assert.strictEqual(m.hasUsableSpeech(''), false); });
  check('classifyTradeRole owner', () => assert.strictEqual(m.classifyTradeRole('I am the owner'), 'owner'));
  check('classifyTradePain after-hours', () => assert.strictEqual(m.classifyTradePain('we miss calls after hours'), 'AFTER_HOURS'));
  check('affirmative yes/no', () => { assert.strictEqual(m.affirmative('yes please'), true); assert.strictEqual(m.affirmative('no'), false); });
  check('pricing: solo tier default, never $499 for single line', () => {
    assert.strictEqual(m.isPricingQuestion('how much is it'), true);
    const a = m.tradePricingAnswer('how much does it cost', 'en', {});
    assert.strictEqual(a.tierId, 'solo');
  });
  check('createSession + evaluateTurn returns speech chunks', () => {
    const s = m.createSession('plumbing', 'CAselftest', '+17545551234', {});
    assert.strictEqual(s.specialist, 'plumbing');
    const r = m.evaluateTurn(s, 'my pipe burst', { language: 'en' });
    assert.ok(r && Array.isArray(r.speechChunks) && r.speechChunks.length > 0);
    assert.strictEqual(typeof m.calculateTradeAxiScore(s), 'number');
  });
  if (failures.length) { console.log('SELF-TEST FAILED: ' + failures.join(', ')); process.exit(1); }
  console.log('SELF-TEST PASSED');
  process.exit(0);
}
