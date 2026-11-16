/**
 * exif_haversine_and_pii_engine.js
 * =============================================================================
 * Series C Production Forensic Photo Vault, Dynamic N/A Scoring,
 * Transcript/Audio PII Scrubber & 24h Dropped-Call ANI Resume Engine
 *
 * Authority: Law T0.1, Law T1.29c (TX Ins. Code §4101 Non-Adjudication), Law T3.13
 * Queue Tasks:
 *   - SC-ADDON-AUDIT-P0-01: Binary JPEG/PNG SHA-256 + Pure-JS EXIF APP1 Parser + Haversine Distance
 *   - SC-ADDON-AUDIT-P0-03: Dynamic N/A Score Denominator Calculator + Critical Fail Ceiling (<=59%)
 *   - SC-ADDON-AUDIT-P0-04: PartialIncompleteSessionStore (${tenantId}:${callerAni}, 24h TTL)
 *   - SC-ADDON-AUDIT-P0-06: Transcript & Audio Timestamp PII Scrubber (SSN, Luhn CC, Bank, DL)
 * =============================================================================
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TX_4101_RECORD_TYPE = 'Record Type: Preliminary — Pending Licensed Adjuster Determination';
const TX_4101_DISCLAIMER =
  'Preliminary Administrative QA & Intake Record Only (Texas Insurance Code Chapter 4101). ' +
  'Formal adjustment, liability, fault, and coverage decisions belong strictly to licensed insurer personnel.';

const EARTH_RADIUS_KM = 6371.0088;
const EARTH_RADIUS_MILES = 3958.7613;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// =============================================================================
// 1. BINARY SHA-256, MAGIC BYTES, PURE-JS EXIF APP1 PARSER & HAVERSINE ENGINE
// =============================================================================

/**
 * Compute cryptographic SHA-256 hex digest over raw binary Buffer
 */
function computeSha256Hex(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input || '');
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Detect binary image format from magic bytes
 */
