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
await client.updateTargetGeo('us_ca');  // Target California
await client.updateTargetGeo('us_ny');  // Switch to New York
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
| `us_al` | Alabama |
| `us_ak` | Alaska |
| `us_az` | Arizona |
| `us_ar` | Arkansas |
| `us_ca` | California |
| `us_co` | Colorado |
| `us_ct` | Connecticut |
| `us_de` | Delaware |
| `us_fl` | Florida |
| `us_ga` | Georgia |
| `us_hi` | Hawaii |
| `us_id` | Idaho |
| `us_il` | Illinois |
| `us_in` | Indiana |
| `us_ia` | Iowa |
| `us_ks` | Kansas |
| `us_ky` | Kentucky |
| `us_la` | Louisiana |
| `us_me` | Maine |
| `us_md` | Maryland |
| `us_ma` | Massachusetts |
| `us_mi` | Michigan |
| `us_mn` | Minnesota |
| `us_ms` | Mississippi |
| `us_mo` | Missouri |
| `us_mt` | Montana |
| `us_ne` | Nebraska |
| `us_nv` | Nevada |
| `us_nh` | New Hampshire |
| `us_nj` | New Jersey |
| `us_nm` | New Mexico |
| `us_ny` | New York |
| `us_nc` | North Carolina |
| `us_nd` | North Dakota |
| `us_oh` | Ohio |
| `us_ok` | Oklahoma |
| `us_or` | Oregon |
| `us_pa` | Pennsylvania |
| `us_ri` | Rhode Island |
| `us_sc` | South Carolina |
| `us_sd` | South Dakota |
| `us_tn` | Tennessee |
| `us_tx` | Texas |
| `us_ut` | Utah |
| `us_vt` | Vermont |
| `us_va` | Virginia |
| `us_wa` | Washington |
| `us_wv` | West Virginia |
| `us_wi` | Wisconsin |
| `us_wy` | Wyoming |
| `us_dc` | District of Columbia |

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
