# Latest handoff — 2026-09-09

## Current checkpoint — implementation roadmap complete

The Coolify public-API parity roadmap is complete through Phase 10. The UI remains
intentionally light/plain, and no private Coolify Laravel/Livewire endpoint was
introduced to imitate unsupported features.

Completed in the latest continuation:

- fixed capability-learning contamination by scoping resource-specific 404 results
  to the resource/subservice that produced them, so one missing log view cannot
  disable logs for another application on the same Coolify version;
- reconciled the final Sources E2E expectations with the physical provider/scope/
  address table and kept upstream log errors generic while retaining Retry-After;
- expanded README coverage/omission notes and exact Coolify deployment guidance;
- the production image now runs Node 24 as the unprivileged `node` user, owns and
  defaults `WARMIFY_DATA_DIR` to `/data`, while Bun remains build-only;
- `.env.example` distinguishes the local cache path from Coolify's `/data` mount;
- documented a named Docker volume with empty Source Path, Destination `/data`,
  one replica, port 3000 and `/health` health check.

Final evidence:

- complete unit/contract suite: 435/435 tests in 59 files;
- `svelte-check`: zero errors and zero warnings;
- Prettier/ESLint clean; `git diff --check` clean apart from informational Windows
  line-ending notices; adapter-node production build succeeds;
- complete Playwright suite: 58/58 passed in one final-state run with one worker;
- configured-instance read-only smoke: nine dashboard/collection/search/system
  pages plus a Project → Environment → Resource hierarchy returned 200 through the
  Node production build; no form action or provider mutation was executed;
- zero configured-token/password hits in inspected SSR responses and zero configured
  credential or known fixture-secret hits in client/SSR build output, SQLite/WAL and
  Playwright cache artifacts.

The smoke also reproduced Bun's native SQLite N-API panic when Vite was launched
under Bun, then passed under the documented Node production runtime. Docker itself
is not installed on this Windows host, so a local `docker build` was unavailable;
the application build and Node runtime were both exercised directly.

No real Coolify or cloud-provider mutation or production deployment was performed.
On 2026-09-09 the verified checkout was moved from `service-parity` to
`coolify-parity-complete` and divided into ten logical commits. The branch remains
local until the user explicitly asks to push it.

## Previous checkpoint — Phase 9 complete; Phase 10 active

Do not restart the internal-endpoint, secret-redaction, SQLite sanitation or failure-
mapping audit. The public UI remains intentionally light/plain.

Completed in the latest continuation:

- every `/internal/*` endpoint now rejects unauthenticated requests with JSON 401;
  sensitive POST endpoints additionally enforce exact same-origin requests, bounded
  identifiers/queries and allowlisted operations;
- reveal endpoints validate their target shapes, return fixed safe failures and use
  `no-store`; optional 404/405/501 capabilities remain honest unavailable states;
- Coolify errors redact the configured token and sensitive submitted values before
  propagation, and audit events are recursively redacted with trusted timestamps;
- SQLite enables secure deletion and sanitizes historical JSON rows on open,
  removing malformed rows and truncating the WAL after a changed sanitation pass;
- the shared redactor now masks generic credential `key` fields such as S3 access
  keys while preserving environment-variable names and masking their values;
- dead generic System/project mutation surfaces were removed, and timeout, rate-
  limit, conflict, authentication, capability and server-failure behavior is bounded;
- targeted internal-security, audit, cache-sanitation, client-timeout and browser
  regressions cover the security boundaries discovered by the audit.

Fresh evidence:

- complete unit/contract suite: 434/434 tests in 59 files;
- `svelte-check`: zero errors and zero warnings;
- final Prettier/ESLint is clean and the adapter-node production build succeeds;
- security-hardening E2E: 2/2 passed after the security implementation;
- post-build scan: zero configured-credential hits outside `.env` and zero known
  fixture-secret hits in client/SSR output, build, SQLite/WAL or E2E cache artifacts.

A later attempt to combine the security and broad Warmify specs did not reach any
test body: both Playwright headless-shell and full-Chromium launch processes stalled
before opening their debugging channel on this Windows host. The experiment was
reverted; it does not supersede the completed 2/2 security execution.

No real Coolify or cloud-provider mutation, commit or push was performed. Branch
remains `service-parity`; preserve the entire dirty checkout.

Resume order:

1. Start Phase 10 by reconciling README and deployment documentation with the actual
   supported routes, SQLite single-replica/persistent-storage requirements and
   version-dependent omissions. Then run final acceptance, including a fresh full
   Playwright run when the local Chromium launcher is healthy.

## Previous checkpoint — Phase 8 complete; Phase 9 active

Do not restart the cross-cutting cache, compatibility, search or navigation work.
The public UI remains intentionally light/plain.

Completed in the latest continuation:

- SQLite-backed collections and dashboard now return cached snapshots immediately,
  refresh in the background, expose their last synchronization time and retain
  cached content with a non-blocking warning when live refresh fails;
- all cached list consumers use one visibility-aware, abortable synchronization
  controller with sequence guards, including dashboard, projects, infrastructure,
  administration lists and project resource counts;
