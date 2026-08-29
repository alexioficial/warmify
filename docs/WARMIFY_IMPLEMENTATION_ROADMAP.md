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

**Active phase:** Phase 1 — Application detail parity.

**Next task:** Task 1.5 — complete environment variable CRUD.

**Latest validation state:** On 2026-08-28, `bun run check` completed with zero diagnostics, all 53 unit/contract tests passed, all 6 Playwright E2E tests passed, `bun run lint` passed, `bun run build` completed successfully, `git diff --check` reported no whitespace errors, and the generated client bundle contained none of the configured secret names or test secret markers.

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
- [~] Reconcile the frozen endpoint manifest with the cloned Coolify commit before each family phase.

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
- [~] Show the destination URL and a page skeleton immediately during client navigation.
- [~] Regression-test rapid Back/Forward navigation and stale navigation cancellation.

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
- [~] Validate create-project plus automatic `production` environment behavior against the current API.
- [~] Validate the complete new-resource flow after application routing changes.

### Phase 0 gate

- [x] Run `bun run check` and record zero diagnostics (2026-08-28).
- [x] Run `bun run test` and record all unit/contract tests passing (47 tests on 2026-08-28).
- [x] Run the navigation/auth hierarchy suite in `tests/e2e/warmify.spec.ts` (4 tests on 2026-08-28).
- [ ] Close the remaining partial Phase 0 verification items before marking the foundation complete.

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

- [~] List redacted variables and reveal sensitive values only after an authenticated server request.
- [~] Create a variable with build/preview/literal/multiline flags.
- [ ] Edit one variable through PATCH `/applications/{uuid}/envs`.
- [ ] Delete one variable through DELETE `/applications/{uuid}/envs/{env_uuid}` with confirmation.
- [ ] Support bulk PATCH without putting secret values into navigation state, logs, or SQLite.
- [ ] Add conflict, validation, and permission-state coverage.

### Task 1.6: Persistent storage and volume backups

**Files:**

- Modify: `src/routes/applications/[uuid]/persistent-storage/+page.server.ts`
- Modify: `src/routes/applications/[uuid]/persistent-storage/+page.svelte`
- Create: `src/lib/components/StorageTable.svelte`
- Create: `src/lib/server/application-storage-actions.ts`
- Test: `src/lib/server/application-storage-actions.test.ts`
- Test: `tests/e2e/warmify.spec.ts`

- [~] List application storages as named rows.
- [ ] Create, edit, and delete storage using the documented API shapes.
- [ ] Show volume-backup availability per storage.
- [ ] Run or delete a storage backup only after confirmation.
- [ ] Invalidate affected collection/detail data after mutation.

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

- [~] Render deployments as a table and logs as text instead of raw JSON.
- [ ] Separate active, queued, and completed deployments using normalized statuses.
- [ ] Link deployment rows to `/deployments/[uuid]`.
- [ ] Poll active deployments/logs every five seconds only while visible.
- [ ] Cancel stale requests when leaving the page and prevent late responses from replacing newer data.
- [ ] Show manual retry for timeout/5xx and `Retry-After` guidance for 429.

### Task 1.8: Scheduled tasks

**Files:**

- Modify: `src/routes/applications/[uuid]/scheduled-tasks/+page.server.ts`
- Modify: `src/routes/applications/[uuid]/scheduled-tasks/+page.svelte`
- Create: `src/lib/components/ScheduledTaskTable.svelte`
- Create: `src/lib/server/scheduled-task-actions.ts`
- Test: `src/lib/server/scheduled-task-actions.test.ts`
- Test: `tests/e2e/warmify.spec.ts`

- [~] List scheduled tasks as rows.
- [ ] Create and edit command, schedule, timeout, and container fields.
- [ ] Delete a task with typed confirmation.
- [ ] Execute a task with explicit confirmation.
- [ ] Show execution history from `/scheduled-tasks/{task_uuid}/executions`.

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

