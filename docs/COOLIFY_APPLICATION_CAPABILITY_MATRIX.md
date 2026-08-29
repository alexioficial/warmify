# Coolify Application Capability Matrix

This document freezes the application-management contract Warmify will implement. It distinguishes the Coolify web UI from Coolify's documented public API so that Warmify can follow the same mental model without calling internal Livewire routes or pretending unsupported operations exist.

## Frozen reference

- Repository: `C:\Users\pc\Desktop\_\Programming\Widube\coolify_reference`
- Commit: `8d675f2e2`
- Describe: `v4.3.14-4-g8d675f2e2`
- UI route source: `routes/web.php`
- UI navigation source: `resources/views/components/application/configuration-sidebar.blade.php`
- Public route source: `routes/api.php`
- Application API source: `app/Http/Controllers/Api/ApplicationsController.php`
- Backup API source: `app/Http/Controllers/Api/VolumeBackupsController.php`
- Scheduled-task API source: `app/Http/Controllers/Api/ScheduledTasksController.php`
- Shared API validation source: `bootstrap/helpers/api.php`

The reference is intentionally frozen. A later Coolify update requires a new audit and an explicit compatibility decision rather than silently changing Warmify's behavior.

## Status meanings

| Status      | Meaning in Warmify                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| Full        | The public API exposes the reads and mutations required for the core screen.                                                |
| Partial     | Some Coolify UI behavior has no public endpoint; Warmify implements only the documented subset and explains the limitation. |
| Conditional | The operation is documented but is restricted by resource type, server type, version, or Coolify runtime behavior.          |
| Omitted     | There is no documented public API capable of implementing the screen safely.                                                |

## Route and screen matrix

Every supported destination must be a physical route under `/applications/[uuid]`. A row marked Partial is still a physical route if its supported portion is useful. Omitted rows must not appear as actionable navigation.

