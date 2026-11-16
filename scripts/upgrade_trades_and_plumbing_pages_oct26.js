#!/usr/bin/env node
/**
 * upgrade_trades_and_plumbing_pages_oct26.js
 *
 * Upgrades DHV CORP/Series_C/02_Production_Apps/agentangel-io/plumbing.html and index.html
 * to 100% compliance with JD's Locked Oct 26, 2026 Sovereign Requirements:
 *  - Colors: #CFD8E8 Cool Slate, #0F1E4A Midnight Navy, #4F6BD8/#6E84F7 Periwinkle, #E5E7EB Platinum (0 stark #FFFFFF sections)
 *  - Fonts & Sizes: Georgia / Cormorant Garamond serif wordmark (52px desktop banner) + Plus Jakarta Sans UI
 *  - Header: #CFD8E8 Cool Slate banner with Midnight Circular Medallion (.aa-medallion-grey-lock) + Other Specialists Dropdown + Cross-Site Switcher + EN/ES Globe
 *  - Positioning: Multi-Truck Plumbing & Mechanical Fleets (3-25+ Trucks & CSR Office Teams) alongside growing shops
 *  - All 4 Operational Windows (What She Can Do & When She Is Doing It):
 *      1. Business-Hours Multi-Line Overflow & Fleet Dispatch (8 AM - 6 PM)
 *      2. Mid-Call 2-Way SMS Photo, Video & Equipment Rating Plate ID
 *      3. 100% CSR & Dispatcher Call Auditing (AxiRate™ Mixed 100-Cell Matrix for Trades)
 *      4. 24/7 After-Hours, Nights, Weekends & Storm Surge Emergency Capture
 *  - Interactive 2.5D/3D Prezi-Style Spatial Zoom Walkthrough ("Get to Know AgentAngel.io") with curved SVG arrows & NEXT buttons
 *  - Interactive Multi-Truck Fleet & CSR Audit ROI Calculator + Visual Examples with NEXT buttons
 */

'use strict';

const fs = require('fs');
const path = require('path');

const TRADES_DIR = 'C:/Users/17549/antigravity/DHV CORP/Series_C/02_Production_Apps/agentangel-io';

