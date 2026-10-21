/**
 * File-token aliases so localized ranks.txt / format.txt headers still parse.
 * Parser keys stay English; these maps only recognize shipped (and equivalent) labels.
 */

function fold(value) {
  return String(value || '')
    .trim()
    .normalize('NFKC')
    .toLowerCase();
}

const UNRANKED_NAMES = new Set(
  [
    'UNRANKED',
    'SIN RANGO',
    'NON CLASSÉ',
    'OHNE RANG',
    'SEM CLASSIFICAÇÃO',
    'БЕЗ РАНГА',
    'ランクなし',
    'بلا رتبة',
    '未定级',
    'बिना रैंक',
  ].map(fold)
);

const GROUP_ALIASES = {
  arms: 'arms',
  arm: 'arms',
  brazos: 'arms',
  bras: 'arms',
  arme: 'arms',
  braços: 'arms',
  руки: 'arms',
  腕: 'arms',
  الذراعان: 'arms',
  手臂: 'arms',
  भुजाएँ: 'arms',
  core: 'core',
  tronco: 'core',
  tronc: 'core',
  rumpf: 'core',
  корпус: 'core',
  体幹: 'core',
  الجذع: 'core',
  核心: 'core',
  कोर: 'core',
  lungs: 'lungs',
  lung: 'lungs',
  pulmones: 'lungs',
  poumons: 'lungs',
  lungen: 'lungs',
  pulmões: 'lungs',
  лёгкие: 'lungs',
  легкие: 'lungs',
  肺: 'lungs',
  الرئتان: 'lungs',
  心肺: 'lungs',
  फेफड़े: 'lungs',
  legs: 'legs',
  leg: 'legs',
  piernas: 'legs',
  jambes: 'legs',
  beine: 'legs',
  pernas: 'legs',
  ноги: 'legs',
  脚: 'legs',
  الساقان: 'legs',
  腿部: 'legs',
  पैर: 'legs',
};

const QUALITY_ALIASES = {
  strength: 'strength',
  fuerza: 'strength',
  force: 'strength',
  kraft: 'strength',
  força: 'strength',
  сила: 'strength',
  筋力: 'strength',
  القوة: 'strength',
  力量: 'strength',
  शक्ति: 'strength',
  endurance: 'endurance',
  resistencia: 'endurance',
  ausdauer: 'endurance',
  resistência: 'endurance',
  выносливость: 'endurance',
  持久力: 'endurance',
  التحمل: 'endurance',
  耐力: 'endurance',
  सहनशक्ति: 'endurance',
};

const PUSH_PULL_ALIASES = {
  push: 'push',
  empuje: 'push',
  poussée: 'push',
  drücken: 'push',
  empurrar: 'push',
  жим: 'push',
  プッシュ: 'push',
  الدفع: 'push',
  推: 'push',
  पुश: 'push',
  pull: 'pull',
  tracción: 'pull',
  tirage: 'pull',
  ziehen: 'pull',
  puxar: 'pull',
  тяга: 'pull',
  プル: 'pull',
  السحب: 'pull',
  拉: 'pull',
  पुल: 'pull',
};

function aliasMap(entries) {
  const out = {};
  for (const [key, value] of Object.entries(entries)) {
    out[fold(key)] = value;
  }
  return out;
}

const GROUP_LOOKUP = aliasMap(GROUP_ALIASES);
const QUALITY_LOOKUP = aliasMap(QUALITY_ALIASES);
const PUSH_PULL_LOOKUP = aliasMap(PUSH_PULL_ALIASES);

function isUnrankedName(name) {
  return UNRANKED_NAMES.has(fold(name));
}

function unrankedDisplayName(tiers) {
  const found = (tiers || []).find((t) => isUnrankedName(t && t.name));
  return found && found.name ? found.name : 'UNRANKED';
}

function muscleGroupFromHeader(header) {
  return GROUP_LOOKUP[fold(header)] || null;
}

function qualityFromHeader(header) {
  return QUALITY_LOOKUP[fold(header)] || null;
}

function qualityFromHeaders(headers) {
  for (const header of headers || []) {
    const quality = qualityFromHeader(header);
    if (quality) return quality;
  }
  return 'other';
}

function sectionHeaderDepth(name) {
  const key = fold(name);
  if (GROUP_LOOKUP[key]) return 0;
  if (QUALITY_LOOKUP[key]) return 1;
  if (PUSH_PULL_LOOKUP[key]) return 2;
  return null;
}

module.exports = {
  fold,
  isUnrankedName,
  unrankedDisplayName,
  muscleGroupFromHeader,
  qualityFromHeader,
  qualityFromHeaders,
  sectionHeaderDepth,
  GROUP_ALIASES: GROUP_LOOKUP,
  QUALITY_ALIASES: QUALITY_LOOKUP,
};