- global search still has no persistent index: it searches recursively redacted
  list snapshots, paints cached results first and refreshes all searchable groups;
- Coolify version detection is bounded to a five-minute interval and optional
  capability availability is learned per version; 404/405/501 responses are
  presented as unavailable instead of leaking raw provider messages;
- unknown response fields are recursively redacted again at the shared presentation
  boundary and appear only in collapsed Additional data/operation-result details;
- keyboard focus has a visible outline, a skip link targets the main region,
  breadcrumbs use navigation semantics, common headers have column scope, and
  narrow tables scroll horizontally;
- the unused legacy interval poller was removed after all active polling consumers
  were verified to use abort, sequence and visibility guards.

Fresh evidence:

- complete unit/contract suite: 425/425 tests in 56 files;
- `svelte-check`: zero errors and zero warnings;
- navigation/cache/search E2E: 3/3, including repeated Back/Forward, refresh,
  stale cached rendering, visibility-triggered retry, keyboard focus and overflow;
- adapter-node production build succeeds; final Prettier/ESLint is clean.

No real Coolify or cloud-provider mutation, commit or push was performed. Branch
remains `service-parity`; preserve the entire dirty checkout.

Resume order:

1. Start Phase 9 with the internal JSON endpoint/authentication/origin audit, then
   scan SSR, SQLite, audit/error paths and Playwright artifacts for credential
   leakage before expanding failure-matrix coverage.

## Current checkpoint — Phase 7 complete; Phase 8 active

Do not restart the private-key, team/member, team shared-variable, notification or
System controller audits. Their public contracts and secret boundaries are frozen in
`docs/ADMINISTRATION_CAPABILITY_MATRIX.md`.

Completed in the latest continuation:

- cached-first private-key index, dedicated create/detail forms, safe metadata edit,
  explicit rotation, exact confirmation and in-use deletion guidance;
- private-key material excluded from SSR, SQLite, audit metadata and failed form
  values, with an authenticated same-origin fresh `no-store` reveal endpoint;
- token-bound team index/detail with a projected read-only member table and no
  invented membership mutations;
- physical team shared-variable administration with current-team ID verification,
  numeric variable ownership, CRUD, keep/replace/clear and protected reveal;
- strict local Coolify mocks for the new public endpoints and mutation contracts;
- six physical notification channel routes covering every documented delivery and
  event field, including all Telegram thread IDs;
- explicit keep/replace/clear behavior for all encrypted notification fields, with
  submitted credentials absent from action results and upstream responses discarded;
- `/system` health/version probes and confirmed API/MCP actions, with fresh root-team
  verification where possible and an API-enable recovery path when protected reads
  are already disabled;
- explicit access-loss warnings and honest unavailable state labels for API/MCP
  flags that the public API cannot read.

Fresh evidence:

- focused administration contracts: 35/35 passed;
- focused administration browser scenarios: 2/2 passed, covering private-key
  lifecycle and team/member/shared-variable behavior with secret-leak,
  wrong-confirmation and cross-origin assertions;
- notification contracts: 9/9 focused unit tests and 1/1 browser scenario passed
  across all six channels; Svelte check reports zero diagnostics;
- System contracts: 8/8 focused unit tests and 1/1 non-mutating browser scenario
  passed; the latest Svelte check still reports zero diagnostics;
- complete Phase 7 gate: 412/412 global tests in 52 files, 4/4 combined
  administration E2E scenarios, Prettier and ESLint clean, zero Svelte diagnostics,
  and successful adapter-node production build.

No real Coolify or cloud-provider mutation, commit or push was performed. Branch
remains `service-parity`; preserve the entire dirty checkout.

Resume order:

1. Continue Phase 8 at its first incomplete item. The historical SQLite/internal-
   endpoint security audit remains pending and belongs in that cross-cutting phase.

## Previous checkpoint — cloud tokens and cloud-init scripts complete

Do not restart the cloud credential/controller audit or CRUD implementation. The
public contract and deliberate write-only behavior are frozen in
`docs/CLOUD_SECURITY_CAPABILITY_MATRIX.md`.

Completed in this continuation:

- cached-first `/security/cloud-tokens` and `/security/cloud-init-scripts` indexes
  synchronize against the public API while writing only recursively redacted data
  to SQLite;
- physical create, General and Danger routes cover exact public CRUD operations,
  route UUID verification, same-origin mutations and safe errors;
- provider tokens are write-only, validated by Coolify at creation, and can only be
  renamed afterward because the public API has no rotation endpoint;
- token validation never relays provider messages, and deletion is disabled while
  its `servers_count` is nonzero;
- cloud-init bodies are write-only; edit uses a blank keep-or-replace textarea and
  never returns an existing script to the browser;
- `script` was added to recursive document redaction so even sensitive-read API
  responses cannot persist script bodies in SQLite;
- the sidebar exposes both new management families without changing the light/plain
  interface.

Fresh evidence:

- focused cloud security/redaction units: 10/10 passed;
- focused browser scenario: 1/1 passed through token create, validate, rename and
  delete plus script create, rename and delete with secret-leak assertions;