| Coolify screen        | Coolify sections and primary fields                                                                                                 | Public operation(s)                                                                                                                                        | Status      | Warmify decision                                                                                                                                                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| General               | Application details, Access, Build pipeline, Container image, Networking, Runtime, Security, Deployment lifecycle, Container labels | `GET /applications/{uuid}`, `PATCH /applications/{uuid}`                                                                                                   | Partial     | Split the large Coolify page into focused physical routes. All PATCH-supported fields are editable. Raw Dockerfile/Compose editors and label-management mode are not editable because PATCH does not accept them.                               |
| Domains               | Domain rows, redirects, search indexing, force HTTPS, DNS checks, generated domains                                                 | `GET /applications/{uuid}`, `PATCH /applications/{uuid}`                                                                                                   | Partial     | Manage `domains`, `noindex_domains`, `redirect`, and `is_force_https_enabled`. Handle 409 conflicts with an explicit `force_domain_override` confirmation. Coolify's internal DNS-check and domain-generation actions are unavailable.          |
| Advanced              | Build, Container, Deployment, Git, Docker Compose, Proxy, Operations, Logs, GPU                                                     | `GET /applications/{uuid}`, `PATCH /applications/{uuid}`                                                                                                   | Full        | Show sections conditionally by Git/build-pack/server capability and enforce the same cross-field constraints locally.                                                                                                                           |
| Swarm                 | Replicas, worker-only placement, placement constraints                                                                              | `GET /applications/{uuid}` only                                                                                                                            | Omitted     | `swarm_replicas`, `is_swarm_only_worker_nodes`, and `swarm_placement_constraints` are not accepted by public PATCH. Do not create a nonfunctional form.                                                                                         |
| Environment Variables | Runtime/build/preview variables, literal/multiline/show-once flags, comments, bulk update                                           | `GET/POST/PATCH /applications/{uuid}/envs`, `PATCH /applications/{uuid}/envs/bulk`, `DELETE /applications/{uuid}/envs/{env_uuid}`                          | Full        | CRUD and bulk upsert are supported. Values remain masked unless a sensitive/root token response is explicitly requested server-side.                                                                                                            |
| Persistent Storage    | Persistent volumes, file mounts, directory mounts, host-file mounts, preview suffix                                                 | `GET/POST/PATCH /applications/{uuid}/storages`, `DELETE /applications/{uuid}/storages/{storage_uuid}`                                                      | Full        | Respect type-specific and read-only restrictions returned by Coolify. File content is sensitive and never cached or embedded in SSR unless deliberately revealed.                                                                               |
| Backups               | Schedule, local/S3 target, stop during backup, retention, timeout, executions, danger                                               | `PUT /applications/{uuid}/storages/{storage_uuid}/backups`, `POST .../backups/run`, `DELETE .../backups`                                                   | Partial     | Create/replace, run, and delete a per-storage schedule. The public API has no standalone GET schedule or executions endpoint, and the storage list does not guarantee either relation, so Warmify cannot reproduce backup history after reload. |
| Terminal              | Interactive commands in the running container                                                                                       | None                                                                                                                                                       | Omitted     | No public terminal/exec API exists.                                                                                                                                                                                                             |
| Deployment Logs       | Application deployment list and deployment detail/log output                                                                        | `GET /deployments/applications/{uuid}`, `GET /deployments/{deployment_uuid}`, `POST /deployments/{deployment_uuid}/cancel`                                 | Full        | Structured deployment table and detail page with visible-tab polling for active deployments.                                                                                                                                                    |
| Runtime Logs          | Container log tail, line count, timestamps                                                                                          | `GET /applications/{uuid}/logs?lines=&show_timestamps=`                                                                                                    | Full        | Text log viewer with bounded line count and visible-tab polling.                                                                                                                                                                                |
| Git Source            | Repository, branch, commit, provider/deploy-key association                                                                         | `GET /applications/{uuid}`, `PATCH /applications/{uuid}`                                                                                                   | Partial     | `git_repository`, `git_branch`, and `git_commit_sha` are editable. Public PATCH cannot change `github_app_id`, `private_key_id`, or provider association.                                                                                       |
| Servers               | Primary and additional deployment destinations                                                                                      | `GET/POST /applications/{uuid}/destinations`, `DELETE /applications/{uuid}/destinations/{destination_uuid}`                                                | Full        | Present the screen as Destinations/Servers while preserving Coolify terminology. The primary destination cannot be removed.                                                                                                                     |
| Scheduled Tasks       | Task CRUD, enabled state, execution, execution history                                                                              | `GET/POST /applications/{uuid}/scheduled-tasks`, `PATCH/DELETE /applications/{uuid}/scheduled-tasks/{task_uuid}`, `GET .../executions`, `POST .../execute` | Full        | Use dedicated task and execution routes/forms. Execute and delete require confirmation.                                                                                                                                                         |
| Webhooks              | Deploy webhook URL and manual Git provider secrets                                                                                  | `GET /applications/{uuid}`, `PATCH /applications/{uuid}`                                                                                                   | Partial     | Edit documented manual provider secrets. A deploy webhook URL may be displayed only if it can be derived without calling an internal endpoint. Secrets never return in SSR HTML.                                                                |
| Preview Deployments   | URL template, pull requests, manual Docker-image preview, deployed previews                                                         | `PATCH /applications/{uuid}`, `DELETE /applications/{uuid}/previews/{pull_request_id}`                                                                     | Partial     | Edit `preview_url_template` and preview-related settings. Allow deletion only when a pull-request identifier is already available from a documented response. No public preview list/create/deploy endpoint exists.                             |
| Healthcheck           | Configuration, command or HTTP request, timing/retries                                                                              | `GET /applications/{uuid}`, `PATCH /applications/{uuid}`                                                                                                   | Full        | Hide for Docker Compose applications, matching Coolify.                                                                                                                                                                                         |
| Rollback              | Image retention and available images                                                                                                | `PATCH /applications/{uuid}`, `GET /applications/{uuid}/rollback-images`, `POST /applications/{uuid}/rollback`                                             | Full        | `docker_images_to_keep` controls retention. Rollback requires explicit confirmation and uses an image tag/commit returned by Coolify.                                                                                                           |
| Resource Limits       | CPU and memory limits                                                                                                               | `GET /applications/{uuid}`, `PATCH /applications/{uuid}`                                                                                                   | Full        | Dedicated route with typed numeric/text inputs.                                                                                                                                                                                                 |
| Resource Operations   | Clone, move between environments, migrate to destination/server                                                                     | `POST /applications/{uuid}/clone`, `POST .../move`, `POST .../migrate`                                                                                     | Conditional | Clone and move are public. The frozen controller guards migration with `isDev()` and returns 404 otherwise, so Warmify treats migrate as an unavailable/version-dependent capability when rejected.                                             |
| Metrics               | CPU/memory graphs and live resource samples                                                                                         | None                                                                                                                                                       | Omitted     | No documented application metrics API exists.                                                                                                                                                                                                   |
| Tags                  | Tag list, attach/create, detach                                                                                                     | `GET/POST /applications/{uuid}/tags`, `DELETE /applications/{uuid}/tags/{tag_uuid}`                                                                        | Full        | Tags are rows, not raw JSON.                                                                                                                                                                                                                    |
| Danger Zone           | Delete configuration, volumes, connected networks, Docker cleanup                                                                   | `DELETE /applications/{uuid}` with documented query flags                                                                                                  | Full        | Dedicated route; require the exact application name or UUID before submission.                                                                                                                                                                  |
| Header actions        | Deploy/start, restart, stop                                                                                                         | `POST /applications/{uuid}/start`, `POST .../restart`, `POST .../stop`                                                                                     | Full        | Mutations stay in the shared header. Stop and restart require confirmation; no lifecycle mutation uses GET.                                                                                                                                     |

