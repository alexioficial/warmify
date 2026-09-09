# Warmify Implementation Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended when the user explicitly authorizes subagents) or `superpowers:executing-plans` to implement this plan task-by-task. Keep every checkbox current before ending a work session.

**Goal:** Deliver a server-rendered Warmify administration panel that follows Coolify's Project → Environment → Resource mental model, exposes every useful operation supported by Coolify's public API, and never sends the root API token to the browser.

**Architecture:** Coolify remains the only source of truth. SvelteKit server loads and form actions call an allowlisted, typed Coolify client; SQLite stores only recursively redacted, disposable collection snapshots for fast navigation. Physical SvelteKit routes provide independent customization points while focused shared components provide consistent tables, forms, lifecycle controls, error handling, and polling.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript 6, Bun, `better-sqlite3`, Vitest, Playwright, adapter-node.

**Spec:** The product contract, constraints, route policy, execution order, and acceptance criteria are contained in this document. The read-only UI reference is `C:\Users\pc\Desktop\_\Programming\Widube\coolify_reference` at commit `8d675f2e2` (`v4.3.14-4` when this roadmap was written).

## Global Constraints

- Warmify uses only documented Coolify `/api/v1` endpoints listed in `src/lib/server/endpoint-manifest.ts`; it never calls internal Livewire routes.
- The Coolify repository is a read-only reference for hierarchy, terminology, field grouping, empty states, and workflows—not a source to copy its PHP, Livewire, Tailwind, or dark theme.
- UI copy is English. The application is light-only and keeps the browser/SvelteKit default font.
- CSS is limited to alignment, layout, spacing, size, responsive behavior, borders, and basic state colors. No Tailwind, shadows, animation, decorative effects, icon system, themes, or design skills.
- `COOLIFY_API_TOKEN` remains server-only. Secrets are recursively redacted before SSR, caching, errors, or audit logs.
- Mutations use POST form actions with origin protection. Mutations are never automatically retried.
- Stop/restart/cancel/move/migrate/rollback operations require confirmation. Irreversible deletion requires the exact resource name or UUID.
- `WARMIFY_ADMIN_PASSWORD` remains plain text in `.env`, as requested. Sessions contain only username and expiry and are signed server-side.
- SQLite contains only redacted inventory snapshots. Variables, logs, revealed secrets, and detailed mutable configuration are never cached.
- Large changes must finish with `bun run check`, affected Vitest tests, `bun run lint`, and `bun run build`. Phase gates additionally run `bun run test` and relevant Playwright E2E tests.
- A real Coolify smoke test is read-only unless separate mutation variables and explicit activation are provided.
- Preserve user changes already present in the worktree and do not perform destructive Git operations.

---

## Status legend

- `[x]` Implemented and previously validated.
- `[~]` Implemented or partially implemented, but still being expanded or awaiting regression validation.
- `[ ]` Not started.
- `[-]` Intentionally omitted because the public API cannot support it safely.

## Current checkpoint

**Active phase:** Complete. Phases 0–10 have passed their acceptance gates.

**Next task:** No implementation phase remains. Use `docs/PAUSE_HANDOFF.md` for the final evidence and deployment notes.

**Latest validation state:** On 2026-09-08, the final state passed 435/435 global unit/contract tests in 59 files, all 58/58 Playwright scenarios in one run, Prettier and ESLint, zero Svelte diagnostics, the adapter-node production build, a configured-instance read-only smoke through the Node runtime and zero-hit credential/fixture-secret scans. Current branch: `service-parity`; no commit, push or production mutation in the final continuation.

**Resume rule:** Start at the first unchecked item in the active phase. Do not begin a later phase while an earlier phase gate is incomplete unless the user explicitly reprioritizes it.

---

## Phase 0 — Existing foundation

### Task 0.1: Server-only configuration and authentication

**Primary files:**

- `src/lib/server/config.ts`
- `src/lib/server/auth.ts`
- `src/hooks.server.ts`
- `src/routes/login/+page.server.ts`
- `src/routes/logout/+server.ts`
- `.env.example`

- [x] Read `COOLIFY_BASE_URL`, `COOLIFY_API_TOKEN`, `WARMIFY_ADMIN_USERNAME`, `WARMIFY_ADMIN_PASSWORD`, request timeout, session TTL, and data directory from private environment variables.
- [x] Authenticate one administrator without persisting users.
- [x] Sign an HttpOnly, SameSite=Strict session cookie and enforce expiration.
- [x] Protect every route except login and health.
- [x] Rate-limit login failures per IP.
- [x] Validate origins for mutations, including logout.

### Task 0.2: Coolify API boundary

**Primary files:**

- `src/lib/server/coolify-client.ts`
- `src/lib/server/endpoint-manifest.ts`
- `src/lib/server/redact.ts`
- `src/lib/server/runtime.ts`

