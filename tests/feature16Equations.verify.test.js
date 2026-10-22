/**
 * Feature 16 - Localization & Language Support
 * Spec: features/feature-16-Localization.md
 *
 * Spec-math verification (FR-023 / FR-024 / FR-025).
 * These tests encode the feature-doc equations so release math cannot drift silently.
 */

'use strict';

/** Normative stride model from FR-023 */
function strideInchesFemale(heightFt) {
  return 4.92 * heightFt;
}
function strideInchesMale(heightFt) {
  return 4.98 * heightFt;
}
function strideInchesFemaleFromIn(heightIn) {
  return 0.41 * heightIn;
}
function strideInchesMaleFromIn(heightIn) {
  return 0.415 * heightIn;
}

/** Exact SI / imperial distance factors (FR-024), as meters per unit */
const M_PER = {
  m: 1,
  km: 1000,
  in: 0.0254,
  ft: 0.3048,
  yd: 0.9144,
  mi: 1609.344,
};

function toMeters(value, unit) {
  if (unit === 'steps') throw new Error('steps needs stride');
  const f = M_PER[unit];
  if (f == null) throw new Error(`unknown distance unit ${unit}`);
  return value * f;
}

function fromMeters(meters, unit) {
  if (unit === 'steps') throw new Error('steps needs stride');
  const f = M_PER[unit];
  if (f == null) throw new Error(`unknown distance unit ${unit}`);
  return meters / f;
}

function convertDistance(value, from, to) {
  return fromMeters(toMeters(value, from), to);
}

function stepsFromLinearInches(dIn, strideIn) {
  return dIn / strideIn;
}
function linearInchesFromSteps(nSteps, strideIn) {
  return nSteps * strideIn;
}

/** Exact avoirdupois definitions (FR-025) */
const KG_PER_LB = 0.45359237; // exact by international agreement
const LB_PER_KG = 1 / KG_PER_LB;
const LB_PER_ST = 14; // exact by FR-025 / British stone

function toPounds(value, unit) {
  if (unit === 'lbs' || unit === 'lb') return value;
  if (unit === 'st') return value * LB_PER_ST;
  if (unit === 'kg' || unit === 'kgs') return value * LB_PER_KG;
  throw new Error(`unknown weight unit ${unit}`);
}

function fromPounds(pounds, unit) {
  if (unit === 'lbs' || unit === 'lb') return pounds;
  if (unit === 'st') return pounds / LB_PER_ST;
  if (unit === 'kg' || unit === 'kgs') return pounds * KG_PER_LB;
  throw new Error(`unknown weight unit ${unit}`);
}

function convertWeight(value, from, to) {
  return fromPounds(toPounds(value, from), to);
}

const DISTANCE_UNITS = ['mi', 'km', 'm', 'yd', 'ft', 'in'];
const WEIGHT_UNITS = ['lbs', 'kg', 'st'];