## General and Advanced PATCH field matrix

All fields below are accepted by the frozen `PATCH /applications/{uuid}` controller. Warmify converts UI camelCase labels to these API names and sends only fields owned by the submitted form.

| Warmify route/section | Public fields                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Application details   | `name`, `description`                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Access and domains    | `domains`, `noindex_domains`, `redirect`, `is_force_https_enabled`, `force_domain_override`                                                                                                                                                                                                                                                                                                                                                                  |
| Build pipeline        | `build_pack`, `is_static`, `is_spa`, `static_image`, `install_command`, `build_command`, `start_command`, `base_directory`, `publish_directory`, `watch_paths`, `dockerfile_location`, `dockerfile_target_build`, `docker_compose_location`, `docker_compose_custom_start_command`, `docker_compose_custom_build_command`, `docker_compose_domains`, `custom_nginx_configuration`, `use_build_server`, `use_build_secrets`, `is_preserve_repository_enabled` |
| Container image       | `docker_registry_image_name`, `docker_registry_image_tag`                                                                                                                                                                                                                                                                                                                                                                                                    |
| Networking            | `ports_exposes`, `ports_mappings`, `custom_network_aliases`, `connect_to_docker_network`                                                                                                                                                                                                                                                                                                                                                                     |
| Runtime               | `custom_docker_run_options`, `max_restart_count`, `stop_grace_period`, `is_consistent_container_name_enabled`, `custom_internal_name`                                                                                                                                                                                                                                                                                                                        |
| Security              | `is_http_basic_auth_enabled`, `http_basic_auth_username`, `http_basic_auth_password`                                                                                                                                                                                                                                                                                                                                                                         |
| Deployment lifecycle  | `pre_deployment_command`, `pre_deployment_command_container`, `post_deployment_command`, `post_deployment_command_container`                                                                                                                                                                                                                                                                                                                                 |
| Container labels      | `custom_labels`, `is_container_label_escape_enabled`                                                                                                                                                                                                                                                                                                                                                                                                         |
| Deployment behavior   | `is_auto_deploy_enabled`, `is_preview_deployments_enabled`, `is_pr_deployments_public_enabled`, `preview_url_template`                                                                                                                                                                                                                                                                                                                                       |
| Git behavior/source   | `git_repository`, `git_branch`, `git_commit_sha`, `is_git_submodules_enabled`, `is_git_lfs_enabled`, `is_git_shallow_clone_enabled`, `disable_build_cache`, `inject_build_args_to_dockerfile`, `include_source_commit_in_build`                                                                                                                                                                                                                              |
| Compose behavior      | `is_raw_compose_deployment_enabled`                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Proxy                 | `is_gzip_enabled`, `is_stripprefix_enabled`                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Logs                  | `is_log_drain_enabled`                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| GPU                   | `is_gpu_enabled`, `gpu_driver`, `gpu_count`, `gpu_device_ids`, `gpu_options`                                                                                                                                                                                                                                                                                                                                                                                 |
| Environment display   | `is_env_sorting_enabled`                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Healthcheck           | `health_check_enabled`, `health_check_type`, `health_check_command`, `health_check_path`, `health_check_port`, `health_check_host`, `health_check_method`, `health_check_return_code`, `health_check_scheme`, `health_check_response_text`, `health_check_interval`, `health_check_timeout`, `health_check_retries`, `health_check_start_period`                                                                                                             |
| Resource limits       | `limits_memory`, `limits_memory_swap`, `limits_memory_swappiness`, `limits_memory_reservation`, `limits_cpus`, `limits_cpuset`, `limits_cpu_shares`                                                                                                                                                                                                                                                                                                          |
| Rollback retention    | `docker_images_to_keep`                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Manual webhooks       | `manual_webhook_secret_github`, `manual_webhook_secret_gitlab`, `manual_webhook_secret_bitbucket`, `manual_webhook_secret_gitea`                                                                                                                                                                                                                                                                                                                             |

