# Warmify service capability matrix

This matrix freezes the Phase 2 service scope against the local Coolify reference at commit `8d675f2e2` and Warmify's generated public endpoint manifest. It deliberately separates Coolify UI parity from operations that are actually available through the public API.

## Service-level routes

| Warmify route                            | Public API                                                      | Scope and constraints                                                                                                                                                                                                             |
| ---------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/services/[uuid]/general`               | `GET /services/{uuid}`, `PATCH /services/{uuid}`                | Edit `name`, `description`, `instant_deploy`, `connect_to_docker_network`, and `is_container_label_escape_enabled`. Render the service type, destination, server, and nested resource summary from the redacted service response. |
| `/services/[uuid]/compose`               | `PATCH /services/{uuid}`                                        | Replace `docker_compose_raw` as base64. Treat compose content as sensitive/write-only unless the token explicitly returns it and the server-side redaction policy permits a reveal. Never cache compose content in SQLite.        |
| `/services/[uuid]/domains`               | `PATCH /services/{uuid}`                                        | Submit `urls: [{ name, url }]` for real compose application names. Support `force_domain_override` only as an explicit second submission after a 409 conflict.                                                                    |
| `/services/[uuid]/environment-variables` | `GET/POST/PATCH /services/{uuid}/envs`, bulk PATCH, UUID DELETE | Full CRUD and bulk update. Values remain redacted in SSR/cache and are revealed only through authenticated server requests.                                                                                                       |
| `/services/[uuid]/persistent-storage`    | `GET/POST/PATCH /services/{uuid}/storages`, UUID DELETE         | Type-aware persistent/file/directory/host-file rows using the documented request shapes. Compose-declared read-only storage stays immutable.                                                                                      |
| `/services/[uuid]/backups`               | storage backup PUT/POST/DELETE                                  | Configure/run/delete volume backup schedules where a returned storage is eligible. There is no public GET for schedule/history, so no invented refreshed state.                                                                   |
| `/services/[uuid]/runtime-logs`          | `GET /services/{uuid}/logs`                                     | Require a real `applications[].name` or `databases[].name` as `sub_service_name`; bound `lines` and timestamp options. Poll only while visible.                                                                                   |
| `/services/[uuid]/scheduled-tasks`       | list/create/update/delete/execute/history endpoints             | Reuse the application scheduled-task workflow with service-specific paths and typed confirmations.                                                                                                                                |
| `/services/[uuid]/tags`                  | list/create/delete endpoints                                    | Add one or many tags and require the exact tag name before deletion.                                                                                                                                                              |
| `/services/[uuid]/resource-operations`   | clone/move/migrate endpoints                                    | Clone `{ destination_uuid, name?, clone_volumes }`; move `{ environment_uuid }`; migrate `{ destination_uuid, migrate_volumes }`. Require exact typed service-name confirmations.                                                 |
| `/services/[uuid]/danger`                | `DELETE /services/{uuid}`                                       | Dedicated route with exact service name/UUID confirmation and all four documented cleanup query flags.                                                                                                                            |

## Shared service header

The shared service layout owns breadcrumbs, status, links to discovered public URLs, and lifecycle forms:

- Deploy/start: `POST /services/{uuid}/start`.
- Restart: `POST /services/{uuid}/restart`, with explicit confirmation.
- Stop: `POST /services/{uuid}/stop`, with explicit confirmation.
- There is no public service deployment-history endpoint in the audited manifest, so the header must not promise deployment history.

## Nested compose applications

`GET /services/{uuid}` already returns `applications`, and dedicated list/detail endpoints provide current sub-resource state. Each nested application must be navigable under the parent service rather than being presented as an unrelated top-level application.

Supported application fields through `PATCH /services/{uuid}/applications/{app_uuid}`:

- `url` and `noindex_domains`
- `human_name` and `description`
- `image`
- `exclude_from_status`
- `is_log_drain_enabled`
- `is_gzip_enabled`
- `is_stripprefix_enabled`
- `is_force_https_enabled`

Supported nested application operations:

- GET/POST logs with bounded `lines`.
- Start/redeploy, restart, and stop.
- Domain conflict handling remains explicit; no forced override on the first submission.

## Nested compose databases

`GET /services/{uuid}` already returns `databases`, and dedicated list/detail endpoints provide current sub-resource state. Each nested database must be navigable under the parent service.

Supported database fields through `PATCH /services/{uuid}/databases/{database_uuid}`:

- `human_name`, `description`, and `image`
- `exclude_from_status` and `is_log_drain_enabled`
- `is_public`
- nullable integer `public_port` from 1–65535
- nullable integer `public_port_timeout` with minimum 1

Supported nested database operations:

- Bounded logs.
- Start/redeploy with optional `force` and `latest` query flags.
- Restart and stop.
- Swarm-specific 501 responses map to an unavailable capability, not a generic application error.

## Explicit omissions and conditional features

| Coolify UI item              | Warmify decision                                                                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Terminal                     | Omit. No public terminal API exists.                                                                                             |
| Webhooks                     | Omit at service level. The audited manifest exposes no service webhook endpoint.                                                 |
| Deployment history           | Omit at service level. Lifecycle endpoints exist, but no service deployment collection exists.                                   |
| Compose read/reveal          | Conditional on API ability. Never include compose content in SSR, SQLite, audit logs, or generic additional-data output.         |
| Backup schedule/history read | Omit refreshed history unless Coolify includes it in a storage response. Mutation endpoints alone do not justify invented state. |
| Swarm-only unsupported paths | Show a capability-unavailable state for documented 501/404/405 responses.                                                        |

## Phase 2 implementation order

1. Build the service presenter, hierarchy loader, shared layout, navigation, and header lifecycle actions.
2. Implement General, Compose, and Domains with section-scoped allowlists and 409 conflict preservation.
3. Reuse hardened environment-variable, storage/backup, scheduled-task, tag, and operation primitives with service endpoint adapters.
4. Add Runtime Logs with sub-resource selection, bounded polling, aborts, and stale-response protection.
5. Add nested application/database index and detail routes with their independent PATCH/lifecycle/log contracts.
6. Add the dedicated Danger route, stateful mock endpoints, presenter/action unit tests, and representative Playwright flows.
7. Run check, lint, all unit tests, focused service E2E, and build at the end of the Phase 2 block.