- [ ] Expose Git source fields that PATCH supports; repository discovery remains tied to documented GitHub App endpoints.
- [ ] Add/remove deployment destinations using documented application destination endpoints.
- [ ] List rollback images and execute rollback with confirmation.
- [ ] Edit CPU and memory limit fields through the application PATCH endpoint.
- [ ] Implement clone, move, and migrate forms with destination/environment choices and confirmation.
- [ ] Manage documented manual webhook fields through the application PATCH endpoint without returning stored secrets in SSR.
- [ ] Add/list/delete tags through documented endpoints.
- [~] Keep Start, Deploy, Restart, and Stop in the shared header with confirmation rules.
- [~] Keep deletion on a dedicated Danger route and require exact name/UUID.
- [-] Omit browser Terminal because Coolify exposes no public terminal API.
- [-] Omit Metrics because Coolify exposes no public application metrics API.
- [-] Omit a standalone Preview Deployments list unless the capability matrix finds a public read endpoint; expose preview deletion only when a public response provides the pull-request identifier contextually.

### Phase 1 gate

- [ ] `bun run check` reports zero diagnostics.
- [ ] `bun run lint` passes.
- [ ] `bun run test` passes.
- [ ] Application-focused Playwright scenarios pass against the simulated Coolify server.
- [ ] `bun run build` succeeds.
- [ ] Manual read-only smoke test confirms breadcrumbs, route history, polling, redaction, and representative application data against the configured Coolify instance.

---

## Phase 2 — Services

**Primary files:**

- `src/routes/services/[uuid]/+page.server.ts`
- `src/routes/services/[uuid]/+page.svelte`
- New physical routes under `src/routes/services/[uuid]/`
- `src/lib/server/resource-actions.ts`
- `src/lib/components/ResourceDetailPage.svelte`
- `tests/e2e/warmify.spec.ts`

- [ ] Freeze a service capability matrix from Coolify's service sidebar and public API.
- [ ] Replace the generic one-page service detail with a shared service layout and physical routes.
- [ ] Implement configuration, domains, variables, storage, logs, scheduled tasks, tags, clone/move/migrate, lifecycle, and deletion where documented.
- [ ] Render nested service applications and databases as navigable resources.
- [ ] Omit Terminal and internal-only functionality.
- [ ] Add server action, presenter, navigation, redaction, and E2E coverage.
- [ ] Complete the Phase 2 gate: check, lint, unit tests, service E2E, build.

---

## Phase 3 — Databases and backups

**Primary files:**

- `src/routes/databases/[uuid]/+page.server.ts`
- `src/routes/databases/[uuid]/+page.svelte`
- New physical routes under `src/routes/databases/[uuid]/`
- `src/lib/server/resource-actions.ts`
- `tests/e2e/warmify.spec.ts`

- [ ] Freeze a database capability matrix covering PostgreSQL, MySQL, MariaDB, MongoDB, Redis, KeyDB, Dragonfly, and ClickHouse.
- [ ] Split General, variables, storage, healthcheck, backups, logs, tags, resource limits, operations, and danger into physical routes when supported.
- [ ] Implement backup schedule CRUD, execution listing, and execution deletion.
- [ ] Preserve masked connection credentials and reveal them only on demand.
- [ ] Normalize engine-specific fields without displaying raw response objects.
- [ ] Add contract tests for every creation engine and representative E2E for SQL and non-SQL engines.
- [ ] Complete the Phase 3 gate: check, lint, unit tests, database E2E, build.

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

- [~] Keep Project → Environment → Resource as the only primary resource hierarchy.
- [ ] Complete project and environment create/edit/delete flows.
- [ ] Manage project-level and environment-level shared variables with full documented CRUD.
- [ ] Rebuild every resource-creation variant from the current Coolify reference while sending only public API payloads.
- [ ] Add conditional forms for public Git, private deploy key, GitHub App, Dockerfile, Docker image, Compose-backed service, and every database engine.
- [ ] Redirect every successful creation directly to the correct physical detail route.
- [ ] Add E2E coverage for default `production`, environment selection, resource selection, validation preservation, and successful creation.
- [ ] Complete the Phase 4 gate: check, lint, unit tests, hierarchy/creation E2E, build.

---

## Phase 5 — Deployment center

**Primary files:**

