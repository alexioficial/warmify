# Project and environment shared variables

Phase 4 audit, 2026-09-04. Read-only source: sibling `coolify_reference`, commit
`8d675f2e2`. Scoped implementation completed and verified on 2026-09-04.

## API contract

Project collection: `/projects/{uuid}/envs`.
Environment collection:
`/projects/{uuid}/environments/{environment_name_or_uuid}/envs`.

- GET returns an array of scoped variables; POST creates one and returns `{ id }`
  with status 201.
- PATCH and DELETE address **integer `env_id`**, appended to the collection path.
  This differs from application/database variable UUIDs and PATCH-by-key behavior.
- Writable fields are `key`, `value`, `is_literal`, `is_multiline`,
  `is_shown_once`, `comment`. No preview, build-time or runtime flags.
- Creation requires a key. The API trims it, permits
  `[A-Za-z_][A-Za-z0-9_.]*`, and limits it to 255 characters. Case is preserved.
- Values are nullable strings. Comments are nullable strings, max 256 characters.
- PATCH accepts partial updates, including renaming the key. An omitted `value`
  preserves its current value; do not accidentally replace it with an empty input.
  Require an explicit replacement choice, including intentional clearing.
- Duplicate keys in the same scope return 409. Missing/out-of-scope IDs return 404.
- Successful PATCH returns the variable model and can include the value when the
  token may read sensitive fields. **Discard this response before action data.**
- GET can include `value` when `can_read_sensitive` is true, but `is_shown_once`
  always hides it. Missing values must not be invented or treated as empty strings.
- No shared-variable bulk endpoint exists in the frozen manifest. Do not reuse
  resource variable bulk APIs or silently issue a sequence of mutations.

## Ownership and safety

The controller resolves projects by the token's team and UUID. Environment lookup
tries its name first, then UUID, within that project. Read the route-owned parent
and verify environment UUID identity before writes, as in the new CRUD actions.
Variable lookup filters by ID, type, team and project/environment scope. Warmify
should independently verify the selected ID before update/delete and require the
loaded key as exact deletion confirmation, not a hidden form claim.

SSR must contain only allowlisted variable metadata. Values must stay out of SQLite,
action errors, audit logs and navigation state. If adding reveal, use an explicit
authenticated same-origin no-store request; handle missing permission and
shown-once values as unavailable, and clear revealed values when switching parents.

## Implementation order

- [x] Add shared-variable-specific presentation and submission helpers; do not
      identify rows by resource `env_uuid` or send application-only flags.
- [x] Add physical `shared-variables` routes under projects and environments,
      linked from their settings navigation and using complete breadcrumbs.
- [x] Implement scoped list/create/edit/delete and write-only replacement values.
- [x] Add on-demand reveal only after auditing the existing internal reveal boundary.
- [x] Cover numeric IDs, key rename, omitted/replaced/cleared values, duplicate keys,
      wrong parent, exact confirmation, API error redaction and safe update responses.
- [x] Add browser coverage for both scopes, draft reset and secret boundaries.
- [x] Batch check, unit tests, lint, browser scenarios and build at block completion.

The dedicated reveal routes require authentication and explicit same-origin JSON
requests, return only the selected value with `Cache-Control: no-store`, and refuse
shown-once or unavailable values. The generic internal reveal endpoint was not
expanded. Reveal state is cleared on hide, navigation and destruction; pending
requests are cancelled. Variable values never enter inventory caching or SSR.

Verification: 211 unit tests (25 files), 28 full-suite browser scenarios, zero
check diagnostics, lint and production build passed. Client fixture-secret scan
found no matches; diff-check passed. No real Coolify mutations were performed.

## Source evidence

`app/Http/Controllers/Api/SharedEnvironmentVariablesController.php`:
allowlist/redaction/validation and CRUD helpers (17–282), parent resolution
(284–315), project handlers (452, 487, 522, 562), environment handlers
(603, 644, 685 and the following DELETE handler).
`app/Models/SharedEnvironmentVariable.php`: hidden encrypted `value`, no public UUID
identity, scoped ownership. `app/Support/ValidationPatterns.php:109,151–172`:
key normalization and validation. Existing Warmify endpoint manifest includes
project/environment collection and integer-ID mutation paths.
