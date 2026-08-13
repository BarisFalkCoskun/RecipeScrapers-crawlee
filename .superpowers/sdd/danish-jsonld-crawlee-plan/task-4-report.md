# Task 4 report: optional reactive Mullvad SOCKS5 transport

Date: 2026-08-13

## Status

Implemented and unit/integration verified. Direct mode remains the default. `--vpn` now starts only after a verified Mullvad relay lease exists and fails before MongoDB/store creation when no relay verifies. No live Mullvad request, external crawl, or MongoDB operation was run.

## Diagnostic assessment

Before implementation, seven plausible failure sources were considered:

1. The installed Cheerio HTTP client might reject `socks5://` proxy URLs.
2. Playwright might support SOCKS but reuse a browser launched with a previous relay.
3. Mullvad relay API/cache schema or country filtering might admit unusable relays.
4. A reachability check might accept a connection that is not a Mullvad exit.
5. Disabling Crawlee's session pool might detach request retries from relay affinity.
6. Rotation classification might rotate for parser, validation, 404, or MongoDB failures.
7. Concurrent lease acquisition might assign one relay to multiple request sessions.

The two most likely failures were transport mismatch and request/relay affinity. Installed `got-scraping` source confirms that only HTTP/HTTPS proxy URLs are accepted, while Playwright accepts SOCKS. A local `proxy-chain` HTTP-to-SOCKS bridge therefore provides one transport URL contract to both crawlers. Explicit hashed request-session IDs in Crawlee `userData` preserve retry affinity without re-enabling Crawlee session interception. Focused tests and bounded relay lifecycle diagnostics validate these assumptions.

The Playwright source check also showed that a browser can be reused across proxy URLs unless `browserPerProxy` is enabled. The dedicated Playwright factory now enforces `browserPerProxy: true` only when the VPN proxy configuration is present.

## Implemented behavior

- Fetches Mullvad relay metadata from the official relay endpoint and caches it at `vpn/mullvad.json` by default; an API failure falls back to that cache.
- Strictly filters active WireGuard relays with SOCKS metadata and an optional case-insensitive `--vpn-country`; it does not silently widen a requested country.
- Verifies each candidate through `am.i.mullvad.net/json` using `socks-proxy-agent` and requires `mullvad_exit_ip: true` before opening a lease.
- Bridges each verified SOCKS relay to a loopback-only HTTP proxy with `proxy-chain`, because the installed Cheerio HTTP stack rejects direct SOCKS proxy URLs.
- Uses Crawlee `ProxyConfiguration.newUrlFunction` plus a stable `vpn-<sha256>` request identity. Retries keep their relay until an allowed rotation occurs.
- Reserves relays during concurrent verification, prevents duplicate active leases, cools failed/rotated relays, and keeps relay choices unique within a request's rotation history.
- Rotates immediately only for `403`, `429`, `526`, explicit block-page signatures, and proxy-specific failures. A generic transport failure rotates only after the second consecutive failure.
- Never rotates for `401`, `404`, successful non-block pages, JSON-LD/parser/validation failures, or MongoDB/BSON failures.
- Allows at most three successful rotations per request. Exhaustion sets `noRetry` while retaining the response/failure diagnostics.
- Calls source response diagnostics before raising the internal rotation retry, preserving `401`/`403`/`429`/`526` handler evidence with Crawlee session pools still disabled.
- Enables the same dynamic proxy configuration for dedicated Cheerio and Playwright factories; Playwright uses one browser per proxy.
- Cleans up local bridges on rotation, startup failure, crawl completion, store cleanup failure, and explicit transport cleanup.
- Emits only bounded relay label, country, reason, counts, and rotation number. Proxy URLs, SOCKS endpoints, and credentials are absent from diagnostics.
- Adds direct runtime dependencies on `proxy-chain` and `socks-proxy-agent`; both were already present transitively in the installed Crawlee tree.

## TDD evidence

Red runs:

- `npx vitest run tests/danish-jsonld/mullvad-relay-provider.test.ts tests/danish-jsonld/vpn-transport.test.ts tests/danish-jsonld/cli.test.ts`
  - Two missing transport/provider suites and one CLI failure proved the feature and fail-closed startup were absent.
- `npx vitest run tests/danish-jsonld/runner.test.ts tests/danish-jsonld/crawler-factories.test.ts tests/danish-jsonld/cli.test.ts`
  - Three failures proved VPN transport was not propagated and CLI still rejected the flags.
- `npx vitest run tests/danish-jsonld/crawler-factories.test.ts`
  - Failed because the dynamic proxy configuration and Playwright `browserPerProxy` invariant were not applied by the factories.
- `npx vitest run tests/danish-jsonld/mullvad-relay-provider.test.ts`
  - Failed because concurrent sessions both selected `dk-cph-wg-001`; relay reservation fixed it.
