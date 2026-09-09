# Cloud security capability matrix

Reference: Coolify commit `8d675f2e2`, especially
`CloudProviderTokensController.php`, `CloudInitScriptsController.php`,
`CloudProviderToken.php`, `CloudInitScript.php`, `ValidCloudInitYaml.php`, and the
corresponding security views. Warmify uses only the public `/api/v1` API.

## Cloud provider tokens

| Capability                  | Public endpoint                      | Warmify route                           |
| --------------------------- | ------------------------------------ | --------------------------------------- |
| List token metadata         | `GET /cloud-tokens`                  | `/security/cloud-tokens`                |
| Validate and create a token | `POST /cloud-tokens`                 | `/security/cloud-tokens/new`            |
| Read one token's metadata   | `GET /cloud-tokens/{uuid}`           | `/security/cloud-tokens/{uuid}/general` |
| Rename a token              | `PATCH /cloud-tokens/{uuid}`         | `/security/cloud-tokens/{uuid}/general` |
| Validate the stored token   | `POST /cloud-tokens/{uuid}/validate` | `/security/cloud-tokens/{uuid}/general` |
| Delete an unused token      | `DELETE /cloud-tokens/{uuid}`        | `/security/cloud-tokens/{uuid}/danger`  |

The supported provider enum is exactly `hetzner`, `digitalocean`, or `vultr`.
Creation sends only provider, token and name; Coolify validates the provider token
before storing it. The public update endpoint accepts only `name`, so Warmify does
not display an inert rotation form. Replacing a credential requires creating a new
token and moving dependent servers through a supported workflow.

Token list/detail views contain only UUID, name, provider, server count and
timestamps. The provider token is write-only and never enters SSR, an action result,
audit metadata, or SQLite. Validation returns only a local valid/invalid result;
provider response text is discarded. Deletion requires an exact name or UUID and
is refused locally when `servers_count` is nonzero, matching Coolify's own guard.

## Cloud-init scripts

| Capability                 | Public endpoint                     | Warmify route                                 |
| -------------------------- | ----------------------------------- | --------------------------------------------- |
| List script metadata       | `GET /cloud-init-scripts`           | `/security/cloud-init-scripts`                |
| Create a script            | `POST /cloud-init-scripts`          | `/security/cloud-init-scripts/new`            |
| Read one script's metadata | `GET /cloud-init-scripts/{uuid}`    | `/security/cloud-init-scripts/{uuid}/general` |
| Rename or replace a script | `PATCH /cloud-init-scripts/{uuid}`  | `/security/cloud-init-scripts/{uuid}/general` |
| Delete a script            | `DELETE /cloud-init-scripts/{uuid}` | `/security/cloud-init-scripts/{uuid}/danger`  |

Coolify accepts cloud-config YAML, ordinary valid YAML, or a shell script beginning
with a shebang. Warmify performs stable local presence/name checks and leaves YAML
parsing authoritative to Coolify.

Script content is write-only in Warmify. It is required when creating a script; on
edit, a blank replacement keeps the existing content while a nonblank replacement
is sent with the name. The presenter exposes only UUID, name and timestamps. The
recursive cache redactor treats `script` as a sensitive document key, so even a
sensitive-read upstream response cannot persist a script body in SQLite. Deletion
requires the exact name or UUID.

## Deliberate omissions

Warmify does not expose raw credential or script reveal actions. The public API has
no cloud-token rotation operation, so none is synthesized. Provider-specific server
creation is a separate billable workflow and is not implied by storing a token; it
must resolve choices through each provider's documented lookup endpoints and require
fresh typed confirmation before the final create request.
