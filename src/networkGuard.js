/**
 * Feature 1 - App Foundation / Feature 19 offline packaging
 * Spec: features/feature-1-App-Foundation.md
 *
 * Blocks Node/browser outbound APIs used by app code.
 *
 * Chromium's own C++ networking is stopped separately via
 * `src/chromiumOfflineArgs.js` -> package.json `chromium-args`
 * (especially `--host-resolver-rules=MAP * ~NOTFOUND`) plus CSP `connect-src 'none'`
 * in index.html.
 */

let outboundAttempts = 0;
let installed = false;
const original = {};

function recordAttempt(kind, detail) {
  outboundAttempts += 1;
  const err = new Error(
    `Outbound network attempt blocked (${kind}): ${detail}`,
  );
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
  if (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.fetch === 'function' &&
    globalThis.fetch !== global.fetch
  ) {
    original.globalThisFetch = globalThis.fetch;
    globalThis.fetch = (...args) => recordAttempt('fetch', String(args[0]));
  }

  try {
    const http = require('http');
    const https = require('https');
    original.httpRequest = http.request;
    original.httpsRequest = https.request;
    original.httpGet = http.get;
    original.httpsGet = https.get;
    http.request = (...args) =>
      recordAttempt(
        'http.request',
        String(args[0] && args[0].href ? args[0].href : args[0]),
      );
    https.request = (...args) =>
      recordAttempt(
        'https.request',
        String(args[0] && args[0].href ? args[0].href : args[0]),
      );
    http.get = (...args) => recordAttempt('http.get', String(args[0]));
    https.get = (...args) => recordAttempt('https.get', String(args[0]));
  } catch (_) {
    /* ignore in restricted envs */
  }

  try {
    const net = require('net');
    original.netConnect = net.connect;
    original.netCreateConnection = net.createConnection;
    if (typeof net.Socket === 'function' && net.Socket.prototype) {
      original.netSocketConnect = net.Socket.prototype.connect;
      net.Socket.prototype.connect = function guardedSocketConnect(...args) {
        recordAttempt('net.Socket.connect', String(args[0]));
        return original.netSocketConnect.apply(this, args);
      };
    }
    net.connect = (...args) => recordAttempt('net.connect', String(args[0]));
    net.createConnection = (...args) =>
      recordAttempt('net.createConnection', String(args[0]));
  } catch (_) {
    /* ignore */
  }

  try {
    const tls = require('tls');
    if (typeof tls.connect === 'function') {
      original.tlsConnect = tls.connect;
      tls.connect = (...args) => recordAttempt('tls.connect', String(args[0]));
    }
  } catch (_) {
    /* ignore */
  }

  try {
    const dns = require('dns');
    original.dnsLookup = dns.lookup;
    original.dnsResolve = dns.resolve;
    original.dnsResolve4 = dns.resolve4;
    original.dnsResolve6 = dns.resolve6;
    original.dnsLookupService = dns.lookupService;
    dns.lookup = (...args) => recordAttempt('dns.lookup', String(args[0]));
    if (typeof dns.resolve === 'function') {
      dns.resolve = (...args) => recordAttempt('dns.resolve', String(args[0]));
    }
    if (typeof dns.resolve4 === 'function') {
      dns.resolve4 = (...args) =>
        recordAttempt('dns.resolve4', String(args[0]));
    }
    if (typeof dns.resolve6 === 'function') {
      dns.resolve6 = (...args) =>
        recordAttempt('dns.resolve6', String(args[0]));
    }
    if (typeof dns.lookupService === 'function') {
      dns.lookupService = (...args) =>
        recordAttempt('dns.lookupService', String(args[0]));
    }
    if (dns.promises) {
      original.dnsPromisesLookup = dns.promises.lookup;
      original.dnsPromisesResolve = dns.promises.resolve;
      dns.promises.lookup = (...args) =>
        recordAttempt('dns.promises.lookup', String(args[0]));
      if (typeof dns.promises.resolve === 'function') {
        dns.promises.resolve = (...args) =>
          recordAttempt('dns.promises.resolve', String(args[0]));
      }
    }
  } catch (_) {
    /* ignore */
  }

  try {
    const dgram = require('dgram');
    if (dgram && dgram.Socket && dgram.Socket.prototype) {
      original.dgramSend = dgram.Socket.prototype.send;
      original.dgramConnect = dgram.Socket.prototype.connect;
      dgram.Socket.prototype.send = function guardedSend(...args) {
        recordAttempt('dgram.send', String(args[0]));
        return original.dgramSend.apply(this, args);
      };
      if (typeof dgram.Socket.prototype.connect === 'function') {
        dgram.Socket.prototype.connect = function guardedDgramConnect(...args) {
          recordAttempt('dgram.connect', String(args[0]));
          return original.dgramConnect.apply(this, args);
        };
      }
    }
  } catch (_) {
    /* ignore */
  }

  if (typeof XMLHttpRequest !== 'undefined') {
    original.xhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function guardedOpen(method, url, ...rest) {
      recordAttempt('xhr', String(url));
      return original.xhrOpen.call(this, method, url, ...rest);
    };
  }

  if (typeof WebSocket !== 'undefined') {
    original.WebSocket = WebSocket;
    // eslint-disable-next-line no-global-assign, no-native-reassign
    WebSocket = function GuardedWebSocket(url, ...rest) {
      recordAttempt('WebSocket', String(url));
      return new original.WebSocket(url, ...rest);
    };
    WebSocket.prototype = original.WebSocket.prototype;
    Object.keys(original.WebSocket).forEach((k) => {
      try {
        WebSocket[k] = original.WebSocket[k];
      } catch (_) {
        /* ignore */
      }
    });
  }

  if (typeof EventSource !== 'undefined') {
    original.EventSource = EventSource;
    // eslint-disable-next-line no-global-assign, no-native-reassign
    EventSource = function GuardedEventSource(url, ...rest) {
      recordAttempt('EventSource', String(url));
      return new original.EventSource(url, ...rest);
    };
    EventSource.prototype = original.EventSource.prototype;
  }

  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    original.sendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, ...rest) => {
      recordAttempt('sendBeacon', String(url));
      return false;
    };
  }

  try {
    if (
      typeof nw !== 'undefined' &&
      nw.Shell &&
      typeof nw.Shell.openExternal === 'function'
    ) {
      original.openExternal = nw.Shell.openExternal.bind(nw.Shell);
      nw.Shell.openExternal = (url) =>
        recordAttempt('nw.Shell.openExternal', String(url));
    }
  } catch (_) {
    /* ignore */
  }
}