- post-slice global gate: 376/376 tests in 45 files, zero Svelte diagnostics, and
  adapter-node production build succeeds;
- final Prettier/ESLint rerun follows this documentation update.

No real Coolify or cloud-provider mutation, commit or push was performed. Branch
remains `service-parity`; preserve the entire dirty checkout.

Resume order:

1. Audit and implement DigitalOcean, Hetzner and Vultr provider provisioning using
   documented lookup endpoints and fresh typed confirmation for every billable
   creation.
2. Run the complete Phase 6 infrastructure E2E/gate and configured-instance
   read-only smoke. The historical SQLite/internal-endpoint security audit remains
   pending.

## Previous checkpoint — S3 storage family complete

Do not restart the S3 controller/view audit or the generic storage replacement. The
public contract and deliberate internal-only omissions are frozen in
`docs/S3_STORAGE_CAPABILITY_MATRIX.md`.

Completed in this continuation:

- `/storage` now uses an explicit projected list with cached-first synchronization,
  usable status, search and direct links to physical settings;
- physical `/storage/new`, General and Danger routes cover exact public CRUD fields,
  explicit `ListObjectsV2` validation and exact deletion confirmation;
- access/secret keys are write-only: required on creation, blank keep-or-replace on
  edit, excluded from presenters and recursively redacted before SQLite;
- changing endpoint, bucket, region or credentials marks the destination
  unvalidated until the user explicitly tests it;
- provider validation messages and mutation response bodies never cross the SSR
  boundary; Coolify remains authoritative for DNS allowlists and connectivity;
- deletion clearly preserves external bucket objects and does not rewrite dependent
  backup schedules;
- the internal Livewire-only storage Resources aggregate is intentionally omitted.

Fresh evidence:

- focused S3 contract/security units: 6/6 passed;
- `bun run check`: zero errors and zero warnings;
- focused `tests/e2e/s3-storage.spec.ts`: 1/1 passed through create, validate,
  credential rotation and deletion with secret-leak assertions.
- post-S3 global gate: 368/368 tests in 44 files, Prettier and ESLint pass,
  zero Svelte diagnostics, and adapter-node production build succeeds.

No real Coolify mutation, commit or push was performed. Branch remains
`service-parity`; preserve the entire dirty checkout.

Resume order:

1. Audit and implement cloud token, cloud-init and provider provisioning workflows,
   with fresh typed confirmation for billable operations.
2. Run the Phase 6 gate and configured-instance read-only smoke. The historical
   SQLite/internal-endpoint security audit remains pending.

## Previous checkpoint — Sources family complete

Do not restart the Sources audit or implementation. The pinned GitHub and GitLab
public controllers were read completely and the implemented support is frozen in
`docs/SOURCE_CAPABILITY_MATRIX.md`.

Completed in this continuation:

- `/sources` now combines GitHub and GitLab Apps, synchronizes on page load, and
  writes only recursively redacted provider-tagged snapshots to SQLite;
- physical GitHub/GitLab creation, General and Danger routes use numeric API IDs,
  current-team ownership checks, exact request allowlists and safe errors;
- private-key choices expose only ID/UUID/name/description; provider credentials are
  write-only on create and blank keep-or-replace inputs on edit;
- foreign system-wide sources are visible but read-only, matching Coolify's team-
  scoped mutation behavior;
- GitHub repository and branch discovery rechecks ownership and repository
  membership; unsupported GitLab discovery and private Livewire-only operations are
  not represented as working controls;
- deletion keeps Coolify's in-use conflict and never cascades into applications.

Fresh evidence:

- focused source/cache units: 8/8 passed;
- `bun run check`: zero errors and zero warnings;
- focused `tests/e2e/sources.spec.ts`: 2/2 passed, covering both provider lists,
  GitHub discovery and GitLab create/rotate/delete with secret-leak assertions.
- post-Sources global gate: 362/362 tests in 43 files, Prettier and ESLint pass,
  zero Svelte diagnostics, and adapter-node production build succeeds.

No real Coolify mutation, commit or push was performed. Branch remains
`service-parity`; preserve the entire dirty checkout.

Resume order:

1. Continue Phase 6 with S3 storage CRUD and explicit validation.
2. Audit and implement cloud token/cloud-init/provisioning flows, with fresh typed
   confirmation for billable operations.
3. Run the Phase 6 gate and configured-instance read-only smoke. The historical
   SQLite/internal-endpoint security audit remains pending.

## Previous checkpoint — server family complete

Do not restart server creation or destinations. The server family is now complete
for every supported public endpoint in the pinned reference. New work in this
continuation:

- physical `/servers/new` creation using an owned private-key choice, local
  IP/hostname, SSH and proxy validation, an exact POST allowlist and accurate
  asynchronous-validation wording;
- private-key SSR projection contains UUID/name/description only and never key
  material;
- physical `/servers/[uuid]/destinations` list/create route with exact parent
  ownership and no invented Docker-network scan endpoint;
- physical destination General and Danger routes with seven-field projection,
  name-only PATCH, readonly network/type/server, attached-resource conflict guidance,
  exact confirmation and a local guard for the default `coolify` network;