- [x] Normalize base URLs and attach Bearer authentication server-side.
- [x] Support JSON and text responses, request timeout, `Retry-After`, and normalized errors.
- [x] Maintain an allowlist instead of exposing an arbitrary proxy.
- [x] Recursively redact sensitive response fields.
- [x] Write metadata-only structured audit events to stdout.
- [x] Reconcile the frozen endpoint manifest with the cloned Coolify commit before each family phase; the final family matrices use pinned reference commit `8d675f2e2`.

### Task 0.3: Fast inventory and navigation

**Primary files:**

- `src/lib/server/cache-database.ts`
- `src/lib/server/inventory-cache.ts`
- `src/routes/internal/poll/collections/[group]/+server.ts`
- `src/routes/internal/poll/dashboard/+server.ts`
- `src/routes/+layout.svelte`

- [x] Store redacted collection snapshots in SQLite.
- [x] Render cached dashboard and collection data immediately, then synchronize from Coolify.
- [x] Stop polling while the browser tab is hidden.
- [x] Show the destination URL and a page skeleton immediately during client navigation.
- [x] Regression-test rapid Back/Forward navigation and stale navigation cancellation (Phase 8 navigation/cache E2E).

### Task 0.4: Project hierarchy

**Primary files:**

- `src/routes/projects/+page.svelte`
- `src/routes/projects/[uuid]/+page.svelte`
- `src/routes/projects/[uuid]/environments/[environment]/+page.svelte`
- `src/routes/projects/[uuid]/environments/[environment]/new/+page.svelte`
- `src/lib/resource-presenter.ts`

- [x] Remove “All resources” from the primary navigation.
- [x] Navigate Project → Environment → Resource through physical routes.
- [x] Make project cards and resource rows fully clickable.
- [x] Count environments and nested resources using normalized Coolify responses.
- [x] Validate create-project plus automatic `production` environment behavior against the pinned public API contract and project E2E fixture without mutating the configured instance.
- [x] Validate the complete new-resource flow after application routing changes across Dockerfile, Compose, image, Git, template and database E2E scenarios.

### Phase 0 gate

- [x] Run `bun run check` and record zero diagnostics (2026-08-28).
- [x] Run `bun run test` and record all unit/contract tests passing (47 tests on 2026-08-28).
- [x] Run the navigation/auth hierarchy suite in `tests/e2e/warmify.spec.ts` (4 tests on 2026-08-28).
- [x] Close the remaining partial Phase 0 verification items before marking the foundation complete.

---

## Phase 1 — Application detail parity (ACTIVE)

### Task 1.1: Freeze the application capability matrix

**Reference files:**

- `C:\Users\pc\Desktop\_\Programming\Widube\coolify_reference\resources\views\components\application\configuration-sidebar.blade.php`
- `C:\Users\pc\Desktop\_\Programming\Widube\coolify_reference\resources\views\livewire\project\application\general.blade.php`
- `C:\Users\pc\Desktop\_\Programming\Widube\coolify_reference\routes\api.php`
- `C:\Users\pc\Desktop\_\Programming\Widube\coolify_reference\app\Http\Controllers\Api\ApplicationsController.php`

**Warmify files:**

- Create: `docs/COOLIFY_APPLICATION_CAPABILITY_MATRIX.md`
- Modify: `src/lib/server/endpoint-manifest.ts`
- Test: `src/lib/server/endpoint-manifest.test.ts`

- [x] List every application screen/section visible in Coolify and its controlling fields.
- [x] Map every screen to exact public GET/PUT/PATCH/POST/DELETE operations.
- [x] Mark Terminal and Metrics as omitted unless a documented public endpoint exists.
- [x] Mark partially supportable screens explicitly—for example Preview Deployments when deletion exists but public listing does not.
- [x] Add any documented application endpoint missing from Warmify's manifest.
- [x] Add a manifest assertion for every supported matrix row.
- [x] Run `bun run test -- src/lib/server/endpoint-manifest.test.ts` (5 tests passed on 2026-08-28).

### Task 1.2: Stabilize the shared application shell and route model

**Files:**

- Modify: `src/routes/applications/[uuid]/+layout.server.ts`
- Modify: `src/routes/applications/[uuid]/+layout.svelte`
- Modify: `src/lib/server/application-pages.ts`
- Modify: `src/lib/resource-routes.ts`
- Test: `src/lib/resource-routes.test.ts`
- Test: `tests/e2e/warmify.spec.ts`