- `npx vitest run tests/danish-jsonld/cli.test.ts`
  - Failed because a rejecting store close skipped VPN cleanup; nested cleanup fixed it.

Green verification:

- `npm run build && npm test && git diff --check`
  - TypeScript build passed.
  - 32 test files passed, 207 tests passed, 0 failed.
  - Diff whitespace validation passed.
- `npm run smoke:crawl`
  - The local-only fixture reached the Playwright phase but could not launch Chromium because the browser binary is not installed in this worktree. This is an environment prerequisite, not a live transport result.

## Changed files

- `.gitignore`
- `package.json`
- `package-lock.json`
- `src/danish-jsonld/cli.ts`
- `src/danish-jsonld/crawler-factories.ts`
- `src/danish-jsonld/mullvad-relay-provider.ts`
- `src/danish-jsonld/runner.ts`
- `src/danish-jsonld/vpn-transport.ts`
- `tests/danish-jsonld/cli.test.ts`
- `tests/danish-jsonld/crawler-factories.test.ts`
- `tests/danish-jsonld/mullvad-relay-provider.test.ts`
- `tests/danish-jsonld/runner.test.ts`
- `tests/danish-jsonld/vpn-transport.test.ts`

## Commit

- `fdc4c5d feat: add reactive Mullvad transport`

## Concerns

- Per the task boundary, Mullvad relay discovery, exit verification, and an end-to-end request through the HTTP-to-SOCKS bridge were not exercised against the live network. Those boundaries are covered with injected relay/verifier/bridge fakes and the installed dependency APIs compile successfully.
- The repository's Chromium binary is currently unavailable, so the existing local fixture smoke crawl cannot complete its Playwright phase until Playwright Chromium is installed.
- `npm install` reports 22 dependency advisories in the existing dependency tree (1 low, 13 moderate, 8 high). No audit remediation was attempted because it is outside Task 4 and could cause unrelated dependency changes.

## Review fix round 1 — 2026-08-13

Commit: `9c8bf3b fix: harden Mullvad lease lifecycle`

Addressed all four findings without live network or crawl activity.

### Root causes and fixes

1. Active request leases only had rotation and whole-transport cleanup paths. Successful and terminal requests therefore retained bridges and active relay ownership until CLI shutdown. Added serialized healthy `release()` to the provider and transport. The dedicated runner releases after successful handling, terminal failure, `noRetry`/cap exhaustion, and source shutdown. It does not release when a retry or rotation remains active. Healthy release closes the bridge and clears session history without cooldown, so finite inventories are reusable.
2. Relay verification collapsed the Mullvad response to a boolean. The verifier now models snake_case and camelCase exit identity fields. With `--vpn-country`, at least one authoritative country or hostname signal is required, every supplied signal must match, and hostname must match both the selected relay and requested country prefix. Mismatches are rejected and cooled with bounded diagnostics.
3. Explicit block signatures were checked only for responses below HTTP 400. Block detection now applies to every status except the explicit non-trigger statuses `401` and `404`; a Cloudflare signature on `503` rotates.
4. Provider rotation bypassed pending acquisition tracking, while transport rotation count was read and written outside a lock. Both layers now serialize acquire/rebind/rotate/release by request session. Cleanup rejects new work, awaits in-flight session operations, then closes every resulting bridge. Concurrent rotations therefore produce one active lease at a time, monotonic rotation counts, and a strict three-rotation cap.

The runner now includes fetch mode in the hashed lease session identity so Cheerio and Playwright fallback requests own distinct releasable leases even when URL and request kind match.

### TDD evidence

Red command:

- `npx vitest run tests/danish-jsonld/mullvad-relay-provider.test.ts tests/danish-jsonld/vpn-transport.test.ts tests/danish-jsonld/runner.test.ts`
  - 9 failures reproduced boolean-only verification, missing release methods/hooks, one-relay exhaustion, concurrent rotation ordering/orphan bridges, cleanup returning before rotation finished, `503` block non-rotation, and four concurrent rotations bypassing the cap.

Green verification:

- `npm run build && npm test && git diff --check`
  - TypeScript build passed.
  - 32 test files passed, 218 tests passed, 0 failed.
  - Diff whitespace validation passed.

Added coverage includes sustained sequential reuse with one relay, flexible real-response field parsing, authoritative country/hostname mismatch cooldown, healthy bridge closure, concurrent provider and transport rotations, strict concurrent rotation cap, cleanup during rotation at both layers, release after recovered success, terminal failure, cap/noRetry, and source shutdown.

### Remaining concerns

The original non-live concerns remain unchanged: live Mullvad endpoint/bridge behavior is intentionally untested, Chromium is absent for the repository smoke crawl, and dependency advisories were not remediated within this task.
