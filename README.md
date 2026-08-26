# Warmify

Warmify is a small, server-rendered administrative wrapper for the public Coolify API. Coolify remains the only source of truth; Warmify stores no resources or users in a database and never sends the Coolify API token to the browser.

## Configuration

Copy `.env.example` to `.env` and set:

- `COOLIFY_BASE_URL`: the trusted Coolify instance URL, with or without `/api/v1`.
- `COOLIFY_API_TOKEN`: a token able to perform the operations you expose. The intended single-admin deployment uses a root token.
- `WARMIFY_ADMIN_USERNAME`: the Warmify login username.
- `WARMIFY_ADMIN_PASSWORD`: the Warmify login password in plain text, as requested. Protect the `.env` file with operating-system permissions and do not commit it.
- `WARMIFY_SESSION_TTL_HOURS`: session lifetime; defaults to 12 hours.
- `WARMIFY_REQUEST_TIMEOUT_MS`: upstream request timeout; defaults to 15000 ms.

Warmify derives its cookie-signing key internally from `WARMIFY_ADMIN_PASSWORD`; changing the password invalidates existing sessions. Deploy behind HTTPS so production session cookies can use the `Secure` flag.

## Development

```sh
bun install --frozen-lockfile
bun run dev
```

Quality checks:

```sh
bun run check
bun run lint
bun run test
bun run test:e2e
bun run build
```

Playwright uses a local Coolify simulation and never mutates a real instance. Install its browser once with `bun x playwright install chromium`.

## API coverage and safety

`src/lib/server/endpoint-manifest.ts` is an allowlisted snapshot of the official Coolify OpenAPI document from 2026-08-25. It includes projects/environments, applications, services, databases/backups, deployments, servers, destinations, sources, storage, scheduled tasks, shared variables, teams, notifications, system operations and supported cloud providers.

The normal interface follows Coolify's Project → Environment → Resource workflow. Projects expose their nested applications, services and databases; resource pages provide contextual lifecycle controls, configuration, environment variables, deployments, logs, storage, backups and scheduled tasks where the public API supports them. The new-resource flow supports public repositories, Docker images, services and every documented database engine.

The complete API catalogue remains available as an unlinked advanced fallback for uncommon or newly introduced operations. It is not the primary management interface. There is no arbitrary upstream URL proxy.

## Route structure

Each resource family has its own physical SvelteKit route instead of passing through a generic `/manage/[group]` page. Collection and detail pages live under paths such as `/projects`, `/projects/[uuid]`, `/applications/[uuid]`, `/services/[uuid]`, `/databases/[uuid]`, `/deployments/[uuid]` and `/servers/[uuid]`. Infrastructure and administration follow the same pattern under `/destinations`, `/storage`, `/security/keys` and `/teams`.

The route files are intentionally separate customization points, while common API, authentication, auditing and currently shared rendering logic stays in `src/lib/server` and `src/lib/components`. `/manage` is not retained as an alias. Only the unlinked advanced API catalogue uses the dynamic `/operations/[group]` route.

- Upstream responses are recursively redacted before SSR and error rendering.
- Sensitive GET responses require an explicit Reveal action and are loaded only then.
- Stop, restart, cancel, move, migrate, rollback and similar actions require explicit confirmation.
- Deletes require typing the first resource identifier exactly.
- Mutations are never retried automatically.
- Warmify emits metadata-only audit events to stdout and does not log request bodies or credentials.

The public Coolify API is version-dependent. Warmify displays the connected version and reports unsupported endpoints without inventing internal Coolify functionality such as the browser terminal.

## Production image

The included multi-stage `dockerfile` builds the SvelteKit Node adapter output and runs it with Bun on port 3000. Supply the environment variables at runtime rather than baking `.env` into the image.