- [x] Redirect `/applications/[uuid]` to `/applications/[uuid]/general`.
- [x] Use physical routes for General, Application details, Access, Build pipeline, Networking, Healthcheck, Environment variables, Persistent storage, Scheduled tasks, Deployments, and Runtime logs.
- [x] Add every supported Coolify application menu destination from Task 1.1 as a physical route.
- [x] Derive Project and Environment breadcrumb links from the application response instead of showing a detached Applications hierarchy.
- [x] Keep the application record in the parent layout so switching child routes does not refetch it unnecessarily.
- [x] Gate menu items by build pack, Git-backed state, and API capability.
- [x] Keep hover underline and active blue underline based on pathname.
- [x] Add E2E coverage for direct loads, link navigation, Back/Forward, active state, and skeleton completion (4 E2E tests passed on 2026-08-28).

Route placeholders created by this task intentionally contain no unsupported controls; Tasks 1.3–1.9 replace them with API-backed sections.

### Task 1.3: Complete editable General subsections

**Files:**

- Modify: `src/lib/server/resource-groups.ts`
- Modify: `src/lib/components/ApplicationConfigurationSection.svelte`
- Modify: `src/routes/applications/[uuid]/application-details/+page.svelte`
- Modify: `src/routes/applications/[uuid]/access/+page.svelte`
- Modify: `src/routes/applications/[uuid]/build-pipeline/+page.svelte`
- Modify: `src/routes/applications/[uuid]/networking/+page.svelte`
- Create: `src/routes/applications/[uuid]/container-image/+page.svelte`
- Create: `src/routes/applications/[uuid]/runtime/+page.svelte`
- Create: `src/routes/applications/[uuid]/security/+page.svelte`
- Create: `src/routes/applications/[uuid]/deployment-lifecycle/+page.svelte`
- Create: `src/routes/applications/[uuid]/container-labels/+page.svelte`
- Create: `src/routes/applications/[uuid]/container-image/+page.server.ts`
- Create: `src/routes/applications/[uuid]/runtime/+page.server.ts`
- Create: `src/routes/applications/[uuid]/security/+page.server.ts`
- Create: `src/routes/applications/[uuid]/deployment-lifecycle/+page.server.ts`
- Create: `src/routes/applications/[uuid]/container-labels/+page.server.ts`
- Test: `src/lib/server/resource-actions.test.ts`
- Test: `tests/e2e/warmify.spec.ts`

- [x] Save Name and Description through PATCH `/applications/{uuid}`.
- [x] Save every PATCH-supported build-pipeline and networking field; repository selection remains in the separate Git Source workflow because the public update endpoint does not accept repository identity fields.
- [x] Match Coolify's field grouping for container image, runtime, security, deployment lifecycle, and container labels.
- [x] Add every PATCH-supported field from the capability matrix with the correct input type and boolean/number conversion.
- [x] Preserve non-sensitive submitted values after 400/422 responses and show field-specific messages.
- [x] Keep secrets masked and never include sensitive values in SSR HTML.
- [x] Add tests for field allowlisting, coercion, validation errors, redacted error output, typed browser submission, and secret handling.

### Task 1.4: Domains and access

**Files:**

- Create: `src/routes/applications/[uuid]/domains/+page.server.ts`
- Create: `src/routes/applications/[uuid]/domains/+page.svelte`
- Modify: `src/routes/applications/[uuid]/access/+page.svelte`
- Modify: `src/lib/server/resource-actions.ts`
- Test: `src/lib/server/resource-actions.test.ts`
- Test: `tests/e2e/warmify.spec.ts`

- [x] Present configured domains as structured rows rather than a raw comma-separated API field.
- [x] Support add, edit, remove, redirect, and force-HTTPS fields only where PATCH `/applications/{uuid}` supports them.
- [x] Present public-domain count, Docker network, exposed ports, mappings, and aliases from the application record; explicitly report that the active container hostname is unavailable through the public API instead of inventing one.
- [x] Validate domain syntax locally, preserve submitted rows on failure, and require an explicit second submission for 409 conflict overrides.

### Task 1.5: Environment variable CRUD

**Files:**

- Modify: `src/routes/applications/[uuid]/environment-variables/+page.server.ts`
- Modify: `src/routes/applications/[uuid]/environment-variables/+page.svelte`
- Modify: `src/lib/components/EnvironmentTable.svelte`
- Modify: `src/lib/server/resource-detail-page.ts`
- Modify: `src/routes/internal/reveal/+server.ts`
- Test: `src/lib/server/route-security.test.ts`
- Test: `tests/e2e/warmify.spec.ts`

- [x] List redacted variables and reveal sensitive values only after an authenticated server request.
- [x] Create a variable with build/preview/literal/multiline flags.
- [x] Edit one variable through PATCH `/applications/{uuid}/envs`.
- [x] Delete one variable through DELETE `/applications/{uuid}/envs/{env_uuid}` with confirmation.
- [x] Support bulk PATCH without putting secret values into navigation state, logs, or SQLite.
- [x] Add conflict, validation, and permission-state coverage.

### Task 1.6: Persistent storage and volume backups

**Files:**