describe('Feature 16 FR-023 stride model', () => {
  const femaleRefs = [
    [4, 19.68],
    [5, 24.6],
    [6, 29.5], // approximate product input; equation -> 29.52
  ];
  const maleRefs = [
    [4, 19.92],
    [5, 24.9],
    [6, 29.9], // approximate product input; equation -> 29.88
  ];

  test('female feet-form matches 4 ft and 5 ft exactly', () => {
    expect(strideInchesFemale(4)).toBeCloseTo(19.68, 12);
    expect(strideInchesFemale(5)).toBeCloseTo(24.6, 12);
  });

  test('male feet-form matches 4 ft and 5 ft exactly', () => {
    expect(strideInchesMale(4)).toBeCloseTo(19.92, 12);
    expect(strideInchesMale(5)).toBeCloseTo(24.9, 12);
  });

  test('6 ft references match equations within product tolerance', () => {
    // Doc checks: 4.92×6=29.52≈29.5 ; 4.98×6=29.88≈29.9
    expect(strideInchesFemale(6)).toBeCloseTo(29.52, 12);
    expect(Math.abs(strideInchesFemale(6) - 29.5)).toBeLessThan(0.05);
    expect(strideInchesMale(6)).toBeCloseTo(29.88, 12);
    expect(Math.abs(strideInchesMale(6) - 29.9)).toBeLessThan(0.05);
  });

  test('doc Checks arithmetic matches normative table', () => {
    expect(4.92 * 4).toBeCloseTo(19.68, 12);
    expect(4.92 * 5).toBeCloseTo(24.6, 12);
    expect(4.92 * 6).toBeCloseTo(29.52, 12);
    expect(4.98 * 4).toBeCloseTo(19.92, 12);
    expect(4.98 * 5).toBeCloseTo(24.9, 12);
    expect(4.98 * 6).toBeCloseTo(29.88, 12);
  });

  test('inch-form coefficients: female 0.41 exact; male use 4.98/12 not literal 0.415', () => {
    expect(4.92 / 12).toBe(0.41);
    // IEEE: 4.98/12 is NOT Object.is-equal to the literal 0.415
    expect(4.98 / 12).not.toBe(0.415);
    expect(4.98 / 12).toBeCloseTo(0.415, 12);
  });

  test('normative inch-form (coeff/12) matches feet-form bit-for-bit via close', () => {
    for (let ft = 3; ft <= 7; ft += 0.05) {
      const hin = ft * 12;
      expect((4.92 / 12) * hin).toBeCloseTo(strideInchesFemale(ft), 12);
      expect((4.98 / 12) * hin).toBeCloseTo(strideInchesMale(ft), 12);
    }
  });

  test('literal 0.415 inch-form drifts from feet-form (doc warning)', () => {
    // Proves why FR-023 forbids hardcoding 0.415 as an independent constant.
    let drifted = 0;
    for (let ft = 3; ft <= 7; ft += 0.05) {
      if (0.415 * ft * 12 !== 4.98 * ft) drifted += 1;
    }
    expect(drifted).toBeGreaterThan(0);
    // Magnitude stays negligible for product display
    expect(Math.abs(0.415 * 60 - 4.98 * 5)).toBeLessThan(1e-12);
  });

  test('inch-form helpers agree with feet-form within epsilon', () => {
    for (let ft = 3; ft <= 7; ft += 0.05) {
      const hin = ft * 12;
      expect(strideInchesFemaleFromIn(hin)).toBeCloseTo(strideInchesFemale(ft), 12);
      expect(strideInchesMaleFromIn(hin)).toBeCloseTo(strideInchesMale(ft), 10);
    }
  });

  test('reference table is linear in height for 4->5 ft slopes', () => {
    const fSlope = (24.6 - 19.68) / (5 - 4);
    const mSlope = (24.9 - 19.92) / (5 - 4);
    expect(fSlope).toBeCloseTo(4.92, 12);
    expect(mSlope).toBeCloseTo(4.98, 12);
  });

  test('6 ft product approximates are NOT exact on the 4->5 line (doc must keep ≈)', () => {
    // If someone "corrected" the table to force exact 29.5/29.9 into the equation,
    // slopes would conflict. Equations stay normative.
    expect((29.5 - 24.6) / 1).not.toBeCloseTo(4.92, 5);
    expect((29.9 - 24.9) / 1).not.toBeCloseTo(4.98, 5);
  });

  test.each(femaleRefs)('female ref height %d listed in doc', (h, listed) => {
    expect(listed).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
  });

  test.each(maleRefs)('male ref height %d listed in doc', (h, listed) => {
    expect(listed).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
  });

  test('steps ↔ inches round-trip', () => {
    const s = strideInchesMale(5); // ~24.9
    expect(s).toBeCloseTo(24.9, 12);
    const steps = stepsFromLinearInches(12, s); // 1 ft
    expect(steps).toBeCloseTo(12 / s, 12);
    expect(linearInchesFromSteps(steps, s)).toBeCloseTo(12, 12);
  });

  test('US-16.6 scenario: 1 ft male 5ft -> steps -> ft', () => {
    const stride = strideInchesMale(5);
    const steps = 12 / stride;
    expect(steps).toBeCloseTo(12 / 24.9, 12);
    const backFt = (steps * stride) / 12;
    expect(backFt).toBeCloseTo(1, 12);
  });
});

