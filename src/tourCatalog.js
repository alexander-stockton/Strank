/**
 * Feature 18 - Tour step catalog
 * Spec: features/feature-18-Tour.md (FR-010–FR-014)
 *
 * Privacy steps are intentionally omitted. Contributing is one FAB-only step.
 *
 * spotlight: 'circle' | 'rect' | 'none'
 *   - circle/rect: hole fitted to the target (or union of targets)
 *   - none: full dim, no hole; target is only used to place the coach card
 */

/** @typedef {'circle' | 'rect' | 'none'} TourSpotlightShape */
/**
 * @typedef {{
 *   id: string,
 *   family: string,
 *   hash: string,
 *   target?: string,
 *   bodyKey: string,
 *   titleKey?: string,
 *   spotlight: TourSpotlightShape,
 *   targetUnion?: boolean,
 *   prepare?: { historyZoom?: 'month' | 'day' | 'years', configSection?: string },
 *   fallbackHash?: string,
 *   fallbackTarget?: string,
 * }} TourStep
 */

/** Week Rank column: heading + badge cells (History month). */
const HISTORY_RANK_COLUMN = '[data-cal-rank-heading], [data-cal-rank-cell]';

/** @type {TourStep[]} */
const STEPS = [
  // Landing (several)
  {
    id: 'landing-badge',
    family: 'landing',
    hash: '#/',
    target: '[data-header-rank-badge], .shell-header-badge',
    spotlight: 'circle',
    titleKey: 'tour.step.landingBadge.title',
    bodyKey: 'tour.step.landingBadge.body',
  },
  {
    id: 'landing-today',
    family: 'landing',
    hash: '#/',
    target: '[data-landing-card="today-expectations"]',
    spotlight: 'rect',
    titleKey: 'tour.step.landingToday.title',
    bodyKey: 'tour.step.landingToday.body',
  },
  {
    id: 'landing-next',
    family: 'landing',
    hash: '#/',
    target: '[data-landing-card="next-rank"]',
    spotlight: 'rect',
    titleKey: 'tour.step.landingNext.title',
    bodyKey: 'tour.step.landingNext.body',
  },
  {
    id: 'landing-get-started',
    family: 'landing',
    hash: '#/',
    target: '[data-action="get-started"], .landing-today-corner',
    spotlight: 'rect',
    titleKey: 'tour.step.landingGetStarted.title',
    bodyKey: 'tour.step.landingGetStarted.body',
  },
  {
    id: 'landing-skills',
    family: 'landing',
    hash: '#/',
    target: '[data-landing-card="skill-progress"], [data-skill-progress]',
    spotlight: 'rect',
    titleKey: 'tour.step.landingSkills.title',
    bodyKey: 'tour.step.landingSkills.body',
  },
  {
    id: 'landing-day-focus',
    family: 'landing',
    hash: '#/',
    target: '[data-action="toggle-day-focus-menu"]',
    spotlight: 'rect',
    titleKey: 'tour.step.landingDayFocus.title',
    bodyKey: 'tour.step.landingDayFocus.body',
  },
  // Navbar
  {
    id: 'navbar-tabs',
    family: 'navbar',
    hash: '#/',
    target: '.app-navbar',
    spotlight: 'rect',
    titleKey: 'tour.step.navbar.title',
    bodyKey: 'tour.step.navbar.body',
  },
  // Get Started notice (explain without requiring live overlay)
  {
    id: 'workout-start-notice',
    family: 'workout-start',
    hash: '#/',
    target: '[data-action="get-started"], .landing-today-corner',
    spotlight: 'rect',
    titleKey: 'tour.step.workoutStart.title',
    bodyKey: 'tour.step.workoutStart.body',
  },
  // Active Workout — navigate to workout only if draft exists; else explain from landing CTA
  {
    id: 'workout-checklist',
    family: 'workout',
    hash: '#/workout',
    target: '[data-workout-checklist], [data-view="activeWorkout"]',
    spotlight: 'rect',
    titleKey: 'tour.step.workoutChecklist.title',
    bodyKey: 'tour.step.workoutChecklist.body',
    fallbackHash: '#/',
    fallbackTarget: '[data-action="get-started"], .landing-today-corner',
  },
  {
    id: 'workout-timer',
    family: 'workout',
    hash: '#/workout',
    target: '[data-workout-timer], .workout-footer',
    spotlight: 'rect',
    titleKey: 'tour.step.workoutTimer.title',
    bodyKey: 'tour.step.workoutTimer.body',
    fallbackHash: '#/',
    fallbackTarget: '[data-action="get-started"], .landing-today-corner',
  },
  {
    id: 'workout-complete',
    family: 'workout',
    hash: '#/workout',
    target: '[data-action="complete"], .workout-actions',
    spotlight: 'rect',
    titleKey: 'tour.step.workoutComplete.title',
    bodyKey: 'tour.step.workoutComplete.body',
    fallbackHash: '#/',
    fallbackTarget: '[data-action="get-started"], .landing-today-corner',
  },
  // History month
  {
    id: 'history-calendar',
    family: 'history',
    hash: '#/history',
    target: '[data-view="workoutHistory"] .cal-grid, [data-view="workoutHistory"], .history-calendar',
    spotlight: 'rect',
    prepare: { historyZoom: 'month' },
    titleKey: 'tour.step.historyCalendar.title',
    bodyKey: 'tour.step.historyCalendar.body',
  },
  {
    id: 'history-week-badges',
    family: 'history',
    hash: '#/history',
    target: HISTORY_RANK_COLUMN,
    targetUnion: true,
    spotlight: 'rect',
    prepare: { historyZoom: 'month' },
    titleKey: 'tour.step.historyWeekBadges.title',
    bodyKey: 'tour.step.historyWeekBadges.body',
  },
  {
    id: 'history-month-progression',
    family: 'history',
    hash: '#/history',
    target: '[data-month-progression]',
    spotlight: 'rect',
    prepare: { historyZoom: 'month' },
    titleKey: 'tour.step.historyMonthProgression.title',
    bodyKey: 'tour.step.historyMonthProgression.body',
  },
  {
    id: 'history-weekly-avg-1',
    family: 'history',
    hash: '#/history',
    target: '[data-tour-week-sample], .cal-week',
    spotlight: 'rect',
    prepare: { historyZoom: 'month' },
    titleKey: 'tour.step.historyWeeklyAvg1.title',
    bodyKey: 'tour.step.historyWeeklyAvg1.body',
  },
  {
    id: 'history-weekly-avg-2',
    family: 'history',
    hash: '#/history',
    target: '[data-tour-week-sample], .cal-week',
    spotlight: 'none',
    prepare: { historyZoom: 'month' },
    titleKey: 'tour.step.historyWeeklyAvg2.title',
    bodyKey: 'tour.step.historyWeeklyAvg2.body',
  },
  // History day detail (open day zoom so the real screen is shown)
  {
    id: 'history-day',
    family: 'history-day',
    hash: '#/history',
    target: '[data-view="historyDay"]',
    spotlight: 'rect',
    prepare: { historyZoom: 'day' },
    titleKey: 'tour.step.historyDay.title',
    bodyKey: 'tour.step.historyDay.body',
  },
  // Years entry is the year button on the month header
  {
    id: 'history-year',
    family: 'history-year',
    hash: '#/history',
    target: '[data-action="zoom-year"]',
    spotlight: 'rect',
    prepare: { historyZoom: 'month' },
    titleKey: 'tour.step.historyYear.title',
    bodyKey: 'tour.step.historyYear.body',
  },
  // Ranks gallery
  {
    id: 'ranks-gallery',
    family: 'ranks',
    hash: '#/ranks',
    target: '[data-view="ranks-gallery"], .ranks-gallery-view, .ranks-gallery-scroller',
    spotlight: 'rect',
    titleKey: 'tour.step.ranksGallery.title',
    bodyKey: 'tour.step.ranksGallery.body',
  },
  {
    id: 'ranks-expectations',
    family: 'ranks',
    hash: '#/ranks',
    target: '.ranks-gallery-column, .ranks-gallery-expectations, [data-view="ranks-gallery"]',
    spotlight: 'rect',
    titleKey: 'tour.step.ranksExpectations.title',
    bodyKey: 'tour.step.ranksExpectations.body',
  },
  // Config — spotlight each section (scroll content-body to reveal it)
  {
    id: 'config-appearance',
    family: 'config',
    hash: '#/config',
    target: '[data-tour-appearance-core]',
    spotlight: 'rect',
    prepare: { configSection: 'appearance-core' },
    titleKey: 'tour.step.configAppearance.title',
    bodyKey: 'tour.step.configAppearance.body',
  },
  {
    id: 'config-accessibility',
    family: 'config',
    hash: '#/config',
    target: '[data-tour-target="config-accessibility"], [data-section="accessibility"]',
    spotlight: 'rect',
    prepare: { configSection: 'accessibility' },
    titleKey: 'tour.step.configAccessibility.title',
    bodyKey: 'tour.step.configAccessibility.body',
  },
  {
    id: 'config-backup',
    family: 'config',
    hash: '#/config',
    target: '[data-section="backup"]',
    spotlight: 'rect',
    prepare: { configSection: 'backup' },
    titleKey: 'tour.step.configBackup.title',
    bodyKey: 'tour.step.configBackup.body',
  },
  {
    id: 'config-advanced',
    family: 'config',
    hash: '#/config',
    // Header + toggles/Reset + Animations (not path overrides below).
    target: '[data-tour-advanced-header], [data-tour-advanced-core]',
    targetUnion: true,
    spotlight: 'rect',
    prepare: { configSection: 'advanced-core' },
    titleKey: 'tour.step.configAdvanced.title',
    bodyKey: 'tour.step.configAdvanced.body',
  },
  // Rank manager / editor (via Edit Ranks control)
  {
    id: 'ranks-edit-entry',
    family: 'rank-editor',
    hash: '#/',
    target: '[data-action="edit-ranks"], [data-navbar-utilities]',
    spotlight: 'rect',
    titleKey: 'tour.step.rankEditEntry.title',
    bodyKey: 'tour.step.rankEditEntry.body',
  },
  {
    id: 'rank-manager',
    family: 'rank-editor',
    hash: '#/rank-manager',
    target: '[data-view="rank-manager"], .rank-manager-view',
    spotlight: 'rect',
    titleKey: 'tour.step.rankManager.title',
    bodyKey: 'tour.step.rankManager.body',
  },
  {
    id: 'rank-editor',
    family: 'rank-editor',
    hash: '#/rank-editor',
    target: '[data-view="rank-editor"], .rank-editor-view',
    spotlight: 'rect',
    titleKey: 'tour.step.rankEditor.title',
    bodyKey: 'tour.step.rankEditor.body',
  },
  // Contributing / GitHub FAB only (FR-004)
  {
    id: 'github-fab',
    family: 'contributing',
    hash: '#/',
    target: '[data-github-fab]',
    spotlight: 'circle',
    titleKey: 'tour.step.githubFab.title',
    bodyKey: 'tour.step.githubFab.body',
  },
];