- destination rows and the global destination index now link to the physical General
  route; server navigation includes Destinations.
- physical API Availability explicitly lists supported, development-only and
  no-public-API server capabilities; unsupported rows have no action links and no
  private endpoint fallback.

The first browser run found a real duplicate `cache-control` header between the
server layout and destinations child loader. The child header was removed. Fresh
evidence after the fix:

- full unit/contract suite: 353/353 tests in 41 files;
- `bun run check`: zero errors and zero warnings;
- lint: Prettier clean and ESLint exit 0;
- adapter-node production build: exit 0;
- full `tests/e2e/servers.spec.ts`: 3/3 scenarios passed, covering server creation,
  destination create/edit/delete and the existing long server settings/secret/Back
  scenario.

No real Coolify mutation, commit or push was performed. The strict local mock owns
all browser mutations and cleans created fixtures. Branch remains `service-parity`;
preserve the entire dirty checkout.

Resume order:

1. Continue Phase 6 with Sources (GitHub/GitLab app management and documented
   repository/branch discovery).
2. Finish S3 storage CRUD/validation, then cloud token/provisioning workflows with
   explicit confirmation for billable operations.
3. Run the Phase 6 gate and configured-instance read-only smoke. The historical
   SQLite/internal-endpoint security audit remains pending.

## Previous checkpoint — server operations implemented; browser gate partially blocked

Do not restart the Phase 6 server slice. Dedicated routes are now implemented for
Docker Cleanup, Proxy, Cloudflare Tunnel, Sentinel and Log Drains. Server navigation
includes each route. The frozen endpoint manifest now also includes the documented
`PUT /servers/{uuid}/proxy/configuration`; a regression test first failed on the
missing entry and passed after the minimal manifest correction.

Security boundaries in the completed slice:

- page loaders project allowlisted metadata and never return raw proxy configuration,
  Sentinel token/custom URL, log-drain keys or custom Fluent Bit documents;
- Proxy, Sentinel and Log Drains use authenticated, same-origin, explicit `no-store`
  reveal requests rather than generic SSR or operation results;
- the shared reveal component aborts stale requests and clears values when hidden or
  destroyed;
- Sentinel and Log Drains use keep/replace/clear writes and typed confirmations;
- cleanup run, proxy restart and tunnel enable/disable require fresh confirmation and
  no mutation is automatically retried;
- Cloudflare Tunnel copy describes stored API state only and does not claim remote
  cloudflared installation or removal.

Fresh evidence from this continuation:

- focused endpoint/server-operation units: 26/26 in 6 files;
- `bun run check`: zero errors and zero warnings;
- adapter-node production build: exit 0;
- manual in-app browser pass against the strict local mock: login, server physical
  navigation, Proxy → Tunnel → Docker Cleanup Back history, no fixture secrets before
  reveal, explicit Sentinel and Log Drains reveal, values cleared after hide, and no
  console errors or warnings;
- lint reached Prettier and found only this already-modified roadmap document
  unformatted; format the updated docs and rerun lint before closing the block.

Automated server E2E did not execute a product assertion. Two headless attempts and
one headed Chromium attempt each launched the browser process but timed out after
180 seconds establishing `remote-debugging-pipe`. Both installed executables answer
`--version`, all runner processes were cleaned after each attempt, and the equivalent
manual browser path passed. Do not claim the Playwright gate passed; retry it once in
a healthy browser environment before the Phase 6 server gate closes.

Resume order:

1. Format these documentation updates and rerun lint. No product source change is
   currently indicated by the browser-launch failure.
2. Continue with server creation and server-owned destination integration using the
   pinned public API and `SERVER_CAPABILITY_MATRIX.md`.
3. Add explicit unavailable/version-dependent states for development-only server
   transfer/export/migrate and other unsupported sidebar capabilities.
4. Rerun the server Playwright scenario, then the full Phase 6 gate when the remaining
   infrastructure families are complete.

No real Coolify mutation, commit or push was performed. Temporary mock/Vite servers
and the agent-created browser tab were closed. Branch remains `service-parity`; keep
the entire dirty checkout. Configured-instance read-only smoke and the historical
SQLite/internal-endpoint security audit remain pending.

## Previous checkpoint — paused during Phase 6 server operations

Pause requested at 4% usage. Do not restart Phase 6 from the beginning.

Completed and focused-validated in this continuation:

- Server shared variables at physical `/servers/[uuid]/environment-variables`, with
  route-owned CRUD/reveal against `/servers/{uuid}/envs` and no plaintext in SSR.
- Server Advanced and Danger. Advanced sends only documented scalar settings;
  Danger blocks the local host and requires exact server plus force-cascade phrases.
- Docker Cleanup settings, latest-20 execution projection, and confirmed manual run.
- Proxy metadata/settings/restart plus explicit `no-store` configuration reveal and
  base64 UTF-8 configuration save. Raw Compose never enters SSR.
- Cloudflare Tunnel implementation and routes were added. Unit tests and mock/E2E
  coverage were written, but this slice has **not yet been run** after the low-usage
  pause.

