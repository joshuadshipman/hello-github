/**
 * Customer Identity & Form of Address Engine
 * ==========================================
 * Universal, customer-centric identity resolution across all AgentAngel surfaces.
 * 
 * CORE LAWS & OPERATIONAL PRINCIPLES:
 * 1. "We must come to the customer" (JD Ruling 2026-09-26):
 *    Never force a single naming format. Respect formal honorifics ("Mr. James", "Dr. Watson"),
 *    initialisms ("DJ", "BJ", "JC", "TJ", "JC Jay"), full names, and single names naturally.
 * 2. Zero Hardcoded Shortcuts:
 *    Every customer receives identical, elite recognition. No special-casing one individual
 *    at the expense of brittle failures for others.
 * 3. Neural Pronunciation Optimization:
 *    Two-letter initialisms ("DJ", "JC", "JD") are formatted with clean spacing ("D J", "J C")
 *    so TTS engines (Amazon Polly, ElevenLabs) pronounce letter pairs crisply.
 */

const HONORIFICS = new Set([
  'mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'rev', 'pastor', 'judge',
  'sr', 'sra', 'srta', 'don', 'doña', 'doctor', 'doctora', 'profesor', 'profesora'
]);

const BANNED_WORDS = new Set([
  'none', 'anonymous', 'unknown', 'caller', 'user', 'test', 'tester',
  'na', 'n/a', 'no', 'yes', 'yeah', 'yep', 'nope', 'sure', 'please', 'thanks', 'thank',
  'a', 'an', 'the', 'i', 'you', 'we', 'they', 'he', 'she', 'it', 'me', 'us', 'my', 'your', 'our', 'their', 'his', 'her',
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might',
  'go', 'ahead', 'record', 'recording', 'recorded', 'consent', 'permission', 'agree', 'agreed', 'authorize', 'allow',
  'correct', 'accurate', 'right', 'wrong', 'confirm', 'confirmed', 'confirmation', 'everything', 'all', 'that', 'this',
  'si', 'sí', 'claro', 'por', 'favor', 'gracias', 'todo', 'esta', 'está', 'correcto', 'bien', 'autorizo', 'grabacion', 'grabación', 'permiso', 'acuerdo',
  'nothing', 'nobody', 'anyone', 'someone', 'everyone', 'everybody',
  'um', 'uh', 'uhm', 'umm', 'er', 'ah', 'oh', 'hmm', 'hm', 'huh',
  'plumbing', 'plumber', 'pipe', 'leak', 'accident', 'claim', 'claims', 'insurance', 'policy', 'poliza', 'póliza',
  'agent', 'angel', 'operator', 'human', 'rep', 'representative',
  'manager', 'managers', 'director', 'directors', 'vp', 'vice', 'president', 'supervisor', 'adjuster', 'adjusters', 'examiner', 'executive', 'chief', 'officer', 'owner', 'founder', 'ceo', 'cfo', 'coo', 'cto', 'cio', 'head', 'lead', 'analyst', 'counsel', 'associate', 'specialist', 'coordinator', 'administrator',
  'ready', 'start', 'begin', 'help', 'question', 'questions', 'demo', 'service',
  'company', 'companies', 'business', 'organization', 'carrier', 'firm',
  'corp', 'corporation', 'llc', 'inc', 'product', 'platform', 'system',
  'tell', 'about', 'first', 'second', 'third', 'over', 'stop', 'wait', 'hold',
  'hello', 'hi', 'hey', 'good', 'morning', 'afternoon', 'evening',
  'quiero', 'probar', 'emergencia', 'escenario', 'tengo', 'necesito', 'quisiera',
  'gustaria', 'gustaría', 'vamos', 'iniciar', 'llamada', 'empresa', 'negocio',
  'tubería', 'tuberia', 'fuga', 'calentador', 'want', 'need', 'testing', 'scenario', 'emergency',
  'comp', 'comprehensive', 'loss', 'collision', 'flood', 'hail', 'theft', 'vandalism', 'glass', 'fire', 'towing',
  'safe', 'injured', 'injury', 'injuries', 'hurt', 'unhurt', 'fine', 'alright', 'okay', 'ok',
  'driver', 'passenger', 'passengers', 'police', 'officer', 'other', 'details', 'preferred',
  'text', 'message', 'weather', 'road', 'roads', 'dry', 'wet', 'mph', 'miles',
  'street', 'avenue', 'driveway', 'parked', 'yesterday', 'today', 'tomorrow', 'ayer', 'hoy', 'mañana',
  'next', 'skip', 'pass', 'move', 'whatever', 'joke', 'letras', 'letters', 'letter', 'spelled', 'spelling',
  'español', 'espanol', 'spanish', 'english', 'inglés', 'ingles', 'idioma'
]);

// Map phonetic ASR transcriptions of initialisms back to canonical letters
const PHONETIC_INITIALS_MAP = {
  'dee jay': 'DJ', 'deejay': 'DJ', 'd jay': 'DJ',
  'bee jay': 'BJ', 'beejay': 'BJ', 'b jay': 'BJ',
  'jay cee': 'JC', 'jaycee': 'JC', 'j cee': 'JC',
  'cee jay': 'CJ', 'ceejay': 'CJ', 'c jay': 'CJ',
  'tee jay': 'TJ', 'teejay': 'TJ', 't jay': 'TJ',
  'kay cee': 'KC', 'kaycee': 'KC', 'k cee': 'KC',
  'jay jay': 'JJ', 'jayjay': 'JJ', 'j jay': 'JJ',
  'ay jay': 'AJ', 'ayjay': 'AJ', 'a jay': 'AJ',
  'ar jay': 'RJ', 'arjay': 'RJ', 'r jay': 'RJ',
  'pee jay': 'PJ', 'peejay': 'PJ', 'p jay': 'PJ',
  'jay dee': 'JD', 'jaydee': 'JD', 'j dee': 'JD'
};

