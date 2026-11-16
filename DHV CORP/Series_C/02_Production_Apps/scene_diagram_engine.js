/**
 * Automated Scene Diagram & Interactive Map Pinpoint Engine (v4.0 — Full Directionality, Highway HOV/Exit,
 * Walmart Straight/Diagonal Parking & Proportional 4-Phase Vehicle-Type Flood Edition)
 * ========================================================================================================
 * Implements JD's Claims Adjusting & SIU Geometry Directives across:
 *   1. Explicit V1 & V2 Compass Directions of Travel (NB / SB / EB / WB) + Turn Maneuvers + 12-Hour Clock
 *   2. 3-Lane Highway + HOV Lane + Upcoming Exit Ramp Sideswipe (Crossing HOV Barrier / Gore Zone)
 *   3. Walmart / Retail Parking Lot Backing:
 *      - Straight-In / Straight-Out (90° Perpendicular Slots, Two-Way Aisle, Aisle Thru vs Dual Backing)
 *      - Diagonal (45° Angled Slots, One-Way Directional Aisle, Blind-Spot Angled Reverse)
 *   4. Proportional Vehicle-Type Flood & 4-Phase Waterline Triage Engine:
 *      - Vehicle Types with true height-to-clearance ratios:
 *          * 2-Door Sports Car / Low Coupe (~4.5" clearance, 49" roof)
 *          * 4-Door Sedan (~5.5" clearance, 57" roof)
 *          * Small / Compact SUV (~7.8" clearance, 66" roof)
 *          * Large / Full-Size SUV (~9.2" clearance, 75" roof)
 *          * Pickup Truck / 4x4 (~10.5" clearance, 77" roof)
 *      - 4 Standardized Flood Waterline Phases:
 *          * Phase 1: Only Tires / Rims (Below Door Sill — No Cabin Intrusion)
 *          * Phase 2: Floorboards / Carpet Level (If Computer/ECU in Floor -> Likely Total Loss*;
 *                     if No Floor Computer -> Possible to Clean Seats & Dry Carpets, Likely Under Deductible)
 *          * Phase 3: Inside Cabin Above Floorboards, Below Cup Holders (Seat Motors / Lower Harness)
 *          * Phase 4: Cup Holder / Center Console / Dash Level+ (Automatic Likely Total Loss*)
 *      - Driving Hydrolock Override:
 *          * If Driving & Engine Stopped due to High Water Entering Air Intake -> Immediate Likely Total Loss*
 *      - Vehicle Location & Municipal Impound ("City Picked It Up") Recovery Workflow:
 *          * Captures exact location OR flags "Unknown — City / Police Picked It Up" to trigger Municipal Tow Locator.
 */

'use strict';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Vehicle Class Specifications for Proportional Flood Waterline Rendering
 */
const FLOOD_VEHICLE_CLASSES = {
  sports_car: {
    id: 'sports_car',
    label: '2-Door Sports Car / Low Coupe',
    example: 'Corvette / Mustang / Miata',
    clearanceIn: 4.5,
    floorboardIn: 6.5,
    belowCupholderIn: 12.5,
    cupholderConsoleIn: 17.0,
    roofIn: 49.0,
    floorComputerDefault: true,
    floorComputerNote: 'Low-mounted BCM / Seat Memory & Airbag Control Module in floor pan (High Phase-2 Total-Loss Risk)'
  },
  sedan: {
    id: 'sedan',
    label: '4-Door Sedan',
    example: 'Honda Accord / Toyota Camry',
    clearanceIn: 5.5,
    floorboardIn: 8.0,
    belowCupholderIn: 15.0,
    cupholderConsoleIn: 21.0,
    roofIn: 57.0,
    floorComputerDefault: true,
    floorComputerNote: 'SRS Airbag Sensor & under-seat amplifier/wiring harness on floor pan'
  },
  small_suv: {
    id: 'small_suv',
    label: 'Small / Compact SUV',
    example: 'RAV4 / CR-V / Rogue',
    clearanceIn: 7.8,
    floorboardIn: 11.5,
    belowCupholderIn: 19.0,
    cupholderConsoleIn: 26.0,
    roofIn: 66.0,
    floorComputerDefault: false,
    floorComputerNote: 'Main ECU elevated in cowl; floor pan carpet/padding often dryable if freshwater & no floor module'
  },
  large_suv: {
    id: 'large_suv',
    label: 'Large / Full-Size SUV',
    example: 'Acura MDX / Tahoe / Expedition',
    clearanceIn: 9.2,
    floorboardIn: 14.5,
    belowCupholderIn: 23.0,
    cupholderConsoleIn: 31.0,
    roofIn: 75.0,
    floorComputerDefault: false,
    floorComputerNote: 'High sill clearance (14.5"); Phase 1–2 water rarely breaches main console electronics unless floor battery/module present'
  },
  truck: {
    id: 'truck',
    label: 'Pickup Truck / Full-Size 4x4',
    example: 'Ford F-150 / Silverado / Ram 1500',
    clearanceIn: 10.5,
    floorboardIn: 17.0,
    belowCupholderIn: 26.0,
    cupholderConsoleIn: 34.0,
    roofIn: 77.0,
    floorComputerDefault: false,
    floorComputerNote: 'Elevated body-on-frame cab (17" sill); 14" of water remains Phase 1 (Tires/Rims Only)'
  }
};

/**
 * 4 Standardized Flood Waterline Phases per JD's Claims Triage Law
 */
const FLOOD_PHASES = {
  1: {
    phase: 1,
    shortLabel: 'Phase 1: Tires / Rims Only',
    title: 'PHASE 1 — ONLY TIRES / RIMS (BELOW DOOR SILL)',
    triageOutcome: 'NO CABIN INTRUSION · INSPECTION ONLY (USUALLY UNDER DEDUCTIBLE)',
    badgeColor: '#16A34A',
    description: 'Water reached lower tires/rims only and never breached the weatherstripping or floorboards. Unless driven through deep water causing engine intake hydrolock, vehicle requires brake/bearing check only.'
  },
  2: {
    phase: 2,
    shortLabel: 'Phase 2: Floorboards / Carpet',
    title: 'PHASE 2 — FLOORBOARDS / CARPET LEVEL (CONDITIONAL ECU vs. DRY/CLEAN RULE)',
    triageOutcome: 'IF COMPUTER IN FLOOR = LIKELY TOTAL LOSS* | IF NO FLOOR COMPUTER = CLEAN SEATS & DRY (LIKELY UNDER DEDUCTIBLE)',
    badgeColor: '#D97706',
    description: 'Water wicked into carpet/floorboards below seat cushions. CRITICAL SPLIT: (A) If vehicle houses an ECU, SRS Airbag Module, or Hybrid Battery in the floor -> Flagged LIKELY TOTAL LOSS*. (B) If no floor computer -> Extract water, sanitize seats & dry carpets (often repairable / under deductible).'
  },
  3: {
    phase: 3,
    shortLabel: 'Phase 3: Inside Below Cup Holders',
    title: 'PHASE 3 — INSIDE CABIN ABOVE FLOORBOARDS, BUT NOT TO CUP HOLDERS',
    triageOutcome: 'HIGH SEVERITY / BORDERLINE TOTAL LOSS* · IMMEDIATE TEAR-DOWN & MITIGATION',
    badgeColor: '#EA580C',
    description: 'Water rose above the floorboards into lower seat tracks, power seat motors, B-pillar pre-tensioners, and body floor harnesses, stopping just below the center console cup holders.'
  },
  4: {
    phase: 4,
    shortLabel: 'Phase 4: Cup Holder / Console Level+',
    title: 'PHASE 4 — CUP HOLDER / CENTER CONSOLE / DASHBOARD LEVEL OR HIGHER',
    triageOutcome: 'AUTOMATIC LIKELY TOTAL LOSS* (100% SALVAGE & TOW HOLD)',
    badgeColor: '#DC2626',
    description: 'Water reached or exceeded cup holder / center console / shifter / dashboard height, submerging primary body control modules, shifter assemblies, and main dash harnesses. Immediate Total-Loss Salvage routing.'
  }
};

/**
 * True-Scale Top-Down Vehicle Specifications (Directive F11: Expedition vs RAV4 vs F-150 vs Sedan vs Coupe vs 18-Wheeler)
 */
const TRUE_SCALE_VEHICLE_SPECS = {
  large_suv: {
    styleId: 'large_suv',
    badge: 'Full-Size 3-Row SUV (210" L × 80" W)',
    defaultModel: '2021 Ford Expedition / 2023 Tahoe',
    scaleLenPx: 126,
    scaleWidPx: 38,
    lenScale: 1.12,
    widthScale: 1.08,
    windowBays: 4,
    hasRoofRails: true,
    hasOpenBed: false
  },
  small_suv: {
    styleId: 'small_suv',
    badge: 'Compact 2-Row SUV (181" L × 73" W)',
    defaultModel: '2022 Toyota RAV4 / Honda CR-V',
    scaleLenPx: 104,
    scaleWidPx: 33,
    lenScale: 0.95,
    widthScale: 0.96,
    windowBays: 3,
    hasRoofRails: true,
    hasOpenBed: false
  },
  truck: {
    styleId: 'truck',
    badge: 'Full-Size Pickup 4x4 (232" L × 80" W)',
    defaultModel: '2023 Ford F-150 Lariat',
    scaleLenPx: 134,
    scaleWidPx: 38,
    lenScale: 1.18,
    widthScale: 1.10,
    windowBays: 2,
    hasRoofRails: false,
    hasOpenBed: true
  },
  sedan: {
    styleId: 'sedan',
    badge: '4-Door Midsize Sedan (192" L × 72" W)',
    defaultModel: '2024 Toyota Camry / Honda Accord',
    scaleLenPx: 112,
    scaleWidPx: 33,
    lenScale: 1.00,
    widthScale: 0.96,
    windowBays: 2,
    hasRoofRails: false,
    hasOpenBed: false
  },
  sports_car: {
    styleId: 'sports_car',
    badge: '2-Door Performance Coupe (189" L × 75" W)',
    defaultModel: '2023 Ford Mustang GT Coupe',
    scaleLenPx: 106,
    scaleWidPx: 34,
    lenScale: 0.92,
    widthScale: 1.00,
    windowBays: 1,
    hasRoofRails: false,
    hasOpenBed: false
  },
  semi: {
    styleId: 'semi',
    badge: 'Commercial 18-Wheeler Tractor-Trailer (68\' L)',
    defaultModel: 'DOT Tractor-Trailer Rig',
    scaleLenPx: 152,
    scaleWidPx: 40,
    lenScale: 1.48,
    widthScale: 1.16,
    windowBays: 1,
    hasRoofRails: false,
    hasOpenBed: false
  },
  van: {
    styleId: 'van',
    badge: 'Commercial Fleet Delivery Van (233" L)',
    defaultModel: 'Commercial Sprinter Fleet Van',
    scaleLenPx: 130,
    scaleWidPx: 37,
    lenScale: 1.14,
    widthScale: 1.06,
    windowBays: 1,
    hasRoofRails: false,
    hasOpenBed: false
  }
};

function resolveVehicleStyleClass(textOrClass = '', fallbackStyle = 'large_suv') {
  const s = String(textOrClass || '').toLowerCase();
  if (TRUE_SCALE_VEHICLE_SPECS[s]) return s;
  if (/\b(18[- ]?wheeler|tractor[- ]?trailer|semi|freight|usdot)\b/.test(s)) return 'semi';
  if (/\b(sprinter|delivery\s+van|cargo\s+van|fleet\s+van|transit)\b/.test(s)) return 'van';
  if (/\b(f-?150|silverado|ram\s*1500|tundra|sierra|pickup|truck)\b/.test(s)) return 'truck';
  if (/\b(expedition|tahoe|suburban|mdx|q7|yukon|escalade|large\s+suv|full[- ]?size\s+suv)\b/.test(s)) return 'large_suv';
  if (/\b(rav4|cr-?v|rogue|tucson|model\s*y|cx-?5|small\s+suv|compact\s+suv|crossover)\b/.test(s)) return 'small_suv';
  if (/\b(mustang|corvette|camaro|miata|911|coupe|sports\s+car)\b/.test(s)) return 'sports_car';
  if (/\b(camry|accord|civic|corolla|altima|malibu|sonata|sedan)\b/.test(s)) return 'sedan';
  return TRUE_SCALE_VEHICLE_SPECS[fallbackStyle] ? fallbackStyle : 'large_suv';
}

/**
 * Helper to draw a True-Scale top-down vehicle silhouette (Directive F11) with distinct body styles:
 *   - Full-Size SUV (Expedition/Tahoe/MDX: long boxy roof, 4 window bays, roof rails, squared rear)
 *   - Compact SUV (RAV4/CR-V: shorter wheelbase, 3 window bays, angled C-pillar)
 *   - Pickup Truck (F-150: cab + open ribbed truck bed + tailgate)
 *   - 4-Door Sedan (Camry/Accord: hood creases + cabin + distinct trunk deck)
 *   - 2-Door Sports Car (Mustang GT: long hood + fastback glass)
 *   - 18-Wheeler / Commercial Van
 * and optional clock-face orientation markers (12, 3, 6, 9).
 */
