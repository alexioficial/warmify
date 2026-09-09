# Project and environment contracts

Initial CRUD audit, 2026-09-04. Reference: sibling `coolify_reference` at
`8d675f2e2`. This is a Phase 4 implementation checkpoint, not a claim that shared
variables or application creation have already been audited or completed.

## Confirmed public API behavior

| Operation          | Endpoint                                                          | Writable fields / behavior                                    |
| ------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| Create project     | `POST /projects`                                                  | `name`, optional `description`; returns UUID with 201         |
| Edit project       | `PATCH /projects/{uuid}`                                          | `name`, `description`; returns UUID/name/description with 201 |
| Delete project     | `DELETE /projects/{uuid}`                                         | Refuses projects containing resources with 400                |
| Create environment | `POST /projects/{uuid}/environments`                              | **Only `name`**; duplicate name is 409; returns UUID with 201 |
| Edit environment   | `PATCH /projects/{uuid}/environments/{environment_name_or_uuid}`  | `name`, `description`; duplicate name is 409                  |
| Delete environment | `DELETE /projects/{uuid}/environments/{environment_name_or_uuid}` | Refuses environments containing resources with 400            |

Evidence: `app/Http/Controllers/Api/ProjectController.php`, methods
`create_project` (234), `update_project` (354), `delete_project` (466),
`create_environment` (624), `update_environment` (753), `delete_environment` (882).
The local endpoint manifest already includes these routes.

`app/Models/Project.php:53` creates the `production` environment in the project's
created callback. Warmify must not issue a second create-environment request when
creating a project. Deleting an empty project also removes its environments and
settings; the UI needs to explain this and require exact confirmation.

Environment mutation lookup tries the name before the UUID, scoped to the parent
project. Use route-owned UUIDs and check the parent's returned environment identity
before mutation; do not trust hidden form project/environment claims.

`app/Support/ValidationPatterns.php:417` defines names as 3–255 characters with
Unicode letters/marks/numbers, whitespace, and `- _ . @ / & ( ) # , : +`.
Descriptions are nullable, at most 255 characters, with a separate punctuation
allowlist. Match these validators or preserve safe API field errors; do not apply
an ASCII-only restriction. Creation requires a name; PATCH permits nullable names,
but Warmify's full edit form should require a usable display name.

## First implementation slice

- [x] Replace broad generic project route actions with focused project/environment actions.
- [x] Remove Description from environment creation and its POST payload.
- [x] Preserve safe name/description values and field errors after validation failures.
- [x] Redirect successful environment creation to its physical resource-selection route.
- [x] Add project and environment settings/danger routes with exact confirmation;
      preserve upstream nonempty-resource refusal and never cascade-delete resources.
- [x] Invalidate project/resource inventory after mutations and key forms by parent UUID/section.
- [x] Add contract and browser cases for default production, create/edit/delete,
      duplicate names, populated deletion refusal, parent identity and browser history.

## Follow-on audits

- [x] Audit project/environment shared-variable controllers, numeric variable IDs,
      ownership, writable fields and redaction in `SHARED_VARIABLE_CONTRACTS.md`.
- [x] Audit remaining application/service creation variants against their own
      controller branches in `RESOURCE_CREATION_CONTRACTS.md`. Database creation
      is handled by the Phase 3 form. GitLab App creation is unavailable because
      the public API has no corresponding endpoint.

Run verification as one meaningful block, not after every edit. All mutations in
automated validation must target the local simulated Coolify API.
