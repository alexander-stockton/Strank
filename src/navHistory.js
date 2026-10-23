/**
 * Last-visited hash stack for Back buttons (not hierarchical "up").
 */

function normalizeNavHash(raw) {
  let h = String(raw == null ? '' : raw).trim();
  if (!h || h === '#' || h === '#/') return '#/';
  if (!h.startsWith('#')) h = `#${h}`;
  if (h === '#') return '#/';
  // App routes are `#/path`; accept bare `#path` from callers.
  if (h.length > 1 && h[1] !== '/') h = `#/${h.slice(1)}`;
  return h;
}

function createNavHistory(options = {}) {
  const maxDepth = options.maxDepth != null ? options.maxDepth : 40;
  /** @type {string[]} */
  let stack = [];
  /** @type {string|null} */
  let current = null;
  /** @type {'push'|'replace'|'back'} */
  let mode = 'push';

  function record(hash) {
    const next = normalizeNavHash(hash);
    if (current == null) {
      current = next;
      mode = 'push';
      return { current, stacked: false };
    }
    if (next === current) {
      mode = 'push';
      return { current, stacked: false };
    }
    if (mode === 'back') {
      current = next;
      mode = 'push';
      return { current, stacked: false };
    }
    if (mode === 'replace') {
      while (stack.length && stack[stack.length - 1] === next) {
        stack.pop();
      }
      current = next;
      mode = 'push';
      return { current, stacked: false };
    }
    stack.push(current);
    if (stack.length > maxDepth) stack.splice(0, stack.length - maxDepth);
    current = next;
    return { current, stacked: true };
  }

  function peekBack() {
    return stack.length ? stack[stack.length - 1] : '#/';
  }

  function consumeBack() {
    const target = stack.length ? stack.pop() : '#/';
    mode = 'back';
    return normalizeNavHash(target);
  }

  function markReplace() {
    mode = 'replace';
  }

  function markBack() {
    mode = 'back';
  }

  function getCurrent() {
    return current;
  }

  function getStack() {
    return stack.slice();
  }

  function reset() {
    stack = [];
    current = null;
    mode = 'push';
  }

  return {
    normalizeNavHash,
    record,
    peekBack,
    consumeBack,
    markReplace,
    markBack,
    getCurrent,
    getStack,
    reset,
  };
}

module.exports = {
  normalizeNavHash,
  createNavHistory,
};