function detectImageFormat(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return 'UNKNOWN';
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'JPEG';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'PNG';
  if (buf.length >= 12 && buf.slice(4, 8).toString('ascii') === 'ftyp') return 'HEIC';
  if (buf.length >= 12 && buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'WEBP';
  return 'UNKNOWN';
}

/**
 * Pure-JS zero-dependency JPEG EXIF APP1 (0xFFE1) TIFF Tag Parser
 * Extracts DateTimeOriginal, DateTime, Make, Model, Software, GPSLatitude, GPSLongitude.
 */
function parseExifApp1(buffer) {
  const result = {
    hasExif: false,
    byteOrder: null,
    Make: null,
    Model: null,
    Software: null,
    DateTime: null,
    DateTimeOriginal: null,
    DateTimeDigitized: null,
    GPSLatitudeRef: null,
    GPSLongitudeRef: null,
    GPSLatitude: null,
    GPSLongitude: null,
    softwareTamperDetected: false,
    softwareTamperMatch: null
  };

  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return result;
  }

  // Locate JPEG SOI (0xFFD8) or scan directly for Exif\0\0 header
  let offset = 0;
  let tiffStart = -1;

  if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
    offset = 2;
    while (offset + 4 <= buffer.length) {
      if (buffer[offset] !== 0xFF) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      if (marker === 0xDA || marker === 0xD9) break; // SOS or EOI
      const segLength = buffer.readUInt16BE(offset + 2);
      if (segLength < 2 || offset + 2 + segLength > buffer.length) break;

      if (
        marker === 0xE1 &&
        segLength >= 8 &&
        buffer.slice(offset + 4, offset + 10).toString('ascii') === 'Exif\0\0'
      ) {
        tiffStart = offset + 10;
        break;
      }
      offset += 2 + segLength;
    }
  } else {
    const idx = buffer.indexOf(Buffer.from('Exif\0\0', 'ascii'));
    if (idx !== -1 && idx + 6 < buffer.length) {
      tiffStart = idx + 6;
    }
  }

  if (tiffStart === -1 || tiffStart + 8 > buffer.length) {
    return result;
  }

  const endianMarker = buffer.readUInt16BE(tiffStart);
  let isLittleEndian = false;
  if (endianMarker === 0x4949) {
    isLittleEndian = true;
    result.byteOrder = 'II_LITTLE_ENDIAN';
  } else if (endianMarker === 0x4D4D) {
    isLittleEndian = false;
    result.byteOrder = 'MM_BIG_ENDIAN';
  } else {
    return result;
  }

  const readU16 = (pos) => (isLittleEndian ? buffer.readUInt16LE(pos) : buffer.readUInt16BE(pos));
  const readU32 = (pos) => (isLittleEndian ? buffer.readUInt32LE(pos) : buffer.readUInt32BE(pos));

  const magic42 = readU16(tiffStart + 2);
  if (magic42 !== 0x002A) return result;

  const ifd0Offset = readU32(tiffStart + 4);
  if (tiffStart + ifd0Offset + 2 > buffer.length) return result;

  result.hasExif = true;

  function readAsciiTag(type, count, valueOffsetPos) {
    if (type !== 2 || count <= 0) return null;
    let strPos = valueOffsetPos;
    if (count > 4) {
      const rel = readU32(valueOffsetPos);
      strPos = tiffStart + rel;
    }
    if (strPos < 0 || strPos + count > buffer.length) return null;
    return buffer
      .slice(strPos, strPos + count)
      .toString('ascii')
      .replace(/\0+$/g, '')
      .trim();
  }

  function readRationalTriplet(type, count, valueOffsetPos) {
    if (type !== 5 || count < 3) return null;
    const rel = readU32(valueOffsetPos);
    const ratPos = tiffStart + rel;
    if (ratPos < 0 || ratPos + 24 > buffer.length) return null;
    const values = [];
    for (let i = 0; i < 3; i++) {
      const num = readU32(ratPos + i * 8);
      const den = readU32(ratPos + i * 8 + 4);
      values.push(den === 0 ? 0 : num / den);
    }
    return values;
  }

  function parseIfd(ifdRelOffset) {
    const dirStart = tiffStart + ifdRelOffset;
    if (dirStart < 0 || dirStart + 2 > buffer.length) return {};
    const numEntries = readU16(dirStart);
    const entries = {};
    for (let i = 0; i < numEntries; i++) {
      const entryPos = dirStart + 2 + i * 12;
      if (entryPos + 12 > buffer.length) break;
      const tag = readU16(entryPos);
      const type = readU16(entryPos + 2);
      const count = readU32(entryPos + 4);
      const valueOffsetPos = entryPos + 8;
      entries[tag] = { tag, type, count, valueOffsetPos };
    }
    return entries;
  }

  const ifd0 = parseIfd(ifd0Offset);
  if (ifd0[0x010F]) result.Make = readAsciiTag(ifd0[0x010F].type, ifd0[0x010F].count, ifd0[0x010F].valueOffsetPos);
  if (ifd0[0x0110]) result.Model = readAsciiTag(ifd0[0x0110].type, ifd0[0x0110].count, ifd0[0x0110].valueOffsetPos);
  if (ifd0[0x0131]) result.Software = readAsciiTag(ifd0[0x0131].type, ifd0[0x0131].count, ifd0[0x0131].valueOffsetPos);
  if (ifd0[0x0132]) result.DateTime = readAsciiTag(ifd0[0x0132].type, ifd0[0x0132].count, ifd0[0x0132].valueOffsetPos);

  if (ifd0[0x8769]) {
    const exifIfdOffset = readU32(ifd0[0x8769].valueOffsetPos);
    const exifIfd = parseIfd(exifIfdOffset);
    if (exifIfd[0x9003]) {
      result.DateTimeOriginal = readAsciiTag(exifIfd[0x9003].type, exifIfd[0x9003].count, exifIfd[0x9003].valueOffsetPos);
    }
    if (exifIfd[0x9004]) {
      result.DateTimeDigitized = readAsciiTag(exifIfd[0x9004].type, exifIfd[0x9004].count, exifIfd[0x9004].valueOffsetPos);
    }
  }

  if (ifd0[0x8825]) {
    const gpsIfdOffset = readU32(ifd0[0x8825].valueOffsetPos);
    const gpsIfd = parseIfd(gpsIfdOffset);
    if (gpsIfd[0x0001]) {
      result.GPSLatitudeRef = readAsciiTag(gpsIfd[0x0001].type, gpsIfd[0x0001].count, gpsIfd[0x0001].valueOffsetPos);
    }
    if (gpsIfd[0x0003]) {
      result.GPSLongitudeRef = readAsciiTag(gpsIfd[0x0003].type, gpsIfd[0x0003].count, gpsIfd[0x0003].valueOffsetPos);
    }
    if (gpsIfd[0x0002]) {
      const dmsLat = readRationalTriplet(gpsIfd[0x0002].type, gpsIfd[0x0002].count, gpsIfd[0x0002].valueOffsetPos);
      if (dmsLat) {
        let decLat = dmsLat[0] + dmsLat[1] / 60 + dmsLat[2] / 3600;
        if (String(result.GPSLatitudeRef || 'N').toUpperCase() === 'S') decLat = -decLat;
        result.GPSLatitude = Math.round(decLat * 1000000) / 1000000;
      }
    }
    if (gpsIfd[0x0004]) {
      const dmsLon = readRationalTriplet(gpsIfd[0x0004].type, gpsIfd[0x0004].count, gpsIfd[0x0004].valueOffsetPos);
      if (dmsLon) {
        let decLon = dmsLon[0] + dmsLon[1] / 60 + dmsLon[2] / 3600;
        if (String(result.GPSLongitudeRef || 'E').toUpperCase() === 'W') decLon = -decLon;
        result.GPSLongitude = Math.round(decLon * 1000000) / 1000000;
      }
    }
  }

  if (result.Software) {
    const tamperRegex = /(adobe\s*photoshop|lightroom|gimp|canva|midjourney|dall-e|stable\s*diffusion|pixelmator|snapseed)/i;
    const match = result.Software.match(tamperRegex);
    if (match) {
      result.softwareTamperDetected = true;
      result.softwareTamperMatch = match[1];
    }
  }

  return result;
}

/**
 * Calculate Great-Circle Haversine Distance (km and miles) and SIU Proximity Classification
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (
    typeof lat1 !== 'number' || typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' || typeof lon2 !== 'number' ||
    Number.isNaN(lat1) || Number.isNaN(lon1) || Number.isNaN(lat2) || Number.isNaN(lon2)
  ) {
    return {
      valid: false,
      distanceKm: null,
      distanceMiles: null,
      proximityStatus: 'UNVERIFIED_COORDINATES',
      siuFlag: 'MD-12_MISSING_GPS_COORDINATES'
    };
  }

  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));

  const distanceKm = Math.round(EARTH_RADIUS_KM * c * 1000) / 1000;
  const distanceMiles = Math.round(EARTH_RADIUS_MILES * c * 1000) / 1000;

  let proximityStatus = 'VERIFIED_PROXIMITY';
  let siuFlag = null;

  if (distanceMiles > 5.0) {
    proximityStatus = 'CRITICAL_SIU_LOCATION_VARIANCE';
    siuFlag = 'MD-09_DISTANCE_EXCEEDS_5_MILES';
  } else if (distanceMiles > 1.0) {
    proximityStatus = 'COACHING_LOCATION_VARIANCE';
    siuFlag = 'MD-10_MODERATE_DISTANCE_1_TO_5_MILES';
  }

  return {
    valid: true,
    distanceKm,
    distanceMiles,
    proximityStatus,
    siuFlag
  };
}

/**
 * Parse EXIF timestamp ("YYYY:MM:DD HH:MM:SS" or ISO) into epoch milliseconds
 */