- Modify: `src/routes/applications/[uuid]/persistent-storage/+page.server.ts`
- Modify: `src/routes/applications/[uuid]/persistent-storage/+page.svelte`
- Create: `src/lib/components/StorageTable.svelte`
- Create: `src/lib/server/application-storage-actions.ts`
- Test: `src/lib/server/application-storage-actions.test.ts`
- Test: `tests/e2e/warmify.spec.ts`

- [x] List application storages as named, type-aware rows without returning managed-file content.
- [x] Create, edit, and delete persistent volumes, managed files, directory mounts, and host-file mounts using the documented API shapes.
- [x] Show volume-backup availability per storage and expose only usable S3 destinations.
- [x] Create, run, and delete storage-backup schedules/archives only after typed confirmation where destructive or immediate.
- [x] Invalidate affected application, resource, and project collection/detail data after mutation.
- [x] Keep Docker Compose-declared storage read-only and explain that Coolify's public API cannot read backup schedule/history state unless it appears in a storage response.

### Task 1.7: Deployments and runtime logs

**Files:**

- Modify: `src/routes/applications/[uuid]/deployments/+page.server.ts`
- Modify: `src/routes/applications/[uuid]/deployments/+page.svelte`
- Modify: `src/routes/applications/[uuid]/runtime-logs/+page.server.ts`
- Modify: `src/routes/applications/[uuid]/runtime-logs/+page.svelte`
- Modify: `src/lib/components/DeploymentTable.svelte`
- Modify: `src/lib/components/LogViewer.svelte`
- Modify: `src/routes/internal/poll/[kind]/[uuid]/+server.ts`
- Test: `tests/e2e/warmify.spec.ts`

- [x] Render deployments as grouped tables and runtime logs as bounded text tails instead of raw JSON.
- [x] Separate active, queued, and completed deployments using normalized Coolify statuses.
- [x] Link deployment rows to `/deployments/[uuid]`.
- [x] Poll active deployments and runtime logs every five seconds only while visible.
- [x] Abort requests when hidden/leaving and use request sequencing so late responses cannot replace newer data.
- [x] Show manual retry for timeout/5xx and `Retry-After` guidance for 429.

### Task 1.8: Scheduled tasks

**Files:**

- Modify: `src/routes/applications/[uuid]/scheduled-tasks/+page.server.ts`
- Modify: `src/routes/applications/[uuid]/scheduled-tasks/+page.svelte`
- Create: `src/lib/components/ScheduledTaskTable.svelte`
- Create: `src/lib/server/scheduled-task-actions.ts`
- Test: `src/lib/server/scheduled-task-actions.test.ts`
- Test: `tests/e2e/warmify.spec.ts`

- [x] List scheduled tasks as rows.
- [x] Create and edit command, schedule, timeout, and container fields.
- [x] Delete a task with typed confirmation.
- [x] Execute a task with explicit confirmation.
- [x] Show execution history from `/scheduled-tasks/{task_uuid}/executions`.

### Task 1.9: Remaining supported application operations

**Files:**

- Create: `src/routes/applications/[uuid]/git-source/+page.server.ts`
- Create: `src/routes/applications/[uuid]/git-source/+page.svelte`
- Create: `src/routes/applications/[uuid]/destinations/+page.server.ts`
- Create: `src/routes/applications/[uuid]/destinations/+page.svelte`
- Create: `src/routes/applications/[uuid]/rollback/+page.server.ts`
- Create: `src/routes/applications/[uuid]/rollback/+page.svelte`
- Create: `src/routes/applications/[uuid]/resource-limits/+page.server.ts`
- Create: `src/routes/applications/[uuid]/resource-limits/+page.svelte`
- Create: `src/routes/applications/[uuid]/resource-operations/+page.server.ts`
- Create: `src/routes/applications/[uuid]/resource-operations/+page.svelte`
- Create: `src/routes/applications/[uuid]/webhooks/+page.server.ts`
- Create: `src/routes/applications/[uuid]/webhooks/+page.svelte`
- Create: `src/routes/applications/[uuid]/tags/+page.server.ts`
- Create: `src/routes/applications/[uuid]/tags/+page.svelte`
- Create: `src/routes/applications/[uuid]/danger/+page.server.ts`
- Create: `src/routes/applications/[uuid]/danger/+page.svelte`
- Modify: `src/lib/server/resource-actions.ts`
- Test: `src/lib/server/resource-actions.test.ts`
- Test: `tests/e2e/warmify.spec.ts`