describe('Feature 16 FR-024 distance constants', () => {
  test('international definitions match doc', () => {
    expect(M_PER.mi).toBe(1609.344);
    expect(M_PER.yd).toBe(0.9144);
    expect(M_PER.ft).toBe(0.3048);
    expect(M_PER.in).toBe(0.0254);
    expect(M_PER.km).toBe(1000);
    expect(M_PER.m).toBe(1);
  });

  test('derived imperial helpers match meter factors (float-safe)', () => {
    expect(M_PER.mi / M_PER.ft).toBeCloseTo(5280, 12);
    expect(M_PER.mi / M_PER.yd).toBeCloseTo(1760, 12);
    expect(M_PER.yd / M_PER.ft).toBeCloseTo(3, 12);
    expect(M_PER.yd / M_PER.in).toBeCloseTo(36, 12);
    expect(M_PER.ft / M_PER.in).toBeCloseTo(12, 12);
    expect(M_PER.mi / M_PER.in).toBeCloseTo(63360, 10);
  });

  test('meter chain is consistent with foot definition', () => {
    expect(0.3048 * 5280).toBeCloseTo(1609.344, 12);
    expect(0.9144 * 1760).toBeCloseTo(1609.344, 12);
    expect(0.0254 * 12).toBeCloseTo(0.3048, 12);
    expect(0.0254 * 36).toBeCloseTo(0.9144, 12);
  });

  test.each(DISTANCE_UNITS)('identity convert %s -> %s', (u) => {
    expect(convertDistance(7.5, u, u)).toBeCloseTo(7.5, 12);
  });

  test('zero stays zero across all distance units', () => {
    for (const from of DISTANCE_UNITS) {
      for (const to of DISTANCE_UNITS) {
        expect(convertDistance(0, from, to)).toBe(0);
      }
    }
  });

  test('all distance unit pairs round-trip within tight epsilon', () => {
    const samples = [0.001, 0.25, 1, 3.1415926535, 10, 100, 42195]; // includes marathon meters
    for (const from of DISTANCE_UNITS) {
      for (const to of DISTANCE_UNITS) {
        for (const v of samples) {
          const mid = convertDistance(v, from, to);
          const back = convertDistance(mid, to, from);
          expect(Math.abs(back - v)).toBeLessThan(1e-9 * Math.max(1, Math.abs(v)));
        }
      }
    }
  });

  test('known landmarks', () => {
    expect(convertDistance(1, 'mi', 'ft')).toBeCloseTo(5280, 12);
    expect(convertDistance(1, 'mi', 'yd')).toBeCloseTo(1760, 12);
    expect(convertDistance(1, 'mi', 'km')).toBeCloseTo(1.609344, 12);
    expect(convertDistance(1, 'km', 'm')).toBe(1000);
    expect(convertDistance(3, 'ft', 'yd')).toBeCloseTo(1, 12);
    expect(convertDistance(1, 'ft', 'in')).toBeCloseTo(12, 12);
    expect(convertDistance(100, 'm', 'ft')).toBeCloseTo(100 / 0.3048, 10);
  });

  test('steps via inches then FR-024: 1 mi male 6ft', () => {
    const stride = strideInchesMale(6); // 29.88
    const inchesInMile = convertDistance(1, 'mi', 'in');
    expect(inchesInMile).toBeCloseTo(63360, 10);
    const steps = inchesInMile / stride;
    expect(steps).toBeCloseTo(63360 / stride, 10);
    const backMi = convertDistance(steps * stride, 'in', 'mi');
    expect(backMi).toBeCloseTo(1, 12);
  });
});

describe('Feature 16 FR-025 weight constants', () => {
  test('1 stone is exactly 14 pounds', () => {
    expect(LB_PER_ST).toBe(14);
    expect(convertWeight(1, 'st', 'lbs')).toBe(14);
    expect(convertWeight(14, 'lbs', 'st')).toBe(1);
  });

  test('international avoirdupois pound is exact kg definition', () => {
    expect(KG_PER_LB).toBe(0.45359237);
    expect(convertWeight(1, 'lbs', 'kg')).toBe(0.45359237);
  });

  test('doc stone↔kg value is exact for the stated product', () => {
    expect(14 * 0.45359237).toBeCloseTo(6.35029318, 12);
    expect(convertWeight(1, 'st', 'kg')).toBeCloseTo(6.35029318, 12);
  });

  test('kg->lb must be derived as 1/0.45359237 (not truncated 2.2046226218)', () => {
    const truncated = 2.2046226218;
    const exact = 1 / 0.45359237;
    expect(exact).toBeCloseTo(2.2046226218487757, 12);
    expect(Math.abs(truncated - exact)).toBeGreaterThan(0);
    expect(Math.abs(truncated - exact)).toBeLessThan(1e-10);
    expect(convertWeight(1, 'kg', 'lbs')).toBe(exact);
    // Using truncated constant as a second hardcoded source would drift:
    expect(1 * truncated * KG_PER_LB).not.toBe(1);
    expect(1 * exact * KG_PER_LB).toBeCloseTo(1, 15);
  });

  test('kg->st must be derived as 1/(14*0.45359237)', () => {
    const viaExact = 1 / (14 * KG_PER_LB);
    const truncatedProse = 0.1574730444;
    expect(convertWeight(1, 'kg', 'st')).toBeCloseTo(viaExact, 15);
    expect(Math.abs(convertWeight(1, 'kg', 'st') - truncatedProse)).toBeLessThan(1e-10);
  });

  test('US-16.6 scenario: 14 lbs -> 1 stone', () => {
    expect(convertWeight(14, 'lbs', 'st')).toBe(1);
  });

  test.each(WEIGHT_UNITS)('identity convert %s -> %s', (u) => {
    expect(convertWeight(11, u, u)).toBeCloseTo(11, 12);
  });

  test('zero stays zero across all weight units', () => {
    for (const from of WEIGHT_UNITS) {
      for (const to of WEIGHT_UNITS) {
        expect(convertWeight(0, from, to)).toBe(0);
      }
    }
  });

  test('all weight unit pairs round-trip within tight epsilon', () => {
    const samples = [0.001, 0.5, 1, 14, 70, 100, 220.46226218];
    for (const from of WEIGHT_UNITS) {
      for (const to of WEIGHT_UNITS) {
        for (const v of samples) {
          const mid = convertWeight(v, from, to);
          const back = convertWeight(mid, to, from);
          expect(Math.abs(back - v)).toBeLessThan(1e-9 * Math.max(1, Math.abs(v)));
        }
      }
    }
  });

  test('cycle lbs -> kg -> st -> lbs', () => {
    const start = 154;
    const a = convertWeight(start, 'lbs', 'kg');
    const b = convertWeight(a, 'kg', 'st');
    const c = convertWeight(b, 'st', 'lbs');
    expect(c).toBeCloseTo(start, 10);
  });
});