function parseExifTimestampMs(exifDateStr) {
  if (!exifDateStr || typeof exifDateStr !== 'string') return null;
  const normalized = exifDateStr
    .trim()
    .replace(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}:\d{2}:\d{2})$/, '$1-$2-$3T$4Z');
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Full Forensic Binary Claim Photo Verification Pipeline (SC-ADDON-AUDIT-P0-01)
 */
function verifyClaimPhotoBinary(buffer, claimContext = {}) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '');
  const sha256 = computeSha256Hex(buf);
  const imageFormat = detectImageFormat(buf);
  const exif = parseExifApp1(buf);

  const effectiveLat = typeof exif.GPSLatitude === 'number'
    ? exif.GPSLatitude
    : (typeof claimContext.deviceUploadLat === 'number' ? claimContext.deviceUploadLat : null);
  const effectiveLon = typeof exif.GPSLongitude === 'number'
    ? exif.GPSLongitude
    : (typeof claimContext.deviceUploadLon === 'number' ? claimContext.deviceUploadLon : null);

  const locationSource = typeof exif.GPSLatitude === 'number'
    ? 'EXIF_APP1_GPS'
    : (typeof claimContext.deviceUploadLat === 'number' ? 'HTML5_DEVICE_GEOLOCATION_FALLBACK' : 'NONE');

  const haversine = calculateHaversineDistance(
    effectiveLat,
    effectiveLon,
    claimContext.reportedLat,
    claimContext.reportedLon
  );

  const flags = [];
  if (exif.softwareTamperDetected) {
    flags.push({
      factorId: 'MD-11',
      severity: 'Critical',
      reason: `EXIF Software tag indicates image editing suite (${exif.Software}).`
    });
  }

  if (haversine.siuFlag === 'MD-09_DISTANCE_EXCEEDS_5_MILES') {
    flags.push({
      factorId: 'MD-09',
      severity: 'Critical',
      reason: `Photo GPS is ${haversine.distanceMiles} mi (${haversine.distanceKm} km) from reported loss location (>5.0 mi threshold).`
    });
  } else if (haversine.siuFlag === 'MD-10_MODERATE_DISTANCE_1_TO_5_MILES') {
    flags.push({
      factorId: 'MD-10',
      severity: 'Coaching',
      reason: `Photo GPS is ${haversine.distanceMiles} mi (${haversine.distanceKm} km) from reported loss location (1.0-5.0 mi range).`
    });
  } else if (locationSource === 'NONE') {
    flags.push({
      factorId: 'MD-12',
      severity: 'Major',
      reason: 'Neither EXIF GPS nor HTML5 device geolocation coordinates were present on upload.'
    });
  }

  const exifCaptureMs = parseExifTimestampMs(exif.DateTimeOriginal || exif.DateTime);
  const reportedLossMs = claimContext.reportedLossIso ? Date.parse(claimContext.reportedLossIso) : null;

  if (exifCaptureMs && reportedLossMs && !Number.isNaN(reportedLossMs)) {
    const twoHoursMs = 2 * 60 * 60 * 1000;
    if (exifCaptureMs < reportedLossMs - twoHoursMs) {
      flags.push({
        factorId: 'MD-08',
        severity: 'Critical',
        reason: `EXIF DateTimeOriginal (${exif.DateTimeOriginal || exif.DateTime}) predates reported Date of Loss (${claimContext.reportedLossIso}).`
      });
    }
  }

  if (Array.isArray(claimContext.knownHashes) && claimContext.knownHashes.includes(sha256)) {
    flags.push({
      factorId: 'MD-07',
      severity: 'Critical',
      reason: `Duplicate SHA-256 hash (${sha256.slice(0, 16)}...) matches an existing photo in the claim vault.`
    });
  }

  return {
    sha256,
    byteLength: buf.length,
    imageFormat,
    exif,
    locationSource,
    haversine,
    flags,
    verificationStatus: flags.some(f => f.severity === 'Critical')
      ? 'FLAGGED_FOR_LICENSED_ADJUSTER_SIU_REVIEW'
      : 'PRELIMINARY_FORENSIC_CHECK_PASSED',
    recordType: TX_4101_RECORD_TYPE,
    statutoryDisclaimer: TX_4101_DISCLAIMER
  };
}

/**
 * Helper to construct a deterministic binary JPEG with embedded EXIF APP1 (II little-endian)
 * for automated unit and integration testing.
 */
