# Resource creation contracts

Pinned read-only reference: Coolify `8d675f2e2`. Phase 4, 2026-09-04.

## Docker source slice

- Inline Dockerfile: POST `/applications/dockerfile`, `dockerfile` is UTF-8 text
  encoded as base64, despite the OpenAPI description saying only “content”.
  Controller decodes it, detects exposed port (fallback 80), sets build pack and
  synthesizes Git metadata. Do not send a repository or claim manual ports apply.
- Docker image: POST `/applications/dockerimage`. `docker_registry_image_name`
  may already contain `:tag` or `@sha256:hash`; appending a default tag breaks those.
  A separate optional `docker_registry_image_tag` is appended before parsing.
  A separate digest input is a Warmify convenience encoded into the image string,
  not an invented API field. Port numbers and domains are optional.
- Compose: POST `/services` with base64 `docker_compose_raw`, not an application.
  Do not send a template `type` with inline Compose. YAML/injection validation is
  performed by Coolify. Service URLs can be configured after creation.
- Common: route-owned project/environment UUIDs, selected server and optional
  destination; name/description/instant deploy. Blank optional values are omitted.
  Both controllers look up environment name before UUID; send UUID only after
  verifying the project and environment returned for the route.
- Multiple server destinations require explicit selection. Coolify verifies
  destination membership and resource-hosting capability. Warmify preserves errors
  but does not bypass those validations or retry mutations.
- POST returns a UUID and possibly domains. Discard all other response data and
  redirect to the physical application/service general page. If deployment was
  skipped and the response contains no UUID, return to the environment, no retry.
- Source documents are write-only and never restored into SSR/action data. Parser
  errors can contain fragments, so return generic creation/field errors instead of
  forwarding backend error text. Session auth and explicit same-origin checks apply.

## Evidence

- `ApplicationsController.php:1181–1350`: common allowlist, parent/server/destination
  lookup. `2049–2188`: inline Dockerfile. `2189–2314`: image validation/parser.
- `ServicesController.php:360–475,587–770`: common validation and inline Compose.
- `app/Rules/DockerImageFormat.php`, `app/Services/DockerImageParser.php`,
  `app/Support/ValidationPatterns.php:138,146`: image, tag and digest contracts.

## Status

- [x] Audit the three Docker-source public contracts.
- [x] Focused helper, conditional forms, safe errors and route-owned identity.
- [x] Unit contracts and browser coverage: 20 new unit cases and three browser
      scenarios; full suite 231/231 units and 31/31 E2E, zero check diagnostics,
      lint/build pass, client fixture-secret scan clean and diff-check pass.
- [x] Audit and rebuild Git-based creation, conditional build options and supported
      GitHub discovery. GitLab App creation stays unavailable without a public API.
- [x] Reconcile service-template creation against the public catalog and endpoint.
- [x] Complete Phase 4 creation gate. Database creation is already validated.

The first unit run found HTTP multipart CRLF normalization in two expected payloads,
not broken base64 encoding. Expectations now account for transport line endings.
The first type check found two test typing issues and the missing optional `error`
prop on the creation form. These were fixed before the successful final gate.

## Git creation slice

Audited `ApplicationsController.php:1336–2048` (public, GitHub App, deploy key),
`:4431` (application validation), `bootstrap/helpers/api.php:113` (shared fields)
and `:366` (request cleanup), plus `ValidGitRepositoryUrl` and `ValidGitBranch`.

- POST `/applications/public`, `/applications/private-deploy-key` and
  `/applications/private-github-app` require repository, branch and build pack.
  Private variants also require the selected key/App UUID. They all create
  applications, including the Git-backed Compose build pack.
- Supported build packs: railpack, nixpacks, static, dockerfile, dockercompose.
  Compose forbids ordinary `domains`, supplies port 80 internally and loads the
  Compose file from Git (also when immediate deployment is disabled). Warmify's
  conditional fields exclude ordinary domains and exposed ports for Compose.
- GitHub App creation verifies repository access inside Coolify. It accepts an
  owner/repository shorthand; HTTP GitHub URLs are normalized by the controller.
  Branches follow the pinned validator, not unrestricted arbitrary shell text.
- `GithubController.php:350,467` discovery uses **numeric App IDs**, whereas
  application creation sends **UUIDs**. Returned repositories and branches are
  normalized to metadata only. Branch lookup requires a repository from the
  selected App's list. Failed discovery has a generic error and manual repository/
  branch entry remains available. No token is sent to GitHub from the browser.
- Parent UUIDs and selected credential membership are checked before POST; no
  name-first environment lookup or form-owned parent IDs. Optional blanks omit
  defaults. Inline credentials in repository URLs are rejected and not restored.
- Custom commands are write-only. Backend messages/field errors can contain
  credential or command fragments, so errors are generic and safe drafts exclude
  commands. Successful creation redirects to the physical application general page.
- Physical new-resource routes now dispatch focused database/Docker/Git helpers;
  obsolete generic action and template branches were removed from those routes.

Git verification complete: unit tests 256/256 (27 files), check zero diagnostics,
lint, 34/34 full-suite E2E and production build passed. Client fixture-secret scan
found no matches and diff-check passed. No real Coolify mutations were performed.
Initial validation exposed a test hook returning a cleanup function and a Svelte
formatter/parser issue in a ternary each expression; fixed before the final tests.

## Service-template creation slice

`ServicesController.php:476–587` supports `POST /services` with a template `type`,
mutually exclusive with `docker_compose_raw`. It reads the installed template
bundle, creates generated variables, parses containers, applies prerequisites and
optionally starts the service. Returns UUID/domains, or a 404 with valid type names.
The complete services API route list has no read-only catalog endpoint. The bundle
is internal/CDN-backed (`bootstrap/helpers/shared.php:1422`), not an API GET.
Warmify provides explicit template-type input and explains this catalog limitation.
It never probes using an invalid POST. Suggestions are accepted only from a failed
creation the user actually submitted, normalized to unique valid identifiers.

`template-creation.ts` sends only type, server/destination, optional name/description,
tags, label escaping and instant-deploy fields, plus verified route-owned parent
UUIDs. Generated credentials/containers remain Coolify-owned. Initial domain
overrides are configured on the service detail page after creation, not exposed by
this creation form. Tags are trimmed/deduplicated. Optional blanks omit defaults.
Responses expose only the created UUID through the physical redirect; errors and
field messages never echo parser output. `ResourceCreationForm.svelte` now serves
both Docker and service-template variants (renamed from DockerCreationForm).

The first full browser gate found missing environments produced an unhandled
upstream 404 and therefore a Warmify 500. Both new-resource page loaders now map
that case to a safe 404 while preserving other failures and parent identity checks.
The regression covers both routes and unsupported kinds.

Final creation gate: 268/268 unit contracts (28 files), 36/36 full-suite E2E,
zero check diagnostics and production build passed on 2026-09-04. Final lint and
client fixture-secret scan are recorded in the handoff. No real API mutations.
