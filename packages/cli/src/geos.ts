import { requireApi } from './api-helpers.js';
import { output } from './cli.js';

export async function handleGeos(): Promise<void> {
  const api = requireApi();
  const geos = await api.geos.list();
  return output({ geos, count: geos.length });
}
