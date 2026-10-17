/**
 * Feature 1 — App Foundation
 * Spec: features/feature-1-App-Foundation.md
 */

let outboundAttempts = 0;
let installed = false;
const original = {};

function recordAttempt(kind, detail) {
  outboundAttempts += 1;
  const err = new Error(`Outbound network attempt blocked (${kind}): ${detail}`);
  err.code = 'NETWORK_GUARD';
  throw err;
}

function install() {
  if (installed) return;
  installed = true;
  outboundAttempts = 0;

  if (typeof global.fetch === 'function') {
    original.fetch = global.fetch;
    global.fetch = (...args) => recordAttempt('fetch', String(args[0]));
  }

  try {
    const http = require('http');
    const https = require('https');
    original.httpRequest = http.request;
    original.httpsRequest = https.request;
    http.request = (...args) => recordAttempt('http.request', String(args[0] && args[0].href ? args[0].href : args[0]));
    https.request = (...args) => recordAttempt('https.request', String(args[0] && args[0].href ? args[0].href : args[0]));
  } catch (_) {
    /* ignore in restricted envs */
  }

  if (typeof XMLHttpRequest !== 'undefined') {
    original.xhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function guardedOpen(method, url, ...rest) {
      recordAttempt('xhr', String(url));
      return original.xhrOpen.call(this, method, url, ...rest);
    };
  }
}

function uninstall() {
  if (!installed) return;
  if (original.fetch) global.fetch = original.fetch;
  try {
    const http = require('http');
    const https = require('https');
    if (original.httpRequest) http.request = original.httpRequest;
    if (original.httpsRequest) https.request = original.httpsRequest;
  } catch (_) {
    /* ignore */
  }
  if (original.xhrOpen && typeof XMLHttpRequest !== 'undefined') {
    XMLHttpRequest.prototype.open = original.xhrOpen;
  }
  installed = false;
  Object.keys(original).forEach((k) => delete original[k]);
}

function resetCount() {
  outboundAttempts = 0;
}

function getOutboundAttempts() {
  return outboundAttempts;
}

function assertOffline() {
  if (outboundAttempts > 0) {
    throw new Error(`Expected no outbound network; saw ${outboundAttempts} attempt(s)`);
  }
}

module.exports = {
  install,
  uninstall,
  resetCount,
  getOutboundAttempts,
  assertOffline,
};
