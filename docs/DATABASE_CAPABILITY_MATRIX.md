# Database capabilities

Reference: local Coolify commit `8d675f2e2`, `DatabasesController.php`, `routes/api.php`, database configuration sidebar, and engine-specific models/views. Warmify keeps the agreed light/plain styling and Project → Environment → Resource hierarchy.

## Physical screens

| Screen under `/databases/[uuid]` | Public contract                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| General                          | GET/PATCH database; name, description, image, instant_deploy                                                              |
| Credentials                      | Engine-specific username/database/password fields; passwords write-only, reveal on demand                                 |
| Initialization                   | PostgreSQL initdb args and host authentication method; no init-script mutation API                                        |
| Configuration                    | Engine config text, base64 encoded on PATCH; treat documents as write-only                                                |
| Networking                       | is_public, nullable public_port and public_port_timeout                                                                   |
| Healthcheck                      | enabled, interval, timeout, retries, start period                                                                         |
| Environment variables            | GET/POST/PATCH/bulk PATCH, UUID DELETE; key identifies PATCH, no application preview/build/runtime flags                  |
| Persistent storage               | GET/POST/PATCH/DELETE storages; same type-specific shapes as applications; no nested resource_uuid                        |
| Volume backups                   | PUT/DELETE storage backup settings and POST backup run; separate from database dumps                                      |
| Backups                          | GET/POST database backup schedules; PATCH/DELETE by schedule UUID; GET/DELETE executions                                  |
| Runtime logs                     | GET logs with bounded lines/timestamps; visibility-aware polling                                                          |
| Resource limits                  | Seven limits_* fields supported by database PATCH                                                                         |
| Servers                          | Read destination/server metadata; move/migrate uses resource operations                                                   |
| Tags                             | GET/POST tags; DELETE by tag UUID with typed confirmation                                                                 |
| Resource operations              | clone(destination_uuid,name?,clone_volumes), move(environment_uuid), migrate(destination_uuid,migrate_volumes)            |
| Danger                           | DELETE with exact name/UUID and explicit delete_configurations, delete_volumes, docker_cleanup, delete_connected_networks |

## Engine-specific PATCH fields

| Engine     | Credentials/initialization                                                                     | Config document |
| ---------- | ---------------------------------------------------------------------------------------------- | --------------- |
| PostgreSQL | postgres_user, postgres_password, postgres_db, postgres_initdb_args, postgres_host_auth_method | postgres_conf   |
| MySQL      | mysql_root_password, mysql_user, mysql_password, mysql_database                                | mysql_conf      |
| MariaDB    | mariadb_root_password, mariadb_user, mariadb_password, mariadb_database                        | mariadb_conf    |
| MongoDB    | mongo_initdb_root_username, mongo_initdb_root_password, mongo_initdb_database                  | mongo_conf      |
| Redis      | redis_password                                                                                 | redis_conf      |
| KeyDB      | keydb_password                                                                                 | keydb_conf      |
| Dragonfly  | dragonfly_password                                                                             | None            |
| ClickHouse | clickhouse_admin_user, clickhouse_admin_password                                               | None            |

All eight engines support common configuration, healthcheck, resource limits, variables, storage, logs and lifecycle. Detect engine from the API's type; do not guess from an image string when authorizing a PATCH. Only fields for the current engine and requested physical section may be sent. Config documents and passwords remain absent from SSR/action errors/cache. Changing initialization credentials may not change users in an already initialized data volume; show that caveat.

## Database backup contract

The pinned models enable native dumps for PostgreSQL, MySQL, MariaDB, MongoDB and ClickHouse. Redis, KeyDB and Dragonfly return false from `isBackupSolutionAvailable()`; show volume backups instead of native dump scheduling for those engines.

Create requires frequency. Update accepts partial fields. Both support enabled, save_s3, s3_storage_uuid, databases_to_backup, dump_all, timeout (60–36000), and six `database_backup_retention_{amount,days,max_storage}_{locally,s3}` fields. S3 destination is required when save_s3 is true. `backup_now:true` queues a run through create/update and requires explicit confirmation; there is no standalone database-dump `/run` endpoint. Check model support before showing dump scheduling; volume backups are a distinct capability.