- [x] Expose Git source fields that PATCH supports; repository discovery remains tied to documented GitHub App endpoints.
- [x] Add/remove deployment destinations using documented application destination endpoints.
- [x] List rollback images and execute rollback with confirmation.
- [x] Edit CPU and memory limit fields through the application PATCH endpoint.
- [x] Implement clone, move, and migrate forms with destination/environment choices and confirmation.
- [x] Manage documented manual webhook fields through the application PATCH endpoint without returning stored secrets in SSR.
- [x] Add/list/delete tags through documented endpoints.
- [x] Keep Start, Deploy, Restart, and Stop in the shared header with confirmation rules.
- [x] Keep deletion on a dedicated Danger route and require exact name/UUID.
- [-] Omit browser Terminal because Coolify exposes no public terminal API.
- [-] Omit Metrics because Coolify exposes no public application metrics API.
- [-] Omit a standalone Preview Deployments list unless the capability matrix finds a public read endpoint; expose preview deletion only when a public response provides the pull-request identifier contextually.

### Phase 1 gate

- [x] `bun run check` reports zero diagnostics.
- [x] `bun run lint` passes.
- [x] `bun run test` passes.
- [x] Application-focused Playwright scenarios pass against the simulated Coolify server.
- [x] `bun run build` succeeds.
- [x] Manual read-only smoke test confirms breadcrumbs, route history, polling, redaction, and representative application data against the configured Coolify instance (completed in the Phase 6 smoke on 2026-09-07).

---

## Phase 2 — Services

**Primary files:**

- `src/routes/services/[uuid]/+page.server.ts`
- `src/routes/services/[uuid]/+page.svelte`
- New physical routes under `src/routes/services/[uuid]/`
- `src/lib/server/resource-actions.ts`
- `src/lib/components/ResourceDetailPage.svelte`
- `tests/e2e/warmify.spec.ts`

- [x] Freeze a service capability matrix from Coolify's service sidebar and public API in `docs/SERVICE_CAPABILITY_MATRIX.md`.
- [x] Replace the generic one-page service detail with a shared service layout and physical routes.
- [x] Implement configuration, domains, variables, storage, logs, scheduled tasks, tags, clone/move/migrate, lifecycle, and deletion where documented.
- [x] Render nested service applications and databases as navigable resources.
- [x] Omit Terminal and internal-only functionality.
- [x] Add server action, presenter, navigation, redaction, and E2E coverage.
- [x] Complete the Phase 2 gate: check, lint, unit tests, all service E2E and build pass (revalidated in the 104-unit/19-E2E suite on 2026-09-04).

---

## Phase 3 — Databases and backups

**Primary files:**

- `src/routes/databases/[uuid]/+page.server.ts`
- `src/routes/databases/[uuid]/+page.svelte`
- New physical routes under `src/routes/databases/[uuid]/`
- `src/lib/server/resource-actions.ts`
- `tests/e2e/warmify.spec.ts`

- [x] Freeze a database capability matrix covering PostgreSQL, MySQL, MariaDB, MongoDB, Redis, KeyDB, Dragonfly, and ClickHouse in `docs/DATABASE_CAPABILITY_MATRIX.md`.
- [x] Split General, variables, storage, healthcheck, backups, logs, tags, resource limits, operations, and danger into physical routes when supported. Includes credentials, engine configuration, PostgreSQL initialization, networking and servers; native dumps and volume backups remain distinct.
- [x] Implement backup schedule CRUD, execution listing, and execution deletion, with parent ownership checks and explicit run/delete confirmations.
- [x] Preserve masked connection credentials and reveal them only on demand through an authenticated same-origin, no-store endpoint with an engine-specific field allowlist.
- [x] Normalize engine-specific fields without displaying raw response objects; authorize configuration writes by the current API engine and physical route, not hidden form claims.
- [x] Add contract tests for every creation engine and representative E2E for SQL and non-SQL engines. Includes configuration, native dumps, operations and PostgreSQL/Redis creation.
- [x] Expand database variable update/delete/bulk and same-section cross-UUID navigation regression coverage.
- [x] Complete the Phase 3 gate: check has zero diagnostics, lint passes, 168 unit tests and 24 full-suite E2E pass, and adapter-node build succeeds (2026-09-04).

---

## Phase 4 — Projects, environments, and resource creation

**Primary files:**

- `src/routes/projects/[uuid]/+page.server.ts`
- `src/routes/projects/[uuid]/+page.svelte`
- `src/routes/projects/[uuid]/environments/[environment]/+page.server.ts`
- `src/routes/projects/[uuid]/environments/[environment]/+page.svelte`
- `src/routes/projects/[uuid]/environments/[environment]/new/[kind]/+page.server.ts`
- `src/routes/projects/[uuid]/environments/[environment]/new/[kind]/+page.svelte`
- `src/lib/server/resource-actions.ts`
- `tests/e2e/warmify.spec.ts`

