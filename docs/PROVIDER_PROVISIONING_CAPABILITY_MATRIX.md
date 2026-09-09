# Provider provisioning capability matrix

Reference: Coolify commit `8d675f2e2`, especially `DigitalOceanController.php`,
`HetznerController.php`, `VultrController.php` and their provider services. Warmify
uses only the documented public `/api/v1` API.

## Supported provisioning

| Provider     | Lookup endpoints                                                       | Create endpoint              | Warmify route                     |
| ------------ | ---------------------------------------------------------------------- | ---------------------------- | --------------------------------- |
| DigitalOcean | regions, sizes, images, SSH keys                                       | `POST /servers/digitalocean` | `/servers/new/cloud/digitalocean` |
| Hetzner      | locations, server types, images, SSH keys, firewalls, private networks | `POST /servers/hetzner`      | `/servers/new/cloud/hetzner`      |
| Vultr        | regions, plans, operating systems, SSH keys                            | `POST /servers/vultr`        | `/servers/new/cloud/vultr`        |

Every provider lookup sends only `cloud_provider_token_uuid` as a query parameter.
The selected token must belong to the current team and match the provider. Provider
responses are projected to value, label and short description choices; SSH public
keys, fingerprints, raw provider payloads and credentials never enter SSR or audit
data.

Before creation, Warmify reloads the current-team tokens, private keys, cloud-init
metadata and every provider choice. Region, size/plan, image/OS and optional SSH
keys must still exist in those results. Hetzner firewall and private-network IDs are
checked the same way. Forged or stale values are rejected before the final POST.

## Provider-specific request bodies

- DigitalOcean sends token UUID, region, size, image, lowercase hostname, private
  key UUID, IPv6, monitoring, selected extra SSH key IDs, optional cloud-init and
  `instant_validate`.
- Hetzner sends token UUID, location, server type, numeric image ID, lowercase
  hostname, private key UUID, IPv4/IPv6, optional backups, SSH key/firewall/network
  IDs, optional cloud-init and `instant_validate`. At least one public IP protocol
  must remain enabled. Enabling backups is labelled as adding 20% to the fee.
- Vultr sends token UUID, region, plan, numeric OS ID, lowercase hostname, private
  key UUID, IPv6, public-IPv4 choice, selected SSH key IDs, optional cloud-init and
  `instant_validate`. Disabling public IPv4 requires IPv6.

The selected Coolify private key is automatically uploaded or reused by Coolify;
optional provider SSH keys are additional. `instant_validate` queues Coolify's
asynchronous validation after creation.

## Cloud-init boundary

The public provider create endpoints accept script content, not a cloud-init script
UUID. Warmify lists only script metadata. When a saved script is selected, the final
server-side action rechecks its UUID, retrieves its content directly from Coolify,
and places it only in the one provider creation request. The content is not returned
to the browser, cached, logged or preserved after the action.

## Billable-operation safety

The final submit requires the exact fresh phrase
`PROVISION <PROVIDER> <lowercase-hostname>`. This check runs before any prerequisite
or provider lookup in the final action. The create request is sent exactly once and
is never automatically retried.

Coolify attempts cleanup for some provider failure paths, but guarantees differ by
provider and failure timing. Therefore a 429, timeout or 5xx result is treated as
uncertain: Warmify discards upstream details, tells the operator to inspect both
Coolify and the provider account, and explicitly discourages automatic resubmission.

## Deliberate omissions

Warmify does not call provider APIs directly and never receives provider tokens in
the browser. It does not synthesize unsupported estimates or availability checks,
does not automatically retry provisioning, and does not imply that deleting the
Coolify server later deletes the external provider instance.