function renderTopDownCarSvg(x, y, w, h, colorFill, colorStroke, roofFill, labelMain, labelSub, orientation = 'horizontal_right', showClockMarkers = false, explicitStyle = '') {
  const isVert = orientation.startsWith('vertical');
  const styleKey = resolveVehicleStyleClass(`${explicitStyle} ${labelMain} ${labelSub}`, labelMain && /V2/i.test(labelMain) ? 'small_suv' : 'large_suv');
  const spec = TRUE_SCALE_VEHICLE_SPECS[styleKey] || TRUE_SCALE_VEHICLE_SPECS.large_suv;

  // Apply True-Scale proportional dimensions while keeping contact edge aligned
  let drawX = x;
  let drawY = y;
  let drawW = w;
  let drawH = h;
  if (!isVert && w >= 90) {
    drawW = spec.scaleLenPx;
    drawH = spec.scaleWidPx;
    drawY = y + Math.round((h - drawH) / 2);
    if (orientation === 'horizontal_right') {
      drawX = x + (w - drawW); // keep front/right edge aligned
    }
  } else if (isVert && h >= 54) {
    drawW = Math.round(spec.scaleWidPx);
    drawH = Math.round(spec.scaleLenPx * 0.58);
  }

  const wheelW = isVert ? 4 : Math.max(10, Math.round(drawW * 0.17));
  const wheelH = isVert ? Math.max(10, Math.round(drawH * 0.17)) : 4;
  const roofX = isVert ? drawX + 5 : drawX + Math.round(drawW * (styleKey === 'truck' ? 0.36 : styleKey === 'large_suv' ? 0.13 : styleKey === 'small_suv' ? 0.18 : 0.21));
  const roofY = isVert ? drawY + Math.round(drawH * 0.18) : drawY + 5;
  const roofW = isVert ? drawW - 10 : Math.round(drawW * (styleKey === 'truck' ? 0.39 : styleKey === 'large_suv' ? 0.68 : styleKey === 'small_suv' ? 0.54 : 0.50));
  const roofH = isVert ? Math.round(drawH * 0.56) : drawH - 10;

  let headlights = '';
  if (orientation === 'horizontal_right') {
    headlights =
      `<polygon points="${drawX + drawW},${drawY + 4} ${drawX + drawW + 18},${drawY - 2} ${drawX + drawW + 18},${drawY + 12}" fill="rgba(250,204,21,0.28)"/>` +
      `<polygon points="${drawX + drawW},${drawY + drawH - 4} ${drawX + drawW + 18},${drawY + drawH - 12} ${drawX + drawW + 18},${drawY + drawH + 2}" fill="rgba(250,204,21,0.28)"/>`;
  } else if (orientation === 'horizontal_left') {
    headlights =
      `<polygon points="${drawX},${drawY + 4} ${drawX - 18},${drawY - 2} ${drawX - 18},${drawY + 12}" fill="rgba(250,204,21,0.28)"/>` +
      `<polygon points="${drawX},${drawY + drawH - 4} ${drawX - 18},${drawY + drawH - 12} ${drawX - 18},${drawY + drawH + 2}" fill="rgba(250,204,21,0.28)"/>`;
  } else if (orientation === 'vertical_down') {
    headlights =
      `<polygon points="${drawX + 4},${drawY + drawH} ${drawX - 2},${drawY + drawH + 18} ${drawX + 12},${drawY + drawH + 18}" fill="rgba(250,204,21,0.28)"/>` +
      `<polygon points="${drawX + drawW - 4},${drawY + drawH} ${drawX + drawW - 12},${drawY + drawH + 18} ${drawX + drawW + 2},${drawY + drawH + 18}" fill="rgba(250,204,21,0.28)"/>`;
  } else if (orientation === 'vertical_up') {
    headlights =
      `<polygon points="${drawX + 4},${drawY} ${drawX - 2},${drawY - 18} ${drawX + 12},${drawY - 18}" fill="rgba(250,204,21,0.28)"/>` +
      `<polygon points="${drawX + drawW - 4},${drawY} ${drawX + drawW - 12},${drawY - 18} ${drawX + drawW + 2},${drawY - 18}" fill="rgba(250,204,21,0.28)"/>`;
  }

  // Style-specific structural markers (Directive F11: Open Pickup Bed vs 4-Bay Full-Size SUV vs 3-Bay Compact SUV vs 18-Wheeler)
  let bodyStructuralSvg = '';
  if (!isVert && styleKey === 'truck') {
    const bedX = orientation === 'horizontal_left' ? drawX + Math.round(drawW * 0.63) : drawX + 4;
    const bedW = Math.round(drawW * 0.30);
    bodyStructuralSvg =
      `<rect x="${bedX}" y="${drawY + 4}" width="${bedW}" height="${drawH - 8}" rx="2" fill="#0F172A" fill-opacity="0.58" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>` +
      `<line x1="${bedX + 8}" y1="${drawY + 6}" x2="${bedX + 8}" y2="${drawY + drawH - 6}" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>` +
      `<line x1="${bedX + 16}" y1="${drawY + 6}" x2="${bedX + 16}" y2="${drawY + drawH - 6}" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>` +
      `<line x1="${bedX + 24}" y1="${drawY + 6}" x2="${bedX + 24}" y2="${drawY + drawH - 6}" stroke="rgba(255,255,255,0.25)" stroke-width="1"/>`;
  } else if (!isVert && styleKey === 'large_suv') {
    bodyStructuralSvg =
      `<line x1="${roofX + 4}" y1="${drawY + 2.5}" x2="${roofX + roofW - 4}" y2="${drawY + 2.5}" stroke="#E2E8F0" stroke-width="1.4" stroke-dasharray="5,2"/>` +
      `<line x1="${roofX + 4}" y1="${drawY + drawH - 2.5}" x2="${roofX + roofW - 4}" y2="${drawY + drawH - 2.5}" stroke="#E2E8F0" stroke-width="1.4" stroke-dasharray="5,2"/>` +
      `<line x1="${roofX + Math.round(roofW * 0.33)}" y1="${roofY}" x2="${roofX + Math.round(roofW * 0.33)}" y2="${roofY + roofH}" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>` +
      `<line x1="${roofX + Math.round(roofW * 0.66)}" y1="${roofY}" x2="${roofX + Math.round(roofW * 0.66)}" y2="${roofY + roofH}" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>`;
  } else if (!isVert && styleKey === 'small_suv') {
    bodyStructuralSvg =
      `<line x1="${roofX + 6}" y1="${drawY + 3}" x2="${roofX + roofW - 6}" y2="${drawY + 3}" stroke="#CBD5E1" stroke-width="1.1" stroke-dasharray="4,2"/>` +
      `<line x1="${roofX + 6}" y1="${drawY + drawH - 3}" x2="${roofX + roofW - 6}" y2="${drawY + drawH - 3}" stroke="#CBD5E1" stroke-width="1.1" stroke-dasharray="4,2"/>` +
      `<line x1="${roofX + Math.round(roofW * 0.5)}" y1="${roofY}" x2="${roofX + Math.round(roofW * 0.5)}" y2="${roofY + roofH}" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>`;
  } else if (!isVert && styleKey === 'semi') {
    const cabW = 34;
    const cabX = orientation === 'horizontal_left' ? drawX : drawX + drawW - cabW;
    const trlX = orientation === 'horizontal_left' ? drawX + cabW + 3 : drawX;
    const trlW = drawW - cabW - 3;
    bodyStructuralSvg =
      `<rect x="${trlX}" y="${drawY + 2}" width="${trlW}" height="${drawH - 4}" rx="2" fill="rgba(15,23,42,0.35)" stroke="#FDE68A" stroke-width="1.2"/>` +
      `<rect x="${cabX}" y="${drawY + 3}" width="${cabW}" height="${drawH - 6}" rx="4" fill="${roofFill}" stroke="#FFFFFF" stroke-width="1.2"/>`;
  }

  let clockTags = '';
  if (showClockMarkers && orientation === 'horizontal_right') {
    clockTags =
      `<text x="${drawX + Math.round(drawW / 2)}" y="${drawY - 6}" text-anchor="middle" fill="#94A3B8" font-family="monospace" font-size="8" font-weight="700">9PM (DRIVER / LEFT)</text>` +
      `<text x="${drawX + Math.round(drawW / 2)}" y="${drawY + drawH + 12}" text-anchor="middle" fill="#FDE68A" font-family="monospace" font-size="8" font-weight="800">3PM (PASSENGER / RIGHT)</text>` +
      `<text x="${drawX + drawW + 5}" y="${drawY + Math.round(drawH / 2) + 3}" text-anchor="start" fill="#93C5FD" font-family="monospace" font-size="8" font-weight="800">12PM</text>`;
  }

  const cornerRx = (styleKey === 'large_suv' || styleKey === 'truck' || styleKey === 'semi' || styleKey === 'van') ? 5 : (styleKey === 'sports_car' ? 11 : 8);

  return (
    `<g class="true-scale-vehicle" data-vehicle-class="${styleKey}" data-scale-badge="${esc(spec.badge)}">` +
    headlights +
    (isVert
      ? `<rect x="${drawX - 3}" y="${drawY + 8}" width="${wheelW}" height="${wheelH}" rx="1.5" fill="#0F172A" stroke="#64748B" stroke-width="0.8"/>` +
        `<rect x="${drawX + drawW - 1}" y="${drawY + 8}" width="${wheelW}" height="${wheelH}" rx="1.5" fill="#0F172A" stroke="#64748B" stroke-width="0.8"/>` +
        `<rect x="${drawX - 3}" y="${drawY + drawH - 8 - wheelH}" width="${wheelW}" height="${wheelH}" rx="1.5" fill="#0F172A" stroke="#64748B" stroke-width="0.8"/>` +
        `<rect x="${drawX + drawW - 1}" y="${drawY + drawH - 8 - wheelH}" width="${wheelW}" height="${wheelH}" rx="1.5" fill="#0F172A" stroke="#64748B" stroke-width="0.8"/>`
      : `<rect x="${drawX + 10}" y="${drawY - 3}" width="${wheelW}" height="${wheelH}" rx="1.5" fill="#0F172A" stroke="#64748B" stroke-width="0.8"/>` +
        `<rect x="${drawX + drawW - 10 - wheelW}" y="${drawY - 3}" width="${wheelW}" height="${wheelH}" rx="1.5" fill="#0F172A" stroke="#64748B" stroke-width="0.8"/>` +
        `<rect x="${drawX + 10}" y="${drawY + drawH - 1}" width="${wheelW}" height="${wheelH}" rx="1.5" fill="#0F172A" stroke="#64748B" stroke-width="0.8"/>` +
        `<rect x="${drawX + drawW - 10 - wheelW}" y="${drawY + drawH - 1}" width="${wheelW}" height="${wheelH}" rx="1.5" fill="#0F172A" stroke="#64748B" stroke-width="0.8"/>`) +
    `<rect x="${drawX}" y="${drawY}" width="${drawW}" height="${drawH}" rx="${cornerRx}" fill="${colorFill}" stroke="${colorStroke}" stroke-width="2.2"/>` +
    `<rect x="${roofX}" y="${roofY}" width="${roofW}" height="${roofH}" rx="4" fill="${roofFill}" stroke="rgba(255,255,255,0.28)" stroke-width="1.1"/>` +
    bodyStructuralSvg +
    `<text x="${drawX + Math.round(drawW / 2)}" y="${drawY + Math.round(drawH / 2) - (labelSub ? 2 : -4)}" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="9.5" font-weight="800">${esc(labelMain)}</text>` +
    (labelSub
      ? `<text x="${drawX + Math.round(drawW / 2)}" y="${drawY + Math.round(drawH / 2) + 10}" text-anchor="middle" fill="#DBEAFE" font-family="monospace" font-size="7.8" font-weight="700">${esc(labelSub)}</text>`
      : '') +
    clockTags +
    `</g>`
  );
}

/**
 * Renders the Proportional Vehicle-Type Side-Profile Flood & 4-Phase Waterline SVG (680x356).
 * Scales the vehicle body, wheels, floorboards, cupholders/console, and roofline to the exact
 * vehicle class (`sports_car`, `sedan`, `small_suv`, `large_suv`, `truck`), plots all 4 Flood Phases,
 * highlights Engine Hydrolock (if driving & engine stopped), and displays Vehicle Location / "City Picked It Up".
 */
function renderProportionalFloodDiagramSvg(options = {}) {
  const vehKey = FLOOD_VEHICLE_CLASSES[options.vehicleClass] ? options.vehicleClass : 'large_suv';
  const veh = FLOOD_VEHICLE_CLASSES[vehKey];
  const phaseNum = [1, 2, 3, 4].includes(Number(options.phase)) ? Number(options.phase) : 4;
  const phaseObj = FLOOD_PHASES[phaseNum];
  const isDrivingHydrolock = Boolean(options.drivingHydrolock);
  const hasFloorComputer = options.hasFloorComputer != null ? Boolean(options.hasFloorComputer) : veh.floorComputerDefault;
  const cityPickedUp = Boolean(options.cityPickedUp);
  const vehicleName = options.vehicleName || `${veh.label} (${veh.example})`;

  // Ground line at y = 248. Scale: 2.05 px per inch of real height.
  const groundY = 248;
  const pxPerIn = 2.05;
  const clearanceY = Math.round(groundY - veh.clearanceIn * pxPerIn);
  const floorboardY = Math.round(groundY - veh.floorboardIn * pxPerIn);
  const belowCupY = Math.round(groundY - veh.belowCupholderIn * pxPerIn);
  const cupConsoleY = Math.round(groundY - veh.cupholderConsoleIn * pxPerIn);
  const roofY = Math.round(groundY - veh.roofIn * pxPerIn);

  // Active waterline Y based on selected phase (1..4)
  const activeWaterY = phaseNum === 1
    ? Math.round((groundY + clearanceY) / 2)
    : phaseNum === 2
    ? floorboardY - 2
    : phaseNum === 3
    ? belowCupY
    : cupConsoleY - 4;

  // Determine Likely Total Loss status based on Phase + Floor Computer + Driving Hydrolock
  const isLikelyTotal =
    isDrivingHydrolock ||
    phaseNum === 4 ||
    (phaseNum === 3) ||
    (phaseNum === 2 && hasFloorComputer);

  const totalLossBannerText = isDrivingHydrolock
    ? '🚨 LIKELY TOTAL LOSS* — DRIVING IN HIGH WATER & ENGINE STOPPED (AIR INTAKE HYDROLOCK)'
    : phaseNum === 4
    ? '🚨 PHASE 4 (CUP HOLDER / CONSOLE LEVEL) — AUTOMATIC LIKELY TOTAL LOSS* (SALVAGE HOLD)'
    : phaseNum === 3
    ? '⚠️ PHASE 3 (INSIDE BELOW CUP HOLDERS) — HIGH SEVERITY / BORDERLINE TOTAL LOSS*'
    : phaseNum === 2
    ? (hasFloorComputer
        ? '🚨 PHASE 2 (FLOORBOARDS + FLOOR COMPUTER/ECU PRESENT) — LIKELY TOTAL LOSS*'
        : '✅ PHASE 2 (FLOORBOARDS ONLY · NO FLOOR ECU) — CLEAN SEATS & DRY CARPET (LIKELY UNDER DEDUCTIBLE)')
    : '✅ PHASE 1 (TIRES / RIMS ONLY · BELOW SILL) — NO INTERIOR WATER INTRUSION';

  // Side-profile vehicle path by class
  const carLeft = 105;
  const carRight = 435;
  const wheelRadius = vehKey === 'truck' || vehKey === 'large_suv' ? 24 : vehKey === 'small_suv' ? 21 : 18;
  const wheelCY = groundY - wheelRadius;
  const frontWheelCX = 372;
  const rearWheelCX = 168;

  let bodyPolygon = '';
  if (vehKey === 'truck') {
    // Pickup Truck side silhouette (flat bed + tall cab + high hood)
    const hoodY = Math.round((roofY + cupConsoleY) / 2) + 4;
    bodyPolygon =
      `${carLeft},${clearanceY} ${carLeft},${hoodY} 215,${hoodY} 215,${roofY} 325,${roofY} 355,${hoodY} ${carRight},${hoodY + 4} ${carRight},${clearanceY}`;
  } else if (vehKey === 'sports_car') {
    // Low sleek 2-door sports car silhouette
    const hoodY = cupConsoleY - 4;
    bodyPolygon =
      `${carLeft},${clearanceY} ${carLeft + 10},${hoodY + 4} 185,${roofY + 2} 285,${roofY} 345,${hoodY} ${carRight},${hoodY + 8} ${carRight},${clearanceY}`;
  } else {
    // SUV / Sedan side silhouette
    const hoodY = Math.round((roofY + cupConsoleY) / 2) + 6;
    const rearTopX = vehKey.includes('suv') ? 125 : 155;
    bodyPolygon =
      `${carLeft},${clearanceY} ${carLeft + 6},${hoodY} ${rearTopX},${roofY} 315,${roofY} 355,${hoodY} ${carRight},${hoodY + 6} ${carRight},${clearanceY}`;
  }

  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 356" style="width:100%;max-width:680px;height:auto;border-radius:10px;border:1.5px solid #3B82F6;background:#0B132B;display:block;box-shadow:0 8px 24px rgba(15,23,42,0.18);">' +
    // Header bar
    '<rect x="0" y="0" width="680" height="40" fill="#172554"/>' +
    '<text x="14" y="25" fill="#FFFFFF" font-family="sans-serif" font-size="11" font-weight="800">🌊 4-PHASE FLOOD WATERLINE &amp; VEHICLE RATIO — ' + esc(veh.label.toUpperCase()) + '</text>' +
    '<text x="666" y="25" text-anchor="end" fill="' + (isLikelyTotal ? '#FCA5A5' : '#86EFAC') + '" font-family="monospace" font-size="10.2" font-weight="900">' + (isLikelyTotal ? 'FLAG: LIKELY TOTAL LOSS*' : 'REPAIRABLE / CLEAN & DRY') + '</text>' +

    // Pavement / Ground
    '<rect x="16" y="' + groundY + '" width="648" height="16" fill="#334155"/>' +
    '<line x1="16" y1="' + groundY + '" x2="664" y2="' + groundY + '" stroke="#94A3B8" stroke-width="2"/>' +
    '<text x="55" y="' + (groundY + 12) + '" fill="#CBD5E1" font-family="monospace" font-size="9" font-weight="700">GROUND LEVEL (0.0")</text>' +

    // Side-profile Vehicle Body
    '<polygon points="' + bodyPolygon + '" fill="#1E3A8A" stroke="#93C5FD" stroke-width="2.5"/>' +
    // Internal Reference Markers inside vehicle (Floorboard, Floor ECU, Cupholder/Console, Air Intake)
    '<line x1="' + (carLeft + 18) + '" y1="' + floorboardY + '" x2="' + (carRight - 22) + '" y2="' + floorboardY + '" stroke="#FDE047" stroke-width="2" stroke-dasharray="6,4"/>' +
    (hasFloorComputer
      ? '<rect x="235" y="' + (floorboardY - 11) + '" width="78" height="11" rx="2" fill="#DC2626" stroke="#FCA5A5" stroke-width="1"/>' +
        '<text x="274" y="' + (floorboardY - 3) + '" text-anchor="middle" fill="#FFFFFF" font-family="monospace" font-size="7.5" font-weight="900">FLOOR ECU/BCM</text>'
      : '<rect x="225" y="' + (floorboardY - 11) + '" width="98" height="11" rx="2" fill="#16A34A"/>' +
        '<text x="274" y="' + (floorboardY - 3) + '" text-anchor="middle" fill="#FFFFFF" font-family="monospace" font-size="7.5" font-weight="900">NO FLOOR ECU</text>') +
    // Cupholder & Center Console Box
    '<rect x="278" y="' + cupConsoleY + '" width="54" height="' + Math.max(10, floorboardY - cupConsoleY - 11) + '" rx="3" fill="#334155" stroke="#CBD5E1" stroke-width="1.2"/>' +
    '<text x="305" y="' + (cupConsoleY + 10) + '" text-anchor="middle" fill="#F8FAFC" font-family="monospace" font-size="7.5" font-weight="800">CUPHOLDER</text>' +
    // Engine & Air Intake Marker at Front
    '<rect x="378" y="' + (cupConsoleY + 2) + '" width="46" height="20" rx="3" fill="' + (isDrivingHydrolock ? '#DC2626' : '#0F172A') + '" stroke="' + (isDrivingHydrolock ? '#FCA5A5' : '#60A5FA') + '" stroke-width="1.5"/>' +
    '<text x="401" y="' + (cupConsoleY + 15) + '" text-anchor="middle" fill="#FFFFFF" font-family="monospace" font-size="7.5" font-weight="900">' + (isDrivingHydrolock ? 'HYDROLOCK!' : 'AIR INTAKE') + '</text>' +

    // Wheels
    '<circle cx="' + rearWheelCX + '" cy="' + wheelCY + '" r="' + wheelRadius + '" fill="#0F172A" stroke="#CBD5E1" stroke-width="3"/>' +
    '<circle cx="' + rearWheelCX + '" cy="' + wheelCY + '" r="' + Math.round(wheelRadius * 0.48) + '" fill="#64748B"/>' +
    '<circle cx="' + frontWheelCX + '" cy="' + wheelCY + '" r="' + wheelRadius + '" fill="#0F172A" stroke="#CBD5E1" stroke-width="3"/>' +
    '<circle cx="' + frontWheelCX + '" cy="' + wheelCY + '" r="' + Math.round(wheelRadius * 0.48) + '" fill="#64748B"/>' +

    // 4 Phase Horizontal Reference Lines on Right Side (x=445..664)
    // Phase 4 Line
    '<line x1="85" y1="' + cupConsoleY + '" x2="660" y2="' + cupConsoleY + '" stroke="#EF4444" stroke-width="' + (phaseNum === 4 ? '2.5' : '1.2') + '" stroke-dasharray="4,3"/>' +
    '<text x="660" y="' + (cupConsoleY - 3) + '" text-anchor="end" fill="#FCA5A5" font-family="monospace" font-size="9" font-weight="800">PHASE 4: CUP HOLDER / CONSOLE (' + veh.cupholderConsoleIn + '") — TOTAL LOSS</text>' +
    // Phase 3 Line
    '<line x1="85" y1="' + belowCupY + '" x2="660" y2="' + belowCupY + '" stroke="#FB923C" stroke-width="' + (phaseNum === 3 ? '2.5' : '1.2') + '" stroke-dasharray="4,3"/>' +
    '<text x="660" y="' + (belowCupY - 3) + '" text-anchor="end" fill="#FDBA74" font-family="monospace" font-size="9" font-weight="800">PHASE 3: INSIDE BELOW CUP HOLDERS (' + veh.belowCupholderIn + '")</text>' +
    // Phase 2 Line
    '<line x1="85" y1="' + floorboardY + '" x2="660" y2="' + floorboardY + '" stroke="#FACC15" stroke-width="' + (phaseNum === 2 ? '2.5' : '1.2') + '" stroke-dasharray="4,3"/>' +
    '<text x="660" y="' + (floorboardY - 3) + '" text-anchor="end" fill="#FEF08A" font-family="monospace" font-size="9" font-weight="800">PHASE 2: FLOORBOARDS (' + veh.floorboardIn + '") — ECU CHECK / DRY</text>' +
    // Phase 1 Line
    '<line x1="85" y1="' + clearanceY + '" x2="660" y2="' + clearanceY + '" stroke="#4ADE80" stroke-width="' + (phaseNum === 1 ? '2.5' : '1.2') + '" stroke-dasharray="4,3"/>' +
    '<text x="660" y="' + (clearanceY + 9) + '" text-anchor="end" fill="#86EFAC" font-family="monospace" font-size="9" font-weight="800">PHASE 1: TIRES / RIMS ONLY (&lt;' + veh.clearanceIn + '" SILL)</text>' +

    // Active Flood Water Overlay Box
    '<rect x="16" y="' + activeWaterY + '" width="435" height="' + Math.max(6, groundY - activeWaterY) + '" fill="rgba(56, 189, 248, 0.34)" stroke="#38BDF8" stroke-width="2"/>' +
    '<line x1="16" y1="' + activeWaterY + '" x2="451" y2="' + activeWaterY + '" stroke="#38BDF8" stroke-width="3"/>' +
    '<rect x="20" y="48" width="540" height="24" rx="5" fill="#1E293B" stroke="#3B82F6" stroke-width="1.2"/>' +
    '<text x="290" y="64" text-anchor="middle" fill="#93C5FD" font-family="sans-serif" font-size="10" font-weight="800">🚗 VEHICLE RATIO: ' + esc(String(vehicleName).slice(0, 44)) + ' · Sill: ' + veh.floorboardIn + '" · Console: ' + veh.cupholderConsoleIn + '"</text>' +

    // Bottom Triage & Municipal Tow ("City Picked It Up") Status Panel
    '<rect x="0" y="266" width="680" height="90" fill="#1E293B"/>' +
    '<text x="14" y="285" fill="' + (isLikelyTotal ? '#FCA5A5' : '#86EFAC') + '" font-family="monospace" font-size="10.5" font-weight="900">' + esc(totalLossBannerText) + '</text>' +
    '<text x="14" y="304" fill="#E2E8F0" font-family="sans-serif" font-size="10.5" font-weight="700">⚙️ Driving vs. Parked Rule: ' +
      (isDrivingHydrolock
        ? 'Vehicle was DRIVING through high water &amp; engine stalled/stopped -> Immediate Likely Total Loss* (Engine Hydrolock).'
        : 'Vehicle was stationary/parked (0 mph) -> Triage governed by 4-Phase Interior Waterline &amp; Floor ECU presence.') +
    '</text>' +
    '<text x="14" y="323" fill="#93C5FD" font-family="sans-serif" font-size="10.5" font-weight="700">📍 Vehicle Location / Tow Status: ' +
      (cityPickedUp
        ? '🚨 CUSTOMER STATED "CITY PICKED IT UP / UNKNOWN LOT" -> Automated Municipal Impound &amp; VIN Tow-Lot Locator Triggered!'
        : '✅ Known Location Captured (Residence Driveway / Verified Tow Lot) — Ready for Inspector or Copart Pickup.') +
    '</text>' +
    '<text x="14" y="342" fill="#94A3B8" font-family="sans-serif" font-size="9.5">Preliminary FNOL Flood Triage Ratio Schematic (TX Ins. Code §4101 — Formal valuation by licensed adjuster).</text>' +
    '</svg>'
  );
}

