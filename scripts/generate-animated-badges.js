const fs = require('fs');
const path = require('path');

const badgesDir = path.join(__dirname, '..', 'data', 'badges');

/**
 * Body metals vs star metals kept separate so stars read clearly against the medal.
 * Star gradients push brighter highlights / deeper shadows (or a cooler tint).
 */
const METALS = {
  bronze: {
    stops: [
      ['0%', '#F0D0B0'],
      ['45%', '#B87333'],
      ['100%', '#6B3A12'],
    ],
    stroke: '#5C2E0A',
    accent: '#F0D0B0',
    starStops: [
      ['0%', '#FFF5E8'],
      ['35%', '#E8A060'],
      ['70%', '#8B4513'],
      ['100%', '#2A1205'],
    ],
    starStroke: '#1A0A02',
  },
  silver: {
    stops: [
      ['0%', '#FFFFFF'],
      ['45%', '#C0C0C0'],
      ['100%', '#5A6570'],
    ],
    stroke: '#4B5563',
    accent: '#FFFFFF',
    starStops: [
      ['0%', '#FFFFFF'],
      ['30%', '#E8F0F8'],
      ['65%', '#7A8FA3'],
      ['100%', '#1A2330'],
    ],
    starStroke: '#0F1720',
  },
  gold: {
    stops: [
      ['0%', '#FFF8DC'],
      ['45%', '#D4AF37'],
      ['100%', '#8B6914'],
    ],
    stroke: '#6B5010',
    accent: '#FFF8DC',
    starStops: [
      ['0%', '#FFFFF0'],
      ['30%', '#FFE566'],
      ['65%', '#C9A227'],
      ['100%', '#3D2A00'],
    ],
    starStroke: '#2A1C00',
  },
  diamond: {
    stops: [
      ['0%', '#F0F9FF'],
      ['45%', '#5B9BD5'],
      ['100%', '#1E3A5F'],
    ],
    stroke: '#16304F',
    accent: '#F0F9FF',
    starStops: [
      ['0%', '#FFFFFF'],
      ['30%', '#CFFAFE'],
      ['60%', '#38BDF8'],
      ['100%', '#082F49'],
    ],
    starStroke: '#041E2E',
  },
  /** Darker, slightly brown-grey — distinct from cool silver. */
  unranked: {
    stops: [
      ['0%', '#8A7F72'],
      ['45%', '#5C534A'],
      ['100%', '#2E2924'],
    ],
    stroke: '#1F1B17',
    accent: '#9A8F82',
    starStops: [
      ['0%', '#8A7F72'],
      ['45%', '#5C534A'],
      ['100%', '#2E2924'],
    ],
    starStroke: '#1F1B17',
  },
  /** Pro family metal: amber/gold only (even when medal fill is RGB). */
  pro: {
    stops: [
      ['0%', '#FFF3C4'],
      ['45%', '#F6D860'],
      ['100%', '#B45309'],
    ],
    stroke: '#92400E',
    accent: '#FFE08A',
    starStops: [
      ['0%', '#FFF3C4'],
      ['45%', '#F6D860'],
      ['100%', '#B45309'],
    ],
    starStroke: '#92400E',
  },
};

function shadowFilter(id = 'shadow') {
  return `<filter id="${id}" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.35"/>
    </filter>`;
}

function starPolygonPoints(cx, cy, outerR, innerR, n = 5) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

function starPoly(cx, cy, outerR, fill, stroke, strokeW = 1.8) {
  const pts = starPolygonPoints(cx, cy, outerR, outerR * 0.4);
  return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>`;
}

function metalStarStops(metalKey) {
  const metal = METALS[metalKey] || METALS.pro;
  return metal.starStops || metal.stops;
}

function metalStarStroke(metalKey) {
  const metal = METALS[metalKey] || METALS.pro;
  return metal.starStroke || metal.stroke;
}

/**
 * Rotating metallic backing star (slightly smaller than Pro-X's).
 */
function backingStarDefsAndMarkup(metalKey, { large = false } = {}) {
  const stops = metalStarStops(metalKey)
    .map(([off, c]) => `<stop offset="${off}" stop-color="${c}"/>`)
    .join('\n      ');
  const stroke = metalStarStroke(metalKey);
  const o = large ? 126 : 118;
  const inn = large ? 50 : 46;
  const pts = starPolygonPoints(128, 128, o, inn, 5);
  const defs = `
    <linearGradient id="starMetal" x1="0" y1="0" x2="0" y2="1">
      ${stops}
    </linearGradient>
    <filter id="starGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="2.2" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;
  const markup = `
  <g filter="url(#starGlow)">
    <g>
      <animateTransform attributeName="transform" type="rotate"
        values="0 128 128;360 128 128" dur="10s" repeatCount="indefinite"/>
      <polygon points="${pts}" fill="url(#starMetal)" stroke="${stroke}" stroke-width="2.5" opacity="0.98"/>
    </g>
  </g>`;
  return { defs, markup };
}