Important bug found and fixed: child server loaders duplicated the layout's
`cache-control: no-store` header after enhanced actions, causing a 500/stuck page.
The header now belongs only to `servers/[uuid]/+layout.server.ts`; the server variable
and Docker cleanup child loaders no longer set it.

In progress, not complete:

- `src/lib/server/server-sentinel.ts` and
  `src/lib/server/server-sentinel.test.ts` were added immediately before the pause.
  They are **unformatted and untested**, and there are no Sentinel route/UI/mock/E2E
  additions yet. Inspect and run the focused test before continuing.
- Log Drains has not been implemented.
- Cloudflare Tunnel still needs formatting, focused tests, static check and browser
  validation together with Sentinel/Log Drains.

Last confirmed evidence before the unfinished Tunnel/Sentinel work:

- shared-variable focused tests: 27/27;
- server-page focused tests: 9/9;
- Docker cleanup focused tests: 3/3, then combined regression 7/7;
- Proxy focused tests: 5/5;
- Svelte check: zero diagnostics through Proxy;
- server Playwright scenario passed through Proxy and Docker Cleanup.

Resume order:

1. Format and inspect `server-sentinel.ts`/test; run its focused test and fix issues.
2. Add physical Sentinel route/UI, safe reveal endpoint, mock handlers and E2E.
3. Format/run the existing Tunnel focused test, then validate its browser path.
4. Implement Log Drains with non-secret SSR and write-only replacements plus explicit
   sensitive reveal.
5. Run the combined server focused unit/check/E2E block, update
   `SERVER_CAPABILITY_MATRIX.md`, then proceed to server creation/destinations.

No full repository gate, real Coolify mutation, commit or push was performed in this
continuation. Branch remains `service-parity`; preserve the dirty tree.

## Previous checkpoint — Phase 6 server configuration complete

Server shared variables now have a physical
`/servers/[uuid]/environment-variables` route while safely targeting Coolify's
server env API. CRUD and reveal verify route ownership; SSR and mutation responses
exclude plaintext values. Advanced exposes the supported public scalar settings with
local range validation. Danger blocks the local host and requires exact server plus
force-cascade confirmations before a single DELETE.

Focused evidence: 27/27 shared-variable unit tests, 9/9 server-page unit tests,
zero Svelte diagnostics and the full server Playwright scenario pass. No real Coolify
mutation was performed.

Next: implement dedicated Docker cleanup, Proxy, Cloudflare Tunnel, Sentinel and Log
Drains routes from `docs/SERVER_CAPABILITY_MATRIX.md`, preserving their sensitive-read
and explicit-confirmation boundaries. Run the full repository gate at the end of the
server phase.

No production mutations, commit or push. Preserve dirty tree. No subagents/design
skills. Phases 6–10, configured-instance read-only smoke and historical SQLite/
internal-endpoint security audit remain active.

## Previous checkpoint — Phase 6 server core complete

Phase 5 remains complete. Phase 6 now has a full pinned-reference audit in
`SERVER_CAPABILITY_MATRIX.md`: all public server controllers, routes 151–201 and
the Coolify server/proxy/Sentinel/security sidebars were read. Transfer/export/
migrate is explicitly development-only because the controller constructor returns
404 outside Coolify dev mode. CA certificate, Swarm, Terminal, patching, metrics
charts, proxy dynamic config/logs and Sentinel logs have no pinned public endpoint.

The generic server detail was replaced by a physical `/servers/[uuid]` layout with
General, Resources, Domains and Validation routes. `server-pages.ts` projects all
server data through a scalar allowlist before SSR, verifies exact route identity
before mutation and never serializes arbitrary backend results. General sends one
allowlisted PATCH. Validation is hydration-gated, explicitly confirmed, sends one
POST with `{ install }` and never retries. Resources link only recognized app,
service and database UUIDs; domain arrays are normalized.

Verification: 314/314 units in 33 files, 42/42 full-suite E2E with one worker,
zero Svelte diagnostics, lint and adapter-node build passed. The new browser test
covers editing, secret exclusion, typed resource links, domains, validation and
Back navigation. An initial full run exposed mock state leaking the renamed server
into the dashboard test; fixture cleanup now runs in `afterEach`, and the rerun is
green. No real Coolify calls or mutations were made.

Next: server-scoped shared variables (reuse the existing safe reveal/update model
without project hierarchy assumptions), then Advanced and Danger. After that add
dedicated Docker Cleanup, Proxy, Cloudflare Tunnel, Sentinel and Log Drains routes.
Raw proxy configuration, Sentinel tokens, drain keys and custom configs must never
enter SSR or SQLite. Manual cleanup/proxy restart/tunnel state/delete require fresh
confirmation and no automatic retry.

No production mutations, commit or push. Preserve dirty tree. No subagents/design
skills. Phases 6–10, configured-instance read-only smoke and historical SQLite/
internal-endpoint security audit remain active.

## Previous checkpoint — Phase 5 complete; infrastructure next

