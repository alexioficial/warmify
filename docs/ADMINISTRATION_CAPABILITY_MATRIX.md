# Administration capability matrix

Reference: Coolify commit `8d675f2e2`, especially `SecurityController.php`,
`TeamController.php`, `SharedEnvironmentVariablesController.php`, the `PrivateKey`
model, and their route declarations. Warmify uses only documented public
`/api/v1` endpoints.

## Private keys

| Capability                         | Public endpoint                                       | Warmify route                                               |
| ---------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------- |
| List key metadata                  | `GET /security/keys`                                  | `/security/keys`                                            |
| Create a key                       | `POST /security/keys`                                 | `/security/keys/new`                                        |
| Read one key                       | `GET /security/keys/{uuid}`                           | `/security/keys/{uuid}`                                     |
| Update metadata or rotate material | `PATCH /security/keys/{uuid}`                         | `/security/keys/{uuid}`                                     |
| Delete an unused key               | `DELETE /security/keys/{uuid}`                        | `/security/keys/{uuid}`                                     |
| Reveal available material          | `GET /security/keys/{uuid}` with `can_read_sensitive` | Explicit same-origin POST to `/security/keys/{uuid}/reveal` |

Create sends only optional `name`, optional `description`, and required
`private_key`. Coolify requires `private_key` again on every PATCH. Warmify
therefore accepts an optional replacement: when blank, the server fetches and
reuses the current material only if the API token has sensitive-read permission;
otherwise it asks for a replacement instead of submitting an incomplete update.

List, detail, cache and ordinary action results expose only UUID, name,
description, public key, fingerprint, relationship flag and timestamps. Private
material is never stored in SQLite, audit data, failed form values, or SSR. An
explicit reveal is authenticated, same-origin, fresh, `no-store`, and returns only
the selected key material. Hiding it removes the value from the rendered page.

Deletion requires the exact name or UUID. Coolify's in-use rejection is translated
to a stable message explaining that attached servers, applications, or Git
integrations must be updated first; upstream details are not relayed.

## Teams and members

| Capability            | Public endpoint           | Warmify route |
| --------------------- | ------------------------- | ------------- |
| List token-bound team | `GET /teams`              | `/teams`      |
| Read team metadata    | `GET /teams/{id}`         | `/teams/{id}` |
| List members          | `GET /teams/{id}/members` | `/teams/{id}` |

Although the API route is plural, `/teams` returns only the team associated with
the current API token. Team IDs and shared-variable IDs are numeric. Member rows
are projected to name, email, verification, two-factor, password-reset and created
metadata; authentication material and unexpected fields are discarded.

The public API has no member invitation, role, removal, ownership transfer, or team
settings mutation. Warmify deliberately presents membership as read-only and does
not synthesize controls backed by private Livewire endpoints.

## Team shared variables

| Capability                  | Public endpoint          | Warmify route                                                      |
| --------------------------- | ------------------------ | ------------------------------------------------------------------ |
| List current-team variables | `GET /team/envs`         | `/teams/{id}/shared-variables`                                     |
| Create a variable           | `POST /team/envs`        | Same physical route                                                |
| Update a variable           | `PATCH /team/envs/{id}`  | Same physical route                                                |
| Delete a variable           | `DELETE /team/envs/{id}` | Same physical route                                                |
| Reveal an available value   | Fresh `GET /team/envs`   | Explicit same-origin POST to `/teams/{id}/shared-variables/reveal` |

Every load, mutation and reveal first fetches `GET /team` and verifies that the
route ID equals the current token's team. The payload allowlist is `key`, `value`,
`comment`, `is_literal`, `is_multiline`, and `is_shown_once`. Updates offer explicit
keep, replace and clear semantics; deletion requires the exact key.

Values are omitted from SSR and SQLite. Reveal is authenticated, same-origin,
fresh and `no-store`. Shown-once values remain unrevealable after creation, matching
Coolify's contract. Mutation responses are discarded because they may echo
plaintext values.

## Validation evidence

- Presenter, route-action and team-scope contracts: 35 focused unit tests passed.
- Browser coverage: two focused scenarios passed for private-key lifecycle and
  team/member/shared-variable navigation and mutations, including secret-boundary,
  wrong-confirmation and cross-origin assertions.

## Notification settings

Each channel has a dedicated Warmify route under `/notifications/{channel}` and a
matching current-team public API pair:

| Channel  | Public read/write endpoint          |
| -------- | ----------------------------------- |
| Email    | `GET/PATCH /notifications/email`    |
| Discord  | `GET/PATCH /notifications/discord`  |
| Slack    | `GET/PATCH /notifications/slack`    |
| Telegram | `GET/PATCH /notifications/telegram` |
| Pushover | `GET/PATCH /notifications/pushover` |
| Webhook  | `GET/PATCH /notifications/webhook`  |

All fourteen public event switches are represented for every channel. Email also
supports SMTP, Resend, instance-email selection, port, encryption, timeout and EHLO
domain. Discord exposes ping behavior. Telegram includes a protected optional
thread ID for every event.

Every model-hidden or encrypted value uses explicit keep, replace or clear
semantics. This includes SMTP identity/recipient/host/credentials, Resend key,
Discord/Slack/custom webhook URLs, Telegram token/chat/thread IDs, and Pushover
keys. Those values are never serialized into SSR, action values, audit data, or
SQLite; the upstream PATCH response is discarded because it may contain decrypted
values. Safe booleans and non-secret numeric/select fields are projected through a
channel-specific allowlist.

Notification validation adds 9 focused unit contracts plus one browser scenario
that loads all six routes and edits Discord and Email while asserting submitted and
upstream secrets never appear in rendered HTML. The same-origin rejection is
covered at the action-contract level.

## System

| Capability                           | Public endpoint     | Warmify route         |
| ------------------------------------ | ------------------- | --------------------- |
| Instance health                      | `GET /health`       | `/system`             |
| Coolify version/protected-read probe | `GET /version`      | `/system`             |
| Enable the public API                | `POST /enable`      | `/system?/enableApi`  |
| Disable the public API               | `POST /disable`     | `/system?/disableApi` |
| Enable the MCP endpoint              | `POST /mcp/enable`  | `/system?/enableMcp`  |
| Disable the MCP endpoint             | `POST /mcp/disable` | `/system?/disableMcp` |

Health, version and current-team capability are fetched independently with
`no-store`, so the recovery page remains useful when Coolify itself is healthy but
protected API reads are disabled. The API-enable endpoint is intentionally called
without a preliminary `/team` read because `/enable` remains outside Coolify's
`ApiAllowed` middleware; Coolify still enforces root-team ownership. All disable
and MCP operations perform a fresh `/team` check for team ID `0` before mutation.

The public API does not expose `is_api_enabled` or `is_mcp_server_enabled`, so
Warmify reports those states as unavailable instead of inferring them from button
clicks. Every action requires an exact typed phrase, is same-origin, is issued once
without retries, discards the upstream response, and writes only safe audit
metadata. The API-disable form warns that all Warmify resource access stops until
the API is enabled again externally or through the recovery page.

System validation adds 8 focused unit contracts and one non-root browser scenario;
the latter verifies health/version presentation, access-loss warning and disabled
root-only controls without mutating the mock instance.
