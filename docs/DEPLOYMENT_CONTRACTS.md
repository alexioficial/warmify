# Deployment center contracts

Phase 5 audit and implementation record, 2026-09-04. Read-only reference `8d675f2e2`.
Read the complete `app/Http/Controllers/Api/DeployController.php` and the deployment
route entries in `routes/api.php:144–149`. The local endpoint manifest already
contains all five public operations below.

## API behavior

- GET `/deployments` returns only queued/in-progress application deployments,
  filtered by team servers and sorted by ID. It is not a global historical feed.
  Collection serialization may preserve numeric keys: normalize records.
- GET `/deployments/{uuid}` looks up `deployment_uuid`, then checks the related
  application's team. Missing/foreign results are 404. Logs are present only with
  read-sensitive permission and must never be stored in SQLite.
- GET `/deployments/applications/{uuid}` supplies application history, with
  nonnegative `skip` and positive `take`. The response comes from the application's
  deployments helper; do not treat the global active list as historical data.
- POST `/deployments/{uuid}/cancel` has no body fields. Only `queued` and
  `in_progress` are cancellable; state is checked atomically upstream. A terminal
  deployment returns 400. Success returns UUID and `cancelled-by-user`. Require
  explicit confirmation, reload current identity/status before POST, and preserve
  the upstream race refusal. Errors can contain command fragments: use safe text.
- POST `/deploy` accepts JSON or query parameters. Use JSON and exactly one of
  comma-separated `uuid` or `tag`. `force` disables the build cache. `pr` and
  `pull_request_id` are aliases; send only the latter. Tags cannot be combined with
  a preview ID. `docker_tag` requires a positive preview ID and UUID selection;
  it is meaningful only for Docker Image applications. Blank options are omitted.

UUID deployment returns `{ deployments: [...] }`, with resource UUID and optional
deployment UUID per result. Missing UUID targets can be silently omitted. Services
start without a deployment UUID, as do databases; applications can be skipped or
refused. A 200 is not proof that every target was deployed. Tag deployment returns
`message` and optional `details`, not the UUID response shape, and selects apps and
services, not databases. Queue exhaustion can return 429 after earlier targets
were already processed. Never retry mutations automatically or claim atomicity.

## Implementation order / status

- [x] Audit controller and public route/manifest parity.
- [x] Add focused deploy input validation and safe result normalization with
      contract tests. Display partial/uncertain outcomes; UI at `/deployments/new`.
- [x] Add confirmed cancellation actions with current identity/status checks.
- [x] Replace generic index/detail pages with structured fields/logs and navigable
      application/project/environment context. Resolve numeric application IDs
      from allowed metadata; never construct a UUID link using a numeric ID.
- [x] Poll active details every five seconds while visible; abort stale responses
      across navigation, stop on terminal status, provide bounded error/retry UI.
- [x] Add browser cases for UUID/tag creation, queued/running/terminal states,
      cancellation, context links and hidden-tab/history behavior.
- [x] Run the Phase 5 gate as one meaningful block and update the roadmap/handoff.

## Current implementation slice

The index now uses a dedicated active-only page with a New deployment link and
visibility-aware polling, including when the list is empty. The existing
DeploymentTable binds the endpoint on mount; the index keys it by loaded data.
Deployment collection synchronization and active polling apply an explicit scalar
metadata allowlist, excluding logs and configuration snapshots before new cache
writes. Numeric-key collections and nested server/environment names normalize to
safe flat fields. Existing historical SQLite rows are not purged by this change.
Deployment polling errors now use safe messages; unrelated generic poll families
remain scheduled for the broader security audit.

The new form sends exactly one POST with UUIDs or tags, optional force/preview/tag
fields, same-origin/auth checks and explicit confirmation. Confirmation resets
after every submission. Errors retain safe fields, distinguish uncertain partial
execution and expose Retry-After without auto retry. Only normalized result enums
and validated resource/deployment UUIDs leave the server; arbitrary response
messages do not. Cache invalidation also runs after uncertain responses.

Follow-up read of `bootstrap/helpers/applications.php:14–106` confirmed a pinned
controller mismatch: duplicate suppression returns the message `Deployment already
queued for this commit.` from the helper, but `DeployController::deploy_resource`
can retain its freshly generated, unused UUID. For that known skipped outcome,
Warmify does not offer the misleading deployment link. Resource names containing
words such as failed/skipped must not classify a successful result as an error.

Deployment detail now has a dedicated no-store loader and allowlisted presenter.
It resolves numeric application IDs against permitted application metadata before
building project/environment/application links. Log parsing shows only visible
`output`, rejects malformed JSON-like payloads, omits command/configuration objects,
masks recognizable credentials and bounds output to the latest 200,000 characters.
Live detail polling runs every five seconds only while visible and active, aborts
stale requests across navigation and stops on terminal status.

Cancellation re-reads the exact route UUID, allows only queued/in-progress state,
posts exactly once with no request body, invalidates deployment cache even after an
uncertain submission and never retries a race refusal. Success uses POST-Redirect-
GET. The enhanced form replaces the current browser-history entry so one Back action
returns to the prior deployment without a duplicate POST/redirect entry or a stuck
skeleton. Confirmation is hydration-gated and must be fresh.

Final Phase 5 gate: 309/309 unit/contract tests (32 files), 41/41 full-suite E2E,
five focused deployment E2E, zero check diagnostics, lint and adapter-node build
passed. The gate exposed and corrected the cancellation history duplication plus a
platform-dependent CRLF expectation in the Docker document encoding contract.
Client fixture-secret scan and diff-check are clean. No real Coolify mutations.