/** Static inner stars matching metal (not rotating). Count 1–4. */
function countStars(n, metalKey) {
  const stroke = metalStarStroke(metalKey);
  const fill = 'url(#innerStarMetal)';
  if (!n || n < 1) return '';

  const sizes = { 1: 36, 2: 26, 3: 22, 4: 20 };
  const o = sizes[Math.min(n, 4)] || 20;

  let polys = '';
  if (n === 1) {
    polys = starPoly(128, 128, o, fill, stroke, 2);
  } else if (n === 2) {
    const gap = 34;
    polys = [
      starPoly(128 - gap, 128, o, fill, stroke),
      starPoly(128 + gap, 128, o, fill, stroke),
    ].join('\n    ');
  } else if (n === 3) {
    polys = [
      starPoly(128, 108, o, fill, stroke),
      starPoly(105, 142, o, fill, stroke),
      starPoly(151, 142, o, fill, stroke),
    ].join('\n    ');
  } else {
    const d = 26;
    polys = [
      starPoly(128 - d, 128 - d, o, fill, stroke),
      starPoly(128 + d, 128 - d, o, fill, stroke),
      starPoly(128 - d, 128 + d, o, fill, stroke),
      starPoly(128 + d, 128 + d, o, fill, stroke),
    ].join('\n    ');
  }

  return `
  <g>
    ${polys}
  </g>`;
}

/**
 * Pro V+: one medium-large star upper-center + N small stars beneath.
 * For pro-v, pass smallCount=0 and largeOnly=true for a single centered large star.
 */
function proClusterStars(smallCount, { largeOnly = false } = {}) {
  const fill = 'url(#innerStarMetal)';
  const stroke = metalStarStroke('pro');

  if (largeOnly) {
    return `
  <g>
    ${starPoly(128, 128, 44, fill, stroke, 2.2)}
  </g>`;
  }

  const large = starPoly(128, 100, 32, fill, stroke, 2);
  if (smallCount <= 0) {
    return `
  <g>
    ${large}
  </g>`;
  }

  const o = 14;
  const y = 158;
  const spacing = 28;
  const totalW = (smallCount - 1) * spacing;
  const startX = 128 - totalW / 2;
  const smalls = [];
  for (let i = 0; i < smallCount; i++) {
    smalls.push(starPoly(startX + i * spacing, y, o, fill, stroke, 1.4));
  }

  return `
  <g>
    ${large}
    ${smalls.join('\n    ')}
  </g>`;
}

function innerStarMetalDef(metalKey) {
  const stops = metalStarStops(metalKey)
    .map(([off, c]) => `<stop offset="${off}" stop-color="${c}"/>`)
    .join('\n      ');
  return `
    <linearGradient id="innerStarMetal" x1="0" y1="0" x2="0" y2="1">
      ${stops}
    </linearGradient>`;
}

function rgbFillGradient(id = 'g') {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ff2244">
        <animate attributeName="stop-color" values="#ff2244;#22ff66;#4488ff;#ff2244" dur="2.8s" repeatCount="indefinite"/>
      </stop>
      <stop offset="50%" stop-color="#1F2937">
        <animate attributeName="stop-color" values="#2a1020;#102a18;#101828;#2a1020" dur="2.8s" repeatCount="indefinite"/>
      </stop>
      <stop offset="100%" stop-color="#4488ff">
        <animate attributeName="stop-color" values="#4488ff;#ff2244;#22ff66;#4488ff" dur="2.8s" repeatCount="indefinite"/>
      </stop>
    </linearGradient>`;
}

function staticFillGradient(stops) {
  return `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      ${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('\n      ')}
    </linearGradient>`;
}

function rainbowBorderRings() {
  const rainbowCycle = '#ff0040;#ff8c00;#ffee00;#00c853;#00b0ff;#7c4dff;#ff0040';
  const rainbowCycleOffset = '#00b0ff;#7c4dff;#ff0040;#ff8c00;#ffee00;#00c853;#00b0ff';
  return `
  <circle cx="128" cy="128" r="120" fill="none" stroke="#ff0040" stroke-width="10" opacity="0.55" filter="url(#rainbowGlow)">
    <animate attributeName="stroke" values="${rainbowCycle}" dur="3.2s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="0.35;0.9;0.35" dur="1.1s" repeatCount="indefinite"/>
  </circle>
  <circle cx="128" cy="128" r="114" fill="none" stroke="#00b0ff" stroke-width="4" opacity="0.7">
    <animate attributeName="stroke" values="${rainbowCycleOffset}" dur="3.2s" repeatCount="indefinite"/>
  </circle>`;
}

function rainbowGlowFilter() {
  return `<filter id="rainbowGlow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;
}