Execution deletion and schedule deletion can remove backup archives, not only metadata; confirmations must say so. Preserve schedule identifiers and validate ownership by reading within the parent database before mutation. Do not expose execution logs or filenames as executable HTML.

Implemented under `/backups` and `/backups/[backup]`: create/edit schedules, separate confirmed `PATCH {backup_now:true}`, and history from the explicit executions endpoint. Schedule responses identify S3 destinations by numeric `s3_storage_id`; map that to a validated S3 UUID before editing. Retention counts/days are integers; maximum storage accepts fractional GB. Blank numeric inputs retain the current/default value and zero means unlimited. Neither `disable_local_backup` nor volume-backup-only fields are accepted by the native backup action.

Deletion always sends an explicit `delete_s3` query flag (false by default). Schedule deletion includes all local archives; execution deletion includes that archive. Known database credentials are scrubbed from execution messages, and unknown embedded execution fields are not serialized. The public API does not expose archive availability, download, restore or bulk cleanup; the UI does not invent those controls or statuses.

## Tags and resource operations

Tags use `tag_names` with deduplication and two-character minimum. Removal checks membership in the current database and requires the exact tag name. Clone, move and migration each require `operation + current database name`, fetched again before mutation. Clone redirects to the returned UUID's General route; move refreshes hierarchy; mutation invalidates database/project/resource snapshots. No raw mutation response is returned to the browser.

Clone and migrate share the reference service operation payload contract. Clone does not copy volume contents by default; migration does by default, with an explicit opt-out. The pinned `migrateResourceToDestination` helper is guarded by `isDev()`: migration is conditional, and 404/405/501 are reported as unavailable without retrying or falling back to internal APIs. Migration stops the resource; the UI reminds the user to start it after completion.

Danger requires the exact database name or UUID. All four cleanup flags are sent explicitly; absent flags are false. The database UI leaves cleanup unchecked by default and explains that keeping Docker resources does not keep the Coolify database record. Tests mutate only the local simulated API, never real databases.

## Explicit limitations

- No public Terminal, Metrics, backup import/restore, or init-script mutation endpoints: do not fabricate working controls.
- No database webhook management endpoint in the manifest. Keep omitted until supported.
- Healthcheck is supported by the actual controller even though its initial common-field list is incomplete: it merges five fields after engine validation.
- Connection URLs and init_scripts may contain credentials. Redact them before SSR/cache; reveal only on explicit authenticated action if Coolify allows sensitive reads.
- 404/405/501 capability failures must be distinguishable from empty successful results.

## Creation contracts

All eight engines use `POST /databases/{engine}` through an engine-specific action at the existing Project → Environment → New resource route. The project and environment come from route parameters, verified with the parent-scoped GET; hidden form fields cannot change that association. Only `environment_uuid` is sent, avoiding the reference controller's environment-name-first lookup.

The creation form exposes General, server/destination, engine credentials, PostgreSQL initialization, supported configuration documents, networking, seven resource limits and tags. Healthcheck fields are PATCH-only and omitted from creation. Empty optional inputs are omitted so Coolify generates credentials and supplies image/settings defaults. Configuration documents are UTF-8 base64 on the wire and write-only in the form. The action keeps only the returned UUID and redirects to General; returned connection URLs are not serialized into action data.

Creation public ports must be integers from 1024 through 65535. Enabling public access without a port produces a local field error instead of silently letting Coolify disable exposure. Tags are deduplicated and require at least two characters. Safe values and checkbox choices survive local/API validation errors; passwords and configuration documents are cleared. Accessible names stay stable when validation descriptions appear.

Eight-engine presenter/action contracts and PostgreSQL/Redis creation E2E cover endpoint selection, engine allowlisting, route ownership, default omission, configuration encoding, validation preservation and secret boundaries. See the roadmap for the current verification counts and remaining phase checks.

## Execution order

1. Engine-aware presenter, configuration actions, shared layout and physical routes.
2. Variables, storage/volume backups, bounded runtime logs and safe connection reveal.
3. Database-dump schedules/executions, tags, operations and danger.
4. Engine creation contract coverage, SQL/non-SQL E2E and full phase gate.

Status: implementation in progress; consult `WARMIFY_IMPLEMENTATION_ROADMAP.md` for validated checkpoints.
