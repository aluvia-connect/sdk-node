---
title: Geo targeting
description: Route traffic through mobile IPs in specific US states
sidebar_position: 3
---

# Geo targeting

Geo targeting lets you route traffic through mobile IPs in specific US states. 

## Benefits

- **Geographic IP diversity**: Distribute requests across IPs from different US states to avoid concentration patterns that trigger blocks.
- **Test localized experiences**: Verify that your application behaves correctly for users in different states.


## How to geo target IPs using the Aluvia client

Use `updateTargetGeo()` to change your target state at runtime:

```ts
await client.updateTargetGeo('us-ca');  // Target California
await client.updateTargetGeo('us-ny');  // Switch to New York
await client.updateTargetGeo(null);     // Clear geo targeting
```

Changes take effect immediately—no restart required.

See Manage Connections for examples.


## How to geo target IPs using `-geo` parameter

In instances where you cannot use the SDK or API (e.g. using a 3rd party proxy client), you can geo target IPs by adding the `-geo` parameter and a geography to your connection's username.

```
myusername-geo-ca
```

This format works with any HTTP client that supports proxy authentication.

## Available states

| Code | State |
|------|-------|
| `us-al` | Alabama |
| `us-ak` | Alaska |
| `us-az` | Arizona |
| `us-ar` | Arkansas |
| `us-ca` | California |
| `us-co` | Colorado |
| `us-ct` | Connecticut |
| `us-de` | Delaware |
| `us-fl` | Florida |
| `us-ga` | Georgia |
| `us-hi` | Hawaii |
| `us-id` | Idaho |
| `us-il` | Illinois |
| `us-in` | Indiana |
| `us-ia` | Iowa |
| `us-ks` | Kansas |
| `us-ky` | Kentucky |
| `us-la` | Louisiana |
| `us-me` | Maine |
| `us-md` | Maryland |
| `us-ma` | Massachusetts |
| `us-mi` | Michigan |
| `us-mn` | Minnesota |
| `us-ms` | Mississippi |
| `us-mo` | Missouri |
| `us-mt` | Montana |
| `us-ne` | Nebraska |
| `us-nv` | Nevada |
| `us-nh` | New Hampshire |
| `us-nj` | New Jersey |
| `us-nm` | New Mexico |
| `us-ny` | New York |
| `us-nc` | North Carolina |
| `us-nd` | North Dakota |
| `us-oh` | Ohio |
| `us-ok` | Oklahoma |
| `us-or` | Oregon |
| `us-pa` | Pennsylvania |
| `us-ri` | Rhode Island |
| `us-sc` | South Carolina |
| `us-sd` | South Dakota |
| `us-tn` | Tennessee |
| `us-tx` | Texas |
| `us-ut` | Utah |
| `us-vt` | Vermont |
| `us-va` | Virginia |
| `us-wa` | Washington |
| `us-wv` | West Virginia |
| `us-wi` | Wisconsin |
| `us-wy` | Wyoming |
| `us-dc` | District of Columbia |

### Fetch available states programmatically

Use the API to get the current list of available states:

```ts
import { AluviaApi } from '@aluvia/sdk';

const api = new AluviaApi({ apiKey: process.env.ALUVIA_API_KEY! });
const geos = await api.geos.list();

for (const geo of geos) {
  console.log(`${geo.code}: ${geo.label}`);
}
```


## Related

- [Connections](connections.md) — Understand connection attributes including `target_geo`