function buildSyntheticExifJpegBuffer(opts = {}) {
  const makeStr = (opts.Make || 'Apple') + '\0';
  const modelStr = (opts.Model || 'iPhone 16 Pro') + '\0';
  const softwareStr = (opts.Software || 'iOS 19.1') + '\0';
  const dateOriginalStr = (opts.DateTimeOriginal || '2026:10:20 14:30:00') + '\0';

  const lat = typeof opts.GPSLatitude === 'number' ? opts.GPSLatitude : 32.8205;
  const lon = typeof opts.GPSLongitude === 'number' ? opts.GPSLongitude : -96.8352;
  const latRef = (lat >= 0 ? 'N' : 'S') + '\0';
  const lonRef = (lon >= 0 ? 'E' : 'W') + '\0';

  function decimalToDmsRationals(dec) {
    const abs = Math.abs(dec);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const secThousandths = Math.round((minFloat - min) * 60 * 1000);
    return [
      [deg, 1],
      [min, 1],
      [secThousandths, 1000]
    ];
  }

  const latRationals = decimalToDmsRationals(lat);
  const lonRationals = decimalToDmsRationals(lon);

  const tiffBuf = Buffer.alloc(512, 0);
  // TIFF Header at offset 0: "II" (0x4949), 42 (0x002A), IFD0 offset = 8
  tiffBuf.writeUInt16LE(0x4949, 0);
  tiffBuf.writeUInt16LE(0x002A, 2);
  tiffBuf.writeUInt32LE(8, 4);

  // IFD0 at offset 8: 5 entries (Make, Model, Software, ExifIFD, GPSIFD)
  const ifd0Count = 5;
  tiffBuf.writeUInt16LE(ifd0Count, 8);
  let dataCursor = 240;

  function writeIfdEntry(basePos, index, tag, type, count, valueOrOffset) {
    const pos = basePos + 2 + index * 12;
    tiffBuf.writeUInt16LE(tag, pos);
    tiffBuf.writeUInt16LE(type, pos + 2);
    tiffBuf.writeUInt32LE(count, pos + 4);
    if (typeof valueOrOffset === 'string') {
      tiffBuf.write(valueOrOffset, pos + 8, Math.min(4, valueOrOffset.length), 'ascii');
    } else {
      tiffBuf.writeUInt32LE(valueOrOffset, pos + 8);
    }
  }

  function writePoolAscii(str) {
    const start = dataCursor;
    tiffBuf.write(str, start, str.length, 'ascii');
    dataCursor += str.length + (str.length % 2);
    return start;
  }

  function writePoolRationals(triplets) {
    const start = dataCursor;
    for (let i = 0; i < 3; i++) {
      tiffBuf.writeUInt32LE(triplets[i][0], start + i * 8);
      tiffBuf.writeUInt32LE(triplets[i][1], start + i * 8 + 4);
    }
    dataCursor += 24;
    return start;
  }

  const makeOffset = writePoolAscii(makeStr);
  const modelOffset = writePoolAscii(modelStr);
  const softwareOffset = writePoolAscii(softwareStr);
  const exifIfdOffset = 80;
  const gpsIfdOffset = 120;

  writeIfdEntry(8, 0, 0x010F, 2, makeStr.length, makeOffset);
  writeIfdEntry(8, 1, 0x0110, 2, modelStr.length, modelOffset);
  writeIfdEntry(8, 2, 0x0131, 2, softwareStr.length, softwareOffset);
  writeIfdEntry(8, 3, 0x8769, 4, 1, exifIfdOffset);
  writeIfdEntry(8, 4, 0x8825, 4, 1, gpsIfdOffset);

  // ExifIFD at offset 80: 1 entry (DateTimeOriginal 0x9003)
  tiffBuf.writeUInt16LE(1, exifIfdOffset);
  const dtOffset = writePoolAscii(dateOriginalStr);
  writeIfdEntry(exifIfdOffset, 0, 0x9003, 2, dateOriginalStr.length, dtOffset);

  // GPSIFD at offset 120: 4 entries (0x0001 LatRef, 0x0002 Lat, 0x0003 LonRef, 0x0004 Lon)
  tiffBuf.writeUInt16LE(4, gpsIfdOffset);
  const latRatOffset = writePoolRationals(latRationals);
  const lonRatOffset = writePoolRationals(lonRationals);
  writeIfdEntry(gpsIfdOffset, 0, 0x0001, 2, 2, latRef);
  writeIfdEntry(gpsIfdOffset, 1, 0x0002, 5, 3, latRatOffset);
  writeIfdEntry(gpsIfdOffset, 2, 0x0003, 2, 2, lonRef);
  writeIfdEntry(gpsIfdOffset, 3, 0x0004, 5, 3, lonRatOffset);

  const usedTiff = tiffBuf.slice(0, dataCursor);
  const exifHeader = Buffer.from('Exif\0\0', 'ascii');
  const app1Length = 2 + exifHeader.length + usedTiff.length;
  const segHeader = Buffer.alloc(4);
  segHeader[0] = 0xFF;
  segHeader[1] = 0xE1;
  segHeader.writeUInt16BE(app1Length, 2);

  return Buffer.concat([
    Buffer.from([0xFF, 0xD8]),
    segHeader,
    exifHeader,
    usedTiff,
    Buffer.from([0xFF, 0xD9])
  ]);
}

// =============================================================================
// 2. DYNAMIC N/A DENOMINATOR CALCULATOR (SC-ADDON-AUDIT-P0-01 / P0-03)
// =============================================================================

/**
 * Calculate Dynamic Denominator Score excluding NOT_ASKED_INAPPLICABLE fields
 * while enforcing a hard <= 59.0% ceiling when any Critical Compliance Rule fails.
 */