### PATCH fields intentionally not represented as ordinary text

- `custom_labels` and `custom_nginx_configuration` are base64-encoded for the public API. Warmify edits decoded text server-side and encodes it immediately before the request.
- `http_basic_auth_password` and manual webhook secrets are write-only UI values. Existing secret values must not be put into page data.
- `force_domain_override` is a one-request acknowledgement after a 409 conflict, not a persistent checkbox.
- `instant_deploy` appears in the controller allowlist but is meaningful during creation, not as a durable detail-page setting.

### Coolify UI fields not accepted by public PATCH

These must not be presented as working editors:

- Raw `dockerfile`, `docker_compose`, and `docker_compose_raw` content.
- Label management mode `is_container_label_readonly_enabled`.
- Git provider/deploy-key association such as `github_app_id` and `private_key_id`.
- Swarm fields `swarm_replicas`, `is_swarm_only_worker_nodes`, and `swarm_placement_constraints`.
- Internal DNS checks, generated-domain actions, source switching, terminal commands, and metrics collection.

## Environment variable shape

Create, single update, and bulk upsert accept the documented variable fields:

- `key`
- `value`
- `is_preview`
- `is_literal`
- `is_multiline`
- `is_shown_once`
- `is_runtime`
- `is_buildtime`
- `comment`

Single update identifies the record by normalized `key` plus `is_preview`; deletion uses `env_uuid`. The API may reveal `value`/`real_value` only for a token with `read:sensitive` or `root`. Warmify still redacts the normal SSR/list path and performs any reveal through an authenticated, allowlisted server endpoint.

## Persistent storage and backup shapes

Storage creation supports:

- Persistent: `type=persistent`, `name`, `mount_path`, optional `host_path`.
- Managed file: `type=file`, `mount_path`, optional `content`.
- Directory: `type=file`, `mount_path`, `is_directory=true`, `fs_path`.
- Host file: `type=file`, `mount_path`, `is_host_file=true`, `fs_path`.

Storage update requires `type` and `uuid` (or deprecated numeric `id`). `is_preview_suffix_enabled` is always eligible; mutable name/path/content fields depend on storage type and Coolify's read-only determination.

The backup schedule replacement body supports:

- `frequency`, `enabled`, `stop_during_backup`, `timeout`
- `save_s3`, `s3_storage_uuid`, `disable_local_backup`
- `retention_amount_locally`, `retention_days_locally`, `retention_max_storage_locally`
- `retention_amount_s3`, `retention_days_s3`, `retention_max_storage_s3`

Only persistent volumes and directory file storages can be backed up. A schedule must be deleted before its storage can be deleted. The public API does not expose a dedicated GET for an existing volume schedule or its executions.

## Scheduled task shape

Create and update use `name`, `command`, `frequency`, optional `container`, `timeout`, and `enabled`. The list and executions endpoints are read operations. Execute is a confirmed mutation; task deletion is destructive.

## Creation variants

The frozen public API exposes five application creation operations:

| Variant                       | Endpoint                                | Required source identity                                   |
| ----------------------------- | --------------------------------------- | ---------------------------------------------------------- |
| Public Git repository         | `POST /applications/public`             | `git_repository`, `git_branch`, `build_pack`               |
| Private GitHub App repository | `POST /applications/private-github-app` | `github_app_uuid`, repository/branch fields, `build_pack`  |
| Private deploy-key repository | `POST /applications/private-deploy-key` | `private_key_uuid`, repository/branch fields, `build_pack` |
| Inline Dockerfile application | `POST /applications/dockerfile`         | Dockerfile content and application placement fields        |
| Docker/OCI image application  | `POST /applications/dockerimage`        | `docker_registry_image_name` and optional tag              |