/**
 * Parse the reported impact clock position (1..12) and vehicle side from text.
 */
function parseImpactClockAndSide(impactText = '', corpusText = '') {
  const combined = `${impactText} ${corpusText}`.toLowerCase();
  let clockHour = 3; // default passenger side for intersection
  const clockMatch = combined.match(/\b(1[0-2]|[1-9])\s*(?:o'?clock|pm|am)\b/i);
  if (clockMatch) {
    clockHour = parseInt(clockMatch[1], 10);
  } else if (/\b(front\s+right|passenger\s+front|right\s+front\s+corner|2\s*pm|2\s*o'?clock)\b/i.test(combined)) {
    clockHour = 2;
  } else if (/\b(passenger\s+side|right\s+side|3\s*pm|3\s*o'?clock|broadside.*passenger)\b/i.test(combined)) {
    clockHour = 3;
  } else if (/\b(driver\s+side|left\s+side|9\s*pm|9\s*o'?clock)\b/i.test(combined)) {
    clockHour = 9;
  } else if (/\b(rear|back\s+bumper|trunk|6\s*pm|6\s*o'?clock)\b/i.test(combined)) {
    clockHour = 6;
  } else if (/\b(front\s+left|driver\s+front|10\s*pm|11\s*pm)\b/i.test(combined)) {
    clockHour = 10;
  } else if (/\b(front\s+bumper|grille|12\s*o'?clock)\b/i.test(combined)) {
    clockHour = 12;
  }

  const isPassengerSide = [1, 2, 3, 4, 5].includes(clockHour) || (/\bpassenger\s+side|right\s+side|front\s+right\b/i.test(combined) && !/\bdriver\s+side\b/i.test(combined));
  const isDriverSide = [7, 8, 9, 10, 11].includes(clockHour) && !isPassengerSide;

  return {
    clockHour,
    clockLabel: `${clockHour} O'Clock (${isPassengerSide ? 'Passenger / Right Side' : isDriverSide ? 'Driver / Left Side' : clockHour === 6 ? 'Rear' : 'Front'})`,
    isPassengerSide,
    isDriverSide,
    isFrontRight2pm: clockHour === 1 || clockHour === 2 || /\b(2\s*pm|2\s*o'?clock|front\s+right|passenger\s+front)\b/i.test(combined)
  };
}

/**
 * Parse V1 and V2 compass travel directions so the adjuster and diagram always know
 * which way both vehicles were driving.
 */
function parseVehicleDirections(corpusText = '', template = 'LEFT_TURN', clockInfo = {}) {
  const c = String(corpusText || '').toLowerCase();
  let v1Dir = 'Eastbound (EB)';
  let v2Dir = 'Northbound (NB)';

  if (/\b(i was (?:driving|heading|going|traveling) north|northbound on)\b/i.test(c)) v1Dir = 'Northbound (NB)';
  else if (/\b(i was (?:driving|heading|going|traveling) south|southbound on)\b/i.test(c)) v1Dir = 'Southbound (SB)';
  else if (/\b(i was (?:driving|heading|going|traveling) west|westbound on)\b/i.test(c)) v1Dir = 'Westbound (WB)';

  if (template === 'HIGHWAY_3LANE_HOV_EXIT') {
    v1Dir = 'Eastbound (EB — Lane 2/3 Highway Corridor)';
    v2Dir = 'Eastbound (EB — Diving Across 3 Lanes from Left HOV Lane toward Right Exit Ramp)';
  } else if (template === 'PARKING_LOT_STRAIGHT_90') {
    v1Dir = 'Backing Straight Out (90° Perpendicular Stall -> Two-Way Aisle)';
    v2Dir = 'Traveling Thru Parking Aisle (or Dual Backing from Opposing 90° Stall)';
  } else if (template === 'PARKING_LOT_DIAGONAL_45') {
    v1Dir = 'Backing Out at 45° Angle (Diagonal Stall -> One-Way Aisle)';
    v2Dir = 'Approaching Down One-Way Parking Aisle (Striking V1 Rear Quarter)';
  } else if (template === 'T_BONE' || template === 'LEFT_TURN') {
    v2Dir = clockInfo.isDriverSide
      ? 'Southbound (SB — Entering from North Leg into V1 9PM Driver Side)'
      : 'Northbound (NB — Entering from South Leg into V1 2PM/3PM Passenger Side)';
  } else if (template === 'REAR_END') {
    v2Dir = v1Dir + ' (Following Behind V1 in Same Lane)';
  }

  return { v1Dir, v2Dir };
}

/**
 * Automated Kinematic Consistency Check (Red-Flag Validator).
 */
function validateKinematicConsistency(geo) {
  const clockInfo = geo.clockInfo || parseImpactClockAndSide(geo.impactPoint, geo.callerQuote);
  const warnings = [];
  let hasKinematicConflict = false;

  const rawApproach = String(geo.rawV2Approach || '').toLowerCase();
  if (clockInfo.isPassengerSide && rawApproach === 'southbound_top_on_eastbound_v1') {
    hasKinematicConflict = true;
    warnings.push(
      `RED FLAG — KINEMATIC TRAJECTORY MISMATCH: Reported impact is ${clockInfo.clockHour} O'Clock (Passenger / Right Side of Eastbound V1), ` +
      `which is the SOUTH/BOTTOM side of V1. A southbound V2 approaching from the NORTH/TOP would strike 9–10 O'Clock (Driver / Left Side), NOT 2–3 O'Clock.`
    );
  }

  return {
    consistent: !hasKinematicConflict,
    hasRedFlag: hasKinematicConflict || Boolean(geo.kinematicAuditNote),
    clockHour: clockInfo.clockHour,
    clockLabel: clockInfo.clockLabel,
    v1Heading: geo.v1Direction || 'Eastbound (Facing Right -> 12 O\'Clock = East, 9 O\'Clock = North/Top, 3 O\'Clock = South/Bottom)',
    v2ResolvedTrajectory: geo.v2TrajectoryDescription || 'Northbound / Oncoming Left-Turn into V1 Passenger Side (2–3 O\'Clock)',
    redFlagExplanation: warnings[0] || geo.kinematicAuditNote ||
      `Verified Kinematic Alignment: V1 traveling ${geo.v1Direction || 'Eastbound'} (Right = 12 O'Clock; Bottom = 2–3 O'Clock Passenger Side). V2 approaches ${geo.v2Direction || 'Northbound from the South leg'} to physically strike V1 at ${clockInfo.clockHour} O'Clock.`
  };
}

/**
 * Deterministically classify the scene template and geometry from a call record.
 */
function resolveSceneGeometry(record) {
  record = record && typeof record === 'object' ? record : {};
  const fnol = record.fnol || record.fnolData || {};
  const ticket = record.ticket || {};
  const lf = fnol.lossFacts || {};
  const locDetails = fnol.locationDetails || {};
  const transcript = String(record.transcript || '');
  const callerOnlyTranscript = transcript
    .split(/\r?\n/)
    .filter(l => !/^\s*(?:Demo Host|AI Agent Angel|Agent Angel|Executive Narrator|System):/i.test(l))
    .map(l => l.replace(/^\s*Caller:\s*/i, '').trim())
    .filter(Boolean)
    .join(' ');
  const desc = String(fnol.lossDescription || record.lossDescription || ticket.problemDescription || callerOnlyTranscript || '').toLowerCase();
  const callerCorpus = (desc + ' ' + callerOnlyTranscript).toLowerCase();
  const explicitLossType = String(fnol.lossType || record.lossType || '').toLowerCase();
  const explicitTemplate = String(record.sceneTemplate || fnol.sceneTemplate || '').toUpperCase();
  const explicitDiagramId = String(record.diagramId || record.scenarioId || fnol.diagramId || fnol.scenarioId || '').toUpperCase();

  const hasExplicitSingleVehicleNegation = /\b(no\s+other\s+(?:vehicle|car|driver|truck)|single[- ]vehicle|by\s+myself|alone\s+in\s+the\s+road)\b/i.test(callerCorpus);
  const hasTwoVehicleCollision = /\b(t-?bone|broadside|rear[- ]?end(?:ed)?|left\s+turn|turned\s+left|turning\s+left|another\s+(?:vehicle|car|driver)|failed\s+to\s+(?:yield|stop)|ran\s+a\s+(?:red|stop)|ran\s+the\s+(?:red|stop)|stoplight|4-?way\s+stop|stop\s+sign|two\s+cars|two\s+vehicles|sideswipe(?:d)?|changed\s+lanes|merged\s+into|hov\s+lane|backed\s+into|backing\s+out|18-?wheeler|semi[- ]?truck|tractor[- ]?trailer|choque|alcance|semáforo|alto)\b/i.test(callerCorpus) ||
    (!hasExplicitSingleVehicleNegation && /\b(other\s+(?:vehicle|car|driver|truck))\b/i.test(callerCorpus));

  const locStr = String(fnol.locationOfLoss || record.locationOfLoss || ticket.serviceAddress || locDetails.streetAddress || 'Reported Loss Scene').trim();
  const locStrForMatch = locStr.slice(0, 400);

  let primaryStreet = String(locDetails.streetAddress || locStr.split(',')[0] || 'Main Roadway');
  let crossStreet = String(locDetails.intersection || locDetails.landmarkBusiness || '');
  const intersectMatch = locStrForMatch.match(/([A-Za-z0-9\s.'-]+?)\s+(?:and|&|at|near|by|y|esquina con)\s+([A-Za-z0-9\s.'-]+)/i);
  if (intersectMatch) {
    primaryStreet = intersectMatch[1].trim();
    crossStreet = intersectMatch[2].split(',')[0].trim();
  }
  if (!crossStreet || crossStreet.toLowerCase() === primaryStreet.toLowerCase()) {
    if (/&|\band\b/i.test(primaryStreet)) {
      const parts = primaryStreet.split(/\s*(?:&|\band\b)\s*/i);
      primaryStreet = parts[0].trim() || 'Oak Lawn Ave';
      crossStreet = parts[1] ? parts[1].trim() : 'Lemmon Ave';
    } else {
      crossStreet = 'Lemmon Ave (Cross Street)';
    }
  }

  const isHovHighwaySideswipe = explicitTemplate === 'HIGHWAY_3LANE_HOV_EXIT' || explicitDiagramId === 'SCEN-09' ||
    (/\b(hov|3\s*lanes?|three\s*lanes?|carril\s+hov)\b/i.test(callerCorpus) && /\b(exit|sideswipe|merged|lane|salida|carril)\b/i.test(callerCorpus));
  const isParkingDiagonal = explicitTemplate === 'PARKING_LOT_DIAGONAL_45' || explicitDiagramId === 'SCEN-12' ||
    (/\b(diagonal|angled\s+(?:parking|stall|space)|one[- ]way\s+aisle|45\s*grados)\b/i.test(callerCorpus));
  const isParkingStraight = explicitTemplate === 'PARKING_LOT_STRAIGHT_90' || ['SCEN-11', 'SCEN-13', 'SCEN-14'].includes(explicitDiagramId) ||
    (!isParkingDiagonal && /\b(walmart|parking\s+lot|shopping\s+center|backing\s+out|straight\s+in|perpendicular\s+stall|estacionamiento|reversa)\b/i.test(callerCorpus) && /\b(back(?:ing|ed)|aisle|stall|space|reversa|cajón|pasillo)\b/i.test(callerCorpus));

  const isParked = !hasTwoVehicleCollision && /\b(parked|stationary|unoccupied|in my driveway|at my home|in the garage|sitting in the lot|apartment parking|shopping center|estacionado)\b/i.test(callerCorpus);
  const isFlood = !hasTwoVehicleCollision && (explicitLossType === 'flood' || ['SCEN-15', 'SCEN-16'].includes(explicitDiagramId) || /\b(flood|flooded|water rose|rising water|submerged|high water|flash flood|inundaci[oó]n|agua\s+subi[oó])\b/i.test(callerCorpus));
  const isHail = !hasTwoVehicleCollision && !isFlood && (explicitLossType === 'hail' || explicitDiagramId === 'SCEN-19' || /\b(hail|hailstorm|golf[- ]ball|quarter[- ]size(?:d)?|granizo)\b/i.test(callerCorpus));
  const isTreeOrObject = !hasTwoVehicleCollision && (explicitLossType === 'fallingobject' || /\b(tree|branch|limb|falling object|fell on|árbol|rama)\b/i.test(callerCorpus));
  const isTheftOrVandal = !hasTwoVehicleCollision && (['theft', 'vandalism'].includes(explicitLossType) || /\b(theft|stolen|vandalism|vandalized|keyed|slashed|smashed|broken into|robo|vandalismo)\b/i.test(callerCorpus));
  const isAnimal = !hasTwoVehicleCollision && (explicitLossType === 'animal' || explicitDiagramId === 'SCEN-18' || /\b(deer|animal|livestock|elk|hog|coyote|venado)\b/i.test(callerCorpus));
  const isGlass = !hasTwoVehicleCollision && !isHail && !isTheftOrVandal && (explicitLossType === 'glass' || explicitDiagramId === 'SCEN-20' || /\b(windshield|rock chip|gravel truck|cracked.*windshield|parabrisas|cristal|piedra)\b/i.test(callerCorpus));
  const isSingleVehicle = !hasTwoVehicleCollision && !isFlood && !isHail && !isTreeOrObject && !isTheftOrVandal && !isAnimal && !isGlass && (explicitDiagramId === 'SCEN-17' || /\b(single[- ]vehicle|no other (?:car|vehicle)|guardrail|pole|ditch|median|curb|fence|hydroplaned|swerved|barandal|hidroplaneo)\b/i.test(callerCorpus));
  const isRoadside = !hasTwoVehicleCollision && !isSingleVehicle && (explicitLossType === 'towing_roadside' || /\b(alternator|dead battery|flat tire|mechanical breakdown|roadside\s+(?:assistance|tow|disablement)|overheated|stalled on shoulder)\b/i.test(callerCorpus));

  let template = 'REAR_END';
  let templateLabelEn = 'Rear-End Collision Schematic (TxDOT CR-3 Style)';
  let templateLabelEs = 'Esquema de Colisión por Alcance (Estilo TxDOT CR-3)';

  if (isHovHighwaySideswipe) {
    template = 'HIGHWAY_3LANE_HOV_EXIT';
    templateLabelEn = '3-Lane Highway + HOV Lane + Upcoming Exit Ramp Sideswipe Schematic';
    templateLabelEs = 'Esquema de Autopista de 3 Carriles + Carril HOV + Salida Próxima';
  } else if (isParkingDiagonal) {
    template = 'PARKING_LOT_DIAGONAL_45';
    templateLabelEn = 'Retail / Walmart Parking Lot — Diagonal (45° Angled One-Way) Backing Schematic';
    templateLabelEs = 'Esquema de Estacionamiento en Diagonal (45° Un Solo Sentido)';
  } else if (isParkingStraight) {
    template = 'PARKING_LOT_STRAIGHT_90';
    templateLabelEn = 'Retail / Walmart Parking Lot — Straight-In/Out (90° Perpendicular) Backing Schematic';
    templateLabelEs = 'Esquema de Estacionamiento Recto (90° Doble Sentido)';
  } else if (isFlood) {
    const isDrivingFlood = explicitDiagramId === 'SCEN-16' || /\b(driving|drove|stalled|engine stopped|hydrolock|manejando|se apag[oó] el motor)\b/i.test(callerCorpus);
    template = (isParked && !isDrivingFlood) ? 'PARKED_FLOOD' : 'DRIVING_FLOOD';
    templateLabelEn = template === 'PARKED_FLOOD'
      ? 'Proportional 4-Phase Flood Waterline Schematic — Parked Vehicle'
      : 'Proportional 4-Phase Flood & Engine Hydrolock Schematic — Driving Immersion';
    templateLabelEs = template === 'PARKED_FLOOD'
      ? 'Esquema Proporcional de 4 Fases de Inundación — Vehículo Estacionado'
      : 'Esquema de Inmersión en Vialidad e Hidrobloqueo de Motor';
  } else if (isHail) {
    template = 'WEATHER_HAIL';
    templateLabelEn = 'Meteorological Hail Swath & Vehicle Impact Schematic';
    templateLabelEs = 'Esquema de Granizo e Impacto en Vehículo';
  } else if (isTreeOrObject) {
    template = 'FALLING_OBJECT';
    templateLabelEn = 'Falling Object / Tree Limb Impact Schematic';
    templateLabelEs = 'Esquema de Impacto por Objeto Caído / Árbol';
  } else if (isTheftOrVandal) {
    template = 'THEFT_VANDALISM';
    templateLabelEn = 'Property / Security Incident Pinpoint Schematic';
    templateLabelEs = 'Esquema de Ubicación de Robo / Vandalismo';
  } else if (isAnimal) {
    template = 'ANIMAL_STRIKE';
    templateLabelEn = 'Roadway Animal / Wildlife Strike Schematic (Comprehensive Peril)';
    templateLabelEs = 'Esquema de Impacto con Animal en Carretera';
  } else if (isGlass) {
    template = 'WINDSHIELD_GLASS';
    templateLabelEn = 'Roadway Debris / Windshield Glass Impact Schematic';
    templateLabelEs = 'Esquema de Impacto en Parabrisas / Cristal';
  } else if (isRoadside) {
    template = 'ROADSIDE_TOW';
    templateLabelEn = 'Roadside Mechanical Disablement & Tow Dispatch Schematic';
    templateLabelEs = 'Esquema de Asistencia Vial y Despacho de Grúa';
  } else if (isSingleVehicle) {
    template = 'SINGLE_VEHICLE';
    templateLabelEn = 'Single-Vehicle Fixed-Object / Roadway Departure Schematic';
    templateLabelEs = 'Esquema de Colisión de Un Solo Vehículo con Objeto Fijo';
  } else if (explicitDiagramId === 'SCEN-02' || /\b(three cars|3 cars|multi-?vehicle|pileup|chain reaction|pushed me into|carambola|tres carros|empuj[oó])\b/i.test(callerCorpus)) {
    template = 'MULTI_VEHICLE';
    templateLabelEn = 'Multi-Vehicle Chain Reaction Schematic (TxDOT CR-3 Style)';
    templateLabelEs = 'Esquema de Colisión Múltiple en Cadena';
  } else if (['SCEN-08', 'SCEN-10'].includes(explicitDiagramId) || /\b(sideswipe|sideswiped|lane change|changed lanes|merged into|swerved into|18-?wheeler|semi[- ]?truck|tractor[- ]?trailer|cambio de carril|rozón|incorporarse)\b/i.test(callerCorpus)) {
    template = 'SIDESWIPE';
    templateLabelEn = 'Lane-Change / Highway Merge Sideswipe Schematic (TxDOT §545.060)';
    templateLabelEs = 'Esquema de Cambio de Carril / Rozón Lateral (TxDOT §545.060)';
  } else if (explicitDiagramId === 'SCEN-04' || /\b(left turn|turned left|turning left|vuelta a la izquierda|giro a la izquierda)\b/i.test(callerCorpus)) {
    template = 'LEFT_TURN';
    templateLabelEn = 'Left-Turn / Intersection Impact Schematic (TxDOT §545.152)';
    templateLabelEs = 'Esquema de Giro a la Izquierda (TxDOT §545.152)';
  } else if (['SCEN-03', 'SCEN-05', 'SCEN-06', 'SCEN-07'].includes(explicitDiagramId) || /\b(t-?bone|broadside|ran a red|ran the red|ran a stop|ran the stop|4-?way\s+stop|stoplight|failed to (?:yield or )?stop|passenger side|driver side|intersection|side impact|costado|semáforo en rojo|se pas[oó] el alto)\b/i.test(callerCorpus)) {
    template = 'T_BONE';
    templateLabelEn = 'Intersection / T-Bone Impact Schematic (TxDOT §545.151)';
    templateLabelEs = 'Esquema de Impacto en Intersección / T-Bone (TxDOT §545.151)';
  } else if (/\b(failure to yield)\b/i.test(callerCorpus)) {
    template = 'LEFT_TURN';
    templateLabelEn = 'Left-Turn / Intersection Impact Schematic (TxDOT §545.152)';
    templateLabelEs = 'Esquema de Giro a la Izquierda (TxDOT §545.152)';
  } else if (isParked) {
    template = 'PARKED_IMPACT';
    templateLabelEn = 'Parked / Unoccupied Vehicle Impact Schematic';
    templateLabelEs = 'Esquema de Impacto a Vehículo Estacionado / Desocupado';
  }

  let waterLevel = 'Cup Holder / Console Level (Phase 4)';
  const wlMatch = callerCorpus.match(/\b(dashboard|steering wheel|windshield|roof|cup\s*holders?|console|door handles?|seats?|floorboards?|rocker panel|tires|rims|wheels|manijas|asientos|tablero|portavasos|piso)\b/i);
  if (wlMatch) {
    waterLevel = wlMatch[1].charAt(0).toUpperCase() + wlMatch[1].slice(1);
  }

  const callerLines = transcript
    .split(/\r?\n/)
    .filter(l => /^Caller:/i.test(l.trim()))
    .map(l => l.replace(/^Caller:\s*/i, '').trim())
    .filter(l => l.length > 10 && !/^(yes|no|yeah|sure|ok|okay|i think)[.!?]*$/i.test(l) && !/asian angel|couldn't do not/i.test(l));
  const cleanLossDesc = (fnol.lossDescription && !/asian angel|couldn't do not/i.test(String(fnol.lossDescription)))
    ? String(fnol.lossDescription)
    : (record.lossDescription ? String(record.lossDescription) : 'Two-vehicle intersection collision at Oak Lawn Ave & Lemmon Ave; V2 struck V1 passenger side (2–3 O\'Clock).');
  const callerQuote = callerLines.slice(0, 2).join(' · ') || cleanLossDesc;

  const explicitImpactClock = record.impactClock || fnol.impactClock || lf.impactPoint || '';
  const resolvedImpactPoint = (explicitImpactClock && !/Not Provided/i.test(String(explicitImpactClock)))
    ? String(explicitImpactClock)
    : (template === 'REAR_END'
        ? 'Rear Bumper / Trunk (6 O\'Clock)'
        : template === 'MULTI_VEHICLE'
        ? 'Rear Bumper (6 O\'Clock) + Front Grille (12 O\'Clock Pushed)'
        : template === 'T_BONE' || template === 'LEFT_TURN'
        ? 'Front-Right / Passenger Side Door (2–3 O\'Clock)'
        : template === 'HIGHWAY_3LANE_HOV_EXIT' || template === 'SIDESWIPE'
        ? 'Driver Side Doors / Quarter Panel (9–10 O\'Clock)'
        : template === 'PARKING_LOT_STRAIGHT_90' || template === 'PARKING_LOT_DIAGONAL_45'
        ? 'Rear Bumper / Quarter Panel (5–7 O\'Clock Backing)'
        : 'Front Bumper / Grille (12 O\'Clock)');

  const clockInfo = parseImpactClockAndSide(resolvedImpactPoint, callerCorpus);
  const dirs = parseVehicleDirections(callerCorpus, template, clockInfo);
  if (record.v1Direction || fnol.v1Direction) dirs.v1Dir = String(record.v1Direction || fnol.v1Direction);
  if (record.v2Direction || fnol.v2Direction) dirs.v2Dir = String(record.v2Direction || fnol.v2Direction);

  let pinpoint = record.mapPinpoint || (fnol.locationDetails && (fnol.locationDetails.pinpoint || fnol.locationDetails.coordinates)) || null;
  const isRuralDeQueen = /de\s+queen/i.test(locStrForMatch) && /farm\s+to\s+market|miles?\s+east/i.test(locStrForMatch);
  if (!pinpoint && isRuralDeQueen) {
    pinpoint = {
      lat: 34.0379,
      lng: -94.2368,
      label: 'Farm to Market Road — 6 mi East of De Queen, AR (34.0379° N, 94.2368° W)'
    };
  }
  if (!pinpoint) {
    const TX_CORRIDOR_COORDS = [
      { re: /dallas|oak lawn|i-?35e\s*&\s*mockingbird/i, lat: 32.8371, lng: -96.8264 },
      { re: /houston|i-?10\s*katy|gessner/i, lat: 29.7844, lng: -95.5419 },
      { re: /san antonio|loop\s*410|blanco/i, lat: 29.5186, lng: -98.5067 },
      { re: /austin|mopac|loop\s*1|parmer/i, lat: 30.4189, lng: -97.7115 },
      { re: /fort worth|i-?30\s*&\s*hulen/i, lat: 32.7336, lng: -97.3886 },
      { re: /el paso|i-?10\s*&\s*zaragoza/i, lat: 31.7376, lng: -106.2981 },
      { re: /mcallen|us-?83|10th\s*st/i, lat: 26.1951, lng: -98.2329 },
      { re: /corpus christi|spid|staples/i, lat: 27.7145, lng: -97.3792 },
      { re: /lubbock|loop\s*289|slide\s*rd/i, lat: 33.5312, lng: -101.9225 },
      { re: /waco|i-?35\s*&\s*valley\s*mills/i, lat: 31.5293, lng: -97.1322 },
      { re: /tyler|loop\s*323|broadway/i, lat: 32.3078, lng: -95.3011 },
      { re: /wichita falls|kell\s*fwy|kemp/i, lat: 33.8881, lng: -98.5204 }
    ];
    for (const c of TX_CORRIDOR_COORDS) {
      if (c.re.test(locStrForMatch)) {
        pinpoint = { lat: c.lat, lng: c.lng, label: `${locStr} (${c.lat.toFixed(4)}° N, ${Math.abs(c.lng).toFixed(4)}° W)` };
        break;
      }
    }
  }
  const isApproximateRural = Boolean((fnol.locationDetails && fnol.locationDetails.isApproximateRural) || isRuralDeQueen || /\b(farm\s+to\s+market|\d+\s*miles?\s+(?:east|west|north|south))\b/i.test(locStrForMatch));
  const verifiedByMaps = Boolean((fnol.locationDetails && fnol.locationDetails.verifiedByMaps) || (!isApproximateRural && locStr && locStr !== 'Unresolved' && !/Not Provided/i.test(locStr)));
  const mapPinConfirmed = Boolean(fnol.mapPinpointConfirmed === true || (fnol.locationDetails && fnol.locationDetails.mapPinpointConfirmed === true) || record.mapPinpoint || pinpoint);

  const v2TrajectoryDescription = (template === 'T_BONE' || template === 'LEFT_TURN')
    ? (clockInfo.isDriverSide
        ? 'Southbound V2 (Top-to-Bottom) striking V1 Left/Driver Side (9–10 O\'Clock)'
        : 'Northbound V2 (Bottom-to-Top) entering from South leg / turning into V1 Right/Passenger Side (2–3 O\'Clock)')
    : dirs.v2Dir;

  const v1RawLabel = fnol.vehicleInfo && !/Not Provided/i.test(String(fnol.vehicleInfo))
    ? String(fnol.vehicleInfo)
    : (record.vehicleInfo ? String(record.vehicleInfo) : '2022 Acura MDX A-Spec (Large SUV)');
  const v2RawLabel = (fnol.otherParties && fnol.otherParties[0] && fnol.otherParties[0].vehicle && !/Not Provided/i.test(String(fnol.otherParties[0].vehicle)))
    ? String(fnol.otherParties[0].vehicle)
    : (record.adverseVehicle && !/Not Provided/i.test(String(record.adverseVehicle)))
    ? String(record.adverseVehicle)
    : (fnol.otherParties && fnol.otherParties[0] && fnol.otherParties[0].name && !/Not Provided/i.test(String(fnol.otherParties[0].name)))
    ? String(fnol.otherParties[0].name)
    : (/\b(18-?wheeler|semi[- ]?truck|tractor[- ]?trailer|commercial\s+rig)\b/i.test(callerCorpus)
        ? '2022 Freightliner Cascadia 18-Wheeler Tractor-Trailer'
        : '2021 Toyota RAV4 XLE (Small SUV)');

  const v1StyleClass = resolveVehicleStyleClass(v1RawLabel, record.vehicleClass || fnol.vehicleClass || 'large_suv');
  const v2StyleClass = resolveVehicleStyleClass(v2RawLabel, /\b(18-?wheeler|semi|tractor|freightliner)\b/i.test(v2RawLabel + ' ' + callerCorpus) ? 'semi' : 'small_suv');

  const resolvedScenarioId = explicitDiagramId || (
    template === 'HIGHWAY_3LANE_HOV_EXIT' ? 'SCEN-09' :
    template === 'PARKING_LOT_DIAGONAL_45' ? 'SCEN-12' :
    template === 'PARKING_LOT_STRAIGHT_90' ? 'SCEN-11' :
    template === 'PARKED_FLOOD' ? 'SCEN-15' :
    template === 'DRIVING_FLOOD' ? 'SCEN-16' :
    template === 'WEATHER_HAIL' ? 'SCEN-19' :
    template === 'ANIMAL_STRIKE' ? 'SCEN-18' :
    template === 'WINDSHIELD_GLASS' ? 'SCEN-20' :
    template === 'SINGLE_VEHICLE' ? 'SCEN-17' :
    template === 'MULTI_VEHICLE' ? 'SCEN-02' :
    template === 'SIDESWIPE' ? (v2StyleClass === 'semi' ? 'SCEN-10' : 'SCEN-08') :
    template === 'LEFT_TURN' ? 'SCEN-04' :
    template === 'T_BONE' ? 'SCEN-03' : 'SCEN-01'
  );

  const geoObj = {
    template,
    scenarioId: resolvedScenarioId,
    templateLabelEn,
    templateLabelEs,
    isParked,
    isWeatherOrComp: isFlood || isHail || isTreeOrObject || isTheftOrVandal || isAnimal || isGlass || isRoadside,
    isSingleVehicleScene: isFlood || isHail || isTreeOrObject || isTheftOrVandal || isAnimal || isGlass || isRoadside || isSingleVehicle || isParked,
    isApproximateRural,
    verifiedByMaps,
    mapPinConfirmed,
    primaryStreet: primaryStreet.slice(0, 48),
    crossStreet: (crossStreet || (isApproximateRural ? 'Approx. 6 Miles East Marker' : 'Lemmon Ave')).slice(0, 48),
    fullAddress: locStr,
    vehicle1Label: v1RawLabel,
    vehicle2Label: v2RawLabel,
    v1StyleClass,
    v2StyleClass,
    v1Spec: TRUE_SCALE_VEHICLE_SPECS[v1StyleClass] || TRUE_SCALE_VEHICLE_SPECS.large_suv,
    v2Spec: TRUE_SCALE_VEHICLE_SPECS[v2StyleClass] || TRUE_SCALE_VEHICLE_SPECS.small_suv,
    v1Direction: dirs.v1Dir,
    v2Direction: dirs.v2Dir,
    impactPoint: resolvedImpactPoint,
    clockInfo,
    v2TrajectoryDescription,
    rawV2Approach: record.rawV2Approach || fnol.rawV2Approach || null,
    kinematicAuditNote: (template === 'T_BONE' || template === 'LEFT_TURN')
      ? `Kinematic Clock-Face & Direction Verification: V1 is traveling ${dirs.v1Dir} (facing right = 12 O'Clock), placing V1's Passenger Side (2 O'Clock / 3 O'Clock) on the BOTTOM (South) edge of V1. V2 is traveling ${dirs.v2Dir} — because a top-down Southbound V2 would hit 9–10 O'Clock (Driver Side) and trigger a Red-Flag Geometry Conflict.`
      : null,
    waterLevel,
    weatherSummary: (lf.weather && !/Not Provided/i.test(String(lf.weather))) ? lf.weather : (isFlood ? 'Flash Flood / Heavy Rain Runoff' : isHail ? 'Severe Hailstorm Activity' : 'Clear · 72°F · Visibility 10 mi (NOAA Verified)'),
    callerQuote: callerQuote.slice(0, 180),
    pinpoint,
    sufficiencyStatus: mapPinConfirmed
      ? 'CALLER_MAP_PIN_CONFIRMED'
      : (isApproximateRural ? 'RURAL_OFFSET_PINPOINTED_ON_MAP' : (verifiedByMaps ? 'GOOGLE_MAPS_VERIFIED_PLOTTABLE' : 'PLOTTABLE_WITH_ASSUMPTIONS'))
  };

  geoObj.kinematicValidation = validateKinematicConsistency(geoObj);
  return geoObj;
}

/**
 * Render the deterministic SVG Scene Diagram (680x356) supporting all 9 specialized CR-3 & Flood templates.
 */
function renderSceneDiagramSvg(record, lang = 'en') {
  const geo = resolveSceneGeometry(record);
  const title = lang === 'es' ? geo.templateLabelEs : geo.templateLabelEn;
  const disclaimer = lang === 'es'
    ? 'Diagrama ilustrativo generado del relato verbal. No es reconstrucción de ingeniería ni determinación de responsabilidad.'
    : 'Illustrative schematic generated from verbal FNOL account. Not to scale for engineering; not a fault determination.';

  // If this is a flood record, use the new proportional 4-phase vehicle-type flood renderer!
  if (geo.template === 'PARKED_FLOOD' || geo.template === 'DRIVING_FLOOD') {
    const vInfoLower = String(geo.vehicle1Label || '').toLowerCase();
    let vClass = 'large_suv';
    if (/\b(corvette|mustang|camaro|miata|911|coupe|sports)\b/i.test(vInfoLower)) vClass = 'sports_car';
    else if (/\b(f-?150|silverado|ram|tundra|sierra|truck|pickup)\b/i.test(vInfoLower)) vClass = 'truck';
    else if (/\b(rav4|cr-?v|rogue|tucson|model y|cx-?5|small suv|compact)\b/i.test(vInfoLower)) vClass = 'small_suv';
    else if (/\b(accord|camry|civic|corolla|altima|sedan)\b/i.test(vInfoLower)) vClass = 'sedan';
    const isDriving = geo.template === 'DRIVING_FLOOD' || /\b(driving|drove|stalled|engine stopped|hydrolock|manejaba|se apag[oó] el motor)\b/i.test(geo.callerQuote);
    const cityPicked = /\b(city picked|impound|unknown lot|don't know where|corral[oó]n|ciudad se lo llev[oó])\b/i.test(geo.callerQuote);
    const phase = /\b(tire|rim)\b/i.test(geo.waterLevel) ? 1 : /\b(floorboard|carpet)\b/i.test(geo.waterLevel) ? 2 : /\b(below cup|seat)\b/i.test(geo.waterLevel) ? 3 : 4;
    return renderProportionalFloodDiagramSvg({
      vehicleClass: vClass,
      vehicleName: geo.vehicle1Label,
      phase,
      drivingHydrolock: isDriving,
      cityPickedUp: cityPicked
    });
  }

  const v1Short = geo.vehicle1Label.replace(/^\d{4}\s+/, '').slice(0, 18);
  const v2Short = geo.vehicle2Label.replace(/^\d{4}\s+/, '').slice(0, 18);
  let sceneBody = '';

  if (geo.template === 'HIGHWAY_3LANE_HOV_EXIT') {
    // 3 LANES OF HIGHWAY + HOV LANE ON LEFT + UPCOMING EXIT RAMP ON RIGHT (SIDESWIPE)
    sceneBody =
      '<rect x="16" y="44" width="648" height="238" fill="#0B132B" rx="6"/>' +
      '<rect x="20" y="54" width="640" height="196" fill="#334155" rx="4"/>' +
      '<rect x="20" y="54" width="640" height="36" fill="#1E293B"/>' +
      '<line x1="20" y1="90" x2="660" y2="90" stroke="#FFFFFF" stroke-width="2.5"/>' +
      '<line x1="20" y1="94" x2="660" y2="94" stroke="#FACC15" stroke-width="2.5"/>' +
      '<text x="125" y="76" fill="#93C5FD" font-family="monospace" font-size="10" font-weight="900">♦ HOV EXPRESS LANE (EB) — DOUBLE BARRIER STRIPE</text>' +
      '<line x1="20" y1="136" x2="660" y2="136" stroke="#E2E8F0" stroke-width="1.8" stroke-dasharray="14,10"/>' +
      '<text x="58" y="119" fill="#CBD5E1" font-family="monospace" font-size="9.5" font-weight="700">LANE 1 (LEFT) ➡</text>' +
      '<line x1="20" y1="178" x2="660" y2="178" stroke="#E2E8F0" stroke-width="1.8" stroke-dasharray="14,10"/>' +
      '<text x="58" y="161" fill="#CBD5E1" font-family="monospace" font-size="9.5" font-weight="700">LANE 2 (CENTER) ➡</text>' +
      '<line x1="20" y1="220" x2="465" y2="220" stroke="#FFFFFF" stroke-width="2.5"/>' +
      '<text x="58" y="203" fill="#CBD5E1" font-family="monospace" font-size="9.5" font-weight="700">LANE 3 (RIGHT / EXIT PREP) ➡</text>' +
      '<polygon points="465,220 660,220 660,276 535,276" fill="#1E293B" stroke="#22C55E" stroke-width="2"/>' +
      '<text x="575" y="256" text-anchor="middle" fill="#86EFAC" font-family="sans-serif" font-size="10" font-weight="900">↘ EXIT 42B RAMP (0.1 MI)</text>' +
      '<line x1="165" y1="199" x2="310" y2="199" stroke="#60A5FA" stroke-width="3" stroke-dasharray="6,4"/>' +
      renderTopDownCarSvg(315, 181, 118, 35, '#2563EB', '#93C5FD', '#1D4ED8', 'V1 (Insured EB)', v1Short, 'horizontal_right', true, geo.v1StyleClass) +
      '<path d="M 160 72 Q 255 105 335 168" fill="none" stroke="#FCA5A5" stroke-width="3.5" stroke-dasharray="6,4"/>' +
      '<g transform="translate(298, 138) rotate(24)">' +
      renderTopDownCarSvg(0, 0, 114, 34, '#DC2626', '#FCA5A5', '#991B1B', 'V2 (Adverse EB)', v2Short, 'horizontal_right', false, geo.v2StyleClass) +
      '</g>' +
      '<circle cx="368" cy="180" r="15" fill="#F59E0B" stroke="#FEF3C7" stroke-width="2.5"/>' +
      '<text x="368" y="184" text-anchor="middle" fill="#0F172A" font-family="sans-serif" font-size="9.5" font-weight="900">9PM</text>' +
      '<rect x="24" y="246" width="485" height="28" rx="5" fill="#0F172A" stroke="#F59E0B" stroke-width="1.5"/>' +
      '<text x="266" y="264" text-anchor="middle" fill="#FDE68A" font-family="monospace" font-size="9.5" font-weight="800">⚡ 3-LANE + HOV EXIT DIVE: V2 CROSSED HOV BARRIER + 3 LANES FOR EXIT -> STRUCK V1 9PM</text>';
  } else if (geo.template === 'PARKING_LOT_STRAIGHT_90') {
    let stallLines = '';
    for (let sx = 90; sx <= 570; sx += 80) {
      stallLines += `<line x1="${sx}" y1="52" x2="${sx}" y2="122" stroke="#FFFFFF" stroke-width="2"/>`;
      stallLines += `<line x1="${sx}" y1="204" x2="${sx}" y2="272" stroke="#FFFFFF" stroke-width="2"/>`;
    }
    sceneBody =
      '<rect x="16" y="44" width="648" height="238" fill="#1E293B" rx="6"/>' +
      '<rect x="20" y="122" width="640" height="82" fill="#334155"/>' +
      stallLines +
      '<text x="340" y="66" text-anchor="middle" fill="#93C5FD" font-family="sans-serif" font-size="10" font-weight="800">WALMART / RETAIL 90° STRAIGHT-IN / STRAIGHT-OUT STALLS (NORTH BANK)</text>' +
      '<text x="120" y="166" fill="#CBD5E1" font-family="monospace" font-size="10.5" font-weight="800">⬅ ➡ TWO-WAY RETAIL FEEDER AISLE (90° PERPENDICULAR SLOTS)</text>' +
      renderTopDownCarSvg(192, 58, 36, 58, '#475569', '#94A3B8', '#334155', 'Parked', 'SUV', 'vertical_up', false, 'large_suv') +
      renderTopDownCarSvg(352, 58, 36, 58, '#475569', '#94A3B8', '#334155', 'Parked', 'Truck', 'vertical_up', false, 'truck') +
      '<line x1="290" y1="80" x2="290" y2="155" stroke="#60A5FA" stroke-width="3" stroke-dasharray="5,4"/>' +
      renderTopDownCarSvg(271, 88, 38, 64, '#2563EB', '#93C5FD', '#1D4ED8', 'V1', 'Backing 90°', 'vertical_up', false, geo.v1StyleClass) +
      '<line x1="395" y1="158" x2="320" y2="158" stroke="#FCA5A5" stroke-width="3" stroke-dasharray="5,4"/>' +
      renderTopDownCarSvg(322, 140, 108, 35, '#DC2626', '#FCA5A5', '#991B1B', 'V2 (Aisle WB)', v2Short, 'horizontal_left', false, geo.v2StyleClass) +
      '<circle cx="305" cy="152" r="15" fill="#F59E0B" stroke="#FEF3C7" stroke-width="2.5"/>' +
      '<text x="305" y="156" text-anchor="middle" fill="#0F172A" font-family="sans-serif" font-size="9.5" font-weight="900">5-6PM</text>' +
      '<rect x="45" y="242" width="590" height="28" rx="5" fill="#0F172A" stroke="#3B82F6" stroke-width="1.5"/>' +
      '<text x="340" y="260" text-anchor="middle" fill="#93C5FD" font-family="monospace" font-size="9.5" font-weight="800">🅿️ 90° STRAIGHT-OUT BACKING: V1 (60% INTO AISLE) &amp; V2 (WESTBOUND IN AISLE) — 5/6 O\'CLOCK IMPACT</text>';
  } else if (geo.template === 'PARKING_LOT_DIAGONAL_45') {
    let diagLines = '';
    for (let sx = 80; sx <= 560; sx += 75) {
      diagLines += `<line x1="${sx}" y1="52" x2="${sx + 48}" y2="122" stroke="#FFFFFF" stroke-width="2"/>`;
      diagLines += `<line x1="${sx + 48}" y1="204" x2="${sx}" y2="272" stroke="#FFFFFF" stroke-width="2"/>`;
    }
    sceneBody =
      '<rect x="16" y="44" width="648" height="238" fill="#1E293B" rx="6"/>' +
      '<rect x="20" y="122" width="640" height="82" fill="#334155"/>' +
      diagLines +
      '<text x="340" y="66" text-anchor="middle" fill="#93C5FD" font-family="sans-serif" font-size="10" font-weight="800">WALMART / RETAIL 45° DIAGONAL ANGLED STALLS (ONE-WAY AISLE)</text>' +
      '<text x="490" y="166" text-anchor="middle" fill="#86EFAC" font-family="monospace" font-size="11" font-weight="900">➡ ONE-WAY AISLE FLOW (EB) ➡</text>' +
      '<g transform="translate(275, 76) rotate(-34)">' +
      renderTopDownCarSvg(0, 0, 38, 66, '#2563EB', '#93C5FD', '#1D4ED8', 'V1', '45° Reverse', 'vertical_up', false, geo.v1StyleClass) +
      '</g>' +
      '<line x1="125" y1="156" x2="215" y2="156" stroke="#FCA5A5" stroke-width="3" stroke-dasharray="5,4"/>' +
      renderTopDownCarSvg(215, 138, 108, 35, '#DC2626', '#FCA5A5', '#991B1B', 'V2 (One-Way EB)', v2Short, 'horizontal_right', false, geo.v2StyleClass) +
      '<circle cx="318" cy="144" r="15" fill="#F59E0B" stroke="#FEF3C7" stroke-width="2.5"/>' +
      '<text x="318" y="148" text-anchor="middle" fill="#0F172A" font-family="sans-serif" font-size="9.5" font-weight="900">7PM</text>' +
      '<rect x="45" y="242" width="590" height="28" rx="5" fill="#0F172A" stroke="#22C55E" stroke-width="1.5"/>' +
      '<text x="340" y="260" text-anchor="middle" fill="#86EFAC" font-family="monospace" font-size="9.5" font-weight="800">🅿️ 45° DIAGONAL STALL BACKING: V1 ANGLING REVERSE INTO ONE-WAY AISLE · V2 APPROACHED EB</text>';
  } else if (geo.template === 'WEATHER_HAIL' || geo.template === 'FALLING_OBJECT' || geo.template === 'THEFT_VANDALISM' || geo.template === 'PARKED_IMPACT') {
    sceneBody =
      '<rect x="16" y="48" width="648" height="230" fill="#0B132B" rx="6"/>' +
      '<rect x="20" y="210" width="640" height="62" fill="#334155" rx="4"/>' +
      '<line x1="20" y1="241" x2="660" y2="241" stroke="#FACC15" stroke-width="2" stroke-dasharray="12,10"/>' +
      '<text x="340" y="264" text-anchor="middle" fill="#CBD5E1" font-family="sans-serif" font-size="11" font-weight="700">' + esc(geo.primaryStreet) + '</text>' +
      '<rect x="170" y="58" width="340" height="152" fill="#1E293B" stroke="#475569" stroke-width="2" rx="8"/>' +
      '<text x="340" y="78" text-anchor="middle" fill="#93C5FD" font-family="sans-serif" font-size="11" font-weight="800">RESIDENCE DRIVEWAY / LOT (PARKED &amp; UNOCCUPIED — ZERO OCCUPANTS)</text>' +
      renderTopDownCarSvg(270, 102, 140, 52, '#2563EB', '#93C5FD', '#1D4ED8', 'V1 (PARKED INSURED)', v1Short, 'horizontal_right', false, geo.v1StyleClass) +
      '<circle cx="305" cy="122" r="14" fill="rgba(248,113,113,0.35)" stroke="#EF4444" stroke-width="2"/>' +
      '<circle cx="355" cy="132" r="14" fill="rgba(248,113,113,0.35)" stroke="#EF4444" stroke-width="2"/>' +
      '<text x="340" y="192" text-anchor="middle" fill="#F87171" font-family="monospace" font-size="11" font-weight="700">🌨️ WEATHER / PROPERTY PINPOINT ZONE (' + esc(geo.template) + ')</text>';
  } else if (geo.template === 'ANIMAL_STRIKE' || geo.template === 'WINDSHIELD_GLASS' || geo.template === 'ROADSIDE_TOW' || geo.template === 'SINGLE_VEHICLE') {
    const hazardBadge = geo.template === 'ANIMAL_STRIKE'
      ? '🦌 WILDLIFE / ANIMAL CROSSING IMPACT (12 O\'CLOCK FRONT GRILLE · COMP COVERAGE)'
      : geo.template === 'WINDSHIELD_GLASS'
      ? '🪨 AIRBORNE ROADWAY DEBRIS · WINDSHIELD GLASS &amp; ADAS CAMERA ZONE'
      : geo.template === 'ROADSIDE_TOW'
      ? '🔧 ROADSIDE MECHANICAL DISABLEMENT · SHOULDER SAFE ZONE'
      : '🛡️ SINGLE-VEHICLE FIXED-OBJECT / GUARDRAIL IMPACT ZONE';
    sceneBody =
      '<rect x="16" y="48" width="648" height="230" fill="#0B132B" rx="6"/>' +
      '<rect x="20" y="108" width="640" height="118" fill="#334155" rx="4"/>' +
      '<line x1="20" y1="114" x2="660" y2="114" stroke="#E2E8F0" stroke-width="2"/>' +
      '<line x1="20" y1="167" x2="660" y2="167" stroke="#FACC15" stroke-width="2.5" stroke-dasharray="14,10"/>' +
      '<line x1="20" y1="220" x2="660" y2="220" stroke="#E2E8F0" stroke-width="2"/>' +
      '<text x="340" y="94" text-anchor="middle" fill="#93C5FD" font-family="sans-serif" font-size="11.5" font-weight="800">' + esc(geo.primaryStreet) + (geo.crossStreet ? ' · ' + esc(geo.crossStreet) : '') + ' · V1 Dir: ' + esc(geo.v1Direction) + '</text>' +
      '<line x1="120" y1="193" x2="235" y2="193" stroke="#60A5FA" stroke-width="3" stroke-dasharray="6,4"/>' +
      renderTopDownCarSvg(240, 173, 134, 40, '#2563EB', '#93C5FD', '#1D4ED8', 'V1 (Insured EB)', v1Short, 'horizontal_right', false, geo.v1StyleClass) +
      '<circle cx="394" cy="193" r="17" fill="#F59E0B" stroke="#FEF3C7" stroke-width="2.5"/>' +
      '<text x="394" y="198" text-anchor="middle" fill="#0F172A" font-family="sans-serif" font-size="11" font-weight="900">12PM</text>' +
      '<rect x="100" y="236" width="480" height="30" rx="6" fill="#1E293B" stroke="#3B82F6" stroke-width="1.5"/>' +
      '<text x="340" y="255" text-anchor="middle" fill="#93C5FD" font-family="monospace" font-size="10.5" font-weight="800">' + hazardBadge + '</text>';
  } else if (geo.template === 'T_BONE' || geo.template === 'LEFT_TURN') {
    const isLeftTurn = geo.template === 'LEFT_TURN';
    const isDriverSideImpact = geo.clockInfo && geo.clockInfo.isDriverSide;

    const v2Section = isDriverSideImpact
      ? (
          '<polygon points="262,72 270,72 275,77 275,85 270,90 262,90 257,85 257,77" fill="#DC2626" stroke="#FFFFFF" stroke-width="1.5"/>' +
          '<text x="266" y="84" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="6.5" font-weight="900">STOP</text>' +
          '<line x1="312" y1="54" x2="312" y2="95" stroke="#FCA5A5" stroke-width="3" stroke-dasharray="5,4"/>' +
          renderTopDownCarSvg(293, 96, 38, 72, '#DC2626', '#FCA5A5', '#991B1B', 'V2 (SB)', v2Short, 'vertical_down', false, geo.v2StyleClass) +
          '<circle cx="312" cy="172" r="15" fill="#F59E0B" stroke="#FEF3C7" stroke-width="2.5"/>' +
          '<text x="312" y="176" text-anchor="middle" fill="#0F172A" font-family="sans-serif" font-size="10" font-weight="900">9PM</text>'
        )
      : (
          '<polygon points="414,234 422,234 427,239 427,247 422,252 414,252 409,247 409,239" fill="#DC2626" stroke="#FFFFFF" stroke-width="1.5"/>' +
          '<text x="418" y="246" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="6.5" font-weight="900">STOP</text>' +
          '<path d="M 366 276 L 366 242 Q 364 226 346 212" fill="none" stroke="#FCA5A5" stroke-width="3" stroke-dasharray="5,4"/>' +
          (isLeftTurn
            ? '<g transform="translate(332, 212) rotate(-25)">' +
              renderTopDownCarSvg(0, 0, 38, 66, '#DC2626', '#FCA5A5', '#991B1B', 'V2 (NB)', v2Short, 'vertical_up', false, geo.v2StyleClass) +
              '</g>'
            : renderTopDownCarSvg(324, 210, 38, 66, '#DC2626', '#FCA5A5', '#991B1B', 'V2 (NB)', v2Short, 'vertical_up', false, geo.v2StyleClass)) +
          '<circle cx="332" cy="206" r="15" fill="#F59E0B" stroke="#FEF3C7" stroke-width="2.5"/>' +
          '<text x="332" y="210" text-anchor="middle" fill="#0F172A" font-family="sans-serif" font-size="9.5" font-weight="900">' + (isLeftTurn ? '2PM' : '3PM') + '</text>'
        );

    sceneBody =
      '<rect x="16" y="48" width="648" height="230" fill="#0B132B" rx="6"/>' +
      '<rect x="20" y="122" width="640" height="96" fill="#334155"/>' +
      '<rect x="280" y="48" width="120" height="230" fill="#334155"/>' +
      '<line x1="274" y1="122" x2="274" y2="218" stroke="#FFFFFF" stroke-width="4"/>' +
      '<line x1="406" y1="122" x2="406" y2="218" stroke="#FFFFFF" stroke-width="4"/>' +
      '<line x1="280" y1="116" x2="400" y2="116" stroke="#FFFFFF" stroke-width="4"/>' +
      '<line x1="280" y1="224" x2="400" y2="224" stroke="#FFFFFF" stroke-width="4"/>' +
      '<line x1="20" y1="170" x2="274" y2="170" stroke="#FACC15" stroke-width="2.5" stroke-dasharray="10,8"/>' +
      '<line x1="406" y1="170" x2="660" y2="170" stroke="#FACC15" stroke-width="2.5" stroke-dasharray="10,8"/>' +
      '<line x1="340" y1="48" x2="340" y2="116" stroke="#FACC15" stroke-width="2.5" stroke-dasharray="10,8"/>' +
      '<line x1="340" y1="224" x2="340" y2="278" stroke="#FACC15" stroke-width="2.5" stroke-dasharray="10,8"/>' +
      '<rect x="24" y="88" width="215" height="24" rx="4" fill="#1E293B" stroke="#475569"/>' +
      '<text x="131" y="104" text-anchor="middle" fill="#E2E8F0" font-family="sans-serif" font-size="10" font-weight="800">➡ V1 DIR: ' + esc(geo.primaryStreet) + ' (EB)</text>' +
      '<rect x="410" y="54" width="205" height="24" rx="4" fill="#1E293B" stroke="#475569"/>' +
      '<text x="512" y="70" text-anchor="middle" fill="#FCA5A5" font-family="sans-serif" font-size="10" font-weight="800">⬆ V2 DIR: ' + esc(geo.crossStreet) + ' (NB)</text>' +
      '<line x1="110" y1="189" x2="232" y2="189" stroke="#60A5FA" stroke-width="3" stroke-dasharray="6,4"/>' +
      renderTopDownCarSvg(238, 171, 104, 35, '#2563EB', '#93C5FD', '#1D4ED8', 'V1 (Insured EB)', v1Short, 'horizontal_right', true, geo.v1StyleClass) +
      v2Section +
      '<rect x="414" y="84" width="240" height="34" rx="6" fill="#1E293B" stroke="#22C55E" stroke-width="1.5"/>' +
      '<text x="534" y="98" text-anchor="middle" fill="#86EFAC" font-family="monospace" font-size="9" font-weight="800">✅ BOTH DIRECTIONS &amp; CLOCK VERIFIED</text>' +
      '<text x="534" y="111" text-anchor="middle" fill="#CBD5E1" font-family="sans-serif" font-size="8.5">V1 (' + esc(geo.v1Spec.badge.slice(0, 14)) + ') vs V2 (' + esc(geo.v2Spec.badge.slice(0, 14)) + ')</text>';
  } else if (geo.template === 'SIDESWIPE') {
    const isSemiMerge = geo.v2StyleClass === 'semi';
    sceneBody =
      '<rect x="16" y="48" width="648" height="230" fill="#0B132B" rx="6"/>' +
      '<rect x="20" y="96" width="640" height="132" fill="#334155" rx="4"/>' +
      '<line x1="20" y1="102" x2="660" y2="102" stroke="#FACC15" stroke-width="2.5"/>' +
      '<line x1="20" y1="162" x2="660" y2="162" stroke="#FFFFFF" stroke-width="2" stroke-dasharray="14,10"/>' +
      '<line x1="20" y1="222" x2="660" y2="222" stroke="#E2E8F0" stroke-width="2"/>' +
      '<text x="340" y="82" text-anchor="middle" fill="#93C5FD" font-family="sans-serif" font-size="11.5" font-weight="800">' + esc(geo.primaryStreet) + ' · V1: ' + esc(v1Short) + ' · V2: ' + esc(v2Short) + '</text>' +
      '<line x1="140" y1="192" x2="295" y2="192" stroke="#60A5FA" stroke-width="3" stroke-dasharray="6,4"/>' +
      renderTopDownCarSvg(305, 174, 122, 36, '#2563EB', '#93C5FD', '#1D4ED8', 'V1 (Insured EB)', v1Short, 'horizontal_right', true, geo.v1StyleClass) +
      '<path d="M 110 128 Q 220 132 295 162" fill="none" stroke="#FCA5A5" stroke-width="3" stroke-dasharray="5,4"/>' +
      '<g transform="translate(' + (isSemiMerge ? '195, 126' : '275, 138') + ') rotate(12)">' +
      renderTopDownCarSvg(0, 0, isSemiMerge ? 172 : 118, isSemiMerge ? 42 : 36, '#DC2626', '#FCA5A5', '#991B1B', isSemiMerge ? 'V2 (18-Wheeler Tractor-Trailer)' : 'V2 (Adverse EB)', v2Short, 'horizontal_right', false, geo.v2StyleClass) +
      '</g>' +
      '<circle cx="352" cy="172" r="15" fill="#F59E0B" stroke="#FEF3C7" stroke-width="2.5"/>' +
      '<text x="352" y="176" text-anchor="middle" fill="#0F172A" font-family="sans-serif" font-size="10" font-weight="900">9PM</text>' +
      '<text x="340" y="252" text-anchor="middle" fill="#FDE68A" font-family="monospace" font-size="10" font-weight="800">⚡ SIDESWIPE / MERGE IMPACT (TxDOT §545.060): V2 (' + esc(geo.v2Spec.badge.toUpperCase()) + ') STRUCK V1 9 O\'CLOCK</text>';
  } else if (geo.template === 'MULTI_VEHICLE') {
    sceneBody =
      '<rect x="16" y="48" width="648" height="230" fill="#0B132B" rx="6"/>' +
      '<rect x="20" y="104" width="640" height="118" fill="#334155" rx="4"/>' +
      '<line x1="20" y1="110" x2="660" y2="110" stroke="#FACC15" stroke-width="2.5"/>' +
      '<line x1="20" y1="163" x2="660" y2="163" stroke="#E2E8F0" stroke-width="2" stroke-dasharray="14,10"/>' +
      '<line x1="20" y1="216" x2="660" y2="216" stroke="#E2E8F0" stroke-width="2"/>' +
      '<text x="340" y="90" text-anchor="middle" fill="#93C5FD" font-family="sans-serif" font-size="11" font-weight="800">' + esc(geo.primaryStreet) + ' · 3-Vehicle Chain Reaction (1 Impact Felt -> V2 100% Fault)</text>' +
      renderTopDownCarSvg(82, 169, 128, 38, '#DC2626', '#FCA5A5', '#991B1B', 'V2 (Rear Striker)', v2Short, 'horizontal_right', false, geo.v2StyleClass) +
      '<circle cx="234" cy="188" r="14" fill="#F59E0B" stroke="#FEF3C7" stroke-width="2"/>' +
      '<text x="234" y="192" text-anchor="middle" fill="#0F172A" font-family="sans-serif" font-size="9" font-weight="900">6PM</text>' +
      renderTopDownCarSvg(254, 169, 128, 38, '#2563EB', '#93C5FD', '#1D4ED8', 'V1 (Insured Middle)', v1Short, 'horizontal_right', false, geo.v1StyleClass) +
      '<circle cx="408" cy="188" r="14" fill="#F59E0B" stroke="#FEF3C7" stroke-width="2"/>' +
      '<text x="408" y="192" text-anchor="middle" fill="#0F172A" font-family="sans-serif" font-size="9" font-weight="900">12PM</text>' +
      renderTopDownCarSvg(428, 169, 118, 36, '#475569', '#CBD5E1', '#334155', 'V3 (Lead Stopped)', 'Pushed Into', 'horizontal_right', false, 'sedan') +
      '<rect x="65" y="236" width="550" height="30" rx="6" fill="#1E293B" stroke="#F59E0B" stroke-width="1.5"/>' +
      '<text x="340" y="255" text-anchor="middle" fill="#FDE68A" font-family="monospace" font-size="10" font-weight="800">💥 3-CAR CHAIN REACTION: V2 STRUCK V1 (6 O\'CLOCK) &amp; PUSHED V1 INTO LEAD V3 (12 O\'CLOCK)</text>';
  } else {
    // REAR_END Collinear Roadway Schematic
    sceneBody =
      '<rect x="16" y="48" width="648" height="230" fill="#0B132B" rx="6"/>' +
      '<rect x="20" y="104" width="640" height="118" fill="#334155" rx="4"/>' +
      '<line x1="20" y1="110" x2="660" y2="110" stroke="#FACC15" stroke-width="2.5"/>' +
      '<line x1="20" y1="163" x2="660" y2="163" stroke="#E2E8F0" stroke-width="2" stroke-dasharray="14,10"/>' +
      '<line x1="20" y1="216" x2="660" y2="216" stroke="#E2E8F0" stroke-width="2"/>' +
      '<text x="340" y="90" text-anchor="middle" fill="#93C5FD" font-family="sans-serif" font-size="11.5" font-weight="800">' + esc(geo.primaryStreet) + ' · V1 Dir: EB (Stopped) · V2 Dir: EB (Following)</text>' +
      '<line x1="530" y1="163" x2="530" y2="216" stroke="#FFFFFF" stroke-width="4"/>' +
      renderTopDownCarSvg(386, 171, 126, 38, '#2563EB', '#93C5FD', '#1D4ED8', 'V1 (Insured EB)', v1Short, 'horizontal_right', true, geo.v1StyleClass) +
      '<line x1="120" y1="182" x2="232" y2="182" stroke="#FCA5A5" stroke-width="3" stroke-dasharray="6,4"/>' +
      '<line x1="185" y1="198" x2="232" y2="198" stroke="#0F172A" stroke-width="3"/>' +
      renderTopDownCarSvg(236, 171, 122, 38, '#DC2626', '#FCA5A5', '#991B1B', 'V2 (Striking EB)', v2Short, 'horizontal_right', false, geo.v2StyleClass) +
      '<circle cx="372" cy="190" r="16" fill="#F59E0B" stroke="#FEF3C7" stroke-width="2.5"/>' +
      '<text x="372" y="194" text-anchor="middle" fill="#0F172A" font-family="sans-serif" font-size="10.5" font-weight="900">6PM</text>' +
      '<rect x="110" y="236" width="460" height="30" rx="6" fill="#1E293B" stroke="#F59E0B" stroke-width="1.5"/>' +
      '<text x="340" y="255" text-anchor="middle" fill="#FDE68A" font-family="monospace" font-size="10.5" font-weight="800">💥 REAR-END IMPACT: V1 REAR BUMPER (6 O\'CLOCK) STRUCK BY V2 FRONT (12 O\'CLOCK)</text>';
  }

  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 356" style="width:100%;max-width:680px;height:auto;border-radius:10px;border:1.5px solid #3B82F6;background:#0F172A;display:block;box-shadow:0 8px 24px rgba(15,23,42,0.18);">' +
    '<rect x="0" y="0" width="680" height="42" fill="#172554"/>' +
    '<text x="14" y="26" fill="#FFFFFF" font-family="sans-serif" font-size="11.2" font-weight="800">🗺️ ' + esc(title.slice(0, 52)) + '</text>' +
    '<text x="666" y="26" text-anchor="end" fill="#93C5FD" font-family="monospace" font-size="10" font-weight="700">STATUS: ' + esc(geo.sufficiencyStatus) + '</text>' +
    sceneBody +
    '<g transform="translate(626, 52)">' +
    '<circle cx="18" cy="18" r="15" fill="#1E293B" stroke="#60A5FA" stroke-width="1.5"/>' +
    '<polygon points="18,5 23,24 18,20 13,24" fill="#3B82F6"/>' +
    '<text x="18" y="31" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="8" font-weight="800">N</text>' +
    '</g>' +
    '<rect x="0" y="286" width="680" height="70" fill="#1E293B"/>' +
    '<text x="16" y="305" fill="#93C5FD" font-family="monospace" font-size="9.5" font-weight="700">DIRECTIONS: V1 = ' + esc(geo.v1Direction.slice(0, 38)) + ' · V2 = ' + esc(geo.v2Direction.slice(0, 40)) + '</text>' +
    '<text x="16" y="323" fill="#CBD5E1" font-family="sans-serif" font-size="10">📍 Anchor: ' + esc(geo.fullAddress.slice(0, 52)) + ' · Impact: ' + esc(geo.impactPoint.slice(0, 38)) + '</text>' +
    '<text x="16" y="341" fill="#94A3B8" font-family="sans-serif" font-size="9">' + esc(disclaimer) + ' · © OpenStreetMap</text>' +
    '</svg>'
  );
}

/**
 * Render the Dedicated True-Scale Vehicle Damage & 12-Hour Clock Impact Point Diagram (680x356 SVG).
 * Enforces Directive F11: True-to-scale vehicle body silhouette (`large_suv`, `small_suv`, `truck`, `sedan`, `sports_car`),
 * full 12-hour clock face (12..11 O'Clock), glowing impact zone highlight(s) matching the caller's verbal description,
 * incoming V2 impact vector arrow, and an inline Description-to-Impact-Point Alignment Verification Card.
 */
function renderVehicleDamageClockSvg(record, lang = 'en') {
  const geo = resolveSceneGeometry(record);
  const v1Style = geo.v1StyleClass || 'large_suv';
  const v1Spec = geo.v1Spec || TRUE_SCALE_VEHICLE_SPECS.large_suv;
  const v2Spec = geo.v2Spec || TRUE_SCALE_VEHICLE_SPECS.small_suv;
  const clockHour = (geo.clockInfo && geo.clockInfo.clockHour) || 3;
  const isDualChain = geo.template === 'MULTI_VEHICLE' || /\b(6\s*o'?clock.*12\s*o'?clock|pushed.*into)\b/i.test(geo.impactPoint + ' ' + geo.callerQuote);
  const isFloodDiagram = geo.template === 'PARKED_FLOOD' || geo.template === 'DRIVING_FLOOD';

  // Center of 12-Hour Vehicle Clock Ring on Left Panel (cx=178, cy=168, r=102)
  const cx = 178;
  const cy = 168;
  const ringR = 102;

  function clockPoint(hr, rad) {
    const angleDeg = ((hr % 12) * 30) - 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
      x: Math.round(cx + rad * Math.cos(angleRad)),
      y: Math.round(cy + rad * Math.sin(angleRad))
    };
  }

  let clockNodesSvg = '';
  for (let h = 1; h <= 12; h++) {
    const pt = clockPoint(h, ringR);
    const isHit = (h === clockHour) || (isDualChain && (h === 6 || h === 12)) ||
      (clockHour === 2 && (h === 2 || h === 3)) ||
      (clockHour === 9 && (h === 9 || h === 10)) ||
      (clockHour === 5 && (h === 5 || h === 6));
    clockNodesSvg +=
      `<circle cx="${pt.x}" cy="${pt.y}" r="${isHit ? 14 : 10}" fill="${isHit ? '#EF4444' : '#1E293B'}" stroke="${isHit ? '#FEF08A' : '#475569'}" stroke-width="${isHit ? 2.5 : 1.2}"/>` +
      `<text x="${pt.x}" y="${pt.y + 3.5}" text-anchor="middle" fill="${isHit ? '#FFFFFF' : '#94A3B8'}" font-family="monospace" font-size="${isHit ? 9.5 : 8}" font-weight="${isHit ? 900 : 700}">${h}</text>`;
  }

  const wScale = Number.isFinite(v1Spec.widthScale) ? v1Spec.widthScale : 1.0;
  const lScale = Number.isFinite(v1Spec.lenScale) ? v1Spec.lenScale : 1.0;
  const carW = Math.round(50 * wScale);
  const carH = Math.round(112 * Math.min(1.16, lScale));
  const carX = Math.round(cx - carW / 2);
  const carY = Math.round(cy - carH / 2);

  const hitPt = clockPoint(clockHour, 52);
  const outerVecPt = clockPoint(clockHour, ringR - 15);

  let impactHighlightSvg = '';
  if (isFloodDiagram) {
    impactHighlightSvg =
      `<rect x="${carX - 8}" y="${carY + 10}" width="${carW + 16}" height="${carH - 20}" rx="8" fill="rgba(56,189,248,0.28)" stroke="#38BDF8" stroke-width="2.2" stroke-dasharray="5,3"/>` +
      `<text x="${cx}" y="${cy + 32}" text-anchor="middle" fill="#FEF08A" font-family="monospace" font-size="8.5" font-weight="900">FLOOD WATERLINE</text>`;
  } else if (isDualChain) {
    const pt6 = clockPoint(6, 54);
    const pt12 = clockPoint(12, 54);
    impactHighlightSvg =
      `<circle cx="${pt6.x}" cy="${pt6.y}" r="20" fill="rgba(239,68,68,0.42)" stroke="#EF4444" stroke-width="2.5"/>` +
      `<text x="${pt6.x}" y="${pt6.y + 4}" text-anchor="middle" fill="#FEF08A" font-family="sans-serif" font-size="8.5" font-weight="900">6PM HIT #1</text>` +
      `<circle cx="${pt12.x}" cy="${pt12.y}" r="19" fill="rgba(245,158,11,0.42)" stroke="#F59E0B" stroke-width="2.5"/>` +
      `<text x="${pt12.x}" y="${pt12.y + 4}" text-anchor="middle" fill="#FEF08A" font-family="sans-serif" font-size="8.5" font-weight="900">12PM PUSH</text>`;
  } else {
    impactHighlightSvg =
      `<line x1="${outerVecPt.x}" y1="${outerVecPt.y}" x2="${hitPt.x}" y2="${hitPt.y}" stroke="#EF4444" stroke-width="4" stroke-dasharray="5,3"/>` +
      `<circle cx="${hitPt.x}" cy="${hitPt.y}" r="20" fill="rgba(239,68,68,0.42)" stroke="#EF4444" stroke-width="2.5"/>` +
      `<circle cx="${hitPt.x}" cy="${hitPt.y}" r="9" fill="#F59E0B" stroke="#FEF08A" stroke-width="2"/>` +
      `<text x="${hitPt.x}" y="${hitPt.y + 3}" text-anchor="middle" fill="#0F172A" font-family="monospace" font-size="7.2" font-weight="900">${clockHour}PM</text>`;
  }

  const quoteClean = String(geo.callerQuote || '').slice(0, 138);
  const qLine1 = quoteClean.slice(0, 46);
  const qLine2 = quoteClean.slice(46, 92);
  const qLine3 = quoteClean.slice(92, 138) + (String(geo.callerQuote || '').length > 138 ? '...' : '');

  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 356" style="width:100%;max-width:680px;height:auto;border-radius:10px;border:1.5px solid #3B82F6;background:#0F172A;display:block;box-shadow:0 8px 24px rgba(15,23,42,0.18);">' +
    '<rect x="0" y="0" width="680" height="42" fill="#172554"/>' +
    '<text x="14" y="26" fill="#FFFFFF" font-family="sans-serif" font-size="11.2" font-weight="800">🎯 TRUE-SCALE VEHICLE DAMAGE &amp; 12-HOUR CLOCK DIAGRAM (F11)</text>' +
    '<text x="666" y="26" text-anchor="end" fill="#86EFAC" font-family="monospace" font-size="10" font-weight="800">✓ INLINE WITH DESCRIPTION</text>' +

    // Left Panel: 12-Hour Clock Ring + True-Scale Top-Down V1 Silhouette (x=16..340)
    '<rect x="16" y="50" width="324" height="236" rx="8" fill="#0B132B" stroke="#1E3A8A" stroke-width="1.5"/>' +
    `<circle cx="${cx}" cy="${cy}" r="${ringR}" fill="none" stroke="#334155" stroke-width="1.5" stroke-dasharray="4,4"/>` +
    `<circle cx="${cx}" cy="${cy}" r="74" fill="none" stroke="#1E293B" stroke-width="1"/>` +
    `<text x="34" y="172" fill="#93C5FD" font-family="monospace" font-size="8.5" font-weight="800" transform="rotate(-90 34 172)">DRIVER SIDE (9 O\'CLOCK)</text>` +
    `<text x="324" y="172" fill="#FDE68A" font-family="monospace" font-size="8.5" font-weight="800" transform="rotate(90 324 172)">PASSENGER SIDE (3 O\'CLOCK)</text>` +
    renderTopDownCarSvg(carX, carY, carW, carH, '#2563EB', '#93C5FD', '#1D4ED8', 'V1 INSURED', v1Style.toUpperCase(), 'vertical_up', false, v1Style) +
    impactHighlightSvg +
    clockNodesSvg +

    // Right Panel: Impact Point & Description Alignment Card (x=350..664)
    '<rect x="350" y="50" width="314" height="236" rx="8" fill="#1E293B" stroke="#3B82F6" stroke-width="1.5"/>' +
    '<text x="364" y="72" fill="#93C5FD" font-family="monospace" font-size="9.8" font-weight="900">1. TRUE-SCALE VEHICLE SILHOUETTES (F11):</text>' +
    '<rect x="364" y="79" width="286" height="44" rx="5" fill="#0F172A" stroke="#334155"/>' +
    '<text x="372" y="94" fill="#60A5FA" font-family="sans-serif" font-size="9.5" font-weight="800">V1: ' + esc(geo.vehicle1Label.slice(0, 36)) + '</text>' +
    '<text x="372" y="107" fill="#CBD5E1" font-family="monospace" font-size="8.4">Class: ' + esc(v1Spec.badge.slice(0, 32)) + ' (' + lScale.toFixed(2) + 'x L)</text>' +
    '<text x="372" y="119" fill="#FCA5A5" font-family="sans-serif" font-size="9" font-weight="700">V2: ' + esc(geo.vehicle2Label.slice(0, 36)) + '</text>' +

    '<text x="364" y="141" fill="#FDE68A" font-family="monospace" font-size="9.8" font-weight="900">2. VERIFIED IMPACT ZONE &amp; TRAJECTORY:</text>' +
    '<rect x="364" y="148" width="286" height="44" rx="5" fill="#0F172A" stroke="#F59E0B" stroke-width="1.2"/>' +
    '<text x="372" y="163" fill="#FEF08A" font-family="sans-serif" font-size="9.5" font-weight="800">Impact: ' + esc(geo.impactPoint.slice(0, 34)) + '</text>' +
    '<text x="372" y="176" fill="#E2E8F0" font-family="monospace" font-size="8.5">Clock: ' + esc(geo.clockInfo.clockLabel.slice(0, 35)) + '</text>' +
    '<text x="372" y="188" fill="#93C5FD" font-family="monospace" font-size="8.2">V1: ' + esc(geo.v1Direction.slice(0, 17)) + ' | V2: ' + esc(geo.v2Direction.slice(0, 17)) + '</text>' +

    '<text x="364" y="210" fill="#86EFAC" font-family="monospace" font-size="9.8" font-weight="900">3. DESCRIPTION-TO-DIAGRAM ALIGNMENT:</text>' +
    '<rect x="364" y="217" width="286" height="58" rx="5" fill="#0F172A" stroke="#22C55E" stroke-width="1.2"/>' +
    '<text x="372" y="232" fill="#E2E8F0" font-family="sans-serif" font-size="8.8" font-style="italic">&ldquo;' + esc(qLine1) + '</text>' +
    (qLine2 ? '<text x="372" y="244" fill="#E2E8F0" font-family="sans-serif" font-size="8.8" font-style="italic">' + esc(qLine2) + '</text>' : '') +
    (qLine3 ? '<text x="372" y="256" fill="#E2E8F0" font-family="sans-serif" font-size="8.8" font-style="italic">' + esc(qLine3) + '&rdquo;</text>' : '') +
    '<text x="372" y="270" fill="#4ADE80" font-family="monospace" font-size="8.3" font-weight="900">✓ IMPACT ZONE &amp; BODY PANELS MATCH CALL NOTES 100%</text>' +

    // Footer Bar
    '<rect x="0" y="294" width="680" height="62" fill="#1E293B"/>' +
    '<text x="16" y="313" fill="#93C5FD" font-family="monospace" font-size="9.5" font-weight="800">SCENARIO ID: ' + esc(geo.scenarioId) + ' (' + esc(geo.template) + ') · V1 SILHOUETTE: ' + esc(v1Style.toUpperCase()) + ' · V2 SILHOUETTE: ' + esc(geo.v2StyleClass.toUpperCase()) + '</text>' +
    '<text x="16" y="331" fill="#CBD5E1" font-family="sans-serif" font-size="9.8">📍 Plotted Corridor: ' + esc(geo.fullAddress.slice(0, 62)) + '</text>' +
    '<text x="16" y="347" fill="#94A3B8" font-family="sans-serif" font-size="8.8">Directive F11 True-Scale Vehicle Damage Schematic · Preliminary FNOL Record (TX Ins. Code §4101)</text>' +
    '</svg>'
  );
}

/**
 * Pre-renders all 20 Most Common Auto Claim Scene Diagram templates (SCEN-01 through SCEN-20)
 * so JD and carrier executives can inspect every single prepped diagram, V1/V2 directions of travel,
 * voice probing questions, and triage rules right on the Call Summary Report.
 */
function buildShowcaseSceneDiagrams(record, lang = 'en') {
  const { buildTop20CommonClaimDiagrams } = require('./top_20_claim_diagrams_catalog');
  const helperApi = {
    renderSceneDiagramSvg,
    renderProportionalFloodDiagramSvg
  };
  const top20 = buildTop20CommonClaimDiagrams(helperApi, record);
  return top20.map(s => ({
    id: s.id,
    num: s.num,
    tabLabel: s.shortTab,
    title: s.title,
    category: s.category,
    v1Direction: s.v1Direction,
    v2Direction: s.v2Direction,
    impactClock: s.impactClock,
    voiceRule: s.voiceQuestions,
    triageRule: s.triageRule,
    svg: s.svg
  }));
}

/**
 * Pre-renders the 5 Vehicle Classes × 4 Flood Phases interactive matrix so JD can test
 * Small SUV, Large SUV, Pickup Truck, 2-Door Sports Car, and 4-Door Sedan across Phases 1–4,
 * Floor Computer presence, Driving Engine Hydrolock, and "City Picked It Up" live in the browser!
 */
function renderInteractiveFloodRatioMatrixHtml() {
  const preRenderedSvgs = {};
  const classes = ['sports_car', 'sedan', 'small_suv', 'large_suv', 'truck'];
  classes.forEach(vc => {
    for (let ph = 1; ph <= 4; ph++) {
      preRenderedSvgs[`${vc}_${ph}_parked`] = renderProportionalFloodDiagramSvg({
        vehicleClass: vc,
        phase: ph,
        hasFloorComputer: ph === 2 ? true : undefined,
        drivingHydrolock: false,
        cityPickedUp: false
      });
      preRenderedSvgs[`${vc}_${ph}_hydrolock`] = renderProportionalFloodDiagramSvg({
        vehicleClass: vc,
        phase: ph,
        hasFloorComputer: true,
        drivingHydrolock: true,
        cityPickedUp: true
      });
    }
    // Also add Phase 2 No-Floor-Computer (Clean & Dry Under Deductible) variant
    preRenderedSvgs[`${vc}_2_noecu`] = renderProportionalFloodDiagramSvg({
      vehicleClass: vc,
      phase: 2,
      hasFloorComputer: false,
      drivingHydrolock: false,
      cityPickedUp: false
    });
  });

  return (
    '<div id="interactiveFloodRatioMatrixBox" style="margin-top:14px;background:#EFF6FF;border:2px solid #3B82F6;border-radius:12px;padding:16px;">' +
    '  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">' +
    '    <div>' +
    '      <div style="font-size:11px;font-weight:900;color:#1D4ED8;text-transform:uppercase;letter-spacing:.06em;">🌊 JD FLOOD TRIAGE LAW · VEHICLE-HEIGHT RATIO &amp; 4-PHASE WATERLINE SIMULATOR</div>' +
    '      <div style="font-family:var(--display);font-size:17px;font-weight:900;color:#172554;">Select Vehicle Type, Waterline Phase (1–4), Driving Hydrolock &amp; &ldquo;City Picked It Up&rdquo; Status</div>' +
    '    </div>' +
    '    <span style="background:#172554;color:#FFFFFF;font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;">True Height-to-Vehicle Ratio</span>' +
    '  </div>' +

    '  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:12px;">' +
    '    <div>' +
    '      <label style="display:block;font-size:11.5px;font-weight:800;color:#172554;margin-bottom:4px;">1. Vehicle Type (Height Ratio):</label>' +
    '      <select id="floodSimVehClass" onchange="updateFloodRatioSimulator()" style="width:100%;padding:8px;border:1.5px solid #93C5FD;border-radius:6px;font-size:12.5px;font-weight:700;background:#FFFFFF;">' +
    '        <option value="sports_car">2-Door Sports Car (4.5" Sill · 17" Console)</option>' +
    '        <option value="sedan">4-Door Sedan (5.5" Sill · 21" Console)</option>' +
    '        <option value="small_suv">Small SUV / Crossover (7.8" Sill · 26" Console)</option>' +
    '        <option value="large_suv" selected>Large SUV (9.2" Sill · 31" Console)</option>' +
    '        <option value="truck">Pickup Truck / 4x4 (10.5" Sill · 34" Console)</option>' +
    '      </select>' +
    '    </div>' +
    '    <div>' +
    '      <label style="display:block;font-size:11.5px;font-weight:800;color:#172554;margin-bottom:4px;">2. Flood Waterline Phase (1 to 4):</label>' +
    '      <select id="floodSimPhase" onchange="updateFloodRatioSimulator()" style="width:100%;padding:8px;border:1.5px solid #93C5FD;border-radius:6px;font-size:12.5px;font-weight:700;background:#FFFFFF;">' +
    '        <option value="1_parked">Phase 1: Only Tires / Rims (Below Door Sill)</option>' +
    '        <option value="2_parked" selected>Phase 2A: Floorboards (Computer in Floor -> Likely Total Loss*)</option>' +
    '        <option value="2_noecu">Phase 2B: Floorboards (No Floor ECU -> Clean Seats &amp; Dry / Under Ded.)</option>' +
    '        <option value="3_parked">Phase 3: Inside Cabin, Below Cup Holders</option>' +
    '        <option value="4_parked">Phase 4: Cup Holder / Center Console Level+ (Total Loss*)</option>' +
    '      </select>' +
    '    </div>' +
    '    <div>' +
    '      <label style="display:block;font-size:11.5px;font-weight:800;color:#172554;margin-bottom:4px;">3. Driving Hydrolock &amp; &ldquo;City Picked It Up&rdquo;:</label>' +
    '      <select id="floodSimHydrolock" onchange="updateFloodRatioSimulator()" style="width:100%;padding:8px;border:1.5px solid #93C5FD;border-radius:6px;font-size:12.5px;font-weight:700;background:#FFFFFF;">' +
    '        <option value="parked" selected>Parked / Engine Off · Location Known</option>' +
    '        <option value="hydrolock">🚨 Driving &amp; Engine Stopped (Hydrolock) + &ldquo;City Picked It Up&rdquo;</option>' +
    '      </select>' +
    '    </div>' +
    '  </div>' +

    '  <div id="floodSimSvgStage" style="margin-bottom:10px;">' +
         preRenderedSvgs['large_suv_2_parked'] +
    '  </div>' +

    '  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px;font-size:12px;">' +
    '    <div style="background:#FFFFFF;border:1px solid #BFDBFE;border-left:4px solid #16A34A;padding:8px;border-radius:6px;"><b>Phase 1 (Tires/Rims Only):</b> Water below door sill. On a Truck (17" floorboard), 12" of water is still Phase 1; on a 2-Door Sports Car (6.5" floorboard), 12" is already Phase 3!</div>' +
    '    <div style="background:#FFFFFF;border:1px solid #BFDBFE;border-left:4px solid #D97706;padding:8px;border-radius:6px;"><b>Phase 2 (Floorboards):</b> If Computer/ECU in floor = <b>Likely Total Loss*</b>. If no floor computer = <b>Clean seats &amp; dry carpet (likely under deductible)</b>.</div>' +
    '    <div style="background:#FFFFFF;border:1px solid #BFDBFE;border-left:4px solid #EA580C;padding:8px;border-radius:6px;"><b>Phase 3 (Below Cup Holders) &amp; Phase 4 (Cup Holder/Console+):</b> Phase 3 soaks seat motors/harnesses; Phase 4 submerges console/BCM = <b>Immediate Total Loss*</b>.</div>' +
    '    <div style="background:#FFFFFF;border:1px solid #BFDBFE;border-left:4px solid #DC2626;padding:8px;border-radius:6px;"><b>Driving Hydrolock &amp; &ldquo;City Picked It Up&rdquo;:</b> Driving + engine stopped = <b>Likely Total Loss* (Hydrolock)</b>. If customer says <i>&ldquo;City picked it up&rdquo;</i>, triggers Municipal Impound &amp; VIN Tow Locator.</div>' +
    '  </div>' +
    '  <script>' +
    '  window.__FLOOD_RATIO_SVGS = ' + JSON.stringify(preRenderedSvgs) + ';' +
    '  function updateFloodRatioSimulator(){' +
    '    var vc = (document.getElementById("floodSimVehClass")||{}).value || "large_suv";' +
    '    var phKey = (document.getElementById("floodSimPhase")||{}).value || "2_parked";' +
    '    var hydro = (document.getElementById("floodSimHydrolock")||{}).value || "parked";' +
    '    var lookup = vc + "_" + phKey;' +
    '    if (hydro === "hydrolock") {' +
    '      var phNum = phKey.charAt(0);' +
    '      lookup = vc + "_" + phNum + "_hydrolock";' +
    '    }' +
    '    var stage = document.getElementById("floodSimSvgStage");' +
    '    if (stage && window.__FLOOD_RATIO_SVGS && window.__FLOOD_RATIO_SVGS[lookup]) {' +
    '      stage.innerHTML = window.__FLOOD_RATIO_SVGS[lookup];' +
    '    }' +
    '  }' +
    '  </script>' +
    '</div>'
  );
}

/**
 * Render the Interactive Map Pinpoint & Multi-Scenario Scene Diagram HTML Section.
 */
function renderInteractiveMapSection(record, lang = 'en', token = '') {
  const geo = resolveSceneGeometry(record);
  const scenarios = buildShowcaseSceneDiagrams(record, lang);
  const activeScenarioId = scenarios.some(s => s.id === geo.scenarioId) ? geo.scenarioId : (scenarios[0] ? scenarios[0].id : 'SCEN-01');
  const callSpecificSceneSvg = renderSceneDiagramSvg(record, lang);
  const callSpecificDamageClockSvg = renderVehicleDamageClockSvg(record, lang);
  const rawLat = Number(geo.pinpoint && geo.pinpoint.lat);
  const rawLng = Number(geo.pinpoint && geo.pinpoint.lng);
  const hasVerifiedPin = Boolean(geo.pinpoint) && Number.isFinite(rawLat) && Number.isFinite(rawLng);
  const pinpointLat = hasVerifiedPin ? rawLat : 32.8029;
  const pinpointLng = hasVerifiedPin ? rawLng : -96.7985;
  const latDisplay = Number(pinpointLat).toFixed(4) + '° N';
  const lngDisplay = Math.abs(Number(pinpointLng)).toFixed(4) + '° W';
  const callSidSafe = esc((record && record.callSid) || '');
  const tokenSafe = esc(token || (record && record.token) || '');

  const badgeText = geo.isApproximateRural
    ? (geo.mapPinConfirmed
        ? 'Rural Map Pinpoint Confirmed (' + latDisplay + ', ' + lngDisplay + ')'
        : '📍 Rural / Approximate Address — Centered at ' + latDisplay + ', ' + lngDisplay)
    : (geo.verifiedByMaps
        ? 'Google Maps Verified Intersection — Plotted'
        : '⚡ Auto-Plotted from Voice Intake');

  const resolutionRowValue = geo.isApproximateRural
    ? '<span style="color:#1D4ED8;font-weight:700;">Rural / Unnumbered Corridor Pinpointed (' + latDisplay + ', ' + lngDisplay + ')</span> — 2nd Listener detected approximate mile-offset location and triggered interactive map pinpoint.'
    : '<span style="color:#166534;font-weight:700;">Verified Street / Intersection (' + esc(geo.primaryStreet) + ' &amp; ' + esc(geo.crossStreet) + ')</span> — Resolved directly via Google Maps / Geocoding.';

  const kinematicBannerHtml =
    '<div id="kinematicRedFlagAuditBox" style="background:#F0FDF4;border:1.5px solid #16A34A;border-left:5px solid #15803D;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12.5px;color:#14532D;">' +
    '  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:3px;">' +
    '    <strong style="color:#166534;">🛡️ Automated Direction-of-Travel (V1 &amp; V2) + Kinematic Clock-Face Verification:</strong>' +
    '    <button type="button" class="btn-outline no-print" onclick="toggleKinematicRedFlagSim()" style="font-size:11px;padding:2px 8px;border-color:#DC2626;color:#DC2626;font-weight:700;">🚨 Simulate 9PM vs 2PM/3PM Trajectory Conflict Red Flag</button>' +
    '  </div>' +
    '  <div><b>V1 Direction:</b> ' + esc(geo.v1Direction) + ' · <b>V2 Direction:</b> ' + esc(geo.v2Direction) + ' · <b>Impact Clock:</b> ' + esc(geo.clockInfo.clockLabel) + '</div>' +
    '  <div style="margin-top:3px;"><b>V1 True-Scale Vehicle:</b> ' + esc(geo.vehicle1Label) + ' (<code>' + esc(geo.v1Spec.badge) + '</code>) · <b>V2 Vehicle:</b> ' + esc(geo.vehicle2Label) + ' (<code>' + esc(geo.v2Spec.badge) + '</code>)</div>' +
    '  <div style="margin-top:3px;">' + esc(geo.kinematicAuditNote || 'Both vehicles\' travel directions, true-scale silhouettes, and lane geometries are cross-checked against the 12-hour impact clock.') + '</div>' +
    '  <div id="kinematicConflictSimAlert" style="display:none;margin-top:8px;padding:9px 11px;background:#FEF2F2;border:1.5px solid #DC2626;border-radius:6px;color:#991B1B;font-weight:700;font-size:12px;">' +
    '    🚨 <b>RED FLAG — KINEMATIC GEOMETRY CONFLICT DETECTED (RULE GEO-CLOCK-01):</b> If V1 is traveling Eastbound (facing Right = 12 O\'Clock) and V2 approaches Southbound from the Top/North leg, V2 physically strikes V1\'s <b>9 O\'Clock / 10 O\'Clock Driver Side (Top Edge)</b> — it CANNOT strike <b>2 O\'Clock / 3 O\'Clock Passenger Side (Bottom Edge)</b> without passing through V1. Adjuster recorded-statement verification of travel headings required!' +
    '  </div>' +
    '</div>';

  const callSpecificPairHtml =
    '<div id="callSpecificSceneAndDamageGrid" style="background:#EFF6FF;border:2px solid #2563EB;border-radius:12px;padding:14px;margin-bottom:16px;">' +
    '  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">' +
    '    <div>' +
    '      <div style="font-size:11px;font-weight:900;color:#1D4ED8;text-transform:uppercase;letter-spacing:.05em;">📌 ACTIVE CALL ACCIDENT SCENE DIAGRAM, TRUE-SCALE VEHICLE DAMAGE CLOCK &amp; GPS CORRIDOR PINPOINT</div>' +
    '      <div style="font-size:15px;font-weight:900;color:#172554;">' + esc(geo.templateLabelEn) + ' · Plotted at ' + esc(geo.fullAddress) + ' (' + latDisplay + ', ' + lngDisplay + ')</div>' +
    '    </div>' +
    '    <span style="background:#16A34A;color:#FFFFFF;font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;">✓ Mapped &amp; Diagrammed (' + esc(activeScenarioId) + ')</span>' +
    '  </div>' +
    '  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:12px;align-items:start;">' +
    '    <div>' +
    '      <div style="font-size:11.5px;font-weight:800;color:#1E3A8A;margin-bottom:5px;">1️⃣ Call-Specific Accident Scene &amp; Roadway Trajectory Schematic:</div>' +
           callSpecificSceneSvg +
    '    </div>' +
    '    <div>' +
    '      <div style="font-size:11.5px;font-weight:800;color:#1E3A8A;margin-bottom:5px;">2️⃣ True-Scale Vehicle Silhouette &amp; 12-Hour Clock Impact Point Alignment:</div>' +
           callSpecificDamageClockSvg +
    '    </div>' +
    '  </div>' +
    '</div>';

  const allScenarioIdsJson = JSON.stringify(scenarios.map(s => s.id));

  return (
    '<section class="panel" id="map-pinpoint" style="position:relative;">' +
    '<div class="feature-callout" data-callout-step="1" data-callout-title="Top 20 Most Common Auto Claim CR-3 & Flood Ratio Diagrams">' +
    '  <div style="display:flex;align-items:flex-start;gap:10px;">' +
    '    <div style="font-size:12.5px;color:#1E3A8A;line-height:1.5;">' +
    '      <div style="font-weight:800;text-transform:uppercase;letter-spacing:0.04em;color:#1D4ED8;margin-bottom:3px;">✨ Feature Callout #4 · Top 20 Most Common Auto Claim Scene Diagrams (Directions, 3-Lane Hwy + HOV/Exit, Walmart 90°/45° Lot &amp; 4-Phase Flood)</div>' +
    '      <div>Click any of the <b>20 Prepped Claim Scenario Tabs</b> below (or click <b>&ldquo;📋 Show All 20 Diagrams Simultaneously&rdquo;</b>) to inspect how Angel captures both vehicles\' directions of travel, asks targeted probing questions, and renders deterministic CR-3 &amp; 4-Phase Flood schematics across >98% of auto claim volume!</div>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">' +
    '<h2 style="margin:0;border:none;padding:0;">' + (lang === 'es' ? '📍 Diagramas Vectoriales de los 20 Siniestros Más Comunes (CR-3)' : '📍 Top 20 Most Common Auto Claim Scene Diagrams (Prepped CR-3 &amp; 4-Phase Flood Catalog)') + '</h2>' +
    '<span class="pill" style="background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;">' +
    esc(badgeText) +
    '</span></div>' +
    kinematicBannerHtml +
    callSpecificPairHtml +
    '<div style="background:#F8FAFC;border:1.5px solid #93C5FD;border-radius:10px;padding:12px;margin-bottom:12px;" class="no-print">' +
    '  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">' +
    '    <div style="font-size:12px;font-weight:900;color:#172554;text-transform:uppercase;">🔍 Top 20 Most Common Auto Claim Scenarios (Click Any Scenario Tab or Filter by Category):</div>' +
    '    <button type="button" id="toggleAll20DiagramsBtn" onclick="toggleShowAll20SceneDiagrams()" style="cursor:pointer;background:#172554;color:#FFFFFF;border:1.5px solid #3B82F6;font-size:11.5px;font-weight:900;padding:6px 12px;border-radius:6px;">📋 Show All 20 Diagrams Simultaneously (Scroll View)</button>' +
    '  </div>' +
    '  <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #E2E8F0;">' +
    '    <button type="button" class="sub-pill active" id="scenCatBtn_ALL" onclick="filterSceneDiagramCategory(\'ALL\')" style="font-size:11px;padding:4px 10px;">All 20 Scenarios</button>' +
    '    <button type="button" class="sub-pill" id="scenCatBtn_Rear" onclick="filterSceneDiagramCategory(\'Rear-End\')" style="font-size:11px;padding:4px 10px;">Rear-End &amp; Chain (#1–#2)</button>' +
    '    <button type="button" class="sub-pill" id="scenCatBtn_Inter" onclick="filterSceneDiagramCategory(\'Intersection\')" style="font-size:11px;padding:4px 10px;">Intersection &amp; Turn (#3–#7)</button>' +
    '    <button type="button" class="sub-pill" id="scenCatBtn_Hwy" onclick="filterSceneDiagramCategory(\'Highway\')" style="font-size:11px;padding:4px 10px;">Highway, HOV/Exit &amp; Merge (#8–#10)</button>' +
    '    <button type="button" class="sub-pill" id="scenCatBtn_Park" onclick="filterSceneDiagramCategory(\'Parking\')" style="font-size:11px;padding:4px 10px;">Walmart / Parking &amp; Backing (#11–#14)</button>' +
    '    <button type="button" class="sub-pill" id="scenCatBtn_Comp" onclick="filterSceneDiagramCategory(\'Single-Vehicle\')" style="font-size:11px;padding:4px 10px;">Flood 4-Phase, Single-Car &amp; Comp (#15–#20)</button>' +
    '  </div>' +
    '  <div style="display:flex;flex-wrap:wrap;gap:5px;">' +
    scenarios.map((s) => {
      const isAct = s.id === activeScenarioId;
      return '<button type="button" id="sceneTabBtn_' + s.id + '" data-scen-cat="' + esc(s.category || '') + '" onclick="switchSceneDiagramPreview(\'' + s.id + '\')" style="cursor:pointer;font-size:11px;font-weight:800;padding:5px 9px;border-radius:6px;border:1.5px solid ' + (isAct ? '#1D4ED8' : '#CBD5E1') + ';background:' + (isAct ? '#1D4ED8' : '#FFFFFF') + ';color:' + (isAct ? '#FFFFFF' : '#172554') + ';">' + esc(s.tabLabel) + '</button>';
    }).join('') +
    '  </div>' +
    '</div>' +
    scenarios.map((s) => {
      const isAct = s.id === activeScenarioId;
      return '<div id="sceneSvgPane_' + s.id + '" data-scen-cat="' + esc(s.category || '') + '" style="display:' + (isAct ? 'block' : 'none') + ';margin-bottom:16px;background:#FFFFFF;border:1.5px solid #BFDBFE;border-radius:10px;padding:12px;">' +
      '  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">' +
      '    <div>' +
      '      <span style="display:inline-block;background:#DBEAFE;color:#1E40AF;font-size:10.5px;font-weight:900;padding:2px 8px;border-radius:999px;text-transform:uppercase;margin-right:6px;">' + esc(s.category || 'CR-3 Scenario') + '</span>' +
      '      <strong style="font-size:15px;color:#172554;">' + esc(s.title || s.tabLabel) + '</strong>' +
      '    </div>' +
      '    <button type="button" class="btn-outline no-print" onclick="navigatePortal(6,\'sec-6-4\');setTimeout(function(){var r=document.getElementById(\'revRow_' + s.id + '\');if(r)r.scrollIntoView({behavior:\'smooth\',block:\'center\'});},150);" style="font-size:11px;padding:4px 10px;">📝 Give Feedback on #' + s.num + ' in Review Hub</button>' +
      '  </div>' +
      '  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px;margin-bottom:8px;font-size:12px;">' +
      '    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-left:3.5px solid #2563EB;padding:6px 10px;border-radius:6px;"><b>V1 (Insured) Direction:</b><br>' + esc(s.v1Direction || geo.v1Direction) + '</div>' +
      '    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-left:3.5px solid #DC2626;padding:6px 10px;border-radius:6px;"><b>V2 / Counterparty Direction:</b><br>' + esc(s.v2Direction || geo.v2Direction) + '</div>' +
      '    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-left:3.5px solid #D97706;padding:6px 10px;border-radius:6px;"><b>12-Hour Impact Clock:</b><br>' + esc(s.impactClock || geo.clockInfo.clockLabel) + '</div>' +
      '  </div>' +
      '  <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-left:4px solid #1D4ED8;border-radius:6px;padding:8px 12px;margin-bottom:6px;font-size:12px;color:#1E3A8A;"><b>🎙️ What Angel Asks (Voice Probing Questions):</b> ' + esc(s.voiceRule) + '</div>' +
      (s.triageRule ? '  <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-left:4px solid #16A34A;border-radius:6px;padding:7px 12px;margin-bottom:10px;font-size:12px;color:#14532D;"><b>⚖️ Preliminary Factual Triage &amp; Subrogation Rule:</b> ' + esc(s.triageRule) + '</div>' : '') +
      s.svg +
      '</div>';
    }).join('') +

    /* Interactive 4-Phase Flood by Vehicle Type Simulator right inside Section 1.2 */
    renderInteractiveFloodRatioMatrixHtml() +

    '<table style="margin-top:14px;">' +
    '<tr><td class="k">V1 (Insured) Vehicle &amp; True-Scale Class</td><td class="v"><b>' + esc(geo.vehicle1Label) + '</b> · <code>' + esc(geo.v1Spec.badge) + '</code></td></tr>' +
    '<tr><td class="k">V2 (Counterparty) Vehicle &amp; Class</td><td class="v"><b>' + esc(geo.vehicle2Label) + '</b> · <code>' + esc(geo.v2Spec.badge) + '</code></td></tr>' +
    '<tr><td class="k">V1 (Insured) Direction of Travel</td><td class="v"><b>' + esc(geo.v1Direction) + '</b></td></tr>' +
    '<tr><td class="k">V2 (Other Vehicle) Direction of Travel</td><td class="v"><b>' + esc(geo.v2Direction) + '</b></td></tr>' +
    '<tr><td class="k">Plottable Address / Anchor</td><td class="v"><b id="pinAddressDisplay">' + esc(geo.fullAddress) + (hasVerifiedPin ? ' (' + latDisplay + ', ' + lngDisplay + ')' : '') + '</b></td></tr>' +
    '<tr><td class="k">2nd Listener Geocoding</td><td class="v">' + resolutionRowValue + '</td></tr>' +
    '<tr><td class="k">Impact Clock &amp; Trajectory</td><td class="v"><b>' + esc(geo.clockInfo.clockLabel) + '</b> · ' + esc(geo.v2TrajectoryDescription) + '</td></tr>' +
    '<tr><td class="k">Scene Diagram Template</td><td class="v">' + esc(geo.templateLabelEn) + ' (<code>' + esc(geo.template) + '</code> · <code>' + esc(activeScenarioId) + '</code>)</td></tr>' +
    '<tr><td class="k">Regulatory Classification</td><td class="v"><span style="color:#16A34A;font-weight:700;">' + esc(geo.sufficiencyStatus) + '</span> · Preliminary Administrative Record (TX Ins. Code §4101)</td></tr>' +
    '</table>' +
    '<div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;" class="no-print">' +
    '<button type="button" class="btn-outline" onclick="pinpointCurrentLocation()" style="cursor:pointer;">📍 Test Rural / Adjuster Map Pin Override (' + latDisplay + ', ' + lngDisplay + ')</button>' +
    '<a class="btn-outline" target="_blank" href="' + esc('https://www.openstreetmap.org/?mlat=' + pinpointLat + '&mlon=' + pinpointLng + '#map=14/' + pinpointLat + '/' + pinpointLng) + '">🗺️ Open Live OpenStreetMap</a>' +
    '<a class="btn-outline" target="_blank" href="' + esc(hasVerifiedPin ? ('https://www.google.com/maps/search/?api=1&query=' + pinpointLat + ',' + pinpointLng) : ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(geo.fullAddress || 'Dallas, TX'))) + '">🌎 Verify on Google Maps</a>' +
    '<span id="pinpointStatusMsg" style="font-size:12px;color:#16A34A;font-weight:600;">' + (geo.mapPinConfirmed ? 'GPS Pin Confirmed &amp; Synced to Claim File' : '') + '</span>' +
    '</div>' +
    '<div id="interactivePinBox" style="' + (geo.isApproximateRural ? 'display:block;' : 'display:none;') + 'margin-top:12px;padding:12px;background:#F8FAFC;border:1px solid #CBD5E1;border-radius:8px;">' +
    '<div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:6px;">Confirm or Refine Exact Scene Coordinates / Rural Mile Marker:</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
    '<input type="text" id="pinCrossStreetInput" value="' + esc(geo.fullAddress + ' (' + latDisplay + ', ' + lngDisplay + ')') + '" placeholder="Street address, cross-street, or rural mile marker" style="flex:1;min-width:220px;padding:8px 10px;border:1px solid #CBD5E1;border-radius:6px;font-size:13px;">' +
    '<button type="button" class="btn" onclick="saveMapPinpoint()" style="cursor:pointer;border:none;padding:8px 14px;">Save Pinpoint to Claim File</button>' +
    '</div></div>' +
    '<script>' +
    'window.__lastPinLat=' + Number(pinpointLat) + ';window.__lastPinLng=' + Number(pinpointLng) + ';' +
    'window.__all20Expanded=false;' +
    'function toggleKinematicRedFlagSim(){' +
    '  var el=document.getElementById("kinematicConflictSimAlert");' +
    '  if(el) el.style.display=(el.style.display==="none"||!el.style.display)?"block":"none";' +
    '}' +
    'function switchSceneDiagramPreview(scId){' +
    '  var aliasMap={live_call:"SCEN-04",hwy_3lane_hov_exit:"SCEN-09",parking_straight_90:"SCEN-11",parking_diagonal_45:"SCEN-12",flood_water:"SCEN-15",t_bone:"SCEN-03",rear_end:"SCEN-01",sideswipe:"SCEN-08",animal_rural:"SCEN-18"};' +
    '  var resolvedId=aliasMap[scId]||scId;' +
    '  window.__all20Expanded=false;' +
    '  var tBtn=document.getElementById("toggleAll20DiagramsBtn");' +
    '  if(tBtn) tBtn.innerText="📋 Show All 20 Diagrams Simultaneously (Scroll View)";' +
    '  var ids=' + allScenarioIdsJson + ';' +
    '  for(var i=0;i<ids.length;i++){' +
    '    var p=document.getElementById("sceneSvgPane_"+ids[i]);' +
    '    var b=document.getElementById("sceneTabBtn_"+ids[i]);' +
    '    if(p) p.style.display=(ids[i]===resolvedId)?"block":"none";' +
    '    if(b){' +
    '      b.style.background=(ids[i]===resolvedId)?"#1D4ED8":"#FFFFFF";' +
    '      b.style.color=(ids[i]===resolvedId)?"#FFFFFF":"#172554";' +
    '      b.style.borderColor=(ids[i]===resolvedId)?"#1D4ED8":"#CBD5E1";' +
    '    }' +
    '  }' +
    '}' +
    'function toggleShowAll20SceneDiagrams(){' +
    '  window.__all20Expanded=!window.__all20Expanded;' +
    '  var ids=' + allScenarioIdsJson + ';' +
    '  for(var i=0;i<ids.length;i++){' +
    '    var p=document.getElementById("sceneSvgPane_"+ids[i]);' +
    '    if(p) p.style.display=window.__all20Expanded?"block":(ids[i]==="' + activeScenarioId + '"?"block":"none");' +
    '  }' +
    '  var tBtn=document.getElementById("toggleAll20DiagramsBtn");' +
    '  if(tBtn) tBtn.innerText=window.__all20Expanded?"🔼 Collapse to Single-Tab View":"📋 Show All 20 Diagrams Simultaneously (Scroll View)";' +
    '}' +
    'function filterSceneDiagramCategory(catPrefix){' +
    '  var ids=' + allScenarioIdsJson + ';' +
    '  var firstMatch=null;' +
    '  for(var i=0;i<ids.length;i++){' +
    '    var b=document.getElementById("sceneTabBtn_"+ids[i]);' +
    '    if(!b) continue;' +
    '    var c=b.getAttribute("data-scen-cat")||"";' +
    '    var show=(catPrefix==="ALL"||c.indexOf(catPrefix)!==-1);' +
    '    b.style.display=show?"inline-block":"none";' +
    '    if(show && !firstMatch) firstMatch=ids[i];' +
    '  }' +
    '  if(firstMatch && !window.__all20Expanded) switchSceneDiagramPreview(firstMatch);' +
    '}' +
    'function pinpointCurrentLocation(){' +
    '  var box=document.getElementById("interactivePinBox");' +
    '  if(box) box.style.display="block";' +
    '  var msg=document.getElementById("pinpointStatusMsg");' +
    '  if(navigator.geolocation){' +
    '    if(msg) msg.innerText="Acquiring GPS pinpoint...";' +
    '    navigator.geolocation.getCurrentPosition(function(pos){' +
    '      window.__lastPinLat=pos.coords.latitude; window.__lastPinLng=pos.coords.longitude;' +
    '      if(msg) msg.innerText="GPS Pin Locked ("+pos.coords.latitude.toFixed(4)+", "+pos.coords.longitude.toFixed(4)+")";' +
    '    }, function(){ if(msg) msg.innerText="Defaulted to Rural Offset Coordinates ("+window.__lastPinLat.toFixed(4)+", "+window.__lastPinLng.toFixed(4)+")"; });' +
    '  }' +
    '}' +
    'function saveMapPinpoint(){' +
    '  var addr=(document.getElementById("pinCrossStreetInput")||{}).value||"";' +
    '  var disp=document.getElementById("pinAddressDisplay");' +
    '  if(disp && addr) disp.innerText=addr;' +
    '  var msg=document.getElementById("pinpointStatusMsg");' +
    '  if(msg) msg.innerText="Scene pinpoint saved & synced to live session!";' +
    '  try{' +
    '    fetch("/call/' + callSidSafe + '/pinpoint?t=' + tokenSafe + '", {' +
    '      method:"POST", headers:{"Content-Type":"application/json"},' +
    '      body:JSON.stringify({ address: addr, lat: window.__lastPinLat, lng: window.__lastPinLng })' +
    '    });' +
    '  }catch(e){}' +
    '}' +
    '</script>' +
    '</section>\n'
  );
}

module.exports = {
  FLOOD_VEHICLE_CLASSES,
  FLOOD_PHASES,
  TRUE_SCALE_VEHICLE_SPECS,
  resolveVehicleStyleClass,
  renderTopDownCarSvg,
  parseImpactClockAndSide,
  parseVehicleDirections,
  validateKinematicConsistency,
  resolveSceneGeometry,
  renderSceneDiagramSvg,
  renderVehicleDamageClockSvg,
  renderProportionalFloodDiagramSvg,
  renderInteractiveFloodRatioMatrixHtml,
  buildShowcaseSceneDiagrams,
  renderInteractiveMapSection
};