- `src/routes/deployments/+page.server.ts`
- `src/routes/deployments/+page.svelte`
- `src/routes/deployments/[uuid]/+page.server.ts`
- `src/routes/deployments/[uuid]/+page.svelte`
- `src/lib/components/DeploymentTable.svelte`
- `src/routes/internal/poll/[kind]/[uuid]/+server.ts`

- [~] Render deployment collections and details as structured tables/logs.
- [ ] Support deploy-by-tag/UUID with a purpose-built form.
- [ ] Support deployment cancellation with confirmation.
- [ ] Poll active deployments every five seconds only while visible.
- [ ] Make application/project/environment context navigable.
- [ ] Add E2E for queued → running → finished/failed/cancelled transitions.
- [ ] Complete the Phase 5 gate: check, lint, unit tests, deployment E2E, build.

---

## Phase 6 — Infrastructure

### Servers

- [ ] Replace generic server detail with physical routes for General, resources, domains, validation, variables, proxy, Docker cleanup, Cloudflare tunnel, Sentinel, log drains, migration/export/transfer, and danger when documented.
- [ ] Show clear unsupported-capability messages for version-dependent endpoints.

### Sources

- [ ] Implement GitHub App and GitLab App list/create/edit/delete screens.
- [ ] Implement documented repository and branch discovery for GitHub Apps.
- [ ] Never expose app secrets in SSR or SQLite.

### Destinations and S3 storage

- [ ] Implement server destination create/list/detail/edit/delete.
- [ ] Implement S3 storage create/edit/delete and explicit validation.
- [ ] Use dedicated forms instead of generic JSON operation actions.

### Cloud provisioning

- [ ] Implement cloud-init script and cloud-token CRUD.
- [ ] Implement DigitalOcean, Hetzner, and Vultr server creation using documented lookup endpoints.
- [ ] Require explicit confirmation before provisioning billable infrastructure.

### Phase 6 gate

- [ ] Run check, lint, unit tests, infrastructure E2E, and build.
- [ ] Run a read-only real smoke test; do not provision or mutate a real provider without separate explicit activation.

---

## Phase 7 — Administration

**Primary route families:**

- `src/routes/security/keys/`
- `src/routes/teams/`
- New `src/routes/notifications/`
- New shared-variable administration routes
- `src/routes/system/`

- [~] List/detail private keys and support safe create/edit/delete with on-demand reveal rules.
- [~] List teams and members visible to the token.
- [ ] Implement team shared variables.
- [ ] Implement Email, Discord, Slack, Telegram, Pushover, and Webhook notification settings.
- [ ] Implement System version/health and API/MCP enable/disable actions.
- [ ] Warn before disabling Coolify's API that Warmify will lose access until re-enabled externally.
- [ ] Do not invent member-management mutations absent from the public API.
- [ ] Complete the Phase 7 gate: check, lint, unit tests, administration E2E, build.

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

- [~] Dashboard uses structured active/recent deployments, projects, and servers.
- [~] Global search is built from list endpoints without a persistent search index.
- [ ] Synchronize cached collections on page load without blocking cached rendering.
- [ ] Apply stale-response protection and visibility-aware polling consistently.
- [ ] Show last synchronization time and a non-blocking stale-data warning.
- [ ] Detect Coolify version once per bounded interval and derive endpoint capabilities.
- [ ] Treat capability-specific 404/405 as unavailable instead of generic failure.
- [ ] Ensure every unknown response field appears only inside recursively redacted `<details>`.
- [ ] Verify keyboard navigation, focus behavior, semantic headings, labels, and table overflow.
- [ ] Add E2E for rapid navigation, Back/Forward, refresh, stale cache, hidden-tab polling, and global search.
- [ ] Complete the Phase 8 gate: check, lint, unit tests, navigation/cache E2E, build.

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