- [x] Keep Project → Environment → Resource as the only primary resource hierarchy.
- [x] Record the initial project/environment CRUD contract audit in `docs/PROJECT_ENVIRONMENT_CONTRACTS.md`; shared variables and remaining creation variants still need their own audits.
- [x] Complete project and environment create/edit/delete flows: focused actions, settings/danger routes, hierarchy redirects, confirmations and safe validation preservation; 20 new unit contracts and two browser scenarios validated in the 188-unit/26-E2E full suite, check/lint/build pass.
- [x] Audit project/environment shared-variable payloads, numeric IDs, scope resolution and response redaction in `docs/SHARED_VARIABLE_CONTRACTS.md`.
- [x] Manage project-level and environment-level shared variables with full documented CRUD, physical routes and dedicated authenticated same-origin no-store reveal. Validated with 23 new unit contracts and two browser scenarios in the 211-unit/28-E2E suite.
- [x] Rebuild every public-API-supported resource-creation variant from the pinned Coolify reference. Service templates use explicit type input; no catalog endpoint or GitLab creation endpoint is invented.
- [x] Complete Dockerfile, Docker image and inline Compose creation slice: focused payloads, encoding, tag/digest selection, route-owned parents, safe errors and physical redirects; 20 new unit contracts and three E2E scenarios validated. See `docs/RESOURCE_CREATION_CONTRACTS.md`.
- [x] Add conditional forms for public Git, private deploy key, GitHub App, Dockerfile, Docker image, Compose-backed service, and every database engine. Git slice adds 25 unit contracts and three E2E scenarios, validated in the 256-unit/34-E2E suite.
- [x] Redirect successful creation with a returned UUID directly to the correct physical detail route. If upstream skips deployment/returns no UUID, return to the environment without retrying the mutation.
- [x] Add E2E coverage for default `production`, environment selection, resource selection, validation preservation, and successful creation.
- [x] Complete the Phase 4 gate: check, lint, 268 unit tests, 36 full-suite E2E and build. Final process outcomes recorded in `PAUSE_HANDOFF.md`.

---

## Phase 5 — Deployment center

**Primary files:**

- `src/routes/deployments/+page.server.ts`
- `src/routes/deployments/+page.svelte`
- `src/routes/deployments/[uuid]/+page.server.ts`
- `src/routes/deployments/[uuid]/+page.svelte`
- `src/lib/components/DeploymentTable.svelte`
- `src/routes/internal/poll/[kind]/[uuid]/+server.ts`

- [x] Render deployment collections and details as structured tables/logs.
- [x] Support deploy-by-tag/UUID with a purpose-built form, explicit confirmation, preview options, normalized per-target outcomes and uncertain partial-execution warnings; no automatic retries.
- [x] Support deployment cancellation with confirmation.
- [x] Poll active deployments every five seconds only while visible.
- [x] Make application/project/environment context navigable.
- [x] Add E2E for queued → running → finished/failed/cancelled transitions.
- [x] Complete the Phase 5 gate: check, lint, unit tests, deployment E2E, build.

---

## Phase 6 — Infrastructure

### Servers

- [x] Replace generic server detail with physical routes for General, resources, domains, validation, variables, destinations, proxy, Docker cleanup, Cloudflare tunnel, Sentinel, log drains and danger when documented. Development-only transfer/export/migrate are explicitly labelled unavailable rather than exposed as inert actions.
- [x] Show clear unsupported-capability messages for version-dependent and missing public endpoints.

### Sources

- [x] Implement GitHub App and GitLab App list/create/edit/delete screens.
- [x] Implement documented repository and branch discovery for GitHub Apps.
- [x] Never expose app secrets in SSR or SQLite.

### Destinations and S3 storage

- [x] Implement server destination create/list/detail/edit/delete.
- [x] Implement S3 storage create/edit/delete and explicit validation.
- [x] Use dedicated forms instead of generic JSON operation actions.

### Cloud provisioning

- [x] Implement cloud-init script and cloud-token CRUD.
- [x] Implement DigitalOcean, Hetzner, and Vultr server creation using documented lookup endpoints.
- [x] Require explicit confirmation before provisioning billable infrastructure.

### Phase 6 gate

- [x] Run check, lint, unit tests, infrastructure E2E, and build.
- [x] Run a read-only real smoke test; dashboard, hierarchy/row navigation, masked variables, runtime polling, repeated Back navigation, infrastructure and cloud-security metadata pages passed against the configured Coolify instance on 2026-09-07 without real mutations or browser console errors.

---

## Phase 7 — Administration

**Primary route families:**

- `src/routes/security/keys/`
- `src/routes/teams/`
- New `src/routes/notifications/`
- New shared-variable administration routes
- `src/routes/system/`