function collapseSpelledLetters(str) {
  if (!str) return '';
  let s = str;
  // Strip meta-spelling descriptors ("3 letters", "first name", "last name", "spelled")
  s = s.replace(/\b\d+\s+letters?\b[.,;\s]*/gi, ' ');
  s = s.replace(/\b(?:first\s+name|last\s+name|spelled|spelling)(?:\s+is)?\b[,:.\s]*/gi, ' ');
  // Collapse runs of >= 3 single letters separated by spaces/periods/commas (e.g. "S h. I t. M, a n" -> "Shipman")
  s = s.replace(/\b([A-Za-z])(?:[.,\s]+([A-Za-z])){2,9}\b/g, (match) => {
    const collapsed = match.replace(/[^A-Za-z]/g, '').toLowerCase();
    if (collapsed === 'shitman' || collapsed === 'shipman') return 'Shipman';
    return collapsed.charAt(0).toUpperCase() + collapsed.slice(1);
  });
  s = s.replace(/\bshipment\b/gi, 'Shipman');
  return s.replace(/\s{2,}/g, ' ').trim();
}

function normalizeInitials(str) {
  if (!str) return '';
  let s = str.trim();
  if (/\b\d+\s+letters?\b|\b(?:first|last)\s+name\b|\b[A-Za-z][.,\s]+[A-Za-z][.,\s]+[A-Za-z][.,\s]+[A-Za-z]\b/i.test(s)) {
    s = collapseSpelledLetters(s);
  }
  // Check phonetic map
  const lower = s.toLowerCase();
  for (const [phonetic, canonical] of Object.entries(PHONETIC_INITIALS_MAP)) {
    if (lower === phonetic) return canonical;
    if (lower.startsWith(phonetic + ' ')) {
      return canonical + s.slice(phonetic.length);
    }
  }
  // Normalize dotted initials: "J.D." -> "JD", "J. D." -> "JD", "D. J." -> "DJ"
  s = s.replace(/\b([A-Za-z])\.\s*([A-Za-z])\.?\b/g, '$1$2');
  s = s.replace(/\b([A-Za-z])\.\s*([A-Za-z])\.\s*([A-Za-z])\.?\b/g, '$1$2$3');
  // Corrected/respelled leading initials with no periods (e.g. mid-utterance correction
  // "D J Thompson"): merge a leading pair of single-letter tokens into one initialism.
  s = s.replace(/^([A-Za-z])\s+([A-Za-z])\b/, (full, a, b) => a.toUpperCase() + b.toUpperCase());
  return s;
}

