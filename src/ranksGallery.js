/**
 * Feature 6 — Custom Ranks
 * Feature 10 — Ranks Gallery
 * Spec: features/feature-6-Custom-Ranks.md
 * Spec: features/feature-10-Ranks-Gallery.md
 */

const ranks = require('./ranks');
const landing = require('./landing');

function groupIntoSections(expectations) {
  const sections = [];
  const map = new Map();
  for (const row of expectations) {
    const headerPath = Array.isArray(row.headers) ? [...row.headers] : [];
    const key = headerPath.join('>') || 'General';
    if (!map.has(key)) {
      const section = { headerPath, items: [] };
      map.set(key, section);
      sections.push(section);
    }
    map.get(key).items.push({
      exerciseId: row.exerciseId,
      name: row.name || row.exerciseId,
      targets: { ...(row.targets || {}) },
      notes: row.notes != null ? row.notes : null,
    });
  }
  return sections;
}

/**
 * Map tier objects → gallery columns (FR-002–FR-005).
 * Omits UNRANKED. Order = file order (tier.order).
 */
function columnsFromTiers(tiers) {
  const list = (tiers || [])
    .filter((t) => String(t.name || '').toUpperCase() !== 'UNRANKED')
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return list.map((tier) => {
    const expectations = landing.tierExpectations(tier);
    const sections = groupIntoSections(expectations);
    return {
      tierName: tier.name,
      badgePath: tier.badgePath || null,
      badgeUrl: landing.resolveBadgeUrl(tier),
      sections,
    };
  });
}

/**
 * Map loadRanks() → gallery columns (FR-002–FR-005).
 */
function getColumns() {
  const loaded = ranks.loadRanks();
  if (!loaded.ok) return loaded;
  return { ok: true, data: columnsFromTiers(loaded.data) };
}

module.exports = {
  getColumns,
  columnsFromTiers,
  groupIntoSections,
};
