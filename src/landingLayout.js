/**
 * Feature 14 — Landing component order (fixed default; no runtime rearrange UI).
 * Spec: features/feature-14-Landing-Layout-Day-Focus.md
 */

const landingConfig = require('./landingConfig');

const DEFAULT_ORDER = ['today-expectations', 'next-rank', 'skill-progress'];
const VALID_IDS = new Set([
  'today-expectations',
  'next-rank',
  'skill-progress',
  'get-started',
]);

function defaultOrder() {
  return [...DEFAULT_ORDER];
}

function parseOrder(raw) {
  const parts = String(raw == null ? '' : raw)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const id of parts) {
    if (!VALID_IDS.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of DEFAULT_ORDER) {
    if (!seen.has(id)) {
      out.push(id);
      seen.add(id);
    }
  }
  return out.length ? out : defaultOrder();
}

function get() {
  landingConfig.load();
  const s = landingConfig.get();
  const order = parseOrder(s['landing component order']);
  const isDefault =
    order.length === DEFAULT_ORDER.length && order.every((id, i) => id === DEFAULT_ORDER[i]);
  return { order, mode: isDefault ? 'default' : 'custom' };
}

function set(order, options = {}) {
  const next = parseOrder(Array.isArray(order) ? order.join(',') : order);
  const isDefault =
    next.length === DEFAULT_ORDER.length && next.every((id, i) => id === DEFAULT_ORDER[i]);
  landingConfig.update(
    {
      'landing component order': next.join(','),
      'landing layout mode': isDefault ? 'default' : 'custom',
    },
    options
  );
  return { ok: true, data: get() };
}

function reset(options = {}) {
  landingConfig.update(
    {
      'landing component order': DEFAULT_ORDER.join(','),
      'landing layout mode': 'default',
    },
    options
  );
  return { ok: true, data: get() };
}

module.exports = {
  get,
  set,
  reset,
  defaultOrder,
  parseOrder,
  DEFAULT_ORDER,
  VALID_IDS,
};
