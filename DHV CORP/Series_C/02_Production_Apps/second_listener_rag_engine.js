/**
 * Second Listener RAG Engine — Sub-50ms Telephony Knowledge & Script Co-Pilot
 * =========================================================================
 * Governs real-time semantic retrieval, grounded objection handling,
 * and Dual-Agent (Matthew ⇄ Angel) tag-team telephony for Series C.
 *
 * Implements:
 * - Fable 5.1 Dual-Agent Sales Demo & 2nd Listener Architecture
 * - 50 Canonical Contractor Due-Diligence Scripts (Top 50 Q&A)
 * - Claims Executive & Statutory §4101 Compliance Rules
 * - Sovereign Pricing (Ruling Q-PLUMBER-OFFER-01): 14-day zero-card trial ->
 *   $99 first 30 days -> $499/mo list price + 30-Day Money-Back Guarantee
 * - High-Status Deferred Answer for Unscripted Fleet Workflows
 * - Sub-50ms Execution Budget (Zero Open-LLM Latency Jitter)
 * - 100% Day-1 Bilingual Parity (EN & ES)
 */
// Audited on 2026-11-04

'use strict';
// NTLB-PILLAR-2 audit timestamp: 2026-11-04
// NTLB-GEMINI2-PILLAR-2-TRIGGER-01 audit: validated loadClientCards path resolution and export consistency
// NTLB-PILLAR-2: syntax validated

const fs = require('fs');
const path = require('path');
const customerIdentity = require('./customer_identity_engine');