- [ ] Re-audit every internal JSON endpoint for authentication, origin, operation allowlisting, UUID/type validation, and response redaction.
- [ ] Verify the token cannot appear in the client bundle, SSR HTML, errors, audit logs, SQLite, or Playwright artifacts.
- [ ] Verify sensitive values cannot appear in cached snapshots or form error payloads.
- [ ] Verify 401/403, 409, 429, timeout, 5xx, and 404/405 capability mappings throughout the UI.
- [ ] Verify all mutation pages use explicit forms and no mutation occurs through GET.
- [ ] Verify lifecycle and destructive confirmations cannot be bypassed by missing form fields.
- [ ] Add targeted regression tests for each discovered security boundary.
- [ ] Complete the Phase 9 gate: check, lint, all unit tests, all security E2E, build.

---

## Phase 10 — Final acceptance and deployment documentation

**Files:**

- Modify: `README.md`
- Modify: `.env.example`
- Modify: `dockerfile`
- Modify: `tests/e2e/warmify.spec.ts`

- [ ] Reconcile `README.md` route/capability claims with the actual implementation.
- [ ] Document `WARMIFY_DATA_DIR=/data` and a persistent directory mount at `/data` in Coolify.
- [ ] Document single-replica SQLite operation and cache rebuild behavior.
- [ ] Document supported/omitted Coolify features and version behavior.
- [ ] Run `bun run check`.
- [ ] Run `bun run lint`.
- [ ] Run `bun run test`.
- [ ] Run `bun run test:e2e`.
- [ ] Run `bun run build`.
- [ ] Run a read-only smoke test against the configured Coolify instance.
- [ ] Inspect generated client assets, SSR output, errors, logs, SQLite, and test artifacts for tokens/secrets.
- [ ] Mark the roadmap complete only when all phase gates are checked.

---

## Work-session status template

Update this block at the end of every substantial session.

```text
Date: 2026-08-28
Active phase/task: Phase 1 / Task 1.5 (Tasks 1.3 and 1.4 complete)
Completed this session: Completed Task 1.4 with structured application-domain rows, per-domain noindex flags, redirect and force-HTTPS controls, local URL/FQDN/duplicate validation, submitted-row preservation, normalized Coolify validation errors, and explicit 409 conflict details plus `force_domain_override` confirmation. Replaced the Access placeholder with public-domain and internal-network facts from the application record and documented why the live container hostname cannot be shown through the public API. Also made environment resource rows immediately clickable through their SSR anchor instead of waiting for hydration.
Validation executed and result: `bun run check` passed with zero diagnostics; the full unit/contract suite passed (11 files, 53 tests); the full E2E suite passed (6 tests), including add/edit/remove domains, noindex, redirects, HTTPS, validation preservation, conflict override, Access presentation, and pre-hydration resource-row navigation; `bun run lint` passed; `bun run build` completed successfully; `git diff --check` reported no whitespace errors; generated client assets contained none of the configured secret names or test secret markers.
Known failures/blockers: Swarm, Terminal, and Metrics lack public application APIs. Coolify's active application container hostname is computed from internal Docker inspection and is not available through the public API. Backup schedules lack public GET/history endpoints. Production migration is guarded by Coolify's `isDev()` check. Placeholder routes still need their API-backed controls in Tasks 1.5–1.9.
Next unchecked item: Task 1.5 — complete application environment-variable CRUD: edit, delete with confirmation, bulk PATCH, conflict/error coverage, and secret-safe state handling.
Files most relevant to resume: `docs/COOLIFY_APPLICATION_CAPABILITY_MATRIX.md`, `docs/WARMIFY_IMPLEMENTATION_ROADMAP.md`, `src/routes/applications/[uuid]/environment-variables/`, `src/lib/components/EnvironmentTable.svelte`, `src/lib/server/resource-detail-page.ts`, `src/routes/internal/reveal/+server.ts`, `src/lib/server/route-security.test.ts`, and `tests/e2e/warmify.spec.ts`.
Resume commands: use `bun run check`, `bun run test`, `bun run test:e2e`, and `bun run build`. Do not run Playwright with `bun run --bun test:e2e`; forcing the Playwright CLI through Bun left orphaned runners and blocked `browser.launch`. The validated command is `bun run test:e2e`.
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
- 2026-08-28: Keep application configuration writes section-scoped and allowlisted. Encode only API-required text fields, keep passwords write-only, and never preserve sensitive form values in action data.
