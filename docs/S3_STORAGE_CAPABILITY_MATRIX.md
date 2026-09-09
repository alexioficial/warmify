# S3 storage capability matrix

Reference: Coolify commit `8d675f2e2`, especially
`S3StoragesController.php`, `S3Storage.php`, `ValidS3BucketName.php`, and the
storage index/create/form/show views. Warmify uses only the public `/api/v1` API.

## Implemented public capabilities

| Capability                          | Public endpoint                     | Warmify route             |
| ----------------------------------- | ----------------------------------- | ------------------------- |
| List storage destinations           | `GET /s3-storages`                  | `/storage`                |
| Create a destination                | `POST /s3-storages`                 | `/storage/new`            |
| Read one destination                | `GET /s3-storages/{uuid}`           | `/storage/{uuid}/general` |
| Edit metadata and connection fields | `PATCH /s3-storages/{uuid}`         | `/storage/{uuid}/general` |
| Validate with `ListObjectsV2`       | `POST /s3-storages/{uuid}/validate` | `/storage/{uuid}/general` |
| Delete a destination                | `DELETE /s3-storages/{uuid}`        | `/storage/{uuid}/danger`  |

The detail helper checks that the UUID returned by Coolify exactly matches the route
before any mutation. Creation and update send only the controller's documented
allowlist. Local validation mirrors stable syntax rules for names, descriptions,
HTTP(S) endpoints, bucket names, region and credential lengths; Coolify remains
authoritative for DNS/instance allowlists and provider connectivity.

Changing endpoint, bucket, region or credentials marks the destination unvalidated.
The explicit Validate action lets Coolify perform `ListObjectsV2` and set the usable
state. Provider error text is not returned to the browser because it can contain
endpoint or credential detail.

## Secret boundary

Access and secret keys are write-only in Warmify. They are required on creation and
represented as blank keep-or-replace inputs on edit. The list/detail presenters
contain only UUID, name, description, endpoint, bucket, region, usable state, team
ID and timestamps. SQLite receives a recursively redacted list response. Upstream
mutation and validation response bodies are not serialized into the UI.

## Deletion behavior

Deletion requires the exact storage name or UUID. It removes the configuration from
Coolify, not objects already present in the external bucket. Backup schedules using
the destination will stop writing to S3; Warmify does not rewrite those schedules or
delete provider objects as a side effect.

## Not exposed by the public S3 storage API

Coolify's storage Resources page can list and move database and volume backup
schedules, but those aggregate queries/actions are internal Livewire behavior.
Warmify does not invent a storage-scoped resources endpoint. Backup destinations
remain selectable in the already implemented database/application/service backup
workflows where their public APIs provide the necessary context.