Phase 5 is complete on `service-parity`. Deployment detail now uses a dedicated
no-store loader and scalar allowlist, resolves numeric application IDs through
permitted metadata, and exposes physical project/environment/application context.
Visible log output is parsed from Coolify's log array, hidden/command/configuration
data is omitted, recognizable credentials are redacted and the tail is bounded to
200,000 characters. Active details poll every five seconds only while visible,
abort stale work on navigation and stop on terminal status.

Cancellation requires auth, exact same origin, fresh confirmation and a live
queued/in-progress re-check before exactly one POST to the route UUID. Upstream race
refusals are safe and never retried. Success is POST-Redirect-GET; the enhanced form
replaces its current history entry so Back/Forward works without a duplicate same-
URL entry or a stuck skeleton. Direct forged/unconfirmed requests remain rejected.

Final verification: 309/309 units in 32 files, 5/5 focused deployment E2E and
41/41 full-suite E2E with one worker, zero Svelte diagnostics, lint and adapter-node
build passed. Client deployment fixture-secret scan and diff-check clean. The gate
first exposed a cancellation-history regression and a Windows CRLF-specific test
expectation; both were corrected. The initial eight-worker Playwright attempt was
discarded because Chromium launch itself timed out under contention; no product
assertion ran in those failed workers.

Next: Phase 6 infrastructure. Audit the complete pinned server sidebar/controllers
and public route/endpoint-manifest support before implementing server General,
resources, domains, validation, variables, proxy, cleanup, tunnel, Sentinel, log
drains, migration/export/transfer and danger routes. Unsupported or version-only
features must remain explicit; do not synthesize private Coolify calls.

No production mutations, commit or push. Preserve the dirty checkout. No subagents
or design skills. Full goal, Phases 6–10, configured-instance read-only smoke and
the historical SQLite/internal-endpoint security audit remain active.

## Previous checkpoint — deployment initiation and active index

Phase 5 remains active on `service-parity`. Added focused
`deployment-actions.ts`, `deployment-presenter.ts`, physical `/deployments/new`
and `DeploymentForm.svelte`. UUID/tag selections support force rebuild and UUID-only
preview ID/Docker tag fields. Inputs validate before the single POST, require auth,
same origin and fresh confirmation, retain safe drafts, and never retry. Per-target
outcome enums and references replace backend text. Missing targets are visible;
429/timeouts warn that some resources may already have started. Inventory is
invalidated even on uncertain outcomes. Skipped duplicate requests suppress the
upstream controller's potentially unused UUID rather than linking to a missing job.

Deployment index is now dedicated, explicitly active-only, with cached rendering
and five-second visible polling even when empty. Deployment collection writes and
active polling use scalar metadata only, no logs/snapshots. Numeric-key responses
and nested server/environment names are supported. Old SQLite rows were not purged.
Do not claim the historical security audit is complete.

Current verification: 292/292 units in 31 files, zero check diagnostics (20625),
38/38 full-suite E2E (27689 terminal exit 0). Final lint 66494 and build 28222
terminal exit 0. Client fixture-secret scan and diff-check clean. No live handles.
First gate found test optional-field typing and an exact-label locator mismatch,
plus lost nested server names in the cache projector. All corrected, with extra
contracts covering SQLite-write boundary, nested names, and duplicate deployment
suppression. No source changes occurred while E2E was running.

Next: deployment detail + cancellation + navigable application/project/environment
context + unified logs/status polling. Detail routes still use the generic resource
loader, so the Phase 5 gate is NOT complete. Full controller audit and model/log
notes are in `DEPLOYMENT_CONTRACTS.md`. Resolve numeric application IDs from allowed
metadata, never use them as UUIDs. Add explicit cancellation confirmation, verify
current cancellable status before POST, and handle upstream race refusal safely.
Log entries have output/type/timestamp/hidden/command fields: do not render command
or configuration blobs. Add queued/running/finished/failed/cancelled and visibility/
history E2E before the Phase 5 close. Keep tests batched at meaningful boundaries.

No production mutations, commit or push. Preserve dirty tree. No subagents/design
skills. Full goal and Phases 5–10 remain active; real read-only smoke and historical
SQLite/internal-endpoint security audit are pending.

## Previous checkpoint — service-template creation complete; Phase 5 next

Active on `service-parity`. Template creation is implemented in
`template-creation.ts`, using the shared `ResourceCreationForm.svelte` (renamed
from DockerCreationForm). The new-resource selector includes Service template.
Only public POST `/services` is used; explicit type input explains the missing
public GET catalog. No invalid POST probing or automatic retry. Failed real user
submissions may surface normalized type suggestions returned by Coolify.
Payloads exclude generated credentials and Compose/application fields. Parent
UUIDs are verified, safe drafts retained, backend error snippets discarded and
successful UUID responses redirect directly to physical service general pages.

The first full E2E run was 35/36: missing-environment creation routes returned 500
because CoolifyError 404 escaped the page loader. Both loaders now translate only
that upstream 404 to a safe Svelte 404. Rerun passed 36/36 (82828, terminal exit 0).
Final units 268/268 in 28 files, check 0 errors/0 warnings (17258), build 49001 exit 0.
Client fixture-secret scan and diff-check clean. Final lint 84202 terminal exit 0.
All verification processes are terminal. No production mutation, commit or push.

