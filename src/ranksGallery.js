/**
 * Feature 6 — Custom Ranks
 * Feature 10 — Ranks Gallery (column model)
 * Spec: features/feature-6-Custom-Ranks.md
 * Spec: features/feature-10-Ranks-Gallery.md
 */

const ranks = require('./ranks');
const catalog = require('./catalog');

function formatTargets(targets) {
  if (!targets || typeof targets !== 'object') return '';
  return Object.entries(targets)
    .map(([k, v]) => `${k} ${v}`)
    .join(' · ');
}

/**
 * Map loadRanks() → gallery columns (omit empty UNRANKED).
 */
function getColumns(options = {}) {
  const ranksMod = options.ranks || ranks;
  const cat = options.catalog || catalog;
  const loaded = options.tiers
    ? { ok: true, data: options.tiers }
    : ranksMod.loadRanks(options.filePath ? { filePath: options.filePath } : {});
  if (!loaded.ok) {
    return { ok: false, message: loaded.message || 'Failed to load rank data.' };
  }

  const columns = [];
  for (const tier of loaded.data || []) {
    const isUnranked = tier.name.toUpperCase() === 'UNRANKED';
    const thresholdIds = Object.keys(tier.thresholds || {});
    if (isUnranked && thresholdIds.length === 0) continue;

    const items = thresholdIds.map((exerciseId) => {
      const ex =
        typeof cat.getActiveExercise === 'function'
          ? cat.getActiveExercise(exerciseId)
          : cat.getExerciseById
            ? cat.getExerciseById(exerciseId)
            : null;
      return {
        exerciseId,
        name: ex ? ex.name : exerciseId,
        targets: tier.thresholds[exerciseId],
        targetSummary: formatTargets(tier.thresholds[exerciseId]),
      };
    });

    columns.push({
      tierName: tier.name,
      tierId: tier.tierId,
      badgePath: tier.badgePath || null,
      badgeUrl: ranksMod.resolveBadgeUrl(tier),
      order: tier.order,
      sections: [
        {
          headerPath: [],
          items,
        },
      ],
    });
  }

  return { ok: true, data: columns };
}

module.exports = {
  getColumns,
  formatTargets,
};
