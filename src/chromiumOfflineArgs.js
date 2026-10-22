/**
 * Feature 19 — offline packaging
 *
 * Canonical Chromium / NW.js command-line switches that keep Strank offline.
 * Applied via package.json `chromium-args` (dev + packaged). Dist staging always
 * copies this string so the shipped package cannot drift.
 *
 * `--host-resolver-rules=MAP * ~NOTFOUND` makes Chromium fail every hostname
 * lookup locally (no system DNS / DoH / outbound resolve). That is the hard stop
 * for framework background sockets that JS cannot intercept.
 */

const CHROMIUM_OFFLINE_ARGS = [
  // Kill background / update / telemetry paths.
  '--disable-background-networking',
  '--disable-component-update',
  '--disable-component-extensions-with-background-pages',
  '--disable-sync',
  '--disable-client-side-phishing-detection',
  '--disable-default-apps',
  '--disable-domain-reliability',
  '--disable-breakpad',
  '--disable-crash-reporter',
  '--disable-features=TranslateUI,InterestFeedContentSuggestions,AudioServiceOutOfProcess,CertificateTransparencyComponentUpdater,AutofillServerCommunication,OptimizationHints,MediaRouter,DialMediaRouteProvider,ChromeWhatsNewUI,NetworkTimeServiceQuerying,CalculateNativeWinOcclusion,DnsOverHttps,UseDnsHttpsSvcb,UnsafeLegacyTLSVersion,BackForwardCache,GlobalMediaControls,ImprovedCookieControls,LazyLoad,DestroyProfileOnBrowserClose',
  '--disable-ipc-flooding-protection',
  '--no-pings',
  '--no-first-run',
  '--no-default-browser-check',
  '--metrics-recording-only',
  '--check-for-update-interval=31536000',
  // Hard offline: no DNS / DoH / QUIC / WebRTC media paths.
  '--dns-over-https-mode=off',
  '--disable-quic',
  '--disable-webrtc',
  '--force-webrtc-ip-permission-check',
  // NW.js treats single-quoted segments as one argv (spaces in the MAP rule).
  "'--host-resolver-rules=MAP * ~NOTFOUND'",
].join(' ');

module.exports = {
  CHROMIUM_OFFLINE_ARGS,
};
