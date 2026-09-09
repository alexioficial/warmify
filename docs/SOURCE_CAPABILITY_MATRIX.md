# Source capability matrix

Reference: Coolify commit `8d675f2e2`, especially `GithubController.php`,
`GitlabController.php`, the public API route declarations, and the matching source
settings views. Warmify uses only the public `/api/v1` API.

## Implemented public capabilities

| Provider | Capability               | Public endpoint                                              | Warmify route                       |
| -------- | ------------------------ | ------------------------------------------------------------ | ----------------------------------- |
| GitHub   | List apps                | `GET /github-apps`                                           | `/sources`                          |
| GitHub   | Create app               | `POST /github-apps`                                          | `/sources/new/github`               |
| GitHub   | Edit app                 | `PATCH /github-apps/{id}`                                    | `/sources/github/{id}/general`      |
| GitHub   | Delete app               | `DELETE /github-apps/{id}`                                   | `/sources/github/{id}/danger`       |
| GitHub   | List repositories        | `GET /github-apps/{id}/repositories`                         | `/sources/github/{id}/repositories` |
| GitHub   | List repository branches | `GET /github-apps/{id}/repositories/{owner}/{repo}/branches` | `/sources/github/{id}/repositories` |
| GitLab   | List apps                | `GET /gitlab-apps`                                           | `/sources`                          |
| GitLab   | Create app               | `POST /gitlab-apps`                                          | `/sources/new/gitlab`               |
| GitLab   | Edit app                 | `PATCH /gitlab-apps/{id}`                                    | `/sources/gitlab/{id}/general`      |
| GitLab   | Delete app               | `DELETE /gitlab-apps/{id}`                                   | `/sources/gitlab/{id}/danger`       |

The upstream CRUD and GitHub discovery endpoints use numeric database IDs, not
source UUIDs. Detail loaders therefore resolve the numeric route ID against the
provider list and the current team before allowing mutations or discovery.

## Ownership and shared sources

Coolify lists both current-team sources and system-wide sources. Its update, delete,
and GitHub discovery queries are current-team scoped. Warmify mirrors that behavior:
sources owned by another team remain visible as system-wide, but their detail is
read-only and has no repository or danger actions.

Deletion preserves Coolify's in-use refusal. Warmify never detaches or deletes
applications to bypass it.

## Secret boundary

Client secrets, webhook secrets/tokens, access tokens, refresh tokens, and private
key material are never projected into SSR data or SQLite. The combined source cache
is recursively redacted before writing and then rendered through an explicit
nonsecret presenter. Private-key choices contain only ID, UUID, name, and
description.

Creation accepts write-only credentials. Editing exposes blank replacement fields:
an empty input keeps the existing credential, while a nonempty input rotates it.
Mutation responses are not returned to the browser.

## Explicitly unavailable through the public API

- GitLab repository and branch discovery.
- GitHub/GitLab connection tests and provider registration callbacks.
- GitHub permission editing and installation administration.
- Listing resources attached to a source.
- Reading existing provider credentials.

These functions exist in Coolify's internal Livewire workflows or provider callback
flow, but Warmify does not invent endpoints or expose inert controls for them.