describe('Feature 16 convert-on-change composition', () => {
  test('distance convert then steps then back (female 5 ft)', () => {
    const stride = strideInchesFemale(5); // 24.6
    const km = 5;
    const inches = convertDistance(km, 'km', 'in');
    const steps = inches / stride;
    const backIn = steps * stride;
    const backKm = convertDistance(backIn, 'in', 'km');
    expect(backKm).toBeCloseTo(km, 12);
  });

  test('stress: 5000 distance round-trips across all pairs', () => {
    for (let i = 0; i < 5000; i++) {
      const from = DISTANCE_UNITS[i % DISTANCE_UNITS.length];
      const to = DISTANCE_UNITS[(i * 3 + 1) % DISTANCE_UNITS.length];
      const v = (i + 1) * Math.PI * 0.017;
      const back = convertDistance(convertDistance(v, from, to), to, from);
      expect(Math.abs(back - v)).toBeLessThan(1e-9 * Math.max(1, Math.abs(v)));
    }
  });

  test('stress: 5000 weight round-trips across all pairs', () => {
    for (let i = 0; i < 5000; i++) {
      const from = WEIGHT_UNITS[i % WEIGHT_UNITS.length];
      const to = WEIGHT_UNITS[(i * 2 + 1) % WEIGHT_UNITS.length];
      const v = (i + 1) * 0.37;
      const back = convertWeight(convertWeight(v, from, to), to, from);
      expect(Math.abs(back - v)).toBeLessThan(1e-9 * Math.max(1, Math.abs(v)));
    }
  });

  test('stress: steps conversions at many heights/sexes', () => {
    const sexes = [
      ['female', strideInchesFemale],
      ['male', strideInchesMale],
    ];
    for (const [, fn] of sexes) {
      for (let h = 4; h <= 6.5; h += 0.1) {
        const stride = fn(h);
        expect(stride).toBeGreaterThan(0);
        for (const unit of ['mi', 'km', 'm', 'yd', 'ft']) {
          const v = 2.5;
          const inches = convertDistance(v, unit, 'in');
          const steps = inches / stride;
          const back = convertDistance(steps * stride, 'in', unit);
          expect(Math.abs(back - v)).toBeLessThan(1e-9 * Math.max(1, Math.abs(v)));
        }
      }
    }
  });

  test('stress: three-hop unit cycles A->B->C->A', () => {
    const hops = [
      ['mi', 'km', 'ft'],
      ['yd', 'm', 'in'],
      ['km', 'yd', 'mi'],
      ['lbs', 'kg', 'st'],
      ['st', 'lbs', 'kg'],
      ['kg', 'st', 'lbs'],
    ];
    for (const [a, b, c] of hops) {
      const isWeight = WEIGHT_UNITS.includes(a);
      const convert = isWeight ? convertWeight : convertDistance;
      for (let i = 1; i <= 200; i++) {
        const v = i * 1.2345;
        const x = convert(v, a, b);
        const y = convert(x, b, c);
        const z = convert(y, c, a);
        expect(Math.abs(z - v)).toBeLessThan(1e-9 * Math.max(1, Math.abs(v)));
      }
    }
  });

  test('stress: convert-on-change A->B->A for every distance and weight pair', () => {
    for (const from of DISTANCE_UNITS) {
      for (const to of DISTANCE_UNITS) {
        if (from === to) continue;
        const v = 12.3456789;
        const mid = convertDistance(v, from, to);
        const back = convertDistance(mid, to, from);
        expect(Math.abs(back - v)).toBeLessThan(1e-9 * Math.max(1, Math.abs(v)));
      }
    }
    for (const from of WEIGHT_UNITS) {
      for (const to of WEIGHT_UNITS) {
        if (from === to) continue;
        const v = 98.7654321;
        const mid = convertWeight(v, from, to);
        const back = convertWeight(mid, to, from);
        expect(Math.abs(back - v)).toBeLessThan(1e-9 * Math.max(1, Math.abs(v)));
      }
    }
  });
});
