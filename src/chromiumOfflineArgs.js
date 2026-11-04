/**
 * Feature 19 - offline packaging
 *
 * Canonical Chromium / NW.js command-line switches that keep Strank offline.
 * Applied via package.json `chromium-args` (dev + packaged). Dist staging always
 * copies this string so the shipped package cannot drift.
 *
 * Under NO circumstances may Strank reach the public internet. These flags are
 * the Chromium-layer hard stop (JS networkGuard cannot intercept C++ sockets).
 *
 * `--host-resolver-rules=MAP * ~NOTFOUND` fails every hostname lookup locally
 * (no system DNS / DoH). `--proxy-server` sends any residual HTTP(S) to a dead
 * local endpoint so nothing leaves the machine.
 */

const CHROMIUM_OFFLINE_ARGS = [
  // Kill background / update / telemetry / “helpful” network paths.
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-component-update',
  '--disable-component-extensions-with-background-pages',
  '--disable-sync',
  '--disable-client-side-phishing-detection',
  '--disable-default-apps',
  '--disable-domain-reliability',
  '--disable-breakpad',
  '--disable-crash-reporter',
  '--disable-logging',
  '--disable-notifications',
  '--disable-permissions-api',
  '--disable-speech-api',
  '--disable-print-preview',
  '--disable-cloud-import',
  '--no-service-autorun',
  '--safebrowsing-disable-auto-update',
  '--safebrowsing-disable-download-protection',
  '--disable-features=TranslateUI,InterestFeedContentSuggestions,AudioServiceOutOfProcess,CertificateTransparencyComponentUpdater,AutofillServerCommunication,OptimizationHints,MediaRouter,DialMediaRouteProvider,ChromeWhatsNewUI,NetworkTimeServiceQuerying,CalculateNativeWinOcclusion,DnsOverHttps,UseDnsHttpsSvcb,UnsafeLegacyTLSVersion,BackForwardCache,GlobalMediaControls,ImprovedCookieControls,LazyLoad,DestroyProfileOnBrowserClose,SafeBrowsingEnhancedProtection,AcceptCHFrame,AutoDeElevate,HardwareMediaKeyHandling',
  '--disable-ipc-flooding-protection',
  '--no-pings',
  '--no-first-run',
  '--no-default-browser-check',
  '--metrics-recording-only',
  '--check-for-update-interval=31536000',
  // Hard offline: no DNS / DoH / QUIC / WebRTC.
  '--dns-over-https-mode=off',
  '--disable-quic',
  '--disable-webrtc',
  '--force-webrtc-ip-permission-check',
  // NW.js treats single-quoted segments as one argv (spaces in the MAP rule).
  "'--host-resolver-rules=MAP * ~NOTFOUND'",
  // Any stack that still opens HTTP(S) hits a closed local port (discard).
  "'--proxy-server=http://127.0.0.1:9'",
  "'--proxy-bypass-list='",
].join(' ');

module.exports = {
  CHROMIUM_OFFLINE_ARGS,
};
