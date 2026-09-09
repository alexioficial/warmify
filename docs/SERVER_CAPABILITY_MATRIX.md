# Server capability matrix

Phase 6 server audit, 2026-09-04. Read-only Coolify reference `8d675f2e2`.
The complete public server controller family, API routes 151–201, server sidebar
and nested proxy/Sentinel/security sidebars were reviewed before implementation.

## Public API mapping

| Warmify section         | Public operation                               | Support               | Boundary                                                                                                                          |
| ----------------------- | ---------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Index / General         | `GET /servers`, `GET/PATCH /servers/{uuid}`    | Full                  | Serialize only an explicit scalar allowlist. Server settings can contain secrets.                                                 |
| Create by IP            | `POST /servers`                                | Full                  | Requires an owned private-key UUID; optional validation is asynchronous.                                                          |
| Resources               | `GET /servers/{uuid}/resources`                | Full                  | Link only recognized application/service/database UUIDs.                                                                          |
| Domains                 | `GET /servers/{uuid}/domains`                  | Full                  | Normalize grouped IP/domain arrays; no inferred DNS claims.                                                                       |
| Validation              | `POST /servers/{uuid}/validate`                | Full                  | Explicit confirmation; `install=true` may install prerequisites and restart Docker. Never retry automatically.                    |
| Shared variables        | server env CRUD endpoints                      | Full                  | Values stay server-only and require the existing explicit reveal boundary.                                                        |
| Advanced                | selected fields in `PATCH /servers/{uuid}`     | Full                  | Build-server conversion is refused upstream when resources exist.                                                                 |
| Destinations            | server destination list/create endpoints       | Full                  | Dedicated form and server ownership checks; edit/delete use the destination endpoints.                                            |
| Docker cleanup          | GET/PATCH settings, POST run, GET executions   | Full                  | Manual run requires confirmation; execution messages are projected as bounded, untrusted text.                                    |
| Proxy                   | GET/PATCH, PUT configuration, POST restart     | Partial/full by field | Raw Compose exists only with sensitive-read. Never cache or SSR raw configuration; restart requires confirmation.                 |
| Cloudflare Tunnel       | GET/PATCH/enable/disable                       | Full                  | Public actions only toggle stored/manual state; they do not deploy/remove cloudflared remotely. Never imply otherwise.            |
| Sentinel                | GET/PATCH                                      | Full                  | Token/custom URL require sensitive-read and must never enter SSR/SQLite. No public Sentinel log endpoint.                         |
| Log drains              | GET/PATCH                                      | Full                  | License/API keys and custom config require sensitive-read; write-only replacement UI by default.                                  |
| Delete                  | `DELETE /servers/{uuid}` with optional `force` | Full                  | Local Coolify host cannot be deleted. Force cascades resource deletion and needs two typed confirmations.                         |
| Transfer/export/migrate | routes exist                                   | Development-only      | The whole controller constructor returns 404 unless Coolify is in dev mode. Show unavailable outside explicitly detected support. |

## Sidebar items without public parity

- Private-key association can be changed through the general PATCH, but private-key
  material is managed separately and must not be embedded in server SSR.
- CA Certificate, Swarm, Terminal, server patching, Terminal Access, metrics charts,
  proxy dynamic configurations/logs and Sentinel logs have no matching public API
  route in the pinned reference. Do not synthesize Livewire/private calls.
- Proxy status/configuration and Sentinel status are not equivalent to their log or
  metrics screens. Label partial support explicitly.
- Cloud provider tokens and provider provisioning belong to the later cloud slice;
  provisioning can incur cost and always requires a separate explicit confirmation.

## Controller-specific behavior

- Server detail hides numeric ID but may expose sensitive settings when the token has
  `read:sensitive`; Warmify must project the response before it reaches a page.
- General update accepts only the documented allowlist and returns 201 with UUID.
  Proxy changes are asynchronous. `instant_validate` dispatches work.
- Domain output groups hostnames by IP and substitutes instance public IPs for
  `host.docker.internal` when configured.
- Cleanup settings validate cron and threshold 1–99; manual-run flags default to
  stored settings; only the latest 20 executions are returned.
- Disabling Sentinel also disables metrics/debug. Sentinel cannot be enabled on a
  build server. Log-drain enablement has provider-specific required fields and
  starts/stops the drain after saving.
- Proxy configuration may be base64 UTF-8; GET never SSH-fetches it. Redirect URLs
  use Coolify's safe external-URL validation.

## Implementation order / status

- [x] Audit public routes, complete controller family and Coolify server navigation.
- [x] Add safe server presenter/loader and physical layout.
- [x] Add General, Resources, Domains and confirmed Validation routes.
- [x] Adapt shared-variable secret boundaries for server scope.
- [x] Add Advanced and Danger routes.
- [x] Add Docker cleanup, Proxy, Tunnel, Sentinel and Log Drains dedicated routes.
- [x] Add server creation and destination integration.
- [x] Add an explicit API availability screen for development-only and unsupported capabilities.
- [x] Run server unit/E2E/security gate and update roadmap/handoff.