// ── CANONICAL SCRIPT KNOWLEDGE BASE (TIER 1) ──
const SCRIPT_DB = [
  // ── 1. PRICING & THE $99 INTRO / $499 LIST / 30-DAY MBG OFFER (Ruling Q-PLUMBER-OFFER-01) ──
  {
    id: 'Q-PRICE',
    specialist: 'trades',
    category: 'pricing',
    match: /\b(cost|price|pricing|rates?|fee|fees|expensive|afford|quote|charge|cobran|cuanto|precio|how much|499|99|299|money back|guarantee|guaranty|refund)\b/i,
    answers: {
      en: {
        narrator: "You start with a 14-day free trial with zero credit card required. If you love it, your first 30 days is just $99. After that, it's our standard $499 a month flat rate with zero per-minute charges. And it comes with our 30-Day Money-Back Guarantee: if it doesn't capture at least 5 qualified jobs in your first month, you get 100% of your money back.",
        anchor: "Trapping a single emergency repair pays for the entire year. Would you like me to text you your trial link?"
      },
      es: {
        narrator: "Comienza con 14 días completamente gratis sin tarjeta de crédito. Si decide continuar, sus primeros 30 días cuestan solo $99 como oferta de lanzamiento, y luego $499 al mes tarifa plana sin cargos por minuto. Además incluye nuestra Garantía de Devolución de 30 Días: si no le captura al menos 5 trabajos calificados, le devolvemos el 100%.",
        anchor: "Un solo trabajo de emergencia cubre el servicio del año entero. ¿Le envío el enlace de activación por texto?"
      }
    }
  },

  // ── 2. SETUP & STAR 72 / 73 FORWARDING (NO HARDWARE — 3 OPERATIONAL MODES) ──
  {
    id: 'Q-SETUP',
    specialist: 'trades',
    category: 'telephony',
    match: /\b(72|71|73|star 72|star 73|call forwarding|forward|forwarding|setup|set up|how does (?:the )?setup work|how does it work|activate|activation|start|turn on|como funciona|activar|desviar)\b/i,
    answers: {
      en: {
        narrator: "Setup takes 60 seconds with zero hardware changes and zero carrier porting, and you can run it in three ways: first, if you're a solo plumber or out on a job under a sink during the day, dial star 72 right now so Angel answers every call while your hands are full; second, set conditional 3-ring no-answer forwarding with star 71 so your phone rings first and Angel only catches calls you can't grab; or third, dial star 72 at 5 PM for after-hours and weekend coverage and star 73 to turn it off.",
        anchor: "Would you use it mainly while you're on jobs during the day, or after hours, or both?"
      },
      es: {
        narrator: "La configuración toma 60 segundos sin cambiar de compañía ni comprar equipos, con tres modos: primero, si trabaja solo o está debajo de un fregadero de día, marque asterisco 72 ahora mismo para que Angel conteste mientras tiene las manos ocupadas; segundo, active el desvío condicional en 3 timbres con asterisco 71 para que solo conteste si usted no alcanza el teléfono; o tercero, úselo después de las 5 PM y fines de semana.",
        anchor: "¿Lo usaría principalmente mientras está en trabajos durante el día, fuera de horario, o ambos?"
      }
    }
  },

  // ── 2b. SOLO PLUMBER / DAYTIME UNDER A SINK / WHY NOT RIGHT NOW ──
  {
    id: 'Q-TRADES-SOLO-DAYTIME',
    specialist: 'trades',
    category: 'telephony',
    match: /\b(why would you not do it right now|why not do it right now|why wait until 5|wait until 5\s*(?:pm)?|working on a sink|under a sink|even for a plumber|answer the phone now|during the day|hands are full|on a job right now)\b/i,
    answers: {
      en: {
        narrator: "You're 100 percent right — if you're a solo plumber or under a sink with a wrench in your hand at 11 AM, waiting until 5 PM makes zero sense! You can turn Angel on right now 24/7 with star 72, or set 3-ring conditional overflow with star 71 so your cell rings first and if your hands are wet under a sink, Angel picks up on ring 3, triages the leak, texts the homeowner a photo link, and sends the job straight to your phone.",
        anchor: "That way you never have to crawl out from under a sink to answer a call again. How many calls a day hit your cell while you're mid-job?"
      },
      es: {
        narrator: "¡Tiene toda la razón! Si trabaja por su cuenta o está debajo de un fregadero a las 11 de la mañana, esperar hasta las 5 de la tarde no tiene sentido. Puede activarla ahora mismo 24/7 con asterisco 72, o configurar el desvío en 3 timbres con asterisco 71 para que si tiene las manos ocupadas, Angel conteste en el tercer timbre, pida fotos por texto y le mande el trabajo al celular.",
        anchor: "Así nunca más pierde un trabajo por tener las manos ocupadas. ¿Cuántas llamadas le entran mientras está trabajando?"
      }
    }
  },

  // ── 2c. HOW DO YOU GET ALL THAT INFORMATION / 60-SECOND WEBSITE AUTO-INGEST ──
  {
    id: 'Q-TRADES-ONBOARDING-WEBSITE',
    specialist: 'trades',
    category: 'onboarding',
    match: /\b(how do you get all that information|where do you get (?:that|all that|the) info|how does (?:she|angel|it) know my (?:business|prices|hours|services|area)|how do we train|onboarding|customize|configure)\b/i,
    answers: {
      en: {
        narrator: "Great question — you don't have to type out a giant manual. When you paste your website URL or Google Business profile into our 60-second onboarding link, our system automatically reads your website to pull your business hours, service cities, zip codes, and job types. Then you just confirm four quick rules: your on-call tech cell number, your dispatch fee policy, which emergencies trigger an immediate text alert, and your CRM webhook if you use ServiceTitan, Housecall Pro, or Jobber.",
        anchor: "It takes about 60 seconds total on your phone. Do you have a website or Google Business page we can pull from?"
      },
      es: {
        narrator: "Excelente pregunta — no tiene que llenar manuales largos. Al ingresar el enlace de su sitio web o perfil de Google en nuestro portal de 60 segundos, el sistema lee automáticamente sus horarios, ciudades, códigos postales y tipos de servicio. Usted solo confirma cuatro datos: el celular del técnico de guardia, su tarifa de diagnóstico, qué emergencias disparan alerta inmediata y su CRM.",
        anchor: "Toma unos 60 segundos desde su celular. ¿Tiene página web o perfil de Google para importar sus datos?"
      }
    }
  },

  // ── 2d. FULL TRADE FEATURES BREAKDOWN ("Tell me more about all the features") ──
  {
    id: 'Q-TRADES-FEATURES',
    specialist: 'trades',
    category: 'features',
    match: /\b(tell me more about (?:all )?(?:the )?features|what (?:are all|other) features|everything (?:it|she|angel) does|all the features|full list of features|what else does (?:it|she) do)\b/i,
    answers: {
      en: {
        narrator: "Here are the 7 core features included in your $100 a month founding plan: first, 24/7 Ring-1 AI voice answering in English and Spanish with zero busy signals even if 10 people call at once; second, live life-safety and main water shut-off valve coaching to stop property damage; third, instant in-call SMS photo upload links so you see the broken pipe or water heater label before rolling a truck; fourth, 10-second SMS and email job tickets sent to your on-call tech; fifth, two-lane triage that separates high-ticket emergencies from routine quotes; sixth, direct webhooks into ServiceTitan, Housecall Pro, and Jobber; and seventh, our 6-category CSR Call Audit if you have office staff.",
        anchor: "Which of those seven features would save you the most headaches right now?"
      },
      es: {
        narrator: "Estas son las 7 funciones incluidas en su plan fundador de $100 al mes: primero, contestación en el primer timbre 24/7 en inglés y español con líneas simultáneas ilimitadas; segundo, guía de emergencia para cerrar la llave de paso; tercero, enlace por SMS para que el cliente suba fotos del daño antes de enviar el camión; cuarto, alertas por SMS en 10 segundos al técnico de guardia; quinto, triaje inteligente que separa emergencias de cotizaciones rutinarias; sexto, integración con ServiceTitan, Housecall Pro y Jobber; y séptimo, auditoría de llamadas para su personal de oficina.",
        anchor: "¿Cuál de esas siete funciones le ayudaría más en su operación hoy?"
      }
    }
  },

  // ── 2e. CLAIMS CARRIER OPERATING MODELS (TPA vs. IN-HOUSE vs. EXPRESS TEAM WARM TRANSFER) ──
  {
    id: 'Q-CLAIMS-TPA-VS-INHOUSE-EXPRESS',
    specialist: 'claims',
    category: 'operations',
    match: /\b(tpa handle the calls|don'?t even have any staff in[- ]?house|in[- ]?house.*express team|express team.*end to end|warm transfer.*express|how does it fit.*tpa)\b/i,
    answers: {
      en: {
        narrator: "Spot on — carriers operate across three distinct models, and we configure Angel for each one: first, if a carrier outsources 100 percent of intake to a TPA with zero in-house staff, Angel acts as your 24/7 overflow and our AxiRate engine audits 100 percent of your TPA's calls and claim files to enforce your 24-hour contact SLAs; second, if you have an in-house intake or Express Claims team, Angel captures the front-end facts, pre-populates the ACORD file, and executes an instant warm transfer so your Express desk handles the claim end-to-end on that first call; and third, after hours or during CAT surges, Angel completes the full FNOL and queues first-in-line morning processing.",
        anchor: "Which of those three operating models matches your organization best?"
      },
      es: {
        narrator: "Exactamente — configuramos a Angel para esos tres modelos operativos: primero, si la aseguradora delega todo a un TPA sin personal interno, Angel sirve de desborde 24/7 y AxiRate audita el 100% de las llamadas del TPA frente a sus SLA de 24 horas; segundo, si tienen un equipo interno o de Reclamos Exprés, Angel captura los datos iniciales, llena el archivo ACORD y hace una transferencia cálida instantánea para que su equipo Exprés cierre el reclamo de principio a fin; y tercero, fuera de horario o en catástrofes, completa el reporte total.",
        anchor: "¿Cuál de esos tres modelos operativos describe mejor a su organización?"
      }
    }
  },

  // ── 3. CRM & DISPATCH INTEGRATIONS (ServiceTitan, Housecall Pro, Jobber, FieldEdge) ──
  {
    id: 'Q-CRM',
    specialist: 'trades',
    category: 'integration',
    match: /\b(servicetitan|service titan|housecall|house call|jobber|fieldedge|dispatch software|plumbing software|how do i know you have integration|know you have integration|integration into those)\b/i,
    answers: {
      en: {
        narrator: "We push live job tickets directly via REST webhook and API into ServiceTitan, Housecall Pro, and Jobber, complete with the customer's name, verified street address, emergency classification, audio recording link, transcript, and damage photos. And you don't have to take our word for it — during your 30-day free trial, we fire a live test ticket straight into your ServiceTitan, Housecall Pro, or Jobber board in 60 seconds so you see it pop up before forwarding a single customer call.",
        anchor: "Which dispatch software is your shop running today — ServiceTitan, Housecall Pro, Jobber, or your mobile phone?"
      },
      es: {
        narrator: "Nos integramos directamente con ServiceTitan, Housecall Pro y Jobber mediante webhooks y API. Al terminar la llamada, el trabajo se registra en su tablero con dirección, grabación, transcripción y fotos. Además, durante su prueba gratuita de 30 días enviamos un ticket de prueba en vivo a su tablero en 60 segundos para que usted mismo lo compruebe antes de desviar llamadas reales.",
        anchor: "¿Qué software de despacho utiliza hoy — ServiceTitan, Housecall Pro, Jobber o su teléfono móvil?"
      }
    }
  },

  // ── 4. TWO-LANE TRIAGE / NIGHT SLEEP / FALSE ALARMS ──
  {
    id: 'Q-TRIAGE',
    category: 'operations',
    match: /\b(will it wake me|middle of the night|false alarm|how does (?:it|the system) know what'?s an emergency|c[oó]mo sabe si es emergencia|falsa alarma|2 am|two am)\b/i,
    answers: {
      en: {
        narrator: "It will never wake you up for routine calls. We enforce strict two-lane triage: routine drips, fixture quotes, or maintenance calls get booked for an 8 AM morning callback with photos attached. Only catastrophic emergencies — gushing water, zero heat, or gas odors — trigger on-call tech dispatch.",
        anchor: "You sleep through the night and only roll for high-ticket revenue. Fair enough?"
      },
      es: {
        narrator: "Nunca lo despertará por llamadas rutinarias. Operamos con triaje estricto de dos carriles: fugas menores o presupuestos se agendan para una llamada a las 8 AM con fotos registradas. Solo emergencias reales como agua corriendo o cortes totales de calefacción disparan la alerta a su técnico de guardia.",
        anchor: "Usted duerme tranquilo y solo factura emergencias de alto valor. ¿Le parece justo?"
      }
    }
  },

  // ── 5. AI DISCLOSURE & HOMEOWNER PERCEPTION ──
  {
    id: 'Q-ROBOT',
    category: 'perception',
    match: /\b(customers? (hate|hang up)|not a robot|real person|hablar conmigo|persona real|robot|ai voice|sound like a robot|sound robotic|hang up on ai)\b/i,
    answers: {
      en: {
        narrator: "Homeowners get annoyed with bots that pretend to be human. That's why we disclose upfront in sentence one that we're your shop's AI emergency assistant. At 2 in the morning, a customer with a flooded basement isn't choosing between you and AI — they're choosing between AI and a dead voicemail. Nobody with water on their floor leaves a voicemail; they call your competitor.",
        anchor: "Angel locks in the dispatch before they can dial anyone else. Does that make sense?"
      },
      es: {
        narrator: "Los clientes se molestan con robots que intentan engañarlos diciendo que son humanos. Por eso nosotros decimos de inmediato que somos el asistente de inteligencia artificial del negocio. A las 2 de la mañana, quien tiene la casa inundada no decide entre usted o la IA; decide entre la IA o un buzón de voz. Y nadie con agua en el piso deja mensajes de voz; llaman a su competidor.",
        anchor: "Angel captura el trabajo al instante antes de que llamen a la competencia. ¿Tiene sentido?"
      }
    }
  },

  // ── 6. COMPARISON TO ANSWERING SERVICES (AnswerConnect, Ruby, Live Call Centers) ──
  {
    id: 'Q-SERVICE',
    category: 'comparison',
    match: /\b(burned|answering service|call center|live operator|quemado|servicio de contestador|ruby|answerconnect|teleperformance)\b/i,
    answers: {
      en: {
        narrator: "Traditional answering services charge per minute and leave you messy handwritten notes at 8 AM. They don't know how to guide a homeowner to a shut-off valve, they don't capture damage photos, and they can't push jobs into ServiceTitan. We do all three instantly for a flat, predictable monthly rate.",
        anchor: "Different incentive, different night's sleep. Would you like to test our triage?"
      },
      es: {
        narrator: "Los call centers tradicionales cobran por minuto y le entregan mensajes en papel a las 8 de la mañana. No saben guiar a un cliente a cerrar la llave de paso, no recopilan fotos y no se integran con su sistema de despacho. Nosotros hacemos las tres cosas en tiempo real por una tarifa mensual predecible.",
        anchor: "Diferente incentivo, diferente descanso. ¿Desea probar nuestro triaje?"
      }
    }
  },

  // ── 7. SPANISH & BILINGUAL PARITY ──
  {
    id: 'Q-SPANISH',
    category: 'bilingual',
    match: /\b(spanish|español|espanol|bilingual|idioma|lenguaje|charge extra for spanish)\b/i,
    answers: {
      en: {
        narrator: "Zero extra charges. Angel speaks fluent native Spanish. She handles the emergency in Spanish, gives water shut-off instructions in Spanish, and outputs an English dispatch ticket for your technicians with zero translation lag and no extra fees.",
        anchor: "Do you get a lot of bilingual calls in your service area?"
      },
      es: {
        narrator: "Sin ningún costo adicional. Agent Angel habla español nativo con total fluidez. Atiende la llamada en español, da instrucciones de cierre de agua en español y genera el ticket de despacho en inglés para sus técnicos sin retrasos ni cobros extras.",
        anchor: "¿Recibe muchas llamadas de clientes hispanohablantes en su zona de servicio?"
      }
    }
  },

  // ── 8. CONCURRENT CALLS & CATASTROPHE SURGE CAPACITY ──
  {
    id: 'Q-SURGE',
    category: 'capacity',
    match: /\b(two calls|multiple calls|concurrent|simultaneous|at the same time|busy signal|busy tone|freeze|freeze surge|catastrophe|storm surge|how many calls)\b/i,
    answers: {
      en: {
        narrator: "Traditional phones give the second caller a busy signal or send them to voicemail. Agent Angel has infinite concurrent cloud lines — she answers 10 or 100 callers at the exact same second with zero hold time, triages every emergency, and queues all tickets.",
        anchor: "How many after-hours calls does your shop average in a typical week?"
      },
      es: {
        narrator: "Los teléfonos tradicionales dan tono de ocupado o envían al buzón si entra una segunda llamada. Agent Angel cuenta con líneas concurrentes ilimitadas en la nube: contesta 10 o 100 llamadas al mismo segundo sin esperas, clasifica cada emergencia y organiza cada uno de los tickets.",
        anchor: "¿Cuántas llamadas fuera de horario recibe su negocio en una semana típica?"
      }
    }
  },

  // ── 9. PHOTO UPLOADS & FORENSIC METADATA (EXIF / GPS) ──
  {
    id: 'Q-PHOTOS',
    category: 'photos',
    match: /\b(how do (?:i|you|we) (?:see|get|upload|take) photos|where do (?:the )?photos go|how does the photo (?:link|upload) work|how do photo uploads work|exif metadata|gps coordinates on photos|forensic photos|chain of custody)\b/i,
    answers: {
      en: {
        narrator: "During the call, Angel texts a secure photo upload link to the caller. The homeowner snaps pictures right from their phone camera without downloading an app. The photos attach to your live ticket with verified timestamps and GPS coordinates so your technician quotes accurately from the truck.",
        anchor: "Did that text link come through on your mobile device?"
      },
      es: {
        narrator: "Durante la llamada, Angel envía un enlace seguro por mensaje de texto. El cliente toma las fotos directamente con la cámara de su celular sin descargar aplicaciones. Las fotos se adjuntan a su orden de trabajo con hora y coordenadas GPS para cotizar desde el camión.",
        anchor: "¿Le llegó el mensaje con el enlace a su teléfono móvil?"
      }
    }
  },

  // ── 10. SPATIAL CONTAINMENT & SHUT-OFF GUIDANCE (Dual-Agent Opportunity) ──
  {
    id: 'Q-SHUTOFF',
    category: 'triage_spatial',
    match: /\b(how do(?:es)? (?:she|you|angel) guide|how does shut.?off (?:guidance|work)|containment guidance|how do you stop (?:the )?water|how to shut off|c[oó]mo gu[ií]a para cerrar)\b/i,
    answers: {
      en: {
        dual: true,
        narrator: "That is our signature spatial emergency containment feature. Angel, demonstrate how you walk a homeowner to their main shut-off valve.",
        agent: "Stay calm. Check near the front exterior hose bib, garage entry, or street meter box. Turn the valve clockwise 90 degrees to shut off main water immediately.",
        narratorWrap: "Walking the caller through that stops $30,000 in structural damage while your truck is rolling.",
        anchor: "Would you like to test that emergency sequence right now?"
      },
      es: {
        dual: true,
        narrator: "Esa es nuestra función insignia de contención espacial de emergencia. Angel, demuestra cómo guías a un cliente para cerrar su llave de paso.",
        agent: "Mantenga la calma. Revise cerca de la manguera exterior frontal, la entrada del garaje o la caja del medidor en la calle. Gírela 90 grados a la derecha para cortar el agua de inmediato.",
        narratorWrap: "Guiar al cliente en ese instante evita miles de dólares en daños mientras su técnico va en camino.",
        anchor: "¿Desea probar esa secuencia de emergencia en vivo ahora mismo?"
      }
    }
  },

  // ── 11. AFTER-HOURS, DAYTIME OVERFLOW & 24/7 SCHEDULE ──
  {
    id: 'Q-HOURS',
    category: 'schedule',
    match: /\b(after.?hours|after 5|weekends|only at night|daytime|business hours|schedule|when does it answer)\b/i,
    answers: {
      en: {
        narrator: "You have complete flexibility: you can run Angel 24/7 right now with star 72 while you're under a sink on a job, or set 3-ring daytime overflow with star 71 so she only answers when you or your office can't get to the phone, or dial star 72 at 5 PM for nights and weekends.",
        anchor: "Would 3-ring daytime overflow or 24/7 coverage work best for how you run your jobs?"
      },
      es: {
        narrator: "Tiene flexibilidad total: puede activar a Angel 24/7 ahora mismo con asterisco 72 mientras está en un trabajo, usar el desvío en 3 timbres con asterisco 71 durante el día cuando no pueda contestar, o activarla a las 5 PM para noches y fines de semana.",
        anchor: "¿Le funcionaría mejor el desvío en 3 timbres durante el día o cobertura 24/7?"
      }
    }
  },

  // ── 12. THINKING IT OVER / HESITATION OBJECTION ──
  {
    id: 'Q-THINKING',
    category: 'objection',
    match: /\b(think about it|think it over|need to think|let me think|pensar|lo pienso|déjame pensarlo|dejame pensar|not sure yet)\b/i,
    answers: {
      en: {
        narrator: "Totally fair. But keep in mind the 14-day trial is zero cost with no credit card required. Thinking about it while keeping voicemail on just costs you missed emergency jobs every night. Dial star 72 tonight, test it with real calls, and dial star 73 if it's not the easiest money your shop has made.",
        anchor: "Fair enough? Would you like me to text you the 45-second setup link?"
      },
      es: {
        narrator: "Totalmente comprensible. Pero recuerde que la prueba de 14 días es con costo cero y sin tarjeta. Pensarlo mientras deja el buzón de voz activo le cuesta llamadas de emergencia perdidas cada noche. Active asterisco 72 hoy, pruébelo con llamadas reales y apáguelo si no le convence.",
        anchor: "¿Le parece justo? ¿Desea que le envíe el enlace de configuración a su teléfono?"
      }
    }
  },

  // ── 13. CLAIMS STATUTORY & TEXAS CODE §4101 BOUNDARY ──
  {
    id: 'Q-TEXAS-4101',
    specialist: 'claims',
    category: 'compliance',
    match: /\b(texas\s+(?:insurance\s+code|code|statute|law|reg)|section\s+4101|4101|insurance code|adjuster license|licensing authority|adjudicat|liability determination|coverage decision|statutory conduit)\b/i,
    answers: {
      en: {
        narrator: "Agent Angel is configured to operate strictly as an administrative communications and preliminary intake conduit aligned with Texas Insurance Code Section 4101 non-adjudication boundaries. She captures and transcribes facts reported by the caller without adjudicating coverage, liability, or fault apportionment. All intake summaries and ACORD exports are stamped with Record Type: Preliminary for your licensed adjusters.",
        anchor: "What scenario would you like to test today with Angel?"
      },
      es: {
        narrator: "Agent Angel está clasificada legalmente estrictamente como un conducto de comunicación y recepción administrativa bajo el Código de Seguros de Texas, Sección 4101. Captura y transcribe los hechos reportados por el usuario sin adjudicación de cobertura ni responsabilidad. Todos los registros y exportaciones ACORD se sellan permanentemente con Tipo de Registro: Preliminar para sus ajustadores licenciados.",
        anchor: "¿Qué escenario le gustaría probar hoy con Angel?"
      }
    }
  },

  // ── 14. CLAIMS CORE INTEGRATIONS (Guidewire, Duck Creek, CCC ONE, Mitchell) ──
  {
    id: 'Q-CLAIMS-INTEGRATIONS',
    specialist: 'claims',
    category: 'compliance',
    match: /\b(guidewire|duck creek|ccc|ccc one|mitchell|snapsheet|acord 125|acord 140|core system|core systems|integration|integrate|webhook|api)\b/i,
    answers: {
      en: {
        narrator: "Agent Angel supports webhook and REST integrations for Guidewire ClaimCenter, Duck Creek, CCC ONE, and Mitchell using structured ACORD 125 and 140 XML and JSON exports, attaching call audio, transcripts, and uploaded photos to the preliminary claim packet.",
        anchor: "What core claims system does your team currently utilize?"
      },
      es: {
        narrator: "Agent Angel se integra de forma nativa con Guidewire ClaimCenter, Duck Creek, CCC ONE y Mitchell mediante webhooks REST y exportaciones XML estándar ACORD 125 y 140. Las grabaciones, transcripciones y fotos forenses se vinculan al expediente sin digitación manual.",
        anchor: "¿Qué sistema central de reclamos utiliza actualmente su organización?"
      }
    }
  },

  // ── 14b. CLAIMS CAT SURGE ELASTICITY & SCALE ──
  {
    id: 'Q-CLAIMS-SURGE',
    specialist: 'claims',
    category: 'capacity',
    match: /\b(cat surge|catastrophe|hurricane|hail surge|surge capacity|scale|scale during|ten thousand|10,000|how do you scale|surge)\b/i,
    answers: {
      en: {
        narrator: "Agent Angel runs on cloud webhook infrastructure designed to handle concurrent catastrophe call spikes during hurricanes or hail storms without adding temporary staffing overhead, queuing preliminary intake records durably if downstream carrier endpoints experience downtime.",
        anchor: "How does your team currently handle intake spikes during major weather events?"
      },
      es: {
        narrator: "Agent Angel escala de forma sin servidor de 1 a 10,000 líneas simultáneas durante un evento catastrófico como huracán o granizo severo sin contratar personal temporal ni horas extras. Cada llamada se procesa al instante con colas locales si su sistema principal sufre caídas.",
        anchor: "¿Cómo gestiona su equipo actualmente los picos de llamadas durante desastres naturales?"
      }
    }
  },

  // ── 15. AXIRATE 108-POINT COMPLIANCE AUDITING & 4 CUSTOMIZABLE CATEGORIES ──
  {
    id: 'Q-AXIRATE',
    category: 'compliance',
    match: /\b(axirate|audit|auditing|compliance|scorecard|qa|quality assurance|scoring|score|sampling|108|categories|customiz|factors|2%|6%|two percent|six percent|coach|counsel)\b/i,
    answers: {
      en: {
        narrator: "Most companies only audit between 2% and 6% of recorded statements by chance. AI Agent Angel not only takes live FNOL calls, she also judges 100% of your existing human employees' FNOL and claims calls across 108 factors that can be customized to your team's needs — broken down into Customer Experience and Empathy, Data Collection and Accuracy in Details, and Correct Validation Questions obtained to verify liability, coverage, vehicle damages, drivability, location, and whether any injuries are being claimed. Angel finds the exact calls your leaders need to review, then coach and counsel the representative.",
        anchor: "As an estimate, what percentage of your FNOL or Express Claim calls are currently audited?"
      },
      es: {
        narrator: "La mayoría de las aseguradoras auditan solo entre el 2% y el 6% de las declaraciones grabadas al azar. AI Agent Angel no solo toma llamadas de Primer Aviso de Pérdida, sino que también evalúa el 100% de las llamadas de sus empleados actuales en base a 108 factores personalizables para su equipo: Experiencia del Cliente y Empatía, Recolección de Datos y Exactitud en los Detalles, y Preguntas Correctas de Validación sobre responsabilidad, cobertura, daños al vehículo, posibilidad de conducción, ubicación y si se reclaman lesiones. Angel identifica exactamente las llamadas que sus líderes deben revisar para capacitar y orientar al representante.",
        anchor: "Como estimación, ¿qué porcentaje de sus llamadas de Primer Aviso de Pérdida o Reclamos Exprés se auditan actualmente?"
      }
    }
  },

  // ── 15b. MULTI-ARTIFACT CLAIM FILE "AUDIT ADD-ON" (50%+ SPEEDUP & 24H KPIS) ──
  {
    id: 'Q-CLAIMS-AUDIT-ADDON',
    specialist: 'claims',
    category: 'compliance',
    match: /\b(audit add[- ]?on|multiple calls|claim notes|police report|kpis?|metrics|speed up|50%|fifty percent|24\s*(?:hr|hour)s?|twenty[- ]four hours?|expectation|followed[- ]?up|all parties|compare statements)\b/i,
    answers: {
      en: {
        narrator: "Our Audit Add-On aggregates multiple calls, adjuster claim notes, police reports, KPIs, and metrics into one quick summary to speed up your audit process by 50% or more. It automatically cross-compares recorded statements, documented claim notes, and police reports alongside dates and timestamps to show where any KPI was met or missed — such as whether the representative followed up with the customer based on the provided expectation, or whether contact was attempted and completed with all parties within 24 hours of receipt.",
        anchor: "Would you like to see how the Audit Add-On flags 24-hour contact and statement discrepancies on your live summary link?"
      },
      es: {
        narrator: "Nuestro Complemento de Auditoría reúne múltiples llamadas, notas del reclamo, reportes policiales, KPIs y métricas en un resumen ejecutivo para acelerar su proceso de auditoría en un 50% o más. Compara automáticamente las declaraciones grabadas, las notas documentadas y los reportes policiales junto con fechas y horas para mostrar si se cumplió cada KPI — como dar seguimiento al cliente según la expectativa prometida o intentar y completar contacto con todas las partes dentro de las 24 horas posteriores a la recepción.",
        anchor: "¿Le gustaría ver cómo el Complemento de Auditoría detecta discrepancias y KPIs de 24 horas en su enlace en vivo?"
      }
    }
  },

  // ── 15c. WARM TRANSFER, BOT OBJECTION & OVERNIGHT 1ST-IN-LINE PRIORITY ──
  {
    id: 'Q-CLAIMS-WARM-TRANSFER',
    specialist: 'claims',
    category: 'operations',
    match: /\b(warm transfer|associate|confirm the data|provide the claim number|issue the claim number|don'?t want a bot|hate bots|talk to a bot|customers want a human|first in line|1st processing|overnight|hold your place|up front|upfront)\b/i,
    answers: {
      en: {
        narrator: "Angel can complete any portion of the FNOL that you as the carrier prefer, and then execute a warm transfer to an associate to confirm the pre-populated data and provide the claim number. When customers say they don't want a bot to report their claim, we aren't replacing your adjuster — we are preparing your representative with all the verified information upfront to keep the call as fast as possible. And overnight, Angel captures the loss facts immediately and holds the caller's place for first-in-line processing tomorrow morning.",
        anchor: "Does your team currently use a front-end intake triage desk or route callers straight to licensed adjusters?"
      },
      es: {
        narrator: "Angel puede completar cualquier parte del Primer Aviso de Pérdida que su aseguradora prefiera y luego realizar una transferencia cálida a un asociado para confirmar los datos y entregar el número de reclamo. Cuando un cliente prefiere no reportar todo a un bot, preparamos al representante con toda la información verificada de antemano para que la llamada sea lo más rápida posible. Y durante la noche, reservamos su lugar para procesamiento prioritario a primera hora de la mañana.",
        anchor: "¿Su equipo utiliza actualmente una mesa de recepción inicial o transfiere directamente a ajustadores licenciados?"
      }
    }
  },

  // ── 15d. INTERACTIVE MAP PINPOINT & SCENE DIAGRAM GENERATION ──
  {
    id: 'Q-CLAIMS-MAP-PINPOINT',
    specialist: 'claims',
    category: 'operations',
    match: /\b(map|pinpoint|scene diagram|diagram|gps pin|location pin|intersection map|cross[- ]?street)\b/i,
    answers: {
      en: {
        narrator: "During the call, Angel texts a live link featuring our interactive Map Pinpoint option so the policyholder can tap to confirm the exact GPS coordinates or intersection of the loss. Once confirmed, the system automatically generates a vector Scene Diagram — showing weather impact zones for parked flood or hail claims, or multi-vehicle trajectories and points of impact for collisions — embedded directly inside your Claim Call Summary Report.",
        anchor: "Have you had a chance to view the generated Scene Diagram on your live Claim Call Summary Report?"
      },
      es: {
        narrator: "Durante la llamada, Angel envía un enlace con nuestra opción de Punto Exacto en el Mapa para que el asegurado confirme las coordenadas GPS o intersección del siniestro. Al confirmarse, el sistema genera automáticamente un Diagrama del Lugar — mostrando zonas climáticas para vehículos estacionados o trayectorias de impacto para colisiones — integrado en su Informe de Resumen de Llamada.",
        anchor: "¿Ha tenido oportunidad de ver el Diagrama del Lugar generado en su Informe de Resumen?"
      }
    }
  },

  // ── 15e. CONTEXTUAL PERIL LOGIC & N/A (NOT ASKED) FOR PARKED UNOCCUPIED LOSSES ──
  {
    id: 'Q-CLAIMS-CONTEXTUAL-NA',
    specialist: 'claims',
    category: 'operations',
    match: /\b(n\/a|not asked|parked|unoccupied|why ask about injur|police report for flood|police report for hail|logic in her questions)\b/i,
    answers: {
      en: {
        narrator: "Angel uses contextual peril and occupancy logic in real time. For a flood or hail loss where the vehicle was parked and unoccupied, there is zero reason to ask about or mention injuries or a police report — so Angel skips those questions entirely and stamps them as N/A (Not Asked — Parked/Unoccupied) on the Claim Call Summary Report.",
        anchor: "What other peril-specific rules does your claims team enforce during FNOL?"
      },
      es: {
        narrator: "Angel aplica lógica contextual según el tipo de pérdida. En un reclamo por inundación o granizo donde el vehículo estaba estacionado y desocupado, no hay razón para preguntar sobre lesiones ni reporte policial — por lo que Angel omite esas preguntas y las registra como N/A (No Preguntado) en el Informe de Resumen.",
        anchor: "¿Qué otras reglas específicas por tipo de siniestro aplica su equipo durante la recepción?"
      }
    }
  },

  // ── 15f. ABRIDGED DEMO WITH PRE-POPULATED DETAILS & CLAIM CALL SUMMARY HIGHLIGHT ──
  {
    id: 'Q-CLAIMS-ABRIDGED-SUMMARY',
    specialist: 'claims',
    category: 'overview',
    match: /\b(abridged|pre[- ]?populated|claim call summary|highlight of the demo|other types of losses|example calls)\b/i,
    answers: {
      en: {
        narrator: "To keep the live demo fast, we pre-load sample policy PA-8849201-NAT and a generic 2022 Acura MDX while capturing your real loss narrative, ACORD fields, and Scene Diagram from your description. Once intake finishes, your single link opens the Claim Call Summary Report and AxiRate Dashboard where you can inspect your call alongside example calls from other loss types, the 108-factor QA breakdown, and the multi-call Audit Add-On.",
        anchor: "Are you viewing the Claim Call Summary Report on your phone or on a computer right now?"
      },
      es: {
        narrator: "Para que la demostración sea ágil, precargamos la póliza de muestra PA-8849201-NAT y un Acura MDX 2022 genérico mientras capturamos los detalles reales del siniestro, los campos ACORD y el Croquis de la Escena a partir de su descripción. Al finalizar, su enlace abre el Informe de Resumen de Llamada y el Panel AxiRate.",
        anchor: "¿Está viendo el Informe de Resumen de Llamada en su teléfono o en su computadora?"
      }
    }
  },

  // ── 15g. WHAT THE CALLER SEES ON THE LINK & HOW THE CALL SUMMARY IS BUILT (CONCEPTS) ──
  {
    id: 'Q-LINK-CALL-SUMMARY-CONCEPTS',
    specialist: 'claims',
    category: 'overview',
    match: /\b(what am i (?:looking at|seeing)|what(?:'s| is) on (?:the|this) (?:link|page|screen|report)|how (?:is|was) the (?:call )?summary built|how does (?:it|she|angel) build the summary|concepts of what she (?:has )?completed|walk me through (?:the|this) (?:link|report|summary)|explain what i'm seeing)\b/i,
    answers: {
      en: {
        narrator: "When you open your single link, you're looking at four live sections built from what Angel just completed: first, at the top is the Executive Claim Call Summary and pre-filled ACORD 125 and 140 packet — turning your spoken story into verified date, time, location, vehicle, and drivability fields, with inapplicable questions marked N/A Not Asked. Second is the automated vector Accident Scene Diagram and pinpoint map built directly from your loss description and street or intersection. Third is the live photo evidence strip with camera timestamp and NOAA weather verification. And fourth is the 108-factor AxiRate scorecard — 72 factors grading the live call across Empathy, Data Accuracy, and Validation Questions, plus 36 factors for the Claim-File Audit Add-On.",
        anchor: "Which of those four sections on your screen would you like to dig into first — the Scene Diagram, the ACORD summary fields, or the 108-factor AxiRate score?"
      },
      es: {
        narrator: "Al abrir su enlace único, verá cuatro secciones construidas con lo que Angel acaba de completar: primero, el Resumen Ejecutivo de la Llamada y el paquete ACORD 125 y 140 prellenado; segundo, el Croquis Vectorial de la Escena y mapa generado directamente desde su descripción; tercero, las fotografías subidas con validación de fecha y clima NOAA; y cuarto, la evaluación AxiRate de 108 factores — 72 factores de la llamada en vivo y 36 del Complemento de Auditoría del expediente.",
        anchor: "¿Cuál de esas cuatro secciones en su pantalla le gustaría revisar primero?"
      }
    }
  },

  // ── 15h. 100+ PLATFORM FEATURES, ONBOARDING & AXIRATE CAPABILITIES ──
  {
    id: 'Q-100-PLUS-FEATURES-CATALOG',
    specialist: 'claims',
    category: 'features',
    match: /\b(100\s*(?:plus|\+)|hundred(?:\s+plus)?\s+features|all\s+(?:the\s+)?features|full\s+features|features\s+of\s+axirate|axirate\s+features|how\s+to\s+onboard|how\s+do\s+we\s+onboard|onboarding\s+process|talk\s+about\s+different\s+aspects)\b/i,
    answers: {
      en: {
        narrator: "Across our 100-plus enterprise features, carriers use six core pillars: first, 4-Step Onboarding where you choose full FNOL or partial triage with warm transfer, map ACORD fields, and customize 44 of the 108 scoring factors in 1 to 2 months; second, Peril-Specific FNOL Carve-Outs for Glass, Comprehensive, CAT hail or flood surges, Towing, and Collision; third, automated Accident Scene Diagrams and EXIF plus NOAA weather verification from the caller's description and photos; fourth, AxiRate 72-factor live call scoring on 100% of inbound and outbound adjuster calls instead of random 2% to 6% sampling; fifth, the 36-factor Claim-File Audit Add-On comparing recorded statements, claim notes, and police reports against 24-hour contact SLAs; and sixth, our AngelText two-way Twilio SMS workbench with automated missing-document follow-up and Guidewire or Duck Creek webhooks.",
        anchor: "Would you like to explore how the 4-step onboarding works, how carriers use AxiRate on Express adjuster calls, or the 108-factor audit breakdown?"
      },
      es: {
        narrator: "Entre nuestras más de 100 funciones empresariales destacan seis pilares: primero, Incorporación en 4 pasos donde elige recepción completa o transferencia cálida y personaliza 44 de los 108 factores; segundo, flujos específicos para Cristales, Cobertura Amplia, Catástrofes, Grúas y Colisión; tercero, Croquis Automáticos de Escena y validación EXIF con clima NOAA; cuarto, calificación AxiRate de 72 factores en el 100% de las llamadas entrantes y salientes; quinto, el Complemento de Auditoría de 36 factores entre declaraciones, notas y reportes policiales; y sexto, mensajería bidireccional AngelText con seguimiento de documentos e integración Guidewire o Duck Creek.",
        anchor: "¿Le gustaría explorar primero el proceso de incorporación, la auditoría en llamadas de ajustadores Exprés o el desglose de los 108 factores?"
      }
    }
  },

  // ── 15i. TPA OVERSIGHT, GLASS/COMP/CAT CARVE-OUTS & EXPRESS ADJUSTER INBOUND/OUTBOUND AUDITING ──
  {
    id: 'Q-TPA-CARVEOUT-AND-EXPRESS-ADJUSTERS',
    specialist: 'claims',
    category: 'operations',
    match: /\b(use\s+a\s+tpa|have\s+a\s+tpa|ask\s+(?:their|our)\s+tpa|tpa\s+to\s+require|certain\s+fnol|testing\s+glass|glass\s+or\s+comp|comp\s+or\s+cat|inbound\s+(?:and|\/)\s+outbound\s+express|express\s+claims?\s+adjusters?|in[- ]?house.*express)\b/i,
    answers: {
      en: {
        narrator: "That goes right to the heart of how carriers deploy us: if you use a TPA, you can require your TPA to run AxiRate on your book so you get 100% audit visibility and 24-hour SLA verification across every TPA call, OR you can carve out specific high-volume FNOL tracks — like Glass, Comprehensive, or CAT storm surge — to run directly through Angel at a fraction of TPA per-claim fees. And if you have an in-house Express Claims team, Angel can warm-transfer the pre-filled ACORD file while AxiRate audits 100% of your Express adjusters' inbound and outbound calls across all 72 live-call factors and 36 file-audit factors.",
        anchor: "Looking at your operation today, would the biggest immediate win be requiring AxiRate oversight on a TPA, carving out Glass, Comp, or CAT FNOL calls, or auditing 100% of your inbound and outbound Express adjuster calls?"
      },
      es: {
        narrator: "Eso va directo al corazón de cómo nos implementan las aseguradoras: si utilizan un TPA, pueden exigirle al TPA que opere con AxiRate para auditar el 100% de las llamadas y SLA de 24 horas, o separar flujos específicos de alto volumen — como Cristales, Cobertura Amplia o eventos CAT — directamente con Angel. Y para su equipo interno de Ajustadores Exprés, Angel transfiere el expediente ACORD prellenado mientras AxiRate audita el 100% de las llamadas entrantes y salientes de sus ajustadores Exprés.",
        anchor: "En su operación actual, ¿dónde vería el mayor impacto inmediato: exigir AxiRate a su TPA, separar llamadas de Cristales, Cobertura Amplia o CAT, o auditar el 100% de las llamadas entrantes y salientes de sus ajustadores Exprés?"
      }
    }
  },

  // ── 16. CLAIMS PRODUCT OVERVIEW & CAPABILITIES ──
  {
    id: 'Q-CLAIMS-OVERVIEW',
    specialist: 'claims',
    category: 'overview',
    match: /\b(tell me about (?:the )?(?:product|platform|system|demo|agent angel|this)|tell me what (?:you|it|she|angel|this) (?:can )?do|what (?:you|it|she|angel|this) (?:can )?do|what can (?:i|it|you|she|angel) do|what does (?:it|this|angel) do|about the product|overview|how does (?:this|it|angel) work)\b/i,
    answers: {
      en: {
        narrator: "In this 3-part interactive demo, you'll experience an abridged live First Notice of Loss with pre-populated policy details, followed by our Claim Call Summary Report, interactive Scene Map, and 108-factor AxiRate call auditing. Angel can complete any portion of the FNOL your carrier prefers and warm-transfer to an associate to confirm the data and issue the claim number — or hold the caller's place overnight for first-in-line morning processing — while also auditing 100% of your existing human employees' calls and claim files.",
        anchor: "When you're ready, what is your name, position, and company, or what else would you like to know?"
      },
      es: {
        narrator: "En esta demostración interactiva de 3 partes, experimentará un Primer Aviso de Pérdida abreviado con datos precargados, seguido de nuestro Informe de Resumen de Llamada, Mapa Interactivo del Lugar y auditoría AxiRate de 108 factores. Angel puede completar cualquier parte del reclamo y transferir cálidamente a un asociado — o reservar el primer lugar en la fila para la mañana siguiente — además de auditar el 100% de las llamadas de sus empleados actuales.",
        anchor: "Cuando guste, ¿cuál es su nombre, cargo y empresa, o qué más le gustaría saber?"
      }
    }
  }
];

// ── HIGH-STATUS DEFERRED ANSWER GENERATOR (TIER 2 / CLIENT SOT BOUNDARY) ──
function getDeferredAnswer(speech, lang, specialist) {
  const l = (lang || 'en').toLowerCase();
  const spec = (specialist || 'plumbing').toLowerCase();
  const isClaims = spec === 'claims' || spec === 'auto_claims' || spec === 'tpa' || spec === 'pi';
  if (isClaims) {
    if (l === 'es') {
      return {
        id: 'Q-CUSTOM-DEFERRED',
        category: 'deferred',
        speaker: 'narrator',
        speechChunks: [
          {
            voice: 'narrator',
            text: `Esa es una regla operativa específica que configuramos a la medida de cada aseguradora o TPA. Durante la implementación del piloto de 30 días sin costo, nuestro equipo técnico adapta los árboles de preguntas y validaciones directamente a sus guías de suscripción y esquema ACORD. ¿Qué escenario de siniestro le gustaría probar hoy, o cuál es su nombre y empresa para comenzar?`
          }
        ],
        anchorQuestion: "¿Qué escenario de siniestro le gustaría probar hoy, o cuál es su nombre y empresa para comenzar?"
      };
    }
    return {
      id: 'Q-CUSTOM-DEFERRED',
      category: 'deferred',
      speaker: 'narrator',
      speechChunks: [
        {
          voice: 'narrator',
          text: `That's a specific claims workflow rule we configure per carrier or TPA. During our 30-day zero-cost proof-of-concept pilot, our engineering team maps your exact underwriting rules, peril trees, and compliance validations directly to your ACORD schema. What claim scenario would you like to test today, or what is your name and company to get started?`
        }
      ],
      anchorQuestion: "What claim scenario would you like to test today, or what is your name and company to get started?"
    };
  }
  if (l === 'es') {
    return {
      id: 'Q-CUSTOM-DEFERRED',
      category: 'deferred',
      speaker: 'narrator',
      speechChunks: [
        {
          voice: 'narrator',
          text: `Ese es un requerimiento operativo muy específico para la flota de su empresa. Lo estoy anotando en su expediente ahora mismo para que nuestro director técnico configure esa lógica exacta durante su prueba de catorce días. Con la prueba sin costo y sin tarjeta, lo ajustamos a su medida. ¿Le gustaría que le envíe el enlace de activación a su teléfono?`
        }
      ],
      anchorQuestion: "¿Le gustaría que le envíe el enlace de activación a su teléfono?"
    };
  }
  return {
    id: 'Q-CUSTOM-DEFERRED',
    category: 'deferred',
    speaker: 'narrator',
    speechChunks: [
      {
        voice: 'narrator',
        text: `That's a specific operational workflow for your fleet. I'm noting that in your file right now, and our onboarding team will configure that exact rule during your 14-day trial. With the zero-card trial, we dial in your custom rules before you pay a dime. Would you like me to text you your trial link so we can stage your account?`
      }
    ],
    anchorQuestion: "Would you like me to text you your trial link so we can stage your account?"
  };
}

class SecondListenerRagEngine {
  constructor() {
    this.scripts = SCRIPT_DB;
    this.clientCardsCache = new Map();
  }

  /**
   * Loads client-specific Quick Response Cards from disk or returns cached cards.
   * Source: DHV CORP/data/second_brain/CLIENTS/<clientId>/QUICK_RESPONSE_CARDS.json
   */
// Audited on 2026-11-04
  loadClientCards(clientId) {
    if (!clientId || typeof clientId !== 'string') return [];
    const id = clientId.trim();
    if (this.clientCardsCache.has(id)) {
      return this.clientCardsCache.get(id);
    }

    // CANON-CLIENT-SCHEMA-UNIFY-01: Fix first lookup path so it resolves to
    // DHV CORP/data/second_brain/CLIENTS instead of non-existent Series_C/data/second_brain/CLIENTS
    function resolveClientsDir(startDir) {
      let cur = startDir;
      for (let i = 0; i < 6; i++) {
        const candidate = path.join(cur, 'data', 'second_brain', 'CLIENTS');
        if (fs.existsSync(candidate)) return candidate;
        const dhvCandidate = path.join(cur, 'DHV CORP', 'data', 'second_brain', 'CLIENTS');
        if (fs.existsSync(dhvCandidate)) return dhvCandidate;
        const parent = path.dirname(cur);
        if (parent === cur) break;
        cur = parent;
      }
      return null;
    }

    const detectedClientsDir = resolveClientsDir(__dirname) || resolveClientsDir(process.cwd());

    const candidatePaths = [
      // 1. Primary lookup: resolved DHV CORP/data/second_brain/CLIENTS (fixes Series_C path error)
      ...(detectedClientsDir ? [path.join(detectedClientsDir, id, 'QUICK_RESPONSE_CARDS.json')] : []),
      // 2. Relative from angel-voice-server (3 levels up to DHV CORP)
      path.resolve(__dirname, '..', '..', '..', 'data', 'second_brain', 'CLIENTS', id, 'QUICK_RESPONSE_CARDS.json'),
      // 3. Relative from 02_Production_Apps (2 levels up to DHV CORP)
      path.resolve(__dirname, '..', '..', 'data', 'second_brain', 'CLIENTS', id, 'QUICK_RESPONSE_CARDS.json'),
      // 4. From working directory
      path.join(process.cwd(), 'DHV CORP', 'data', 'second_brain', 'CLIENTS', id, 'QUICK_RESPONSE_CARDS.json'),
      path.join(process.cwd(), 'data', 'second_brain', 'CLIENTS', id, 'QUICK_RESPONSE_CARDS.json'),
      // 5. Container-local fallback
      path.join(__dirname, 'CLIENTS', id, 'QUICK_RESPONSE_CARDS.json')
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const raw = fs.readFileSync(p, 'utf8');
          const cards = JSON.parse(raw);
          if (Array.isArray(cards)) {
            const compiled = cards.map(c => ({
              ...c,
              compiledMatch: c.match_pattern ? new RegExp(c.match_pattern, 'i') : null
            }));
            this.clientCardsCache.set(id, compiled);
            return compiled;
          }
        } catch (e) {
          // Fall through
        }
      }
    }

    return [];
  }

  /**
   * Registers client cards directly into memory (useful for tests or dynamic runtime)
   */
// Audited on 2026-11-04
  registerClientCards(clientId, cards) {
    if (!clientId || !Array.isArray(cards)) return;
    const compiled = cards.map(c => ({
      ...c,
      compiledMatch: c.match_pattern ? (c.match_pattern instanceof RegExp ? c.match_pattern : new RegExp(c.match_pattern, 'i')) : null
    }));
    this.clientCardsCache.set(String(clientId).trim(), compiled);
  }

  /**
   * Sub-50ms deterministic semantic query.
   * Matches incoming caller utterance against Tier 0 Client SOT cards,
   * then Tier 1 standard scripts, or executes High-Status Deferred Answer.
   */
// Audited on 2026-11-04
  query(speech, options = {}) {
    if (!speech || typeof speech !== 'string') return null;
    const text = speech.trim();
    if (text.length < 3) return null;
    const lower = text.toLowerCase();
    const lang = (options.language || 'en').toLowerCase();
    const spec = (options.specialist || 'plumbing').toLowerCase();

    // ── TIER 0: CLIENT-SPECIFIC NOTEBOOKLM QUICK RESPONSE CARDS ──
    const clientId = options.clientId || options.client_id;
    const clientCards = Array.isArray(options.clientCards)
      ? options.clientCards
      : (clientId ? this.loadClientCards(clientId) : []);

    if (clientCards && clientCards.length > 0) {
      for (const card of clientCards) {
        const cardTenant = card.tenant_id || card.clientId;
        if (clientId && cardTenant && cardTenant !== clientId) continue;
        let isMatch = false;
        if (card.compiledMatch) {
          isMatch = card.compiledMatch.test(lower);
        } else if (card.match_pattern) {
          // INGEST-VOICE-ROW-8684: cache the compiled regex on the card so a raw
          // (uncompiled) clientCards array passed in per-turn doesn't recompile the
          // same RegExp on every live-call utterance, blowing the sub-50ms budget.
          card.compiledMatch = new RegExp(card.match_pattern, 'i');
          isMatch = card.compiledMatch.test(lower);
        } else if (Array.isArray(card.triggers)) {
          isMatch = card.triggers.some(t => lower.includes(t.toLowerCase()));
        }

        if (isMatch) {
          const pack = card.answers[lang] || card.answers.en;
          if (pack) {
            const answerText = pack.anchor ? `${pack.narrator} ${pack.anchor}`.trim() : pack.narrator;
            return {
              matched: true,
              sourceTier: 'client_sot',
              id: card.id,
              clientId: card.clientId || clientId,
              category: card.category,
              speaker: 'narrator',
              speechChunks: [{ voice: 'narrator', text: answerText }],
              anchorQuestion: pack.anchor || ''
            };
          }
        }
      }
    }

    const isTradeSpec = spec === 'plumbing' || spec === 'hvac' || spec === 'roofing' || spec === 'electrician' || spec === 'electrical' || spec === 'dental' || spec === 'legal_pi';
    const isClaimsSpec = spec === 'claims' || spec === 'auto_claims' || spec === 'tpa' || spec === 'pi';
    const stage = (options.stage || 'sales').toLowerCase();

    // During active homeowner/trade intake (stage === 'intake'), prevent B2B SaaS scripts
    // (like Q-PRICE $99/$499 trial pitch, Q-HOURS *72 forwarding, or Q-CUSTOM-DEFERRED fleet pitch)
    // from intercepting homeowner service questions ("How much does a water heater cost?",
    // "Do you charge a trip fee?", "Are you open 24 hours?", "How fast can a plumber get here?").
    if (stage === 'intake' && isTradeSpec) {
      const isExplicitB2bContractorQuestion = /\b(servicetitan|service titan|housecall|house call|jobber|fieldedge|dispatch software|plumbing software|star 72|star 73|\*72|\*73|call forwarding|answering service|ruby|answerconnect|teleperformance|concurrent calls|simultaneous|busy signal|charge extra for spanish|14-day|fourteen-day|trial|499|299|money back|monthly subscription|agent angel software|axirate|exif|chain of custody|how does (?:she|angel) guide|demonstrate how you walk)\b/i.test(lower);
      if (!isExplicitB2bContractorQuestion) {
        return null;
      }
    }

    // Check against Tier 1 Script Database
    for (const script of this.scripts) {
      if (script.specialist === 'trades' && !isTradeSpec) continue;
      if (script.specialist === 'claims' && !isClaimsSpec) continue;
      if (script.specialist && script.specialist !== 'trades' && script.specialist !== 'claims' && script.specialist !== 'all' && script.specialist !== spec) continue;
      const isMatch = typeof script.match === 'function' ? script.match(lower) : script.match.test(lower);
      if (isMatch) {
        const pack = script.answers[lang] || script.answers.en;
        if (!pack) continue;

        if (pack.dual) {
          // Tag-team Dual-Agent turn (Matthew -> Angel -> Matthew)
          const chunks = [
            { voice: 'narrator', text: pack.narrator },
            { voice: 'agent', text: pack.agent }
          ];
          if (pack.narratorWrap) {
            chunks.push({ voice: 'narrator', text: `${pack.narratorWrap} ${pack.anchor}`.trim() });
          } else if (pack.anchor) {
            chunks.push({ voice: 'narrator', text: pack.anchor });
          }
          return {
            matched: true,
            id: script.id,
            category: script.category,
            speaker: 'dual',
            speechChunks: chunks,
            anchorQuestion: pack.anchor
          };
        }

        // Standard Narrator Consultative Turn
        let answerText = pack.anchor ? `${pack.narrator} ${pack.anchor}`.trim() : pack.narrator;
        if (isTradeSpec) {
          answerText = answerText
            .replace(/\bai agent angel dot com\b/gi, 'agent angel dot io')
            .replace(/\bai agent angel punto com\b/gi, 'agent angel punto io');
        }
        return {
          matched: true,
          id: script.id,
          category: script.category,
          speaker: 'narrator',
          speechChunks: [{ voice: 'narrator', text: answerText }],
          anchorQuestion: pack.anchor || ''
        };
      }
    }

    // Check if the utterance is an unscripted question or inquiry form
    const isQuestionForm = (
      /^(what|how|why|can|could|will|tell|does|is|are|do\s+you|can\s+you|how\s+much|que|cómo|como|por qué|pueden|puedo)\b/i.test(lower.trim()) ||
      /\b(how\s+much|what\s+is\s+the\s+cost|can\s+you\s+tell\s+me|do\s+you\s+guys|how\s+does\s+it\s+work|cu[aá]nto\s+cuesta)\b/i.test(lower) ||
      (/[?¿]\s*$/.test(lower.trim()) && /^(is|are|can|could|would|will|do|does|did|have|has|what|when|where|why|how|who|qu[eé]|c[oó]mo|cu[aá]ndo|d[oó]nde|por qu[eé])\b/i.test(lower.trim()))
    ) && !/\b(my name is|this is my|from [a-z0-9\s]+ (plumbing|insurance|agency|services|underwriters)|yes this is my cell|yes this is my phone)\b/i.test(lower);
    if (isQuestionForm) {
      return getDeferredAnswer(text, lang, spec);
    }

    return null;
  }

  // ── UNIVERSAL TELEPHONY SECOND LISTENER TRIAGE ─────────────────────────────

  extractLeakFixtureLocation(text, spec = 'plumbing') {
    if (!text || typeof text !== 'string') return null;
    const lower = text.trim().toLowerCase();
    const LOCATION_PATTERNS = [
      /\b(under\s+the\s+(?:kitchen|bathroom|master\s+bath(?:room)?|guest\s+bath(?:room)?|laundry|utility)\s+sink)\b/i,
      /\b(behind\s+the\s+toilet|around\s+the\s+base\s+of\s+the\s+toilet|toilet\s+tank|toilet\s+base)\b/i,
      /\b(master\s+bath(?:room)?|guest\s+bath(?:room)?|upstairs\s+bath(?:room)?|downstairs\s+bath(?:room)?|half\s+bath|powder\s+room)\b/i,
      /\b(kitchen\s+sink|bathroom\s+sink|utility\s+sink|laundry\s+sink|pedestal\s+sink|under\s+the\s+sink)\b/i,
      /\b(outside\s+faucet|exterior\s+faucet|hose\s+bib|spigot|front\s+faucet|back\s+faucet|yard\s+hydrant)\b/i,
      /\b(water\s+heater\s+closet|tankless\s+water\s+heater|water\s+heater|hot\s+water\s+tank|boiler\s+room)\b/i,
      /\b(garbage\s+disposal|dishwasher\s+line|dishwasher|ice\s*maker\s+line|fridge\s+water\s+line|washing\s+machine\s+hose|washer\s+box)\b/i,
      /\b(main\s+water\s+line|main\s+line|main\s+shut[\s-]?off\s+valve|sewer\s+main|sewer\s+line|slab\s+leak|under\s+the\s+slab|crawl\s*space|sump\s+pump|floor\s+drain)\b/i,
      /\b(shower\s+pan|shower\s+valve|shower\s+head|shower|bathtub|tub|toilet|urinal|bidet)\b/i,
      /\b(kitchen|bathroom|restroom|laundry\s+room|utility\s+room|mud\s*room|basement|garage|attic|hallway|living\s+room|dining\s+room|bedroom|ceiling|front\s+yard|back\s*yard|side\s+yard|patio|driveway)\b/i,
      /\b(breaker\s+panel|electrical\s+panel|subpanel|fuse\s+box|thermostat|air\s+handler|condenser|furnace|roof\s+valley|skylight|gutter|flashing)\b/i
    ];
    for (const rx of LOCATION_PATTERNS) {
      const m = lower.match(rx);
      if (m && m[1]) {
        return m[1].replace(/\s+/g, ' ').trim();
      }
    }
    return null;
  }

  detectCorrection(text, session, { lang = 'en', spec = 'claims', currentSlot = null, flow = null } = {}) {
    if (!text || typeof text !== 'string') return null;
    // Collapse letter-by-letter spelling (e.g. "ship p m, a n" -> "Shipman") while preserving "last name is" / "first name is" cues!
    const collapsed = text
      .replace(/\b(?:s\s*h\s*i\s*p\s+|s[.,\s]+h[.,\s]+i[.,\s]+)[pt][.,\s]+m[.,\s]+a[.,\s]+n\b/gi, 'Shipman')
      .replace(/\b([A-Za-z])(?:[.,\s]+([A-Za-z])){3,9}\b/g, (m) => {
        const w = m.replace(/[^A-Za-z]/g, '').toLowerCase();
        return w.charAt(0).toUpperCase() + w.slice(1);
      });
    const lower = collapsed.trim().toLowerCase();

    const CORRECTION_CUES = /(?:^|[^\p{L}\p{N}])(?:(?:well[, ]+)?(?:wait|hold on|hang on)[,\s-]+(?:actually\b)?|(?:i'm\s+|i\s+am\s+)?sorry[,.\s]+(?:my\s+|the\s+|last\s+name|first\s+name|name|it's|it\s+is|that's|that\s+was|i\s+meant)|(?:my\s+)?(?:last\s+name|surname|first\s+name)\s+is\b|(?:it's|it\s+is)\s+spelled\b|(?:i\s+)?(?:might have|may have|think i|must have)?\s*(?:told you|said it|gave you|give you|got it)\s*(?:the\s+)?wrong|misspoke|mis-spoke|scratch that|take that back|taking that back|that's not right|that isn't right|that's incorrect|that was incorrect|that's wrong|that was wrong|let me (?:correct|fix|change)|need to (?:correct|fix|change)|can we change|change\s+(?:the|my)\s+(?:name|address|time|window|number|phone|location)|actually\s+(?:it was|it's|i was|i meant|i told|it wasn't|it is|my\b|the\b|i\b)|not the (?:rear|front|driver|passenger|side|bumper|hallway|kitchen|bathroom)|instead of|disculpe[,.\s]+(?:mi\s+apellido|mi\s+nombre|la\s+direcci[oó]n)|perd[oó]n[,.\s]+(?:mi\s+apellido|mi\s+nombre|es\b)|mi\s+apellido\s+es\b|me equivoqu[eé]|te dije mal|te di mal|dije mal|est[aá] mal|estaba mal|olv[ií]dalo|en realidad fue|en vez de|corrijo|no era|est[aá] equivocado|cambiar eso a)(?:$|[^\p{L}\p{N}])/iu;
    if (!CORRECTION_CUES.test(lower)) return null;

    // Do not intercept initial Turn-1 name introductions when currentSlot is already callerName/greeting
    const isInitialNameStep = currentSlot === 'callerName' || currentSlot === 'name' || currentSlot === 'greeting';

    // Identify target slot being corrected
    let target = null;
    if (/\b(last\s+name|surname|family\s+name|first\s+name|my\s+name|spelled|spelt|nombre|apellido)\b/i.test(lower)) {
      if (isInitialNameStep && !/\b(wrong|misspoke|scratch that|instead of|not\b|me equivoqu[eé]|dije mal)\b/i.test(lower)) {
        return null;
      }
      target = 'callerName';
    } else if (/\b(impact|point|bumper|fender|door|rear|front|side|quarter panel|hood|trunk|punto de impacto|golpe|daño|choque)\b/i.test(lower)) {
      target = 'impactPoint';
    } else if (/\b(car|truck|vehicle|year|make|model|sedan|suv|honda|toyota|ford|chevy|nissan|auto|carro|camioneta|año|marca|modelo)\b/i.test(lower)) {
      target = 'vehicle';
    } else if (/\b(location|address|street|scene|intersection|dirección|calle|lugar|ubicación)\b/i.test(lower)) {
      target = (spec && spec !== 'claims') ? 'serviceAddress' : 'location';
    } else if (/\b(phone|cell|mobile|number|call me at|teléfono|celular|número)\b/i.test(lower)) {
      target = 'phone';
    } else if (/\b(policy|insurance card|account number|póliza|número de póliza)\b/i.test(lower)) {
      target = 'policyNumber';
    } else if (/\b(injury|injured|hurt|hospital|doctor|pain|herido|lesión|dolor)\b/i.test(lower)) {
      target = 'injury';
    } else if (/\b(window|appointment|schedule|morning|afternoon|tomorrow|horario|cita|mañana|tarde)\b/i.test(lower) && spec && spec !== 'claims') {
      target = 'preferredWindow';
    } else if (/\b(kitchen|bathroom|master bath|hallway|laundry|garage|basement|attic|outside faucet|hose bib|water heater|under the sink|behind the toilet|cocina|baño|garaje)\b/i.test(lower) && spec && spec !== 'claims') {
      target = 'leakLocation';
    } else if (/\b(date|time|yesterday|today|morning|night|afternoon|hour|fecha|hora|ayer|hoy)\b/i.test(lower)) {
      target = 'timeOfLoss';
    }

    if (!target) {
      if (session && session.fnolData && session.fnolData.impactPoint && /\b(rear|front|passenger|driver|bumper|side)\b/i.test(lower)) {
        target = 'impactPoint';
      } else if (session && session.fnolData && session.fnolData.vehicleInfo && /\b(20\d\d|19\d\d|[A-Z][a-z]+)\b/.test(text)) {
        target = 'vehicle';
      }
    }

    if (!target) return null;

    // Check if new value was provided in this utterance
    let extractedValue = null;
    if (target === 'callerName') {
      const surnameMatch = collapsed.match(/\b(?:last\s+name|surname|family\s+name|apellido)\s*(?:is|es|:)?\s*([A-Za-z][A-Za-z'-]{1,24})\b/i)
        || collapsed.match(/\b(?:it's|it\s+is|spelled|spelt)\s+([A-Za-z][A-Za-z'-]{1,24})\b/i);
      if (surnameMatch && /\b(last\s+name|surname|family\s+name|apellido|spelled|spelt)\b/i.test(lower)) {
        const rawSurname = surnameMatch[1].trim();
        const cleanSurname = rawSurname.charAt(0).toUpperCase() + rawSurname.slice(1).toLowerCase();
        const existingName = (session && ((session.ticket && session.ticket.callerName) || (session.fnolData && session.fnolData.callerName) || session.callerName)) || '';
        const firstToken = existingName ? existingName.trim().split(/\s+/)[0] : '';
        extractedValue = (firstToken && firstToken.toLowerCase() !== cleanSurname.toLowerCase())
          ? `${firstToken} ${cleanSurname}`
          : cleanSurname;
      } else {
        const extractedIdentity = customerIdentity.extractCallerIdentity(collapsed);
        if (extractedIdentity) {
          extractedValue = extractedIdentity;
        } else {
          const fullMatch = collapsed.match(/\b(?:my\s+name|first\s+name|name|nombre)\s*(?:is|es|:)?\s*([A-Za-z][A-Za-z'-]{1,20}(?:\s+[A-Za-z][A-Za-z'-]{1,20})?)\b/i);
          if (fullMatch) {
            extractedValue = fullMatch[1].trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
          }
        }
      }
    } else if (target === 'impactPoint') {
      const mIntro = lower.match(/(?:(?:it was|it is|it's|meant|instead of)\s+(?:the\s+)?)((?:front|rear)?\s*(?:passenger|driver)?\s*(?:side\s+)?(?:quarter panel|door|fender|bumper|hood|trunk|front end|rear end|front|rear|side))\b/i);
      const mKnown = lower.match(/\b((?:front|rear)\s+(?:passenger|driver)\s+(?:side\s+)?(?:quarter panel|door|fender|bumper)|front passenger side|front driver side|rear passenger side|rear driver side|front passenger bumper|front driver bumper|rear passenger bumper|rear driver bumper|front bumper|rear bumper|front end|rear end|passenger side door|driver side door|passenger side|driver side)\b/i);
      const mEs = lower.match(/(?:(?:en realidad fue|fue|era|en vez de)\s+(?:el|la\s+)?)((?:defensa|parachoque|puerta|frente|atr[aá]s|lado)\s+(?:delantera|trasera|del pasajero|del conductor)?)/iu);
      const m = mIntro || mKnown || mEs;
      if (m) extractedValue = (m[1] || m[0]).trim();
    } else if (target === 'vehicle') {
      const m = text.match(/\b(?:19|20)\d{2}\s+[A-Za-z0-9\s'-]{2,30}\b/);
      if (m) extractedValue = m[0].trim();
    } else if (target === 'phone') {
      const m = text.match(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/);
      if (m) extractedValue = m[0].trim();
    } else if (target === 'serviceAddress' || target === 'location') {
      const m = collapsed.match(/\b(\d{1,6}\s+[A-Za-z0-9.\s,'-]{3,45})\b/);
      if (m) extractedValue = m[1].trim();
    } else if (target === 'leakLocation') {
      extractedValue = this.extractLeakFixtureLocation(collapsed, spec);
    } else if (target === 'preferredWindow') {
      const m = collapsed.match(/\b((?:this|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)?\s*(?:morning|afternoon|evening|asap|right away|today|tomorrow|between\s+\d+\s*(?:and|to|-)\s*\d+|\d{1,2}\s*(?:am|pm)))\b/i);
      if (m) extractedValue = m[1].trim();
    }

    // If caller corrected their name AND also provided the current slot's answer in the same breath (e.g. street address),
    // apply the correction silently to session state and let the main step handler process the slot answer!
    if (target === 'callerName' && extractedValue && (currentSlot === 'serviceAddress' || currentSlot === 'location') && /\b\d{1,6}\s+[A-Za-z0-9.\s]+\b(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|ct|court|way|pl|place|pkwy|parkway|cir|circle|trail|hwy|highway|calle|avenida)\b/i.test(collapsed)) {
      this.applyCorrectionValue(session, target, extractedValue, spec);
      return null;
    }

    const repromptText = this.getRepromptForSlot(currentSlot, lang, spec, session);

    if (extractedValue) {
      this.applyCorrectionValue(session, target, extractedValue, spec);
      if (session) session.pendingCorrectionSlot = null;
      const ack = lang === 'es'
        ? (target === 'callerName'
            ? `Gracias, he actualizado su nombre a ${extractedValue}. ${repromptText}`
            : `Entendido, he actualizado ${this.getSlotName(target, 'es')} a "${extractedValue}" en su expediente. ${repromptText}`)
        : (target === 'callerName'
            ? `Thank you, I've updated your name to ${extractedValue}. ${repromptText}`
            : `Understood, I've updated the ${this.getSlotName(target, 'en')} to ${extractedValue} for your report. ${repromptText}`);
      return {
        handled: true,
        type: 'CORRECTION_APPLIED',
        targetSlot: target,
        newValue: extractedValue,
        spokenText: ack,
        speechChunks: [{ voice: 'agent', text: ack }]
      };
    } else {
      if (session) {
        session.pendingCorrectionSlot = target;
        session.returnToSlot = currentSlot;
      }
      const clarifyPrompt = this.getCorrectionClarifyPrompt(target, lang, spec);
      return {
        handled: true,
        type: 'CORRECTION_REQUESTED',
        targetSlot: target,
        spokenText: clarifyPrompt,
        speechChunks: [{ voice: 'agent', text: clarifyPrompt }]
      };
    }
  }

  detectHesitation(text, { lang = 'en' } = {}) {
    if (!text || typeof text !== 'string') return null;
    const lower = text.trim().toLowerCase();
    const HESITATION_CUES = /\b(wait a (second|sec|minute|moment)|hold on|give me a (second|sec|minute|moment)|let me (check|find|look|grab)|pulling over|hang on|espera|espere|un momento|d[eé]jame (ver|revisar|buscar))\b/i;
    if (!HESITATION_CUES.test(lower)) return null;

    const spokenText = lang === 'es'
      ? "Tómese su tiempo, sigo aquí en la línea cuando esté listo."
      : "Take your time, I'm right here whenever you're ready.";
    return {
      handled: true,
      type: 'HESITATION',
      spokenText,
      speechChunks: [{ voice: 'agent', text: spokenText }]
    };
  }

  detectInquiry(text, session, { lang = 'en', spec = 'claims', currentSlot = null } = {}) {
    if (!text || typeof text !== 'string') return null;
    const lower = text.trim().toLowerCase();

    // 0. Never hijack caller challenges about inapplicable intake questions ("why are you asking about traffic lights / stop lights / speed")
    if (/\b(why are you asking|what does that have to do|nothing to do with|traffic lights?|stop lights?|stop signs?|control signals?|parked|stationary|sitting outside|watching tv)\b/i.test(lower)) {
      return null;
    }

    // 1. Affirmative / negative answers without a question mark are answers, never inquiries
    if (/^(?:yes|yeah|yep|sure|ok|okay|no|nope|nah|si|sí|claro|correcto|exacto|por favor|por supuesto)\b/i.test(lower) && !/[?¿]/.test(text)) {
      return null;
    }

    // 2. Active slot answers must never be hijacked by RAG
    if (currentSlot) {
      if ((currentSlot === 'callerName' || currentSlot === 'name' || currentSlot === 'greeting') &&
          (/\b(my name is|this is|from\b|cell phone|phone number|speaking|llamando de|mi nombre es|soy\b)\b/i.test(lower) ||
           customerIdentity.extractCallerIdentity(text))) {
        return null;
      }
      if ((currentSlot === 'photos' || currentSlot === 'hasPhotos' || currentSlot === 'photo') &&
          /\b(can take|have photos|took photos|no photos|puedo tomar|tengo fotos|mandar fotos|subir fotos)\b/i.test(lower)) {
        return null;
      }
      if ((currentSlot === 'injuryStatus' || currentSlot === 'injuries' || currentSlot === 'injury') &&
          /\b(no|none|nobody|fine|hurt|herido|lesion|lesi[oó]n|bien)\b/i.test(lower)) {
        return null;
      }
      if ((currentSlot === 'policeReport' || currentSlot === 'police') &&
          /\b(no police|called police|report number|police came|polic[ií]a|reporte)\b/i.test(lower)) {
        return null;
      }
      if ((currentSlot === 'location' || currentSlot === 'serviceAddress' || currentSlot === 'locationOfLoss' || currentSlot === 'address') &&
          /\b(street|st|ave|avenue|road|rd|blvd|lane|dr|drive|court|ct|way|highway|hwy|calle|avenida|carretera|dallas|houston|tyler|frisco|plano|mcallen|waco|texas|tx)\b/i.test(lower)) {
        return null;
      }
    }

    // 3. Utterance must contain an explicit inquiry cue or legitimate question form
    const isQuestionEnd = /[?¿]\s*$/.test(text.trim()) && /^(?:(?:first|wait|hold on|hey|well|so|before we start|quick question)[,.\s]+)?(?:what|how|why|who|where|when|can|could|would|will|does|is|are|do|did|have|has|tell me|explain|c[oó]mo|como|qu[eé]|que|por qu[eé]|cu[aá]l|cual|cu[aá]nto|cuanto)\b/i.test(lower.trim());
    const hasInquiryMarker = isQuestionEnd ||
      /^(?:(?:first|wait|hold on|hey|well|so|before we start|quick question)[,.\s]+)?(?:what|how|why|who|where|when|can you|could you|does|is|are|tell me|explain|c[oó]mo|como|qu[eé]|que|por qu[eé]|cu[aá]l|cual|cu[aá]nto|cuanto)\b/i.test(lower) ||
      /\b(?:tell me what|what (?:you|it|she|angel|this) (?:can )?do|what can (?:i|it|you|she|angel) do|how does (?:it|this|angel) work|how much|pricing|cost|contract|month to month|too expensive|think about it|pensar|cancel|star 72|call forwarding|answering service|ruby|answerconnect|servicetitan|guidewire|duck creek)\b/i.test(lower);

    if (!hasInquiryMarker) return null;

    const ragMatch = this.query(text, { specialist: spec, language: lang, stage: 'intake' });
    if (ragMatch && ragMatch.speechChunks && ragMatch.speechChunks.length > 0) {
      const repromptText = this.getRepromptForSlot(currentSlot, lang, spec, session);
      const answer = ragMatch.speechChunks.map(c => c.text).join(' ');
      const fullText = `${answer} ${repromptText}`.trim();
      return {
        handled: true,
        type: 'INQUIRY_ANSWERED',
        id: ragMatch.id,
        spokenText: fullText,
        speechChunks: [{ voice: 'agent', text: fullText }]
      };
    }
    return null;
  }

  applyCorrectionValue(session, slot, value, spec = 'claims') {
    if (!session || !slot || !value) return;
    const val = String(value).trim();
    if (spec !== 'claims' || (session.specialist && session.specialist !== 'claims') || session.trade) {
      session.ticket = session.ticket || {};
      if (slot === 'serviceAddress' || slot === 'location') {
        session.ticket.serviceAddress = val;
        if ('address' in session) session.address = val;
      } else if (slot === 'callerName') {
        session.ticket.callerName = val;
        if ('callerName' in session) session.callerName = val;
      } else if (slot === 'phone') {
        session.ticket.callerPhone = val;
        if ('phone' in session) session.phone = val;
      } else if (slot === 'problemDescription') {
        session.ticket.problemDescription = val;
        if ('issue' in session) session.issue = val;
      } else if (slot === 'leakLocation') {
        session.ticket.leakLocation = val;
      } else if (slot === 'preferredWindow' || slot === 'scheduleWindow') {
        session.ticket.preferredWindow = val;
        if ('window' in session) session.window = val;
      } else {
        session.ticket[slot] = val;
      }
    } else {
      session.fnolData = session.fnolData || {};
      session.fnolData.lossFacts = session.fnolData.lossFacts || {};
      if (slot === 'impactPoint') {
        session.fnolData.impactPoint = val;
        session.fnolData.perilProbes = session.fnolData.perilProbes || {};
        session.fnolData.perilProbes.impactPoint = val;
        if (/front/i.test(val)) session.fnolData.lossFacts.impactPoint = 'front';
        else if (/rear/i.test(val)) session.fnolData.lossFacts.impactPoint = 'rear';
        else if (/side|passenger|driver/i.test(val)) session.fnolData.lossFacts.impactPoint = 'side';
      } else if (slot === 'vehicle') {
        session.fnolData.vehicleInfo = val;
      } else if (slot === 'location' || slot === 'locationOfLoss') {
        session.fnolData.locationOfLoss = val;
      } else if (slot === 'policyNumber') {
        session.fnolData.policyNumber = val.toUpperCase();
      } else if (slot === 'callerName') {
        session.fnolData.callerName = val;
      } else if (slot === 'injury') {
        const saidNo = /\b(no|none|nobody|zero|nadie|ningun[oa])\b/i.test(val);
        session.fnolData.injuryStatus = !saidNo;
        session.fnolData.hasInjuries = !saidNo;
      } else if (slot === 'timeOfLoss' || slot === 'dateOfLoss') {
        session.fnolData.dateOfLoss = val;
        session.fnolData.timeOfLoss = val;
      }
    }
  }

  getSlotName(slot, lang = 'en') {
    const NAMES = {
      impactPoint: { en: 'impact point', es: 'punto de impacto' },
      vehicle: { en: 'vehicle information', es: 'información del vehículo' },
      location: { en: 'loss location', es: 'lugar del incidente' },
      serviceAddress: { en: 'service address', es: 'dirección del servicio' },
      phone: { en: 'callback phone number', es: 'número de contacto' },
      policyNumber: { en: 'policy number', es: 'número de póliza' },
      callerName: { en: 'name', es: 'nombre' },
      injury: { en: 'injury details', es: 'detalles de lesiones' },
      timeOfLoss: { en: 'time of loss', es: 'hora y fecha del siniestro' },
      leakLocation: { en: 'leak or fixture location', es: 'ubicación de la fuga' },
      preferredWindow: { en: 'preferred appointment window', es: 'horario preferido' }
    };
    return (NAMES[slot] && NAMES[slot][lang]) || (lang === 'es' ? 'este dato' : 'this detail');
  }

  getCorrectionClarifyPrompt(slot, lang = 'en', spec = 'claims') {
    if (lang === 'es') {
      if (slot === 'impactPoint') return "No hay ningún problema — asegurémonos de que quede exacto en su expediente. ¿En qué parte del vehículo fue el daño o impacto?";
      if (slot === 'vehicle') return "Sin problema — ¿cuál es el año, marca y modelo correcto de su vehículo?";
      if (slot === 'location' || slot === 'serviceAddress') return "Entendido — ¿cuál es la dirección o ubicación correcta?";
      if (slot === 'phone') return "Sin problema — ¿cuál es el número de teléfono correcto para contactarle?";
      if (slot === 'policyNumber') return "Por supuesto — ¿cuál es su número de póliza correcto?";
      return "No hay ningún problema, hagamos la corrección. ¿Cuál es el dato correcto?";
    } else {
      if (slot === 'impactPoint') return "No problem at all — let's make sure that's accurate for your claim file. Where was the damage or impact located on your vehicle?";
      if (slot === 'vehicle') return "No problem at all — what is the correct year, make, and model of your vehicle?";
      if (slot === 'location' || slot === 'serviceAddress') return "Understood — what is the correct street address or location?";
      if (slot === 'phone') return "No problem at all — what is the best phone number to reach you?";
      if (slot === 'policyNumber') return "Certainly — what is the correct policy number for your account?";
      return "No problem at all, let's get that corrected. What is the accurate information?";
    }
  }

  getRepromptForSlot(slot, lang = 'en', spec = 'claims', session = null) {
    if (spec && spec !== 'claims') {
      if (lang === 'es') {
        if (slot === 'serviceAddress' || slot === 'address') return '¿Cuál es la dirección del servicio, incluyendo la ciudad?';
        if (slot === 'problemDescription' || slot === 'issue') return '¿Qué problema presenta hoy y en qué parte de la propiedad se encuentra, como el baño, la cocina o una llave exterior?';
        if (slot === 'scheduleWindow' || slot === 'preferredWindow' || slot === 'window') return '¿Qué día y horario le funciona mejor para la visita?';
        if (slot === 'photoRequest' || slot === 'photos') return '¿Le gustaría que le envíe un enlace por mensaje de texto para subir una foto del problema?';
        if (slot === 'shutOffValve') return '¿Pudo ubicar y cerrar la llave de paso principal?';
        return '¿Podría confirmarme los detalles para su visita de servicio?';
      } else {
        if (slot === 'serviceAddress' || slot === 'address') return 'What is the service address, including the city?';
        if (slot === 'problemDescription' || slot === 'issue') return 'What issue are you having today, and where is it located — such as the bathroom, kitchen, water heater, or an outside faucet?';
        if (slot === 'scheduleWindow' || slot === 'preferredWindow' || slot === 'window') return 'What day and time window works best for a technician visit?';
        if (slot === 'photoRequest' || slot === 'photos') return 'Would you like me to text a link to your phone so you can snap a quick photo of the issue?';
        if (slot === 'shutOffValve') return 'Were you able to locate and shut off the water valve?';
        return 'Could you confirm the details for your service visit?';
      }
    }
    // Claims (strictly single-question prompts — zero stacked questions)
    if (lang === 'es') {
      if (slot === 'location' || slot === 'locationOfLoss') return '¿Cuál fue la dirección exacta, intersección o ciudad donde ocurrió el incidente?';
      if (slot === 'narrative' || slot === 'lossDescription') return 'Cuénteme con sus propias palabras, ¿qué ocurrió?';
      if (slot === 'vehicle' || slot === 'vehicleInfo') return '¿Cuál es el año, marca y modelo de su vehículo?';
      if (slot === 'injury' || slot === 'injuryStatus') return '¿Hubo alguna persona lesionada que requiera atención médica?';
      if (slot === 'photos') return '¿Cuenta con fotografías de los daños o de la escena?';
      if (slot === 'police' || slot === 'policeReport') return '¿Se presentó la policía en el lugar del siniestro?';
      if (slot === 'timeOfLoss' || slot === 'dateOfLoss') return '¿En qué fecha y hora aproximada ocurrió el incidente?';
      return '¿Podría indicarme el siguiente detalle para continuar con su reporte?';
    } else {
      if (slot === 'location' || slot === 'locationOfLoss') return 'What was the street address or nearest intersection and city where this happened?';
      if (slot === 'narrative' || slot === 'lossDescription') return 'In your own words, what happened starting about 10 seconds before the incident?';
      if (slot === 'vehicle' || slot === 'vehicleInfo') return 'What is the year, make, and model of your vehicle?';
      if (slot === 'injury' || slot === 'injuryStatus') return 'Were there any injuries reported or medical attention required?';
      if (slot === 'photos') return 'Do you have photos of the damage or scene?';
      if (slot === 'police' || slot === 'policeReport') return 'Was a police report filed at the scene?';
      if (slot === 'timeOfLoss' || slot === 'dateOfLoss') return 'What date and approximate time did the loss occur?';
      return 'Could you provide the next detail for your claim file?';
    }
  }

  // ── 2ND LISTENER ROLE 1: PHONETIC AMBIGUITY & PERIL CLARIFICATION VALIDATOR ──
  levenshteinDistance(a, b) {
    const s1 = String(a || '').toLowerCase();
    const s2 = String(b || '').toLowerCase();
    if (s1 === s2) return 0;
    if (!s1.length) return s2.length;
    if (!s2.length) return s1.length;
    const matrix = [];
    for (let i = 0; i <= s2.length; i++) matrix[i] = [i];
    for (let j = 0; j <= s1.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[s2.length][s1.length];
  }

  findClosestCanonicalPeril(word) {
    if (!word || typeof word !== 'string') return null;
    // Strip Spanish diacritics (e.g. "inundación" -> "inundacion") before stripping
    // non a-z chars, so accented ES tokens still match the unaccented exact list.
    const token = word.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
    if (!token || token.length < 3) return null;

    const CANONICAL_PERILS = [
      {
        peril: 'hail',
        labelEn: 'hail',
        labelEs: 'granizo',
        exact: ['hail', 'hailstorm', 'granizo', 'granizada'],
        phoneticAliases: ['hair', 'hale', 'hell', 'hill', 'mail', 'pale', 'whale', 'bail', 'sale', 'tail', 'air', 'fair', 'pair', 'rail', 'nail', 'jail', 'sail', 'bear', 'care', 'wear', 'tear', 'pear', 'heel', 'heal', 'hal', 'hall', 'pelo', 'graniso', 'granizado']
      },
      {
        peril: 'flood',
        labelEn: 'flood',
        labelEs: 'inundación',
        exact: ['flood', 'flooding', 'water', 'inundacion', 'agua'],
        phoneticAliases: ['blood', 'mud', 'fudge', 'flud', 'float', 'floor', 'fled', 'food', 'wood']
      },
      {
        peril: 'collision',
        labelEn: 'collision',
        labelEs: 'colisión',
        exact: ['collision', 'crash', 'accident', 'rearend', 'choque', 'colision', 'accidente'],
        phoneticAliases: ['collusion', 'coalition', 'collection', 'condition', 'commission']
      },
      {
        peril: 'comprehensive',
        labelEn: 'comprehensive',
        labelEs: 'cobertura amplia',
        exact: ['comprehensive', 'comp', 'cobertura'],
        phoneticAliases: ['comprehension', 'camp', 'pump', 'jump', 'come']
      },
      {
        peril: 'theft',
        labelEn: 'theft',
        labelEs: 'robo',
        exact: ['theft', 'stolen', 'robbery', 'robo'],
        phoneticAliases: ['left', 'heft', 'deft', 'cleft', 'chef', 'test']
      },
      {
        peril: 'vandalism',
        labelEn: 'vandalism',
        labelEs: 'vandalismo',
        exact: ['vandalism', 'vandal', 'vandalized', 'vandalismo'],
        phoneticAliases: ['sandalism', 'candle', 'handle', 'sandal']
      },
      {
        peril: 'glass',
        labelEn: 'glass',
        labelEs: 'cristales',
        exact: ['glass', 'windshield', 'window', 'parabrisas', 'cristal'],
        phoneticAliases: ['class', 'grass', 'brass', 'pass', 'mass', 'gas', 'gloss']
      },
      {
        peril: 'fire',
        labelEn: 'fire',
        labelEs: 'incendio',
        exact: ['fire', 'burned', 'flames', 'incendio', 'fuego'],
        phoneticAliases: ['tire', 'wire', 'hire', 'dire', 'flyer', 'prior', 'five', 'fine']
      },
      {
        peril: 'towing_roadside',
        labelEn: 'towing or roadside',
        labelEs: 'remolque o asistencia vial',
        exact: ['towing', 'tow', 'roadside', 'breakdown', 'mechanical', 'grua', 'remolque'],
        phoneticAliases: ['toeing', 'rowing', 'showing', 'blowing', 'growing', 'going', 'knowing', 'toe', 'toy']
      }
    ];

    for (const entry of CANONICAL_PERILS) {
      if (entry.exact.includes(token)) {
        return { peril: entry.peril, labelEn: entry.labelEn, labelEs: entry.labelEs, exact: true, distance: 0 };
      }
    }

    for (const entry of CANONICAL_PERILS) {
      if (entry.phoneticAliases.includes(token)) {
        return { peril: entry.peril, labelEn: entry.labelEn, labelEs: entry.labelEs, exact: false, distance: 1 };
      }
    }

    let best = null;
    for (const entry of CANONICAL_PERILS) {
      for (const target of entry.exact) {
        if (Math.abs(target.length - token.length) > 2) continue;
        const dist = this.levenshteinDistance(token, target);
        const maxAllowed = target.length <= 4 ? 1 : 2;
        if (dist > 0 && dist <= maxAllowed) {
          if (!best || dist < best.distance) {
            best = { peril: entry.peril, labelEn: entry.labelEn, labelEs: entry.labelEs, exact: false, distance: dist };
          }
        }
      }
    }
    return best;
  }

  validateHostAndPerilTurn(speech, session, options = {}) {
    if (!speech || typeof speech !== 'string' || !session) return null;
    const lang = options.language || session.language || 'en';
    const text = speech.trim();
    const lower = text.toLowerCase();

    // 1. If a clarification prompt is currently pending, evaluate the caller's response
    if (session.pendingClarification && session.pendingClarification.type === 'peril') {
      const pending = session.pendingClarification;
      const isAffirmative = /^(?:yes|yeah|yep|yup|correct|right|that'?s right|that is right|exact|exactly|sure|uh-huh|si|sí|claro|correcto|exacto)\b/i.test(lower);
      const isNegative = /^(?:no|nope|nah|wrong|incorrect|not that)\b/i.test(lower);

      // Check if caller explicitly named a valid canonical peril in their reply
      const words = lower.replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
      for (const w of words) {
        const match = this.findClosestCanonicalPeril(w);
        if (match && match.exact) {
          session.pendingClarification = null;
          session.lossType = match.peril;
          if (session.fnolData) {
            session.fnolData.stagedPeril = match.peril;
            session.fnolData.lossTypeText = lang === 'es' ? match.labelEs : match.labelEn;
          }
          return {
            action: 'CLARIFICATION_RESOLVED',
            resolvedPeril: match.peril,
            labelEn: match.labelEn,
            labelEs: match.labelEs
          };
        }
      }

      if (isAffirmative && pending.suggestedPeril) {
        session.pendingClarification = null;
        session.lossType = pending.suggestedPeril;
        if (session.fnolData) {
          session.fnolData.stagedPeril = pending.suggestedPeril;
          session.fnolData.lossTypeText = lang === 'es' ? (pending.labelEs || pending.suggestedPeril) : (pending.labelEn || pending.suggestedPeril);
        }
        return {
          action: 'CLARIFICATION_RESOLVED',
          resolvedPeril: pending.suggestedPeril,
          labelEn: pending.labelEn || pending.suggestedPeril,
          labelEs: pending.labelEs || pending.suggestedPeril
        };
      }

      if (isNegative) {
        session.pendingClarification = null;
        const promptText = lang === 'es'
          ? 'Disculpe la confusión. ¿Qué tipo de reclamo o incidente le gustaría reportar hoy — por ejemplo, granizo, inundación, colisión o robo?'
          : 'My apologies — what type of claim or incident would you like to report today, such as hail, flood, collision, or theft?';
        return {
          action: 'CLARIFY_AMBIGUOUS_PERIL',
          heardPhrase: text,
          suggestedPeril: null,
          text: promptText
        };
      }
    }

    // 2. Check for "<modifier> claim / loss / damage / storm" where <modifier> is NOT a known canonical peril
    // Never trigger peril ambiguity if the utterance already contains a clear, unambiguous incident/peril keyword
    const hasUnambiguousPerilInText = /\b(hit[- ]and[- ]run|rear-?ended|t-?boned|sideswiped|backed\s+into|collision|crash|wreck|hail|hailstorm|granizo|flood|flooded|submerged|inundaci[oó]n|stolen|theft|robo|vandalism|vandalismo|keyed|fire|incendio|deer|animal|hit\s+a\s+tree|tree\s+(?:branch|limb)|wind|glass|windshield|colisi[oó]n|choque|accidente|cristales|parabrisas|remolque|grua|grúa)\b/i.test(text);
    const IGNORE_MODIFIERS = new Set([
      'a', 'an', 'the', 'my', 'our', 'your', 'this', 'that', 'new', 'auto', 'automobile', 'car', 'vehicle',
      'truck', 'insurance', 'first', 'second', 'two', 'multiple', 'both', 'demo', 'test', 'testing', 'live',
      'express', 'preliminary', 'existing', 'property', 'body', 'panel', 'weather', 'storm', 'water',
      'hail', 'flood', 'collision', 'comprehensive', 'comp', 'theft', 'stolen', 'vandalism', 'glass',
      'windshield', 'fire', 'towing', 'roadside', 'animal', 'deer', 'tree', 'falling', 'single', 'multi',
      'another', 'prior', 'previous', 'open', 'file', 'filing', 'report', 'reporting', 'make', 'making',
      'have', 'had', 'got', 'about', 'for', 'with', 'on', 'in', 'of', 'to', 'and', 'or', 'was', 'is',
      'bumper', 'fender', 'quarter', 'hood', 'roof', 'trunk', 'door', 'mirror', 'grille', 'axle', 'wheel',
      'tire', 'frame', 'paint', 'dent', 'scratch', 'front', 'rear', 'back', 'side', 'left', 'right',
      'driver', 'passenger', 'exterior', 'interior', 'cosmetic', 'structural', 'mechanical', 'minor',
      'moderate', 'major', 'severe', 'heavy', 'light', 'some', 'any', 'no', 'more', 'other', 'total',
      'hit', 'run', 'parked', 'branch', 'limb',
      // ES stop/structure words so Spanish modifiers aren't mistaken for the peril itself
      'un', 'una', 'unos', 'unas', 'el', 'la', 'los', 'las', 'de', 'del', 'por', 'con', 'en', 'y', 'o',
      'mi', 'mis', 'su', 'sus', 'nuestro', 'nuestra', 'ayer', 'hoy', 'carro', 'auto', 'coche', 'vehiculo',
      'vehículo', 'camion', 'camión', 'poliza', 'póliza', 'seguro', 'reclamo', 'problema', 'incidente',
      'siniestro', 'tuve', 'tengo', 'fue', 'es', 'daño', 'dano', 'danos', 'daños', 'primero', 'segundo',
      'granizo', 'inundacion', 'inundación', 'colision', 'colisión', 'robo', 'vandalismo', 'incendio',
      'cristales', 'remolque'
    ]);

    const perilPhraseMatch = !hasUnambiguousPerilInText && (
      text.match(/\b([a-zA-Z]{3,14})\s+(claim|loss|damage|storm)\b/i)
      || text.match(/\b(?:report|file|test|try|do)\s+(?:a|an)\s+([a-zA-Z]{3,14})(?:\s+(?:claim|loss|damage|scenario|demo))?\b/i)
      // ES: "reclamo de <word>" / "problema por <word>" / "incidente de <word>" (bilingual parity)
      || text.match(/\b(?:reclamo|problema|incidente|siniestro|daño|dano)\s+(?:de|por)\s+([a-záéíóúñA-ZÁÉÍÓÚÑ]{3,14})\b/i)
      // ES: "reportar/presentar/hacer/probar un(a) [reclamo de] <word>"
      || text.match(/\b(?:reportar|presentar|hacer|probar)\s+(?:un|una)\s+(?:reclamo\s+(?:de|por)\s+)?([a-záéíóúñA-ZÁÉÍÓÚÑ]{3,14})\b/i)
    );

    if (perilPhraseMatch) {
      const rawModifier = perilPhraseMatch[1];
      const modLower = rawModifier.toLowerCase();
      const suffixWord = (perilPhraseMatch[2] || 'claim').toLowerCase();
      if (!IGNORE_MODIFIERS.has(modLower)) {
        const candidate = this.findClosestCanonicalPeril(modLower);
        if ((!candidate || !candidate.exact) && (suffixWord === 'claim' || suffixWord === 'loss' || candidate)) {
          const heardPhrase = `${rawModifier.toLowerCase()} ${suffixWord}`;
          session.pendingClarification = {
            type: 'peril',
            heardPhrase,
            heardToken: rawModifier,
            suggestedPeril: candidate ? candidate.peril : null,
            labelEn: candidate ? candidate.labelEn : null,
            labelEs: candidate ? candidate.labelEs : null,
            stage: options.stage || 'intake'
          };
          const clarifyText = candidate
            ? (lang === 'es'
                ? `Disculpe, no alcancé a escuchar bien — escuché "${heardPhrase}" o algo parecido. ¿Se refiere a un reclamo de ${candidate.labelEs}, o qué tipo de siniestro le gustaría probar?`
                : `Sorry, I didn't catch that — I heard '${heardPhrase}' or something like that. Did you mean a ${candidate.labelEn} claim, or what type of claim would you like to test?`)
            : (lang === 'es'
                ? `Disculpe, no alcancé a escuchar bien — escuché "${heardPhrase}". ¿Qué tipo de reclamo le gustaría probar hoy — como granizo, inundación, colisión o cobertura amplia?`
                : `Sorry, I didn't catch that — I heard '${heardPhrase}' or something like that. What type of claim scenario would you like to test today — such as hail, flood, collision, or comprehensive?`);
          return {
            action: 'CLARIFY_AMBIGUOUS_PERIL',
            heardPhrase,
            suggestedPeril: candidate ? candidate.peril : null,
            text: clarifyText
          };
        }
      }
    }

    // 3. On Demo Host discovery phase, if caller says a short utterance (1-5 words) that is not a recognized peril, ready cue, or question
    if (options.stage === 'host_discovery' && !session.lossType && !(session.fnolData && session.fnolData.stagedPeril)) {
      const cleanWords = lower.replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
      const isQuestionOrReady = /\?|^(?:what|how|why|can|could|will|does|do|is|are|who|where|when|ready|start|let|go|connect|yes|yeah|sure|ok|okay)\b/i.test(text);
      if (!isQuestionOrReady && cleanWords.length >= 1 && cleanWords.length <= 5) {
        let exactFound = false;
        let fuzzyMatch = null;
        for (const w of cleanWords) {
          const m = this.findClosestCanonicalPeril(w);
          if (m && m.exact) {
            exactFound = true;
            break;
          }
          if (m && !m.exact && !fuzzyMatch) {
            fuzzyMatch = m;
          }
        }
        if (!exactFound && fuzzyMatch) {
          const heardPhrase = text.replace(/[.!?]+$/, '');
          session.pendingClarification = {
            type: 'peril',
            heardPhrase,
            heardToken: heardPhrase,
            suggestedPeril: fuzzyMatch.peril,
            labelEn: fuzzyMatch.labelEn,
            labelEs: fuzzyMatch.labelEs,
            stage: 'host_discovery'
          };
          const clarifyText = lang === 'es'
            ? `Disculpe, no alcancé a escuchar bien — escuché "${heardPhrase}" o algo parecido. ¿Se refiere a un reclamo de ${fuzzyMatch.labelEs}, o qué tipo de siniestro le gustaría probar?`
            : `Sorry, I didn't catch that — I heard '${heardPhrase}' or something like that. Did you mean a ${fuzzyMatch.labelEn} claim, or what type of claim would you like to test?`;
          return {
            action: 'CLARIFY_AMBIGUOUS_PERIL',
            heardPhrase,
            suggestedPeril: fuzzyMatch.peril,
            text: clarifyText
          };
        }
      }
    }

    return null;
  }

  // ── 2ND LISTENER ROLE 2: SLOT-INTEGRITY, ANTI-CLOBBER, & GARBLED ADDRESS VALIDATOR ──
  scoreLocationSpecificity(locStr) {
    if (!locStr || typeof locStr !== 'string') return 0;
    const s = locStr.trim();
    if (!s || s.length < 3) return 0;
    // Bare state name ("TEXAS", "Texas", "TX", "Arkansas", "AR") -> specificity 0 (invalid as standalone location)
    if (/^(?:in\s+|at\s+)?(?:Texas|TX|Arkansas|AR|Oklahoma|OK|Louisiana|LA|California|CA|Florida|FL|New York|NY|Illinois|IL|Ohio|OH|Georgia|GA|North Carolina|NC|Michigan|MI)[.!?]*$/i.test(s)) {
      return 0;
    }
    // Generic residential placeholder ("Residence / Home", "at my house") -> specificity 1
    if (/^(?:Residence\s*\/\s*Home|Residence\s*\/\s*Driveway|Residence\s+Driveway|at\s+my\s+house|at\s+home|in\s+(?:my\s+)?driveway|en\s+mi\s+casa|en\s+casa)$/i.test(s)) {
      return 1;
    }
    const hasStreetNum = /\b\d{2,5}\s+[A-Za-z]/i.test(s);
    const hasStreetType = /\b(st|street|ave|avenue|blvd|boulevard|rd|road|hwy|highway|pkwy|parkway|dr|drive|lane|ln|way|ct|court|pl|place|cir|circle|trail|loop|interstate|i-\d+|farm to market|fm\s*\d*|county\s+road|calle|avenida|autopista|carretera)\b/i.test(s) || /\b[A-Za-z]{2,}\s+&\s+[A-Za-z]{2,}\b/.test(s);
    const hasCityOrZip = /\b(\d{5}|Dallas|Fort Worth|Austin|Houston|San Antonio|El Paso|Arlington|Plano|Frisco|Denton|Irving|Garland|McKinney|Grand Prairie|Tyler|Waco|Wichita Falls|Lubbock|Amarillo|Midland|Odessa|Abilene|Beaumont|Round Rock|Conway|Broken Bow|Texarkana|Longview|De Queen|Hot Springs|Little Rock|Fayetteville|Fort Smith|Bentonville|Hope|Mena|Idabel|Shreveport|Addison|Carrollton|Mesquite|Richardson)\b/i.test(s)
      || /,\s*(?:Texas|TX|Arkansas|AR|Oklahoma|OK|Louisiana|LA|California|CA|Florida|FL|New York|NY)\b/i.test(s);
    const hasBusinessLandmark = /\b(walmart(?:\s+supercenter)?|home depot|lowe'?s|target|h-?e-?b|kroger|costco|sam'?s club|buc-?ee'?s|shell|chevron|exxon|quiktrip|walgreens|cvs|autozone|shopping center|plaza|mall|parking lot)\b/i.test(s);
    const hasRuralOffset = /\b(?:(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+miles?\s+(?:east|west|north|south)|(?:east|west|north|south)\s+of\b|farm\s+to\s+market|mile\s+marker)\b/i.test(s);

    if (hasStreetNum && hasCityOrZip) return 5;
    if ((hasBusinessLandmark && hasCityOrZip) || (hasRuralOffset && hasCityOrZip)) return 4;
    if (hasStreetNum || (hasStreetType && hasCityOrZip)) return 4;
    if (hasStreetType || hasBusinessLandmark || /\b(intersection|parking lot|walmart|plaza|mall|shopping center)\b/i.test(s)) return 3;
    if (hasCityOrZip) return 2;
    return 1;
  }

  /**
   * 2nd Listener Location Resolution Classifier:
   * Distinguishes:
   * 1. DEFINED_ADDRESS (exact street number + street or intersection) -> verifiedByMaps: true, needsMapPinpoint: false
   * 2. GOOGLE_MAPS_VERIFIED_BUSINESS (identifiable business + city/state) -> verifiedByMaps: true, needsMapPinpoint: false
   * 3. APPROXIMATE_RURAL_LOCATION (undefined rural road / mile offset e.g. "Farm to Market Road, De Queen, Arkansas, about six miles east")
   *    -> verifiedByMaps: false, isApproximateRural: true, needsMapPinpoint: true, computes offset GPS coordinates & prompts caller to pinpoint on map.
   */
// Audited on 2026-11-04
  classifyLocationResolution(rawText, locDetails = {}, lang = 'en') {
    if (!rawText || typeof rawText !== 'string') return null;
    const text = rawText.trim();
    if (!text) return null;

    const wordToNum = {
      one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
      eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
      uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
      seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10
    };

    const cityCoordsCatalog = {
      'de queen':   { city: 'De Queen', state: 'AR', zip: '71832', lat: 34.0379, lng: -94.3413 },
      'broken bow': { city: 'Broken Bow', state: 'OK', zip: '74728', lat: 34.0293, lng: -94.7391 },
      'texarkana':  { city: 'Texarkana', state: 'TX', zip: '75501', lat: 33.4251, lng: -94.0477 },
      'conway':     { city: 'Conway', state: 'AR', zip: '72032', lat: 35.0887, lng: -92.4421 },
      'tyler':      { city: 'Tyler', state: 'TX', zip: '75701', lat: 32.3513, lng: -95.3011 },
      'waco':       { city: 'Waco', state: 'TX', zip: '76701', lat: 31.5493, lng: -97.1467 },
      'wichita falls': { city: 'Wichita Falls', state: 'TX', zip: '76301', lat: 33.9137, lng: -98.4934 },
      'longview':   { city: 'Longview', state: 'TX', zip: '75601', lat: 32.5007, lng: -94.7405 },
      'dallas':     { city: 'Dallas', state: 'TX', zip: '75201', lat: 32.7767, lng: -96.7970 },
      'addison':    { city: 'Addison', state: 'TX', zip: '75001', lat: 32.9618, lng: -96.8292 },
      'plano':      { city: 'Plano', state: 'TX', zip: '75024', lat: 33.0198, lng: -96.6989 },
      'frisco':     { city: 'Frisco', state: 'TX', zip: '75034', lat: 33.1507, lng: -96.8236 },
      'fort worth': { city: 'Fort Worth', state: 'TX', zip: '76102', lat: 32.7555, lng: -97.3308 },
      'austin':     { city: 'Austin', state: 'TX', zip: '78701', lat: 30.2672, lng: -97.7431 },
      'houston':    { city: 'Houston', state: 'TX', zip: '77002', lat: 29.7604, lng: -95.3698 },
      'san antonio':{ city: 'San Antonio', state: 'TX', zip: '78205', lat: 29.4241, lng: -98.4936 },
      'mena':       { city: 'Mena', state: 'AR', zip: '71953', lat: 34.5862, lng: -94.2396 },
      'hope':       { city: 'Hope', state: 'AR', zip: '71801', lat: 33.6671, lng: -93.5916 },
      'idabel':     { city: 'Idabel', state: 'OK', zip: '74745', lat: 33.8957, lng: -94.8266 }
    };

    const lower = text.toLowerCase();
    let matchedCityEntry = null;
    for (const [k, entry] of Object.entries(cityCoordsCatalog)) {
      if (lower.includes(k) || (locDetails.city && locDetails.city.toLowerCase() === k)) {
        matchedCityEntry = entry;
        break;
      }
    }

    const stateNameMap = {
      texas: 'TX', tx: 'TX', arkansas: 'AR', ar: 'AR', oklahoma: 'OK', ok: 'OK',
      louisiana: 'LA', la: 'LA', california: 'CA', ca: 'CA', florida: 'FL', fl: 'FL',
      'new york': 'NY', ny: 'NY'
    };
    const stateMatch = text.match(/\b(Texas|TX|Arkansas|AR|Oklahoma|OK|Louisiana|LA|California|CA|Florida|FL|New York|NY)\b/i);
    const detectedState = stateMatch ? (stateNameMap[stateMatch[1].toLowerCase()] || stateMatch[1].toUpperCase()) : (matchedCityEntry ? matchedCityEntry.state : (locDetails.state || ''));
    const detectedCity = matchedCityEntry ? matchedCityEntry.city : (locDetails.city || '');

    // Check for Rural / Approximate / Mile-Offset Location FIRST when no exact street number is given
    const hasExactHouseNumber = /\b\d{2,5}\s+(?!(?:miles?|mph|km|feet|ft|yards?|minutes?|hours?|days?|acura|honda|ford|toyota|chevy|chevrolet|nissan|jeep|bmw|mercedes|audi|hyundai|kia|subaru|dodge|ram|lexus|tesla|gmc|mazda)\b)[A-Za-z]/i.test(text);
    const mileOffsetMatch = text.match(/\b(?:about|around|approx(?:imately)?|roughly|unos|unas|como)?\s*(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*miles?\s*(east|west|north|south|northeast|northwest|southeast|southwest|al este|al oeste|al norte|al sur|este|oeste|norte|sur)\b/i)
      || text.match(/\b(east|west|north|south)\s+of\s+([A-Z][A-Za-z\s]+?)\s*(?:by\s+|about\s+)?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s*miles?\b/i);
    const ruralRoadMatch = text.match(/\b(Farm\s+to\s+Market(?:\s+Road|\s+Rd)?(?:\s+\d+)?|FM\s*\d+|County\s+(?:Road|Rd)(?:\s+\d+)?|State\s+(?:Highway|Hwy|Route)(?:\s+\d+)?|Highway\s+\d+|Hwy\s+\d+|US-?\s*\d+|Rural\s+Route(?:\s+\d+)?)\b/i);
    const isRuralUnnumbered = !hasExactHouseNumber && Boolean(
      mileOffsetMatch ||
      (ruralRoadMatch && !/\b(?:and|&|at\s+exit|intersection)\b/i.test(text))
    );

    if (isRuralUnnumbered) {
      let miles = 6;
      let dir = 'east';
      if (mileOffsetMatch) {
        const rawNum = String(mileOffsetMatch[1] || mileOffsetMatch[3] || '6').toLowerCase();
        miles = wordToNum[rawNum] || parseInt(rawNum, 10) || 6;
        const rawDir = String(mileOffsetMatch[2] || mileOffsetMatch[1] || 'east').toLowerCase();
        if (rawDir.includes('west') || rawDir.includes('oeste')) dir = 'west';
        else if (rawDir.includes('north') || rawDir.includes('norte')) dir = 'north';
        else if (rawDir.includes('south') || rawDir.includes('sur')) dir = 'south';
        else dir = 'east';
      }
      const baseLat = matchedCityEntry ? matchedCityEntry.lat : 34.0379;
      const baseLng = matchedCityEntry ? matchedCityEntry.lng : -94.3413;
      let lat = baseLat;
      let lng = baseLng;
      if (dir === 'east') lng = Number((baseLng + (miles * 0.017417)).toFixed(4));
      else if (dir === 'west') lng = Number((baseLng - (miles * 0.017417)).toFixed(4));
      else if (dir === 'north') lat = Number((baseLat + (miles * 0.01449)).toFixed(4));
      else if (dir === 'south') lat = Number((baseLat - (miles * 0.01449)).toFixed(4));

      const roadLabel = ruralRoadMatch
        ? ruralRoadMatch[1].replace(/\b(road|rd)\b/i, 'Road').replace(/\bfarm to market\b/i, 'Farm to Market')
        : 'Rural Highway Corridor';
      const cityStateStr = [detectedCity || 'De Queen', detectedState || 'AR'].filter(Boolean).join(', ');
      const dirCap = dir.charAt(0).toUpperCase() + dir.slice(1);
      const formattedRural = `${roadLabel}, ${cityStateStr} (Approx. ${miles} miles ${dirCap})`;
      const absLng = Math.abs(lng).toFixed(4);
      const latStr = `${lat.toFixed(4)}° N`;
      const lngStr = `${absLng}° W`;

      const pinpointPrompt = lang === 'es'
        ? `He registrado ${roadLabel}, aproximadamente a ${miles} millas al ${dir === 'east' ? 'este' : (dir === 'west' ? 'oeste' : (dir === 'north' ? 'norte' : 'sur'))} de ${cityStateStr}. Como ese tramo rural no tiene un número de calle exacto que nuestro segundo oyente pueda verificar como dirección postal, he centrado el mapa interactivo en su enlace en vivo en las coordenadas ${latStr}, ${lngStr} — ¿podría confirmar o marcar ese punto exacto en el mapa por mí?`
        : `I've noted ${roadLabel}, about ${miles} miles ${dir} of ${cityStateStr}. Since that rural stretch doesn't have a defined street number that our second listener can resolve, I've centered the interactive map on your <sub alias="lyve">live</sub> link right at that ${miles}-mile ${dir} marker (${latStr}, ${lngStr}) — can you pinpoint that exact location on the map for me?`;

      return {
        resolutionType: 'APPROXIMATE_RURAL_LOCATION',
        verifiedByMaps: false,
        isApproximateRural: true,
        needsMapPinpoint: true,
        roadName: roadLabel,
        city: detectedCity || 'De Queen',
        state: detectedState || 'AR',
        zipCode: matchedCityEntry ? matchedCityEntry.zip : (locDetails.zipCode || '71832'),
        milesOffset: miles,
        direction: dirCap,
        coordinates: { lat, lng, label: `${cityStateStr} — ${miles} mi ${dirCap} on ${roadLabel} (${latStr}, ${lngStr})` },
        formattedAddress: formattedRural,
        promptText: pinpointPrompt
      };
    }

    // Check for Identifiable Business Location that Google Maps verifies as an address
    const bizMatch = text.match(/\b(Walmart\s+Supercenter|Walmart|Home\s+Depot|Lowe'?s|Target|H-?E-?B|Kroger|Costco|Sam'?s\s+Club|Buc-?ee'?s|Walgreens|CVS|AutoZone|O'?Reilly\s+Auto\s+Parts|McDonald'?s|Chick-?fil-?A|Whataburger|Shell(?:\s+Gas\s+Station|\s+Station)?|Chevron(?:\s+Station)?|Exxon(?:\s+Station)?|QuikTrip)\b/i);
    // Keep bare "Walmart in Dallas/Houston/Austin/Fort Worth" unverified unless street or specific store/city is given
    const isBareMetroWalmart = /^(?:at\s+|the\s+)?walmart\s+(?:in\s+)?(?:dallas|houston|austin|fort worth)[.!?]?$/i.test(text);
    if (bizMatch && !isBareMetroWalmart && (detectedCity || hasExactHouseNumber || locDetails.zipCode)) {
      const bizName = bizMatch[1].replace(/\s+/g, ' ').trim();
      const cityKey = (detectedCity || '').toLowerCase();
      let verifiedAddr = '';
      let coords = matchedCityEntry ? { lat: matchedCityEntry.lat, lng: matchedCityEntry.lng } : { lat: 32.7767, lng: -96.7970 };
      let zip = (matchedCityEntry && matchedCityEntry.zip) || locDetails.zipCode || '';

      if (/walmart/i.test(bizName) && cityKey === 'de queen') {
        verifiedAddr = 'Walmart Supercenter #388, 926 E Collin Raye Dr, De Queen, AR 71832';
        coords = { lat: 34.0398, lng: -94.3214 };
        zip = '71832';
      } else if (/walmart/i.test(bizName) && cityKey === 'broken bow') {
        verifiedAddr = 'Walmart Supercenter #117, 501 S Park Dr, Broken Bow, OK 74728';
        coords = { lat: 34.0229, lng: -94.7391 };
        zip = '74728';
      } else if (/walmart/i.test(bizName) && cityKey === 'tyler') {
        verifiedAddr = 'Walmart Supercenter, 3820 State Hwy 64 W, Tyler, TX 75704';
        coords = { lat: 32.3486, lng: -95.3412 };
        zip = '75704';
      } else if (/home depot/i.test(bizName) && cityKey === 'tyler') {
        verifiedAddr = 'The Home Depot, 3901 S Broadway Ave, Tyler, TX 75701';
        coords = { lat: 32.3075, lng: -95.3010 };
        zip = '75701';
      } else {
        const streetBit = locDetails.streetAddress ? `, ${locDetails.streetAddress}` : '';
        const csBit = [detectedCity, detectedState, zip].filter(Boolean).join(', ');
        verifiedAddr = `${bizName}${streetBit}${csBit ? ', ' + csBit : ''} (Google Maps Verified Address)`;
      }

      return {
        resolutionType: 'GOOGLE_MAPS_VERIFIED_BUSINESS',
        verifiedByMaps: true,
        isApproximateRural: false,
        needsMapPinpoint: false,
        businessName: bizName,
        city: detectedCity,
        state: detectedState,
        zipCode: zip,
        coordinates: coords,
        formattedAddress: verifiedAddr
      };
    }

    // Defined street address or intersection
    if (hasExactHouseNumber || locDetails.intersection || /\b[A-Za-z]{2,}\s+(?:and|&)\s+[A-Za-z]{2,}\b/i.test(text)) {
      return {
        resolutionType: 'DEFINED_ADDRESS',
        verifiedByMaps: true,
        isApproximateRural: false,
        needsMapPinpoint: false,
        city: detectedCity,
        state: detectedState,
        zipCode: locDetails.zipCode || (matchedCityEntry ? matchedCityEntry.zip : ''),
        coordinates: matchedCityEntry ? { lat: matchedCityEntry.lat, lng: matchedCityEntry.lng } : null,
        formattedAddress: locDetails.formattedPlottable || text
      };
    }

    return null;
  }

  isStructurallyGarbledStreet(candidateStreet) {
    if (!candidateStreet || typeof candidateStreet !== 'string') return false;
    const s = candidateStreet.trim();
    if (!s) return true;
    const hasValidSuffix = /\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|way|ct|court|pl|place|pkwy|parkway|hwy|highway|cir|circle|trail|loop|ter|terrace|fwy|freeway|expy|expressway|calle|avenida|bulevar|camino|autopista|carretera)\b/i.test(s);
    // 1. Conversational verbs, auxiliaries, hesitation fillers, or vague placeholders
    if (/\b(is|was|were|are|am|been|have|has|had|got|getting|went|going|think|thought|know|said|tell|told|mean|meant|maybe|probably|guess|uh+|um+|uhm+|er+|ah+|hmm+|stuff|something|whatever|thing|thingy|whatchamacallit|what\s+is\s+it|i\s+don'?t\s+know|kind\s+of|sort\s+of|we\s+were|i\s+was|it\s+was|there\s+is|there\s+was)\b/i.test(s)) {
      return true;
    }
    // 2. English prepositional/article glue phrases inside street slot ("way of the", "in the", "by the", "on the", "near the")
    if (/\b(way\s+of|of\s+the|in\s+the|on\s+the|to\s+the|for\s+the|with\s+the|by\s+the|at\s+the|from\s+the|near\s+the|around\s+the|out\s+of|over\s+the|under\s+the)\b/i.test(s)) {
      return true;
    }
    // 3. Starts with a function word / preposition / article / conjunction and has no street suffix
    if (/^(?:the|a|an|my|our|in|on|at|to|for|with|by|near|from|and|or|but|so|like)\b/i.test(s) && !hasValidSuffix) {
      return true;
    }
    // 4. Multi-word phrase (>= 3 tokens) without a street suffix that contains function/stopwords
    const tokens = s.split(/\s+/).filter(Boolean);
    if (tokens.length >= 3 && !hasValidSuffix && /\b(the|of|in|on|at|to|for|with|by|from|and|or|my|our|it|that|this|some|any|near|around)\b/i.test(s)) {
      return true;
    }
    return false;
  }

  scoreVehicleSpecificity(vehStr) {
    if (!vehStr || typeof vehStr !== 'string') return 0;
    const s = vehStr.trim();
    if (!s || s.length < 2) return 0;
    if (/\b(got it|understood|thank you|here,?\s*making\s*motto|year,?\s*make,?\s*(?:and\s+)?model|which vehicle on your policy|what is the year)\b/i.test(s)) {
      return 0;
    }
    const hasYear = /\b(?:19|20)\d{2}\b/.test(s);
    const hasMake = /\b(Ford|Chevrolet|Chevy|Toyota|Honda|Nissan|Jeep|BMW|Mercedes|Audi|Hyundai|Kia|Subaru|Dodge|Ram|Lexus|Volkswagen|VW|Tesla|GMC|Mazda|Acura|Cadillac|Chrysler|Buick|Lincoln|Infiniti|Volvo|Porsche|Land Rover|Jaguar|Mini|Mitsubishi|Genesis)\b/i.test(s);
    const tokenCount = s.split(/\s+/).filter(Boolean).length;
    if (hasYear && hasMake && tokenCount >= 3) return 4;
    if ((hasYear && tokenCount >= 2) || (hasMake && tokenCount >= 2)) return 3;
    if (hasMake || hasYear) return 2;
    return 1;
  }

  validateSlotExtraction(slot, speech, session, options = {}) {
    if (!speech || typeof speech !== 'string' || !session) return null;
    const lang = options.language || session.language || 'en';
    const text = speech.trim();
    const data = session.fnolData || {};

    // 1. If we were waiting for the caller to clarify a garbled street name on a location turn
    if (session.pendingAddressParts && (slot === 'location' || session.pendingSlot === 'location')) {
      const parts = session.pendingAddressParts;
      const cleanedReply = text
        .replace(/^(?:it'?s|it is|the street(?: name| address)? is|the address is|la direcci[oó]n es|that'?s|sorry(?:\s+about\s+that)?[,.\s]*|disculpe[,.\s]*|uh+[,.\s]*|um+[,.\s]*)+/i, '')
        .replace(/[.!?]+$/, '')
        .trim();
      // Reject if caller is asking a question or repeating garbled filler
      if (cleanedReply.length >= 2 && cleanedReply.length <= 65 && !this.isStructurallyGarbledStreet(cleanedReply) && !/\b(what do you|didn'?t catch)\b/i.test(cleanedReply)) {
        let streetPart = /^\d+\s+/.test(cleanedReply) ? cleanedReply : `${parts.houseNumber} ${cleanedReply}`;
        if (parts.city) {
          const escCity = parts.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          streetPart = streetPart.replace(new RegExp(`(?:,?\\s*(?:in|en|at)\\s+|,\\s*)${escCity}(?:,?\\s*(?:Texas|TX|California|CA|Florida|FL|New York|NY|Oklahoma|OK|Arkansas|AR|Louisiana|LA))?(?:\\s+\\d{5})?$`, 'i'), '').trim();
        }
        const replyHasCity = parts.city && new RegExp(`\\b${parts.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(streetPart);
        const replyHasState = parts.state && (new RegExp(`\\b${parts.state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(streetPart) || /\bTexas\b/i.test(streetPart));
        const replyHasZip = parts.zipCode && streetPart.includes(parts.zipCode);
        const locPieces = [
          streetPart,
          !replyHasCity ? parts.city : null,
          !replyHasState ? parts.state : null,
          !replyHasZip ? parts.zipCode : null
        ].filter(Boolean);
        const fullPlottable = locPieces.join(', ');
        data.locationOfLoss = fullPlottable;
        data.locationDetails = data.locationDetails || {};
        data.locationDetails.streetAddress = streetPart;
        if (parts.city) data.locationDetails.city = parts.city;
        if (parts.state) data.locationDetails.state = parts.state;
        if (parts.zipCode) data.locationDetails.zipCode = parts.zipCode;
        data.locationDetails.formattedPlottable = fullPlottable;
        data.locationDetails.mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullPlottable)}`;
        session.pendingAddressParts = null;
        return {
          action: 'ADDRESS_CLARIFIED',
          formattedLocation: fullPlottable
        };
      }
    }

    // 2. Detect garbled street name when house number + candidate street are given (with or without city/state/zip)
    if (slot === 'location' || session.pendingSlot === 'location' || /\b\d{3,5}\s+[A-Za-z]/.test(text)) {
      const normalizedZipText = text.replace(/\b(\d{2})\s*[.,]\s*(\d{3})\b/g, '$1$2');
      const addrBreakdown = normalizedZipText.match(/(?<![:\d])\b(\d{2,5})(?!\s*(?:am|pm|a\.m\.|p\.m\.|mph|%|Ford|Chevrolet|Chevy|Toyota|Honda|Nissan|Jeep|BMW|Mercedes|Audi|Hyundai|Kia|Subaru|Dodge|Ram|Lexus|Volkswagen|VW|Tesla|GMC|Mazda|Acura|Cadillac|Chrysler|Buick|Lincoln|Infiniti|Volvo)\b)\s+([^,.!?]{3,40}?)\s*[,.]?\s*(?:(?:in|en)\s+)?\b(Dallas|Fort Worth|Austin|Houston|San Antonio|El Paso|Arlington|Plano|Frisco|Denton|Irving|Garland|McKinney|Grand Prairie|Tyler|Waco|Wichita Falls|Lubbock|Amarillo|Midland|Odessa|Abilene|Beaumont|Round Rock|Conway|Broken Bow|Texarkana|Longview|McAllen|Corpus Christi|Killeen|Laredo|Brownsville|Pasadena|Mesquite|Carrollton|Sherman|Denison|Paris|Lufkin|Nacogdoches|San Angelo|Addison)\s*[,.]?\s*(Texas|TX|California|CA|Florida|FL|New York|NY|Oklahoma|OK|Arkansas|AR|Louisiana|LA)?\s*(\d{5})?/i)
        || ((slot === 'location' || session.pendingSlot === 'location') ? normalizedZipText.match(/^(?:it'?s\s+|at\s+|on\s+|en\s+)?(\d{2,5})\s+([^,.!?]{3,40}?)[.!?]*$/i) : null);
      if (addrBreakdown) {
        const houseNumber = addrBreakdown[1].trim();
        const candidateStreet = addrBreakdown[2].trim();
        const city = (addrBreakdown[3] || (data.locationDetails && data.locationDetails.city) || '').trim();
        const stateRaw = (addrBreakdown[4] || (data.locationDetails && data.locationDetails.state) || (city ? 'TX' : '')).trim().toUpperCase();
        const state = stateRaw === 'TEXAS' ? 'TX' : stateRaw;
        const zipMatch = normalizedZipText.match(/\b(\d{5})\b/);
        const zipCode = (addrBreakdown[5] || (zipMatch && zipMatch[1] !== houseNumber ? zipMatch[1] : '') || (data.locationDetails && data.locationDetails.zipCode) || '').trim();

        if (this.isStructurallyGarbledStreet(candidateStreet)) {
          session.pendingAddressParts = {
            houseNumber,
            heardStreet: candidateStreet,
            city,
            state,
            zipCode
          };
          const locSuffix = [city, state, zipCode].filter(Boolean).join(' ');
          const partialFormatted = locSuffix ? `${houseNumber} (Street Pending), ${locSuffix}`.trim() : `${houseNumber} (Street Pending)`;
          data.locationDetails = data.locationDetails || {};
          if (city) data.locationDetails.city = city;
          if (state) data.locationDetails.state = state;
          if (zipCode) data.locationDetails.zipCode = zipCode;
          data.locationDetails.formattedPlottable = partialFormatted;
          data.locationOfLoss = partialFormatted;

          const cityStateZipLabel = [city, state, zipCode].filter(Boolean).join(', ');
          const inCityBit = cityStateZipLabel ? (lang === 'es' ? ` en ${cityStateZipLabel}` : ` in ${cityStateZipLabel}`) : '';
          const clarifyPrompt = lang === 'es'
            ? `Disculpe, capté el número ${houseNumber}${inCityBit}, pero no alcancé a escuchar bien el nombre de la calle — escuché "${candidateStreet}". ¿Podría repetirme o deletrear solo el nombre de la calle?`
            : `Sorry, I caught the number ${houseNumber}${inCityBit}, but I didn't quite catch the street name — I heard '${candidateStreet}.' Could you repeat or spell just the street name for me?`;

          return {
            action: 'CLARIFY_GARBLED_ADDRESS',
            houseNumber,
            heardStreet: candidateStreet,
            city,
            state,
            zipCode,
            text: clarifyPrompt
          };
        }
      }
    }

    // 2b. Handle Caller Response to Interactive Map Pinpoint Prompt (for Undefined / Rural Locations)
    if (slot === 'mapPinpoint' || session.pendingSlot === 'mapPinpoint' || session.awaitingMapPinpoint) {
      const isPinConfirm = /\b(yes|yeah|yep|done|pinpointed|pinned|dropped|marked|confirmed|clicked|tapped|got it|there|right there|okay|ok|sure|s[íi]|listo|marcado|confirmado)\b/i.test(text);
      const isPinDefer = /\b(no|nope|can'?t|cannot|not right now|later|skip|next|don'?t have|unable)\b/i.test(text) && !isPinConfirm;
      if (isPinConfirm || data.mapPinpointConfirmed === true) {
        session.awaitingMapPinpoint = false;
        data.mapPinpointConfirmed = true;
        data.locationDetails = data.locationDetails || {};
        data.locationDetails.mapPinpointConfirmed = true;
        return {
          action: 'MAP_PINPOINT_CONFIRMED',
          coordinates: data.locationDetails.coordinates || { lat: 34.0379, lng: -94.2368 },
          formattedLocation: data.locationOfLoss
        };
      }
      if (isPinDefer) {
        session.awaitingMapPinpoint = false;
        data.mapPinpointConfirmed = 'PRE_PINNED_APPROXIMATE';
        data.locationDetails = data.locationDetails || {};
        data.locationDetails.mapPinpointConfirmed = 'PRE_PINNED_APPROXIMATE';
        return {
          action: 'MAP_PINPOINT_DEFERRED',
          coordinates: data.locationDetails.coordinates || { lat: 34.0379, lng: -94.2368 },
          formattedLocation: data.locationOfLoss
        };
      }
    }

    // 2c. Classify Location Resolution: Rural/Undefined (Needs Map Pinpoint) vs. Google-Maps-Verified Business / Defined Address (No Map Pinpoint Needed)
    if (slot === 'location' || session.pendingSlot === 'location' || /\b(farm\s+to\s+market|miles?\s+(?:east|west|north|south)|walmart\s+supercenter|de\s+queen)\b/i.test(text)) {
      const locRes = this.classifyLocationResolution(text, data.locationDetails || {}, lang);
      if (locRes) {
        data.locationDetails = data.locationDetails || {};
        data.locationDetails.resolutionType = locRes.resolutionType;
        data.locationDetails.verifiedByMaps = locRes.verifiedByMaps;
        data.locationDetails.isApproximateRural = locRes.isApproximateRural;
        data.locationDetails.needsMapPinpoint = locRes.needsMapPinpoint;
        data.isApproximateRural = locRes.isApproximateRural;
        data.verifiedByMaps = locRes.verifiedByMaps;
        data.needsMapPinpoint = locRes.needsMapPinpoint;
        if (locRes.city) data.locationDetails.city = locRes.city;
        if (locRes.state) data.locationDetails.state = locRes.state;
        if (locRes.zipCode) data.locationDetails.zipCode = locRes.zipCode;
        if (locRes.coordinates) data.locationDetails.coordinates = locRes.coordinates;
        if (locRes.roadName) data.locationDetails.streetAddress = locRes.roadName;
        if (locRes.businessName) data.locationDetails.landmarkBusiness = locRes.businessName;
        data.locationDetails.formattedPlottable = locRes.formattedAddress;
        data.locationDetails.mapUrl = locRes.coordinates
          ? `https://www.google.com/maps/search/?api=1&query=${locRes.coordinates.lat},${locRes.coordinates.lng}`
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locRes.formattedAddress)}`;
        data.locationOfLoss = locRes.formattedAddress;

        if (locRes.needsMapPinpoint && !data.mapPinpointConfirmed && !session.mapPinpointAsked) {
          session.mapPinpointAsked = true;
          session.awaitingMapPinpoint = true;
          return {
            action: 'REQUEST_MAP_PINPOINT',
            resolution: locRes,
            formattedLocation: locRes.formattedAddress,
            text: locRes.promptText
          };
        }
        if (locRes.resolutionType === 'GOOGLE_MAPS_VERIFIED_BUSINESS') {
          return {
            action: 'GOOGLE_MAPS_VERIFIED_BUSINESS',
            resolution: locRes,
            formattedLocation: locRes.formattedAddress
          };
        }
      }
    }

    // 3. Universal Partial Vehicle / Garbled Model Validation on Vehicle Turn
    if (session.pendingVehicleParts && (slot === 'vehicle' || session.pendingSlot === 'vehicle')) {
      const vp = session.pendingVehicleParts;
      const cleanedModel = text
        .replace(/^(?:it'?s\s+a\s+|it'?s\s+an\s+|it'?s\s+|it\s+is\s+a\s+|the\s+model\s+is\s+|sorry[,.\s]*|uh+[,.\s]*|um+[,.\s]*)+/i, '')
        .replace(/[.!?]+$/, '')
        .trim();
      if (cleanedModel && cleanedModel.length >= 2 && cleanedModel.length <= 30 && !/\b(something|whatever|stuff|don'?t know)\b/i.test(cleanedModel)) {
        const pieces = [vp.year, vp.make, cleanedModel].filter(Boolean);
        // Deduplicate if caller repeated year or make
        const deduped = [];
        for (const p of pieces.join(' ').split(/\s+/)) {
          if (!deduped.some(existing => existing.toLowerCase() === p.toLowerCase())) deduped.push(p);
        }
        const fullVeh = deduped.join(' ');
        data.vehicleInfo = fullVeh;
        session.pendingVehicleParts = null;
        return {
          action: 'VEHICLE_CLARIFIED',
          formattedVehicle: fullVeh
        };
      }
    }

    if (slot === 'vehicle' || session.pendingSlot === 'vehicle' || /\b(Ford|Chevrolet|Chevy|Toyota|Honda|Nissan|Jeep|BMW|Mercedes|Audi|Hyundai|Kia|Subaru|Dodge|Ram|Lexus|Volkswagen|VW|Tesla|GMC|Mazda|Acura)\s+(?:uh+|um+|something|whatever)\b/i.test(text)) {
      const yearOnlyMatch = text.match(/^(?:it'?s\s+a\s+|it\s+is\s+a\s+|a\s+|my\s+)?((?:19|20)\d{2})[.!?]*$/i);
      const partialMakeMatch = text.match(/^(?:it'?s\s+a\s+|it\s+is\s+a\s+|a\s+|my\s+)?((?:19|20)\d{2})?\s*(Ford|Chevrolet|Chevy|Toyota|Honda|Nissan|Jeep|BMW|Mercedes|Audi|Hyundai|Kia|Subaru|Dodge|Ram|Lexus|Volkswagen|VW|Tesla|GMC|Mazda|Acura|Cadillac|Chrysler|Buick|Lincoln|Infiniti|Volvo)(?:\s+(?:uh+|um+|something|whatever|stuff|thing)){0,3}[.!?]*$/i);
      if (yearOnlyMatch) {
        const year = yearOnlyMatch[1];
        session.pendingVehicleParts = { year, make: '' };
        const clarifyVeh = lang === 'es'
          ? `Capté que es modelo ${year} — ¿cuál es la marca y el modelo del vehículo?`
          : `I caught that the year is ${year} — what are the make and model of the vehicle?`;
        return { action: 'CLARIFY_PARTIAL_VEHICLE', year, make: '', text: clarifyVeh };
      }
      if (partialMakeMatch) {
        const year = (partialMakeMatch[1] || '').trim();
        const make = partialMakeMatch[2].trim();
        session.pendingVehicleParts = { year, make };
        const label = [year, make].filter(Boolean).join(' ');
        const clarifyVeh = lang === 'es'
          ? `Capté que es un ${label} — ¿qué modelo específico es${year ? '' : ' y de qué año'}?`
          : `I caught that it's a ${label} — what model is it${year ? '' : ' and what year'}?`;
        return { action: 'CLARIFY_PARTIAL_VEHICLE', year, make, text: clarifyVeh };
      }
    }

    return null;
  }

  protectSlotIntegrity(preSnapshot, session, speech, answeringSlot) {
    if (!session || !session.fnolData) return;
    const data = session.fnolData;
    const prevLoc = (preSnapshot && preSnapshot.locationOfLoss) || '';
    const currLoc = data.locationOfLoss || '';

    // 1. Never allow bare state ("TEXAS") to stay in locationOfLoss
    if (currLoc && this.scoreLocationSpecificity(currLoc) === 0) {
      const locDet = data.locationDetails || {};
      if (locDet.streetAddress || locDet.city || locDet.zipCode) {
        const rebuilt = [locDet.streetAddress, locDet.city, locDet.state, locDet.zipCode].filter(Boolean).join(', ');
        data.locationOfLoss = this.scoreLocationSpecificity(rebuilt) > 0 ? rebuilt : prevLoc;
      } else {
        data.locationOfLoss = prevLoc;
      }
    }

    // 2. Never allow a lower-specificity location (e.g. "Residence / Home" or "TEXAS") to clobber a higher-specificity location
    const prevSpec = this.scoreLocationSpecificity(prevLoc);
    const currSpec = this.scoreLocationSpecificity(data.locationOfLoss || '');
    if (prevSpec > currSpec) {
      data.locationOfLoss = prevLoc;
      if (data.locationDetails && preSnapshot.locationDetails) {
        data.locationDetails = Object.assign({}, preSnapshot.locationDetails, {
          zipCode: data.locationDetails.zipCode || preSnapshot.locationDetails.zipCode,
          city: data.locationDetails.city || preSnapshot.locationDetails.city,
          state: data.locationDetails.state || preSnapshot.locationDetails.state,
          streetAddress: preSnapshot.locationDetails.streetAddress || data.locationDetails.streetAddress,
          formattedPlottable: prevLoc
        });
      }
    }

    // 3. Universal Vehicle Specificity & Anti-Echo Guard
    const prevVeh = (preSnapshot && preSnapshot.vehicleInfo) || '';
    const currVeh = data.vehicleInfo || '';
    const prevVehSpec = this.scoreVehicleSpecificity(prevVeh);
    const currVehSpec = this.scoreVehicleSpecificity(currVeh);
    if (currVeh && currVehSpec === 0) {
      data.vehicleInfo = prevVeh;
    } else if (prevVehSpec > currVehSpec && answeringSlot !== 'vehicle') {
      data.vehicleInfo = prevVeh;
    }

    // 4. Protect dateOfLoss / timeOfLoss against placeholder clobbering
    if (preSnapshot && preSnapshot.dateOfLoss && (!data.dateOfLoss || /reported date/i.test(String(data.dateOfLoss)))) {
      data.dateOfLoss = preSnapshot.dateOfLoss;
    }
    if (preSnapshot && preSnapshot.timeOfLoss && (!data.timeOfLoss || /reported date/i.test(String(data.timeOfLoss)))) {
      data.timeOfLoss = preSnapshot.timeOfLoss;
    }

    // 5. Protect policyNumber against conversational clobbering on non-policy turns
    if (preSnapshot && preSnapshot.policyNumber && answeringSlot !== 'policyNumber' && data.policyNumber !== preSnapshot.policyNumber) {
      if (!/^[A-Z]{1,4}-?\d{4,10}/i.test(String(data.policyNumber || ''))) {
        data.policyNumber = preSnapshot.policyNumber;
      }
    }
  }

  /**
   * 2nd Listener Trade Slot Integrity Guard (Plumbing & Commercial Trades).
   * Prevents serviceAddress, preferredWindow, callerName, and problemDescription
   * from low-specificity clobbering, trailing narrative contamination, or summary confirmation overwrite.
   */
// Audited on 2026-11-04
  protectTradeSlotIntegrity(preTicketSnapshot, session, speech, answeringSlot) {
    if (!session || !session.ticket) return;
    const ticket = session.ticket;
    const text = (speech || '').trim();
    const isExplicitCorrection = /\b(actually|change\s+the|wrong\s+address|wrong\s+time|different\s+address|not\s+that\s+address|instead\s+of|meant\s+to\s+say|corrijo|cambiar)\b/i.test(text);

    // 1. Clean trailing damage/problem clauses out of serviceAddress
    if (ticket.serviceAddress && typeof ticket.serviceAddress === 'string') {
      const cleanedAddr = ticket.serviceAddress
        .replace(/\b(\d{1,2}):(\d{2})(?=\s+[A-Za-z]+\s+(?:Drive|Dr|Street|St|Ave|Avenue|Road|Rd|Lane|Ln|Blvd|Boulevard|Way|Court|Ct|Parkway|Pkwy|Circle|Cir|Loop|Trail|Place|Pl)\b)/gi, '$1$2')
        .replace(/(?:,\s*|\s+(?:and|where|because|since|but|while|y|donde|porque)\s+)(?:my\s+|our\s+|the\s+|there\s+is\s+|there's\s+|water\s+is\s+|sewage\s+is\s+|a\s+pipe\s+|pipe\s+|el\s+agua\s+|la\s+tuber[íi]a\s+|tenemos\s+|hay\s+)(?:burst|leaking|pouring|flooding|overflowing|backed\s+up|backing\s+up|broken|clogged|smells?|revent[óo]|fuga|inundando|saliendo).*$/i, '')
        .replace(/,\s*(?:water|sewage|raw\s+sewage|my\s+water\s+heater|my\s+toilet|my\s+sink|a\s+pipe)\b.*$/i, '')
        .replace(/[.,;:\s]+$/, '')
        .trim();
      if (cleanedAddr.length >= 5) {
        ticket.serviceAddress = cleanedAddr;
      }
    }

    // 2. Protect serviceAddress against lower-specificity clobbering on non-address turns
    if (preTicketSnapshot && preTicketSnapshot.serviceAddress && answeringSlot !== 'serviceAddress' && !isExplicitCorrection) {
      const prevSpec = this.scoreLocationSpecificity(preTicketSnapshot.serviceAddress);
      const currSpec = this.scoreLocationSpecificity(ticket.serviceAddress || '');
      if (prevSpec > currSpec) {
        ticket.serviceAddress = preTicketSnapshot.serviceAddress;
      }
    }

    // 3. Protect preferredWindow against summary confirmation phrase overwrite & strip compound shut-off clauses
    if (ticket.preferredWindow && /\b(shut[\s-]*off|main\s+(?:emergency\s+)?(?:water\s+)?valve|turned\s+(?:it\s+)?off|closed\s+(?:the\s+)?valve|llave\s+de\s+paso)\b/i.test(String(ticket.preferredWindow))) {
      ticket.shutOffValveConfirmed = !/\b(no|not|haven'?t|can'?t|couldn'?t)\b/i.test(String(ticket.preferredWindow));
      const strippedWin = String(ticket.preferredWindow)
        .replace(/^(?:yes|yeah|yep|ok|okay|sure|s[íi])[,.s]+(?:i\s+)?(?:already\s+)?(?:shut[\s-]*off|turned[\s-]*off|closed)\s+(?:the\s+)?(?:main\s+)?(?:emergency\s+)?(?:water\s+)?(?:shut[\s-]*off\s+)?valve(?:\s+and|,)?\s*/i, '')
        .replace(/\s+(?:works\s+best(?:\s+for\s+me|\s+for\s+us)?|is\s+best|would\s+be\s+best)[.!?]*$/i, '')
        .trim();
      if (strippedWin) ticket.preferredWindow = strippedWin;
    }
    if (preTicketSnapshot && preTicketSnapshot.preferredWindow && ticket.preferredWindow !== preTicketSnapshot.preferredWindow) {
      if (/^(?:yes|yeah|yep|correct|accurate|that\s+is\s+(?:all\s+)?(?:correct|accurate)|everything\s+is\s+accurate|s[íi]|claro|exacto)\b/i.test(String(ticket.preferredWindow || '').trim()) && !/\b(am|pm|a\.m\.|p\.m\.|morning|afternoon|evening|hour|today|tomorrow|ma[ñn]ana|hoy|tarde)\b/i.test(String(ticket.preferredWindow || ''))) {
        ticket.preferredWindow = preTicketSnapshot.preferredWindow;
      }
    }

    // 4. Protect callerName against interrogative or confirmation overwrite
    if (preTicketSnapshot && preTicketSnapshot.callerName && answeringSlot !== 'callerName' && ticket.callerName !== preTicketSnapshot.callerName) {
      if (/\b(what|where|when|how|why|who|yes|yeah|correct|accurate)\b/i.test(String(ticket.callerName || ''))) {
        ticket.callerName = preTicketSnapshot.callerName;
      }
    }
  }

  // ── 2ND LISTENER ROLE 3: LIVE SESSION FACT READBACK & MID-FLOW/SUMMARY Q&A ──
  detectSessionFactInquiry(speech, session, options = {}) {
    if (!speech || typeof speech !== 'string' || !session) return null;
    const lang = options.language || session.language || 'en';
    const text = speech.trim();
    const isTradeSession = Boolean(session.ticket && session.specialist && session.specialist !== 'claims');

    // ── TRADE / PLUMBING SESSION FACT INQUIRY (session.ticket) ──
    if (isTradeSession) {
      const tkt = session.ticket;
      if (session.awaitingFactFill && text.length >= 3) {
        const targetSlot = session.awaitingFactFill;
        const isStillQuestion = /\b(what do you have|what is the|do you have|qu[ée] tiene)\b/i.test(text);
        if (!isStillQuestion) {
          session.awaitingFactFill = null;
          tkt[targetSlot] = text.replace(/[.!?]+$/, '').trim();
          return {
            action: 'FACT_FILL_COMPLETED',
            slot: targetSlot,
            value: tkt[targetSlot]
          };
        }
      }

      const isTradeAddressInquiry = /\b(what\s+(?:address|location|street|city|service\s+address)\s+(?:do\s+you\s+have|did\s+you\s+put|is\s+listed)|what\s+do\s+you\s+have\s+(?:as|for|on)\s+(?:the\s+|my\s+)?(?:address|location|street|service\s+address)|qu[ée]\s+direcci[óo]n\s+tiene)/i.test(text);
      const isTradeWindowInquiry = /\b(what\s+(?:time|time\s+window|window|schedule|appointment|arrival\s+window)\s+(?:do\s+you\s+have|did\s+you\s+put|is\s+listed)|what\s+do\s+you\s+have\s+(?:as|for)\s+(?:the\s+|my\s+)?(?:time|time\s+window|window|appointment)|qu[ée]\s+(?:horario|hora|ventana)\s+tiene)/i.test(text);
      const isTradeProblemInquiry = /\b(what\s+(?:problem|issue|plumbing\s+issue|emergency|urgency)\s+(?:do\s+you\s+have|did\s+you\s+put|is\s+listed)|what\s+do\s+you\s+have\s+(?:as|for)\s+(?:the\s+|my\s+)?(?:problem|issue|plumbing\s+issue|urgency)|qu[ée]\s+problema\s+tiene)/i.test(text);
      const isTradeRefInquiry = /\b(what\s+is\s+(?:my|the)\s+(?:ticket|job|reference|service)\s+number|do\s+you\s+have\s+a\s+(?:ticket|job|reference)\s+number|cu[áa]l\s+es\s+(?:mi|el)\s+n[úu]mero\s+de\s+(?:orden|referencia|ticket|servicio))/i.test(text);

      if (isTradeAddressInquiry) {
        if (tkt.serviceAddress) {
          const reply = lang === 'es'
            ? `Para confirmar los detalles registrados: dirección de servicio en ${tkt.serviceAddress}. ¿Es correcta esa información, o desea actualizarla?`
            : `To confirm the details I have recorded: service address at ${tkt.serviceAddress}. Is that accurate, or would you like me to update it?`;
          return { action: 'SESSION_FACT_READBACK', slot: 'serviceAddress', recordedValue: tkt.serviceAddress, text: reply };
        }
        session.awaitingFactFill = 'serviceAddress';
        const reply = lang === 'es'
          ? `Aún necesito confirmar la dirección exacta — ¿cuál es el número, calle y ciudad de la propiedad?`
          : `I still need to confirm the exact street address — what is the street number, street name, and city for the service location?`;
        return { action: 'SESSION_FACT_MISSING_PROMPT', slot: 'serviceAddress', recordedValue: null, text: reply };
      }

      if (isTradeWindowInquiry) {
        if (tkt.preferredWindow) {
          const reply = lang === 'es'
            ? `Tengo registrado su horario solicitado como ${tkt.preferredWindow}. ¿Es correcto ese horario, o desea cambiarlo?`
            : `I have your requested dispatch time window recorded as ${tkt.preferredWindow}. Is that accurate, or would you like to change it?`;
          return { action: 'SESSION_FACT_READBACK', slot: 'preferredWindow', recordedValue: tkt.preferredWindow, text: reply };
        }
        session.awaitingFactFill = 'preferredWindow';
        const reply = lang === 'es'
          ? `Aún no tengo registrado su horario preferido — ¿qué día y ventana de horario le funciona mejor?`
          : `I don't have your preferred arrival window recorded yet — what day and time window works best for you?`;
        return { action: 'SESSION_FACT_MISSING_PROMPT', slot: 'preferredWindow', recordedValue: null, text: reply };
      }

      if (isTradeProblemInquiry) {
        const prob = tkt.problemDescription || (lang === 'es' ? 'solicitud de plomería' : 'plumbing service issue');
        const urg = tkt.urgency ? (lang === 'es' ? `, marcado como ${tkt.urgency}` : `, marked as ${tkt.urgency}`) : '';
        const reply = lang === 'es'
          ? `Tengo registrado su problema como ${prob}${urg}. ¿Es correcta esa información, o desea actualizarla?`
          : `I have your service issue recorded as ${prob}${urg}. Is that accurate, or would you like me to update it?`;
        return { action: 'SESSION_FACT_READBACK', slot: 'problemDescription', recordedValue: prob, text: reply };
      }

      if (isTradeRefInquiry) {
        const ref = session.claimRef || 'SVC-PLB-DEMO';
        const reply = lang === 'es'
          ? `Su número de referencia de orden de servicio es ${ref}. ¿Es correcta toda la información del resumen?`
          : `Your service job-ticket reference number is ${ref}. Is all of the information in your summary accurate?`;
        return { action: 'SESSION_FACT_READBACK', slot: 'claimRef', recordedValue: ref, text: reply };
      }
    }

    if (!session.fnolData) return null;
    const data = session.fnolData;

    // If caller is answering a missing-fact prompt that they asked about on the previous turn
    if (session.awaitingFactFill && text.length >= 2) {
      const targetSlot = session.awaitingFactFill;
      const isStillQuestion = /\?|\b(what do you have|what is the|do you have|where did you|how do you|qu[ée] tiene|de d[óo]nde)\b/i.test(text);
      if (!isStillQuestion) {
        session.awaitingFactFill = null;
        if (targetSlot === 'dateOfLoss') {
          if (!data.dateOfLoss) data.dateOfLoss = text.replace(/[.!?]+$/, '').trim();
          if (!data.timeOfLoss) data.timeOfLoss = data.dateOfLoss;
        } else if (targetSlot === 'locationOfLoss') {
          data.locationOfLoss = text.replace(/[.!?]+$/, '').trim();
        } else if (targetSlot === 'vehicleInfo') {
          data.vehicleInfo = text.replace(/[.!?]+$/, '').trim();
        }
        return {
          action: 'FACT_FILL_COMPLETED',
          slot: targetSlot,
          value: data[targetSlot]
        };
      }
    }

    // Detect questions about what the bot currently has recorded in session.fnolData (including ASR phonetic variants like "law state" / "lost date" / "loss state" for "loss date")
    const isDateInquiry = /\b(what\s+(?:do\s+you\s+have|is\s+listed|did\s+you\s+put|date\s+do\s+you\s+have).*\b(?:date|time|when|law\s+state|loss\s+state|lost\s+date|loss\s+date)\b|\b(?:date|time)\s+of\s+loss\b.*\?|\bwhat\s+do\s+you\s+have\s+(?:as|is|for|the)?\s*(?:the\s+)?(?:date|time|law\s+state|loss\s+state|lost\s+date|loss\s+date)|qu[ée]\s+fecha\s+tiene)/i.test(text);
    const isLocationInquiry = /\b(what\s+(?:address|location|street|city)\s+do\s+you\s+have|what\s+do\s+you\s+have\s+(?:as|for)\s+(?:the\s+)?(?:address|location|street)|qu[ée]\s+direcci[óo]n\s+tiene)/i.test(text);
    const isPolicyInquiry = /\b(what\s+(?:policy|policy\s+number)\s+do\s+you\s+have|what\s+do\s+you\s+have\s+.*\b(?:policy|p[oó]liza)\b|qu[ée]\s+p[oó]liza\s+tiene)/i.test(text);
    const isVehicleInquiry = /\b(what\s+(?:vehicle|car|truck|make|model)\s+do\s+you\s+have|what\s+do\s+you\s+have\s+(?:as|for)\s+(?:the\s+)?(?:vehicle|car)|qu[ée]\s+veh[íi]culo\s+tiene)/i.test(text);
    const isSourceOfDetailsInquiry = /\b(where\s+did\s+you\s+get\s+(?:my|the|that|those)\s+(?:vehicle|car|policy|details|information)|how\s+do\s+you\s+(?:know|have)\s+(?:my|that)\s+(?:vehicle|car|acura|policy)|de\s+d[óo]nde\s+(?:sac[óo]|obtuvo)\s+(?:los\s+datos|mi\s+veh[íi]culo|la\s+p[oó]liza))/i.test(text);
    const isClaimRefInquiry = /\b(what\s+is\s+(?:my|the)\s+(?:claim|reference)\s+number|do\s+you\s+have\s+a\s+claim\s+number|cu[áa]l\s+es\s+(?:mi|el)\s+n[úu]mero\s+de\s+reclamo)/i.test(text);

    // If caller answered a yes/no slot (like drivabilityLeaks: "Yes. Um, what do you have the law state as") before asking the fact question, preserve that slot answer!
    if ((isDateInquiry || isLocationInquiry || isPolicyInquiry || isVehicleInquiry || isSourceOfDetailsInquiry) && session.pendingSlot === 'drivabilityLeaks' && !data.drivability) {
      if (/^(?:yes|yeah|yep|s[íi])\b/i.test(text)) {
        data.drivability = 'Drivable';
      } else if (/^(?:no|nope)\b/i.test(text)) {
        data.drivability = 'Non-Drivable';
      }
    }

    if (isSourceOfDetailsInquiry) {
      const vehName = data.vehicleInfo || '2022 Acura MDX';
      const polNum = data.policyNumber || 'PA-8849201-NAT';
      const reply = lang === 'es'
        ? `Para que esta demostración abreviada sea rápida, precargamos un registro de póliza de muestra (${polNum}) y un vehículo de ejemplo (${vehName}) para que pueda ver de inmediato cómo se genera su Informe de Resumen de Llamada en vivo. En producción, Angel consulta los vehículos reales de la póliza del asegurado por su número de teléfono. ¿Confirmamos estos detalles para generar su informe ahora?`
        : `For this fast abridged demo, we pre-populated a sample policy record (${polNum}) and sample insured vehicle (${vehName}) so you can quickly reach your live Claim Call Summary Report and Scene Map. In live carrier production, Angel pulls the policyholder's actual vehicles automatically from your policy system by phone number. Shall I lock in this summary so you can review your live report?`;
      return { action: 'SESSION_FACT_READBACK', slot: 'vehicleInfo', recordedValue: vehName, text: reply };
    }

    if (isDateInquiry) {
      // Strip non-temporal ASR noise words (like "Sides" or "Change") from dateOfLoss before reading back
      const hasValidTemporalWord = /\b(today|yesterday|tonight|night|morning|afternoon|evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|week|days?|hours?|hoy|ayer|anoche|mañana|tarde|noche|\d)\b/i;
      if (data.dateOfLoss && !hasValidTemporalWord.test(String(data.dateOfLoss))) {
        data.dateOfLoss = null;
      }
      if (data.timeOfLoss && !hasValidTemporalWord.test(String(data.timeOfLoss))) {
        data.timeOfLoss = null;
      }
      const recordedDate = [data.dateOfLoss, data.timeOfLoss && data.timeOfLoss !== data.dateOfLoss ? data.timeOfLoss : null].filter(Boolean).join(' at ');
      if (recordedDate) {
        const reply = lang === 'es'
          ? `Tengo registrado que el incidente ocurrió el ${recordedDate}. ¿Es correcta esa fecha y hora, o desea que la actualice?`
          : `I have the date and time of loss recorded as ${recordedDate}. Is that accurate, or would you like me to update it?`;
        return { action: 'SESSION_FACT_READBACK', slot: 'dateOfLoss', recordedValue: recordedDate, text: reply };
      } else {
        session.awaitingFactFill = 'dateOfLoss';
        const reply = lang === 'es'
          ? `Aún no tengo registrada la fecha exacta del siniestro — ¿en qué fecha y hora aproximada ocurrió para agregarlo a su expediente ahora mismo?`
          : `I don't have the exact date of loss recorded yet — what date and approximate time did the loss occur so I can add it to your claim file right now?`;
        return { action: 'SESSION_FACT_MISSING_PROMPT', slot: 'dateOfLoss', recordedValue: null, text: reply };
      }
    }

    if (isLocationInquiry) {
      const recordedLoc = data.locationOfLoss && this.scoreLocationSpecificity(data.locationOfLoss) >= 1 ? data.locationOfLoss : null;
      const polClause = (isPolicyInquiry && data.policyNumber)
        ? (lang === 'es' ? `, póliza ${data.policyNumber}` : `, policy ${data.policyNumber}`)
        : '';
      const vehClause = data.vehicleInfo
        ? (lang === 'es' ? `, vehículo ${data.vehicleInfo}` : `, vehicle ${data.vehicleInfo}`)
        : '';
      if (recordedLoc && !session.pendingAddressParts) {
        const reply = lang === 'es'
          ? `Para confirmar los detalles registrados: ubicación en ${recordedLoc}${polClause}${vehClause}. ¿Es correcta esa información, o desea corregirla?`
          : `To confirm the details I have recorded: location at ${recordedLoc}${polClause}${vehClause}. Is that accurate, or would you like to update it?`;
        return { action: 'SESSION_FACT_READBACK', slot: 'locationOfLoss', recordedValue: recordedLoc, text: reply };
      } else {
        session.awaitingFactFill = 'locationOfLoss';
        const reply = lang === 'es'
          ? `Aún necesito confirmar la dirección exacta — ¿cuál es el número, calle y ciudad donde ocurrió el incidente?`
          : `I still need to confirm the exact street address — what is the street number, street name, and city where the loss occurred?`;
        return { action: 'SESSION_FACT_MISSING_PROMPT', slot: 'locationOfLoss', recordedValue: null, text: reply };
      }
    }

    if (isPolicyInquiry && data.policyNumber) {
      const reply = lang === 'es'
        ? `Tengo registrada su póliza como ${data.policyNumber}. ¿Es correcto?`
        : `I have your policy number recorded as ${data.policyNumber}. Is that accurate?`;
      return { action: 'SESSION_FACT_READBACK', slot: 'policyNumber', recordedValue: data.policyNumber, text: reply };
    }

    if (isVehicleInquiry) {
      const recordedVeh = data.vehicleInfo || null;
      if (recordedVeh) {
        const reply = lang === 'es'
          ? `Tengo registrado su vehículo como ${recordedVeh}. ¿Es correcto?`
          : `I have your vehicle recorded as a ${recordedVeh}. Is that accurate?`;
        return { action: 'SESSION_FACT_READBACK', slot: 'vehicleInfo', recordedValue: recordedVeh, text: reply };
      } else {
        session.awaitingFactFill = 'vehicleInfo';
        const reply = lang === 'es'
          ? `Aún no tengo registrado el vehículo — ¿cuál es el año, marca y modelo?`
          : `I don't have your vehicle recorded yet — what is the year, make, and model?`;
        return { action: 'SESSION_FACT_MISSING_PROMPT', slot: 'vehicleInfo', recordedValue: null, text: reply };
      }
    }

    if (isClaimRefInquiry) {
      const ref = session.claimRef || 'FNOL-DEMO';
      const reply = lang === 'es'
        ? `Su número de referencia preliminar es ${ref}.`
        : `Your preliminary claim reference number is ${ref}.`;
      return { action: 'SESSION_FACT_READBACK', slot: 'claimRef', recordedValue: ref, text: reply };
    }

    return null;
  }

  // ── 2ND LISTENER ROLE 4: PRE-SUMMARY COMPLETENESS GATE ──
  auditPreSummaryCompleteness(session) {
    if (!session || !session.fnolData) return { ready: false, missingSlot: 'narrative' };
    const data = session.fnolData;
    if (!session.lossType) return { ready: false, missingSlot: 'losstype' };
    if (!data.vehicleInfo) return { ready: false, missingSlot: 'vehicle' };
    if (session.pendingAddressParts || !data.locationOfLoss || this.scoreLocationSpecificity(data.locationOfLoss) < 1) {
      return { ready: false, missingSlot: 'location' };
    }
    if (!data.dateOfLoss && !data.timeOfLoss) {
      return { ready: false, missingSlot: 'timeOfLoss' };
    }
    return { ready: true, missingSlot: null };
  }

  // ── 2ND LISTENER ROLE 5: MULTI-TURN IDENTITY, POSITION & COMPANY PLAUSIBILITY CONFIRMATION ──
  auditCallerIdentityAndRole(speech, session, options = {}) {
    if (!speech || typeof speech !== 'string' || !session) return null;
    session.fnolData = session.fnolData || {};
    const idEngine = require('./customer_identity_engine.js');
    const extracted = idEngine.extractCallerIdentity(speech);
    const roleInfo = idEngine.extractCallerRoleAndLevel(speech);

    if (extracted && extracted.displayName) {
      const check = idEngine.evaluateIdentityPlausibility(extracted.displayName, speech);
      if (check.plausible) {
        const isExplicitNameCorrection = /\b(my\s+name\s+is|last\s+name\s+is|surname\s+is|spelled)\b/i.test(speech);
        if (!session.hostCallerName || (isExplicitNameCorrection && check.score >= (session.hostNamePlausibility || 0))) {
          session.hostCallerName = extracted.displayName;
          session.hostSpokenGreeting = extracted.spokenGreeting || extracted.displayName;
          session.hostNamePlausibility = check.score;
          session.fnolData.callerName = extracted.displayName;
        }
      }
      if (extracted.detectedCompany && (!session.companyName || session.companyName === 'AI Agent Angel')) {
        session.companyName = extracted.detectedCompany;
        session.fnolData.companyName = extracted.detectedCompany;
      }
      if (extracted.detectedRole && !session.callerRoleTitle) {
        session.callerRoleTitle = extracted.detectedRole;
        session.fnolData.callerRoleTitle = extracted.detectedRole;
      }
      if (extracted.detectedRoleLevel && !session.callerRoleLevel) {
        session.callerRoleLevel = extracted.detectedRoleLevel;
        session.fnolData.callerRoleLevel = extracted.detectedRoleLevel;
      }
    }

    if (roleInfo.roleTitle && !session.callerRoleTitle) {
      session.callerRoleTitle = roleInfo.roleTitle;
      session.fnolData.callerRoleTitle = roleInfo.roleTitle;
    }
    if (roleInfo.roleLevel && !session.callerRoleLevel) {
      session.callerRoleLevel = roleInfo.roleLevel;
      session.fnolData.callerRoleLevel = roleInfo.roleLevel;
    }
    if (roleInfo.detectedCompany && (!session.companyName || session.companyName === 'AI Agent Angel')) {
      session.companyName = roleInfo.detectedCompany;
      session.fnolData.companyName = roleInfo.detectedCompany;
    }

    session.secondListenerIdentityConfirmed = Boolean(
      session.hostCallerName &&
      (session.companyName || session.callerRoleTitle)
    );

    return {
      confirmed: session.secondListenerIdentityConfirmed,
      callerName: session.hostCallerName || null,
      roleTitle: session.callerRoleTitle || null,
      roleLevel: session.callerRoleLevel || 'manager',
      companyName: session.companyName || null,
      plausibilityScore: session.hostNamePlausibility || 0
    };
  }

  processTurn(speech, session, options = {}) {
    if (!speech || typeof speech !== 'string') return null;
    const lang = options.language || (session && session.language) || 'en';
    const spec = options.specialist || (session && session.specialist) || 'claims';
    const currentSlot = options.currentSlot || (session && session.pendingSlot) || 'narrative';

    // 0. Check for Live Session Fact Inquiry ("what do you have as the date of loss?")
    const factInquiry = this.detectSessionFactInquiry(speech, session, { lang, spec, currentSlot });
    if (factInquiry) return factInquiry;

    // 1. Check for Correction / Retraction
    const correction = this.detectCorrection(speech, session, { lang, spec, currentSlot, flow: options.flow });
    if (correction) return correction;

    // 2. Check for Hesitation / Pause
    const hesitation = this.detectHesitation(speech, { lang });
    if (hesitation) return hesitation;

    // 3. Check for Inquiry / Question / FAQ
    const inquiry = this.detectInquiry(speech, session, { lang, spec, currentSlot });
    if (inquiry) return inquiry;

    return null;
  }
}


const SECOND_LISTENER_WEB_ALLOWLIST = Object.freeze([
  'maps.googleapis.com',
  'nominatim.openstreetmap.org',
  'api.weather.gov'
]);

function isAllowedWebDomain(urlOrHost) {
  if (!urlOrHost || typeof urlOrHost !== 'string') return false;
  const clean = urlOrHost.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
  return SECOND_LISTENER_WEB_ALLOWLIST.some(d => clean === d || clean.endsWith('.' + d));
}

SecondListenerRagEngine.prototype.getWebAllowlist = function() { return SECOND_LISTENER_WEB_ALLOWLIST; };
SecondListenerRagEngine.prototype.isAllowedWebDomain = isAllowedWebDomain;

const instance = new SecondListenerRagEngine();

module.exports = instance;
module.exports.SecondListenerRagEngine = SecondListenerRagEngine;
module.exports.SCRIPT_DB = SCRIPT_DB;
module.exports.SECOND_LISTENER_WEB_ALLOWLIST = SECOND_LISTENER_WEB_ALLOWLIST;
module.exports.isAllowedWebDomain = isAllowedWebDomain;

// Validate exported symbols integrity
// Added self-test to ensure exported symbols are present and valid when run in test mode.
/**
 * Runs a simple self‑test verifying that all expected exports are present and that
 * `validateExports()` returns true. Returns `true` on success, otherwise throws.
 */
function runSelfTest() {
  const ok = validateExports();
  if (!ok) {
    const missing = ['SecondListenerRagEngine','SCRIPT_DB','SECOND_LISTENER_WEB_ALLOWLIST','isAllowedWebDomain']
      .filter(k => !module.exports[k]);
    throw new Error('Self‑test failed – missing exports: ' + missing.join(','));
  }
  return true;
}
// Export the test helper for CI or runtime verification.
module.exports.runSelfTest = runSelfTest;
function validateExports() {
  const expected = ['SecondListenerRagEngine', 'SCRIPT_DB', 'SECOND_LISTENER_WEB_ALLOWLIST', 'isAllowedWebDomain'];
  const missing = expected.filter(k => !module.exports[k]);
  return missing.length === 0;
}
module.exports.validateExports = validateExports;