function uninstall() {
  if (!installed) return;
  if (original.fetch) global.fetch = original.fetch;
  if (original.globalThisFetch && typeof globalThis !== 'undefined') {
    globalThis.fetch = original.globalThisFetch;
  }
  try {
    const http = require('http');
    const https = require('https');
    if (original.httpRequest) http.request = original.httpRequest;
    if (original.httpsRequest) https.request = original.httpsRequest;
    if (original.httpGet) http.get = original.httpGet;
    if (original.httpsGet) https.get = original.httpsGet;
  } catch (_) {
    /* ignore */
  }
  try {
    const net = require('net');
    if (original.netConnect) net.connect = original.netConnect;
    if (original.netCreateConnection)
      net.createConnection = original.netCreateConnection;
    if (original.netSocketConnect && net.Socket && net.Socket.prototype) {
      net.Socket.prototype.connect = original.netSocketConnect;
    }
  } catch (_) {
    /* ignore */
  }
  try {
    const tls = require('tls');
    if (original.tlsConnect) tls.connect = original.tlsConnect;
  } catch (_) {
    /* ignore */
  }
  try {
    const dns = require('dns');
    if (original.dnsLookup) dns.lookup = original.dnsLookup;
    if (original.dnsResolve) dns.resolve = original.dnsResolve;
    if (original.dnsResolve4) dns.resolve4 = original.dnsResolve4;
    if (original.dnsResolve6) dns.resolve6 = original.dnsResolve6;
    if (original.dnsLookupService)
      dns.lookupService = original.dnsLookupService;
    if (dns.promises) {
      if (original.dnsPromisesLookup)
        dns.promises.lookup = original.dnsPromisesLookup;
      if (original.dnsPromisesResolve)
        dns.promises.resolve = original.dnsPromisesResolve;
    }
  } catch (_) {
    /* ignore */
  }
  try {
    const dgram = require('dgram');
    if (dgram.Socket && dgram.Socket.prototype) {
      if (original.dgramSend) dgram.Socket.prototype.send = original.dgramSend;
      if (original.dgramConnect)
        dgram.Socket.prototype.connect = original.dgramConnect;
    }
  } catch (_) {
    /* ignore */
  }
  if (original.xhrOpen && typeof XMLHttpRequest !== 'undefined') {
    XMLHttpRequest.prototype.open = original.xhrOpen;
  }
  if (original.WebSocket) {
    // eslint-disable-next-line no-global-assign, no-native-reassign
    WebSocket = original.WebSocket;
  }
  if (original.EventSource) {
    // eslint-disable-next-line no-global-assign, no-native-reassign
    EventSource = original.EventSource;
  }
  if (original.sendBeacon && typeof navigator !== 'undefined') {
    navigator.sendBeacon = original.sendBeacon;
  }
  try {
    if (original.openExternal && typeof nw !== 'undefined' && nw.Shell) {
      nw.Shell.openExternal = original.openExternal;
    }
  } catch (_) {
    /* ignore */
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
    throw new Error(
      `Expected no outbound network; saw ${outboundAttempts} attempt(s)`,
    );
  }
}

module.exports = {
  install,
  uninstall,
  resetCount,
  getOutboundAttempts,
  assertOffline,
};
