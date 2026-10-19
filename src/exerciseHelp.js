/**
 * Shared exercise description (notes) help control.
 * Notes come from `{…}` on format.txt / ranks.txt leaves (Feature 1 FR-005).
 */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeDescription(notes) {
  if (notes == null) return null;
  const text = String(notes).trim();
  if (!text) return null;
  // Ignore format.txt placeholder tokens like {(description)} / {description}
  if (/^\(?description\)?$/i.test(text)) return null;
  return text;
}

function hasDescription(notes) {
  return normalizeDescription(notes) != null;
}

/**
 * Resolve description for an exercise id from the active catalog.
 */
function descriptionForExercise(exerciseId, catalogMod) {
  if (!exerciseId || !catalogMod) return null;
  const ex =
    typeof catalogMod.getActiveExercise === 'function'
      ? catalogMod.getActiveExercise(exerciseId)
      : typeof catalogMod.getExerciseById === 'function'
        ? catalogMod.getExerciseById(exerciseId)
        : null;
  return normalizeDescription(ex && ex.notes);
}

/**
 * Circled-? control; description appears on hover (and keyboard focus).
 * Returns empty string when there is no description.
 */
function renderExerciseHelp(notes, options = {}) {
  const text = normalizeDescription(notes);
  if (!text) return '';
  const tipId = options.id
    ? `exercise-help-${escapeHtml(String(options.id))}`
    : `exercise-help-${Math.random().toString(36).slice(2, 9)}`;
  return `<span class="exercise-help" data-exercise-help>
    <button type="button" class="exercise-help-btn" aria-label="Exercise description" aria-describedby="${tipId}">?</button>
    <span class="exercise-help-tip" role="tooltip" id="${tipId}" data-exercise-help-tip>${escapeHtml(text)}</span>
  </span>`;
}

module.exports = {
  escapeHtml,
  normalizeDescription,
  hasDescription,
  descriptionForExercise,
  renderExerciseHelp,
};