/** Medal face: rim only — inner decoration is provided separately. */
function medalFace({ stroke, accent, radius = 96 }) {
  const inner = Math.round(radius * 0.82);
  return `
  <g filter="url(#shadow)">
    <circle cx="128" cy="128" r="${radius}" fill="url(#g)" stroke="${stroke}" stroke-width="7"/>
    <circle cx="128" cy="128" r="${inner}" fill="none" stroke="${accent}" stroke-width="3.5" opacity="0.85"/>
  </g>`;
}

function wrapBadge(aria, defsExtra, bodyBeforeMedal, medal, overlay = '') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" role="img" aria-label="${aria}">
  <defs>
    ${defsExtra}
    ${shadowFilter()}
  </defs>
  <rect width="256" height="256" fill="none"/>
  ${bodyBeforeMedal}
  ${medal}
  ${overlay}
</svg>
`;
}

const PRO_GLOW_STOPS = [
  ['0%', '#FBBF24'],
  ['55%', '#1F2937'],
  ['100%', '#F59E0B'],
];

function glowingPro(aria, starOverlay = '') {
  const star = backingStarDefsAndMarkup('pro');
  const defs = `
    ${staticFillGradient(PRO_GLOW_STOPS)}
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    ${star.defs}
    ${innerStarMetalDef('pro')}`;
  const rings = `
  <circle cx="128" cy="128" r="118" fill="none" stroke="#F59E0B" stroke-width="6" opacity="0.35" filter="url(#glow)">
    <animate attributeName="opacity" values="0.2;0.75;0.2" dur="2.4s" repeatCount="indefinite"/>
    <animate attributeName="r" values="114;122;114" dur="2.4s" repeatCount="indefinite"/>
  </circle>
  <circle cx="128" cy="128" r="112" fill="none" stroke="#FBBF24" stroke-width="3" opacity="0.5">
    <animate attributeName="opacity" values="0.25;0.85;0.25" dur="2.4s" begin="0.3s" repeatCount="indefinite"/>
  </circle>`;
  return wrapBadge(
    aria,
    defs,
    star.markup + rings,
    medalFace({ stroke: '#F59E0B', accent: '#FBBF24', radius: 96 }),
    starOverlay
  );
}

function rainbowPro(aria, starOverlay = '') {
  const star = backingStarDefsAndMarkup('pro');
  const defs = `
    ${staticFillGradient(PRO_GLOW_STOPS)}
    ${rainbowGlowFilter()}
    ${star.defs}
    ${innerStarMetalDef('pro')}`;
  return wrapBadge(
    aria,
    defs,
    star.markup + rainbowBorderRings(),
    medalFace({ stroke: '#111827', accent: '#FBBF24', radius: 96 }),
    starOverlay
  );
}

function rgbFillPro(aria, starOverlay = '') {
  const star = backingStarDefsAndMarkup('pro');
  const defs = `
    ${rgbFillGradient('g')}
    ${star.defs}
    ${innerStarMetalDef('pro')}`;
  const medal = `
  <g filter="url(#shadow)">
    <circle cx="128" cy="128" r="96" fill="url(#g)" stroke="#111827" stroke-width="7"/>
    <circle cx="128" cy="128" r="78" fill="none" stroke="#FFFFFF" stroke-width="3" opacity="0.55">
      <animate attributeName="stroke" values="#ff6680;#66ff99;#88bbff;#ff6680" dur="2.8s" repeatCount="indefinite"/>
    </circle>
  </g>`;
  return wrapBadge(aria, defs, star.markup, medal, starOverlay);
}

/**
 * Pro-X: RGB body + rainbow border + gold X (static) + large rotating backing star.
 */
function proXBadge(aria) {
  const star = backingStarDefsAndMarkup('pro', { large: true });
  const defs = `
    ${rgbFillGradient('g')}
    <linearGradient id="xFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFF8DC"/>
      <stop offset="40%" stop-color="#FFD700"/>
      <stop offset="100%" stop-color="#8B6914"/>
    </linearGradient>
    ${rainbowGlowFilter()}
    ${star.defs}`;
  const medal = `
  <g filter="url(#shadow)">
    <circle cx="128" cy="128" r="78" fill="url(#g)" stroke="#D4AF37" stroke-width="6"/>
    <circle cx="128" cy="128" r="64" fill="none" stroke="#FFE08A" stroke-width="2.5" opacity="0.9"/>
  </g>`;
  const xMark = `
  <g>
    <rect x="112" y="78" width="32" height="100" rx="6" fill="url(#xFill)" stroke="#6B5010" stroke-width="1.5" transform="rotate(45 128 128)"/>
    <rect x="112" y="78" width="32" height="100" rx="6" fill="url(#xFill)" stroke="#6B5010" stroke-width="1.5" transform="rotate(-45 128 128)"/>
  </g>`;
  return wrapBadge(aria, defs, star.markup + rainbowBorderRings(), medal, xMark);
}

/**
 * Empty pro-star baseline: large backing star + RGB body + rainbow border, no X / inner stars.
 */
function proStarBaseline(aria) {
  const star = backingStarDefsAndMarkup('pro', { large: true });
  const defs = `
    ${rgbFillGradient('g')}
    ${rainbowGlowFilter()}
    ${star.defs}`;
  const medal = `
  <g filter="url(#shadow)">
    <circle cx="128" cy="128" r="78" fill="url(#g)" stroke="#D4AF37" stroke-width="6"/>
    <circle cx="128" cy="128" r="64" fill="none" stroke="#FFE08A" stroke-width="2.5" opacity="0.9"/>
  </g>`;
  return wrapBadge(aria, defs, star.markup + rainbowBorderRings(), medal, '');
}

function familyBadge(metalKey, aria, starCount = 0, { backingStar = true } = {}) {
  const metal = METALS[metalKey];
  const star = backingStar ? backingStarDefsAndMarkup(metalKey) : { defs: '', markup: '' };
  const defs = `
    ${staticFillGradient(metal.stops)}
    ${star.defs}
    ${innerStarMetalDef(metalKey)}`;
  return wrapBadge(
    aria,
    defs,
    star.markup,
    medalFace({ stroke: metal.stroke, accent: metal.accent, radius: 96 }),
    countStars(starCount, metalKey)
  );
}

const files = {
  'unranked.svg': familyBadge('unranked', 'UNRANKED badge', 0, { backingStar: false }),

  'bronze-i.svg': familyBadge('bronze', 'BRONZE I badge', 1),
  'bronze-ii.svg': familyBadge('bronze', 'BRONZE II badge', 2),
  'bronze-iii.svg': familyBadge('bronze', 'BRONZE III badge', 3),
  'bronze.svg': familyBadge('bronze', 'Bronze badge', 0),

  'silver-i.svg': familyBadge('silver', 'SILVER I badge', 1),
  'silver-ii.svg': familyBadge('silver', 'SILVER II badge', 2),
  'silver-iii.svg': familyBadge('silver', 'SILVER III badge', 3),
  'silver.svg': familyBadge('silver', 'Silver badge', 0),

  'gold-i.svg': familyBadge('gold', 'GOLD I badge', 1),
  'gold-ii.svg': familyBadge('gold', 'GOLD II badge', 2),
  'gold-iii.svg': familyBadge('gold', 'GOLD III badge', 3),
  'gold.svg': familyBadge('gold', 'Gold badge', 0),

  'diamond-i.svg': familyBadge('diamond', 'DIAMOND I badge', 1),
  'diamond-ii.svg': familyBadge('diamond', 'DIAMOND II badge', 2),
  'diamond-iii.svg': familyBadge('diamond', 'DIAMOND III badge', 3),
  'diamond-iv.svg': familyBadge('diamond', 'DIAMOND IV badge', 4),
  'diamond.svg': familyBadge('diamond', 'Diamond badge', 0),

  'pro-i.svg': glowingPro('PRO I badge', countStars(1, 'pro')),
  'pro-ii.svg': glowingPro('PRO II badge', countStars(2, 'pro')),
  'pro-iii.svg': glowingPro('PRO III badge', countStars(3, 'pro')),
  'pro-iv.svg': glowingPro('PRO IV badge', countStars(4, 'pro')),

  'pro-v.svg': rainbowPro('PRO V badge', proClusterStars(0, { largeOnly: true })),
  'pro-vi.svg': rainbowPro('PRO VI badge', proClusterStars(1)),
  'pro-vii.svg': rainbowPro('PRO VII badge', proClusterStars(2)),

  'pro-viii.svg': rgbFillPro('PRO VIII badge', proClusterStars(3)),
  'pro-ix.svg': rgbFillPro('PRO IX badge', proClusterStars(4)),

  'pro-x.svg': proXBadge('PRO X badge'),

  // Generic baselines: effects only, no inner symbols
  'pro-glowing.svg': glowingPro('Pro glowing badge', ''),
  'pro-rgb.svg': rgbFillPro('Pro RGB badge', ''),
  'pro-rainbow.svg': rainbowPro('Pro rainbow badge', ''),
  'pro-star.svg': proStarBaseline('Pro star badge'),
};

for (const [name, xml] of Object.entries(files)) {
  fs.writeFileSync(path.join(badgesDir, name), xml.trim() + '\n', 'utf8');
  console.log('wrote', name);
}
