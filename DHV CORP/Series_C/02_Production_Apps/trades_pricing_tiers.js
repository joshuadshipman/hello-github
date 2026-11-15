'use strict';
// PRICING-TIERS-TRADES-SINGLE-LINE-01 — canonical commercial trades pricing.
// Single source of truth for every trades surface (sales engine in
// specialist_engines.js, GET /api/trades/pricing in voice_webhook_server.js).
// Rule: a solo / single-line contractor is NEVER quoted the Call Center Pro
// tier. Tier selection is by truck count + requested add-ons, never by guess.

const TRADES_PRICING_TIERS = [
  {
    id: 'solo',
    name: 'Solo / Single-Line',
    priceMinMonthly: 99,
    priceMaxMonthly: 149,
    trucks: { min: 1, max: 1 },
    features: [
      '24/7 answering',
      'Leak and freeze triage',
      'Shut-off valve guidance',
      'Missed-call SMS text-back',
    ],
  },
  {
    id: 'growth',
    name: 'Growth (2–5 Trucks)',
    priceMinMonthly: 249,
    priceMaxMonthly: 299,
    trucks: { min: 2, max: 5 },
    features: [
      'Everything in Solo',
      'Photo Triage Webview',
      'After-Hours Surcharge Triage',
      'Google LSA Review Engine',
    ],
  },
  {
    id: 'call_center_pro',
    name: 'Call Center Pro / Multi-Truck',
    priceMinMonthly: 499,
    priceMaxMonthly: 499,
    trucks: { min: 6, max: Infinity },
    features: [
      'Everything in Growth',
      'Full bi-directional CRM sync (ServiceTitan, Jobber, Housecall Pro)',
      'Multi-line routing',
      'AxiRate™ 100% compliance auditing',
    ],
  },
];

const TIER_BY_ID = Object.fromEntries(TRADES_PRICING_TIERS.map((t) => [t.id, t]));

// Add-on / capability signals that force a minimum tier.
const GROWTH_SIGNALS = /\b(photo triage|photos?|pictures?|surcharge|after.?hours? (fee|surcharge|pricing)|lsa|google (local services|reviews?)|reviews?|fotos?|rese[ñn]as?|recargo)\b/i;
const PRO_SIGNALS = /\b(service ?titan|jobber|housecall( pro)?|crm|multi.?line|multiple lines|call center|axirate|compliance audit\w*|centro de llamadas|varias l[ií]neas)\b/i;
const SOLO_SIGNALS = /\b(solo|one.?man|single.?line|one truck|just me|by myself|owner.?operator|yo solo|un solo cami[oó]n|una sola l[ií]nea)\b/i;

const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };

function parseTruckCount(text) {
  if (!text) return null;
  const m = String(text).toLowerCase().match(/\b(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(trucks?|vans?|techs?|technicians?|crews?|lines?|cami[oó]n(es)?|camionetas?|t[eé]cnicos?|l[ií]neas?)\b/);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : NUM_WORDS[m[1]];
  return Number.isFinite(n) && n > 0 ? n : null;
}

function tierForTrucks(n) {
  if (n <= 1) return TIER_BY_ID.solo;
  if (n <= 5) return TIER_BY_ID.growth;
  return TIER_BY_ID.call_center_pro;
}

const RANK = { solo: 0, growth: 1, call_center_pro: 2 };

// Recommend a tier from a free-text query and/or explicit { trucks, addOns }.
// Returns { tier, reason }. Default (no signal) is Solo — the cheapest honest
// entry point — never the Call Center Pro tier.
function recommendTier(query, opts = {}) {
  const text = String(query || '');
  let trucks = Number.isFinite(opts.trucks) ? opts.trucks : parseTruckCount(text);
  if (trucks == null && SOLO_SIGNALS.test(text)) trucks = 1;
  let tier = trucks != null ? tierForTrucks(trucks) : TIER_BY_ID.solo;
  let reason = trucks != null ? `truck_count:${trucks}` : 'default_entry';
  const addOns = [text].concat(opts.addOns || []).join(' ');
  if (PRO_SIGNALS.test(addOns) && RANK[tier.id] < RANK.call_center_pro) {
    tier = TIER_BY_ID.call_center_pro; reason = 'addon:pro';
  } else if (GROWTH_SIGNALS.test(addOns) && RANK[tier.id] < RANK.growth) {
    tier = TIER_BY_ID.growth; reason = 'addon:growth';
  }
  return { tier, reason, trucks };
}

function formatPrice(tier) {
  return tier.priceMinMonthly === tier.priceMaxMonthly
    ? `$${tier.priceMinMonthly}/mo`
    : `$${tier.priceMinMonthly}–$${tier.priceMaxMonthly}/mo`;
}

const PRICING_COPY = {
  en: {
    quote: `For your business that's our {NAME} plan at {PRICE}: {FEATURES}.`,
    ladder: `We have three plans: Solo for single-line shops at \x2499 to \x24149 a month ($100/mo founding Design Partner rate), Growth for 2 to 5 trucks at \x24249 to \x24299 a month, and Call Center Pro for multi-truck operations at \x24499 a month.`,
  },
  es: {
    quote: `Para su negocio corresponde nuestro plan {NAME} a {PRICE}: {FEATURES}.`,
    ladder: `Tenemos tres planes: Solo para negocios de una sola línea de \x2499 a \x24149 al mes ($100/mo tarifa fundadora), Growth para 2 a 5 camiones de \x24249 a \x24299 al mes, y Call Center Pro para operaciones de varios camiones a \x24499 al mes.`,
  },
};

function pricingAnswer(query, lang = 'en', opts = {}) {
  const copy = PRICING_COPY[lang] || PRICING_COPY.en;
  const { tier, reason, trucks } = recommendTier(query, opts);
  const text = copy.quote
    .replace('{NAME}', tier.name)
    .replace('{PRICE}', formatPrice(tier))
    .replace('{FEATURES}', tier.features.join(', '));
  return { tierId: tier.id, price: formatPrice(tier), reason, trucks, text, ladder: copy.ladder };
}

const PRICING_QUESTION = /\b(how much|price|pricing|cost|costs|rate|plans?|tiers?|per month|monthly|cu[aá]nto (cuesta|cobran|vale)|precios?|planes?|al mes|mensual)\b/i;
function isPricingQuestion(speech) { return !!speech && PRICING_QUESTION.test(speech); }

// 4-Tier Geo-Demographic & Operational Trades Pricing Matrix (JD Ruling 2026-10-20)
// Keeps all revenue on the table from <10k rural towns (e.g. DeQueen, AR)
// up to multi-line Call Center Pro operations with AxiRate™.
const GEO_DEMOGRAPHIC_TRADES_TIERS = {
  RURAL_HOMETOWN_99: {
    id: 'rural_99',
    name: 'Rural Hometown Starter',
    monthlyPriceUsd: 99,
    listAnchorUsd: 199,
    qualification: 'Town population < 10,000 (e.g., DeQueen, AR) or county population < 10,000–25,000 with low competitor density',
    includesAxiRateHumanReview: false,
    includesAllTradeAddOns: false,
    includedSeriesDAddOns: ['missed_call_sms_textback'],
    grossMarginEstimatePct: 95,
  },
  SOLO_OPERATOR_199: {
    id: 'solo_199',
    name: 'Solo Operator (D1 *72)',
    monthlyPriceUsd: 199,
    listAnchorUsd: 299,
    qualification: '1–2 truck owner-operator in towns 10,000–250,000 pop; no office CSR staff requiring AxiRate human call review',
    includesAxiRateHumanReview: false,
    includesAllTradeAddOns: false,
    includedSeriesDAddOns: ['missed_call_sms_textback', 'after_hours_surcharge_calculator'],
    grossMarginEstimatePct: 96,
  },
  TRADE_COMPLETE_299: {
    id: 'trade_complete_299',
    name: 'Trade Complete Package (Voice + All Series D Add-Ons)',
    monthlyPriceUsd: 299,
    listAnchorUsd: 299,
    qualification: '2–5 trucks wanting 24/7 Voice + Webchat + ALL Series D Plumbing/Trade Add-Ons included',
    includesAxiRateHumanReview: false,
    includesAllTradeAddOns: true,
    includedSeriesDAddOns: [
      'missed_call_sms_textback',
      'photo_triage_webview',
      'after_hours_surcharge_calculator',
      'google_lsa_review_solicitor',
      'commercial_pm_contract_builder',
      'permit_inspection_tracker',
    ],
    grossMarginEstimatePct: 96,
  },
  CALL_CENTER_PRO_499: {
    id: 'call_center_pro_499',
    name: 'Call Center Pro + AxiRate™ CSR Auditing',
    monthlyPriceUsd: 499,
    listAnchorUsd: 499,
    qualification: 'Multi-line shops with daytime CSR/dispatch staff needing AxiRate™ 100% Call Review & Coaching + All Add-Ons',
    includesAxiRateHumanReview: true,
    includesAllTradeAddOns: true,
    includedSeriesDAddOns: ['ALL_SERIES_D_TRADE_ADDONS', 'AXIRATE_CSR_QA_COACHING'],
    grossMarginEstimatePct: 94,
  },
};

function resolveGeoDemographicTradeTier(prospect = {}) {
  const townPop = Number(prospect.townPopulation ?? 50000);
  const countyPop = Number(prospect.countyPopulation ?? 100000);
  const trucks = Number(prospect.truckCount ?? 1);
  const hasOfficeCsr = Boolean(prospect.hasOfficeCsrStaff);
  const wantsAllAddOns = Boolean(prospect.wantsAllTradeAddOns);

  if (hasOfficeCsr || trucks >= 6) {
    return {
      ...GEO_DEMOGRAPHIC_TRADES_TIERS.CALL_CENTER_PRO_499,
      appliedDiscountReason: 'Full Multi-Line + AxiRate™ Human CSR Call Auditing & Coaching',
    };
  }
  if (townPop < 10000 || countyPop < 15000) {
    return {
      ...GEO_DEMOGRAPHIC_TRADES_TIERS.RURAL_HOMETOWN_99,
      appliedDiscountReason: `Hometown Small-Market Rate for ${prospect.city || 'Rural Market'} (pop ${townPop.toLocaleString()}) — listed at \x24199, locked at \x2499/mo`,
    };
  }
  if (trucks <= 2 && !wantsAllAddOns) {
    return {
      ...GEO_DEMOGRAPHIC_TRADES_TIERS.SOLO_OPERATOR_199,
      appliedDiscountReason: 'Solo Operator Rate ($100/mo savings — no AxiRate human CSR review overhead required)',
    };
  }
  return {
    ...GEO_DEMOGRAPHIC_TRADES_TIERS.TRADE_COMPLETE_299,
    appliedDiscountReason: 'All-In Trade Complete Package (24/7 Voice + Webchat + All 6 Plumbing/Trade Add-Ons included)',
  };
}

module.exports = {
  TRADES_PRICING_TIERS, TIER_BY_ID, PRICING_COPY,
  GEO_DEMOGRAPHIC_TRADES_TIERS, resolveGeoDemographicTradeTier,
  parseTruckCount, tierForTrucks, recommendTier, formatPrice, pricingAnswer, isPricingQuestion,
};
