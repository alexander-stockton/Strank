/**
 * Helpers for History Day "Add exercise" picker (Focus / Type / Push-Pull / Skill).
 */

const FOCUS_KEYS = ['arms', 'core', 'legs', 'lungs'];
const TYPE_KEYS = ['strength', 'endurance'];
const SUBTYPE_KEYS = ['push', 'pull'];

function normHeader(h) {
  return String(h == null ? '' : h)
    .trim()
    .toLowerCase();
}

function exerciseHeaders(ex) {
  return (ex && Array.isArray(ex.headers) ? ex.headers : []).map(normHeader);
}

function matchesFocusType(ex, focus, type) {
  const h = exerciseHeaders(ex);
  return h.includes(normHeader(focus)) && h.includes(normHeader(type));
}

/**
 * True when any exercise under focus+type sits under a PUSH or PULL header.
 */
function hasPushPullSubsections(exercises, focus, type) {
  const list = Array.isArray(exercises) ? exercises : [];
  return list.some((ex) => {
    if (!matchesFocusType(ex, focus, type)) return false;
    const h = exerciseHeaders(ex);
    return h.includes('push') || h.includes('pull');
  });
}

/**
 * Filter the live catalog by Focus → Type → optional Push/Pull.
 * @param {Array} exercises
 * @param {{ focus: string, type: string, subtype?: string|null }} sel
 */
function filterExercisesForPicker(exercises, sel) {
  const focus = normHeader(sel && sel.focus);
  const type = normHeader(sel && sel.type);
  const subtype =
    sel && sel.subtype != null && String(sel.subtype).trim()
      ? normHeader(sel.subtype)
      : null;
  const list = Array.isArray(exercises) ? exercises : [];
  return list
    .filter((ex) => {
      if (!matchesFocusType(ex, focus, type)) return false;
      if (!subtype) return true;
      return exerciseHeaders(ex).includes(subtype);
    })
    .slice()
    .sort((a, b) => String(a.name || a.exerciseId).localeCompare(String(b.name || b.exerciseId)));
}

/**
 * Placeholder metrics so history.create can insert before Edit opens.
 * reps/sets/duration require >= 1; weight/distance allow 0.
 */
function defaultMetricsForSchema(schemaKeys) {
  const keys = Array.isArray(schemaKeys) ? schemaKeys : [];
  const metrics = {};
  for (const key of keys) {
    if (key === 'weight' || key === 'distance') metrics[key] = 0;
    else metrics[key] = 1;
  }
  return metrics;
}

/**
 * Normalize picker selection after focus/type change (drop invalid subtype / skill).
 */
function normalizePickerSelection(exercises, sel) {
  const focus = FOCUS_KEYS.includes(normHeader(sel && sel.focus))
    ? normHeader(sel.focus)
    : 'arms';
  const type = TYPE_KEYS.includes(normHeader(sel && sel.type))
    ? normHeader(sel.type)
    : 'strength';
  const needsSubtype = hasPushPullSubsections(exercises, focus, type);
  let subtype = null;
  if (needsSubtype) {
    const wanted = normHeader(sel && sel.subtype);
    subtype = SUBTYPE_KEYS.includes(wanted) ? wanted : 'push';
  }
  const filtered = filterExercisesForPicker(exercises, { focus, type, subtype });
  let exerciseId = sel && sel.exerciseId ? String(sel.exerciseId) : '';
  if (exerciseId && !filtered.some((e) => e.exerciseId === exerciseId)) {
    exerciseId = '';
  }
  return { focus, type, subtype, exerciseId, needsSubtype, filtered };
}

module.exports = {
  FOCUS_KEYS,
  TYPE_KEYS,
  SUBTYPE_KEYS,
  hasPushPullSubsections,
  filterExercisesForPicker,
  defaultMetricsForSchema,
  normalizePickerSelection,
  matchesFocusType,
};
