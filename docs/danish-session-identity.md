# Danish session and identity changes

Scope: implement the requested session continuity, coherent HTTP identity, and
browser-patch audit. Host-wide Retry-After backoff is a separate change.

## Investigation before behavior changes

Six candidate signals were considered: request rate, retry behavior, IP reputation,
session continuity, HTTP/TLS identity consistency, and JavaScript fingerprints.
The local investigation concentrated on identity mismatch and session ownership.

- Loopback capture showed generic Impit `chrome` advertising Chrome 124 while
  the independent generator sampled Chrome 140–145. Mixed-case caller overrides
  produced concatenated/conflicting UA and client-hint values.
- The browser advertised Linux on this macOS host. Its WebGL override replaced
  Apple GPU information with Intel/Mesa, exposed JavaScript function source, and
  returned a renderer for an invalid receiver where the native method throws.
- Lifecycle logs showed different lease IDs for two URLs and bridge release
  after each completed request, despite source-level cookie state.
- A failing loopback regression demonstrated lost cookies across crawler
  instances. HTTP and browser state needed a common owner.

The observations establish local consistency defects. They do not establish
that a particular remote site's blocks were caused by those defects.

## Implementation plan and behavior

- [x] Add local diagnostics and capture the original behavior before fixes.
- [x] Keep a source-attempt VPN lease across URLs and fetch modes; retain separate
  request retry budgets and reset relay history between completed request chains.
- [x] Share a scoped tough-cookie jar across HTTP, redirects, and browser pages.
  Capture cookies after handlers as well as navigation, preserve deletion and
  cookie attributes, and ignore stale browser snapshots after relay rotation.
- [x] Clear cookie state on relay changes and retire affected browser contexts.
  Serialize the source session to avoid rotation while another request is active.
- [x] Pin a supported HTTP profile and its matching UA/client hints; strip
  conflicting identity overrides case-insensitively. Preserve source headers
  unrelated to browser identity and the Nemlig transport exception.
- [x] Preserve native WebGL. Derive browser UA version from bundled Chromium and
  its platform from the runtime host. Keep the former WebGL script only for the
  diagnostic comparison.

HTTP currently impersonates Chrome 151 on Windows; Playwright uses the bundled
real browser (Chromium 147 at implementation time) on the runtime platform. Both
are stable and internally consistent, but fallback still changes transport
fingerprint. This avoids falsely assigning an unsupported version to either
transport; it does not claim indistinguishability between them.

## Validation

Verified locally on 2026-09-22: TypeScript build passed; 599 tests across 62
files passed; the smoke crawl passed with 6 HTTP and 5 browser requests, zero
failed requests; the identity/WebGL diagnostic passed. Independent review's
redirect-scope and closed-page recovery findings were reproduced and fixed.

Run `npm run build`, `npm test`, `npm run smoke:crawl`, and
`npm run diagnose:identity`. The identity diagnostic prints sanitized JSON and
fails if profile headers, browser version/platform, or native WebGL checks differ.
It uses only a local server and bundled Chromium; no external test service or
recipe site is contacted, and TLS/JA4 is not measured by this HTTP fixture.

Session regressions cover HTTP redirects, HTTP-to-browser-to-HTTP transfer,
late JavaScript cookie updates, navigation failure recovery, cookie deletion and
redirect host/path scope, rotation resets,
source-final cleanup, and independent per-request rotation budgets.
Runtime session diagnostics contain generated identifiers, generation numbers,
entry counts and lifecycle reasons, never cookie values or proxy credentials.

The before/after identity JSON is saved locally under ignored `evidence/`.
No production crawl or block-rate comparison was run as part of this change.