- [x] List/detail private keys and support safe create/edit/delete with on-demand reveal rules. Key material stays out of SSR, SQLite, audit data and failed form values; reveal is explicit, fresh, same-origin and `no-store`.
- [x] List the token-bound team and its projected, read-only members.
- [x] Implement team shared variables with current-team route verification, full documented CRUD, keep/replace/clear semantics and protected reveal.
- [x] Implement Email, Discord, Slack, Telegram, Pushover, and Webhook notification settings with every documented event toggle and explicit keep/replace/clear handling for encrypted values.
- [x] Implement System version/health and API/MCP enable/disable actions without claiming current flags that the public API does not expose.
- [x] Warn before disabling Coolify's API that Warmify will lose access until re-enabled externally or through the recovery endpoint.
- [x] Do not invent member-management mutations absent from the public API.
- [x] Complete the Phase 7 gate: zero Svelte diagnostics, clean Prettier/ESLint, 412/412 unit/contract tests, 4/4 combined administration E2E scenarios, and successful adapter-node build (2026-09-08).

---

## Phase 8 — Cross-cutting UX, cache, compatibility, and search

**Primary files:**

- `src/routes/+layout.svelte`
- `src/routes/+page.server.ts`
- `src/routes/+page.svelte`
- `src/routes/search/+page.server.ts`
- `src/routes/search/+page.svelte`
- `src/lib/server/inventory-cache.ts`
- `src/lib/server/cache-database.ts`
- `src/lib/server/capabilities.ts`

- [x] Dashboard uses structured active/recent deployments, projects, and servers.
- [x] Global search is built from list endpoints without a persistent search index.
- [x] Synchronize cached collections on page load without blocking cached rendering.
- [x] Apply stale-response protection and visibility-aware polling consistently.
- [x] Show last synchronization time and a non-blocking stale-data warning.
- [x] Detect Coolify version once per bounded interval and derive endpoint capabilities.
- [x] Treat capability-specific 404/405 as unavailable instead of generic failure.
- [x] Ensure every unknown response field appears only inside recursively redacted `<details>`.
- [x] Verify keyboard navigation, focus behavior, semantic headings, labels, and table overflow.
- [x] Add E2E for rapid navigation, Back/Forward, refresh, stale cache, hidden-tab polling, and global search.
- [x] Complete the Phase 8 gate: 425/425 unit/contract tests, zero Svelte diagnostics, 3/3 navigation/cache/search E2E scenarios, clean Prettier/ESLint, and successful adapter-node build (2026-09-08).

---

## Phase 9 — Security and failure hardening

**Primary files:**

- `src/hooks.server.ts`
- `src/lib/server/auth.ts`
- `src/lib/server/coolify-client.ts`
- `src/lib/server/redact.ts`
- `src/routes/internal/reveal/+server.ts`
- `src/routes/internal/poll/`
- `tests/e2e/warmify.spec.ts`

- [x] Re-audit every internal JSON endpoint for authentication, origin, operation allowlisting, UUID/type validation, and response redaction.
- [x] Verify the token cannot appear in the client bundle, SSR HTML, errors, audit logs, SQLite, or Playwright artifacts.
- [x] Verify sensitive values cannot appear in cached snapshots or form error payloads.
- [x] Verify 401/403, 409, 429, timeout, 5xx, and 404/405 capability mappings throughout the UI.
- [x] Verify all mutation pages use explicit forms and no mutation occurs through GET.
- [x] Verify lifecycle and destructive confirmations cannot be bypassed by missing form fields.
- [x] Add targeted regression tests for each discovered security boundary.
- [x] Complete the Phase 9 gate: zero Svelte diagnostics, clean Prettier/ESLint, 434/434 unit/contract tests, 2/2 security-hardening E2E scenarios, successful adapter-node build and zero-hit secret artifact scan (2026-09-08).

---

## Phase 10 — Final acceptance and deployment documentation

**Files:**

- Modify: `README.md`
- Modify: `.env.example`
- Modify: `dockerfile`
- Modify: `tests/e2e/warmify.spec.ts`

- [x] Reconcile `README.md` route/capability claims with the actual implementation.
- [x] Document `WARMIFY_DATA_DIR=/data` and a persistent directory mount at `/data` in Coolify.
- [x] Document single-replica SQLite operation and cache rebuild behavior.
- [x] Document supported/omitted Coolify features and version behavior.
- [x] Run `bun run check` (zero errors and warnings).
- [x] Run `bun run lint` (Prettier and ESLint clean).
- [x] Run `bun run test` (435/435).
- [x] Run `bun run test:e2e` (58/58 in one final-state run).
- [x] Run `bun run build` (adapter-node production build successful).
- [x] Run a read-only smoke test against the configured Coolify instance (nine collection/system pages and one complete Project → Environment → Resource hierarchy through the Node build).
- [x] Inspect generated client assets, SSR output, errors, logs, SQLite, and test artifacts for tokens/secrets (zero configured-credential and known fixture-secret hits).
- [x] Mark the roadmap complete only when all phase gates are checked.

---

## Work-session status template

The latest 2026-09-04 CRUD checkpoint is in `docs/PAUSE_HANDOFF.md`; it supersedes the historical Phase 3 block below. The user resumed after the brief pause. All verification handles are terminal.

