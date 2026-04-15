/**
 * NextGen Business Operations Intelligence Platform
 * Executive 5-Slide Deck — IBM-inspired design system
 * Built with pptxgenjs
 */

const pptxgen = require("pptxgenjs");
const path = require("path");
const fs = require("fs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10" x 5.625"
pres.title = "NextGen Business Operations Intelligence Platform";
pres.author = "NextGen BO Platform";

// ─── Color palette ────────────────────────────────────────────────────────────
const C = {
  navy:      "0F1941",
  ibmBlue:   "0f62fe",
  ibmBlueDark: "0043ce",
  lightGray: "F4F4F4",
  white:     "FFFFFF",
  darkText:  "161616",
  medText:   "525252",
  lightText: "C1C7CD",
  tealAccent:"08BDBA",
  cardBg:    "FFFFFF",
  cardBorder:"E0E0E0",
};

// ─── Screenshot paths ─────────────────────────────────────────────────────────
const SCREENSHOT_DIR = "C:/Users/Public/nextgenbpo-platform/deck-screenshots";
const screenshots = {
  assess:       path.join(SCREENSHOT_DIR, "assess.png"),
  roadmap:      path.join(SCREENSHOT_DIR, "roadmap.png"),
  businesscase: path.join(SCREENSHOT_DIR, "businesscase.png"),
  index:        path.join(SCREENSHOT_DIR, "index.png"),
};

function screenshotExists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

// ─── Helper: placeholder box when screenshot missing ─────────────────────────
function addPlaceholderBox(slide, x, y, w, h, label) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h,
    fill: { color: "E8EDF5" },
    line: { color: "0f62fe", width: 1.5, dashType: "dash" },
  });
  slide.addText(`[Screenshot: ${label}]`, {
    x, y, w, h,
    align: "center", valign: "middle",
    fontSize: 11, color: "525252", italic: true,
    margin: 0,
  });
}