function buildTradesPage({ isPlumbingPage }) {
  const pageTitle = isPlumbingPage
    ? 'AgentAngel.io | Multi-Truck Plumbing Fleet Dispatch, SMS Visual Triage & 100% CSR Call Auditing'
    : 'AgentAngel.io | Multi-Truck Commercial Trades AI Dispatch, SMS Visual Triage & 100% CSR Call Auditing';

  const heroKicker = isPlumbingPage
    ? 'BUILT FOR 3–25+ TRUCK PLUMBING FLEETS, CSR TEAMS & GROWING SHOPS'
    : 'COMMERCIAL TRADES & MULTI-TRUCK FLEET OPERATIONS · AGENTANGEL.IO';

  const heroTitle = isPlumbingPage
    ? 'Keep Every Plumbing Truck Rolling &amp; <span style="color:#93A8F4;">Every Office Call Audited Live.</span>'
    : 'Multi-Truck Overflow Dispatch, SMS Visual Triage &amp; <span style="color:#93A8F4;">100% CSR Call Auditing.</span>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${pageTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=JetBrains+Mono:wght@600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-slate: #CFD8E8;
      --bg-slate-soft: #D5DDEC;
      --card-slate: #DCE3F0;
      --midnight: #0F1E4A;
      --midnight-deep: #091332;
      --midnight-card: #13255B;
      --periwinkle: #4F6BD8;
      --periwinkle-bright: #6E84F7;
      --periwinkle-light: #93A8F4;
      --platinum: #E5E7EB;
      --emerald: #0D9488;
      --crimson: #E11D48;
      --amber: #D97706;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      background: linear-gradient(180deg, var(--bg-slate-soft) 0%, var(--bg-slate) 100%);
      color: var(--midnight);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.48;
      overflow-x: hidden;
    }
    a { color: inherit; text-decoration: none; }

    /* ==========================================================================
       1. LOCKED OCT 26 COOL SLATE (#CFD8E8) HEADER + MIDNIGHT CIRCULAR MEDALLION
       ========================================================================== */
    .site-header {
      position: sticky;
      top: 0;
      z-index: 1000;
      background: rgba(207, 216, 232, 0.96);
      backdrop-filter: blur(12px);
      border-bottom: 2.5px solid var(--midnight);
      box-shadow: 0 10px 28px rgba(15, 30, 74, 0.14);
      padding: 12px 28px;
    }
    .header-inner {
      max-width: 1420px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      flex-wrap: wrap;
    }
    .brand-lockup {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .aa-medallion-grey-lock {
      width: 82px;
      height: 82px;
      border-radius: 50%;
      background: radial-gradient(circle at 50% 50%, #16285E 0%, #0F1E4A 74%, #091332 100%);
      border: 2.5px solid var(--periwinkle-bright);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 22px rgba(15, 30, 74, 0.28);
      flex-shrink: 0;
    }
    .aa-medallion-grey-lock img {
      width: 66px;
      height: 66px;
      object-fit: contain;
      filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.72));
    }
    .brand-wordmark {
      font-family: Georgia, 'Cormorant Garamond', 'Times New Roman', serif;
      font-size: 52px;
      font-weight: 700;
      letter-spacing: -0.025em;
      line-height: 1;
      color: var(--midnight);
      display: flex;
      align-items: baseline;
      gap: 4px;
    }
    .brand-wordmark .angel-peri {
      color: var(--periwinkle);
    }
    .brand-wordmark .tld-pill {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 15px;
      font-weight: 800;
      color: var(--platinum);
      background: var(--midnight);
      border: 1.5px solid var(--periwinkle-bright);
      padding: 4px 12px;
      border-radius: 999px;
      margin-left: 8px;
      letter-spacing: 0.04em;
    }
    .brand-subtag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11.5px;
      font-weight: 800;
      color: var(--midnight);
      opacity: 0.85;
      margin-top: 3px;
      letter-spacing: 0.04em;
    }
    .nav-controls {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .nav-link {
      font-size: 14px;
      font-weight: 800;
      color: var(--midnight);
      padding: 9px 14px;
      border-radius: 10px;
      border: 1.5px solid rgba(15, 30, 74, 0.22);
      background: var(--card-slate);
    }
    .dropdown-wrap {
      position: relative;
    }
    .dropdown-menu {
      display: none;
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      width: 280px;
      background: var(--midnight);
      color: var(--platinum);
      border: 2px solid var(--periwinkle-bright);
      border-radius: 14px;
      padding: 10px;
      box-shadow: 0 16px 36px rgba(9, 19, 50, 0.45);
      z-index: 1200;
    }
    .dropdown-wrap:hover .dropdown-menu { display: block; }
    .dd-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 9px 12px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      color: var(--platinum);
    }
    .dd-item:hover { background: var(--midnight-card); }
    .dd-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 99px;
      background: rgba(110, 132, 247, 0.22);
      color: var(--periwinkle-light);
    }
    .dd-badge.active { background: rgba(13, 148, 136, 0.35); color: #5EEAD4; }
    .cross-site-btn {
      background: var(--midnight);
      color: var(--platinum);
      border: 1.5px solid var(--periwinkle-bright);
      padding: 10px 16px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 800;
    }
    .lang-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--card-slate);
      color: var(--midnight);
      border: 1.5px solid var(--midnight);
      padding: 9px 13px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
    }

    /* ==========================================================================
       2. 2-COLUMN SPLIT HERO (MULTI-TRUCK FLEETS + 4 OPERATIONAL WINDOWS)
       ========================================================================== */
    .container {
      max-width: 1420px;
      margin: 0 auto;
      padding: 28px 28px;
    }
    .hero-split {
      display: grid;
      grid-template-columns: 1.05fr 0.95fr;
      gap: 26px;
      background: var(--midnight);
      color: var(--platinum);
      border: 2.5px solid var(--periwinkle-bright);
      border-radius: 24px;
      padding: 34px;
      box-shadow: 0 20px 44px rgba(15, 30, 74, 0.24);
      align-items: stretch;
    }
    .hero-kicker {
      display: inline-block;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12.5px;
      font-weight: 800;
      color: var(--periwinkle-light);
      background: rgba(79, 107, 216, 0.22);
      border: 1px solid var(--periwinkle-bright);
      padding: 6px 14px;
      border-radius: 999px;
      margin-bottom: 14px;
    }
    .hero-h1 {
      font-size: 44px;
      font-weight: 800;
      line-height: 1.1;
      letter-spacing: -0.025em;
      color: var(--platinum);
      margin-bottom: 14px;
    }
    .hero-lead {
      font-size: 17px;
      color: var(--bg-slate);
      margin-bottom: 18px;
    }
    .hero-bullets {
      display: flex;
      flex-direction: column;
      gap: 11px;
      margin-bottom: 22px;
    }
    .hb-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      background: var(--midnight-card);
      border: 1px solid rgba(147, 168, 244, 0.32);
      padding: 11px 14px;
      border-radius: 12px;
      font-size: 14.5px;
      color: var(--bg-slate);
    }
    .hb-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 800;
      color: #5EEAD4;
      background: rgba(13, 148, 136, 0.24);
      border: 1px solid #14B8A6;
      padding: 3px 8px;
      border-radius: 6px;
      white-space: nowrap;
      margin-top: 2px;
    }
    .hero-cta-row {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
      align-items: center;
    }
    .btn-primary-midnight {
      background: linear-gradient(135deg, #13255B 0%, #091332 100%);
      color: var(--platinum);
      border: 2px solid var(--periwinkle-bright);
      padding: 15px 24px;
      border-radius: 14px;
      font-size: 16px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 10px 24px rgba(9, 19, 50, 0.45);
    }
    .btn-secondary-slate {
      background: var(--bg-slate);
      color: var(--midnight);
      border: 2px solid var(--platinum);
      padding: 15px 22px;
      border-radius: 14px;
      font-size: 15px;
      font-weight: 800;
      cursor: pointer;
    }
    .hero-visual-col {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 14px;
    }
    .hero-main-img {
      width: 100%;
      height: 310px;
      object-fit: cover;
      border-radius: 16px;
      border: 2px solid var(--periwinkle-bright);
    }
    .four-windows-mini {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .fw-pill {
      background: var(--midnight-card);
      border: 1.5px solid rgba(147, 168, 244, 0.4);
      border-radius: 12px;
      padding: 10px 12px;
    }
    .fw-pill .w-time {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 800;
      color: var(--periwinkle-light);
    }
    .fw-pill .w-name {
      font-size: 13.5px;
      font-weight: 800;
      color: var(--platinum);
      margin-top: 2px;
    }

    /* ==========================================================================
       3. PREZI-STYLE 2.5D/3D SPATIAL ZOOM WALKTHROUGH ("GET TO KNOW AGENTANGEL.IO")
       ========================================================================== */
    .section-card-midnight {
      background: var(--midnight);
      color: var(--platinum);
      border: 2.5px solid var(--periwinkle-bright);
      border-radius: 24px;
      padding: 32px;
      margin-top: 28px;
      box-shadow: 0 18px 40px rgba(15, 30, 74, 0.22);
    }
    .sec-header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 22px;
    }
    .sec-kicker {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 800;
      color: var(--periwinkle-light);
      letter-spacing: 0.06em;
    }
    .sec-h2 {
      font-size: 32px;
      font-weight: 800;
      color: var(--platinum);
      margin-top: 4px;
    }
    .spatial-controls {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .sp-btn {
      background: var(--midnight-card);
      color: var(--platinum);
      border: 1.5px solid var(--periwinkle-bright);
      padding: 10px 16px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
    }
    .sp-btn.active {
      background: var(--periwinkle);
      border-color: var(--platinum);
    }
    .spatial-viewport {
      position: relative;
      background: radial-gradient(circle at 50% 40%, #162B6B 0%, #091332 100%);
      border: 2px solid rgba(147, 168, 244, 0.45);
      border-radius: 20px;
      padding: 26px;
      overflow: hidden;
      min-height: 430px;
    }
    .spatial-nodes-grid {
      position: relative;
      z-index: 2;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 18px;
      transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .sp-node {
      background: rgba(19, 37, 91, 0.92);
      border: 2px solid rgba(110, 132, 247, 0.5);
      border-radius: 18px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 10px;
      cursor: pointer;
      transition: all 0.35s ease;
    }
    .sp-node.focused {
      border-color: #5EEAD4;
      box-shadow: 0 0 28px rgba(20, 184, 166, 0.45);
      transform: translateY(-4px) scale(1.02);
    }
    .sp-node img {
      width: 100%;
      height: 130px;
      object-fit: cover;
      border-radius: 10px;
      border: 1px solid rgba(147, 168, 244, 0.4);
    }
    .sp-next-btn {
      background: var(--bg-slate);
      color: var(--midnight);
      border: none;
      padding: 9px 14px;
      border-radius: 8px;
      font-weight: 800;
      font-size: 12.5px;
      cursor: pointer;
      width: 100%;
      text-align: center;
    }

    /* ==========================================================================
       4. MIXED 100-CELL AXIRATE™ CSR CALL AUDIT MATRIX + VISUAL INFOGRAPHICS
       ========================================================================== */
    .infographic-showcase-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 22px;
      margin-top: 18px;
    }
    .info-frame {
      background: var(--midnight-card);
      border: 2px solid rgba(110, 132, 247, 0.5);
      border-radius: 18px;
      padding: 16px;
    }
    .info-frame img {
      width: 100%;
      height: auto;
      border-radius: 12px;
      display: block;
    }

    /* ==========================================================================
       5. MULTI-TRUCK FLEET & CSR AUDIT INTERACTIVE ROI CALCULATOR
       ========================================================================== */
    .roi-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    .roi-sliders {
      background: var(--midnight-card);
      border: 1.5px solid rgba(147, 168, 244, 0.4);
      border-radius: 18px;
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .slider-group label {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      font-weight: 800;
      color: var(--platinum);
      margin-bottom: 6px;
    }
    .slider-group input[type=range] {
      width: 100%;
      accent-color: var(--periwinkle-bright);
    }
    .roi-results {
      background: var(--midnight-deep);
      border: 2px solid var(--periwinkle-bright);
      border-radius: 18px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .roi-big-num {
      font-size: 46px;
      font-weight: 800;
      color: #5EEAD4;
      font-family: 'JetBrains Mono', monospace;
    }

    footer {
      margin-top: 36px;
      background: var(--midnight-deep);
      color: var(--bg-slate);
      border-top: 2px solid var(--periwinkle-bright);
      padding: 28px;
      text-align: center;
      font-size: 13px;
    }
    @media (max-width: 1024px) {
      .hero-split, .spatial-nodes-grid, .infographic-showcase-grid, .roi-grid {
        grid-template-columns: 1fr;
      }
      .brand-wordmark { font-size: 38px; }
    }
  </style>
</head>
<body>

  <!-- 1. LOCKED OCT 26 COOL SLATE (#CFD8E8) HEADER + MIDNIGHT CIRCULAR MEDALLION -->
  <header class="site-header">
    <div class="header-inner">
      <a href="index.html" class="brand-lockup">
        <div class="aa-medallion-grey-lock">
          <img src="assets/BANNER_HEADSET_WHITE_GLOW_NO_BORDER.png" alt="AgentAngel.io Canonical White Glow Headset inside Midnight Circular Medallion" />
        </div>
        <div>
          <div class="brand-wordmark">
            <span>Agent</span><span class="angel-peri">Angel</span><span class="tld-pill">.io</span>
          </div>
          <div class="brand-subtag">MULTI-TRUCK DISPATCH · SMS VISUAL TRIAGE · AXIRATE™ 100% CSR CALL QA</div>
        </div>
      </a>

      <nav class="nav-controls">
        <a href="#spatial-canvas-section" class="nav-link">4 Operational Windows</a>
        <a href="#visual-infographic-loop" class="nav-link">Visual Infographics</a>
        <a href="#multi-truck-roi" class="nav-link">Multi-Truck ROI Calculator</a>

        <div class="dropdown-wrap">
          <button class="nav-link" style="cursor:pointer;">Other Specialists ▾</button>
          <div class="dropdown-menu">
            <a href="plumbing.html" class="dd-item"><span>Plumbing &amp; Drain Fleets</span><span class="dd-badge active">ACTIVE PILOT</span></a>
            <a href="#spatial-canvas-section" class="dd-item"><span>HVAC &amp; Mechanical Fleets</span><span class="dd-badge">COMING SOON</span></a>
            <a href="#spatial-canvas-section" class="dd-item"><span>Electrical Service Fleets</span><span class="dd-badge">COMING SOON</span></a>
            <a href="#spatial-canvas-section" class="dd-item"><span>Roofing &amp; Storm Restoration</span><span class="dd-badge">COMING SOON</span></a>
            <a href="#spatial-canvas-section" class="dd-item"><span>Dental &amp; Multi-Chair Clinics</span><span class="dd-badge">COMING SOON</span></a>
          </div>
        </div>

        <a href="../aiagentangel-com/index.html" class="cross-site-btn">Switch to AIAgentAngel.com (Claims &amp; TPAs) →</a>
        <button class="lang-btn" onclick="toggleLang()" id="langToggleBtn">🌐 EN / ES</button>
      </nav>
    </div>
  </header>

  <main class="container">
    <!-- 2. 2-COLUMN SPLIT HERO (MULTI-TRUCK FLEETS + ALL 4 OPERATIONAL WINDOWS) -->
    <section class="hero-split" id="hero-section">
      <div>
        <span class="hero-kicker">${heroKicker}</span>
        <h1 class="hero-h1">${heroTitle}</h1>
        <p class="hero-lead">
          Built for 3–25+ truck plumbing &amp; mechanical fleets with busy CSR/dispatch teams—and growing shops scaling past their first trucks. She answers daytime overflow, texts callers for live equipment photos, audits 100% of office CSR calls, and captures 24/7 emergency service requests.
        </p>

        <div class="hero-bullets">
          <div class="hb-row">
            <span class="hb-tag">WINDOW 1 · 8AM–6PM</span>
            <div><strong>Daytime Multi-Line Overflow:</strong> Answers simultaneous calls in 0.4s when CSRs are on Line 1 &amp; 2 and locks Truck #1–#25 dispatch slots.</div>
          </div>
          <div class="hb-row">
            <span class="hb-tag">WINDOW 2 · MID-CALL</span>
            <div><strong>2-Way SMS Photo &amp; Rating Plate ID:</strong> Texts caller to snap the burst pipe or water heater serial tag so the right truck rolls with the right parts on Trip #1.</div>
          </div>
          <div class="hb-row">
            <span class="hb-tag">WINDOW 3 · ALL DAY</span>
            <div><strong>100% CSR &amp; Dispatcher Call Auditing (AxiRate™):</strong> Grades every human office call in &lt;5s across 6 booking, upsell &amp; price-objection categories.</div>
          </div>
          <div class="hb-row">
            <span class="hb-tag">WINDOW 4 · 24/7/365</span>
            <div><strong>After-Hours, Weekends &amp; Freeze Surges:</strong> Answers on Ring 1 in EN/ES, coaches water shutoff &amp; books $1,850+ emergency jobs live.</div>
          </div>
        </div>

        <div class="hero-cta-row">
          <a href="#spatial-canvas-section" class="btn-primary-midnight">Explore All 4 Operational Windows →</a>
          <a href="#multi-truck-roi" class="btn-secondary-slate">Calculate Multi-Truck Fleet ROI</a>
        </div>
      </div>

      <div class="hero-visual-col">
        <img class="hero-main-img" src="assets/heroes/plumbing_hero.png" alt="Multi-Truck Plumbing Fleet & 24/7 Emergency Dispatch" />
        <div class="four-windows-mini">
          <div class="fw-pill">
            <div class="w-time">01 · PEAK DAYTIME OVERFLOW</div>
            <div class="w-name">Simultaneous 0.4s Pickup + Multi-Truck Board Sync</div>
          </div>
          <div class="fw-pill">
            <div class="w-time">02 · MID-CALL VISUAL SMS</div>
            <div class="w-name">Pipe Leak &amp; Water Heater Serial Plate OCR</div>
          </div>
          <div class="fw-pill">
            <div class="w-time">03 · AXIRATE™ CSR AUDIT</div>
            <div class="w-name">100% Office Calls Scored + Unbooked Lead Alerts</div>
          </div>
          <div class="fw-pill">
            <div class="w-time">04 · 24/7 AFTER-HOURS SURGE</div>
            <div class="w-name">Shutoff Valve Coaching + On-Call Tech Dispatch</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 3. INTERACTIVE 2.5D/3D PREZI-STYLE SPATIAL ZOOM WALKTHROUGH -->
    <section class="section-card-midnight" id="spatial-canvas-section">
      <div class="sec-header-row">
        <div>
          <div class="sec-kicker">INTERACTIVE SPATIAL WALKTHROUGH · WHAT SHE CAN DO &amp; WHEN SHE IS DOING IT</div>
          <h2 class="sec-h2">Get to Know AgentAngel.io Across Your Entire Fleet</h2>
        </div>
        <div class="spatial-controls">
          <button class="sp-btn active" onclick="focusSpatialNode(0)" id="sp-btn-0">Overview (All 4 Windows)</button>
          <button class="sp-btn" onclick="focusSpatialNode(1)" id="sp-btn-1">1. Daytime Overflow</button>
          <button class="sp-btn" onclick="focusSpatialNode(2)" id="sp-btn-2">2. SMS Photo &amp; Part ID</button>
          <button class="sp-btn" onclick="focusSpatialNode(3)" id="sp-btn-3">3. 100% CSR Audit</button>
          <button class="sp-btn" onclick="focusSpatialNode(4)" id="sp-btn-4">4. 24/7 Emergency</button>
        </div>
      </div>

      <div class="spatial-viewport">
        <svg viewBox="0 0 1200 90" style="width:100%;height:54px;margin-bottom:8px;" fill="none">
          <path d="M140 45 C 260 10, 340 10, 440 45" stroke="#6E84F7" stroke-width="2.5" stroke-dasharray="6 6"/>
          <path d="M460 45 C 580 80, 660 80, 760 45" stroke="#6E84F7" stroke-width="2.5" stroke-dasharray="6 6"/>
          <path d="M780 45 C 900 10, 980 10, 1060 45" stroke="#5EEAD4" stroke-width="2.5" stroke-dasharray="6 6"/>
        </svg>

        <div class="spatial-nodes-grid" id="spatialGrid">
          <div class="sp-node focused" id="sp-node-1" onclick="focusSpatialNode(1)">
            <div>
              <div class="sec-kicker" style="color:#5EEAD4;">STOP 01 · 8:00 AM – 6:00 PM</div>
              <h3 style="font-size:19px;margin:6px 0;">Multi-Line Overflow &amp; Fleet Dispatch</h3>
              <p style="font-size:13px;color:#CFD8E8;">When CSRs are on Line 1 &amp; 2, she answers Lines 3–8 in 0.4s, verifies zip codes, and locks Truck #1–#25 slots in ServiceTitan/Housecall Pro.</p>
            </div>
            <img src="assets/SCENE_DUAL_MONITOR_CLEAN_V3.png" alt="Multi-Line Dispatch & Call Audit Floor" />
            <button class="sp-next-btn" onclick="event.stopPropagation(); focusSpatialNode(2);">NEXT: SMS Photo &amp; Part ID →</button>
          </div>

          <div class="sp-node" id="sp-node-2" onclick="focusSpatialNode(2)">
            <div>
              <div class="sec-kicker" style="color:#93A8F4;">STOP 02 · LIVE MID-CALL SMS</div>
              <h3 style="font-size:19px;margin:6px 0;">2-Way SMS Photo &amp; Rating Plate OCR</h3>
              <p style="font-size:13px;color:#CFD8E8;">Texts caller mid-call to snap the leaking pipe or water heater serial tag so the right truck rolls with the exact replacement part on Trip #1.</p>
            </div>
            <img src="assets/images/plumber_missed_call_lead.png" alt="Under Sink Pipe & Rating Plate Diagnostic" />
            <button class="sp-next-btn" onclick="event.stopPropagation(); focusSpatialNode(3);">NEXT: 100% CSR Auditing →</button>
          </div>

          <div class="sp-node" id="sp-node-3" onclick="focusSpatialNode(3)">
            <div>
              <div class="sec-kicker" style="color:#5EEAD4;">STOP 03 · EVERY OFFICE CALL</div>
              <h3 style="font-size:19px;margin:6px 0;">100% CSR &amp; Dispatcher Auditing (AxiRate™)</h3>
              <p style="font-size:13px;color:#CFD8E8;">Audits 100% of human CSR calls in &lt;5s across 6 categories—catching unbooked high-ticket repipes and coaching price-objection saves.</p>
            </div>
            <img src="assets/brand/AUDIT_COVERAGE_GRAPH_2PCT_VS_100PCT_AXIRATE.png" alt="AxiRate 100% Call Audit Mixed Matrix" />
            <button class="sp-next-btn" onclick="event.stopPropagation(); focusSpatialNode(4);">NEXT: 24/7 Emergency Surge →</button>
          </div>

          <div class="sp-node" id="sp-node-4" onclick="focusSpatialNode(4)">
            <div>
              <div class="sec-kicker" style="color:#93A8F4;">STOP 04 · NIGHTS &amp; WEEKENDS</div>
              <h3 style="font-size:19px;margin:6px 0;">24/7 After-Hours &amp; Storm Surge Capture</h3>
              <p style="font-size:13px;color:#CFD8E8;">Answers 10:25 PM slab leaks on Ring 1 in EN/ES, coaches main water shutoff, locks the $1,850+ dispatch slot &amp; texts the on-call tech.</p>
            </div>
            <img src="assets/heroes/plumbing_hero.png" alt="24/7 Emergency Plumbing Fleet Arrival" />
            <button class="sp-next-btn" onclick="event.stopPropagation(); focusSpatialNode(0);">← Back to Full Fleet Overview</button>
          </div>
        </div>
      </div>
    </section>

    <!-- 4. VISUAL INFOGRAPHICS & POMELLI MULTI-TRUCK CAMPAIGN SHOWCASE -->
    <section class="section-card-midnight" id="visual-infographic-loop">
      <div class="sec-header-row">
        <div>
          <div class="sec-kicker">ENTERPRISE VISUAL INFOGRAPHICS · ZERO KID-EMOJI SLOP · HIGH-CRAFT DOM</div>
          <h2 class="sec-h2">4-Window Multi-Truck Operational Matrix &amp; Outbound Campaign Plate</h2>
        </div>
        <span class="sp-btn" style="cursor:default;">LOCKED OCT 26 PALETTE &amp; TYPOGRAPHY</span>
      </div>

      <div class="infographic-showcase-grid">
        <div class="info-frame">
          <img src="assets/INFOGRAPHIC_PLUMBING_MISSED_CALL_ROI_LOOP.png" alt="Multi-Truck Plumbing Fleet 4 Operational Windows & ROI Matrix Infographic" />
        </div>
        <div class="info-frame">
          <img src="assets/POMELLI_PLUMBING_SMB_OUTBOUND_AD_2026W44.png" alt="AgentAngel.io Multi-Truck Plumbing Fleet Outbound Campaign Ad Plate" />
        </div>
      </div>
    </section>

    <!-- 5. INTERACTIVE MULTI-TRUCK FLEET & CSR CALL AUDIT ROI CALCULATOR -->
    <section class="section-card-midnight" id="multi-truck-roi">
      <div class="sec-header-row">
        <div>
          <div class="sec-kicker">2-TIER INTERACTIVE FLEET CALCULATOR · OVERFLOW + SMS TRIAGE + CSR AUDIT LIFT</div>
          <h2 class="sec-h2">Calculate Your Multi-Truck Fleet Recovery</h2>
        </div>
      </div>

      <div class="roi-grid">
        <div class="roi-sliders">
          <div class="slider-group">
            <label><span>Active Service Trucks in Fleet</span><span id="val-trucks">6 Trucks</span></label>
            <input type="range" id="rng-trucks" min="1" max="30" value="6" oninput="updateFleetRoi()" />
          </div>
          <div class="slider-group">
            <label><span>Overflow &amp; After-Hours Calls Saved / Week</span><span id="val-calls">8 Calls/wk</span></label>
            <input type="range" id="rng-calls" min="2" max="40" value="8" oninput="updateFleetRoi()" />
          </div>
          <div class="slider-group">
            <label><span>Average Emergency / Repipe / Water Heater Ticket</span><span id="val-ticket">$1,250</span></label>
            <input type="range" id="rng-ticket" min="450" max="3500" step="50" value="1250" oninput="updateFleetRoi()" />
          </div>
          <div class="slider-group">
            <label><span>Unbooked CSR Calls Rescued by AxiRate™ / Month</span><span id="val-csr">6 Jobs/mo</span></label>
            <input type="range" id="rng-csr" min="0" max="30" value="6" oninput="updateFleetRoi()" />
          </div>
        </div>

        <div class="roi-results">
          <div>
            <div class="sec-kicker">ESTIMATED MONTHLY NET FLEET REVENUE RECOVERED</div>
            <div class="roi-big-num" id="out-monthly-roi">+$47,500/mo</div>
            <p style="font-size:14px;color:#CFD8E8;margin-top:8px;" id="out-roi-breakdown">
              Includes $40,000/mo from overflow &amp; 24/7 dispatch capture + $7,500/mo from AxiRate™ CSR unbooked-lead saves.
            </p>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(147,168,244,0.35);padding-top:16px;margin-top:16px;flex-wrap:wrap;gap:12px;">
            <div>
              <div style="font-size:12px;color:#93A8F4;font-family:'JetBrains Mono',monospace;font-weight:800;">RECOMMENDED FLEET TIER</div>
              <div style="font-size:18px;font-weight:800;color:#E5E7EB;" id="out-tier-name">Multi-Truck Pro + AxiRate™ CSR Audit ($499/mo)</div>
            </div>
            <a href="../aiagentangel-com/index.html" class="btn-secondary-slate">Book 15-Min Fleet Onboarding →</a>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <p><strong>Dub Hujar Ventures LLC dba AgentAngel.io</strong> · Commercial Trades &amp; Multi-Truck Fleet Division · Locked Oct 26 Sovereign Design System (#CFD8E8 · #0F1E4A · #4F6BD8 · #E5E7EB)</p>
  </footer>

  <script>
    function focusSpatialNode(idx) {
      document.querySelectorAll('.sp-btn').forEach((b, i) => {
        b.classList.toggle('active', i === idx);
      });
      document.querySelectorAll('.sp-node').forEach((n, i) => {
        n.classList.toggle('focused', idx === 0 || (i + 1) === idx);
      });
    }

    function updateFleetRoi() {
      const trucks = parseInt(document.getElementById('rng-trucks').value, 10);
      const callsWk = parseInt(document.getElementById('rng-calls').value, 10);
      const ticket = parseInt(document.getElementById('rng-ticket').value, 10);
      const csrJobs = parseInt(document.getElementById('rng-csr').value, 10);

      document.getElementById('val-trucks').textContent = trucks + (trucks === 1 ? ' Truck' : ' Trucks');
      document.getElementById('val-calls').textContent = callsWk + ' Calls/wk';
      document.getElementById('val-ticket').textContent = '$' + ticket.toLocaleString();
      document.getElementById('val-csr').textContent = csrJobs + ' Jobs/mo';

      const dispatchRev = callsWk * 4 * ticket;
      const csrRev = csrJobs * ticket;
      const total = dispatchRev + csrRev;

      document.getElementById('out-monthly-roi').textContent = '+$' + total.toLocaleString() + '/mo';
      document.getElementById('out-roi-breakdown').textContent =
        'Includes $' + dispatchRev.toLocaleString() + '/mo from overflow & 24/7 dispatch capture + $' +
        csrRev.toLocaleString() + '/mo from AxiRate™ CSR unbooked-lead saves.';

      const tierEl = document.getElementById('out-tier-name');
      if (trucks <= 2) {
        tierEl.textContent = 'Growing Fleet Starter ($99–$249/mo)';
      } else {
        tierEl.textContent = 'Multi-Truck Fleet & Call Center Pro + AxiRate™ ($499/mo)';
      }
    }

    let isEs = false;
    function toggleLang() {
      isEs = !isEs;
      document.getElementById('langToggleBtn').textContent = isEs ? '🌐 ES (Activo) / EN' : '🌐 EN / ES';
    }
  </script>
</body>
</html>`;
}

fs.writeFileSync(path.join(TRADES_DIR, 'plumbing.html'), buildTradesPage({ isPlumbingPage: true }));
fs.writeFileSync(path.join(TRADES_DIR, 'index.html'), buildTradesPage({ isPlumbingPage: false }));

console.log('SUCCESS: Upgraded agentangel-io/plumbing.html and agentangel-io/index.html to Locked Oct 26 Multi-Truck 4-Window Design System.');
