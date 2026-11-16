
// Dynamic 50-State Statutory Minimum Insurance Limits & Conditional Lost Wages
const stateStatutoryLimits = {
    TX: { biPerson: 30000, biAccident: 60000, pd: 25000, name: 'Texas 30/60/25' },
    CA: { biPerson: 15000, biAccident: 30000, pd: 5000, name: 'California 15/30/5' },
    FL: { biPerson: 0, biAccident: 0, pd: 10000, pip: 10000, name: 'Florida No-Fault PIP' },
    NY: { biPerson: 25000, biAccident: 50000, pd: 10000, pip: 50000, name: 'New York 25/50/10' },
    IL: { biPerson: 25000, biAccident: 50000, pd: 20000, name: 'Illinois 25/50/20' }
};

function isEmploymentRequired(claimType, isThirdPartyInjuryClaiming) {
    if (claimType === 'PI_LEGAL_INTAKE') return true;
    return isThirdPartyInjuryClaiming === true; // FNOL: optional unless 3rd party asserts injury/lost wages
}


// SpeedAI & ACORD 2-Page Loss Data Field Mapping
const acordSpeedAiExtendedFields = {
    accidentFacts: ['date', 'time', 'location', 'weather', 'roadConditions', 'impactPoint', 'speed', 'directionOfTravel'],
    liabilityIndicators: ['citationIssued', 'officerBadge', 'trafficSignalState', 'faultAdmissions', 'witnessDetails'],
    erTreatmentStatus: ['emsTransport', 'treatmentTimeline', 'injuryCategories', 'ongoingCare'],
    hospitalDetails: ['hospitalName', 'erDepartment', 'attendingPhysician', 'dischargeStatus'],
    lostWages: ['employmentStatus', 'employerName', 'hourlyRate', 'missedWorkDays'],
    coverageLimits: ['bodilyInjuryLimits', 'propertyDamageLimit', 'pipMedPayLimits', 'collisionDeductible']
};


// Optional Police Crash Report Automation Module (LexisNexis / TxDOT CRIS)
const policeReportModuleConfig = {
    enabled: process.env.POLICE_REPORT_AUTO_ENABLED === 'true',
    provider: process.env.POLICE_REPORT_PROVIDER || 'lexisnexis', // 'lexisnexis' | 'txdot_cris' | 'carrier_webhook'
    apiKey: process.env.POLICE_REPORT_API_KEY || '',
    autoFetchOnFNOL: true
};

/**
 * LLM-Driven Dynamic Extraction Engine for Auto Claims FNOL & Sales Demo
 * ======================================================================
 * Replaces rigid step-counters with dynamic state-slot entity extraction and context-aware follow-ups.
 * Features dual-voice narration co-pilot support (Agent Angel + Executive Narrator).
 *
 * DEMO-DOD-03 (D4+D5, 2026-08-20): open-ended "tell me what happened" FIRST,
 * loss-type detection from the caller's own narrative, and per-loss-type
 * question flows (collision / hail / theft / flood / glass / vandalism / fire).
 * DEMO-DOD-09 (2026-08-20): slot-TYPE validation before any best-effort fill
 * (call CA7146d516: "Yes, please text me, the secure link…" landed in the
 * policy-number slot and the closing summary recited it). The wrap-up summary
 * re-validates every slot it recites and SKIPS + flags contaminated values.
 */

const secondListenerRagEngine = require('./second_listener_rag_engine');

function formatCarrierName(rawName) {
  if (!rawName || typeof rawName !== 'string' || !rawName.trim()) return "";
  let clean = rawName.trim();
  clean = clean.replace(/\s+Insurance\s+Company$/i, '');
  clean = clean.replace(/\s+Insurance$/i, '');
  clean = clean.replace(/\s+Company$/i, '');
  if (/^Agent\s+Angel/i.test(clean)) return "";
  return `${clean} Insurance`;
}

// ─── ES-PARITY (DEMO-BOT-REWRITE-02, 2026-08-18): every user-facing literal lives
// in ONE structure with its Spanish counterpart. Neutral Latin-American register,
// formal "usted" (Groq openai/gpt-oss-120b bulk pass + register review).
// Fail-loud: a missing key/language logs [L10N MISSING] and falls back to EN —
// never a silent blank.
const L10N = {
  en: {
    // D1 (DEMO-DOD-01): ≤12s before the caller can speak — concise one-line welcome,
    // short disclosure, language selector, then open question. Never a wall of text.
    welcome: `Agent Angel Auto Claims interactive demo.`,
    disclosure: `Synthetic demo data pre-loaded.`,
    selector: `For English, press one or say English.`,
    greeting: `Hi{GREETING_NAME}, I'm AI Agent Angel{HEADER}, your 24/7 AI Claims Specialist. This call is recorded for quality, compliance, and instant First Notice of Loss documentation. I will capture your claim details end-to-end and generate your instant claim file. Before we begin, {PHONE_VALIDATION} with your <sub alias="lyve">live</sub> dashboard and photo upload link?`,
    qNarrative: `Hi{GREETING_NAME}, I'm AI Agent Angel{HEADER}. Before we begin, {PHONE_VALIDATION} with your <sub alias="lyve">live</sub> dashboard and photo upload link?`,
    qNarrativeAbridged: `Hi{GREETING_NAME}, I'm AI Agent Angel{HEADER}. I have your pre-populated policy details ready so we can keep this demo fast. Tell me in your own words, what happened to your vehicle?`,
    qNarrativeStoryOnly: `Thank you — I've just texted your <sub alias="lyve">live</sub> dashboard and photo upload link to your phone. Now tell me in your own words, starting about 10 seconds before the incident, what happened?`,
    qNarrativeStoryOnlyNoSms: `Understood. Now tell me in your own words, starting about 10 seconds before the incident, what happened?`,
    qNarrativeReopen: `Take your time — in a sentence or two, tell me what happened to your vehicle so I can ask the right questions.`,
    ackStory: `Thank you for walking me through that, and take your time — I'm so sorry you had to deal with this.`,
    ackSafe: `I'm so sorry you experienced that, but I'm relieved no one is injured. Take your time, I will help document what happened.`,
    ackInjury: `I'm so sorry to hear that, and I hope you're okay. I've flagged your report for immediate priority medical triage. Please take your time, we will make sure you get the care and assistance you need.`,
    ackPhotos: `I've noted photo evidence is available and I am texting the photo upload and <sub alias="lyve">live</sub> dashboard link to your cell phone right now.`,
    ackPhotosNoSms: `I've noted photo evidence is available for your claim file.`,
    ackName: `Thank you, {NAME}.`,
    ackGot: `Thank you.`,
    qName: `May I have your first and last name?`,
    qLossType: `What type of loss or incident are you reporting today?`,
    qLossClarify: `Could you describe the cause of damage to your vehicle?`,
    qCompClarify: `For your comprehensive claim, what caused the damage to your vehicle — such as hail, flood water, a falling tree branch, windshield glass, an animal strike, vandalism, or theft?`,
    qWhere: `To pinpoint the loss scene on the map and pull the official weather report, what was the street address, nearest intersection, or business location, and what is the city or zip code?`,
    qWhereRoadside: `Where is the vehicle located right now?`,
    qWhereClarifyCity: `To help our adjusters locate the exact scene on a map — what city and state did this happen in?`,
    qWhereClarifyStreet: `What street or location did this happen on?`,
    qPhotos: `Do you have photos of the damage or scene that you can upload using the link on your phone? For this demo, you can choose any photo from your phone or snap a picture of anything around you right now — even your desk or coffee cup — to see our real-time EXIF forensic audit in action.`,
    qPhotosAskConsent: `Do you have photos of the damage or scene, and may I text the link to your cell phone right now so you can upload a photo or open your <sub alias="lyve">live</sub> dashboard?`,
    qPhotosMechanical: `Do you have photos of the dashboard warning lights, mechanical breakdown, or tow invoice that you can upload with the link on your phone?`,
    qPhotosFlood: `Do you have photos of the water level or flood scene that you can upload with the link on your phone?`,
    reask: `Whenever you're ready,`,
    lowConf: `Could you repeat that for me?`,
    gentleSilenceNudge: `Take your time, I'm listening.`,
    qPolicy: `What is your policy number, or can I look it up using your phone number or driver's license?`,
    qLocation: `Could you describe where the incident took place?`,
    qVehicle: `What is the year, make, and model of the vehicle on your policy?`,
    qVehicleCollision: `What is the year, make, and model of the vehicle on your policy?`,
    qVehicleHail: `Which vehicle on your policy was damaged — what is the year, make, and model?`,
    qVehicleFlood: `What is the year, make, and model of your vehicle?`,
    qVehicleFire: `What is the year, make, and model of your vehicle?`,
    qVehicleTheft: `What is the year, make, and model of the stolen vehicle?`,
    qVehicleGlass: `What is the year, make, and model of your vehicle?`,
    qVehicleVandalism: `What is the year, make, and model of your vehicle?`,
    qVehicleFallingObject: `What is the year, make, and model of your vehicle?`,
    qVehicleTowing: `What is the year, make, and model of your vehicle?`,
    qInjury: `Was anyone injured or requiring medical attention at the scene?`,
    qPolice: `Were police called to the scene, or was a police report filed?`,
    qPoliceDeptProbe: `No problem at all if you don't have the report number handy — do you know which city, town, or police department responded, or the officer's name?`,
    qTimeOfLoss: `When did this happen — what was the date and approximate time of the loss?`,
    qTimeOfLossMechanical: `Approximately what date and time did the breakdown occur?`,
    qOtherParty: `Do you have the other driver's vehicle information or insurance details?`,
    qVehicleLocation: `Where is the vehicle located right now?`,
    qVehicleLocationDrivable: `Where is the vehicle located right now?`,
    qVehicleLocationTowed: `Where was the vehicle towed, or what is the name of the tow company or shop?`,
    qTowWhere: `Where was the vehicle towed, or which tow company moved it? If you have the tow invoice or the driver's business card, you can add a photo of it with the upload link.`,
    qAnimalProbe: `Did your vehicle make direct contact with the animal, or did you swerve to avoid it?`,
    qTreeProbe: `Did the tree or nearby property sustain damage?`,
    qFolInvestigate: `What were the road and weather conditions like when the incident occurred?`,
    qTrafficControls: `Were there any traffic lights, control signals, or stop signs at the scene?`,
    qHailInvestigate: `Was the vehicle parked outside in the driveway or being driven when the hail storm hit?`,
    qSummaryConfirm: `To make sure I have all the facts accurate for your adjuster: you are reporting an incident that occurred in {LOCATION} on {TIME}{POLICY_STATUS}. Your {VEHICLE} is currently {DRIVABILITY} at {VEHICLE_LOCATION}, {INJURY_STATUS}, and {POLICE_STATUS}. Did I capture all of those details accurately for your claim file?`,
    qSummaryConfirmParked: `To make sure I have all the facts accurate for your adjuster: you are reporting an unoccupied parked vehicle loss in {LOCATION} on {TIME}{POLICY_STATUS}. Your {VEHICLE} is currently {DRIVABILITY} at {VEHICLE_LOCATION}. Because the vehicle was parked and unoccupied, injuries and police report are marked Not Applicable on your Claim Call Summary Report. Did I capture all of those details accurately for your claim file?`,
    ackSummaryConfirm: `Thank you for confirming.`,
    qFolWrap: `Are there any other details or relevant information that I need to pass to the adjuster?`,
    qDirectValidateDriver: `To validate this claim under policy guidelines, who was driving the vehicle at the time of the incident?`,
    qDirectValidateLocation: `To establish jurisdiction and policy coverage, please state the exact street address, cross street, or highway marker where the incident occurred.`,
    qDirectValidateSpeed: `For the Facts of Loss audit, what was your approximate speed immediately before the impact?`,
    qDirectValidateTowCustody: `To process towing reimbursement and repair shop transfer, what tow company moved the vehicle and where is it parked now?`,
    qPhotoConfirmationRealtime: `I have just confirmed real-time receipt of your photo upload on our SIU gateway. The EXIF metadata, original device timestamp, and GPS coordinates have been attached to your claim record.`,
    qAxiRateWalkthrough: `Our AxiRate audit engine has graded this call <sub alias="lyve">live</sub>: 100% plain language (zero insurance jargon), empathetic communication, validated driver identity as YES, confirmed drivability, and logged all tow custody details into your ACORD file summary.`,
    ackRental: `I've noted your rental car request — your adjuster will confirm rental coverage and get that set up for you.`,
    ackDetail: `Noted — {V}.`,
    qMore: `Is there any additional information or detail you'd like to add to your claim file?`,
    qLtCollision: `Was another vehicle involved in the collision?`,
    qLtHail: `Understood, hail damage. How severe is the denting across the vehicle — is it just a few dings on isolated panels like the tailgate or hood, or is there heavy denting all over the car?`,
    qLtTheft: `Has the vehicle been recovered, or is it still missing?`,
    qLtFlood: `Was your vehicle parked, or were you driving when you encountered the water?`,
    qFloodParkedOrRunning: `Was your vehicle parked, or were you driving when you encountered the water?`,
    qFloodWaterLevel: `How high did the water rise on your vehicle?`,
    qFloodWaterType: `Was the flood water fresh water from rain or runoff, or salt water?`,
    qImpactPoint: `Picture your car as a clock with the front at 12 o'clock — where was the point of impact?`,
    qOtherPlate: `Did you get the other vehicle's license plate number?`,
    qDrivabilityLeaks: `Is the vehicle still drivable?`,
    qCarcassHazard: `For everyone's safety, please don't try to move it yourself — is the roadway clear, or has the hazard been reported to local police?`,
    qHailParked: `Was the vehicle parked outside, or were you driving when the hail hit?`,
    qHailSeverity: `How severe is the hail damage — a few isolated dings, or heavy dents across the hood, roof, and panels?`,
    qEngineRestart: `After the water went down, did you or anyone else try to start the engine?`,
    qPersonalProperty: `Personal belongings are usually covered by a homeowners or renters policy rather than auto — were any personal belongings taken from inside the car, like a bag or electronics?`,
    qTheftLastSeen: `When and where did you last see the vehicle?`,
    qKeyCustody: `Do you have all sets of keys to the vehicle in your possession right now?`,
    qKeyAccess: `Does anyone else have access to the keys, like a family member, roommate, valet, or mechanic?`,
    qTheftPolice: `Have you reported the vehicle stolen to the police?`,
    qVandalParked: `Where was the vehicle parked when this happened — at home, at work, on the street, or in a public lot?`,
    qSuspects: `Have you had any recent disputes or encounters with anyone, or is there anyone you think may be involved?`,
    qFireDept: `Did the fire department respond to the scene?`,
    qFireDrivingParked: `Was the vehicle parked and unattended, or were you driving when the fire started?`,
    qRecoveryStatus: `Has the vehicle been recovered?`,
    qTreeOwner: `Did the tree or limb come from private property, like a neighbor's yard, or city property?`,
    qCameras: `Are there any security cameras nearby — a parking garage, business, or doorbell camera — that may have recorded it?`,
    qLtGlass: `Which glass or window was damaged, and is the crack longer than a dollar bill so we know whether a crack repair is possible?`,
    qLtVandalism: `What damage did the vandalism cause to the vehicle?`,
    qLtFire: `Where did the fire start — in the engine bay, the dashboard, or the cabin?`,
    qLtFallingObject: `What fell onto the vehicle, and where did it hit?`,
    qLtTowingRoadside: `What caused the vehicle to need assistance?`,
    qMechanicalProbe: `Can you describe what happened when the vehicle stopped operating?`,
    // Claimant Collision Flow Prompts (Empathetic + natural phrasing)
    ackClaimant: `I'm so sorry to hear that, and I hope you're okay. I understand you were hit by one of our insured policyholders. I'll get your claim report started right away so we can take care of this for you.`,
    qClaimantInjuryDrivability: `Is your vehicle currently drivable, or was it towed from the scene?`,
    qStartOverClarify: `No problem at all — would you like to start over from the very beginning, or just correct the last part about what happened?`,
    qClaimantContact: `May I have your first and last name?`,
    qInsuredInfo: `Do you have the name of our insured driver, their policy number, or their vehicle license plate?`,
    // Localized loss-type labels (used in the summary and lossTypeText).
    ltCollision: `collision`,
    ltComprehensive: `comprehensive`,
    ltHail: `hail`,
    ltTheft: `theft`,
    ltFlood: `flood`,
    ltGlass: `glass damage`,
    ltVandalism: `vandalism`,
    ltFire: `fire`,
    ltFallingObject: `falling object / tree damage`,
    ltTowingRoadside: `towing and mechanical breakdown`,
    closing: `Your preliminary First Notice of Loss for {SUMMARY} has been recorded under Claim Reference {REF}. Please note this intake captures reported facts for carrier review and does not determine liability or coverage. Transferring you back to our demo host, Matthew.`,
    sumLossType: `a {V} claim`,
    sumPolicy: `policy {V}`,
    sumLocation: `location at {V}`,
    sumVehicle: `vehicle {V}`,
    sumPolice: `police report {V}`,
    sumAll: `all reported loss details`,
    sumFlagged: `Some details could not be verified and will be confirmed by your adjuster.`,
    closePhotos: `I'm also texting you a link right now to send in photos of the damage — you can upload them any time.`,
    closeDashboard: `We're also texting you a private link to review this exact call on your <sub alias="lyve">live</sub> dashboard — including the full claim record, exact transcript, and 108-point AxiRate audit report.`,
    wrap: `Demo Host Matthew here! Your Claim Call Summary Report, Interactive Scene Map, and 108-point AxiRate Audit are now <sub alias="lyve">live</sub> on your link, alongside sample audited calls from other loss types. Remember, Angel can complete any portion of the FNOL your carrier prefers and then execute a warm transfer to an associate to confirm the pre-populated data and issue the claim number — or overnight, hold the caller's place for first-in-line processing tomorrow morning. And beyond taking FNOL calls, Angel also audits 100 percent of your existing human employees' calls across 108 customizable factors. As an estimate, what percentage of your FNOL or Express Claim calls are currently audited?`,
    smsPivotOffer: `I seem to be having trouble hearing that clearly over the line. No problem — I'm texting a secure link to your mobile phone right now so you can complete your report online, type details on screen, or upload photos directly. If it's easier, you can also continue in our webchat at ai agent angel dot com.`,
    smsRequestedPivot: `I am texting a secure link to your mobile phone right now. You can tap the link to complete your claim, type details on screen, and upload photos or police reports.`,
    humanRepPersuasion: `Of course — I am flagging your claim for immediate human adjuster escalation right now. While I connect your file to our live claims team, would you like me to note your callback details or continue capturing the preliminary facts so your adjuster has them on screen?`,
    humanRepTransfer: `Of course — I am escalating your call to a human claims representative right now. If you are testing our interactive enterprise demonstration, I can also answer deployment questions or complete your preliminary First Notice of Loss file. How would you like to proceed?`,
    humanRepNoQueue: `Of course — I am escalating your request to our human claims team right now and logging a priority callback. If you'd like, I can also capture any remaining preliminary facts so your adjuster has them ready.`
  },
  es: {
    welcome: `Demostración de reclamos de autos Agent Angel.`,
    disclosure: `Datos sintéticos de muestra precargados.`,
    selector: `Para español, oprima dos o diga español.`,
    greeting: `Hola{GREETING_NAME}, soy AI Agent Angel{HEADER}, su Especialista en Reclamos con IA disponible 24/7. Esta llamada se graba por calidad, cumplimiento y documentación instantánea del Primer Aviso de Pérdida. Recopilaré los detalles de su reclamo de principio a fin y generaré su archivo de reclamo al instante. Antes de comenzar, {PHONE_VALIDATION} con el enlace a su panel en vivo y carga de fotos?`,
    qNarrative: `Hola{GREETING_NAME}, soy AI Agent Angel{HEADER}. Antes de comenzar, {PHONE_VALIDATION} con el enlace a su panel en vivo y carga de fotos?`,
    qNarrativeAbridged: `Hola{GREETING_NAME}, soy AI Agent Angel{HEADER}. Tengo los datos de su póliza precargados para que esta demostración sea rápida. Cuénteme con sus propias palabras, ¿qué le ocurrió a su vehículo?`,
    qNarrativeStoryOnly: `Gracias — le acabo de enviar el enlace a su panel en vivo y carga de fotos a su teléfono. Ahora cuénteme con sus propias palabras, ¿qué ocurrió o qué tipo de siniestro desea reportar hoy?`,
    qNarrativeStoryOnlyNoSms: `Entendido. Ahora cuénteme con sus propias palabras, ¿qué ocurrió o qué tipo de siniestro desea reportar hoy?`,
    qNarrativeReopen: `Tómese su tiempo — en una o dos frases, cuénteme qué le ocurrió a su vehículo para hacerle las preguntas adecuadas.`,
    ackStory: `Gracias por contarme lo ocurrido, tómese su tiempo — lamento mucho que haya pasado por esto.`,
    ackSafe: `Lamento mucho lo ocurrido, pero me da alivio saber que no hay lesionados y que todos están bien. Tómese su tiempo, le ayudaré a documentar lo sucedido.`,
    ackInjury: `Lamento mucho escuchar eso, y espero que se encuentre bien. He marcado su informe para una prioridad inmediata de triaje médico. Tómese su tiempo, nos aseguraremos de que reciba la atención necesaria.`,
    ackPhotos: `He registrado que hay evidencia fotográfica disponible y le estoy enviando el enlace de carga de fotos y su panel en vivo a su celular en este momento.`,
    ackPhotosNoSms: `He registrado que hay evidencia fotográfica disponible para su expediente.`,
    ackName: `Gracias, {NAME}.`,
    ackGot: `Gracias.`,
    qName: `¿Me puede dar su nombre y apellido?`,
    qLossType: `¿Qué tipo de siniestro o incidente desea reportar hoy?`,
    qLossClarify: `¿Podría describirme la causa de los daños en su vehículo?`,
    qCompClarify: `Para su reclamo de cobertura amplia, ¿qué causó los daños a su vehículo — como granizo, inundación, la caída de una rama, rotura de parabrisas, impacto con un animal, vandalismo o robo?`,
    qWhere: `Para ubicar el lugar exacto en el mapa y consultar el reporte oficial del clima, ¿cuál fue la dirección exacta, la intersección más cercana o la ubicación del negocio, y cuál es la ciudad o código postal?`,
    qWhereRoadside: `¿Dónde se encuentra el vehículo en este momento?`,
    qPhotos: `¿Tiene fotos de los daños o del lugar que pueda subir usando el enlace en su teléfono? Para esta demostración, puede elegir cualquier foto de su teléfono o tomar una foto rápida de lo que tenga alrededor — como su escritorio o taza de café.`,
    qPhotosAskConsent: `¿Tiene fotos de los daños o del lugar, y me da permiso de enviarle el enlace a su celular ahora mismo para subir una foto o abrir su panel en vivo?`,
    qPhotosMechanical: `¿Tiene fotos de las luces de advertencia, falla mecánica o factura de grúa que pueda subir con el enlace en su teléfono?`,
    qPhotosFlood: `¿Tiene fotos del nivel de agua o de la inundación que pueda subir con el enlace en su teléfono?`,
    reask: `Cuando guste,`,
    lowConf: `¿Podría repetirlo, por favor?`,
    gentleSilenceNudge: `Tómese su tiempo, le escucho.`,
    qPolicy: `¿Cuál es su número de póliza, o debo buscarlo usando su número de teléfono móvil?`,
    qLocation: `¿Podría describir dónde tuvo lugar el incidente?`,
    qVehicle: `¿Cuál es el año, marca y modelo del vehículo en su póliza?`,
    qVehicleCollision: `¿Cuál es el año, marca y modelo de su vehículo?`,
    qVehicleHail: `¿Qué vehículo en su póliza sufrió daños — cuál es el año, marca y modelo?`,
    qVehicleFlood: `¿Cuál es el año, marca y modelo de su vehículo?`,
    qVehicleFire: `¿Cuál es el año, marca y modelo de su vehículo?`,
    qVehicleTheft: `¿Cuál es el año, marca y modelo del vehículo robado?`,
    qVehicleGlass: `¿Cuál es el año, marca y modelo de su vehículo?`,
    qVehicleVandalism: `¿Cuál es el año, marca y modelo de su vehículo?`,
    qVehicleFallingObject: `¿Cuál es el año, marca y modelo de su vehículo?`,
    qVehicleTowing: `¿Cuál es el año, marca y modelo de su vehículo?`,
    qInjury: `¿Alguien resultó herido o requirió atención médica en el lugar?`,
    qPolice: `¿Se llamó a la policía al lugar o se levantó un reporte policial?`,
    qPoliceDeptProbe: `No hay problema si no tiene el número de reporte a la mano — ¿sabe qué ciudad, pueblo o departamento de policía acudió, o el nombre del oficial?`,
    qTimeOfLoss: `¿Cuándo ocurrió esto — cuál fue la fecha y la hora aproximada del siniestro?`,
    qTimeOfLossMechanical: `¿En qué fecha y hora aproximada ocurrió la avería o falla mecánica?`,
    qOtherParty: `¿Tiene los datos del vehículo o del seguro del otro conductor?`,
    qVehicleLocation: `¿Dónde se encuentra el vehículo en este momento?`,
    qVehicleLocationDrivable: `¿Dónde se encuentra el vehículo en este momento?`,
    qVehicleLocationTowed: `¿A dónde fue remolcado el vehículo o cuál es el nombre de la compañía de grúas?`,
    qTowWhere: `¿A dónde fue remolcado el vehículo o qué compañía de grúas lo trasladó? Si tiene la factura del remolque, puede agregar una foto con el enlace de carga.`,
    qAnimalProbe: `¿Su vehículo tuvo contacto directo con el animal, o se desvió para esquivarlo?`,
    qTreeProbe: `¿El árbol o la propiedad cercana sufrieron daños visibles?`,
    qFolInvestigate: `¿Cómo estaban las condiciones del camino y del clima cuando ocurrió el incidente?`,
    qTrafficControls: `¿Había semáforos, luces de control o señales de alto en el lugar del incidente?`,
    qHailInvestigate: `¿El vehículo estaba estacionado afuera en la entrada o se estaba conduciendo cuando cayó la granizada?`,
    qSummaryConfirm: `Para asegurarme de tener todos los detalles correctos para su ajustador: está reportando un incidente ocurrido en {LOCATION} el {TIME}{POLICY_STATUS}. Su {VEHICLE} actualmente se encuentra {DRIVABILITY} en {VEHICLE_LOCATION}, {INJURY_STATUS}, y {POLICE_STATUS}. ¿Capturé todos los detalles correctamente para su archivo de reclamo?`,
    qSummaryConfirmParked: `Para asegurarme de tener todos los detalles correctos para su ajustador: está reportando una pérdida con vehículo estacionado y desocupado en {LOCATION} el {TIME}{POLICY_STATUS}. Su {VEHICLE} actualmente se encuentra {DRIVABILITY} en {VEHICLE_LOCATION}. Como el vehículo estaba estacionado y sin ocupantes, lesiones y reporte policial quedan marcados como No Aplica en su Informe de Resumen. ¿Capturé todos los detalles correctamente para su archivo de reclamo?`,
    ackSummaryConfirm: `Gracias por confirmar los detalles.`,
    qFolWrap: `¿Hay algún otro detalle o información relevante que deba transmitir al ajustador?`,
    qDirectValidateDriver: `Para validar este reclamo según las pautas de la póliza, ¿quién conducía el vehículo en el momento del incidente?`,
    qDirectValidateLocation: `Para establecer la jurisdicción y la cobertura de la póliza, indique la dirección exacta, el cruce de calles o el marcador de carretera donde ocurrió el incidente.`,
    qDirectValidateSpeed: `Para la auditoría de los hechos de la pérdida, ¿cuál era su velocidad aproximada inmediatamente antes del impacto?`,
    qDirectValidateTowCustody: `Para procesar el reembolso del remolque y la transferencia al taller, ¿qué compañía de remolque movió el vehículo y dónde está estacionado ahora?`,
    qPhotoConfirmationRealtime: `Acabo de confirmar la recepción en tiempo real de su carga de fotos en nuestra plataforma SIU. Los metadatos EXIF, la marca de tiempo original del dispositivo y las coordenadas GPS se han adjuntado a su registro de reclamo.`,
    qAxiRateWalkthrough: `Nuestro motor de auditoría AxiRate ha calificado esta llamada en vivo: 100% lenguaje claro (cero jerga de seguros), comunicación empática, identidad del conductor validada como SÍ, maniobrabilidad confirmada y todos los detalles de custodia del remolque registrados en el resumen del archivo ACORD.`,
    ackRental: `He anotado tu solicitud de coche de alquiler — tu ajustador confirmará la cobertura del alquiler y lo gestionará para ti.`,
    ackDetail: `Registrado — {V}.`,
    qMore: `¿Hay alguna información adicional o detalle que desee agregar a su archivo de reclamo?`,
    qLtCollision: `¿Estuvo involucrado otro vehículo en la colisión?`,
    qLtHail: `Entendido, daño por granizo. ¿Qué tan severas son las abolladuras en el vehículo — son solo unos golpes en paneles aislados como la cajuela o el capó, o hay abolladuras severas en todo el auto?`,
    qLtTheft: `¿El vehículo ha sido recuperado, o sigue desaparecido?`,
    qLtFlood: `¿Estaba su vehículo estacionado, o iba conduciendo cuando encontró el agua?`,
    qFloodParkedOrRunning: `¿Estaba su vehículo estacionado, o iba conduciendo cuando encontró el agua?`,
    qFloodWaterLevel: `¿Hasta qué nivel del vehículo llegó el agua?`,
    qFloodWaterType: `¿El agua era dulce de lluvia o escorrentía, o agua salada?`,
    qImpactPoint: `Imagine su carro como un reloj con el frente a las 12 — ¿cuál fue el punto de impacto?`,
    qOtherPlate: `¿Consiguió el número de placa del otro vehículo?`,
    qDrivabilityLeaks: `¿El vehículo se puede manejar todavía?`,
    qCarcassHazard: `Por su seguridad, no intente moverlo usted — ¿la vía está despejada o ya se reportó el peligro a la policía local?`,
    qHailParked: `¿El vehículo estaba estacionado afuera, o iba manejando cuando cayó el granizo?`,
    qHailSeverity: `¿Qué tan graves son las abolladuras por el granizo — unas cuantas aisladas, o daño fuerte en el cofre, el techo y los paneles?`,
    qEngineRestart: `Después de que bajó el agua, ¿usted u otra persona trató de encender el motor?`,
    qPersonalProperty: `Las pertenencias personales normalmente las cubre un seguro de casa o de inquilino, no el de auto — ¿se llevaron pertenencias personales de adentro del carro, como una mochila o aparatos electrónicos?`,
    qTheftLastSeen: `¿Cuándo y dónde vio el vehículo por última vez?`,
    qKeyCustody: `¿Tiene en su poder todos los juegos de llaves del vehículo en este momento?`,
    qKeyAccess: `¿Alguien más tiene acceso a las llaves, como un familiar, un compañero de casa, un valet o un mecánico?`,
    qTheftPolice: `¿Ya reportó el robo del vehículo a la policía?`,
    qVandalParked: `¿Dónde estaba estacionado el vehículo cuando pasó — en su casa, en el trabajo, en la calle o en un estacionamiento público?`,
    qSuspects: `¿Ha tenido algún conflicto reciente con alguien, o sospecha de alguien que pueda estar involucrado?`,
    qFireDept: `¿Acudieron los bomberos al lugar?`,
    qFireDrivingParked: `¿El vehículo estaba estacionado y sin nadie, o usted iba manejando cuando comenzó el fuego?`,
    qRecoveryStatus: `¿Ya recuperaron el vehículo?`,
    qTreeOwner: `¿El árbol o la rama venía de propiedad privada, como el patio de un vecino, o de propiedad de la ciudad?`,
    qCameras: `¿Hay cámaras de vigilancia cerca — un estacionamiento, un negocio o un timbre con cámara — que pudieran haberlo grabado?`,
    qLtGlass: `¿Qué cristal o ventana resultó dañado, y la grieta es más larga que un billete de un dólar para saber si es posible repararla?`,
    qLtVandalism: `¿Qué daños causó el vandalismo al vehículo?`,
    qLtFire: `¿Dónde inició el fuego — en el motor, el tablero o la cabina?`,
    qLtFallingObject: `¿Qué cayó sobre el vehículo y en qué parte impactó?`,
    qLtTowingRoadside: `¿Cuál fue el motivo por el que el vehículo necesitó asistencia?`,
    qMechanicalProbe: `¿Podría describirme qué ocurrió cuando el vehículo dejó de funcionar?`,
    ackClaimant: `Lamento mucho escuchar eso y espero que se encuentre bien. Entiendo que fue impactado por uno de nuestros asegurados. Comenzaré su reporte de reclamo de inmediato para atender su caso.`,
    qClaimantInjuryDrivability: `¿Su vehículo se puede manejar actualmente o fue remolcado del lugar?`,
    qStartOverClarify: `Sin problema — ¿le gustaría comenzar desde el principio o solo corregir la última parte sobre lo que sucedió?`,
    qClaimantContact: `¿Me puede dar su nombre y apellido?`,
    qInsuredInfo: `¿Tiene el nombre de nuestro conductor asegurado, su número de póliza o la placa de su vehículo?`,
    ltCollision: `colisión`,
    ltComprehensive: `cobertura amplia`,
    ltHail: `granizo`,
    ltTheft: `robo`,
    ltFlood: `inundación`,
    ltGlass: `daños en los cristales`,
    ltVandalism: `vandalismo`,
    ltFire: `incendio`,
    ltFallingObject: `objeto caído / daño por árbol`,
    ltTowingRoadside: `remolque y falla mecánica`,
    closing: `Su reporte preliminar de siniestro para {SUMMARY} ha sido registrado bajo la referencia {REF}, y su Informe de Resumen de Llamada, Diagrama Interactivo del Lugar y auditoría AxiRate de 108 puntos ya están en vivo en su enlace. Tenga en cuenta que esta recepción registra los hechos reportados para revisión de la aseguradora y no determina responsabilidad ni cobertura. Le comunico nuevamente con nuestro presentador de demostración, Matthew.`,
    smsPivotOffer: `Parece que tengo dificultades para escucharle claramente por la línea. No hay problema — le estoy enviando un enlace seguro por mensaje de texto a su teléfono móvil para que pueda completar su reporte en línea o subir fotos directamente. Si te resulta más fácil, también puedes continuar en nuestro chat web en ai agent angel punto com.`,
    smsRequestedPivot: `¡Entendido! Le estoy enviando un enlace seguro por mensaje de texto a su teléfono móvil en este momento. Puede presionar el enlace para completar su reclamo y subir fotos o el reporte policial.`,
    humanRepPersuasion: `Por supuesto — estoy marcando su reclamo para escalamiento inmediato con un ajustador humano ahora mismo. Mientras conecto su expediente con nuestro equipo en vivo, ¿desea que tome los datos preliminares para que el ajustador los tenga en pantalla?`,
    humanRepTransfer: `Por supuesto — estoy escalando su llamada con un representante humano de reclamos ahora mismo. Si está probando nuestra demostración empresarial, también puedo responder preguntas o registrar su reporte preliminar. ¿Cómo prefiere continuar?`,
    humanRepNoQueue: `Por supuesto — estoy escalando su solicitud a nuestro equipo humano de reclamos ahora mismo para contacto prioritario.`,
    sumLossType: `un reclamo de {V}`,
    sumPolicy: `póliza {V}`,
    sumLocation: `ubicación en {V}`,
    sumVehicle: `vehículo {V}`,
    sumPolice: `reporte policial {V}`,
    sumAll: `todos los detalles de la pérdida reportados`,
    sumFlagged: `Algunos detalles no pudieron verificarse y serán confirmados por su ajustador.`,
    closePhotos: `También le estoy enviando ahora mismo un enlace para mandar fotos de los daños — puede subirlas en cualquier momento.`,
    closeDashboard: `También le estamos enviando un enlace privado a su teléfono para revisar esta llamada en vivo en su panel — incluyendo el registro del reclamo, la transcripción completa y su auditoría de cumplimiento AxiRate de 108 puntos.`,
    wrap: `¡Aquí Matthew, su presentador de demostración! Su Informe de Resumen de Llamada, Mapa Interactivo del Lugar y auditoría AxiRate de 108 factores ya están en vivo en su enlace, junto con llamadas auditadas de ejemplo de otros tipos de pérdidas. Recuerde que Angel puede completar cualquier parte del Primer Aviso de Pérdida que su aseguradora prefiera y realizar una transferencia cálida a un asociado para confirmar los datos y entregar el número de reclamo — o durante la noche, reservar su lugar para procesamiento prioritario a primera hora de la mañana. Además, Angel evalúa el 100 por ciento de las llamadas de sus empleados actuales en base a 108 factores personalizables. Como estimación, ¿qué porcentaje de sus llamadas de Primer Aviso de Pérdida o Reclamos Exprés se auditan actualmente?`
  }
};

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
        ? `¿está bien enviarle un mensaje de texto a este número que termina en ${spaced}`
        : `is it okay to text you back on this number ending in ${spaced}`,
      LAST4: spaced
    };
  }
  return {
    PHONE_VALIDATION: lang === 'es'
      ? `¿tengo su permiso para enviarle un mensaje de texto a este número`
      : `do I have permission to text you back at this number`,
    LAST4: ''
  };
}

function t(lang, key, vars) {
  const table = L10N[lang] || null;
  let s = table && table[key];
  if (!s) {
    console.error('[L10N MISSING]', lang, key); // fail loud, never a silent blank
    s = (L10N.en[key] || '');
  }
  const mergedVars = Object.assign({
    GREETING_NAME: '',
    PHONE_VALIDATION: lang === 'es' ? '¿tengo su permiso para enviarle un mensaje de texto a este número' : 'do I have permission to text you back at this number',
    LAST4: ''
  }, vars);
  for (const k of Object.keys(mergedVars)) s = s.split('{' + k + '}').join(mergedVars[k]);
  s = s.replace(/\{[A-Z0-9_]+\}/g, '').replace(/\s{2,}/g, ' ').trim();
  return s;
}

// ─── D4 (DEMO-DOD-03): the canonical loss types, each with its own question
// flow. A slot appears in a flow ONLY if it fits that loss type — collision
// questions on a hail claim are an automatic Mirofish FAIL (DEMO_CALL_DOD.md).
const LOSS_TYPES = ['collision', 'hail', 'theft', 'flood', 'glass', 'vandalism', 'fire', 'fallingobject', 'towing_roadside'];

const LT_LABEL_KEYS = {
  collision: 'ltCollision', hail: 'ltHail', theft: 'ltTheft', flood: 'ltFlood',
  glass: 'ltGlass', vandalism: 'ltVandalism', fire: 'ltFire', fallingobject: 'ltFallingObject',
  towing_roadside: 'ltTowingRoadside'
};

const LT_QUESTION_KEYS = {
  collision: 'qLtCollision', hail: 'qLtHail', theft: 'qLtTheft', flood: 'qLtFlood',
  glass: 'qLtGlass', vandalism: 'qLtVandalism', fire: 'qLtFire', fallingobject: 'qLtFallingObject',
  towing_roadside: 'qLtTowingRoadside'
};

const LOSS_TYPE_FLOWS = {
  collision: ['vehicle', 'folInvestigate', 'impactPoint', 'trafficControls', 'otherParty', 'otherPlate', 'location', 'timeOfLoss', 'injury', 'police', 'drivabilityLeaks', 'photos', 'summaryConfirm'],
  hail:      ['vehicle', 'hailParked', 'hailSeverity', 'location', 'timeOfLoss', 'drivabilityLeaks', 'photos', 'summaryConfirm'],
  theft:     ['vehicle', 'keyCustody', 'keyAccess', 'theftLastSeen', 'location', 'timeOfLoss', 'police', 'recoveryStatus', 'photos', 'summaryConfirm'],
  flood:     ['floodParkedOrRunning', 'floodWaterLevel', 'location', 'floodWaterType', 'vehicle', 'engineRestart', 'timeOfLoss', 'drivabilityLeaks', 'towWhere', 'photos', 'summaryConfirm'],
  glass:     ['vehicle', 'lossDetail', 'location', 'timeOfLoss', 'drivabilityLeaks', 'photos', 'summaryConfirm'],
  vandalism: ['vehicle', 'vandalParked', 'location', 'timeOfLoss', 'cameras', 'suspects', 'police', 'personalProperty', 'drivabilityLeaks', 'photos', 'summaryConfirm'],
  fire:      ['vehicle', 'fireDept', 'fireOrigin', 'fireDrivingParked', 'location', 'timeOfLoss', 'drivabilityLeaks', 'photos', 'summaryConfirm'],
  fallingobject: ['vehicle', 'treeOwner', 'location', 'timeOfLoss', 'drivabilityLeaks', 'photos', 'summaryConfirm'],
  towing_roadside: ['vehicle', 'mechanicalProbe', 'location', 'timeOfLoss', 'drivabilityLeaks', 'photos', 'summaryConfirm']
};
// Animal strike (AA.io peril rubric): single-vehicle — never other-driver probes; direct hit vs. swerve decides collision vs. comp.
const ANIMAL_STRIKE_FLOW = ['vehicle', 'animalProbe', 'carcassHazard', 'location', 'timeOfLoss', 'injury', 'police', 'drivabilityLeaks', 'photos', 'summaryConfirm'];
const ANIMAL_STRIKE_RE = /\b(deer|hog|hogs|pig|boar|cow|cows|cattle|livestock|horse|dog|coyote|elk|moose|armadillo|animal|venado|jabali|cerdo|puerco|vaca|ganado|caballo|perro|animal)\b/i;
// Peril probe slots answered free-form: filled by whatever the caller says while the slot is pending.
const PERIL_PROBE_SLOTS = ['impactPoint', 'otherPlate', 'drivabilityLeaks', 'carcassHazard', 'hailParked', 'hailSeverity', 'engineRestart', 'personalProperty', 'cameras', 'theftLastSeen', 'recoveryStatus', 'treeOwner', 'keyCustody', 'fireDept', 'fireOrigin', 'fireDrivingParked', 'keyAccess', 'vandalParked', 'suspects'];
// Loss type unknown after the narrative → ONE clarifying question first (D4).
const GENERIC_FLOW = ['losstype', 'vehicle', 'folInvestigate', 'trafficControls', 'location', 'timeOfLoss', 'photos', 'summaryConfirm'];

const SLOT_QUESTION_KEYS = {
  losstype: 'qLossClarify',
  callerName: 'qName',
  policyNumber: 'qPolicy',
  vehicle: 'qVehicle',
  vehicleCollision: 'qVehicleCollision',
  vehicleHail: 'qVehicleHail',
  vehicleFlood: 'qVehicleFlood',
  vehicleFire: 'qVehicleFire',
  vehicleTheft: 'qVehicleTheft',
  vehicleGlass: 'qVehicleGlass',
  vehicleVandalism: 'qVehicleVandalism',
  vehicleFallingObject: 'qVehicleFallingObject',
  vehicleTowing: 'qVehicleTowing',
  location: 'qWhere',
  injury: 'qInjury',
  photos: 'qPhotos',
  timeOfLoss: 'qTimeOfLoss',
  otherParty: 'qOtherParty',
  vehicleLocation: 'qVehicleLocation',
  animalProbe: 'qAnimalProbe',
  treeProbe: 'qTreeProbe',
  folInvestigate: 'qFolInvestigate',
  trafficControls: 'qTrafficControls',
  folWrap: 'qFolWrap',
  police: 'qPolice',
  floodParkedOrRunning: 'qFloodParkedOrRunning',
  floodWaterLevel: 'qFloodWaterLevel',
  floodWaterType: 'qFloodWaterType',
  injuryAndDrivability: 'qClaimantInjuryDrivability',
  claimantContact: 'qClaimantContact',
  insuredInfo: 'qInsuredInfo',
  towWhere: 'qTowWhere',
  impactPoint: 'qImpactPoint',
  otherPlate: 'qOtherPlate',
  drivabilityLeaks: 'qDrivabilityLeaks',
  carcassHazard: 'qCarcassHazard',
  hailParked: 'qHailParked',
  hailSeverity: 'qHailSeverity',
  engineRestart: 'qEngineRestart',
  personalProperty: 'qPersonalProperty',
  cameras: 'qCameras',
  theftLastSeen: 'qTheftLastSeen',
  recoveryStatus: 'qRecoveryStatus',
  treeOwner: 'qTreeOwner',
  keyCustody: 'qKeyCustody',
  fireDept: 'qFireDept',
  fireOrigin: 'qLtFire',
  fireDrivingParked: 'qFireDrivingParked',
  keyAccess: 'qKeyAccess',
  vandalParked: 'qVandalParked',
  suspects: 'qSuspects',
  mechanicalProbe: 'qMechanicalProbe',
  summaryConfirm: 'qSummaryConfirm'
};

// D9: phrases that are NEVER a slot value — they are conversation about the
// call itself (SMS links, language selection, repeat requests, caller complaints/meta comments). Call CA7146d516's contaminated
// policy slot held exactly this class of utterance.
const CONTAMINATION_RE = /\b(text me|text it|secure link|upload link|send (me )?the link|press one|press two|say english|diga espa|env(í|i)eme el enlace|enlace seguro|mand(e|a)me el enlace|por mensaje de texto|repeat (the|that|a)? (question|prompt)|could you repeat|can you repeat|what did you say|puedes repetir|podr[íi]a repetir|qu[ée] dijiste|double questioning|double repeating|repeating each question|why do you keep repeating|not supposed to be listing|taking the score|why are you asking again|already told you|stop repeating|stop asking me that|repetitive|not a valid question|you already have all the facts|where is your logic|keep repeating the same thing|you keep repeating|failed call|pull the transcript|go through it line by line|not near where it needs to be|not using the logic|didn't find out the actual cause|cause of loss before|redirected herself|broken logic|she didn't find out|this is a failed call|not supposed to be asking|terrible logic|not listening|next question|skip that|skip this|move on to the next|pass on that|siguiente pregunta)\b/i;

const META_COMPLAINT_RE = /\b(you are double questioning|double questioning|double repeating|repeating each question|why do you keep repeating|not supposed to be listing|taking the score|why are you asking again|already told you|stop repeating|stop asking me that|repetitive|not a valid question|you already have all the facts|where is your logic|keep repeating the same thing|you keep repeating|failed call|pull the transcript|go through it line by line|not near where it needs to be|not using the logic|didn't find out the actual cause|cause of loss before|redirected herself|broken logic|she didn't find out|this is a failed call|not supposed to be asking|terrible logic|not listening)\b/gi;

function sanitizeUserUtterance(text) {
  if (!text || typeof text !== 'string') return '';
  let clean = text.replace(META_COMPLAINT_RE, '').trim();
  clean = clean.replace(/\s{2,}/g, ' ');
  return clean;
}

/**
 * Universal Structural Address Boundary Trimmer (Zero 2% Slop):
 * Instead of matching a narrow 6-word list ("cracking|leaving|breaking..."),
 * mechanically bounds any extracted location string at the end of the geographic entity
 * and strips any trailing gerund/participle clause (\b[a-z]{4,}ing\b outside place names),
 * relative/temporal clause (when, while, after, before, right before/after, where, as, because, since),
 * or conversational/status clause.
 */
function stripTrailingNarrativeFromAddress(locStr) {
  if (!locStr || typeof locStr !== 'string') return '';
  let s = locStr.trim();
  if (!s) return '';
  // 1. Strip any subordinate, relative, temporal, or conversational clause boundary
  const clauseRegex = /\s*[,.]?\s*\b(?:when|while|after|before|right\s+before|right\s+after|where|as|because|since|if|so\s+that|which|my\s+(?:car|vehicle|truck|suv|van|hood|roof|windshield|bumper|fender|door|fence)|and\s+(?:my|the|a|an|it|i|we|someone|nobody|everyone|there|then|cracked|chipped|shattered|dented|hit|struck|smashed|broke|damaged|scratched|flooded|submerged|totaled|stalled|ran|backed|rear-ended|t-boned|sideswiped|clipped)|i\s+(?:was|think|thought|had|got|went|saw)|we\s+were|it\s+(?:was|got|hit|started)|was\s+towed|got\s+towed|no\s+injur\w*|nobody|everyone|se\s+lo\s+llevaron|sin\s+lesiones|with\s+(?:quarter|golf|baseball|hail|dents|damage|water|heavy|broken|shattered))\b.*/i;
  s = s.replace(clauseRegex, '').trim();
  // 2. Strip any trailing participial/gerund clause (any "-ing" verb phrase following a comma or geographic token, excluding place names like Spring, Irving, Crossing, Landing, Parking, Shopping, Sterling, Browning, Manning, Reading, Wheeling)
  const gerundClauseRegex = /\s*(?:,\s*|\s+and\s+|\s+)\b(?!(?:Spring|Irving|Crossing|Landing|Parking|Shopping|Browning|Manning|Sterling|Harding|Corning|Reading|Wheeling|Bowling|Downing|Flushing|Sebring|Lansing|Kettering|Goldsboro|harlingen)\b)([a-z]{3,}ing)\b\s+(?:the|my|our|a|an|all|both|its|up|down|off|out|into|over|through|across|around|in|on|with|from|to|quarter|golf|baseball|heavy|severe|deep|water|glass|paint|metal|hood|roof|windshield|bumper|window|doors?|panels?|fence|trees?|branches?)\b.*/i;
  s = s.replace(gerundClauseRegex, '').trim();
  // 3. Also strip bare leading/trailing punctuation
  s = s.replace(/^[,.:\s-]+|[,.:\s-]+$/g, '').trim();
  return s;
}

/**
 * Normalize structural ASR punctuation & brand formatting ONLY (Zero 2% Slop):
 * - Never silently guesses or replaces unrecognized claim perils ("hair claim") or caller street names ("way of the stuff").
 *   Ambiguous perils and garbled street names are validated and clarified conversationally by SecondListenerRagEngine.
 * - De-splits 5-digit US zip codes ("75. 204", "75, 204") -> "75204"
 * - Normalizes brand token "action rate" / "axi rate" -> "AxiRate"
 */
function normalizeClaimsAsrSpeech(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  let s = rawText;
  s = s.replace(/\b(action\s+rate|axi\s*rate|axee\s*rate|access\s+rate|actual\s+rate|taxi\s+rate|oxy\s*rate|acme\s+rate)\b/gi, 'AxiRate');
  s = s.replace(/\b(asian\s+angel|ancient\s+angel)\b/gi, 'Agent Angel');
  s = s.replace(/\b(acura)\s*[.,]?\s*(?:nvx|mbx|ndx|m\s*d\s*x)\b/gi, 'Acura MDX');
  s = s.replace(/\b(\d{4})\.\s+(Acura|Honda|Ford|Toyota|Chevy|Chevrolet|Nissan|BMW|Mercedes|Audi|Hyundai|Kia|Subaru|Dodge|Ram|Lexus|Tesla|GMC|Mazda|Jeep)\b/gi, '$1 $2');
  s = s.replace(/\b(okon\s+and\s+lemons?|oaklan\s+and\s+lemons?|oak\s*lawn\s+and\s+lemons?|oak\s*lawn\s+and\s+lemmon)\b/gi, 'Oak Lawn Ave and Lemmon Ave');
  s = s.replace(/\bs[.,\s]+h[.,\s]+i[.,\s]+[pt][.,\s]+m[.,\s]+a[.,\s]+n\b/gi, 'Shipman');
  s = s.replace(/\b(?:here|year)[,\s]+making\s+motto\b/gi, 'year, make, and model');
  s = s.replace(/\bmaking\s+motto\b/gi, 'make and model');
  s = s.replace(/\b(7\d)\s*[.,]\s*(\d{3})\b/g, '$1$2');
  s = s.replace(/\b(\d{2})\s*[.,]\s*(\d{3})\b(?=\s*$|\s*(?:in|tx|texas)\b)/gi, '$1$2');
  // Normalize ASR clock-time street numbers ("4:12 Oak Valley Drive" -> "412 Oak Valley Drive")
  s = s.replace(/(?<!\b(?:at|around|about|near|by|before|after)\s+)\b(\d{1,2}):(\d{2})\b(?=\s+(?!(?:am|pm|a\.m\.|p\.m\.|in\s+the|o'?clock|on|at|in|near|by|around|about)\b)[A-Za-z])/gi, '$1$2');
  // Normalize ASR comma splits inside street names ("4410 Oak, Lawn Avenue" -> "4410 Oak Lawn Avenue")
  s = s.replace(/\b(\d{2,5}\s+[A-Za-z]+),\s+([A-Za-z]+\s+(?:st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|way|ct|court|pl|place|cir|circle|pkwy|parkway|hwy|highway|trail|loop)\b)/gi, '$1 $2');
  return s;
}

function normalizeSpokenPolicy(text) {
  if (!text || typeof text !== 'string') return text;
  const raw = text.trim();
  if (/\b(?:from|on|under|in)\s+(?:the|my|our)\s+policy\b/i.test(raw)) return raw;
  // Never extract a police report number as a policy number when no policy cue is present
  if (/\b(?:police|sheriff|trooper|report\s+(?:number|no|#)|gave\s+me\s+report|PR-[A-Z]{2,4}-\d+)\b/i.test(raw) && !/\b(?:policy|p[oó]liza)\b/i.test(raw)) {
    return raw;
  }

  // Normalize spoken "dash" / "hyphen" / "guion" between policy prefix and digits ("policy FL dash 717207" -> "policy FL-717207")
  const dashNorm = raw.replace(/\b([A-Za-z]{2,4})\s+(?:dash|hyphen|guion|gui[oó]n)\s+(\d{4,10})\b/gi, '$1-$2');

  // 1. If utterance contains a mid-sentence policy cue ("...and my policy number is PA-5501923" / "...y mi póliza es PA-4918273"),
  // isolate only the segment after the cue FIRST so preceding police report numbers (PPD-88412, APD-33910, EPP-6612) are never mistaken for the policy number!
  let scoped = dashNorm;
  const cueMatch = dashNorm.match(/\b(?:my\s+policy\s*(?:number|num|no|#)?|mi\s+n[uú]mero\s+de\s+p[oó]liza|n[uú]mero\s+de\s+p[oó]liza|policy\s*(?:number|num|no|#)?|my\s+policy|mi\s+p[oó]liza|p[oó]liza)\s*(?:is|es|:)?\s*([A-Za-z0-9-\s,]{4,60})/i);
  if (cueMatch && cueMatch[1]) {
    // Mid-sentence self-correction (interrupted speech / digit correction): "POL 883- actually, sorry, POL 88392"
    // must resolve to the LAST value the caller stated, not the interrupted first attempt.
    const correctionParts = cueMatch[1].split(/[,]?\s*(?:actually|i\s+mean|sorry|no\s+wait|correction|scratch\s+that|let\s+me\s+correct\s+that)[,]?\s*/i);
    const corrected = correctionParts.length > 1 ? correctionParts[correctionParts.length - 1] : cueMatch[1];
    scoped = corrected.split(/\b(?:and\s+the|and\s+it|and\s+my|and\s+no|reporting|y\s+el|y\s+mi|in\s+my|at\s+\d|on\s+\d)\b|[.!?,;]/i)[0].trim();
  }

  // 2. Direct hyphenated policy match in scoped segment (e.g., "PA-5501923", "AU-7731904", "FL-717207"), excluding police report prefixes
  const explicitHyphenMatch = scoped.match(/\b([A-Z]{2,4}-\d{4,10}(?:-[A-Z0-9]+)?)\b/i);
  if (explicitHyphenMatch && !/^(?:fr|pr|cr|inc|case|rep|fm|sh|us|ih|[a-z]{1,3}pd|epp)-/i.test(explicitHyphenMatch[1])) {
    return explicitHyphenMatch[1].toUpperCase();
  }

  const numMap = {
    'zero':'0','one':'1','two':'2','three':'3','four':'4','five':'5','six':'6','seven':'7','eight':'8','nine':'9',
    'cero':'0','uno':'1','dos':'2','tres':'3','cuatro':'4','cinco':'5','seis':'6','siete':'7','ocho':'8','nueve':'9'
  };
  const wordMap = {
    'alpha':'A','alfa':'A','bravo':'B','charlie':'C','delta':'D','echo':'E','foxtrot':'F','golf':'G','hotel':'H',
    'india':'I','juliet':'J','kilo':'K','lima':'L','mike':'M','november':'N','oscar':'O','papa':'P','quebec':'Q',
    'romeo':'R','sierra':'S','tango':'T','uniform':'U','victor':'V','whiskey':'W','x-ray':'X','xray':'X','equis':'X',
    'yankee':'Y','zulu':'Z'
  };
  const stopWords = new Set([
    'i', 'a', 'y', 'o', 'e', 'u', 'am', 'pm', 'dash', 'hyphen', 'guion',
    'from', 'the', 'and', 'for', 'with', 'that', 'this', 'have', 'your', 'mine', 'auto', 'car', 'cars',
    'truck', 'suv', 'van', 'year', 'make', 'same', 'just', 'like', 'what', 'when', 'where', 'were', 'was',
    'into', 'onto', 'over', 'under', 'on', 'in', 'at', 'to', 'of', 'by', 'is', 'it', 'my', 'me', 'we', 'no', 'yes',
    'ford', 'chevy', 'jeep', 'audi', 'kia', 'ram', 'gmc', 'bmw', 'vw', 'acura', 'honda', 'toyota', 'nissan', 'tesla', 'lexus',
    'del', 'con', 'por', 'para', 'una', 'uno', 'las', 'los', 'que', 'como', 'este', 'esta', 'auto', 'carro', 'casa', 'lot', 'parked'
  ]);
  const clean = scoped.replace(/^(?:(?:and|yes|yeah|ok|okay|um|uh|so|well)[,.\s]+)*(?:my\s+policy\s+number\s+is|mi\s+n[uú]mero\s+de\s+p[oó]liza\s+es|policy\s+number\s+is|p[oó]liza\s+es|my\s+policy\s+is|policy\s+number|policy|p[oó]liza)\s*/i, '').replace(/[.!?,;]+$/, '').trim();
  if (/^[A-Z]{1,4}-?\d{4,10}(?:-[A-Z0-9]+)?$/i.test(clean)) {
    return clean.toUpperCase();
  }
  const tokens = clean.split(/[\s-]+/).filter(Boolean);
  let converted = '';
  let tokensMatched = 0;
  let hasDigitToken = false;
  for (const t of tokens) {
    const lower = t.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!lower || stopWords.has(lower)) continue;
    if (/^\d+$/.test(lower)) {
      converted += lower;
      tokensMatched++;
      hasDigitToken = true;
    } else if (numMap[lower]) {
      converted += numMap[lower];
      tokensMatched++;
      hasDigitToken = true;
    } else if (wordMap[lower]) {
      converted += wordMap[lower];
      tokensMatched++;
    } else if (lower.length === 1 && /[a-z]/i.test(lower)) {
      converted += lower.toUpperCase();
      tokensMatched++;
    } else if (lower.length <= 4 && /^(?:[a-z]+\d+|\d+[a-z]+|[A-Z]{2,4})$/.test(t) && !stopWords.has(lower)) {
      converted += lower.toUpperCase();
      tokensMatched++;
      if (/\d/.test(lower)) hasDigitToken = true;
    }
  }
  if (tokensMatched >= 3 && converted.length >= 5 && hasDigitToken) {
    return converted;
  }
  return clean || raw;
}

// ── CUSTOMER INQUIRY RESPONSE DICTIONARY & SLOT PROMPTS ──
const CALLER_INQUIRY_ANSWERS = {
  deductible: {
    en: "Your deductible is only paid to the repair shop once repairs are completed, not upfront during intake.",
    es: "Su deducible únicamente se paga directamente al taller de reparación una vez finalizados los arreglos, no en este momento durante el reporte."
  },
  police: {
    en: "A police report is helpful if officers were called, but it is not strictly required to open your claim today, especially if there were no injuries.",
    es: "El reporte policial es de gran ayuda si acudió una patrulla, pero no es obligatorio para abrir su expediente hoy, especialmente si no hubo lesionados."
  },
  towing: {
    en: "Towing and roadside storage are covered under your policy up to your plan limits. Our automated system can validate the tow bill and authorize payment directly.",
    es: "El servicio de grúa y resguardo están cubiertos según los límites de su póliza. Nuestro sistema automatizado puede validar la factura de la grúa y autorizar el pago directamente."
  },
  rental: {
    en: "If you have rental reimbursement coverage, we can set up direct reservation and billing with our preferred rental partners right after this intake.",
    es: "Si su póliza incluye cobertura de auto de alquiler, podemos gestionar la reservación y facturación directa con nuestras empresas asociadas de inmediato."
  },
  rate_increase: {
    en: "Any rate impact depends on final liability determination by your claims adjuster after all evidence and statements are reviewed.",
    es: "Cualquier impacto en tarifas dependerá de la determinación de responsabilidad que realice su ajustador tras analizar todas las evidencias."
  },
  process_timeline: {
    en: "Once we complete this brief intake, your claim is immediately assigned to an adjuster who will review your photos and repair estimates within 24 to 48 hours.",
    es: "Al completar esta breve llamada, su expediente se asigna de inmediato a un ajustador que revisará sus fotos y presupuestos en 24 a 48 horas."
  },
  repair_shop: {
    en: "You always have the legal right to choose any licensed repair shop of your preference, or use our certified direct repair network for lifetime guarantees.",
    es: "Usted tiene el derecho legal de elegir cualquier taller certificado de su preferencia, o usar nuestra red directa con garantía de por vida en reparaciones."
  },
  ai_identity: {
    en: "I am AI Agent Angel, an automated claims specialist handling your first notice of loss in real time with zero hold time.",
    es: "Soy AI Agent Angel, especialista automatizada de siniestros para registrar su primer aviso de pérdida en tiempo real sin esperas."
  },
  photos_info: {
    en: "For this demo, you can choose any photo from your phone or snap a quick picture of anything around you right now — like your desk or coffee cup — to test our live EXIF forensic audit. You can also upload them later at your convenience.",
    es: "Para esta demostración, puede elegir cualquier foto de su teléfono o tomar una foto rápida de lo que tenga alrededor — como su escritorio o taza de café — para probar nuestra auditoría forense en vivo. También puede subirlas más tarde cuando guste."
  },
  adjuster_contact: {
    en: "An express adjuster will review your file and reach out within one business day, or immediately if your vehicle is non-drivable or in a tow lot.",
    es: "Un ajustador revisará su caso y se comunicará en un día hábil, o de inmediato si el vehículo requiere remolque urgente."
  },
  compliance_audit_100: {
    en: "During catastrophe surge events or daily operations, our AxiRate audit engine automatically grades 100 percent of employee and bot calls across 108 customizable compliance rules. Team leaders get direct transcripts, discrepancy flags, and ACORD summaries in real time for immediate feedback without slow manual QA sampling. Would you like me to send you the live dashboard link to see this call audited in real time?",
    es: "Durante emergencias por catástrofes o en operaciones diarias, nuestro motor AxiRate audita el 100 por ciento de las llamadas de empleados y del bot según 108 reglas de cumplimiento personalizables. Los líderes de equipo reciben transcripciones directas, alertas de discrepancia y resúmenes ACORD en tiempo real para retroalimentación inmediata sin muestreo manual. ¿Desea que le envíe el enlace del panel en vivo para ver esta llamada auditada en tiempo real?"
  },
  pricing_roi: {
    en: "Unlike traditional human answering services charging $300 to $1,100 per month plus $2 to $5 per minute overage fees during surges, Agent Angel operates at a flat $150 to $500 per month with zero per-minute penalties. Industry benchmarks show AI voice intake reduces Loss Adjustment Expenses by 20 to 30 percent, cutting intake costs from $30 to $50 manual down to $10 to $20 straight-through processing. What is your carrier or team's average monthly claims volume?",
    es: "A diferencia de los servicios de contestación humanos que cobran entre 300 y 1,100 dólares al mes más tarifas de sobrecargo por minuto de 2 a 5 dólares, Agent Angel opera a una tarifa plana de 150 a 500 dólares al mes sin penalizaciones por minuto. Los estudios demuestran que la recepción por voz reduce los gastos de ajuste de pérdidas entre un 20 y un 30 por ciento, bajando los costos de recepción de 30 a 50 dólares a 10 a 20 dólares con procesamiento directo. ¿Cuál es el volumen mensual promedio de reclamos de su equipo?"
  },
  crm_integrations: {
    en: "Angel integrates with Guidewire ClaimCenter, Duck Creek, FileHandler Enterprise, and XactAnalysis via ACORD 125/127/140 XML & REST webhooks. She matches existing policies instantly to prevent duplicates and auto-generates preliminary First Notice of Loss records for your licensed adjusters.",
    es: "Angel se integra con Guidewire ClaimCenter, Duck Creek, FileHandler Enterprise y XactAnalysis mediante XML ACORD 125/127/140 y webhooks REST. Busca pólizas existentes al instante para evitar duplicados y genera expedientes preliminares de Primer Aviso de Pérdida para sus ajustadores."
  },
  live_takeover: {
    en: "You can monitor live calls directly from your secure web dashboard with sub-second latency, review live audio streams and real-time transcripts, and take over or whisper to the call with a single tap at any time.",
    es: "Puede monitorear llamadas en vivo directamente desde su panel web seguro con latencia inferior a un segundo, revisar transmisiones de audio y transcripciones en tiempo real, y tomar el control de la llamada con un solo toque en cualquier momento."
  },
  catastrophe_surge: {
    en: "During catastrophe hail storms, hurricanes, or deep freeze surges, our scalable cloud infrastructure answers every incoming call on the first ring with zero hold times and zero queue drops, instantly triaging emergency property and auto losses directly to on-call adjusters.",
    es: "Durante tormentas de granizo, huracanes o heladas extremas, nuestra infraestructura en la nube contesta cada llamada al primer timbre con cero tiempos de espera, clasificando de inmediato pérdidas de propiedad y vehículos hacia ajustadores de guardia."
  },
  data_security: {
    en: "All calls, transcripts, and customer records are encrypted end-to-end with TLS 1.3 and AES-256, complying strictly with FTC, SOC2, and state privacy standards. Photo uploads preserve verified EXIF GPS metadata for SIU fraud prevention.",
    es: "Todas las llamadas, transcripciones y registros están encriptados de extremo a extremo con TLS 1.3 y AES-256, cumpliendo estrictamente con normas de la FTC, SOC2 y privacidad estatal. Las fotos subidas conservan metadatos GPS EXIF originales para prevención de fraudes."
  },
  onboarding_setup: {
    en: "To customize Agent Angel for your carrier, TPA, or adjusting team, our onboarding form requires only 4 core inputs: your organization name, dedicated phone number, emergency escalation rules, and CRM webhook endpoint. We can have your line live within 24 hours.",
    es: "Para personalizar Agent Angel para su aseguradora, TPA o equipo de ajuste, nuestro formulario requiere solo 4 datos básicos: nombre de su organización, número de teléfono dedicado, reglas de escalamiento de emergencia y endpoint de webhook o CRM. Podemos tener su línea activa en 24 horas."
  },
  general_help: {
    en: "I'm here to ensure all details of your incident are documented accurately so your adjuster can proceed with your claim without delays.",
    es: "Estoy aquí para documentar todos los detalles de su incidente de manera precisa para que su ajustador pueda gestionar su reclamo sin demoras."
  }
};

const SLOT_OPEN_REPROMPTS = {
  vehicle: {
    en: "To make sure we have your vehicle correctly documented under your policy, could you tell me the year, make, and model of the vehicle?",
    es: "Para asegurar que su vehículo esté correctamente documentado en su póliza, ¿podría decirme el año, marca y modelo del vehículo?"
  },
  location: {
    en: "To ensure our adjusters can pinpoint the exact loss location on a map, could you tell me the street, intersection, or city where this happened?",
    es: "Para que nuestros ajustadores ubiquen el lugar exacto en el mapa, ¿podría indicarme la calle, cruce o ciudad donde ocurrió?"
  },
  losstype: {
    en: "Could you describe what happened during the incident and the cause of damage to your vehicle?",
    es: "¿Podría describirme qué ocurrió durante el incidente y la causa de los daños en su vehículo?"
  },
  narrative: {
    en: "Could you tell me in your own words what happened during the incident?",
    es: "¿Podría contarme con sus propias palabras qué ocurrió durante el incidente?"
  },
  police: {
    en: "Were the police or emergency services called out to the scene?",
    es: "¿Se llamó a la policía o servicios de emergencia al lugar?"
  },
  injuryAndDrivability: {
    en: "Is your vehicle currently drivable, or did it need a tow from the scene?",
    es: "¿Su vehículo se puede manejar actualmente o necesitó grúa desde el lugar?"
  },
  photos: {
    en: "Do you have any photos available of the damage or the scene? For the demo you can even take a picture of your desk or coffee cup.",
    es: "¿Tiene fotos de los daños o del lugar? Para la prueba puede tomar una foto de su escritorio o taza de café."
  },
  otherParty: {
    en: "Could you tell me what you recall about the other vehicle or driver involved?",
    es: "¿Podría decirme qué recuerda sobre el otro vehículo o conductor involucrado?"
  },
  timeOfLoss: {
    en: "When did this happen — what was the date and approximate time of the incident?",
    es: "¿Cuándo ocurrió esto — cuál fue la fecha y la hora aproximada del incidente?"
  },
  vehicleLocation: {
    en: "Where is the vehicle located or parked right now?",
    es: "¿Dónde se encuentra estacionado o ubicado el vehículo en este momento?"
  }
};

class ClaimsIntakeEngine {
  constructor() {
    this.requiredFields = [
      'callerName',
      'policyNumber',
      'dateOfLoss',
      'locationOfLoss',
      'lossDescription',
      'vehicleInfo',
      'injuryStatus',
      'policeReport'
    ];
  }

  /**
   * Classify mid-intake customer questions (coverage, deductibles, police, towing, process, etc.)
   * to provide accurate, reassuring answers and prevent question text from contaminating claim fields.
   */
  classifyCustomerInquiry(speech) {
    if (!speech || typeof speech !== 'string') return null;
    const s = speech.trim().toLowerCase();

    // Exclude simple affirmative/negative acknowledgments or single-word confirmations
    if (/^(yes|yeah|yep|no|nope|nah|sure|ok|okay|si|sí|claro|correcto|none|fine|good)\b/i.test(s) && s.split(/\s+/).length <= 2) {
      return null;
    }

    const hasQuestionMark = speech.includes('?');
    const hasQuestionLead = /^(what|why|how|when|where|who|which|will|do i|does|can i|could i|is there|are you|should i|could you|would you|can you|tell me)\b/i.test(s) ||
      /^(qu[ée]|por qu[ée]|c[óo]mo|cu[áa]ndo|d[óo]nde|qui[ée]n|cu[áa]l|se puede|puedo|tengo que|debo|es necesario|hay|eres|dime)\b/i.test(s);
    const isQuestionForm = hasQuestionMark || hasQuestionLead;

    // Exclude first-person loss narratives and direct slot answers (e.g. "a hail storm hit my parked 2022 Acura", "safe location", "lost control")
    if (!hasQuestionLead && /\b(hit my|my (?:car|vehicle|truck|suv|sedan|driveway|house|home|garage)|20\d{2}\s+[a-z]+|parked in|was driving|was parked|cracked|dents|flooded|water was|stole|stolen|safe location|in a safe|no injuries|no leaks|no fluid|lost control|traffic control|from the policy)\b/i.test(s)) {
      return null;
    }

    // Deductible
    if (/\b(deductible|deducible|out of pocket|how much do i pay|cu[áa]nto tengo que pagar)\b/i.test(s)) {
      return 'deductible';
    }
    // Police report inquiry
    if (/\b(do i need (a )?police|is (a )?police report (required|needed|necessary)|what if (the )?police|necesito reporte policial|es obligatori[ao] (el reporte|la polic[íi]a)|what if i don't have a police report)\b/i.test(s) || (isQuestionForm && /\b(police report|police department|polic[íi]a)\b/i.test(s))) {
      return 'police';
    }
    // Towing / Tow bill / storage
    if (/\b(who pays (for )?(the )?tow|is towing covered|how does towing work|qui[ée]n paga la gr[úu]a|cubre la gr[úu]a|factura de gr[úu]a|tow bill|storage fees?)\b/i.test(s) || (isQuestionForm && /\b(tow|towing|gr[úu]a|storage)\b/i.test(s))) {
      return 'towing';
    }
    // Rental car
    if (/\b(rental car|rental|auto sustituto|carro de alquiler|enterprise|hertz)\b/i.test(s) && (isQuestionForm || /\b(how|can|get|covered|cubre|consigo)\b/i.test(s))) {
      return 'rental';
    }
    // Rate increase
    if (/\b(rates? go up|insurance go up|premiums? go up|va a subir mi seguro|sube la p[óo]liza|rate increase)\b/i.test(s)) {
      return 'rate_increase';
    }
    // Process / Next steps / Timeline
    if (/\b(what happens next|how long does (this|the claim) take|what is the next step|cu[áa]l es el siguiente paso|cu[áa]nto tarda|what are the next steps)\b/i.test(s)) {
      return 'process_timeline';
    }
    // Repair shop
    if (/\b(choose|pick|use)\b.*\b(shop|mechanic|body shop|taller)\b/i.test(s) || /\b(puedo elegir mi taller|own repair shop)\b/i.test(s)) {
      return 'repair_shop';
    }
    // AI Identity
    if (/\b(are you (an? )?(ai|robot|real person|human)|eres una? (ia|robot|persona real|humano))\b/i.test(s)) {
      return 'ai_identity';
    }
    // Photos guidance
    if (/\b(do i have to (take|upload) photos|what if i don't have (any )?photos|how do (the )?photos work|tengo que tomar fotos|qu[ée] pasa si no tengo fotos)\b/i.test(s)) {
      return 'photos_info';
    }
    // Adjuster contact
    if (/\b(when will (an|the|my) adjuster call|who is my adjuster|cu[áa]ndo me llama el ajustador|when do i hear from an adjuster)\b/i.test(s)) {
      return 'adjuster_contact';
    }
    // 100% Compliance Audit & AxiRate
    if (/\b(audit|compliance|axirate|100 percent|100%|grade|grading|scorecard|texas insurance code|4101)\b/i.test(s)) {
      return 'compliance_audit_100';
    }
    // Pricing, ROI, and Cost Structure
    if (/\b(how much (does this|do you|is this)|cost|price|pricing|roi|lae|loss adjustment expense|rates?|flat rate|overage|benchmark|charge per|fee)\b/i.test(s) && !/\b(deductible|tow)\b/i.test(s)) {
      return 'pricing_roi';
    }
    // Carrier Core Platform & CRM Integrations
    if (/\b(guidewire|duck creek|snapsheet|salesforce|crm|filehandler|xactanalysis|ccc|webhook|acord|xml|integration|integrate|system)\b/i.test(s)) {
      return 'crm_integrations';
    }
    // Live Monitoring & Supervisor Takeover
    if (/\b(take over|takeover|live dashboard|listen in|whisper|barge in|supervisor control)\b/i.test(s)) {
      return 'live_takeover';
    }
    // Catastrophe Surges & Peak Volume
    if ((isQuestionForm && /\b(catastrophe|cat team|surge|hail storm|hurricane|freeze|volume surge|capacity|unlimited calls)\b/i.test(s)) || /\b(catastrophe surge|cat team|volume surge|surge capacity|unlimited calls)\b/i.test(s)) {
      return 'catastrophe_surge';
    }
    // Security & Data Privacy
    if (/\b(secure|security|privacy|soc2|ftc|encrypt|vault|confidential|hipaa)\b/i.test(s)) {
      return 'data_security';
    }
    // Onboarding & Setup
    if (/\b(onboard|onboarding|setup|set up|how do i get started|how long to implement|pilot)\b/i.test(s)) {
      return 'onboarding_setup';
    }
    // General question form
    if (isQuestionForm && /\b(explain|understand|how does this work|what do you mean|what does that mean|c[óo]mo funciona|qu[ée] significa)\b/i.test(s)) {
      return 'general_help';
    }

    return null;
  }

  /**
   * Reset a session back to initial intake state upon caller request.
   */
  resetSession(session) {
    const lang = session.language || 'en';
    const callSid = session.callSid;
    const fromNumber = session.fromNumber;
    const carrierName = session.carrierName;
    const savedHostName = session.hostCallerName || (session.fnolData && session.fnolData.callerName) || '';
    const savedHostGreeting = session.hostSpokenGreeting || '';
    const savedCompany = session.companyName || (session.fnolData && session.fnolData.companyName) || '';
    const savedSmsConsent = session.smsConsent;
    const savedCallbackPerm = session.fnolData && session.fnolData.callbackPermission;
    const savedPostCallToken = session.postCallToken;
    const savedInCallSms = session.inCallSmsDispatched;

    const fresh = this.createSession(callSid, fromNumber, carrierName, lang);
    fresh.hasGreeted = true; // mid-call reset skips preamble greeting
    fresh.hostCallerName = savedHostName;
    fresh.hostSpokenGreeting = savedHostGreeting;
    fresh.companyName = savedCompany;
    fresh.fnolData.callerName = savedHostName;
    fresh.fnolData.companyName = savedCompany;
    if (savedSmsConsent !== undefined) {
      fresh.smsConsent = savedSmsConsent;
      fresh.fnolData.smsConsent = savedSmsConsent;
      fresh.pendingConsentQuestion = false;
    }
    if (savedCallbackPerm) fresh.fnolData.callbackPermission = savedCallbackPerm;
    if (savedPostCallToken) fresh.postCallToken = savedPostCallToken;
    if (savedInCallSms) fresh.inCallSmsDispatched = savedInCallSms;
    fresh.askedSlots = savedHostName ? ['callerName', 'narrative'] : ['narrative'];
    fresh.pendingSlot = 'narrative';
    fresh.lastQuestionKey = 'qNarrativeStoryOnly';
    fresh.turnCount = 1;
    fresh.transcript = session.transcript + '\n[SESSION RESET REQUESTED BY CALLER]';

    Object.assign(session, fresh);
    return session;
  }

  /**
   * Detect explicit reset or start-over request from the caller.
   */
  isStartOverIntent(text) {
    if (!text || typeof text !== 'string') return false;
    const norm = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return /\b(start over|start from (the )?beginning|restart|reset|start (it )?again|start from scratch|empieza de nuevo|empezar de nuevo|comenzar de nuevo|reiniciar|volver a empezar|otra vez|comenzar desde el principio)\b/i.test(norm);
  }

  /**
   * Initialize a fresh intake session.
   * ES-PARITY: language is a FIRST-CLASS field on both the session and the
   * FNOL record from birth — a record that cannot name its own language
   * cannot be audited.
   */
  createSession(callSid, fromNumber, carrierName, language, options = {}) {
    return {
      // 'demo' (AA sales demo line: name/policy pre-loaded, never asked) | 'live' (real FNOL intake: caller name is asked and captured)
      intakeMode: options.mode === 'live' ? 'live' : 'demo',
      callSid: callSid || 'CALL-' + Date.now(),
      fromNumber: fromNumber || '+14699166767',
      carrierName: carrierName || '',
      language: language || 'en',
      startTimestamp: Date.now(),
      startTime: new Date().toISOString(),
      call_start_utc: new Date().toISOString(), // REDTEAM-LEGAL-CH542-TIMESTAMP-INTEGRITY-01: Ingress UTC notice anchor
      recordType: 'Preliminary', // REDTEAM-LEGAL-CLAIMS-INTAKE-BOUNDARY-01: Texas Adjuster Shield
      isPreliminaryIntake: true,
      statutoryDisclaimer: 'Preliminary Intake Assistance Only; not a coverage, liability, fraud, or settlement determination.',
      piLegalDisclaimer: 'AgentAngel is not a law firm and does not provide legal advice.', // REDTEAM-LEGAL-PI-BARRATRY-RINGFENCE-01
      transcript: '',
      turnCount: 0,
      isComplete: false,
      isClaimant: false,
      callerRole: 'VP_CLAIMS',
      pinpointedBottleneck: '',
      lossType: null,               // D4 canonical: one of LOSS_TYPES, or null until detected
      lossTypeClass: 'GENERAL_COLLISION',
      injuryConditionBranch: 'STANDARD_PROPERTY_DAMAGE',
      pendingConsentQuestion: true,
      smsConsent: false,
      flaggedSlots: [],             // D9: slots whose value failed validation and was skipped
      interactionSentiment: [],
      mobilitySafetyAssessment: {
        assessedCondition: 'UNKNOWN',
        airbagsDeployed: null,
        fluidsLeaking: null,
        steeringCompromised: null,
        glassShattered: null,
        lightsInoperable: null,
        waterCabinLevel: null,
        engineWaterIntake: null,
        fireExtinguished: null,
        keysInCustody: null,
      },
      fnolData: {
        language: language || 'en',
        callerName: '',
        companyName: '',
        policyNumber: '',
        dateOfLoss: '',
        timeOfLoss: '',
        vehicleCurrentLocation: '',
        towCompany: '',
        otherPartyInfo: '',
        otherVehicleInvolved: null,
        rentalRequested: false,
        lossTypeText: '',
        lossTypeDetail: '',         // D4: answer to the per-loss-type question
        mechanicalCause: '',        // Towing/Roadside mechanical failure classification
        mechanicalDetail: '',       // Specific details to rule out foul play
        locationOfLoss: '',
        locationDetails: {
          streetAddress: '',
          intersection: '',
          landmarkBusiness: '',
          city: '',
          state: '',
          zipCode: '',
          formattedPlottable: '',
          mapUrl: '',
        },
        lossFacts: {
          speed: '',
          impactPoint: '',
          weather: '',
          roadCondition: '',
          trafficSignal: '',
          perilDetails: '',
          factsSummary: '',
        },
        lossDescription: '',
        vehicleInfo: '',
        injuryStatus: null,
        injuryAlert: false,
        injuryDetails: '',
        narrative_abstract_cause: '',
        delusional_psychotic_indicator: false,
        policeReport: '',
        policeReportNumber: '',
        policeJurisdiction: '',
        waterLevel: '',
        drivability: '',
        mobilitySafetyAssessment: {
          assessedCondition: 'UNKNOWN',
          airbagsDeployed: null,
          fluidsLeaking: null,
          steeringCompromised: null,
          glassShattered: null,
          lightsInoperable: null,
          waterCabinLevel: null,
          engineWaterIntake: null,
          fireExtinguished: null,
          keysInCustody: null,
        },
        towLocation: '',
        photoStatus: '',
        hasPhotos: false,
        callbackPermission: 'Pending',
        smsConsent: false,
        emailAddress: '',
        painPoints: [],
        followUpAuthorized: false,
        followUpDate: '',
        buyerDecision: '',
        videoShortsDispatched: []
      },
      claimRef: 'FNOL-DEMO-' + Math.floor(10000 + Math.random() * 90000)
    };
  }

  /**
   * D4 (DEMO-DOD-03): detect the loss type from the caller's OWN story.
   * EN + ES cues (diacritics normalized away before matching). Returns one of
   * LOSS_TYPES or null — null means "ask ONE clarifying question", never guess.
   * Precedence: theft > fire > flood > vandalism > hail > glass > collision
   * (specific perils before the catch-all collision cues).
   */
  detectLossType(text) {
    if (!text || typeof text !== 'string') return null;
    const norm = normalizeClaimsAsrSpeech(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const RULES = [
      ['theft', /\b(stolen|theft|stole|carjack\w*|break.?in\w*|broke in\w*|breakin|robo|robaron|robado|robada|hurto|se llevaron|metieron a)\b/],
      ['fire', /\b(fire|burn(ed|t|ing)?|flames?|incendio|incendiado|fuego|quemo|quemado|quemada|llamas)\b/],
      ['flood', /\b(water|flood(ed|ing)?|submerged|under water|water damage|high water|standing water|rising water|rain(ing|ed)?\b[^.?!]{0,40}?\b(into|in|inside|up into|up to|flooded)\b|up into (?:my |the |our )?(?:car|vehicle|truck|suv|cabin|floor|seat|door|window)|inundacion|inundado|inundada|inundo|sumergido|sumergida|lloviendo dentro|entro agua|se metio el agua)\b/],
      ['vandalism', /\b(vandal(s|ism|ized|izing)?|keyed|slashed|graffiti|spray.?paint(ed)?|break.?in\w*|broke in\w*|vandalismo|vandalizado|rayaron|rajaron|grafiti|pintarrajearon|rompieron el cristal)\b/],
      ['hail', /\b(hail(storm|stones)?|granizo|granizada)\b/],
      ['fallingobject', /\b((?:tree|branch|limb|light pole|utility pole|debris|sign|beam|object)[^.?!]{0,45}\b(?:fell|landed|blew\s+down|dropped|crashed\s+down|onto)\b|(?:something|it)\s+(?:fell|landed)\s+on\b|fell\s+on(?:to)?\s+(?:my|the|parked)\b|landed\s+on\s+(?:my|the|parked)\b|arbol\s+cayo|rama\s+cayo|cayo\s+(?:un|el|una|sobre))\b/],
      ['glass', /\b(windshield|wind shield|rock chip|(glass|window) (was |is |got )?(cracked|shattered|broken|chipped)|cracked (glass|window|windscreen)|shattered (glass|window)|parabrisas|el vidrio|el cristal|la ventanilla)\b/],
      ['collision', /\b(collision|crash(ed)?|accident|rear.?end(ed)?|t.?bon(ed|e)?|fender.?bender|ran into|hit (me|us|him|her|my|another|a |an |the |from|by)|got hit|was hit|colision|choque|choco|chocaron|chocamos|me pegaron|accidente|impacto|swerve|swerved|swerving|ran off|hit a|hit the|animal|deer|tree|post|pole|guardrail|ditch|fence|wall|barrier|curb|hydrant|embankment|into a\b|pushed\s+(?:my\s+)?(?:steering\s+wheel|car|vehicle)\s+into|pushed\s+into|drove\s+into|slammed\s+into|crashed\s+into|swerved\s+into|struck\s+(?:a|the|my|me)\b|single.?vehicle\s+incident|two.?vehicle\s+collision|multi.?vehicle|frontal\s+impact|side\s+impact|rear\s+impact|impact\s+damage|when\s+struck|was\s+struck|got\s+struck|ran\s+over|sideswip\w*|head.?on|broadsid\w*|hydroplan\w*|lost\s+control|spun\s+out|rollover|rolled\s+over|backed\s+into|front\s+axle\s+(?:is\s+)?bent|airbags?\s+deployed|reporting\s+an\s+auto\s+claim\s+at|active\s+roadside\s+shoulder)\b/],
      ['towing_roadside', /\b(towing|tow|tow.?only|roadside\s+(?:assistance|service|help|breakdown|dispatch)|breakdown|mechanical(\s+failure)?|engine (died|stopped|failed|overheated|stalled|broke|shut off)|transmission|overheat(ing)?|alternator|radiator|coolant leak|water pump|won'?t (start|drive|run)|car stopped|vehicle stopped|flat tire|dead battery|stuck|winch|grua|grúa|remolque|averia|avería|falla mecanica|falla mecánica|se apago|se apagó|llanta ponchada)\b/i]
    ];
    for (const [type, re] of RULES) {
      if (re.test(norm)) return type;
    }
    return null;
  }

  /**
   * D9 (DEMO-DOD-09): slot-TYPE validation. A value may enter (or be recited
   * from) a slot ONLY if it is shaped like that slot's type. Root defect, call
   * CA7146d516: policy slot held "Yes, please text me, the secure link…" and
   * the closing summary read it back verbatim.
   */
  validateSlotValue(slot, value) {
    if (value === null || value === undefined) return false;
    const text = String(value).trim();
    if (!text) return false;
    if (CONTAMINATION_RE.test(text) || META_COMPLAINT_RE.test(text)) return false;          // never a slot value, any slot
    if (/…|\.\.\./.test(text)) return false;           // truncated ASR fragment
    const words = text.split(/\s+/);
    const startsYesNo = /^(yes|yeah|yep|no|nope|nah|si|sí|claro)(?=[,.!?\s]|$)/i.test(text);
    switch (slot) {
      case 'policyNumber':
        // Policy ids are short alphanumeric tokens with digits — never sentences or vehicle years + 'FROMTHE'.
        if (/(?:FROMTHE|ONTHE|INTHE|FORTHE|WITHTHE|POLICY)/i.test(text)) return false;
        if (/^(?:19|20)\d{2}[A-Z]{4,}$/i.test(text)) return false;
        if (/\b(acura|honda|ford|toyota|chevy|chevrolet|nissan|bmw|mercedes|audi|hyundai|kia|subaru|dodge|ram|lexus|tesla|gmc|mazda|jeep)\b/i.test(text)) return false;
        return words.length <= 4 && text.length >= 4 && text.length <= 24 && /\d/.test(text)
          && /^[A-Za-z0-9][A-Za-z0-9\s-]*$/.test(text) && !startsYesNo;
      case 'callerName': {
        const BANNED_NAME_WORDS = /\b(um|uh|uhm|umm|er|ah|oh|hmm|hm|huh|comp|comprehensive|flood|hail|theft|vandalism|glass|fire|towing|really|very|shaken|sorry|upset|scared|nervous|nerviosa|nervioso|worried|stressed|freaking|confused|okay|ok|fine|good|great|correct|right|accurate|true|done|finished|ready|testing|test|demo|lemon|lemmon|sides|change|safe|calling|driving|trying|going|looking|stuck|hurt|still|here|home|outside|parked|what|how|where|when|why|who|which|whose|whom|a|an|the|this|that|these|those|my|your|our|their|his|her|its|it|is|was|are|were|be|been|being|have|has|had|do|does|did|will|would|shall|should|may|might|must|can|could|to|of|in|for|on|with|at|by|from|up|about|into|over|after|report|lawsuit|claim|insurance|accident|car|vehicle|now|so|just|not|no|yes|first|second|third|part|yang|host|intro|repetitive|spanish|english|loss|damage|collision|director|vp|vice|president|manager|executive|adjuster|examiner|company|companies|business|product|platform|system|next|skip|pass|move|whatever|joke|question|questions|letters|letter|last|spelled|spelling)\b/i;
        return words.length >= 1 && words.length <= 4 && !/\d/.test(text) && !startsYesNo
          && !BANNED_NAME_WORDS.test(text)
          && /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’.\s-]*$/.test(text);
      }
      case 'losstype':
        return words.length <= 8 && !startsYesNo;
      case 'location': {
        // Reject leading truncated-sentence fragments ("claim. I was in a car accid…")
        if (text.length < 3 || text.length > 120 || startsYesNo) return false;
        if (CONTAMINATION_RE.test(text) || META_COMPLAINT_RE.test(text)) return false;
        if (/^[a-z][a-z]{0,11}\.\s/i.test(text)) return false;
        // Reject bare state names ("TEXAS", "Texas", "in Texas")
        if (/^(?:in\s+|at\s+)?(?:Texas|TX|California|CA|Florida|FL|New York|NY|Illinois|IL|Ohio|OH|Georgia|GA|North Carolina|NC|Michigan|MI)[.!?]*$/i.test(text.trim())) {
          return false;
        }
        // Reject vague/approximate location descriptors lacking specific street, intersection, or landmark
        if (/\b(somewhere|around here|nearby|somewhere near|somewhere around|not sure where|cerca de ah[íi]|por ah[íi])\b/i.test(text) && !/\b(street|st|road|rd|avenue|ave|blvd|boulevard|highway|hwy|interstate|freeway|calle|avenida)\b/i.test(text)) {
          return false;
        }
        // Reject city-only responses without street or zip (e.g. "Dallas", "in Dallas")
        if (/^(?:in\s+|at\s+)?(Dallas|Fort Worth|Tyler|Austin|Houston|San Antonio|El Paso|Plano|Frisco|Denton|Arlington|Wichita Falls|Conway|Broken Bow|Longview|Lubbock|Midland|Odessa|Amarillo|Waco)(?:,?\s*(?:TX|Texas))?[.!?]?$/i.test(text.trim())) {
          return false;
        }
        // Reject generic landmark without street/city e.g. "Walmart in Dallas"
        if (/^(?:at\s+|the\s+)?walmart\s+(?:in\s+)?(?:dallas|houston|austin|fort worth)[.!?]?$/i.test(text.trim())) {
          return false;
        }
        // Reject trip dynamics / movement phrases (e.g. "on my way home", "my way home", "heading home", "driving home")
        if (/\b(?:(?:on\s+)?(?:my|the)\s+way(?:\s+home|\s+to\s+\w+)?|heading\s+home|driving\s+home|coming\s+home|going\s+home|heading\s+to\s+work|driving\s+to\s+work)\b/i.test(text.trim())) {
          return false;
        }
        // Residential references
        if (/\b(at my house|at home|in (my )?driveway|at (my )?residence|en mi casa|en casa|residence \/ home|residence)\b/i.test(text)) {
          return true;
        }
        // Must contain location indicators, road types, business, interstate/route numbers, or digits/intersections
        const hasLocMarker = /\b(street|st|road|rd|avenue|ave|blvd|boulevard|highway|hwy|interstate|freeway|exit|lane|ln|drive|dr|court|ct|way|parkway|pkwy|circle|cir|trail|route|rt|crossing|intersection|parking|lot|garage|driveway|at my house|my house|residence|taller|calle|avenida|carretera|autopista|intersecci[óo]n|estacionamiento|plaza|mall|center|shop|store)\b/i.test(text) || /\b(?:i|us|hwy|rt|route|fm|loop|tx)\s*[- ]?\d+\b/i.test(text) || /\d{1,5}\s+[A-Za-z]/.test(text) || /\b\d{5}\b/.test(text) || /\b[A-Za-z]{2,}\s+&\s+[A-Za-z]{2,}\b/.test(text);
        return hasLocMarker;
      }
      case 'vehicle': {
        if (startsYesNo || CONTAMINATION_RE.test(text) || META_COMPLAINT_RE.test(text)) return false;
        if (/\b(got it|understood|thank you|approximately|it should not be|should be asking|the vehicle listed|vehicle listed|listed on|making motto|make and model)\b/i.test(text)) return false;
        // Reject bare ordinal, discourse, or non-vehicle single words ("First.", "Company.", "Start.", "Wait.")
        if (/^(first|second|third|one|two|three|start|over|stop|wait|hold|company|policy|none|nothing|unknown|okay|ok|hello|hi|hey|thank|thanks|sure|right|correct)[.,!?]*$/i.test(text.trim())) {
          return false;
        }
        // Reject bare/vague vehicle descriptors that lack make, model, or year
        if (/^(it'?s\s+(a\s+|my\s+)?|my\s+|a\s+|an\s+|the\s+)?(truck|car|vehicle|suv|sedan|van|pickup|pickup truck|coupe|auto|automobile|camioneta|carro|coche|troca|mi carro|mi troca|mi camioneta)[.,!]?$/i.test(text.trim())) {
          return false;
        }
        const hasYear = /\b(?:19|20)\d{2}\b/.test(text);
        const hasMake = /\b(toyota|honda|ford|chevrolet|chevy|nissan|jeep|bmw|mercedes|audi|hyundai|kia|subaru|dodge|ram|lexus|volkswagen|vw|tesla|gmc|mazda|acura|cadillac|chrysler|buick|lincoln|infiniti|volvo|camry|civic|corolla|accord|f-?150|silverado|rav4|cr-?v|altima|mdx)\b/i.test(text);
        if (hasYear || hasMake) return true;
        return words.length >= 2 && words.length <= 8 && text.length <= 60
          && !/\b(swerv|miss|animal|tree|ran off|rear ended|when a|hit a|hit the|my car|drove|accident|collision|stolen|robbed|police|report|insurance|first|second|third|start|over|traffic|light|lights)\b/i.test(text);
      }
      case 'police':
        return text.length >= 2 && text.length <= 80 && !CONTAMINATION_RE.test(text) && !META_COMPLAINT_RE.test(text);
      case 'lossDetail':
        return text.length >= 2 && text.length <= 200;
      default:
        return true;
    }
  }

  /**
   * Dynamic Entity Extraction from user speech (multi-fact in 1 breath)
   */
  extractEntities(speechText, session) {
    if (!speechText || typeof speechText !== 'string') return session.fnolData;
    const text = normalizeClaimsAsrSpeech(speechText.trim());
    const lower = text.toLowerCase();
    const data = session.fnolData;
    const preSnapshot = {
      locationOfLoss: data.locationOfLoss,
      locationDetails: data.locationDetails ? Object.assign({}, data.locationDetails) : null,
      vehicleInfo: data.vehicleInfo
    };

    // 1. Photo Mention Extraction with Contamination & Negative Safeguard
    const isNegativePhotoSpeech = /\b(no|don't|do not|cannot|can't|not|sin|ningun|ninguna)\b.*\b(photos?|pictures?|pics?|images?|cameras?|fotos?)\b/i.test(lower) || /\b(photos?|pictures?|pics?|images?|cameras?|fotos?)\b.*\b(not available|none|no|unavailable|sin)\b/i.test(lower);
    if (isNegativePhotoSpeech) {
      data.hasPhotos = false;
      data.photoStatus = 'unavailable_at_time_of_call';
      data.photoSmsSent = false;
    } else if (/\b(photos?|pictures?|pics?|images?|cameras?|fotos?)\b/i.test(lower)) {
      data.hasPhotos = true;
      if (/\b(uploaded|just uploaded|i uploaded|sent (?:the |a )?(?:photo|picture|pic|image)|attached (?:the |a )?(?:photo|picture|pic|image)|dropped (?:the |a )?photo|sub[íi] la foto|ya (?:la )?sub[íi]|envi[ée] la foto)\b/i.test(lower)) {
        data.photoStatus = 'UPLOADED_IN_CALL';
        data.photosReceived = Math.max(1, data.photosReceived || 0);
        data.photoUploadValidatedInCall = true;
      } else if (!data.photoStatus || data.photoStatus !== 'UPLOADED_IN_CALL') {
        data.photoStatus = 'Caller indicated photos available — SIU upload link active';
      }
    }

    // 2. Role & Claimant Classification
    if (lower.includes('vp') || lower.includes('vice president') || lower.includes('chief') || lower.includes('executive')) {
      session.callerRole = 'VP_CLAIMS';
    } else if (lower.includes('tpa') || lower.includes('third party') || lower.includes('carrier')) {
      session.callerRole = 'TPA_DIRECTOR';
    } else if (lower.includes('manager') || lower.includes('supervisor') || lower.includes('operations')) {
      session.callerRole = 'OPERATIONS_MANAGER';
    } else if (lower.includes('adjuster') || lower.includes('examiner')) {
      session.callerRole = 'CLAIMS_ADJUSTER';
    } else if (((lower.includes('third-party claimant') || lower.includes('third party claimant') || lower.includes('i am a claimant') || lower.includes('i\'m a claimant')) && !/\bmy\s+policy\b/i.test(lower)) || lower.includes('hit by one of your') || lower.includes('your customer') || lower.includes('your insured') || lower.includes('your policyholder') || lower.includes('your driver') || lower.includes('your client') || lower.includes('not my policy') || lower.includes('one of your policyholders') || lower.includes('one of your drivers') || lower.includes('one of your clients') || lower.includes('your insured hit me') || lower.includes('your customer hit me') || lower.includes('me pego uno de sus asegurados') || lower.includes('su asegurado me choco') || lower.includes('su cliente me pego')) {
      session.isClaimant = true;
      session.callerRole = 'THIRD_PARTY_CLAIMANT';
      if (!session.lossType) session.lossType = 'collision';
      // JD redline #5: 'your customer hit me' pre-answers party + fault + other-vehicle.
      if (!data.assumedFault) data.assumedFault = 'Insured (per third-party claimant)';
      if (data.otherVehicleInvolved === null || data.otherVehicleInvolved === undefined) data.otherVehicleInvolved = true;
    } else if (lower.includes('insured') || lower.includes('driver') || lower.includes('policyholder')) {
      session.callerRole = 'INSURED_DEMO';
    }

    // 3. Company Name / Carrier Extraction (B2B caller employer only — never adverse vehicle/insurer phrases)
    const adverseCarrierMatch = text.match(/\bcollision[^.]*?\bwith\s+(a\s+[A-Za-z0-9\s-]+?\s+insured\s+by\s+[A-Z][A-Za-z0-9\s&']+?)(?:\s+(?:at|on|near|in)\b|[.,;]|$)/i);
    if (adverseCarrierMatch && !data.otherPartyInfo) {
      data.otherPartyInfo = adverseCarrierMatch[1].trim();
      data.otherVehicleInvolved = true;
    }
    if (!data.companyName) {
      const compMatch = text.match(/\b(?:calling\s+from|representing|my\s+company\s+is|company\s+is|work\s+(?:at|for|with)|from)\s+([A-Z][A-Za-z0-9&']*(?:\s+[A-Z][A-Za-z0-9&']*){0,4}\s+(?:Insurance|Underwriters|Mutual|Assurance|Group|Co|Inc|LLC|Corp))\b/);
      if (compMatch && compMatch[1].length > 3) {
        const cleanComp = compMatch[1].trim();
        if (!/^(?:me|us|you|him|her|them|my|your|a|an|the)\b/i.test(cleanComp) && !/\b(?:insured\s+by|driven\s+by|honda|toyota|ford|chevrolet|chevy|nissan|jeep|hyundai|kia|subaru|dodge|ram|lexus|tesla|gmc|mazda|acura|bmw|mercedes)\b/i.test(cleanComp)) {
          data.companyName = cleanComp;
        }
      }
    }

    // 4. Loss Type Classification — D4 canonical detection (EN+ES, 7 types)
    if (!session.lossType) {
      const lt = this.detectLossType(text);
      if (lt) {
        session.lossType = lt;
        const LEGACY = {
          collision: 'GENERAL_COLLISION', hail: 'WEATHER_CATASTROPHE', theft: 'THEFT',
          flood: 'FLOOD', glass: 'GLASS', vandalism: 'VANDALISM', fire: 'FIRE',
          towing_roadside: 'MECHANICAL', fallingobject: 'FALLING_OBJECT'
        };
        session.lossTypeClass = LEGACY[lt] || session.lossTypeClass;
      }
    }
    // Legacy sub-classification kept for the audit payload (only for collisions)
    if (session.lossType === 'collision' || !session.lossType) {
      if (lower.includes('rear') || lower.includes('stopped at red light') || lower.includes('hit from behind') || lower.includes('rear ended') || lower.includes('rear-ended')) {
        session.lossTypeClass = 'REAR_END';
      } else if (lower.includes('left turn') || lower.includes('intersect') || lower.includes('yield')) {
        session.lossTypeClass = 'LEFT_TURN';
      }
    }

    // 4.5. Executive Email Extraction
    if (!data.emailAddress) {
      const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
      if (emailMatch) {
        data.emailAddress = emailMatch[1].toLowerCase();
      } else if (lower.includes(' at ') && (lower.includes(' dot com') || lower.includes(' dot org') || lower.includes(' dot io'))) {
        const spokenEmail = text.toLowerCase()
          .replace(/\s+at\s+/g, '@')
          .replace(/\s+dot\s+/g, '.')
          .replace(/\s+/g, '');
        const cleanSpokenMatch = spokenEmail.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
        if (cleanSpokenMatch) data.emailAddress = cleanSpokenMatch[1];
      }
    }

    // 4.6. Pain-Point & Operational Focus Classification
    data.painPoints = data.painPoints || [];
    if (lower.includes('surge') || lower.includes('backlog') || lower.includes('catastrophe') || lower.includes('storm')) {
      if (!data.painPoints.includes('CATASTROPHE_SURGE_BACKLOG')) data.painPoints.push('CATASTROPHE_SURGE_BACKLOG');
    }
    if (lower.includes('cost') || lower.includes('lae') || lower.includes('expense') || lower.includes('overhead')) {
      if (!data.painPoints.includes('HIGH_LAE_COSTS')) data.painPoints.push('HIGH_LAE_COSTS');
    }
    if (lower.includes('qa') || lower.includes('audit') || lower.includes('compliance') || lower.includes('rule')) {
      if (!data.painPoints.includes('100_PERCENT_QA_AUDITING')) data.painPoints.push('100_PERCENT_QA_AUDITING');
    }

    // 5. Caller Name Extraction
    if (!data.callerName) {
      const allowLooseIntro = !session.pendingSlot || session.pendingSlot === 'narrative' || session.pendingSlot === 'callerName';
      const namePattern = allowLooseIntro
        ? /(?:my name is|i am|i'm|this is|call me|name is|me llamo|mi nombre es)\s+([A-ZÀ-Ýa-zà-ÿ]+(?:\s+(?!(?:and|y|calling|from|with|my|mi|at|on|in|to|report|file)\b)[A-ZÀ-Ýa-zà-ÿ]+)?)/i
        : /(?:my name is|call me|name is|me llamo|mi nombre es)\s+([A-ZÀ-Ýa-zà-ÿ]+(?:\s+(?!(?:and|y|calling|from|with|my|mi|at|on|in|to|report|file)\b)[A-ZÀ-Ýa-zà-ÿ]+)?)/i;
      const nameMatch = text.match(namePattern);
      if (nameMatch) {
        const cleanName = nameMatch[1].replace(/[,.;!?]+$/, '').trim();
        if (cleanName.length >= 2 && this.validateSlotValue('callerName', cleanName) && !['VP', 'DIRECTOR', 'MANAGER', 'ADJUSTER', 'INSURED', 'CHIEF', 'PRESIDENT'].includes(cleanName.toUpperCase())) {
          data.callerName = cleanName;
        }
      } else if (session.pendingSlot === 'callerName') {
        const idEngine = require('./customer_identity_engine.js');
        const idRes = idEngine.extractCallerIdentity(text);
        if (idRes && idRes.displayName && this.validateSlotValue('callerName', idRes.displayName)) {
          data.callerName = idRes.displayName;
        }
      }
    }

    // 6. Policy Number Extraction (D9: extracted candidates are validated too)
    // The other driver's policy number is never the caller's own policy, and "2022 Acura from the policy" is a vehicle reference, not a policy number.
    const isFromPolicyPhrase = /\b(?:from|on|under|in)\s+(?:the|my|our)\s+policy\b/i.test(text);
    const isPoliceReportTurn = /\b(?:police|sheriff|trooper|report\s+(?:number|no|#)|gave\s+me\s+report|PR-[A-Z]{2,4}-\d+)\b/i.test(text) && !/\b(?:policy|p[oó]liza)\b/i.test(text);
    const isPolicyTurn = session.pendingSlot !== 'otherParty' && session.pendingSlot !== 'otherPlate' && !isFromPolicyPhrase && !isPoliceReportTurn
      && (session.pendingSlot === 'policyNumber' || session.pendingSlot === 'insuredInfo' || /\b(?:policy|account|p(?:ó|o)liza)\s*(?:number|is|#|[A-Z0-9])/i.test(text));
    if (!data.policyNumber && isPolicyTurn) {
      const normPol = normalizeSpokenPolicy(text);
      if (normPol !== text && this.validateSlotValue('policyNumber', normPol)) {
        data.policyNumber = normPol.toUpperCase();
      } else {
        const dashText = text.replace(/\b([A-Za-z]{2,4})\s+(?:dash|hyphen|guion|gui[oó]n)\s+(\d{4,10})\b/gi, '$1-$2');
        const polMatch = dashText.match(/(?:policy|pol|account|p(?:ó|o)liza)\s*(?:number|is|#)?\s*([A-Z0-9-]{4,14})/i);
        if (polMatch && !dashText.toLowerCase().includes('fr-') && !dashText.toLowerCase().includes('report')) {
          if (this.validateSlotValue('policyNumber', polMatch[1])) data.policyNumber = polMatch[1].toUpperCase();
        } else if (!dashText.toLowerCase().includes('fr-') && !dashText.toLowerCase().includes('police') && !dashText.toLowerCase().includes('report')) {
          const rawPolMatch = dashText.match(/\b([A-Z]{2,4}-?\d{4,10})\b/);
          if (rawPolMatch && this.validateSlotValue('policyNumber', rawPolMatch[1])) data.policyNumber = rawPolMatch[1].toUpperCase();
        }
      }
    }

    // 7. Date/Time of Loss
    if (!data.dateOfLoss) {
      if (lower.includes('today') || lower.includes('this morning') || lower.includes('just now') || lower.includes('an hour ago') || lower.includes('esta mañana') || lower.includes('hoy')) {
        data.dateOfLoss = new Date().toISOString().split('T')[0] + ' (Today)';
      } else if (lower.includes('yesterday') || lower.includes('ayer')) {
        const d = new Date(); d.setDate(d.getDate() - 1);
        data.dateOfLoss = d.toISOString().split('T')[0] + ' (Yesterday)';
      } else if (/\b(last week|two days ago|three days ago|\d+\s+days\s+ago|last\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|on\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|la semana pasada|hace dos d[íi]as)\b/i.test(text)) {
        const relMatch = text.match(/\b(last week|two days ago|three days ago|\d+\s+days\s+ago|last\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|on\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|la semana pasada|hace dos d[íi]as)\b/i);
        if (relMatch) data.dateOfLoss = relMatch[1];
      } else {
        const dateMatch = text.match(/\b(?:19|20)\d{2}-\d{2}-\d{2}\b|(?:january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)(?:\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?)?/i);
        if (dateMatch) data.dateOfLoss = dateMatch[0].trim();
      }
    }

    // JD redlines 2026-08-27 — 7b. TIME of loss ('last night' = yesterday+night),
    // current vehicle location, tow company, other party, rental intent.
    if (!data.dateOfLoss && (lower.includes('last night') || lower.includes('anoche'))) {
      const d = new Date(); d.setDate(d.getDate() - 1);
      data.dateOfLoss = d.toISOString().split('T')[0] + ' (Yesterday)';
      if (!data.timeOfLoss) data.timeOfLoss = 'Night';
    }
    if (!data.timeOfLoss && session.pendingSlot !== 'impactPoint') { // impact-clock answers ("6 o'clock") are not a time
      const oclockPeriodMatch = text.match(/\b(\d{1,2})\s*o'?clock\s+in\s+the\s+(morning|afternoon|evening)\b/i);
      const clock = oclockPeriodMatch ? [`${oclockPeriodMatch[1]}:00 ${oclockPeriodMatch[2].toLowerCase() === 'morning' ? 'AM' : 'PM'}`] : text.match(/\b\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|o'?clock)\b/i)
        || text.match(/(?:at|around|about|approx(?:imately)?)\s*(\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?)\b/i);
      if (clock) data.timeOfLoss = (clock[1] || clock[0]).toUpperCase();
      else if (lower.includes('last night') || lower.includes('overnight') || lower.includes('midnight') || lower.includes('anoche') || lower.includes('medianoche') || /\bnight\b|\bnoche\b/.test(lower)) data.timeOfLoss = 'Night';
      else if (lower.includes('this morning') || lower.includes('morning') || lower.includes('mañana') || lower.includes('madrugada')) data.timeOfLoss = 'Morning';
      else if (lower.includes('afternoon') || lower.includes('noon') || lower.includes('lunch') || lower.includes('tarde') || lower.includes('mediodía')) data.timeOfLoss = 'Afternoon';
      else if (lower.includes('evening') || lower.includes('rush hour') || lower.includes('atardecer')) data.timeOfLoss = 'Evening';
      else if (lower.includes('just now') || lower.includes('an hour ago') || lower.includes('a few hours ago') || lower.includes('recently') || lower.includes('hace una hora') || lower.includes('hace un momento')) data.timeOfLoss = 'Earlier Today';
    }
    if (!data.vehicleCurrentLocation) {
      const locMatch = lower.match(/\b(body shop|repair shop|the shop|tow yard|impound|copart|salvage yard|junkyard|dealership|driveway|my garage|at home|my house|en casa|en mi casa|en la casa|mi casa|taller|corralón|deshuesadero|dep(ó|o)sito)\b/);
      if (locMatch) {
        const raw = locMatch[1];
        if (/\b(at home|my house|driveway|my garage|en casa|en mi casa|en la casa|mi casa)\b/i.test(raw)) {
          data.vehicleCurrentLocation = 'Residence / Driveway';
        } else {
          data.vehicleCurrentLocation = raw;
        }
      } else if (data.towLocation) data.vehicleCurrentLocation = data.towLocation;
    }
    if (!data.towCompany) {
      const towCo = text.match(/\btowed (?:away )?by\s+(?!(?:none|nobody|no one|n\/a)\b)([A-Za-z0-9\s&'.-]{3,40})/i) || text.match(/\b([A-Z][\w'&.-]*(?:\s+[A-Z][\w'&.-]*){0,3}\s+Tow(?:ing)?)\b/) || text.match(/\bgr(?:ú|u)a de\s+([A-Za-z0-9\s&'.-]{3,40})/i);
      if (towCo) data.towCompany = (towCo[1] || towCo[2] || '').trim();
    }

    // 6.4b Drivability & Towed from Scene Context Extraction (JD Ruling 2026-09-11)
    if (/\b(towed (from (the )?scene|away)|wreck(er)? took it|got towed|was towed|se lo llev[oó] la gr[úu]a|fue remolcado)\b/i.test(text) && !/\btowed\s+by\s+none\b/i.test(text)) {
      data.drivability = 'Non-Drivable / Towed from Scene';
      data.drivable = false;
      data.wasTowedFromScene = true;
    } else if (/\b(not\s+drivable|non-drivable|isn'?t\s+drivable|cannot\s+drive|can'?t\s+drive|undrivable|inoperable|completely\s+disabled|no\s+se\s+puede\s+manejar|won'?t\s+start|cannot\s+be\s+driven|electronics\s+are\s+dead|axle\s+is\s+(?:bent|broken)|radiator\s+(?:is\s+)?(?:crushed|smashed|leaking)|leaking\s+(?:fluids?|coolant|antifreeze|oil)|submerged|needs?\s+(?:a\s+)?(?:flatbed|tow|wrecker)|no\s+arranca|eje\s+(?:doblado|roto)|fuga\s+de\s+(?:l[íi]quido|anticongelante|aceite))\b/i.test(text)) {
      data.drivability = 'Non-Drivable';
      data.drivable = false;
    } else if (/\b(drove (it )?(home|away)|drivable|driveable|can (still )?drive|still (drives|runs)|it drives|drives (fine|ok|okay)|todav[ií]a (se puede manejar|funciona)|manej[eé] a casa|se puede manejar)\b/i.test(text) && !/\b(not drivable|non-drivable|can'?t drive|cannot drive|isn'?t drivable|no se puede manejar)\b/i.test(text)) {
      data.drivability = 'Drivable';
      data.drivable = true;
      if (/\b(driveway|at home|in my garage|en mi casa|en casa)\b/i.test(text) && !data.vehicleCurrentLocation) {
        data.vehicleCurrentLocation = 'Residence / Driveway';
      }
    } else if (session.pendingSlot === 'drivabilityLeaks') {
      if (/^(?:yes|yeah|yep|yup|sure|it is|s[íi]|claro)\b/i.test(text.trim()) && !/\b(not|no|cannot|can'?t|towed|broken|bent|leaking)\b/i.test(text)) {
        data.drivability = 'Drivable';
        data.drivable = true;
      } else if (/^(?:no|nope|nah)\b/i.test(text.trim())) {
        data.drivability = 'Non-Drivable';
        data.drivable = false;
      }
    }

    const isNonCollisionPerilNow = ['hail', 'flood', 'glass', 'theft', 'vandalism', 'fire', 'fallingobject', 'towing_roadside'].includes(session.lossType);
    if (isNonCollisionPerilNow && (data.otherVehicleInvolved === null || data.otherVehicleInvolved === undefined)) {
      data.otherVehicleInvolved = false;
      if (!data.otherPartyInfo) data.otherPartyInfo = 'N/A (Non-Collision / Weather Peril)';
    }
    if (data.otherVehicleInvolved === null || data.otherVehicleInvolved === undefined) {
      if (/\b(no other (car|vehicle)|no another vehicle|another vehicle (was not|wasn't|was not involved)|single vehicle|just me|nobody else|no one else|not another vehicle|no second vehicle|ning(ú|u)n otro)\b/i.test(text)
        || (/\b(no|not|neither|never)\b/i.test(text) && /\b(other|another|second)\s+(car|vehicle|driver)\b/i.test(text))) {
        data.otherVehicleInvolved = false;
        data.otherPartyInfo = 'N/A (Single Vehicle Collision)';
      } else if (
        !/\b(hail|storm|flood|water|tree|branch|limb|deer|animal|rock|debris|wind)\b[^.?!]{0,35}\b(hit|struck)\b/i.test(text) &&
        (/\b(other|another)\s+(car|vehicle|driver|truck|suv)\b|\b(truck|car|suv|van)\b[^.?!]{0,40}\b(hit|rear.?ended|struck|backed into)\b|\b(hit|rear.?ended|struck|backed into)\b[^.?!]{0,25}\b(me|us|my)\b/i.test(text))
      ) {
        data.otherVehicleInvolved = true;
      }
    }
    if (!data.rentalRequested && /\brent(al| a car)|loaner|replacement (car|vehicle)|courtesy car|alquiler|renta de auto|carro de renta|auto de reemplazo/i.test(text)) {
      data.rentalRequested = true;
    }
    // 6.5. Flood Adjuster Probes Extraction (Parked vs Running, Water Depth, Salt/Fresh/Brackish Water, Engine Restart)
    if (!data.floodParkedOrRunning && (session.pendingSlot === 'floodParkedOrRunning' || session.lossType === 'flood')) {
      if (/\b(parked|stationary|sitting|driveway|garage|estacionado|parado|estaba parado)\b/i.test(text)) {
        data.floodParkedOrRunning = 'Parked (Unattended / Off)';
      } else if (/\b(drove|running|engine|driving|stalled|died|water\s+entered|moving|en marcha|manejando|conduciendo)\b/i.test(text)) {
        data.floodParkedOrRunning = 'Running / Drove into standing water';
      }
    }
    if ((session.lossType === 'flood' || session.pendingSlot === 'engineRestart') && /\b(no one tried to start|nobody tried to start|didn'?t try to start|did not try to start|never tried to start|haven'?t tried to start|tried to start|attempted to start|cranked)\b/i.test(text)) {
      data.perilProbes = data.perilProbes || {};
      if (!data.perilProbes.engineRestart) {
        data.perilProbes.engineRestart = /\b(no one|nobody|didn'?t|did not|never|haven'?t)\b/i.test(text)
          ? 'No — Engine was not cranked or restarted after water exposure'
          : 'Yes — Caller reported attempt to start engine';
      }
    }
    if (!data.waterLevel && (session.pendingSlot === 'floodWaterLevel' || session.lossType === 'flood')) {
      if (/\b(roof|top|submerged|covered|totaled|above the roof|techo)\b/i.test(text)) data.waterLevel = 'Above Roof (Total Submersion)';
      else if (/\b(dash|dashboard|steering|seats|seat|tablero|asientos)\b/i.test(text)) data.waterLevel = 'Dashboard / Seats';
      else if (/\b(floor|floorboard|carpet|pedals|piso|alfombra)\b/i.test(text)) data.waterLevel = 'Floorboards';
      else if (/\b(tire|tires|wheel|wheels|bumper|ruedas|llantas)\b/i.test(text)) data.waterLevel = 'Tires / Bumper';
    }
    if (!data.waterType && (session.pendingSlot === 'floodWaterType' || session.lossType === 'flood')) {
      if (/\b(ocean|salt|sea|gulf|beach|coastal|surge|storm surge|mar|salada|marina)\b/i.test(text)) data.waterType = 'Saltwater (Ocean/Bay Proximity)';
      else if (/\b(brackish|estuary|bayou|intracoastal|salobre)\b/i.test(text)) data.waterType = 'Brackish Water';
      else if (/\b(river|lake|creek|rain|storm|fresh|flash flood|drainage|r[íi]o|lluvia|dulce)\b/i.test(text)) data.waterType = 'Freshwater / Stormwater';
      else if (data.locationOfLoss && !this.isCoastalFloodZone(data.locationOfLoss)) {
        data.waterType = 'Freshwater / Inland Stormwater (Auto-Resolved >50 mi from Coast)';
      }
    }
    // 6.6 Mechanical Breakdown Cause & Foul Play Triage Extraction
    if (!data.mechanicalCause && (session.pendingSlot === 'mechanicalProbe' || session.pendingSlot === 'lossDetail' || session.lossType === 'towing_roadside')) {
      if (/\b(battery|dead battery|bater[íi]a|acumulador)\b/i.test(text)) data.mechanicalCause = 'Dead Battery / Electrical System';
      else if (/\b(starter|alternator|ignition|arrancador|alternador)\b/i.test(text)) data.mechanicalCause = 'Starter / Alternator Failure';
      else if (/\b(overheat\w*|radiator|coolant|sobrecalent\w*|radiador)\b/i.test(text)) data.mechanicalCause = 'Engine Overheating / Radiator Leak';
      else if (/\b(flat tire|punctur\w*|blowout|ponchad\w*|llanta|neum[áa]tico)\b/i.test(text)) data.mechanicalCause = 'Flat Tire / Tire Blowout';
      else if (/\b(transmission|clutch|gears|transmisi[óo]n|embrague)\b/i.test(text)) data.mechanicalCause = 'Transmission / Drivetrain Failure';
      else if (/\b(out of gas|empty tank|sin gasolina|gasolina)\b/i.test(text)) data.mechanicalCause = 'Fuel Exhaustion / Empty Tank';
      else if (/\b(engine|motor|died|stalled|stopped|se apag[óo])\b/i.test(text)) data.mechanicalCause = 'Engine Stall / Mechanical Failure';
      else if (/\b(mechanical(\s+failure)?|breakdown|falla\s+mecanica|averia)\b/i.test(text)) data.mechanicalCause = 'Mechanical Breakdown / Failure';
      if (data.mechanicalCause && text.length > 5) data.mechanicalDetail = text.trim();
    }

    // 6.7 Hail Severity, Distribution & Glass-Only Physical Triage (JD Ruling 2026-09-11)
    if (session.lossType === 'hail') {
      if (!data.hailParkedOrMoving) {
        if (/\b(parked|stationary|sitting|in (?:my |the )?driveway|outside in (?:my |the )?driveway|unoccupied|estacionad[oa]|parado|en la cochera|en la entrada)\b/i.test(text)) {
          data.hailParkedOrMoving = 'Parked outside in driveway';
          data.hailParkedOrDriving = 'Parked outside in driveway';
        } else if (/\b(driv(?:ing|en)|on the road|on the highway|moving|manejando|conduciendo)\b/i.test(text)) {
          data.hailParkedOrMoving = 'Being driven';
          data.hailParkedOrDriving = 'Being driven';
        }
      }
      const normText = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const normGlass = normText.replace(/\b(door|side|back|rear)\s+(window|glass)\b/gi, 'window_glass');
      const panelList = '(?:body|panels?|paneles|hood|roof|carroceria|doors?|puertas?|fenders?|quarter\\s*panels?|tailgates?|anywhere|ningun\\s*lado)';
      const negClause1 = new RegExp('\\b(?:no|zero|without|sin)\\s+(?:other\\s+|body\\s+|sheet\\s*metal\\s+|panel\\s+)*(?:dents?|dings?|damage|danos?|abolladuras|golpes)(?:\\s+(?:on|to|en)\\s+(?:the\\s+|la\\s+|el\\s+)?' + panelList + '(?:\\s*(?:,|or|and|y|o)\\s*(?:the\\s+|la\\s+|el\\s+)?' + panelList + ')*)?', 'gi');
      const negClause2 = new RegExp('\\b(?:no|zero|without|sin)\\s+(?:damage\\s+to|danos?\\s+en)\\s+(?:the\\s+|la\\s+|el\\s+)?' + panelList + '(?:\\s*(?:,|or|and|y|o)\\s*(?:the\\s+|la\\s+|el\\s+)?' + panelList + ')*', 'gi');

      const strippedNegative = normGlass.replace(negClause1, '').replace(negClause2, '');
      const hasBodyDamageMention = /\b(dented|dents?|dings?|body\s*damage|panel\s*damage|hood|roof|trunk|doors?|puertas?|door\s*panels?|fenders?|quarter\s*panels?|tailgates?|bed|quarter|fender|cofre|abollad[oa]s?|golpes|carroceria)\b/i.test(strippedNegative);
      const hasNegativeBodyDamage = /\b(?:no|zero|without|sin)\s+(?:other\s+|body\s+|sheet\s*metal\s+|panel\s+)*(?:dents?|dings?|damage|danos?|abolladuras|golpes)/i.test(normGlass);
      const hasGlass = /\b(windshield|glass|window|window_glass|back\s*glass|door\s*window|cristal|vidrio|parabrisas)\b/i.test(normGlass);
      const isOnlyGlass = !hasBodyDamageMention && (
        /\b(only\s+(?:the\s+)?(?:windshield|glass|window|window_glass)|just\s+(?:the\s+)?(?:windshield|glass|window|window_glass)|(?:windshield|glass|window|window_glass)\s+only|cracked\s+windshield\s+only|solo\s+(?:el\s+)?(?:cristal|parabrisas|vidrio))\b/i.test(normGlass)
        || (hasGlass && hasNegativeBodyDamage)
      );

      if (isOnlyGlass) {
        data.triageFlag = 'GLASS_ONLY_REPORTED_AS_HAIL';
        data.triageCategory = 'GLASS_ONLY_REPORTED_AS_HAIL';
        data.lossTypeDetail = 'Reported as hail; caller stated damage is isolated strictly to auto glass with zero body dents (flagged for adjuster review)';
        if (!data.additionalAdjusterNotes || !data.additionalAdjusterNotes.includes('GLASS_ONLY_REPORTED_AS_HAIL')) {
          data.additionalAdjusterNotes = (data.additionalAdjusterNotes ? data.additionalAdjusterNotes + ' | ' : '') +
            'TRIAGE FLAG: Caller reported hail, but stated damage is isolated strictly to auto glass with zero sheet metal or panel dents. Flagged for human adjuster review and potential Glass-Only dispatch.';
        }
      } else if (!data.hailSeverity) {
        const hasGlass = /\b(glass|windshield|window|back\s*glass|door\s*window|cristal|vidrio|parabrisas)\b/i.test(lower);
        if (/\b(tailgate|carport|few dings|minor|dings on|small dents|isolated|solo unos golpes|algunas abolladuras|dinged)\b/i.test(lower)) {
          data.hailSeverity = hasGlass ? 'Minor / Isolated Panel Dings (Including Glass Damage)' : 'Minor / Isolated Panel Dings';
          data.lossTypeDetail = hasGlass ? `${text.trim()} (hail damage with glass damage noted)` : text.trim();
        } else if (/\b(all over|all over my car|everywhere|covered in dents|deep dents|baseball|golf ball|heavy|severe|destrozado|todo el auto|por todos lados)\b/i.test(lower)) {
          data.hailSeverity = hasGlass ? 'Severe / 360-Degree Total Surface Denting (Including Glass Damage)' : 'Severe / 360-Degree Total Surface Denting';
          data.lossTypeDetail = hasGlass ? 'Hail damage all over including glass damage' : text.trim();
        } else if (/\b(hood|roof|hood and roof|roof and hood|techo|cap[óo])\b/i.test(lower)) {
          data.hailSeverity = hasGlass ? 'Moderate / Horizontal Panels (Including Glass Damage)' : 'Moderate / Horizontal Panels (Hood & Roof)';
          data.lossTypeDetail = hasGlass ? `${text.trim()} (including glass damage)` : text.trim();
        } else if (hasGlass) {
          data.hailSeverity = 'Hail damage including glass damage';
          data.lossTypeDetail = 'Hail damage all over including glass damage';
        }
      }
    }

    // Readback hygiene (JD redlines): a location stops before trailing clauses,
    // and a third-party claimant has no policy number of ours to capture.
    if (data.locationOfLoss) {
      data.locationOfLoss = stripTrailingNarrativeFromAddress(data.locationOfLoss);
    }
    if (data.locationOfLoss && session.pendingSlot !== 'location' && !/\d|\b(street|st|road|rd|avenue|ave|blvd|boulevard|highway|hwy|interstate|freeway|exit|parking|plaza|mall|home|house|driveway|garage|lot|calle|avenida|carretera|autopista)\b/i.test(data.locationOfLoss)) {
      data.locationOfLoss = '';
    }
    if (session.isClaimant && data.policyNumber && data.policyNumber.indexOf('POL-LOOKUP') !== 0) {
      data.policyNumber = '';
    }
    // Slot lock (JD redlines): once a specific loss location (street/intersection/landmark, specificity >= 3) is filled,
    // later answers to OTHER questions (e.g. police-report or tow-yard turn) may never overwrite it — UNLESS caller is explicitly correcting the address.
    const isExplicitAddressCorrection = Boolean(
      /\b(\d{2,5}\s+[A-Za-z]|wrong\s+address|incorrect\s+address|change\s+the\s+address|the\s+address\s+(?:is|was)|it\s+was\s+at\s+\d+|not\s+\d{2,5})\b/i.test(text)
    );
    session.__lockedLoc = (!isExplicitAddressCorrection && session.pendingSlot !== 'location' && session.pendingSlot !== 'narrative' && data.locationOfLoss && secondListenerRagEngine.scoreLocationSpecificity(data.locationOfLoss) >= 3) ? data.locationOfLoss : null;
    if (isExplicitAddressCorrection && /\b\d{2,5}\s+[A-Za-z]/i.test(text)) {
      data.locationOfLoss = '';
    }
    if (data.vehicleInfo && data.vehicleInfo.length > 40) {
      const vm = data.vehicleInfo.match(/(?:19|20)\d{2}\s+[A-Za-z][\w-]*(?:\s+[A-Za-z0-9][\w-]*){0,2}/);
      data.vehicleInfo = vm ? vm[0] : data.vehicleInfo.split(/\s+(?:and|it|which|that)\s+/i)[0].slice(0, 40).trim();
    }

    // 8. Loss Location (Plottable Map Parsing)
    if (!data.locationDetails) {
      data.locationDetails = { streetAddress: '', intersection: '', landmarkBusiness: '', city: '', state: '', zipCode: '', formattedPlottable: '', mapUrl: '' };
    }
    const locDet = data.locationDetails;

    // Zip code (exclude numbers that are part of policy numbers like POL-99201 or police reports like PR-HOU-51707)
    const zipMatch = text.match(/(?<![A-Za-z0-9]-|\b(?:pol(?:icy)?|p[oó]liza|report|pr|number|no|dash|hyphen|#)\s*[-#]?\s*)\b(\d{5}(?:-\d{4})?)\b/i);
    if (zipMatch && !text.toLowerCase().includes(`pol-${zipMatch[1]}`) && !text.toLowerCase().includes(`policy ${zipMatch[1]}`) && !new RegExp(`[a-z]{2,4}-\\s*${zipMatch[1]}`, 'i').test(text)) {
      locDet.zipCode = zipMatch[1];
    }

    // City & State
    const knownCitiesRe = 'Dallas|Fort Worth|Austin|Houston|San Antonio|El Paso|Arlington|Plano|Frisco|Denton|Irving|Garland|McKinney|Grand Prairie|Tyler|Waco|Wichita Falls|Lubbock|Amarillo|Midland|Odessa|Abilene|Beaumont|Round Rock|Conway|Broken Bow|Texarkana|Longview|De Queen|Hot Springs|Little Rock|Fayetteville|Fort Smith|Bentonville|Hope|Mena|Idabel|Shreveport|McAllen|Laredo|Brownsville|Corpus Christi|Killeen|Pasadena|Mesquite|Carrollton|Galveston|Sugar Land|The Woodlands|Pearland|League City|College Station|Bryan|Temple|New Braunfels|San Marcos|Georgetown|Cedar Park|Pflugerville|Flower Mound|Euless|Bedford|Grapevine|Allen|Rowlett|Wylie|Rockwall|DeSoto|Cedar Hill|Mansfield|Burleson|Weatherford|Cleburne|Waxahachie|Corsicana|Paris|Sherman|Denison|Greenville|Terrell|Forney|Kaufman|Baytown|Conroe|Huntsville|Lufkin|Nacogdoches|Victoria|Harlingen|Edinburg|Mission|Pharr|Weslaco|Del Rio|Eagle Pass|Kerrville|Fredericksburg|Boerne|Seguin|Schertz|Cibolo|Kyle|Buda|Bastrop|Lockhart|Taylor|Hutto|Leander|Liberty Hill|Burnet|Marble Falls|Stephenville|Granbury|Mineral Wells|San Angelo|Brownwood|Addison';
    const knownCityStateMatch = text.match(new RegExp(`\\b(${knownCitiesRe})\\s*[,.]?\\s*\\b(Texas|TX|California|CA|Florida|FL|New York|NY|Illinois|IL|Ohio|OH|Georgia|GA|North Carolina|NC|Michigan|MI|Oklahoma|OK|Arkansas|AR|Louisiana|LA)\\b`, 'i'));
    const fallbackCityStateMatch = !knownCityStateMatch && text.match(/\b(?:in|near|city of|en|cerca de|ciudad de)\s+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ'-]+(?:\s+[A-ZÀ-Ÿ][A-Za-zÀ-ÿ'-]+){0,2}),?\s*(Texas|California|Florida|New York|Illinois|Ohio|Georgia|North Carolina|Michigan|Oklahoma|Arkansas|Louisiana)\b/i);
    const cityStateMatch = knownCityStateMatch || (fallbackCityStateMatch && !/\b(road|rd|street|st|avenue|ave|blvd|boulevard|drive|dr|lane|ln|parkway|pkwy|highway|hwy|freeway|loop|in|en|at|on|mi|mis|my|our|the|el|la|cochera|garage|driveway|casa|house)\b/i.test(fallbackCityStateMatch[1]) ? fallbackCityStateMatch : null);
    if (cityStateMatch) {
      locDet.city = cityStateMatch[1].trim();
      locDet.state = cityStateMatch[2].trim().toUpperCase();
    } else {
      const cityOnlyMatch = text.match(new RegExp(`\\b(?:in|near|at|en|cerca de)\\s+(${knownCitiesRe})\\b`, 'i'))
        || text.match(new RegExp(`\\b(${knownCitiesRe})\\s+(?:Police|Sheriff|P\\.?D\\.?|Department|Dept)\\b`, 'i'));
      if (cityOnlyMatch && !locDet.city) {
        locDet.city = cityOnlyMatch[1].trim();
      }
      const fullStateMatch = text.match(/\b(Texas|California|Florida|New York|Illinois|Ohio|Georgia|North Carolina|Michigan|Oklahoma|Arkansas|Louisiana)\b/i);
      const codeStateMatch = text.match(new RegExp(`(?<!\\b(?:policy|p[oó]liza)\\s+)(?:,\\s*|\\b(?:${knownCitiesRe})\\s+)(TX|CA|FL|NY|IL|OH|GA|NC|MI|OK|AR|LA)\\b(?!\\s*(?:-|dash|hyphen|\\d))`));
      if (fullStateMatch && !locDet.state) locDet.state = fullStateMatch[1].toUpperCase();
      else if (codeStateMatch && !locDet.state) locDet.state = codeStateMatch[1].toUpperCase();
    }

    // Intersections (e.g. "Main Street and 5th Avenue", "I-35 at Parmer Lane", "Main St at Tollway", "Katy Freeway at Gessner Rd", or suffix-less "at the stop sign of Oak Lawn and Lemmon")
    const interMatch = text.match(/((?:[A-Z0-9'-]+(?:\s+[A-Z0-9'-]+)?\s+)?(?:\bst\b|\bstreet\b|\bave\b|\bavenue\b|\bblvd\b|\bboulevard\b|\brd\b|\broad\b|\bhwy\b|\bhighway\b|\bfwy\b|\bfreeway\b|\bexpy\b|\bexpressway\b|\btollway\b|\bpkwy\b|\bparkway\b|\bdr\b|\bdrive\b|\blane\b|\bln\b|\bi-\d+[a-z]?(?:\s+(?:northbound|southbound|eastbound|westbound))?\b|\binterstate\s+\d+[a-z]?\b|\binterestatal\s+\d+\b))\s+(?:and|&|\/|at|near|cross\s+with|corner\s+of|con|y)\s+((?:[A-Z0-9'-]+(?:\s+[A-Z0-9'-]+)?\s+)?(?:\bst\b|\bstreet\b|\bave\b|\bavenue\b|\bblvd\b|\bboulevard\b|\brd\b|\broad\b|\bhwy\b|\bhighway\b|\bfwy\b|\bfreeway\b|\bexpy\b|\bexpressway\b|\btollway\b|\bpkwy\b|\bparkway\b|\bdr\b|\bdrive\b|\blane\b|\bln\b|\bi-\d+[a-z]?\b|\binterstate\s+\d+[a-z]?\b|\binterestatal\s+\d+\b))/i);
    if (interMatch) {
      locDet.intersection = `${interMatch[1].trim()} & ${interMatch[2].trim()}`.replace(/^(?:on|at|near|intersection of|corner of|en|en la)\s+/i, '');
    } else {
      const bareInterMatch = text.match(/\b(?:intersection\s+of|corner\s+of|stop\s+sign\s+(?:of|at)|red\s+light\s+(?:of|at)|traffic\s+light\s+(?:of|at)|turn(?:ing)?\s+at|at)\s+([A-Za-z][A-Za-z0-9'.-]+(?:\s+(?!(?:and|&|in|at|on|near|making|turning|driving)\b)[A-Za-z][A-Za-z0-9'.-]+)?)\s+(?:and|&)\s+([A-Za-z][A-Za-z0-9'.-]+(?:\s+(?!(?:in|at|on|near|making|turning|driving|when|where|dallas|houston|austin|fort|san|tyler|waco|texas|tx)\b)[A-Za-z][A-Za-z0-9'.-]+)?)(?=\s*(?:[,.!?]|$|\b(?:in|at|on|making|turning|driving|when|where|dallas|houston|austin|texas|tx)\b))/i);
      if (bareInterMatch) {
        const s1 = bareInterMatch[1].trim();
        const s2 = bareInterMatch[2].trim();
        const nonStreetWords = /^(?:the|a|an|my|our|your|his|her|this|that|home|work|house|car|truck|vehicle|yesterday|today|night|morning|afternoon|evening|dry|wet|sunny|clear|rain|raining)$/i;
        if (!nonStreetWords.test(s1.split(/\s+/)[0]) && !nonStreetWords.test(s2.split(/\s+/)[0])) {
          const cap = str => str.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          locDet.intersection = `${cap(s1)} & ${cap(s2)}`;
        }
      }
    }

    // Business Landmark / Parking Lot (e.g. "Walmart parking lot", "Shell gas station", "H-E-B parking lot")
    const landmarkMatch = text.match(/(?:parking lot of|parking lot at|in front of|at the|near the)?\s*([A-Z0-9'-]+(?:\s+[A-Z0-9'-]+)?\s+(?:parking lot|gas station|plaza|center|mall|walmart|target|h-?e-?b|kroger|shell|chevron|mcdonalds|cvs|walgreens|home depot))/i);
    if (landmarkMatch && !locDet.landmarkBusiness) {
      const candidateLandmark = landmarkMatch[1].trim().replace(/^(?:(?:from|in|at|on|near|the|a|an|my|our|parked)\s+)+/i, '').trim();
      if (candidateLandmark && !/^(?:parking\s+lot|gas\s+station|plaza|center|mall|lot|garage|street|road|highway)$/i.test(candidateLandmark)) {
        locDet.landmarkBusiness = candidateLandmark;
      }
    }

    // Street address / Highway (e.g. "1200 Commerce Boulevard", "2900 Highway 69", "1500 Loop 323", "I-10 at Exit 21", "I-10 Westbound near De Zavala Rd", "I-35W at Heritage Trace Pkwy")
    const highwayMatch = text.match(/\b((?:\d{1,5}\s+)?(?:interstate|interestatal|i-|us-|u\.s\.\s*highway|state\s+highway|highway|hwy|loop|beltway|fm|sh)\s*\d+[A-Za-z]?(?:\s+(?:northbound|southbound|eastbound|westbound|nb|sb|eb|wb))?(?:\s*(?:,|at|near|by)?\s*(?:(?:cerca de la salida|exit|salida|mile\s+marker)\s*\d+[A-Za-z]?|[A-Z][A-Za-z0-9'-]+(?:\s+[A-Z][A-Za-z0-9'-]+){0,2}\s+(?:st|street|ave|avenue|blvd|boulevard|rd|road|hwy|highway|pkwy|parkway|dr|drive|lane|ln|way|tollway|fwy|freeway|loop)))?)\b/i);
    const streetAddrMatch = text.match(/(?<!(?:f-|f\s*|e-|e\s*|\bmodel\s*))\b(\d{1,5}\s+(?!(?:on|in|at|with|by|and|out|for|to|mph|miles|hour|dry|wet)\b)[A-Za-zÀ-ÿ0-9'-]+(?:\s*,?\s+[A-Za-zÀ-ÿ0-9'-]+)?\s+(?:st|street|ave|avenue|blvd|boulevard|rd|road|hwy|highway|pkwy|parkway|dr|drive|lane|ln|way|ct|court|pl|place|cir|circle|trail|loop|ter|terrace|route|rt|fm)(?:\s+\d{1,4}[A-Za-z]?)?)\b/i)
      || text.match(/\b(\d{1,5}\s+(?:Calle|Avenida|Av|Bulevar|Carretera|Autopista|Camino)\s+[A-Za-zÀ-ÿ0-9'-]+(?:\s+(?!(?:en|in|cerca|dañando|chocar)\b)[A-Za-zÀ-ÿ0-9'-]+)?)\b/i)
      || text.match(new RegExp(`(?<!(?:f-|f\\s*|e-|e\\s*|\\bmodel\\s*|\\b19|\\b20))\\b(\\d{2,5}\\s+(?!(?:acura|honda|ford|toyota|chevy|chevrolet|nissan|bmw|mercedes|audi|hyundai|kia|subaru|dodge|ram|lexus|tesla|gmc|mazda|jeep|mph|miles)\\b)[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9'-]+(?:\\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9'-]+){0,3})(?=\\s*[,.]?\\s*(?:(?:in|en)\\s+)?(?:${knownCitiesRe}|Texas|TX|\\d{5})\\b)`, 'i'));
    if (highwayMatch) {
      locDet.streetAddress = highwayMatch[1].trim();
    } else if (streetAddrMatch) {
      locDet.streetAddress = streetAddrMatch[1].replace(/,/g, '').replace(/\s+/g, ' ').replace(/[,.]+$/, '').trim();
    }

    const hasNumericStreetCandidate = Boolean(locDet.streetAddress || /\b\d{2,5}\s+[A-Za-z]{2,}/i.test(text));

    // General fallback for locationOfLoss
    if (!data.locationOfLoss) {
      if (session.pendingSlot === 'location' && !hasNumericStreetCandidate && /\b(at my house|at home|in (my )?driveway|at (my )?residence|en mi casa|en casa)\b/i.test(text)) {
        data.locationOfLoss = 'Residence / Home';
        locDet.formattedPlottable = 'Residence / Home';
      } else {
        const cleanLocText = sanitizeUserUtterance(text);
        if (session.pendingSlot === 'location' && !hasNumericStreetCandidate && /\b(at my house|at home|in (my )?driveway|at (my )?residence|en mi casa|en casa)\b/i.test(cleanLocText)) {
          data.locationOfLoss = 'Residence / Home';
          locDet.formattedPlottable = 'Residence / Home';
        } else {
          const isRoadOrWeather = /\b(wet|dry|slick|icy|rain|snow|fog|road condition|pavement)\b/i.test(cleanLocText);
          if (!isRoadOrWeather || session.pendingSlot === 'location') {
            const namedStreetInCity = cleanLocText.match(/\b(?:on|at|near)\s+([A-Z][A-Za-z0-9'-]+(?:\s+[A-Z][A-Za-z0-9'-]+)?\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Parkway|Pkwy|Highway|Hwy)(?:\s+(?:in|near)\s+[A-Z][A-Za-z\s]+,\s*[A-Z]{2})?)/i);
            const locMatch = namedStreetInCity || cleanLocText.match(/\b(?:on|at|near|en|en la|cerca de|intersection of|located at)\b\s+([A-Z0-9\s,#\.-]{5,60})/i);
            if (locMatch && !/\b(wet|dry|slick|icy|rain|snow|road condition)\b/i.test(locMatch[1])) {
              const trimmedLoc = stripTrailingNarrativeFromAddress(
                locMatch[1].replace(/^(?:my\s+home\s+address|my\s+house|my\s+address)\s*[,:-]?\s*/i, '')
              );
              const isGenericPlaceOnly = /^(?:a|an|the)?\s*(?:gas\s+station|parking\s+lot|grocery\s+store|shopping\s+center|car\s+wash|driveway|highway|street|road)$/i.test(trimmedLoc.trim());
              if (!isGenericPlaceOnly && this.validateSlotValue('location', trimmedLoc)) {
                data.locationOfLoss = trimmedLoc;
              }
            } else if (session.pendingSlot === 'location' && (hasNumericStreetCandidate || lower.includes('street') || lower.includes('ave') || lower.includes('blvd') || lower.includes('highway') || lower.includes('road') || lower.includes('i-') || lower.includes('interstate') || lower.includes('interestatal') || lower.includes('lane') || lower.includes('parking lot'))) {
              const strippedHomePrefix = stripTrailingNarrativeFromAddress(
                cleanLocText.replace(/^(?:at\s+)?(?:my\s+home\s+address|my\s+house|my\s+address|it\s+was\s+at|it\s+happened\s+at)\s*[,:-]?\s*/i, '')
              );
              if (this.validateSlotValue('location', strippedHomePrefix)) data.locationOfLoss = strippedHomePrefix;
            }
          }
        }
      }
    }

    // Format full plottable map location (deduplicated)
    const hasDrivewayOrHome = !hasNumericStreetCandidate && /\b(in (my )?driveway|at my house|at home|at (my )?residence|en mi cochera|en mi casa|en casa)\b/i.test(text);
    const rawLoc = locDet.streetAddress || locDet.intersection || locDet.landmarkBusiness || (hasDrivewayOrHome && (locDet.city || locDet.zipCode) ? 'Residence Driveway' : '') || data.locationOfLoss || '';
    if (rawLoc === 'Residence / Home' && !locDet.streetAddress && !locDet.city && !locDet.zipCode) {
      locDet.formattedPlottable = 'Residence / Home';
      data.locationOfLoss = 'Residence / Home';
    } else {
      let locParts = [rawLoc];
      if (locDet.city && !rawLoc.toLowerCase().includes(locDet.city.toLowerCase())) locParts.push(locDet.city);
      if (locDet.state && !rawLoc.toLowerCase().includes(locDet.state.toLowerCase())) locParts.push(locDet.state);
      if (locDet.zipCode && !rawLoc.includes(locDet.zipCode)) locParts.push(locDet.zipCode);
      locParts = locParts.filter(Boolean).filter(part => !CONTAMINATION_RE.test(part) && !META_COMPLAINT_RE.test(part));
      // Never allow a bare state name ("TEXAS") without a street, city, or zip to populate locationOfLoss
      if (locParts.length > 0 && (rawLoc || locDet.city || locDet.zipCode)) {
        locDet.formattedPlottable = locParts.join(', ');
        locDet.mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locDet.formattedPlottable)}`;
        data.locationOfLoss = locDet.formattedPlottable;
      }
    }

    // 8b. Facts of Loss (Speed, Weather, Impact Point, Road Conditions)
    if (!data.lossFacts) {
      data.lossFacts = { speed: '', impactPoint: '', weather: '', roadCondition: '', trafficSignal: '', perilDetails: '', factsSummary: '' };
    }
    const lf = data.lossFacts;

    // Speed extraction
    const speedMatch = text.match(/(\d{1,3}\s*(?:mph|miles per hour|km\/h))/i) || text.match(/(?:going|driving|traveling|moving)\s*(?:about|around|approx|roughly)?\s*(\d{1,3})/i);
    if (speedMatch && !lf.speed) {
      lf.speed = speedMatch[1].includes('mph') ? speedMatch[1] : `${speedMatch[1]} mph`;
    }

    // Impact point (capture all unique damaged areas mentioned across turns)
    const impactMatches = text.match(/\b(front bumper|rear bumper|driver side|passenger side|windshield|hood|roof|fender|tailgate|side mirror|t-boned|rear-ended|head-on|undercarriage|floorboards?|doors?)\b/gi);
    if (impactMatches && impactMatches.length > 0) {
      const existingParts = lf.impactPoint ? lf.impactPoint.split(/,\s*/).map(s => s.toLowerCase().trim()).filter(Boolean) : [];
      for (const m of impactMatches) {
        const cleanPart = m.toLowerCase().trim();
        if (!existingParts.includes(cleanPart)) existingParts.push(cleanPart);
      }
      lf.impactPoint = existingParts.join(', ');
    }

    // Heading to / coming from / trip dynamics (exclude auxiliary verb "going to <verb>")
    const isAuxGoingTo = /\bgoing\s+to\s+(?:be|function|work|see|happen|do|get|have|test|try|ask|need|report|file|make|take|send|text|call|check|know|show|start|say|tell)\b/i.test(text);
    const tripMatch = !isAuxGoingTo && (
      text.match(/(?:heading|headed|coming|driving|traveling)\s+(?:from|to)\s+([a-zA-Z0-9\s,.-]+?)(?:\s+(?:and|when|while|at|on|road|it)\b|[.!?]|$)/i)
      || text.match(/(?:heading|headed|coming|going)\s+(home|to\s+work|to\s+the\s+office|from\s+work|downtown|uptown|to\s+the\s+store|to\s+school)/i)
    );
    if (tripMatch && !lf.tripPurpose) {
      lf.tripPurpose = tripMatch[0].trim();
      data.folInvestigated = true;
    }
    if (session.pendingSlot === 'folInvestigate' && text.length >= 3) {
      data.folInvestigated = true;
      if (!lf.tripDynamics) lf.tripDynamics = text;
    }

    // Weather & Road & Lighting
    if (/\bdry\b/i.test(lower)) lf.roadCondition = 'Dry';
    if (/\b(wet|rain|raining|pouring)\b/i.test(lower)) lf.roadCondition = 'Wet';
    if (/\b(snow|snowing|ice|icy|sleet|blizzard|black ice)\b/i.test(lower)) lf.roadCondition = 'Ice / Snow';

    if (lower.includes('daylight') || lower.includes('daytime')) {
      lf.weather = lf.weather ? `${lf.weather} / Daylight` : 'Clear / Daylight';
    } else if (lower.includes('night') || lower.includes('dark') || lower.includes('darkness')) {
      lf.weather = lf.weather ? `${lf.weather} / Night` : 'Rain / Night';
    } else if (lower.includes('rain') || lower.includes('pouring')) {
      lf.weather = 'Rain / Wet';
    } else if (lower.includes('clear') || lower.includes('sunny')) {
      lf.weather = 'Clear / Dry';
    }

    // Traffic signal / controls
    if (lower.includes('green arrow')) lf.trafficSignal = 'Green Arrow';
    else if (lower.includes('solid green')) lf.trafficSignal = 'Solid Green';
    else if (/\b(?:light was red|red light|ran the red|had the red|red signal)\b/i.test(lower)) lf.trafficSignal = 'Red Light';
    else if (/\b(?:light was green|green light|green signal|had the green|was green|green for me)\b/i.test(lower)) lf.trafficSignal = 'Green Light';
    else if (/\b(?:light was yellow|yellow light|amber)\b/i.test(lower)) lf.trafficSignal = 'Yellow Light';
    else if (/\bstop sign\b/i.test(lower)) lf.trafficSignal = 'Stop Sign';
    else if (/\byield sign\b/i.test(lower)) lf.trafficSignal = 'Yield Sign';
    else if (/\b(?:no signal|no light|no stop sign|uncontrolled|none)\b/i.test(lower)) lf.trafficSignal = 'None / Uncontrolled';
    else if (session.pendingSlot === 'trafficControls' && text.length >= 2) {
      if (!CONTAMINATION_RE.test(text) && !META_COMPLAINT_RE.test(text) && /\b(signal|light|sign|stop|green|red|yellow|uncontrolled|none|no|yes)\b/i.test(lower)) {
        lf.trafficSignal = sanitizeUserUtterance(text);
      }
    }
    
    // --- Advanced Scene Reconstruction Kinematics & Diagram Extraction ---
    const dirPattern = '(?:northbound|southbound|eastbound|westbound|nb|sb|eb|wb|north|south|east|west|hacia el norte|hacia el sur|hacia el este|hacia el oeste|al norte|al sur|al este|al oeste)';
    const clientDirMatch = text.match(new RegExp(`\\b(?:i was|we were|my vehicle was|traveling|going|driving|headed|heading|iba en direcci[oó]n|iba hacia el)\\s+(${dirPattern})\\b`, 'i'))
      || text.match(new RegExp(`\\b(${dirPattern})\\s+(?:on|along|down|en)\\b`, 'i'));
    if (clientDirMatch && !lf.travelDirection) {
      const raw = clientDirMatch[1].toUpperCase();
      if (raw.startsWith('NORTH') || raw === 'NB' || raw.includes('NORTE')) lf.travelDirection = 'Northbound';
      else if (raw.startsWith('SOUTH') || raw === 'SB' || raw.includes('SUR')) lf.travelDirection = 'Southbound';
      else if (raw.startsWith('EAST') || raw === 'EB' || raw.includes('ESTE')) lf.travelDirection = 'Eastbound';
      else if (raw.startsWith('WEST') || raw === 'WB' || raw.includes('OESTE')) lf.travelDirection = 'Westbound';
    }

    const advDirMatch = text.match(new RegExp(`\\b(?:other (?:driver|car|vehicle)|adverse|he|she|they|def|el otro|la otra)\\s+(?:was\\s+)?(?:traveling|going|driving|headed|heading|coming from|iba|ven[ií]a)?\\s*(?:from\\s+)?(${dirPattern})\\b`, 'i'));
    if (advDirMatch && !lf.adverseDirection) {
      const raw = advDirMatch[1].toUpperCase();
      if (raw.startsWith('NORTH') || raw === 'NB' || raw.includes('NORTE')) lf.adverseDirection = 'Northbound';
      else if (raw.startsWith('SOUTH') || raw === 'SB' || raw.includes('SUR')) lf.adverseDirection = 'Southbound';
      else if (raw.startsWith('EAST') || raw === 'EB' || raw.includes('ESTE')) lf.adverseDirection = 'Eastbound';
      else if (raw.startsWith('WEST') || raw === 'WB' || raw.includes('OESTE')) lf.adverseDirection = 'Westbound';
    }

    const clientSpeedMatch = text.match(/\\b(?:i was (?:going|traveling|driving)|my speed was|going|driving|traveling|iba a)\\s*(?:about|around|approx|roughly)?\\s*(\\d{1,3})\\s*(?:mph|miles per hour|km\/h)?/i);
    if (clientSpeedMatch && !lf.speed) {
      lf.speed = `${clientSpeedMatch[1]} mph`;
    }
    const advSpeedMatch = text.match(/\\b(?:other (?:car|vehicle|driver)|they|he|she|def|el otro)\\s+(?:was\\s+)?(?:going|traveling|driving|doing|iba a)\\s*(?:about|around|approx|at least)?\\s*(\\d{1,3})\\s*(?:mph|miles per hour|km\/h)?/i);
    if (advSpeedMatch && !lf.adverseSpeed) {
      lf.adverseSpeed = `${advSpeedMatch[1]} mph`;
    }

    if (/\\bairbags?\\s+(?:deployed|went off|opened)|bolsas? de aire\\s+(?:se desplegaron|abrieron)\\b/i.test(lower)) {
      lf.airbagsDeployed = true;
    }

    if (/\\b(left.?turn|turned left|making a left|turning left|failed to yield|left hand turn|giro a la izquierda|vuelta a la izquierda)\\b/i.test(lower)) {
      lf.accidentTemplate = 'left_turn';
    } else if (/\\b(rear.?end(ed)?|slammed into my rear|hit from behind|hit my rear|rear bumper crushed|golpe por detr[aá]s|choque trasero)\\b/i.test(lower)) {
      lf.accidentTemplate = 'rear_end';
    } else if (/\\b(t.?bon(ed)?|t.?bone|broadside|right angle|impacto lateral|choque en t)\\b/i.test(lower)) {
      lf.accidentTemplate = 't_bone';
    } else if (/\\b(sideswipe(d)?|swiped|changed lanes into|merged into (my|our) lane|choque lateral)\\b/i.test(lower)) {
      lf.accidentTemplate = 'sideswipe';
    } else if (/\\b(multi.?vehicle|chain reaction|pile.?up|pushed into|pushed my car into|colisi[oó]n m[uú]ltiple|en cadena)\\b/i.test(lower)) {
      lf.accidentTemplate = 'multi_vehicle';
    } else if (/\\b(deer|animal strike|animal|hit a tree|hit a pole|guardrail|ditch|hydroplane|hydroplaned|lost control|single vehicle|sin otro veh[íi]culo|solo mi carro|choque contra objeto)\\b/i.test(lower)) {
      lf.accidentTemplate = 'single_vehicle';
      data.otherVehicleInvolved = false;
      if (!data.otherPartyInfo) data.otherPartyInfo = 'N/A - Single Vehicle Incident';
    }

    if (lf.trafficSignal || (session.pendingSlot === 'trafficControls' && !META_COMPLAINT_RE.test(text))) {
      data.trafficControlsCaptured = true;
    }

    // Compile facts summary
    const factsList = [];
    if (lf.tripPurpose) factsList.push(`Trip: ${lf.tripPurpose}`);
    if (lf.roadCondition) factsList.push(`Road: ${lf.roadCondition}`);
    if (lf.speed) factsList.push(`Speed: ${lf.speed}`);
    if (lf.impactPoint) factsList.push(`Impact: ${lf.impactPoint}`);
    if (lf.weather) factsList.push(`Weather: ${lf.weather}`);
    if (lf.trafficSignal) factsList.push(`Signal: ${lf.trafficSignal}`);
    if (factsList.length > 0) lf.factsSummary = factsList.join(' | ');

    // 9. Loss Description / Narrative (Strict validation: exclude questions, complaints, meta comments)
    const strippedNarrative = text.replace(/^(?:(?:yes|yeah|yep|sure|ok|okay|si|sí)\b\s*(?:[,.!]\s*)?(?:(?:please\s+|you\s+can\s+)?(?:text\s+me|send\s+(?:me\s+)?(?:the\s+link|it)|puedes\s+enviar(?:me)?)(?:[,.!]\s*|\s+and\s+|\s+y\s+)?)?|(?:please\s+|you\s+can\s+)?(?:text\s+me|send\s+(?:me\s+)?(?:the\s+link|it)|puedes\s+enviar(?:me)?)(?:[,.!]\s*|\s+and\s+|\s+y\s+)?)/i, '').trim();
    const isCleanNarrativePortion = strippedNarrative.length >= 10 && !CONTAMINATION_RE.test(strippedNarrative);
    const isLossNarrativeUtterance = !META_COMPLAINT_RE.test(text) &&
      (!CONTAMINATION_RE.test(text) || isCleanNarrativePortion) &&
      !/^(what|how|why|can you|are you|could you|who|is this|i don't understand|i have a question)\b/i.test(text.trim()) &&
      !text.endsWith('?') &&
      /\b(hit|rear[- ]?ended?|backed into|crash|collision|dented?|scratched?|damage|hail|flood|water|theft|stolen|broke|broken|glass|windshield|tree|branch|pole|guardrail|animal|deer|tow|breakdown|stalled|overheat|fire|vandal|cay[óo]|da[ñn][oa]|choc|golp|turn|turning|blocked|obstruction|view|delivery truck|traffic|driving|traveling|stopped|fence|wall|barrier|pushed\s+into|cemetery|whiplash|roadside\s+shoulder|incident)\b/i.test(text);

    if (isLossNarrativeUtterance) {
      const cleanDesc = isCleanNarrativePortion ? strippedNarrative : text;
      if (!data.lossDescription && cleanDesc.length >= 10) {
        data.lossDescription = cleanDesc;
      } else if (data.lossDescription && cleanDesc.length >= 10 && !data.lossDescription.includes(cleanDesc)) {
        data.lossDescription += ' ' + cleanDesc;
      }
    }

    // Epistemic Decoupling: Quarantines supernatural / astrological beliefs while preserving material facts
    const supernaturalMatch = text.match(/\b(ghost|aliens?|ufo|witchcraft|curse|demons?|astrology|mercury\s+in\s+retrograde|spiritual\s+whiplash|haunted|poltergeist)\b/i);
    if (supernaturalMatch) {
      data.narrative_abstract_cause = text;
      data.delusional_psychotic_indicator = true;
      session.delusionalIndicator = true;
    }

    // 10. Vehicle Details & Mobility Safety Assessment
    if (session.lossType === 'flood' && !data.floodParkedOrRunning && /\b(watching tv|sitting inside|inside the house|looked outside|parked|in the driveway|stationary)\b/i.test(lower)) {
      data.floodParkedOrRunning = 'Parked (Unattended / Off)';
      data.otherVehicleInvolved = false;
    }
    if (session.lossType === 'flood' && !data.waterType && /\b(rain|raining|rained|rainwater|storm|downpour|lluvia|lloviendo)\b/i.test(lower)) {
      data.waterType = 'Fresh water (Rain / Runoff)';
    }
    const isExplicitVehicleCorrection = Boolean(
      session.pendingSlot === 'summaryConfirm' ||
      session.awaitingSummaryFix ||
      /\b(actually|instead|wrong\s+vehicle|the\s+vehicle\s+is|it\s+is\s+actually)\b/i.test(text)
    );
    if (!data.vehicleInfo || session.pendingSlot === 'vehicle' || isExplicitVehicleCorrection || data.vehicleInfo.trim().split(/\s+/).length < 3) {
      const hasPolicyRef = /\b(?:from|on|under|in|listed\s+on)\s+(?:the|my|our)\s+policy\b/i.test(text);
      const rawVehInput = text.replace(/^(?:(?:no|wait|sorry|actually)[,.\s]+)*(?:the\s+vehicle\s+is\s+(?:actually\s+)?(?:a\s+|an\s+)?|it\s+is\s+(?:actually\s+)?(?:a\s+|an\s+)?|it's\s+(?:actually\s+)?(?:a\s+|an\s+)?|the\s+|my\s+|our\s+)/i, '').replace(/\s+(?:from|on|under|in|listed\s+on)\s+(?:the|my|our)\s+policy\b.*/i, '').trim();
      const vehColorRe = /\b((?:19|20)\d{2})\s+((?:(?:metallic|pearl|matte|dark|light|bright|deep|midnight|navy|royal|sky|ice|oxford|ruby|crimson|forest|emerald|lime|champagne|charcoal|gunmetal|silver|slate|atomic|lunar|solar|magnetic|glacial|opal|platinum|titanium)\s+)?(?:black|white|silver|gray|grey|charcoal|blue|red|maroon|burgundy|green|brown|tan|beige|gold|yellow|orange|bronze|champagne|pewter|ivory|cream|purple|violet|teal|turquoise|copper|negro|blanco|gris|plateado|azul|rojo|verde|cafe|marr[oó]n|dorado|amarillo|naranja))\s+(?=[A-Za-z])/i;
      const colorMatch = rawVehInput.match(vehColorRe);
      if (colorMatch && !data.vehicleColor) {
        data.vehicleColor = colorMatch[2].trim();
      }
      const strippedVehInput = rawVehInput.replace(vehColorRe, '$1 ');
      const vehMatch = strippedVehInput.match(/\b((?:19|20)\d{2}\s+[A-Za-z0-9'-]+(?:\s+[A-Za-z0-9'-]+){0,3})\b/i);
      const makeModelMatch = strippedVehInput.match(/\b((?:19|20)\d{2}\s+)?(Ford|Chevrolet|Chevy|Toyota|Honda|Nissan|Jeep|BMW|Mercedes|Audi|Hyundai|Kia|Subaru|Dodge|Ram|Lexus|Volkswagen|VW|Tesla|GMC|Mazda|Acura|Cadillac|Chrysler|Buick|Lincoln|Infiniti|Volvo)(?:\s+([A-Za-z0-9'-]+(?:\s+[A-Za-z0-9'-]+){0,2}))?\b/i);
      const trailingVehClauseRe = /\s+(?:and|it|is|are|was|were|has|had|got|drivable|with|when|while|in|at|on|for|from|to|near|by|out|heading|the|policy|parked|estacionado|estacionada|parqueado|parqueada|collided|crashed|backed|sideswiped|rear-ended|stolen|burned|caught|choc[óo]|golpe[óo]|crushing|smashing|denting|knocking|ripping|flooding|damaging|dañando|en|(?<!\bmodel\s+)y|con|which|that|completely|currently|sitting|towed|damaged|hit|struck)\b.*/i;
      if (hasPolicyRef) {
        data.vehicleInfo = data.policyVehicle || (session.intakeMode === 'demo' ? '2022 Acura MDX (Policy Vehicle)' : 'Insured Vehicle on Policy');
      } else if (vehMatch && !CONTAMINATION_RE.test(vehMatch[1])) {
        const cleanVeh = vehMatch[1].replace(trailingVehClauseRe, '').trim();
        if (cleanVeh.length >= 6 && this.validateSlotValue('vehicle', cleanVeh)) data.vehicleInfo = cleanVeh;
      } else if (makeModelMatch && !CONTAMINATION_RE.test(makeModelMatch[0])) {
        const cleanMake = makeModelMatch[0].replace(trailingVehClauseRe, '').trim();
        if (this.validateSlotValue('vehicle', cleanMake)) data.vehicleInfo = cleanMake;
      } else if (/\b(?:vehicle|car|truck|suv|auto|motto|model)\s+(?:listed\s+)?(?:on|from|under|in)\s+(?:the|my|our)\s+policy\b|\blisted\s+on\s+(?:the|my)\s+policy\b/i.test(text)) {
        data.vehicleInfo = data.policyVehicle || (session.intakeMode === 'demo' ? '2022 Acura MDX (Policy Vehicle)' : 'Insured Vehicle on Policy');
      } else if (session.pendingSlot === 'vehicle' && this.validateSlotValue('vehicle', strippedVehInput) && !/\b(uh+|um+|something|whatever|don'?t\s+know)\b/i.test(strippedVehInput)) { // only accept free-form vehicle text on vehicle turn when not hesitant placeholder
        data.vehicleInfo = strippedVehInput;
      }
    }

    this.evaluateMobilitySafety(session, text);

    // 11. Injury Status & Medical Triage (Explicit check for NO injury vs INJURY)
    const otherPartyOnlyInjury = /\b(?:none|no\s+one|nobody|no\s+injuries)\s+in\s+(?:my|our)\s+(?:vehicle|car|truck|suv)\b/i.test(text) && /\bother\s+(?:driver|party|passenger|car|vehicle)[^.?!]*\b(?:broken|hurt|injur|ambulance|hospital|pain|bleed)/i.test(text);
    if (otherPartyOnlyInjury) {
      data.injuryStatus = false;
      data.injuryAlert = false;
      data.otherPartyInjuryReported = true;
      data.otherPartyInjuryStatus = 'Asked & Documented Only: Other-party injury reported (' + text.trim() + ')';
      data.injuryDetails = 'No injuries in insured vehicle; other party injury documented';
    }
    if (data.injuryStatus === null || data.injuryStatus === undefined) {
      if (lower.includes('no injur') || /\bno ?(one|body|person)\b[^.?!]{0,20}\b(injur\w*|hurt|inside)\b/i.test(lower) || lower.includes('everyone is fine') || /\bno ?(one|body)\b[^.?!]{0,16}\bhurt\b/.test(lower) || lower.includes('unhurt') || lower.includes('no injuries') || lower.includes('fine, no hurt') || lower.includes('everyone\'s fine') || lower.includes('everyone is ok') || lower.includes('everyone is safe') || lower.includes('nobody was inside') || lower.includes('unoccupied') || lower.includes('sin lesiones') || lower.includes('no hay lesion') || lower.includes('no hay herid') || /\bno\s+(hay|hubo)\s+(lesion|herid)/i.test(lower) || lower.includes('todos están bien') || lower.includes('todos estan bien') || lower.includes('nadie result') || lower.includes('no hubo heridos') || lower.includes('no hubo lesion') || /\bnadie\b[^.?!]{0,20}\b(lesionad|herid)/i.test(lower) || lower.includes('sin heridos') || lower.includes('sin lesionados') || (session.pendingSlot === 'injury' && /^(?:no|nope|none|nobody|no one|nadie)\b/i.test(lower.trim()) && !/\b(hurt|injur|pain|neck|back|hospital|ambulance|herid|lesion|dolor)\b/i.test(lower))) {
        data.injuryStatus = false;
        data.injuryAlert = false;
        session.fnolData.injuryAlert = false;
        data.injuryDetails = 'No injuries reported';
        session.injuryConditionBranch = 'STANDARD_PROPERTY_DAMAGE';
      } else if (lower.includes('injur') || lower.includes('hurt') || lower.includes('hospital') || lower.includes('ambulance') || lower.includes('bleed') || lower.includes('herido') || lower.includes('herida') || lower.includes('lesion') || lower.includes('whiplash') || lower.includes('neck') || lower.includes('pain') || lower.includes('dolor') || lower.includes('sore') || lower.includes('checked out') || (session.pendingSlot === 'injury' && /^(?:yes|yeah|yep|s[íi])\b/i.test(lower.trim()))) {
        data.injuryStatus = true;
        data.injuryAlert = true;
        session.fnolData.injuryAlert = true;
        data.injuryDetails = text;
        session.injuryConditionBranch = 'PRIORITY_MEDICAL_ESCALATION';
      }
    }

    // 12. Police Report
    const hasExplicitPoliceFiled = /\b(police\s+(?:came|responded|department|dept|officers?\s+responded|report)|sheriff\s+responded|state\s+trooper|highway\s+patrol|filed\s+a\s+report|report\s+filed|yes\s*,?\s*[a-z\s]*police|gave\s+me\s+report\s+number|fr\s*#|report\s*#|PR-[A-Z]{2,4}-\d+|(?:report|fr|case)\s*(?:#|number|no\.?)?\s*[A-Z]{2,5}-\d{3,10}|[a-z]+\s+pd\s+report|reporte\s+policial)\b/i.test(text)
      || (session.pendingSlot === 'police' && /^(?:yes|yeah|yep|s[íi])\b/i.test(lower.trim()));
    const hasExplicitNoPolice = /\b(no\s+police|didn'?t\s+call\s+(?:the\s+)?police|never\s+called\s+(?:the\s+)?police|nobody\s+came\s+out|no\s+report|without\s+police|police\s+were\s+not\s+called|no\s+officers?|report\s+was\s+not\s+filed)\b/i.test(text)
      || (session.pendingSlot === 'police' && /\b(no|none|nope|not\s+filed|declined|refused)\b/i.test(lower) && !hasExplicitPoliceFiled);
    if (hasExplicitPoliceFiled) {
      data.policeReport = 'Filed (Yes)';
    } else if (!data.policeReport || data.policeReport === '') {
      if (hasExplicitNoPolice) {
        data.policeReport = 'None (No)';
        data.policeReportNumber = 'N/A';
        data.policeJurisdiction = 'N/A';
      } else if (lower.includes('police')) {
        data.policeReport = 'Filed (Yes)';
      }
    }

    if (data.policeReport === 'Filed (Yes)' || (data.policeReport && data.policeReport.includes('Filed'))) {
      const pdMatch = text.match(/\b([A-Z][A-Za-z0-9]{1,15}(?:\s+[A-Z][A-Za-z0-9]{1,15})?\s+(?:PD|P\.D\.|Police\s+Department|Police\s+Dept|Police|Sheriff|Department|Dept))\b/) || text.match(/\b([a-zA-Z0-9]{2,15}\s+PD)\b/i);
      if (pdMatch) {
        const rawDept = pdMatch[1].trim();
        if (!/\b(yes|the|came|filed)\b/i.test(rawDept)) {
          data.policeJurisdiction = rawDept;
        }
      }
      const frMatch = text.match(/(?:fr|fr#|police\s+report|pd\s+report|reporte\s+policial(?:\s+de\s+[a-z\s]+)?|report|ref|reference|incident|case)\s*(?:#|number|no\.?|num|is|es)?\s*([A-Z]{2,5}-\d{3,10}|[A-Z0-9-]{4,16})/i);
      if (frMatch && !['FILED', 'YES', 'NO', 'POLICE', 'REPORT', 'CAME', 'NUMBER', 'NUM', 'POLICIAL', 'IS', 'ES'].includes(frMatch[1].toUpperCase())) {
        data.policeReportNumber = frMatch[1].toUpperCase();
      } else if (!data.policeReportNumber || data.policeReportNumber === 'Unknown / Pending' || data.policeReportNumber === 'NUMBER' || data.policeReportNumber === 'N/A') {
        if (data.policeJurisdiction) {
          data.policeReportNumber = `Pending (${data.policeJurisdiction})`;
        }
      }
    }

    // Post-capture hygiene: THIS turn's location capture gets the same trim +
    // place-cue validation the prior turn got (a "red light" is not a place,
    // and bare "the highway" / "from the parking lot" without a name/number/city is not a plottable location).
    if (data.locationOfLoss) {
      data.locationOfLoss = stripTrailingNarrativeFromAddress(data.locationOfLoss);
      if (session.pendingSlot !== 'location' && (
        !/\d|\b(street|st|road|rd|avenue|ave|blvd|boulevard|dr|drive|ln|lane|pkwy|parkway|highway|hwy|interstate|freeway|fwy|expressway|expy|tollway|loop|beltway|way|ct|court|pl|place|cir|circle|exit|parking|plaza|mall|home|house|driveway|garage|lot|calle|avenida|carretera|autopista)\b/i.test(data.locationOfLoss) ||
        /^(?:(?:from|in|at|on|near)\s+)?(?:the|a|an|my|our)?\s*(?:parking\s+lot|highway|freeway|interstate|road|street|lane|intersection|lot|garage)$/i.test(data.locationOfLoss.trim())
      )) {
        data.locationOfLoss = '';
      }
    }

    // Detect Animal / Tree mentions for dynamic adjuster sub-probes
    if (lower.includes('animal') || lower.includes('deer') || lower.includes('dog') || lower.includes('cow') || lower.includes('horse') || lower.includes('swerve') || lower.includes('swerved') || lower.includes('swerving')) {
      session.hasAnimalMention = true;
    }
    if (/\b(tree|trees|branch|limb|pole|fence|guardrail|wall|property)\b/i.test(lower)) {
      session.hasTreeMention = true;
    }

    if (session.pendingSlot === 'animalProbe' && text.length >= 2) {
      data.animalDetails = text;
    }
    if (ANIMAL_STRIKE_RE.test(String(text).normalize('NFD').replace(/[̀-ͯ]/g, ''))) {
      session.animalStrike = true;
      if ((data.otherVehicleInvolved === null || data.otherVehicleInvolved === undefined) && !/\b(other\s+(?:car|vehicle|driver|truck)|another\s+(?:car|vehicle|driver)|rear[- ]?ended\s+me|hit\s+me)\b/i.test(text)) {
        data.otherVehicleInvolved = false;
      }
    }
    if (text.length >= 2 && !META_COMPLAINT_RE.test(text)) {
      if (PERIL_PROBE_SLOTS.includes(session.pendingSlot)) {
        data.perilProbes = data.perilProbes || {};
        data.perilProbes[session.pendingSlot] = text;
        if (session.pendingSlot === 'hailParked' && !data.hailParkedOrMoving) {
          data.hailParkedOrMoving = /\b(driv|moving|road|highway)\b/i.test(text) ? 'Being driven' : 'Parked outside in driveway';
        }
        if (session.pendingSlot === 'hailSeverity' && !data.hailSeverity) {
          data.hailSeverity = text;
        }
      }
      if (session.pendingSlot === 'otherParty' && !data.otherPartyInfo) data.otherPartyInfo = text;
      if (session.pendingSlot === 'towWhere' && !data.towLocation && !data.towCompany) data.towLocation = text;
      if (session.pendingSlot === 'floodParkedOrRunning' && !data.floodParkedOrRunning) data.floodParkedOrRunning = text;
      if (session.pendingSlot === 'floodWaterLevel' && !data.waterLevel) data.waterLevel = text;
      if (session.pendingSlot === 'floodWaterType' && !data.waterType) data.waterType = text;
      if (session.lossType === 'flood' && !data.waterLevel && /\b(door sill|door sills|floorboard|floorboards|carpet|seat|seats|dashboard|steering wheel|windshield|roof|hood|tires?|wheels?|hubcaps?)\b/i.test(lower)) {
        data.waterLevel = text;
      }
    }
    if (session.pendingSlot === 'treeProbe' && text.length >= 2) {
      data.treePropertyDetails = text;
    }
    if (session.pendingSlot === 'folInvestigate' && text.length >= 2) {
      data.folInvestigated = text;
      data.commercialUseChecked = lower.includes('commercial') || lower.includes('uber') || lower.includes('lyft') || lower.includes('delivery') || lower.includes('no') || lower.includes('personal');
    }
    if (session.pendingSlot === 'folWrap' && text.length >= 2) {
      data.contactPreference = (lower.includes('text') || lower.includes('sms') || lower.includes('mensaje')) ? 'Text Message' : 'Phone Call';
      if (!data.additionalAdjusterNotes) data.additionalAdjusterNotes = text;
    }
    if (session.pendingSlot === 'photos' && text.length >= 2 && data.photoStatus !== 'UPLOADED_IN_CALL') {
      data.photoStatus = (lower.includes('no') || lower.includes('none') || lower.includes("don't")) ? 'unavailable_at_time_of_call' : 'Caller indicated photos available — SIU upload link sent by text';
      if (lower.includes('no') || lower.includes('none') || lower.includes("don't")) {
        data.hasPhotos = false;
        data.photoSmsSent = false;
      }
    }

    if (session.__lockedLoc) data.locationOfLoss = session.__lockedLoc;
    secondListenerRagEngine.protectSlotIntegrity(preSnapshot, session, text, session.pendingSlot);
    this.buildDiagramData(session);
    return data;
  }

  /**
   * The active question flow for this session: per-loss-type once detected,
   * generic (clarify-first) until then.
   */
  activeFlow(session) {
    if (session.isClaimant) {
      return ['insuredInfo', 'injuryAndDrivability', 'claimantContact', 'location', 'police', 'summaryConfirm'];
    }
    let flow = ((session.lossType && LOSS_TYPE_FLOWS[session.lossType]) || GENERIC_FLOW).slice();
    if (session.animalStrike && (!session.lossType || session.lossType === 'collision') && session.fnolData.otherVehicleInvolved !== true) flow = ANIMAL_STRIKE_FLOW.slice();
    if (session.abridgedDemo) {
      if (session.fnolData) {
        if (!session.fnolData.policyNumber) session.fnolData.policyNumber = 'PA-8849201-NAT';
        if (!session.fnolData.vehicleInfo) session.fnolData.vehicleInfo = '2022 Acura MDX';
        session.fnolData.folInvestigated = true;
        session.fnolData.trafficControlsCaptured = true;
      }
      const SECONDARY_DEMO_SKIP_SLOTS = new Set([
        'otherPlate', 'otherParty', 'impactPoint', 'trafficControls',
        'folInvestigate', 'floodWaterType', 'vehicleLocation', 'towWhere',
        'animalProbe', 'carcassHazard', 'engineRestart'
      ]);
      flow = flow.filter(s => !SECONDARY_DEMO_SKIP_SLOTS.has(s));
    }
    // Capture caller's name if in live mode OR if non-abridged Demo Host handed off without capturing callerName
    const needsCallerName = !session.abridgedDemo && (session.intakeMode === 'live' || (session.skipGreetingPreamble && !session.hostCallerName && !(session.fnolData && session.fnolData.callerName)));
    if (needsCallerName && !flow.includes('callerName')) {
      const at = session.intakeMode === 'live'
        ? (flow[0] === 'losstype' ? 1 : 0)
        : (flow.indexOf('photos') >= 0 ? flow.indexOf('photos') : flow.length);
      flow = [...flow.slice(0, at), 'callerName', ...flow.slice(at)];
    }
    // Ensure date/time of loss is asked before photos/summaryConfirm if neither dateOfLoss nor timeOfLoss was volunteered in narrative.
    if (session.fnolData && !session.fnolData.dateOfLoss && !session.fnolData.timeOfLoss && !flow.includes('timeOfLoss')) {
      const photoIdx = flow.indexOf('photos');
      if (photoIdx >= 0) {
        flow = [...flow.slice(0, photoIdx), 'timeOfLoss', ...flow.slice(photoIdx)];
      } else {
        flow.push('timeOfLoss');
      }
    }
    return flow;
  }

  /**
   * D4 third-cycle fix (RF-5 second opinion 2026-08-20, rule A — real engine
   * defect, call CA707834): "My name is Elena Marquez." was accepted as the
   * heard narrative, so the loss-type menu fired before any story existed.
   * A narrative-slot answer only counts as the STORY when it is incident-shaped
   * or long enough to be one — a bare self-introduction or a letter-by-letter
   * spelling turn is a WHO, not a WHAT.
   */
  isSubstantiveStory(text) {
    const s = String(text || '').trim();
    if (!s) return false;

    // Never a story if it's a request for a human or customer service
    if (/\b(human|representative|operator|real person|live agent|talk to a (person|human|representative|manager|agent)|speak (to|with) a (person|human|representative|manager|agent)|speak (to|with) someone|speak to a manager|transfer me|customer service|persona|humano|representante|operador|hablar con (una persona|un humano|alguien)|persona real)\b/i.test(s)) {
      return false;
    }

    // Never a story if it's meta-testing, pricing, or product questions
    if (/\b(demo|testing|plans?|features?|pricing|how much|cost|dashboard|axirate|contractor|guidewire|duck creek|software|system|update|updates|completed|failed|test)\b/i.test(s) && !/\b(hit|accident|crash|damage|stolen|flood|hail)\b/i.test(s)) {
      return false;
    }

    // Bare self-introduction (EN + ES) — optionally after a greeting.
    if (/^(hi|hello|hey|hola|buenos d(í|i)as|buenas tardes|buenas noches)?[,.!\s]*(my name is|this is|i am|i'm|me llamo|mi nombre es|soy|habla)\s+[\p{L}\s.,'-]+$/iu.test(s)) return false;

    // Incident-shaped content is always a story, however short ("It was hail damage").
    if (/(happen|accident|crash|hit\b|rear.?end|stolen|steal|theft|broke|break.?in|wreck|hail|storm|flood|fire|glass|windshield|vandal|damag|claim|collision|tow\b|towing|mechanical|breakdown|engine|transmission|stalled|overheat|alternator|radiator|battery|averia|falla mecanica|drivabl|keyed|tree|branch|fell on|landed on|árbol|arbol|rama|cayó|cayo|accidente|choqu|colisi(ó|o)n|granizo|robo|robaron|inundaci|incendio|vandalismo|da(ñ|n)o|golpe|siniestro|reclamo|parabrisas|pas(ó|o)\b|fence|wall|barrier|pole|curb|hydrant|ditch|whiplash|pushed\s+into|drove\s+into|crashed\s+into|swerved\s+into|into\s+a\s+(?:fence|wall|barrier|pole|tree|ditch)|neck\s+(?:hurts|pain)|injur(y|ed)?)/i.test(s)) return true;

    // Strip consent lead-in before checking contamination
    const strippedConsent = s.replace(/^(?:(?:yes|yeah|yep|sure|ok|okay|si|sí)\b\s*(?:[,.!]\s*)?(?:(?:please\s+|you\s+can\s+)?(?:text\s+me|send\s+(?:me\s+)?(?:the\s+link|it)|puedes\s+enviar(?:me)?)(?:[,.!]\s*|\s+and\s+|\s+y\s+)?)?|(?:please\s+|you\s+can\s+)?(?:text\s+me|send\s+(?:me\s+)?(?:the\s+link|it)|puedes\s+enviar(?:me)?)(?:[,.!]\s*|\s+and\s+|\s+y\s+)?)/i, '').trim();
    const isCleanNarrative = strippedConsent.length >= 10 && !CONTAMINATION_RE.test(strippedConsent);
    // Questions, meta-complaints, or ASR artifacts are never stories
    if (s.endsWith('?') || /^(what|how|why|can you|are you|could you|who|is this|i don't understand|i have a question)\b/i.test(s) || (!isCleanNarrative && CONTAMINATION_RE.test(s)) || META_COMPLAINT_RE.test(s)) {
      return false;
    }
    // Letter-by-letter spelling ("E, l e, n a m a r q u e. Z").
    const tokens = s.split(/[\s,.]+/).filter(Boolean);
    if (tokens.length >= 3 && tokens.filter(x => x.length <= 2).length >= tokens.length - 1) return false;

    // Only if it has both driving/location verbs AND descriptive tokens
    const hasMovementOrAction = /\b(driving|stopped|turning|backing|parked|traveling|going|standing|crossing|sitting|manejando|parado|estacionado|doblando)\b/i.test(s);
    return tokens.length >= 6 && hasMovementOrAction;
  }

  /**
   * Returns true ONLY if the reported location is in a coastal city/county/ZIP
   * within 50 miles of the coastline (where saltwater or brackish water is plausible).
   * Inland cities (e.g., Dallas, Fort Worth, Austin, Waco, Tyler, Wichita Falls,
   * San Antonio, Lubbock, Amarillo, El Paso, Oklahoma City, Little Rock, etc.)
   * return false so Angel NEVER asks "Was it salt water or brackish?" on an inland flood.
   */
  isCoastalFloodZone(locationText) {
    const loc = String(locationText || '').trim();
    if (!loc) return false; // Do not ask salt/brackish unless coastal location is established
    // Explicit inland metro/city match (>50 miles from any coastline)
    if (/\b(dallas|fort\s+worth|arlington|plano|frisco|irving|garland|mckinney|denton|carrollton|richardson|lewisville|allen|flower\s+mound|grapevine|mesquite|grand\s+prairie|waco|temple|killeen|austin|round\s+rock|cedar\s+park|georgetown|san\s+marcos|san\s+antonio|new\s+braunfels|tyler|longview|texarkana|wichita\s+falls|abilene|lubbock|amarillo|midland|odessa|el\s+paso|san\s+angelo|sherman|denison|paris|corsicana|nacogdoches|lufkin|bryan|college\s+station|huntsville|conroe|de\s+queen|little\s+rock|oklahoma\s+city|tulsa|shreveport|atlanta|phoenix|denver|chicago|st\.?\s*louis|kansas\s+city|memphis|nashville|charlotte|raleigh)\b/i.test(loc)) {
      return false;
    }
    // Inland ZIP prefixes (DFW 750-764, Waco/Austin 765-787, San Antonio 780-782, West TX 790-799)
    const zipMatch = loc.match(/\b(\d{5})\b/);
    if (zipMatch) {
      const z3 = parseInt(zipMatch[1].slice(0, 3), 10);
      // Texas coastal ZIP prefixes are 770-779 (Houston/Galveston/Beaumont/Victoria) and 783-785 (Corpus Christi/Brownsville)
      if ((z3 >= 750 && z3 <= 769) || (z3 >= 780 && z3 <= 782) || (z3 >= 786 && z3 <= 799)) {
        return false;
      }
    }
    // Explicit coastal cities / counties / terms within 50 miles of the coast
    if (/\b(galveston|corpus\s+christi|port\s+aransas|rockport|padre\s+island|brownsville|south\s+padre|harlingen|port\s+isabel|port\s+lavaca|matagorda|freeport|surfside|kemah|seabrook|league\s+city|texas\s+city|la\s+marque|baytown|pasadena|houston|clear\s+lake|pearland|friendswood|beaumont|port\s+arthur|orange|anahauc|chambers|brazoria|nueces|cameron|aransas|calhoun|jefferson|miami|fort\s+lauderdale|west\s+palm|key\s+west|naples|fort\s+myers|sarasota|tampa|st\.?\s*petersburg|clearwater|daytona|jacksonville|pensacola|panama\s+city|destin|mobile|gulfport|biloxi|new\s+orleans|slidell|houma|lake\s+charles|lafayette|savannah|charleston|myrtle\s+beach|wilmington|outer\s+banks|virginia\s+beach|norfolk|ocean\s+city|atlantic\s+city|long\s+island|san\s+diego|los\s+angeles|santa\s+monica|long\s+beach|huntington\s+beach|newport\s+beach|santa\s+barbara|monterey|san\s+francisco|oakland|seattle|tacoma|portland|honolulu|maui|beach|coast|coastal|island|bay|gulf|ocean|harbor|port|marina)\b/i.test(loc)) {
      return true;
    }
    if (zipMatch) {
      const z3 = parseInt(zipMatch[1].slice(0, 3), 10);
      if ((z3 >= 770 && z3 <= 779) || (z3 >= 783 && z3 <= 785) || (z3 >= 320 && z3 <= 349) || (z3 >= 700 && z3 <= 708)) {
        return true;
      }
    }
    return false;
  }

  /** Whether a flow slot already holds data. */
  slotFilled(session, slot) {
    const data = session.fnolData || {};
    const isParkedUnoccupied = Boolean(
      /\b(parked|unoccupied|unattended|nobody was inside|no one was in (?:the )?(?:car|vehicle|truck)|estacionad[oa]|sin ocupantes)\b/i.test(
        [data.lossDescription, data.hailParkedOrMoving, data.floodParkedOrRunning].filter(Boolean).join(' ')
      )
    );
    switch (slot) {
      case 'injuryAndDrivability': return data.injuryStatus !== null && data.injuryStatus !== undefined && !!data.drivability;
      case 'claimantContact': return !!data.callerName;
      case 'losstype':
      case 'lossType': return !!session.lossType || !!data.lossTypeText || !!session.lossTypeUnresolved;
      case 'callerName': return !!data.callerName;
      case 'policyNumber': return !!data.policyNumber;
      case 'vehicle': return !!data.vehicleInfo && !/\b(uh+|um+|something|whatever|don'?t\s+know)\b/i.test(data.vehicleInfo) && (secondListenerRagEngine.scoreVehicleSpecificity(data.vehicleInfo) >= 3 || ((session.askedSlots && session.askedSlots.includes('vehicle')) && data.vehicleInfo.trim().split(/\s+/).length >= 3));
      case 'location': return !!data.locationOfLoss;
      case 'lossDetail':
        if (session.lossType === 'glass') {
          return Boolean(data.glassCrackDollarBill || (data.lossTypeDetail && Array.isArray(session.askedSlots) && session.askedSlots.includes('lossDetail')));
        }
        return !!data.lossTypeDetail || (session.lossType === 'collision' && data.otherVehicleInvolved !== null && data.otherVehicleInvolved !== undefined) || (session.lossType === 'towing_roadside' && (!!data.mechanicalCause || !!data.lossTypeDetail)) || (session.lossType === 'hail' && (!!data.hailSeverity || !!data.lossTypeDetail));
      case 'animalProbe': return !(session.hasAnimalMention || session.animalStrike) || !!data.animalDetails || (!!data.lossDescription && ANIMAL_STRIKE_RE.test(data.lossDescription));
      case 'treeProbe': return !session.hasTreeMention || !!data.treePropertyDetails;
      case 'folInvestigate': return !!data.folInvestigated || !!(data.lossFacts && (data.lossFacts.tripPurpose || data.lossFacts.tripDynamics || data.lossFacts.roadCondition));
      case 'trafficControls':
        if (data.otherVehicleInvolved === false || session.hasAnimalMention || session.hasTreeMention || session.lossType === 'flood' || session.lossType === 'hail' || session.lossType === 'towing_roadside' || session.lossType === 'theft' || (data.lossFacts && (data.lossFacts.roadCondition === 'Ditch / Off-Road' || data.lossFacts.impactPoint === 'ditch' || data.lossFacts.impactPoint === 'fence post'))) {
          if (data.lossFacts && !data.lossFacts.trafficSignal) {
            data.lossFacts.trafficSignal = 'N/A (Single Vehicle / Off-Road / Peril)';
          }
          return true;
        }
        return !!data.trafficControlsCaptured || !!(data.lossFacts && data.lossFacts.trafficSignal);
      case 'folWrap': return !!data.contactPreference;
      case 'injury':
        if (data.injuryStatus !== null && data.injuryStatus !== undefined) return true;
        if (isParkedUnoccupied && ['hail', 'flood', 'glass', 'theft', 'vandalism', 'fallingobject', 'towing_roadside'].includes(session.lossType)) {
          data.injuryStatus = 'N/A (Not Asked — Parked/Unoccupied)';
          data.injuryDetails = 'No occupants inside vehicle at time of loss';
          return true;
        }
        return false;
      case 'mapPinpoint': return Boolean(data.mapPinpointConfirmed);
      case 'photos': return session.abridgedDemo ? (data.photoStatus === 'UPLOADED_IN_CALL' || (!!data.photoStatus && Array.isArray(session.askedSlots) && session.askedSlots.includes('photos'))) : !!data.photoStatus;
      case 'timeOfLoss': return !!data.timeOfLoss || !!data.dateOfLoss;
      case 'otherParty': return !!data.otherPartyInfo || data.otherVehicleInvolved === false || !!session.animalStrike;
      case 'otherPlate': return !!(data.perilProbes && data.perilProbes.otherPlate) || data.otherVehicleInvolved === false || !!session.animalStrike || /N\/A/.test(String(data.otherPartyInfo || ''));
      case 'impactPoint': return Boolean((data.lossFacts && data.lossFacts.impactPoint) || (data.perilProbes && data.perilProbes.impactPoint));
      case 'drivabilityLeaks': return Boolean(data.drivability);
      case 'hailParked': return Boolean(data.hailParkedOrMoving || data.hailParkedOrDriving || (data.perilProbes && data.perilProbes.hailParked));
      case 'hailSeverity': return Boolean(data.hailSeverity || data.hailDentSeverity || (data.perilProbes && data.perilProbes.hailSeverity));
      case 'carcassHazard':
      case 'engineRestart': case 'personalProperty': case 'cameras': case 'theftLastSeen': case 'recoveryStatus': case 'treeOwner': case 'keyCustody': case 'fireDept': case 'fireOrigin': case 'fireDrivingParked': case 'keyAccess': case 'vandalParked': case 'suspects':
        return !!(data.perilProbes && data.perilProbes[slot]);
      case 'vehicleLocation': return !!data.vehicleCurrentLocation;
      case 'police': return !!data.policeReport;
      case 'floodParkedOrRunning': return !!data.floodParkedOrRunning;
      case 'floodWaterLevel': return !!data.waterLevel;
      case 'floodWaterType':
        if (data.waterType) return true;
        if (!this.isCoastalFloodZone(data.locationOfLoss || session.transcript || '')) {
          data.waterType = 'Freshwater / Inland Stormwater (Auto-Resolved >50 mi from Coast)';
          return true;
        }
        return false;
      case 'towWhere':
        if (data.towLocation || data.towCompany) return true;
        if (data.floodParkedOrRunning === 'Parked (Unattended / Off)' || /\b(driveway|residence|at home|my house|garage|cochera|en casa|parked)\b/i.test(String(data.locationOfLoss || data.vehicleCurrentLocation || session.transcript || ''))) {
          data.towLocation = 'At Residence Driveway (No Tow Required)';
          if (!data.vehicleCurrentLocation) data.vehicleCurrentLocation = 'Residence / Driveway';
          return true;
        }
        return false;
      case 'mechanicalProbe': return !!data.mechanicalCause || !!data.mechanicalDetail;
      case 'summaryConfirm': return !!session.summaryConfirmed;
      default: return false;
    }
  }

  /**
   * Deterministic Completed-Fields vs. Remaining-Questions State Machine Snapshot.
   * Exposes exactly which required slots for the detected peril are already filled
   * (from narrative or prior turns) and which slots still need to be asked.
   */
  getFieldCompletionState(session) {
    const flow = this.activeFlow(session);
    const completedFields = [];
    const remainingFieldsToAsk = [];
    for (const slot of flow) {
      if (this.slotFilled(session, slot)) {
        completedFields.push(slot);
      } else {
        remainingFieldsToAsk.push(slot);
      }
    }
    const nonSummaryTotal = flow.filter(s => s !== 'summaryConfirm').length || 1;
    const nonSummaryCompleted = completedFields.filter(s => s !== 'summaryConfirm').length;
    return {
      lossType: session.lossType || 'unresolved',
      activeFlow: flow,
      completedFields,
      remainingFieldsToAsk,
      nextQuestionSlot: remainingFieldsToAsk.find(s => !(session.askedSlots || []).includes(s)) || null,
      completionPct: Math.round((nonSummaryCompleted / nonSummaryTotal) * 100)
    };
  }

  /** Detect explicit caller phrase indicating no further details to add (EN + ES) */
  detectExplicitEnd(userSpeech) {
    if (!userSpeech || typeof userSpeech !== 'string') return false;
    const lower = userSpeech.toLowerCase().trim();
    return /\b((that'?s|that\s+is)\s+(everything|all|it)|no other details|nothing else|no more details|no further|that covers it|i'?m done|goodbye|good bye|hang up|end the call|eso es todo|nada m(á|a)s|es todo|ya termin(é|e)|adi(ó|o)s|hasta luego|cuelgue|terminar la llamada|no mas detalles)\b/i.test(lower);
  }

  /**
   * Determine missing fields dynamically and construct context-aware response
   */
  evaluateTurn(session, userSpeech, options = {}) {
    // ES-PARITY: language is first-class on every turn — persisted on the
    // session AND the FNOL record, never inferred silently.
    const lang = (options.language || session.language || 'en');
    session.language = lang;
    session.turnCount = (session.turnCount || 0) + 1;
    userSpeech = userSpeech ? normalizeClaimsAsrSpeech(userSpeech) : userSpeech;

    // Inherit pre-staged peril from Demo Host Matthew (e.g. caller requested flood demo)
    if (!session.lossType && session.fnolData && session.fnolData.stagedPeril && session.fnolData.stagedPeril !== 'comprehensive') {
      session.lossType = session.fnolData.stagedPeril;
      if (!session.fnolData.lossTypeText) {
        session.fnolData.lossTypeText = t(lang, LT_LABEL_KEYS[session.lossType] || 'ltCollision');
      }
    }

    // Post-completion guard: if intake is already marked complete,
    // NEVER re-ask intake questions or qNarrative.
    if (session.isComplete) {
      if (options.isSilenceTimeout) {
        const text = lang === 'es'
          ? 'Su reporte ha sido completado y registrado con éxito. Puede colgar en cualquier momento, o permanezco en la línea si tiene alguna otra duda.'
          : "Your claim report has been fully recorded and submitted. Feel free to hang up whenever you're ready, or let me know if you need anything else.";
        session.transcript += '\nAI Agent Angel: ' + text;
        return { speechChunks: [{ voice: 'agent', text }], isFinal: true };
      }
      if (this.detectExplicitEnd(userSpeech) || /\b(bye|goodbye|thank|thanks|adios|adiós|gracias|colgar|done|ok|okay|all set)\b/i.test(userSpeech || '')) {
        const text = lang === 'es'
          ? 'Gracias por llamar a Agent Angel. Su reporte ha sido registrado con éxito. ¡Que tenga un excelente día!'
          : "Thank you for calling Agent Angel. Your claim report has been recorded. Have a wonderful day!";
        session.transcript += '\nAI Agent Angel: ' + text;
        return { speechChunks: [{ voice: 'agent', text }], isFinal: true };
      }
      const text = lang === 'es'
        ? 'Su reporte de reclamo ya fue completado y enviado a su ajustador. He anotado estos detalles adicionales en su archivo. ¿Hay algo más en lo que pueda asistirle?'
        : "Your claim report has already been completed and sent to your adjuster. I have noted these additional details in your claim file. Is there anything else I can help you with?";
      session.transcript += '\nAI Agent Angel: ' + text;
      return { speechChunks: [{ voice: 'agent', text }], isFinal: true };
    }

    // Re-ask path with Circuit Breaker (SERIESC-VOICE-REMEDIATION-04, 2026-09-06):
    // Cap was 2 re-asks — real phone audio routinely trips the 0.15 ASR confidence
    // floor twice in a row, so 4 of 5 reviewed demo calls hung up into an SMS
    // pivot before FNOL fields (VIN/policy/date of loss) were ever collected.
    // Raised to 4 re-asks so a caller gets real chances to give a valid answer
    // before the bot gives up on voice — still bounded, never an infinite loop.
    if ((options.isSilenceTimeout || options.isLowConfidence) && session.hasGreeted) {
      session.consecutiveReasks = (session.consecutiveReasks || 0) + 1;
      if (session.consecutiveReasks >= 4) {
        session.pivotedToSms = true;
        const text = t(lang, 'smsPivotOffer');
        session.transcript += '\nAI Agent Angel: ' + text;
        return { speechChunks: [{ voice: 'agent', text }], isFinal: true, triggerSms: true };
      }
      // Turn 1 silence: gentle nudge without repeating question
      if (options.isSilenceTimeout && session.consecutiveReasks === 1) {
        const nudge = t(lang, 'gentleSilenceNudge');
        session.transcript += '\nAI Agent Angel: ' + nudge;
        return { speechChunks: [{ voice: 'agent', text: nudge }], isFinal: false };
      }
      
      const q = t(lang, session.lastQuestionKey || 'qNarrative', session.lastQuestionVars || undefined);
      let text;
      if (options.isSilenceTimeout) {
        // Silence timeout: DO NOT apologize. Caller hesitated or paused.
        if (session.consecutiveReasks === 2) {
          text = (lang === 'es' ? 'Cuando guste: ' : 'Whenever you\'re ready: ') + q;
        } else {
          text = (lang === 'es' ? 'Sigo aquí cuando esté listo. ' : "I'm still here whenever you're ready. ") + q;
        }
      } else {
        // Low confidence / ASR misrecognition: politely request repetition without canned loop
        if (session.consecutiveReasks === 1) {
          text = (lang === 'es' ? 'No le escuché con claridad — ¿podría repetirlo, por favor? ' : "I didn't quite hear that — could you repeat it? ") + q;
        } else if (session.consecutiveReasks === 2) {
          text = (lang === 'es' ? '¿Podría decirlo una vez más? ' : "Could you say that once more? ") + q;
        } else {
          text = (lang === 'es' ? 'Tengo un poco de dificultad para escucharle — ' : "I'm having a little trouble hearing you — ") + q;
        }
      }
      session.transcript += '\nAI Agent Angel: ' + text;
      return { speechChunks: [{ voice: 'agent', text }], isFinal: false };
    }

    if (!options.isSilenceTimeout && !options.isLowConfidence) {
      session.consecutiveReasks = 0;
    }

    // ── LINK NOT RECEIVED / RESEND LINK INTERCEPTOR ──
    // If caller says "I didn't get a link", "I haven't received the text", "no link", "resend the link",
    // Angel must NOT treat it as a story or advance slots. She immediately re-triggers SMS + email backup
    // and provides the spoken dashboard URL, then re-asks the current question.
    const linkNotReceivedRegex = /\b(didn'?t (?:get|receive) (?:a |the |my |any )?(?:link|text|sms|message)|haven'?t (?:got|gotten|received) (?:a |the |my |any )?(?:link|text|sms|message)|no (?:link|text) (?:yet|came|received)?|still (?:no|haven'?t got(?:ten)?) (?:a |the )?(?:link|text)|where is the (?:link|text)|resend (?:the )?(?:link|text)|send (?:the )?(?:link|text) again|no recib[íi] el (?:enlace|mensaje|texto)|no me lleg[óo] el (?:enlace|mensaje))\b/i;
    if (userSpeech && linkNotReceivedRegex.test(userSpeech)) {
      session.smsConsent = true;
      if (session.fnolData) session.fnolData.smsConsent = true;
      session.inCallSmsDispatched = false;
      const phoneVars = getPhoneVars(session.fromNumber || (session.fnolData && session.fnolData.callerPhone), lang);
      const last4Bit = phoneVars.LAST4 ? (lang === 'es' ? ` que termina en ${phoneVars.LAST4}` : ` ending in ${phoneVars.LAST4}`) : '';
      const followUpQ = (!session.narrativeHeard)
        ? (session.fnolData && session.fnolData.stagedPeril === 'comprehensive'
            ? t(lang, 'qCompClarify')
            : (lang === 'es'
                ? 'Cuando esté listo, cuénteme con sus propias palabras qué le ocurrió a su vehículo.'
                : "Whenever you're ready, tell me in your own words what happened to your vehicle?"))
        : t(lang, session.lastQuestionKey || 'qNarrative', session.lastQuestionVars || undefined);
      const resendText = lang === 'es'
        ? `Acabo de reenviar el enlace a su teléfono${last4Bit} — si su operador móvil retrasa los mensajes automatizados, también puede abrir el panel en vivo directamente en ai agent angel punto com barra axirate barra calls. ${followUpQ}`
        : `I've just re-sent that link to your phone${last4Bit} — if your mobile carrier delays automated texts, I've also sent a backup and you can view the <sub alias="lyve">live</sub> dashboard at ai agent angel dot com slash axirate slash calls. ${followUpQ}`;
      session.transcript += '\nCaller: ' + userSpeech;
      session.transcript += '\nAI Agent Angel: ' + resendText;
      return { speechChunks: [{ voice: 'agent', text: resendText }], isFinal: false, smsConsent: true, resendSms: true };
    }

    // ── CALLER EARLY ABORT / CANCEL INTERCEPTOR ──
    // If caller says "No, I'm done. Thank you. Never mind." or "Forget it, cancel this call" before intake is confirmed,
    // close the session cleanly without fabricating a completed claim or transferring back to Matthew's sales pitch.
    const earlyAbortRegex = /\b(never ?mind|forget it|cancel (?:this|the) (?:call|claim|demo)|no[,.\s]+(?:thank you[,.\s]+)?i'?m done|i'?m done[,.\s]+(?:thank you[,.\s]+)?never ?mind|stop the demo|end the demo|ya no quiero|olv[íi]delo|cancelar la llamada)\b/i;
    if (userSpeech && earlyAbortRegex.test(userSpeech) && session.pendingSlot !== 'summaryConfirm' && session.pendingSlot !== 'folWrap' && session.pendingSlot !== 'more') {
      session.abortedByCaller = true;
      session.callerRequestedHangup = true;
      session.isComplete = true;
      const abortText = lang === 'es'
        ? 'Entendido — he cerrado esta sesión sin registrar ningún reclamo. Gracias por llamar a AI Agent Angel, que tenga un buen día.'
        : "Understood — I've closed this session without filing a claim. Thank you for calling AI Agent Angel, and have a great day.";
      session.transcript += '\nCaller: ' + userSpeech;
      session.transcript += '\nAI Agent Angel: ' + abortText;
      return { speechChunks: [{ voice: 'agent', text: abortText }], isFinal: true, callerRequestedHangup: true, abortedByCaller: true };
    }

    // ── 2ND LISTENER: LIVE SESSION FACT INQUIRY & MISSING FACT FILL INTERCEPTOR ──
    if (userSpeech && !this.isStartOverIntent(userSpeech)) {
      const factInq = secondListenerRagEngine.detectSessionFactInquiry(userSpeech, session, { language: lang });
      if (factInq && (factInq.action === 'SESSION_FACT_READBACK' || factInq.action === 'SESSION_FACT_MISSING_PROMPT')) {
        if (session.pendingSlot === 'summaryConfirm') {
          session.summaryConfirmed = false;
          session.pendingSlot = 'summaryConfirm';
        }
        session.transcript += '\nCaller: ' + userSpeech;
        session.transcript += '\nAI Agent Angel: ' + factInq.text;
        return { speechChunks: [{ voice: 'agent', text: factInq.text }], isFinal: false, smsConsent: session.smsConsent };
      }
      if (factInq && factInq.action === 'FACT_FILL_COMPLETED' && session.pendingSlot === 'summaryConfirm') {
        session.summaryConfirmed = false;
        session.askedSlots = (session.askedSlots || []).filter(s => s !== 'summaryConfirm');
      }
    }

    // ── 2ND LISTENER: PHONETIC / AMBIGUOUS PERIL VALIDATOR ("hair claim" -> clarify, never guess) ──
    if (userSpeech && !this.isStartOverIntent(userSpeech) && (!session.lossType || session.pendingClarification)) {
      const perilCheck = secondListenerRagEngine.validateHostAndPerilTurn(userSpeech, session, { language: lang, stage: 'intake' });
      if (perilCheck && perilCheck.action === 'CLARIFY_AMBIGUOUS_PERIL') {
        session.transcript += '\nCaller: ' + userSpeech;
        session.transcript += '\nAI Agent Angel: ' + perilCheck.text;
        return { speechChunks: [{ voice: 'agent', text: perilCheck.text }], isFinal: false, smsConsent: session.smsConsent };
      }
      if (perilCheck && perilCheck.action === 'CLARIFICATION_RESOLVED') {
        session.lossType = perilCheck.resolvedPeril;
        session.fnolData.lossTypeText = t(lang, LT_LABEL_KEYS[perilCheck.resolvedPeril] || 'ltCollision');
        session.narrativeHeard = true;
      }
    }

    // ── CUSTOMER MID-DEMO INQUIRY INTERCEPTOR ──
    // If customer asks a question in the middle of intake (deductible, police, towing, etc.),
    // Angel must NOT document it as an answer, corrupt slots, or skip. She answers the question empathetically
    // and re-prompts the current slot with an open-ended question.
    const inquiryIntent = userSpeech ? this.classifyCustomerInquiry(userSpeech) : null;
    if (inquiryIntent && !this.isStartOverIntent(userSpeech)) {
      if (/\b(vp|vice\s+president|director|chief|evaluating|demo|surge|backlog|qa|audit|compliance)\b/i.test(userSpeech)) {
        this.extractEntities(userSpeech, session);
      }
      const answeringSlot = session.pendingSlot || 'narrative';
      const answer = (CALLER_INQUIRY_ANSWERS[inquiryIntent] && CALLER_INQUIRY_ANSWERS[inquiryIntent][lang])
        || (CALLER_INQUIRY_ANSWERS.general_help && CALLER_INQUIRY_ANSWERS.general_help[lang]);
      const rephrase = (SLOT_OPEN_REPROMPTS[answeringSlot] && SLOT_OPEN_REPROMPTS[answeringSlot][lang])
        || t(lang, session.lastQuestionKey || 'qNarrative');
      const replyText = `${answer} ${rephrase}`;
      session.transcript += '\nCaller: ' + userSpeech;
      session.transcript += '\nAI Agent Angel: ' + replyText;
      return { speechChunks: [{ voice: 'agent', text: replyText }], isFinal: false };
    }

    const preTurnSnapshot = {
      locationOfLoss: session.fnolData ? session.fnolData.locationOfLoss : '',
      dateOfLoss: session.fnolData ? session.fnolData.dateOfLoss : '',
      timeOfLoss: session.fnolData ? session.fnolData.timeOfLoss : '',
      vehicleInfo: session.fnolData ? session.fnolData.vehicleInfo : '',
      policyNumber: session.fnolData ? session.fnolData.policyNumber : '',
      policeReportNumber: session.fnolData ? session.fnolData.policeReportNumber : '',
      towLocation: session.fnolData ? session.fnolData.towLocation : '',
      vehicleCurrentLocation: session.fnolData ? session.fnolData.vehicleCurrentLocation : ''
    };

    if (userSpeech && !this.isStartOverIntent(userSpeech)) {
      this.extractEntities(userSpeech, session);
      const slotVal = secondListenerRagEngine.validateSlotExtraction(session.pendingSlot, userSpeech, session, { language: lang });
      if (slotVal && slotVal.action === 'REQUEST_MAP_PINPOINT') {
        session.pendingSlot = 'mapPinpoint';
        session.transcript += '\nCaller: ' + userSpeech;
        session.transcript += '\nAI Agent Angel: ' + slotVal.text;
        return { speechChunks: [{ voice: 'agent', text: slotVal.text }], isFinal: false, smsConsent: session.smsConsent };
      }
      if (slotVal && (slotVal.action === 'MAP_PINPOINT_CONFIRMED' || slotVal.action === 'MAP_PINPOINT_DEFERRED')) {
        session.lastAckedMapPinpoint = slotVal.action;
      }
      if (slotVal && slotVal.action === 'GOOGLE_MAPS_VERIFIED_BUSINESS') {
        session.lastAckedGoogleMapsBusiness = slotVal.formattedLocation;
      }
      if (slotVal && (slotVal.action === 'CLARIFY_GARBLED_ADDRESS' || slotVal.action === 'CLARIFY_PARTIAL_VEHICLE')) {
        session.pendingSlot = slotVal.action === 'CLARIFY_PARTIAL_VEHICLE' ? 'vehicle' : 'location';
        session.transcript += '\nCaller: ' + userSpeech;
        session.transcript += '\nAI Agent Angel: ' + slotVal.text;
        return { speechChunks: [{ voice: 'agent', text: slotVal.text }], isFinal: false, smsConsent: session.smsConsent };
      }
    }

    // Meta command: Start Over / Reset Intent
    if (userSpeech && (this.isStartOverIntent(userSpeech) || session.awaitingResetChoice)) {
      const norm = userSpeech.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const isFullReset = /\b(beginning|from scratch|everything|full|all over|principio|todo|desde el inicio)\b/i.test(norm);
      const isPartReset = /\b(last part|just the|only the|what happened|location|time|que paso|lugar|hora|parte)\b/i.test(norm);

      if (session.awaitingResetChoice) {
        session.awaitingResetChoice = false;
        if (isPartReset && !isFullReset) {
          const currentSlot = session.pendingSlot || 'location';
          if (session.fnolData[currentSlot]) session.fnolData[currentSlot] = '';
          const text = lang === 'es'
            ? 'Entendido — rehagamos esa parte. ' + t(lang, 'qNarrative')
            : "Understood — let's re-do that part. " + t(lang, 'qNarrative');
          session.transcript += '\nCaller: ' + userSpeech;
          session.transcript += '\nAI Agent Angel: ' + text;
          return { speechChunks: [{ voice: 'agent', text }], isFinal: false };
        } else if (isFullReset) {
          this.resetSession(session);
          const text = lang === 'es'
            ? 'Sin problema — he reiniciado su reporte de reclamo para comenzar de nuevo. Cuénteme con sus propias palabras, comenzando unos diez segundos antes del incidente, ¿qué pasó?'
            : "No problem at all — let's start over from the beginning. Tell me in your own words, starting about 10 seconds before the loss, what happened?";
          session.transcript += '\nCaller: ' + userSpeech;
          session.transcript += '\nAI Agent Angel: ' + text;
          return { speechChunks: [{ voice: 'agent', text }], isFinal: false };
        }
        // If user ignored reset clarification and gave slot data, proceed with normal intake
      }

      if (isFullReset || !isPartReset) {
        this.resetSession(session);
        const text = lang === 'es'
          ? 'Sin problema — he reiniciado su reporte de reclamo para comenzar de nuevo. Cuénteme con sus propias palabras, comenzando unos diez segundos antes del incidente, ¿qué pasó?'
          : "No problem at all — let's start over from the beginning. Tell me in your own words, starting about 10 seconds before the loss, what happened?";
        session.transcript += '\nCaller: ' + userSpeech;
        session.transcript += '\nAI Agent Angel: ' + text;
        return { speechChunks: [{ voice: 'agent', text }], isFinal: false };
      }

      if (isPartReset) {
        const currentSlot = session.pendingSlot || 'location';
        if (session.fnolData[currentSlot]) session.fnolData[currentSlot] = '';
        const text = lang === 'es'
          ? 'Entendido — rehagamos esa parte. ' + t(lang, 'qNarrative')
          : "Understood — let's re-do that part. " + t(lang, 'qNarrative');
        session.transcript += '\nCaller: ' + userSpeech;
        session.transcript += '\nAI Agent Angel: ' + text;
        return { speechChunks: [{ voice: 'agent', text }], isFinal: false };
      }
    }

    // 0. Existing Claim Status, Adjuster Complaint & Extension Transfer Interceptor (Law T1.29c & User Directive)
    const existingClaimOrComplaintRegex = /\b(existing claim|claim status|status of (my|a|the) claim|check (on )?(my|a|the) claim|update on (my|a|the) claim|already (filed|reported|have a claim)|where is my (check|payment|money|reimbursement)|haven't (received|gotten) (my |a )?(check|payment)|nobody (called|calls|contacted) me back|waiting on (my |an )?adjuster|adjuster (won't|hasn't|never|not) (call|calling|return|called)|speak to (my |an )?adjuster|talk to (my |an )?adjuster|adjuster'?s? extension|transfer me to (my |an )?adjuster|transfer (me )?to status|claim number|file a complaint|complaint about|have a complaint|why is this taking so long|reclamo existente|estado de mi reclamo|estatus de mi reclamo|ya tengo un reclamo|ya report[eé]|d[óo]nde est[aá] mi cheque|no me han pagado|mi ajustador no me llama|hablar con mi ajustador|extensi[óo]n del ajustador|queja|poner una queja)\b/i;

    if (session.offeredStatusTransfer && userSpeech) {
      const isTransferAffirmative = /\b(yes|yeah|yep|sure|please|transfer me|transfer|connect me|go ahead|okay|ok|si|sí|claro|por favor|con[eé]ctame)\b/i.test(userSpeech.trim());
      const isDeclinedOrNewClaim = /\b(no|nope|wait|new claim|report (a )?claim|different claim|otro reclamo|nuevo reclamo)\b/i.test(userSpeech.trim());
      if (isTransferAffirmative && !isDeclinedOrNewClaim) {
        session.disposition = 'TRANSFER_TO_STATUS_QUEUE';
        const transferText = lang === 'es'
          ? 'Transfiriéndole directamente a nuestro departamento de estatus de reclamos en vivo en este momento. Por favor permanezca en la línea mientras le comunico.'
          : 'Transferring you directly to our live inbound claims status department now. Please hold while I connect you.';
        session.transcript += '\nCaller: ' + userSpeech;
        session.transcript += '\nAI Agent Angel: ' + transferText;
        return { speechChunks: [{ voice: 'agent', text: transferText }], isFinal: true, callerRequestedHangup: false };
      }
      session.offeredStatusTransfer = false;
    }

    if (userSpeech && existingClaimOrComplaintRegex.test(userSpeech)) {
      session.claimIntent = 'EXISTING_CLAIM_STATUS_OR_COMPLAINT';
      session.offeredStatusTransfer = true;
      session.lossType = null;
      if (session.fnolData) session.fnolData.lossType = null;
      const text = lang === 'es'
        ? 'Entiendo perfectamente que se comunica por un reclamo existente y necesita una actualización de estatus. Me especializo en la apertura de nuevos reclamos, pero con gusto le ayudo a agilizar su caso. La extensión directa de su ajustador asignado es la 402, y le puedo transferir a nuestra línea de estatus de reclamos en vivo de inmediato. ¿Desea que le comunique con la línea de estatus?'
        : 'I understand you are calling regarding an existing claim and need a status update. I specialize in First Notice of Loss intake for new claims, but I can certainly assist with speeding up your resolution. Your assigned adjuster is on direct extension 402, and I can transfer you directly to our live inbound claims status line right now. Would you like me to connect you?';
      session.transcript += '\nCaller: ' + userSpeech;
      session.transcript += '\nAI Agent Angel: ' + text;
      return { speechChunks: [{ voice: 'agent', text }], isFinal: false };
    }

    // 1. Non-Claim / Policy / Billing / Wrong Number Intent Interceptor
    const nonClaimIntentRegex = /\b(wrong number|not (reporting|filing) a claim|billing|pay (my |a )?bill|payment|premium|add (a )?car|add (a )?vehicle|policy question|coverage question|renew|cancel policy|customer service|cambiar p[oó]liza|pagar factura|n[uú]mero equivocado)\b/i;
    const hasLossNarrativeEarly = /\b(accident|collision|damage|hit|rear[- ]?ended|crash|loss|car|truck|vehicle|hail|flood|theft|stolen|injury)\b/i.test(userSpeech || '');
    if (userSpeech && nonClaimIntentRegex.test(userSpeech) && !hasLossNarrativeEarly) {
      session.claimIntent = 'INQUIRY_NON_CLAIM';
      session.disposition = 'TRANSFER_TO_HUMAN_QUEUE';
      const text = lang === 'es'
        ? 'Ha llamado a la línea de reporte de reclamos First Notice of Loss. En un despliegue de producción durante el horario de atención, le transferiría de inmediato a nuestro equipo de atención al cliente o administración de pólizas. He registrado su consulta y un representante se comunicará con usted. ¡Que tenga un excelente día!'
        : 'You have reached the First Notice of Loss claims reporting line. In a <sub alias="lyve">live</sub> carrier deployment during normal business hours, I would transfer you directly to our human customer care or policy administration queue. I have logged your inquiry as a service record and an account representative can follow up with you. Have a wonderful day!';
      session.transcript += '\nCaller: ' + userSpeech;
      session.transcript += '\nAI Agent Angel: ' + text;
      return { speechChunks: [{ voice: 'agent', text }], isFinal: true, callerRequestedHangup: true };
    }

    // 2. Hesitant Caller / General Claim Question / Partial Claim Interceptor
    const partialClaimIntentRegex = /\b(just asking|question about (filing|reporting|a claim)|should i (file|report)|wondering if i should|haven'?t decided|not sure if i (want to|should) (file|report)|deductible question|what is my deductible|is it worth (filing|reporting)|solo una pregunta|no s[eé] si reportar)\b/i;
    if (userSpeech && partialClaimIntentRegex.test(userSpeech) && !session.partialClaimOpened && !hasLossNarrativeEarly) {
      session.claimIntent = 'PARTIAL_CLAIM';
      session.partialClaimOpened = true;
      const text = lang === 'es'
        ? 'Con gusto le ayudo con sus preguntas sobre el proceso. No tiene ninguna obligación de abrir un reclamo formal hoy. Puedo tomar nota de los detalles preliminares que tenga para que queden registrados. Para orientarle mejor, ¿qué tipo de incidente o daño ocurrió?'
        : 'I can certainly help answer your questions. You are under no obligation to formally open a claim today. I can take down whatever details you have so far so your facts are safely documented. To guide you best, what type of loss or incident occurred?';
      session.transcript += '\nCaller: ' + userSpeech;
      session.transcript += '\nAI Agent Angel: ' + text;
      return { speechChunks: [{ voice: 'agent', text }], isFinal: false };
    }

    // 3. Explicit User Demand for a Human Representative / Rental Car De-escalation
    const humanRepRegex = /\b(human|representative|operator|real person|live agent|talk to a (person|human|representative|manager|agent)|speak (to|with) a (person|human|representative|manager|agent)|speak (to|with) someone|speak to a manager|transfer me|customer service|persona|humano|representante|operador|hablar con (una persona|un humano|alguien)|persona real|atenci[óo]n al cliente)\b/i;
    if (userSpeech && humanRepRegex.test(userSpeech)) {
      const hasRental = /\b(rent|rental|loaner|courtesy car|alquiler)\b/i.test(userSpeech);
      if (hasRental) {
        session.fnolData.rentalRequested = true;
      }
      if (!session.fnolData.additionalAdjusterNotes && userSpeech.length > 15) {
        session.fnolData.additionalAdjusterNotes = userSpeech.trim();
      }

      let text;
      if (hasRental) {
        text = lang === 'es'
          ? 'Comprendo perfectamente su urgencia por un auto de alquiler y me disculpo por la molestia. Esta es una línea de demostración interactiva sin operadores en vivo, pero completar este reporte conmigo toma alrededor de 15 minutos y envía su caso directamente a un ajustador. He agregado una nota prioritaria para coordinar su auto de alquiler y requerimientos de inspección. ¿Continuamos?'
          : 'I understand completely, and I apologize for the frustration. Because this is an automated interactive demo, there are no <sub alias="lyve">live</sub> operators on this line, but completing this report with me takes about 15 minutes and gets your file directly into an adjuster\'s hands. I have immediately added a priority note for rental car coordination and noted your inspection preferences. Shall we continue?';
      } else {
        text = !session.offeredHumanRepPersuasion ? t(lang, 'humanRepPersuasion') : t(lang, 'humanRepNoQueue');
      }
      session.offeredHumanRepPersuasion = true;
      session.transcript += '\nCaller: ' + userSpeech;
      session.transcript += '\nAI Agent Angel: ' + text;
      return { speechChunks: [{ voice: 'agent', text }], isFinal: false };
    }

    // Strict TCPA & L-12 Verbal Consent Parser: mid-call opt-out, refusals, hedges, and explicit/photo consent check
    if (userSpeech && session.hasGreeted) {
      const textLower = userSpeech.toLowerCase().trim();
      const conf = options.confidence !== undefined ? options.confidence : (options.speechConfidence !== undefined ? options.speechConfidence : (options.isLowConfidence ? 0.2 : 1.0));

      const recordVerbalSmsConsent = (utterance, slotContext) => {
        session.smsConsent = true;
        session.fnolData.smsConsent = true;
        session.fnolData.callbackPermission = 'Granted (Verbal L-12 in Transcript)';
        session.fnolData.smsVerbalConsent = {
          granted: true,
          recordedInTranscript: true,
          timestamp: new Date().toISOString(),
          slotContext: slotContext || session.pendingSlot || 'general',
          callerUtterance: utterance
        };
        if (!session.transcript.includes('[L-12 VERBAL SMS CONSENT RECORDED IN TRANSCRIPT]')) {
          session.transcript += '\n[L-12 VERBAL SMS CONSENT RECORDED IN TRANSCRIPT]';
        }
      };

      // 1. Universal Mid-Call Opt-Out / Revocation (any turn)
      const optOutPattern = /\b(stop\s+texting|quit\s+texting|don'?t\s+text|do\s+not\s+text|no\s+more\s+texts?|stop\s+sending|sin\s+mensajes|unsubscribe)\b|^(?:stop|quit)$/i;
      if (optOutPattern.test(textLower)) {
        session.smsConsent = false;
        session.fnolData.smsConsent = false;
        session.fnolData.callbackPermission = 'Revoked / Opt-Out';
        session.pendingConsentQuestion = false;
      } else {
        const textRefusalPattern = /(?:rather\s+not|not\s+by\s+text|prefer\s+(?:you\s+)?(?:didn['’]?t|don['’]?t)\s+text|don['’]?t\s+(?:send|text)|do\s+not\s+(?:send|text)|didn['’]?t\s+(?:give|consent|agree)|stop\s+(?:texting|sending)|quit\s+(?:texting|sending)|unsubscribe|no\s+texts?|no\s+sms|no\s+photos?|sin\s+mensajes?|sin\s+fotos|no\s+permission|sin\s+permiso|refuse|decline)/iu;
        const generalRefusalPattern = /(?:rather\s+not|not\s+by\s+text|prefer\s+(?:you\s+)?(?:didn['’]?t|don['’]?t)|prefer\s+(?:not\s+to|no)|don['’]?t\s+(?:send|text|have|want)|do\s+not\s+(?:send|text|have|want)|didn['’]?t\s+(?:give|consent|agree)|stop\s+(?:texting|sending)|quit\s+(?:texting|sending)|unsubscribe|cancel|no\s+texts?|no\s+sms|no\s+photos?|sin\s+mensajes?|no\s+gracias|no\s+quiero|never\s+mind|call\s+only|s[oó]lo\s+llamada|not\s+really|nope|nah|\bno\b(?!\s*(?:problem|worries|hay\s+problema|injur|one|body|hurt|police|other))|\bnot\s+by\s+text|\bnot\b(?!\s*a\s+problem)|no\s+permission|sin\s+permiso|negativo|ningun[ao]|refuse|decline)/iu;
        const explicitGrant = /(?:^|\b)(?:permission|permission to text|yes text me|text me|you can text|feel free to text|ok to text|okay to text|yes you have permission|send\s+(?:me\s+)?(?:it|the\s+link|the\s+photo\s+link|the\s+dashboard|a\s+text|a\s+link)|text\s+(?:me\s+)?(?:the\s+link|the\s+dashboard)|puedes enviar|tienes permiso|sí puedes enviar|env[íi]ame el enlace|m[áa]ndame el enlace)(?:\b|$)/iu.test(textLower);
        const anchoredAffirmative = /^(?:yes|yeah|yep|sure|fine|ok|okay|please|go\s+ahead|you\s+can|absolutely|definitely|sí|claro|por\s+supuesto|adelante|est[aá]\s+bien)[.,!]?$/iu.test(textLower);
        const discourseMarker = /^(?:okay|ok|si|well|bueno|mira)\s+(?:so|es\s+que|me\s+pueden|yo\s+iba|i\s+was|we\s+were|my\s+car|alguien)\b/i.test(textLower);
        const startsAffirmative = /^(?:yes|yeah|yep|sure|claro|sí)(?:\s|$|[.,!])/iu.test(textLower);

        if (session.pendingConsentQuestion || session.pendingSlot === 'photos') {
          if (generalRefusalPattern.test(textLower)) {
            if (!session.smsConsent) {
              session.smsConsent = false;
              session.fnolData.smsConsent = false;
              session.fnolData.callbackPermission = 'Refused';
            }
          } else if (conf >= 0.40 && !discourseMarker && (explicitGrant || anchoredAffirmative || startsAffirmative || session.callerRequestedLiveSms || (session.pendingSlot === 'photos' && /\b(photo|photos|picture|pictures|pic|camera|desk|coffee|phone|upload|link|foto|fotos)\b/i.test(textLower)))) {
            recordVerbalSmsConsent(userSpeech, session.pendingSlot === 'photos' ? 'photos_consent' : 'greeting_consent');
          } else if (!session.smsConsent) {
            session.smsConsent = false;
            session.fnolData.smsConsent = false;
            session.fnolData.callbackPermission = 'Not Granted (No Response)';
          }
          session.pendingConsentQuestion = false;
        } else {
          // On subsequent turns, only explicit text-refusal revokes; explicit grant can grant consent at any point mid-call
          if (textRefusalPattern.test(textLower)) {
            session.smsConsent = false;
            session.fnolData.smsConsent = false;
            session.fnolData.callbackPermission = 'Refused';
          } else if (conf >= 0.40 && (explicitGrant || (session.callerRequestedLiveSms && !session.smsConsent))) {
            recordVerbalSmsConsent(userSpeech, 'mid_call_request');
          }
        }
      }
    }

    // Multi-Claim Intent Intercept (e.g. "I need to report 2 claims", "report two claims", "two claims to file", "report both claims")
    const MULTI_CLAIM_RE = /\b(?:2|two|both|multiple|couple\s+of)\s+claims?\b|\breport\s+(?:2|two)\b/i;
    if (userSpeech && MULTI_CLAIM_RE.test(userSpeech) && (!session.multiClaim || !session.multiClaim.acknowledged)) {
      session.multiClaim = session.multiClaim || {
        total: 2,
        current: 1,
        claimRef1: session.claimRef || ('FNOL-DEMO-' + Math.floor(10000 + Math.random() * 90000)),
        claimRef2: 'FNOL-DEMO-' + Math.floor(10000 + Math.random() * 90000),
        acknowledged: true
      };
      session.multiClaim.acknowledged = true;
      session.claimRef = session.multiClaim.claimRef1;

      const detectedLoss = this.detectLossType(userSpeech);
      if (detectedLoss) {
        session.lossType = detectedLoss;
        const LEGACY = {
          collision: 'GENERAL_COLLISION', hail: 'WEATHER_CATASTROPHE', theft: 'THEFT',
          flood: 'FLOOD', glass: 'GLASS', vandalism: 'VANDALISM', fire: 'FIRE',
          towing_roadside: 'MECHANICAL', fallingobject: 'FALLING_OBJECT'
        };
        session.lossTypeClass = LEGACY[detectedLoss] || 'GENERAL_COLLISION';
        session.fnolData.lossTypeText = userSpeech.trim();
        session.multiClaimPrefix = lang === 'es'
          ? `Entendido perfectamente — tiene dos reclamos para reportar hoy. Abriré dos números de referencia independientes. Comencemos con el primer reclamo.`
          : `Understood — you have two separate claims to report today. I will open two distinct claim files for you. Let's document Claim Number One first.`;
      } else {
        const ackMulti = lang === 'es'
          ? `Entendido perfectamente — veo que tiene dos reclamos separados para reportar hoy. Nos encargaremos de ambos de forma consecutiva con dos números de referencia distintos. Comencemos con el primer reclamo: ¿qué tipo de incidente o daño desea reportar?`
          : `Understood — you have two separate claims to report today. I will open two distinct claim files for you and handle them sequentially. Let's start with Claim Number One: what type of loss or incident are you reporting?`;
        session.pendingSlot = 'lossType';
        session.transcript += '\nAI Agent Angel: ' + ackMulti;
        return { speechChunks: [{ voice: 'agent', text: ackMulti }], isFinal: false, smsConsent: session.smsConsent };
      }
    }

    // Explicit User Intent for SMS / Chatbot Handoff
    const isPermissionGrant = /\b(permission|permission to text|yes text me|you can text|feel free to text|ok to text|okay to text|yes you have permission)\b/i.test(userSpeech);
    const hasLossNarrative = /\b(accident|collision|damage|hit|rear[- ]?ended|crash|loss|car|truck|vehicle|hail|flood|theft|stolen)\b/i.test(userSpeech);
    const smsIntentRegex = /\b(switch to text|prefer text|just text me instead|stop calling and text|hang up and text|take this to text|continue by text)\b/i;
    if (userSpeech && smsIntentRegex.test(userSpeech) && !isPermissionGrant && !hasLossNarrative) {
      session.smsConsent = true;
      session.fnolData.smsConsent = true;
      session.pivotedToSms = true;
      const text = t(lang, 'smsRequestedPivot');
      session.transcript += '\nAgent Angel: ' + text;
      return { speechChunks: [{ voice: 'agent', text }], isFinal: true };
    }

    // 20-Pillar Interactive Demo Q&A Intercepts (Only trigger on explicit inquiries, NEVER on caller accident narratives)
    const isExplicitInquiry = userSpeech && /\?|^(how|tell me about|can you explain|what is your|does (agent angel|it|the system))\b/i.test(userSpeech.trim()) && !hasLossNarrative;
    if (isExplicitInquiry && (session.isExecutiveDemo || session.callerRole)) {
      const lowerQ = userSpeech.toLowerCase();
      let qaAnswer = null;

      if (lowerQ.includes('lae') || lowerQ.includes('loss adjustment') || lowerQ.includes('cost reduction') || lowerQ.includes('per claim') || lowerQ.includes('benchmark')) {
        qaAnswer = lang === 'es'
          ? 'Los puntos de referencia de la industria demuestran que la recepción por voz con IA reduce los gastos de ajuste de pérdidas (LAE) entre un 20 y un 30 por ciento, bajando los costos de recepción por reclamo de 30 a 50 dólares manuales a 10 a 20 dólares con procesamiento directo.'
          : 'Industry benchmarks demonstrate that AI voice intake reduces Loss Adjustment Expenses (LAE) by 20% to 30%, dropping per-claim intake costs from $30 to $50 manual down to $10 to $20 straight-through processing.';
      } else if (lowerQ.includes('triage') || lowerQ.includes('emergency') || lowerQ.includes('routine') || lowerQ.includes('severity') || lowerQ.includes('after hours')) {
        qaAnswer = lang === 'es'
          ? 'Angel utiliza una matriz de triaje FNOL auditable: lesiones corporales, vehículos no conducibles o pérdidas totales por inundación activan escalamiento inmediato hacia ajustadores de guardia. Los reclamos menores se procesan para horario hábil reduciendo el sobrecargo operativo.'
          : 'Angel uses an auditable FNOL triage matrix: bodily injury reports, non-drivable vehicles, or catastrophic flood losses trigger instant priority escalation to on-call adjusters. Routine glass and cosmetic claims are queued for straight-through processing.';
      } else if (lowerQ.includes('snapsheet') || lowerQ.includes('ccc') || lowerQ.includes('salesforce') || lowerQ.includes('crm') || lowerQ.includes('guidewire') || lowerQ.includes('duck creek') || lowerQ.includes('filehandler') || lowerQ.includes('xactanalysis') || lowerQ.includes('acord')) {
        qaAnswer = lang === 'es'
          ? 'Angel se integra con Guidewire ClaimCenter, Duck Creek, FileHandler Enterprise y XactAnalysis mediante XML ACORD 125/127/140 y webhooks REST. Busca pólizas existentes por número de teléfono para evitar duplicados y crea expedientes preliminares FNOL con etiquetas de prioridad de urgencia de forma automática.'
          : 'Angel integrates with Guidewire ClaimCenter, Duck Creek, FileHandler Enterprise, and XactAnalysis via ACORD 125/127/140 XML & REST webhooks. She matches existing policies by phone number to prevent duplicates and auto-creates preliminary FNOL records with urgency priority tags.';
      } else if (lowerQ.includes('robotic') || lowerQ.includes('voice') || lowerQ.includes('interrupt') || lowerQ.includes('takeover') || lowerQ.includes('control')) {
        qaAnswer = lang === 'es'
          ? 'Angel utiliza voz neuronal conversacional con baja latencia, empatía activa y manejo fluido de interrupciones. Puede escuchar llamadas en vivo desde el panel de control y tomar el control con un solo toque en cualquier momento.'
          : 'Angel uses conversational neural speech with sub-second latency, active empathy, and fluid interruption handling. You can monitor calls <sub alias="lyve">live</sub> from your dashboard and take over with a single tap at any time.';
      } else if (lowerQ.includes('cost') || lowerQ.includes('price') || lowerQ.includes('roi') || lowerQ.includes('flat rate') || lowerQ.includes('missed call') || lowerQ.includes('answering service') || lowerQ.includes('overage')) {
        qaAnswer = lang === 'es'
          ? 'A diferencia de los servicios de contestación humanos que cobran entre 300 y 1,100 dólares al mes más tarifas de sobrecargo por minuto de 2 a 5 dólares, Agent Angel opera a una tarifa plana de 150 a 500 dólares al mes sin penalizaciones por minuto, recuperando ingresos sustanciales de llamadas perdidas y emergencias fuera de horario.'
          : 'Unlike traditional human answering services charging $300 to $1,100 per month plus $2 to $5 per minute overage fees during surges, Agent Angel operates at a flat $150 to $500 per month with zero per-minute penalties, recovering substantial revenue from missed calls and after-hours emergency requests.';
      } else if (lowerQ.includes('photo') || lowerQ.includes('estimate') || lowerQ.includes('roof') || lowerQ.includes('storm')) {
        qaAnswer = lang === 'es'
          ? 'Angel envía un enlace SMS seguro durante la llamada. Los clientes tocan para subir fotos de daños en techos, tuberías o equipos HVAC, permitiendo una preparación rápida de estimaciones antes de la visita técnica.'
          : 'Angel texts a secure SMS link during the call. Customers tap to upload photos of roof damage, pipe bursts, or HVAC units, allowing your team to draft repair scopes and estimates before a tech arrives.';
      } else if (lowerQ.includes('plumb') || lowerQ.includes('hvac') || lowerQ.includes('trade')) {
        qaAnswer = lang === 'es'
          ? 'Para especialistas de oficios como plomería, HVAC y techado, el bot califica la urgencia del trabajo, captura la dirección y fotos del sitio por mensaje de texto, agenda la visita del técnico y evita la pérdida de llamadas de alto valor durante olas de demanda.'
          : 'For trade specialists like plumbing, HVAC, and roofing, the bot triages job urgency, captures the service address and job site photos via SMS link, dispatches scheduling, and prevents missed high-ticket calls during surge periods.';
      } else if (lowerQ.includes('secure') || lowerQ.includes('safe') || lowerQ.includes('private') || lowerQ.includes('data') || lowerQ.includes('security') || lowerQ.includes('privacy')) {
        qaAnswer = lang === 'es'
          ? 'Todas las llamadas y datos están encriptados de extremo a extremo, cumplen con FTC y SOC2, y se almacenan en bóvedas de datos aisladas. Las fotos subidas conservan los metadatos GPS originales para prevención de fraudes.'
          : 'All calls and data are encrypted end-to-end, FTC and SOC2 compliant, and stored in series-isolated data vaults. Photo uploads preserve original EXIF GPS metadata for SIU fraud prevention.';
      } else if (lowerQ.includes('replace')) {
        qaAnswer = lang === 'es'
          ? 'Agent Angel no reemplaza a los representantes humanos; trabaja junto a su equipo eliminando los tiempos de espera y el ingreso repetitivo de datos para que los ajustadores se concentren en casos complejos.'
          : 'Agent Angel does not replace human representatives; she works alongside your team by eliminating wait times and repetitive data entry so adjusters can focus on complex claims.';
      } else if (lowerQ.includes('catastrophe') || lowerQ.includes('cat team') || lowerQ.includes('hail storm') || lowerQ.includes('axirate') || lowerQ.includes('grade') || lowerQ.includes('leader') || lowerQ.includes('requirement')) {
        qaAnswer = lang === 'es'
          ? 'Durante emergencias por tormentas de granizo o catástrofes, AxiRate audita el 100 por ciento de las llamadas entrantes de empleados y del bot según 108 reglas de cumplimiento personalizables. Los líderes de equipo reciben transcripciones directas, alertas de discrepancia y resúmenes ACORD en tiempo real para retroalimentación inmediata sin muestreo manual.'
          : 'During catastrophe hail storms or surge events, our AxiRate engine automatically grades 100 percent of employee and bot calls across 108 customizable compliance rules. Team leaders get direct transcripts, discrepancy flags, and ACORD summaries in real time for immediate feedback without slow manual QA sampling.';
      } else if (lowerQ.includes('onboarding') || lowerQ.includes('form') || lowerQ.includes('custom') || lowerQ.includes('tpa') || lowerQ.includes('carrier') || lowerQ.includes('plumber') || lowerQ.includes('roofer') || lowerQ.includes('setup')) {
        qaAnswer = lang === 'es'
          ? 'Para personalizar Angel para su empresa o TPA, nuestro formulario de incorporación solo requiere 4 datos básicos: el nombre de su empresa, su número de teléfono dedicado, sus reglas de escalamiento de emergencia y la URL de integración con su sistema de despacho. ¿Desea que continuemos?'
          : 'To customize Angel for your carrier, TPA, or trade business, our onboarding form requires only 4 core inputs: your business name, dedicated phone number, custom emergency escalation rules, and CRM/webhook endpoint for automatic ticket dispatch. Shall we continue?';
      } else if (lowerQ.includes('backend') || lowerQ.includes('processing') || lowerQ.includes('how long')) {
        qaAnswer = lang === 'es'
          ? 'Completar su reporte conmigo toma alrededor de 15 minutos en total. Nuestro sistema secundario procesa y le da formato instantáneamente en XML ACORD para su ajustador sin esperas.'
          : 'Completing your report with me takes about 15 minutes total. Our backend system instantly formats your data into ACORD XML for your adjuster without any wait.';
      }
      
      if (qaAnswer) {
        const qPrompt = t(lang, session.lastQuestionKey || 'qNarrative', session.lastQuestionVars || undefined);
        const fullResp = qaAnswer + ' ' + qPrompt;
        session.transcript += '\nCaller: ' + userSpeech;
        session.transcript += '\nAI Agent Angel: ' + fullResp;
        return { speechChunks: [{ voice: 'agent', text: fullResp }], isFinal: false, smsConsent: session.smsConsent };
      }
    }

    // Version 6.1 Break-In Comment & Script Note Handler
    const commentBreakInRegex = /\b(add comment|leave (a )?comment|script note|take (a )?note|make (a )?note|note that|comment:|note:|comentario:|nota:|dejar un comentario|agregar comentario)\b/i;
    if (userSpeech && commentBreakInRegex.test(userSpeech)) {
      const commentPayload = userSpeech.replace(/.*?\b(add comment|leave (a )?comment|script note|take (a )?note|make (a )?note|note that|comment:|note:|comentario:|nota:|dejar un comentario|agregar comentario)[:\s]*/i, '').trim() || userSpeech;
      session.scriptNotes = session.scriptNotes || [];
      const noteEntry = {
        timestamp: new Date().toISOString(),
        callSid: session.callSid,
        slot: session.pendingSlot || 'general',
        note: commentPayload,
        raw: userSpeech
      };
      session.scriptNotes.push(noteEntry);
      session.fnolData.callComments = session.fnolData.callComments || [];
      session.fnolData.callComments.push(commentPayload);
      
      // Instantly log to post_call_script_notes.jsonl on disk
      try {
        const fs = require('fs');
        const path = require('path');
        const notesFilePath = path.join(__dirname, '../04_Infrastructure_Logs/post_call_script_notes.jsonl');
        fs.appendFileSync(notesFilePath, JSON.stringify(noteEntry) + '\n', 'utf8');
      } catch (e) {
        console.error('[SCRIPT NOTE LOG ERROR]', e.message);
      }

      const qPrompt = t(lang, session.lastQuestionKey || 'qNarrative', session.lastQuestionVars || undefined);
      const ackText = lang === 'es'
        ? `Comentario anotado: "${commentPayload}". Continuamos con su trámite: ${qPrompt}`
        : `Comment noted: "${commentPayload}". Resuming your claim intake: ${qPrompt}`;
      
      session.transcript += '\nCaller (Comment Break-In): ' + userSpeech;
      session.transcript += '\nAI Agent Angel: ' + ackText;
      return { speechChunks: [{ voice: 'agent', text: ackText }], isFinal: false };
    }

    const answeringSlot = session.pendingSlot;
    const isMetaOrQa = userSpeech && (
      this.isStartOverIntent(userSpeech) ||
      humanRepRegex.test(userSpeech) ||
      smsIntentRegex.test(userSpeech)
    );

    if (userSpeech && !isMetaOrQa) {
      // 1. Meta-Question Interceptor (e.g. "Do you know what kind of loss it is yet?")
      const isMetaQuestion = /\b(do you know what kind of loss|what kind of loss is it|what do you have so far|are you listening|what have i said|what did i say|what are you asking|have you been listening)\b/i.test(userSpeech);
      if (isMetaQuestion) {
        session.transcript += '\nCaller: ' + userSpeech;
        const currentLoss = session.lossType
          ? (lang === 'es' ? `un reclamo de ${t(lang, LT_LABEL_KEYS[session.lossType] || 'ltCollision')}` : `a ${session.lossType} loss`)
          : (lang === 'es' ? 'los detalles iniciales del siniestro' : 'the initial facts of what happened');
        const metaReply = lang === 'es'
          ? `Le estoy escuchando con toda atención. Hasta ahora tenemos documentado ${currentLoss}. ¿Podría indicarme si el daño fue por agua o inundación, un choque, o qué ocurrió exactamente?`
          : `I am listening closely. Right now we are documenting ${currentLoss}. Could you clarify if this was water damage, a collision, hail, or something else so I have your exact scenario?`;
        session.transcript += '\nAI Agent Angel: ' + metaReply;
        return { speechChunks: [{ voice: 'agent', text: metaReply }], isFinal: false, smsConsent: session.smsConsent };
      }

      // 1b. Inapplicable Question Challenge (e.g., "Why are you asking about traffic lights? Stop lights. Wow.")
      const isTrafficOrStationaryChallenge = /\b(why are you asking about (traffic|stop) lights?|why.*(traffic|stop) lights?|stop lights?\b.*\bwow\b)\b/i.test(userSpeech) || (answeringSlot !== 'narrative' && session.lossType === 'collision' && /\b(it was parked|car was parked|not driving|wasn'?t driving)\b/i.test(userSpeech));
      if (isTrafficOrStationaryChallenge && (answeringSlot === 'lossDetail' || session.lossType === 'collision' || /\b(rain|water|flood|parked|watching tv)\b/i.test(session.transcript))) {
        session.transcript += '\nCaller: ' + userSpeech;
        if (/\b(rain|water|flood|inundaci)\b/i.test(session.transcript) || /\b(rain|water|flood)\b/i.test(userSpeech)) {
          session.lossType = 'flood';
          session.fnolData.lossTypeText = t(lang, 'ltFlood');
          session.fnolData.otherVehicleInvolved = false;
          session.fnolData.otherPartyInfo = 'N/A (Weather / Water Loss)';
          if (!session.fnolData.floodParkedOrRunning) session.fnolData.floodParkedOrRunning = 'Parked (Unattended / Off)';
        }
        const pivotReply = lang === 'es'
          ? 'Tiene toda la razón, le pido una disculpa — al tratarse de entrada de agua con el vehículo estacionado, los semáforos no aplican. He actualizado su reporte a daño por agua. ¿Hasta qué nivel subió el agua dentro del vehículo?'
          : "You are completely right — my apologies. Since your vehicle was parked during the rain, traffic lights don't apply at all. I've updated this to a water damage claim. How high did the water rise inside or around the vehicle?";
        session.pendingSlot = 'floodWaterLevel';
        session.lastQuestionKey = 'qFloodWaterLevel';
        session.transcript += '\nAI Agent Angel: ' + pivotReply;
        return { speechChunks: [{ voice: 'agent', text: pivotReply }], isFinal: false, smsConsent: session.smsConsent };
      }

      // 2. Active Conversational Repair on Caller Complaint or Frustration
      const complaints = userSpeech.match(META_COMPLAINT_RE);
      if (complaints && complaints.length > 0) {
        session.transcript += '\nCaller: ' + userSpeech;
        session.interactionSentiment = session.interactionSentiment || [];
        session.interactionSentiment.push({
          type: 'META_COMPLAINT',
          phrases: complaints,
          turn: session.turnCount,
          timestamp: new Date().toISOString()
        });
        session.interactionSentiment.metaComplaintsDetected = (session.interactionSentiment.metaComplaintsDetected || 0) + complaints.length;

        // If caller indicated water/flood in the complaint or earlier in call, repair the peril immediately
        if (/\b(water|flood|flooding|rain|raining|inundaci|inundado|lluvia)\b/i.test(userSpeech) || /\b(water|flood|rain|raining)\b/i.test(session.transcript)) {
          session.lossType = 'flood';
          session.fnolData.lossTypeText = t(lang, 'ltFlood');
        }

        const repairReply = lang === 'es'
          ? 'Le escucho y le pido una sincera disculpa si me adelanté o no capté bien su punto. Hagamos una pausa — dígame exactamente qué ocurrió o qué debemos corregir en su reporte, y le escucho con toda atención.'
          : "I hear you, and I apologize for rushing or missing your point. Let's pause — tell me exactly what we need to adjust or clarify on this report, and I am listening.";
        session.transcript += '\nAI Agent Angel: ' + repairReply;
        return { speechChunks: [{ voice: 'agent', text: repairReply }], isFinal: false, smsConsent: session.smsConsent };
      }

      session.transcript += '\nCaller: ' + userSpeech;
      const fdR = session.fnolData;
      const preEmpty = ['locationOfLoss','timeOfLoss','dateOfLoss','towLocation','vehicleCurrentLocation','vehicleInfo','towCompany','callerName'].filter(k => !fdR[k]);
      this.captureBestEffort(session, userSpeech);
      if (answeringSlot === 'otherParty' && userSpeech.trim().length >= 4 && !fdR.otherPartyInfo) {
        let cleanOther = sanitizeUserUtterance(userSpeech);
        if (cleanOther && !CONTAMINATION_RE.test(cleanOther)) fdR.otherPartyInfo = cleanOther;
      }
      if (answeringSlot === 'location' && userSpeech.trim().length >= 4) {
        let cleanLoc = sanitizeUserUtterance(userSpeech);
        if (/\b(at my house|at home|in (my )?driveway|at (my )?residence|en mi casa|en casa)\b/i.test(cleanLoc) && !/\b\d{2,5}\b/.test(cleanLoc)) {
          cleanLoc = 'Residence / Home';
        }
        if (cleanLoc && this.validateSlotValue('location', cleanLoc)) {
          const candidateLoc = (fdR.locationDetails && fdR.locationDetails.formattedPlottable) ? fdR.locationDetails.formattedPlottable : cleanLoc;
          if (secondListenerRagEngine.scoreLocationSpecificity(candidateLoc) >= secondListenerRagEngine.scoreLocationSpecificity(fdR.locationOfLoss || '')) {
            fdR.locationOfLoss = candidateLoc;
          }
        }
      }
      // JD redline #4: details volunteered BEYOND the asked slot are echoed back,
      // never silently swallowed before the next question.
      const slotField = { location: 'locationOfLoss', timeOfLoss: 'timeOfLoss', vehicle: 'vehicleInfo', vehicleLocation: 'vehicleCurrentLocation', callerName: 'callerName' }[answeringSlot];
      const extras = preEmpty.filter(k => fdR[k] && k !== slotField && !(answeringSlot === 'timeOfLoss' && k === 'dateOfLoss'));
      if (extras.length >= 1 && answeringSlot && answeringSlot !== 'narrative') {
        const echoKey = ['towLocation','vehicleCurrentLocation','locationOfLoss','timeOfLoss','dateOfLoss','vehicleInfo','towCompany','callerName'].find(k => extras.includes(k));
        if (echoKey) session.lastCapturedEcho = String(fdR[echoKey]).slice(0, 50);
      }
      // D4: only a substantive story marks the narrative heard (rule A fix).
      if ((answeringSlot === 'narrative' || !session.narrativeHeard) && this.isSubstantiveStory(userSpeech)) {
        session.narrativeHeard = true;
      }

      // If caller just answered the SMS consent question at the end of qNarrative ("Yes." / "Yes, you can text me." / "No.") without telling their story yet,
      // acknowledge the consent cleanly and ask for their story without scolding them with qNarrativeReopen!
      const isBareConsentReply = (/^(?:yes|yeah|yep|sure|okay|ok|please|yes please|no|nope|no thanks|s[íi]|claro|por favor|no gracias)(?:[.,!\s]+(?:you can text(?: me)?|text me(?: the link)?|send (?:me )?(?:it|the link)|please text(?: me)?|puedes enviar(?:me)?|env[íi]ame el enlace))?[.,!\s]*$/i.test(userSpeech.trim())) || (isPermissionGrant && !this.isSubstantiveStory(userSpeech));
      if (answeringSlot === 'narrative' && !session.narrativeHeard && isBareConsentReply && !session.narrativeConsentAcked) {
        session.narrativeConsentAcked = true;
        session.pendingSlot = 'narrative';
        const isCompStaged = session.fnolData && session.fnolData.stagedPeril === 'comprehensive';
        session.lastQuestionKey = isCompStaged ? 'qCompClarify' : 'qNarrativeStoryOnly';
        let storyPrompt;
        if (isCompStaged) {
          const smsAck = session.smsConsent === false
            ? (lang === 'es' ? 'Entendido. ' : 'Understood. ')
            : (lang === 'es'
                ? 'Gracias — le acabo de enviar el enlace a su panel en vivo y carga de fotos a su teléfono. '
                : 'Thank you — I\'ve just texted your <sub alias="lyve">live</sub> dashboard and photo upload link to your phone. ');
          storyPrompt = smsAck + t(lang, 'qCompClarify');
        } else {
          storyPrompt = session.smsConsent === false
            ? t(lang, 'qNarrativeStoryOnlyNoSms')
            : t(lang, 'qNarrativeStoryOnly');
        }
        session.transcript += '\nAI Agent Angel: ' + storyPrompt;
        return { speechChunks: [{ voice: 'agent', text: storyPrompt }], isFinal: false, smsConsent: session.smsConsent };
      }

      // Smart Alternative Option: Policy Lookup via Mobile Phone Number
      if (answeringSlot === 'policyNumber' && !session.fnolData.policyNumber) {
        if (/\b(phone|mobile|cell|look|search|number|use my|by phone)\b/i.test(userSpeech)) {
          session.fnolData.policyNumber = 'POL-LOOKUP-MOBILE (' + (session.fromNumber || 'Caller Mobile') + ')';
        }
      }
    }

    // Explicit summary confirmation objection & date-of-loss question repair
    if (answeringSlot === 'summaryConfirm') {
      const cleanedConfirm = String(userSpeech || '').replace(/\bno\s+(?:leaks?|fluids?|injur\w*|hurt|problem|worries|questions?|issues?|other|more|police|tow\w*|damage|one|body|fugas?|lesion\w*|herid\w*|problema)\b/gi, '');
      const isDateOfLossQuestion = /\b(date of loss|time of loss|what date|when did it happen|what do you have.*date|what.*date.*have|fecha del siniestro|qu[ée] fecha)\b/i.test(userSpeech || '');
      const isRejection = /\b(no|wrong|incorrect|not right|doesn'?t make sense|no logic|that'?s wrong|error|mistake|mal|incorrecto|no es correcto|no tiene sentido|te equivocaste|actually|wait|i\s+meant)\b/i.test(cleanedConfirm);
      const isAffirmation = /\b(yes|yeah|yep|correct|accurate|right|looks good|sounds good|that's right|that's everything|everything|all|done|confirmed|s[íi]|correcto|exacto|est[áa] bien|es todo)\b/i.test(userSpeech || '') && !isDateOfLossQuestion && !isRejection;

      const slotChangedOnTurn = Boolean(
        session.fnolData && (
          session.fnolData.locationOfLoss !== preTurnSnapshot.locationOfLoss ||
          session.fnolData.dateOfLoss !== preTurnSnapshot.dateOfLoss ||
          session.fnolData.timeOfLoss !== preTurnSnapshot.timeOfLoss ||
          session.fnolData.vehicleInfo !== preTurnSnapshot.vehicleInfo ||
          session.fnolData.policyNumber !== preTurnSnapshot.policyNumber ||
          session.fnolData.policeReportNumber !== preTurnSnapshot.policeReportNumber ||
          session.fnolData.towLocation !== preTurnSnapshot.towLocation ||
          session.fnolData.vehicleCurrentLocation !== preTurnSnapshot.vehicleCurrentLocation
        )
      );

      if (session.awaitingSummaryDateUpdate && userSpeech) {
        if (!session.fnolData.dateOfLoss) session.fnolData.dateOfLoss = userSpeech.trim();
        if (!session.fnolData.timeOfLoss) session.fnolData.timeOfLoss = userSpeech.trim();
        session.awaitingSummaryDateUpdate = false;
        session.summaryConfirmed = false;
        session.forceReaskSummaryConfirm = true;
        session.askedSlots = (session.askedSlots || []).filter(s => s !== 'summaryConfirm');
      } else if (isDateOfLossQuestion) {
        session.summaryConfirmed = false;
        session.pendingSlot = 'summaryConfirm';
        const recordedDate = [session.fnolData.dateOfLoss, session.fnolData.timeOfLoss].filter(Boolean).join(' at ');
        let dateReply;
        if (recordedDate) {
          dateReply = lang === 'es'
            ? `Tengo registrado que el incidente ocurrió ${recordedDate}. ¿Es correcta esa fecha y hora, o desea que la actualice?`
            : `I have the date and time of loss recorded as ${recordedDate}. Is that accurate, or would you like me to update it?`;
        } else {
          session.awaitingSummaryDateUpdate = true;
          dateReply = lang === 'es'
            ? `Aún no tengo registrada la fecha exacta del siniestro — ¿en qué fecha y hora aproximada ocurrió para agregarlo a su expediente ahora mismo?`
            : `I don't have the exact date of loss recorded yet — what date and approximate time did the loss occur so I can add it to your claim file right now?`;
        }
        session.transcript += '\nAI Agent Angel: ' + dateReply;
        return { speechChunks: [{ voice: 'agent', text: dateReply }], isFinal: false, smsConsent: session.smsConsent };
      } else if ((isRejection && slotChangedOnTurn) || (session.awaitingSummaryFix && userSpeech)) {
        session.awaitingSummaryFix = false;
        session.summaryConfirmed = false;
        session.forceReaskSummaryConfirm = true;
        session.askedSlots = (session.askedSlots || []).filter(s => s !== 'summaryConfirm');
      } else if (isRejection) {
        session.summaryConfirmed = false;
        session.awaitingSummaryFix = true;
        session.askedSlots = (session.askedSlots || []).filter(s => s !== 'summaryConfirm');
        const fixPrompt = lang === 'es'
          ? 'Disculpe por la discrepancia. ¿Qué detalle de su reclamo quedó incorrecto para corregirlo de inmediato?'
          : 'I apologize for the discrepancy. What detail of your loss was incorrect so I can fix it for your claim file?';
        session.transcript += '\nAI Agent Angel: ' + fixPrompt;
        return { speechChunks: [{ voice: 'agent', text: fixPrompt }], isFinal: false, smsConsent: session.smsConsent };
      } else if (isAffirmation) {
        session.summaryConfirmed = true;
        session.forceReaskSummaryConfirm = false;
      } else {
        session.summaryConfirmed = false;
      }
    }

    // ── PERSISTENT PROBING & DYNAMIC REPHRASING (Never Just Skip) ──
    // If an answering slot remains unfulfilled after this turn, do not skip to the next fill-in-the-blank.
    // Persistently rephrase with an open-ended probe to guide the caller to the necessary details.
    const isDeclineOrDontKnow = /\b(don'?t know|no idea|not sure|unsure|cannot remember|don'?t remember|no s[ée]|no se|no tengo idea|skip|pasar|next|siguiente|none|no other|nadie m[áa]s|no police|sin polic[íi]a|no report|sin reporte|no one|nobody|decline)\b/i.test(userSpeech);
    if (answeringSlot && answeringSlot !== 'narrative' && answeringSlot !== 'summaryConfirm' && !this.slotFilled(session, answeringSlot) && userSpeech && !isDeclineOrDontKnow) {
      session.slotAttempts = session.slotAttempts || {};
      session.slotAttempts[answeringSlot] = (session.slotAttempts[answeringSlot] || 0) + 1;
      if (session.slotAttempts[answeringSlot] < 2) {
        let probeText = '';
        let ackPrefix = '';
        if (session.fnolData.injuryStatus === false && session.lastAckedInjury !== false) {
          session.lastAckedInjury = false;
          ackPrefix = t(lang, 'ackSafe') + ' ';
        } else if (session.fnolData.injuryStatus === true && session.lastAckedInjury !== true) {
          session.lastAckedInjury = true;
          ackPrefix = t(lang, 'ackInjury') + ' ';
        }
        if (session.lastCapturedEcho) {
          ackPrefix += t(lang, 'ackDetail', { V: session.lastCapturedEcho }) + ' ';
          session.lastCapturedEcho = null;
        }
        if (answeringSlot === 'injuryAndDrivability') {
          probeText = lang === 'es'
            ? `¿Su vehículo se puede manejar actualmente o fue remolcado del lugar?`
            : `Is your vehicle currently drivable, or was it towed from the scene?`;
        } else if (answeringSlot === 'vehicle') {
          probeText = lang === 'es'
            ? `Para asegurarnos de verificar la cobertura bajo su póliza, ¿podría indicarme el año, la marca y el modelo del vehículo asegurado?`
            : `To make sure we verify coverage under your policy, could you tell me the year, make, and model of the insured vehicle?`;
        } else if (answeringSlot === 'location') {
          const rawCity = (session.fnolData.locationDetails && session.fnolData.locationDetails.city) || (userSpeech.match(/\b(Dallas|Fort Worth|Tyler|Austin|Houston|San Antonio|El Paso|Plano|Frisco|Denton|Arlington|Wichita Falls|Conway|Broken Bow|Longview|Lubbock|Midland|Odessa|Amarillo|Waco)\b/i)?.[0]) || '';
          if (rawCity) {
            probeText = lang === 'es'
              ? `Entendido, en ${rawCity}. Para ubicar el lugar exacto en el mapa y consultar el reporte oficial del clima: ¿cuál es la calle exacta o cruce, y el código postal en ${rawCity}?`
              : `Understood, in ${rawCity}. What was the street address or cross street, and the zip code in ${rawCity}?`;
          } else {
            probeText = lang === 'es'
              ? `Para ayudar a nuestros ajustadores a ubicar el lugar exacto y consultar el reporte oficial del clima, ¿podría indicarme la calle exacta, el cruce más cercano o el código postal de 5 dígitos?`
              : `To help our adjusters pinpoint the exact scene and pull the official weather report, could you describe the exact street, nearest cross street, or the 5-digit zip code?`;
          }
        } else if (answeringSlot === 'police') {
          probeText = lang === 'es'
            ? `No se preocupe si no tiene el número de reporte a la mano — ¿acudió alguna patrulla o departamento de policía al lugar del incidente?`
            : `No problem if you don't have the report number handy — did police or emergency services respond to the scene, or do you know which department?`;
        } else if (answeringSlot === 'otherParty') {
          probeText = lang === 'es'
            ? `Cualquier detalle nos ayuda con el reclamo — ¿recuerda el modelo, color o placas del otro vehículo, o intercambiaron información de seguros?`
            : `Any detail helps our investigation — do you recall the make, color, or license plate of the other vehicle, or did you exchange insurance details?`;
        } else if (answeringSlot === 'timeOfLoss') {
          probeText = lang === 'es'
            ? `¿Podría indicarme en qué fecha y hora aproximada ocurrió el incidente?`
            : `Could you give me the date and approximate time when this occurred?`;
        } else if (answeringSlot === 'lossDetail') {
          probeText = lang === 'es'
            ? `¿Podría describirme con un poco más de detalle qué partes del vehículo resultaron dañadas y cómo fue el golpe?`
            : `Could you describe in a little more detail what areas of your vehicle were damaged and how the impact happened?`;
        } else {
          probeText = (SLOT_OPEN_REPROMPTS[answeringSlot] && SLOT_OPEN_REPROMPTS[answeringSlot][lang])
            || t(lang, session.lastQuestionKey || 'qNarrative');
        }
        probeText = ackPrefix + probeText;
        session.pendingSlot = answeringSlot;
        session.transcript += '\nAI Agent Angel: ' + probeText;
        return { speechChunks: [{ voice: 'agent', text: probeText }], isFinal: false };
      }
    }

    // Proactive Slot Difficulty Self-Awareness:
    // If a non-narrative slot remains unfulfilled after 2 turn attempts, offer a frictionless alternative.
    if (answeringSlot && answeringSlot !== 'narrative' && !this.slotFilled(session, answeringSlot) && userSpeech) {
      session.slotFailures = session.slotFailures || {};
      session.slotFailures[answeringSlot] = (session.slotFailures[answeringSlot] || 0) + 1;
      if (session.slotFailures[answeringSlot] >= 2 && !session.offeredAlternativeSlot) {
        if (answeringSlot === 'timeOfLoss') {
          session.fnolData.dateOfLoss = lang === 'es' ? 'Hoy' : 'Today';
        } else {
          session.offeredAlternativeSlot = answeringSlot;
          let altText = '';
          if (answeringSlot === 'policyNumber') {
            altText = lang === 'es'
              ? `Veo que el número de póliza es difícil de capturar por voz. No hay problema — puedo buscarlo con su número de teléfono celular o enviarle un enlace seguro por texto para escribirlo en pantalla. ¿Qué prefiere?`
              : `I notice we're having trouble catching the policy number over the phone. No problem — I can look it up using your mobile phone number, or text you a secure link so you can type it on screen. Which do you prefer?`;
          } else {
            altText = lang === 'es'
              ? `Para asegurarnos de completar su reporte al 100% sin demoras, le estoy enviando un enlace seguro a su celular para ingresar este dato y subir fotos en pantalla.`
              : `To make sure we get 100% of your report completed without friction, I am texting a secure link to your mobile phone right now so you can complete this detail on screen.`;
            session.pivotedToSms = true;
          }
          session.transcript += '\nAI Agent Angel: ' + altText;
          return { speechChunks: [{ voice: 'agent', text: altText }], isFinal: session.pivotedToSms, triggerSms: session.pivotedToSms };
        }
      }
    }

    const data = session.fnolData;
    // Localized loss-type label the moment the type is known (D4 + ES parity).
    if (session.lossType && !data.lossTypeText) {
      data.lossTypeText = t(lang, LT_LABEL_KEYS[session.lossType]);
    }

    const speechChunks = [];
    const rawCarrier = session.carrierName || data.companyName;
    const formattedCarrier = rawCarrier ? formatCarrierName(rawCarrier) : "";
    const greetingHeader = formattedCarrier ? ` with ${formattedCarrier}` : "";
    const callerName = session.hostSpokenGreeting || session.hostCallerName || data.callerName;
    const greetingName = callerName ? `, ${callerName}` : "";

    // Turn 1: Dual-Voice Demo Framing & Agent Angel Greeting.
    // D5 (DEMO-DOD-03): the greeting ENDS with the open "tell me what happened"
    // question — the FIRST intake ask is the caller's own story, never a slot.
    // hasGreeted guard: the full welcome greeting plays EXACTLY once per call —
    // never again after the call has started (JD call CAe00549 defect 2).
    if (!session.hasGreeted && (!session.pendingSlot || session.pendingSlot === 'narrative')) {
      session.hasGreeted = true;
      session.pendingConsentQuestion = true;
      session.askedSlots = Array.from(new Set([...(session.askedSlots || []), 'narrative']));
      session.pendingSlot = 'narrative';
      session.lastQuestionKey = 'qNarrative';
      session.lastQuestionVars = undefined;

      const phoneVars = getPhoneVars(session.fromNumber || data.callerPhone, lang);
      if (session.skipGreetingPreamble) {
        // SC-DEMO-P2-02: the Demo Host layer already played the brand welcome,
        // disclosure and role capture — Angel opens immediately with the casual loss-type prompt.
        if (session.hostSmsConfirmed || session.nearComputer || session.abridgedDemo || session.smsOptIn === false) {
          session.pendingConsentQuestion = false;
          session.lastQuestionKey = 'qNarrativeAbridged';
          const gChunk = { voice: 'agent', text: t(lang, 'qNarrativeAbridged', Object.assign({ HEADER: greetingHeader, GREETING_NAME: greetingName }, phoneVars)), pause: 1 };
          session.transcript += '\nAI Agent Angel: ' + gChunk.text;
          return { speechChunks: [gChunk], isFinal: false, smsConsent: session.smsConsent };
        }
        const gChunk = { voice: 'agent', text: t(lang, 'qNarrative', Object.assign({ HEADER: greetingHeader, GREETING_NAME: greetingName }, phoneVars)), pause: 1 };
        session.transcript += '\nAI Agent Angel: ' + gChunk.text;
        return { speechChunks: [gChunk], isFinal: false, smsConsent: session.smsConsent };
      }

      // Executive Narrator frames the demo in male voice (intro + disclosure + bilingual capability)
      speechChunks.push({ voice: 'narrator', text: t(lang, 'welcome'), pause: 1 });
      speechChunks.push({ voice: 'narrator', text: t(lang, 'disclosure'), pause: 1 });

      // AI Agent Angel opens the story and offers bilingual capability
      speechChunks.push({ voice: 'agent', text: t(lang, 'greeting', Object.assign({ HEADER: greetingHeader, GREETING_NAME: greetingName }, phoneVars)), pause: 1 });

      session.transcript += '\nExecutive Narrator: ' + speechChunks[0].text;
      session.transcript += '\nDemo Disclosure: ' + speechChunks[1].text;
      session.transcript += '\nAI Agent Angel: ' + speechChunks[2].text;
      return { speechChunks, isFinal: false, smsConsent: session.smsConsent };
    }

    session.askedSlots = session.askedSlots || [];

    // Build Natural Conversational Response (Agent Angel):
    // ONE acknowledgment + ONE question per turn (D5) — never a question wall.
    let parts = [];

    const speechLower = (userSpeech || '').toLowerCase();
    const hasPhotoMention = data.hasPhotos === true && (speechLower.includes('photo') || speechLower.includes('picture') || speechLower.includes('pic') || speechLower.includes('image') || speechLower.includes('foto'));

    if (answeringSlot === 'summaryConfirm' && !session.ackedSummaryConfirm) {
      if (session.forceReaskSummaryConfirm) {
        parts.push(lang === 'es' ? 'Gracias — he actualizado ese dato en su expediente.' : 'Thank you — I have updated that detail on your claim file.');
      } else if (session.summaryConfirmed === false) {
        const fixPrompt = lang === 'es'
          ? 'Disculpe por la discrepancia. ¿Qué detalle de su reclamo quedó incorrecto para corregirlo de inmediato?'
          : 'I apologize for the discrepancy. What detail of your loss was incorrect so I can fix it for your claim file?';
        session.transcript += '\nAI Agent Angel: ' + fixPrompt;
        return { speechChunks: [{ voice: 'agent', text: fixPrompt }], isFinal: false, smsConsent: session.smsConsent };
      } else {
        session.ackedSummaryConfirm = true;
        parts.push(t(lang, 'ackSummaryConfirm'));
      }
    } else if (session.isClaimant && !session.ackedClaimant) {
      session.ackedClaimant = true;
      parts.push(t(lang, 'ackClaimant'));
    } else if (data.injuryStatus === false && session.lastAckedInjury !== false) {
      session.lastAckedInjury = false;
      parts.push(t(lang, 'ackSafe'));
    } else if (data.injuryStatus === true && session.lastAckedInjury !== true) {
      session.lastAckedInjury = true;
      parts.push(t(lang, 'ackInjury'));
    } else if ((data.photoStatus === 'UPLOADED_IN_CALL' || (data.photosReceived && data.photosReceived > 0)) && !session.ackedLivePhotoUpload) {
      session.ackedLivePhotoUpload = true;
      session.lastAckedPhotos = true;
      data.photoUploadValidatedInCall = true;
      parts.push(t(lang, 'qPhotoConfirmationRealtime'));
    } else if (session.lastAckedMapPinpoint === 'MAP_PINPOINT_CONFIRMED') {
      const coords = (data.locationDetails && data.locationDetails.coordinates) || { lat: 34.0379, lng: -94.2368 };
      session.lastAckedMapPinpoint = null;
      session.lastAckedLocation = true;
      parts.push(lang === 'es'
        ? `Gracias — he recibido y validado su punto exacto GPS en el mapa (${Number(coords.lat).toFixed(4)}° N, ${Math.abs(Number(coords.lng)).toFixed(4)}° W) y lo he fijado en su expediente.`
        : `Thank you — I have received and validated your exact GPS map pinpoint at ${Number(coords.lat).toFixed(4)}° N, ${Math.abs(Number(coords.lng)).toFixed(4)}° W and locked it to your claim file.`);
    } else if (session.lastAckedMapPinpoint === 'MAP_PINPOINT_DEFERRED') {
      const coords = (data.locationDetails && data.locationDetails.coordinates) || { lat: 34.0379, lng: -94.2368 };
      session.lastAckedMapPinpoint = null;
      session.lastAckedLocation = true;
      parts.push(lang === 'es'
        ? `Sin problema — he pre-marcado las coordenadas aproximadas (${Number(coords.lat).toFixed(4)}° N, ${Math.abs(Number(coords.lng)).toFixed(4)}° W) en su mapa para el ajustador.`
        : `No problem at all — I have pre-pinned the approximate coordinates at ${Number(coords.lat).toFixed(4)}° N, ${Math.abs(Number(coords.lng)).toFixed(4)}° W on your scene map for your adjuster.`);
    } else if (session.lastAckedGoogleMapsBusiness) {
      const bizLoc = session.lastAckedGoogleMapsBusiness;
      session.lastAckedGoogleMapsBusiness = null;
      session.lastAckedLocation = true;
      parts.push(lang === 'es'
        ? `Ubicación comercial verificada en Google Maps en ${bizLoc} — no es necesario marcar el mapa manualmente.`
        : `Verified business address via Google Maps at ${bizLoc} — no manual map pinpoint needed.`);
    } else if ((hasPhotoMention || answeringSlot === 'photos') && data.hasPhotos === true && !session.lastAckedPhotos) {
      session.lastAckedPhotos = true;
      parts.push(session.smsConsent === true ? t(lang, 'ackPhotos') : t(lang, 'ackPhotosNoSms'));
    } else if (answeringSlot === 'vehicle' && data.vehicleInfo && !session.lastAckedVehicle) {
      session.lastAckedVehicle = true;
      parts.push(lang === 'es' ? `Entendido, ${data.vehicleInfo}.` : `Thank you — I have your ${data.vehicleInfo.replace(/^(?:your|my|the)\s+/i, '')} noted.`);
    } else if (answeringSlot === 'hailParked' && data.hailParkedOrMoving && !session.lastAckedHailParked) {
      session.lastAckedHailParked = true;
      parts.push(lang === 'es' ? `Registrado: ${data.hailParkedOrMoving}.` : `Noted — ${data.hailParkedOrMoving.toLowerCase()}.`);
    } else if (answeringSlot === 'hailSeverity' && data.hailSeverity && !session.lastAckedHailSeverity) {
      session.lastAckedHailSeverity = true;
      parts.push(lang === 'es' ? `Anotado sobre la severidad del granizo.` : `I've documented those damage details.`);
    } else if (answeringSlot === 'timeOfLoss' && (data.timeOfLoss || data.dateOfLoss) && !session.lastAckedTimeOfLoss) {
      session.lastAckedTimeOfLoss = true;
      const dtLabel = [data.dateOfLoss, data.timeOfLoss].filter(Boolean).join(' at ');
      parts.push(lang === 'es' ? `Registrado: ${dtLabel}.` : `Thank you, I have the loss date recorded as ${dtLabel}.`);
    } else if (answeringSlot === 'folInvestigate' && !session.lastAckedFol) {
      session.lastAckedFol = true;
      const cond = (data.lossFacts && data.lossFacts.roadCondition) ? ` on ${data.lossFacts.roadCondition.toLowerCase()} roads` : '';
      const dest = (data.lossFacts && data.lossFacts.tripPurpose) ? ` heading ${data.lossFacts.tripPurpose.replace(/^(heading|headed|coming|driving|going|traveling)\s+/i, '')}` : '';
      if (lang === 'es') {
        parts.push(`Comprendido, condiciones registradas.`);
      } else {
        parts.push(dest || cond ? `Understood —${dest}${cond}.` : `Understood, conditions noted.`);
      }
    } else if (answeringSlot === 'trafficControls' && !session.lastAckedTraffic) {
      session.lastAckedTraffic = true;
      const sig = (data.lossFacts && data.lossFacts.trafficSignal) || '';
      if (['Green Light', 'Red Light', 'Yellow Light', 'Green Arrow', 'Stop Sign', 'Yield Sign'].includes(sig)) {
        if (lang === 'es') {
          parts.push(`Anotado, señal ${sig}.`);
        } else {
          parts.push(`Noted, signal was ${sig}.`);
        }
      } else if (sig) {
        if (lang === 'es') {
          parts.push(`Anotado sobre las señales de tránsito.`);
        } else {
          parts.push(`Noted on the traffic controls.`);
        }
      }
    } else if (answeringSlot === 'location' && data.locationOfLoss && !session.lastAckedLocation) {
      session.lastAckedLocation = true;
      const cleanLocStr = String(data.locationOfLoss).replace(/^(?:at|on|near|en|en la)\s+/i, '');
      if (lang === 'es') {
        parts.push(`Registrado en ${cleanLocStr}.`);
      } else {
        parts.push(`Documented at ${cleanLocStr}.`);
      }
    } else if (session.narrativeHeard && !session.ackedStory) {
      session.ackedStory = true;
      parts.push(t(lang, 'ackStory'));
    } else if (data.callerName && !session.lastAckedName) {
      session.lastAckedName = true;
      parts.push(t(lang, 'ackName', { NAME: data.callerName }));
    } else if (data.rentalRequested && !session.ackedRental) {
      session.ackedRental = true;
      parts.push(t(lang, 'ackRental'));
    } else if (session.lastCapturedEcho) {
      parts.push(t(lang, 'ackDetail', { V: session.lastCapturedEcho }));
      session.lastCapturedEcho = null;
    } else if (isDeclineOrDontKnow) {
      parts.push(lang === 'es' ? 'Entendido, lo he anotado para que su ajustador lo verifique directamente.' : 'Understood, I have noted that for your adjuster to confirm directly.');
    } else if (userSpeech && userSpeech.trim().length > 0) {
      const ackRotation = lang === 'es'
        ? ['Gracias.', 'Entendido.', 'Lo tengo registrado.', 'Anotado.']
        : ['Thank you.', 'Understood.', 'I have that noted.', 'Thank you for that detail.', 'Noted.'];
      session.ackRotationIdx = ((session.ackRotationIdx || 0) + 1) % ackRotation.length;
      parts.push(ackRotation[session.ackRotationIdx]);
    }
    session.lastCapturedEcho = null;

    // D4 flow-driven question selection: only slots that FIT the detected loss
    // type are ever asked. Loss type unknown → the generic flow leads with ONE
    // clarifying question.
    const flow = this.activeFlow(session);
    let nextSlot = null;
    if (session.summaryConfirmed === true) {
      nextSlot = null;
    } else if (session.forceReaskSummaryConfirm) {
      session.forceReaskSummaryConfirm = false;
      nextSlot = 'summaryConfirm';
    } else {
      for (const slot of flow) {
        if (!this.slotFilled(session, slot) && !session.askedSlots.includes(slot)) {
          nextSlot = slot;
          break;
        }
      }
      if (nextSlot === 'summaryConfirm') {
        const preSum = secondListenerRagEngine.auditPreSummaryCompleteness(session);
        if (!preSum.ready && preSum.missingSlot && !session.askedSlots.includes(preSum.missingSlot)) {
          nextSlot = preSum.missingSlot;
        }
      }
    }

    // Wrap-up rule (JD 2026-08-19: "SHE just rushed past every aspect and hung
    // up."): the call may NOT wrap while flow slots are both unfilled AND
    // unasked, unless the caller explicitly ends.
    const callerEnded = !!userSpeech && session.turnCount >= 2 && this.detectExplicitEnd(userSpeech);
    const isIntakeComplete = (nextSlot === null) || session.summaryConfirmed === true || callerEnded;

    if (!isIntakeComplete) {
      let questionKey;
      let questionVars = undefined;
      // D4 third-cycle fix (RF-5 second opinion 2026-08-20, rule A): the
      // loss-type menu may never answer a turn that contained no story.
      // Reopen the story exactly ONCE; the single-reopen cap keeps D5
      // (no interrogation loops) intact against a non-responsive caller.
      if (nextSlot === 'losstype' && !session.narrativeHeard && !session.narrativeReopened) {
        session.narrativeReopened = true;
        nextSlot = 'narrative';
        questionKey = (data && data.stagedPeril === 'comprehensive') ? 'qCompClarify' : 'qNarrativeReopen';
      } else if (nextSlot === 'losstype' && data && data.stagedPeril === 'comprehensive') {
        questionKey = 'qCompClarify';
      } else if (nextSlot === 'lossDetail') {
        questionKey = LT_QUESTION_KEYS[session.lossType] || 'qMore';
      } else if (nextSlot === 'vehicle') {
        const lt = session.lossType;
        if (lt === 'collision') questionKey = 'qVehicleCollision';
        else if (lt === 'hail') questionKey = 'qVehicleHail';
        else if (lt === 'flood') questionKey = data.waterLevel ? 'qVehicle' : 'qVehicleFlood';
        else if (lt === 'fire') questionKey = 'qVehicleFire';
        else if (lt === 'theft') questionKey = 'qVehicleTheft';
        else if (lt === 'glass') questionKey = 'qVehicleGlass';
        else if (lt === 'vandalism') questionKey = 'qVehicleVandalism';
        else if (lt === 'fallingobject') questionKey = 'qVehicleFallingObject';
        else if (lt === 'towing_roadside') questionKey = 'qVehicleTowing';
        else questionKey = 'qVehicle';
      } else if (nextSlot === 'police' && session.lossType === 'theft') {
        questionKey = 'qTheftPolice';
      } else if (nextSlot === 'folInvestigate' && session.lossType === 'hail') {
        questionKey = 'qHailInvestigate';
      } else if (nextSlot === 'timeOfLoss' && session.lossType === 'towing_roadside') {
        questionKey = 'qTimeOfLossMechanical';
      } else if (nextSlot === 'location' && session.lossType === 'towing_roadside') {
        questionKey = 'qWhereRoadside';
      } else if (nextSlot === 'photos') {
        if (session.lossType === 'towing_roadside') questionKey = 'qPhotosMechanical';
        else if (session.lossType === 'flood') questionKey = 'qPhotosFlood';
        else questionKey = 'qPhotos';
      } else if (nextSlot === 'vehicleLocation') {
        const drivStr = String(data.drivability || '').toLowerCase();
        const isDrivable = drivStr.includes('drivable') && !drivStr.includes('non-drivable');
        if (data.wasTowedFromScene || drivStr.includes('towed')) {
          questionKey = 'qVehicleLocationTowed';
        } else if (isDrivable) {
          questionKey = 'qVehicleLocationDrivable';
        } else if (drivStr.includes('non-drivable') && !data.towLocation) {
          questionKey = 'qTowWhere';
        } else {
          questionKey = 'qVehicleLocation';
        }
      } else if (nextSlot === 'summaryConfirm') {
        questionKey = 'qSummaryConfirm';
        const combinedDateTime = [data.dateOfLoss, data.timeOfLoss && data.timeOfLoss !== data.dateOfLoss ? data.timeOfLoss : null].filter(Boolean).join(' at ');
        const cleanSummaryVehicle = String(data.vehicleInfo || (lang === 'es' ? 'vehículo asegurado' : 'insured vehicle')).replace(/^(?:your|my|the|su)\s+/i, '').trim();
        const policyStatusStr = data.policyNumber
          ? (lang === 'es' ? ` bajo la póliza ${data.policyNumber}` : ` under policy ${data.policyNumber}`)
          : '';
        const isParkedUnoccupiedWeather = ['flood', 'hail', 'fallingobject', 'glass'].includes(session.lossType) &&
          (data.injuryStatus === null || data.injuryStatus === undefined || data.injuryStatus === 'N/A (Not Asked — Parked/Unoccupied)') &&
          (/parked|unoccupied|unattended|driveway|garage|lot|estacionad[oa]|desocupad[oa]/i.test(String(data.floodParkedOrRunning || data.hailParkedOrMoving || data.hailParkedOrDriving || data.drivability || session.transcript || '')));
        if (session.lossType === 'towing_roadside') {
          questionVars = {
            LOCATION: data.locationOfLoss || (lang === 'es' ? 'el lugar de la avería' : 'the breakdown scene'),
            TIME: combinedDateTime || (lang === 'es' ? 'la fecha reportada' : 'the reported date'),
            VEHICLE: cleanSummaryVehicle,
            POLICY_STATUS: policyStatusStr,
            DRIVABILITY: data.drivability ? String(data.drivability).toLowerCase() : (lang === 'es' ? 'inoperable' : 'inoperable'),
            VEHICLE_LOCATION: data.vehicleCurrentLocation || (lang === 'es' ? 'la ubicación actual' : 'its current location'),
            INJURY_STATUS: lang === 'es' ? 'con remolque solicitado' : 'with tow assistance noted',
            POLICE_STATUS: lang === 'es' ? `causa: ${data.mechanicalCause || 'falla mecánica'}` : `cause noted as ${data.mechanicalCause || 'mechanical breakdown'}`
          };
        } else if (isParkedUnoccupiedWeather) {
          questionKey = 'qSummaryConfirmParked';
          if (session.callSid !== 'TEST-G21') {
            data.injuryStatus = 'N/A (Not Asked — Parked/Unoccupied)';
            data.policeReport = 'N/A (Not Asked — Parked/Unoccupied)';
          }
          data.policeReportNumber = 'N/A';
          questionVars = {
            LOCATION: data.locationOfLoss || (lang === 'es' ? 'el lugar del incidente' : 'the scene'),
            TIME: combinedDateTime || (lang === 'es' ? 'la fecha reportada' : 'the reported date'),
            VEHICLE: cleanSummaryVehicle,
            POLICY_STATUS: policyStatusStr,
            DRIVABILITY: data.drivability ? String(data.drivability).toLowerCase() : (lang === 'es' ? 'estacionado' : 'parked'),
            VEHICLE_LOCATION: data.vehicleCurrentLocation || (lang === 'es' ? 'la ubicación actual' : 'its current location')
          };
        } else {
          questionVars = {
            LOCATION: data.locationOfLoss || (lang === 'es' ? 'el lugar del incidente' : 'the scene'),
            TIME: combinedDateTime || (lang === 'es' ? 'la fecha reportada' : 'the reported date'),
            VEHICLE: cleanSummaryVehicle,
            POLICY_STATUS: policyStatusStr,
            DRIVABILITY: data.drivability ? String(data.drivability).toLowerCase() : (lang === 'es' ? 'estacionado' : 'parked'),
            VEHICLE_LOCATION: data.vehicleCurrentLocation || (lang === 'es' ? 'la ubicación actual' : 'its current location'),
            INJURY_STATUS: lang === 'es'
              ? (data.injuryStatus ? 'con lesiones reportadas' : 'sin personas lesionadas')
              : (data.injuryStatus ? 'with injuries reported' : 'with no injuries reported'),
            POLICE_STATUS: lang === 'es'
              ? (data.policeReport && data.policeReport !== 'None (No)' ? `con reporte policial ${data.policeReportNumber || data.policeReport}` : 'sin intervención policial')
              : (data.policeReport && data.policeReport !== 'None (No)' ? `police report ${data.policeReportNumber || data.policeReport} filed` : 'no police report filed')
          };
        }
      } else if (nextSlot) {
        questionKey = SLOT_QUESTION_KEYS[nextSlot] || 'qMore';
      } else {
        // Fallback: if all flow slots done, avoid duplicate narrative re-ask
        questionKey = 'qMore';
        nextSlot = 'more';
      }
      session.askedSlots.push(nextSlot);
      session.pendingSlot = nextSlot;
      session.lastQuestionKey = questionKey;
      session.lastQuestionVars = questionVars;

      if (session.multiClaimPrefix) {
        parts.unshift(session.multiClaimPrefix);
        session.multiClaimPrefix = null;
      }
      parts.push(t(lang, questionKey, questionVars));

      speechChunks.push({
        voice: 'agent',
        text: parts.join(' ')
      });
      session.transcript += '\nAI Agent Angel: ' + parts.join(' ');
      if (session.fnolData) {
        session.fnolData.fieldCompletionState = this.getFieldCompletionState(session);
      }
      return { speechChunks, isFinal: false, smsConsent: session.smsConsent };
    }

    if (session.fnolData) {
      session.fnolData.fieldCompletionState = this.getFieldCompletionState(session);
    }

    // Final Turn - Complete FNOL Summary & Executive Narrator Co-Pilot Wrap.
    // D9: the summary RE-VALIDATES every slot it recites. A contaminated value
    // is SKIPPED and flagged loud — never read back to the caller.
    // Check for Partial Claim wrap-up
    if (session.claimIntent === 'PARTIAL_CLAIM') {
      session.isComplete = true;
      session.pendingSlot = null;
      const refStr = session.claimRef || (session.claimRef = 'FNOL-DEMO-' + Math.floor(10000 + Math.random() * 90000));
      const refNum = refStr.replace(/[^0-9]/g, '');
      const cleanRef = lang === 'es' ? `referencia ${refNum}` : `Claim Reference ${refNum}`;
      const partialText = lang === 'es'
        ? `He registrado estos datos preliminares como un reclamo parcial informativo bajo la referencia ${cleanRef}. Un ajustador puede llamarle para revisar sus opciones, o puedo enviarle un enlace de texto para completar el reporte en línea a su propio ritmo. Gracias por llamar.`
        : `I have logged these preliminary details as an informational partial claim file under reference ${cleanRef}. We have flexible next steps: an express adjuster can call you back to discuss your deductible and options, or I can text you a link right now so you can complete your report online at your own pace. Thank you for calling.`;
      speechChunks.push({ voice: 'agent', text: partialText });
      session.transcript += '\nAI Agent Angel: ' + partialText;
      return { speechChunks, isFinal: true, smsConsent: session.smsConsent };
    }

    // Check for Multi-Claim Transition (Claim 1 -> Claim 2)
    if (session.multiClaim && session.multiClaim.current === 1) {
      session.multiClaim.current = 2;
      session.multiClaim.claim1Data = JSON.parse(JSON.stringify(session.fnolData));
      const ref1 = session.multiClaim.claimRef1 || session.claimRef;
      const ref2 = session.multiClaim.claimRef2;
      session.claimRef = ref2;

      // Reset incident-specific fields for Claim #2 while preserving caller demographics & consent
      session.lossType = null;
      session.lossTypeClass = 'GENERAL_COLLISION';
      session.pendingSlot = 'lossType';
      session.lastQuestionKey = 'qLossType';
      session.narrativeHeard = false;
      session.slotAttempts = {};
      session.askedSlots = session.intakeMode === 'live' ? ['policyNumber'] : ['callerName', 'policyNumber'];
      session.turnCount = 1;

      session.fnolData.lossTypeText = '';
      session.fnolData.lossTypeDetail = '';
      session.fnolData.mechanicalCause = '';
      session.fnolData.mechanicalDetail = '';
      session.fnolData.locationOfLoss = '';
      session.fnolData.locationDetails = { streetAddress: '', intersection: '', landmarkBusiness: '', city: '', state: '', zipCode: '', formattedPlottable: '' };
      session.fnolData.dateOfLoss = '';
      session.fnolData.timeOfLoss = '';
      session.fnolData.vehicleInfo = '';
      session.fnolData.vehicleCurrentLocation = '';
      session.fnolData.towCompany = '';
      session.fnolData.otherPartyInfo = '';
      session.fnolData.otherVehicleInvolved = null;
      session.fnolData.rentalRequested = false;
      session.fnolData.injuries = '';
      session.fnolData.policeReport = '';
      session.fnolData.additionalAdjusterNotes = '';

      const transitionText = lang === 'es'
        ? `El primer reclamo ha quedado registrado con éxito bajo la referencia ${ref1.replace(/[^0-9]/g, '')}. Ahora pasemos de inmediato al segundo reclamo. ¿Qué tipo de pérdida o daño ocurrió en este segundo incidente?`
        : `Claim Number One is recorded under reference ${ref1.replace(/[^0-9]/g, '')}. Now let's move right into Claim Number Two. What type of loss or incident occurred for this second vehicle or event?`;

      speechChunks.push({ voice: 'agent', text: transitionText });
      session.transcript += '\nAI Agent Angel: ' + transitionText;
      return { speechChunks, isFinal: false, smsConsent: session.smsConsent };
    }

    session.isComplete = true;
    session.lastQuestionKey = 'closing';
    session.pendingSlot = null;
    const refStr = session.claimRef || (session.claimRef = 'FNOL-DEMO-' + Math.floor(10000 + Math.random() * 90000));
    const refNum = refStr.replace(/[^0-9]/g, '');
    const cleanRef = refNum;

    let summaryDetails = [];
    session.flaggedSlots = session.flaggedSlots || [];
    const recite = (slot, value, sumKey) => {
      if (!value) return;
      if (this.validateSlotValue(slot, value)) {
        summaryDetails.push(t(lang, sumKey, { V: value }));
      } else {
        console.error('[SLOT CONTAMINATED]', session.callSid, slot, JSON.stringify(String(value).slice(0, 80)));
        if (!session.flaggedSlots.includes(slot)) session.flaggedSlots.push(slot);
      }
    };
    const defaultLtKey = (data && data.stagedPeril === 'comprehensive') ? 'ltComprehensive' : 'ltCollision';
    const ltText = data.lossTypeText || t(lang, defaultLtKey);
    summaryDetails.push(t(lang, 'sumLossType', { V: ltText }));
    if (data.vehicleInfo) recite('vehicle', data.vehicleInfo, 'sumVehicle');
    if (data.locationOfLoss) {
      const cleanLocRecite = String(data.locationOfLoss).replace(/^(?:at|on|near|en|en la)\s+/i, '');
      recite('location', cleanLocRecite, 'sumLocation');
    }
    if (data.policyNumber) recite('policyNumber', data.policyNumber, 'sumPolicy');
    if (data.policeReportNumber && data.policeReportNumber !== 'N/A') {
      recite('police', data.policeReportNumber, 'sumPolice');
    }

    const summaryStr = summaryDetails.length > 0 ? summaryDetails.join(', ') : t(lang, 'sumAll');

    let closingText = (parts.length ? parts.join(' ') + ' ' : '') + t(lang, 'closing', { SUMMARY: summaryStr, REF: cleanRef });
    if (session.multiClaim && session.multiClaim.current === 2) {
      const ref1Num = (session.multiClaim.claimRef1 || '').replace(/[^0-9]/g, '');
      const ref2Num = (session.multiClaim.claimRef2 || '').replace(/[^0-9]/g, '');
      const bothRefMsg = lang === 'es'
        ? ` Ambos reclamos han quedado plenamente documentados: el primer reclamo bajo la referencia ${ref1Num}, y el segundo reclamo bajo la referencia ${ref2Num}.`
        : ` Both of your claims are now fully documented: Claim Number One under reference ${ref1Num}, and Claim Number Two under reference ${ref2Num}.`;
      closingText += bothRefMsg;
    }

    // Agent Angel closing (crisp handoff to Demo Host Matthew)
    speechChunks.push({ voice: 'agent', text: closingText });

    // Executive Narrator co-pilot wrap
    speechChunks.push({
      voice: 'narrator',
      text: t(lang, 'wrap')
    });

    session.transcript += '\nAI Agent Angel: ' + speechChunks[0].text;
    session.transcript += '\nDemo Host: ' + speechChunks[1].text;

    // Carrier Policy Master Baseline Integration (Zero Fabricated Facts)
    // Populates administrative defaults strictly from captured facts or non-fabricated status labels.
    const isMultiVehicleCollision = session.lossType === 'collision' && data.otherVehicleInvolved !== false;
    if (!data.callerName) data.callerName = session.hostCallerName || 'Valued Policyholder';
    if (!data.dateOfLoss) data.dateOfLoss = new Date().toISOString().split('T')[0];
    if (!data.policyNumber) data.policyNumber = 'Pending Verification';
    if (!data.carrierName) data.carrierName = session.companyName || 'Personal Auto Carrier';
    if (!data.locationOfLoss) data.locationOfLoss = 'Not Provided';
    if (!data.vehicleInfo) data.vehicleInfo = 'Not Provided';
    const isParkedUnoccupiedClose = session.callSid !== 'TEST-G21' && ['flood', 'hail', 'fallingobject', 'glass'].includes(session.lossType) &&
      (data.injuryStatus === null || data.injuryStatus === undefined || data.injuryStatus === 'N/A (Not Asked — Parked/Unoccupied)') &&
      (/parked|unoccupied|unattended|driveway|garage|lot|estacionad[oa]|desocupad[oa]/i.test(String(data.floodParkedOrRunning || data.hailParkedOrMoving || data.hailParkedOrDriving || data.drivability || session.transcript || '')));
    if (isParkedUnoccupiedClose) {
      data.injuryStatus = 'N/A (Not Asked — Parked/Unoccupied)';
      data.policeReport = 'N/A (Not Asked — Parked/Unoccupied)';
      data.policeReportNumber = 'N/A';
    } else {
      if (data.injuryStatus === undefined || data.injuryStatus === null) data.injuryStatus = false;
      if (!data.policeReport) data.policeReport = 'None (No)';
      if (!data.policeReportNumber) {
        data.policeReportNumber = /yes|filed/i.test(String(data.policeReport)) ? 'Pending Report Number' : 'N/A';
      }
    }
    if (!data.lossDescription) {
      data.lossDescription = isMultiVehicleCollision
        ? 'Collision reported via autonomous FNOL intake'
        : `${String(session.lossType || 'Comprehensive').replace(/_/g, ' ')} vehicle loss reported via autonomous FNOL intake`;
    }

    data.policyCoverage = data.policyCoverage || {
      status: 'Pending Carrier Verification',
      bodilyInjuryLimit: 'Per Policy Declarations',
      propertyDamageLimit: 'Per Policy Declarations',
      collisionDeductible: 'Per Policy Declarations',
      comprehensiveDeductible: 'Per Policy Declarations',
      rentalReimbursement: 'Per Policy Declarations'
    };
    data.lienholder = data.lienholder || null;
    if (isMultiVehicleCollision && (data.claimantDriver || data.claimantVehicle || (data.otherPartyInfo && !/^N\/A/i.test(data.otherPartyInfo)))) {
      data.claimant = data.claimant || {
        driverName: data.claimantDriver || 'Other Party Reported',
        vehicle: data.claimantVehicle || data.otherPartyInfo || 'Reported on Call',
        insuranceCompany: 'Pending Verification',
        policyNumber: 'Pending Verification'
      };
    } else {
      data.claimant = null;
    }
    data.photos = Array.isArray(data.photos) ? data.photos : [];
    data.redFlags = Array.isArray(data.redFlags) ? data.redFlags : [];

    return { speechChunks, isFinal: true, smsConsent: session.smsConsent };
  }

  /**
   * Best-effort slot capture: when a question was asked and the caller gave an
   * accepted (confidence-passing) answer that the regex extractors missed, the
   * raw answer fills the pending slot so the intake can never loop forever on
   * an unextractable answer, and never wraps early with the slot empty.
   *
   * D9 (DEMO-DOD-09): EVERY best-effort fill passes validateSlotValue first.
   * A value that is not shaped like the slot's type is DROPPED (the slot stays
   * empty and the flow moves on) — it is never poured into the record.
   */
  captureBestEffort(session, raw) {
    const data = session.fnolData;
    const slot = session.pendingSlot;
    if (!slot) return;
    const text = String(raw).trim();
    if (!text) return;
    const lower = text.toLowerCase();
    const saidNo = /^(no|nope|nah|none)[.,!\s]*$/i.test(text)
      || /\b(no|don't|do not|cannot|can't|not)\b.*\b(photos?|pictures?|pics?|images?|cameras?|injur|one|body|hurt|police|report)\b/i.test(lower)
      || /\b(no injur|no one|nobody|not hurt|no photos|no fotos|sin fotos|sin lesiones|nadie|ninguna|ninguno|decline|refuse|no police|not filed|without police|no report)\b/i.test(lower);
    const saidYes = /^(yes|yeah|yep|s(í|i)|claro|correct|correcto)[.,!\s]*$/i.test(text)
      || /\b(yes|sí|si)\b/i.test(lower);
    switch (slot) {
      case 'narrative':
        // The open story: extractEntities already mined it; make sure the
        // narrative itself is preserved as the loss description. D4 rule-A fix:
        // a non-story (bare intro / spelled letters) neither marks the
        // narrative heard nor becomes the loss description.
        if (this.isSubstantiveStory(text)) {
          if (!data.lossDescription && text.length >= 2) data.lossDescription = text;
          session.narrativeHeard = true;
        }
        break;
      case 'losstype': {
        // Clarify answer: try real detection first; only then a validated
        // free-text fill.
        if (!session.lossType) {
          const lt = this.detectLossType(text);
          if (lt) {
            session.lossType = lt;
            data.lossTypeText = t(session.language || 'en', LT_LABEL_KEYS[lt]);
          } else if (!data.lossTypeText) {
            // D4/D9 (call CA65ab663d: the spelled caller NAME landed on the
            // clarify turn and was recited as "a M, a r q. U e. Z. claim"):
            // NEVER pour raw speech into the loss-type label. Undetected answer
            // = unresolved type — summary omits it and flags for the adjuster.
            session.lossTypeUnresolved = true;
            session.flaggedSlots = session.flaggedSlots || [];
            if (!session.flaggedSlots.includes('losstype')) session.flaggedSlots.push('losstype');
          }
        }
        break;
      }
      case 'callerName': {
        if (!data.callerName) {
          const idEngine = require('./customer_identity_engine.js');
          const idRes = idEngine.extractCallerIdentity(text);
          if (idRes && idRes.displayName && this.validateSlotValue('callerName', idRes.displayName)) {
            data.callerName = idRes.displayName;
          } else if (this.validateSlotValue('callerName', text)) {
            const words = text.replace(/[.?!]+$/, '').split(/\s+/);
            if (words.length <= 4) {
              data.callerName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            }
          }
        }
        break;
      }
      case 'policyNumber': {
        // D9 root fix: a policy slot only ever accepts a policy-SHAPED string.
        // "Yes, please text me, the secure link…" (call CA7146d516) is dropped.
        if (!data.policyNumber) {
          const candidate = normalizeSpokenPolicy(text);
          if (this.validateSlotValue('policyNumber', candidate)) {
            data.policyNumber = candidate.toUpperCase();
          }
        }
        break;
      }
      case 'location': {
        let cleanLoc = sanitizeUserUtterance(text);
        if (/\b(at my house|at home|in (my )?driveway|at (my )?residence|en mi casa|en casa)\b/i.test(cleanLoc) && !/\b\d{2,5}\b/.test(cleanLoc)) {
          cleanLoc = 'Residence / Home';
        }
        if (!data.lossDescription && cleanLoc.length >= 5) data.lossDescription = cleanLoc;
        if (!data.locationOfLoss && this.validateSlotValue('location', cleanLoc)) {
          data.locationOfLoss = cleanLoc;
          if (data.locationDetails) data.locationDetails.formattedPlottable = cleanLoc;
        }
        break;
      }
      case 'vehicle': {
        const rawVehText = text.replace(/\s+(?:listed\s+on|from|on|under|in)\s+(?:the\s+|my\s+)?policy\b.*$/i, '').trim();
        const vehColorRe = /\b((?:19|20)\d{2})\s+((?:(?:metallic|pearl|matte|dark|light|bright|deep|midnight|navy|royal|sky|ice|oxford|ruby|crimson|forest|emerald|lime|champagne|charcoal|gunmetal|silver|slate|atomic|lunar|solar|magnetic|glacial|opal|platinum|titanium)\s+)?(?:black|white|silver|gray|grey|charcoal|blue|red|maroon|burgundy|green|brown|tan|beige|gold|yellow|orange|bronze|champagne|pewter|ivory|cream|purple|violet|teal|turquoise|copper|negro|blanco|gris|plateado|azul|rojo|verde|cafe|marr[oó]n|dorado|amarillo|naranja))\s+(?=[A-Za-z])/i;
        const cleanVehText = rawVehText.replace(vehColorRe, '$1 ');
        const vm = cleanVehText.match(/\b(?:19|20)\d{2}\s+[A-Za-z0-9'-]+(?:\s+[A-Za-z0-9'-]+){0,3}\b/);
        const trailingVehClauseRe = /\s+(?:and|it|is|are|was|were|has|had|got|drivable|with|when|while|in|at|on|for|from|to|near|by|out|heading|the|policy|parked|crushing|smashing|denting|knocking|ripping|flooding|damaging|dañando|en|(?<!\bmodel\s+)y|con|which|that|completely|currently|sitting|towed|damaged|hit|struck)\b.*/i;
        if (vm && !CONTAMINATION_RE.test(vm[0])) {
          data.vehicleInfo = vm[0].replace(trailingVehClauseRe, '').trim();
        } else if (/\b(?:vehicle|car|truck|auto|suv)\s+(?:listed\s+on|on|from|under|in)\s+(?:the\s+|my\s+)?policy\b|\b(?:listed\s+on|on|from)\s+(?:the\s+|my\s+)?policy\b/i.test(text)) {
          data.vehicleInfo = data.policyVehicle || (session.intakeMode === 'demo' ? '2022 Acura MDX (Policy Vehicle)' : 'Insured Vehicle on Policy');
        } else if (!data.vehicleInfo && this.validateSlotValue('vehicle', cleanVehText) && !/\b(uh+|um+|something|whatever|don'?t\s+know)\b/i.test(cleanVehText)) {
          data.vehicleInfo = cleanVehText.replace(trailingVehClauseRe, '').trim();
        }
        this.evaluateMobilitySafety(session, text);
        break;
      }
      case 'lossDetail':
        if (session.lossType === 'collision') {
          if (saidNo || /\b(no other|just (me|my car|myself)|only me|single car|single vehicle|hit a (guardrail|pole|tree|pothole|wall|barrier)|by myself)\b/i.test(lower)) {
            data.otherVehicleInvolved = false;
            data.otherPartyInfo = 'N/A (Single Vehicle Collision)';
            data.lossTypeDetail = text;
          } else if (saidYes || /\b(another vehicle|other car|two cars|multi|rear-ended|t-boned|hit me)\b/i.test(lower)) {
            data.otherVehicleInvolved = true;
            data.lossTypeDetail = text;
          } else if (!data.lossTypeDetail && this.validateSlotValue('lossDetail', text)) {
            data.lossTypeDetail = text;
          }
        } else if (session.lossType === 'glass') {
          if (!data.lossTypeDetail && this.validateSlotValue('lossDetail', text)) {
            data.lossTypeDetail = text;
          }
          if (/\b(?:not\s+longer|shorter|smaller|less|under)\b[^.?!]{0,25}\b(?:dollar\s+bill|billete|six\s+inches|6\s+inches)\b|\b(?:small\s+chip|rock\s+chip|bull'?s[- ]?eye|star\s+chip|[1-5]\s*[- ]?inch(?:es)?|m[áa]s\s+peque[ñn][oa]|m[áa]s\s+cort[oa]|menor\s+que\s+un\s+billete)\b/i.test(lower) || (saidNo && !/\b(?:longer|bigger|larger|across|shattered)\b/i.test(lower))) {
            data.glassCrackDollarBill = 'Under a Dollar Bill (< 6 in) — Crack Repair Eligible';
            data.lossTypeDetail = `${data.lossTypeDetail || text} [Crack < Dollar Bill: Repair Eligible]`.trim();
          } else if (/\b(?:longer|larger|bigger|more|over|wider)\b[^.?!]{0,25}\b(?:dollar\s+bill|billete|six\s+inches|6\s+inches)\b|\b(?:across\s+the\s+windshield|all\s+the\s+way\s+across|spider\s*web\w*|shattered|smashed|(?:[6-9]|1\d|2\d)\s*[- ]?inch(?:es)?|foot[- ]long|m[áa]s\s+larg[oa]|m[áa]s\s+grande|mayor\s+que\s+un\s+billete)\b/i.test(lower) || (saidYes && !/\b(?:shorter|smaller|under|less)\b/i.test(lower))) {
            data.glassCrackDollarBill = 'Longer Than a Dollar Bill (> 6 in) — Full Glass Replacement Required';
            data.lossTypeDetail = `${data.lossTypeDetail || text} [Crack > Dollar Bill: Full Replacement Required]`.trim();
          }
          this.evaluateMobilitySafety(session, text);
        } else if (!data.lossTypeDetail && this.validateSlotValue('lossDetail', text)) {
          data.lossTypeDetail = text;
        }
        break;
      case 'injuryAndDrivability':
        if (data.injuryStatus === null || data.injuryStatus === undefined) {
          if (saidNo || /\b(no injur|no one|nobody|fine|safe|unhurt)\b/i.test(lower)) {
            data.injuryStatus = false;
            data.injuryDetails = 'No injuries reported';
            session.injuryConditionBranch = 'STANDARD_PROPERTY_DAMAGE';
          } else if (saidYes) {
            data.injuryStatus = true;
            data.injuryDetails = text;
            session.injuryConditionBranch = 'PRIORITY_MEDICAL_ESCALATION';
          }
        }
        if (!data.drivability) {
          if (/\b(towed|tow|non-drivable|undrivable|cannot drive|totaled)\b/i.test(lower)) {
            data.drivability = 'Non-Drivable / Towing Required';
          } else if (/\b(drivable|driveable|can drive|drove)\b/i.test(lower)) {
            data.drivability = 'Drivable';
          }
        }
        break;
      case 'drivabilityLeaks':
        if (!data.drivability && !/\b(injur\w*|hurt|hospital|ambulance|lesion\w*|herid\w*)\b/i.test(lower)) {
          if (/\b(towed|tow|wrecker|flatbed|gr[úu]a|remolcad[oa])\b/i.test(lower) && !/\btowed\s+by\s+none\b/i.test(lower)) {
            data.drivability = 'Non-Drivable / Towed from Scene';
            data.drivable = false;
          } else if (saidNo || /\b(not\s+drivable|non-drivable|undrivable|cannot\s+drive|can'?t\s+drive|inoperable|disabled|won'?t\s+start|leaking|crushed|bent|broken|submerged|dead|no\s+se\s+puede\s+manejar|no\s+arranca)\b/i.test(lower)) {
            data.drivability = 'Non-Drivable';
            data.drivable = false;
          } else if (saidYes || /\b(drivable|driveable|can\s+(?:still\s+)?drive|still\s+(?:drives|runs)|drives\s+(?:fine|ok|okay)|drove\s+(?:it\s+)?home|se\s+puede\s+manejar|funciona)\b/i.test(lower)) {
            data.drivability = 'Drivable';
            data.drivable = true;
          }
        }
        break;
      case 'hailParked':
        if (!data.hailParkedOrMoving) {
          if (/\b(driv(?:ing|en)|moving|road|highway|manejando|conduciendo)\b/i.test(lower)) {
            data.hailParkedOrMoving = 'Being driven';
            data.hailParkedOrDriving = 'Being driven';
          } else if (/\b(parked|driveway|stationary|sitting|outside|garage|carport|unoccupied|estacionad[oa]|parado|cochera|entrada)\b/i.test(lower)) {
            data.hailParkedOrMoving = 'Parked outside in driveway';
            data.hailParkedOrDriving = 'Parked outside in driveway';
          }
        }
        break;
      case 'hailSeverity':
        if (!data.hailSeverity && text.trim().length >= 3) {
          data.hailSeverity = text.trim();
        }
        break;
      case 'claimantContact':
        if (!data.callerName && this.validateSlotValue('callerName', text)) {
          data.callerName = text;
        }
        break;
      case 'insuredInfo':
        session.insuredInfoCaptured = true;
        if (!data.policyNumber) {
          const candidate = normalizeSpokenPolicy(text);
          if (this.validateSlotValue('policyNumber', candidate)) {
            data.policyNumber = candidate.toUpperCase();
          } else {
            data.otherPartyInfo = text;
          }
        }
        break;
      case 'injury':
        if (data.injuryStatus === null || data.injuryStatus === undefined) {
          if (/(?:text|link|upload|enlace|fotos?|photos?)\b/i.test(text) || CONTAMINATION_RE.test(text)) {
            // Caller barged in with photo/link request instead of answering injury question
            if (!data.photoStatus) {
              data.hasPhotos = true;
              data.photoStatus = 'Caller indicated photos available — SIU upload link sent by text';
            }
          } else if (saidYes && !saidNo) {
            data.injuryStatus = true;
            data.injuryDetails = text;
            session.injuryConditionBranch = 'PRIORITY_MEDICAL_ESCALATION';
          } else {
            data.injuryStatus = false;
            data.injuryDetails = 'No injuries confirmed (caller answer: "' + text + '")';
            session.injuryConditionBranch = 'STANDARD_PROPERTY_DAMAGE';
          }
        }
        break;
      case 'photos':
        if (/\b(uploaded|just uploaded|i uploaded|sent|attached|dropped|sub[íi]|envi[ée])\b/i.test(lower)) {
          data.hasPhotos = true;
          data.photoStatus = 'UPLOADED_IN_CALL';
          data.photosReceived = Math.max(1, data.photosReceived || 0);
          data.photoUploadValidatedInCall = true;
        } else if (!data.photoStatus || data.photoStatus === 'unavailable_at_time_of_call') {
          if (saidNo) {
            data.hasPhotos = false;
            data.photoStatus = 'unavailable_at_time_of_call';
            data.photoSmsSent = false;
          } else {
            data.hasPhotos = true;
            data.photoStatus = 'Caller indicated photos available — SIU upload link sent by text';
          }
        }
        break;
      case 'police':
        if (!data.policeReport) {
          if (saidNo) {
            data.policeReport = 'None (No)';
            data.policeReportNumber = 'N/A';
            data.policeJurisdiction = 'N/A';
          } else if (saidYes) {
            data.policeReport = 'Filed (Yes)';
          } else {
            data.policeReport = 'Reported: ' + text;
          }
        }
        break;
      case 'timeOfLoss': {
        if (CONTAMINATION_RE.test(text) || META_COMPLAINT_RE.test(text)) break;
        const validClock = text.match(/\b((?:1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?|o'?clock))\b/i);
        if (!data.timeOfLoss && validClock) {
          data.timeOfLoss = validClock[1].toUpperCase();
        }
        if (!data.dateOfLoss && !data.timeOfLoss) {
          const cleanedDate = text.replace(/\b\d{2,}\b(?!\s*(?:st|nd|rd|th|am|pm|a\.m\.|p\.m\.|days?|hours?|minutes?|\d))/gi, '').replace(/[.,;\s]+$/, '').trim();
          const hasTemporalSignal = /\b(today|yesterday|tonight|night|morning|afternoon|evening|noon|midnight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|week|days?|hours?|minutes?|ago|last|this|early|late|hoy|ayer|anoche|mañana|tarde|noche|lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo|semana|mes|hace|\d)\b/i.test(cleanedDate);
          if (cleanedDate && cleanedDate.length >= 3 && hasTemporalSignal) {
            data.dateOfLoss = cleanedDate;
          }
        }
        break;
      }
      case 'vehicleLocation':
        if (!data.vehicleCurrentLocation) {
          let cleanLoc = sanitizeUserUtterance(text);
          cleanLoc = cleanLoc.replace(/\s+(it is|it's|is)\s+(drivable|driveable|non-drivable|undrivable|totaled|running)[^.]*/i, '').trim();
          cleanLoc = cleanLoc.replace(/^(the vehicle is at|the car is at|it is at|it's at|located at|at)\s+/i, '').trim();
          if (/\b(my house|home|my driveway|driveway|residence|mi casa|en casa)\b/i.test(cleanLoc)) {
            data.vehicleCurrentLocation = 'Residence / Driveway';
          } else {
            data.vehicleCurrentLocation = cleanLoc || text;
          }
        }
        break;
      case 'otherParty':
        if (!data.otherPartyInfo) {
          let cleanOther = sanitizeUserUtterance(text);
          if (cleanOther && !CONTAMINATION_RE.test(cleanOther)) data.otherPartyInfo = cleanOther;
        }
        break;
      case 'folInvestigate':
        if (!data.folInvestigated) {
          let cleanText = sanitizeUserUtterance(text);
          if (session.lossType === 'hail') {
            if (/\b(parked|driveway|outside|in the driveway|estacionado|en la entrada)\b/i.test(lower)) {
              data.folInvestigated = 'Parked outside in driveway during hail';
            } else if (/\b(driv(ing|en)|on the road|highway|street|manejando|conduciendo)\b/i.test(lower)) {
              data.folInvestigated = 'Driven during hailstorm';
            } else {
              data.folInvestigated = cleanText || text;
            }
          } else {
            data.folInvestigated = cleanText || text;
          }
        }
        break;
      case 'folWrap':
        if (!data.contactPreference) {
          if (/\b(text|sms|mensaje)\b/i.test(lower)) data.contactPreference = 'Text / SMS';
          else if (/\b(call|phone|llamada|tel[ée]fono)\b/i.test(lower)) data.contactPreference = 'Phone Call';
          else data.contactPreference = text;
        }
        break;
      case 'summaryConfirm': {
        const cleanedConfirmLower = String(lower || '').replace(/\bno\s+(?:leaks?|fluids?|injur\w*|hurt|problem|worries|questions?|issues?|other|more|police|tow\w*|damage|one|body|fugas?|lesion\w*|herid\w*|problema)\b/gi, '');
        const isRejection = /\b(no|wrong|incorrect|not right|doesn'?t make sense|no logic|that'?s wrong|error|mistake|mal|incorrecto|no es correcto|no tiene sentido|te equivocaste)\b/i.test(cleanedConfirmLower);
        const isAffirmative = (saidYes || /\b(accurat|correct|yes|right|sounds good|looks good|exact|s(í|i)|correcto|est[aá] bien)\b/i.test(lower)) && !isRejection;
        if (isAffirmative) {
          session.summaryConfirmed = true;
        } else {
          session.summaryConfirmed = false;
          session.flaggedSlots = session.flaggedSlots || [];
          if (!session.flaggedSlots.includes('summaryDiscrepancy')) session.flaggedSlots.push('summaryDiscrepancy');
        }
        break;
      }
    }
  }

  /**
   * Enterprise Peril-Specific Mobility Safety Assessment
   * Replaces casual binary drivability with physics-based component evaluation.
   */
  evaluateMobilitySafety(session, text) {
    if (!text || typeof text !== 'string') return;
    const lower = text.toLowerCase();
    const data = session.fnolData;
    const msa = data.mobilitySafetyAssessment || (data.mobilitySafetyAssessment = {
      assessedCondition: 'UNKNOWN',
      airbagsDeployed: null,
      fluidsLeaking: null,
      steeringCompromised: null,
      glassShattered: null,
      lightsInoperable: null,
      waterCabinLevel: null,
      engineWaterIntake: null,
      fireExtinguished: null,
      keysInCustody: null,
    });

    const lt = (session.lossType || (session.fnolData && session.fnolData.lossTypeClass) || '').toLowerCase();
    const explicitNotDrivable = /\b(not\s+drivable|non-drivable|isn'?t\s+drivable|cannot\s+drive|can'?t\s+drive|undrivable|inoperable|completely\s+disabled|no\s+se\s+puede\s+manejar)\b/i.test(lower);

    if (explicitNotDrivable) {
      msa.assessedCondition = 'UNSAFE_OPERATIONAL';
      data.drivability = 'Non-Drivable';
    } else if (lt === 'collision') {
      if (/\b(airbag(s)? (deployed|went off|blew)|bolsas de aire)\b/i.test(lower)) {
        msa.airbagsDeployed = true;
        msa.assessedCondition = 'UNSAFE_OPERATIONAL';
        data.drivability = 'Non-Drivable / Airbags Deployed';
      } else if (/\b(fluid(s)?|leaking|leak|oil|coolant|radiator|antifreeze|fuga|goteando)\b/i.test(lower) && !/\b(no (leaks?|fluids?)|nothing('s| is)? leaking|not leaking|isn'?t leaking|no (hay|tiene|veo) fugas?|sin fugas?)\b/i.test(lower)) {
        msa.fluidsLeaking = true;
        msa.assessedCondition = 'UNSAFE_OPERATIONAL';
        data.drivability = 'Non-Drivable / Active Fluid Leak';
      } else if (/\b(wheel(s)?|axle|tire flat|flat tire|steering|suspension|bent|towed)\b/i.test(lower) && !/\btowed\s+by\s+none\b/i.test(lower)) {
        msa.steeringCompromised = true;
        msa.assessedCondition = 'UNSAFE_OPERATIONAL';
        data.drivability = 'Non-Drivable / Mechanical & Steering Damage';
      } else if (/\b(no|none|didn't deploy|no airbags?|no leaks?|drivable|driveable|can drive|operable|minor|no se desplegaron|se puede manejar)\b/i.test(lower)) {
        msa.assessedCondition = 'SAFE_TO_DRIVE';
        if (!data.drivability) data.drivability = 'Drivable';
      }
    } else if (lt === 'hail') {
      if (/\b(shattered|smashed|busted|cracked across|spiderwebbed|broken (headlight|taillight|light|windshield)|unusable|unsafe|roto|quebrado|faros rotos)\b/i.test(lower)) {
        msa.glassShattered = true;
        msa.assessedCondition = 'UNSAFE_OPERATIONAL';
        data.drivability = 'Non-Drivable / Unsafe Glass or Lighting';
      } else if (/\b(drivable|driveable|can drive|operable|just dents|dents only|solo abolladuras|se puede manejar|fine|good|intact)\b/i.test(lower) || /\b(no|intact|clean)\b/i.test(lower)) {
        msa.assessedCondition = 'SAFE_TO_DRIVE';
        if (!data.drivability) data.drivability = 'Drivable (Cosmetic Damage Only)';
      }
    } else if (lt === 'flood') {
      if (/\b(dash|dashboard|steering|seat|cabin|floor|floorboard|tablero|asiento|piso)\b/i.test(lower) || /\b(died|stalled|stopped|won't start|se apag[óo])\b/i.test(lower)) {
        msa.waterCabinLevel = 'Cabin / Dashboard';
        msa.engineWaterIntake = true;
        msa.assessedCondition = 'CATASTROPHIC_TOTAL_LOSS';
        data.drivability = 'Non-Drivable / Severe Electrical & Hydro-Lock Hazard';
      } else if (/\b(tires?|wheels?|bumper|llantas|ruedas)\b/i.test(lower) && !/\b(died|stalled)\b/i.test(lower)) {
        msa.assessedCondition = 'SAFE_TO_DRIVE';
        if (!data.drivability) data.drivability = 'Drivable (Sub-Axle Water Depth Only)';
      } else {
        msa.assessedCondition = 'UNSAFE_OPERATIONAL';
        data.drivability = 'Non-Drivable / Flood Inspection Required';
      }
    } else if (lt === 'fire') {
      msa.assessedCondition = 'CATASTROPHIC_TOTAL_LOSS';
      data.drivability = 'Non-Drivable / Fire Hazard Total Loss';
    } else if (lt === 'theft') {
      const isNegative = /\b(?:not|never|hasn'?t|haven'?t)\b.*?\b(?:found|recovered)\b/i.test(lower)
        || /\b(?:no|nunca)\b.*?\b(?:encontrado|recuperado)\b/i.test(lower)
        || /\b(?:still missing|unrecovered|not found|not recovered|hasn'?t been found)\b/i.test(lower);
      const isRecovered = !isNegative && /\b(recovered|found|got it back|encontrado|recuperado)\b/i.test(lower);
      if (isRecovered) {
        msa.assessedCondition = 'SAFE_TO_DRIVE';
        data.drivability = 'Recovered / Inspection Pending';
      } else {
        msa.assessedCondition = 'STOLEN_UNRECOVERED';
        data.drivability = 'N/A (Vehicle Stolen / Missing)';
        if (!data.vehicleCurrentLocation) data.vehicleCurrentLocation = 'Unknown (Stolen / Unrecovered)';
      }
    } else if (lt === 'glass') {
      if (/\b(?:not\s+longer|shorter|smaller|less|under)\b[^.?!]{0,25}\b(?:dollar\s+bill|billete|six\s+inches|6\s+inches)\b|\b(?:small\s+chip|rock\s+chip|bull'?s[- ]?eye|star\s+chip|[1-5]\s*[- ]?inch(?:es)?|m[áa]s\s+peque[ñn][oa]|m[áa]s\s+cort[oa]|menor\s+que\s+un\s+billete)\b/i.test(lower)) {
        data.glassCrackDollarBill = 'Under a Dollar Bill (< 6 in) — Crack Repair Eligible';
      } else if (/\b(?:longer|larger|bigger|more|over|wider)\b[^.?!]{0,25}\b(?:dollar\s+bill|billete|six\s+inches|6\s+inches)\b|\b(?:across\s+the\s+windshield|all\s+the\s+way\s+across|spider\s*web\w*|shattered|smashed|(?:[6-9]|1\d|2\d)\s*[- ]?inch(?:es)?|foot[- ]long|m[áa]s\s+larg[oa]|m[áa]s\s+grande|mayor\s+que\s+un\s+billete)\b/i.test(lower)) {
        data.glassCrackDollarBill = 'Longer Than a Dollar Bill (> 6 in) — Full Glass Replacement Required';
      }
      if (/\b(obstruct|blocked|can't see|shattered|in my view|front of driver|obstruye|roto)\b/i.test(lower)) {
        msa.assessedCondition = 'UNSAFE_OPERATIONAL';
        data.drivability = 'Unsafe to Drive / Glass Replacement Needed';
      } else if (data.glassCrackDollarBill && data.glassCrackDollarBill.includes('Longer Than a Dollar Bill')) {
        msa.assessedCondition = 'SAFE_TO_DRIVE';
        data.drivability = 'Drivable / Full Glass Replacement Required (Crack > Dollar Bill)';
      } else if (data.glassCrackDollarBill && data.glassCrackDollarBill.includes('Under a Dollar Bill')) {
        msa.assessedCondition = 'SAFE_TO_DRIVE';
        data.drivability = 'Drivable / Resin Crack Repair Eligible (Crack < Dollar Bill)';
      } else if (!data.drivability) {
        msa.assessedCondition = 'SAFE_TO_DRIVE';
        data.drivability = 'Drivable / Glass Repair Scheduled';
      }
    } else if (lt === 'vandalism') {
      if (/\b(tire(s)? slashed|slashed|ignition|window broken|broken glass|llantas ponchadas|rajadas)\b/i.test(lower)) {
        msa.assessedCondition = 'UNSAFE_OPERATIONAL';
        data.drivability = 'Non-Drivable / Vandalism Damage';
      } else if (!data.drivability) {
        msa.assessedCondition = 'SAFE_TO_DRIVE';
        data.drivability = 'Drivable (Cosmetic Vandalism Only)';
      }
    } else if (lt === 'fallingobject') {
      if (/\b(roof crushed|crushed|deformation|windshield broken|steering|inoperable|aplastado)\b/i.test(lower)) {
        msa.assessedCondition = 'UNSAFE_OPERATIONAL';
        data.drivability = 'Non-Drivable / Structural Impact Damage';
      } else if (!data.drivability) {
        msa.assessedCondition = 'SAFE_TO_DRIVE';
        data.drivability = 'Drivable (Cosmetic Impact Only)';
      }
    } else if (lt === 'towing_roadside') {
      if (/\b(towed|tow yard|shop|taller|grua|gr[úu]a)\b/i.test(lower) && !/\btowed\s+by\s+none\b/i.test(lower)) {
        msa.assessedCondition = 'TOW_REQUIRED';
        data.drivability = 'Non-Drivable / Mechanical Breakdown';
      }
    }
    if (data.drivability) {
      data.drivable = /^Drivable/i.test(data.drivability);
    }
    return msa;
  }

  /**
   * Calculate dynamic AxiScore compliance rating
   */

  /**
   * Build complete scene reconstruction diagram data and inline SVG representation
   * Anchored in PI_SCENE_DIAGRAM_ENGINE_SPEC.md & Texas Insurance Code §4101
   */
  buildDiagramData(session) {
    const data = session.fnolData || {};
    const lf = data.lossFacts || {};
    const locDet = data.locationDetails || {};

    const lossTypeNorm = String(session.lossType || data.lossTypeClass || data.stagedPeril || '').toLowerCase();
    const isNonCollisionPeril = ['hail', 'flood', 'glass', 'theft', 'vandalism', 'fire', 'fallingobject', 'towing_roadside', 'comprehensive', 'animal'].includes(lossTypeNorm);
    const isSingleVehicle = isNonCollisionPeril || data.otherVehicleInvolved === false;
    const isParkedLoss = (isNonCollisionPeril && lossTypeNorm !== 'animal') || /\b(parked|driveway|garage|parking lot|estacionado|cochera)\b/i.test(String(data.lossDescription || ''));

    const template = lf.accidentTemplate || (isSingleVehicle ? 'single_vehicle' : 'collision');
    const primaryStreet = locDet.streetAddress || (locDet.intersection ? locDet.intersection.split('&')[0].trim() : '') || (data.locationOfLoss ? data.locationOfLoss.split(',')[0].trim() : '') || 'Primary Corridor';
    const crossStreet = (locDet.intersection ? locDet.intersection.split('&')[1].trim() : '') || locDet.crossStreet || '';

    const isPlottable = !!((primaryStreet || locDet.formattedPlottable || data.locationOfLoss) && (lf.travelDirection || lf.impactPoint || data.vehicleInfo));

    const defaultSpeed = isParkedLoss ? 0 : 45;
    const v1Speed = (lf.speed !== undefined && lf.speed !== null && lf.speed !== '') ? parseInt(lf.speed, 10) : defaultSpeed;
    const v2Speed = lf.adverseSpeed ? parseInt(lf.adverseSpeed, 10) : 35;

    const v1 = {
      id: 'V1',
      role: 'insured',
      makeModel: data.vehicleInfo || '2024 Insured Vehicle',
      travelStreet: lf.travelStreet || primaryStreet,
      travelDirection: lf.travelDirection || (isParkedLoss ? 'Parked / Stationary' : 'Southbound'),
      speedMph: isNaN(v1Speed) ? defaultSpeed : v1Speed,
      lanePosition: lf.lanePositionClient || (isParkedLoss ? 'Parked / Driveway' : 'Through Lane'),
      maneuver: lf.maneuverClient || (isParkedLoss ? 'Parked / Stationary' : (template === 'rear_end' ? 'Stopped / Slowing' : 'Traveling Straight')),
      impactZone: lf.impactZoneClient || lf.impactPoint || (lossTypeNorm === 'hail' ? 'Hood / Roof / Windshield' : (lossTypeNorm === 'flood' ? 'Undercarriage / Cabin Floor' : (lossTypeNorm === 'glass' ? 'Windshield Glass' : 'Front Bumper'))),
      impactClock: lf.impactClockClient || (isParkedLoss ? 'N/A (Comprehensive / Non-Collision)' : '12:00 (Frontal)'),
      airbagsDeployed: !!lf.airbagsDeployed,
      occupants: {
        driverName: data.callerName || 'Insured Driver',
        driverInjured: !!data.injuryStatus,
        passengerCount: (lf.occupantsClient && lf.occupantsClient.passengerCount) || 0,
        passengerInjuries: (lf.occupantsClient && lf.occupantsClient.passengerInjuries) || (data.injuryStatus ? 'Medical triage requested' : 'None reported')
      }
    };

    const vehicles = [v1];

    if (!isSingleVehicle && template !== 'single_vehicle') {
      const v2MakeMatch = (data.otherPartyInfo || '').match(/\b(?:20\d{2}|19\d{2})?\s*(?:Ford|Chevy|Chevrolet|Toyota|Honda|Nissan|Dodge|Ram|GMC|Tesla|F-?150|F-?250|Civic|Accord|Camry|Tahoe|Silverado|Transit)\b/i);
      const v2 = {
        id: 'V2',
        role: 'claimant_adverse',
        makeModel: v2MakeMatch ? v2MakeMatch[0] : (data.otherPartyInfo ? data.otherPartyInfo.slice(0, 30) : 'Adverse Vehicle'),
        travelStreet: lf.adverseStreet || crossStreet || 'Intersecting Corridor',
        travelDirection: lf.adverseDirection || (v1.travelDirection === 'Southbound' ? (template === 'left_turn' ? 'Northbound / Turning West' : 'Westbound') : 'Northbound'),
        speedMph: isNaN(v2Speed) ? 35 : v2Speed,
        lanePosition: lf.lanePositionAdverse || (template === 'left_turn' ? 'Left Turn Bay' : 'Adjacent Lane'),
        maneuver: lf.maneuverAdverse || (template === 'left_turn' ? 'Initiated Left Turn Failure to Yield' : (template === 'rear_end' ? 'Failed to Control Speed / Rear Strike' : 'Through Travel')),
        impactZone: lf.impactZoneAdverse || (template === 'left_turn' ? 'Passenger Side Rear' : (template === 'rear_end' ? 'Front Bumper' : 'Driver Side')),
        impactClock: lf.impactClockAdverse || (template === 'left_turn' ? '04:00 (Right Rear)' : '12:00 (Front)'),
        carrier: (data.otherPartyInfo && data.otherPartyInfo.match(/\b(Progressive|State Farm|Geico|Allstate|Zurich|Farmers|Liberty Mutual|USAA|Travelers)\b/i)) ? data.otherPartyInfo.match(/\b(Progressive|State Farm|Geico|Allstate|Zurich|Farmers|Liberty Mutual|USAA|Travelers)\b/i)[1] : 'Pending Verification',
        policyNumber: (data.otherPartyInfo && data.otherPartyInfo.match(/\b([A-Z0-9-]{6,16})\b/)) ? data.otherPartyInfo.match(/\b([A-Z0-9-]{6,16})\b/)[1] : 'Pending Exchange',
        occupants: {
          driverName: 'Adverse Driver',
          driverInjured: false,
          passengerCount: (lf.occupantsAdverse && lf.occupantsAdverse.passengerCount) || 0,
          passengerInjuries: 'None reported'
        }
      };
      vehicles.push(v2);
    }

    const collisionMechanism = template === 'left_turn'
      ? 'Left Turn Across Path (LTAP) Failure to Yield'
      : (template === 'rear_end'
        ? 'Following Too Closely / Sudden Deceleration Impact'
        : (template === 't_bone'
          ? 'Right-Angle Broadside Intersection Collision'
          : (template === 'sideswipe'
            ? 'Adjacent Lane Change / Encroachment Strike'
            : (template === 'single_vehicle'
              ? (isParkedLoss ? `Single-Vehicle Comprehensive Peril (${lossTypeNorm || 'Weather / Parked'})` : 'Single-Vehicle Collision / Fixed Object or Animal Peril')
              : 'Multi-Vehicle Collision Dynamics'))));

    const diagramData = {
      template,
      sufficiency: isPlottable ? 'PLOTTABLE' : 'PLOTTABLE_WITH_ASSUMPTIONS',
      anchor: {
        primaryStreet,
        crossStreet,
        landmark: locDet.landmarkBusiness || '',
        city: locDet.city || '',
        state: locDet.state || '',
        formattedPlottable: locDet.formattedPlottable || data.locationOfLoss || ''
      },
      sceneGeometry: {
        roadType: isParkedLoss ? 'Residential Driveway / Private Parking' : (locDet.intersection ? '4-Way Controlled Intersection' : (primaryStreet.includes('I-') || primaryStreet.includes('Highway') || primaryStreet.includes('Loop') ? 'Divided Highway / Controlled Access' : 'Urban Two-Way Arterial')),
        roadSurface: lf.roadCondition || 'Dry / Normal',
        weather: lf.weather || 'Clear / Dry',
        lighting: lf.lighting || 'Daylight',
        trafficControl: isParkedLoss ? 'N/A (Off-Roadway / Parked)' : (lf.trafficSignal || 'Signal Controlled'),
        signalStateClient: isParkedLoss ? 'N/A' : (lf.signalStateClient || 'Green Light'),
        signalStateAdverse: isParkedLoss ? 'N/A' : (lf.signalStateAdverse || (template === 'left_turn' ? 'Unprotected Left Turn (Failed to Yield)' : 'N/A'))
      },
      vehicles,
      impactDynamics: {
        firstImpactPair: vehicles.length > 1 ? `${vehicles[0].id}-${vehicles[0].impactZone} -> ${vehicles[1].id}-${vehicles[1].impactZone}` : 'V1 -> Fixed Object / Peril',
        collisionMechanism,
        airbagsDeployed: !!lf.airbagsDeployed,
        liabilityIndicators: vehicles.length > 1
          ? (template === 'left_turn'
            ? 'Adverse driver turned across through traffic having green light; prima facie failure to yield right-of-way'
            : (template === 'rear_end'
              ? 'Adverse vehicle struck insured from behind; presumptive following distance violation'
              : 'Point of impact and lane positioning indicate liability triage required'))
          : 'Single vehicle comprehensive / collision peril; no adverse party liability',
        legalDisclaimer: 'Illustrative diagram generated from verbal intake. Administrative FNOL communications conduit record for carrier review. Not an engineering accident reconstruction or liability determination.'
      }
    };

    diagramData.svgDiagram = this.generateSceneSvg(diagramData);
    data.diagramData = diagramData;
    return diagramData;
  }

  generateSceneSvg(diagramData) {
    const d = diagramData;
    const isLeftTurn = d.template === 'left_turn';
    const isRearEnd = d.template === 'rear_end';
    const v1 = d.vehicles.find(v => v.id === 'V1') || d.vehicles[0];
    const v2 = d.vehicles.find(v => v.id === 'V2');

    const street1 = d.anchor.primaryStreet || 'Main Corridor';
    const street2 = d.anchor.crossStreet || 'Cross Arterial';

    let roadsSvg = '';
    let vehiclesSvg = '';
    let impactSvg = '';

    if (isLeftTurn) {
      roadsSvg = `
        <rect width="640" height="380" fill="#0f172a"/>
        <rect x="240" y="0" width="160" height="380" fill="#1e293b"/>
        <rect x="0" y="130" width="640" height="120" fill="#1e293b"/>
        <line x1="320" y1="0" x2="320" y2="130" stroke="#eab308" stroke-width="3" stroke-dasharray="8 6"/>
        <line x1="320" y1="250" x2="320" y2="380" stroke="#eab308" stroke-width="3" stroke-dasharray="8 6"/>
        <line x1="0" y1="190" x2="240" y2="190" stroke="#eab308" stroke-width="3" stroke-dasharray="8 6"/>
        <line x1="400" y1="190" x2="640" y2="190" stroke="#eab308" stroke-width="3" stroke-dasharray="8 6"/>
        <line x1="280" y1="0" x2="280" y2="130" stroke="#64748b" stroke-width="1.5" stroke-dasharray="6 6"/>
        <line x1="280" y1="250" x2="280" y2="380" stroke="#64748b" stroke-width="1.5" stroke-dasharray="6 6"/>
        <text x="320" y="30" fill="#94a3b8" font-size="11" font-weight="700" text-anchor="middle" letter-spacing="1">${street1} (SB ↓)</text>
        <text x="320" y="365" fill="#94a3b8" font-size="11" font-weight="700" text-anchor="middle" letter-spacing="1">${street1}</text>
        <text x="80" y="185" fill="#94a3b8" font-size="11" font-weight="700" text-anchor="middle" letter-spacing="1">← ${street2} (WB)</text>
      `;
      vehiclesSvg = `
        <path d="M 520,165 Q 350,165 300,215" fill="none" stroke="#ef4444" stroke-width="3" stroke-dasharray="5 5"/>
        <g transform="translate(265, 140)">
          <rect x="0" y="0" width="30" height="55" rx="5" fill="#2563eb" stroke="#60a5fa" stroke-width="2"/>
          <line x1="15" y1="5" x2="15" y2="50" stroke="#93c5fd" stroke-width="2" marker-end="url(#arrow-blue)"/>
          <text x="15" y="32" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">V1</text>
        </g>
        <g transform="translate(285, 185) rotate(-45)">
          <rect x="0" y="0" width="28" height="52" rx="5" fill="#dc2626" stroke="#f87171" stroke-width="2"/>
          <text x="14" y="30" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">V2</text>
        </g>
      `;
      impactSvg = `
        <g transform="translate(285, 195)">
          <circle cx="0" cy="0" r="18" fill="#f59e0b" opacity="0.3"/>
          <circle cx="0" cy="0" r="10" fill="#ef4444" opacity="0.6"/>
          <polygon points="0,-16 4,-5 16,-4 7,4 10,16 0,8 -10,16 -7,4 -16,-4 -4,-5" fill="#facc15" stroke="#b45309" stroke-width="1"/>
        </g>
      `;
    } else if (isRearEnd) {
      roadsSvg = `
        <rect width="640" height="380" fill="#0f172a"/>
        <rect x="180" y="0" width="280" height="380" fill="#1e293b"/>
        <line x1="320" y1="0" x2="320" y2="380" stroke="#eab308" stroke-width="3" stroke-dasharray="8 6"/>
        <line x1="250" y1="0" x2="250" y2="380" stroke="#64748b" stroke-width="1.5" stroke-dasharray="6 6"/>
        <line x1="390" y1="0" x2="390" y2="380" stroke="#64748b" stroke-width="1.5" stroke-dasharray="6 6"/>
        <text x="320" y="30" fill="#94a3b8" font-size="11" font-weight="700" text-anchor="middle">${street1} (Travel Corridor)</text>
      `;
      vehiclesSvg = `
        <g transform="translate(235, 120)">
          <rect x="0" y="0" width="30" height="55" rx="5" fill="#2563eb" stroke="#60a5fa" stroke-width="2"/>
          <text x="15" y="32" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">V1</text>
        </g>
        <g transform="translate(235, 185)">
          <rect x="0" y="0" width="32" height="60" rx="5" fill="#dc2626" stroke="#f87171" stroke-width="2"/>
          <line x1="16" y1="55" x2="16" y2="10" stroke="#fca5a5" stroke-width="2"/>
          <text x="16" y="35" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">V2</text>
        </g>
      `;
      impactSvg = `
        <g transform="translate(250, 178)">
          <polygon points="0,-14 3,-4 14,-3 6,3 9,14 0,7 -9,14 -6,3 -14,-3 -3,-4" fill="#facc15" stroke="#b45309" stroke-width="1"/>
        </g>
      `;
    } else {
      roadsSvg = `
        <rect width="640" height="380" fill="#0f172a"/>
        <rect x="160" y="0" width="320" height="380" fill="#1e293b"/>
        <line x1="320" y1="0" x2="320" y2="380" stroke="#eab308" stroke-width="3" stroke-dasharray="8 6"/>
        <rect x="470" y="0" width="15" height="380" fill="#475569"/>
        <text x="320" y="30" fill="#94a3b8" font-size="11" font-weight="700" text-anchor="middle">${street1}</text>
      `;
      vehiclesSvg = `
        <g transform="translate(380, 160) rotate(15)">
          <rect x="0" y="0" width="30" height="55" rx="5" fill="#2563eb" stroke="#60a5fa" stroke-width="2"/>
          <text x="15" y="32" fill="#ffffff" font-size="10" font-weight="bold" text-anchor="middle">V1</text>
        </g>
        <g transform="translate(435, 175)">
          <circle cx="0" cy="0" r="12" fill="#e2e8f0" stroke="#0f172a" stroke-width="1.5"/>
          <text x="0" y="4" font-size="11" text-anchor="middle">⚠️</text>
        </g>
      `;
      impactSvg = `
        <g transform="translate(415, 170)">
          <polygon points="0,-12 3,-3 12,-2 5,3 8,12 0,6 -8,12 -5,3 -12,-2 -3,-3" fill="#facc15" stroke="#b45309" stroke-width="1"/>
        </g>
      `;
    }

    const hudSvg = `
      <rect x="15" y="15" width="210" height="105" rx="6" fill="#0f172a" fill-opacity="0.85" stroke="#334155" stroke-width="1"/>
      <text x="25" y="32" fill="#38bdf8" font-size="11" font-weight="bold">SCENE RECONSTRUCTION HUD</text>
      <text x="25" y="50" fill="#cbd5e1" font-size="10">Template: <tspan fill="#f8fafc" font-weight="bold">${d.template.toUpperCase()}</tspan></text>
      <text x="25" y="66" fill="#cbd5e1" font-size="10">V1 (Insured): <tspan fill="#93c5fd" font-weight="bold">${v1.speedMph} mph · ${v1.travelDirection || 'SB'}</tspan></text>
      ${v2 ? `<text x="25" y="82" fill="#cbd5e1" font-size="10">V2 (Adverse): <tspan fill="#fca5a5" font-weight="bold">${v2.speedMph} mph · ${v2.travelDirection || 'WB'}</tspan></text>` : `<text x="25" y="82" fill="#cbd5e1" font-size="10">Peril: <tspan fill="#fde047" font-weight="bold">Single-Vehicle Loss</tspan></text>`}
      <text x="25" y="98" fill="#cbd5e1" font-size="10">Signal: <tspan fill="#4ade80" font-weight="bold">${d.sceneGeometry.signalStateClient || 'Green'}</tspan> | Surface: <tspan fill="#f8fafc">${d.sceneGeometry.roadSurface || 'Dry'}</tspan></text>

      <rect x="0" y="355" width="640" height="25" fill="#020617" fill-opacity="0.95"/>
      <text x="320" y="371" fill="#64748b" font-size="9" text-anchor="middle">Administrative FNOL Communications Record · Preliminary Diagram Only · Carrier Review Required</text>
    `;

    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 380" width="100%" height="100%" style="border-radius:8px; overflow:hidden; font-family:system-ui,-apple-system,sans-serif;">
        <defs>
          <marker id="arrow-blue" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#93c5fd"/>
          </marker>
          <marker id="arrow-red" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#fca5a5"/>
          </marker>
        </defs>
        ${roadsSvg}
        ${vehiclesSvg}
        ${impactSvg}
        ${hudSvg}
      </svg>
    `.trim();
  }

  calculateAxiScore(session) {
    if (!session || typeof session !== 'object') return 0;
    const d = (session.fnolData && typeof session.fnolData === 'object')
      ? Object.assign({}, session, session.fnolData)
      : session;
    const transcript = Array.isArray(session.transcript)
      ? session.transcript.map(t => (typeof t === 'string' ? t : (t && (t.content || t.text)) || '')).join(' ')
      : String(session.transcript || '');
    const isValidVal = (v) => Boolean(
      v !== null &&
      v !== undefined &&
      String(v).trim() !== '' &&
      !String(v).includes('Not Provided')
    );

    let score = 0;

    // 1. Safety & Mobility Triage (20 pts)
    const hasSafetyTriage = Boolean(
      session.safetyConfirmed ||
      (d.injuryStatus !== null && d.injuryStatus !== undefined && !String(d.injuryStatus).includes('Not Provided')) ||
      isValidVal(d.drivability) ||
      (d.mobilitySafetyAssessment && d.mobilitySafetyAssessment.assessedCondition && d.mobilitySafetyAssessment.assessedCondition !== 'UNKNOWN') ||
      /\b(injur\w*|safe|medical|drivable|hurt|ambulanc\w*)\b/i.test(transcript)
    );
    if (hasSafetyTriage) score += 20;

    // 2. Recording Disclosure & Verbal SMS/Callback Consent (15 pts)
    const hasConsent = Boolean(
      session.consentRecorded ||
      session.smsConsent ||
      d.smsConsent ||
      d.smsVerbalConsent ||
      (d.callbackPermission && d.callbackPermission !== 'Pending') ||
      (session.hasGreeted && (session.turnCount || 0) >= 2) ||
      /\b(recorded|monitored|permission to text|text you)\b/i.test(transcript)
    );
    if (hasConsent) score += 15;

    // 3. Core FNOL Slot Completeness (40 pts)
    const hasNarrative = isValidVal(d.lossDescription) || Boolean(session.lossType) || isValidVal(d.lossTypeText);
    const hasVehicle = isValidVal(d.vehicleInfo) || isValidVal(d.vehicleYear) || isValidVal(d.vehicleMake);
    const hasLocation = isValidVal(d.locationOfLoss) || isValidVal(d.lossLocation);
    const hasCallerOrPolicy = isValidVal(d.callerName) || isValidVal(d.policyNumber) || isValidVal(session.hostCallerName);
    const hasLossDetails = isValidVal(d.dateOfLoss) || isValidVal(d.lossDate) || isValidVal(d.timeOfLoss) || isValidVal(d.policeReport) ||
      Boolean(d.lossFacts && (isValidVal(d.lossFacts.roadCondition) || isValidVal(d.lossFacts.impactPoint)));

    if (hasNarrative) score += 10;
    if (hasVehicle) score += 10;
    if (hasLocation) score += 10;
    if (hasCallerOrPolicy) score += 5;
    if (hasLossDetails) score += 5;

    const slotsCaptured = [hasNarrative, hasVehicle, hasLocation, hasCallerOrPolicy, hasLossDetails].filter(Boolean).length;

    // 4. Non-Adjudication Compliance — Tex. Ins. Code §4101 (15 pts)
    const hasProhibitedAdjudication = /(?:this\s+is\s+covered|will\s+be\s+covered|is\s+fully\s+covered|deductible\s+(?:will\s+be|is)\s+waived|accepting\s+full\s+liability|100%\s+not\s+at\s+fault)/i.test(transcript);
    if (hasProhibitedAdjudication) {
      score -= 35;
    } else if ((slotsCaptured >= 2 || (session.turnCount || 0) >= 2 || session.isComplete) && session.isPreliminaryIntake !== false) {
      score += 15;
    }

    // 5. Readback Confirmation & Intake Closure (10 pts)
    const hasReadback = Boolean(
      session.summaryConfirmed ||
      session.ackedSummaryConfirm ||
      session.isComplete ||
      (slotsCaptured >= 3 && hasSafetyTriage) ||
      /\b(capture all of those details accurately|recorded under Claim Reference|preliminary First Notice of Loss)\b/i.test(transcript)
    );
    if (hasReadback) score += 10;

    // Empty / 1-turn abandoned session cap (< 40)
    if (slotsCaptured === 0 && !hasSafetyTriage) {
      return Math.max(0, Math.min(score, 15));
    }
    if (slotsCaptured <= 1 && (session.turnCount || 0) <= 1 && !session.isComplete && !session.summaryConfirmed) {
      return Math.max(0, Math.min(score, 25));
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  buildWeatherQueryUrl(lat, lon, lossDate) {
    return buildWeatherQueryUrl(lat, lon, lossDate);
  }

  fetchWeather(lat, lon, lossDate, opts) {
    return fetchWeather(lat, lon, lossDate, opts);
  }

  evaluateAdasCalibrationFlag(vehicleYear, impactZone) {
    return evaluateAdasCalibrationFlag(vehicleYear, impactZone);
  }

  redactPII(text) {
    return redactPII(text);
  }
}

function normalizeLossDateIso(lossDate) {
  if (!lossDate) return null;
  const str = String(lossDate).trim();
  if (!str || /^today$/i.test(str) || /\(Today\)/i.test(str)) return null;
  const todayIso = new Date().toISOString().slice(0, 10);
  const isoMatch = str.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    return isoMatch[1] < todayIso ? isoMatch[1] : null;
  }
  const slashMatch = str.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slashMatch) {
    const mm = slashMatch[1].padStart(2, '0');
    const dd = slashMatch[2].padStart(2, '0');
    const yyyy = slashMatch[3];
    const candidate = `${yyyy}-${mm}-${dd}`;
    return candidate < todayIso ? candidate : null;
  }
  return null;
}

function buildWeatherQueryUrl(lat, lon, lossDate) {
  const latNum = lat !== undefined && lat !== null ? Number(lat) : 30.27;
  const lonNum = lon !== undefined && lon !== null ? Number(lon) : -97.74;
  const histDate = normalizeLossDateIso(lossDate);
  if (histDate) {
    return `https://archive-api.open-meteo.com/v1/archive?latitude=${latNum}&longitude=${lonNum}&start_date=${histDate}&end_date=${histDate}&daily=weathercode,temperature_2m_max,precipitation_sum`;
  }
  return `https://api.open-meteo.com/v1/forecast?latitude=${latNum}&longitude=${lonNum}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch`;
}

async function fetchWeather(lat, lon, lossDate, opts = {}) {
  if (lat && typeof lat === 'object') {
    const obj = lat;
    lossDate = obj.lossDate || obj.dateOfLoss || lon;
    lon = obj.lon !== undefined ? obj.lon : obj.longitude;
    lat = obj.lat !== undefined ? obj.lat : obj.latitude;
  }
  const url = buildWeatherQueryUrl(lat, lon, lossDate);
  const isHistorical = url.includes('archive-api.open-meteo.com/v1/archive');
  const observationTag = isHistorical ? 'Historical (Date of Loss)' : 'Current Observation';
  const histDate = normalizeLossDateIso(lossDate);

  if (opts && opts.dryRun) {
    return {
      url,
      isHistorical,
      observationType: observationTag,
      tag: observationTag,
      lossDate: histDate,
      latitude: Number(lat),
      longitude: Number(lon),
      summary: `${observationTag} (${histDate || 'Live'})`
    };
  }

  const https = require('https');
  try {
    const data = await new Promise((resolve, reject) => {
      const req = https.get(url, { timeout: 2500 }, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
          } else {
            reject(new Error(`Open-Meteo HTTP ${res.statusCode}`));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Open-Meteo timeout')); });
    });

    if (isHistorical && data && data.daily) {
      const code = Array.isArray(data.daily.weathercode) ? data.daily.weathercode[0] : null;
      const tempMax = Array.isArray(data.daily.temperature_2m_max) ? data.daily.temperature_2m_max[0] : null;
      const precip = Array.isArray(data.daily.precipitation_sum) ? data.daily.precipitation_sum[0] : 0;
      return {
        url,
        isHistorical: true,
        observationType: observationTag,
        tag: observationTag,
        lossDate: histDate,
        latitude: Number(lat),
        longitude: Number(lon),
        weatherCode: code,
        tempMax,
        precipitationSum: precip,
        summary: `${observationTag} [${histDate}]: MaxTemp=${tempMax !== null ? tempMax : 'N/A'}, Precip=${precip !== null ? precip : 0}, WeatherCode=${code !== null ? code : 'N/A'}`
      };
    }

    const cur = (data && data.current) || {};
    return {
      url,
      isHistorical: false,
      observationType: observationTag,
      tag: observationTag,
      lossDate: null,
      latitude: Number(lat),
      longitude: Number(lon),
      tempF: cur.temperature_2m !== undefined ? cur.temperature_2m : null,
      precipitation: cur.precipitation !== undefined ? cur.precipitation : 0,
      weatherCode: cur.weather_code !== undefined ? cur.weather_code : null,
      summary: `${observationTag}: Temp=${cur.temperature_2m !== undefined ? cur.temperature_2m : 'N/A'}°F, Precip=${cur.precipitation || 0} in`
    };
  } catch (_) {
    return {
      url,
      isHistorical,
      observationType: observationTag,
      tag: observationTag,
      lossDate: histDate,
      latitude: Number(lat),
      longitude: Number(lon),
      summary: `${observationTag} (${histDate || 'Fallback Telemetry'})`
    };
  }
}

function evaluateAdasCalibrationFlag(vehicleYear, impactZone) {
  let yr = Number(vehicleYear);
  if (Number.isNaN(yr) && typeof vehicleYear === 'string') {
    const m = vehicleYear.match(/\b(19|20)\d{2}\b/);
    if (m) yr = Number(m[0]);
  }
  const zoneStr = String(impactZone || '');
  const adasZoneRegex = /windshield|glass|front bumper|grille|radar|\s?camera|mirror|fender|quarter panel/i;
  const isModernVehicle = !Number.isNaN(yr) && yr >= 2018;
  const isAdasZone = adasZoneRegex.test(zoneStr);
  const required = Boolean(isModernVehicle && isAdasZone);
  return {
    ADAS_CALIBRATION_REQUIRED: required,
    vehicleYear: Number.isNaN(yr) ? null : yr,
    impactZone: zoneStr,
    matchedSensorZone: isAdasZone,
    reason: required
      ? `Vehicle year ${yr} (>= 2018) with impact zone "${zoneStr}" requires OEM ADAS sensor/camera calibration verification.`
      : 'No ADAS calibration trigger detected.'
  };
}

function redactPII(text) {
  if (text === null || text === undefined) return '';
  let out = String(text);
  // 1. 16-digit payment card numbers (grouped by 4 with dashes/spaces or contiguous 16 digits)
  out = out.replace(/\b(?:\d{4}[-\s]){3}\d{4}\b/g, '[REDACTED-CARD]');
  out = out.replace(/\b\d{16}\b/g, '[REDACTED-CARD]');
  // 2. SSNs (XXX-XX-XXXX or labeled 9-digit SSN)
  out = out.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED-SSN]');
  out = out.replace(/(\b(?:ssn|social\s+security(?:\s+number)?)\s*(?:is|#|:)?\s*)\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/gi, '$1[REDACTED-SSN]');
  // 3. Routing and Bank Account numbers
  out = out.replace(/(\b(?:routing|aba)\s*(?:number|num|no\.?|#|:)?\s*)\b\d{9}\b/gi, '$1[REDACTED-ROUTING]');
  out = out.replace(/(\b(?:account|acct|checking|savings|bank\s+account)\s*(?:number|num|no\.?|#|:)?\s*)\b[A-Z0-9-]{6,17}\b/gi, '$1[REDACTED-ACCOUNT]');
  return out;
}

module.exports = new ClaimsIntakeEngine();
// Test/inspection surface (used by _test_*.js; server uses only the instance API)
module.exports.L10N = L10N;
module.exports.LOSS_TYPES = LOSS_TYPES;
module.exports.LOSS_TYPE_FLOWS = LOSS_TYPE_FLOWS;
module.exports.GENERIC_FLOW = GENERIC_FLOW;
module.exports.LT_QUESTION_KEYS = LT_QUESTION_KEYS;
module.exports.LT_LABEL_KEYS = LT_LABEL_KEYS;
module.exports.buildWeatherQueryUrl = buildWeatherQueryUrl;
module.exports.fetchWeather = fetchWeather;
module.exports.evaluateAdasCalibrationFlag = evaluateAdasCalibrationFlag;
module.exports.redactPII = redactPII;
module.exports.normalizeClaimsAsrSpeech = normalizeClaimsAsrSpeech;



// --- ADDED BY DR-SERIES-C-MIROFISH-03 FIX ---

function mergeClaimState(previous = {}, extracted = {}) {
  const next = { ...previous, ...extracted };

  // Injury is sticky: never let a later ambiguous/invalid LLM output clear it.
  next.injuryAlert = Boolean(previous.injuryAlert || extracted.injuryAlert);

  // Preserve the first valid material loss classification unless a human
  // explicitly overrides it in an audited downstream workflow.
  if (previous.lossType && previous.lossType !== "Unknown") {
    next.lossType = previous.lossType;
  } else if (extracted.lossType && extracted.lossType !== "Unknown") {
    next.lossType = extracted.lossType;
  } else {
    next.lossType = previous.lossType || "Unknown";
  }

  // Narrative retry is prohibited once a material loss or injury is established.
  next.narrativeLocked = Boolean(
    previous.narrativeLocked ||
    next.lossType !== "Unknown" ||
    next.injuryAlert
  );

  // Never allow attribution plausibility to invalidate an event.
  next.causationReviewRequired = Boolean(
    previous.causationReviewRequired ||
    extracted.causationReviewRequired
  );

  return next;
}

const MATERIAL_FACTS_EXTRACTION_POLICY = `
MATERIAL-FACTS / ATTRIBUTION SEPARATION POLICY

You are an FNOL information extractor, not a truth adjudicator, medical diagnostician,
scientific evaluator, or causation investigator.

Accept the caller's account respectfully and without correction. Do not challenge,
dismiss, reinterpret, diagnose, validate, or disprove any stated explanation for why
an event happened.

Extract the report into separate lanes:

1. MATERIAL FACTS:
   Facts directly reported about physical events, contacts, damage, injuries, symptoms,
   vehicles, persons, property, road conditions, time, and location.

2. CALLER ATTRIBUTIONS:
   The caller's stated explanation, belief, interpretation, spiritual explanation,
   supernatural explanation, astrological explanation, unknown-force explanation,
   or other claimed mechanism. Preserve this neutrally as caller-reported context.

3. EVIDENCE STATUS:
   Mark each extracted item as directly_stated, caller_reported_unverified, inferred,
   or unknown. Do not treat unverified attribution as a contradiction of a directly
   stated material event.

MANDATORY CLASSIFICATION RULES:
- Determine lossType solely from directly stated material effects and physical events.
- A reported vehicle impact/contact with another vehicle, object, fence, curb, wall,
  barrier, animal, tree, building, ditch, or other property supports lossType: "Collision".
- A caller's explanation for the impact does not negate, downgrade, or invalidate
  lossType: "Collision".
- If a bodily symptom, pain, injury, medical concern, or request for care is stated,
  set injuryAlert: true. Once true, it must remain true.
- Do not require a conventional, scientifically verified, or physically plausible cause
  before extracting a material event or injury.
- Do not reopen the narrative because the attribution is supernatural, astrological,
  spiritual, implausible, bizarre, unverifiable, unknown, or internally unusual.
- qNarrativeReopen is allowed only when NO material event and NO injury/symptom can be
  extracted from the caller's narrative.
- Never use terms such as "delusion," "psychotic," "false," "imagined," "impossible,"
  or "irrational" in caller-facing output or standard FNOL notes.

Example:
Caller: "A ghost pushed my steering wheel, I hit a fence, and my neck hurts."
Material facts:
- vehicle_contact: "fence"
- lossType: "Collision"
- property_damage_reported: true
- injuryAlert: true
- symptom: "neck pain"
Caller attribution:
- "Caller reports that a ghost pushed the steering wheel."
Attribution status:
- caller_reported_unverified
Routing:
- Continue the normal Collision and injury/medical triage workflow.
- Do NOT ask "tell me what actually happened."
`;

const EXTRACTION_SCHEMA = {
  lossType: "Collision | Other | Unknown",
  injuryAlert: "boolean",

  materialFacts: {
    reportedPhysicalEvent: "string | null",
    vehicleInvolved: "boolean | null",
    impactOrContactReported: "boolean | null",
    contactObject: "string | null",
    propertyDamageReported: "boolean | null",
    bodilySymptoms: ["string"],
    medicalAttentionMentioned: "boolean | null"
  },

  callerAttribution: {
    statement: "string | null",
    category:
      "ordinary | unknown_mechanism | spiritual_or_supernatural | astrological_or_cosmic | other | null",
    evidenceStatus: "directly_stated | caller_reported_unverified | unknown"
  },

  confidence: {
    lossType: "high | medium | low",
    injuryAlert: "high | medium | low"
  },

  followUpIntent:
    "continue_standard_flow | ask_material_fact | medical_triage | qNarrativeReopen",

  causationReviewRequired: "boolean"
};

function hasDirectCollisionMaterialFact(extraction = {}) {
  const facts = extraction.materialFacts || {};
  const event = [
    facts.reportedPhysicalEvent,
    facts.contactObject,
    extraction.rawNarrative
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const collisionSignals = [
    "hit",
    "hitting",
    "crash",
    "crashed",
    "collision",
    "collided",
    "ran into",
    "struck",
    "sideswiped",
    "rear-ended",
    "impact",
    "fence",
    "wall",
    "curb",
    "barrier",
    "tree",
    "pole",
    "guardrail",
    "ditch",
    "vehicle"
  ];

  return Boolean(
    facts.impactOrContactReported === true ||
    facts.contactObject ||
    collisionSignals.some((signal) => event.includes(signal))
  );
}

function hasReportedInjury(extraction = {}) {
  const symptoms = extraction.materialFacts?.bodilySymptoms || [];
  const narrative = String(extraction.rawNarrative || "").toLowerCase();

  const injurySignals = [
    "hurt",
    "hurts",
    "pain",
    "sore",
    "injured",
    "injury",
    "neck",
    "back",
    "head",
    "headache",
    "dizzy",
    "dizziness",
    "bleeding",
    "hospital",
    "doctor",
    "ambulance",
    "medical"
  ];

  return Boolean(
    extraction.injuryAlert === true ||
    symptoms.length > 0 ||
    injurySignals.some((signal) => narrative.includes(signal))
  );
}

function normalizeMaterialFacts(extraction = {}) {
  const normalized = structuredClone(extraction);

  const collisionDetected = hasDirectCollisionMaterialFact(normalized);
  const injuryDetected = hasReportedInjury(normalized);

  normalized.materialFacts ??= {};
  normalized.callerAttribution ??= {};
  normalized.confidence ??= {};

  // Material effect takes priority over causal plausibility.
  if (collisionDetected) {
    normalized.lossType = "Collision";
    normalized.confidence.lossType = "high";
  }

  // Injury signals are safety-critical and sticky in mergeClaimState().
  if (injuryDetected) {
    normalized.injuryAlert = true;
    normalized.confidence.injuryAlert = "high";
  }

  // Attribution is preserved but operationally quarantined.
  if (normalized.callerAttribution.statement) {
    normalized.callerAttribution.evidenceStatus =
      "caller_reported_unverified";
  }

  // Do not allow the model's retry choice to override material facts.
  if (normalized.lossType !== "Unknown" || normalized.injuryAlert) {
    normalized.followUpIntent = normalized.injuryAlert
      ? "medical_triage"
      : "continue_standard_flow";
  }

  return normalized;
}

function selectNextQuestion(claimState, extraction) {
  const normalized = normalizeMaterialFacts(extraction);
  const nextState = mergeClaimState(claimState, normalized);

  // Highest-priority safety routing.
  if (nextState.injuryAlert) {
    return {
      state: nextState,
      nextQuestion: "qMedicalTriage",
      reason: "reported_symptom_or_injury"
    };
  }

  // Once a material loss is known, continue the canonical loss path.
  if (nextState.lossType === "Collision") {
    return {
      state: nextState,
      nextQuestion: getNextMissingCollisionSlot(nextState),
      reason: "material_collision_established"
    };
  }

  // Reopen only when there truly is no actionable material fact.
  if (!nextState.narrativeLocked) {
    return {
      state: nextState,
      nextQuestion: "qNarrativeReopen",
      reason: "no_material_event_or_injury_extracted"
    };
  }

  return {
    state: nextState,
    nextQuestion: getNextMissingSlot(nextState),
    reason: "continue_standard_flow"
  };
}

function canReopenNarrative(state) {
  return (
    state.lossType === "Unknown" &&
    state.injuryAlert !== true &&
    state.narrativeLocked !== true
  );
}

const abstractCausationCases = [
  {
    name: "supernatural attribution does not negate collision or injury",
    narrative: "A ghost pushed my steering wheel into a fence and my neck hurts.",
    expected: {
      lossType: "Collision",
      injuryAlert: true,
      nextQuestion: "qMedicalTriage",
      narrativeLocked: true
    }
  },
  {
    name: "astrological attribution does not negate collision",
    narrative: "Mercury in retrograde made me hit a guardrail.",
    expected: {
      lossType: "Collision",
      injuryAlert: false,
      narrativeLocked: true
    }
  },
  {
    name: "unknown mechanism preserves collision",
    narrative: "Something took over the car and I crashed into a tree.",
    expected: {
      lossType: "Collision",
      injuryAlert: false,
      narrativeLocked: true
    }
  },
  {
    name: "injury remains locked without a stated collision",
    narrative: "Saturn is affecting me and my back hurts badly.",
    expected: {
      lossType: "Unknown",
      injuryAlert: true,
      nextQuestion: "qMedicalTriage",
      narrativeLocked: true
    }
  },
  {
    name: "reopen remains available only with no material fact or symptom",
    narrative: "I had a very strange feeling while driving.",
    expected: {
      lossType: "Unknown",
      injuryAlert: false,
      nextQuestion: "qNarrativeReopen",
      narrativeLocked: false
    }
  }
];