function listSteps() {
  return STEPS.slice();
}

function stepById(id) {
  return STEPS.find((s) => s.id === id) || null;
}

function indexOfStepId(id) {
  return STEPS.findIndex((s) => s.id === id);
}

function firstStepForFamily(family) {
  return STEPS.find((s) => s.family === family) || null;
}

/** Map app route id -> tour family for header jump (FR-003). */
function familyForRoute(route) {
  const r = String(route || '');
  if (r === 'landing' || r === 'today') return 'landing';
  if (r === 'workout') return 'workout';
  if (r === 'history') return 'history';
  if (r === 'ranks' || r === 'rank') return 'ranks';
  if (r === 'config') return 'config';
  if (r === 'rank-manager' || r === 'rank-create' || r === 'rank-edit' || r === 'rank-editor') {
    return 'rank-editor';
  }
  if (r === 'contributing') return 'contributing';
  if (r === 'privacy' || r === 'onboarding') return 'landing';
  return 'landing';
}

function firstStepForRoute(route) {
  const family = familyForRoute(route);
  return firstStepForFamily(family) || STEPS[0] || null;
}

function assertCatalogRules() {
  const landing = STEPS.filter((s) => s.family === 'landing');
  const privacy = STEPS.filter((s) => /privacy/i.test(s.id) || s.family === 'privacy');
  const contributing = STEPS.filter((s) => s.family === 'contributing');
  const historyCombined = STEPS.some((s) => s.id === 'history-calendar');
  const missingShape = STEPS.filter(
    (s) => s.spotlight !== 'circle' && s.spotlight !== 'rect' && s.spotlight !== 'none'
  );
  return {
    landingCount: landing.length,
    privacyCount: privacy.length,
    contributingCount: contributing.length,
    historyCombinedStep: historyCombined,
    missingSpotlightShape: missingShape.length,
  };
}

module.exports = {
  STEPS,
  listSteps,
  stepById,
  indexOfStepId,
  firstStepForFamily,
  familyForRoute,
  firstStepForRoute,
  assertCatalogRules,
};