## Implemented core slice

`server-pages.ts` projects server detail and settings into an explicit non-secret
shape before returning page data. The physical `/servers/[uuid]` layout redirects
to General and provides real routes for General, Resources, Domains and Validation.
General mutations verify the live route UUID and send one allowlisted PATCH.
Validation requires a fresh hydration-gated confirmation, sends exactly one POST
and never exposes arbitrary backend messages. Resource rows link only recognized
application, service and database types; unknown types remain non-links.

Core-slice verification: 314/314 unit/contract tests in 33 files, 42/42 full-suite
E2E, zero Svelte diagnostics, lint and adapter-node build passed. Browser coverage
includes editing, secret exclusion, typed resource links, domains, validation and
Back navigation. Shared mock state is restored after the scenario to keep the suite
order-independent.

## Implemented configuration slice

Server-scoped variables reuse the hardened shared-variable forms while keeping
Warmify's physical `/environment-variables` route separate from Coolify's
`/servers/{uuid}/envs` API path. Every mutation and reveal validates the route-owned
server first. Values never enter SSR, mutation results or caches, and reveal remains
same-origin, explicit and `no-store`.

Advanced exposes only the public scalar settings supported by the pinned controller.
It validates numeric ranges locally, sends one allowlisted PATCH, and accurately
describes Coolify's build-server resource guard. Danger blocks the local Coolify host,
requires the exact server name or UUID, and additionally requires
`DELETE ALL RESOURCES` before `force=true` can be sent. Neither path serializes
arbitrary upstream messages.

Focused verification: 27/27 shared-variable unit tests, 9/9 server-page unit tests,
zero Svelte diagnostics, and the complete server browser scenario passed. A later
server phase gate will rerun the full repository suites.

## Implemented operations slice

Docker Cleanup now has structured settings and bounded execution history, local cron
and threshold validation, and a separately confirmed manual run that is never
retried. Proxy exposes projected metadata, allowlisted settings, confirmed restart,
and base64 UTF-8 configuration save. Its raw configuration is available only through
an authenticated, same-origin, `no-store` reveal request.

Cloudflare Tunnel accurately labels the API's stored-state enable/disable behavior
and blocks the local Coolify host. Sentinel exposes supported flags and intervals,
uses keep/replace/clear semantics for its token and URL, refuses build-server
enablement, and requires `SAVE SENTINEL`. Log Drains uses provider-specific metadata,
write-only keep/replace/clear values for keys and custom Fluent Bit documents, and
requires `SAVE LOG DRAINS`. Sentinel and Log Drains share an explicit reveal UI that
cancels stale requests and clears revealed values on hide or navigation. No raw
configuration or secret is returned by their page loaders.

Focused verification on 2026-09-04: 26/26 unit/contract tests across the endpoint
manifest and five server-operation helpers passed; `svelte-check` reported zero
errors and warnings; adapter-node production build completed. A manual local-browser
pass against the strict mock verified login, physical navigation, Back history,
secret absence before reveal, explicit Sentinel/Log Drains reveal and cleanup after
hide, with no browser console errors or warnings. Three early Playwright attempts
timed out establishing `remote-debugging-pipe`; the final full server-family run
subsequently launched normally and passed 3/3 scenarios.

## Implemented creation and destinations slice

`/servers/new` now loads an explicit UUID/name/description projection of the current
team's private keys and never serializes key material. The form validates an IPv4,
IPv6 or RFC 1123 hostname, SSH port/user, owned key and proxy choice before one
allowlisted `POST /servers`. Optional validation is described as asynchronous and a
successful response opens the physical server General route.

Every server now has a physical Destinations route backed only by
`GET/POST /servers/{uuid}/destinations`. Creation sends name and network only, so
Coolify derives standalone versus swarm from the actual server. Destination detail
projects the documented seven fields, exposes name-only editing and keeps network,
type and owning server read-only. Danger requires exact typed confirmation, maps the
attached-resource conflict to safe guidance and refuses deletion of the default
`coolify` network.

Final server-family evidence on 2026-09-04: 353/353 unit and contract tests in 41
files, zero Svelte diagnostics, lint and adapter-node build passed. The complete
`tests/e2e/servers.spec.ts` gate then passed 3/3 scenarios, including server creation,
destination create/edit/delete, physical server navigation, secret-boundary checks
and Back history. The API availability route explicitly labels development-only
transfer/migration/export and sidebar features with no public endpoint, without
offering private actions. The earlier Chromium launch issue did not recur. No real
Coolify mutation was performed.