function calculateDynamicDenominatorScore(factors = [], options = {}) {
  const criticalCeiling = typeof options.criticalCeiling === 'number' ? options.criticalCeiling : 59.0;

  if (!Array.isArray(factors) || factors.length === 0) {
    return {
      totalFactors: 0,
      applicableFactorsCount: 0,
      inapplicableExcludedCount: 0,
      totalCatalogWeight: 0,
      applicablePointsDenominator: 0,
      excludedInapplicablePoints: 0,
      earnedPointsNumerator: 0,
      rawScorePercent: 100.0,
      finalScorePercent: 100.0,
      criticalFailureCapApplied: false,
      failedCriticalRuleIds: [],
      recordType: TX_4101_RECORD_TYPE
    };
  }

  let totalCatalogWeight = 0;
  let applicablePointsDenominator = 0;
  let excludedInapplicablePoints = 0;
  let earnedPointsNumerator = 0;
  let applicableFactorsCount = 0;
  let inapplicableExcludedCount = 0;
  const failedCriticalRuleIds = [];

  for (const factor of factors) {
    const weight = typeof factor.weight === 'number' && factor.weight > 0 ? factor.weight : 1;
    const status = String(factor.status || '').toUpperCase();
    const isCritical = Boolean(factor.critical || factor.severity === 'Critical');
    totalCatalogWeight += weight;

    if (
      status === 'NOT_ASKED_INAPPLICABLE' ||
      status === 'INAPPLICABLE' ||
      status === 'N/A' ||
      factor.inapplicable === true
    ) {
      excludedInapplicablePoints += weight;
      inapplicableExcludedCount += 1;
      continue;
    }

    applicableFactorsCount += 1;
    applicablePointsDenominator += weight;

    const passed =
      status === 'PASSED' ||
      status === 'PASS' ||
      status === 'ASKED' ||
      status === 'INDEXED' ||
      status === 'COMPLIANT' ||
      factor.passed === true;

    if (passed) {
      earnedPointsNumerator += weight;
    } else if (isCritical) {
      failedCriticalRuleIds.push(factor.id || factor.factorId || 'CRITICAL_RULE');
    }
  }

  const rawScorePercent = applicablePointsDenominator > 0
    ? Math.round((earnedPointsNumerator / applicablePointsDenominator) * 10000) / 100
    : 100.0;

  const criticalFailureCapApplied = failedCriticalRuleIds.length > 0;
  const finalScorePercent = criticalFailureCapApplied
    ? Math.min(rawScorePercent, criticalCeiling)
    : rawScorePercent;

  return {
    totalFactors: factors.length,
    applicableFactorsCount,
    inapplicableExcludedCount,
    totalCatalogWeight: Math.round(totalCatalogWeight * 100) / 100,
    applicablePointsDenominator: Math.round(applicablePointsDenominator * 100) / 100,
    excludedInapplicablePoints: Math.round(excludedInapplicablePoints * 100) / 100,
    earnedPointsNumerator: Math.round(earnedPointsNumerator * 100) / 100,
    rawScorePercent,
    finalScorePercent,
    criticalFailureCapApplied,
    failedCriticalRuleIds,
    recordType: TX_4101_RECORD_TYPE
  };
}

// =============================================================================
// 3. TRANSCRIPT & AUDIO TIMESTAMP PII SCRUBBER (SC-ADDON-AUDIT-P0-06)
// =============================================================================

/**
 * Deterministic Luhn Modulo-10 Check for 13-to-19 digit payment cards
 */
