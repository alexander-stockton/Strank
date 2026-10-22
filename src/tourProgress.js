/**
 * Feature 18 - Tour progress persistence
 * Spec: features/feature-18-Tour.md
 */

const config = require('./config');

const COMPLETED_KEY = 'tour completed';
const STORED_STEP_KEY = 'tour stored step id';

function read() {
  const s = config.get();
  const completed = s[COMPLETED_KEY] === true || s[COMPLETED_KEY] === 'true';
  const raw = s[STORED_STEP_KEY];
  const storedStepId =
    raw == null || raw === false || String(raw).trim() === '' || String(raw).trim() === 'false'
      ? null
      : String(raw).trim();
  return { completed, storedStepId };
}

function write(patch) {
  const cur = read();
  const next = {
    completed: patch.completed != null ? Boolean(patch.completed) : cur.completed,
    storedStepId:
      patch.storedStepId !== undefined
        ? patch.storedStepId == null || patch.storedStepId === ''
          ? null
          : String(patch.storedStepId)
        : cur.storedStepId,
  };
  return config.update({
    [COMPLETED_KEY]: next.completed,
    [STORED_STEP_KEY]: next.storedStepId == null ? '' : next.storedStepId,
  });
}

function markCompleted() {
  return write({ completed: true, storedStepId: null });
}

function storeStep(stepId) {
  return write({ completed: false, storedStepId: stepId });
}

function clearStoredStep() {
  return write({ storedStepId: null });
}

function hasStoredStep() {
  const { storedStepId, completed } = read();
  return !completed && storedStepId != null;
}

module.exports = {
  COMPLETED_KEY,
  STORED_STEP_KEY,
  read,
  write,
  markCompleted,
  storeStep,
  clearStoredStep,
  hasStoredStep,
};
