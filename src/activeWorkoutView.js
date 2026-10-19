/**
 * Feature 7 — Landing Page (Get Started → Feature 8 stub)
 * Feature 8 — Active Workout (minimal route shell only)
 * Spec: features/feature-7-Landing-Page.md
 *
 * Full checklist workout UI is Feature 8 — this stub exists so Landing CTA can navigate.
 */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mountActiveWorkoutView(root, options = {}) {
  const localDate = options.localDate || '';
  const expectations = options.expectations || [];
  const onBack = options.onBack || (() => {});
  let destroyed = false;

  function destroy() {
    destroyed = true;
    root.innerHTML = '';
  }

  function refresh() {
    if (!destroyed) render();
  }

  function render() {
    if (destroyed) return;
    root.innerHTML = `
      <section class="panel active-workout-view" data-view="activeWorkout">
        <header class="workout-header">
          <button type="button" class="ghost" data-action="back">Back</button>
          <h1>Active Workout</h1>
        </header>
        <p class="workout-date" data-local-date>${escapeHtml(localDate)}</p>
        <p class="hint">Feature 8 checklist UI will appear here.</p>
        <ul class="expectation-list" data-workout-expectations>
          ${expectations
            .map(
              (e) =>
                `<li data-exercise-id="${escapeHtml(e.exerciseId)}">${escapeHtml(e.name || e.exerciseId)}</li>`
            )
            .join('')}
        </ul>
      </section>
    `;
    const back = root.querySelector('[data-action="back"]');
    if (back) back.addEventListener('click', () => onBack());
  }

  render();

  return { refresh, destroy, getRoot: () => root };
}

module.exports = {
  mountActiveWorkoutView,
};