// ─── Helper: add screenshot or placeholder ────────────────────────────────────
function addScreenshot(slide, key, x, y, w, h) {
  const p = screenshots[key];
  if (screenshotExists(p)) {
    slide.addImage({ path: p, x, y, w, h, sizing: { type: "contain", w, h } });
  } else {
    const labels = {
      assess:       "assess.html — Finance Spider Chart & Scorecard",
      roadmap:      "roadmap.html — Transformation Roadmap & Timeline",
      businesscase: "businesscase.html — Multi-Scenario Business Case",
      index:        "index.html — Platform Homepage Hero",
    };
    addPlaceholderBox(slide, x, y, w, h, labels[key] || key);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE 1 — Title (dark navy background)
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.navy };

  // ── Brand mark (top-left) ──
  // Small teal square logo "BO"
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.45, y: 0.32, w: 0.46, h: 0.46,
    fill: { color: C.tealAccent },
    line: { color: C.tealAccent, width: 0 },
  });
  s.addText("BO", {
    x: 0.45, y: 0.32, w: 0.46, h: 0.46,
    align: "center", valign: "middle",
    fontSize: 13, bold: true, color: C.navy, margin: 0,
    fontFace: "Calibri",
  });
  // Brand name
  s.addText("NextGen Business Operations", {
    x: 1.0, y: 0.34, w: 3.8, h: 0.42,
    align: "left", valign: "middle",
    fontSize: 13, bold: false, color: C.lightText,
    fontFace: "Calibri", margin: 0,
  });

  // ── Thin IBM-blue accent rule ──
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.45, y: 1.05, w: 1.1, h: 0.035,
    fill: { color: C.ibmBlue },
    line: { color: C.ibmBlue, width: 0 },
  });

  // ── Main headline ──
  s.addText("Transforming How Enterprises\nAssess, Design & Operate\nNext-Gen Business Operations", {
    x: 0.45, y: 1.18, w: 8.8, h: 2.35,
    align: "left", valign: "top",
    fontSize: 40, bold: false, color: C.white,
    fontFace: "Calibri Light",
    paraSpaceAfter: 4,
  });

  // ── Subtitle ──
  s.addText("White-Label Intelligence Platform for GTM, Deal Teams, Solution Architects & Delivery Leaders", {
    x: 0.45, y: 3.6, w: 8.4, h: 0.6,
    align: "left", valign: "middle",
    fontSize: 17, color: "8EB1E5",
    fontFace: "Calibri Light",
  });

  // ── Four persona tags ──
  const tags = ["GTM & Sellers", "Large Deal Teams", "Solution Architects", "Delivery Leaders"];
  const tagW = 2.0;
  const tagH = 0.38;
  const tagY = 4.55;
  const tagGap = 0.14;
  const tagStartX = 0.45;
  tags.forEach((tag, i) => {
    const tx = tagStartX + i * (tagW + tagGap);
    s.addShape(pres.shapes.RECTANGLE, {
      x: tx, y: tagY, w: tagW, h: tagH,
      fill: { color: C.ibmBlue },
      line: { color: C.ibmBlue, width: 0 },
    });
    s.addText(tag, {
      x: tx, y: tagY, w: tagW, h: tagH,
      align: "center", valign: "middle",
      fontSize: 11, bold: true, color: C.white,
      fontFace: "Calibri", margin: 0,
    });
  });

  // ── CONFIDENTIAL label (bottom-right) ──
  s.addText("CONFIDENTIAL", {
    x: 7.8, y: 5.22, w: 1.8, h: 0.25,
    align: "right", valign: "middle",
    fontSize: 9, color: "4A5568", bold: false,
    fontFace: "Calibri",
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE 2 — Platform Overview (light F4F4F4 background)
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.lightGray };

  // ── IBM-blue top bar ──
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.07,
    fill: { color: C.ibmBlue },
    line: { color: C.ibmBlue, width: 0 },
  });

  // ── Slide header ──
  s.addText("One Platform. Four Powerful Use Cases.", {
    x: 0.45, y: 0.2, w: 9.1, h: 0.65,
    align: "left", valign: "middle",
    fontSize: 28, bold: true, color: C.darkText,
    fontFace: "Calibri",
  });
  s.addText("Accelerating next-generation Business Operations opportunities across Finance, Procurement & HR", {
    x: 0.45, y: 0.82, w: 9.1, h: 0.38,
    align: "left", valign: "middle",
    fontSize: 13, color: C.medText,
    fontFace: "Calibri Light",
  });

  // ── 2x2 card grid ──
  const cards = [
    {
      num: "01",
      title: "GTM & SELLERS",
      subTitle: "Client Zero Story Engine",
      body: "Bring the NextGen BO story to life for prospects. Use proven transformation benchmarks and Client Zero case study outcomes to shape compelling $50M+ opportunities across 3 key domains.",
    },
    {
      num: "02",
      title: "LARGE DEAL TEAMS",
      subTitle: "60-Question Maturity Harvester",
      body: "Rapid multi-stakeholder assessment across Finance, Procurement & HR. Built from years of successful client engagements. Outputs a scored maturity profile instantly with prioritised gap analysis.",
    },
    {
      num: "03",
      title: "STRATEGIC & DELIVERY TEAMS",
      subTitle: "Intelligent Transformation Roadmap",
      body: "AI-generated domain roadmaps aligned to client maturity and Client Zero benchmarks. Horizon-based initiative library with value mapping, Gantt timelines and ROI projections.",
    },
    {
      num: "04",
      title: "SOLUTION ARCHITECTS",
      subTitle: "Business Case Modelling Engine",
      body: "Model automation, onshore/nearshore BO and hybrid scenarios at transaction level. Built on industry benchmarks. Compare 5 scenarios instantly — outputs exec-ready cost and savings analysis.",
    },
  ];

  const colW = 4.5;
  const rowH = 1.88;
  const colGap = 0.1;
  const rowGap = 0.12;
  const startX = 0.45;
  const startY = 1.28;

  cards.forEach((card, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cx = startX + col * (colW + colGap);
    const cy = startY + row * (rowH + rowGap);

    // Card background
    s.addShape(pres.shapes.RECTANGLE, {
      x: cx, y: cy, w: colW, h: rowH,
      fill: { color: C.white },
      line: { color: C.cardBorder, width: 0.75 },
      shadow: { type: "outer", color: "000000", blur: 8, offset: 2, angle: 135, opacity: 0.07 },
    });

    // IBM-blue left accent bar
    s.addShape(pres.shapes.RECTANGLE, {
      x: cx, y: cy, w: 0.055, h: rowH,
      fill: { color: C.ibmBlue },
      line: { color: C.ibmBlue, width: 0 },
    });

    // Number circle (IBM blue filled)
    s.addShape(pres.shapes.OVAL, {
      x: cx + 0.16, y: cy + 0.16, w: 0.38, h: 0.38,
      fill: { color: C.ibmBlue },
      line: { color: C.ibmBlue, width: 0 },
    });
    s.addText(card.num, {
      x: cx + 0.16, y: cy + 0.16, w: 0.38, h: 0.38,
      align: "center", valign: "middle",
      fontSize: 10, bold: true, color: C.white,
      fontFace: "Calibri", margin: 0,
    });

    // Card title label (IBM blue small caps style)
    s.addText(card.title, {
      x: cx + 0.65, y: cy + 0.16, w: colW - 0.75, h: 0.25,
      align: "left", valign: "middle",
      fontSize: 9, bold: true, color: C.ibmBlue,
      fontFace: "Calibri", charSpacing: 1, margin: 0,
    });

    // Card sub-title (bold, dark)
    s.addText(card.subTitle, {
      x: cx + 0.16, y: cy + 0.56, w: colW - 0.28, h: 0.32,
      align: "left", valign: "middle",
      fontSize: 13, bold: true, color: C.darkText,
      fontFace: "Calibri",
    });

    // Card body
    s.addText(card.body, {
      x: cx + 0.16, y: cy + 0.9, w: colW - 0.28, h: 0.9,
      align: "left", valign: "top",
      fontSize: 11, color: C.medText,
      fontFace: "Calibri Light",
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE 3 — Maturity Assessment (white background, split layout)
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.white };

  // ── IBM-blue top bar ──
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.07,
    fill: { color: C.ibmBlue },
    line: { color: C.ibmBlue, width: 0 },
  });

  // ── Slide header ──
  s.addText("Accelerated Maturity Assessment", {
    x: 0.45, y: 0.2, w: 9.1, h: 0.58,
    align: "left", valign: "middle",
    fontSize: 26, bold: true, color: C.darkText,
    fontFace: "Calibri",
  });
  s.addText("Beta client assessment — Finance domain deep dive", {
    x: 0.45, y: 0.74, w: 9.1, h: 0.32,
    align: "left", valign: "middle",
    fontSize: 13, color: C.medText,
    fontFace: "Calibri Light",
  });

  // ── Left screenshot zone (60% width) ──
  const imgX = 0.45;
  const imgY = 1.14;
  const imgW = 5.8;
  const imgH = 3.3;
  addScreenshot(s, "assess", imgX, imgY, imgW, imgH);

  // ── Right: 3 stat callout boxes ──
  // Stat boxes — numeric stats use large number; 3rd uses 2-line label style
  const statX = 6.55;
  const statW = 3.1;
  const statH = 0.97;
  const statGap = 0.18;
  const statStartY = 1.14;

  const statDefs = [
    { big: "60", bigSize: 28, small: "Questions", sub: "Across 3 domains" },
    { big: "5",  bigSize: 28, small: "Maturity Levels", sub: "Aware → Leading" },
    { big: "Domain + Sub-domain", bigSize: 14, small: "Scored per dimension", sub: "Granular gap analysis" },
  ];

  statDefs.forEach((stat, i) => {
    const sy = statStartY + i * (statH + statGap);
    s.addShape(pres.shapes.RECTANGLE, {
      x: statX, y: sy, w: statW, h: statH,
      fill: { color: C.lightGray },
      line: { color: C.cardBorder, width: 0.75 },
    });
    // Blue left accent
    s.addShape(pres.shapes.RECTANGLE, {
      x: statX, y: sy, w: 0.055, h: statH,
      fill: { color: C.ibmBlue },
      line: { color: C.ibmBlue, width: 0 },
    });
    // Big number / label
    s.addText(stat.big, {
      x: statX + 0.16, y: sy + 0.04, w: statW - 0.22, h: 0.42,
      align: "left", valign: "middle",
      fontSize: stat.bigSize, bold: true, color: C.ibmBlue,
      fontFace: "Calibri",
    });
    s.addText(stat.small, {
      x: statX + 0.16, y: sy + 0.44, w: statW - 0.22, h: 0.24,
      align: "left", valign: "middle",
      fontSize: 11, bold: true, color: C.darkText,
      fontFace: "Calibri",
    });
    s.addText(stat.sub, {
      x: statX + 0.16, y: sy + 0.67, w: statW - 0.22, h: 0.22,
      align: "left", valign: "middle",
      fontSize: 10, color: C.medText,
      fontFace: "Calibri Light",
    });
  });

  // ── 3 bullet points below screenshot ──
  const bullets = [
    "Multi-stakeholder questionnaire refined over 3+ years of client engagements",
    "Instant domain-level spider charts with drill-down to sub-domain scorecards",
    "Exports assessment results for SteerCo and executive reporting",
  ];
  s.addText(
    bullets.map((b, i) => ({
      text: b,
      options: { bullet: true, breakLine: i < bullets.length - 1 },
    })),
    {
      x: 0.45, y: 4.52, w: 5.8, h: 1.0,
      align: "left", valign: "top",
      fontSize: 11, color: C.medText,
      fontFace: "Calibri Light",
    }
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE 4 — Roadmap & Business Case (white background, two-column)
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.white };

  // ── IBM-blue top bar ──
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.07,
    fill: { color: C.ibmBlue },
    line: { color: C.ibmBlue, width: 0 },
  });

  // ── Slide header ──
  s.addText("From Assessment to Roadmap to Business Case — In Minutes", {
    x: 0.45, y: 0.2, w: 9.1, h: 0.58,
    align: "left", valign: "middle",
    fontSize: 22, bold: true, color: C.darkText,
    fontFace: "Calibri",
  });

  // Thin divider under header
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.45, y: 0.82, w: 9.1, h: 0.028,
    fill: { color: C.cardBorder },
    line: { color: C.cardBorder, width: 0 },
  });

  // ─── Left column: Roadmap ───
  const colW = 4.5;
  const lx = 0.45;
  const rx = 5.15;
  const colY1 = 0.92;

  // Left sub-header
  s.addShape(pres.shapes.RECTANGLE, {
    x: lx, y: colY1, w: colW, h: 0.35,
    fill: { color: C.ibmBlue },
    line: { color: C.ibmBlue, width: 0 },
  });
  s.addText("Value-Based Transformation Roadmap", {
    x: lx + 0.12, y: colY1, w: colW - 0.16, h: 0.35,
    align: "left", valign: "middle",
    fontSize: 12, bold: true, color: C.white,
    fontFace: "Calibri", margin: 0,
  });

  // Roadmap screenshot
  const imgY = colY1 + 0.38;
  const imgH = 2.9;
  addScreenshot(s, "roadmap", lx, imgY, colW, imgH);

  // Roadmap bullets
  const roadmapBullets = [
    "Initiative library mapped to maturity gaps — horizon-classified (0-6m, 6-18m, 18m+)",
    "Real-time value summary: EAV, cost, ROI per initiative",
  ];
  s.addText(
    roadmapBullets.map((b, i) => ({
      text: b,
      options: { bullet: true, breakLine: i < roadmapBullets.length - 1 },
    })),
    {
      x: lx, y: imgY + imgH + 0.1, w: colW, h: 0.78,
      align: "left", valign: "top",
      fontSize: 10.5, color: C.medText,
      fontFace: "Calibri Light",
    }
  );

  // ─── Right column: Business Case ───
  // Right sub-header
  s.addShape(pres.shapes.RECTANGLE, {
    x: rx, y: colY1, w: colW, h: 0.35,
    fill: { color: C.ibmBlueDark },
    line: { color: C.ibmBlueDark, width: 0 },
  });
  s.addText("Multi-Scenario Business Case", {
    x: rx + 0.12, y: colY1, w: colW - 0.16, h: 0.35,
    align: "left", valign: "middle",
    fontSize: 12, bold: true, color: C.white,
    fontFace: "Calibri", margin: 0,
  });

  // Business case screenshot
  addScreenshot(s, "businesscase", rx, imgY, colW, imgH);

  // Business case bullets
  const bcBullets = [
    "5 modelled scenarios: Do Nothing, Automation, BO Onshore/Nearshore, Hybrid",
    "Transaction-level unit economics vs industry benchmarks",
  ];
  s.addText(
    bcBullets.map((b, i) => ({
      text: b,
      options: { bullet: true, breakLine: i < bcBullets.length - 1 },
    })),
    {
      x: rx, y: imgY + imgH + 0.1, w: colW, h: 0.78,
      align: "left", valign: "top",
      fontSize: 10.5, color: C.medText,
      fontFace: "Calibri Light",
    }
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE 5 — Closing (dark navy background)
// ═══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.navy };

  // ── Slide header ──
  s.addText("A Complete Intelligence Platform for the Full Transformation Journey", {
    x: 0.45, y: 0.18, w: 9.1, h: 0.62,
    align: "left", valign: "middle",
    fontSize: 22, bold: false, color: C.white,
    fontFace: "Calibri Light",
  });
  s.addText("From first client conversation to steady-state operations", {
    x: 0.45, y: 0.80, w: 9.1, h: 0.30,
    align: "left", valign: "middle",
    fontSize: 13, color: "8EB1E5",
    fontFace: "Calibri Light",
  });

  // ── 5 horizontal capability strips ──
  const strips = [
    { icon: "Assess",         text: "60-question maturity benchmark across Finance, Procurement & HR" },
    { icon: "Roadmap",        text: "Gap-to-initiative mapping with horizon planning and value forecasting" },
    { icon: "Business Case",  text: "Scenario modelling with transaction economics and benchmarks" },
    { icon: "Playbooks",      text: "Methodology guides, SOP templates and transformation accelerators" },
    { icon: "Pipeline & ROI", text: "Track engagements, measure KPI delivery, report savings to clients" },
  ];

  const stripH = 0.50;
  const stripGap = 0.09;
  const stripStartY = 1.22;
  const stripX = 0.45;
  const stripW = 9.1;

  strips.forEach((strip, i) => {
    const sy = stripStartY + i * (stripH + stripGap);

    // Strip background (slightly lighter navy)
    s.addShape(pres.shapes.RECTANGLE, {
      x: stripX, y: sy, w: stripW, h: stripH,
      fill: { color: "1A2B5C" },
      line: { color: "243570", width: 0.5 },
    });

    // IBM-blue left accent bar
    s.addShape(pres.shapes.RECTANGLE, {
      x: stripX, y: sy, w: 0.07, h: stripH,
      fill: { color: C.ibmBlue },
      line: { color: C.ibmBlue, width: 0 },
    });

    // Icon label pill (IBM blue)
    const pilW = 1.25;
    const pilH = 0.30;
    const pilY = sy + (stripH - pilH) / 2;
    s.addShape(pres.shapes.RECTANGLE, {
      x: stripX + 0.18, y: pilY, w: pilW, h: pilH,
      fill: { color: C.ibmBlue },
      line: { color: C.ibmBlue, width: 0 },
    });
    s.addText(strip.icon, {
      x: stripX + 0.18, y: pilY, w: pilW, h: pilH,
      align: "center", valign: "middle",
      fontSize: 10, bold: true, color: C.white,
      fontFace: "Calibri", margin: 0,
    });

    // Strip body text
    s.addText(strip.text, {
      x: stripX + 1.57, y: sy, w: stripW - 1.68, h: stripH,
      align: "left", valign: "middle",
      fontSize: 12.5, color: "D0D8E8",
      fontFace: "Calibri Light",
    });
  });

  // ── Action buttons ──
  const btnY = 4.78;
  const btnH = 0.42;

  // Filled IBM Blue: "Request a Live Demo"
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.45, y: btnY, w: 2.2, h: btnH,
    fill: { color: C.ibmBlue },
    line: { color: C.ibmBlue, width: 0 },
  });
  s.addText("Request a Live Demo", {
    x: 0.45, y: btnY, w: 2.2, h: btnH,
    align: "center", valign: "middle",
    fontSize: 12, bold: true, color: C.white,
    fontFace: "Calibri", margin: 0,
  });

  // Outlined IBM Blue: "Access Platform"
  s.addShape(pres.shapes.RECTANGLE, {
    x: 2.78, y: btnY, w: 1.9, h: btnH,
    fill: { color: C.navy },
    line: { color: C.ibmBlue, width: 1.5 },
  });
  s.addText("Access Platform", {
    x: 2.78, y: btnY, w: 1.9, h: btnH,
    align: "center", valign: "middle",
    fontSize: 12, bold: false, color: C.ibmBlue,
    fontFace: "Calibri", margin: 0,
  });

  // URL
  s.addText("nextgenbpo.app", {
    x: 0.45, y: btnY + btnH + 0.08, w: 4.5, h: 0.22,
    align: "left", valign: "middle",
    fontSize: 11, color: "8EB1E5",
    fontFace: "Calibri Light",
  });
}

// ─── Write file ──────────────────────────────────────────────────────────────
const outPath = "C:/Users/Public/nextgenbpo-platform/NextGen_BO_Platform_Executive_Deck.pptx";

pres.writeFile({ fileName: outPath })
  .then(() => {
    console.log(`✅  Saved: ${outPath}`);
  })
  .catch((err) => {
    console.error("❌  Error:", err);
    process.exit(1);
  });