Phase 4 implementation/gates are complete.
Next: Phase 5 deployment center. `docs/DEPLOYMENT_CONTRACTS.md` records the complete
read of pinned `DeployController.php` and public routes. Global GET `/deployments`
is active-only, history is per app, UUID/tag POST responses differ and multi-target
deploy can partially execute before 429. No automatic retry. Current deployment
routes remain generic. Next implement focused deploy/cancel helpers and safe
presenters, then physical pages/polling/context and browser tests as one block.
Read model log shape and metadata before presenter work. Keep tests batched.

Full goal remains active; Phases 5–10 and historical foundation/security items
remain. No subagents or design skills. Configured-instance read-only smoke and
historical SQLite security audit remain pending. Preserve the entire dirty tree.

## Previous checkpoint — Git creation slice complete

Active on `service-parity`. Public Git, deploy-key and GitHub App creation now use
`git-creation.ts`, shared `git-creation-fields.ts` and `GitCreationForm.svelte`.
All five build packs have conditional fields; Compose omits ordinary domains/ports.
GitHub discovery uses numeric App IDs and metadata-only repository/branch lists,
creation uses UUIDs. Parent and selected credential membership checks precede POST.
Repository credentials are rejected/not restored; custom commands are write-only;
backend snippets never enter action errors. Routes dispatch focused helpers and
the obsolete generic action/form branches were removed from the physical routes.

Final gates: 256/256 unit tests (27 files), 34/34 E2E (30578 terminal exit 0), check
zero errors/warnings (11178), lint (56093) and build (17633), all terminal exit 0.
Client fixture-secret scan and diff-check clean. All processes terminal. First
validation found a unit setup callback returning its mock as a cleanup function,
and a formatter/parser issue in a Svelte ternary each expression. Fixed both;
no pending known local failure. Tests remain batched at meaningful-block boundaries.
No real Coolify mutations, commit or push; preserve the entire dirty checkout.

Next: service-template creation, then final Phase 4 gate and Phase 5. Contracts in
`docs/RESOURCE_CREATION_CONTRACTS.md`. `ServicesController.php:476–587` template
branch and `bootstrap/helpers/shared.php:1422` template getter were read. API routes
have no GET catalog: support explicit template type without inventing an endpoint
or sending an invalid POST just to discover names. Controller accepts `type`
instead of Compose, generates variables/containers and returns UUID/domains. Audit
remaining optional inputs and test this supported flow. Keep catalog limits explicit.

Phase 4 and full goal remain active. No subagents or design skills. Configured-instance
read-only smoke and historical SQLite security audit remain pending; do not echo
the credentials previously exposed in screenshots.

## Previous checkpoint — Docker creation slice complete

Active on `service-parity`, user resumed. The Dockerfile, Docker image and inline
Compose routes now use `docker-creation.ts` and `DockerCreationForm.svelte`.
Dockerfile and Compose source are base64-encoded; values are write-only and API
parser errors are never echoed. Image references preserve embedded tags/digests;
separate tag/digest inputs are mutually exclusive and `latest` is not appended.
Route-owned project/environment UUIDs are verified before creation. Physical
creation-page loads now reject parent identity mismatches as well. No real API
mutations, commit or push. Existing database creation and shared variables retained.

Added 20 unit cases and three E2E scenarios with a strict Docker creation fixture.
Final verification: 231/231 unit tests, 26 files; 31/31 E2E (70016 terminal exit 0);
check zero errors/warnings (13060), lint (8393) and build (97433) terminal exit 0.
Client fixture-secret scan found no matches; diff-check passed. No running handles.
First unit run failed two multipart CRLF expectations; first check found three
typing issues. Fixed, final gates passed. Do not rerun before a new meaningful block.

Next: Git-based creation (public, deploy key, GitHub App), then service templates.
Use `docs/RESOURCE_CREATION_CONTRACTS.md` for the audited slice and next entry points.
Shared Git validators in `bootstrap/helpers/api.php:113` and cleanup `:366` read;
initial public/GitHub/deploy-key branch validation read, but full Git audit remains.
GitHub discovery controller is `GithubController`, not `GithubAppsController`.
Current generic Git actions still need conditional build fields, parent ownership
and safe errors. Old Docker branches in those generic action/page files are now
unreachable; remove with the Git rewrite. Phase 4 and the full goal remain open.

## Previous shared-variable checkpoint

User resumed with “Nevermind, continua XD”; work is active on `service-parity`.
Shared variables are implemented for both projects and environments: physical
routes, numeric-ID scoped CRUD, keep/replace/clear values, metadata-only SSR,
exact loaded-key deletion confirmation, and dedicated authenticated same-origin
no-store reveal. Shown-once/missing values cannot be revealed; pending reveal
requests cancel and displayed values clear on hide/navigation. No bulk endpoint
was invented and the broader generic internal reveal endpoint was not expanded.