function passesLuhnCheck(digitStr) {
  const clean = String(digitStr || '').replace(/\D/g, '');
  if (clean.length < 13 || clean.length > 19) return false;
  if (/^(\d)\1+$/.test(clean)) return false;

  let sum = 0;
  let shouldDouble = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let digit = parseInt(clean.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

/**
 * Scrub PII (SSNs, Luhn Payment Cards, Bank Routing/Account #, Driver's License #)
 * from both transcript text and optional word-level audio timestamps.
 */
function scrubTranscriptPii(input, options = {}) {
  const isObjectInput = input && typeof input === 'object' && !Buffer.isBuffer(input);
  const rawText = isObjectInput ? String(input.text || '') : String(input || '');
  const words = isObjectInput && Array.isArray(input.words) ? input.words : [];

  const redactions = [];
  let scrubbedText = rawText;

  // 1. Formatted SSNs (e.g., 123-45-6789 or 123 45 6789)
  const ssnHyphenRegex = /\b(?!000|666|9\d\d)\d{3}[-\s](?!00)\d{2}[-\s](?!0000)\d{4}\b/g;
  scrubbedText = scrubbedText.replace(ssnHyphenRegex, (match, offset) => {
    redactions.push({ type: 'SSN_FORMATTED', matchLength: match.length, offset });
    return '[REDACTED-SSN]';
  });

  // 2. Contextual unformatted 9-digit SSNs ("SSN is 123456789" / "social security 123456789")
  const ssnContextRegex = /\b(ssn|social\s+security(?:\s+number)?|seguro\s+social)\s*(?:is|es|#|:)?\s*(\d{9})\b/gi;
  scrubbedText = scrubbedText.replace(ssnContextRegex, (full, label, digits, offset) => {
    redactions.push({ type: 'SSN_CONTEXTUAL', matchLength: digits.length, offset });
    return `${label}: [REDACTED-SSN]`;
  });

  // 3. Spoken-word 9-digit SSN sequences (EN/ES)
  const digitWord = '(?:zero|oh|one|two|three|four|five|six|seven|eight|nine|cero|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)';
  const spokenNineRegex = new RegExp(`\\b(${digitWord}(?:[\\s,-]+${digitWord}){8})\\b`, 'gi');
  scrubbedText = scrubbedText.replace(spokenNineRegex, (match, _g1, offset) => {
    redactions.push({ type: 'SSN_SPOKEN_DIGITS', matchLength: match.length, offset });
    return '[REDACTED-SSN-SPOKEN]';
  });

  // 4. Luhn-validated 13-19 digit Credit/Debit Card numbers
  const cardCandidateRegex = /\b(?:\d[ -]*?){13,19}\b/g;
  scrubbedText = scrubbedText.replace(cardCandidateRegex, (match, offset) => {
    const digitsOnly = match.replace(/\D/g, '');
    if (passesLuhnCheck(digitsOnly)) {
      const last4 = digitsOnly.slice(-4);
      redactions.push({ type: 'PAYMENT_CARD_LUHN', matchLength: match.length, offset, last4 });
      return `[REDACTED-CARD-LAST4:${last4}]`;
    }
    return match;
  });

  // 5. Contextual Bank Routing & Account Numbers
  const bankRegex = /\b(routing\s*(?:number|#)?|account\s*(?:number|#)?|aba\s*routing|cuenta\s*bancaria)\s*(?:is|es|:|#)?\s*(\d{8,17})\b/gi;
  scrubbedText = scrubbedText.replace(bankRegex, (full, label, digits, offset) => {
    redactions.push({ type: 'BANK_ROUTING_OR_ACCOUNT', matchLength: digits.length, offset });
    return `${label}: [REDACTED-BANK]`;
  });

  // 6. Contextual Driver's License Numbers (TX 7-8 digits, CA 1 letter + 7 digits, etc.)
  const dlRegex = /\b(driver'?s?\s*license(?:\s*number|#)?|dl\s*#|tx\s*dl|licencia\s*de\s*conducir)\s*(?:is|es|:|#)?\s*([A-Z0-9-]{7,12})\b/gi;
  scrubbedText = scrubbedText.replace(dlRegex, (full, label, token, offset) => {
    redactions.push({ type: 'DRIVERS_LICENSE', matchLength: token.length, offset });
    return `${label}: [REDACTED-DL]`;
  });

  // Map redactions to audio mute timestamp ranges (startMs, endMs)
  const audioMuteRangesMs = [];
  if (words.length > 0) {
    for (const w of words) {
      const wClean = String(w.word || '').replace(/\D/g, '');
      if (wClean.length >= 4 && redactions.length > 0) {
        audioMuteRangesMs.push({
          startMs: typeof w.startMs === 'number' ? w.startMs : 0,
          endMs: typeof w.endMs === 'number' ? w.endMs : 500,
          reason: 'PII_AUDIO_BLEEP'
        });
      }
    }
  } else if (redactions.length > 0) {
    // Estimate timestamp range at 150 words/min (~12.5 chars/sec = 80ms/char)
    for (const r of redactions) {
      const startMs = Math.max(0, Math.round((r.offset || 0) * 80));
      const endMs = startMs + Math.max(600, Math.round((r.matchLength || 10) * 80));
      audioMuteRangesMs.push({ startMs, endMs, reason: r.type });
    }
  }

  const output = {
    scrubbedText,
    text: scrubbedText,
    piiDetected: redactions.length > 0,
    redactionCount: redactions.length,
    redactions,
    audioMuteRangesMs,
    toString() {
      return scrubbedText;
    },
    valueOf() {
      return scrubbedText;
    }
  };

  return output;
}

// =============================================================================
// 4. PARTIAL_INCOMPLETE SESSION STORE (24H TTL KEYED BY ${tenantId}:${callerAni})
// =============================================================================

function normalizeE164(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '+10000000000';
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

class PartialIncompleteSessionStore {
  constructor(options = {}) {
    this.ttlMs = typeof options.ttlMs === 'number' && options.ttlMs > 0
      ? options.ttlMs
      : TWENTY_FOUR_HOURS_MS;
    this.persistPath = options.persistPath || null;
    this.sessions = new Map();
    if (this.persistPath && fs.existsSync(this.persistPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.persistPath, 'utf8'));
        for (const [k, v] of Object.entries(raw)) {
          this.sessions.set(k, v);
        }
      } catch (_err) {
        // Ignore corrupted cache on boot
      }
    }
  }

  buildKey(tenantId, callerAni) {
    const cleanTenant = String(tenantId || 'default_tenant').trim();
    const cleanAni = normalizeE164(callerAni);
    return `${cleanTenant}:${cleanAni}`;
  }

  _persistIfConfigured() {
    if (!this.persistPath) return;
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const obj = Object.fromEntries(this.sessions.entries());
      fs.writeFileSync(this.persistPath, JSON.stringify(obj, null, 2), 'utf8');
    } catch (_err) {
      // Non-fatal persistence warning
    }
  }

  savePartialSession(tenantId, callerAni, payload = {}, nowMs = Date.now()) {
    const sessionKey = this.buildKey(tenantId, callerAni);
    const requiredSlots = Array.isArray(payload.requiredSlots) && payload.requiredSlots.length > 0
      ? payload.requiredSlots
      : ['callerName', 'policyNumber', 'lossDate', 'lossLocation', 'perilType', 'vehicleDamages'];

    const capturedSlots = payload.capturedSlots || {};
    const missingSlots = requiredSlots.filter(slot => {
      const val = capturedSlots[slot];
      return val === undefined || val === null || String(val).trim() === '';
    });

    const record = {
      sessionKey,
      tenantId: String(tenantId || 'default_tenant').trim(),
      callerAni: normalizeE164(callerAni),
      callSid: payload.callSid || `CA_${Date.now()}`,
      status: 'PARTIAL_INCOMPLETE',
      vertical: payload.vertical || 'claims',
      language: payload.language || 'en',
      capturedSlots,
      missingSlots,
      firstUnpopulatedSlot: missingSlots[0] || null,
      resumeShortCode: payload.resumeShortCode || crypto.createHash('md5').update(sessionKey).digest('hex').slice(0, 6).toUpperCase(),
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
      expiresAtMs: nowMs + this.ttlMs
    };

    this.sessions.set(sessionKey, record);
    this._persistIfConfigured();
    return record;
  }

  getActiveSession(tenantId, callerAni, nowMs = Date.now()) {
    const sessionKey = this.buildKey(tenantId, callerAni);
    const record = this.sessions.get(sessionKey);
    if (!record) return null;
    if (nowMs >= record.expiresAtMs || record.status !== 'PARTIAL_INCOMPLETE') {
      this.sessions.delete(sessionKey);
      this._persistIfConfigured();
      return null;
    }
    return record;
  }

  resumeSessionTurnZero(tenantId, callerAni, nowMs = Date.now()) {
    const record = this.getActiveSession(tenantId, callerAni, nowMs);
    if (!record) {
      return { found: false, sessionKey: this.buildKey(tenantId, callerAni) };
    }

    const namePart = record.capturedSlots.callerName ? `, ${record.capturedSlots.callerName}` : '';
    const locPart = record.capturedSlots.lossLocation || record.capturedSlots.serviceAddress || 'your location';
    const isEs = String(record.language || 'en').toLowerCase().startsWith('es');

    const turnZeroPrompt = isEs
      ? `Bienvenido de nuevo${namePart}. Guardé su reporte parcial de hace unos minutos sobre ${locPart}. ¿Desea continuar exactamente donde nos quedamos con ${record.firstUnpopulatedSlot || 'los detalles restantes'}, o iniciar un reporte nuevo?`
      : `Welcome back${namePart}. I saved your partial report from earlier regarding ${locPart}. Would you like to pick up right where we left off with ${record.firstUnpopulatedSlot || 'the remaining details'}, or start a new report?`;

    const missedCallSmsCopy = isEs
      ? `Se corto la llamada. Llame de nuevo o continue en https://aiagentangel.com/d/${record.resumeShortCode}#resume. Responda STOP para cancelar`
      : `We disconnected before finishing your report. Call back or resume at https://aiagentangel.com/d/${record.resumeShortCode}#resume. Reply STOP to opt out`;

    return {
      found: true,
      sessionKey: record.sessionKey,
      record,
      firstUnpopulatedSlot: record.firstUnpopulatedSlot,
      capturedSlots: record.capturedSlots,
      missingSlots: record.missingSlots,
      turnZeroPrompt,
      missedCallSmsCopy
    };
  }

  markCompleted(tenantId, callerAni) {
    const sessionKey = this.buildKey(tenantId, callerAni);
    const record = this.sessions.get(sessionKey);
    if (!record) return false;
    record.status = 'COMPLETED';
    this.sessions.delete(sessionKey);
    this._persistIfConfigured();
    return true;
  }

  pruneExpired(nowMs = Date.now()) {
    let pruned = 0;
    for (const [key, rec] of this.sessions.entries()) {
      if (nowMs >= rec.expiresAtMs) {
        this.sessions.delete(key);
        pruned += 1;
      }
    }
    if (pruned > 0) this._persistIfConfigured();
    return pruned;
  }
}

// =============================================================================
// 5. DETERMINISTIC SELF-TEST SUITE (--self-test)
// =============================================================================

function runSelfTest() {
  const assert = require('assert');
  const results = [];

  // Test 1: Binary JPEG SHA-256 + EXIF APP1 Parser + Haversine Distance (SC-ADDON-AUDIT-P0-01)
  const sampleJpeg = buildSyntheticExifJpegBuffer({
    Make: 'Apple',
    Model: 'iPhone 16 Pro',
    Software: 'iOS 19.1',
    DateTimeOriginal: '2026:10:20 14:30:00',
    GPSLatitude: 32.8205,
    GPSLongitude: -96.8352
  });

  const verificationNear = verifyClaimPhotoBinary(sampleJpeg, {
    reportedLat: 32.8210,
    reportedLon: -96.8355,
    reportedLossIso: '2026-10-20T14:00:00Z'
  });

  assert.strictEqual(verificationNear.sha256.length, 64, 'SHA-256 must be 64 hex chars');
  assert.strictEqual(verificationNear.imageFormat, 'JPEG', 'Must detect JPEG magic bytes');
  assert.strictEqual(verificationNear.exif.hasExif, true, 'Must parse EXIF APP1');
  assert.strictEqual(verificationNear.exif.Make, 'Apple', 'Must extract Make=Apple');
  assert.strictEqual(verificationNear.exif.DateTimeOriginal, '2026:10:20 14:30:00', 'Must extract DateTimeOriginal');
  assert.ok(Math.abs(verificationNear.exif.GPSLatitude - 32.8205) < 0.001, 'Must parse GPSLatitude');
  assert.ok(Math.abs(verificationNear.exif.GPSLongitude - (-96.8352)) < 0.001, 'Must parse GPSLongitude');
  assert.ok(verificationNear.haversine.distanceMiles < 0.2, 'Haversine distance for nearby scene must be <0.2 miles');
  assert.strictEqual(verificationNear.verificationStatus, 'PRELIMINARY_FORENSIC_CHECK_PASSED');

  // Test Haversine far distance (>5 miles triggers MD-09 Critical SIU Flag)
  const verificationFar = verifyClaimPhotoBinary(sampleJpeg, {
    reportedLat: 32.9999,
    reportedLon: -97.1500,
    reportedLossIso: '2026-10-20T14:00:00Z'
  });
  assert.ok(verificationFar.haversine.distanceMiles > 15, 'Far coordinates must exceed 15 miles');
  assert.ok(verificationFar.flags.some(f => f.factorId === 'MD-09'), 'Must flag MD-09 for >5 miles');
  results.push({ test: 'SC-ADDON-AUDIT-P0-01_EXIF_SHA256_HAVERSINE', status: 'PASS', sha256: verificationNear.sha256 });

  // Test 2: Dynamic N/A Score Denominator Calculator (Parked Hail vs. Critical Cap)
  const hailScore = calculateDynamicDenominatorScore([
    { id: 'DR-01', weight: 20, critical: true, status: 'PASSED' },
    { id: 'DR-02', weight: 30, critical: false, status: 'PASSED' },
    { id: 'DR-05', weight: 25, critical: true, status: 'NOT_ASKED_INAPPLICABLE' },
    { id: 'DR-10', weight: 25, critical: false, status: 'NOT_ASKED_INAPPLICABLE' }
  ]);
  assert.strictEqual(hailScore.applicablePointsDenominator, 50, 'Denominator must exclude 50 pts of N/A hail fields');
  assert.strictEqual(hailScore.finalScorePercent, 100.0, 'Score must be 100% when all applicable fields pass');

  const criticalCapScore = calculateDynamicDenominatorScore([
    { id: 'DR-01', weight: 90, critical: false, status: 'PASSED' },
    { id: 'DR-13', weight: 10, critical: true, status: 'FAILED' }
  ]);
  assert.strictEqual(criticalCapScore.rawScorePercent, 90.0);
  assert.strictEqual(criticalCapScore.finalScorePercent, 59.0, 'Critical fail must cap score at <=59.0%');
  assert.strictEqual(criticalCapScore.criticalFailureCapApplied, true);
  results.push({ test: 'DYNAMIC_NA_DENOMINATOR_AND_CRITICAL_CAP', status: 'PASS', hailScore: hailScore.finalScorePercent, cappedScore: criticalCapScore.finalScorePercent });

  // Test 3: Transcript & Audio Timestamp PII Scrubber (SC-ADDON-AUDIT-P0-06)
  const rawTranscript =
    'Caller SSN is 123-45-6789, spoken SSN one two three four five six seven eight nine, ' +
    'Visa card 4532 0151 1283 0366, routing number 111000025, and TX DL 12345678.';
  const scrubbed = scrubTranscriptPii(rawTranscript);
  assert.strictEqual(scrubbed.piiDetected, true, 'Must detect PII');
  assert.ok(!scrubbed.scrubbedText.includes('123-45-6789'), 'Must redact formatted SSN');
  assert.ok(!scrubbed.scrubbedText.includes('4532 0151 1283 0366'), 'Must redact Luhn credit card');
  assert.ok(scrubbed.scrubbedText.includes('[REDACTED-CARD-LAST4:0366]'), 'Must retain masked card token');
  assert.ok(!scrubbed.scrubbedText.includes('111000025'), 'Must redact routing number');
  assert.ok(!scrubbed.scrubbedText.includes('12345678'), 'Must redact TX DL number');
  assert.ok(scrubbed.audioMuteRangesMs.length >= 4, 'Must compute audio timestamp mute ranges');
  results.push({ test: 'SC-ADDON-AUDIT-P0-06_PII_SCRUBBER', status: 'PASS', redactionCount: scrubbed.redactionCount });

  // Test 4: PartialIncompleteSessionStore 24h TTL & Callback Resume (SC-ADDON-AUDIT-P0-04)
  const store = new PartialIncompleteSessionStore();
  const baseTime = 1792524000000;
  store.savePartialSession('demo_agentangel', '(214) 555-0188', {
    language: 'en',
    capturedSlots: {
      callerName: 'Marcus Vance',
      policyNumber: 'TX-AUTO-884920',
      lossDate: '2026-10-20',
      lossLocation: 'I-35E & Mockingbird Ln, Dallas, TX'
    }
  }, baseTime);

  const resumed = store.resumeSessionTurnZero('demo_agentangel', '+12145550188', baseTime + 300000);
  assert.strictEqual(resumed.found, true, 'Must locate active session within 24h TTL');
  assert.strictEqual(resumed.sessionKey, 'demo_agentangel:+12145550188');
  assert.strictEqual(resumed.firstUnpopulatedSlot, 'perilType');
  assert.ok(resumed.turnZeroPrompt.includes('Welcome back, Marcus Vance'), 'Must generate Turn-0 resume prompt');
  assert.ok(resumed.missedCallSmsCopy.length <= 160, 'Missed call SMS must fit within 160 GSM-7 chars');

  // Verify 24h + 1ms expiration
  const expiredCheck = store.getActiveSession('demo_agentangel', '+12145550188', baseTime + TWENTY_FOUR_HOURS_MS + 1);
  assert.strictEqual(expiredCheck, null, 'Session must expire after 24 hours');
  results.push({ test: 'SC-ADDON-AUDIT-P0-04_ANI_SESSION_RESUME_24H_TTL', status: 'PASS' });

  // Test 5: Verify axirate_copilot.js TX §4101 Non-Adjudication Compliance (SC-ADDON-AUDIT-P0-03)
  const copilotPath = path.resolve(__dirname, '../aaio-claims-uat-deploy/assets/axirate_copilot.js');
  if (fs.existsSync(copilotPath)) {
    const copilot = require(copilotPath);
    const engine = new copilot.AxiRateCopilotEngine();
    const audit = engine.evaluateCompNeg('Intersection collision at yellow light with speed and police report');
    assert.strictEqual(audit.adjudicationProhibited, true, 'Adjudication must be strictly prohibited');
    assert.strictEqual(audit.faultAllocationAssigned, null, 'Fault allocation must be null');
    assert.strictEqual(audit.totalEssentialQuestions, 7, 'Must evaluate 7 essential liability questions');
    assert.ok(audit.recordType.includes('Preliminary'), 'Must carry Preliminary stamp');
    results.push({ test: 'SC-ADDON-AUDIT-P0-03_AXIRATE_COPILOT_TX_4101', status: 'PASS', completeness: audit.completenessRatio });
  }

  console.log(JSON.stringify({
    selfTestStatus: 'ALL_ASSERTIONS_PASSED',
    timestamp: new Date().toISOString(),
    results
  }, null, 2));
}

if (require.main === module && process.argv.includes('--self-test')) {
  try {
    runSelfTest();
    process.exit(0);
  } catch (err) {
    console.error('SELF-TEST FAILED:', err);
    process.exit(1);
  }
}

module.exports = {
  computeSha256Hex,
  detectImageFormat,
  parseExifApp1,
  calculateHaversineDistance,
  verifyClaimPhotoBinary,
  buildSyntheticExifJpegBuffer,
  calculateDynamicDenominatorScore,
  passesLuhnCheck,
  scrubTranscriptPii,
  normalizeE164,
  PartialIncompleteSessionStore,
  TX_4101_RECORD_TYPE,
  TX_4101_DISCLAIMER
};