Every creation variant also requires `project_uuid`, `server_uuid`, and at least one of `environment_name` or `environment_uuid`; `destination_uuid` is required when the selected server has multiple destinations. Docker Compose from Git is a `build_pack=dockercompose` application. A directly entered Compose definition follows Coolify's Services API and is not a sixth application endpoint.

## Complete public application operation inventory

This is the allowlist that `src/lib/server/endpoint-manifest.test.ts` freezes:

```text
GET    /applications
POST   /applications/public
POST   /applications/private-github-app
POST   /applications/private-deploy-key
POST   /applications/dockerfile
POST   /applications/dockerimage
GET    /applications/{uuid}
PATCH  /applications/{uuid}
DELETE /applications/{uuid}
GET    /applications/{uuid}/logs
GET    /applications/{uuid}/envs
POST   /applications/{uuid}/envs
PATCH  /applications/{uuid}/envs
PATCH  /applications/{uuid}/envs/bulk
DELETE /applications/{uuid}/envs/{env_uuid}
POST   /applications/{uuid}/start
POST   /applications/{uuid}/stop
POST   /applications/{uuid}/restart
POST   /applications/{uuid}/move
POST   /applications/{uuid}/migrate
POST   /applications/{uuid}/clone
GET    /applications/{uuid}/storages
POST   /applications/{uuid}/storages
PATCH  /applications/{uuid}/storages
DELETE /applications/{uuid}/storages/{storage_uuid}
PUT    /applications/{uuid}/storages/{storage_uuid}/backups
POST   /applications/{uuid}/storages/{storage_uuid}/backups/run
DELETE /applications/{uuid}/storages/{storage_uuid}/backups
DELETE /applications/{uuid}/previews/{pull_request_id}
GET    /applications/{uuid}/tags
POST   /applications/{uuid}/tags
DELETE /applications/{uuid}/tags/{tag_uuid}
GET    /applications/{uuid}/rollback-images
POST   /applications/{uuid}/rollback
GET    /applications/{uuid}/destinations
POST   /applications/{uuid}/destinations
DELETE /applications/{uuid}/destinations/{destination_uuid}
GET    /applications/{uuid}/scheduled-tasks
POST   /applications/{uuid}/scheduled-tasks
PATCH  /applications/{uuid}/scheduled-tasks/{task_uuid}
DELETE /applications/{uuid}/scheduled-tasks/{task_uuid}
GET    /applications/{uuid}/scheduled-tasks/{task_uuid}/executions
POST   /applications/{uuid}/scheduled-tasks/{task_uuid}/execute
GET    /deployments/applications/{uuid}
GET    /deployments/{deployment_uuid}
POST   /deployments/{deployment_uuid}/cancel
```

The GET lifecycle routes present in `routes/api.php` are deliberately excluded. They only return “POST required” and are not functional operations.

## Capability and security rules

- Treat documented-but-unavailable 404/405 responses as capability mismatches where the matrix says Partial or Conditional.
- Never retry a mutation automatically.
- Map 401/403 to token configuration or permission errors, 409 to an explicit conflict flow, 429 to `Retry-After`, and timeout/5xx to a manual retry state.
- A root or `read:sensitive` token can cause Coolify to return fields hidden from ordinary tokens. Warmify must still recursively redact normal SSR, error, audit, and cache paths.
- `GET /applications/{uuid}` includes application settings, but consumers must tolerate unknown fields and show them only inside recursively redacted `<details>`.
- Start/restart/stop, cancel, rollback, execute task, move, migrate, clone-with-volumes, backup run, and backup deletion require an explicit confirmation step appropriate to their risk.
- Application deletion requires exact name or UUID and exposes the four documented cleanup flags deliberately rather than relying invisibly on API defaults.

## Implementation order derived from this matrix

1. Shared application shell, capability-aware navigation, and breadcrumbs.
2. PATCH-backed General/Advanced sections, domains, healthchecks, resource limits, and secrets handling.
3. Environment variables and persistent storage CRUD.
4. Volume backup replacement/run/delete with a clear partial-capability notice.
5. Deployment/runtime logs and visible-tab polling.
6. Scheduled tasks, destinations, rollback, tags, resource operations, and danger.
7. Partial Git Source, Webhooks, and Preview Deployments screens.
8. Explicitly omit Swarm, Terminal, and Metrics until documented public endpoints exist.