Verification: 211/211 unit tests (25 files), 28/28 browser scenarios, check with
zero errors/warnings (14230), final lint 34242 exit 0. Final build 68591 exit 0;
the old build handle was unreadable, so only build was repeated after resume.
Client fixture-secret scan found no matches; diff-check passed. All handles are
terminal. No production mutations, commit or push. Contract checklist and roadmap
shared-variable item are now closed; Phase 4 and the overall goal remain open.

Next: audit and rebuild remaining application/service creation variants, preserving
completed database creation. `ApplicationsController::create_application` starts
at 1181 in the pinned reference. Initial concrete finding: inline Dockerfile must
be base64-encoded (2070), but the current generic action passes raw content. Read
the complete relevant branches before implementation. Also audit route-owned
environment identity, conditional build fields and safe API errors. Current
`new/[kind]` action and Svelte page plus `resource-actions.ts` need focused helpers.

Keep tests batched at meaningful-block boundaries; no subagents/design skills.
Configured-instance read-only smoke and historical SQLite audit remain pending.

## Historical CRUD checkpoint

User briefly asked to pause, then explicitly resumed in the same turn. Work is active.
Branch `service-parity`; existing dirty checkout preserved. No commit, push or real
Coolify mutation. This handoff supersedes the older session block in the roadmap.

## Completed in this block

- Added `src/lib/server/project-actions.ts`: focused project/environment create,
  update, delete and settings context. Parent UUID checks, allowlisted fields,
  upstream Unicode validation, safe input preservation and field errors, exact
  deletion confirmation, inventory invalidation and metadata-only audit logs.
- Project creation does not issue a second environment request: Coolify creates
  `production`. Environment creation sends **only name** and redirects to the new
  environment. Populated parent deletion is refused by Coolify, never bypassed by
  deleting resources.
- Added physical settings/danger routes under both projects and environments,
  `HierarchyForm.svelte` and `HierarchySettings.svelte`. Added overview links and
  active-blue/underlined settings navigation. All light/plain styling preserved.
- Project collection/detail now expose focused actions instead of the generic
  factories. Older generic helper branches remain in their original modules but
  are not used by these project routes.
- Added 20 unit cases in `project-actions.test.ts`, two browser scenarios in
  `tests/e2e/projects.spec.ts`, and a stateful `tests/mock-projects.ts` fixture.
- Fixed hydration races found by E2E: creation details no longer assign `open=false`
  during hydration; `HierarchyForm` uses `bind:value` and initial untracked drafts
  to preserve edits made before hydration. Its parent is keyed by identity/section.
- Audited shared-variable controllers/model/validators for the next block; recorded
  numeric IDs, optional PATCH values, scope checks and secret boundaries in
  `docs/SHARED_VARIABLE_CONTRACTS.md`. Shared-variable UI is NOT implemented yet.

## Verification

- `bun run test`: **188/188**, 24 files, exit 0.
- `bun run check`: **0 errors, 0 warnings**, final handle 72036 terminal exit 0.
- `bun run test:e2e --workers=1`: **26/26**, final handle 79198 terminal exit 0.
- Initial E2E runs each passed 25/26: first exposed early-hydration details closure,
  second exposed early-hydration input replacement. Both fixed without sleeps or
  weakening assertions. Initial check had three dynamic-link typing errors;
  explicit `/projects/${string}` return type fixed them.
- Full lint passed before the final hydration changes (handle 51707 exit 0).
- Final build **2727** and lint **55099** are now terminal, both exit 0.
- Final client fixture-secret scan found no matches, and final diff-check passed.
- Code verification is complete. This handoff is being formatted with the roadmap
  and contract documents after their final status update.

## Resume order

1. CRUD checkbox and the first implementation slice in
   `docs/PROJECT_ENVIRONMENT_CONTRACTS.md` are closed. Do not rerun finished gates
   before making a new meaningful block of changes.
2. Implement scoped project/environment shared-variable physical routes and CRUD
   using `docs/SHARED_VARIABLE_CONTRACTS.md`. Do not reuse resource variable UUIDs,
   PATCH-by-key endpoints or nonexistent bulk APIs. Audit the reveal boundary
   before adding on-demand reveal.
   The existing generic `/internal/reveal` calls executeOperation with raw reveal
   enabled and lacks its own explicit JSON-origin check. Do not widen that generic
   endpoint; inspect `internal/databases/[uuid]/credentials/+server.ts` and use a
   dedicated authenticated, explicit same-origin no-store handler for the selected
   parent/numeric variable ID. Global hooks enforce session auth, but JSON requests
   need explicit origin handling. Shared-variable helpers/model have been read;
   no shared-variable implementation code has been added yet.
3. Continue remaining application/service creation variants, then later phases.
   Phase 4 and the full persistent goal are NOT complete.

Keep tests batched at meaningful-block boundaries. No subagents or design skills.
Never edit source or build while Playwright owns mock API4010/Vite4173. No real
mutation/smoke, commit or push without appropriate authorization. Historical SQLite
redaction audit and configured-instance read-only smoke remain pending. Credentials
exposed in earlier screenshots require external rotation; do not echo them.