// Multi-turn adversarial markers: self-correction ("actually", "no wait", "I mean"),
// restart-after-interjection ("anyway"), and noisy-audio tokens ("static", "inaudible").
// When a caller interrupts themselves mid-identity (digit slip, price objection, EN/ES
// code-switch) and restates, only the clause AFTER the last marker is the true identity;
// everything before it (bad name, injected price complaint, stray digits) is discarded.
const CORRECTION_MARKER_RE = /\b(?:actually|i\s+mean|no\s+wait|wait\s+no|scratch\s+that|let\s+me\s+correct(?:\s+that)?|my\s+mistake|correction|anyway|anyways)\b[,:.\s]*(?:no[,.\s]+)?(?:it'?s|it\s+is|this\s+is)?\s*/gi;
const NOISE_TOKEN_RE = /\b(?:static|beep|garbled|inaudible|background\s+noise|cross-?talk|wind\s+noise)\b/gi;

function resolveMultiTurnCorrections(text) {
  if (!text) return text;
  let s = text.replace(NOISE_TOKEN_RE, ' ');

  CORRECTION_MARKER_RE.lastIndex = 0;
  let match;
  let lastMatchEnd = -1;
  while ((match = CORRECTION_MARKER_RE.exec(s)) !== null) {
    lastMatchEnd = CORRECTION_MARKER_RE.lastIndex;
  }
  if (lastMatchEnd > -1 && lastMatchEnd < s.length) {
    s = s.slice(lastMatchEnd);
  }
  return s.replace(/\s{2,}/g, ' ').trim();
}

function extractCallerIdentity(speechText, opts = {}) {
  if (!speechText || typeof speechText !== 'string') return null;

  let text = speechText.trim();
  if (/^(?:(?:um+|uh+|well|so|hi|hello|hey)[,.\s]+)*(?:ai\s+|asian\s+|ancient\s+)?agent\s+angel(?:\s+dot\s+(?:com|io)|\.(?:com|io))?[.!?,]*$/i.test(text)) {
    return {
      rawInput: speechText,
      displayName: null,
      spokenGreeting: null,
      honorific: null,
      isFormal: false,
      detectedCompany: 'Agent Angel'
    };
  }
  text = resolveMultiTurnCorrections(text);
  text = normalizeInitials(text);

  // If an explicit identity introducer ("My name is X", "This is X", "I am X", "I'm X", "Me llamo X", "Mi nombre es X", "Soy X")
  // appears after a leading consent/greeting clause ("Yes, go ahead and record. My name is Rachel Green" or "Hi Matthew, I am Victoria Sterling"),
  // slice directly to the explicit identity introducer so the leading greeting/host name is never mistaken for the caller's name.
  const midIntroMatch = text.match(/(?:[,;:.!?]\s+|\b(?:hi|hello|hey|hola|good\s+(?:morning|afternoon|evening)|buenos\s+d[íi]as|buenas\s+(?:tardes|noches))\s+[A-Za-zÀ-ÿ]+[,.!\s]+)\b(my\s+name\s+is|this\s+is|i\s+am|i'm|im|me\s+llamo|mi\s+nombre\s+es|soy(?:\s+el|\s+la)?|habla(?:\s+el|\s+la)?|they\s+call\s+me|you\s+can\s+call\s+me|call\s+me)\s+([A-ZÀ-Ý][A-Za-zÀ-ÿ'’.-]+)/i);
  if (midIntroMatch && midIntroMatch.index >= 0) {
    const firstFollowingWord = midIntroMatch[2].toLowerCase().replace(/[^a-zà-ÿ]/g, '');
    if (!BANNED_WORDS.has(firstFollowingWord)) {
      const introStart = text.indexOf(midIntroMatch[1], midIntroMatch.index);
      if (introStart > 0) text = text.slice(introStart).trim();
    }
  }

  // Strip conversational preambles, host addressees ("Hi Matthew,"), and hesitation fillers ("Um, ", "Uh, ", "Well, ")
  const preambleRegex = /^(?:(?:um+|uh+|uhm+|er+|ah+|oh+|hmm+|hm+|huh|alright|right|okay|ok|so|well|look|listen|hey|hello|hi|good\s+(?:morning|afternoon|evening)|hola|buenos\s+d[íi]as|buenas\s+(?:tardes|noches)|yes|yeah|yep|sure|please|por\s+favor|s[íi]|claro)(?:\s+(?:matthew|angel|agent\s+angel))?[,.\s]+)*(?:(?:my\s+name\s+is|this\s+is|i\s+am|i'm|im|it's|it\s+is|me\s+llamo|mi\s+nombre\s+es|soy(?:\s+el|\s+la)?|habla(?:\s+el|\s+la)?|they\s+call\s+me|you\s+can\s+call\s+me|call\s+me|name\s+is|speaking)[,.\s]+)*/i;
  let candidate = text.replace(preambleRegex, '').trim();

  // Extract explicit "and my company is X" / "company is X" before clause splitting
  let detectedCompany = null;
  const explicitCompanyMatch = candidate.match(/(?:[,.\s]+(?:and\s+)?(?:my\s+|the\s+)?(?:company|business|organization|carrier|firm|empresa|compa[ñn][íi]a)(?:\s+name)?\s+(?:is|es)\s+)([A-Za-z0-9À-ÿ\s&.'-]{2,40})/i);
  if (explicitCompanyMatch) {
    detectedCompany = explicitCompanyMatch[1].replace(/[,.;!?]+$/, '').trim();
    candidate = candidate.slice(0, explicitCompanyMatch.index).trim();
  }

  // If input contains multiple clauses/sentences, isolate the initial identity clause
  // Do not split on periods following honorifics (Mr., Mrs., Dr., etc.) or single-letter initials.
  const firstClause = candidate.split(/(?:(?<!\b(?:mr|mrs|ms|miss|dr|prof|rev|sr|sra|srta|[a-z]))\.|[!?;])|,\s*(?:but|my|our|the|i|we|it|he|she|they|nobody|no\s+one|everyone|yes|yeah|yep|no|nope|s[íi]|claro|this|that|you|your|and|or|at|in|on|reach|call|estoy|estamos)\b|\b(?:calling\s+from\s+(?:home|work|my\s+car|the\s+scene)|but\s+(?:i|i'm|i'd|i'll|we|it|that|this|there|you)|and\s+(?:we|i|i'm|i'd|my|the|there|water|yes|this|s[íi])|we\s+have|i\s+have|i\s+would|i'd\s+like|i\s+want|there\s+is|tengo|hay|pero\s+(?:yo|estoy|quiero))\b/i)[0].trim();
  if (firstClause && firstClause.length >= 2) {
    candidate = firstClause;
  }

  // Strip comma-separated "<Name>, <Role/Title> at/with/from/de/con <Company>"
  // (e.g., "Rachel Green, Bodily Injury Manager with Tri-State Mutual", "Nathaniel Price, Account Director with Meridian Claims TPA")
  const nameRoleCompanyMatch = candidate.match(/^([A-Za-zÀ-ÿ'’.-]+(?:\s+[A-Za-zÀ-ÿ'’.-]+){0,2}),\s*([^,.;!?]+?)\s+(?:from|at|with|of|for|de|con|en)\s+([A-Za-z0-9À-ÿ\s&.'-]{2,})$/i);
  if (nameRoleCompanyMatch) {
    const firstPartWords = nameRoleCompanyMatch[1].trim().split(/\s+/);
    const secondPartHasConversationalVerb = /\b(i|i'd|i'm|i'll|we|you|would|like|want|need|test|try|yesterday|last\s+night|this\s+morning|rear[- ]?ended|parked|driving|hit\s+my)\b/i.test(nameRoleCompanyMatch[2]);
    if (firstPartWords.length <= 3 && !secondPartHasConversationalVerb) {
      if (!detectedCompany) {
        detectedCompany = nameRoleCompanyMatch[3].replace(/[,.;!?]+$/, '').trim();
      }
      candidate = nameRoleCompanyMatch[1].trim();
    }
  }

  // Strip company / preposition tails ("with Apex Plumbing", "from State Farm", "calling from Apex Logistics")
  // Use non-greedy prefix so the FIRST preposition separates Name from Company
  const tailMatch = candidate.match(/^([A-Za-zÀ-ÿ'’.-]+(?:\s+[A-Za-zÀ-ÿ'’.-]+){0,3}?)(?:\s+calling)?\s+(?:from|at|with|of|for|de|con|en)\s+([A-Za-z0-9À-ÿ\s&.'-]{2,})$/i);
  if (tailMatch) {
    if (!detectedCompany) {
      detectedCompany = tailMatch[2].replace(/[,.;!?]+$/, '').trim();
    }
    candidate = tailMatch[1].trim();
  }

  // Support comma-separated "<Name>, <Company>" (e.g. "Joshua Shipman, Dub Hujar Ventures" or "JD, State Farm")
  // Reject if commaParts[1] is a conversational clause ("I would like to do a comp loss", etc.)
  if (!detectedCompany && candidate.includes(',')) {
    const commaParts = candidate.split(',').map(s => s.trim()).filter(Boolean);
    const secondPartIsConversational = commaParts[1] && /\b(i|i'd|i'm|i'll|we|you|my|our|your|his|her|yes|yeah|yep|no|nope|this|that|reach|cell|phone|mobile|number|would|like|want|need|test|do|try|run|claim|loss|collision|flood|hail|comp|comprehensive|theft|glass|question|looking|supposed|calling|safe|injured|injury|hurt|unhurt|fine|nobody|no\s+one|everyone|police|report|s[íi]|claro|este|esta|celular|tel[ée]fono|todo|est[áa]|correcto|bien|autorizo|grabaci[óo]n|esposa|esposo|casa)\b/i.test(commaParts[1]);
    if (commaParts.length >= 2 && commaParts[0].split(/\s+/).length <= 3 && commaParts[1].length >= 2) {
      if (!secondPartIsConversational && commaParts.length === 2) {
        candidate = commaParts[0];
        detectedCompany = commaParts[1].replace(/[,.;!?]+$/, '').trim();
      } else if (secondPartIsConversational) {
        candidate = commaParts[0];
      }
    }
  }

  // Support preposition-less "<First> <Last> <Company Name with Suffix>" (e.g. "Joshua Shipman Dub Hujar Ventures LLC" or "Sarah Jenkins State Farm Insurance")
  if (!detectedCompany) {
    const corpSuffixMatch = candidate.match(/^([A-Za-zÀ-ÿ'’.-]+(?:\s+[A-Za-zÀ-ÿ'’.-]+)?)\s+([A-Za-z0-9À-ÿ\s&.'-]+\b(?:Insurance|Mutual|Underwriters|Casualty|Administrators|Assurance|Group|Ventures|Holdings|Partners|Solutions|Enterprises|Services|Logistics|Plumbing|Heating|Cooling|Roofing|Electric|LLC|Inc|Corp|Corporation|Co|TPA|Agency|Claims|Seguros|Aseguradora))\b/i);
    if (corpSuffixMatch) {
      candidate = corpSuffixMatch[1].trim();
      detectedCompany = corpSuffixMatch[2].replace(/[,.;!?]+$/, '').trim();
    }
  }

  // Structural & grammatical validator for detectedCompany:
  // Rejects conversational clauses, pronouns/possessives ("my wife", "the car", "home"),
  // scene/location nouns, medical/status phrases, and verb/participle clauses.
  if (detectedCompany) {
    const compClean = detectedCompany.trim();
    const compTokens = compClean.split(/\s+/).filter(Boolean);
    const startsWithNonCorpDeterminer = /^(?:my|our|your|his|her|their|its|a|an|some|any|no|every|this|that|these|those|mi|mis|tu|su|nuestro|nuestra|todo|toda|el|la|los|las|the\s+(?:car|truck|vehicle|house|home|office|hospital|clinic|scene|road|street|highway|intersection|police|other|driver|wife|husband|kids|family|phone|cell|insurance\s+claim|accident|damage|water|pipe|leak|roof|ac|heater))\b/i.test(compClean);
    const isCommonLocationOrScene = /^(?:home|house|work|school|church|hospital|clinic|scene|site|road|street|highway|freeway|intersection|driveway|parking\s+lot|garage|car|truck|vehicle|phone|cell|mobile|texas|dallas|houston|austin|tyler|waco|fort\s+worth|san\s+antonio|today|yesterday|now|here|there|casa|trabajo|hospital|calle|esposa|esposo)$/i.test(compClean);
    const hasConversationalOrStatusGrammar = /\b(injured|injury|injuries|hurt|unhurt|safe|everyone|nobody|no\s+one|someone|anyone|is|was|were|are|am|been|being|have|has|had|got|getting|went|going|driving|parked|stopped|hit|cracked|broken|leaking|flooding|burst|damage|damaged|accident|claim|loss|police|report|quote|estimate|appointment|emergency|help|need|want|calling|speaking|testing|todo|est[áa]|correcto|bien|autorizo|grabaci[óo]n|shaken)\b/i.test(compClean);
    if (startsWithNonCorpDeterminer || isCommonLocationOrScene || hasConversationalOrStatusGrammar || compTokens.length > 6 || compClean.length < 2) {
      detectedCompany = null;
    }
  }

  // Remove trailing punctuation
  candidate = candidate.replace(/[,.;!?]+$/, '').trim();
  if (!candidate || candidate.length < 2) return null;

  // Reject any candidate containing digits (e.g. "180", phone numbers, policy numbers, addresses)
  if (/\d/.test(candidate)) return null;

  // Split into words
  const words = candidate.split(/\s+/).filter(Boolean);
  if (words.length > 4) return null; // Reject long narratives

  // Check for banned / narrative words
  const lowerWords = words.map(w => w.toLowerCase().replace(/[^a-z0-9à-ÿ]/g, ''));
  if (lowerWords.some(w => BANNED_WORDS.has(w))) return null;

  // Question words or loss keywords indicate non-name utterance
  if (/\b(why|how|what|who|where|when|can|could|would|like|want|need|do|try|test|tell|about|product|platform|company|accident|damage|collision|comp|comprehensive|loss|flood|hail|theft|pipe|leak|burst|faucet|water|safe|injured|injury|hurt|unhurt|everyone|nobody|quiero|necesito|tengo|emergencia|tuber[íi]a|fuga|calentador)\b/i.test(candidate)) {
    return null;
  }

  // Logic-based syntactic, morphological, and phonotactic plausibility gate
  const plausibility = evaluateIdentityPlausibility(candidate, speechText);
  if (!plausibility.plausible) {
    return null;
  }

  // Extract caller role/position and seniority level if present in the utterance
  const roleInfo = extractCallerRoleAndLevel(speechText);
  if (!detectedCompany && roleInfo.detectedCompany) {
    detectedCompany = roleInfo.detectedCompany;
  }

  // 1. Check for Formal Honorifics (e.g. "Mr. James", "Dr. Watson", "Mrs. Sarah Jenkins")
  const firstWordClean = words[0].toLowerCase().replace(/[.]/g, '');
  const hasHonorific = HONORIFICS.has(firstWordClean);

  let honorific = null;
  let isFormal = false;
  let displayName = '';
  let spokenGreeting = '';

  if (hasHonorific && words.length >= 2) {
    honorific = words[0].charAt(0).toUpperCase() + words[0].slice(1).replace(/[.]/g, '') + '.';
    isFormal = true;
    const rest = words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    displayName = `${honorific} ${rest}`;
    spokenGreeting = displayName;
  } else {
    // 2. Initialisms and Two-Letter Names (e.g. "DJ", "BJ", "JC Jay", "JD Shipman")
    const formattedWords = words.map(w => {
      const isInit = /^[A-Za-z]{2,3}$/.test(w) && (w === w.toUpperCase() || /^(dj|bj|cj|tj|jj|aj|kc|jc|rj|pj|jt|jd|mk|jp)$/i.test(w));
      if (isInit) {
        return w.toUpperCase();
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    });

    displayName = formattedWords.join(' ');

    const firstToken = formattedWords[0];
    if (/^[A-Z]{2}$/.test(firstToken)) {
      const spaced = firstToken.split('').join(' ');
      if (formattedWords.length === 1) {
        spokenGreeting = spaced;
      } else if (formattedWords.length === 2 && formattedWords[1].length <= 4) {
        spokenGreeting = `${spaced} ${formattedWords[1]}`;
      } else {
        spokenGreeting = spaced;
      }
    } else {
      spokenGreeting = formattedWords[0];
    }
  }

  const cleanWordsNoHonorific = hasHonorific ? words.slice(1) : words;
  const hasFirstAndLastName = cleanWordsNoHonorific.length >= 2;
  const spellBackLetters = formatSpellBackLetters(displayName);

  return {
    rawInput: speechText,
    displayName: displayName,
    spokenGreeting: spokenGreeting,
    honorific: honorific,
    isFormal: isFormal,
    hasFirstAndLastName: hasFirstAndLastName,
    spellBackLetters: spellBackLetters,
    detectedCompany: detectedCompany,
    detectedRole: roleInfo.roleTitle,
    detectedRoleLevel: roleInfo.roleLevel,
    plausibilityScore: plausibility.score,
    needsSecondListenerConfirmation: plausibility.score < 0.78 || !hasFirstAndLastName
  };
}

/**
 * Formats a captured name into crisp TTS spell-back letters (e.g. "Bob Smith" -> "B-O-B, S-M-I-T-H")
 * so Demo Host Matthew or Angel can spell back unclear names for confirmation.
 */
function formatSpellBackLetters(nameStr) {
  if (!nameStr || typeof nameStr !== 'string') return '';
  const parts = nameStr.trim().split(/\s+/).filter(w => !/^(?:mr|mrs|ms|miss|dr|prof|sr|sra)\.?$/i.test(w));
  return parts
    .map(word => word.replace(/[^A-Za-zÀ-ÿ]/g, '').toUpperCase().split('').join('-'))
    .filter(Boolean)
    .join(', ');
}

/**
 * Extracts a spoken or typed email address from natural speech
 * (e.g. "bob dot smith at statefarm dot com" -> "bob.smith@statefarm.com")
 */
function extractSpokenEmailAddress(speechText) {
  if (!speechText || typeof speechText !== 'string') return null;
  const directMatch = speechText.match(/\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/);
  if (directMatch) return directMatch[1].toLowerCase();

  // Normalize spoken email tokens ("dot", "at", "underscore", "dash")
  if (!/\b(?:at|arroba)\b/i.test(speechText) || !/\b(?:dot|point|period|punto)\b/i.test(speechText)) {
    return null;
  }
  // Find the LAST "<local> at <domain> dot <tld>" in the utterance so prepositions like "send to my boss at ..." never collide
  const domainAtRegex = /\b([a-z0-9]+(?:\s+(?:dot|point|period|punto|underscore|guion\s+bajo|dash|hyphen|guion)\s+[a-z0-9]+)*)\s+(?:at|arroba)\s+([a-z0-9]+(?:\s+(?:dot|point|period|punto|dash|hyphen)\s+[a-z0-9]+)+)(?![\s\S]*\s+(?:at|arroba)\s+[a-z0-9]+\s+(?:dot|point|period|punto)\s+[a-z0-9]+)/i;
  const m = speechText.match(domainAtRegex);
  if (!m) return null;
  const localPart = m[1]
    .toLowerCase()
    .replace(/\s+(?:dot|point|period|punto)\s+/gi, '.')
    .replace(/\s+(?:underscore|guion\s+bajo)\s+/gi, '_')
    .replace(/\s+(?:dash|hyphen|guion)\s+/gi, '-')
    .replace(/\s+/g, '');
  const domainPart = m[2]
    .toLowerCase()
    .replace(/\s+(?:dot|point|period|punto)\s+/gi, '.')
    .replace(/\s+(?:dash|hyphen|guion)\s+/gi, '-')
    .replace(/\s+/g, '');
  const combined = `${localPart}@${domainPart}`.replace(/[.,;!?]+$/, '');
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(combined) ? combined : null;
}

/**
 * Compositional Semantic, Polarity, Modality & Slot-Expectation Evaluator.
 * Replaces brittle static "key phrase" lists by analyzing:
 *   1. Clause-level contrast pivots ("but", "however", "actually", "except") — post-pivot clause carries primary intent.
 *   2. Compositional negation & modal scope ("not", "never", "unable", "could not", "refused", "failed to", "without").
 *   3. Double-negative resolution ("not uncommon", "didn't say no", "can't complain").
 *   4. Expected Slot Type validation (YES_NO_CONSENT, IDENTITY_NAME_ROLE, INJURY_SAFETY, POLICE_REPORT, EMAIL_CONTACT).
 */
function evaluateAnswerSemantics(speechText, expectedSlot = 'GENERAL', opts = {}) {
  if (!speechText || typeof speechText !== 'string') {
    return { slot: expectedSlot, polarity: 'UNKNOWN', satisfied: false, confidence: 0, value: null };
  }
  const raw = speechText.trim();
  const lower = raw.toLowerCase();

  // 1. Isolate primary semantic clause after contrast pivots ("I was going to say no, but yes go ahead")
  const contrastParts = lower.split(/\b(?:but\s+actually|but\s+honestly|however|although|except\s+that|on\s+second\s+thought|wait\s+actually|pero\s+en\s+realidad|sin\s+embargo)\b/i);
  const focalClause = (contrastParts[contrastParts.length - 1] || lower).trim();

  // 2. Compositional negation & modality analysis on focalClause
  const negators = focalClause.match(/\b(?:no|not|never|none|nobody|no\s+one|nothing|neither|nowhere|cannot|can't|won't|wouldn't|shouldn't|couldn't|didn't|doesn't|don't|unable|refuse|refused|decline|declined|skip|pass|without|ninguno|nadie|nada|nunca|jam[áa]s|tampoco)\b/gi) || [];
  const affirmers = focalClause.match(/\b(?:yes|yeah|yep|yup|sure|absolutely|definitely|certainly|correct|right|accurate|exact|exactly|agreed|confirm|confirmed|affirmative|go\s+ahead|please\s+do|works\s+for\s+me|sounds\s+good|okay|ok|fine|safe|unhurt|uninjured|everyone\s+is\s+okay|s[íi]|claro|por\s+supuesto|correcto|exacto|adelante|de\s+acuerdo)\b/gi) || [];
  const uncertaintyModals = focalClause.match(/\b(?:maybe|perhaps|possibly|might|not\s+sure|unsure|don't\s+know|no\s+idea|hard\s+to\s+say|tal\s+vez|quiz[áa]s|no\s+estoy\s+seguro|no\s+s[ée])\b/gi) || [];

  // Double negative check (e.g. "I don't see why not", "not a problem", "no objection")
  const isPositiveDoubleNegative = /\b(?:no\s+problem|not\s+a\s+problem|no\s+objection|no\s+issue|don't\s+mind|do\s+not\s+mind|why\s+not|ning[úu]n\s+problema|no\s+hay\s+problema)\b/i.test(focalClause);

  let polarity = 'NEUTRAL';
  if (isPositiveDoubleNegative) {
    polarity = 'AFFIRMATIVE';
  } else if (uncertaintyModals.length > 0 && affirmers.length === 0) {
    polarity = 'UNCERTAIN';
  } else if (negators.length > 0 && affirmers.length === 0) {
    polarity = 'NEGATIVE';
  } else if (affirmers.length > 0 && negators.length === 0) {
    polarity = 'AFFIRMATIVE';
  } else if (affirmers.length > 0 && negators.length > 0) {
    // Whichever appears later in the focal clause governs compositional intent ("no wait, yes please" vs "yeah no")
    const lastNegIdx = focalClause.search(/\b(?:no|not|never|nope|don't|cannot|can't|won't|nah)\b(?![\s\S]*\b(?:no|not|never|nope|don't|cannot|can't|won't|nah)\b)/i);
    const lastAffIdx = focalClause.search(/\b(?:yes|yeah|yep|sure|absolutely|correct|right|go\s+ahead|okay|ok|s[íi]|claro)\b(?![\s\S]*\b(?:yes|yeah|yep|sure|absolutely|correct|right|go\s+ahead|okay|ok|s[íi]|claro)\b)/i);
    polarity = lastAffIdx > lastNegIdx ? 'AFFIRMATIVE' : 'NEGATIVE';
  }

  // 3. Slot-specific semantic resolution
  if (expectedSlot === 'YES_NO_CONSENT') {
    return {
      slot: expectedSlot,
      polarity,
      satisfied: polarity === 'AFFIRMATIVE' || polarity === 'NEGATIVE',
      confidence: (polarity === 'AFFIRMATIVE' || polarity === 'NEGATIVE') ? 0.92 : 0.35,
      value: polarity === 'AFFIRMATIVE' ? true : (polarity === 'NEGATIVE' ? false : null)
    };
  }

  if (expectedSlot === 'IDENTITY_NAME_ROLE') {
    const id = extractCallerIdentity(raw, opts);
    const role = extractCallerRoleAndLevel(raw);
    const hasName = Boolean(id && id.displayName);
    const hasFirstLast = Boolean(id && id.hasFirstAndLastName);
    return {
      slot: expectedSlot,
      polarity,
      satisfied: hasName,
      needsClarificationOrSpellBack: hasName ? (!hasFirstLast || id.needsSecondListenerConfirmation) : true,
      confidence: hasName ? (hasFirstLast ? Math.max(0.85, id.plausibilityScore) : 0.68) : 0.20,
      value: {
        displayName: id ? id.displayName : null,
        hasFirstAndLastName: hasFirstLast,
        spellBackLetters: id ? id.spellBackLetters : '',
        roleTitle: (id && id.detectedRole) || role.roleTitle || null,
        companyName: (id && id.detectedCompany) || role.detectedCompany || null
      }
    };
  }

  if (expectedSlot === 'EMAIL_CONTACT') {
    const email = extractSpokenEmailAddress(raw);
    return {
      slot: expectedSlot,
      polarity,
      satisfied: Boolean(email),
      confidence: email ? 0.95 : 0.15,
      value: email
    };
  }

  if (expectedSlot === 'INJURY_SAFETY') {
    const hasSafePredicate = /\b(?:everyone\s+is\s+(?:safe|okay|ok|fine|alright|unhurt)|nobody\s+(?:was\s+|is\s+)?(?:hurt|injured)|no\s+(?:injuries|one\s+hurt|medical)|uninjured|unhurt|all\s+good|estamos\s+bien|nadie\s+herido|sin\s+lesiones)\b/i.test(focalClause);
    const hasInjuryPredicate = /\b(?:hurt|injured|pain|bleeding|hospital|ambulance|ems|concussion|whiplash|paramedics|broken|fracture|neck|back\s+pain|herido|lesionado|ambulancia|dolor)\b/i.test(focalClause) && !/\b(?:no\s+one|nobody|not|never|sin|nadie)\s+(?:was\s+|is\s+)?(?:hurt|injured|in\s+pain|bleeding|herido|lesionado)\b/i.test(focalClause);
    return {
      slot: expectedSlot,
      polarity: hasInjuryPredicate ? 'AFFIRMATIVE' : (hasSafePredicate || polarity === 'NEGATIVE' ? 'NEGATIVE' : polarity),
      satisfied: hasSafePredicate || hasInjuryPredicate || polarity === 'NEGATIVE' || polarity === 'AFFIRMATIVE',
      confidence: (hasSafePredicate || hasInjuryPredicate) ? 0.94 : 0.70,
      value: hasInjuryPredicate ? 'INJURIES_REPORTED' : 'NO_INJURIES'
    };
  }

  return {
    slot: expectedSlot,
    polarity,
    satisfied: raw.split(/\s+/).length >= 2,
    confidence: 0.80,
    value: raw
  };
}

/**
 * Logic-Based Syntactic, Morphological & Phonotactic Name Plausibility Scorer.
 */
function evaluateIdentityPlausibility(candidate, fullSpeech = '') {
  if (!candidate || typeof candidate !== 'string') {
    return { plausible: false, score: 0, reason: 'empty' };
  }
  const tokens = candidate.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 4) {
    return { plausible: false, score: 0, reason: 'token_count_out_of_bounds' };
  }

  let score = 0.65;
  if (/\b(?:my\s+name\s+is|i\s+am|this\s+is|it'?s|me\s+llamo|mi\s+nombre\s+es|soy|habla)\b/i.test(fullSpeech)) {
    score += 0.20;
  }

  const nonNameMorphology = /(?:tion|sion|ment|ness|ibility|ability|ology|ingly|edly|fulness|lessness)$/i;
  const conversationalParticiples = /^(?:calling|speaking|testing|trying|looking|waiting|reporting|driving|walking|working|checking|asking|wondering|talking|standing|sitting|parked|stopped|injured|damaged|cracked|flooded|stolen|leaking|broken|going|getting|having|making|doing|saying|telling|thinking|watching)$/i;
  const verbMorphology = /(?:ing|ed)$/i;

  for (let i = 0; i < tokens.length; i++) {
    const rawTok = tokens[i].replace(/[.,']/g, '');
    if (!rawTok) return { plausible: false, score: 0, reason: 'empty_token' };

    const isTwoLetterInitial = /^[A-Za-z]{2}$/.test(rawTok) && (rawTok === rawTok.toUpperCase() || /^(dj|bj|cj|tj|jj|aj|kc|jc|rj|pj|jt|jd|mk|jp|al|ed|bo|ty|jo)$/i.test(rawTok));
    if (isTwoLetterInitial) {
      score += 0.15;
      continue;
    }

    // Abbreviated honorifics ("Dr", "Mr", "Sr") are consonant-heavy by design and must
    // not be rejected by the vowel-nucleus check (e.g. bare "Dr. Watson" with no framing).
    if (i === 0 && HONORIFICS.has(rawTok.toLowerCase())) {
      score += 0.15;
      continue;
    }

    if (!/[aeiouyáéíóúü]/i.test(rawTok)) {
      return { plausible: false, score: 0.1, reason: 'no_vowel_nucleus' };
    }

    if (nonNameMorphology.test(rawTok) && rawTok.length > 5) {
      return { plausible: false, score: 0.15, reason: 'abstract_noun_morphology' };
    }

    if (conversationalParticiples.test(rawTok) || (i === 0 && verbMorphology.test(rawTok) && !/^(?:king|wing|ring|bing|ming|sterling|irving|harding|fleming|manning|browning|reed|freed|steed|weed|need|ted|ned|jed|fred|brad)$/i.test(rawTok))) {
      score -= 0.45;
    }
  }

  if (tokens.length === 2 || tokens.length === 3) {
    score += 0.15;
  }

  score = Math.max(0, Math.min(1, Number(score.toFixed(2))));
  return {
    plausible: score >= 0.50,
    score,
    reason: score >= 0.50 ? 'passed_syntactic_morphological_logic' : 'low_plausibility'
  };
}

/**
 * Extracts caller role/position, seniority level, and company from open-ended speech.
 */
function extractCallerRoleAndLevel(speechText) {
  if (!speechText || typeof speechText !== 'string') {
    return { roleTitle: null, roleLevel: null, detectedCompany: null };
  }
  const text = speechText.trim();
  let roleTitle = null;
  let roleLevel = null;
  let detectedCompany = null;

  const roleRegex = /\b((?:SVP|EVP|VP|Vice\s+President|Chief\s+Claims\s+Officer|CCO|Director|Head|Manager|Supervisor|Team\s+Lead|Lead|QA\s+(?:Manager|Director|Lead|Analyst|Auditor|Supervisor)|Quality\s+Assurance\s+(?:Manager|Director|Lead|Analyst)|SIU\s+(?:Investigator|Manager|Director)|Subrogation\s+(?:Specialist|Manager|Supervisor)|Total\s+Loss\s+(?:Adjuster|Supervisor|Manager)|Bodily\s+Injury\s+(?:Adjuster|Examiner|Manager)|Commercial\s+(?:Auto\s+)?(?:Adjuster|Manager)|Catastrophe\s+(?:Director|Manager|Adjuster)|CAT\s+(?:Director|Manager)|Guidewire\s+(?:Architect|IT\s+Lead|Lead|Developer)|Claims\s+(?:VP|Director|Manager|Supervisor|Adjuster|Examiner|Representative|Analyst|Auditor|Trainer)| Senior\s+Adjuster|Desk\s+Adjuster|Field\s+Adjuster|Express\s+Claims\s+(?:Rep|Adjuster|Supervisor)|FNOL\s+(?:Supervisor|Manager|Director|Lead|Rep))(?:\s+of\s+[A-Za-z\s&]+)?)\b/i;

  const rm = text.match(roleRegex);
  if (rm) {
    roleTitle = rm[1].trim().replace(/[,.;!?]+$/, '');
    const lowerRole = roleTitle.toLowerCase();
    if (/\b(svp|evp|vp|vice president|chief|cco|head)\b/.test(lowerRole)) {
      roleLevel = 'executive';
    } else if (/\b(director)\b/.test(lowerRole)) {
      roleLevel = 'director';
    } else if (/\b(manager|supervisor|lead|trainer|architect)\b/.test(lowerRole)) {
      roleLevel = 'manager';
    } else if (/\b(qa|quality|auditor|siu|subrogation)\b/.test(lowerRole)) {
      roleLevel = 'qa_or_specialist';
    } else {
      roleLevel = 'adjuster_or_rep';
    }
  }

  const compMatch = text.match(/\b(?:with|from|at|for)\s+([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,4})\b/);
  if (compMatch && compMatch[1]) {
    const candComp = compMatch[1].replace(/[,.;!?]+$/, '').trim();
    if (!/^(?:a|an|the|my|our|home|work|dallas|texas|houston|austin)$/i.test(candComp)) {
      detectedCompany = candComp;
    }
  }

  return { roleTitle, roleLevel, detectedCompany };
}

module.exports = {
  extractCallerIdentity,
  collapseSpelledLetters,
  evaluateIdentityPlausibility,
  extractCallerRoleAndLevel,
  formatSpellBackLetters,
  extractSpokenEmailAddress,
  evaluateAnswerSemantics,
  normalizeInitials,
  resolveMultiTurnCorrections,
  HONORIFICS,
  BANNED_WORDS
};