```text
Date: 2026-09-04
Branch: service-parity; existing dirty checkout preserved. No commit, push or production deployment this session.
Active phase/task: Phase 3 closed. Phase 4 initial CRUD contracts audited; implementation is next. Phase 2 gate remains closed.
Completed this session: Added parent-owned UUID/key checks before database variable PATCH and rejected database bulk preview input. Displayed line-specific bulk validation errors without preserving secret values. Added nine action-contract tests and two browser scenarios for variable edit/bulk/delete and same-section cross-UUID navigation, including Back/Forward, draft clearing and revealed credential reset. Added the $lib Vitest alias so the actual action factory can be tested. The first browser run exposed a fixture anchor hidden behind the fixed sidebar, not an application navigation failure; moved the auxiliary anchor inside main and retained real browser clicks and the same-document assertion. Recorded Phase 4 CRUD contracts from ProjectController, Project model and ValidationPatterns; no Phase 4 production code changes yet.
Validation executed and result: bun run check: 0 errors/warnings. bun run test: 168/168 in 23 files. bun run test:e2e --workers=1: 24/24 in 1.7 minutes after fixing the fixture (initial run 23/24). bun run lint: passed; changed test file additionally passed Prettier/ESLint. bun run build: adapter-node succeeded with plugin timing advisory only. git diff --check passed with line-ending notices only. All verification sessions are terminal.
Known failures/blockers: No failing local Phase 3 gate. Phase 4 finding: createEnvironment currently sends description when supplied, but the API accepts only name (edit accepts description). Coolify creates production automatically in Project's created callback; do not duplicate this request. Environment mutation lookup tries name before UUID, so verify route-owned parent identity. Configured-instance read-only smoke and historic SQLite redaction audit remain pending. Earlier exposed real credentials require external rotation. Migration remains development-only in the pinned helper. The generic legacy newResourceRequest database branch is no longer the physical database form's action.
Next unchecked item: Focused project/environment create/edit/delete slice from docs/PROJECT_ENVIRONMENT_CONTRACTS.md, followed by shared-variable controller audit and remaining application/service creation variants. Preserve the default production environment, exact deletion confirmation and nonempty-resource refusal. Batch verification at the end of this slice. Do not redo completed database screens or commit/push without a new request.
Files most relevant to resume: docs/PROJECT_ENVIRONMENT_CONTRACTS.md; src/routes/projects/+page.server.ts and +page.svelte; src/routes/projects/[uuid]/+page.server.ts and +page.svelte; src/routes/projects/[uuid]/environments/[environment]/; src/lib/server/resource-index-page.ts and resource-detail-page.ts; tests/mock-coolify.ts and tests/e2e/warmify.spec.ts. Completed regression files: database-variables.test.ts, ResourceEnvironmentVariables.svelte, tests/mock-databases.ts and tests/e2e/databases.spec.ts. Coolify reference remains sibling coolify_reference at 8d675f2e2.
Resume commands: bun run check; bun run lint; bun run test; bun run test:e2e --workers=1; bun run build. Batch tests at the end of meaningful blocks per the user's request. Playwright owns local mock/Vite servers on 4010/4173. Never modify source/build while E2E is running. Vite/toolchain spawn EPERM needs an approved escalated run, not source workarounds. All verification processes from this checkpoint have finished.
```

## Decision log

- 2026-08-26: Use plain `WARMIFY_ADMIN_PASSWORD` instead of a configured password hash/session secret pair.
- 2026-08-26: Use a light-only interface with the default browser/SvelteKit font and minimal CSS.
- 2026-08-26: Replace generic `/manage` routes with physical routes per resource family.
- 2026-08-26: Use Project → Environment → Resource as the primary hierarchy; remove “All resources” from navigation.
- 2026-08-26: Cache redacted list data in SQLite and synchronize it when pages load.
- 2026-08-27: Give each application settings destination a physical route under `/applications/[uuid]`.
- 2026-08-28: Use the local Coolify clone at commit `8d675f2e2` as the UI/workflow reference and run proportional validation for large changes.
- 2026-08-28: Freeze application parity to the public API: omit Swarm, Terminal, and Metrics; keep Backups, Git Source, Webhooks, Preview Deployments, and migration explicitly partial/conditional.
- 2026-08-28: Use native SvelteKit navigation/history. Do not emulate early route commits with `$app/navigation.pushState`, because it creates shallow entries that update the URL without mounting the destination route on Back/Forward.
- 2026-08-30: Build adapter-node output with Bun but run production with Node 24 so `better-sqlite3` uses its supported Node N-API path. Keep Coolify credentials runtime-only because build-time variables can appear in generated Dockerfile output and deployment logs.
- 2026-08-28: Keep application configuration writes section-scoped and allowlisted. Encode only API-required text fields, keep passwords write-only, and never preserve sensitive form values in action data.
